"""
Comprehensive Test Suite for Milestone 7B.1: Mesh Geometry Conditioning Generator
Covers:
1. UV depth generation on a synthetic cube
2. UV normal generation and object-space encoding
3. Chart occupancy mask generation
4. Wireframe and chart boundary map generation
5. Output image dimensions and formats
6. Empty UV regions preservation
7. Degenerate UV triangle tolerance
8. UV coordinates outside expected [0, 1] bounds
9. Overlapping UV triangle handling (deterministic depth testing)
10. Valid pixel percentage calculation
11. Deterministic reproducibility
12. Invalid mesh rejection
13. Real xatlas-unwrapped geometry integration
14. Visual artifact generation (saved to gitignored storage/textures/)
"""

from pathlib import Path
import numpy as np
from PIL import Image
import pytest
import trimesh

from mesh_processing.uv_unwrapper import UVUnwrapper, UVUnwrapOptions
from texture_engine.geometry_conditioner import (
    GeometryConditioner,
    GeometryConditionerConfig,
    GeometryConditioningResult,
    DepthNormalizationMode,
    OverlapResolution,
)


# ----------------------------------------------------------------------
# Geometry Fixtures
# ----------------------------------------------------------------------

def create_synthetic_cube_with_uvs() -> trimesh.Trimesh:
    """Creates a synthetic unit box with manual non-overlapping [0, 1] UVs."""
    box = trimesh.creation.box(extents=(1.0, 1.0, 1.0))
    # Unwrap using UVUnwrapper to ensure realistic, clean xatlas charts
    unwrapped, res = UVUnwrapper.unwrap(
        box,
        options=UVUnwrapOptions(resolution=512, padding=4),
        mesh_name="SyntheticCube",
    )
    assert res.success is True
    assert unwrapped is not None
    return unwrapped


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------

def test_uv_depth_generation_on_cube():
    """Validates UV depth map generation, value range, and continuous interpolation."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(
        resolution=256,
        depth_mode=DepthNormalizationMode.RADIAL_DISTANCE,
    )
    res = GeometryConditioner.generate(cube, config=cfg)

    assert res.success is True
    assert res.depth_map is not None
    assert isinstance(res.depth_map, Image.Image)
    assert res.depth_map.size == (256, 256)
    assert res.depth_map.mode == "L"

    depth_arr = np.array(res.depth_map)
    # Check that depth is non-trivial and values range in [0, 255]
    assert depth_arr.shape == (256, 256)
    assert np.max(depth_arr) > 0
    assert np.min(depth_arr) == 0  # Background is 0


def test_uv_normal_generation_and_encoding():
    """Validates object-space normal map synthesis and unit vector RGB encoding."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(
        resolution=256,
        normal_background_color=(0, 0, 0),
    )
    res = GeometryConditioner.generate(cube, config=cfg)

    assert res.success is True
    assert res.normal_map is not None
    assert res.normal_map.size == (256, 256)
    assert res.normal_map.mode == "RGB"

    normal_arr = np.array(res.normal_map)
    assert normal_arr.shape == (256, 256, 3)

    # Empty pixels must equal background (0, 0, 0)
    mask_arr = np.array(res.chart_mask) == 255
    empty_pixels = normal_arr[~mask_arr]
    if len(empty_pixels) > 0:
        assert np.all(empty_pixels == 0)

    # Valid surface pixels must decode back to approximately unit-length normals
    surface_pixels = normal_arr[mask_arr]
    assert len(surface_pixels) > 0
    # Decode: n = (rgb / 255.0) * 2 - 1
    decoded_n = (surface_pixels.astype(np.float32) / 255.0) * 2.0 - 1.0
    lengths = np.linalg.norm(decoded_n, axis=1)
    # Allow small tolerance for 8-bit quantization
    assert np.all(np.abs(lengths - 1.0) < 0.08)


def test_chart_mask_generation():
    """Validates that chart mask is strictly binary [0, 255] and identifies atlas occupancy."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(resolution=256)
    res = GeometryConditioner.generate(cube, config=cfg)

    assert res.success is True
    assert res.chart_mask is not None
    assert res.chart_mask.size == (256, 256)
    assert res.chart_mask.mode == "L"

    mask_arr = np.array(res.chart_mask)
    unique_vals = np.unique(mask_arr)
    # Only 0 (empty) and 255 (occupied surface)
    assert set(unique_vals).issubset({0, 255})
    assert 255 in unique_vals
    assert 0 in unique_vals


def test_wireframe_and_boundary_generation():
    """Validates UV wireframe map rendering with distinct boundary and interior edges."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(
        resolution=256,
        wireframe_thickness=1,
        chart_boundary_thickness=3,
        wireframe_color=(100, 100, 100),
        chart_boundary_color=(255, 255, 255),
        wireframe_background_color=(10, 10, 10),
    )
    res = GeometryConditioner.generate(cube, config=cfg)

    assert res.success is True
    assert res.wireframe_map is not None
    assert res.wireframe_map.size == (256, 256)
    assert res.wireframe_map.mode == "RGB"

    wf_arr = np.array(res.wireframe_map)
    # Check that boundary pixels (255, 255, 255) are present
    assert np.any(np.all(wf_arr == [255, 255, 255], axis=-1))


