import React from 'react';
import type { Asset } from '../../types';
import { api } from '../../api/client';
import { Download, Box, Layers, Maximize2, Tag, Info, Cpu } from 'lucide-react';

interface ModelInspectorProps {
  asset?: Asset | null;
  liveStats?: {
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
  };
}

export const ModelInspector: React.FC<ModelInspectorProps> = ({ asset, liveStats }) => {
  if (!asset) {
    return (
      <div className="p-4 bg-slate-900/90 border border-slate-800/80 rounded-xl backdrop-blur-md text-xs text-slate-400">
        <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Model Inspector</span>
        </div>
        <p className="text-slate-500">Select or generate an asset to inspect topology and export options.</p>
      </div>
    );
  }

  const polyCount = liveStats?.polyCount || asset.poly_count;
  const vertexCount = liveStats?.vertexCount || asset.vertex_count;

  return (
    <div className="p-4 bg-slate-900/90 border border-slate-800/80 rounded-xl backdrop-blur-md text-xs flex flex-col gap-4 text-slate-300">
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
        <div className="flex items-center gap-1.5 text-slate-400 mb-2 font-medium">
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Asset</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
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
      </div>
    </div>
  );
};
