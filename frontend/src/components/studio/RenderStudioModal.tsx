import React, { useState, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Download, 
  Check, 
  Sparkles, 
  Maximize2, 
  Sliders,
  Image as ImageIcon
} from 'lucide-react';

interface RenderStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetTitle?: string;
  onCapture: (options: {
    width: number;
    height: number;
    transparent: boolean;
    watermark: boolean;
  }) => string | null;
}

interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  aspect: string;
  badge: string;
}

const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: '1080p', label: '1080p Full HD', width: 1920, height: 1080, aspect: '16:9', badge: 'Fast' },
  { id: '2k', label: '2K Quad HD', width: 2560, height: 1440, aspect: '16:9', badge: 'Balanced' },
  { id: '4k', label: '4K Ultra HD', width: 3840, height: 2160, aspect: '16:9', badge: 'Cinema' },
  { id: 'square', label: 'Square Portfolio', width: 2048, height: 2048, aspect: '1:1', badge: 'Social / Catalog' },
  { id: 'viewport', label: 'Native Viewport', width: window.innerWidth, height: window.innerHeight, aspect: 'Window', badge: 'Exact' },
];

export const RenderStudioModal: React.FC<RenderStudioModalProps> = ({
  isOpen,
  onClose,
  assetTitle = 'PolyGen_Asset',
  onCapture,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<ResolutionPreset>(RESOLUTION_PRESETS[0]);
  const [transparent, setTransparent] = useState<boolean>(true);
  const [watermark, setWatermark] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Generate initial render preview when modal opens
  useEffect(() => {
    if (isOpen) {
      handleGenerateSnapshot(selectedPreset, transparent, watermark);
    } else {
      setPreviewUrl(null);
    }
  }, [isOpen]);

  const handleGenerateSnapshot = (
    preset: ResolutionPreset,
    isTransparent: boolean,
    isWatermark: boolean
  ) => {
    setIsRendering(true);
    setTimeout(() => {
      try {
        const dataUrl = onCapture({
          width: preset.width,
          height: preset.height,
          transparent: isTransparent,
          watermark: isWatermark,
        });
        setPreviewUrl(dataUrl);
      } catch (err) {
        console.error('Failed to capture snapshot:', err);
      } finally {
        setIsRendering(false);
      }
    }, 50);
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const cleanTitle = assetTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `PolyGen_${cleanTitle}_${selectedPreset.id}_${Date.now()}.png`;

    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                High-Resolution Render Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                  Up to 4K UHD
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Render and export production-grade marketing snapshots of <span className="text-slate-200 font-medium">"{assetTitle}"</span>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Preset & Export Options (5 cols) */}
          <div className="md:col-span-5 flex flex-col gap-5">
            {/* Resolution Presets */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                Render Resolution Preset
              </label>
              <div className="flex flex-col gap-2">
                {RESOLUTION_PRESETS.map((p) => {
                  const isSelected = selectedPreset.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPreset(p);
                        handleGenerateSnapshot(p, transparent, watermark);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500/70 text-white shadow-md shadow-amber-950/50'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs flex items-center gap-2">
                          <span>{p.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.width} × {p.height}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Aspect {p.aspect} • {p.badge}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Render Compositing Switches */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Compositing & Alpha
              </label>

              {/* Transparent BG Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Transparent Background</div>
                  <div className="text-[10px] text-slate-500">Isolate 3D asset with 32-bit PNG alpha channel</div>
                </div>
                <button
                  onClick={() => {
                    const next = !transparent;
                    setTransparent(next);
                    handleGenerateSnapshot(selectedPreset, next, watermark);
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
                    transparent ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      transparent ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Watermark Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <div>
                  <div className="text-xs font-semibold text-slate-200">PolyGen Studio Stamp</div>
                  <div className="text-[10px] text-slate-500">Include sleek bottom watermark branding</div>
                </div>
                <button
                  onClick={() => {
                    const next = !watermark;
                    setWatermark(next);
                    handleGenerateSnapshot(selectedPreset, transparent, next);
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
                    watermark ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      watermark ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Render Preview & Action (7 cols) */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                Render Preview
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {selectedPreset.width} × {selectedPreset.height} • PNG
              </span>
            </div>

            {/* Checkerboard Preview Frame */}
            <div className="relative flex-1 min-h-[260px] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center bg-slate-950 p-2">
              {transparent && (
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
              )}

              {isRendering ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
                  <span className="text-xs font-medium">Synthesizing High-Res Frame...</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Render Preview"
                  className="max-h-[320px] max-w-full object-contain rounded-lg shadow-2xl relative z-10"
                />
              ) : (
                <div className="text-xs text-slate-500">No snapshot generated</div>
              )}
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={!previewUrl || isRendering}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Download High-Res Snapshot ({selectedPreset.label})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
