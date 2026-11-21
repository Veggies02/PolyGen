"""
Regression Tests for Milestone 6.1: Asset Storage Serialization & Metadata Cleanliness
Verifies that:
1. Binary buffers in aux_files are never serialized into assets_index.json.
2. Companion files (.obj, .mtl, .png) are correctly saved to disk and retrievable.
3. Legacy polluted index entries with binary strings are automatically sanitized on load.
"""

import io
import json
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.storage import AssetStorageService, asset_storage
from app.services.mesh_generator import ProceduralMeshFactory


def test_save_asset_sanitizes_binary_aux_files(tmp_path: Path):
    """Saving an asset with binary aux_files writes files to disk but stores only clean metadata in index."""
    test_storage = AssetStorageService(base_dir=tmp_path / "assets")

    dummy_mtl = b"# Test MTL File\nnewmtl TestMaterial\nKd 1.0 1.0 1.0\nmap_Kd test_texture.png\n"
    dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + (b"\x00" * 50) + b"IEND\xaeB`\x82"

    raw_attributes = {
        "engine": "TestEngine",
        "has_mtl": True,
        "aux_files": {
            "test_material.mtl": dummy_mtl,
            "test_texture.png": dummy_png,
        },
    }

    asset = test_storage.save_asset(
        title="Sanitization Test Asset",
        prompt="test prompt for storage sanitization",
        provider="demo",
        style="scifi",
        glb_bytes=b"glTF\x02\x00\x00\x00" + (b"\x00" * 30),
        obj_str="v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n",
        stl_bytes=b"solid test\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nendloop\nendfacet\nendsolid\n",
        poly_count=1,
        vertex_count=3,
        attributes=raw_attributes,
        is_demo=True,
    )

    # 1. Verify companion files physically exist on disk
    asset_dir = tmp_path / "assets" / asset.id
    assert (asset_dir / f"{asset.id}.glb").exists()
    assert (asset_dir / f"{asset.id}.obj").exists()
    assert (asset_dir / f"{asset.id}.stl").exists()

    mtl_path = test_storage.get_file_path(asset.id, "mtl")
    assert mtl_path is not None
    assert mtl_path.exists()
    assert mtl_path.read_bytes() == dummy_mtl

    png_path = test_storage.get_file_path(asset.id, "png")
    assert png_path is not None
    assert png_path.exists()
    assert png_path.read_bytes() == dummy_png

    # 2. Inspect raw index file text on disk
    index_file = tmp_path / "assets" / "assets_index.json"
    assert index_file.exists()
    index_raw_text = index_file.read_text(encoding="utf-8")

    # Critical assertions: NO Python binary string representations in JSON!
    assert "b'\\x89PNG" not in index_raw_text
    assert "b'#" not in index_raw_text
    assert "\\x89PNG" not in index_raw_text

    # 3. Parse index JSON and check clean metadata structure
    with open(index_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) >= 1
    stored_entry = next(item for item in data if item["id"] == asset.id)
    stored_aux = stored_entry["attributes"]["aux_files"]

    assert "test_material.mtl" in stored_aux
    assert stored_aux["test_material.mtl"]["filename"] == "test_material.mtl"
    assert stored_aux["test_material.mtl"]["format"] == "mtl"
    assert stored_aux["test_material.mtl"]["size_bytes"] == len(dummy_mtl)
    assert stored_aux["test_material.mtl"]["path"] == f"{asset.id}/test_material.mtl"

    assert "test_texture.png" in stored_aux
    assert stored_aux["test_texture.png"]["filename"] == "test_texture.png"
    assert stored_aux["test_texture.png"]["format"] == "png"
    assert stored_aux["test_texture.png"]["size_bytes"] == len(dummy_png)
    assert stored_aux["test_texture.png"]["path"] == f"{asset.id}/test_texture.png"


