"""
PolyGen Mesh Processing & Asset Pipeline Orchestrator
Coordinates geometric validation, automatic UV parameterization, texture mapping,
glTF 2.0 PBR material preparation, and binary GLB/OBJ/STL compilation.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np
from pydantic import BaseModel, Field
import trimesh

from .mesh_validator import MeshValidator, MeshValidationReport, MeshValidationError
from .uv_unwrapper import UVUnwrapper, UVUnwrapOptions, UVUnwrapResult
from .texture_mapper import (
    TextureMapper,
    TextureMappingError,
    MaterialConfig,
    TextureMappingResult,
)
from .mesh_simplifier import MeshSimplifier, SimplificationOptions, SimplificationResult

try:
    from texture_engine.texture_generator import TextureGenerator
    from texture_engine.texture_config import TextureConfig
except (ImportError, ValueError):
    from ..texture_engine.texture_generator import TextureGenerator
    from ..texture_engine.texture_config import TextureConfig


class PipelineConfig(BaseModel):
    """Configuration options governing asset processing through the pipeline."""
    apply_texture: bool = Field(True, description="Whether to apply a texture to the unwrapped mesh")
    generate_procedural_texture: bool = Field(False, description="Synthesize procedural texture if no image is provided")
    use_calibration_texture: bool = Field(True, description="Generate checkerboard texture if no image is provided and procedural texturing is disabled")
    texture_prompt: Optional[str] = Field(None, description="Text prompt guiding texture generation")
    texture_style: Optional[str] = Field(None, description="Explicit texture style (e.g. metallic, wood, stone, marble, scifi)")
    texture_palette: Optional[List[str]] = Field(None, description="Color palette override for texture generation")
    texture_seed: Optional[int] = Field(None, description="Deterministic seed for texture generation")
    texture_provider: str = Field("procedural", description="Texture synthesis backend provider ('procedural' or 'stable_diffusion')")
    texture_negative_prompt: Optional[str] = Field(None, description="Negative prompt for neural diffusion")
    texture_num_inference_steps: int = Field(25, ge=1, le=150, description="Inference steps for diffusion")
    texture_guidance_scale: float = Field(7.5, ge=1.0, le=20.0, description="CFG guidance scale")
    texture_model_id: Optional[str] = Field(None, description="Hugging Face model checkpoint for diffusion")
    texture_fallback_to_procedural: bool = Field(True, description="Allow procedural fallback if neural diffusion is unavailable")
    texture_resolution: int = Field(512, ge=128, le=4096, description="Resolution for generated or mapped textures")
    uv_padding: int = Field(2, ge=0, le=64, description="Texel padding between UV charts")
    metallic_factor: float = Field(0.2, ge=0.0, le=1.0, description="PBR metallic factor")
    roughness_factor: float = Field(0.6, ge=0.0, le=1.0, description="PBR roughness factor")
    material_name: str = Field("PolyGen_Material", description="PBR material identifier")
    enable_optimization: bool = Field(False, description="Whether to decimate mesh polygon count using QEM")
    target_faces: Optional[int] = Field(None, ge=1, description="Target face count for simplified mesh")
    reduction_ratio: Optional[float] = Field(None, gt=0.0, lt=1.0, description="Fraction of faces to eliminate")


class PipelineResult(BaseModel):
    """Output contract produced by MeshProcessingPipeline."""
    success: bool = Field(..., description="True if pipeline completed all stages without fatal error")
    title: str = Field("Processed Asset", description="Title or prompt identifier of the asset")
    glb_bytes: bytes = Field(default=b"", description="Self-contained binary glTF 2.0 (.glb) container")
    obj_str: str = Field(default="", description="Wavefront OBJ representation with 'vt' texture coordinates")
    stl_bytes: bytes = Field(default=b"", description="Binary stereolithography (.stl) mesh data")
    poly_count: int = Field(0, description="Final face/polygon count")
    vertex_count: int = Field(0, description="Final vertex count")
    validation_report: Optional[MeshValidationReport] = Field(None, description="Initial mesh validation report")
    uv_result: Optional[UVUnwrapResult] = Field(None, description="UV unwrapping and atlas packing report")
    simplification_result: Optional[SimplificationResult] = Field(None, description="QEM mesh simplification report")
    texture_result: Optional[TextureMappingResult] = Field(None, description="Texture and material mapping report")
    round_trip_report: Optional[Dict[str, Any]] = Field(None, description="GLB reload and verification report")
    attributes: Dict[str, Any] = Field(default_factory=dict, description="Diagnostic telemetry and pipeline metadata")
    errors: List[str] = Field(default_factory=list, description="Fatal pipeline errors")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")

    model_config = {"arbitrary_types_allowed": True}


class MeshProcessingPipeline:
    """
    Modular asset processing pipeline integrating:
    1. Mesh Ingestion & Structural Validation
    2. Automatic UV Parameterization (xatlas)
    3. PBR Texture & Material Application
    4. Multi-format compilation (GLB 2.0, OBJ with vt, STL)
    5. Post-export GLB round-trip verification
    """

    @classmethod
    def process_mesh(
        cls,
        mesh_source: Union[trimesh.Trimesh, Any, str, Path, bytes, io.BytesIO],
        texture_source: Optional[Union[str, Path, bytes, io.BytesIO, Any]] = None,
        config: Optional[PipelineConfig] = None,
        title: str = "Generated Asset",
        file_type: Optional[str] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> PipelineResult:
        """
        Executes the full asset processing and compilation pipeline.

        Args:
            mesh_source: Input 3D geometry (Trimesh instance, Procedural MeshData, file path, or bytes).
            texture_source: Optional texture image. If None and config.use_calibration_texture is True,
                            a calibration checkerboard pattern is synthesized.
            config: Pipeline configuration settings.
            title: Human-readable asset title.
            file_type: Format extension if passing raw bytes (e.g. 'obj', 'glb').
            progress_callback: Optional callback receiving (percent: int, stage_desc: str).

        Returns:
            PipelineResult containing compiled GLB/OBJ/STL files and comprehensive stage telemetry.
        """
        cfg = config or PipelineConfig()
        errors: List[str] = []
        warnings: List[str] = []

        def notify(pct: int, msg: str):
            if progress_callback:
                try:
                    progress_callback(pct, msg)
                except Exception:
                    pass

        # ------------------------------------------------------------------
        # Stage 1: Ingestion & Adapter Conversion
        # ------------------------------------------------------------------
        notify(10, "Ingesting raw geometry and converting to Trimesh representation...")
        raw_trimesh: Optional[trimesh.Trimesh] = None

        try:
            # Check for Procedural MeshData instance (from backend/app/services/mesh_generator.py)
            if hasattr(mesh_source, "vertices") and hasattr(mesh_source, "faces") and not isinstance(mesh_source, trimesh.Trimesh):
                verts = np.asarray(mesh_source.vertices, dtype=np.float64)
                faces = np.asarray(mesh_source.faces, dtype=np.int64)
                raw_trimesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
            elif isinstance(mesh_source, trimesh.Trimesh):
                raw_trimesh = mesh_source
            else:
                raw_trimesh = MeshValidator.load_mesh(mesh_source, file_type=file_type, process=False)

        except Exception as e:
            errors.append(f"Stage 1 Ingestion Failed: {e}")
            return PipelineResult(success=False, title=title, errors=errors)

        # ------------------------------------------------------------------
        # Stage 2: Geometric & Topological Validation
        # ------------------------------------------------------------------
        notify(25, "Executing topological and manifold validation...")
        val_report = MeshValidator.validate_trimesh(raw_trimesh, mesh_name=title)
        if not val_report.is_valid:
            errors.extend([f"Validation Error: {err}" for err in val_report.errors])
            return PipelineResult(
                success=False,
                title=title,
                validation_report=val_report,
                errors=errors,
                warnings=val_report.warnings,
            )
        warnings.extend(val_report.warnings)

        # ------------------------------------------------------------------
        # Stage 2.5: Automatic QEM Mesh Simplification (Decimation before UV unwrap)
        # ------------------------------------------------------------------
        simp_result: Optional[SimplificationResult] = None
        if cfg.enable_optimization:
            notify(35, "Executing Quadric Error Metrics (QEM) polygon decimation...")
            try:
                simp_result = MeshSimplifier.simplify(
                    mesh=raw_trimesh,
                    target_faces=cfg.target_faces,
                    reduction_ratio=cfg.reduction_ratio,
                )
                if simp_result.success and simp_result.optimized_mesh is not None:
                    raw_trimesh = simp_result.optimized_mesh
                    if simp_result.warnings:
                        warnings.extend(simp_result.warnings)
                else:
                    err_msg = "; ".join(simp_result.errors) if simp_result.errors else "Unknown decimation error"
                    warnings.append(f"QEM mesh optimization failed: {err_msg}. Proceeding with original mesh.")
            except Exception as e:
                warnings.append(f"QEM mesh optimization encountered exception: {e}. Proceeding with original mesh.")

        # ------------------------------------------------------------------
        # Stage 3: Automatic UV Unwrapping & Atlas Packing
        # ------------------------------------------------------------------
        notify(50, "Generating non-overlapping UV atlas via xatlas...")
        uv_opts = UVUnwrapOptions(
            resolution=cfg.texture_resolution,
            padding=cfg.uv_padding,
            rotate_charts=True,
            rotate_charts_to_axis=True,
        )

        unwrapped_mesh, uv_result = UVUnwrapper.unwrap(
            raw_trimesh,
            options=uv_opts,
            mesh_name=title,
        )

        if not uv_result.success or unwrapped_mesh is None:
            errors.extend([f"UV Unwrapping Failed: {err}" for err in uv_result.errors])
            return PipelineResult(
                success=False,
                title=title,
                validation_report=val_report,
                uv_result=uv_result,
                errors=errors,
            )
        warnings.extend(uv_result.warnings)

        # ------------------------------------------------------------------
        # Stage 4: Texture Mapping & PBR Material Creation
        # ------------------------------------------------------------------
        notify(70, "Applying PBR metallic-roughness material and texture maps...")
        mat_cfg = MaterialConfig(
            name=cfg.material_name,
            base_color_factor=[1.0, 1.0, 1.0, 1.0],
            metallic_factor=cfg.metallic_factor,
            roughness_factor=cfg.roughness_factor,
            double_sided=True,
        )

        final_mesh: trimesh.Trimesh = unwrapped_mesh
        tex_result: Optional[TextureMappingResult] = None
        actual_provider: str = cfg.texture_provider

        if cfg.apply_texture:
            if texture_source is not None:
                final_mesh, tex_result = TextureMapper.apply_texture(
                    mesh=unwrapped_mesh,
                    texture=texture_source,
                    material_config=mat_cfg,
                    mesh_name=title,
                )
            elif cfg.generate_procedural_texture or cfg.texture_provider == "stable_diffusion" or (cfg.texture_prompt and not cfg.use_calibration_texture):
                prompt_to_use = cfg.texture_prompt or title
                notify(65, f"Synthesizing texture map ({cfg.texture_provider}) for '{prompt_to_use}'...")
                gen_res = TextureGenerator.generate(
                    prompt=prompt_to_use,
                    negative_prompt=cfg.texture_negative_prompt,
                    style=cfg.texture_style,
                    resolution=cfg.texture_resolution,
                    palette=cfg.texture_palette,
                    seed=cfg.texture_seed,
                    provider=cfg.texture_provider,
                    num_inference_steps=cfg.texture_num_inference_steps,
                    guidance_scale=cfg.texture_guidance_scale,
                    model_id=cfg.texture_model_id,
                    fallback_to_procedural=cfg.texture_fallback_to_procedural,
                )
                if gen_res.warnings:
                    warnings.extend(gen_res.warnings)
                actual_provider = getattr(gen_res, "actual_provider", None) or cfg.texture_provider

                if gen_res.success and gen_res.image is not None:
                    final_mesh, tex_result = TextureMapper.apply_texture(
                        mesh=unwrapped_mesh,
                        texture=gen_res.image,
                        material_config=mat_cfg,
                        mesh_name=title,
                    )
                else:
                    if not cfg.texture_fallback_to_procedural:
                        err_detail = "; ".join(gen_res.errors) if gen_res.errors else f"Synthesis failed using provider '{cfg.texture_provider}'."
                        errors.append(f"Strict Texture Synthesis Failed: {err_detail}")
                        return PipelineResult(
                            success=False,
                            title=title,
                            validation_report=val_report,
                            uv_result=uv_result,
                            errors=errors,
                            warnings=warnings,
                        )
                    warnings.append(f"Texture generation ({cfg.texture_provider}) failed; falling back to calibration pattern.")
                    final_mesh, tex_result = TextureMapper.apply_checkerboard(
                        mesh=unwrapped_mesh,
                        resolution=cfg.texture_resolution,
                        grid_count=16,
                        material_config=mat_cfg,
                        mesh_name=title,
                    )
            elif cfg.use_calibration_texture:
                final_mesh, tex_result = TextureMapper.apply_checkerboard(
                    mesh=unwrapped_mesh,
                    resolution=cfg.texture_resolution,
                    grid_count=16,
                    material_config=mat_cfg,
                    mesh_name=title,
                )

            if tex_result and not tex_result.success:
                errors.extend([f"Texture Mapping Failed: {err}" for err in tex_result.errors])
                return PipelineResult(
                    success=False,
                    title=title,
                    validation_report=val_report,
                    uv_result=uv_result,
                    texture_result=tex_result,
                    errors=errors,
                )

        # ------------------------------------------------------------------
        # Stage 5: Multi-Format Asset Compilation (GLB, OBJ + MTL, STL)
        # ------------------------------------------------------------------
        notify(85, "Compiling binary glTF 2.0 container, Wavefront OBJ + MTL, and STL...")
        try:
            # 1. Binary GLB with embedded PBR materials & TEXCOORD_0
            glb_bytes = TextureMapper.export_textured_glb(final_mesh)

            # 2. Wavefront OBJ with 'vt' texture coordinates, 'material.mtl', and texture maps
            from trimesh.exchange.obj import export_obj
            obj_export_res = export_obj(final_mesh, return_texture=True)
            if isinstance(obj_export_res, tuple) and len(obj_export_res) == 2:
                obj_raw, aux_files = obj_export_res
            else:
                obj_raw = obj_export_res
                aux_files = {}

            if isinstance(obj_raw, bytes):
                obj_str = obj_raw.decode("utf-8", errors="replace")
            else:
                obj_str = str(obj_raw)

            # 3. Binary STL
            stl_bytes = final_mesh.export(file_type="stl")
            if not isinstance(stl_bytes, bytes):
                stl_bytes = str(stl_bytes).encode("ascii")

        except Exception as e:
            errors.append(f"Format Export Failed: {e}")
            return PipelineResult(
                success=False,
                title=title,
                validation_report=val_report,
                uv_result=uv_result,
                texture_result=tex_result,
                errors=errors,
            )

        # ------------------------------------------------------------------
        # Stage 6: Post-Export Round-Trip Verification
        # ------------------------------------------------------------------
        notify(95, "Verifying exported GLB container integrity and texture preservation...")
        round_trip_report = TextureMapper.verify_glb_round_trip(glb_bytes)

        if not round_trip_report.get("round_trip_success", False):
            warnings.append(
                f"GLB round-trip verification advisory: {round_trip_report.get('error', 'Inspection flagged warnings')}"
            )

        notify(100, "Asset compilation & verification complete!")

        # Attributes telemetry dictionary
        if simp_result is not None:
            optimization_metrics = {
                "optimized": bool(simp_result.success and simp_result.reduction_percentage > 0.0),
                "algorithm": simp_result.algorithm,
                "original_face_count": simp_result.original_face_count,
                "final_face_count": simp_result.final_face_count,
                "reduction_percentage": simp_result.reduction_percentage,
                "requested_target_faces": simp_result.requested_target_faces,
                "target_reached": simp_result.target_reached,
                "execution_time_seconds": simp_result.execution_time_seconds,
                "warnings": simp_result.warnings,
            }
        else:
            face_count = len(final_mesh.faces) if final_mesh is not None else 0
            optimization_metrics = {
                "optimized": False,
                "algorithm": "None",
                "original_face_count": face_count,
                "final_face_count": face_count,
                "reduction_percentage": 0.0,
                "requested_target_faces": cfg.target_faces,
                "target_reached": False,
                "execution_time_seconds": 0.0,
                "warnings": [],
            }

        attributes = {
            "is_valid": val_report.is_valid,
            "is_watertight": val_report.metrics.is_watertight,
            "surface_area": val_report.metrics.surface_area,
            "dimensions": val_report.metrics.dimensions,
            "uv_chart_count": uv_result.metrics.chart_count if uv_result.metrics else 0,
            "seam_vertex_duplications": uv_result.metrics.seam_vertex_duplications if uv_result.metrics else 0,
            "is_textured": tex_result.texture_applied if tex_result else False,
            "texture_resolution": [cfg.texture_resolution, cfg.texture_resolution],
            "metallic_factor": cfg.metallic_factor,
            "roughness_factor": cfg.roughness_factor,
            "has_mtl": "material.mtl" in aux_files,
            "aux_files": aux_files,
            "texture_provider": cfg.texture_provider,
            "actual_texture_provider": actual_provider,
            "is_fallback": (actual_provider != cfg.texture_provider),
            "optimization_metrics": optimization_metrics,
            "pipeline_engine": "PolyGen Unified 3D Pipeline v1.0",
        }

        return PipelineResult(
            success=True,
            title=title,
            glb_bytes=glb_bytes,
            obj_str=obj_str,
            stl_bytes=stl_bytes,
            poly_count=len(final_mesh.faces),
            vertex_count=len(final_mesh.vertices),
            validation_report=val_report,
            uv_result=uv_result,
            simplification_result=simp_result,
            texture_result=tex_result,
            round_trip_report=round_trip_report,
            attributes=attributes,
            errors=errors,
            warnings=warnings,
        )
