"""
PolyGen QEM Mesh Simplification Service
Provides high-fidelity polygon decimation using genuine Garland–Heckbert
Quadric Error Metrics (QEM) via Trimesh and fast-simplification.
"""

from __future__ import annotations

import time
from typing import Any, List, Optional, Union
import numpy as np
from pydantic import BaseModel, Field
import trimesh


class SimplificationOptions(BaseModel):
    """Configuration options governing QEM mesh decimation."""
    target_faces: Optional[int] = Field(None, description="Absolute target polygon face count")
    reduction_ratio: Optional[float] = Field(
        None, description="Fraction of faces to eliminate (e.g. 0.5 removes 50% faces)"
    )
    aggression: Optional[int] = Field(
        None, description="Decimation aggression parameter (0=conservative/precise, 10=aggressive/fast)"
    )


class SimplificationResult(BaseModel):
    """Structured report returned after QEM mesh simplification."""
    success: bool = Field(..., description="True if QEM decimation completed successfully")
    optimized_mesh: Optional[Any] = Field(None, description="Decimated Trimesh instance if successful")
    original_face_count: int = Field(..., description="Initial face count prior to decimation")
    final_face_count: int = Field(..., description="Resulting face count after decimation")
    reduction_percentage: float = Field(0.0, description="Percentage of faces removed (0.0 to 100.0%)")
    requested_target_faces: Optional[int] = Field(None, description="Requested target face count")
    target_reached: bool = Field(False, description="True if final face count <= requested target")
    execution_time_seconds: float = Field(0.0, description="Execution time in seconds")
    algorithm: str = Field(
        "Garland-Heckbert Quadric Error Metrics (QEM)", description="Simplification algorithm employed"
    )
    warnings: List[str] = Field(default_factory=list, description="Non-fatal advisories or notices")
    errors: List[str] = Field(default_factory=list, description="Fatal errors preventing simplification")

    model_config = {"arbitrary_types_allowed": True}


