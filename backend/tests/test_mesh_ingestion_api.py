"""
Comprehensive Test Suite for Milestone 6.2: External Mesh Ingestion API (POST /api/mesh/process)
Covers:
1. Capabilities discovery (GET /api/mesh/capabilities)
2. OBJ file upload and procedural texturing
3. GLB file upload and procedural texturing
4. Unsupported file format rejection (.stl, .ply)
5. Empty file (0 bytes) rejection
6. Malformed GLB binary rejection
7. Malformed OBJ text rejection
8. Invalid texture configuration validation (Pydantic 422)
9. Mocked Stable Diffusion neural generation
10. Stable Diffusion fallback behavior with explicit warnings
11. GLB round-trip verification on processed uploads
12. Asset storage persistence and multi-format download
13. Concurrency protection guarding neural model inference
"""

import asyncio
import io
import json
import time
from unittest.mock import patch, MagicMock
from pathlib import Path
import pytest
from PIL import Image
import trimesh
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.storage import asset_storage
from mesh_processing.texture_mapper import TextureMapper
from texture_engine.stable_diffusion_provider import StableDiffusionProvider


# ----------------------------------------------------------------------
# Geometry Fixtures (Wedge OBJ & Cube GLB)
# ----------------------------------------------------------------------

SAMPLE_OBJ_TEXT = """# Valid 3D Wedge OBJ
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
v 0.0 0.0 1.0
v 1.0 0.0 1.0
f 1 2 3
f 1 3 4
f 1 5 6
f 1 6 2
f 2 6 3
f 4 3 6
f 1 4 5
"""

def create_sample_glb_bytes() -> bytes:
    """Creates a minimal valid binary glTF 2.0 file from Trimesh."""
    box = trimesh.creation.box(extents=(1.0, 1.0, 1.0))
    glb_data = box.export(file_type="glb")
    return glb_data if isinstance(glb_data, bytes) else glb_data.encode("ascii")


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_capabilities_endpoint():
    """Capabilities endpoint returns supported formats, size limits, and provider status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/mesh/capabilities")
        assert res.status_code == 200
        data = res.json()
        assert "glb" in data["supported_formats"]
        assert "obj" in data["supported_formats"]
        assert data["max_upload_size_mb"] >= 10
        assert "procedural" in data["texture_providers"]
        assert "stable_diffusion" in data["texture_providers"]


@pytest.mark.asyncio
async def test_obj_upload_and_procedural_processing():
    """Valid OBJ file is ingested, unwrapped, textured, and exported as a verified GLB."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {
            "file": ("test_wedge.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
        }
        data = {
            "texture_provider": "procedural",
            "texture_style": "wood",
            "texture_prompt": "polished walnut block",
            "texture_resolution": "256",
            "texture_seed": "42",
            "title": "Walnut Wedge",
        }
        res = await client.post("/api/mesh/process", files=files, data=data)
        assert res.status_code == 201
        resp = res.json()

        assert resp["success"] is True
        assert resp["title"] == "Walnut Wedge"
        assert resp["format_uploaded"] == "obj"
        assert resp["requested_texture_provider"] == "procedural"
        assert resp["actual_texture_provider"] == "procedural"
        assert resp["is_fallback"] is False
        assert resp["texture_style"] == "wood"
        assert resp["poly_count"] > 0
        assert resp["vertex_count"] > 0
        assert "glb" in resp["formats"]
        assert resp["metrics"]["round_trip_success"] is True

        # Verify downloading the generated GLB
        glb_res = await client.get(resp["download_url"])
        assert glb_res.status_code == 200
        assert glb_res.content.startswith(b"glTF")

        # Verify round trip inspection
        inspect_report = TextureMapper.verify_glb_round_trip(glb_res.content)
        assert inspect_report["is_valid_gltf"] is True
        assert inspect_report["round_trip_success"] is True
        assert inspect_report["has_uvs"] is True
        assert inspect_report["has_texture_image"] is True


@pytest.mark.asyncio
async def test_glb_upload_and_procedural_processing():
    """Valid GLB binary file is ingested, unwrapped, textured with metallic style, and stored."""
    transport = ASGITransport(app=app)
    glb_content = create_sample_glb_bytes()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {
            "file": ("sample_cube.glb", io.BytesIO(glb_content), "model/gltf-binary")
        }
        data = {
            "texture_provider": "procedural",
            "texture_style": "metallic",
            "texture_resolution": "256",
            "metallic_factor": "0.8",
            "roughness_factor": "0.2",
            "title": "Chrome Box",
        }
        res = await client.post("/api/mesh/process", files=files, data=data)
        assert res.status_code == 201
        resp = res.json()

        assert resp["success"] is True
        assert resp["format_uploaded"] == "glb"
        assert resp["poly_count"] == 12  # Box has 12 triangular faces
        assert resp["actual_texture_provider"] == "procedural"


