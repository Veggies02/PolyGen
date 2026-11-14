import React from 'react';
import type { ViewerOptions, MaterialCustomization } from '../../types';
import { 
  Palette, 
  Sun, 
  Camera, 
  RotateCcw
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
    wireframeOverlay: false,
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
    },
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
              wireframeOverlay: false,
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
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
          PBR Shader Presets
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

      {/* 2. Color & Swatches */}
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

      {/* 3. PBR Sliders */}
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

        {/* Clearcoat */}
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
      </div>

      {/* 4. Studio Environment Lighting */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Studio Lighting Environment
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
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
      </div>

      {/* 5. Snapshot & Capture Studio */}
      <div className="pt-2 border-t border-slate-800">
        <button
          onClick={onCaptureSnapshot}
          title={assetTitle ? `Capture render of ${assetTitle}` : 'Capture Viewport Render'}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-[0.99] transition-all"
        >
          <Camera className="w-4 h-4 fill-slate-950" />
          <span>Capture 4K Viewport Render (.PNG)</span>
        </button>
      </div>
    </div>
  );
};
