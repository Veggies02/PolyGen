import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List
from ..models.schemas import GenerationRequest, JobStatus
from ..providers.base import Base3DProvider
from ..providers.demo_provider import DemoProvider
from ..providers.tripo_provider import Tripo3DProvider
from ..providers.meshy_provider import MeshyProvider
from .storage import asset_storage

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, JobStatus] = {}
        self.providers: Dict[str, Base3DProvider] = {
            "demo": DemoProvider(),
            "tripo": Tripo3DProvider(),
            "meshy": MeshyProvider()
        }

    def get_provider(self, provider_id: str) -> Base3DProvider:
        p = self.providers.get(provider_id.lower())
        if not p:
            # Fallback to demo
            return self.providers["demo"]
        return p

    def list_providers(self):
        return [p.get_info() for p in self.providers.values()]

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        return self.jobs.get(job_id)

    def list_jobs(self, limit: int = 50) -> List[JobStatus]:
        all_jobs = list(self.jobs.values())
        all_jobs.sort(key=lambda j: j.created_at, reverse=True)
        return all_jobs[:limit]

    def create_job(self, request: GenerationRequest) -> JobStatus:
        job_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc)
        
        job = JobStatus(
            id=job_id,
            prompt=request.prompt,
            provider=request.provider,
            status="queued",
            progress=0,
            current_stage="Job queued for synthesis...",
            created_at=now,
            updated_at=now,
            asset_id=None
        )
        self.jobs[job_id] = job

        # Launch background task
        asyncio.create_task(self._process_job(job_id, request))
        return job

    async def _process_job(self, job_id: str, request: GenerationRequest):
        job = self.jobs.get(job_id)
        if not job:
            return

        provider = self.get_provider(request.provider)

        async def update_progress(pct: int, stage_desc: str):
            if job.status in ["completed", "failed"]:
                return
            job.progress = pct
            job.current_stage = stage_desc
            job.status = "synthesizing" if pct < 50 else ("meshing" if pct < 80 else "texturing")
            job.updated_at = datetime.now(timezone.utc)

        try:
            # Execute provider generation
            result = await provider.generate(
                request=request,
                job_id=job_id,
                progress_callback=update_progress
            )

            # Save generated assets to storage
            asset = asset_storage.save_asset(
                title=result["title"],
                prompt=request.prompt,
                provider=request.provider,
                style=request.style,
                glb_bytes=result["glb_bytes"],
                obj_str=result.get("obj_str", ""),
                stl_bytes=result.get("stl_bytes", b""),
                poly_count=result.get("poly_count", 0),
                vertex_count=result.get("vertex_count", 0),
                tags=result.get("tags", []),
                attributes=result.get("attributes", {}),
                negative_prompt=request.negative_prompt,
                is_demo=isinstance(provider, DemoProvider)
            )

            job.status = "completed"
            job.progress = 100
            job.current_stage = "Asset ready in gallery!"
            job.asset_id = asset.id
            job.updated_at = datetime.now(timezone.utc)

        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.current_stage = f"Generation failed: {str(e)}"
            job.updated_at = datetime.now(timezone.utc)

job_manager = JobManager()
