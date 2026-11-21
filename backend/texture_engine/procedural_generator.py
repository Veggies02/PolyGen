"""
Procedural Texture Generator Engine
High-performance, CPU-only algorithmic texture synthesizer using NumPy and Pillow.
Supports 9 distinct material styles with deterministic seeding and prompt color steering.
"""

import io
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import scipy.ndimage as ndi
from PIL import Image

from .texture_config import TextureConfig, TextureStyle
from .texture_result import TextureResult


class ProceduralGenerator:
    """
    Pure Python/NumPy procedural texture synthesis engine.
    Requires no GPU, no network, and no external AI models.
    """

    # Pre-calibrated color palettes [Primary, Secondary, Accent] in RGB [0.0 - 1.0]
    PALETTES: Dict[str, Dict[str, Tuple[float, float, float]]] = {
        "metallic": {
            "steel": ((0.70, 0.72, 0.75), (0.45, 0.48, 0.52), (0.92, 0.94, 0.96)),
            "gold": ((0.85, 0.72, 0.32), (0.62, 0.48, 0.18), (0.98, 0.92, 0.65)),
            "copper": ((0.82, 0.48, 0.32), (0.55, 0.28, 0.16), (0.96, 0.72, 0.58)),
            "titanium": ((0.28, 0.30, 0.34), (0.16, 0.18, 0.22), (0.52, 0.56, 0.62)),
        },
        "wood": {
            "walnut": ((0.32, 0.18, 0.08), (0.18, 0.09, 0.04), (0.48, 0.30, 0.16)),
            "oak": ((0.58, 0.38, 0.20), (0.36, 0.22, 0.10), (0.74, 0.54, 0.34)),
            "pine": ((0.78, 0.56, 0.32), (0.52, 0.34, 0.18), (0.90, 0.72, 0.48)),
        },
        "stone": {
            "granite": ((0.52, 0.52, 0.54), (0.32, 0.33, 0.36), (0.75, 0.74, 0.72)),
            "slate": ((0.25, 0.28, 0.32), (0.15, 0.17, 0.20), (0.42, 0.46, 0.52)),
            "sandstone": ((0.76, 0.64, 0.48), (0.58, 0.46, 0.32), (0.88, 0.78, 0.62)),
        },
        "marble": {
            "carrara": ((0.92, 0.93, 0.95), (0.38, 0.42, 0.48), (0.18, 0.20, 0.24)),
            "nero": ((0.12, 0.13, 0.15), (0.88, 0.89, 0.92), (0.75, 0.62, 0.28)),
            "emerald": ((0.15, 0.35, 0.28), (0.08, 0.18, 0.14), (0.82, 0.92, 0.85)),
        },
        "carbon_fiber": {
            "graphite": ((0.08, 0.08, 0.09), (0.24, 0.25, 0.28), (0.42, 0.44, 0.48)),
            "colored": ((0.10, 0.12, 0.18), (0.18, 0.28, 0.45), (0.32, 0.52, 0.82)),
        },
        "fabric": {
            "denim": ((0.22, 0.34, 0.56), (0.12, 0.20, 0.38), (0.48, 0.60, 0.78)),
            "canvas": ((0.74, 0.68, 0.58), (0.54, 0.48, 0.38), (0.86, 0.82, 0.74)),
            "charcoal": ((0.22, 0.22, 0.24), (0.12, 0.12, 0.14), (0.38, 0.38, 0.42)),
        },
        "ceramic": {
            "porcelain": ((0.94, 0.95, 0.97), (0.22, 0.45, 0.78), (0.82, 0.85, 0.90)),
            "terracotta": ((0.75, 0.38, 0.24), (0.52, 0.24, 0.14), (0.88, 0.54, 0.38)),
            "celadon": ((0.48, 0.68, 0.60), (0.32, 0.48, 0.42), (0.72, 0.86, 0.80)),
        },
        "scifi": {
            "cyber": ((0.14, 0.16, 0.20), (0.08, 0.09, 0.12), (0.12, 0.88, 0.98)),
            "hazard": ((0.16, 0.17, 0.18), (0.09, 0.09, 0.10), (0.98, 0.78, 0.12)),
            "crimson": ((0.16, 0.14, 0.16), (0.09, 0.08, 0.09), (0.98, 0.18, 0.28)),
        },
        "organic": {
            "lichen": ((0.32, 0.46, 0.26), (0.18, 0.28, 0.14), (0.58, 0.68, 0.38)),
            "scales": ((0.22, 0.40, 0.35), (0.12, 0.24, 0.20), (0.45, 0.72, 0.60)),
            "bark": ((0.38, 0.28, 0.20), (0.22, 0.15, 0.10), (0.54, 0.42, 0.30)),
        },
    }

    @classmethod
    def generate(cls, config: TextureConfig) -> TextureResult:
        """
        Synthesizes a procedural texture based on the provided configuration.

        Args:
            config: Texture synthesis parameters.

        Returns:
            TextureResult containing PIL Image, lossless PNG bytes, and generation metrics.
        """
        start_time = time.perf_counter()
        w, h = config.width, config.height
        style_key = config.style.lower()
        seed = config.seed if config.seed is not None else int(time.time() * 1000) % 2147483647
        rng = np.random.default_rng(seed)

        # Parse prompt for color modifiers and palette overrides
        palette = cls._resolve_palette(style_key, config.prompt, config.color_palette)

        errors: List[str] = []
        warnings: List[str] = []
        rgb_array: np.ndarray

        try:
            if style_key == "metallic":
                rgb_array = cls._gen_metallic(w, h, rng, palette)
            elif style_key == "wood":
                rgb_array = cls._gen_wood(w, h, rng, palette)
            elif style_key == "stone":
                rgb_array = cls._gen_stone(w, h, rng, palette)
            elif style_key == "marble":
                rgb_array = cls._gen_marble(w, h, rng, palette)
            elif style_key == "carbon_fiber":
                rgb_array = cls._gen_carbon_fiber(w, h, rng, palette)
            elif style_key == "fabric":
                rgb_array = cls._gen_fabric(w, h, rng, palette)
            elif style_key == "ceramic":
                rgb_array = cls._gen_ceramic(w, h, rng, palette)
            elif style_key == "scifi":
                rgb_array = cls._gen_scifi(w, h, rng, palette)
            elif style_key == "organic":
                rgb_array = cls._gen_organic(w, h, rng, palette)
            else:
                warnings.append(f"Unrecognized style '{style_key}'; defaulting to procedural 'scifi'.")
                rgb_array = cls._gen_scifi(w, h, rng, palette)

            # Clamp and convert float [0.0, 1.0] to uint8 [0, 255]
            rgb_uint8 = np.clip(rgb_array * 255.0, 0, 255).astype(np.uint8)
            img = Image.fromarray(rgb_uint8, mode="RGB")

            # Encode to PNG buffer
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            image_bytes = buf.getvalue()

            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

            return TextureResult(
                success=True,
                image=img,
                image_bytes=image_bytes,
                width=w,
                height=h,
                channels=3,
                style=style_key,
                provider="procedural",
                seed=seed,
                generation_time_ms=elapsed_ms,
                metadata={
                    "style": style_key,
                    "resolution": f"{w}x{h}",
                    "seed": seed,
                    "prompt": config.prompt,
                    "palette_primary": [round(c, 3) for c in palette[0]],
                    "palette_accent": [round(c, 3) for c in palette[2]],
                },
                warnings=warnings,
            )

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            errors.append(f"Procedural synthesis failed: {str(e)}")
            return TextureResult(
                success=False,
                width=w,
                height=h,
                style=style_key,
                provider="procedural",
                seed=seed,
                generation_time_ms=elapsed_ms,
                errors=errors,
            )

    # -------------------------------------------------------------------------
    # Procedural Style Implementations
    # -------------------------------------------------------------------------

    @classmethod
    def _gen_metallic(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Brushed metal surface with anisotropic streaks and specular sheen."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # High-frequency horizontal streak pattern (anisotropic brush marks)
        noise_1d = rng.normal(0.5, 0.15, (h, 1))
        noise_1d = ndi.gaussian_filter1d(noise_1d, sigma=1.2, axis=0)
        streaks = np.repeat(noise_1d, w, axis=1)

        # Micro-grit variation
        grit = rng.uniform(0.95, 1.05, (h, w))
        streaks = np.clip(streaks * grit, 0.0, 1.0)

        # Broad specular lighting gradient (diagonal sheen)
        x = np.linspace(-1, 1, w)
        y = np.linspace(-1, 1, h)
        xx, yy = np.meshgrid(x, y)
        specular = np.exp(-((xx + yy) ** 2) / 0.8) * 0.35

        # Blend primary, secondary, and highlight
        base = c_prim * streaks[..., None] + c_sec * (1.0 - streaks[..., None]) * 0.4
        result = base + c_acc * specular[..., None]
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_wood(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Natural wood grain with warped concentric growth rings and fiber streaks."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # Knot center off-canvas
        knot_x = rng.uniform(-0.5, 0.3) * w
        knot_y = rng.uniform(0.2, 0.8) * h

        x = np.arange(w, dtype=np.float32) - knot_x
        y = (np.arange(h, dtype=np.float32) - knot_y) * 3.5  # Elongate vertically
        xx, yy = np.meshgrid(x, y)

        # Distance field
        dist = np.sqrt(xx**2 + yy**2)

        # Turbulence distortion for organic growth lines
        low_noise = rng.uniform(0, 1, (16, 16))
        turb = ndi.zoom(low_noise, (h / 16.0, w / 16.0), order=1)[:h, :w] * 35.0
        dist_warped = dist + turb

        # Concentric ring modulation
        rings = np.sin(dist_warped * 0.08) * 0.5 + 0.5
        rings = rings**0.7  # Sharpen dark rings

        # Fine longitudinal fiber grain
        fine_fibers = rng.normal(0.5, 0.08, (h, 1))
        fine_fibers = ndi.gaussian_filter1d(fine_fibers, sigma=0.8, axis=0)
        fibers = np.repeat(fine_fibers, w, axis=1)

        wood_map = rings * 0.7 + fibers * 0.3
        result = c_prim * wood_map[..., None] + c_sec * (1.0 - wood_map[..., None])
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_stone(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Granite/slate stone with multi-octave cellular flecks and mineral inclusions."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # Multi-octave fractal noise
        octave1 = ndi.zoom(rng.uniform(0, 1, (8, 8)), (h / 8.0, w / 8.0), order=1)[:h, :w]
        octave2 = ndi.zoom(rng.uniform(0, 1, (32, 32)), (h / 32.0, w / 32.0), order=1)[:h, :w]
        octave3 = ndi.zoom(rng.uniform(0, 1, (64, 64)), (h / 64.0, w / 64.0), order=1)[:h, :w]
        fractal = octave1 * 0.5 + octave2 * 0.3 + octave3 * 0.2

        # Mineral flecks (high-frequency quartz & mica crystals)
        flecks = rng.uniform(0, 1, (h, w))
        fleck_mask = (flecks > 0.88).astype(np.float32)

        stone_map = np.clip(fractal, 0.0, 1.0)
        base = c_prim * stone_map[..., None] + c_sec * (1.0 - stone_map[..., None])
        result = base * (1.0 - fleck_mask[..., None] * 0.3) + c_acc * fleck_mask[..., None] * 0.8
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_marble(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Polished marble with fluid turbulence-driven mineral veins."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        x = np.linspace(0, 4 * np.pi, w)
        y = np.linspace(0, 4 * np.pi, h)
        xx, yy = np.meshgrid(x, y)

        # Multi-scale Perlin turbulence
        t1 = ndi.zoom(rng.uniform(-1, 1, (8, 8)), (h / 8.0, w / 8.0), order=1)[:h, :w]
        t2 = ndi.zoom(rng.uniform(-1, 1, (16, 16)), (h / 16.0, w / 16.0), order=1)[:h, :w]
        t3 = ndi.zoom(rng.uniform(-1, 1, (32, 32)), (h / 32.0, w / 32.0), order=1)[:h, :w]
        turbulence = t1 * 1.0 + t2 * 0.5 + t3 * 0.25

        # Vein pattern equation: sin(xx + yy + 3.0 * turbulence)
        veins = np.sin(xx + yy * 0.5 + 3.5 * turbulence)
        vein_intensity = np.abs(veins) ** 3.0  # Thin, sharp vein profiles

        # Broad mineral color wash
        wash = ndi.gaussian_filter(rng.uniform(0, 1, (h, w)), sigma=w / 16.0)

        base = c_prim * (0.85 + 0.15 * wash[..., None])
        vein_color = c_sec * (1.0 - vein_intensity[..., None]) + c_acc * vein_intensity[..., None]
        result = base * (1.0 - (1.0 - vein_intensity[..., None]) * 0.6) + vein_color * ((1.0 - vein_intensity[..., None]) * 0.6)
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_carbon_fiber(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """2x2 twill carbon fiber weave with anisotropic thread sheen."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # Cell size for weave tiles (e.g. 16 or 32 pixels per thread bundle)
        cell = max(8, w // 32)
        x_idx = (np.arange(w) // cell) % 4
        y_idx = (np.arange(h) // cell) % 4
        xx_idx, yy_idx = np.meshgrid(x_idx, y_idx)

        # Standard 2x2 twill matrix pattern
        twill_mask = ((xx_idx + yy_idx) % 4 < 2).astype(np.float32)

        # Strand fiber micro-shading
        x_sub = (np.arange(w) % cell) / float(cell)
        y_sub = (np.arange(h) % cell) / float(cell)
        xx_sub, yy_sub = np.meshgrid(x_sub, y_sub)

        # Curved filament reflection
        h_sheen = np.sin(xx_sub * np.pi) ** 1.5
        v_sheen = np.sin(yy_sub * np.pi) ** 1.5

        weave_intensity = twill_mask * h_sheen + (1.0 - twill_mask) * v_sheen
        micro_grain = rng.uniform(0.92, 1.08, (h, w))
        weave_intensity = np.clip(weave_intensity * micro_grain, 0.0, 1.0)

        # Deep charcoal base with anisotropic thread highlights
        base = c_prim * 0.6 + c_sec * (weave_intensity[..., None] * 0.5)
        specular = c_acc * ((weave_intensity**2.5)[..., None] * 0.3)
        return np.clip(base + specular, 0.0, 1.0)

    @classmethod
    def _gen_fabric(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Textile canvas / denim weave with interlaced warp & weft threads."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        freq = max(2.0, w / 64.0)
        x = np.linspace(0, freq * 2 * np.pi, w)
        y = np.linspace(0, freq * 2 * np.pi, h)
        xx, yy = np.meshgrid(x, y)

        # Warp and weft threads
        warp = np.sin(xx) * 0.5 + 0.5
        weft = np.cos(yy) * 0.5 + 0.5
        fabric_grid = (warp + weft) * 0.5

        # Micro-fiber fuzziness
        fiber_noise = rng.normal(0.0, 0.08, (h, w))
        fabric_map = np.clip(fabric_grid + fiber_noise, 0.0, 1.0)

        result = c_prim * fabric_map[..., None] + c_sec * (1.0 - fabric_map[..., None]) * 0.6
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_ceramic(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Glazed glossy ceramic with subtle crazing crackle fractures."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # Broad smooth glaze gradient with rim lighting
        x = np.linspace(-1, 1, w)
        y = np.linspace(-1, 1, h)
        xx, yy = np.meshgrid(x, y)
        glaze_vignette = 1.0 - 0.25 * (xx**2 + yy**2)

        # Fine glaze crackle lines using Voronoi distance field
        num_seeds = max(16, w // 16)
        seed_x = rng.uniform(0, w, num_seeds)
        seed_y = rng.uniform(0, h, num_seeds)

        # Approximate crackle lines with downsampled Voronoi
        grid_scale = 8
        gw, gh = w // grid_scale, h // grid_scale
        gx, gy = np.meshgrid(np.arange(gw) * grid_scale, np.arange(gh) * grid_scale)
        pts = np.stack([gx.ravel(), gy.ravel()], axis=1)
        seed_pts = np.stack([seed_x, seed_y], axis=1)

        # Distances to all seeds
        dists = np.linalg.norm(pts[:, None, :] - seed_pts[None, :, :], axis=2)
        sorted_dists = np.sort(dists, axis=1)
        # Boundary edges where d2 - d1 is small
        crackle_coarse = (sorted_dists[:, 1] - sorted_dists[:, 0]).reshape(gh, gw)
        crackle_full = ndi.zoom(crackle_coarse, (h / float(gh), w / float(gw)), order=1)[:h, :w]
        crackle_lines = (crackle_full < (w / 128.0)).astype(np.float32)

        base = c_prim * glaze_vignette[..., None]
        result = base * (1.0 - crackle_lines[..., None] * 0.5) + c_sec * (crackle_lines[..., None] * 0.5)
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_scifi(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """High-tech armored hull plating, circuit conduits, and neon emissive nodes."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        panel_size = max(32, w // 8)
        xx, yy = np.meshgrid(np.arange(w), np.arange(h))

        # Panel borders (seams between armor plates)
        border_x = (xx % panel_size == 0) | (xx % panel_size == 1)
        border_y = (yy % panel_size == 0) | (yy % panel_size == 1)
        seams = border_x | border_y

        # Circuit traces running along panel sub-grids
        sub_size = panel_size // 4
        circuit_x = (xx % sub_size == 0) & ((yy // sub_size) % 3 == 0)
        circuit_y = (yy % sub_size == 0) & ((xx // sub_size) % 3 == 0)
        circuits = circuit_x | circuit_y

        # Panel plate height variations
        panel_id = (xx // panel_size) + (yy // panel_size) * (w // panel_size)
        panel_noise = rng.uniform(0.85, 1.15, (h // panel_size + 2, w // panel_size + 2))
        px = np.clip(xx // panel_size, 0, panel_noise.shape[1] - 1)
        py = np.clip(yy // panel_size, 0, panel_noise.shape[0] - 1)
        plate_shade = panel_noise[py, px]

        # Assemble plate base
        base = c_prim * plate_shade[..., None]
        base[seams] = c_sec * 0.4  # Dark recessed panel seams

        # Neon emissive accents at junctions
        junctions = ((xx % panel_size < 3) & (yy % panel_size < 3)) | circuits
        glow = ndi.gaussian_filter(junctions.astype(np.float32), sigma=2.0)
        result = base * (1.0 - glow[..., None] * 0.3) + c_acc * (glow[..., None] * 1.5)
        return np.clip(result, 0.0, 1.0)

    @classmethod
    def _gen_organic(cls, w: int, h: int, rng: np.random.Generator, pal: Tuple) -> np.ndarray:
        """Biomorphic cellular tissue, scales, or bark plates."""
        c_prim, c_sec, c_acc = np.array(pal[0]), np.array(pal[1]), np.array(pal[2])

        # Downsampled Worley cellular noise
        cell_density = max(8, w // 32)
        cell_seeds = rng.uniform(0, w, (cell_density * cell_density, 2))

        gw, gh = w // 4, h // 4
        gx, gy = np.meshgrid(np.arange(gw) * 4, np.arange(gh) * 4)
        pts = np.stack([gx.ravel(), gy.ravel()], axis=1)

        dists = np.linalg.norm(pts[:, None, :] - cell_seeds[None, :, :], axis=2)
        min_dists = np.min(dists, axis=1).reshape(gh, gw)
        cell_map = ndi.zoom(min_dists, (h / float(gh), w / float(gw)), order=1)[:h, :w]
        cell_norm = (cell_map - cell_map.min()) / (cell_map.max() - cell_map.min() + 1e-6)

        # Micro-dermal texture
        skin_grain = rng.uniform(0.9, 1.1, (h, w))
        cellular = np.clip(cell_norm * skin_grain, 0.0, 1.0)

        result = c_prim * (1.0 - cellular[..., None]) + c_sec * cellular[..., None]
        # Highlight cell apex
        highlight = (cellular < 0.15).astype(np.float32)
        result += c_acc * highlight[..., None] * 0.4
        return np.clip(result, 0.0, 1.0)

    # -------------------------------------------------------------------------
    # Palette & Prompt Steering
    # -------------------------------------------------------------------------

    @classmethod
    def _resolve_palette(
        cls,
        style: str,
        prompt: Optional[str] = None,
        custom_palette: Optional[List[str]] = None,
    ) -> Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]:
        """
        Determines the optimal 3-tone color palette based on style and prompt cues.
        """
        # If user explicitly provided hex or RGB colors
        if custom_palette and len(custom_palette) >= 2:
            parsed = [cls._parse_color(c) for c in custom_palette]
            prim = parsed[0]
            sec = parsed[1]
            acc = parsed[2] if len(parsed) >= 3 else cls._lighten(prim, 0.4)
            return (prim, sec, acc)

        style_palettes = cls.PALETTES.get(style, cls.PALETTES["scifi"])
        palette_keys = list(style_palettes.keys())
        chosen_variant = palette_keys[0]

        # Inspect prompt for color hints
        if prompt:
            prompt_lower = prompt.lower()
            for key in palette_keys:
                if key in prompt_lower:
                    chosen_variant = key
                    break
            # General color steering keywords
            if any(w in prompt_lower for w in ["gold", "golden", "brass"]):
                return ((0.85, 0.72, 0.32), (0.55, 0.42, 0.18), (0.98, 0.92, 0.65))
            if any(w in prompt_lower for w in ["copper", "bronze"]):
                return ((0.82, 0.48, 0.32), (0.52, 0.28, 0.16), (0.95, 0.70, 0.55))
            if any(w in prompt_lower for w in ["emerald", "jade", "green"]):
                return ((0.18, 0.45, 0.28), (0.10, 0.25, 0.16), (0.35, 0.85, 0.55))
            if any(w in prompt_lower for w in ["ruby", "crimson", "red"]):
                return ((0.65, 0.15, 0.18), (0.35, 0.08, 0.10), (0.95, 0.35, 0.40))
            if any(w in prompt_lower for w in ["cobalt", "sapphire", "blue"]):
                return ((0.15, 0.32, 0.65), (0.08, 0.18, 0.40), (0.35, 0.65, 0.98))
            if any(w in prompt_lower for w in ["cyber", "neon", "cyan"]):
                return ((0.14, 0.16, 0.20), (0.08, 0.09, 0.12), (0.12, 0.88, 0.98))
            if any(w in prompt_lower for w in ["dark", "obsidian", "black"]):
                return ((0.12, 0.12, 0.14), (0.05, 0.05, 0.06), (0.35, 0.38, 0.42))

        pal = style_palettes[chosen_variant]
        return pal

    @staticmethod
    def _parse_color(c: str) -> Tuple[float, float, float]:
        """Parses hex string (#RGB, #RRGGBB) to normalized float tuple."""
        clean = c.strip().lstrip("#")
        if len(clean) == 3:
            clean = "".join([ch * 2 for ch in clean])
        if len(clean) == 6:
            r = int(clean[0:2], 16) / 255.0
            g = int(clean[2:4], 16) / 255.0
            b = int(clean[4:6], 16) / 255.0
            return (r, g, b)
        return (0.5, 0.5, 0.5)

    @staticmethod
    def _lighten(color: Tuple[float, float, float], factor: float) -> Tuple[float, float, float]:
        return tuple(min(1.0, c + (1.0 - c) * factor) for c in color)
