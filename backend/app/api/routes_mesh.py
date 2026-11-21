"""
PolyGen External Mesh Ingestion & Texture Processing API Router
Provides endpoints to upload external 3D models (OBJ, GLB), parameterize UVs,
apply procedural or neural Stable Diffusion textures, compile glTF PBR assets,
and store them in AssetStorageService.
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator

from mesh_processing.pipeline import MeshProcessingPipeline, PipelineConfig, PipelineResult
from mesh_processing.mesh_simplifier import MeshSimplifier
from ..services.storage import asset_storage
from texture_engine.texture_config import TextureStyle, TextureGeneratorProvider
from texture_engine.texture_generator import TextureGenerator
from texture_engine.stable_diffusion_provider import StableDiffusionProvider

router = APIRouter(prefix="/mesh", tags=["Mesh Processing"])

# Maximum upload file size: 50 MB
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024
SUPPORTED_FORMATS = {"obj", "glb"}
VALID_STYLES = {s.value for s in TextureStyle}

# Async semaphore to restrict concurrent neural diffusion model inference to 1 job at a time,
# preventing Apple Silicon Unified Memory and GPU VRAM exhaustion.
_diffusion_concurrency_semaphore = asyncio.Semaphore(1)


class MeshProcessConfig(BaseModel):
    """Pydantic validation model for mesh processing parameters."""
    texture_provider: str = Field("procedural", description="Texture synthesis backend: 'procedural' or 'stable_diffusion'")
    texture_style: Optional[str] = Field("scifi", description="Material style preset")
    texture_prompt: Optional[str] = Field(None, description="Custom prompt guiding texture appearance")
    texture_resolution: int = Field(512, ge=64, le=2048, description="Square resolution in pixels (e.g. 256, 512, 1024)")
    texture_seed: Optional[int] = Field(None, description="Deterministic seed for reproducible texturing")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt for neural diffusion")
    fallback_to_procedural: bool = Field(True, description="Allow procedural fallback if neural model is unavailable")
    title: Optional[str] = Field(None, description="Human-readable asset title")
    metallic_factor: float = Field(0.2, ge=0.0, le=1.0, description="PBR metallic factor")
    roughness_factor: float = Field(0.6, ge=0.0, le=1.0, description="PBR roughness factor")
    enable_optimization: bool = Field(False, description="Whether to decimate mesh polygon count using QEM")
    target_faces: Optional[int] = Field(None, ge=1, description="Target face count for simplified mesh")
    reduction_ratio: Optional[float] = Field(None, gt=0.0, lt=1.0, description="Fraction of faces to eliminate")

    @field_validator("texture_provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in ["procedural", "stable_diffusion"]:
            raise ValueError(f"Invalid texture_provider: '{v}'. Must be 'procedural' or 'stable_diffusion'.")
        return cleaned

    @field_validator("texture_style")
    @classmethod
    def validate_style(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip().lower()
        if cleaned not in VALID_STYLES:
            raise ValueError(
                f"Invalid texture_style: '{v}'. Supported styles are: {', '.join(sorted(VALID_STYLES))}."
            )
        return cleaned


class MeshProcessResponse(BaseModel):
    """Response contract returning processed asset metadata, formats, and verification telemetry."""
    success: bool
    asset_id: str
    title: str
    format_uploaded: str
    poly_count: int
    vertex_count: int
    requested_texture_provider: str
    actual_texture_provider: str
    is_fallback: bool
    texture_style: Optional[str] = None
    texture_resolution: List[int]
    formats: Dict[str, str]
    download_url: str
    metrics: Dict[str, Any]
    warnings: List[str] = []


@router.get("/capabilities", response_model=Dict[str, Any])
async def get_mesh_capabilities():
    """Returns supported formats, file limits, and texture provider capabilities."""
    sd_info = StableDiffusionProvider.get_device_info()
    sd_available = TextureGenerator.get_provider("stable_diffusion").is_available
    return {
        "supported_formats": sorted(list(SUPPORTED_FORMATS)),
        "max_upload_size_bytes": MAX_UPLOAD_SIZE_BYTES,
        "max_upload_size_mb": MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        "texture_providers": {
            "procedural": {
                "available": True,
                "supported_styles": sorted(list(VALID_STYLES)),
            },
            "stable_diffusion": {
                "available": sd_available,
                "default_model": StableDiffusionProvider.DEFAULT_MODEL_ID,
                "device_info": sd_info,
            },
        },
        "qem_simplification": {
            "available": MeshSimplifier.is_engine_available(),
            "algorithm": MeshSimplifier.ALGORITHM_NAME,
        },
    }


@router.post("/process", response_model=MeshProcessResponse, status_code=status.HTTP_201_CREATED)
async def process_external_mesh(
    file: UploadFile = File(..., description="External 3D mesh file in Wavefront OBJ (.obj) or glTF binary (.glb) format"),
    texture_provider: str = Form("procedural", description="Texture synthesis backend: 'procedural' or 'stable_diffusion'"),
    texture_style: Optional[str] = Form("scifi", description="Procedural style: metallic, wood, stone, marble, carbon_fiber, fabric, ceramic, scifi, organic"),
    texture_prompt: Optional[str] = Form(None, description="Custom prompt guiding texture appearance"),
    texture_resolution: int = Form(512, description="Square texture resolution (128, 256, 512, 1024, 2048)"),
    texture_seed: Optional[int] = Form(None, description="Deterministic seed for reproducibility"),
    negative_prompt: Optional[str] = Form(None, description="Negative prompt for neural diffusion"),
    fallback_to_procedural: bool = Form(True, description="Allow procedural fallback if neural model is unavailable"),
    title: Optional[str] = Form(None, description="Asset title"),
    metallic_factor: float = Form(0.2, description="PBR metallic factor (0.0 to 1.0)"),
    roughness_factor: float = Form(0.6, description="PBR roughness factor (0.0 to 1.0)"),
    enable_optimization: bool = Form(False, description="Whether to decimate mesh polygon count using QEM"),
    target_faces: Optional[int] = Form(None, description="Target face count for simplified mesh"),
    reduction_ratio: Optional[float] = Form(None, description="Fraction of faces to eliminate (0.0 to 1.0)"),
):
    """
    Ingests an external 3D model (OBJ or GLB), validates geometry, generates UVs,
    synthesizes and maps textures (procedural or Stable Diffusion), builds PBR materials,
    exports binary GLB, and registers the asset in storage.
    """
    # 1. Parameter Validation via Pydantic
    try:
        config_params = MeshProcessConfig(
            texture_provider=texture_provider,
            texture_style=texture_style,
            texture_prompt=texture_prompt,
            texture_resolution=texture_resolution,
            texture_seed=texture_seed,
            negative_prompt=negative_prompt,
            fallback_to_procedural=fallback_to_procedural,
            title=title,
            metallic_factor=metallic_factor,
            roughness_factor=roughness_factor,
            enable_optimization=enable_optimization,
            target_faces=target_faces,
            reduction_ratio=reduction_ratio,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid mesh processing configuration: {str(e)}",
        )

    # 2. File Format and Extension Validation
    filename = file.filename or "uploaded_model"
    ext = Path(filename).suffix.lower().lstrip(".")
    if not ext or ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext or 'unknown'}'. Supported formats are: {', '.join(sorted(SUPPORTED_FORMATS))}.",
        )

    # 3. Safe File Reading & Size Boundary Check
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file size ({file_size / (1024 * 1024):.1f} MB) exceeds maximum allowed limit of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # 4. Format-Specific Magic Header / Syntax Pre-Validation
    if ext == "glb":
        if not file_bytes.startswith(b"glTF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed GLB file: Binary header does not start with glTF magic bytes ('glTF').",
            )
    elif ext == "obj":
        try:
            head_sample = file_bytes[:2048].decode("utf-8", errors="replace")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed OBJ file: File content could not be decoded as text.",
            )
        # Check that file contains vertex coordinates (space or tab delimited)
        has_vertices = any(line.strip().startswith(('v ', 'v\t')) for line in head_sample.splitlines())
        if not has_vertices:
            # Check full file if first 2KB had comments/mtl headers
            full_text = file_bytes.decode("utf-8", errors="replace")
            if not any(line.strip().startswith(('v ', 'v\t')) for line in full_text.splitlines()[:500]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Malformed OBJ file: No geometric vertex declarations ('v ') found in mesh.",
                )

    # 5. Asset Title Resolution
    resolved_title = (
        config_params.title
        or Path(filename).stem.replace("_", " ").replace("-", " ").title()
    )

    # 6. Configure Mesh Processing Pipeline
    pipeline_cfg = PipelineConfig(
        apply_texture=True,
        generate_procedural_texture=(config_params.texture_provider == "procedural"),
        texture_provider=config_params.texture_provider,
        texture_style=config_params.texture_style,
        texture_prompt=config_params.texture_prompt or resolved_title,
        texture_negative_prompt=config_params.negative_prompt,
        texture_resolution=config_params.texture_resolution,
        texture_seed=config_params.texture_seed,
        texture_fallback_to_procedural=config_params.fallback_to_procedural,
        use_calibration_texture=False,
        metallic_factor=config_params.metallic_factor,
        roughness_factor=config_params.roughness_factor,
        material_name=f"{resolved_title.replace(' ', '_')}_PBR_Material",
        enable_optimization=config_params.enable_optimization,
        target_faces=config_params.target_faces,
        reduction_ratio=config_params.reduction_ratio,
    )

    # 7. Execute Pipeline with Concurrency Guard for Stable Diffusion
    def _run_pipeline() -> PipelineResult:
        return MeshProcessingPipeline.process_mesh(
            mesh_source=io.BytesIO(file_bytes),
            file_type=ext,
            config=pipeline_cfg,
            title=resolved_title,
        )

    if config_params.texture_provider == "stable_diffusion":
        async with _diffusion_concurrency_semaphore:
            pipe_res = await asyncio.to_thread(_run_pipeline)
    else:
        pipe_res = await asyncio.to_thread(_run_pipeline)

    if not pipe_res.success:
        err_msg = "; ".join(pipe_res.errors) if pipe_res.errors else "Unknown mesh processing failure."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Mesh processing pipeline failed: {err_msg}",
        )

    # 8. Save Processed Asset in AssetStorageService
    actual_provider = pipe_res.attributes.get("actual_texture_provider", config_params.texture_provider)
    is_fallback = pipe_res.attributes.get("is_fallback", False)

    asset = asset_storage.save_asset(
        title=resolved_title,
        prompt=config_params.texture_prompt or f"Ingested {ext.upper()} model with {actual_provider} texture",
        provider="external_ingestion",
        style=config_params.texture_style or "scifi",
        glb_bytes=pipe_res.glb_bytes,
        obj_str=pipe_res.obj_str,
        stl_bytes=pipe_res.stl_bytes,
        poly_count=pipe_res.poly_count,
        vertex_count=pipe_res.vertex_count,
        tags=[ext, "external-mesh", actual_provider, "textured"],
        attributes={
            "source_filename": filename,
            "source_format": ext,
            "requested_provider": config_params.texture_provider,
            "actual_provider": actual_provider,
            "is_fallback": is_fallback,
            **pipe_res.attributes,
        },
        negative_prompt=config_params.negative_prompt,
        is_demo=False,
    )

    # 9. Format Response
    metrics_summary = {
        "is_watertight": pipe_res.attributes.get("is_watertight", False),
        "surface_area": pipe_res.attributes.get("surface_area", 0.0),
        "dimensions": pipe_res.attributes.get("dimensions", [0, 0, 0]),
        "uv_chart_count": pipe_res.attributes.get("uv_chart_count", 0),
        "seam_vertex_duplications": pipe_res.attributes.get("seam_vertex_duplications", 0),
        "round_trip_success": (pipe_res.round_trip_report or {}).get("round_trip_success", True),
        "optimization": pipe_res.attributes.get("optimization_metrics", {}),
    }

    return MeshProcessResponse(
        success=True,
        asset_id=asset.id,
        title=resolved_title,
        format_uploaded=ext,
        poly_count=pipe_res.poly_count,
        vertex_count=pipe_res.vertex_count,
        requested_texture_provider=config_params.texture_provider,
        actual_texture_provider=actual_provider,
        is_fallback=is_fallback,
        texture_style=config_params.texture_style,
        texture_resolution=[config_params.texture_resolution, config_params.texture_resolution],
        formats=asset.formats,
        download_url=asset.formats.get("glb", f"/api/assets/{asset.id}/download/glb"),
        metrics=metrics_summary,
        warnings=pipe_res.warnings,
    )
