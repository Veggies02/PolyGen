import React, { useState, useMemo } from 'react';
import type { Asset } from '../../types';
import { api } from '../../api/client';
import { AssetThumbnail } from './AssetThumbnail';
import { 
  Search, 
  Box, 
  Download, 
  Building2, 
  Car, 
  Package, 
  User, 
  X, 
  ArrowRight, 
  Maximize2, 
  Grid,
  Archive,
  Trash2,
  CheckSquare,
  Check,
  CheckCheck
} from 'lucide-react';

interface AssetGalleryViewProps {
  assets: Asset[];
  onInspectAsset: (asset: Asset) => void;
  onDeleteAsset?: (assetId: string) => void;
}

const GENRES = ['all', 'scifi', 'cyberpunk', 'low-poly', 'realistic', 'organic'];

// Category keyword mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  buildings: ['building', 'house', 'monolith', 'temple', 'station', 'laundry', 'pod', 'tower', 'architecture'],
  vehicles: ['drone', 'car', 'vehicle', 'aircraft', 'ship', 'plane', 'speeder', 'thruster'],
  props: ['crystal', 'gem', 'weapon', 'blaster', 'rifle', 'axe', 'sword', 'helmet', 'visor', 'core', 'gyro', 'relic'],
  characters: ['character', 'mech', 'robot', 'warrior', 'exo', 'cyborg', 'humanoid', 'soldier'],
};

