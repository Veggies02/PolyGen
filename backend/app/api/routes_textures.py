"""
PolyGen Texture Generation API Router
Provides independent endpoints for synthesizing, previewing, and inspecting procedural
and neural Stable Diffusion texture maps.
"""

from typing import Any, Dict, List, Optional
import urllib.parse
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from texture_engine.texture_config import TextureStyle, TextureGeneratorProvider
from texture_engine.texture_generator import TextureGenerator
from texture_engine.texture_result import TextureResult
from texture_engine.stable_diffusion_provider import StableDiffusionProvider

router = APIRouter(prefix="/textures", tags=["Textures"])


class TextureGenerationRequest(BaseModel):
    """Payload for requesting texture synthesis."""
    prompt: Optional[str] = Field(None, description="Descriptive text steering texture appearance")
    negative_prompt: Optional[str] = Field(None, description="Elements to avoid during neural diffusion")
    style: Optional[str] = Field("scifi", description="Material style (metallic, wood, stone, marble, etc.)")
    resolution: int = Field(512, ge=64, le=2048, description="Square resolution in pixels (e.g. 256, 512, 1024)")
    color_palette: Optional[List[str]] = Field(None, description="Optional hex or named colors")
    seed: Optional[int] = Field(None, description="Deterministic seed")
    provider: str = Field("procedural", description="Synthesis provider engine ('procedural' or 'stable_diffusion')")
    num_inference_steps: int = Field(25, ge=1, le=150, description="Denoising steps (diffusion only)")
    guidance_scale: float = Field(7.5, ge=1.0, le=20.0, description="CFG guidance scale (diffusion only)")
    model_id: Optional[str] = Field(None, description="Hugging Face model checkpoint (diffusion only)")
    fallback_to_procedural: bool = Field(True, description="Fallback to procedural if neural model is unavailable")


class TextureGenerationResponse(BaseModel):
    """Response contract returning synthesized texture metadata and base64 payload."""
    success: bool
    style: str
    width: int
    height: int
    generator: str
    actual_provider: str
    model_id: Optional[str] = None
    seed: int
    generation_time_ms: float
    data_uri: str
    preview_url: str
    metadata: Dict[str, Any]
    errors: List[str]
    warnings: List[str]


@router.get("/styles", response_model=List[Dict[str, Any]])
async def list_texture_styles():
    """Returns all available procedural texture styles with descriptions."""
    styles = [
        {"id": "metallic", "name": "Brushed Metallic", "description": "Anisotropic brushed metal, steel, gold, and titanium with specular sheen"},
        {"id": "wood", "name": "Natural Wood", "description": "Warped concentric growth rings with organic grain fibers"},
        {"id": "stone", "name": "Granite / Slate Stone", "description": "Multi-octave mineral flecks, fissures, and granite crystalline speckles"},
        {"id": "marble", "name": "Carrara / Onyx Marble", "description": "Fluid turbulence-driven mineral veins over polished alabaster"},
        {"id": "carbon_fiber", "name": "2x2 Twill Carbon Fiber", "description": "Alternating woven graphite yarn bundles with anisotropic sheen"},
        {"id": "fabric", "name": "Canvas / Denim Weave", "description": "Interlaced warp and weft textile micro-fibers"},
        {"id": "ceramic", "name": "Glazed Ceramic / Porcelain", "description": "Smooth glossy enamel with delicate crazing crackle fractures"},
        {"id": "scifi", "name": "Sci-Fi Armored Hull", "description": "Modular armor plating grid, recessed seams, and neon emissive conduits"},
        {"id": "organic", "name": "Biomorphic Skin / Scales", "description": "Voronoi cellular tissue, reptile scales, and lichen membranes"},
    ]
    return styles


@router.get("/providers", response_model=Dict[str, Any])
async def get_providers_info():
    """Returns status and hardware acceleration capabilities of available texture providers."""
    device_info = StableDiffusionProvider.get_device_info()
    sd_available = TextureGenerator.get_provider("stable_diffusion").is_available
    return {
        "providers": {
            "procedural": {
                "available": True,
                "description": "Fast deterministic CPU algorithmic texture synthesizer",
                "hardware": "CPU (vectorized NumPy/SciPy)",
            },
            "stable_diffusion": {
                "available": sd_available,
                "description": "Neural text-to-image latent diffusion model",
                "default_model": StableDiffusionProvider.DEFAULT_MODEL_ID,
                "device_info": device_info,
            },
        }
    }


@router.post("/generate", response_model=TextureGenerationResponse)
async def generate_texture(req: TextureGenerationRequest):
    """
    Synthesizes a texture map from prompt and style parameters.
    Supports procedural and neural Stable Diffusion synthesis with transparent provider reporting.
    Returns inline base64 image data URI without exposing internal filesystem paths.
    """
    res = TextureGenerator.generate(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        style=req.style,
        resolution=req.resolution,
        palette=req.color_palette,
        seed=req.seed,
        provider=req.provider,
        num_inference_steps=req.num_inference_steps,
        guidance_scale=req.guidance_scale,
        model_id=req.model_id,
        fallback_to_procedural=req.fallback_to_procedural,
    )

    if not res.success:
        raise HTTPException(
            status_code=500,
            detail=f"Texture generation failed: {'; '.join(res.errors)}",
        )

    # Construct preview URL for direct binary streaming
    preview_url = f"/api/textures/preview?style={res.style}&resolution={res.width}&seed={res.seed}&provider={res.actual_provider or res.provider}"
    if req.prompt:
        preview_url += f"&prompt={urllib.parse.quote(req.prompt)}"

    generator_name = res.requested_provider or res.provider
    actual_prov = res.actual_provider or res.provider

    return TextureGenerationResponse(
        success=res.success,
        style=res.style,
        width=res.width,
        height=res.height,
        generator=generator_name,
        actual_provider=actual_prov,
        model_id=res.model_id,
        seed=res.seed,
        generation_time_ms=res.generation_time_ms,
        data_uri=res.to_data_uri(),
        preview_url=preview_url,
        metadata=res.metadata,
        errors=res.errors,
        warnings=res.warnings,
    )


@router.get("/preview")
async def preview_texture(
    style: Optional[str] = Query("scifi", description="Material style"),
    prompt: Optional[str] = Query(None, description="Optional prompt cue"),
    resolution: int = Query(512, ge=64, le=2048, description="Resolution"),
    seed: Optional[int] = Query(None, description="Deterministic seed"),
    provider: str = Query("procedural", description="Synthesis provider"),
):
    """
    Streams a synthesized PNG texture image directly as binary content.
    Ideal for direct embedding in HTML <img> tags or 3D viewer texture slots.
    """
    res = TextureGenerator.generate(
        prompt=prompt,
        style=style,
        resolution=resolution,
        seed=seed,
        provider=provider,
    )

    if not res.success or not res.image_bytes:
        raise HTTPException(status_code=500, detail="Failed to synthesize preview texture.")

    return Response(
        content=res.image_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )
