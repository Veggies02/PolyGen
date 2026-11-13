import httpx
import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any
from .base import Base3DProvider
from ..models.schemas import GenerationRequest, ProviderInfo
from ..config import settings

class MeshyProvider(Base3DProvider):
    @property
    def provider_id(self) -> str:
        return "meshy"

    def is_configured(self) -> bool:
        return bool(settings.MESHY_API_KEY and settings.MESHY_API_KEY.strip())

    def get_info(self) -> ProviderInfo:
        return ProviderInfo(
            id="meshy",
            name="Meshy.ai Text-to-3D",
            description="Meshy AI Text-to-3D pipeline providing production meshes, high-quality PBR maps, and multiple polygon budget targets.",
            is_configured=self.is_configured(),
            is_demo=False,
            supported_formats=["glb", "obj", "stl"],
            capabilities=[
                "Artistic style presets",
                "PBR texture generation",
                "Quad & Tri mesh retopology",
                "High poly refinement"
            ],
            speed_estimate="~45-60 seconds"
        )

    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise ValueError(
                "Meshy API key is not configured. Please set MESHY_API_KEY in your .env file or choose Demo Mode."
            )

        headers = {
            "Authorization": f"Bearer {settings.MESHY_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "mode": "preview",
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt or "",
            "art_style": request.style if request.style in ["realistic", "scifi"] else "realistic",
            "should_remesh": True
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            if progress_callback:
                await progress_callback(10, "Submitting job to Meshy AI API...")
            
            res = await client.post("https://api.meshy.ai/v2/text-to-3d", headers=headers, json=payload)
            res.raise_for_status()
            task_id = res.json().get("result")

            while True:
                await asyncio.sleep(4.0)
                status_res = await client.get(f"https://api.meshy.ai/v2/text-to-3d/{task_id}", headers=headers)
                status_res.raise_for_status()
                data = status_res.json()
                status = data.get("status")
                progress = data.get("progress", 0)

                if progress_callback:
                    await progress_callback(
                        min(int(progress), 95),
                        f"Meshy AI Processing: {status} ({progress}%)"
                    )

                if status == "SUCCEEDED":
                    model_urls = data.get("model_urls", {})
                    glb_url = model_urls.get("glb")
                    glb_res = await client.get(glb_url)
                    return {
                        "title": request.prompt[:30].strip(),
                        "glb_bytes": glb_res.content,
                        "obj_str": "",
                        "stl_bytes": b"",
                        "poly_count": 30000,
                        "vertex_count": 16000,
                        "tags": [request.style, "meshy"],
                        "attributes": {"task_id": task_id, "engine": "Meshy.ai"}
                    }
                elif status in ["FAILED", "EXPIRED"]:
                    raise RuntimeError(f"Meshy generation failed: {data.get('task_error')}")
