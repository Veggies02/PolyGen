"""
Unit and Integration Tests for Milestone 5B: Stable Diffusion Texture Provider
Covers:
- Provider registration and selection
- Device and hardware detection (Apple Silicon MPS / CUDA / CPU)
- Missing diffusers / PyTorch dependency handling
- Model loading failure and out-of-memory handling
- Strict mode vs. procedural fallback transparent reporting
- Mocked neural inference loop with deterministic seed handling
- Pipeline integration with Stable Diffusion provider
- REST API /api/textures/providers and /api/textures/generate
"""

import sys
from unittest.mock import MagicMock, patch
import pytest
import numpy as np
from PIL import Image
from httpx import AsyncClient, ASGITransport

from app.main import app
from texture_engine.texture_config import TextureConfig, TextureStyle
from texture_engine.texture_result import TextureResult
from texture_engine.texture_generator import TextureGenerator
from texture_engine.stable_diffusion_provider import StableDiffusionProvider
from mesh_processing.pipeline import MeshProcessingPipeline, PipelineConfig
from app.services.mesh_generator import ProceduralMeshFactory


def test_sd_provider_registration():
    """Verify StableDiffusionProvider is registered in TextureGenerator registry."""
    provider = TextureGenerator.get_provider("stable_diffusion")
    assert isinstance(provider, StableDiffusionProvider)
    assert provider.name == "stable_diffusion"


def test_sd_device_info_inspection():
    """Verify hardware detection returns valid device profile dictionary."""
    info = StableDiffusionProvider.get_device_info()
    assert "device" in info
    assert info["device"] in ["mps", "cuda", "cpu"]
    assert "torch_dtype" in info
    assert "backend_description" in info


def test_sd_missing_dependencies_strict_mode():
    """When dependencies are unavailable and fallback is disabled, return strict error."""
    provider = StableDiffusionProvider(fallback_to_procedural=False)

    with patch.object(StableDiffusionProvider, "is_available", new=False):
        cfg = TextureConfig(
            prompt="futuristic hull",
            provider="stable_diffusion",
            fallback_to_procedural=False,
            width=256,
            height=256,
        )
        res = provider.generate(cfg)

        assert res.success is False
        assert res.provider == "stable_diffusion"
        assert res.actual_provider == "none"
        assert res.requested_provider == "stable_diffusion"
        assert len(res.errors) > 0
        assert "libraries are not installed" in res.errors[0]


def test_sd_missing_dependencies_fallback_behavior():
    """When dependencies are unavailable but fallback is enabled, synthesize procedurally with warning."""
    provider = StableDiffusionProvider(fallback_to_procedural=True)

    with patch.object(StableDiffusionProvider, "is_available", new=False):
        cfg = TextureConfig(
            prompt="futuristic cyber armor",
            style="scifi",
            provider="stable_diffusion",
            fallback_to_procedural=True,
            width=256,
            height=256,
        )
        res = provider.generate(cfg)

        assert res.success is True
        assert res.image is not None
        assert res.actual_provider == "procedural"
        assert res.requested_provider == "stable_diffusion"
        assert len(res.warnings) > 0
        assert "fallback" in res.warnings[0].lower()


def test_sd_model_loading_failure_strict():
    """Verify failure to download/load checkpoint returns structured error in strict mode."""
    provider = StableDiffusionProvider(fallback_to_procedural=False)

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(provider, "_load_pipeline", side_effect=RuntimeError("Checkpoint 404")):
            cfg = TextureConfig(
                prompt="gold plating",
                provider="stable_diffusion",
                fallback_to_procedural=False,
                width=256,
                height=256,
            )
            res = provider.generate(cfg)

            assert res.success is False
            assert "Failed to load diffusion pipeline" in res.errors[0]
            assert res.actual_provider == "none"


def test_sd_model_loading_failure_fallback():
    """Verify failure to load checkpoint falls back to procedural when configured."""
    provider = StableDiffusionProvider(fallback_to_procedural=True)

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(provider, "_load_pipeline", side_effect=RuntimeError("Network timeout")):
            cfg = TextureConfig(
                prompt="gold plating",
                style="metallic",
                provider="stable_diffusion",
                fallback_to_procedural=True,
                width=256,
                height=256,
            )
            res = provider.generate(cfg)

            assert res.success is True
            assert res.actual_provider == "procedural"
            assert res.requested_provider == "stable_diffusion"
            assert any("Used procedural synthesis fallback" in w for w in res.warnings)


