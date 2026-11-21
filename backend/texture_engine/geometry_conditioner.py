"""
PolyGen Geometry Conditioning Generator (Milestone 7B.1)
Converts UV-parameterized 3D geometry into high-fidelity image representations:
1. UV Depth / Height Map: Continuous scalar surface relief interpolated across UV triangles.
2. UV Normal Map: Object-space unit surface normals encoded into RGB color space.
3. UV Chart Mask: Binary atlas segmentation distinguishing valid surface texels from empty regions.
4. UV Wireframe Map: Visual representation of triangle edges and UV chart boundary seams.

Suitable for geometry-guided generative AI (e.g. ControlNet conditioning).
"""

from __future__ import annotations

from collections import Counter
from enum import Enum
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field
import trimesh


class DepthNormalizationMode(str, Enum):
    """Modes governing scalar depth/height normalization across 3D geometry."""
    RADIAL_DISTANCE = "radial_distance"  # Euclidean distance from mesh centroid: ||v - c||_2
    BOUNDING_BOX_Z = "bounding_box_z"    # Elevation along Z-axis normalized across bounding box
    BOUNDING_BOX_DIAG = "bounding_box_diag"  # Distance from min bounding corner normalized by diagonal
    PLANAR_Y = "planar_y"                # Elevation along Y-axis normalized across bounding box


class OverlapResolution(str, Enum):
    """Deterministic policy for resolving overlapping triangles in UV space."""
    MAX_DEPTH = "max_depth"  # Triangle with larger depth value takes precedence
    MIN_DEPTH = "min_depth"  # Triangle with smaller depth value takes precedence
    FIRST = "first"          # First rasterized triangle wins
    LAST = "last"            # Last rasterized triangle wins


class GeometryConditionerConfig(BaseModel):
    """Configuration governing geometry conditioning map generation."""
    resolution: int = Field(512, ge=64, le=4096, description="Output image square resolution in pixels")
    depth_mode: Union[DepthNormalizationMode, str] = Field(
        DepthNormalizationMode.RADIAL_DISTANCE, description="Method used to calculate geometric depth/height"
    )
    overlap_resolution: Union[OverlapResolution, str] = Field(
        OverlapResolution.MAX_DEPTH, description="Policy for handling overlapping UV charts"
    )
    wireframe_thickness: int = Field(1, ge=1, le=10, description="Pixel width of internal triangle wireframe edges")
    chart_boundary_thickness: int = Field(2, ge=1, le=10, description="Pixel width of UV chart boundary seam lines")
    depth_background_value: int = Field(0, ge=0, le=255, description="Grayscale value for empty atlas space in depth map")
    normal_background_color: Tuple[int, int, int] = Field(
        (0, 0, 0), description="RGB color for empty atlas space in normal map"
    )
    wireframe_color: Tuple[int, int, int] = Field(
        (160, 160, 160), description="RGB line color for internal triangle edges"
    )
    chart_boundary_color: Tuple[int, int, int] = Field(
        (255, 255, 255), description="RGB line color for UV chart boundaries"
    )
    wireframe_background_color: Tuple[int, int, int] = Field(
        (0, 0, 0), description="RGB background color for wireframe map"
    )
    v_flip: bool = Field(
        True,
        description="Flip vertical coordinate so V=1 maps to top of image (glTF / standard image space)"
    )
    auto_unwrap_if_missing: bool = Field(
        False, description="Automatically unwrap mesh using xatlas if input mesh lacks UV coordinates"
    )


