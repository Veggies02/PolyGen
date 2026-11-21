"""
Unit & Integration Tests for Milestone 5A: Modular Texture Generation Engine
Covers:
- Procedural texture generation for all 9 styles
- Determinism and prompt-driven variance
- Resolution scaling (256, 512, 1024)
- Color palette steering & prompt inference
- Stable Diffusion provider architecture stubs
- Integration with TextureMapper and MeshProcessingPipeline
- Texture Generation API endpoints (/api/textures/*)
"""

import io
from unittest.mock import patch, MagicMock
import pytest
import numpy as np
from PIL import Image
from httpx import AsyncClient, ASGITransport

from app.main import app
from texture_engine.texture_config import TextureConfig, TextureStyle
from texture_engine.texture_result import TextureResult
from texture_engine.procedural_generator import ProceduralGenerator
from texture_engine.texture_generator import (
    TextureGenerator,
    ProceduralTextureProvider,
    StableDiffusionProvider,
    RemoteTextureProvider,
)
from mesh_processing.uv_unwrapper import UVUnwrapper
from mesh_processing.texture_mapper import TextureMapper, MaterialConfig
from mesh_processing.pipeline import MeshProcessingPipeline, PipelineConfig
from app.services.mesh_generator import ProceduralMeshFactory


ALL_STYLES = [
    "metallic",
    "wood",
    "stone",
    "marble",
    "carbon_fiber",
    "fabric",
    "ceramic",
    "scifi",
    "organic",
]


def test_all_nine_procedural_styles():
    """Verify that all 9 required procedural styles synthesize valid PNG images."""
    for style in ALL_STYLES:
        cfg = TextureConfig(style=style, width=256, height=256, seed=123)
        res = ProceduralGenerator.generate(cfg)

        assert res.success is True, f"Style '{style}' failed: {res.errors}"
        assert res.image is not None
        assert isinstance(res.image, Image.Image)
        assert res.image.size == (256, 256)
        assert res.image.mode == "RGB"
        assert res.image_bytes is not None
        assert len(res.image_bytes) > 1000
        # Check PNG header
        assert res.image_bytes[:8] == b"\x89PNG\r\n\x1a\n"
        assert res.style == style
        assert res.provider == "procedural"
        assert res.generation_time_ms > 0.0


def test_deterministic_seeding():
    """Verify that identical seeds produce identical arrays, while distinct seeds diverge."""
    cfg1 = TextureConfig(style="stone", width=256, height=256, seed=42)
    cfg2 = TextureConfig(style="stone", width=256, height=256, seed=42)
    cfg3 = TextureConfig(style="stone", width=256, height=256, seed=999)

    res1 = ProceduralGenerator.generate(cfg1)
    res2 = ProceduralGenerator.generate(cfg2)
    res3 = ProceduralGenerator.generate(cfg3)

    arr1 = np.array(res1.image)
    arr2 = np.array(res2.image)
    arr3 = np.array(res3.image)

    # Identical seed must be strictly equal
    assert np.array_equal(arr1, arr2)
    # Different seed must produce different texture
    assert not np.array_equal(arr1, arr3)


def test_prompt_driven_color_steering():
    """Verify that semantic color prompts adjust the synthesized color palette."""
    cfg_gold = TextureConfig(style="metallic", prompt="radiant golden dragon armor", seed=10)
    cfg_dark = TextureConfig(style="metallic", prompt="dark obsidian stealth plating", seed=10)

    res_gold = ProceduralGenerator.generate(cfg_gold)
    res_dark = ProceduralGenerator.generate(cfg_dark)

    arr_gold = np.array(res_gold.image)
    arr_dark = np.array(res_dark.image)

    # Golden texture should have significantly higher red and green channels than dark obsidian
    assert arr_gold[..., 0].mean() > arr_dark[..., 0].mean()
    assert arr_gold[..., 1].mean() > arr_dark[..., 1].mean()
    assert not np.array_equal(arr_gold, arr_dark)


def test_resolution_scaling():
    """Verify procedural generation across multiple standard power-of-two resolutions."""
    for res in [256, 512, 1024]:
        cfg = TextureConfig(style="carbon_fiber", width=res, height=res, seed=5)
        out = ProceduralGenerator.generate(cfg)
        assert out.success is True
        assert out.image.size == (res, res)
        assert out.width == res
        assert out.height == res


