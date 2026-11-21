"""
Automated Test Suite for UV Unwrapping & Atlas Packing
Tests automatic UV parameterization, island segmentation, seam vertex duplication,
geometry preservation, and UV validation reports across diverse geometries.
"""

import pytest
import numpy as np
import trimesh

from mesh_processing.uv_unwrapper import (
    UVUnwrapper,
    UVUnwrapOptions,
    UVUnwrapResult,
    UVValidationReport,
)
from mesh_processing.mesh_validator import MeshValidator


# ----------------------------------------------------------------------
# 1. Standard Geometry Unwrapping Tests
# ----------------------------------------------------------------------

def test_unwrap_tetrahedron():
    """Unwrapping a regular tetrahedron produces valid normalized UVs and preserves surface area."""
    vertices = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.5, 0.866025, 0.0],
        [0.5, 0.288675, 0.816497],
    ], dtype=np.float32)
    faces = np.array([
        [0, 2, 1],
        [0, 1, 3],
        [1, 2, 3],
        [2, 0, 3],
    ], dtype=np.uint32)

    tetra = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    unwrapped, result = UVUnwrapper.unwrap(tetra, mesh_name="Tetrahedron")

    assert result.success is True
    assert unwrapped is not None
    assert result.metrics is not None
    assert result.metrics.chart_count >= 1
    assert result.metrics.uv_count == len(unwrapped.vertices)
    assert result.validation.is_valid is True
    assert result.validation.has_uvs is True
    assert result.validation.is_finite is True
    assert result.validation.is_normalized is True
    assert result.validation.has_face_correspondence is True
    assert result.validation.geometry_preserved is True
    assert pytest.approx(unwrapped.area, rel=1e-3) == tetra.area


def test_unwrap_cube_seam_handling():
    """Unwrapping a closed cube requires cutting seams and duplicating vertices."""
    cube = trimesh.creation.box(extents=(2.0, 2.0, 2.0))
    orig_v_count = len(cube.vertices)  # 8
    orig_f_count = len(cube.faces)     # 12

    unwrapped, result = UVUnwrapper.unwrap(cube, mesh_name="Cube")

    assert result.success is True
    assert unwrapped is not None
    assert result.metrics is not None
    # Because cube surfaces must unfold onto 2D, seam vertices must be duplicated
    assert result.metrics.original_vertex_count == orig_v_count
    assert result.metrics.unwrapped_vertex_count > orig_v_count
    assert result.metrics.seam_vertex_duplications > 0
    # Face count must remain identical
    assert len(unwrapped.faces) == orig_f_count

    # 100% Geometry Conservation
    assert result.validation.geometry_preserved is True
    assert pytest.approx(unwrapped.area, rel=1e-3) == cube.area
    assert np.allclose(cube.extents, unwrapped.extents, atol=1e-4)


def test_unwrap_open_mesh():
    """An open surface (e.g. single quad / 2 triangles) unwraps with 0 seam duplications."""
    vertices = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [1.0, 1.0, 0.0],
        [0.0, 1.0, 0.0],
    ], dtype=np.float32)
    faces = np.array([
        [0, 1, 2],
        [0, 2, 3],
    ], dtype=np.uint32)

    plane = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    unwrapped, result = UVUnwrapper.unwrap(plane, mesh_name="OpenQuad")

    assert result.success is True
    assert unwrapped is not None
    assert result.validation.is_valid is True
    assert result.metrics.chart_count == 1
    # Open flat surface has no interior cuts
    assert result.metrics.original_vertex_count == 4
    assert result.metrics.unwrapped_vertex_count == 4
    assert result.metrics.seam_vertex_duplications == 0


# ----------------------------------------------------------------------
# 2. UV Coordinate Ranges & Bounds
# ----------------------------------------------------------------------

def test_uv_coordinate_ranges():
    """All generated UV coordinates must strictly fall within [0.0, 1.0]."""
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
    unwrapped, result = UVUnwrapper.unwrap(sphere, mesh_name="Icosphere")

    assert result.success is True
    assert unwrapped is not None
    uvs = unwrapped.visual.uv
    assert uvs.ndim == 2
    assert uvs.shape[1] == 2
    assert np.all(uvs >= 0.0)
    assert np.all(uvs <= 1.0)
    assert np.all(np.isfinite(uvs))


# ----------------------------------------------------------------------
# 3. Invalid & Edge-Case Handling
# ----------------------------------------------------------------------

def test_empty_mesh_unwrap():
    """Unwrapping an empty mesh must return success=False and meaningful validation errors."""
    empty = trimesh.Trimesh(vertices=[], faces=[], process=False)
    unwrapped, result = UVUnwrapper.unwrap(empty, mesh_name="EmptyMesh")

    assert result.success is False
    assert unwrapped is None
    assert result.validation.is_valid is False
    assert any("insufficient geometry" in err.lower() for err in result.errors)


def test_corrupted_uv_validation():
    """Directly validating a mesh with non-finite or out-of-range UVs must flag errors."""
    cube = trimesh.creation.box(extents=(1.0, 1.0, 1.0))

    # Case A: Out of range UVs (> 1.0)
    bad_uvs = np.full((len(cube.vertices), 2), 2.5, dtype=np.float32)
    cube.visual = trimesh.visual.TextureVisuals(uv=bad_uvs)
    report = UVUnwrapper.validate_uvs(cube)
    assert report.is_valid is False
    assert any("out of normalized" in err.lower() for err in report.errors)

    # Case B: NaN UVs
    nan_uvs = np.zeros((len(cube.vertices), 2), dtype=np.float32)
    nan_uvs[0, 0] = float("nan")
    cube.visual = trimesh.visual.TextureVisuals(uv=nan_uvs)
    report_nan = UVUnwrapper.validate_uvs(cube)
    assert report_nan.is_valid is False
    assert any("non-finite" in err.lower() for err in report_nan.errors)

    # Case C: UV count != Vertex count
    mismatched_uvs = np.zeros((len(cube.vertices) - 2, 2), dtype=np.float32)
    cube.visual = trimesh.visual.TextureVisuals(uv=mismatched_uvs)
    report_mismatch = UVUnwrapper.validate_uvs(cube)
    assert report_mismatch.is_valid is False
    assert any("does not match vertex count" in err.lower() for err in report_mismatch.errors)


# ----------------------------------------------------------------------
# 4. Configurable Packing Options
# ----------------------------------------------------------------------

def test_configurable_padding_and_resolution():
    """Testing UV unwrap options with custom padding and resolution settings."""
    cube = trimesh.creation.box(extents=(1.0, 1.0, 1.0))
    opts = UVUnwrapOptions(resolution=2048, padding=4, rotate_charts=True)

    unwrapped, result = UVUnwrapper.unwrap(cube, options=opts, mesh_name="Cube2048")
    assert result.success is True
    assert result.metrics is not None
    assert result.metrics.atlas_width > 0
    assert result.metrics.atlas_height > 0


# ----------------------------------------------------------------------
# 5. Checkerboard Texture Generator
# ----------------------------------------------------------------------

def test_checkerboard_texture_generation():
    """Checkerboard texture helper creates valid RGB PIL image with specified dimensions."""
    img = UVUnwrapper.generate_checkerboard_texture(resolution=256, grid_count=8)
    assert img.size == (256, 256)
    assert img.mode == "RGB"
    pixels = np.array(img)
    assert pixels.shape == (256, 256, 3)
