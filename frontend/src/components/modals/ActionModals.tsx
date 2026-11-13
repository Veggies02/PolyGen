import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Key, 
  Check, 
  Search, 
  HelpCircle, 
  BookOpen, 
  LifeBuoy, 
  Zap, 
  Box, 
  Sliders
} from 'lucide-react';
import type { ProviderInfo, Asset } from '../../types';

// 1. COMMAND PALETTE MODAL (Ctrl+K / ⌘K)
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (view: 'dashboard' | 'studio' | 'gallery') => void;
  onSelectAsset: (asset: Asset) => void;
  assets: Asset[];
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectAction,
  onSelectAsset,
  assets,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredAssets = assets.filter(
    (a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.prompt.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search 3D models or jump to view..."
            autoFocus
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto flex flex-col gap-1 text-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 px-3 py-1">Quick Navigation</span>
          <button
            onClick={() => { onSelectAction('studio'); onClose(); }}
            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <span>Launch 3D Studio & Viewport (Mixar)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Workspace</span>
          </button>

          <button
            onClick={() => { onSelectAction('gallery'); onClose(); }}
            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-amber-400" />
              <span>Browse 3D Model Library (Cargo)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Library</span>
          </button>

          <button
            onClick={() => { onSelectAction('dashboard'); onClose(); }}
            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Open Workspace Insights Dashboard</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Insights</span>
          </button>

          {filteredAssets.length > 0 && (
            <>
              <div className="w-full h-px bg-slate-800 my-1" />
              <span className="text-[10px] font-bold uppercase text-slate-500 px-3 py-1">3D Assets ({filteredAssets.length})</span>
              {filteredAssets.slice(0, 5).map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => { onSelectAsset(asset); onClose(); }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-lime-400" />
                    <span className="truncate max-w-[280px]">{asset.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{asset.style}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. CONFIG & API CREDENTIALS MODAL
interface ConfigApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderInfo[];
}

export const ConfigApiModal: React.FC<ConfigApiModalProps> = ({ isOpen, onClose, providers }) => {
  const [tripoKey, setTripoKey] = useState('');
  const [meshyKey, setMeshyKey] = useState('');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Engine & API Credentials</h2>
            <p className="text-xs text-slate-400">Manage 3D model generation providers</p>
          </div>
        </div>

        {/* Demo Mode Explanation Card */}
        <div className="p-3 my-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 leading-relaxed">
          <div className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Built-in Demo Core Active</span>
          </div>
          PolyGen is currently synthesizing valid 3D geometry locally with zero external API fees. Connect production cloud APIs below whenever you wish to upgrade.
        </div>

        {/* Available Providers Status */}
        {providers.length > 0 && (
          <div className="flex flex-col gap-1.5 my-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Registered Engine Providers</span>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {providers.map((p) => (
                <div key={p.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="font-semibold text-white block capitalize">{p.name}</span>
                  <span className={`text-[9px] ${p.is_configured ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {p.is_configured ? 'Online' : 'Requires Key'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provider Credential Inputs */}
        <div className="flex flex-col gap-3 my-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">Tripo3D API Key (Optional)</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="password"
                value={tripoKey}
                onChange={(e) => setTripoKey(e.target.value)}
                placeholder="tsk_live_..."
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">Meshy AI API Key (Optional)</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="password"
                value={meshyKey}
                onChange={(e) => setMeshyKey(e.target.value)}
                placeholder="msy_..."
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {saved && (
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs text-center mb-3">
            Keys saved to environment configuration!
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs">
            Close
          </button>
          <button
            onClick={() => { setSaved(true); setTimeout(() => onClose(), 800); }}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. HELP & DOCUMENTATION MODAL
interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'guides' | 'faq' | 'support';
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, section }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-500/40 text-indigo-400">
            {section === 'guides' && <BookOpen className="w-5 h-5" />}
            {section === 'faq' && <HelpCircle className="w-5 h-5" />}
            {section === 'support' && <LifeBuoy className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              {section === 'guides' ? 'PolyGen Studio Guide' : section === 'faq' ? 'Frequently Asked Questions' : 'Support Hub'}
            </h2>
            <p className="text-xs text-slate-400">Documentation & Help Center</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-xs text-slate-300 my-4 max-h-80 overflow-y-auto">
          {section === 'guides' && (
            <>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-white block mb-1">1. Generating 3D Assets</span>
                <p className="text-slate-400 leading-relaxed">
                  Type a prompt describing your desired 3D asset in the studio. Click "Enhance" to automatically append PBR material and lighting keywords. Choose a polygon budget and click "Generate ⚡ 35".
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-white block mb-1">2. Viewport Inspection</span>
                <p className="text-slate-400 leading-relaxed">
                  Use left-click to orbit, right-click to pan, and wheel to zoom. Toggle wireframe, turntable auto-rotation, or switch between PBR, Clay, and Normal shaders.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-white block mb-1">3. Multi-Format Exports</span>
                <p className="text-slate-400 leading-relaxed">
                  Export valid .GLB (for Three.js / Web), .OBJ (for Blender / Maya), or .STL (for 3D printing).
                </p>
              </div>
            </>
          )}

          {section === 'faq' && (
            <>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-white block mb-1">Is this running real AI or a demo?</span>
                <p className="text-slate-400 leading-relaxed">
                  PolyGen includes a local procedural 3D synthesis core by default that creates genuine, valid 3D meshes without fees. You can seamlessly plug in your Tripo3D or Meshy API keys at any time.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-white block mb-1">What formats are supported?</span>
                <p className="text-slate-400 leading-relaxed">
                  Every asset generated in PolyGen is immediately packaged into binary glTF 2.0 (.glb), Wavefront (.obj), and binary STL (.stl).
                </p>
              </div>
            </>
          )}

          {section === 'support' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center gap-2">
              <LifeBuoy className="w-8 h-8 text-cyan-400" />
              <span className="font-semibold text-white text-sm">Need help or want custom engine integration?</span>
              <p className="text-slate-400 text-xs max-w-xs">
                Our team is ready to connect custom enterprise models, proprietary weights, or local ComfyUI pipelines.
              </p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 text-xs font-semibold">
          Close
        </button>
      </div>
    </div>
  );
};

// 4. STUDIO PLAN UPGRADE MODAL
interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">PolyGen Studio Pro Plan</h2>
            <p className="text-xs text-slate-400">Unlock maximum resolution 3D generation</p>
          </div>
        </div>

        <div className="space-y-2.5 my-4 text-xs">
          {[
            'Ultra resolution meshes (up to 250k polygons)',
            'Dedicated H100 GPU synthesis pipeline',
            'Full PBR texture maps (Normal, Roughness, Metallic, Emissive)',
            'Direct Blender & Unreal Engine 5 live sync plugins',
            'Unlimited generation queue slots'
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-300">
              <Check className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
        >
          Start 14-Day Free Studio Trial
        </button>
      </div>
    </div>
  );
};
