"""
Automated Test Suite for Mesh Validation & Geometry Metrics
Tests structural soundness, topological manifoldness, degenerate face detection,
file loading (OBJ, GLB, STL), and backwards compatibility.
"""

import io
import pytest
import numpy as np

from app.services.mesh_generator import ProceduralMeshFactory
from mesh_processing.mesh_validator import (
    MeshValidator,
    MeshValidationReport,
    MeshValidationError,
)
from utils.mesh_metrics import calculate_mesh_metrics, validate_mesh_asset


# ----------------------------------------------------------------------
# 1. Valid Manifold Geometry Tests
# ----------------------------------------------------------------------

def test_valid_tetrahedron():
    """Valid closed tetrahedron should be watertight, manifold, and non-degenerate."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.5, 0.866025, 0.0],
        [0.5, 0.288675, 0.816497],
    ]
    # Faces oriented outwards
    faces = [
        [0, 2, 1],
        [0, 1, 3],
        [1, 2, 3],
        [2, 0, 3],
    ]

    report = MeshValidator.validate_arrays(vertices, faces, mesh_name="Tetrahedron")
    assert report.is_valid is True
    assert report.metrics.vertex_count == 4
    assert report.metrics.face_count == 4
    assert report.metrics.edge_count == 6
    assert report.metrics.is_watertight is True
    assert report.has_degenerate_faces is False
    assert report.has_non_manifold_edges is False
    assert report.boundary_edge_count == 0
    assert len(report.errors) == 0
    assert report.metrics.surface_area > 0.0
    assert report.metrics.volume is not None and report.metrics.volume > 0.0


def test_valid_cube_trimesh():
    """Valid cube should have correct bounding box, volume, and Euler characteristic."""
    import trimesh
    cube = trimesh.creation.box(extents=(2.0, 4.0, 6.0))
    report = MeshValidator.validate_trimesh(cube, mesh_name="Box")

    assert report.is_valid is True
    assert report.metrics.vertex_count == 8
    assert report.metrics.face_count == 12
    assert report.metrics.edge_count == 18
    assert report.metrics.is_watertight is True
    assert report.has_degenerate_faces is False
    assert report.has_non_manifold_edges is False
    assert report.metrics.euler_characteristic == 2
    # Volume of 2 * 4 * 6 = 48
    assert pytest.approx(report.metrics.volume, rel=1e-3) == 48.0
    assert pytest.approx(report.metrics.dimensions, rel=1e-3) == [2.0, 4.0, 6.0]


# ----------------------------------------------------------------------
# 2. Degenerate and Zero-Area Face Detection
# ----------------------------------------------------------------------

def test_degenerate_face_duplicate_indices():
    """Faces with repeated vertex indices (e.g. [0, 1, 0]) must be flagged as degenerate."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [
        [0, 1, 0],  # Degenerate face with repeated vertex 0
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.is_valid is False
    assert report.has_degenerate_faces is True
    assert report.degenerate_face_count >= 1
    assert any("degenerate" in err.lower() for err in report.errors)


def test_zero_area_collinear_face():
    """Collinear vertices form a triangle with zero surface area; should be flagged."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [2.0, 0.0, 0.0],  # Collinear on X axis
    ]
    faces = [
        [0, 1, 2],
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.has_degenerate_faces is True
    assert report.degenerate_face_count >= 1
    assert any("zero or near-zero" in w.lower() for w in report.warnings)


# ----------------------------------------------------------------------
# 3. Non-Manifold and Open Boundary Topology Tests
# ----------------------------------------------------------------------

def test_non_manifold_edge_detection():
    """An edge shared by 3 triangles is non-manifold and must be flagged as an error."""
    # 3 triangles meeting at the edge between vertex 0 and 1
    vertices = [
        [0.0, 0.0, 0.0],  # 0
        [1.0, 0.0, 0.0],  # 1
        [0.5, 1.0, 0.0],  # 2 (Triangle 1)
        [0.5, -1.0, 0.0], # 3 (Triangle 2)
        [0.5, 0.0, 1.0],  # 4 (Triangle 3)
    ]
    faces = [
        [0, 1, 2],
        [0, 1, 3],
        [0, 1, 4],  # Edge (0, 1) is shared by 3 faces
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.is_valid is False
    assert report.has_non_manifold_edges is True
    assert report.non_manifold_edge_count >= 1
    assert any("non-manifold" in err.lower() for err in report.errors)


def test_open_boundary_warning():
    """An open surface (e.g. a single triangle or open plane) has boundary edges and is not watertight."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [
        [0, 1, 2],
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.is_valid is True  # Valid open surface (not necessarily fatal)
    assert report.metrics.is_watertight is False
    assert report.boundary_edge_count == 3
    assert any("boundary" in w.lower() for w in report.warnings)


# ----------------------------------------------------------------------
# 4. Duplicate and Isolated Vertex Detection
# ----------------------------------------------------------------------