def test_sd_mocked_neural_inference_loop():
    """Verify successful diffusion inference loop using a mocked Diffusers pipeline."""
    provider = StableDiffusionProvider(fallback_to_procedural=False)

    mock_img = Image.new("RGB", (256, 256), color=(200, 150, 80))
    mock_pipeline_output = MagicMock()
    mock_pipeline_output.images = [mock_img]

    mock_pipe = MagicMock()
    mock_pipe.return_value = mock_pipeline_output

    progress_steps = []

    def progress_cb(pct, msg):
        progress_steps.append((pct, msg))

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(provider, "_load_pipeline", return_value=mock_pipe):
            with patch.dict(sys.modules, {"torch": MagicMock()}):
                cfg = TextureConfig(
                    prompt="weathered oak plank",
                    negative_prompt="modern, plastic",
                    style="wood",
                    provider="stable_diffusion",
                    fallback_to_procedural=False,
                    width=256,
                    height=256,
                    seed=777,
                    num_inference_steps=20,
                    guidance_scale=8.0,
                )
                res = provider.generate(cfg, progress_callback=progress_cb)

                assert res.success is True
                assert res.actual_provider == "stable_diffusion"
                assert res.provider == "stable_diffusion"
                assert res.image.size == (256, 256)
                assert res.metadata["steps"] == 20
                assert res.metadata["guidance_scale"] == 8.0
                assert "weathered oak plank" in res.metadata["positive_prompt"]
                assert res.metadata["negative_prompt"] == "modern, plastic"
                assert len(progress_steps) > 0


def test_sd_out_of_memory_cache_clearing():
    """Verify Out Of Memory triggers model cache clearance and cleanup."""
    provider = StableDiffusionProvider(fallback_to_procedural=False)

    mock_pipe = MagicMock()
    mock_pipe.side_effect = RuntimeError("MPS allocation failed: out of memory")

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(provider, "_load_pipeline", return_value=mock_pipe):
            with patch.dict(sys.modules, {"torch": MagicMock()}):
                with patch.object(StableDiffusionProvider, "unload_model") as mock_unload:
                    cfg = TextureConfig(
                        prompt="heavy stone",
                        provider="stable_diffusion",
                        fallback_to_procedural=False,
                        width=256,
                        height=256,
                    )
                    res = provider.generate(cfg)

                    assert res.success is False
                    assert "Out of Memory" in res.errors[0]
                    assert mock_unload.called


def test_sd_prompt_crafting():
    """Verify texture-specific PBR keywords are appended to user prompts."""
    enhanced = StableDiffusionProvider._craft_texture_prompt("brushed titanium", "metallic")
    assert "brushed titanium" in enhanced
    assert "seamless texture" in enhanced
    assert "flat albedo map" in enhanced
    assert "metallic material finish" in enhanced


def test_pipeline_integration_with_stable_diffusion():
    """Verify MeshProcessingPipeline executes cleanly when configured with Stable Diffusion provider."""
    mesh_data = ProceduralMeshFactory.create_crystal()

    config = PipelineConfig(
        apply_texture=True,
        texture_provider="stable_diffusion",
        texture_prompt="iridescent bismuth crystal",
        texture_style="stone",
        texture_resolution=256,
        texture_fallback_to_procedural=True,
        use_calibration_texture=False,
    )

    pipe_res = MeshProcessingPipeline.process_mesh(
        mesh_source=mesh_data,
        config=config,
        title="Bismuth Monolith",
    )

    assert pipe_res.success is True
    assert pipe_res.texture_result is not None
    assert pipe_res.texture_result.texture_applied is True
    assert pipe_res.attributes["texture_provider"] == "stable_diffusion"
    assert len(pipe_res.glb_bytes) > 0


@pytest.mark.asyncio
async def test_api_providers_endpoint():
    """Verify GET /api/textures/providers returns information on procedural and Stable Diffusion backends."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/textures/providers")
        assert res.status_code == 200
        data = res.json()
        assert "providers" in data
        assert "procedural" in data["providers"]
        assert "stable_diffusion" in data["providers"]
        assert data["providers"]["procedural"]["available"] is True
        assert "device_info" in data["providers"]["stable_diffusion"]


@pytest.mark.asyncio
async def test_api_generate_with_stable_diffusion_fallback():
    """Verify POST /api/textures/generate transparently reports fallback when neural diffusion is unavailable."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "futuristic carbon plating",
            "style": "carbon_fiber",
            "provider": "stable_diffusion",
            "fallback_to_procedural": True,
            "resolution": 256,
        }
        res = await client.post("/api/textures/generate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["generator"] == "stable_diffusion"
        # Transparent reporting: actual_provider must reflect procedural fallback
        assert data["actual_provider"] == "procedural"
        assert len(data["warnings"]) > 0


@pytest.mark.asyncio
async def test_api_generate_with_stable_diffusion_strict_mode():
    """Verify POST /api/textures/generate raises 500 when neural diffusion is unavailable in strict mode."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "futuristic carbon plating",
            "style": "carbon_fiber",
            "provider": "stable_diffusion",
            "fallback_to_procedural": False,
            "resolution": 256,
        }
        res = await client.post("/api/textures/generate", json=payload)
        assert res.status_code == 500
        err = res.json()
        assert "detail" in err
        assert "Texture generation failed" in err["detail"]
