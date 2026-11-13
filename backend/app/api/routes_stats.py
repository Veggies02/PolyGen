from fastapi import APIRouter
from ..models.schemas import StatsOverview
from ..services.storage import asset_storage
from ..services.job_manager import job_manager

router = APIRouter(prefix="/stats", tags=["Statistics"])

@router.get("", response_model=StatsOverview)
async def get_stats():
    assets = asset_storage.list_assets()
    jobs = job_manager.list_jobs()
    
    active = sum(1 for j in jobs if j.status in ["queued", "synthesizing", "meshing", "texturing"])
    completed = sum(1 for j in jobs if j.status == "completed")
    storage_size = sum(a.file_size_bytes for a in assets)
    providers = job_manager.list_providers()

    return StatsOverview(
        total_assets=len(assets),
        active_jobs=active,
        completed_jobs=completed,
        storage_used_bytes=storage_size,
        available_providers=len(providers)
    )
