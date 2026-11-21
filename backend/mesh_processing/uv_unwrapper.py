"""
PolyGen UV Unwrapping Service
Provides automatic UV parameterization, island segmentation, atlas packing,
and UV coordinate validation using xatlas and Trimesh.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field
import trimesh
import xatlas

from .mesh_validator import MeshValidator, MeshValidationError


class UVUnwrapOptions(BaseModel):
    """Configuration options for UV island generation and atlas packing."""
    resolution: int = Field(1024, ge=128, le=8192, description="Target atlas texture resolution in pixels")
    padding: int = Field(2, ge=0, le=64, description="Padding between UV islands in texels to prevent bleeding")
    bilinear: bool = Field(True, description="Account for bilinear filtering during chart packing")
    block_align: bool = Field(False, description="Align charts to 4x4 blocks for GPU block compression")
    rotate_charts: bool = Field(True, description="Rotate charts to optimize packing space utilization")
    rotate_charts_to_axis: bool = Field(True, description="Align charts to coordinate axes")
    brute_force: bool = Field(False, description="Use exhaustive search during packing (slower, tighter pack)")
    max_chart_size: int = Field(0, description="Maximum size of an individual chart in texels (0 = unbounded)")
    normal_seam_weight: float = Field(1.0, ge=0.0, description="Weight penalty for cuts across steep surface normals")
    texture_seam_weight: float = Field(1.0, ge=0.0, description="Weight penalty for cuts across existing seams")


class UVMetrics(BaseModel):
    """Quantitative telemetry for generated UV coordinates and packed charts."""
    uv_count: int = Field(..., description="Total number of 2D UV coordinates")
    chart_count: int = Field(..., description="Number of disconnected UV charts (islands)")
    atlas_width: int = Field(..., description="Raster width of the packed atlas")
    atlas_height: int = Field(..., description="Raster height of the packed atlas")
    uv_min: List[float] = Field(..., description="Minimum [U, V] coordinate values")
    uv_max: List[float] = Field(..., description="Maximum [U, V] coordinate values")
    original_vertex_count: int = Field(..., description="Vertex count of 3D mesh prior to unwrapping")
    unwrapped_vertex_count: int = Field(..., description="Vertex count after seam duplication")
    seam_vertex_duplications: int = Field(..., description="Number of duplicate vertices created along UV seams")
    aspect_ratio: float = Field(..., description="Width-to-height aspect ratio of the packed atlas")


class UVValidationReport(BaseModel):
    """Validation report inspecting UV coordinates, atlas normalization, and geometric fidelity."""
    is_valid: bool = Field(..., description="True if UV coordinates passed all integrity checks")
    has_uvs: bool = Field(..., description="True if non-empty UV coordinates are present")
    is_finite: bool = Field(..., description="True if all UV values are finite real numbers (no NaN / Inf)")
    is_normalized: bool = Field(..., description="True if all UV values lie within normalized [0, 1] bounds")
    has_face_correspondence: bool = Field(..., description="True if face vertex count matches UV indices count")
    geometry_preserved: bool = Field(..., description="True if 3D surface area and bounding extents match original")
    area_delta_percent: float = Field(0.0, description="Percentage difference in surface area (|A_new - A_orig| / A_orig)")
    errors: List[str] = Field(default_factory=list, description="Fatal UV errors")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal UV advisories")


class UVUnwrapResult(BaseModel):
    """Structured result returned by UVUnwrapper."""
    success: bool = Field(..., description="True if UV unwrapping and verification completed successfully")
    mesh_name: str = Field("Mesh", description="Identifier of the unwrapped mesh")
    metrics: Optional[UVMetrics] = Field(None, description="UV telemetry metrics")
    validation: UVValidationReport = Field(..., description="UV validation report")
    errors: List[str] = Field(default_factory=list, description="Processing errors")
    warnings: List[str] = Field(default_factory=list, description="Processing warnings")

    # trimesh.Trimesh is an arbitrary non-pydantic type, allow arbitrary types
    model_config = {"arbitrary_types_allowed": True}


class UVUnwrapper:
    """
    Automatic UV parameterization and atlas packing service.
    Converts 3D polygonal surface meshes into normalized 2D UV texture atlases.
    Preserves spatial geometry while managing vertex duplication along UV seam boundaries.
    """

    @classmethod
    def unwrap(
        cls,
        mesh: Union[trimesh.Trimesh, str, Path, bytes, io.BytesIO],
        file_type: Optional[str] = None,
        options: Optional[UVUnwrapOptions] = None,
        mesh_name: str = "UnwrappedAsset",
    ) -> Tuple[Optional[trimesh.Trimesh], UVUnwrapResult]:
        """
        Automatically unwrap a 3D mesh and assign normalized UV coordinates.

        Args:
            mesh: Trimesh instance, file path, bytes, or BytesIO stream.
            file_type: Optional file format extension (e.g. 'obj', 'glb') if passing raw bytes or stream.
            options: UVUnwrapOptions configuring atlas resolution, padding, and chart generation.
            mesh_name: Diagnostic identifier for reporting.

        Returns:
            Tuple of (unwrapped_trimesh, UVUnwrapResult).
        """
        opts = options or UVUnwrapOptions()
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Load and inspect input mesh
        try:
            if not isinstance(mesh, trimesh.Trimesh):
                original_mesh = MeshValidator.load_mesh(mesh, file_type=file_type, process=False)
            else:
                original_mesh = mesh
        except Exception as e:
            errors.append(f"Failed to load mesh for UV unwrapping: {e}")
            validation = UVValidationReport(
                is_valid=False,
                has_uvs=False,
                is_finite=False,
                is_normalized=False,
                has_face_correspondence=False,
                geometry_preserved=False,
                errors=errors,
            )
            return None, UVUnwrapResult(
                success=False,
                mesh_name=mesh_name,
                validation=validation,
                errors=errors,
            )

        orig_v_count = len(original_mesh.vertices)
        orig_f_count = len(original_mesh.faces)

        if orig_v_count < 3 or orig_f_count == 0:
            errors.append(f"Mesh has insufficient geometry for UV unwrapping ({orig_v_count} vertices, {orig_f_count} faces).")
            validation = UVValidationReport(
                is_valid=False,
                has_uvs=False,
                is_finite=False,
                is_normalized=False,
                has_face_correspondence=False,
                geometry_preserved=False,
                errors=errors,
            )
            return None, UVUnwrapResult(
                success=False,
                mesh_name=mesh_name,
                validation=validation,
                errors=errors,
            )

        # 2. Configure xatlas ChartOptions and PackOptions
        c_opts = xatlas.ChartOptions()
        c_opts.normal_seam_weight = opts.normal_seam_weight
        c_opts.texture_seam_weight = opts.texture_seam_weight

        p_opts = xatlas.PackOptions()
        p_opts.resolution = opts.resolution
        p_opts.padding = opts.padding
        p_opts.bilinear = opts.bilinear
        p_opts.blockAlign = opts.block_align
        p_opts.rotate_charts = opts.rotate_charts
        p_opts.rotate_charts_to_axis = opts.rotate_charts_to_axis
        p_opts.bruteForce = opts.brute_force
        if opts.max_chart_size > 0:
            p_opts.max_chart_size = opts.max_chart_size

        # 3. Execute xatlas Atlas computation
        try:
            # Prepare contiguous float32 vertex and uint32 face arrays
            vertices_f32 = np.ascontiguousarray(original_mesh.vertices, dtype=np.float32)
            faces_u32 = np.ascontiguousarray(original_mesh.faces, dtype=np.uint32)

            atlas = xatlas.Atlas()
            atlas.add_mesh(vertices_f32, faces_u32)
            atlas.generate(chart_options=c_opts, pack_options=p_opts)

            if len(atlas) == 0:
                raise RuntimeError("xatlas generated 0 unwrapped sub-meshes.")

            vmap, new_faces, uvs_raw = atlas[0]
            chart_count = int(atlas.chart_count)
            atlas_w = int(atlas.width)
            atlas_h = int(atlas.height)

        except Exception as e:
            errors.append(f"xatlas UV parameterization failed: {e}")
            validation = UVValidationReport(
                is_valid=False,
                has_uvs=False,
                is_finite=False,
                is_normalized=False,
                has_face_correspondence=False,
                geometry_preserved=False,
                errors=errors,
            )
            return None, UVUnwrapResult(
                success=False,
                mesh_name=mesh_name,
                validation=validation,
                errors=errors,
            )

        # 4. Construct unwrapped geometry with seam vertex duplication
        # vmap maps each unwrapped vertex back to the original vertex index
        new_vertices = original_mesh.vertices[vmap]
        new_faces_i64 = np.asarray(new_faces, dtype=np.int64)

        # Normalize UV coordinates to [0, 1] float32
        uvs_norm = np.asarray(uvs_raw, dtype=np.float32)
        # Ensure UV values are cleanly clamped to [0.0, 1.0] to guard against epsilon rounding
        uvs_norm = np.clip(uvs_norm, 0.0, 1.0)

        unwrapped_v_count = len(new_vertices)
        seam_duplications = unwrapped_v_count - orig_v_count

        # Compute vertex normals for the new vertex buffer
        # If original mesh had explicit normals, map them via vmap; otherwise compute
        if original_mesh.vertex_normals is not None and len(original_mesh.vertex_normals) == orig_v_count:
            new_normals = original_mesh.vertex_normals[vmap]
        else:
            new_normals = None

        # Build unwrapped Trimesh
        unwrapped_mesh = trimesh.Trimesh(
            vertices=new_vertices,
            faces=new_faces_i64,
            vertex_normals=new_normals,
            process=False,
        )

        # Attach TextureVisuals containing normalized UVs
        unwrapped_mesh.visual = trimesh.visual.TextureVisuals(uv=uvs_norm)

        # 5. Execute Comprehensive UV Validation
        validation = cls.validate_uvs(unwrapped_mesh=unwrapped_mesh, original_mesh=original_mesh)

        # 6. Assemble Telemetry Metrics
        uv_min = [float(np.min(uvs_norm[:, 0])), float(np.min(uvs_norm[:, 1]))]
        uv_max = [float(np.max(uvs_norm[:, 0])), float(np.max(uvs_norm[:, 1]))]
        aspect_ratio = round(atlas_w / max(atlas_h, 1), 3)

        metrics = UVMetrics(
            uv_count=len(uvs_norm),
            chart_count=chart_count,
            atlas_width=atlas_w,
            atlas_height=atlas_h,
            uv_min=uv_min,
            uv_max=uv_max,
            original_vertex_count=orig_v_count,
            unwrapped_vertex_count=unwrapped_v_count,
            seam_vertex_duplications=seam_duplications,
            aspect_ratio=aspect_ratio,
        )

        if seam_duplications > 0:
            warnings.append(
                f"Generated {seam_duplications} duplicate vertex coordinate(s) along UV seam boundaries."
            )

        success = validation.is_valid and len(errors) == 0

        result = UVUnwrapResult(
            success=success,
            mesh_name=mesh_name,
            metrics=metrics,
            validation=validation,
            errors=errors + validation.errors,
            warnings=warnings + validation.warnings,
        )

        return unwrapped_mesh, result

    @classmethod
    def validate_uvs(
        cls,
        unwrapped_mesh: trimesh.Trimesh,
        original_mesh: Optional[trimesh.Trimesh] = None,
    ) -> UVValidationReport:
        """
        Inspects UV coordinates on a mesh for mathematical finiteness, boundary containment,
        face correspondence, and geometry conservation.

        Args:
            unwrapped_mesh: The UV-mapped mesh to validate.
            original_mesh: Optional pre-unwrap mesh to check against for surface area / bounds preservation.

        Returns:
            UVValidationReport.
        """
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Check UV presence on Trimesh
        has_uvs = (
            hasattr(unwrapped_mesh, "visual")
            and hasattr(unwrapped_mesh.visual, "uv")
            and unwrapped_mesh.visual.uv is not None
            and len(unwrapped_mesh.visual.uv) > 0
        )

        if not has_uvs:
            errors.append("Mesh does not contain UV texture coordinates.")
            return UVValidationReport(
                is_valid=False,
                has_uvs=False,
                is_finite=False,
                is_normalized=False,
                has_face_correspondence=False,
                geometry_preserved=False,
                errors=errors,
            )

        uvs = unwrapped_mesh.visual.uv
        num_uvs = len(uvs)
        num_verts = len(unwrapped_mesh.vertices)

        # 2. Dimension check (must be N x 2)
        if uvs.ndim != 2 or uvs.shape[1] != 2:
            errors.append(f"UV array must have shape (N, 2), got {uvs.shape}.")

        # 3. Finite value check (NaN / Inf)
        is_finite = bool(np.all(np.isfinite(uvs)))
        if not is_finite:
            errors.append("UV coordinates contain non-finite values (NaN or Inf).")

        # 4. Normalized range check [0, 1]
        u_min, v_min = float(np.min(uvs[:, 0])), float(np.min(uvs[:, 1]))
        u_max, v_max = float(np.max(uvs[:, 0])), float(np.max(uvs[:, 1]))

        # Allow small epsilon for floating-point tolerance (1e-5)
        is_normalized = (u_min >= -1e-5 and v_min >= -1e-5 and u_max <= 1.0 + 1e-5 and v_max <= 1.0 + 1e-5)
        if not is_normalized:
            errors.append(f"UV coordinates out of normalized [0, 1] range: U=[{u_min:.4f}, {u_max:.4f}], V=[{v_min:.4f}, {v_max:.4f}].")

        # 5. Face-to-UV correspondence
        # In a standard textured Trimesh, UV count must equal vertex count
        has_correspondence = (num_uvs == num_verts)
        if not has_correspondence:
            errors.append(
                f"UV count ({num_uvs}) does not match vertex count ({num_verts}). "
                f"Every vertex in the vertex buffer must possess exactly one UV coordinate."
            )

        # 6. Geometry preservation check (if original mesh provided)
        geometry_preserved = True
        area_delta_pct = 0.0

        if original_mesh is not None:
            try:
                orig_area = float(original_mesh.area)
                new_area = float(unwrapped_mesh.area)
                if orig_area > 1e-9:
                    area_delta_pct = abs(new_area - orig_area) / orig_area * 100.0
                    # Allow 0.05% tolerance for floating point summation order differences
                    if area_delta_pct > 0.05:
                        geometry_preserved = False
                        errors.append(
                            f"Geometry area altered during unwrapping: original={orig_area:.5f}, "
                            f"unwrapped={new_area:.5f} (delta={area_delta_pct:.3f}%)."
                        )

                # Bounding box extents check
                orig_extents = np.asarray(original_mesh.extents, dtype=np.float64)
                new_extents = np.asarray(unwrapped_mesh.extents, dtype=np.float64)
                if not np.allclose(orig_extents, new_extents, atol=1e-4):
                    geometry_preserved = False
                    errors.append(
                        f"Mesh bounding extents altered during unwrapping: "
                        f"original={orig_extents.tolist()}, unwrapped={new_extents.tolist()}."
                    )
            except Exception as e:
                warnings.append(f"Could not compute comparative geometry preservation metrics: {e}")

        is_valid = (len(errors) == 0 and has_uvs and is_finite and is_normalized and has_correspondence and geometry_preserved)

        return UVValidationReport(
            is_valid=is_valid,
            has_uvs=has_uvs,
            is_finite=is_finite,
            is_normalized=is_normalized,
            has_face_correspondence=has_correspondence,
            geometry_preserved=geometry_preserved,
            area_delta_percent=round(area_delta_pct, 4),
            errors=errors,
            warnings=warnings,
        )

    @classmethod
    def generate_checkerboard_texture(
        cls,
        resolution: int = 512,
        grid_count: int = 16,
        color1: Tuple[int, int, int] = (235, 238, 245),
        color2: Tuple[int, int, int] = (60, 100, 150),
        add_grid_lines: bool = True,
    ) -> Image.Image:
        """
        Generates a standard calibration UV checkerboard texture pattern for visual inspection.

        Args:
            resolution: Square image size in pixels.
            grid_count: Number of checkerboard cells along each dimension.
            color1: RGB color of light squares.
            color2: RGB color of dark squares.
            add_grid_lines: Whether to draw thin contrasting grid lines around cells.

        Returns:
            PIL Image in RGB format.
        """
        img = Image.new("RGB", (resolution, resolution), color=color1)
        draw = ImageDraw.Draw(img)
        tile_size = resolution / grid_count

        for i in range(grid_count):
            for j in range(grid_count):
                if (i + j) % 2 == 1:
                    x0 = int(i * tile_size)
                    y0 = int(j * tile_size)
                    x1 = int((i + 1) * tile_size)
                    y1 = int((j + 1) * tile_size)
                    draw.rectangle([x0, y0, x1, y1], fill=color2)

        if add_grid_lines:
            for k in range(grid_count + 1):
                pos = int(k * tile_size)
                draw.line([(pos, 0), (pos, resolution)], fill=(20, 30, 45), width=1)
                draw.line([(0, pos), (resolution, pos)], fill=(20, 30, 45), width=1)

        return img
