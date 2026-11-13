from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings
from .api import routes_generate, routes_assets, routes_providers, routes_stats
from .services.storage import asset_storage

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="PolyGen - Generative Text-to-3D Asset Pipeline API"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(routes_generate.router, prefix=settings.API_PREFIX)
app.include_router(routes_assets.router, prefix=settings.API_PREFIX)
app.include_router(routes_providers.router, prefix=settings.API_PREFIX)
app.include_router(routes_stats.router, prefix=settings.API_PREFIX)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "default_provider": settings.DEFAULT_PROVIDER,
        "total_assets": len(asset_storage.list_assets())
    }
