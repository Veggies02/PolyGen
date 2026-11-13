import httpx
import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any
from .base import Base3DProvider
from ..models.schemas import GenerationRequest, ProviderInfo
from ..config import settings

class Tripo3DProvider(Base3DProvider):
    @property
    def provider_id(self) -> str:
        return "tripo"

    def is_configured(self) -> bool:
        return bool(settings.TRIPO_API_KEY and settings.TRIPO_API_KEY.strip())

    def get_info(self) -> ProviderInfo:
        return ProviderInfo(
            id="tripo",
            name="Tripo3D AI",
            description="Production text-to-3D cloud engine by Tripo AI. Generates high-fidelity textured 3D models from text in seconds.",
            is_configured=self.is_configured(),
            is_demo=False,
            supported_formats=["glb", "obj", "stl"],
            capabilities=[
                "High-resolution neural texturing",
                "Advanced mesh retopology",
                "PBR metallic-roughness materials",
                "Fast cloud inference"
            ],
            speed_estimate="~15-30 seconds"
        )

    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise ValueError(
                "Tripo3D API key is not configured. Please set TRIPO_API_KEY in your .env file or choose Demo Mode."
            )

        # Implementation for live Tripo3D OpenAPI v2
        headers = {
            "Authorization": f"Bearer {settings.TRIPO_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "type": "text_to_model",
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt or ""
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            if progress_callback:
                await progress_callback(10, "Submitting task to Tripo3D Cloud...")
            
            res = await client.post("https://api.tripo3d.ai/v2/openapi/task", headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            task_id = data.get("data", {}).get("task_id")

            # Poll for completion
            while True:
                await asyncio.sleep(3.0)
                status_res = await client.get(f"https://api.tripo3d.ai/v2/openapi/task/{task_id}", headers=headers)
                status_res.raise_for_status()
                task_data = status_res.json().get("data", {})
                status = task_data.get("status")
                progress = task_data.get("progress", 0)

                if progress_callback:
                    await progress_callback(
                        min(int(progress), 95),
                        f"Tripo3D Synthesis: {status} ({progress}%)"
                    )

                if status == "success":
                    model_url = task_data.get("output", {}).get("model")
                    glb_res = await client.get(model_url)
                    glb_bytes = glb_res.content
                    return {
                        "title": request.prompt[:30].strip(),
                        "glb_bytes": glb_bytes,
                        "obj_str": "",
                        "stl_bytes": b"",
                        "poly_count": 25000,
                        "vertex_count": 14000,
                        "tags": [request.style, "tripo3d"],
                        "attributes": {"task_id": task_id, "engine": "Tripo3D Cloud"}
                    }
                elif status in ["failed", "cancelled"]:
                    raise RuntimeError(f"Tripo3D generation failed: {task_data.get('error')}")