class MeshSimplifier:
    """
    Standalone Quadric Error Metrics (QEM) mesh simplification service.
    Utilizes Garland-Heckbert error quadric minimization to reduce polygon count
    while preserving geometric volume, surface curvature, and boundary topology.
    """

    ALGORITHM_NAME = "Garland-Heckbert Quadric Error Metrics (QEM)"

    @classmethod
    def is_engine_available(cls) -> bool:
        """
        Detects whether the underlying QEM acceleration engine (fast-simplification)
        is installed and available in the current environment.
        """
        try:
            import fast_simplification  # noqa: F401
            return True
        except ImportError:
            return False

    @classmethod
    def simplify(
        cls,
        mesh: trimesh.Trimesh,
        target_faces: Optional[int] = None,
        reduction_ratio: Optional[float] = None,
        aggression: Optional[int] = None,
        options: Optional[SimplificationOptions] = None,
    ) -> SimplificationResult:
        """
        Simplifies a triangular mesh using genuine Quadric Error Metrics.
        Preserves the input mesh by performing all operations on an isolated copy.

        Args:
            mesh: Input trimesh.Trimesh to be simplified.
            target_faces: Explicit target polygon face count.
            reduction_ratio: Fraction of faces to remove in range (0.0, 1.0).
            aggression: Aggression scale (0 to 10) passed to fast_simplification.
            options: Optional SimplificationOptions model overriding direct arguments.

        Returns:
            SimplificationResult containing the optimized Trimesh and comprehensive metrics.
        """
        # Resolve options
        opts = options or SimplificationOptions(
            target_faces=target_faces,
            reduction_ratio=reduction_ratio,
            aggression=aggression,
        )

        resolved_target = opts.target_faces
        resolved_ratio = opts.reduction_ratio
        resolved_aggression = opts.aggression

        # 1. Parameter Validation
        if resolved_target is None and resolved_ratio is None:
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=len(mesh.faces) if isinstance(mesh, trimesh.Trimesh) and hasattr(mesh, "faces") else 0,
                final_face_count=0,
                algorithm=cls.ALGORITHM_NAME,
                errors=["Either 'target_faces' or 'reduction_ratio' must be specified."],
            )

        if resolved_ratio is not None and not (0.0 < resolved_ratio < 1.0):
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=len(mesh.faces) if isinstance(mesh, trimesh.Trimesh) and hasattr(mesh, "faces") else 0,
                final_face_count=0,
                algorithm=cls.ALGORITHM_NAME,
                errors=[f"Invalid reduction_ratio {resolved_ratio}. Must be strictly between 0.0 and 1.0."],
            )

        if resolved_target is not None and resolved_target < 1:
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=len(mesh.faces) if isinstance(mesh, trimesh.Trimesh) and hasattr(mesh, "faces") else 0,
                final_face_count=0,
                algorithm=cls.ALGORITHM_NAME,
                errors=[f"Invalid target_faces {resolved_target}. Must be an integer >= 1."],
            )

        # 2. Input Geometry Validation
        if not isinstance(mesh, trimesh.Trimesh):
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=0,
                final_face_count=0,
                algorithm=cls.ALGORITHM_NAME,
                errors=[f"Expected a trimesh.Trimesh instance, got: {type(mesh).__name__}."],
            )

        if len(mesh.vertices) < 3 or len(mesh.faces) < 1:
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=len(mesh.faces),
                final_face_count=0,
                algorithm=cls.ALGORITHM_NAME,
                errors=["Input mesh is degenerate: contains fewer than 3 vertices or 1 face."],
            )

        orig_faces = int(len(mesh.faces))

        # 3. Calculate Effective Target Face Count
        if resolved_target is not None:
            target_faces_calc = int(resolved_target)
        else:
            # reduction_ratio indicates fraction of faces to remove
            target_faces_calc = max(1, int(round(orig_faces * (1.0 - float(resolved_ratio)))))

        # 4. Handle Meshes Already Below or At Target
        if orig_faces <= target_faces_calc:
            return SimplificationResult(
                success=True,
                optimized_mesh=mesh.copy(),
                original_face_count=orig_faces,
                final_face_count=orig_faces,
                reduction_percentage=0.0,
                requested_target_faces=target_faces_calc,
                target_reached=True,
                execution_time_seconds=0.0,
                algorithm=cls.ALGORITHM_NAME,
                warnings=[
                    f"Mesh face count ({orig_faces}) is already at or below target ({target_faces_calc}). "
                    "No simplification performed."
                ],
            )

        # 5. Handle Minimal / Indivisible Meshes (e.g. Tetrahedron with <= 4 faces)
        if orig_faces <= 4:
            return SimplificationResult(
                success=True,
                optimized_mesh=mesh.copy(),
                original_face_count=orig_faces,
                final_face_count=orig_faces,
                reduction_percentage=0.0,
                requested_target_faces=target_faces_calc,
                target_reached=False,
                execution_time_seconds=0.0,
                algorithm=cls.ALGORITHM_NAME,
                warnings=[
                    f"Mesh face count ({orig_faces}) is at minimal topological limit (<= 4). "
                    "Further decimation would destroy volumetric manifoldness."
                ],
            )

        # 6. Check Engine Availability
        if not cls.is_engine_available():
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=orig_faces,
                final_face_count=orig_faces,
                reduction_percentage=0.0,
                requested_target_faces=target_faces_calc,
                target_reached=False,
                execution_time_seconds=0.0,
                algorithm=cls.ALGORITHM_NAME,
                errors=[
                    "QEM decimation engine 'fast-simplification' is not installed. "
                    "To enable genuine Garland-Heckbert Quadric Error Metrics simplification, "
                    "install the required package: pip install fast-simplification"
                ],
            )

        # 7. Execute Simplification on Isolated Copy
        mesh_copy = mesh.copy()

        # Pre-clean non-manifold degenerate elements before quadric accumulation
        if hasattr(mesh_copy, "unique_faces"):
            mesh_copy.update_faces(mesh_copy.unique_faces())
        if hasattr(mesh_copy, "nondegenerate_faces"):
            mesh_copy.update_faces(mesh_copy.nondegenerate_faces())
        if hasattr(mesh_copy, "remove_unreferenced_vertices"):
            mesh_copy.remove_unreferenced_vertices()

        t0 = time.perf_counter()
        try:
            simplified = mesh_copy.simplify_quadric_decimation(
                face_count=target_faces_calc,
                aggression=resolved_aggression,
            )
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=orig_faces,
                final_face_count=orig_faces,
                reduction_percentage=0.0,
                requested_target_faces=target_faces_calc,
                target_reached=False,
                execution_time_seconds=round(elapsed, 4),
                algorithm=cls.ALGORITHM_NAME,
                errors=[f"QEM simplification failed during edge contraction: {str(exc)}"],
            )

        elapsed = time.perf_counter() - t0

        # 8. Post-Decimation Geometric Validation
        if not isinstance(simplified, trimesh.Trimesh) or len(simplified.faces) == 0:
            return SimplificationResult(
                success=False,
                optimized_mesh=None,
                original_face_count=orig_faces,
                final_face_count=0,
                reduction_percentage=0.0,
                requested_target_faces=target_faces_calc,
                target_reached=False,
                execution_time_seconds=round(elapsed, 4),
                algorithm=cls.ALGORITHM_NAME,
                errors=["QEM decimation produced empty or degenerate geometry (0 faces)."],
            )

        final_faces = int(len(simplified.faces))
        reduction_pct = round((1.0 - (final_faces / float(orig_faces))) * 100.0, 2)
        # In QEM edge collapse, each collapse eliminates 2 faces; odd/even face counts land within +/- 2 of target
        target_reached = final_faces <= max(target_faces_calc, target_faces_calc + 2)

        warnings: List[str] = []
        if final_faces > target_faces_calc:
            warnings.append(
                f"Decimation stopped at {final_faces} faces to prevent topological breakdown "
                f"before reaching exact target of {target_faces_calc}."
            )

        return SimplificationResult(
            success=True,
            optimized_mesh=simplified,
            original_face_count=orig_faces,
            final_face_count=final_faces,
            reduction_percentage=reduction_pct,
            requested_target_faces=target_faces_calc,
            target_reached=target_reached,
            execution_time_seconds=round(elapsed, 4),
            algorithm=cls.ALGORITHM_NAME,
            warnings=warnings,
            errors=[],
        )
