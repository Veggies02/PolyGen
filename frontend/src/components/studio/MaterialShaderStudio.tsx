import React from 'react';
import type { ViewerOptions, MaterialCustomization, ToneMappingMode, StudioBackdrop, MotionMode, EnvironmentPreset } from '../../types';
import { 
  Palette, 
  Sun, 
  Camera, 
  RotateCcw,
  Sparkles,
  Layers,
  Box,
  Compass,
  Film,
  Play,
  Image as ImageIcon,
  Lightbulb,
  Globe
} from 'lucide-react';

interface MaterialShaderStudioProps {
  options: ViewerOptions;
  onOptionsChange: (options: ViewerOptions) => void;
  onCaptureSnapshot: () => void;
  assetTitle?: string;
}

export const MaterialShaderStudio: React.FC<MaterialShaderStudioProps> = ({
  options,
  onOptionsChange,
  onCaptureSnapshot,
  assetTitle,
}) => {
  const currentMaterial: MaterialCustomization = options.materials || {
    preset: 'default',
    color: '#cbd5e1',
    metalness: 0.5,
    roughness: 0.4,
    emissiveColor: '#000000',
    emissiveIntensity: 0.0,
    clearcoat: 0.0,
    transmission: 0.0,
    ior: 1.5,
    wireframeOverlay: options.wireframeOverlay || false,
    proceduralPattern: 'none',
  };

  const updateMaterial = (patch: Partial<MaterialCustomization>) => {
    onOptionsChange({
      ...options,
      materials: {
        ...currentMaterial,
        ...patch,
      },
    });
  };

  const materialPresets: Array<{
    id: MaterialCustomization['preset'];
    name: string;
    color: string;
    metalness: number;
    roughness: number;
    emissiveColor: string;
    emissiveIntensity: number;
    clearcoat: number;
    transmission?: number;
    ior?: number;
    proceduralPattern?: MaterialCustomization['proceduralPattern'];
  }> = [
    {
      id: 'default',
      name: 'Original GLB',
      color: '#cbd5e1',
      metalness: 0.4,
      roughness: 0.5,
      emissiveColor: '#000000',
      emissiveIntensity: 0,
      clearcoat: 0,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'titanium',
      name: 'Titanium Alloy',
      color: '#e2e8f0',
      metalness: 0.95,
      roughness: 0.15,
      emissiveColor: '#000000',
      emissiveIntensity: 0,
      clearcoat: 0.8,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'cyberpunk-neon',
      name: 'Cyberpunk Neon',
      color: '#0f172a',
      metalness: 0.3,
      roughness: 0.25,
      emissiveColor: '#06b6d4',
      emissiveIntensity: 2.5,
      clearcoat: 0.4,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'frosted-glass',
      name: 'Frosted Glass',
      color: '#ffffff',
      metalness: 0.05,
      roughness: 0.15,
      emissiveColor: '#000000',
      emissiveIntensity: 0,
      clearcoat: 1.0,
      transmission: 0.92,
      ior: 1.52,
      proceduralPattern: 'none',
    },
    {
      id: 'emerald-gem',
      name: 'Emerald Gem',
      color: '#10b981',
      metalness: 0.1,
      roughness: 0.05,
      emissiveColor: '#059669',
      emissiveIntensity: 0.4,
      clearcoat: 1.0,
      transmission: 0.78,
      ior: 1.58,
      proceduralPattern: 'none',
    },
    {
      id: 'hologram',
      name: 'Cyber Hologram',
      color: '#06b6d4',
      metalness: 0.2,
      roughness: 0.1,
      emissiveColor: '#22d3ee',
      emissiveIntensity: 2.2,
      clearcoat: 0.8,
      transmission: 0.65,
      ior: 1.25,
      proceduralPattern: 'tech-circuit',
    },
    {
      id: 'obsidian',
      name: 'Obsidian Crystal',
      color: '#09090b',
      metalness: 0.85,
      roughness: 0.05,
      emissiveColor: '#10b981',
      emissiveIntensity: 0.5,
      clearcoat: 1.0,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'gold',
      name: '24K Polished Gold',
      color: '#fbbf24',
      metalness: 0.98,
      roughness: 0.12,
      emissiveColor: '#d97706',
      emissiveIntensity: 0.2,
      clearcoat: 0.6,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'iridescent',
      name: 'Holo Iridescent',
      color: '#f43f5e',
      metalness: 0.75,
      roughness: 0.18,
      emissiveColor: '#a855f7',
      emissiveIntensity: 1.8,
      clearcoat: 0.9,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'none',
    },
    {
      id: 'matte-carbon',
      name: 'Stealth Carbon',
      color: '#18181b',
      metalness: 0.1,
      roughness: 0.88,
      emissiveColor: '#000000',
      emissiveIntensity: 0,
      clearcoat: 0.0,
      transmission: 0,
      ior: 1.5,
      proceduralPattern: 'carbon-weave',
    },
  ];

  const proceduralPatterns: Array<{
    id: NonNullable<MaterialCustomization['proceduralPattern']>;
    label: string;
    description: string;
  }> = [
    { id: 'none', label: 'Solid', description: 'Native GLB/Color' },
    { id: 'checker', label: 'Studio Grid', description: 'Calibration check' },
    { id: 'hex-armor', label: 'Hex Armor', description: 'Sci-fi plating' },
    { id: 'carbon-weave', label: 'Carbon Weave', description: 'Composite weave' },
    { id: 'tech-circuit', label: 'Tech Circuit', description: 'Cyber traces' },
  ];

  const lightingPresets: Array<{
    id: ViewerOptions['lightingPreset'];
    label: string;
    desc: string;
    iconColor: string;
  }> = [
    { id: 'studio', label: 'Studio 3-Point', desc: 'Neutral studio softbox', iconColor: 'text-amber-400' },
    { id: 'cyberpunk', label: 'Cyberpunk Neon', desc: 'Cyan & Magenta rim lights', iconColor: 'text-cyan-400' },
    { id: 'sunset', label: 'Sunset Golden', desc: 'Warm directional dusk', iconColor: 'text-orange-400' },
    { id: 'space', label: 'Deep Space', desc: 'High-contrast specular void', iconColor: 'text-indigo-400' },
  ];

  const colorSwatches = [
    '#ffffff', '#94a3b8', '#0f172a', '#ef4444', 
    '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'
  ];

  return (
    <div className="flex flex-col gap-4 text-xs text-slate-300 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white text-xs uppercase tracking-wider">
            Material & PBR Shaders
          </span>
        </div>
        <button
          onClick={() => {
            const def = materialPresets[0];
            updateMaterial({
              preset: 'default',
              color: def.color,
              metalness: def.metalness,
              roughness: def.roughness,
              emissiveColor: def.emissiveColor,
              emissiveIntensity: def.emissiveIntensity,
              clearcoat: def.clearcoat,
              transmission: 0,
              ior: 1.5,
              wireframeOverlay: false,
              proceduralPattern: 'none',
            });
            onOptionsChange({
              ...options,
              wireframeOverlay: false,
              lightAngle: 45,
            });
          }}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          title="Reset Material to Defaults"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Quick Material Presets */}
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          PBR Shader & Refraction Presets
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {materialPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                updateMaterial({
                  preset: p.id,
                  color: p.color,
                  metalness: p.metalness,
                  roughness: p.roughness,
                  emissiveColor: p.emissiveColor,
                  emissiveIntensity: p.emissiveIntensity,
                  clearcoat: p.clearcoat,
                  transmission: p.transmission ?? 0,
                  ior: p.ior ?? 1.5,
                  proceduralPattern: p.proceduralPattern || 'none',
                });
              }}
              className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 ${
                currentMaterial.preset === p.id
                  ? 'bg-amber-950/40 border-amber-500/70 text-amber-300 shadow-sm shadow-amber-950'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div 
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-inner"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[11px] font-medium truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Procedural Texture Pattern Overlay */}
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-cyan-400" />
          Procedural Texture Patterns
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {proceduralPatterns.map((pat) => {
            const isActive = (currentMaterial.proceduralPattern || 'none') === pat.id;
            return (
              <button
                key={pat.id}
                onClick={() => updateMaterial({ proceduralPattern: pat.id })}
                className={`p-1.5 rounded-lg border text-center transition-all ${
                  isActive
                    ? 'bg-cyan-950/50 border-cyan-500/80 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title={pat.description}
              >
                <div className="text-[10px] font-medium truncate">{pat.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Base Color & Swatches */}
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
          Base Albedo Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentMaterial.color}
            onChange={(e) => updateMaterial({ color: e.target.value, preset: 'default' })}
            className="w-8 h-8 rounded-lg cursor-pointer bg-slate-900 border border-slate-800 p-0.5"
            title="Custom Color Picker"
          />
          <div className="flex flex-wrap items-center gap-1">
            {colorSwatches.map((c) => (
              <button
                key={c}
                onClick={() => updateMaterial({ color: c, preset: 'default' })}
                className="w-5 h-5 rounded-full border border-slate-700/80 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Physical Material & Refractive Optics Controls */}
      <div className="space-y-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
        {/* Metalness */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Metalness</span>
            <span className="font-mono text-amber-400">{(currentMaterial.metalness * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={currentMaterial.metalness}
            onChange={(e) => updateMaterial({ metalness: parseFloat(e.target.value), preset: 'default' })}
            className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Roughness */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Roughness</span>
            <span className="font-mono text-amber-400">{(currentMaterial.roughness * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={currentMaterial.roughness}
            onChange={(e) => updateMaterial({ roughness: parseFloat(e.target.value), preset: 'default' })}
            className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Clearcoat Gloss */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Clearcoat Gloss</span>
            <span className="font-mono text-cyan-400">{(currentMaterial.clearcoat * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={currentMaterial.clearcoat}
            onChange={(e) => updateMaterial({ clearcoat: parseFloat(e.target.value), preset: 'default' })}
            className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Transmission (Glass & Gem Refraction) */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Transmission (Refraction)</span>
            <span className="font-mono text-emerald-400">{((currentMaterial.transmission || 0) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={currentMaterial.transmission || 0}
            onChange={(e) => updateMaterial({ transmission: parseFloat(e.target.value), preset: 'default' })}
            className="w-full accent-emerald-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Index of Refraction (IOR) */}
        {(currentMaterial.transmission || 0) > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">Index of Refraction (IOR)</span>
              <span className="font-mono text-emerald-400">{(currentMaterial.ior || 1.5).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={2.4}
              step={0.02}
              value={currentMaterial.ior || 1.5}
              onChange={(e) => updateMaterial({ ior: parseFloat(e.target.value), preset: 'default' })}
              className="w-full accent-emerald-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        )}

        {/* Emissive Intensity */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Emissive Neon Glow</span>
            <span className="font-mono text-cyan-400">{currentMaterial.emissiveIntensity.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentMaterial.emissiveColor || '#06b6d4'}
              onChange={(e) => updateMaterial({ emissiveColor: e.target.value, preset: 'default' })}
              className="w-6 h-6 rounded cursor-pointer bg-slate-900 border border-slate-800 p-0"
              title="Emissive Glow Color"
            />
            <input
              type="range"
              min={0}
              max={4}
              step={0.1}
              value={currentMaterial.emissiveIntensity}
              onChange={(e) => updateMaterial({ emissiveIntensity: parseFloat(e.target.value), preset: 'default' })}
              className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Wireframe Overlay Toggle */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 text-[11px]">Wireframe Topology Overlay</span>
          </div>
          <button
            onClick={() => {
              const nextVal = !(options.wireframeOverlay || currentMaterial.wireframeOverlay);
              updateMaterial({ wireframeOverlay: nextVal });
              onOptionsChange({ ...options, wireframeOverlay: nextVal });
            }}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
              (options.wireframeOverlay || currentMaterial.wireframeOverlay) ? 'bg-amber-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                (options.wireframeOverlay || currentMaterial.wireframeOverlay) ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 5. Studio Environment Lighting & Sun Gizmo */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase font-bold text-slate-500">
              Studio Lighting Environment
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          {lightingPresets.map((l) => (
            <button
              key={l.id}
              onClick={() => onOptionsChange({ ...options, lightingPreset: l.id })}
              className={`p-2 rounded-xl text-left border transition-all ${
                options.lightingPreset === l.id
                  ? 'bg-indigo-950/50 border-indigo-500/70 text-white shadow-sm'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[11px] font-semibold block">{l.label}</span>
              <span className="text-[9px] text-slate-500">{l.desc}</span>
            </button>
          ))}
        </div>

        {/* Key Light Orbit Slider */}
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 mb-2">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-amber-400" />
              Key Light Orbit Angle
            </span>
            <span className="font-mono text-amber-400">{Math.round(options.lightAngle ?? 45)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={options.lightAngle ?? 45}
            onChange={(e) => onOptionsChange({ ...options, lightAngle: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* 3-Point Light Rig Customizer */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-800/80">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              Custom 3-Point Light Rig
            </span>
            <button
              onClick={() => {
                onOptionsChange({
                  ...options,
                  lightingRig: {
                    keyColor: '#ffffff',
                    keyIntensity: 2.4,
                    fillColor: '#94a3b8',
                    fillIntensity: 1.2,
                    rimColor: '#38bdf8',
                    rimIntensity: 1.4,
                    shadows: true,
                    showLightGizmos: false,
                  },
                });
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Reset Rig
            </button>
          </div>

          {/* Key Light */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Key Light (Main)</span>
              <span className="font-mono text-amber-400">
                {(options.lightingRig?.keyIntensity ?? 2.4).toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={options.lightingRig?.keyColor || '#ffffff'}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), keyColor: e.target.value },
                  })
                }
                className="w-5 h-5 rounded cursor-pointer bg-slate-900 border border-slate-800 p-0"
                title="Key Light Color"
              />
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={options.lightingRig?.keyIntensity ?? 2.4}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), keyIntensity: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Fill Light */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Fill Light (Softening)</span>
              <span className="font-mono text-cyan-400">
                {(options.lightingRig?.fillIntensity ?? 1.2).toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={options.lightingRig?.fillColor || '#94a3b8'}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), fillColor: e.target.value },
                  })
                }
                className="w-5 h-5 rounded cursor-pointer bg-slate-900 border border-slate-800 p-0"
                title="Fill Light Color"
              />
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={options.lightingRig?.fillIntensity ?? 1.2}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), fillIntensity: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Rim Light */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Rim / Edge Backlight</span>
              <span className="font-mono text-sky-400">
                {(options.lightingRig?.rimIntensity ?? 1.4).toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={options.lightingRig?.rimColor || '#38bdf8'}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), rimColor: e.target.value },
                  })
                }
                className="w-5 h-5 rounded cursor-pointer bg-slate-900 border border-slate-800 p-0"
                title="Rim Light Color"
              />
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={options.lightingRig?.rimIntensity ?? 1.4}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), rimIntensity: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-sky-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Shadow & Gizmo Toggles */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={options.lightingRig?.shadows !== false}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), shadows: e.target.checked },
                  })
                }
                className="rounded accent-amber-400"
              />
              <span>Cast Shadows</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(options.lightingRig?.showLightGizmos)}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    lightingRig: { ...(options.lightingRig || {}), showLightGizmos: e.target.checked },
                  })
                }
                className="rounded accent-cyan-400"
              />
              <span>Light Gizmos</span>
            </label>
          </div>
        </div>
      </div>

      {/* 5.5. Real-Time IBL Environment & HDR Reflections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] uppercase font-bold text-slate-500">
              HDR Environment & IBL Reflections
            </span>
          </div>
          <button
            onClick={() => {
              onOptionsChange({
                ...options,
                environment: {
                  preset: 'studio-softbox',
                  intensity: 1.2,
                  rotation: 0,
                  showSkybox: false,
                  groundShadow: true,
                  groundShadowOpacity: 0.75,
                },
              });
            }}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Reset IBL
          </button>
        </div>

        {/* Environment Preset Pills */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'studio-softbox' as EnvironmentPreset, label: 'Softbox', color: '#f8fafc' },
            { id: 'cyber-neon' as EnvironmentPreset, label: 'Cyber Neon', color: '#06b6d4' },
            { id: 'sunset-radiance' as EnvironmentPreset, label: 'Sunset', color: '#f59e0b' },
            { id: 'industrial-loft' as EnvironmentPreset, label: 'Loft', color: '#f97316' },
            { id: 'deep-cosmos' as EnvironmentPreset, label: 'Cosmos', color: '#818cf8' },
            { id: 'neutral' as EnvironmentPreset, label: 'Daylight', color: '#e2e8f0' },
          ].map((env) => {
            const isSelected = (options.environment?.preset || 'studio-softbox') === env.id;
            return (
              <button
                key={env.id}
                onClick={() =>
                  onOptionsChange({
                    ...options,
                    environment: {
                      ...(options.environment || {
                        intensity: 1.2,
                        rotation: 0,
                        showSkybox: false,
                        groundShadow: true,
                        groundShadowOpacity: 0.75,
                      }),
                      preset: env.id,
                    },
                  })
                }
                className={`p-2 rounded-xl text-left border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-950/50 border-sky-500/70 text-sky-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: env.color }}
                />
                <span className="text-[10px] font-semibold truncate">{env.label}</span>
              </button>
            );
          })}
        </div>

        {/* IBL Intensity & Rotation Sliders */}
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
          {/* Intensity */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Reflection Intensity</span>
              <span className="font-mono text-sky-400">
                {(options.environment?.intensity ?? 1.2).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3.0}
              step={0.1}
              value={options.environment?.intensity ?? 1.2}
              onChange={(e) =>
                onOptionsChange({
                  ...options,
                  environment: {
                    ...(options.environment || {
                      preset: 'studio-softbox',
                      rotation: 0,
                      showSkybox: false,
                      groundShadow: true,
                    }),
                    intensity: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-sky-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Environment Rotation */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Environment Rotation</span>
              <span className="font-mono text-amber-400">
                {options.environment?.rotation ?? 0}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={options.environment?.rotation ?? 0}
              onChange={(e) =>
                onOptionsChange({
                  ...options,
                  environment: {
                    ...(options.environment || {
                      preset: 'studio-softbox',
                      intensity: 1.2,
                      showSkybox: false,
                      groundShadow: true,
                    }),
                    rotation: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Skybox Background & Ground Shadow Toggles */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(options.environment?.showSkybox)}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    environment: {
                      ...(options.environment || {
                        preset: 'studio-softbox',
                        intensity: 1.2,
                        rotation: 0,
                        groundShadow: true,
                      }),
                      showSkybox: e.target.checked,
                    },
                  })
                }
                className="rounded accent-sky-400"
              />
              <span>Render Skybox 360</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={options.environment?.groundShadow !== false}
                onChange={(e) =>
                  onOptionsChange({
                    ...options,
                    environment: {
                      ...(options.environment || {
                        preset: 'studio-softbox',
                        intensity: 1.2,
                        rotation: 0,
                        showSkybox: false,
                      }),
                      groundShadow: e.target.checked,
                    },
                  })
                }
                className="rounded accent-emerald-400"
              />
              <span>Contact Shadow</span>
            </label>
          </div>
        </div>
      </div>

      {/* 6. Studio Backdrop & Cyc Environment */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Studio Backdrop & Cyc Wall
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'void' as StudioBackdrop, label: 'Deep Void', desc: 'Clean dark backdrop' },
            { id: 'studio-vignette' as StudioBackdrop, label: 'Studio Cyc', desc: 'Radial spotlight vignette' },
            { id: 'cyber-grid' as StudioBackdrop, label: 'Cyber Grid', desc: 'Tron luminescent matrix' },
            { id: 'warm-sunset' as StudioBackdrop, label: 'Warm Dusk', desc: 'Amber atmospheric glow' },
            { id: 'blueprint' as StudioBackdrop, label: 'CAD Blueprint', desc: 'Technical engineering grid' },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => onOptionsChange({ ...options, studioBackdrop: b.id })}
              className={`p-2 rounded-xl text-left border transition-all ${
                (options.studioBackdrop || 'void') === b.id
                  ? 'bg-cyan-950/50 border-cyan-500/70 text-white shadow-sm'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[11px] font-semibold block">{b.label}</span>
              <span className="text-[9px] text-slate-500">{b.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 7. Tone Mapping & Color Science */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Film className="w-3.5 h-3.5 text-lime-400" />
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Color Science & Tone Mapping
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'aces' as ToneMappingMode, label: 'ACES Filmic' },
            { id: 'agx' as ToneMappingMode, label: 'AgX Gamut' },
            { id: 'neutral' as ToneMappingMode, label: 'Neutral PBR' },
            { id: 'cineon' as ToneMappingMode, label: 'Cineon Log' },
            { id: 'reinhard' as ToneMappingMode, label: 'Reinhard' },
            { id: 'linear' as ToneMappingMode, label: 'Linear Raw' },
          ].map((tm) => (
            <button
              key={tm.id}
              onClick={() => onOptionsChange({ ...options, toneMapping: tm.id })}
              className={`p-1.5 rounded-lg border text-center transition-all ${
                (options.toneMapping || 'aces') === tm.id
                  ? 'bg-lime-950/50 border-lime-500/70 text-lime-300 font-semibold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] truncate">{tm.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 8. Procedural Presentation Motion */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Play className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Presentation Motion & Turntable
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'hover-float' as MotionMode, label: 'Hover Float', desc: 'Sine-wave levitation & roll' },
            { id: 'turntable-spin' as MotionMode, label: '360° Turntable', desc: 'Smooth continuous orbit' },
            { id: 'cinematic-pulse' as MotionMode, label: 'Cinematic Pulse', desc: 'Harmonic breathing scale' },
            { id: 'none' as MotionMode, label: 'Static Lock', desc: 'Fixed coordinates' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => onOptionsChange({ ...options, motionMode: m.id })}
              className={`p-2 rounded-xl text-left border transition-all ${
                (options.motionMode || 'hover-float') === m.id
                  ? 'bg-amber-950/50 border-amber-500/70 text-amber-300 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[11px] font-semibold block">{m.label}</span>
              <span className="text-[9px] text-slate-500">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 9. Snapshot & Capture Studio */}
      <div className="pt-2 border-t border-slate-800">
        <button
          onClick={onCaptureSnapshot}
          title={assetTitle ? `Open Render Studio for ${assetTitle}` : 'Open Render Studio'}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-[0.99] transition-all"
        >
          <Camera className="w-4 h-4 fill-slate-950" />
          <span>Open High-Res Render Studio</span>
        </button>
      </div>
    </div>
  );
};