def test_sanitize_attributes_static_method(tmp_path: Path):
    """Unit test for AssetStorageService._sanitize_attributes."""
    sample_dir = tmp_path / "sample_asset"
    sample_dir.mkdir(parents=True)
    sample_file = sample_dir / "custom.png"
    sample_file.write_bytes(b"\x89PNG_TEST_DATA_12345")

    attrs = {
        "is_valid": True,
        "aux_files": {
            "custom.png": b"\x89PNG_TEST_DATA_12345",
            "legacy_string.png": "b'\\x89PNG\\r\\n\\x1a\\n" + ("\\x00" * 300) + "'",
            "plain_text.mtl": "newmtl Material",
        },
    }

    clean = AssetStorageService._sanitize_attributes(attrs, asset_dir=sample_dir, asset_id="sample_asset")

    assert clean["is_valid"] is True
    aux = clean["aux_files"]
    assert aux["custom.png"]["size_bytes"] == len(b"\x89PNG_TEST_DATA_12345")
    assert aux["custom.png"]["format"] == "png"
    assert aux["custom.png"]["path"] == "sample_asset/custom.png"

    # Legacy repr string is sanitized into compact metadata without retaining the buffer
    assert isinstance(aux["legacy_string.png"], dict)
    assert aux["legacy_string.png"]["format"] == "png"
    assert aux["legacy_string.png"]["size_bytes"] > 0
    assert "b'\\x89PNG" not in str(aux["legacy_string.png"])


def test_load_index_auto_sanitizes_polluted_entries(tmp_path: Path):
    """When loading an index containing legacy binary strings, it automatically cleans them and resaves."""
    base_dir = tmp_path / "legacy_assets"
    base_dir.mkdir(parents=True)
    index_file = base_dir / "assets_index.json"

    # Create dummy asset directory
    asset_id = "leg12345"
    asset_dir = base_dir / asset_id
    asset_dir.mkdir(parents=True)
    (asset_dir / f"{asset_id}.glb").write_bytes(b"glTF\x02\x00\x00\x00" + b"\x00" * 20)
    (asset_dir / "texture.png").write_bytes(b"\x89PNG_LEGACY_BUFFER")

    polluted_data = [
        {
            "id": asset_id,
            "title": "Legacy Polluted Asset",
            "prompt": "polluted test",
            "provider": "demo",
            "style": "scifi",
            "poly_count": 10,
            "vertex_count": 20,
            "file_size_bytes": 100,
            "formats": {"glb": f"/api/assets/{asset_id}/download/glb"},
            "created_at": "2026-11-18 12:00:00+00:00",
            "is_demo": True,
            "attributes": {
                "aux_files": {
                    "texture.png": "b'\\x89PNG" + ("\\x00" * 400) + "'",
                }
            },
        }
    ]

    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(polluted_data, f)

    # Initialize service and trigger load
    service = AssetStorageService(base_dir=base_dir)
    loaded = service.list_assets()

    assert len(loaded) == 1
    # Check that disk index was rewritten cleanly
    resaved_text = index_file.read_text(encoding="utf-8")
    assert "b'\\x89PNG" not in resaved_text
    assert len(resaved_text) < 1000  # Compact


@pytest.mark.asyncio
async def test_companion_mtl_and_png_downloadable_via_api():
    """Verify that companion files can be downloaded via standard API endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check assets list
        res = await client.get("/api/assets")
        assert res.status_code == 200
        assets = res.json()
        assert len(assets) > 0

        # Find an asset with mtl or png format
        target = next((a for a in assets if "mtl" in a.get("formats", {}) or "png" in a.get("formats", {})), None)
        if target:
            aid = target["id"]
            if "mtl" in target["formats"]:
                mtl_res = await client.get(f"/api/assets/{aid}/download/mtl")
                assert mtl_res.status_code == 200
                assert len(mtl_res.content) > 0

            if "png" in target["formats"]:
                png_res = await client.get(f"/api/assets/{aid}/download/png")
                assert png_res.status_code == 200
                assert png_res.content.startswith(b"\x89PNG")
