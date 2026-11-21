"""
Texture Generation Configuration Models
Defines parameters, styles, and options for procedural and AI texture synthesis.
"""

from enum import Enum
from typing import Any, List, Optional, Tuple, Union
from pydantic import BaseModel, Field, field_validator


class TextureStyle(str, Enum):
    """Supported procedural and AI texture styles."""
    METALLIC = "metallic"
    WOOD = "wood"
    STONE = "stone"
    MARBLE = "marble"
    CARBON_FIBER = "carbon_fiber"
    FABRIC = "fabric"
    CERAMIC = "ceramic"
    SCIFI = "scifi"
    ORGANIC = "organic"


class TextureGeneratorProvider(str, Enum):
    """Available texture synthesis backend providers."""
    PROCEDURAL = "procedural"
    STABLE_DIFFUSION = "stable_diffusion"
    REMOTE_API = "remote_api"


class TextureConfig(BaseModel):
    """
    Configuration specification for generating texture maps.
    """
    prompt: Optional[str] = Field(None, description="Descriptive prompt steering texture appearance")
    negative_prompt: Optional[str] = Field(None, description="Elements to avoid during synthesis")
    style: Union[TextureStyle, str] = Field(TextureStyle.SCIFI, description="Visual material style or motif")
    width: int = Field(512, ge=64, le=2048, description="Texture width in pixels")
    height: int = Field(512, ge=64, le=2048, description="Texture height in pixels")
    seed: Optional[int] = Field(None, description="Random seed for deterministic reproduction")
    color_palette: Optional[List[str]] = Field(None, description="Optional hex or named colors to prioritize")
    provider: Union[TextureGeneratorProvider, str] = Field(
        TextureGeneratorProvider.PROCEDURAL, description="Synthesis provider engine"
    )
    num_inference_steps: int = Field(25, ge=1, le=150, description="Denoising steps for neural diffusion")
    guidance_scale: float = Field(7.5, ge=1.0, le=20.0, description="Classifier-Free Guidance (CFG) scale")
    model_id: Optional[str] = Field(None, description="Hugging Face model checkpoint identifier")
    fallback_to_procedural: bool = Field(True, description="Fallback to procedural generator if neural model is unavailable")
    seamless: bool = Field(True, description="Whether pattern edges should tile seamlessly")
    roughness_hint: Optional[float] = Field(None, ge=0.0, le=1.0, description="Recommended PBR roughness")
    metallic_hint: Optional[float] = Field(None, ge=0.0, le=1.0, description="Recommended PBR metalness")

    @field_validator("style", mode="before")
    @classmethod
    def normalize_style(cls, v: Any) -> str:
        if isinstance(v, TextureStyle):
            return v.value
        if isinstance(v, str):
            clean = v.strip().lower().replace("-", "_").replace(" ", "_")
            # Map aliases
            alias_map = {
                "metal": "metallic",
                "steel": "metallic",
                "chrome": "metallic",
                "gold": "metallic",
                "rock": "stone",
                "granite": "stone",
                "slate": "stone",
                "carbon": "carbon_fiber",
                "cloth": "fabric",
                "denim": "fabric",
                "canvas": "fabric",
                "porcelain": "ceramic",
                "tile": "ceramic",
                "cyber": "scifi",
                "cyberpunk": "scifi",
                "futuristic": "scifi",
                "tech": "scifi",
                "nature": "organic",
                "skin": "organic",
                "scales": "organic",
                "bark": "organic",
            }
            return alias_map.get(clean, clean)
        return "scifi"

    @field_validator("width", "height")
    @classmethod
    def validate_power_of_two_preference(cls, v: int) -> int:
        if v < 64 or v > 2048:
            raise ValueError("Resolution must be between 64 and 2048.")
        return v
