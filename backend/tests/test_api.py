import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.storage import asset_storage
from app.services.mesh_generator import ProceduralMeshFactory

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "version" in data

@pytest.mark.asyncio
async def test_list_providers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/providers")
        assert res.status_code == 200
        providers = res.json()
        assert len(providers) >= 3
        ids = [p["id"] for p in providers]
        assert "demo" in ids
        assert "tripo" in ids
        assert "meshy" in ids
        
        demo = next(p for p in providers if p["id"] == "demo")
        assert demo["is_configured"] is True
        assert demo["is_demo"] is True

@pytest.mark.asyncio
async def test_list_and_download_assets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/assets")
        assert res.status_code == 200
        assets = res.json()
        assert len(assets) > 0
        
        sample_id = assets[0]["id"]
        # Download GLB
        glb_res = await client.get(f"/api/assets/{sample_id}/download/glb")
        assert glb_res.status_code == 200
        # Check glTF 2.0 binary header
        assert glb_res.content[:4] == b"glTF"
        
        # Download OBJ
        obj_res = await client.get(f"/api/assets/{sample_id}/download/obj")
        assert obj_res.status_code == 200
        assert "v " in obj_res.text
        
        # Download STL
        stl_res = await client.get(f"/api/assets/{sample_id}/download/stl")
        assert stl_res.status_code == 200
        assert len(stl_res.content) > 84

        # Download All-in-One ZIP Bundle
        bundle_res = await client.get(f"/api/assets/{sample_id}/bundle")
        assert bundle_res.status_code == 200
        assert bundle_res.headers["content-type"] == "application/zip"
        assert len(bundle_res.content) > 200
        # Check ZIP magic header (PK\x03\x04)
        assert bundle_res.content[:4] == b"PK\x03\x04"

@pytest.mark.asyncio
async def test_enhance_prompt():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"prompt": "cybernetic assault mech", "style": "cyberpunk"}
        res = await client.post("/api/generate/enhance-prompt", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "enhanced_prompt" in data
        assert len(data["suggested_tags"]) > 0

@pytest.mark.asyncio
async def test_generate_job_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "futuristic hovering crystal sensor",
            "provider": "demo",
            "style": "scifi",
            "poly_budget": "medium",
            "symmetry": True
        }
        res = await client.post("/api/generate", json=payload)
        assert res.status_code == 200
        job_data = res.json()
        job_id = job_data["id"]
        assert job_data["status"] == "queued"

        # Poll until complete (demo mode takes ~3-4s)
        completed = False
        for _ in range(20):
            await asyncio.sleep(0.5)
            status_res = await client.get(f"/api/generate/jobs/{job_id}")
            assert status_res.status_code == 200
            j = status_res.json()
            if j["status"] == "completed":
                completed = True
                assert j["asset_id"] is not None
                break
        assert completed is True

@pytest.mark.asyncio
async def test_stats():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["total_assets"] >= 4
        assert data["available_providers"] >= 3

@pytest.mark.asyncio
async def test_prompt_validation_failures():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Whitespace only prompt
        res = await client.post("/api/generate", json={"prompt": "   ", "provider": "demo", "style": "scifi"})
        assert res.status_code == 422

        # 2. Invalid style
        res = await client.post("/api/generate", json={"prompt": "cool drone", "provider": "demo", "style": "invalid_style"})
        assert res.status_code == 422

        # 3. Invalid provider
        res = await client.post("/api/generate", json={"prompt": "cool drone", "provider": "unknown_ai", "style": "scifi"})
        assert res.status_code == 422

@pytest.mark.asyncio
async def test_new_procedural_mesh_types():
    # Blade weapon
    blade = ProceduralMeshFactory.generate_by_prompt("tactical energy sword with curved plasma edge", style="cyberpunk")
    assert blade.name == "Cyber_Blade_Weapon"
    assert blade.poly_count > 30
    assert len(blade.export_glb()) > 500

    # Modular habitat tower
    tower = ProceduralMeshFactory.generate_by_prompt("modular skyscraper habitat tower with cantilevered pods", style="scifi")
    assert tower.name == "Modular_Habitat_Tower"
    assert tower.poly_count > 50
    assert len(tower.export_glb()) > 500

@pytest.mark.asyncio
async def test_asset_deletion():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a disposable asset
        mesh = ProceduralMeshFactory.create_drone()
        asset = asset_storage.save_asset(
            title="Disposable Test Drone",
            prompt="disposable drone for deletion testing",
            provider="demo",
            style="scifi",
            glb_bytes=mesh.export_glb(),
            obj_str=mesh.export_obj(),
            stl_bytes=mesh.export_stl(),
            poly_count=mesh.poly_count,
            vertex_count=mesh.vertex_count,
            is_demo=True
        )
        asset_id = asset.id

        # Verify it exists
        get_res = await client.get(f"/api/assets/{asset_id}")
        assert get_res.status_code == 200

        # Delete it
        del_res = await client.delete(f"/api/assets/{asset_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Verify it no longer exists
        get_res2 = await client.get(f"/api/assets/{asset_id}")
        assert get_res2.status_code == 404
