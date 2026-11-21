"""
Texture Generator Facade & Provider Architecture
Provides a unified interface for procedural synthesis and prepares integration
hooks for Stable Diffusion (diffusers) and remote generative AI providers.
"""

from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional, Type, Union
import re
import time

from PIL import Image

from .texture_config import TextureConfig, TextureStyle, TextureGeneratorProvider
from .texture_result import TextureResult
from .procedural_generator import ProceduralGenerator
from .stable_diffusion_provider import StableDiffusionProvider


class BaseTextureProvider(ABC):
    """Abstract base provider for texture synthesis backends."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""
        pass

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """True if provider dependencies and runtime environment are satisfied."""
        pass

    @abstractmethod
    def generate(
        self,
        config: TextureConfig,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> TextureResult:
        """Synthesizes a texture image according to the specified configuration."""
        pass


class ProceduralTextureProvider(BaseTextureProvider):
    """Pure CPU algorithmic texture generator using NumPy & Pillow."""

    @property
    def name(self) -> str:
        return "procedural"

    @property
    def is_available(self) -> bool:
        return True

    def generate(
        self,
        config: TextureConfig,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> TextureResult:
        if progress_callback:
            progress_callback(20, f"Synthesizing procedural {config.style} texture...")
        res = ProceduralGenerator.generate(config)
        if progress_callback:
            progress_callback(100, "Procedural texture synthesis complete.")
        return res


class RemoteTextureProvider(BaseTextureProvider):
    """Stub for remote generative microservices and external inference endpoints."""

    def __init__(self, endpoint_url: Optional[str] = None):
        self.endpoint_url = endpoint_url

    @property
    def name(self) -> str:
        return "remote_api"

    @property
    def is_available(self) -> bool:
        return bool(self.endpoint_url)

    def generate(
        self,
        config: TextureConfig,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> TextureResult:
        return TextureResult(
            success=False,
            width=config.width,
            height=config.height,
            style=str(config.style),
            provider=self.name,
            errors=["RemoteTextureProvider: Remote inference endpoint not configured."],
        )


class TextureGenerator:
    """
    Central facade and registry for texture generation across PolyGen.
    """

    _providers: Dict[str, BaseTextureProvider] = {
        "procedural": ProceduralTextureProvider(),
        "stable_diffusion": StableDiffusionProvider(),
        "remote_api": RemoteTextureProvider(),
    }

    @classmethod
    def register_provider(cls, name: str, provider: BaseTextureProvider):
        """Registers a custom or alternate texture synthesis provider."""
        cls._providers[name.lower()] = provider

    @classmethod
    def get_provider(cls, name: str) -> BaseTextureProvider:
        """Retrieves provider by name, defaulting to procedural engine."""
        return cls._providers.get(name.lower(), cls._providers["procedural"])

    @classmethod
    def infer_style_from_prompt(cls, prompt: Optional[str]) -> str:
        """
        Analyzes a textual prompt to automatically deduce the most fitting material style.
        """
        if not prompt:
            return TextureStyle.SCIFI.value

        p = prompt.lower()
        if any(w in p for w in ["wood", "wooden", "oak", "timber", "bark", "table", "chest", "plank", "log"]):
            return TextureStyle.WOOD.value
        if any(w in p for w in ["marble", "vein", "carrara", "onyx"]):
            return TextureStyle.MARBLE.value
        if any(w in p for w in ["stone", "rock", "granite", "slate", "cobble", "boulder", "mineral", "crystal", "gem", "monolith"]):
            return TextureStyle.STONE.value
        if any(w in p for w in ["metal", "steel", "chrome", "gold", "bronze", "copper", "iron", "armor", "blade"]):
            return TextureStyle.METALLIC.value
        if any(w in p for w in ["carbon", "fiber", "twill", "composite"]):
            return TextureStyle.CARBON_FIBER.value
        if any(w in p for w in ["fabric", "cloth", "denim", "canvas", "linen", "leather", "cloak", "robe", "curtain"]):
            return TextureStyle.FABRIC.value
        if any(w in p for w in ["ceramic", "porcelain", "pottery", "tile", "vase", "glaze", "clay"]):
            return TextureStyle.CERAMIC.value
        if any(w in p for w in ["cyber", "scifi", "sci-fi", "futuristic", "tech", "drone", "robot", "laser", "circuit", "spaceship"]):
            return TextureStyle.SCIFI.value
        if any(w in p for w in ["organic", "creature", "skin", "flesh", "scales", "alien", "lichen", "moss", "plant", "biomorphic"]):
            return TextureStyle.ORGANIC.value

        return TextureStyle.SCIFI.value

    @classmethod
    def generate(
        cls,
        prompt: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        style: Optional[Union[TextureStyle, str]] = None,
        resolution: int = 512,
        width: Optional[int] = None,
        height: Optional[int] = None,
        palette: Optional[List[str]] = None,
        seed: Optional[int] = None,
        provider: str = "procedural",
        num_inference_steps: int = 25,
        guidance_scale: float = 7.5,
        model_id: Optional[str] = None,
        fallback_to_procedural: bool = True,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> TextureResult:
        """
        High-level facade to synthesize texture maps from prompt and style.

        Args:
            prompt: Text prompt guiding texture appearance.
            negative_prompt: Elements to avoid during neural synthesis.
            style: Explicit material style. If omitted, automatically inferred from prompt.
            resolution: Square resolution (default 512).
            width: Custom width (overrides resolution).
            height: Custom height (overrides resolution).
            palette: Optional list of hex or color tokens.
            seed: Deterministic integer seed.
            provider: Synthesis provider ("procedural", "stable_diffusion", etc.).
            num_inference_steps: Neural denoising iterations (diffusion only).
            guidance_scale: Classifier-free guidance multiplier (diffusion only).
            model_id: Model checkpoint identifier (diffusion only).
            fallback_to_procedural: Allow procedural fallback if neural model is unavailable.
            progress_callback: Progress notification hook.

        Returns:
            Validated TextureResult.
        """
        w = width or resolution
        h = height or resolution

        # Deduce style if not provided
        resolved_style = style or cls.infer_style_from_prompt(prompt)

        config = TextureConfig(
            prompt=prompt,
            negative_prompt=negative_prompt,
            style=resolved_style,
            width=w,
            height=h,
            color_palette=palette,
            seed=seed,
            provider=provider,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            model_id=model_id,
            fallback_to_procedural=fallback_to_procedural,
        )

        engine = cls.get_provider(provider)
        result = engine.generate(config, progress_callback=progress_callback)

        # Output validation
        if result.success and result.image is not None:
            if result.image.size != (w, h):
                result.warnings.append(f"Image dimensions {result.image.size} differ from requested {(w, h)}.")
            if result.image.mode not in ["RGB", "RGBA"]:
                result.warnings.append(f"Image mode {result.image.mode} converted to standard RGB.")
                result.image = result.image.convert("RGB")

        return result
