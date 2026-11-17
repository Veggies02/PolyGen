"""
PolyGen Mesh Validation Service
Provides robust inspection, geometry metrics calculation, and structural validation
for 3D mesh assets in OBJ, GLB, GLTF, and STL formats.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from pydantic import BaseModel, Field
import trimesh


class MeshValidationError(Exception):
    """Raised when a mesh has fatal validation errors that prevent further processing."""
    pass


class MeshMetrics(BaseModel):
    """Geometric and volumetric statistics for a 3D mesh."""
    vertex_count: int = Field(..., description="Total number of vertices")
    face_count: int = Field(..., description="Total number of faces (triangles)")
    edge_count: int = Field(..., description="Total number of unique edges")
    bounding_box_min: List[float] = Field(..., description="Minimum [X, Y, Z] coordinate bounds")
    bounding_box_max: List[float] = Field(..., description="Maximum [X, Y, Z] coordinate bounds")
    dimensions: List[float] = Field(..., description="Extents [width, height, depth] (max - min)")
    centroid: List[float] = Field(..., description="Geometric centroid [X, Y, Z]")
    surface_area: float = Field(..., description="Total surface area in square units")
    volume: Optional[float] = Field(None, description="Enclosed volume in cubic units (if watertight)")
    is_watertight: bool = Field(..., description="True if mesh is a closed solid with no boundary holes")
    is_winding_consistent: bool = Field(..., description="True if face vertex winding order is consistent")
    euler_characteristic: int = Field(..., description="Euler characteristic (V - E + F)")


class MeshValidationReport(BaseModel):
    """Comprehensive validation report for a 3D mesh."""
    is_valid: bool = Field(..., description="True if mesh passed all structural validity checks")
    mesh_name: str = Field("Mesh", description="Identifier or filename of the validated mesh")
    metrics: MeshMetrics = Field(..., description="Computed geometric statistics")
    has_degenerate_faces: bool = Field(..., description="True if faces with duplicate indices or 0 area exist")
    degenerate_face_count: int = Field(0, description="Number of degenerate faces detected")
    has_duplicate_vertices: bool = Field(..., description="True if coincident vertices exist")
    duplicate_vertex_count: int = Field(0, description="Estimated number of duplicate/coincident vertices")
    has_isolated_vertices: bool = Field(..., description="True if unreferenced vertices exist")
    isolated_vertex_count: int = Field(0, description="Number of vertices not referenced by any face")
    has_non_manifold_edges: bool = Field(..., description="True if edges shared by > 2 faces exist")
    non_manifold_edge_count: int = Field(0, description="Number of non-manifold edges detected")
    boundary_edge_count: int = Field(0, description="Number of open boundary edges (edges with only 1 face)")
    errors: List[str] = Field(default_factory=list, description="Fatal validation errors")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings or advisories")
    diagnostics: Dict[str, Any] = Field(default_factory=dict, description="Supplementary diagnostic data")


class MeshValidator:
    """
    Production-grade mesh validation engine.
    Analyzes raw arrays, Trimesh instances, or file inputs for geometric soundness,
    topological manifoldness, and export readiness.
    """

    @classmethod
    def load_mesh(
        cls,
        source: Union[str, Path, bytes, io.BytesIO, trimesh.Trimesh],
        file_type: Optional[str] = None,
        process: bool = False,
    ) -> trimesh.Trimesh:
        """
        Loads a mesh from a file path, byte stream, or Trimesh instance.
        Preserves original geometry without auto-collapsing or auto-repairing if process=False.

        Args:
            source: File path, raw bytes, BytesIO stream, or trimesh.Trimesh instance.
            file_type: Explicit file extension (e.g. 'obj', 'glb', 'stl') if passing bytes.
            process: Whether trimesh should auto-process geometry on load. Defaults to False
                     to ensure validation inspects the true raw input.

        Returns:
            trimesh.Trimesh instance.

        Raises:
            MeshValidationError: If the source cannot be parsed or produces no valid geometry.
        """
        if isinstance(source, trimesh.Trimesh):
            return source

        try:
            if isinstance(source, (str, Path)):
                path = Path(source)
                if not path.exists():
                    raise MeshValidationError(f"Mesh file does not exist: {path}")
                loaded = trimesh.load(str(path), process=process)
            elif isinstance(source, bytes):
                if not file_type:
                    raise MeshValidationError("file_type must be specified when loading mesh from raw bytes")
                loaded = trimesh.load(
                    file_obj=io.BytesIO(source),
                    file_type=file_type.lstrip(".").lower(),
                    process=process,
                )
            elif isinstance(source, io.BytesIO):
                if not file_type:
                    raise MeshValidationError("file_type must be specified when loading mesh from BytesIO")
                loaded = trimesh.load(
                    file_obj=source,
                    file_type=file_type.lstrip(".").lower(),
                    process=process,
                )
            else:
                raise MeshValidationError(f"Unsupported mesh source type: {type(source).__name__}")

            # If a Scene was loaded (e.g. from multi-node GLB), merge or extract geometry
            if isinstance(loaded, trimesh.Scene):
                if len(loaded.geometry) == 0:
                    raise MeshValidationError("Loaded 3D scene contains zero geometry nodes.")
                # Concatenate geometries if multiple exist
                meshes = [m for m in loaded.geometry.values() if isinstance(m, trimesh.Trimesh)]
                if not meshes:
                    raise MeshValidationError("Loaded 3D scene contains no triangular mesh geometries.")
                if len(meshes) == 1:
                    return meshes[0]
                return trimesh.util.concatenate(meshes)

            if not isinstance(loaded, trimesh.Trimesh):
                raise MeshValidationError(f"Expected a triangular mesh, got: {type(loaded).__name__}")

            return loaded

        except Exception as exc:
            if isinstance(exc, MeshValidationError):
                raise
            raise MeshValidationError(f"Failed to load mesh: {exc}") from exc

    @classmethod
    def validate_arrays(
        cls,
        vertices: Union[List[Any], np.ndarray],
        faces: Union[List[Any], np.ndarray],
        mesh_name: str = "RawArrayMesh",
    ) -> MeshValidationReport:
        """
        Validates raw vertex coordinates and face index arrays directly.
        Provides compatibility with lightweight array inputs without requiring file I/O.
        """
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Basic array presence
        if vertices is None or len(vertices) == 0:
            errors.append("Mesh contains zero vertices.")
            return cls._empty_report(mesh_name, errors)

        if faces is None or len(faces) == 0:
            errors.append("Mesh contains zero faces.")
            return cls._empty_report(mesh_name, errors, vertex_count=len(vertices))

        # Convert to numpy
        try:
            verts_np = np.asarray(vertices, dtype=np.float64)
        except Exception as e:
            errors.append(f"Cannot parse vertices into float64 array: {e}")
            return cls._empty_report(mesh_name, errors)

        if verts_np.ndim != 2 or verts_np.shape[1] != 3:
            errors.append(f"Vertices array must have shape (N, 3), got {verts_np.shape}.")
            return cls._empty_report(mesh_name, errors)

        if not np.all(np.isfinite(verts_np)):
            errors.append("Vertices array contains NaN or Infinite coordinate values.")

        num_vertices = len(verts_np)

        # 2. Inspect faces
        triangles: List[Tuple[int, int, int]] = []
        has_invalid_indices = False
        non_triangular_faces = 0

        for f_idx, f in enumerate(faces):
            f_len = len(f)
            if f_len < 3:
                errors.append(f"Face {f_idx} has {f_len} vertices; minimum required is 3.")
                has_invalid_indices = True
                continue

            for idx in f:
                if idx < 0 or idx >= num_vertices:
                    errors.append(
                        f"Face {f_idx} references out-of-bounds vertex index {idx} "
                        f"(valid range: 0 to {num_vertices - 1})."
                    )
                    has_invalid_indices = True
                    break

            if not has_invalid_indices:
                # Triangulate polygons with > 3 vertices via simple fan for validation
                if f_len == 3:
                    triangles.append((int(f[0]), int(f[1]), int(f[2])))
                else:
                    non_triangular_faces += 1
                    for k in range(1, f_len - 1):
                        triangles.append((int(f[0]), int(f[k]), int(f[k + 1])))

        if non_triangular_faces > 0:
            warnings.append(
                f"Mesh contains {non_triangular_faces} polygon faces with > 3 vertices; "
                f"triangulated via fan for topological inspection."
            )

        if has_invalid_indices or len(triangles) == 0:
            return cls._empty_report(mesh_name, errors, vertex_count=num_vertices)

        faces_np = np.asarray(triangles, dtype=np.int64)

        # Build trimesh instance for deep geometric telemetry
        try:
            tm = trimesh.Trimesh(vertices=verts_np, faces=faces_np, process=False)
            return cls.validate_trimesh(tm, mesh_name=mesh_name, initial_errors=errors, initial_warnings=warnings)
        except Exception as e:
            errors.append(f"Topology analysis failed: {e}")
            return cls._empty_report(mesh_name, errors, vertex_count=num_vertices, face_count=len(faces_np))

    @classmethod
    def validate_trimesh(
        cls,
        mesh: trimesh.Trimesh,
        mesh_name: str = "TrimeshAsset",
        initial_errors: Optional[List[str]] = None,
        initial_warnings: Optional[List[str]] = None,
    ) -> MeshValidationReport:
        """
        Performs in-depth topological, geometric, and manifold inspection on a Trimesh instance.
        """
        errors = list(initial_errors or [])
        warnings = list(initial_warnings or [])

        verts = mesh.vertices
        faces = mesh.faces

        vertex_count = len(verts)
        face_count = len(faces)

        if vertex_count == 0:
            errors.append("Mesh has 0 vertices.")
            return cls._empty_report(mesh_name, errors)
        if face_count == 0:
            errors.append("Mesh has 0 faces.")
            return cls._empty_report(mesh_name, errors, vertex_count=vertex_count)

        # 1. Coordinate Validity
        if not np.all(np.isfinite(verts)):
            errors.append("Vertex buffer contains non-finite coordinates (NaN or Inf).")

        # 2. Degenerate faces detection
        # Case A: Faces with duplicate indices (e.g. [0, 1, 0])
        degenerate_indices_mask = (
            (faces[:, 0] == faces[:, 1]) |
            (faces[:, 1] == faces[:, 2]) |
            (faces[:, 0] == faces[:, 2])
        )
        idx_degen_count = int(np.sum(degenerate_indices_mask))

        # Case B: Zero-area faces (collinear vertices, cross product norm ~ 0)
        # Compute face cross products
        v0 = verts[faces[:, 0]]
        v1 = verts[faces[:, 1]]
        v2 = verts[faces[:, 2]]
        cross_prod = np.cross(v1 - v0, v2 - v0)
        area_doubled = np.linalg.norm(cross_prod, axis=1)
        zero_area_mask = area_doubled < 1e-12
        zero_area_count = int(np.sum(zero_area_mask))

        total_degen_faces = int(np.sum(degenerate_indices_mask | zero_area_mask))
        has_degenerate_faces = total_degen_faces > 0

        if idx_degen_count > 0:
            errors.append(f"Detected {idx_degen_count} degenerate face(s) with duplicate vertex indices.")
        if zero_area_count > 0:
            warnings.append(f"Detected {zero_area_count} face(s) with zero or near-zero surface area (< 1e-12).")

        # 3. Duplicate vertices check
        unique_verts = np.unique(np.round(verts, decimals=6), axis=0)
        duplicate_vertex_count = vertex_count - len(unique_verts)
        has_duplicate_vertices = duplicate_vertex_count > 0
        if has_duplicate_vertices:
            warnings.append(
                f"Mesh contains {duplicate_vertex_count} coincident/duplicate vertex coordinate(s) "
                f"within 1e-6 precision."
            )

        # 4. Isolated / Unreferenced vertices
        referenced_indices = np.unique(faces)
        isolated_vertex_count = vertex_count - len(referenced_indices)
        has_isolated_vertices = isolated_vertex_count > 0
        if has_isolated_vertices:
            warnings.append(f"Detected {isolated_vertex_count} unreferenced (isolated) vertex position(s).")

        # 5. Non-manifold and Boundary edge checks
        # Each edge in a manifold 2D surface appears in at most 2 faces.
        # Edges appearing in 1 face are boundary edges (holes/open mesh).
        # Edges appearing in > 2 faces are non-manifold.
        edges = mesh.edges_sorted
        unique_edges, edge_counts = np.unique(edges, axis=0, return_counts=True)
        non_manifold_mask = edge_counts > 2
        boundary_mask = edge_counts == 1

        non_manifold_count = int(np.sum(non_manifold_mask))
        boundary_count = int(np.sum(boundary_mask))
        has_non_manifold = non_manifold_count > 0

        if has_non_manifold:
            errors.append(
                f"Detected {non_manifold_count} non-manifold edge(s) shared by more than 2 faces. "
                f"Mesh is not a 2-manifold."
            )
        if boundary_count > 0:
            warnings.append(
                f"Mesh has {boundary_count} open boundary edge(s); geometry is not watertight."
            )

        # 6. Geometric bounds & metrics
        bounds = mesh.bounds
        if bounds is not None and len(bounds) == 2:
            bbox_min = [float(c) for c in bounds[0]]
            bbox_max = [float(c) for c in bounds[1]]
            dims = [float(bbox_max[i] - bbox_min[i]) for i in range(3)]
        else:
            bbox_min, bbox_max, dims = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]

        try:
            centroid = [float(c) for c in mesh.centroid]
        except Exception:
            centroid = [float(c) for c in np.mean(verts, axis=0)]

        try:
            surface_area = float(mesh.area)
        except Exception:
            surface_area = float(np.sum(area_doubled) * 0.5)

        is_watertight = bool(mesh.is_watertight)
        volume = float(mesh.volume) if is_watertight else None

        try:
            is_winding_consistent = bool(mesh.is_winding_consistent)
        except Exception:
            is_winding_consistent = False

        try:
            euler_characteristic = int(mesh.euler_number)
        except Exception:
            euler_characteristic = vertex_count - len(unique_edges) + face_count

        metrics = MeshMetrics(
            vertex_count=vertex_count,
            face_count=face_count,
            edge_count=len(unique_edges),
            bounding_box_min=bbox_min,
            bounding_box_max=bbox_max,
            dimensions=dims,
            centroid=centroid,
            surface_area=round(surface_area, 6),
            volume=round(volume, 6) if volume is not None else None,
            is_watertight=is_watertight,
            is_winding_consistent=is_winding_consistent,
            euler_characteristic=euler_characteristic,
        )

        is_valid = len(errors) == 0

        return MeshValidationReport(
            is_valid=is_valid,
            mesh_name=mesh_name,
            metrics=metrics,
            has_degenerate_faces=has_degenerate_faces,
            degenerate_face_count=total_degen_faces,
            has_duplicate_vertices=has_duplicate_vertices,
            duplicate_vertex_count=duplicate_vertex_count,
            has_isolated_vertices=has_isolated_vertices,
            isolated_vertex_count=isolated_vertex_count,
            has_non_manifold_edges=has_non_manifold,
            non_manifold_edge_count=non_manifold_count,
            boundary_edge_count=boundary_count,
            errors=errors,
            warnings=warnings,
            diagnostics={
                "index_degenerate_faces": idx_degen_count,
                "zero_area_faces": zero_area_count,
                "aspect_ratio": [round(d / max(dims[0], 1e-6), 3) for d in dims],
            },
        )

    @classmethod
    def load_and_validate(
        cls,
        source: Union[str, Path, bytes, io.BytesIO],
        file_type: Optional[str] = None,
        mesh_name: Optional[str] = None,
    ) -> MeshValidationReport:
        """
        Convenience method to load and validate a mesh file in one call.
        """
        name = mesh_name
        if not name:
            if isinstance(source, (str, Path)):
                name = Path(source).name
            else:
                name = f"MeshAsset.{file_type or 'bin'}"

        try:
            tm = cls.load_mesh(source=source, file_type=file_type, process=False)
            return cls.validate_trimesh(tm, mesh_name=name)
        except MeshValidationError as e:
            return cls._empty_report(name, errors=[str(e)])

    @classmethod
    def _empty_report(
        cls,
        mesh_name: str,
        errors: List[str],
        vertex_count: int = 0,
        face_count: int = 0,
    ) -> MeshValidationReport:
        """Helper to create a failed report when geometry is missing or malformed."""
        empty_metrics = MeshMetrics(
            vertex_count=vertex_count,
            face_count=face_count,
            edge_count=0,
            bounding_box_min=[0.0, 0.0, 0.0],
            bounding_box_max=[0.0, 0.0, 0.0],
            dimensions=[0.0, 0.0, 0.0],
            centroid=[0.0, 0.0, 0.0],
            surface_area=0.0,
            volume=None,
            is_watertight=False,
            is_winding_consistent=False,
            euler_characteristic=0,
        )
        return MeshValidationReport(
            is_valid=False,
            mesh_name=mesh_name,
            metrics=empty_metrics,
            has_degenerate_faces=False,
            degenerate_face_count=0,
            has_duplicate_vertices=False,
            duplicate_vertex_count=0,
            has_isolated_vertices=False,
            isolated_vertex_count=0,
            has_non_manifold_edges=False,
            non_manifold_edge_count=0,
            boundary_edge_count=0,
            errors=errors,
            warnings=[],
            diagnostics={},
        )

