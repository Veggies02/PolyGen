"""
Integration Test Suite for PolyGen Mesh Processing Pipeline
Tests end-to-end integration across MeshValidator, UVUnwrapper, TextureMapper,
AssetStorageService, JobManager, and API asset downloads.
"""

import io
import pytest
import numpy as np
import trimesh
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.mesh_generator import ProceduralMeshFactory
from app.services.storage import asset_storage
from mesh_processing.pipeline import (
    MeshProcessingPipeline,
    PipelineConfig,
    PipelineResult,
)
from mesh_processing.mesh_validator import MeshValidator
from mesh_processing.texture_mapper import TextureMapper


# ----------------------------------------------------------------------
# 1. Pipeline Ingestion & Multi-Format Input Tests
# ----------------------------------------------------------------------

def test_pipeline_procedural_meshdata_input():
    """Pipeline accepts raw Procedural MeshData from ProceduralMeshFactory."""
    drone = ProceduralMeshFactory.create_drone()
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=drone,
        title="Integration_Drone",
    )

    assert result.success is True
    assert result.poly_count == drone.poly_count
    assert result.glb_bytes.startswith(b"glTF")
    assert len(result.obj_str) > 0
    assert "vt " in result.obj_str  # UVs written to OBJ!
    assert len(result.stl_bytes) > 84
    assert result.attributes["is_textured"] is True
    assert result.attributes["is_watertight"] is True


def test_pipeline_obj_string_input():
    """Pipeline accepts raw Wavefront OBJ strings or file streams."""
    obj_data = """# Test Wedge OBJ
v 0.0 0.0 0.0
v 2.0 0.0 0.0
v 2.0 1.0 0.0
v 0.0 1.0 0.0
v 0.0 0.0 1.0
v 2.0 0.0 1.0
f 1 2 3
f 1 3 4
f 1 5 6
f 1 6 2
f 2 6 3
f 4 3 6
f 1 4 5
"""
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=io.BytesIO(obj_data.encode("utf-8")),
        file_type="obj",
        title="Wedge_Asset",
    )

    assert result.success is True
    assert result.validation_report is not None
    assert result.validation_report.is_valid is True
    assert result.uv_result is not None
    assert result.uv_result.success is True
    assert result.glb_bytes.startswith(b"glTF")


def test_pipeline_invalid_mesh_rejection():
    """Pipeline strictly rejects malformed or degenerate geometry without corrupting state."""
    # Degenerate face with out-of-bounds index
    bad_obj = """
v 0.0 0.0 0.0
v 1.0 0.0 0.0
f 1 2 99
"""
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=io.BytesIO(bad_obj.encode("utf-8")),
        file_type="obj",
        title="Malformed_Asset",
    )

    assert result.success is False
    assert len(result.errors) > 0
    assert result.glb_bytes == b""


# ----------------------------------------------------------------------
# 2. Asset Storage Integration & Download Verification
# ----------------------------------------------------------------------

def test_pipeline_storage_and_reload_verification():
    """Processed pipeline assets are saved via AssetStorageService and reload cleanly."""
    crystal = ProceduralMeshFactory.create_crystal(scale=1.2, seed=77)
    pipe_res = MeshProcessingPipeline.process_mesh(
        mesh_source=crystal,
        title="Storage_Crystal",
    )
    assert pipe_res.success is True

    # Save to AssetStorageService
    asset = asset_storage.save_asset(
        title=pipe_res.title,
        prompt="resonant crystal monolith with procedural facets",
        provider="demo",
        style="low-poly",
        glb_bytes=pipe_res.glb_bytes,
        obj_str=pipe_res.obj_str,
        stl_bytes=pipe_res.stl_bytes,
        poly_count=pipe_res.poly_count,
        vertex_count=pipe_res.vertex_count,
        tags=["crystal", "pipeline-test"],
        attributes=pipe_res.attributes,
        is_demo=True,
    )

    assert asset.id is not None
    assert asset.poly_count == pipe_res.poly_count

    # Check file exists on disk
    glb_path = asset_storage.get_file_path(asset.id, "glb")
    assert glb_path is not None
    assert glb_path.exists()

    # Check companion OBJ MTL and texture files exist on disk
    mtl_path = asset_storage.get_file_path(asset.id, "mtl")
    assert mtl_path is not None
    assert mtl_path.exists()

    png_path = asset_storage.get_file_path(asset.id, "png")
    assert png_path is not None
    assert png_path.exists()

    # Verify reload of stored GLB file from disk
    with open(glb_path, "rb") as f:
        stored_bytes = f.read()

    verify_report = TextureMapper.verify_glb_round_trip(stored_bytes)
    assert verify_report["is_valid_gltf"] is True
    assert verify_report["round_trip_success"] is True
    assert verify_report["has_uvs"] is True
    assert verify_report["has_texture_image"] is True