export const AssetGalleryView: React.FC<AssetGalleryViewProps> = ({ 
  assets, 
  onInspectAsset,
  onDeleteAsset 
}) => {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedAccess, setSelectedAccess] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'buildings' | 'vehicles' | 'props' | 'characters'>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [gridZoom, setGridZoom] = useState<number>(4);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAsset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const handleBatchDownloadGlb = () => {
    const targets = assets.filter((a) => selectedIds.has(a.id));
    targets.forEach((a, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = api.getDownloadUrl(a.id, 'glb');
        link.download = `${a.id}.glb`;
        link.click();
      }, idx * 250);
    });
  };

  const handleBatchDownloadZip = () => {
    const targets = assets.filter((a) => selectedIds.has(a.id));
    targets.forEach((a, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = api.getBundleUrl(a.id);
        link.download = `PolyGen_${a.id}_bundle.zip`;
        link.click();
      }, idx * 250);
    });
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. Search text filter
      const matchesSearch =
        search.trim() === '' ||
        asset.title.toLowerCase().includes(search.toLowerCase()) ||
        asset.prompt.toLowerCase().includes(search.toLowerCase());

      // 2. Genre filter
      const matchesGenre =
        selectedGenre === 'all' ||
        asset.style.toLowerCase() === selectedGenre.toLowerCase() ||
        asset.tags?.some((t) => t.toLowerCase() === selectedGenre.toLowerCase());

      // 3. Access filter
      const matchesAccess =
        selectedAccess === 'all' ||
        (selectedAccess === 'demo' && asset.is_demo) ||
        (selectedAccess === 'user' && !asset.is_demo);

      // 4. Left Category Dock filter
      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        const keywords = CATEGORY_KEYWORDS[selectedCategory] || [];
        const fullText = `${asset.title} ${asset.prompt} ${asset.tags?.join(' ')}`.toLowerCase();
        matchesCategory = keywords.some((kw) => fullText.includes(kw));
      }

      return matchesSearch && matchesGenre && matchesAccess && matchesCategory;
    });
  }, [assets, search, selectedGenre, selectedAccess, selectedCategory]);

  const gridColsClass =
    gridZoom === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : gridZoom === 3
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
      : gridZoom === 5
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4';

  return (
    <div className="flex h-full w-full bg-[#0d0f14] text-slate-200 font-sans overflow-hidden">
      {/* 1. LEFT MINI-DOCK (CARGO BY KITBASH3D STYLE) */}
      <aside className="w-14 bg-slate-950 border-r border-slate-800/80 flex flex-col items-center py-4 gap-4 shrink-0 select-none">
        <div 
          onClick={() => { setSelectedCategory('all'); setSelectedGenre('all'); setSearch(''); }}
          title="Reset Filters"
          className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 cursor-pointer flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 transition-all"
        >
          ↗
        </div>

        <div className="w-8 h-px bg-slate-800 my-1" />

        <button
          onClick={() => setSelectedCategory('buildings')}
          title="Buildings & Architecture"
          className={`p-2.5 rounded-xl transition-all ${
            selectedCategory === 'buildings'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSelectedCategory('vehicles')}
          title="Vehicles & Drones"
          className={`p-2.5 rounded-xl transition-all ${
            selectedCategory === 'vehicles'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Car className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSelectedCategory('props')}
          title="Props, Weapons & Artifacts"
          className={`p-2.5 rounded-xl transition-all ${
            selectedCategory === 'props'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSelectedCategory('characters')}
          title="Characters & Mechs"
          className={`p-2.5 rounded-xl transition-all ${
            selectedCategory === 'characters'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
        </button>
      </aside>

      {/* 2. MAIN GALLERY AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* CARGO TOP BAR */}
        <div className="h-14 px-6 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white tracking-tight">3D Models</h1>
            <span className="text-xs text-slate-500 font-mono">({filteredAssets.length})</span>
            {selectedCategory !== 'all' && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <span>{selectedCategory}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('all')} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Multi-Select Toggle */}
            <button
              onClick={() => {
                setIsMultiSelectMode((prev) => !prev);
                if (isMultiSelectMode) setSelectedIds(new Set());
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isMultiSelectMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Multi-Select</span>
            </button>

            {isMultiSelectMode && (
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>{selectedIds.size === filteredAssets.length ? 'Deselect All' : 'Select All'}</span>
              </button>
            )}

            {/* Genre Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-500">Genre:</span>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none capitalize font-medium cursor-pointer"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g} className="bg-slate-900 text-slate-200">
                    {g === 'all' ? 'All Genres' : g}
                  </option>
                ))}
              </select>
            </div>

            {/* Access Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-500">Access:</span>
              <select
                value={selectedAccess}
                onChange={(e) => setSelectedAccess(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none font-medium cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Assets</option>
                <option value="demo" className="bg-slate-900">Demo Library</option>
                <option value="user" className="bg-slate-900">User Generations</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/70 w-44"
              />
            </div>
          </div>
        </div>

        {/* ASSET GRID WITH CARGO TILES */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredAssets.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-slate-800/60 flex flex-col items-center justify-center gap-2">
              <Box className="w-10 h-10 text-slate-600 mb-1" />
              <h3 className="text-base font-semibold text-slate-300">No matching 3D models</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Try clearing category filters or generate a new asset in the Text-to-3D Studio.
              </p>
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedGenre('all'); setSearch(''); }}
                className="mt-2 px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={`grid ${gridColsClass} gap-4`}>
              {filteredAssets.map((asset) => {
                const isSelected = selectedIds.has(asset.id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      if (isMultiSelectMode) {
                        toggleSelectAsset(asset.id);
                      } else {
                        setSelectedAsset(asset);
                      }
                    }}
                    className={`group relative flex flex-col justify-between p-4 rounded-xl bg-slate-950 border transition-all cursor-pointer shadow-lg min-h-[220px] ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-400/20'
                        : 'border-slate-800/80 hover:border-amber-500/80 hover:shadow-amber-500/10'
                    }`}
                  >
                    <div className="absolute top-3 left-3 z-10">
                      {isMultiSelectMode ? (
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-amber-400 border-amber-300 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : null}
                        </div>
                      ) : (
                        <a
                          href={api.getDownloadUrl(asset.id, 'glb')}
                          download={`${asset.id}.glb`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded text-amber-400 hover:text-amber-300 transition-colors block"
                          title="Quick Download GLB"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <span className="self-end text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {asset.style}
                    </span>

                    <div className="flex flex-col items-center justify-center my-auto w-full py-1">
                      <AssetThumbnail asset={asset} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-xs text-white truncate group-hover:text-amber-300 transition-colors">
                        {asset.title}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                        <span>{asset.poly_count.toLocaleString()} F</span>
                        <span>{(asset.file_size_bytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    {/* Quick Hover Studio Action */}
                    {!isMultiSelectMode && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectAsset(asset);
                          }}
                          className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20"
                        >
                          <Box className="w-3.5 h-3.5" />
                          <span>Open in 3D Studio</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(asset);
                          }}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                        >
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FLOATING MULTI-SELECT BATCH ACTION BAR */}
        {isMultiSelectMode && selectedIds.size > 0 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 bg-slate-950/95 border border-amber-500/60 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center">
                {selectedIds.size}
              </span>
              <span className="font-semibold text-slate-200">Selected</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={handleBatchDownloadGlb}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export GLBs</span>
            </button>
            <button
              onClick={handleBatchDownloadZip}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Export ZIP Bundles</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* STATUS BAR */}
        <div className="h-10 px-6 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Ready for export: <span className="text-white font-mono">{filteredAssets.length}</span> Assets</span>
          </div>

          <div className="flex items-center gap-2">
            <Grid className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="range"
              min={2}
              max={5}
              value={gridZoom}
              onChange={(e) => setGridZoom(Number(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
              title="Adjust Grid Columns"
            />
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl text-slate-200">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{selectedAsset.title}</h2>
                <span className="text-xs text-slate-400 font-mono">Engine: {selectedAsset.provider}</span>
              </div>
            </div>

            <div className="my-2 border border-slate-800 rounded-xl overflow-hidden">
              <AssetThumbnail asset={selectedAsset} />
            </div>

            <p className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs italic text-slate-300 font-serif my-3">
              "{selectedAsset.prompt}"
            </p>

            <div className="grid grid-cols-3 gap-2 text-center my-4">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Polygons</span>
                <span className="font-bold text-white font-mono text-sm">{selectedAsset.poly_count.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Vertices</span>
                <span className="font-bold text-white font-mono text-sm">{selectedAsset.vertex_count.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">File Size</span>
                <span className="font-bold text-white font-mono text-sm">{(selectedAsset.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 my-3">
              <a
                href={api.getDownloadUrl(selectedAsset.id, 'glb')}
                download={`${selectedAsset.id}.glb`}
                className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-bold text-center text-xs"
              >
                GLB (glTF)
              </a>
              <a
                href={api.getDownloadUrl(selectedAsset.id, 'obj')}
                download={`${selectedAsset.id}.obj`}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 font-bold text-center text-xs"
              >
                OBJ (Mesh)
              </a>
              <a
                href={api.getDownloadUrl(selectedAsset.id, 'stl')}
                download={`${selectedAsset.id}.stl`}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 font-bold text-center text-xs"
              >
                STL (3D Print)
              </a>
            </div>

            <a
              href={api.getBundleUrl(selectedAsset.id)}
              download={`PolyGen_${selectedAsset.id}_bundle.zip`}
              className="w-full py-2.5 mb-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 font-semibold flex items-center justify-center gap-2 text-xs transition-all shadow-sm"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Complete Asset Bundle (.ZIP)</span>
            </a>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onInspectAsset(selectedAsset);
                  setSelectedAsset(null);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Box className="w-4 h-4" />
                <span>Open in Mixar 3D Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onDeleteAsset && (
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${selectedAsset.title}"?`)) {
                      onDeleteAsset(selectedAsset.id);
                      setSelectedAsset(null);
                    }
                  }}
                  className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 hover:text-rose-100 transition-colors"
                  title="Delete Asset from Workspace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
