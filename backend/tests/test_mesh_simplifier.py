"""
Unit tests for PolyGen MeshSimplifier service (Milestone 7A.1).
Tests genuine Garland-Heckbert Quadric Error Metrics (QEM) decimation,
engine availability detection, target face budgets, reduction ratios,
and error handling.
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
import trimesh

from mesh_processing.mesh_simplifier import (
    MeshSimplifier,
    SimplificationOptions,
    SimplificationResult,
)


def create_sample_icosphere(subdivisions: int = 2) -> trimesh.Trimesh:
    """Creates a sample manifold icosphere for decimation testing."""
    return trimesh.creation.icosphere(subdivisions=subdivisions)


def create_sample_cube() -> trimesh.Trimesh:
    """Creates a 12-face manifold cube."""
    return trimesh.creation.box(extents=(1.0, 1.0, 1.0))


def create_sample_tetrahedron() -> trimesh.Trimesh:
    """Creates a minimal 4-face manifold tetrahedron."""
    verts = np.array([
        [1.0, 1.0, 1.0],
        [-1.0, -1.0, 1.0],
        [-1.0, 1.0, -1.0],
        [1.0, -1.0, -1.0],
    ], dtype=np.float64)
    faces = np.array([
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2],
    ], dtype=np.int64)
    return trimesh.Trimesh(vertices=verts, faces=faces, process=False)


# ---------------------------------------------------------------------------
# Test 1: Genuine QEM Engine Availability Detection
# ---------------------------------------------------------------------------
def test_engine_availability_detection():
    """Verify is_engine_available() reflects fast-simplification presence accurately."""
    # When fast_simplification is not importable
    with patch.dict(sys.modules, {"fast_simplification": None}):
        assert MeshSimplifier.is_engine_available() is False

    # When fast_simplification is present
    mock_module = MagicMock()
    with patch.dict(sys.modules, {"fast_simplification": mock_module}):
        assert MeshSimplifier.is_engine_available() is True


# ---------------------------------------------------------------------------
# Test 2 & 10: Explicit Error When fast-simplification is Unavailable
# ---------------------------------------------------------------------------
def test_explicit_error_when_unavailable():
    """Verify simplification returns an explicit actionable error when fast-simplification is absent."""
    mesh = create_sample_icosphere(subdivisions=2)
    orig_faces = len(mesh.faces)

    with patch.object(MeshSimplifier, "is_engine_available", return_value=False):
        result = MeshSimplifier.simplify(mesh, target_faces=50)

        assert result.success is False
        assert result.optimized_mesh is None
        assert result.original_face_count == orig_faces
        assert result.final_face_count == orig_faces
        assert result.target_reached is False
        assert len(result.errors) > 0
        assert "fast-simplification" in result.errors[0]
        assert "pip install fast-simplification" in result.errors[0]
        assert result.algorithm == "Garland-Heckbert Quadric Error Metrics (QEM)"


# ---------------------------------------------------------------------------
# Test 3 & 4: Target Already Above or Equal to Original Face Count
# ---------------------------------------------------------------------------
def test_target_already_above_or_equal_to_original_face_count():
    """Verify meshes already below or at target face count are preserved without decimation."""
    cube = create_sample_cube()  # 12 faces
    orig_faces = len(cube.faces)

    # 1. Target higher than original (target=50 > 12)
    res_higher = MeshSimplifier.simplify(cube, target_faces=50)
    assert res_higher.success is True
    assert res_higher.target_reached is True
    assert res_higher.final_face_count == orig_faces
    assert res_higher.reduction_percentage == 0.0
    assert len(res_higher.warnings) > 0
    assert "already at or below target" in res_higher.warnings[0]
    assert len(res_higher.errors) == 0

    # 2. Target exactly equal to original (target=12 == 12)
    res_equal = MeshSimplifier.simplify(cube, target_faces=12)
    assert res_equal.success is True
    assert res_equal.final_face_count == orig_faces
    assert res_equal.reduction_percentage == 0.0


# ---------------------------------------------------------------------------
# Test 5: Parameter Validation for Reduction Ratio and Target Faces
# ---------------------------------------------------------------------------
def test_parameter_validation():
    """Verify invalid target configurations are rejected with descriptive errors."""
    mesh = create_sample_cube()

    # 1. Neither target_faces nor reduction_ratio
    res_none = MeshSimplifier.simplify(mesh)
    assert res_none.success is False
    assert any("Either 'target_faces' or 'reduction_ratio'" in err for err in res_none.errors)

    # 2. Invalid reduction_ratio: <= 0.0
    res_zero_ratio = MeshSimplifier.simplify(mesh, reduction_ratio=0.0)
    assert res_zero_ratio.success is False
    assert any("reduction_ratio" in err for err in res_zero_ratio.errors)

    # 3. Invalid reduction_ratio: >= 1.0
    res_high_ratio = MeshSimplifier.simplify(mesh, reduction_ratio=1.5)
    assert res_high_ratio.success is False
    assert any("reduction_ratio" in err for err in res_high_ratio.errors)

    # 4. Invalid target_faces: < 1
    res_neg_target = MeshSimplifier.simplify(mesh, target_faces=0)
    assert res_neg_target.success is False
    assert any("target_faces" in err for err in res_neg_target.errors)


# ---------------------------------------------------------------------------
# Test 6: Invalid and Non-Trimesh Geometry Handling
# ---------------------------------------------------------------------------
def test_invalid_geometry_handling():
    """Verify non-Trimesh objects and malformed geometries fail gracefully."""
    # 1. Non-Trimesh instance (dict)
    res_not_mesh = MeshSimplifier.simplify({"vertices": [], "faces": []}, target_faces=10)  # type: ignore
    assert res_not_mesh.success is False
    assert any("Expected a trimesh.Trimesh instance" in err for err in res_not_mesh.errors)

    # 2. Empty mesh with 0 vertices and 0 faces
    empty_mesh = trimesh.Trimesh()
    res_empty = MeshSimplifier.simplify(empty_mesh, target_faces=10)
    assert res_empty.success is False
    assert any("degenerate" in err for err in res_empty.errors)


# ---------------------------------------------------------------------------
# Test 7: Original Mesh Preservation (Immutability)
# ---------------------------------------------------------------------------
def test_original_mesh_remains_unchanged():
    """Verify simplification never modifies the input Trimesh instance in-place."""
    mesh = create_sample_icosphere(subdivisions=2)
    orig_vertices = mesh.vertices.copy()
    orig_faces = mesh.faces.copy()

    # Simulate decimation via mock
    mock_simplified = create_sample_icosphere(subdivisions=1)  # fewer faces (80 -> 20)

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=mock_simplified):
            result = MeshSimplifier.simplify(mesh, target_faces=20)

            assert result.success is True
            # Verify original mesh vertices and faces were not altered
            np.testing.assert_array_equal(mesh.vertices, orig_vertices)
            np.testing.assert_array_equal(mesh.faces, orig_faces)
            assert len(mesh.faces) == len(orig_faces)


# ---------------------------------------------------------------------------
# Test 8: Minimal Indivisible Topology (Tetrahedron)
# ---------------------------------------------------------------------------
def test_minimal_topology_mesh_handling():
    """Verify minimal 4-face tetrahedron is handled safely without topological collapse."""
    tetra = create_sample_tetrahedron()
    assert len(tetra.faces) == 4

    result = MeshSimplifier.simplify(tetra, target_faces=2)
    assert result.success is True
    assert result.final_face_count == 4
    assert any("minimal topological limit" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Test 9: Execution Time and Metric Reporting
# ---------------------------------------------------------------------------
def test_execution_time_reporting():
    """Verify execution time is recorded as a positive float upon simplification."""
    mesh = create_sample_icosphere(subdivisions=2)
    mock_simplified = create_sample_icosphere(subdivisions=1)

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=mock_simplified):
            result = MeshSimplifier.simplify(mesh, target_faces=20)

            assert result.success is True
            assert isinstance(result.execution_time_seconds, float)
            assert result.execution_time_seconds >= 0.0
            assert result.reduction_percentage > 0.0


# ---------------------------------------------------------------------------
# Test 10: Successful Simplification When Engine is Available
# ---------------------------------------------------------------------------
def test_successful_simplification_and_reduction():
    """Verify successful QEM simplification, target reaching, and reduction calculations."""
    mesh = create_sample_icosphere(subdivisions=2)  # 320 faces
    orig_faces = len(mesh.faces)
    target = 80

    # Mock simplified mesh with 80 faces
    mock_simplified = trimesh.creation.icosphere(subdivisions=1)  # 80 faces
    assert len(mock_simplified.faces) == 80

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=mock_simplified) as mock_decim:
            result = MeshSimplifier.simplify(mesh, target_faces=target)

            assert result.success is True
            assert result.original_face_count == orig_faces
            assert result.final_face_count == 80
            assert result.requested_target_faces == target
            assert result.target_reached is True
            expected_reduction = round((1.0 - (80.0 / orig_faces)) * 100.0, 2)
            assert result.reduction_percentage == expected_reduction
            assert result.optimized_mesh is not None
            assert len(result.optimized_mesh.faces) == 80

            # Verify simplify_quadric_decimation was invoked with correct target_count
            mock_decim.assert_called_once()
            call_kwargs = mock_decim.call_args[1]
            assert call_kwargs["face_count"] == target


def test_reduction_ratio_calculation():
    """Verify reduction_ratio properly calculates target_faces."""
    mesh = create_sample_icosphere(subdivisions=2)  # 320 faces
    orig_faces = len(mesh.faces)
    ratio = 0.5  # 50% reduction -> target = 160 faces

    mock_simplified = create_sample_icosphere(subdivisions=1)  # 80 faces

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=mock_simplified) as mock_decim:
            result = MeshSimplifier.simplify(mesh, reduction_ratio=ratio)

            assert result.success is True
            expected_target = int(orig_faces * (1.0 - ratio))
            assert result.requested_target_faces == expected_target
            mock_decim.assert_called_once()
            call_kwargs = mock_decim.call_args[1]
            assert call_kwargs["face_count"] == expected_target


def test_simplification_options_model():
    """Verify SimplificationOptions model passes arguments cleanly to MeshSimplifier."""
    mesh = create_sample_icosphere(subdivisions=2)
    opts = SimplificationOptions(target_faces=100, aggression=5)
    mock_simplified = create_sample_icosphere(subdivisions=1)

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=mock_simplified) as mock_decim:
            result = MeshSimplifier.simplify(mesh, options=opts)

            assert result.success is True
            mock_decim.assert_called_once()
            assert mock_decim.call_args[1]["face_count"] == 100
            assert mock_decim.call_args[1]["aggression"] == 5


def test_degenerate_simplification_output_handling():
    """Verify that if simplification produces 0 faces, the result reports failure cleanly."""
    mesh = create_sample_icosphere(subdivisions=2)
    empty_result = trimesh.Trimesh(vertices=[], faces=[])

    with patch.object(MeshSimplifier, "is_engine_available", return_value=True):
        with patch.object(trimesh.Trimesh, "simplify_quadric_decimation", return_value=empty_result):
            result = MeshSimplifier.simplify(mesh, target_faces=50)

            assert result.success is False
            assert result.optimized_mesh is None
            assert any("degenerate" in err or "0 faces" in err for err in result.errors)


def test_real_qem_live_simplification():
    """Verify genuine non-mocked QEM decimation executes end-to-end when fast-simplification is installed."""
    if not MeshSimplifier.is_engine_available():
        pytest.skip("fast-simplification not installed in runtime")

    # Real icosphere with 1,280 faces
    mesh = trimesh.creation.icosphere(subdivisions=3)
    orig_faces = len(mesh.faces)
    target = 320

    res = MeshSimplifier.simplify(mesh, target_faces=target)
    assert res.success is True
    assert res.optimized_mesh is not None
    assert res.final_face_count <= target + 2
    assert res.final_face_count < orig_faces
    assert res.reduction_percentage > 50.0
    assert res.target_reached is True
    assert res.execution_time_seconds >= 0.0
    assert len(res.errors) == 0

    # Ensure original mesh was not mutated
    assert len(mesh.faces) == orig_faces