def test_style_inference_from_prompt():
    """Verify prompt keyword classifier correctly infers appropriate styles."""
    test_cases = [
        ("ancient wooden chest with brass locks", "wood"),
        ("chiseled granite rock monolith", "stone"),
        ("fluid carrara marble slab", "marble"),
        ("heavy brushed steel mech plating", "metallic"),
        ("woven carbon fiber automotive spoiler", "carbon_fiber"),
        ("linen denim fabric cape", "fabric"),
        ("glazed porcelain ceramic tea bowl", "ceramic"),
        ("cyberpunk recon tactical drone", "scifi"),
        ("biomorphic reptilian scales skin", "organic"),
    ]
    for prompt, expected_style in test_cases:
        inferred = TextureGenerator.infer_style_from_prompt(prompt)
        assert inferred == expected_style, f"Prompt '{prompt}' inferred '{inferred}', expected '{expected_style}'"


def test_custom_color_palette_override():
    """Verify explicit hex color palettes override procedural defaults."""
    custom_hex = ["#ff0000", "#00ff00", "#0000ff"]
    cfg = TextureConfig(style="scifi", color_palette=custom_hex, width=256, height=256, seed=1)
    res = ProceduralGenerator.generate(cfg)
    assert res.success is True
    # Verify primary color metadata reflects red #ff0000 = (1.0, 0.0, 0.0)
    primary = res.metadata["palette_primary"]
    assert primary[0] == 1.0
    assert primary[1] == 0.0
    assert primary[2] == 0.0


def test_unsupported_style_graceful_fallback():
    """Verify unsupported style names trigger a warning and gracefully fall back to scifi."""
    cfg = TextureConfig(style="holographic_hyperspace", width=256, height=256, seed=7)
    res = ProceduralGenerator.generate(cfg)
    assert res.success is True
    assert len(res.warnings) > 0
    assert "Unrecognized style" in res.warnings[0]


def test_empty_and_none_prompt_handling():
    """Verify None, empty string, and whitespace prompts are handled robustly."""
    for p in [None, "", "   "]:
        res = TextureGenerator.generate(prompt=p, style="ceramic", resolution=256)
        assert res.success is True
        assert res.image is not None


def test_stable_diffusion_provider_architecture():
    """Verify Stable Diffusion provider architecture and deterministic fallback behavior."""
    sd_provider = StableDiffusionProvider(fallback_to_procedural=True)
    assert sd_provider.name == "stable_diffusion"

    cfg = TextureConfig(style="wood", width=256, height=256, seed=3)
    
    # Explicitly mock pipeline loading failure to verify fallback deterministically,
    # independent of whether model weights are cached in the ambient environment.
    with patch.object(sd_provider, "_load_pipeline", side_effect=RuntimeError("Simulated uninitialized model / offline load failure")):
        res = sd_provider.generate(cfg)

    # When torch/diffusers pipeline fails or is uninitialized, it falls back to procedural engine cleanly
    assert res.success is True
    assert res.image is not None
    assert res.actual_provider == "procedural"
    assert any("StableDiffusionProvider" in w or "fallback" in w.lower() for w in res.warnings)


def test_sd_fallback_consistency_without_ambient_weights():
    """Regression test ensuring fallback operates consistently with mock dependencies and load failures."""
    sd_provider = StableDiffusionProvider(fallback_to_procedural=True)
    cfg = TextureConfig(style="stone", width=256, height=256, seed=42)

    # 1. Test missing dependencies fallback
    with patch.object(StableDiffusionProvider, "is_available", new=False):
        res_no_deps = sd_provider.generate(cfg)
        assert res_no_deps.success is True
        assert res_no_deps.actual_provider == "procedural"
        assert any("libraries are not installed" in w for w in res_no_deps.warnings)

    # 2. Test strict mode (fallback disabled) reports structured error
    strict_provider = StableDiffusionProvider(fallback_to_procedural=False)
    cfg_strict = TextureConfig(style="stone", width=256, height=256, seed=42, fallback_to_procedural=False)
    with patch.object(strict_provider, "_load_pipeline", side_effect=RuntimeError("Network timeout on HuggingFace Hub")):
        res_strict = strict_provider.generate(cfg_strict)
        assert res_strict.success is False
        assert len(res_strict.errors) > 0
        assert "Failed to load diffusion pipeline" in res_strict.errors[0]


def test_remote_provider_architecture():
    """Verify Remote inference provider stub returns clean status when unconfigured."""
    remote_provider = RemoteTextureProvider(endpoint_url=None)
    assert remote_provider.name == "remote_api"
    assert remote_provider.is_available is False

    cfg = TextureConfig(style="metallic", width=256, height=256)
    res = remote_provider.generate(cfg)
    assert res.success is False
    assert len(res.errors) > 0


