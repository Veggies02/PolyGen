"""
PolyGen Texture Mapping & PBR Material Service
Applies 2D texture images (PNG, JPEG, checkerboard calibration) to UV-unwrapped
Trimesh geometries and prepares glTF metallic-roughness PBR material definitions.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from pydantic import BaseModel, Field
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


class TextureMappingError(Exception):
    """Raised when texture loading, UV verification, or material mapping fails."""
    pass


class MaterialConfig(BaseModel):
    """PBR Metallic-Roughness material parameters conforming to glTF 2.0 specifications."""
    name: str = Field("PolyGen_PBR_Material", description="Unique identifier for the material")
    base_color_factor: List[float] = Field(
        default=[1.0, 1.0, 1.0, 1.0],
        description="Linear RGBA multiplier for base color [R, G, B, A] in range [0.0, 1.0]"
    )
    metallic_factor: float = Field(
        0.1,
        ge=0.0,
        le=1.0,
        description="Metalness scalar (0.0 = dielectric/non-metal, 1.0 = pure metal)"
    )
    roughness_factor: float = Field(
        0.6,
        ge=0.0,
        le=1.0,
        description="Surface roughness scalar (0.0 = mirror smooth, 1.0 = diffuse rough)"
    )
    double_sided: bool = Field(True, description="Whether faces are rendered from both sides")


class TextureMetrics(BaseModel):
    """Dimensional and memory telemetry for applied texture images."""
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    channels: int = Field(..., description="Number of color channels (e.g. 3 for RGB, 4 for RGBA)")
    format: str = Field(..., description="Image encoding format (e.g. 'PNG', 'JPEG', 'RGB')")
    aspect_ratio: float = Field(..., description="Width-to-height ratio (width / height)")
    memory_size_bytes: int = Field(..., description="Uncompressed bitmap memory footprint in bytes")


class TextureMappingResult(BaseModel):
    """Structured report returned after texture and material application."""
    success: bool = Field(..., description="True if texture mapping succeeded with valid UVs")
    mesh_name: str = Field("Mesh", description="Identifier of the textured mesh")
    has_uvs: bool = Field(..., description="True if UV coordinates were confirmed on the mesh")
    texture_applied: bool = Field(..., description="True if a valid texture image was assigned to the material")
    material_name: str = Field(..., description="Name of the assigned PBR material")
    material_config: MaterialConfig = Field(..., description="Configured PBR material parameters")
    texture_metrics: Optional[TextureMetrics] = Field(None, description="Metadata of the applied texture image")
    errors: List[str] = Field(default_factory=list, description="Fatal processing errors")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")

    model_config = {"arbitrary_types_allowed": True}


class TextureMapper:
    """
    Production-grade texture application and PBR material engine.
    Applies raster texture images to UV-unwrapped 3D meshes, creates glTF 2.0 PBR materials,
    and handles binary GLB export with round-trip verification.
    """

    SUPPORTED_FORMATS = {"PNG", "JPEG", "JPG", "WEBP", "BMP"}

    @classmethod
    def load_texture_image(
        cls,
        source: Union[str, Path, bytes, io.BytesIO, Image.Image],
        target_resolution: Optional[Tuple[int, int]] = None,
    ) -> Image.Image:
        """
        Loads, validates, and normalizes a texture image.

        Args:
            source: File path, byte buffer, BytesIO stream, or PIL Image.
            target_resolution: Optional (width, height) to resize texture.

        Returns:
            Validated PIL Image in RGB or RGBA mode.

        Raises:
            TextureMappingError: If image cannot be read, has 0 dimensions, or invalid format.
        """
        img: Image.Image
        if isinstance(source, Image.Image):
            img = source.copy()
        elif isinstance(source, (str, Path)):
            path = Path(source)
            if not path.exists():
                raise TextureMappingError(f"Texture image file does not exist: {path}")
            try:
                with open(path, "rb") as f:
                    data = f.read()
                img = Image.open(io.BytesIO(data))
                img.load()
            except Exception as e:
                raise TextureMappingError(f"Failed to read image file '{path}': {e}") from e
        elif isinstance(source, bytes):
            if len(source) == 0:
                raise TextureMappingError("Texture byte buffer is empty.")
            try:
                img = Image.open(io.BytesIO(source))
                img.load()
            except Exception as e:
                raise TextureMappingError(f"Failed to decode image from raw bytes: {e}") from e
        elif isinstance(source, io.BytesIO):
            try:
                source.seek(0)
                img = Image.open(source)
                img.load()
            except Exception as e:
                raise TextureMappingError(f"Failed to decode image from BytesIO stream: {e}") from e
        else:
            raise TextureMappingError(f"Unsupported texture source type: {type(source).__name__}")

        # Dimension validation
        w, h = img.size
        if w <= 0 or h <= 0:
            raise TextureMappingError(f"Invalid image dimensions: {w}x{h}.")

        # Format / mode normalization (glTF standard expects RGB or RGBA)
        if img.mode not in ("RGB", "RGBA"):
            try:
                img = img.convert("RGB")
            except Exception as e:
                raise TextureMappingError(f"Failed to convert image mode '{img.mode}' to RGB: {e}")

        # Optional resize
        if target_resolution is not None:
            rw, rh = target_resolution
            if rw > 0 and rh > 0 and (rw, rh) != img.size:
                img = img.resize((rw, rh), Image.Resampling.LANCZOS)

        return img

    @classmethod
    def create_pbr_material(
        cls,
        texture_image: Image.Image,
        config: Optional[MaterialConfig] = None,
    ) -> PBRMaterial:
        """
        Creates a Trimesh PBRMaterial object with baseColorTexture.

        Args:
            texture_image: PIL Image for base color channel.
            config: Material parameters (factors for color, metallic, roughness).

        Returns:
            trimesh.visual.material.PBRMaterial instance.
        """
        cfg = config or MaterialConfig()

        # Convert 0.0-1.0 float factors to 0-255 uint8 if required by Trimesh,
        # but Trimesh PBRMaterial accepts float or uint8. Passing floats:
        return PBRMaterial(
            name=cfg.name,
            baseColorTexture=texture_image,
            baseColorFactor=cfg.base_color_factor,
            metallicFactor=cfg.metallic_factor,
            roughnessFactor=cfg.roughness_factor,
            doubleSided=cfg.double_sided,
        )

    @classmethod
    def apply_texture(
        cls,
        mesh: trimesh.Trimesh,
        texture: Union[str, Path, bytes, io.BytesIO, Image.Image],
        material_config: Optional[MaterialConfig] = None,
        target_resolution: Optional[Tuple[int, int]] = None,
        mesh_name: str = "TexturedMesh",
    ) -> Tuple[trimesh.Trimesh, TextureMappingResult]:
        """
        Applies a texture image to an already UV-unwrapped Trimesh geometry.

        Args:
            mesh: Trimesh geometry containing valid UV coordinates.
            texture: Texture image source.
            material_config: PBR material factors.
            target_resolution: Optional target resize resolution.
            mesh_name: Identifier for reporting.

        Returns:
            Tuple of (textured_mesh, TextureMappingResult).
        """
        cfg = material_config or MaterialConfig()
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Check UV coordinates on mesh
        has_uvs = (
            hasattr(mesh, "visual")
            and hasattr(mesh.visual, "uv")
            and mesh.visual.uv is not None
            and len(mesh.visual.uv) > 0
        )

        if not has_uvs:
            errors.append("Mesh does not contain UV coordinates. UV unwrapping is required before texture application.")
            res = TextureMappingResult(
                success=False,
                mesh_name=mesh_name,
                has_uvs=False,
                texture_applied=False,
                material_name=cfg.name,
                material_config=cfg,
                errors=errors,
                warnings=warnings,
            )
            return mesh, res

        uvs = mesh.visual.uv
        if len(uvs) != len(mesh.vertices):
            errors.append(f"UV count ({len(uvs)}) does not match vertex count ({len(mesh.vertices)}).")
            res = TextureMappingResult(
                success=False,
                mesh_name=mesh_name,
                has_uvs=True,
                texture_applied=False,
                material_name=cfg.name,
                material_config=cfg,
                errors=errors,
                warnings=warnings,
            )
            return mesh, res

        # 2. Load and validate texture image
        try:
            image = cls.load_texture_image(texture, target_resolution=target_resolution)
        except Exception as e:
            errors.append(f"Texture validation failed: {e}")
            res = TextureMappingResult(
                success=False,
                mesh_name=mesh_name,
                has_uvs=True,
                texture_applied=False,
                material_name=cfg.name,
                material_config=cfg,
                errors=errors,
                warnings=warnings,
            )
            return mesh, res

        # 3. Create PBR Material
        pbr_mat = cls.create_pbr_material(texture_image=image, config=cfg)

        # 4. Attach TextureVisuals
        # Copy mesh or assign visual while preserving vertices, faces, normals
        textured_mesh = mesh.copy()
        textured_mesh.visual = TextureVisuals(uv=uvs, material=pbr_mat)

        # Calculate metrics
        w, h = image.size
        channels = len(image.getbands())
        mem_size = w * h * channels
        metrics = TextureMetrics(
            width=w,
            height=h,
            channels=channels,
            format=image.format or "RGB",
            aspect_ratio=round(w / max(h, 1), 3),
            memory_size_bytes=mem_size,
        )

        res = TextureMappingResult(
            success=True,
            mesh_name=mesh_name,
            has_uvs=True,
            texture_applied=True,
            material_name=cfg.name,
            material_config=cfg,
            texture_metrics=metrics,
            errors=errors,
            warnings=warnings,
        )

        return textured_mesh, res

    @classmethod
    def apply_checkerboard(
        cls,
        mesh: trimesh.Trimesh,
        resolution: int = 512,
        grid_count: int = 16,
        color1: Tuple[int, int, int] = (240, 240, 245),
        color2: Tuple[int, int, int] = (70, 110, 160),
        material_config: Optional[MaterialConfig] = None,
        mesh_name: str = "CheckerboardMesh",
    ) -> Tuple[trimesh.Trimesh, TextureMappingResult]:
        """
        Convenience method to generate and apply a standard calibration checkerboard texture.
        """
        from .uv_unwrapper import UVUnwrapper

        checker_img = UVUnwrapper.generate_checkerboard_texture(
            resolution=resolution,
            grid_count=grid_count,
            color1=color1,
            color2=color2,
        )
        return cls.apply_texture(
            mesh=mesh,
            texture=checker_img,
            material_config=material_config,
            mesh_name=mesh_name,
        )

    @classmethod
    def export_textured_glb(cls, mesh: trimesh.Trimesh) -> bytes:
        """
        Exports a textured Trimesh to glTF 2.0 binary container (.glb).
        Embeds vertex positions, normals, TEXCOORD_0 UVs, PBR metallic-roughness material,
        and PNG/JPEG texture buffers.

        Args:
            mesh: Textured Trimesh instance.

        Returns:
            glTF 2.0 binary bytes.

        Raises:
            TextureMappingError: If export fails.
        """
        try:
            glb_bytes = mesh.export(file_type="glb")
            if not isinstance(glb_bytes, bytes) or len(glb_bytes) < 20:
                raise TextureMappingError("Exported GLB data is malformed or empty.")
            return glb_bytes
        except Exception as e:
            raise TextureMappingError(f"Failed to export textured mesh to GLB: {e}") from e

    @classmethod
    def verify_glb_round_trip(cls, glb_bytes: bytes) -> Dict[str, Any]:
        """
        Validates that an exported binary GLB contains all expected components:
        glTF 2.0 header, valid geometry, TEXCOORD_0 coordinates, and embedded texture image.

        Args:
            glb_bytes: Raw bytes of a .glb file.

        Returns:
            Dictionary containing round-trip verification metrics and status flags.
        """
        if not glb_bytes.startswith(b"glTF"):
            return {
                "is_valid_gltf": False,
                "error": "Binary header does not begin with 'glTF' magic bytes.",
            }

        try:
            scene = trimesh.load(trimesh.util.wrap_as_stream(glb_bytes), file_type="glb")
            if isinstance(scene, trimesh.Scene):
                if len(scene.geometry) == 0:
                    return {"is_valid_gltf": False, "error": "Loaded GLB scene has 0 geometry nodes."}
                mesh = list(scene.geometry.values())[0]
            elif isinstance(scene, trimesh.Trimesh):
                mesh = scene
            else:
                return {"is_valid_gltf": False, "error": f"Unexpected object type loaded: {type(scene)}"}

            # Check UVs
            has_uvs = hasattr(mesh, "visual") and hasattr(mesh.visual, "uv") and mesh.visual.uv is not None
            uv_count = len(mesh.visual.uv) if has_uvs else 0
            uv_finite = bool(np.all(np.isfinite(mesh.visual.uv))) if has_uvs else False

            # Check Material & Texture
            has_material = hasattr(mesh.visual, "material") and mesh.visual.material is not None
            mat = mesh.visual.material if has_material else None

            has_texture_image = False
            texture_size = (0, 0)
            if mat is not None:
                if hasattr(mat, "baseColorTexture") and mat.baseColorTexture is not None:
                    has_texture_image = True
                    texture_size = mat.baseColorTexture.size
                elif hasattr(mat, "image") and mat.image is not None:
                    has_texture_image = True
                    texture_size = mat.image.size

            metallic = getattr(mat, "metallicFactor", None) if mat else None
            roughness = getattr(mat, "roughnessFactor", None) if mat else None

            round_trip_success = (
                has_uvs
                and uv_count == len(mesh.vertices)
                and uv_finite
                and has_material
                and has_texture_image
            )

            return {
                "is_valid_gltf": True,
                "round_trip_success": round_trip_success,
                "vertex_count": len(mesh.vertices),
                "face_count": len(mesh.faces),
                "has_uvs": has_uvs,
                "uv_count": uv_count,
                "uv_finite": uv_finite,
                "has_material": has_material,
                "has_texture_image": has_texture_image,
                "texture_size": texture_size,
                "metallic_factor": metallic,
                "roughness_factor": roughness,
                "glb_size_bytes": len(glb_bytes),
            }

        except Exception as e:
            return {
                "is_valid_gltf": False,
                "round_trip_success": False,
                "error": f"Failed to reload and inspect GLB: {e}",
            }
