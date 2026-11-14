import React, { useState } from 'react';
import { 
  Wand2, 
  Copy, 
  Check, 
  ArrowRight, 
  Compass, 
  Zap, 
  Plus
} from 'lucide-react';

interface PromptLabViewProps {
  onSelectPrompt: (promptText: string, style?: string, polyBudget?: string) => void;
  onNavigateStudio: () => void;
}

export const PromptLabView: React.FC<PromptLabViewProps> = ({
  onSelectPrompt,
  onNavigateStudio,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Prompt Builder State
  const [subjectInput, setSubjectInput] = useState<string>('tactical orbital drop pod with heat shield tiles');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([
    'hexagonal armor plating',
    'quad topology',
    'high-definition normal maps'
  ]);
  const [builderStyle, setBuilderStyle] = useState<string>('scifi');
  const [builderBudget, setBuilderBudget] = useState<string>('medium');

  const categories = [
    { id: 'all', label: 'All Recipes' },
    { id: 'vehicles', label: 'Vehicles & Mechs' },
    { id: 'props', label: 'Weapons & Relics' },
    { id: 'architecture', label: 'Sci-Fi Architecture' },
    { id: 'tech', label: 'Quantum & Tech' },
    { id: 'characters', label: 'Characters & Exos' },
  ];

  const promptRecipes = [
    {
      id: 'p-1',
      category: 'vehicles',
      title: 'Valkyrie Hypersonic Stealth Interceptor',
      prompt: 'Hypersonic variable-geometry stealth interceptor with dual scramjet engines, beveled titanium fuselage, conformal weapons bay, and carbon composite winglets.',
      style: 'scifi',
      polyBudget: 'high',
      tags: ['Aerospace', 'Hard Surface', 'Titanium'],
      popularity: '98%',
    },
    {
      id: 'p-2',
      category: 'props',
      title: 'Sol-Forged Relic Greatsword',
      prompt: 'Ornate celestial greatsword forged from solar glass and ancient meteoric iron, rune-etched central fuller with pulsing amber luminescence, dragon crossguard, and wire-wrapped hilt.',
      style: 'realistic',
      polyBudget: 'medium',
      tags: ['Fantasy', 'Weapons', 'PBR Gold'],
      popularity: '95%',
    },
    {
      id: 'p-3',
      category: 'architecture',
      title: 'Neo-Shinjuku Modular Capsule Tower',
      prompt: 'Cyberpunk modular micro-apartment tower with staggered cantilevered pods, exposed conduit pipes, neon advertising brackets, rooftop comms dish, and weathered industrial facades.',
      style: 'cyberpunk',
      polyBudget: 'high',
      tags: ['Modular', 'Cyberpunk', 'Greebles'],
      popularity: '92%',
    },
    {
      id: 'p-4',
      category: 'tech',
      title: 'Quantum Entanglement Resonance Chamber',
      prompt: 'Compact quantum field resonator with counter-rotating electromagnetic rings, faceted obsidian core, fiber-optic coolant channels, and gold vacuum flanges.',
      style: 'scifi',
      polyBudget: 'medium',
      tags: ['Sci-Fi', 'Kinetic', 'Gold/Obsidian'],
      popularity: '89%',
    },
    {
      id: 'p-5',
      category: 'characters',
      title: 'Aegis Apex Heavy Exoskeleton Suit',
      prompt: 'Heavy industrial power loader exoskeleton suit with hydraulic piston joints, reinforced ballistic chest plate, hazard orange warning stripes, and dual work-light clamps.',
      style: 'scifi',
      polyBudget: 'high',
      tags: ['Exo', 'Industrial', 'Hydraulics'],
      popularity: '94%',
    },
    {
      id: 'p-6',
      category: 'props',
      title: 'Low-Poly Isometric Survival Rover',
      prompt: 'Chunky low-poly 6-wheeled planetary survey rover with solar array roof, dual antennae, external storage canisters, and clean faceted geometric topology.',
      style: 'low-poly',
      polyBudget: 'low',
      tags: ['Low-Poly', 'Mobile Ready', 'Stylized'],
      popularity: '87%',
    },
    {
      id: 'p-7',
      category: 'vehicles',
      title: 'Autonomous Deep-Sea Hydrofoil Drone',
      prompt: 'Biomimetic manta-ray deep-sea autonomous drone with carbon hydrofoils, glowing blue sensor dome, micro-thrusters, and titanium pressure hull.',
      style: 'scifi',
      polyBudget: 'medium',
      tags: ['Subsea', 'Biomimetic', 'Carbon'],
      popularity: '91%',
    },
    {
      id: 'p-8',
      category: 'props',
      title: 'Tactical EMP Grenade Dispenser',
      prompt: 'Compact cylindrical tactical EMP canister with knurled grip, digital arming display, glowing cyan status ring, and reinforced safety pins.',
      style: 'cyberpunk',
      polyBudget: 'low',
      tags: ['Cyberpunk', 'Weapon Prop', 'Game Ready'],
      popularity: '93%',
    },
  ];

  const modifierPool = [
    { group: 'Topology & Geometry', items: ['clean quad topology', 'chamfered beveled edges', 'game-ready low poly', 'subdivision ready surface'] },
    { group: 'Materials & Shaders', items: ['8K PBR roughness/metalness', 'brushed carbon fiber', 'weathered industrial patina', 'subsurface scattering'] },
    { group: 'Lighting & FX', items: ['volumetric neon bloom', 'internal luminescence', 'cinematic rim lighting', 'anodized titanium finish'] },
    { group: 'Details & Micro-Elements', items: ['hexagonal armor plating', 'procedural greebles', 'micro-scratches & edge wear', 'conformal sensor array'] },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleModifier = (mod: string) => {
    if (selectedModifiers.includes(mod)) {
      setSelectedModifiers(selectedModifiers.filter((m) => m !== mod));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const getFullBuilderPrompt = () => {
    const mods = selectedModifiers.length > 0 ? `, with ${selectedModifiers.join(', ')}` : '';
    return `${subjectInput.trim()}${mods}.`;
  };

  const handleLaunchBuilder = () => {
    const full = getFullBuilderPrompt();
    onSelectPrompt(full, builderStyle, builderBudget);
    onNavigateStudio();
  };

  const filteredRecipes = promptRecipes.filter((r) => {
    if (selectedCategory === 'all') return true;
    return r.category === selectedCategory;
  });

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full text-slate-200 font-sans pb-16">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Compass className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PromptLab <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">v1.2 Matrix</span>
              </h1>
              <p className="text-xs text-slate-400">Curated 3D prompt engineering matrix & interactive asset synthesizer</p>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateStudio}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 flex items-center gap-2 transition-colors"
        >
          <span>Open 3D Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. INTERACTIVE PROMPT BUILDER / MODIFIER MATRIX */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b0e14] border border-blue-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Interactive 3D Prompt Synthesizer Matrix
          </h2>
        </div>

        {/* Core Subject Input */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1.5 font-medium">Core Asset Subject:</label>
          <div className="relative">
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              placeholder="e.g. futuristic reconnaissance drone, tactical combat helmet, crystalline monolith..."
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/70 font-medium"
            />
          </div>
        </div>

        {/* Modifier Matrix Tags */}
        <div className="space-y-3 mb-5">
          <span className="text-xs text-slate-400 block font-medium">Click to inject PBR & geometry descriptors:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {modifierPool.map((col) => (
              <div key={col.group} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">{col.group}</span>
                <div className="flex flex-wrap gap-1.5">
                  {col.items.map((item) => {
                    const active = selectedModifiers.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => toggleModifier(item)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition-all text-left flex items-center gap-1.5 ${
                          active
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/60 hover:bg-slate-850'
                        }`}
                      >
                        {active ? <Check className="w-3 h-3 text-blue-400" /> : <Plus className="w-3 h-3 text-slate-500" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Target Settings Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Target Style:</span>
              <select
                value={builderStyle}
                onChange={(e) => setBuilderStyle(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none capitalize font-medium cursor-pointer"
              >
                <option value="scifi">Sci-Fi</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="low-poly">Low-Poly</option>
                <option value="realistic">Realistic</option>
                <option value="organic">Organic</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Poly Budget:</span>
              <select
                value={builderBudget}
                onChange={(e) => setBuilderBudget(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none capitalize font-medium cursor-pointer"
              >
                <option value="low">Low Poly (Game-Ready)</option>
                <option value="medium">Medium Poly (Balanced)</option>
                <option value="high">High Poly (Cinematic)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleLaunchBuilder}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Generate in 3D Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. CURATED 3D PROMPT RECIPES */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Curated 3D Asset Recipes</h2>
            <p className="text-xs text-slate-400">Tested and verified prompts guaranteed to synthesize watertight 3D meshes</p>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-950 border border-slate-800 rounded-xl">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-4 group shadow-lg hover:shadow-blue-950/20"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm text-white group-hover:text-blue-300 transition-colors">
                    {recipe.title}
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                    {recipe.popularity} match
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-serif italic mb-3 bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                  "{recipe.prompt}"
                </p>

                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {recipe.style}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {recipe.polyBudget} poly
                  </span>
                  {recipe.tags.map((t) => (
                    <span key={t} className="text-[10px] text-blue-400/80">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-900">
                <button
                  onClick={() => handleCopy(recipe.id, recipe.prompt)}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  title="Copy Prompt"
                >
                  {copiedId === recipe.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedId === recipe.id ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => {
                    onSelectPrompt(recipe.prompt, recipe.style, recipe.polyBudget);
                    onNavigateStudio();
                  }}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                  title="Send prompt to 3D Studio"
                >
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  <span>Use in Studio</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
