import React from 'react';
import { Box, ShieldCheck, Plus } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigateStudio: () => void;
  assetCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigateStudio }) => {
  const viewTitles: Record<string, string> = {
    dashboard: 'Workspace Overview',
    studio: 'Text-to-3D Studio & Inspector',
    gallery: 'Generated Asset Gallery',
  };

  return (
    <header className="h-16 px-6 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Box className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              PolyGen <span className="text-[10px] text-cyan-400 font-mono font-normal">v1.0</span>
            </span>
          </div>
        </div>

        <div className="w-px h-4 bg-slate-800 mx-1 hidden sm:block" />

        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2">
          <span>Studio</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-medium">{viewTitles[currentView] || 'Workspace'}</span>
        </div>
      </div>

      {/* Right Tools & Badges */}
      <div className="flex items-center gap-3">
        {/* Demo Mode Badge */}
        <div
          title="PolyGen Procedural Core active. Generates real GLB/OBJ/STL geometry locally without external API tokens."
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium cursor-help"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline font-mono">DEMO MODE ACTIVE</span>
          <span className="md:hidden font-mono">DEMO</span>
        </div>

        {/* New Generation CTA */}
        {currentView !== 'studio' && (
          <button
            onClick={onNavigateStudio}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Generation</span>
          </button>
        )}
      </div>
    </header>
  );
};
