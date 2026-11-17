"""
Mesh Metrics Utility
Provides basic geometric statistics and comprehensive validation for 3D meshes.
Reuses and integrates with the PolyGen MeshValidator engine.
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path

try:
    from mesh_processing.mesh_validator import (
        MeshValidator,
        MeshValidationReport,
        MeshValidationError,
    )
except (ImportError, ValueError):
    from ..mesh_processing.mesh_validator import (
        MeshValidator,
        MeshValidationReport,
        MeshValidationError,
    )


def calculate_mesh_metrics(vertices: list, faces: list) -> Dict[str, Any]:
    """
    Calculate basic and advanced geometric statistics for a 3D mesh.

    Args:
        vertices: List of 3D vertex coordinates.
        faces: List of polygon faces containing vertex indices.

    Returns:
        Dictionary containing mesh statistics and validation status.

    Raises:
        ValueError: If mesh contains empty data, malformed coordinates, or invalid indices.
    """
    vertex_count = len(vertices) if vertices is not None else 0
    face_count = len(faces) if faces is not None else 0

    if vertex_count == 0:
        raise ValueError("Mesh must contain at least one vertex.")

    if face_count == 0:
        raise ValueError("Mesh must contain at least one face.")

    for vertex in vertices:
        if len(vertex) != 3:
            raise ValueError("Every vertex must contain exactly 3 coordinates.")

    for face in faces:
        if len(face) < 3:
            raise ValueError("Every face must contain at least 3 vertices.")

        if any(index < 0 or index >= vertex_count for index in face):
            raise ValueError("Face contains an invalid vertex index.")

    # Execute comprehensive validation via MeshValidator engine
    report = MeshValidator.validate_arrays(vertices=vertices, faces=faces)

    # Average vertices per face
    avg_verts_per_face = round(sum(len(f) for f in faces) / face_count, 2)

    # Construct rich, backwards-compatible dictionary
    return {
        "vertex_count": vertex_count,
        "face_count": face_count,
        "average_vertices_per_face": avg_verts_per_face,
        "is_valid": report.is_valid,
        "edge_count": report.metrics.edge_count,
        "surface_area": report.metrics.surface_area,
        "volume": report.metrics.volume,
        "is_watertight": report.metrics.is_watertight,
        "is_winding_consistent": report.metrics.is_winding_consistent,
        "has_degenerate_faces": report.has_degenerate_faces,
        "has_non_manifold_edges": report.has_non_manifold_edges,
        "bounding_box": {
            "min": report.metrics.bounding_box_min,
            "max": report.metrics.bounding_box_max,
            "dimensions": report.metrics.dimensions,
        },
        "errors": report.errors,
        "warnings": report.warnings,
        "report": report.model_dump(),
    }


def validate_mesh_asset(
    source: Union[str, Path, bytes],
    file_type: Optional[str] = None,
) -> MeshValidationReport:
    """
    Inspects and validates a 3D asset file (.obj, .glb, .gltf, .stl).

    Args:
        source: File path or raw bytes.
        file_type: Optional file extension if passing bytes.

    Returns:
        Structured MeshValidationReport.
    """
    return MeshValidator.load_and_validate(source=source, file_type=file_type)


if __name__ == "__main__":
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
    print("Mesh Metrics & Validation Summary:")
    for k, v in metrics.items():
        if k != "report":
            print(f"  {k}: {v}")