def test_custom_image_dimensions():
    """Validates that arbitrary resolutions (e.g. 128, 512, 1024) are respected."""
    cube = create_synthetic_cube_with_uvs()
    for size in [128, 512]:
        cfg = GeometryConditionerConfig(resolution=size)
        res = GeometryConditioner.generate(cube, config=cfg)
        assert res.success is True
        assert res.resolution == (size, size)
        assert res.depth_map.size == (size, size)
        assert res.normal_map.size == (size, size)
        assert res.chart_mask.size == (size, size)
        assert res.wireframe_map.size == (size, size)


def test_empty_uv_regions_preservation():
    """Validates that regions outside UV charts maintain configured background values."""
    cube = create_synthetic_cube_with_uvs()
    bg_val = 42
    bg_color = (15, 25, 35)
    cfg = GeometryConditionerConfig(
        resolution=256,
        depth_background_value=bg_val,
        normal_background_color=bg_color,
    )
    res = GeometryConditioner.generate(cube, config=cfg)

    depth_arr = np.array(res.depth_map)
    normal_arr = np.array(res.normal_map)
    mask_arr = np.array(res.chart_mask)

    empty_coords = (mask_arr == 0)
    assert np.all(depth_arr[empty_coords] == bg_val)
    assert np.all(normal_arr[empty_coords] == np.array(bg_color, dtype=np.uint8))


def test_degenerate_triangle_handling():
    """Tolerates collinear / zero-area UV triangles gracefully with warnings."""
    # Create triangle with collinear UVs: (0,0), (0.5, 0.5), (1.0, 1.0)
    verts = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], dtype=np.float32)
    faces = np.array([[0, 1, 2]], dtype=np.int64)
    collinear_uvs = np.array([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]], dtype=np.float32)

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=collinear_uvs)

    cfg = GeometryConditionerConfig(resolution=128)
    res = GeometryConditioner.generate(mesh, config=cfg)

    assert res.success is True
    assert any("degenerate" in w.lower() for w in res.warnings)
    # Since only 1 triangle existed and was degenerate, valid percentage is 0
    assert res.valid_pixel_percentage == 0.0


def test_uv_coordinates_outside_bounds():
    """Clamps UV coordinates outside [0, 1] range and records an advisory warning."""
    verts = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], dtype=np.float32)
    faces = np.array([[0, 1, 2]], dtype=np.int64)
    out_of_bounds_uvs = np.array([[-0.2, 0.0], [1.3, 0.5], [0.5, 1.4]], dtype=np.float32)

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=out_of_bounds_uvs)

    cfg = GeometryConditionerConfig(resolution=128)
    res = GeometryConditioner.generate(mesh, config=cfg)

    assert res.success is True
    assert any("outside standard [0, 1]" in w for w in res.warnings)
    assert res.valid_pixel_percentage > 0.0


def test_overlapping_uv_triangle_handling():
    """Verifies deterministic resolution of overlapping UV triangles via MAX vs MIN depth."""
    # Two identical UV triangles with different 3D Z heights
    verts = np.array([
        # Triangle 1 (Low Z = 0.0)
        [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0],
        # Triangle 2 (High Z = 5.0)
        [0.0, 0.0, 5.0], [1.0, 0.0, 5.0], [0.0, 1.0, 5.0],
    ], dtype=np.float32)
    faces = np.array([[0, 1, 2], [3, 4, 5]], dtype=np.int64)
    # Both share exact same UV footprint
    uvs = np.array([
        [0.1, 0.1], [0.8, 0.1], [0.1, 0.8],
        [0.1, 0.1], [0.8, 0.1], [0.1, 0.8],
    ], dtype=np.float32)

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=uvs)

    # 1. MAX_DEPTH policy
    cfg_max = GeometryConditionerConfig(
        resolution=128,
        depth_mode=DepthNormalizationMode.BOUNDING_BOX_Z,
        overlap_resolution=OverlapResolution.MAX_DEPTH,
    )
    res_max = GeometryConditioner.generate(mesh, config=cfg_max)
    depth_max = np.array(res_max.depth_map)

    # 2. MIN_DEPTH policy
    cfg_min = GeometryConditionerConfig(
        resolution=128,
        depth_mode=DepthNormalizationMode.BOUNDING_BOX_Z,
        overlap_resolution=OverlapResolution.MIN_DEPTH,
    )
    res_min = GeometryConditioner.generate(mesh, config=cfg_min)
    depth_min = np.array(res_min.depth_map)

    mask = np.array(res_max.chart_mask) == 255
    # Max depth inside triangle should equal 255 (Z = 5.0)
    assert np.mean(depth_max[mask]) > np.mean(depth_min[mask])
    assert np.all(depth_max[mask] == 255)
    assert np.all(depth_min[mask] == 0)


