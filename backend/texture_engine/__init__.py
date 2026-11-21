"""
PolyGen Texture Engine Package
Provides modular procedural texture synthesis and actual Stable Diffusion
neural texture pipelines with hardware-aware Apple Silicon acceleration.
"""

from .texture_config import TextureConfig, TextureStyle, TextureGeneratorProvider
from .texture_result import TextureResult
from .procedural_generator import ProceduralGenerator
from .stable_diffusion_provider import StableDiffusionProvider
from .texture_generator import (
    BaseTextureProvider,
    ProceduralTextureProvider,
    RemoteTextureProvider,
    TextureGenerator,
)
from .geometry_conditioner import (
    GeometryConditioner,
    GeometryConditionerConfig,
    GeometryConditioningResult,
    DepthNormalizationMode,
    OverlapResolution,
)

__all__ = [
    "TextureConfig",
    "TextureStyle",
    "TextureGeneratorProvider",
    "TextureResult",
    "ProceduralGenerator",
    "BaseTextureProvider",
    "ProceduralTextureProvider",
    "StableDiffusionProvider",
    "RemoteTextureProvider",
    "TextureGenerator",
    "GeometryConditioner",
    "GeometryConditionerConfig",
    "GeometryConditioningResult",
    "DepthNormalizationMode",
    "OverlapResolution",
]
