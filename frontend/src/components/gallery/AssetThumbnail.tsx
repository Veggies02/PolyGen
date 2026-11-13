import React from 'react';
import type { Asset } from '../../types';

interface AssetThumbnailProps {
  asset: Asset;
}

export const AssetThumbnail: React.FC<AssetThumbnailProps> = ({ asset }) => {
  const title = (asset.title || '').toLowerCase();
  const prompt = (asset.prompt || '').toLowerCase();
  const fullText = `${title} ${prompt} ${asset.tags?.join(' ') || ''}`.toLowerCase();

  // Determine asset visual category
  const isDrone = fullText.includes('drone') || fullText.includes('aircraft') || fullText.includes('recon') || fullText.includes('ship') || fullText.includes('thruster');
  const isCrystal = fullText.includes('crystal') || fullText.includes('monolith') || fullText.includes('obsidian') || fullText.includes('resonator') || fullText.includes('gem');
  const isHelmet = fullText.includes('helmet') || fullText.includes('exo') || fullText.includes('visor') || fullText.includes('combat') || fullText.includes('cyberpunk');
  const isGyro = fullText.includes('gyro') || fullText.includes('kinetic') || fullText.includes('quantum') || fullText.includes('ring') || fullText.includes('core');
  const isBuilding = fullText.includes('building') || fullText.includes('house') || fullText.includes('tower') || fullText.includes('habitat') || fullText.includes('station') || fullText.includes('architecture');
  const isWeapon = fullText.includes('axe') || fullText.includes('weapon') || fullText.includes('blade') || fullText.includes('sword') || fullText.includes('rifle');

  return (
    <div className="relative w-full h-36 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/40 via-slate-950/80 to-[#07080c] group-hover:scale-[1.03] transition-all duration-300">
      {/* Isometric Floor Grid & Shadow Base */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity" viewBox="0 0 200 140">
        <defs>
          <radialGradient id={`floorGlow-${asset.id}`} cx="50%" cy="65%" r="45%">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#0f172a" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Floor shadow ellipse */}
        <ellipse cx="100" cy="105" rx="60" ry="20" fill={`url(#floorGlow-${asset.id})`} />
        {/* Isometric Grid lines */}
        <path d="M40 105 L100 75 L160 105 L100 135 Z" fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
        <path d="M60 105 L100 85 L140 105 L100 125 Z" fill="none" stroke="#475569" strokeWidth="0.8" />
        <path d="M100 75 L100 135" fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
        <path d="M40 105 L160 105" fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
      </svg>

      {/* Dynamic 3D Isometric SVG Models */}
      <div className="relative z-10 w-28 h-28 flex items-center justify-center filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]">
        {isDrone && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`droneBody-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id={`wingGlow-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            {/* Left Wing */}
            <polygon points="50,45 10,60 25,68 50,55" fill="url(#droneBody-1)" stroke="#38bdf8" strokeWidth="0.8" />
            {/* Right Wing */}
            <polygon points="50,45 90,60 75,68 50,55" fill="url(#droneBody-1)" stroke="#38bdf8" strokeWidth="0.8" />
            {/* Center Fuselage */}
            <polygon points="50,25 65,48 50,65 35,48" fill={`url(#droneBody-${asset.id})`} stroke="#94a3b8" strokeWidth="1" />
            {/* Cockpit Canopy */}
            <polygon points="50,32 58,45 50,52 42,45" fill="#38bdf8" fillOpacity="0.85" stroke="#7dd3fc" strokeWidth="1" />
            {/* Thruster Glows */}
            <circle cx="20" cy="64" r="2.5" fill="#38bdf8" />
            <circle cx="80" cy="64" r="2.5" fill="#38bdf8" />
            <circle cx="50" cy="62" r="2" fill="#fbbf24" />
          </svg>
        )}

        {isCrystal && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`crystTop-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id={`crystLeft-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#065f46" />
                <stop offset="100%" stopColor="#022c22" />
              </linearGradient>
              <linearGradient id={`crystRight-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Main Central Spire */}
            <polygon points="50,15 65,65 50,85 35,65" fill={`url(#crystRight-${asset.id})`} stroke="#6ee7b7" strokeWidth="0.8" />
            <polygon points="50,15 35,65 50,85" fill={`url(#crystLeft-${asset.id})`} stroke="#34d399" strokeWidth="0.8" />
            {/* Left Minor Cluster Spire */}
            <polygon points="32,38 42,70 30,80 22,55" fill={`url(#crystLeft-${asset.id})`} stroke="#10b981" strokeWidth="0.8" />
            {/* Right Minor Cluster Spire */}
            <polygon points="68,42 78,60 68,80 58,70" fill={`url(#crystTop-${asset.id})`} stroke="#34d399" strokeWidth="0.8" />
            {/* Energy Core Gleam */}
            <line x1="50" y1="20" x2="50" y2="78" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}

        {isHelmet && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`helmShell-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id={`visorGlow-${asset.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Helmet Cranium */}
            <path d="M25,50 C25,25 75,25 75,50 L72,75 L28,75 Z" fill={`url(#helmShell-${asset.id})`} stroke="#64748b" strokeWidth="1" />
            {/* Curving Ballistic Visor */}
            <path d="M30,42 Q50,38 70,42 L68,58 Q50,64 32,58 Z" fill={`url(#visorGlow-${asset.id})`} stroke="#fef08a" strokeWidth="1.2" />
            {/* Visor Glint */}
            <path d="M35,46 Q50,42 62,46" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.8" />
            {/* Lower Rebreather Module */}
            <rect x="42" y="66" width="16" height="10" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="0.8" />
            <line x1="45" y1="71" x2="55" y2="71" stroke="#fbbf24" strokeWidth="0.8" />
            {/* Ear Comms Nodes */}
            <circle cx="25" cy="54" r="4" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
            <circle cx="75" cy="54" r="4" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          </svg>
        )}

        {isGyro && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`goldRing-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="50%" stopColor="#ca8a04" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
            </defs>
            {/* Outer Gimbal Ring */}
            <ellipse cx="50" cy="50" rx="38" ry="18" fill="none" stroke={`url(#goldRing-${asset.id})`} strokeWidth="3" transform="rotate(-25 50 50)" />
            {/* Middle Gimbal Ring */}
            <ellipse cx="50" cy="50" rx="28" ry="14" fill="none" stroke="#38bdf8" strokeWidth="2.5" transform="rotate(35 50 50)" />
            {/* Inner Ring */}
            <ellipse cx="50" cy="50" rx="18" ry="9" fill="none" stroke="#ec4899" strokeWidth="2" transform="rotate(-65 50 50)" />
            {/* Core Polyhedron */}
            <polygon points="50,40 58,48 50,60 42,48" fill="#fef08a" stroke="#eab308" strokeWidth="1.2" />
            <circle cx="50" cy="49" r="3" fill="#ffffff" />
          </svg>
        )}

        {isBuilding && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`bldgFront-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id={`bldgSide-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
            </defs>
            {/* Isometric Tower Left Face */}
            <polygon points="50,20 25,35 25,80 50,65" fill={`url(#bldgSide-${asset.id})`} stroke="#475569" strokeWidth="0.8" />
            {/* Isometric Tower Right Face */}
            <polygon points="50,20 75,35 75,80 50,65" fill={`url(#bldgFront-${asset.id})`} stroke="#38bdf8" strokeWidth="0.8" />
            {/* Isometric Tower Roof */}
            <polygon points="50,20 25,35 50,50 75,35" fill="#64748b" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Roof Spire Antenna */}
            <line x1="50" y1="20" x2="50" y2="8" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="50" cy="8" r="2" fill="#ef4444" />
            {/* Windows Matrix */}
            <rect x="56" y="45" width="4" height="6" fill="#fef08a" opacity="0.9" />
            <rect x="64" y="50" width="4" height="6" fill="#fef08a" opacity="0.9" />
            <rect x="56" y="57" width="4" height="6" fill="#fef08a" opacity="0.9" />
            <rect x="64" y="62" width="4" height="6" fill="#fef08a" opacity="0.9" />
          </svg>
        )}

        {isWeapon && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`bladeGlow-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {/* Shaft */}
            <line x1="25" y1="75" x2="70" y2="30" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
            {/* Grip Wrapping */}
            <line x1="28" y1="72" x2="40" y2="60" stroke="#d97706" strokeWidth="5" />
            {/* Dual Axe Blades */}
            <polygon points="65,35 85,20 75,45 60,40" fill={`url(#bladeGlow-${asset.id})`} stroke="#c084fc" strokeWidth="1" />
            <polygon points="65,35 48,15 55,38 60,40" fill={`url(#bladeGlow-${asset.id})`} stroke="#c084fc" strokeWidth="1" />
            {/* Central Rune Core */}
            <circle cx="62" cy="37" r="3.5" fill="#fef08a" stroke="#a855f7" strokeWidth="1" />
          </svg>
        )}

        {/* Fallback Curated Isometric Polyhedron */}
        {!isDrone && !isCrystal && !isHelmet && !isGyro && !isBuilding && !isWeapon && (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id={`polyTop-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
              <linearGradient id={`polyLeft-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#854d0e" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
              <linearGradient id={`polyRight-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Isometric 3D Cube Polyhedron */}
            <polygon points="50,22 76,37 50,52 24,37" fill={`url(#polyTop-${asset.id})`} stroke="#fef08a" strokeWidth="0.8" />
            <polygon points="24,37 50,52 50,82 24,67" fill={`url(#polyLeft-${asset.id})`} stroke="#ca8a04" strokeWidth="0.8" />
            <polygon points="50,52 76,37 76,67 50,82" fill={`url(#polyRight-${asset.id})`} stroke="#eab308" strokeWidth="0.8" />
            {/* Center Vertex Star */}
            <circle cx="50" cy="52" r="2.5" fill="#ffffff" />
          </svg>
        )}
      </div>
    </div>
  );
};
