import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
ASSETS_DIR = STORAGE_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "PolyGen API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = os.getenv("POLYGEN_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("POLYGEN_PORT", "8000"))
    
    # Storage
    STORAGE_DIR: Path = STORAGE_DIR
    ASSETS_DIR: Path = ASSETS_DIR
    
    # Providers
    DEFAULT_PROVIDER: str = os.getenv("POLYGEN_DEFAULT_PROVIDER", "demo")
    TRIPO_API_KEY: str = os.getenv("TRIPO_API_KEY", "")
    MESHY_API_KEY: str = os.getenv("MESHY_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Security / CORS
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()