class GeometryConditioningResult(BaseModel):
    """Structured container returning generated conditioning maps and coverage telemetry."""
    success: bool = Field(..., description="True if conditioning maps were synthesized without fatal error")
    depth_map: Optional[Any] = Field(None, description="Normalized geometric depth/height map (PIL.Image 'L')")
    normal_map: Optional[Any] = Field(None, description="Object-space normal map (PIL.Image 'RGB')")
    chart_mask: Optional[Any] = Field(None, description="Binary UV chart occupancy mask (PIL.Image 'L')")
    wireframe_map: Optional[Any] = Field(None, description="UV wireframe and chart boundary map (PIL.Image 'RGB')")
    resolution: Tuple[int, int] = Field((512, 512), description="Dimensions of the generated maps [width, height]")
    valid_pixel_percentage: float = Field(
        0.0, description="Percentage of atlas area covered by valid UV charts (0.0 to 100.0%)"
    )
    face_count_processed: int = Field(0, description="Number of mesh faces processed into the UV atlas")
    chart_count: int = Field(0, description="Number of detected disconnected UV charts")
    depth_mode_used: str = Field("", description="Depth normalization mode applied")
    normal_coordinate_frame: str = Field(
        "Object Space (X=Right, Y=Up, Z=Forward, RGB mapped from [-1, 1] to [0, 255])",
        description="Coordinate space and channel encoding of the normal map"
    )
    execution_time_seconds: float = Field(0.0, description="Total execution time for conditioning generation")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings or advisories")
    errors: List[str] = Field(default_factory=list, description="Fatal errors preventing generation")

    model_config = {"arbitrary_types_allowed": True}


