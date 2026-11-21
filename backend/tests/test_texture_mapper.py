"""
Automated Test Suite for Texture Mapping, PBR Materials, and GLB Round-Trip Export
Tests texture image validation (PNG, JPEG), UV correspondence checks,
glTF PBR metallic-roughness material binding, and GLB export/reload integrity.
"""

import io
import pytest
import numpy as np
from PIL import Image
import trimesh

from mesh_processing.mesh_validator import MeshValidator
from mesh_processing.uv_unwrapper import UVUnwrapper
from mesh_processing.texture_mapper import (
    TextureMapper,
    TextureMappingError,
    MaterialConfig,
    TextureMappingResult,
)


@pytest.fixture
def sample_unwrapped_cube():
    """Provides a cleanly UV-unwrapped cube Trimesh."""
    cube = trimesh.creation.box(extents=(1.0, 1.0, 1.0))
    unwrapped, result = UVUnwrapper.unwrap(cube, mesh_name="TestCube")
    assert result.success is True
    return unwrapped


@pytest.fixture
def sample_png_bytes():
    """Generates an in-memory PNG image byte stream."""
    img = Image.new("RGB", (128, 128), color=(255, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def sample_jpeg_bytes():
    """Generates an in-memory JPEG image byte stream."""
    img = Image.new("RGB", (128, 128), color=(50, 150, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ----------------------------------------------------------------------
# 1. Texture Loading & Validation Tests
# ----------------------------------------------------------------------

def test_load_png_and_jpeg_textures(sample_png_bytes, sample_jpeg_bytes):
    """Verifies that PNG and JPEG byte streams decode into valid PIL Images."""
    png_img = TextureMapper.load_texture_image(sample_png_bytes)
    assert png_img.size == (128, 128)
    assert png_img.mode in ("RGB", "RGBA")

    jpeg_img = TextureMapper.load_texture_image(sample_jpeg_bytes)
    assert jpeg_img.size == (128, 128)
    assert jpeg_img.mode in ("RGB", "RGBA")


def test_load_texture_with_target_resolution(sample_png_bytes):
    """Verifies that target_resolution resizes the texture cleanly."""
    resized = TextureMapper.load_texture_image(sample_png_bytes, target_resolution=(256, 512))
    assert resized.size == (256, 512)


def test_missing_texture_file():
    """Attempting to load a nonexistent file path must raise TextureMappingError."""
    with pytest.raises(TextureMappingError, match="does not exist"):
        TextureMapper.load_texture_image("/path/to/nonexistent/texture_xyz.png")


def test_empty_or_corrupted_image_data():
    """Empty or random non-image bytes must raise TextureMappingError."""
    with pytest.raises(TextureMappingError, match="empty"):
        TextureMapper.load_texture_image(b"")

    with pytest.raises(TextureMappingError, match="Failed to decode"):
        TextureMapper.load_texture_image(b"NOT_A_VALID_IMAGE_HEADER_12345")


# ----------------------------------------------------------------------
# 2. Material Creation & Parameter Preservation
# ----------------------------------------------------------------------

def test_pbr_material_creation():
    """Tests PBRMaterial factor assignment and parameter fidelity."""
    img = Image.new("RGB", (64, 64), color=(200, 200, 200))
    cfg = MaterialConfig(
        name="Custom_Obsidian",
        base_color_factor=[0.8, 0.2, 0.2, 1.0],
        metallic_factor=0.85,
        roughness_factor=0.15,
        double_sided=True,
    )
    mat = TextureMapper.create_pbr_material(texture_image=img, config=cfg)

    assert mat.name == "Custom_Obsidian"
    assert mat.baseColorTexture is not None
    assert mat.baseColorTexture.size == (64, 64)
    assert pytest.approx(mat.metallicFactor, abs=1e-3) == 0.85
    assert pytest.approx(mat.roughnessFactor, abs=1e-3) == 0.15


# ----------------------------------------------------------------------
# 3. Texture Application & UV Preservation
# ----------------------------------------------------------------------

def test_apply_texture_success(sample_unwrapped_cube, sample_png_bytes):
    """Applying a texture to a UV-unwrapped mesh preserves vertices, faces, and UVs."""
    orig_v_count = len(sample_unwrapped_cube.vertices)
    orig_f_count = len(sample_unwrapped_cube.faces)
    orig_uvs = sample_unwrapped_cube.visual.uv.copy()

    textured, result = TextureMapper.apply_texture(
        mesh=sample_unwrapped_cube,
        texture=sample_png_bytes,
        mesh_name="TexturedCube",
    )

    assert result.success is True
    assert result.has_uvs is True
    assert result.texture_applied is True
    assert result.texture_metrics is not None
    assert result.texture_metrics.width == 128
    assert result.texture_metrics.height == 128

    # Geometry preservation
    assert len(textured.vertices) == orig_v_count
    assert len(textured.faces) == orig_f_count
    assert np.allclose(textured.visual.uv, orig_uvs)


def test_apply_texture_missing_uvs():
    """Attempting to texture a mesh lacking UVs must fail with a descriptive error."""
    raw_cube = trimesh.creation.box(extents=(1.0, 1.0, 1.0))  # Has vertex colors, but no UVs
    # Ensure visual has no UVs
    raw_cube.visual = trimesh.visual.ColorVisuals()

    img = Image.new("RGB", (64, 64), color=(0, 255, 0))
    _, result = TextureMapper.apply_texture(mesh=raw_cube, texture=img)

    assert result.success is False
    assert result.has_uvs is False
    assert any("does not contain uv coordinates" in err.lower() for err in result.errors)


def test_apply_checkerboard_calibration(sample_unwrapped_cube):
    """Verifies helper for generating and applying procedural checkerboard calibration textures."""
    textured, result = TextureMapper.apply_checkerboard(
        mesh=sample_unwrapped_cube,
        resolution=512,
        grid_count=16,
        mesh_name="CheckerboardCube",
    )

    assert result.success is True
    assert result.texture_applied is True
    assert result.texture_metrics.width == 512
    assert result.texture_metrics.height == 512


# ----------------------------------------------------------------------
# 4. End-to-End Round-Trip Verification (OBJ -> UV -> Texture -> GLB -> Reload)
# ----------------------------------------------------------------------

def test_full_pipeline_round_trip():
    """
    Comprehensive end-to-end integration test:
    1. Ingest raw OBJ string
    2. Validate with MeshValidator
    3. Unwrap with UVUnwrapper (xatlas)
    4. Map checkerboard texture with TextureMapper
    5. Export binary glTF 2.0 (.glb)
    6. Reload and verify TEXCOORD_0, baseColorTexture, and PBR factors survive export.
    """
    # 1. Raw OBJ (Pyramid / Tetrahedron)
    obj_data = """# Test Pyramid OBJ
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 0.866025 0.0
v 0.5 0.288675 0.816497
f 1 3 2
f 1 2 4
f 2 3 4
f 3 1 4
"""
    # 2. Validation
    val_report = MeshValidator.load_and_validate(io.BytesIO(obj_data.encode("utf-8")), file_type="obj")
    assert val_report.is_valid is True

    # 3. UV Unwrapping
    unwrapped_mesh, uv_result = UVUnwrapper.unwrap(
        io.BytesIO(obj_data.encode("utf-8")),
        file_type="obj",
        mesh_name="Pyramid",
    )
    assert uv_result.success is True
    assert uv_result.validation.is_valid is True

    # 4. Texture & Material Mapping
    cfg = MaterialConfig(
        name="Pyramid_Calibration_Mat",
        base_color_factor=[1.0, 1.0, 1.0, 1.0],
        metallic_factor=0.25,
        roughness_factor=0.75,
    )
    textured_mesh, tex_result = TextureMapper.apply_checkerboard(
        mesh=unwrapped_mesh,
        resolution=256,
        grid_count=8,
        material_config=cfg,
        mesh_name="TexturedPyramid",
    )
    assert tex_result.success is True

    # 5. Export to binary GLB
    glb_bytes = TextureMapper.export_textured_glb(textured_mesh)
    assert isinstance(glb_bytes, bytes)
    assert glb_bytes.startswith(b"glTF")

    # 6. Reload and verify GLB
    verify_report = TextureMapper.verify_glb_round_trip(glb_bytes)
    assert verify_report["is_valid_gltf"] is True
    assert verify_report["round_trip_success"] is True
    assert verify_report["has_uvs"] is True
    assert verify_report["uv_count"] == len(textured_mesh.vertices)
    assert verify_report["uv_finite"] is True
    assert verify_report["has_material"] is True
    assert verify_report["has_texture_image"] is True
    assert verify_report["texture_size"] == (256, 256)
    assert pytest.approx(verify_report["metallic_factor"], abs=1e-3) == 0.25
    assert pytest.approx(verify_report["roughness_factor"], abs=1e-3) == 0.75