@pytest.mark.asyncio
async def test_unsupported_file_format_rejection():
    """Uploading files other than .obj or .glb returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. STL file rejected
        files = {"file": ("model.stl", io.BytesIO(b"solid test\nendsolid\n"), "model/stl")}
        res = await client.post("/api/mesh/process", files=files)
        assert res.status_code == 400
        assert "Unsupported file format" in res.json()["detail"]

        # 2. PLY file rejected
        files_ply = {"file": ("model.ply", io.BytesIO(b"ply\n"), "application/octet-stream")}
        res_ply = await client.post("/api/mesh/process", files=files_ply)
        assert res_ply.status_code == 400


@pytest.mark.asyncio
async def test_empty_file_rejection():
    """Uploading a 0-byte file returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("empty.obj", io.BytesIO(b""), "text/plain")}
        res = await client.post("/api/mesh/process", files=files)
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_malformed_glb_rejection():
    """Uploading a corrupted GLB missing the 'glTF' binary magic header returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        corrupted = b"NOT_GLTF_DATA_JUST_RANDOM_BYTES" + (b"\x00" * 100)
        files = {"file": ("corrupted.glb", io.BytesIO(corrupted), "model/gltf-binary")}
        res = await client.post("/api/mesh/process", files=files)
        assert res.status_code == 400
        assert "glTF" in res.json()["detail"]


@pytest.mark.asyncio
async def test_malformed_obj_rejection():
    """Uploading an OBJ file with no geometric vertex definitions returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        text_without_verts = "# Just comments\n# No vertices\ng Group1\ns 1\n"
        files = {"file": ("no_verts.obj", io.BytesIO(text_without_verts.encode("utf-8")), "text/plain")}
        res = await client.post("/api/mesh/process", files=files)
        assert res.status_code == 400
        assert "vertex" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_texture_config_rejection():
    """Passing invalid texture parameters triggers Pydantic 422 Unprocessable Entity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid provider
        files = {"file": ("test.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")}
        res = await client.post("/api/mesh/process", files=files, data={"texture_provider": "invalid_magic_ai"})
        assert res.status_code == 422

        # Invalid style
        res_style = await client.post("/api/mesh/process", files=files, data={"texture_style": "spaghetti_sauce"})
        assert res_style.status_code == 422

        # Invalid resolution (out of bounds)
        res_res = await client.post("/api/mesh/process", files=files, data={"texture_resolution": "99999"})
        assert res_res.status_code == 422


@pytest.mark.asyncio
async def test_stable_diffusion_provider_mocked():
    """Selecting stable_diffusion provider executes neural generation and reports actual_provider correctly."""
    transport = ASGITransport(app=app)

    # Synthetic 256x256 test image
    mock_img = Image.new("RGB", (256, 256), color=(200, 180, 150))
    mock_pipe = MagicMock()
    mock_pipe.return_value = MagicMock(images=[mock_img])

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(StableDiffusionProvider, "_load_pipeline", return_value=mock_pipe):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                files = {
                    "file": ("ai_model.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
                }
                data = {
                    "texture_provider": "stable_diffusion",
                    "texture_prompt": "brushed titanium surface with scratches",
                    "texture_resolution": "256",
                    "fallback_to_procedural": "false",
                    "title": "Neural Titanium Wedge",
                }
                res = await client.post("/api/mesh/process", files=files, data=data)
                assert res.status_code == 201
                resp = res.json()

                assert resp["success"] is True
                assert resp["requested_texture_provider"] == "stable_diffusion"
                assert resp["actual_texture_provider"] == "stable_diffusion"
                assert resp["is_fallback"] is False


@pytest.mark.asyncio
async def test_stable_diffusion_fallback_behavior():
    """When Stable Diffusion loading fails and fallback is enabled, synthesizes procedurally with warning."""
    transport = ASGITransport(app=app)

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(StableDiffusionProvider, "_load_pipeline", side_effect=RuntimeError("GPU Stockout")):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                files = {
                    "file": ("fallback_model.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
                }
                data = {
                    "texture_provider": "stable_diffusion",
                    "texture_style": "stone",
                    "texture_resolution": "256",
                    "fallback_to_procedural": "true",
                    "title": "Fallback Stone Wedge",
                }
                res = await client.post("/api/mesh/process", files=files, data=data)
                assert res.status_code == 201
                resp = res.json()

                assert resp["success"] is True
                assert resp["requested_texture_provider"] == "stable_diffusion"
                # Actual provider is transparently reported as procedural
                assert resp["actual_texture_provider"] == "procedural"
                assert resp["is_fallback"] is True
                assert len(resp["warnings"]) > 0
                assert any("fallback" in w.lower() or "stablediffusionprovider" in w.lower() for w in resp["warnings"])


@pytest.mark.asyncio
async def test_stable_diffusion_strict_failure_rejection():
    """When Stable Diffusion loading fails in strict mode (fallback disabled), endpoint rejects with 422."""
    transport = ASGITransport(app=app)

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(StableDiffusionProvider, "_load_pipeline", side_effect=RuntimeError("GPU Memory Contention")):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                files = {
                    "file": ("strict_model.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
                }
                data = {
                    "texture_provider": "stable_diffusion",
                    "texture_style": "stone",
                    "texture_resolution": "256",
                    "fallback_to_procedural": "false",
                    "title": "Strict Stone Wedge",
                }
                res = await client.post("/api/mesh/process", files=files, data=data)
                assert res.status_code == 422
                assert "Strict Texture Synthesis Failed" in res.json()["detail"]


@pytest.mark.asyncio
async def test_processed_asset_storage_and_multi_format_download():
    """Processed external models are saved into AssetStorageService and downloadable in all formats."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {
            "file": ("full_lifecycle.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
        }
        data = {
            "texture_provider": "procedural",
            "texture_style": "carbon_fiber",
            "texture_resolution": "256",
            "title": "Carbon Wedge",
        }
        res = await client.post("/api/mesh/process", files=files, data=data)
        assert res.status_code == 201
        asset_id = res.json()["asset_id"]

        # 1. Fetch metadata from /api/assets/{id}
        meta_res = await client.get(f"/api/assets/{asset_id}")
        assert meta_res.status_code == 200
        meta = meta_res.json()
        assert meta["title"] == "Carbon Wedge"
        assert meta["provider"] == "external_ingestion"

        # 2. Download GLB
        glb_res = await client.get(f"/api/assets/{asset_id}/download/glb")
        assert glb_res.status_code == 200
        assert glb_res.content.startswith(b"glTF")

        # 3. Download OBJ
        obj_res = await client.get(f"/api/assets/{asset_id}/download/obj")
        assert obj_res.status_code == 200
        assert "vt " in obj_res.text

        # 4. Download STL
        stl_res = await client.get(f"/api/assets/{asset_id}/download/stl")
        assert stl_res.status_code == 200
        assert len(stl_res.content) > 0


