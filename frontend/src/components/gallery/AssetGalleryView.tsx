import React, { useState, useMemo } from 'react';
import type { Asset } from '../../types';
import { api } from '../../api/client';
import { 
  Search, 
  Box, 
  Download, 
  Tag, 
  Calendar, 
  Layers, 
  X, 
  ArrowRight,
  Maximize2
} from 'lucide-react';

interface AssetGalleryViewProps {
  assets: Asset[];
  onInspectAsset: (asset: Asset) => void;
}

export const AssetGalleryView: React.FC<AssetGalleryViewProps> = ({ assets, onInspectAsset }) => {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => a.tags?.forEach((t) => set.add(t.toLowerCase())));
    return ['all', ...Array.from(set)];
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch =
        search.trim() === '' ||
        asset.title.toLowerCase().includes(search.toLowerCase()) ||
        asset.prompt.toLowerCase().includes(search.toLowerCase());

      const matchesTag =
        selectedTag === 'all' ||
        asset.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase());

      return matchesSearch && matchesTag;
    });
  }, [assets, search, selectedTag]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full text-slate-200">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search generated 3D models by title, keyword or prompt..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                selectedTag === tag
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm shadow-cyan-500/30'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      {filteredAssets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-2">
          <Box className="w-10 h-10 text-slate-600 mb-1" />
          <h3 className="text-base font-semibold text-slate-300">No 3D models found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search query or generate a new asset in the Text-to-3D Studio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="group flex flex-col justify-between p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-950/20 transition-all"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3
                    className="font-semibold text-sm text-white truncate max-w-[180px] group-hover:text-cyan-300 transition-colors cursor-pointer"
                    onClick={() => setSelectedAsset(asset)}
                    title={asset.title}
                  >
                    {asset.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                      asset.is_demo
                        ? 'bg-emerald-950/70 border border-emerald-500/30 text-emerald-300'
                        : 'bg-indigo-950/70 border border-indigo-500/30 text-indigo-300'
                    }`}
                  >
                    {asset.is_demo ? 'Demo' : asset.provider}
                  </span>
                </div>

                <p
                  className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed mb-3 cursor-pointer"
                  onClick={() => setSelectedAsset(asset)}
                  title={asset.prompt}
                >
                  "{asset.prompt}"
                </p>
              </div>

              {/* Geometry Stats */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-slate-300 font-mono">
                  <div className="flex items-center gap-1">
                    <Box className="w-3 h-3 text-cyan-400" />
                    <span>{asset.poly_count.toLocaleString()} F</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span>{asset.vertex_count.toLocaleString()} V</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => onInspectAsset(asset)}
                    className="flex-1 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Open in 3D Studio</span>
                  </button>

                  <button
                    onClick={() => setSelectedAsset(asset)}
                    title="Asset Details & Downloads"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-200">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title & Provider */}
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold text-white">{selectedAsset.title}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                {selectedAsset.is_demo ? 'Demo Core Engine' : selectedAsset.provider}
              </span>
            </div>

            {/* Prompt */}
            <div className="p-3 my-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 italic font-serif">
              "{selectedAsset.prompt}"
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-3 gap-2.5 my-4">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-0.5 font-sans">
                  Polygons
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {selectedAsset.poly_count.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-0.5 font-sans">
                  Vertices
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {selectedAsset.vertex_count.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-0.5 font-sans">
                  Size
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {(selectedAsset.file_size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            {/* Tags & Creation Date */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 py-3 border-y border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                {selectedAsset.tags?.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-slate-800/70 text-[11px] text-slate-300">
                    #{t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(selectedAsset.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Download Links */}
            <div className="my-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Download Model Files
              </span>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={api.getDownloadUrl(selectedAsset.id, 'glb')}
                  download={`${selectedAsset.id}.glb`}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all font-medium text-center"
                >
                  <Download className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">GLB</span>
                  <span className="text-[10px] text-cyan-400/70">glTF 2.0 Binary</span>
                </a>

                <a
                  href={api.getDownloadUrl(selectedAsset.id, 'obj')}
                  download={`${selectedAsset.id}.obj`}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all font-medium text-center"
                >
                  <Download className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">OBJ</span>
                  <span className="text-[10px] text-slate-400">Wavefront Mesh</span>
                </a>

                <a
                  href={api.getDownloadUrl(selectedAsset.id, 'stl')}
                  download={`${selectedAsset.id}.stl`}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all font-medium text-center"
                >
                  <Download className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold">STL</span>
                  <span className="text-[10px] text-slate-400">3D Printing STL</span>
                </a>
              </div>
            </div>

            {/* Open in 3D Studio Action */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => {
                  onInspectAsset(selectedAsset);
                  setSelectedAsset(null);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-semibold text-xs tracking-wider uppercase shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Box className="w-4 h-4" />
                <span>Open in Interactive 3D Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
