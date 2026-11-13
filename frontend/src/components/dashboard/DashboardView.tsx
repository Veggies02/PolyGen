import React, { useState } from 'react';
import type { Asset, StatsOverview, ProviderInfo } from '../../types';
import { 
  Box, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  MoreVertical,
  Calendar
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
  const [activeTooltip, setActiveTooltip] = useState<boolean>(true);
  const [regionTab, setRegionTab] = useState<'overview' | 'region'>('overview');

  const creativeLeaders = [
    {
      name: 'Aria Nakamura',
      role: 'Creative Synth Specialist',
      earnings: '$14,200',
      projects: '2.1k',
      rating: '5.0',
      progress: 88,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      highlight: true,
    },
    {
      name: 'Luca Marino',
      role: 'Generative Media Director',
      earnings: '$11,700',
      projects: '1.4k',
      rating: '4.8',
      progress: 44,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      highlight: false,
    },
    {
      name: 'James Solis',
      role: 'Digital Concept Architect',
      earnings: '$9,300',
      projects: '1.6k',
      rating: '4.6',
      progress: 76,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
      highlight: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full text-slate-200 font-sans">
      {/* 1. TOP TITLE HEADER & ACTIONS */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Workspace insights</h1>
            {stats && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {stats.total_assets} Assets • {providers.length} Engines
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Overview of active generators, 3D pipelines & model metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateStudio}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Open 3D Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. CREATIVE LEADERS SECTION (From Image 1 reference) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Creative leaders</h2>
          <button onClick={onNavigateGallery} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <span>View all</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {creativeLeaders.map((leader) => (
            <div
              key={leader.name}
              className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between gap-4 ${
                leader.highlight
                  ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border-indigo-400/50 shadow-xl shadow-indigo-950/40 text-white'
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={leader.avatar}
                      alt={leader.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">{leader.name}</span>
                        <CheckCircle2 className={`w-3.5 h-3.5 ${leader.highlight ? 'text-white' : 'text-cyan-400'}`} />
                      </div>
                      <span className={`text-xs ${leader.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {leader.role}
                      </span>
                    </div>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-400 hover:text-white cursor-pointer" />
                </div>

                {/* Progress bar */}
                <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 opacity-80">
                  <span>Efficiency</span>
                  <span>{leader.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${leader.highlight ? 'bg-white' : 'bg-cyan-400'}`}
                    style={{ width: `${leader.progress}%` }}
                  />
                </div>
              </div>

              {/* Leader Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-xs">
                <div>
                  <span className={`text-[10px] block ${leader.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>
                    Earnings
                  </span>
                  <span className="font-bold text-sm text-white">{leader.earnings}</span>
                </div>
                <div>
                  <span className={`text-[10px] block ${leader.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>
                    Projects
                  </span>
                  <span className="font-bold text-sm text-white">{leader.projects}</span>
                </div>
                <div>
                  <span className={`text-[10px] block ${leader.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>
                    Rating
                  </span>
                  <span className="font-bold text-sm text-white">{leader.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. TRENDING STYLES + TIME VS REVENUE + PERFORMANCE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Trending Styles & Time vs Revenue */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Trending AI Styles */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white">Trending AI Styles</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 rounded-xl bg-slate-950/70 border border-slate-800/60">
                <span className="text-xs font-medium text-slate-300 block mb-1">Dynamic storyboards</span>
                <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +12.4%
                </span>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-slate-950/70 border border-slate-800/60">
                <span className="text-xs font-medium text-slate-300 block mb-1">Hyper-real textures</span>
                <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +5.1%
                </span>
              </div>
            </div>
          </div>

          {/* Time vs Revenue stylized chart */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-white">Time vs Generated Assets</span>
              <span className="text-[11px] text-slate-500 font-mono">Q3 - Q4 2026</span>
            </div>

            {/* Stylized Bars matching Image 1 */}
            <div className="flex items-end justify-between h-40 pt-4 px-2">
              {[
                { month: 'Jul', h1: '40%', h2: '20%' },
                { month: 'Aug', h1: '65%', h2: '35%' },
                { month: 'Sep', h1: '90%', h2: '75%' },
                { month: 'Oct', h1: '85%', h2: '60%' },
                { month: 'Nov', h1: '45%', h2: '25%' },
                { month: 'Dec', h1: '70%', h2: '50%' },
              ].map((bar) => (
                <div key={bar.month} className="flex flex-col items-center gap-2">
                  <div className="relative w-6 h-32 flex flex-col justify-end items-center">
                    <div
                      className="w-full bg-slate-800 rounded-lg absolute bottom-0 opacity-50"
                      style={{ height: bar.h1 }}
                    />
                    <div
                      className="w-full bg-indigo-500 rounded-lg relative z-10 transition-all hover:bg-indigo-400"
                      style={{ height: bar.h2 }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">{bar.month}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span>Production time</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Finalized assets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Performance Multi-Line Step Chart */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            {/* Header Controls (matching Image 1) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Performance</span>
                <span className="text-[11px] text-slate-400">Output value across creative platforms</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setRegionTab('overview')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      regionTab === 'overview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setRegionTab('region')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      regionTab === 'region' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    My region
                  </button>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Jan 1, 2026 - Jan 1, 2027</span>
                </div>
              </div>
            </div>

            {/* Step-line Chart Area with Tooltip */}
            <div 
              className="relative h-56 w-full pt-4 cursor-pointer"
              onClick={() => setActiveTooltip(!activeTooltip)}
            >
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                {[20, 60, 100, 140].map((y) => (
                  <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                ))}

                {/* Line 1: VisionForge (Yellow/Gold) */}
                <path
                  d="M 0 50 L 50 50 L 50 35 L 120 35 L 120 45 L 200 45 L 200 25 L 280 25 L 280 40 L 360 40 L 360 20 L 440 20 L 440 40 L 500 40"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="2"
                />

                {/* Line 2: PromptLab (Blue) */}
                <path
                  d="M 0 80 L 70 80 L 70 70 L 150 70 L 150 90 L 240 90 L 240 65 L 320 65 L 320 85 L 400 85 L 400 100 L 500 100"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />

                {/* Line 3: StreamCraft (Magenta) */}
                <path
                  d="M 0 120 L 80 120 L 80 130 L 160 130 L 160 115 L 260 115 L 260 125 L 350 125 L 350 135 L 430 135 L 430 120 L 500 120"
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="2"
                />

                <line x1="280" y1="10" x2="280" y2="150" stroke="#475569" strokeWidth="1" />
              </svg>

              {activeTooltip && (
                <div className="absolute left-[56%] top-6 bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs z-20 w-44">
                  <span className="text-[11px] font-semibold text-slate-200 block mb-2">June 2026</span>
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-yellow-400">
                      <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        <span className="text-slate-300">VisionForge</span>
                      </span>
                      <span className="font-bold">$6,100</span>
                    </div>

                    <div className="flex items-center justify-between text-blue-400">
                      <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span className="text-slate-300">PromptLab</span>
                      </span>
                      <span className="font-bold">$4,450</span>
                    </div>

                    <div className="flex items-center justify-between text-pink-400">
                      <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                        <span className="text-slate-300">StreamCraft</span>
                      </span>
                      <span className="font-bold">$2,480</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-800">
              {['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                <span key={`${m}-${idx}`}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT GENERATIONS PREVIEW CARDS */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Recent 3D Generations in Workspace
            </h2>
          </div>
          <button
            onClick={onNavigateGallery}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            <span>Explore All ({recentAssets.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentAssets.slice(0, 4).map((asset) => (
            <div
              key={asset.id}
              onClick={() => onInspectAsset(asset)}
              className="group p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-950/20 transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-white truncate max-w-[140px] group-hover:text-amber-300 transition-colors">
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

              <div className="flex items-center justify-between text-[11px] text-slate-400 py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800/60 font-mono">
                <span>{asset.poly_count.toLocaleString()} polys</span>
                <span>{(asset.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
