import json
import uuid
import io
import zipfile
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

    def _load_index(self) -> List[Dict[str, Any]]:
        try:
            if self.metadata_file.exists():
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return []

    def _save_index(self, data: List[Dict[str, Any]]):
        with open(self.metadata_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def list_assets(self, tag: Optional[str] = None, search: Optional[str] = None) -> List[AssetMetadata]:
        raw_list = self._load_index()
        assets = []
        for item in raw_list:
            # Parse created_at
            if isinstance(item.get("created_at"), str):
                item["created_at"] = datetime.fromisoformat(item["created_at"])
            asset = AssetMetadata(**item)
            
            if tag and tag.lower() not in [t.lower() for t in asset.tags]:
                continue
            if search and search.lower() not in asset.title.lower() and search.lower() not in asset.prompt.lower():
                continue
            assets.append(asset)
        
        # Sort newest first
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

        file_size = len(glb_bytes)
        formats = {
            "glb": f"/api/assets/{asset_id}/download/glb",
            "obj": f"/api/assets/{asset_id}/download/obj",
            "stl": f"/api/assets/{asset_id}/download/stl"
        }

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
            attributes=attributes or {}
        )

        current_index = self._load_index()
        current_index.insert(0, metadata.model_dump())
        self._save_index(current_index)
        return metadata

    def get_file_path(self, asset_id: str, fmt: str) -> Optional[Path]:
        fmt = fmt.lower()
        if fmt not in ["glb", "obj", "stl"]:
            return None
        file_path = self.base_dir / asset_id / f"{asset_id}.{fmt}"
        if file_path.exists():
            return file_path
        return None

    def create_bundle_zip(self, asset_id: str) -> Optional[bytes]:
        """Creates an in-memory ZIP package containing all 3D formats (.glb, .obj, .stl) and metadata."""
        asset = self.get_asset(asset_id)
        if not asset:
            return None

        asset_dir = self.base_dir / asset_id
        if not asset_dir.exists():
            return None

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Add 3D format files
            for fmt in ["glb", "obj", "stl"]:
                path = asset_dir / f"{asset_id}.{fmt}"
                if path.exists():
                    zip_file.write(path, arcname=f"{asset.title.replace(' ', '_')}_{asset_id}.{fmt}")

            # 2. Add manifest.json
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
                "formats": ["glb", "obj", "stl"],
                "license": "Creative Commons CC-BY 4.0",
                "generator": "PolyGen Text-to-3D Synthesis Core"
            }
            zip_file.writestr("manifest.json", json.dumps(manifest_data, indent=2))

            # 3. Add README.txt
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
