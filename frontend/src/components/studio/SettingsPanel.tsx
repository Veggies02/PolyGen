import React from 'react';
import type { GenerationSettings, ProviderInfo } from '../../types';
import { Sliders, Cpu, Dna, ShieldAlert, Sparkles, Shuffle } from 'lucide-react';

interface SettingsPanelProps {
  settings: GenerationSettings;
  providers: ProviderInfo[];
  onChange: (settings: GenerationSettings) => void;
  disabled?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  providers,
  onChange,
  disabled = false,
}) => {
  const styles = [
    { id: 'scifi', label: 'Sci-Fi Hard Surface', desc: 'Panels, emissive vents & titanium chassis' },
    { id: 'cyberpunk', label: 'Cyberpunk Industrial', desc: 'Neon conduits, grit & modular cyberware' },
    { id: 'low-poly', label: 'Stylized Low-Poly', desc: 'Faceted geometric game-ready silhouettes' },
    { id: 'realistic', label: 'Photorealistic PBR', desc: 'Accurate surface roughness & micro-details' },
    { id: 'organic', label: 'Biomechanical', desc: 'Chitinous curves, musculature & alien forms' },
  ];

  const polyBudgets = [
    { id: 'low', label: 'Low (~5k)', desc: 'Mobile / XR' },
    { id: 'medium', label: 'Mid (~25k)', desc: 'Game Real-time' },
    { id: 'high', label: 'High (~60k)', desc: 'Cinematic / Render' },
  ];

  const handleRandomSeed = () => {
    const s = Math.floor(Math.random() * 900000) + 100000;
    onChange({ ...settings, seed: s });
  };

  const activeProvider = providers.find((p) => p.id === settings.provider);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl backdrop-blur-md text-xs text-slate-300">
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
        <Sliders className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-white uppercase tracking-wider">Pipeline Settings</span>
      </div>

      {/* Provider Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-slate-400 font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Model / Engine Provider</span>
          </span>
          {activeProvider?.is_demo && (
            <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
              Demo Active
            </span>
          )}
        </label>

        <div className="flex flex-col gap-1.5">
          {providers.map((p) => {
            const isSelected = settings.provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ ...settings, provider: p.id })}
                disabled={disabled}
                className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/60 text-white shadow-sm shadow-cyan-950'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-200">{p.name}</span>
                    {p.is_demo && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-medium">
                        Local Demo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {p.is_configured ? (
                    <span className="text-[10px] text-emerald-400 font-medium">Ready</span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Key Needed
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-mono">{p.speed_estimate}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Preset */}
      <div className="flex flex-col gap-1.5">
        <label className="text-slate-400 font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Aesthetic Style Preset</span>
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {styles.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onChange({ ...settings, style: st.id })}
              disabled={disabled}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${
                settings.style === st.id
                  ? 'bg-slate-800 border-cyan-500/60 text-white'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="font-medium">{st.label}</span>
              <span className="text-[10px] text-slate-500">{st.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Poly Budget */}
      <div className="flex flex-col gap-1.5">
        <label className="text-slate-400 font-medium flex items-center gap-1.5">
          <Dna className="w-3.5 h-3.5 text-cyan-400" />
          <span>Polygon Target Budget</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {polyBudgets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange({ ...settings, poly_budget: b.id })}
              disabled={disabled}
              className={`p-2 rounded-xl border text-center transition-all ${
                settings.poly_budget === b.id
                  ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs">{b.label}</div>
              <div className="text-[9px] text-slate-500">{b.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bilateral Symmetry & Random Seed */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.symmetry}
            onChange={(e) => onChange({ ...settings, symmetry: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
          />
          <span className="text-slate-300 font-medium">Bilateral Symmetry</span>
        </label>

        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={settings.seed ?? ''}
            onChange={(e) =>
              onChange({ ...settings, seed: e.target.value ? parseInt(e.target.value) : undefined })
            }
            placeholder="Seed (Auto)"
            disabled={disabled}
            className="w-24 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/60"
          />
          <button
            type="button"
            onClick={handleRandomSeed}
            disabled={disabled}
            title="Randomize Seed"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
