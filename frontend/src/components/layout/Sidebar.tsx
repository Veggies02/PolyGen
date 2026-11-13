import React from 'react';
import { 
  LayoutDashboard, 
  FolderArchive, 
  Search, 
  ChevronDown, 
  HelpCircle, 
  BookOpen, 
  LifeBuoy, 
  Users, 
  BarChart2, 
  Zap,
  Box
} from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'studio' | 'gallery';
  onSelectView: (view: 'dashboard' | 'studio' | 'gallery') => void;
  onOpenCommandPalette: () => void;
  onOpenHelp: (section: 'guides' | 'faq' | 'support') => void;
  onOpenPlan: () => void;
  onOpenConfigApi: () => void;
  assetCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onSelectView, 
  onOpenCommandPalette,
  onOpenHelp,
  onOpenPlan,
  onOpenConfigApi,
  assetCount 
}) => {
  return (
    <aside className="w-60 bg-[#0d0f14] border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none overflow-y-auto font-sans">
      <div className="p-3.5 flex flex-col gap-4">
        {/* 1. USER PROFILE HEADER */}
        <div 
          onClick={onOpenConfigApi}
          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors"
          title="Click to view Account & API configuration"
        >
          <div className="flex items-center gap-2.5">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
              alt="Julia Johnson"
              className="w-8 h-8 rounded-full object-cover border border-indigo-400/50"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Julia Johnson</span>
              <span className="text-[10px] text-slate-400">Creative Lead</span>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {/* 2. SEARCH BAR WITH SHORTCUT */}
        <div 
          onClick={onOpenCommandPalette}
          className="relative cursor-pointer group"
          title="Press Ctrl+K or click to search"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
          <input
            type="text"
            placeholder="Search commands & assets"
            readOnly
            className="w-full pl-8 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-500 cursor-pointer group-hover:border-slate-700 transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 border border-slate-800 px-1 rounded">
            ⌘K
          </span>
        </div>

        {/* 3. SECTION: MAIN */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
            Main
          </span>

          <button
            onClick={() => onSelectView('dashboard')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentView === 'dashboard'
                ? 'bg-slate-900 border border-slate-700/80 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <span>Dashboard</span>
          </button>
        </div>

        {/* 4. SECTION: GENERATORS */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Generators</span>
            <ChevronDown className="w-3 h-3 text-slate-600" />
          </span>

          <button
            onClick={() => onSelectView('studio')}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentView === 'studio'
                ? 'bg-indigo-950/60 border border-indigo-500/50 text-white font-semibold shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Box className="w-4 h-4 text-cyan-400" />
              <span>3D Studio (Mixar)</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-lime-500/20 text-lime-400 font-mono">
              Live
            </span>
          </button>

          <button
            onClick={() => onSelectView('studio')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>VisionForge 3D</span>
          </button>

          <button
            onClick={() => onSelectView('studio')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>PromptLab</span>
          </button>

          <button
            onClick={() => onSelectView('studio')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-pink-400" />
            <span>StreamCraft AI</span>
          </button>
        </div>

        {/* 5. SECTION: DESIGN MODES */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
            Design modes
          </span>

          <button
            onClick={() => onSelectView('gallery')}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              currentView === 'gallery'
                ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderArchive className="w-4 h-4 text-amber-400" />
              <span>Asset Library (Cargo)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{assetCount}</span>
          </button>

          <button
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <BarChart2 className="w-4 h-4 text-slate-500" />
            <span>Metrics</span>
          </button>

          <button
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Teams</span>
          </button>
        </div>

        {/* 6. SECTION: GUIDES & HELP */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
            Guides & Help
          </span>

          <button
            onClick={() => onOpenHelp('guides')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Guides</span>
          </button>

          <button
            onClick={() => onOpenHelp('faq')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>FAQ</span>
          </button>

          <button
            onClick={() => onOpenHelp('support')}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-900/40 text-left transition-colors"
          >
            <LifeBuoy className="w-4 h-4 text-slate-500" />
            <span>Support Hub</span>
          </button>
        </div>
      </div>

      {/* 7. UNLOCK MORE FEATURES */}
      <div className="p-3.5 m-3 rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950/40 border border-slate-800/80 flex flex-col gap-2.5">
        <div>
          <span className="text-xs font-semibold text-white block">Unlock more features</span>
          <span className="text-[11px] text-slate-400 leading-tight block">Get started with 14 days free.</span>
        </div>

        <button
          onClick={onOpenPlan}
          className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Switch to Studio Plan</span>
        </button>
      </div>
    </aside>
  );
};