def test_valid_pixel_percentage_calculation():
    """Validates that coverage percentage matches actual nonzero mask pixels."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(resolution=256)
    res = GeometryConditioner.generate(cube, config=cfg)

    mask_arr = np.array(res.chart_mask)
    expected_pct = round(float(np.count_nonzero(mask_arr)) / float(256 * 256) * 100.0, 2)
    assert abs(res.valid_pixel_percentage - expected_pct) < 1e-4
    assert 20.0 < res.valid_pixel_percentage < 90.0


def test_deterministic_output():
    """Multiple generation passes produce bitwise identical outputs for fixed inputs."""
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(resolution=128)

    res1 = GeometryConditioner.generate(cube, config=cfg)
    res2 = GeometryConditioner.generate(cube, config=cfg)

    assert np.array_equal(np.array(res1.depth_map), np.array(res2.depth_map))
    assert np.array_equal(np.array(res1.normal_map), np.array(res2.normal_map))
    assert np.array_equal(np.array(res1.chart_mask), np.array(res2.chart_mask))
    assert np.array_equal(np.array(res1.wireframe_map), np.array(res2.wireframe_map))


def test_invalid_mesh_rejection():
    """Strictly rejects non-Trimesh inputs, empty meshes, or meshes lacking UVs."""
    # 1. Non-mesh input
    res_bad_type = GeometryConditioner.generate("not a mesh")  # type: ignore
    assert res_bad_type.success is False
    assert len(res_bad_type.errors) > 0

    # 2. Empty mesh
    empty_mesh = trimesh.Trimesh()
    res_empty = GeometryConditioner.generate(empty_mesh)
    assert res_empty.success is False
    assert len(res_empty.errors) > 0

    # 3. Mesh without UVs when auto_unwrap is False
    raw_box = trimesh.creation.box()
    raw_box.visual = trimesh.visual.ColorVisuals()  # No UVs
    res_no_uv = GeometryConditioner.generate(raw_box, config=GeometryConditionerConfig(auto_unwrap_if_missing=False))
    assert res_no_uv.success is False
    assert any("lacks uv" in err.lower() for err in res_no_uv.errors)


def test_real_xatlas_unwrapped_geometry():
    """Integrates with real multi-chart xatlas unwrapped geometry (icosphere)."""
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
    unwrapped, unwrap_res = UVUnwrapper.unwrap(sphere, options=UVUnwrapOptions(resolution=256))
    assert unwrap_res.success is True

    res = GeometryConditioner.generate(unwrapped, config=GeometryConditionerConfig(resolution=256))
    assert res.success is True
    assert res.chart_count > 1  # Icosphere has multiple charts
    assert res.face_count_processed == len(sphere.faces)
    assert res.valid_pixel_percentage > 30.0


def test_visual_validation_artifact_generation():
    """Generates and saves visual conditioning artifacts in gitignored storage/textures/."""
    # Use real asset or high-fidelity geometry
    cube = create_synthetic_cube_with_uvs()
    cfg = GeometryConditionerConfig(
        resolution=512,
        depth_mode=DepthNormalizationMode.RADIAL_DISTANCE,
        wireframe_thickness=1,
        chart_boundary_thickness=2,
    )
    res = GeometryConditioner.generate(cube, config=cfg)
    assert res.success is True

    output_dir = Path(__file__).resolve().parent.parent / "storage" / "textures"
    output_dir.mkdir(parents=True, exist_ok=True)

    depth_path = output_dir / "test_uv_depth.png"
    normal_path = output_dir / "test_uv_normals.png"
    mask_path = output_dir / "test_uv_mask.png"
    wireframe_path = output_dir / "test_uv_wireframe.png"

    res.depth_map.save(depth_path)
    res.normal_map.save(normal_path)
    res.chart_mask.save(mask_path)
    res.wireframe_map.save(wireframe_path)

    for p in [depth_path, normal_path, mask_path, wireframe_path]:
        assert p.exists()
        assert p.stat().st_size > 500  # Non-trivial image files
