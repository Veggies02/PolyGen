from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000, description="Text prompt describing the desired 3D asset")
    negative_prompt: Optional[str] = Field(None, max_length=500)
    provider: str = Field("demo", description="Provider ID: 'demo', 'tripo', 'meshy'")
    style: str = Field("scifi", description="Style preset: 'scifi', 'low-poly', 'realistic', 'cyberpunk', 'organic'")
    poly_budget: str = Field("medium", description="Poly budget: 'low' (~5k), 'medium' (~25k), 'high' (~60k)")
    symmetry: bool = Field(False, description="Enforce bilateral symmetry")
    seed: Optional[int] = Field(None, description="Random seed for deterministic generation")

class JobStatus(BaseModel):
    id: str
    prompt: str
    provider: str
    status: str  # 'queued', 'synthesizing', 'meshing', 'texturing', 'completed', 'failed'
    progress: int = 0  # 0 to 100
    current_stage: str = "Queued"
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    asset_id: Optional[str] = None

class AssetMetadata(BaseModel):
    id: str
    title: str
    prompt: str
    negative_prompt: Optional[str] = None
    provider: str
    style: str
    poly_count: int
    vertex_count: int
    file_size_bytes: int
    formats: Dict[str, str]  # e.g. {"glb": "/api/assets/xyz/download/glb", ...}
    thumbnail_url: Optional[str] = None
    tags: List[str] = []
    created_at: datetime
    is_demo: bool = False
    attributes: Dict[str, Any] = {}

class ProviderInfo(BaseModel):
    id: str
    name: str
    description: str
    is_configured: bool
    is_demo: bool
    supported_formats: List[str]
    capabilities: List[str]
    speed_estimate: str

class PromptEnhanceRequest(BaseModel):
    prompt: str = Field(..., min_length=2)
    style: Optional[str] = "scifi"

class PromptEnhanceResponse(BaseModel):
    original_prompt: str
    enhanced_prompt: str
    suggested_tags: List[str]
    style_applied: str

class StatsOverview(BaseModel):
    total_assets: int
    active_jobs: int
    completed_jobs: int
    storage_used_bytes: int
    available_providers: int
