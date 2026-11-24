"""Text-to-3D provider that calls a remote Shap-E GPU server (e.g. a Colab notebook).

Week 1 deliverable: text prompt -> raw OBJ mesh. The GPU work happens remotely;
this class only needs httpx and trimesh, so it runs on any machine.
"""
import asyncio
import io
from typing import Callable, Awaitable, Optional, Dict, Any

import httpx

from .base import Base3DProvider
from ..config import settings
from ..models.schemas import GenerationRequest, ProviderInfo

_STEPS_BY_BUDGET = {"low": 32, "medium": 64, "high": 96}


def _convert_obj(obj_str: str) -> Dict[str, Any]:
    """Load the raw OBJ with trimesh and export GLB/STL for the asset store."""
    import trimesh

    mesh = trimesh.load(
        io.BytesIO(obj_str.encode("utf-8")),
        file_type="obj", force="mesh", process=False,
    )
    if len(mesh.faces) == 0:
        raise RuntimeError("Shap-E returned an empty mesh; try a more concrete prompt.")
    # NOTE: no axis rotation here. Shap-E orientation varies per prompt
    # (chair came out Z-up, sword Y-up), so orientation is handled separately.
    return {
        "glb_bytes": mesh.export(file_type="glb"),
        "stl_bytes": mesh.export(file_type="stl"),
        "poly_count": int(len(mesh.faces)),
        "vertex_count": int(len(mesh.vertices)),
        "bounds": mesh.bounds.tolist(),
    }


class ShapEProvider(Base3DProvider):
    @property
    def provider_id(self) -> str:
        return "shape"

    def is_configured(self) -> bool:
        return bool(settings.SHAPE_REMOTE_URL.strip() and settings.SHAPE_API_TOKEN.strip())

    def get_info(self) -> ProviderInfo:
        return ProviderInfo(
            id="shape",
            name="Shap-E (Remote GPU)",
            description="Open-source text-to-3D (OpenAI Shap-E) running on a remote GPU. "
                        "Produces a raw coloured mesh.",
            is_configured=self.is_configured(),
            is_demo=False,
            supported_formats=["glb", "obj", "stl"],
            capabilities=["Open-source model", "No per-generation cost", "Raw OBJ geometry"],
            speed_estimate="~20-60 seconds",
        )

    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise ValueError(
                "Shap-E is not configured. Set SHAPE_REMOTE_URL and SHAPE_API_TOKEN in backend/.env "
                "or choose another provider."
            )

        async def progress(pct: int, msg: str):
            if progress_callback:
                await progress_callback(pct, msg)

        base = settings.SHAPE_REMOTE_URL.rstrip("/")
        headers = {
            "x-api-token": settings.SHAPE_API_TOKEN,
            "ngrok-skip-browser-warning": "1",
        }
        payload = {
            "prompt": request.prompt,
            "seed": request.seed,
            "steps": _STEPS_BY_BUDGET.get(request.poly_budget, 64),
        }

        await progress(10, "Sending prompt to Shap-E GPU server...")
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client:
                task = asyncio.create_task(client.post(f"{base}/generate", json=payload, headers=headers))
                pct = 15
                while not task.done():
                    await progress(pct, "Shap-E is sampling the 3D model on the GPU...")
                    pct = min(pct + 5, 85)
                    await asyncio.sleep(2.0)
                res = await task
        except httpx.ConnectError:
            raise RuntimeError("Cannot reach the Shap-E server. Is the Colab notebook running?")
        except httpx.TimeoutException:
            raise RuntimeError("Shap-E server timed out.")

        if res.status_code == 401:
            raise RuntimeError("Shap-E server rejected the API token.")
        res.raise_for_status()
        data = res.json()

        await progress(90, "Converting raw mesh to GLB/STL...")
        obj_str = data["obj"]
        converted = await asyncio.to_thread(_convert_obj, obj_str)

        words = [w for w in request.prompt.split() if len(w) > 3][:3]
        title = " ".join(words).title() if words else "Generated Asset"
        await progress(100, "Asset compilation complete!")

        return {
            "title": f"{title} (Shap-E)",
            "glb_bytes": converted.pop("glb_bytes"),
            "obj_str": obj_str,
            "stl_bytes": converted.pop("stl_bytes"),
            "poly_count": converted.pop("poly_count"),
            "vertex_count": converted.pop("vertex_count"),
            "tags": ["shap-e", "ai-generated", "raw-mesh"],
            "attributes": {
                "engine": "Shap-E text300M (remote)",
                "prompt": request.prompt,
                "seed": data.get("seed", request.seed),
                "is_demo": False,
                **converted,
            },
        }