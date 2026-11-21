"""
Real-World Controlled Stable Diffusion Inference Test Script
Executes one single real inference run on Apple Silicon M4 with native MPS acceleration.
Uses strict mode (fallback_to_procedural=False) to ensure 100% genuine neural synthesis.
"""

import os
import sys
import time
from pathlib import Path
import psutil
import torch
from PIL import Image

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from texture_engine.texture_config import TextureConfig
from texture_engine.stable_diffusion_provider import StableDiffusionProvider


def get_process_memory_mb() -> float:
    """Returns the current process's RSS memory usage in megabytes."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def main():
    print("=" * 70)
    print("POLYGEN MILESTONE 5B: CONTROLLED STABLE DIFFUSION MPS INFERENCE TEST")
    print("=" * 70)

    # 1. Inspect environment and memory
    mem_initial = get_process_memory_mb()
    print(f"[Pre-Flight] Process RSS Memory: {mem_initial:.1f} MB")
    print(f"[Pre-Flight] PyTorch Version: {torch.__version__}")
    print(f"[Pre-Flight] MPS Built: {torch.backends.mps.is_built()}")
    print(f"[Pre-Flight] MPS Available: {torch.backends.mps.is_available()}")

    device_info = StableDiffusionProvider.get_device_info()
    print(f"[Pre-Flight] Resolved Device: {device_info['device'].upper()} ({device_info['backend_description']})")
    print(f"[Pre-Flight] Torch Precision: {device_info['torch_dtype']}")

    # 2. Configure target directory
    output_dir = BASE_DIR / "storage" / "textures"
    output_dir.mkdir(parents=True, exist_ok=True)
    target_png = output_dir / "test_titanium_sd_mps.png"

    # 3. Configure Controlled Test Parameters
    prompt = (
        "seamless brushed titanium metallic surface texture, neutral silver color, "
        "fine horizontal grain, uniform lighting, flat albedo material, no perspective, no shadows"
    )
    negative_prompt = "objects, perspective, text, watermark, shadows, reflections, blur"
    resolution = 512
    steps = 20
    guidance = 7.5
    seed = 42

    print("\n[Configuration]")
    print(f"  Model ID:               {StableDiffusionProvider.DEFAULT_MODEL_ID} (FP16)")
    print(f"  Prompt:                 {prompt}")
    print(f"  Negative Prompt:        {negative_prompt}")
    print(f"  Resolution:             {resolution} x {resolution}")
    print(f"  Inference Steps:        {steps}")
    print(f"  Guidance Scale (CFG):   {guidance}")
    print(f"  Deterministic Seed:     {seed}")
    print(f"  Target Output:          {target_png}")
    print(f"  Fallback To Procedural: FALSE (Strict Mode)")

    cfg = TextureConfig(
        prompt=prompt,
        negative_prompt=negative_prompt,
        style="metallic",
        width=resolution,
        height=resolution,
        num_inference_steps=steps,
        guidance_scale=guidance,
        seed=seed,
        fallback_to_procedural=False,  # STRICT: never substitute procedural!
        provider="stable_diffusion",
    )

    provider = StableDiffusionProvider(fallback_to_procedural=False)

    def on_progress(pct: int, msg: str):
        print(f"  -> [{pct:>3}%] {msg}")

    print("\n[Execution] Starting Neural Inference Pipeline...")
    t_start = time.perf_counter()

    res = provider.generate(cfg, progress_callback=on_progress)
    t_total = time.perf_counter() - t_start
    mem_post_inference = get_process_memory_mb()

    if not res.success:
        print(f"\n[FAILURE] Stable Diffusion generation failed with errors:")
        for err in res.errors:
            print(f"  - {err}")
        sys.exit(1)

    print("\n[Inference Completed Successfully]")
    print(f"  Execution Time:         {t_total:.2f} seconds ({res.generation_time_ms} ms)")
    print(f"  Process Memory Post-Inf: {mem_post_inference:.1f} MB (Delta: +{mem_post_inference - mem_initial:.1f} MB)")
    print(f"  Actual Provider:        {res.actual_provider}")
    print(f"  Model ID:               {res.model_id}")

    # Confirm it is genuinely Stable Diffusion
    assert res.actual_provider == "stable_diffusion", f"Expected 'stable_diffusion', got '{res.actual_provider}'!"
    assert res.image is not None, "Output PIL Image is None!"

    # 4. Save and Verify Image Output
    res.image.save(target_png, format="PNG")
    print(f"\n[Artifact Verification]")
    print(f"  Saved Image Path:       {target_png}")
    print(f"  File Exists on Disk:    {target_png.exists()}")
    file_size_kb = target_png.stat().st_size / 1024.0
    print(f"  File Size on Disk:      {file_size_kb:.1f} KB")

    # Reload from disk and verify
    with Image.open(target_png) as reloaded:
        print(f"  Reloaded Dimensions:    {reloaded.size[0]} x {reloaded.size[1]} (Expected: {resolution} x {resolution})")
        print(f"  Reloaded Mode/Channels: {reloaded.mode} (Expected: RGB)")
        assert reloaded.size == (resolution, resolution), "Dimension mismatch!"
        assert reloaded.mode == "RGB", "Color mode mismatch!"

    print("\n" + "=" * 70)
    print("SUCCESS: CONTROLLED REAL STABLE DIFFUSION INFERENCE PASSED ON MPS!")
    print("=" * 70)


if __name__ == "__main__":
    main()