class GeometryConditioner:
    """
    Standalone 3D Mesh Geometry Conditioning Engine.
    Rasterizes UV-parameterized polygonal meshes into 2D feature maps for ControlNet.

    Documentation of Coordinate Frames & Values:
    - Depth Map:
      Scalar values represent normalized 3D geometric distance or relief across the mesh.
      Unlike camera-space Z-buffer depth (which measures distance from an optical lens in view space),
      UV-space depth represents intrinsic 3D spatial properties (e.g. radial distance ||v - c|| from the
      volumetric centroid, or axial elevation along Z) mapped directly onto the flattened 2D UV parameterization.
      Values are linearly normalized to [0.0, 1.0] and quantized to 8-bit [0, 255] grayscale.
      Empty regions outside any UV chart are filled with depth_background_value (default 0).
    - Normal Map:
      Normals are represented in OBJECT SPACE (model coordinate frame).
      Vertex normals are interpolated across each UV triangle using 2D barycentric weights and re-normalized
      to unit length (||n||_2 = 1.0).
      Channels are mapped linearly: R = (n_x + 1)/2 * 255, G = (n_y + 1)/2 * 255, B = (n_z + 1)/2 * 255.
      Empty regions outside UV charts are filled with normal_background_color (default [0, 0, 0]),
      distinguishable from any valid unit normal since no unit vector can have norm sqrt(3) at (0,0,0).
    - Chart Mask:
      Binary 8-bit mask ('L') where valid surface texels = 255 and empty atlas texels = 0.
    - Wireframe Map:
      RGB visualization of mesh edges in UV space. Internal shared edges are rendered with wireframe_color,
      while outer boundary edges of UV charts are highlighted with chart_boundary_color.
    """

    @classmethod
    def generate(
        cls,
        mesh: trimesh.Trimesh,
        config: Optional[GeometryConditionerConfig] = None,
    ) -> GeometryConditioningResult:
        """
        Synthesizes UV depth, normal, mask, and wireframe maps for an input 3D mesh.

        Args:
            mesh: trimesh.Trimesh instance with visual.uv coordinates.
            config: Optional configuration model.

        Returns:
            GeometryConditioningResult with PIL images and quantitative telemetry.
        """
        start_time = time.perf_counter()
        cfg = config or GeometryConditionerConfig()
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Input Mesh Validation
        if not isinstance(mesh, trimesh.Trimesh):
            errors.append(f"Expected a trimesh.Trimesh instance, got: {type(mesh).__name__}.")
            return GeometryConditioningResult(
                success=False,
                resolution=(cfg.resolution, cfg.resolution),
                errors=errors,
            )

        if len(mesh.vertices) < 3 or len(mesh.faces) < 1:
            errors.append(
                f"Degenerate input geometry: Mesh contains {len(mesh.vertices)} vertices and {len(mesh.faces)} faces."
            )
            return GeometryConditioningResult(
                success=False,
                resolution=(cfg.resolution, cfg.resolution),
                errors=errors,
            )

        # 2. UV Coordinates Extraction & Optional Auto-Unwrap
        target_mesh = mesh
        uvs: Optional[np.ndarray] = None

        if hasattr(target_mesh, "visual") and hasattr(target_mesh.visual, "uv") and target_mesh.visual.uv is not None:
            raw_uv = np.asarray(target_mesh.visual.uv)
            if raw_uv.ndim == 2 and raw_uv.shape[0] == len(target_mesh.vertices) and raw_uv.shape[1] == 2:
                uvs = raw_uv

        if uvs is None:
            if cfg.auto_unwrap_if_missing:
                try:
                    from mesh_processing.uv_unwrapper import UVUnwrapper, UVUnwrapOptions
                    unwrapped, unwrap_res = UVUnwrapper.unwrap(
                        mesh,
                        options=UVUnwrapOptions(resolution=cfg.resolution),
                        mesh_name="ConditioningMesh",
                    )
                    if unwrap_res.success and unwrapped is not None:
                        target_mesh = unwrapped
                        uvs = np.asarray(target_mesh.visual.uv)
                        warnings.append("Input mesh lacked UVs; automatically unwrapped using xatlas.")
                    else:
                        errors.append(f"Auto UV unwrapping failed: {'; '.join(unwrap_res.errors)}")
                        return GeometryConditioningResult(
                            success=False,
                            resolution=(cfg.resolution, cfg.resolution),
                            errors=errors,
                        )
                except Exception as e:
                    errors.append(f"Exception during auto UV unwrapping: {e}")
                    return GeometryConditioningResult(
                        success=False,
                        resolution=(cfg.resolution, cfg.resolution),
                        errors=errors,
                    )
            else:
                errors.append(
                    "Input mesh lacks UV texture coordinates. Set 'auto_unwrap_if_missing=True' "
                    "or unwrap mesh using UVUnwrapper prior to conditioning."
                )
                return GeometryConditioningResult(
                    success=False,
                    resolution=(cfg.resolution, cfg.resolution),
                    errors=errors,
                )

        # 3. Check and Clean UV Bounds
        uv_min = np.min(uvs, axis=0)
        uv_max = np.max(uvs, axis=0)
        if np.any(uv_min < -1e-4) or np.any(uv_max > 1.0001):
            warnings.append(
                f"UV coordinates fall outside standard [0, 1] atlas boundaries "
                f"(min={uv_min.tolist()}, max={uv_max.tolist()}). Values were clamped to [0, 1]."
            )
        uvs_clamped = np.clip(uvs, 0.0, 1.0)

        # 4. Compute 3D Vertex Normals
        try:
            vertex_normals = np.asarray(target_mesh.vertex_normals, dtype=np.float32)
            if vertex_normals.shape != (len(target_mesh.vertices), 3):
                target_mesh.fix_normals()
                vertex_normals = np.asarray(target_mesh.vertex_normals, dtype=np.float32)
        except Exception:
            vertex_normals = np.zeros((len(target_mesh.vertices), 3), dtype=np.float32)
            vertex_normals[:, 2] = 1.0  # Default +Z normal fallback
            warnings.append("Unable to compute vertex normals; defaulted to forward +Z unit vectors.")

        # Ensure unit length
        norms = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
        norms[norms < 1e-9] = 1.0
        vertex_normals = vertex_normals / norms

        # 5. Compute Normalized Scalar Geometric Depths / Heights
        vertices_3d = np.asarray(target_mesh.vertices, dtype=np.float32)
        depth_mode = (
            cfg.depth_mode.value
            if isinstance(cfg.depth_mode, DepthNormalizationMode)
            else str(cfg.depth_mode).lower()
        )

        if depth_mode == DepthNormalizationMode.BOUNDING_BOX_Z.value:
            z_vals = vertices_3d[:, 2]
            z_min, z_max = float(z_vals.min()), float(z_vals.max())
            if (z_max - z_min) > 1e-6:
                vertex_depths = (z_vals - z_min) / (z_max - z_min)
            else:
                vertex_depths = np.ones_like(z_vals)
            depth_desc = "Bounding Box Z-Elevation [0.0=min Z, 1.0=max Z]"

        elif depth_mode == DepthNormalizationMode.PLANAR_Y.value:
            y_vals = vertices_3d[:, 1]
            y_min, y_max = float(y_vals.min()), float(y_vals.max())
            if (y_max - y_min) > 1e-6:
                vertex_depths = (y_vals - y_min) / (y_max - y_min)
            else:
                vertex_depths = np.ones_like(y_vals)
            depth_desc = "Bounding Box Y-Elevation [0.0=min Y, 1.0=max Y]"

        elif depth_mode == DepthNormalizationMode.BOUNDING_BOX_DIAG.value:
            b_min = np.min(vertices_3d, axis=0)
            b_max = np.max(vertices_3d, axis=0)
            diag = np.linalg.norm(b_max - b_min)
            if diag > 1e-6:
                vertex_depths = np.linalg.norm(vertices_3d - b_min, axis=1) / diag
            else:
                vertex_depths = np.zeros_like(vertices_3d[:, 0])
            depth_desc = "Diagonal Distance from Bounding Box Min Corner [0.0, 1.0]"

        else:
            # Default: RADIAL_DISTANCE from mesh volumetric centroid
            centroid = np.mean(vertices_3d, axis=0)
            dists = np.linalg.norm(vertices_3d - centroid, axis=1)
            d_min, d_max = float(dists.min()), float(dists.max())
            if (d_max - d_min) > 1e-6:
                vertex_depths = (dists - d_min) / (d_max - d_min)
            elif d_max > 1e-6:
                vertex_depths = np.ones_like(dists)
            else:
                vertex_depths = np.zeros_like(dists)
            depth_desc = "Radial Euclidean Distance from Centroid [0.0=closest, 1.0=furthest]"

        vertex_depths = np.clip(vertex_depths, 0.0, 1.0).astype(np.float32)

        # 6. Map UVs to Raster Pixel Coordinates
        res = cfg.resolution
        W, H = res, res
        pix_coords = np.empty_like(uvs_clamped, dtype=np.float32)
        pix_coords[:, 0] = uvs_clamped[:, 0] * (W - 1)
        if cfg.v_flip:
            pix_coords[:, 1] = (1.0 - uvs_clamped[:, 1]) * (H - 1)
        else:
            pix_coords[:, 1] = uvs_clamped[:, 1] * (H - 1)

        faces = np.asarray(target_mesh.faces, dtype=np.int64)
        num_faces = len(faces)

        # Buffers for rasterization
        depth_buffer = np.full((H, W), np.nan, dtype=np.float32)
        normal_buffer = np.zeros((H, W, 3), dtype=np.float32)
        mask_buffer = np.zeros((H, W), dtype=bool)

        # Face coordinate projections
        tri_pix = pix_coords[faces]           # (num_faces, 3, 2)
        tri_depths = vertex_depths[faces]     # (num_faces, 3)
        tri_normals = vertex_normals[faces]   # (num_faces, 3, 3)

        overlap_rule = (
            cfg.overlap_resolution.value
            if isinstance(cfg.overlap_resolution, OverlapResolution)
            else str(cfg.overlap_resolution).lower()
        )
        degenerate_count = 0

        # 7. Vectorized Bounding-Box Triangle Rasterization
        for i in range(num_faces):
            f_idx = faces[i]
            # Check normalized UV determinant to detect degenerate triangles
            u0, v0 = uvs_clamped[f_idx[0]]
            u1, v1 = uvs_clamped[f_idx[1]]
            u2, v2 = uvs_clamped[f_idx[2]]
            det_uv = (u1 - u0) * (v2 - v0) - (v1 - v0) * (u2 - u0)

            p = tri_pix[i]
            x0, y0 = p[0]
            x1, y1 = p[1]
            x2, y2 = p[2]

            # 2D cross product for signed triangle area in UV pixel space
            det = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
            if abs(det_uv) < 1e-6 or abs(det) < 0.05:
                degenerate_count += 1
                continue

            # Integer pixel bounding box clamped to image canvas
            xmin = max(0, int(np.floor(min(x0, x1, x2))))
            xmax = min(W - 1, int(np.ceil(max(x0, x1, x2))))
            ymin = max(0, int(np.floor(min(y0, y1, y2))))
            ymax = min(H - 1, int(np.ceil(max(y0, y1, y2))))

            if xmin > xmax or ymin > ymax:
                continue

            # Pixel grid inside bounding box
            xs, ys = np.meshgrid(
                np.arange(xmin, xmax + 1, dtype=np.float32),
                np.arange(ymin, ymax + 1, dtype=np.float32),
            )

            # Edge functions for barycentric weights
            w0 = (x1 - xs) * (y2 - ys) - (y1 - ys) * (x2 - xs)
            w1 = (x2 - xs) * (y0 - ys) - (y2 - ys) * (x0 - xs)
            w2 = (x0 - xs) * (y1 - ys) - (y0 - ys) * (x1 - xs)

            # Ensure consistent clockwise/counter-clockwise orientation
            if det < 0:
                w0, w1, w2 = -w0, -w1, -w2
                inv_det = -1.0 / det
            else:
                inv_det = 1.0 / det

            inside = (w0 >= 0.0) & (w1 >= 0.0) & (w2 >= 0.0)
            if not np.any(inside):
                continue

            # Normalized barycentric coordinates
            l0 = w0[inside] * inv_det
            l1 = w1[inside] * inv_det
            l2 = w2[inside] * inv_det

            # Interpolate depth
            d0, d1, d2 = tri_depths[i]
            interp_d = l0 * d0 + l1 * d1 + l2 * d2

            # Interpolate normal
            n0, n1, n2 = tri_normals[i]
            # (K, 3)
            interp_n = (
                l0[:, None] * n0[None, :] +
                l1[:, None] * n1[None, :] +
                l2[:, None] * n2[None, :]
            )
            # Re-normalize interpolated normals
            n_lens = np.linalg.norm(interp_n, axis=1, keepdims=True)
            n_lens[n_lens < 1e-9] = 1.0
            interp_n = interp_n / n_lens

            pix_y = ys[inside].astype(np.int64)
            pix_x = xs[inside].astype(np.int64)

            curr_depth = depth_buffer[pix_y, pix_x]
            is_unvisited = np.isnan(curr_depth)

            # Overlap resolution policy
            if overlap_rule == OverlapResolution.MIN_DEPTH.value:
                update_mask = is_unvisited | (interp_d < curr_depth)
            elif overlap_rule == OverlapResolution.FIRST.value:
                update_mask = is_unvisited
            elif overlap_rule == OverlapResolution.LAST.value:
                update_mask = np.ones_like(interp_d, dtype=bool)
            else:
                # Default: MAX_DEPTH
                update_mask = is_unvisited | (interp_d > curr_depth)

            y_up = pix_y[update_mask]
            x_up = pix_x[update_mask]

            depth_buffer[y_up, x_up] = interp_d[update_mask]
            normal_buffer[y_up, x_up] = interp_n[update_mask]
            mask_buffer[y_up, x_up] = True

        if degenerate_count > 0:
            warnings.append(
                f"Skipped {degenerate_count} degenerate or zero-area UV triangles out of {num_faces} total faces."
            )

        # 8. Encode Output Images

        # (a) UV Depth Map (Grayscale 'L')
        depth_bg_norm = cfg.depth_background_value / 255.0
        depth_final = np.where(mask_buffer, depth_buffer, depth_bg_norm)
        depth_u8 = np.clip(np.round(depth_final * 255.0), 0, 255).astype(np.uint8)
        depth_img = Image.fromarray(depth_u8, mode="L")

        # (b) UV Normal Map (RGB)
        # Normal components [-1.0, 1.0] -> [0, 255]
        # (n + 1) / 2
        normal_rgb = np.clip(np.round((normal_buffer + 1.0) * 0.5 * 255.0), 0, 255).astype(np.uint8)
        # Apply background color to empty pixels
        bg_rgb = np.array(cfg.normal_background_color, dtype=np.uint8)
        normal_rgb[~mask_buffer] = bg_rgb
        normal_img = Image.fromarray(normal_rgb, mode="RGB")

        # (c) UV Chart Occupancy Mask ('L')
        mask_u8 = (mask_buffer * 255).astype(np.uint8)
        mask_img = Image.fromarray(mask_u8, mode="L")

        # (d) UV Wireframe & Boundary Map
        wireframe_img = cls._render_wireframe_map(
            pix_coords=pix_coords,
            faces=faces,
            resolution=res,
            config=cfg,
        )

        # 9. Compute Telemetry
        valid_pixel_count = int(np.count_nonzero(mask_buffer))
        valid_pixel_pct = round((valid_pixel_count / float(W * H)) * 100.0, 2)

        # Detect disconnected UV charts via connected component analysis on UV face edges
        chart_count = cls._count_uv_charts(faces)

        exec_time = round(time.perf_counter() - start_time, 4)

        return GeometryConditioningResult(
            success=True,
            depth_map=depth_img,
            normal_map=normal_img,
            chart_mask=mask_img,
            wireframe_map=wireframe_img,
            resolution=(W, H),
            valid_pixel_percentage=valid_pixel_pct,
            face_count_processed=num_faces,
            chart_count=chart_count,
            depth_mode_used=depth_desc,
            execution_time_seconds=exec_time,
            warnings=warnings,
            errors=errors,
        )

    @classmethod
    def _render_wireframe_map(
        cls,
        pix_coords: np.ndarray,
        faces: np.ndarray,
        resolution: int,
        config: GeometryConditionerConfig,
    ) -> Image.Image:
        """
        Renders triangle edges and chart boundaries into a clean PIL image.
        Distinguishes internal triangle edges from outer UV chart boundary edges.
        """
        img = Image.new("RGB", (resolution, resolution), color=config.wireframe_background_color)
        draw = ImageDraw.Draw(img)

        # Count edge occurrences in UV face connectivity
        edge_counts: Counter[Tuple[int, int]] = Counter()
        for f in faces:
            i0, i1, i2 = int(f[0]), int(f[1]), int(f[2])
            edge_counts[tuple(sorted((i0, i1)))] += 1
            edge_counts[tuple(sorted((i1, i2)))] += 1
            edge_counts[tuple(sorted((i2, i0)))] += 1

        interior_edges = [edge for edge, count in edge_counts.items() if count > 1]
        boundary_edges = [edge for edge, count in edge_counts.items() if count == 1]

        # 1. Draw interior triangle edges first
        for i0, i1 in interior_edges:
            x0, y0 = float(pix_coords[i0, 0]), float(pix_coords[i0, 1])
            x1, y1 = float(pix_coords[i1, 0]), float(pix_coords[i1, 1])
            draw.line([(x0, y0), (x1, y1)], fill=config.wireframe_color, width=config.wireframe_thickness)

        # 2. Draw outer chart boundaries on top with chart_boundary_thickness
        for i0, i1 in boundary_edges:
            x0, y0 = float(pix_coords[i0, 0]), float(pix_coords[i0, 1])
            x1, y1 = float(pix_coords[i1, 0]), float(pix_coords[i1, 1])
            draw.line([(x0, y0), (x1, y1)], fill=config.chart_boundary_color, width=config.chart_boundary_thickness)

        return img

    @classmethod
    def _count_uv_charts(cls, faces: np.ndarray) -> int:
        """
        Computes the number of connected components (islands/charts) in UV space
        using disjoint-set union (DSU) across shared face vertices.
        """
        if len(faces) == 0:
            return 0

        max_v = int(np.max(faces))
        parent = list(range(max_v + 1))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(i: int, j: int):
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                parent[root_i] = root_j

        for f in faces:
            union(int(f[0]), int(f[1]))
            union(int(f[1]), int(f[2]))

        used_vertices = set(faces.flatten())
        roots = {find(v) for v in used_vertices}
        return len(roots)
