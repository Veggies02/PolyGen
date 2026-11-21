import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any
from .base import Base3DProvider
from ..models.schemas import GenerationRequest, ProviderInfo
from ..services.mesh_generator import ProceduralMeshFactory
from mesh_processing.pipeline import MeshProcessingPipeline, PipelineConfig

class DemoProvider(Base3DProvider):
    @property
    def provider_id(self) -> str:
        return "demo"

    def is_configured(self) -> bool:
        return True  # Always configured and available without external API keys

    def get_info(self) -> ProviderInfo:
        return ProviderInfo(
            id="demo",
            name="PolyGen Procedural Core (Demo Mode)",
            description="Built-in procedural 3D synthesis engine. Generates valid GLB, OBJ, and STL models locally with zero external API dependencies.",
            is_configured=True,
            is_demo=True,
            supported_formats=["glb", "obj", "stl"],
            capabilities=[
                "Local procedural generation",
                "Compliant glTF 2.0 binary output",
                "Interactive topology & normals",
                "Automatic UV unwrapping & PBR texturing"
            ],
            speed_estimate="~3-5 seconds"
        )

    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        # 1. Synthesize procedural geometry
        if progress_callback:
            await progress_callback(20, "Synthesizing spatial geometry & primitives...")
        await asyncio.sleep(0.3)

        raw_mesh = ProceduralMeshFactory.generate_by_prompt(
            prompt=request.prompt,
            style=request.style,
            seed=request.seed
        )

        # Title heuristic
        words = [w for w in request.prompt.split() if len(w) > 3][:3]
        title = " ".join(words).title() if words else "Generated Asset"
        full_title = f"{title} ({request.style.capitalize()})"

        if progress_callback:
            await progress_callback(40, "Validating geometry and topology...")
        await asyncio.sleep(0.2)

        # 2. Configure Unified Mesh Processing Pipeline
        is_metallic_style = request.style.lower() in ["scifi", "cyberpunk"]
        pipeline_config = PipelineConfig(
            apply_texture=True,
            generate_procedural_texture=True,
            texture_prompt=request.prompt,
            texture_style=request.style,
            use_calibration_texture=False,
            texture_resolution=512,
            uv_padding=2,
            metallic_factor=0.4 if is_metallic_style else 0.1,
            roughness_factor=0.35 if is_metallic_style else 0.7,
            material_name=f"{title.replace(' ', '_')}_PBR_Material"
        )

        if progress_callback:
            await progress_callback(60, "Computing automatic UV atlas & PBR texture mapping...")

        # 3. Execute Full Pipeline: Validation -> UV Unwrapping -> Texture Mapping -> GLB Export
        pipe_res = MeshProcessingPipeline.process_mesh(
            mesh_source=raw_mesh,
            config=pipeline_config,
            title=full_title,
        )

        if not pipe_res.success:
            err_msg = "; ".join(pipe_res.errors) if pipe_res.errors else "Unknown pipeline error"
            raise RuntimeError(f"Mesh processing pipeline failed: {err_msg}")

        if progress_callback:
            await progress_callback(85, "Assembling PBR material channels & glTF binary buffer...")
            await asyncio.sleep(0.1)

        merged_attributes = {
            "symmetry": request.symmetry,
            "poly_budget": request.poly_budget,
            "seed": request.seed,
            "engine": "PolyGen Procedural Core + Unified Mesh Pipeline",
            "is_demo": True,
            **pipe_res.attributes
        }

        return {
            "title": full_title,
            "glb_bytes": pipe_res.glb_bytes,
            "obj_str": pipe_res.obj_str,
            "stl_bytes": pipe_res.stl_bytes,
            "poly_count": pipe_res.poly_count,
            "vertex_count": pipe_res.vertex_count,
            "tags": [request.style, "procedural", "uv-mapped", "textured", f"budget-{request.poly_budget}"],
            "attributes": merged_attributes
        }
