"""
Mesh Metrics Utility
Provides basic geometric statistics for 3D meshes.
"""

from typing import Any


def calculate_mesh_metrics(vertices: list, faces: list) -> dict[str, Any]:
    """
    Calculate basic statistics for a 3D mesh.

    Args:
        vertices: List of 3D vertex coordinates.
        faces: List of polygon faces containing vertex indices.

    Returns:
        Dictionary containing mesh statistics.
    """

    vertex_count = len(vertices)
    face_count = len(faces)

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

    return {
        "vertex_count": vertex_count,
        "face_count": face_count,
        "average_vertices_per_face": round(
            sum(len(face) for face in faces) / face_count, 2
        ),
        "is_valid": True,
    }


if __name__ == "__main__":
    sample_vertices = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ]

    sample_faces = [
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3],
    ]

    print(calculate_mesh_metrics(sample_vertices, sample_faces))