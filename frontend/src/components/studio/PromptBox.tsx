import React, { useState } from 'react';
import { 
  Wand2, 
  Loader2, 
  Image as ImageIcon, 
  Zap, 
  Layers, 
  Box, 
  UploadCloud
} from 'lucide-react';
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
  style,
  onPromptChange,
  onGenerate,
  disabled = false,
}) => {
  const [enhancing, setEnhancing] = useState(false);
  const [mode, setMode] = useState<'one-click' | 'refine'>('one-click');
  const [workflow, setWorkflow] = useState<'text-to-3d' | 'multiview' | 'batch'>('text-to-3d');
  const [meshRes, setMeshRes] = useState<'standard' | 'ultra'>('standard');

  const presets = [
    { label: 'Cyber Recon Drone', text: 'futuristic tactical stealth recon drone with dual thruster wings and sensor array' },
    { label: 'Skyrend Axe', text: 'Skyrend Axe of the Stormhowl Clan, giant double-bladed weapon of steel and dragonbone, lightning runes, electric arcs, leather grip, wolf-head motif.' },
    { label: 'Obsidian Monolith', text: 'obsidian crystal cluster monolith with sharp faceted mineral spires' },
    { label: 'Exo Combat Helmet', text: 'cyberpunk tactical combat helmet with reinforced ballistic visor and rebreather' },
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
    <div className="flex flex-col gap-3 p-4 bg-slate-950/95 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-md text-slate-200">
      {/* 1. TRIPO AI TOP MODE TOGGLE */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setMode('one-click')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'one-click'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            One-Click
          </button>
          <button
            onClick={() => setMode('refine')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'refine'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Build & Refine
          </button>
        </div>

        <span className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full">
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>v3.0-PRO</span>
        </span>
      </div>

      {/* 2. WORKFLOW SELECTOR */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          onClick={() => setWorkflow('text-to-3d')}
          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
            workflow === 'text-to-3d'
              ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm shadow-indigo-950'
              : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-medium leading-tight">Image / Text to 3D</span>
        </button>

        <button
          onClick={() => setWorkflow('multiview')}
          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
            workflow === 'multiview'
              ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm shadow-indigo-950'
              : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] font-medium leading-tight">Multi-views to 3D</span>
        </button>

        <button
          onClick={() => setWorkflow('batch')}
          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
            workflow === 'batch'
              ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm shadow-indigo-950'
              : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] font-medium leading-tight">Batch 3D Gen</span>
        </button>
      </div>

      {/* 3. TRIPO IMAGE DROPZONE PREVIEW */}
      <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/50 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors group">
        <UploadCloud className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
        <span className="text-xs text-slate-400 group-hover:text-slate-200 font-medium">
          Drag, Upload or Paste Reference Image
        </span>
        <span className="text-[10px] text-slate-600">JPG, PNG, WEBP • Max 15MB</span>
      </div>

      {/* 4. TRIPO LARGE GOLD-ACCENTED PROMPT TEXTAREA */}
      <div className="relative rounded-2xl bg-slate-950 border-2 border-amber-500/50 p-3 shadow-inner shadow-amber-950/10">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe your 3D asset in detail..."
          rows={3}
          maxLength={1000}
          disabled={disabled}
          className="w-full bg-transparent text-sm font-medium text-amber-200/90 placeholder-amber-400/40 focus:outline-none resize-none leading-relaxed font-sans"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnhance}
              disabled={!prompt.trim() || enhancing || disabled}
              className="p-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1 text-[11px]"
              title="Enhance prompt with PBR materials and high-definition normal descriptors"
            >
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>Enhance</span>
            </button>

            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
              T-Pose
            </div>

            <div className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/40 text-[10px] text-indigo-300 font-medium">
              FLUX.1 Kontext [pro]
            </div>
          </div>

          <span className="text-[10px] font-mono text-slate-500">
            {prompt.length}/1000
          </span>
        </div>
      </div>

      {/* Quick Inspirations */}
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        <span className="text-slate-500 mr-1">Presets:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onPromptChange(p.text)}
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white transition-colors text-[10px]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Mesh Resolution */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-400 font-medium">Mesh Resolution:</span>
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setMeshRes('ultra')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
              meshRes === 'ultra' ? 'bg-indigo-900 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ultra
          </button>
          <button
            onClick={() => setMeshRes('standard')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
              meshRes === 'standard' ? 'bg-indigo-900 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Standard
          </button>
        </div>
      </div>

      {/* 5. PROMINENT TRIPO AI GOLDEN GENERATE BUTTON */}
      <button
        onClick={onGenerate}
        disabled={!prompt.trim() || disabled}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-sm tracking-wide shadow-xl shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
      >
        <Zap className="w-4 h-4 fill-slate-950" />
        <span>Generate ⚡ 35</span>
      </button>
    </div>
  );
};
