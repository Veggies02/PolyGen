"""
PolyGen Mesh Processing Engine
Provides validation, topology inspection, UV mapping, texture mapping, pipeline orchestration, and optimization services.
"""

from .mesh_validator import (
    MeshValidator,
    MeshValidationReport,
    MeshMetrics,
    MeshValidationError,
)
from .uv_unwrapper import (
    UVUnwrapper,
    UVUnwrapOptions,
    UVUnwrapResult,
    UVMetrics,
    UVValidationReport,
)
from .texture_mapper import (
    TextureMapper,
    TextureMappingError,
    MaterialConfig,
    TextureMetrics,
    TextureMappingResult,
)
from .pipeline import (
    MeshProcessingPipeline,
    PipelineConfig,
    PipelineResult,
)
from .mesh_simplifier import (
    MeshSimplifier,
    SimplificationOptions,
    SimplificationResult,
)

__all__ = [
    "MeshValidator",
    "MeshValidationReport",
    "MeshMetrics",
    "MeshValidationError",
    "UVUnwrapper",
    "UVUnwrapOptions",
    "UVUnwrapResult",
    "UVMetrics",
    "UVValidationReport",
    "TextureMapper",
    "TextureMappingError",
    "MaterialConfig",
    "TextureMetrics",
    "TextureMappingResult",
    "MeshProcessingPipeline",
    "PipelineConfig",
    "PipelineResult",
    "MeshSimplifier",
    "SimplificationOptions",
    "SimplificationResult",
]
