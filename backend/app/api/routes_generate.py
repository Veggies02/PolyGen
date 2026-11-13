from fastapi import APIRouter, HTTPException
from typing import List
from ..models.schemas import (
    GenerationRequest,
    JobStatus,
    PromptEnhanceRequest,
    PromptEnhanceResponse
)
from ..services.job_manager import job_manager

router = APIRouter(prefix="/generate", tags=["Generation"])

@router.post("", response_model=JobStatus)
async def start_generation(request: GenerationRequest):
    provider = job_manager.get_provider(request.provider)
    if not provider.is_configured():
        raise HTTPException(
            status_code=400,
            detail=f"Provider '{request.provider}' is not configured with valid API credentials. Please switch to 'demo' mode or configure credentials in .env"
        )
    job = job_manager.create_job(request)
    return job

@router.get("/jobs", response_model=List[JobStatus])
async def list_jobs():
    return job_manager.list_jobs()

@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    return job

@router.post("/enhance-prompt", response_model=PromptEnhanceResponse)
async def enhance_prompt(req: PromptEnhanceRequest):
    p = req.prompt.strip()
    style = req.style or "scifi"
    
    enhancements = {
        "scifi": "hyper-detailed hard-surface panels, emissive conduit strips, titanium chassis, game-ready PBR mesh, 8k textures, cinematic lighting",
        "cyberpunk": "neon fiber accents, weathered alloy plating, modular cyberware ports, gritty industrial finish, high-definition normal maps",
        "low-poly": "clean geometric facets, isometric stylized silhouette, optimized quad topology, vibrant flat shading palette",
        "realistic": "photorealistic photogrammetry quality, micro-surface imperfections, accurate real-world scale, natural material scattering",
        "organic": "biomechanical musculature, sculpted chitinous exoskeleton, cellular vascular patterns, procedural subsurface scattering"
    }

    modifier = enhancements.get(style, enhancements["scifi"])
    enhanced = f"{p}, {modifier}"
    tags = [style, "pbr", "game-ready", "high-poly" if "poly" not in style else "low-poly"]

    return PromptEnhanceResponse(
        original_prompt=p,
        enhanced_prompt=enhanced,
        suggested_tags=tags,
        style_applied=style
    )
