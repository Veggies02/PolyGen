"""
Stable Diffusion Texture Generation Provider
Integrates Hugging Face Diffusers for neural text-to-texture generation with
Apple Silicon (MPS) acceleration, memory optimizations, and procedural fallback.
"""

import io
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
from PIL import Image

from .texture_config import TextureConfig
from .texture_result import TextureResult
from .procedural_generator import ProceduralGenerator


class StableDiffusionProvider:
    """
    Hugging Face Diffusers-based texture synthesis provider.
    Supports local Stable Diffusion checkpoints, PyTorch MPS/CUDA/CPU execution,
    attention slicing for memory efficiency, and deterministic seed control.
    """

    DEFAULT_MODEL_ID = "runwayml/stable-diffusion-v1-5"

    # Cached pipeline singletons: {(model_id, device): pipeline_instance}
    _pipeline_cache: Dict[Tuple[str, str], Any] = {}

    # Thread-safe lock to prevent simultaneous model inferences and memory exhaustion
    _inference_lock = threading.Lock()

    @classmethod
    def get_inference_lock(cls) -> threading.Lock:
        """Returns the process-wide inference lock guarding neural diffusion execution."""
        return cls._inference_lock

    def __init__(
        self,
        default_model_id: str = DEFAULT_MODEL_ID,
        fallback_to_procedural: bool = True,
    ):
        self.default_model_id = default_model_id
        self.fallback_to_procedural = fallback_to_procedural

    @property
    def name(self) -> str:
        return "stable_diffusion"

    @property
    def is_available(self) -> bool:
        """Checks whether PyTorch and Diffusers packages are available in the runtime."""
        try:
            import torch  # noqa: F401
            import diffusers  # noqa: F401
            return True
        except ImportError:
            return False

    @classmethod
    def get_device_info(cls) -> Dict[str, Any]:
        """
        Inspects runtime hardware and returns recommended acceleration backend.
        Prioritizes Apple Silicon MPS (Metal), then CUDA, falling back to CPU.
        """
        info: Dict[str, Any] = {
            "device": "cpu",
            "torch_dtype": "float32",
            "mps_available": False,
            "cuda_available": False,
            "backend_description": "CPU Standard Precision",
        }
        try:
            import torch
            if torch.backends.mps.is_available():
                info["device"] = "mps"
                info["torch_dtype"] = "float16"
                info["mps_available"] = True
                info["backend_description"] = "Apple Silicon Metal Performance Shaders (MPS)"
            elif torch.cuda.is_available():
                info["device"] = "cuda"
                info["torch_dtype"] = "float16"
                info["cuda_available"] = True
                info["backend_description"] = f"NVIDIA CUDA ({torch.cuda.get_device_name(0)})"
        except ImportError:
            info["backend_description"] = "PyTorch not installed"
        return info

    @classmethod
    def unload_model(cls, model_id: Optional[str] = None):
        """Releases cached diffusion pipelines to free system memory."""
        if model_id:
            keys_to_remove = [k for k in cls._pipeline_cache if k[0] == model_id]
            for k in keys_to_remove:
                del cls._pipeline_cache[k]
        else:
            cls._pipeline_cache.clear()

        # Suggest garbage collection
        try:
            import gc
            import torch
            gc.collect()
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
            elif torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

    def _load_pipeline(self, model_id: str, device_info: Dict[str, Any]) -> Any:
        """
        Loads and caches a Hugging Face Stable Diffusion pipeline with memory optimizations.
        """
        device = device_info["device"]
        cache_key = (model_id, device)

        if cache_key in self._pipeline_cache:
            return self._pipeline_cache[cache_key]

        import torch
        from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

        dtype = torch.float16 if device_info["torch_dtype"] == "float16" else torch.float32

        load_kwargs: Dict[str, Any] = {
            "torch_dtype": dtype,
            "safety_checker": None,
        }

        # Try to load lightweight fp16 variant first if running half-precision
        if dtype == torch.float16:
            try:
                pipe = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    variant="fp16",
                    **load_kwargs,
                )
            except Exception:
                pipe = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    **load_kwargs,
                )
        else:
            pipe = StableDiffusionPipeline.from_pretrained(
                model_id,
                **load_kwargs,
            )

        # Use fast DPM-Solver++ scheduler for high quality at lower step count (20-25 steps)
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

        # Move to target device
        pipe = pipe.to(device)

        # Hardware & memory optimizations for 16GB Unified Memory / VRAM
        if hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing(slice_size="auto")
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()
        if hasattr(pipe, "enable_vae_tiling"):
            pipe.enable_vae_tiling()

        self._pipeline_cache[cache_key] = pipe
        return pipe

    def generate(
        self,
        config: TextureConfig,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> TextureResult:
        """
        Synthesizes a texture image using Stable Diffusion or triggers procedural fallback.

        Args:
            config: Texture configuration including prompt, resolution, seed, steps.
            progress_callback: Optional progress hook receiving (percentage, status_text).

        Returns:
            Standardized TextureResult.
        """
        start_time = time.perf_counter()
        model_id = config.model_id or self.default_model_id
        allow_fallback = config.fallback_to_procedural if config.fallback_to_procedural is not None else self.fallback_to_procedural
        seed = config.seed if config.seed is not None else int(time.time() * 1000) % 2147483647

        # 1. Verify dependencies
        if not self.is_available:
            err_msg = "StableDiffusionProvider: 'torch' and/or 'diffusers' libraries are not installed."
            if allow_fallback:
                if progress_callback:
                    progress_callback(20, f"{err_msg} Falling back to procedural engine...")
                res = ProceduralGenerator.generate(config)
                res.actual_provider = "procedural"
                res.requested_provider = self.name
                res.model_id = None
                res.warnings.append(f"{err_msg} Used procedural synthesis fallback.")
                return res
            return TextureResult(
                success=False,
                width=config.width,
                height=config.height,
                style=str(config.style),
                provider=self.name,
                actual_provider="none",
                requested_provider=self.name,
                model_id=model_id,
                errors=[err_msg],
            )

        # 2. Inspect target device
        device_info = self.get_device_info()
        device = device_info["device"]

        # 3. Load / retrieve cached pipeline
        if progress_callback:
            progress_callback(10, f"Initializing neural pipeline ({model_id}) on {device_info['backend_description']}...")

        pipe = None
        try:
            pipe = self._load_pipeline(model_id, device_info)
        except Exception as load_err:
            err_msg = f"Failed to load diffusion pipeline '{model_id}': {str(load_err)}"
            if allow_fallback:
                if progress_callback:
                    progress_callback(25, f"{err_msg}. Triggering procedural fallback...")
                res = ProceduralGenerator.generate(config)
                res.actual_provider = "procedural"
                res.requested_provider = self.name
                res.model_id = None
                res.warnings.append(f"{err_msg} Used procedural synthesis fallback.")
                return res
            return TextureResult(
                success=False,
                width=config.width,
                height=config.height,
                style=str(config.style),
                provider=self.name,
                actual_provider="none",
                requested_provider=self.name,
                model_id=model_id,
                errors=[err_msg],
            )

        # 4. Prepare prompt and negative prompt
        positive_prompt = self._craft_texture_prompt(config.prompt, config.style)
        negative_prompt = config.negative_prompt or (
            "blur, out of focus, watermark, text, signature, lowres, distorted, artifact, 3d render seams"
        )

        steps = config.num_inference_steps if hasattr(config, "num_inference_steps") and config.num_inference_steps else 25
        guidance = config.guidance_scale if hasattr(config, "guidance_scale") and config.guidance_scale else 7.5

        if progress_callback:
            progress_callback(20, f"Executing diffusion denoising ({steps} steps) on {device.upper()}...")

        # 5. Execute neural inference loop
        try:
            import torch

            # Deterministic generator
            generator = None
            if seed is not None:
                try:
                    generator = torch.Generator(device=device).manual_seed(seed)
                except Exception:
                    generator = torch.Generator("cpu").manual_seed(seed)

            # Step callback for fine-grained progress updates
            def step_callback(step: int, timestep: int, latents: Any):
                if progress_callback and steps > 0:
                    pct = int(20 + (step / float(steps)) * 70)
                    progress_callback(pct, f"Denoising latent manifold (step {step + 1}/{steps})...")

            kwargs: Dict[str, Any] = {
                "prompt": positive_prompt,
                "negative_prompt": negative_prompt,
                "width": config.width,
                "height": config.height,
                "num_inference_steps": steps,
                "guidance_scale": guidance,
                "generator": generator,
            }

            # Diffusers callback compatibility using inspect.signature
            import inspect
            try:
                sig = inspect.signature(pipe)
                if "callback" in sig.parameters:
                    kwargs["callback"] = step_callback
                    kwargs["callback_steps"] = max(1, steps // 5)
            except Exception:
                pass

            with self._inference_lock:
                inference_output = pipe(**kwargs)
            pil_image: Image.Image = inference_output.images[0]

            # Encode to lossless PNG buffer
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            image_bytes = buf.getvalue()

            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            if progress_callback:
                progress_callback(100, "Neural texture synthesis complete.")

            return TextureResult(
                success=True,
                image=pil_image,
                image_bytes=image_bytes,
                width=config.width,
                height=config.height,
                channels=3,
                style=str(config.style),
                provider=self.name,
                actual_provider=self.name,
                requested_provider=self.name,
                model_id=model_id,
                seed=seed,
                generation_time_ms=elapsed_ms,
                metadata={
                    "model_id": model_id,
                    "device": device,
                    "steps": steps,
                    "guidance_scale": guidance,
                    "positive_prompt": positive_prompt,
                    "negative_prompt": negative_prompt,
                },
            )

        except Exception as infer_err:
            err_str = str(infer_err)
            is_oom = "out of memory" in err_str.lower() or "mps" in err_str.lower()
            err_msg = f"Diffusion inference failure ({'Out of Memory' if is_oom else 'Execution Error'}): {err_str}"

            if is_oom:
                self.unload_model(model_id)

            if allow_fallback:
                if progress_callback:
                    progress_callback(30, f"{err_msg}. Triggering procedural fallback...")
                res = ProceduralGenerator.generate(config)
                res.actual_provider = "procedural"
                res.requested_provider = self.name
                res.model_id = None
                res.warnings.append(f"{err_msg} Used procedural synthesis fallback.")
                return res

            return TextureResult(
                success=False,
                width=config.width,
                height=config.height,
                style=str(config.style),
                provider=self.name,
                actual_provider="none",
                requested_provider=self.name,
                model_id=model_id,
                seed=seed,
                generation_time_ms=round((time.perf_counter() - start_time) * 1000.0, 2),
                errors=[err_msg],
            )

    @staticmethod
    def _craft_texture_prompt(user_prompt: Optional[str], style: Optional[str]) -> str:
        """
        Enhances prompt with professional texture-specific tags ensuring seamless material quality.
        """
        base = user_prompt or f"{style} texture surface"
        tags = "seamless texture, high resolution, 8k pbr material, flat albedo map, clean orthogonal surface"
        if style:
            tags += f", {style} material finish"
        return f"{base}, {tags}"
