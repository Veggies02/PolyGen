import React from 'react';
import type { ViewerOptions } from '../../types';
import { 
  Grid, 
  RotateCw, 
  Layers, 
  Sun, 
  Palette, 
  RotateCcw,
  Box
} from 'lucide-react';

interface ViewerControlsProps {
  options: ViewerOptions;
  onChange: (options: ViewerOptions) => void;
  onResetView?: () => void;
}

export const ViewerControls: React.FC<ViewerControlsProps> = ({
  options,
  onChange,
  onResetView,
}) => {
  const shadingModes: { id: ViewerOptions['shadingMode']; label: string }[] = [
    { id: 'pbr', label: 'PBR Shaded' },
    { id: 'clay', label: 'Clay Matte' },
    { id: 'normals', label: 'Normals' },
    { id: 'face-orientation', label: 'Face Orientation' },
    { id: 'curvature', label: 'Curvature Heatmap' },
    { id: 'wireframe', label: 'Wireframe' },
  ];

  const lightingPresets: { id: ViewerOptions['lightingPreset']; label: string }[] = [
    { id: 'studio', label: 'Studio Neutral' },
    { id: 'cyberpunk', label: 'Cyberpunk Neon' },
    { id: 'dramatic', label: 'Dramatic Key' },
    { id: 'soft', label: 'Soft Ambient' },
  ];

  const backgroundColors = [
    { id: '#0c0e14', label: 'Charcoal' },
    { id: '#141824', label: 'Slate' },
    { id: '#050608', label: 'Pitch Black' },
    { id: '#202533', label: 'Deep Blue' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl text-xs text-slate-300">
      {/* Grid Toggle */}
      <button
        onClick={() => onChange({ ...options, grid: !options.grid })}
        title="Toggle Ground Grid"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
          options.grid
            ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Grid className="w-3.5 h-3.5" />
        <span className="font-medium">Grid</span>
      </button>

      {/* Wireframe Overlay Toggle */}
      <button
        onClick={() => onChange({ ...options, wireframe: !options.wireframe })}
        title="Toggle Wireframe Overlay"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
          options.wireframe
            ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Box className="w-3.5 h-3.5" />
        <span className="font-medium">Wireframe</span>
      </button>

      {/* Auto Rotate Toggle */}
      <button
        onClick={() => onChange({ ...options, autoRotate: !options.autoRotate })}
        title="Toggle 360° Turntable Rotation"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
          options.autoRotate
            ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        <RotateCw className={`w-3.5 h-3.5 ${options.autoRotate ? 'animate-spin' : ''}`} />
        <span className="font-medium">Turntable</span>
      </button>

      <div className="w-px h-5 bg-slate-800 mx-1" />

      {/* Shading Mode */}
      <div className="flex items-center gap-1">
        <Layers className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
        <select
          value={options.shadingMode}
          onChange={(e) => onChange({ ...options, shadingMode: e.target.value as any })}
          className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
        >
          {shadingModes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lighting Presets */}
      <div className="flex items-center gap-1">
        <Sun className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
        <select
          value={options.lightingPreset}
          onChange={(e) => onChange({ ...options, lightingPreset: e.target.value as any })}
          className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
        >
          {lightingPresets.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Background Color Swatches */}
      <div className="flex items-center gap-1">
        <Palette className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
        <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700/50">
          {backgroundColors.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onChange({ ...options, backgroundColor: bg.id })}
              title={`Background: ${bg.label}`}
              className={`w-4 h-4 rounded-full border transition-all ${
                options.backgroundColor === bg.id ? 'border-cyan-400 scale-110 shadow-sm' : 'border-slate-600 opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: bg.id }}
            />
          ))}
        </div>
      </div>

      {/* Reset Camera View */}
      {onResetView && (
        <button
          onClick={onResetView}
          title="Reset Camera Framing"
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset View</span>
        </button>
      )}
    </div>
  );
};
