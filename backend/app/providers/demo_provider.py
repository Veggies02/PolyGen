import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any
from .base import Base3DProvider
from ..models.schemas import GenerationRequest, ProviderInfo
from ..services.mesh_generator import ProceduralMeshFactory

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
                "Instant simulation with real geometry"
            ],
            speed_estimate="~3-5 seconds"
        )

    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        stages = [
            (15, "Analyzing prompt semantics & geometric primitives..."),
            (40, "Synthesizing spatial geometry & vertex cloud..."),
            (70, "Computing surface topology, normals & winding order..."),
            (90, "Assembling PBR material channels & glTF binary buffer..."),
            (100, "Asset compilation complete!")
        ]

        for pct, stage_name in stages[:-1]:
            if progress_callback:
                await progress_callback(pct, stage_name)
            await asyncio.sleep(0.7)  # Realistic simulation step

        # Generate actual geometry
        mesh = ProceduralMeshFactory.generate_by_prompt(
            prompt=request.prompt,
            style=request.style,
            seed=request.seed
        )

        glb_bytes = mesh.export_glb()
        obj_str = mesh.export_obj()
        stl_bytes = mesh.export_stl()

        if progress_callback:
            await progress_callback(100, "Asset compilation complete!")

        # Title heuristic
        words = [w for w in request.prompt.split() if len(w) > 3][:3]
        title = " ".join(words).title() if words else "Generated Asset"

        return {
            "title": f"{title} ({request.style.capitalize()})",
            "glb_bytes": glb_bytes,
            "obj_str": obj_str,
            "stl_bytes": stl_bytes,
            "poly_count": mesh.poly_count,
            "vertex_count": mesh.vertex_count,
            "tags": [request.style, "procedural", "demo-engine", f"budget-{request.poly_budget}"],
            "attributes": {
                "symmetry": request.symmetry,
                "poly_budget": request.poly_budget,
                "seed": request.seed,
                "engine": "PolyGen Procedural v1.0",
                "is_demo": True
            }
        }
