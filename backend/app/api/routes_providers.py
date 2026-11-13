from fastapi import APIRouter
from typing import List
from ..models.schemas import ProviderInfo
from ..services.job_manager import job_manager

router = APIRouter(prefix="/providers", tags=["Providers"])

@router.get("", response_model=List[ProviderInfo])
async def list_providers():
    return job_manager.list_providers()
