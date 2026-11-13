import React, { useState } from 'react';
import { Sparkles, Wand2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { api } from '../../api/client';

interface PromptBoxProps {
  prompt: string;
  negativePrompt: string;
  style: string;
  onPromptChange: (val: string) => void;
  onNegativePromptChange: (val: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
}

export const PromptBox: React.FC<PromptBoxProps> = ({
  prompt,
  negativePrompt,
  style,
  onPromptChange,
  onNegativePromptChange,
  onGenerate,
  disabled = false,
}) => {
  const [enhancing, setEnhancing] = useState(false);
  const [showNegative, setShowNegative] = useState(false);

  const presets = [
    { label: 'Cyber Recon Drone', text: 'futuristic tactical stealth recon drone with dual thruster wings and sensor array' },
    { label: 'Obsidian Monolith', text: 'obsidian crystal cluster monolith with sharp faceted mineral spires' },
    { label: 'Exo Combat Helmet', text: 'cyberpunk tactical combat helmet with reinforced ballistic visor and rebreather' },
    { label: 'Quantum Gyroscope', text: 'nested concentric kinetic gyroscope rings enclosing a glowing polyhedral energy core' },
    { label: 'Plasma Blaster Rifle', text: 'modular sci-fi plasma assault blaster with thermal rail heat sinks' },
  ];

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await api.enhancePrompt(prompt, style);
      onPromptChange(res.enhanced_prompt);
    } catch (err) {
      console.error('Enhancement error:', err);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Prompt Synthesizer</span>
        </label>
        
        <button
          type="button"
          onClick={handleEnhance}
          disabled={!prompt.trim() || enhancing || disabled}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-950 to-indigo-950 border border-cyan-500/40 text-cyan-300 text-xs font-medium hover:border-cyan-400 hover:text-cyan-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Use AI to inject PBR materials, surface topology and lighting details"
        >
          {enhancing ? (
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
          ) : (
            <Wand2 className="w-3 h-3 text-cyan-400" />
          )}
          <span>{enhancing ? 'Enhancing...' : 'Enhance Prompt'}</span>
        </button>
      </div>

      {/* Main Textarea */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe your 3D asset in detail (e.g. 'futuristic stealth drone with carbon fiber chassis and blue plasma thrusters')..."
          rows={3}
          disabled={disabled}
          className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none font-sans"
        />
      </div>

      {/* Quick Preset Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-500 mr-1">Inspirations:</span>
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPromptChange(preset.text)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-[11px] text-slate-300 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Negative Prompt Accordion */}
      <div>
        <button
          type="button"
          onClick={() => setShowNegative(!showNegative)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-300 font-medium py-1"
        >
          {showNegative ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>Negative Prompt (Optional)</span>
        </button>

        {showNegative && (
          <div className="mt-1">
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => onNegativePromptChange(e.target.value)}
              placeholder="e.g. low quality, blurry, deformed geometry, holes, noisy polygons"
              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        )}
      </div>

      {/* Generate Action Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!prompt.trim() || disabled}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 text-slate-950 font-semibold text-sm tracking-wide shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>GENERATE 3D ASSET</span>
        </button>
      </div>
    </div>
  );
};
