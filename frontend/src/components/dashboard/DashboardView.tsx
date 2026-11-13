import React from 'react';
import type { Asset, StatsOverview, ProviderInfo } from '../../types';
import { api } from '../../api/client';
import { 
  Box, 
  Layers, 
  Sparkles, 
  Cpu, 
  ArrowRight, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  HardDrive
} from 'lucide-react';

interface DashboardViewProps {
  stats: StatsOverview | null;
  recentAssets: Asset[];
  providers: ProviderInfo[];
  onNavigateStudio: () => void;
  onInspectAsset: (asset: Asset) => void;
  onNavigateGallery: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  recentAssets,
  providers,
  onNavigateStudio,
  onInspectAsset,
  onNavigateGallery,
}) => {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full text-slate-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PolyGen Studio v1.0 • Ready</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Generative Text-to-3D Asset Studio
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Turn creative text descriptions into production-ready 3D assets. Inspect topology, adjust lighting, and export compliant GLB, OBJ, and STL files locally or via modular AI providers.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateStudio}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-semibold text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              <span>Launch 3D Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateGallery}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs text-slate-300 font-medium transition-colors"
            >
              Explore Asset Gallery
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Total Assets</span>
            <Box className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-2xl font-bold text-white mt-1">
            {stats ? stats.total_assets : '—'}
          </span>
          <span className="text-[11px] text-slate-500">Ready in workspace gallery</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Pipeline Status</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400 mt-1">
            {stats && stats.active_jobs > 0 ? `${stats.active_jobs} Active` : 'Idle / Ready'}
          </span>
          <span className="text-[11px] text-slate-500">
            {stats ? `${stats.completed_jobs} jobs completed` : 'Asynchronous queue'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Providers</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-white mt-1">
            {providers.length} Engine{providers.length === 1 ? '' : 's'}
          </span>
          <span className="text-[11px] text-emerald-400 font-medium">
            Demo Core + Cloud Providers
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-wider font-medium">Storage Used</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-bold text-white mt-1">
            {stats ? `${(stats.storage_used_bytes / 1024).toFixed(1)} KB` : '—'}
          </span>
          <span className="text-[11px] text-slate-500">GLB, OBJ & STL packages</span>
        </div>
      </div>

      {/* Provider Status Grid */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              AI Generation Engine Providers
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">Modular Architecture</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                p.is_demo
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : p.is_configured
                  ? 'bg-indigo-950/20 border-indigo-500/40'
                  : 'bg-slate-950/30 border-slate-800/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-xs text-white">{p.name}</span>
                  {p.is_demo ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Built-in Demo
                    </span>
                  ) : p.is_configured ? (
                    <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/30">
                      <AlertCircle className="w-3 h-3" />
                      Key Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                <span>Speed: {p.speed_estimate}</span>
                <span>Formats: {p.supported_formats.join(', ').toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Generations */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Recent 3D Generations
            </h2>
          </div>
          <button
            onClick={onNavigateGallery}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            <span>View All ({recentAssets.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentAssets.slice(0, 4).map((asset) => (
            <div
              key={asset.id}
              className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-950/30 transition-all flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-white truncate max-w-[140px]" title={asset.title}>
                    {asset.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                    {asset.style}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                  "{asset.prompt}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 py-1.5 px-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <span>{asset.poly_count.toLocaleString()} polys</span>
                <span>{(asset.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => onInspectAsset(asset)}
                  className="flex-1 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>
                <a
                  href={api.getDownloadUrl(asset.id, 'glb')}
                  download={`${asset.id}.glb`}
                  title="Download GLB"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
