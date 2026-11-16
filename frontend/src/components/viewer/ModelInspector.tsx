import React, { useState } from 'react';
import type { Asset, ViewerOptions, TransformData } from '../../types';
import { api } from '../../api/client';
import { 
  Download, 
  Box, 
  Layers, 
  Maximize2, 
  Tag, 
  Info, 
  Cpu, 
  Palette, 
  Archive, 
  Camera, 
  Trash2, 
  Sliders, 
  RotateCcw, 
  Move,
  RotateCw,
  Scale
} from 'lucide-react';
import { MaterialShaderStudio } from '../studio/MaterialShaderStudio';

interface ModelInspectorProps {
  asset?: Asset | null;
  liveStats?: {
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
  };
  options?: ViewerOptions;
  onOptionsChange?: (options: ViewerOptions) => void;
  onCaptureSnapshot?: () => void;
  onDeleteAsset?: (assetId: string) => void;
  transformData?: TransformData;
  explodeFactor?: number;
  onExplodeChange?: (factor: number) => void;
  onResetTransform?: () => void;
}

export const ModelInspector: React.FC<ModelInspectorProps> = ({ 
  asset, 
  liveStats,
  options,
  onOptionsChange,
  onCaptureSnapshot,
  onDeleteAsset,
  transformData = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  explodeFactor = 0,
  onExplodeChange,
  onResetTransform
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'shaders' | 'transforms'>('info');

  if (!asset) {
    return (
      <div className="p-4 bg-slate-900/90 border border-slate-800/80 rounded-xl backdrop-blur-md text-xs text-slate-400">
        <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Model Inspector</span>
        </div>
        <p className="text-slate-500">Select or generate an asset to inspect topology, PBR materials, and export options.</p>
      </div>
    );
  }

  const polyCount = liveStats?.polyCount || asset.poly_count;
  const vertexCount = liveStats?.vertexCount || asset.vertex_count;

  return (
    <div className="p-4 bg-slate-900/90 border border-slate-800/80 rounded-xl backdrop-blur-md text-xs flex flex-col gap-4 text-slate-300">
      {/* Tab Switcher: Info vs Shaders */}
      <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'info'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-3.5 h-3.5 text-cyan-400" />
          <span>Geometry</span>
        </button>
        <button
          onClick={() => setActiveTab('shaders')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'shaders'
              ? 'bg-amber-950/50 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>Shaders</span>
        </button>
        <button
          onClick={() => setActiveTab('transforms')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'transforms'
              ? 'bg-lime-950/50 text-lime-300 border border-lime-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-lime-400" />
          <span>Transform</span>
        </button>
      </div>

      {activeTab === 'shaders' && options && onOptionsChange && (
        <MaterialShaderStudio
          options={options}
          onOptionsChange={onOptionsChange}
          onCaptureSnapshot={onCaptureSnapshot || (() => {})}
          assetTitle={asset.title}
        />
      )}

      {activeTab === 'transforms' && (
        <div className="flex flex-col gap-4">
          {/* Explode Assembly Section */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Explode Assembly
              </span>
              <span className="font-mono font-bold text-amber-400">
                {Math.round(explodeFactor * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Disassembles submeshes along their radial bounding vectors for internal topological inspection.
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explodeFactor}
              onChange={(e) => onExplodeChange?.(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (Packed)</span>
              <button
                onClick={() => onExplodeChange?.(0)}
                className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
              >
                Reset Assembly
              </button>
              <span>100% (Exploded)</span>
            </div>
          </div>

          {/* Real-time Transform Coordinates Readout */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-lime-400" />
                Transform Coordinates
              </span>
              {onResetTransform && (
                <button
                  onClick={onResetTransform}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                  title="Reset coordinates to origin"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {/* Translation */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Move className="w-3 h-3 text-cyan-400" />
                  Position
                </span>
                <span className="text-slate-200">
                  X: {transformData.position[0]} | Y: {transformData.position[1]} | Z: {transformData.position[2]}
                </span>
              </div>

              {/* Rotation */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 text-green-400" />
                  Rotation (deg)
                </span>
                <span className="text-slate-200">
                  {transformData.rotation[0]}° | {transformData.rotation[1]}° | {transformData.rotation[2]}°
                </span>
              </div>

              {/* Scale */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Scale className="w-3 h-3 text-amber-400" />
                  Scale
                </span>
                <span className="text-slate-200">
                  {transformData.scale[0]}x | {transformData.scale[1]}x | {transformData.scale[2]}x
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 leading-normal">
              Use viewport gizmo handles or hotkeys (<kbd className="text-slate-300">G</kbd> Move, <kbd className="text-slate-300">R</kbd> Rotate, <kbd className="text-slate-300">S</kbd> Scale) to adjust coordinates interactively.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <>
          {/* Header Info */}
          <div className="border-b border-slate-800/80 pb-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm text-white truncate" title={asset.title}>
                {asset.title}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                  asset.is_demo
                    ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                    : 'bg-indigo-950/70 border border-indigo-500/40 text-indigo-300'
                }`}
              >
                {asset.is_demo ? 'Demo Core' : asset.provider}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed" title={asset.prompt}>
              "{asset.prompt}"
            </p>
          </div>

          {/* Geometry Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider">Polygons</span>
              </div>
              <span className="text-sm font-semibold text-white">{polyCount.toLocaleString()}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider">Vertices</span>
              </div>
              <span className="text-sm font-semibold text-white">{vertexCount.toLocaleString()}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider">Size (Units)</span>
              </div>
              <span className="text-xs font-mono text-slate-200">
                {liveStats ? `${liveStats.dimensions.x} × ${liveStats.dimensions.y} × ${liveStats.dimensions.z}` : '—'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase tracking-wider">File Size</span>
              </div>
              <span className="text-xs font-mono text-slate-200">
                {(asset.file_size_bytes / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <Tag className="w-3 h-3 text-slate-500 mr-1" />
              {asset.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-400"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Export & Download Buttons */}
          <div className="border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between text-slate-400 mb-2 font-medium">
              <div className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Formats</span>
              </div>
              {onCaptureSnapshot && (
                <button
                  onClick={onCaptureSnapshot}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                  title="Capture Viewport Screenshot"
                >
                  <Camera className="w-3 h-3" />
                  <span>Snapshot</span>
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <a
                href={api.getDownloadUrl(asset.id, 'glb')}
                download={`${asset.id}.glb`}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all font-medium text-center"
              >
                <span className="text-xs font-bold tracking-wider">GLB</span>
                <span className="text-[9px] text-cyan-400/70">glTF Binary</span>
              </a>

              <a
                href={api.getDownloadUrl(asset.id, 'obj')}
                download={`${asset.id}.obj`}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all font-medium text-center"
              >
                <span className="text-xs font-bold tracking-wider">OBJ</span>
                <span className="text-[9px] text-slate-400">Wavefront</span>
              </a>

              <a
                href={api.getDownloadUrl(asset.id, 'stl')}
                download={`${asset.id}.stl`}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all font-medium text-center"
              >
                <span className="text-xs font-bold tracking-wider">STL</span>
                <span className="text-[9px] text-slate-400">3D Printing</span>
              </a>
            </div>

            {/* All-in-One ZIP Bundle Download Button */}
            <a
              href={api.getBundleUrl(asset.id)}
              download={`PolyGen_${asset.id}_bundle.zip`}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
              title="Download ZIP package with GLB, OBJ, STL, and manifest.json"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Asset Bundle (.ZIP)</span>
            </a>

            {onDeleteAsset && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${asset.title}"?`)) {
                    onDeleteAsset(asset.id);
                  }
                }}
                className="w-full py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 font-medium flex items-center justify-center gap-1.5 transition-colors mt-2"
                title="Delete this 3D model from storage"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Asset</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
export default ModelInspector;
