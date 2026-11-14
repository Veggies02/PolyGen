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
