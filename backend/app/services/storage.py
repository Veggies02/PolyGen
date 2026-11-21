import json
import uuid
import io
import zipfile
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
from ..models.schemas import AssetMetadata
from ..config import settings
from .mesh_generator import ProceduralMeshFactory

class AssetStorageService:
    def __init__(self, base_dir: Path = settings.ASSETS_DIR):
        self.base_dir = base_dir
        self.metadata_file = self.base_dir / "assets_index.json"
        self._ensure_storage()

    def _ensure_storage(self):
        self.base_dir.mkdir(parents=True, exist_ok=True)
        if not self.metadata_file.exists():
            self._save_index([])
            self.seed_sample_assets()
        else:
            # Check if any indexed asset files exist on disk
            index = self._load_index()
            valid_entries = [
                item for item in index
                if isinstance(item, dict) and "id" in item and (self.base_dir / item["id"] / f"{item['id']}.glb").exists()
            ]
            if not valid_entries:
                # Fresh clone with orphan index: reset index and seed fresh curated assets with real geometry
                self._save_index([])
                self.seed_sample_assets()
            elif len(valid_entries) < len(index):
                # Clean up phantom records where files were missing
                self._save_index(valid_entries)

    def _load_index(self) -> List[Dict[str, Any]]:
        try:
            if self.metadata_file.exists():
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    needs_resave = False
                    for item in data:
                        if isinstance(item, dict) and "attributes" in item:
                            attrs = item.get("attributes")
                            if isinstance(attrs, dict) and "aux_files" in attrs:
                                aux = attrs["aux_files"]
                                if isinstance(aux, dict):
                                    for k, v in aux.items():
                                        if isinstance(v, (bytes, bytearray)) or (
                                            isinstance(v, str) and (v.startswith("b'") or len(v) > 200)
                                        ):
                                            aid = item.get("id")
                                            adir = self.base_dir / aid if aid else None
                                            item["attributes"] = self._sanitize_attributes(
                                                attrs, asset_dir=adir, asset_id=aid
                                            )
                                            needs_resave = True
                                            break
                    if needs_resave:
                        self._save_index(data)
                    return data
        except Exception:
            pass
        return []

    @staticmethod
    def _sanitize_attributes(
        attributes: Optional[Dict[str, Any]],
        asset_dir: Optional[Path] = None,
        asset_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sanitizes asset attributes dictionary for serialization into assets_index.json.
        Converts raw binary buffers or binary-string representations in aux_files into clean companion metadata.
        """
        if not attributes or not isinstance(attributes, dict):
            return {}

        clean = dict(attributes)
        aux_files = clean.get("aux_files")
        if isinstance(aux_files, dict):
            clean_aux = {}
            for fname, fcontent in aux_files.items():
                size = 0
                if asset_dir:
                    disk_file = asset_dir / fname
                    if disk_file.exists():
                        try:
                            size = disk_file.stat().st_size
                        except OSError:
                            pass

                if size == 0:
                    if isinstance(fcontent, (bytes, bytearray)):
                        size = len(fcontent)
                    elif isinstance(fcontent, str):
                        if (fcontent.startswith("b'") or fcontent.startswith('b"')) and len(fcontent) > 100:
                            size = max(0, (len(fcontent) - 3) // 4)
                        else:
                            size = len(fcontent.encode("utf-8"))
                    elif isinstance(fcontent, dict) and "size_bytes" in fcontent:
                        clean_aux[fname] = fcontent
                        continue

                clean_aux[fname] = {
                    "filename": fname,
                    "path": f"{asset_id}/{fname}" if asset_id else fname,
                    "size_bytes": size,
                    "format": Path(fname).suffix.lstrip(".").lower() or "bin",
                }
            clean["aux_files"] = clean_aux

        return clean

    def _save_index(self, data: List[Dict[str, Any]]):
        with open(self.metadata_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def list_assets(self, tag: Optional[str] = None, search: Optional[str] = None) -> List[AssetMetadata]:
        raw_list = self._load_index()
        assets = []
        for item in raw_list:
            if isinstance(item.get("created_at"), str):
                item["created_at"] = datetime.fromisoformat(item["created_at"])
            asset = AssetMetadata(**item)
            
            if tag and tag.lower() not in [t.lower() for t in asset.tags]:
                continue
            if search and search.lower() not in asset.title.lower() and search.lower() not in asset.prompt.lower():
                continue
            assets.append(asset)
        
        assets.sort(key=lambda a: a.created_at, reverse=True)
        return assets

    def get_asset(self, asset_id: str) -> Optional[AssetMetadata]:
        raw_list = self._load_index()
        for item in raw_list:
            if item.get("id") == asset_id:
                if isinstance(item.get("created_at"), str):
                    item["created_at"] = datetime.fromisoformat(item["created_at"])
                return AssetMetadata(**item)
        return None

    def delete_asset(self, asset_id: str) -> bool:
        """Deletes an asset from the persistent index and disk storage."""
        raw_list = self._load_index()
        initial_len = len(raw_list)
        filtered = [item for item in raw_list if item.get("id") != asset_id]
        if len(filtered) == initial_len:
            return False

        self._save_index(filtered)

        asset_dir = self.base_dir / asset_id
        if asset_dir.exists() and asset_dir.is_dir():
            shutil.rmtree(asset_dir, ignore_errors=True)

        return True

    def save_asset(
        self,
        title: str,
        prompt: str,
        provider: str,
        style: str,
        glb_bytes: bytes,
        obj_str: str,
        stl_bytes: bytes,
        poly_count: int,
        vertex_count: int,
        tags: List[str] = None,
        attributes: Dict[str, Any] = None,
        negative_prompt: Optional[str] = None,
        is_demo: bool = False
    ) -> AssetMetadata:
        asset_id = str(uuid.uuid4())[:8]
        asset_dir = self.base_dir / asset_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        glb_path = asset_dir / f"{asset_id}.glb"
        obj_path = asset_dir / f"{asset_id}.obj"
        stl_path = asset_dir / f"{asset_id}.stl"

        with open(glb_path, "wb") as f:
            f.write(glb_bytes)
        with open(obj_path, "w", encoding="utf-8") as f:
            f.write(obj_str)
        with open(stl_path, "wb") as f:
            f.write(stl_bytes)

        # Write companion auxiliary files (e.g. material.mtl, material_0.png for OBJ)
        aux_files = (attributes or {}).get("aux_files", {})
        if isinstance(aux_files, dict):
            for fname, fcontent in aux_files.items():
                target_file = asset_dir / fname
                if isinstance(fcontent, (bytes, bytearray)):
                    with open(target_file, "wb") as f:
                        f.write(fcontent)
                elif isinstance(fcontent, str):
                    # Guard against legacy repr(bytes) strings
                    if (fcontent.startswith("b'") or fcontent.startswith('b"')) and len(fcontent) > 100:
                        try:
                            import ast
                            parsed_bytes = ast.literal_eval(fcontent)
                            if isinstance(parsed_bytes, (bytes, bytearray)):
                                with open(target_file, "wb") as f:
                                    f.write(parsed_bytes)
                                continue
                        except Exception:
                            pass
                    with open(target_file, "w", encoding="utf-8") as f:
                        f.write(fcontent)

        file_size = len(glb_bytes)
        formats = {
            "glb": f"/api/assets/{asset_id}/download/glb",
            "obj": f"/api/assets/{asset_id}/download/obj",
            "stl": f"/api/assets/{asset_id}/download/stl",
        }
        if (asset_dir / "material.mtl").exists() or any(asset_dir.glob("*.mtl")):
            formats["mtl"] = f"/api/assets/{asset_id}/download/mtl"
        if (asset_dir / "material_0.png").exists() or any(asset_dir.glob("*.png")):
            formats["png"] = f"/api/assets/{asset_id}/download/png"

        # Sanitize attributes to store clean metadata instead of raw binary buffers
        clean_attributes = self._sanitize_attributes(
            attributes=attributes,
            asset_dir=asset_dir,
            asset_id=asset_id,
        )

        metadata = AssetMetadata(
            id=asset_id,
            title=title,
            prompt=prompt,
            negative_prompt=negative_prompt,
            provider=provider,
            style=style,
            poly_count=poly_count,
            vertex_count=vertex_count,
            file_size_bytes=file_size,
            formats=formats,
            thumbnail_url=None,
            tags=tags or [style, provider],
            created_at=datetime.now(timezone.utc),
            is_demo=is_demo,
            attributes=clean_attributes,
        )

        current_index = self._load_index()
        current_index.insert(0, metadata.model_dump())
        self._save_index(current_index)
        return metadata

    def get_file_path(self, asset_id: str, fmt: str) -> Optional[Path]:
        fmt = fmt.lower()
        if fmt not in ["glb", "obj", "stl", "mtl", "png"]:
            return None
        file_path = self.base_dir / asset_id / f"{asset_id}.{fmt}"
        if file_path.exists():
            return file_path
        asset_folder = self.base_dir / asset_id
        if not asset_folder.exists():
            return None
        # Check standard companion filenames
        if fmt == "mtl":
            alt = asset_folder / "material.mtl"
            if alt.exists():
                return alt
            for p in asset_folder.glob("*.mtl"):
                if p.exists():
                    return p
        if fmt == "png":
            for candidate in ["material_0.png", "PolyGen_Material.png"]:
                alt = asset_folder / candidate
                if alt.exists():
                    return alt
            for p in asset_folder.glob("*.png"):
                if p.exists():
                    return p
        return None

    def create_bundle_zip(self, asset_id: str) -> Optional[bytes]:
        """Creates an in-memory ZIP package containing all 3D formats (.glb, .obj, .stl), companions (.mtl, .png) and metadata."""
        asset = self.get_asset(asset_id)
        if not asset:
            return None

        asset_dir = self.base_dir / asset_id
        if not asset_dir.exists():
            return None

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            formats_included = []
            # 1. Add 3D format files
            for fmt in ["glb", "obj", "stl"]:
                path = asset_dir / f"{asset_id}.{fmt}"
                if path.exists():
                    zip_file.write(path, arcname=f"{asset.title.replace(' ', '_')}_{asset_id}.{fmt}")
                    formats_included.append(fmt)

            # 2. Add companion auxiliary files if present (e.g. material.mtl, material_0.png)
            for companion in asset_dir.glob("*.mtl"):
                zip_file.write(companion, arcname=companion.name)
                if "mtl" not in formats_included:
                    formats_included.append("mtl")
            for companion in asset_dir.glob("*.png"):
                zip_file.write(companion, arcname=companion.name)
                if "png" not in formats_included:
                    formats_included.append("png")

            # 3. Add manifest.json
            manifest_data = {
                "polygen_version": "1.0.0",
                "asset_id": asset.id,
                "title": asset.title,
                "prompt": asset.prompt,
                "style": asset.style,
                "provider": asset.provider,
                "poly_count": asset.poly_count,
                "vertex_count": asset.vertex_count,
                "created_at": asset.created_at.isoformat(),
                "formats": formats_included,
                "license": "Creative Commons CC-BY 4.0",
                "generator": "PolyGen Text-to-3D Synthesis Core"
            }
            zip_file.writestr("manifest.json", json.dumps(manifest_data, indent=2))

            # 4. Add README.txt
            readme_text = f"""==================================================
POLYGEN 3D ASSET BUNDLE
==================================================
Title:       {asset.title}
Asset ID:    {asset.id}
Prompt:      "{asset.prompt}"
Style:       {asset.style}
Polygons:    {asset.poly_count:,}
Vertices:    {asset.vertex_count:,}
Generated:   {asset.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
Engine:      PolyGen ({asset.provider})

INCLUDED FILES:
- *.glb: Binary glTF 2.0 (web, Three.js, Babylon.js, Unity)
- *.obj: Wavefront OBJ (Blender, Maya, 3ds Max, Cinema4D)
- *.stl: Stereolithography (3D Printing, slicing engines)
- *.mtl / *.png: PBR material definition & companion textures (if applicable)
- manifest.json: Complete technical metadata specification

Exported from PolyGen 3D Studio:
https://github.com/Veggies02/PolyGen
==================================================
"""
            zip_file.writestr("README.txt", readme_text)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    def seed_sample_assets(self):
        """Seed initial curated demo models so the workspace starts populated."""
        samples = [
            {
                "title": "Cyber Recon Drone X-1",
                "prompt": "futuristic stealth tactical recon drone with dual thruster wings and sensor array",
                "style": "scifi",
                "mesh": ProceduralMeshFactory.create_drone()
            },
            {
                "title": "Obsidian Resonator Monolith",
                "prompt": "obsidian crystal cluster monolith with faceted mineral spires",
                "style": "low-poly",
                "mesh": ProceduralMeshFactory.create_crystal()
            },
            {
                "title": "Vanguard Exo-Combat Helmet",
                "prompt": "cyberpunk tactical combat helmet with reinforced ballistic visor and rebreather",
                "style": "cyberpunk",
                "mesh": ProceduralMeshFactory.create_helmet()
            },
            {
                "title": "Quantum Kinetic Gyroscope",
                "prompt": "nested concentric kinetic gyroscope rings enclosing a glowing polyhedral core",
                "style": "scifi",
                "mesh": ProceduralMeshFactory.create_gyro_artifact()
            }
        ]

        for s in samples:
            mesh = s["mesh"]
            self.save_asset(
                title=s["title"],
                prompt=s["prompt"],
                provider="demo",
                style=s["style"],
                glb_bytes=mesh.export_glb(),
                obj_str=mesh.export_obj(),
                stl_bytes=mesh.export_stl(),
                poly_count=mesh.poly_count,
                vertex_count=mesh.vertex_count,
                tags=[s["style"], "curated-sample", "demo"],
                attributes={"curated": True, "engine": "PolyGen Procedural Core"},
                is_demo=True
            )

asset_storage = AssetStorageService()