@pytest.mark.asyncio
async def test_end_to_end_api_generation_lifecycle_with_pipeline():
    """
    Full end-to-end API test:
    1. POST /api/generate submits job to DemoProvider
    2. Background job executes full MeshProcessingPipeline
    3. Polls GET /api/generate/jobs/{id} until completed
    4. Downloads GET /api/assets/{asset_id}/download/glb
    5. Confirms downloaded GLB contains TEXCOORD_0 and embedded texture.
    6. Confirms companion MTL and texture PNG are downloadable.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit job
        req_payload = {
            "prompt": "futuristic tactical cyber helmet with optics",
            "provider": "demo",
            "style": "cyberpunk",
            "poly_budget": "medium",
            "symmetry": True,
        }
        res = await client.post("/api/generate", json=req_payload)
        assert res.status_code == 200
        job_data = res.json()
        job_id = job_data["id"]

        # 2. Poll job status
        import asyncio
        completed = False
        asset_id = None
        for _ in range(30):
            await asyncio.sleep(0.4)
            status_res = await client.get(f"/api/generate/jobs/{job_id}")
            assert status_res.status_code == 200
            j = status_res.json()
            if j["status"] == "completed":
                completed = True
                asset_id = j["asset_id"]
                break
            elif j["status"] == "failed":
                pytest.fail(f"Job failed: {j.get('error')}")

        assert completed is True
        assert asset_id is not None

        # 3. Download generated GLB
        glb_res = await client.get(f"/api/assets/{asset_id}/download/glb")
        assert glb_res.status_code == 200
        glb_content = glb_res.content

        # 4. Verify downloaded GLB has valid glTF 2.0 structure & textures
        verify = TextureMapper.verify_glb_round_trip(glb_content)
        assert verify["is_valid_gltf"] is True
        assert verify["round_trip_success"] is True
        assert verify["has_uvs"] is True
        assert verify["has_texture_image"] is True
        assert verify["metallic_factor"] == 0.4  # Matches cyberpunk style!

        # 5. Download companion OBJ, MTL, and PNG
        obj_res = await client.get(f"/api/assets/{asset_id}/download/obj")
        assert obj_res.status_code == 200
        assert "mtllib" in obj_res.text
        assert "vt " in obj_res.text

        mtl_res = await client.get(f"/api/assets/{asset_id}/download/mtl")
        assert mtl_res.status_code == 200
        assert "newmtl" in mtl_res.text

        png_res = await client.get(f"/api/assets/{asset_id}/download/png")
        assert png_res.status_code == 200
        assert len(png_res.content) > 0


# ----------------------------------------------------------------------
# 3. Stage 2.5: QEM Mesh Simplification Integration Tests
# ----------------------------------------------------------------------

def test_pipeline_with_optimization_disabled_preserves_polycount():
    """Pipeline with enable_optimization=False preserves the exact input poly count."""
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=1.0)
    orig_faces = len(sphere.faces)  # 1280

    cfg = PipelineConfig(
        enable_optimization=False,
        generate_procedural_texture=True,
        texture_style="metallic",
    )
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=sphere,
        config=cfg,
        title="Unoptimized_Sphere",
    )

    assert result.success is True
    assert result.poly_count == orig_faces
    assert result.attributes["optimization_metrics"]["optimized"] is False
    assert result.attributes["optimization_metrics"]["algorithm"] == "None"
    assert result.attributes["optimization_metrics"]["original_face_count"] == orig_faces
    assert result.attributes["optimization_metrics"]["final_face_count"] == orig_faces
    assert result.simplification_result is None


def test_pipeline_with_qem_optimization_target_faces():
    """Pipeline with enable_optimization=True and target_faces decimates mesh before UV unwrapping."""
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=1.0)
    orig_faces = len(sphere.faces)  # 1280
    target_faces = 320

    cfg = PipelineConfig(
        enable_optimization=True,
        target_faces=target_faces,
        generate_procedural_texture=True,
        texture_style="scifi",
    )
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=sphere,
        config=cfg,
        title="Decimated_Sphere_Target",
    )

    assert result.success is True
    assert result.simplification_result is not None
    assert result.simplification_result.success is True
    assert abs(result.simplification_result.final_face_count - target_faces) <= 2
    assert result.poly_count == result.simplification_result.final_face_count
    assert result.poly_count < orig_faces

    # Verify telemetry
    opt_meta = result.attributes["optimization_metrics"]
    assert opt_meta["optimized"] is True
    assert "Quadric Error Metrics" in opt_meta["algorithm"]
    assert opt_meta["original_face_count"] == orig_faces
    assert abs(opt_meta["final_face_count"] - target_faces) <= 2
    assert opt_meta["reduction_percentage"] > 70.0
    assert opt_meta["execution_time_seconds"] > 0.0

    # Verify UV and texturing succeeded on the decimated geometry
    assert result.uv_result is not None
    assert result.uv_result.success is True
    assert result.attributes["is_textured"] is True
    assert result.glb_bytes.startswith(b"glTF")
    assert result.round_trip_report is not None
    assert result.round_trip_report["round_trip_success"] is True


def test_pipeline_with_qem_optimization_reduction_ratio():
    """Pipeline with enable_optimization=True and reduction_ratio decimates proportional face count."""
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=1.0)
    orig_faces = len(sphere.faces)  # 1280

    cfg = PipelineConfig(
        enable_optimization=True,
        reduction_ratio=0.5,  # 50% reduction -> ~640 faces
        generate_procedural_texture=True,
        texture_style="marble",
    )
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=sphere,
        config=cfg,
        title="Decimated_Sphere_Ratio",
    )

    assert result.success is True
    assert result.simplification_result is not None
    assert result.simplification_result.success is True
    assert abs(result.simplification_result.final_face_count - 640) <= 2
    assert result.poly_count == result.simplification_result.final_face_count
    assert 45.0 <= result.attributes["optimization_metrics"]["reduction_percentage"] <= 55.0
    assert result.glb_bytes.startswith(b"glTF")
    assert result.round_trip_report["round_trip_success"] is True


def test_pipeline_optimization_graceful_tolerance_when_target_exceeds_faces():
    """Pipeline safely preserves original mesh when target_faces is greater than or equal to current faces."""
    box = trimesh.creation.box(extents=(1, 1, 1))  # 12 faces
    orig_faces = len(box.faces)

    cfg = PipelineConfig(
        enable_optimization=True,
        target_faces=50,  # larger than 12
        use_calibration_texture=True,
    )
    result = MeshProcessingPipeline.process_mesh(
        mesh_source=box,
        config=cfg,
        title="Box_Already_Simple",
    )

    assert result.success is True
    assert result.poly_count == orig_faces
    assert result.simplification_result is not None
    assert result.simplification_result.success is True
    assert result.simplification_result.final_face_count == orig_faces
    assert result.attributes["optimization_metrics"]["optimized"] is False
    assert any("already at or below" in w for w in result.simplification_result.warnings)