def test_duplicate_and_isolated_vertices():
    """Coincident vertices and unused vertices must be detected."""
    vertices = [
        [0.0, 0.0, 0.0],  # 0
        [1.0, 0.0, 0.0],  # 1
        [0.0, 1.0, 0.0],  # 2
        [0.0, 0.0, 0.0],  # 3 (Coincident duplicate of 0)
        [5.0, 5.0, 5.0],  # 4 (Isolated, never referenced in faces)
    ]
    faces = [
        [0, 1, 2],
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.has_duplicate_vertices is True
    assert report.duplicate_vertex_count >= 1
    assert report.has_isolated_vertices is True
    assert report.isolated_vertex_count == 2  # vertex 3 and 4 are not in faces


# ----------------------------------------------------------------------
# 5. Invalid Input and Boundary Handling
# ----------------------------------------------------------------------

def test_empty_mesh_inputs():
    """Empty vertices or faces must produce is_valid=False with meaningful errors."""
    report_empty_v = MeshValidator.validate_arrays([], [[0, 1, 2]])
    assert report_empty_v.is_valid is False
    assert any("zero vertices" in err.lower() for err in report_empty_v.errors)

    report_empty_f = MeshValidator.validate_arrays([[0, 0, 0]], [])
    assert report_empty_f.is_valid is False
    assert any("zero faces" in err.lower() for err in report_empty_f.errors)


def test_out_of_bounds_index():
    """Referencing a vertex index greater than len(vertices) - 1 must fail."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [
        [0, 1, 99],  # 99 is out of bounds
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.is_valid is False
    assert any("out-of-bounds" in err.lower() for err in report.errors)


def test_non_finite_coordinates():
    """NaN or Inf coordinates must be flagged as fatal errors."""
    vertices = [
        [0.0, 0.0, 0.0],
        [float("nan"), 1.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [
        [0, 1, 2],
    ]

    report = MeshValidator.validate_arrays(vertices, faces)
    assert report.is_valid is False
    assert any("nan" in err.lower() or "finite" in err.lower() for err in report.errors)


# ----------------------------------------------------------------------
# 6. File Loading & Format Support (OBJ, GLB, STL)
# ----------------------------------------------------------------------

def test_load_and_validate_obj_and_stl():
    """Inspect and validate OBJ and binary STL representations from ProceduralMeshFactory."""
    mesh_data = ProceduralMeshFactory.create_crystal(scale=1.5, seed=101)

    obj_str = mesh_data.export_obj()
    stl_bytes = mesh_data.export_stl()

    # Validate OBJ
    obj_report = MeshValidator.load_and_validate(
        source=io.BytesIO(obj_str.encode("utf-8")),
        file_type="obj",
        mesh_name="Crystal_OBJ",
    )
    assert obj_report.is_valid is True
    assert obj_report.metrics.vertex_count == mesh_data.vertex_count
    assert obj_report.metrics.face_count == mesh_data.poly_count

    # Validate STL
    stl_report = MeshValidator.load_and_validate(
        source=stl_bytes,
        file_type="stl",
        mesh_name="Crystal_STL",
    )
    assert stl_report.is_valid is True
    assert stl_report.metrics.face_count == mesh_data.poly_count


def test_load_and_validate_glb():
    """Inspect and validate binary glTF 2.0 (GLB) output from ProceduralMeshFactory."""
    drone_data = ProceduralMeshFactory.create_drone()
    glb_bytes = drone_data.export_glb()

    report = MeshValidator.load_and_validate(
        source=glb_bytes,
        file_type="glb",
        mesh_name="Recon_Drone_GLB",
    )
    assert report.is_valid is True
    assert report.metrics.vertex_count == drone_data.vertex_count
    assert report.metrics.face_count == drone_data.poly_count
    assert report.metrics.dimensions[0] > 0.0
    assert report.metrics.surface_area > 0.0


# ----------------------------------------------------------------------
# 7. Backward Compatibility for calculate_mesh_metrics
# ----------------------------------------------------------------------

def test_calculate_mesh_metrics_backwards_compatibility():
    """Verify that calculate_mesh_metrics in utils/mesh_metrics.py retains its contract."""
    sample_vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ]
    sample_faces = [
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3],
    ]

    metrics = calculate_mesh_metrics(sample_vertices, sample_faces)
    assert metrics["is_valid"] is True
    assert metrics["vertex_count"] == 4
    assert metrics["face_count"] == 4
    assert metrics["average_vertices_per_face"] == 3.0
    # Enhanced attributes
    assert "surface_area" in metrics
    assert "bounding_box" in metrics
    assert "is_watertight" in metrics


def test_calculate_mesh_metrics_exceptions():
    """Verify that calculate_mesh_metrics raises ValueError for invalid inputs as before."""
    with pytest.raises(ValueError, match="at least one vertex"):
        calculate_mesh_metrics([], [[0, 1, 2]])

    with pytest.raises(ValueError, match="at least one face"):
        calculate_mesh_metrics([[0, 0, 0]], [])

    with pytest.raises(ValueError, match="exactly 3 coordinates"):
        calculate_mesh_metrics([[0, 0]], [[0, 0, 0]])

    with pytest.raises(ValueError, match="at least 3 vertices"):
        calculate_mesh_metrics([[0, 0, 0], [1, 0, 0]], [[0, 1]])

    with pytest.raises(ValueError, match="invalid vertex index"):
        calculate_mesh_metrics([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 5]])

