"""
Texture Generation Result Contract
Encapsulates synthesized texture image, encoded payload, and diagnostic telemetry.
"""

import base64
import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from PIL import Image


class TextureResult(BaseModel):
    """
    Standard outcome contract returned by texture synthesis generators.
    """
    success: bool = Field(..., description="Whether texture synthesis succeeded")
    image: Optional[Any] = Field(None, description="PIL.Image.Image instance")
    image_bytes: Optional[bytes] = Field(None, description="Lossless PNG encoded byte buffer")
    width: int = Field(0, description="Image width in pixels")
    height: int = Field(0, description="Image height in pixels")
    channels: int = Field(3, description="Color channels (3=RGB, 4=RGBA)")
    style: str = Field("unknown", description="Applied visual style")
    provider: str = Field("procedural", description="Underlying generator engine")
    actual_provider: str = Field("procedural", description="Engine that genuinely synthesized the image")
    requested_provider: Optional[str] = Field(None, description="Engine requested by user/pipeline")
    model_id: Optional[str] = Field(None, description="Neural model identifier if diffusion engine was utilized")
    seed: int = Field(0, description="Random seed used for generation")
    generation_time_ms: float = Field(0.0, description="Execution duration in milliseconds")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Generator telemetry and palette details")
    errors: List[str] = Field(default_factory=list, description="Encountered fatal errors")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")

    model_config = {"arbitrary_types_allowed": True}

    def to_base64(self) -> str:
        """Returns base64 encoded string of PNG image bytes."""
        if not self.image_bytes and self.image:
            buf = io.BytesIO()
            self.image.save(buf, format="PNG")
            self.image_bytes = buf.getvalue()
        if not self.image_bytes:
            return ""
        return base64.b64encode(self.image_bytes).decode("ascii")

    def to_data_uri(self) -> str:
        """Returns browser-renderable data URI (data:image/png;base64,...)."""
        b64 = self.to_base64()
        return f"data:image/png;base64,{b64}" if b64 else ""

    def save(self, path: Union[str, Path]) -> Path:
        """Saves texture image to disk."""
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if self.image:
            self.image.save(target)
        elif self.image_bytes:
            with open(target, "wb") as f:
                f.write(self.image_bytes)
        else:
            raise ValueError("No image data available to save.")
        return target