def test_texture_result_helper_methods():
    """Verify TextureResult data URI and base64 export helpers."""
    res = TextureGenerator.generate(style="marble", resolution=256, seed=1)
    assert res.success is True

    b64 = res.to_base64()
    assert isinstance(b64, str)
    assert len(b64) > 100

    uri = res.to_data_uri()
    assert uri.startswith("data:image/png;base64,")


def test_integration_with_texture_mapper():
    """Verify applying a procedurally generated texture to a 3D mesh via TextureMapper."""
    import trimesh
    raw_cube = trimesh.creation.box(extents=(1.0, 1.0, 1.0))
    unwrapped_mesh, unwrap_res = UVUnwrapper.unwrap(raw_cube)
    assert unwrap_res.success is True
    assert unwrapped_mesh is not None

    tex_res = TextureGenerator.generate(style="wood", resolution=256, seed=42)
    assert tex_res.success is True

    mat_cfg = MaterialConfig(name="Procedural_Wood_Mat", metallic_factor=0.05, roughness_factor=0.8)
    textured_mesh, map_res = TextureMapper.apply_texture(
        mesh=unwrapped_mesh,
        texture=tex_res.image,
        material_config=mat_cfg,
    )

    assert map_res.success is True
    assert map_res.texture_applied is True
    assert isinstance(textured_mesh.visual, trimesh.visual.TextureVisuals)

    # Export to binary GLB and verify round-trip
    glb_bytes = TextureMapper.export_textured_glb(textured_mesh)
    verify = TextureMapper.verify_glb_round_trip(glb_bytes)
    assert verify["is_valid_gltf"] is True
    assert verify["has_texture_image"] is True
    assert verify["has_uvs"] is True


def test_pipeline_with_procedural_texture_generation():
    """Verify full MeshProcessingPipeline execution using procedural texture synthesis."""
    mesh_data = ProceduralMeshFactory.create_crystal()

    config = PipelineConfig(
        apply_texture=True,
        generate_procedural_texture=True,
        texture_style="marble",
        texture_prompt="iridescent crystalline marble monolith",
        texture_resolution=256,
        use_calibration_texture=False,
    )

    pipe_res = MeshProcessingPipeline.process_mesh(
        mesh_source=mesh_data,
        config=config,
        title="Marble Crystal Monolith",
    )

    assert pipe_res.success is True
    assert pipe_res.texture_result is not None
    assert pipe_res.texture_result.texture_applied is True
    assert len(pipe_res.glb_bytes) > 0
    assert len(pipe_res.obj_str) > 0
    assert pipe_res.round_trip_report["round_trip_success"] is True
    assert pipe_res.round_trip_report["has_texture_image"] is True


def test_pipeline_backward_compatibility_checkerboard():
    """Verify that default pipeline config retains calibration checkerboard behavior."""
    mesh_data = ProceduralMeshFactory.create_crystal()

    config = PipelineConfig(
        apply_texture=True,
        use_calibration_texture=True,
        generate_procedural_texture=False,
        texture_resolution=256,
    )

    pipe_res = MeshProcessingPipeline.process_mesh(
        mesh_source=mesh_data,
        config=config,
        title="Calibration Crystal",
    )

    assert pipe_res.success is True
    assert pipe_res.texture_result is not None
    assert pipe_res.texture_result.texture_applied is True
    assert pipe_res.round_trip_report["round_trip_success"] is True


@pytest.mark.asyncio
async def test_api_list_texture_styles():
    """Verify GET /api/textures/styles lists all 9 supported styles."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/textures/styles")
        assert res.status_code == 200
        styles = res.json()
        assert len(styles) == 9
        style_ids = [s["id"] for s in styles]
        for expected in ALL_STYLES:
            assert expected in style_ids


@pytest.mark.asyncio
async def test_api_generate_texture():
    """Verify POST /api/textures/generate returns valid data URI and telemetry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "obsidian titanium cyber hull",
            "style": "scifi",
            "resolution": 256,
            "seed": 77,
        }
        res = await client.post("/api/textures/generate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["style"] == "scifi"
        assert data["width"] == 256
        assert data["height"] == 256
        assert data["generator"] == "procedural"
        assert data["data_uri"].startswith("data:image/png;base64,")
        assert "/api/textures/preview" in data["preview_url"]
        assert data["generation_time_ms"] > 0


@pytest.mark.asyncio
async def test_api_preview_texture():
    """Verify GET /api/textures/preview streams raw PNG image bytes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/textures/preview?style=wood&resolution=256&seed=10")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(res.content) > 1000