@pytest.mark.asyncio
async def test_concurrent_inference_protection():
    """Simultaneous requests to Stable Diffusion are protected by concurrency semaphore."""
    transport = ASGITransport(app=app)

    concurrency_counter = 0
    max_concurrency = 0

    def mock_inference_call(*args, **kwargs):
        nonlocal concurrency_counter, max_concurrency
        concurrency_counter += 1
        if concurrency_counter > max_concurrency:
            max_concurrency = concurrency_counter
        # Artificial sleep to simulate inference duration
        time.sleep(0.08)
        img = Image.new("RGB", (128, 128), color=(100, 100, 100))
        concurrency_counter -= 1
        return MagicMock(images=[img])

    mock_pipe = MagicMock()
    mock_pipe.side_effect = mock_inference_call

    with patch.object(StableDiffusionProvider, "is_available", new=True):
        with patch.object(StableDiffusionProvider, "_load_pipeline", return_value=mock_pipe):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                async def send_request(idx: int):
                    files = {
                        "file": (f"model_{idx}.obj", io.BytesIO(SAMPLE_OBJ_TEXT.encode("utf-8")), "text/plain")
                    }
                    data = {
                        "texture_provider": "stable_diffusion",
                        "texture_prompt": f"metallic alloy test {idx}",
                        "texture_resolution": "128",
                        "fallback_to_procedural": "false",
                    }
                    return await client.post("/api/mesh/process", files=files, data=data)

                # Fire 3 requests concurrently
                responses = await asyncio.gather(
                    send_request(1),
                    send_request(2),
                    send_request(3),
                )

                for r in responses:
                    assert r.status_code == 201

                # Concurrency was strictly serialized to 1 at a time!
                assert max_concurrency == 1


@pytest.mark.asyncio
async def test_capabilities_includes_qem():
    """Capabilities endpoint reports QEM simplification engine availability."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/mesh/capabilities")
        assert res.status_code == 200
        data = res.json()
        assert "qem_simplification" in data
        assert data["qem_simplification"]["available"] is True


@pytest.mark.asyncio
async def test_api_mesh_process_with_qem_optimization():
    """POST /api/mesh/process can decimate polygon count before UV parameterization."""
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=1.0)  # 320 faces
    obj_raw = sphere.export(file_type="obj")
    obj_bytes = obj_raw.encode("utf-8") if isinstance(obj_raw, str) else obj_raw

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {
            "file": ("sphere_320.obj", io.BytesIO(obj_bytes), "text/plain")
        }
        data = {
            "texture_provider": "procedural",
            "texture_style": "metallic",
            "enable_optimization": "true",
            "target_faces": "80",
        }
        res = await client.post("/api/mesh/process", files=files, data=data)
        assert res.status_code == 201
        resp_data = res.json()
        assert resp_data["success"] is True
        assert abs(resp_data["poly_count"] - 80) <= 2
        opt_info = resp_data["metrics"]["optimization"]
        assert opt_info["optimized"] is True
        assert opt_info["original_face_count"] == 320
        assert abs(opt_info["final_face_count"] - 80) <= 2

