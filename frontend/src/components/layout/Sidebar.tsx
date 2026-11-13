import React from 'react';
import { LayoutDashboard, Sparkles, FolderArchive } from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'studio' | 'gallery';
  onSelectView: (view: 'dashboard' | 'studio' | 'gallery') => void;
  assetCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, assetCount }) => {
  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'studio' as const,
      label: '3D Studio',
      icon: Sparkles,
      badge: 'Live',
    },
    {
      id: 'gallery' as const,
      label: 'Asset Gallery',
      icon: FolderArchive,
      badge: assetCount > 0 ? String(assetCount) : null,
    },
  ];

  return (
    <aside className="w-16 md:w-56 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      {/* Navigation */}
      <div className="p-3 flex flex-col gap-1.5">
        <span className="hidden md:block text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-2">
          Workspace
        </span>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className="hidden md:inline">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`hidden md:inline px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 hidden md:flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400 font-medium">FastAPI Local Engine</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          Three.js ACES Filmic • Compliant glTF 2.0 Binary Export
        </p>
      </div>
    </aside>
  );
};
