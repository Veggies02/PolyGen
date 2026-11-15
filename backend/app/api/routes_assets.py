from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse
from typing import List, Optional
from ..models.schemas import AssetMetadata
from ..services.storage import asset_storage

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("", response_model=List[AssetMetadata])
async def list_assets(
    tag: Optional[str] = Query(None, description="Filter by tag"),
    search: Optional[str] = Query(None, description="Search by title or prompt")
):
    return asset_storage.list_assets(tag=tag, search=search)

@router.get("/{asset_id}", response_model=AssetMetadata)
async def get_asset(asset_id: str):
    asset = asset_storage.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@router.delete("/{asset_id}")
async def delete_asset(asset_id: str):
    """Deletes an asset from the system."""
    success = asset_storage.delete_asset(asset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found or already deleted")
    return {"status": "deleted", "id": asset_id}

@router.get("/{asset_id}/download/{fmt}")
async def download_asset(asset_id: str, fmt: str):
    fmt = fmt.lower()
    file_path = asset_storage.get_file_path(asset_id, fmt)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File for format '{fmt}' not found")
    
    media_types = {
        "glb": "model/gltf-binary",
        "obj": "text/plain",
        "stl": "model/stl"
    }

    return FileResponse(
        path=file_path,
        media_type=media_types.get(fmt, "application/octet-stream"),
        filename=f"{asset_id}.{fmt}"
    )

@router.get("/{asset_id}/bundle")
async def download_bundle(asset_id: str):
    """Exports all model formats (.glb, .obj, .stl) + manifest.json packed into a ZIP bundle."""
    zip_bytes = asset_storage.create_bundle_zip(asset_id)
    if not zip_bytes:
        raise HTTPException(status_code=404, detail="Unable to create ZIP bundle for asset")

    asset = asset_storage.get_asset(asset_id)
    safe_title = (asset.title.replace(" ", "_") if asset else asset_id)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="PolyGen_{safe_title}_{asset_id}.zip"'
        }
    )
