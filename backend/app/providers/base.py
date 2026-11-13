from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Optional, Dict, Any
from ..models.schemas import GenerationRequest, ProviderInfo, AssetMetadata

class Base3DProvider(ABC):
    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier for this provider (e.g. 'demo', 'tripo', 'meshy')."""
        pass

    @abstractmethod
    def get_info(self) -> ProviderInfo:
        """Returns metadata, capability flags, and configuration status."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns whether required API credentials are set."""
        pass

    @abstractmethod
    async def generate(
        self,
        request: GenerationRequest,
        job_id: str,
        progress_callback: Optional[Callable[[int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        """
        Executes generation, emitting progress via callback.
        Returns a dict containing file contents or file paths:
        {
            'title': str,
            'glb_bytes': bytes,
            'obj_str': str,
            'stl_bytes': bytes,
            'poly_count': int,
            'vertex_count': int,
            'tags': list[str],
            'attributes': dict
        }
        """
        pass
