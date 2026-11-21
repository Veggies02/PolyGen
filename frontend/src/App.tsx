import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  Asset, 
  JobStatus, 
  ProviderInfo, 
  StatsOverview, 
  GenerationSettings, 
  ViewerOptions, 
  TransformData,
  ModelAnnotation,
  MeasurementData 
} from './types';
import { api } from './api/client';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Canvas3D } from './components/viewer/Canvas3D';
import { ModelInspector } from './components/viewer/ModelInspector';
import { PromptBox } from './components/studio/PromptBox';
import { SettingsPanel } from './components/studio/SettingsPanel';
import { JobProgressModal } from './components/studio/JobProgressModal';
import { GenerationHistoryModal } from './components/studio/GenerationHistoryModal';
import { RenderStudioModal } from './components/studio/RenderStudioModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { AssetGalleryView } from './components/gallery/AssetGalleryView';
import { PromptLabView } from './components/studio/PromptLabView';
import { 
  CommandPaletteModal, 
  ConfigApiModal, 
  HelpModal, 
  PlanModal 
} from './components/modals/ActionModals';
import { AlertCircle, RefreshCw, Minimize2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'studio' | 'gallery' | 'promptlab'>('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Zen Mode state (Fullscreen Mixar Viewport)
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

  // Global Action Modals state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isConfigApiOpen, setIsConfigApiOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isRenderStudioOpen, setIsRenderStudioOpen] = useState<boolean>(false);
  const [helpModalSection, setHelpModalSection] = useState<'guides' | 'faq' | 'support' | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);

  // Live Three.js Geometry Telemetry
  const [liveStats, setLiveStats] = useState<{
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
    surfaceArea?: number;
    volume?: number;
  }>({
    polyCount: 0,
    vertexCount: 0,
    dimensions: { x: 0, y: 0, z: 0 },
    materialCount: 0,
  });

  // Live Transform Telemetry & Explode Assembly State
  const [transformData, setTransformData] = useState<TransformData>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  // 3D Viewport Annotations & Caliper Measurement State
  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  const [measurementData, setMeasurementData] = useState<MeasurementData | null>(null);
  const focusAnnotationRef = useRef<((ann: ModelAnnotation) => void) | null>(null);
  const captureSnapshotRef = useRef<((options: { width: number; height: number; transparent: boolean; watermark: boolean }) => string) | null>(null);

  // 3D Viewer Configuration
  const [viewerOptions, setViewerOptions] = useState<ViewerOptions>({
    wireframe: false,
    grid: true,
    autoRotate: false,
    shadingMode: 'pbr',
    lightingPreset: 'studio',
    backgroundColor: '#0c0e14',
    exposure: 1.1,
  });

  // Studio Generation Settings
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    prompt: 'futuristic tactical stealth recon drone with dual thruster wings and sensor array',
    negative_prompt: '',
    provider: 'demo',
    style: 'scifi',
    poly_budget: 'medium',
    symmetry: true,
    seed: undefined,
  });

  // Active Job for modal tracking
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null);

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsConfigApiOpen(false);
        setIsHistoryOpen(false);
        setIsRenderStudioOpen(false);
        setHelpModalSection(null);
        setIsPlanModalOpen(false);
        if (isZenMode) {
          setIsZenMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode]);

  // Fetch initial data
  const loadInitialData = useCallback(async () => {
    setBackendError(null);
    try {
      const [assetsData, providersData, statsData] = await Promise.all([
        api.listAssets(),
        api.getProviders(),
        api.getStats(),
      ]);

      setAssets(assetsData);
      setProviders(providersData);
      setStats(statsData);

      if (assetsData.length > 0 && !activeAsset) {
        setActiveAsset(assetsData[0]);
      }
    } catch (err: any) {
      console.error('Failed to connect to PolyGen backend:', err);
      setBackendError(
        'Unable to reach PolyGen FastAPI backend at http://127.0.0.1:8000. Ensure the backend server is running.'
      );
    }
  }, [activeAsset]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle Generate
  const handleGenerate = async () => {
    try {
      const job = await api.generate(generationSettings);
      setActiveJob(job);
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    }
  };

  // Poll Active Job
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await api.getJob(activeJob.id);
        setActiveJob(updated);

        if (updated.status === 'completed') {
          const [updatedAssets, updatedStats] = await Promise.all([
            api.listAssets(),
            api.getStats(),
          ]);
          setAssets(updatedAssets);
          setStats(updatedStats);

          if (updated.asset_id) {
            const newAsset = updatedAssets.find((a) => a.id === updated.asset_id);
            if (newAsset) {
              setActiveAsset(newAsset);
            }
          }
        }
      } catch (err) {
        console.error('Failed polling job:', err);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [activeJob]);

  // Handle Inspect Asset from any view
  const handleInspectAsset = (asset: Asset) => {
    setActiveAsset(asset);
    setCurrentView('studio');
  };

  const handleAssetProcessed = (newAsset: Asset, _newModelUrl?: string) => {
    setAssets((prev) => [newAsset, ...prev.filter((a) => a.id !== newAsset.id)]);
    setActiveAsset(newAsset);
    api.getStats().then(setStats).catch(console.error);
  };

  // Handle Delete Asset
  const handleDeleteAsset = async (id: string) => {
    try {
      await api.deleteAsset(id);
      const updated = assets.filter((a) => a.id !== id);
      setAssets(updated);
      if (activeAsset?.id === id) {
        setActiveAsset(updated.length > 0 ? updated[0] : null);
      }
      api.getStats().then(setStats).catch(() => {});
    } catch (err: any) {
      alert(`Failed to delete asset: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#090a0f] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar (collapses in Zen Mode for distraction-free 3D work) */}
      {!isZenMode && (
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenHelp={(sec) => setHelpModalSection(sec)}
          onOpenPlan={() => setIsPlanModalOpen(true)}
          onOpenConfigApi={() => setIsConfigApiOpen(true)}
          assetCount={assets.length}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header (hidden in Zen Mode for full-bleed 3D viewport) */}
        {!isZenMode && (
          <Header
            currentView={currentView}
            onNavigateStudio={() => setCurrentView('studio')}
            onOpenConfigApi={() => setIsConfigApiOpen(true)}
            onOpenHistory={() => setIsHistoryOpen(true)}
            assetCount={assets.length}
          />
        )}

        {/* Floating Exit Zen Mode Button if in Zen Mode */}
        {isZenMode && (
          <div className="absolute top-3 right-4 z-50">
            <button
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl transition-all"
              title="Exit Zen Mode (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Zen Mode</span>
            </button>
          </div>
        )}

        {/* Backend Error Banner */}
        {backendError && (
          <div className="p-3 bg-rose-950/90 border-b border-rose-500/40 text-xs text-rose-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{backendError}</span>
            </div>
            <button
              onClick={loadInitialData}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* View Switcher */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              stats={stats}
              recentAssets={assets}
              providers={providers}
              onNavigateStudio={() => setCurrentView('studio')}
              onInspectAsset={handleInspectAsset}
              onNavigateGallery={() => setCurrentView('gallery')}
            />
          )}

          {currentView === 'gallery' && (
            <AssetGalleryView
              assets={assets}
              onInspectAsset={handleInspectAsset}
              onDeleteAsset={handleDeleteAsset}
            />
          )}

          {currentView === 'promptlab' && (
            <PromptLabView
              onSelectPrompt={(promptText, style, polyBudget) => {
                setGenerationSettings((prev) => ({
                  ...prev,
                  prompt: promptText,
                  style: style || prev.style,
                  poly_budget: polyBudget || prev.poly_budget,
                }));
              }}
              onNavigateStudio={() => setCurrentView('studio')}
            />
          )}

          {currentView === 'studio' && (
            <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
              {/* Left Column: Tripo-style Generation Controls (hidden in Zen Mode) */}
              {!isZenMode && (
                <div className="w-full lg:w-96 p-4 border-r border-slate-800/80 bg-slate-950/90 overflow-y-auto flex flex-col gap-4 shrink-0">
                  <PromptBox
                    prompt={generationSettings.prompt}
                    negativePrompt={generationSettings.negative_prompt || ''}
                    style={generationSettings.style}
                    onPromptChange={(val) =>
                      setGenerationSettings({ ...generationSettings, prompt: val })
                    }
                    onNegativePromptChange={(val) =>
                      setGenerationSettings({ ...generationSettings, negative_prompt: val })
                    }
                    onGenerate={handleGenerate}
                    disabled={activeJob?.status === 'synthesizing' || activeJob?.status === 'meshing'}
                  />

                  <SettingsPanel
                    settings={generationSettings}
                    providers={providers}
                    onChange={setGenerationSettings}
                    disabled={activeJob?.status === 'synthesizing' || activeJob?.status === 'meshing'}
                  />
                </div>
              )}

              {/* Center: Mixar 3D Studio Viewport */}
              <div className="flex-1 relative flex flex-col min-w-0 h-[50vh] lg:h-full bg-[#0c0e14]">
                <Canvas3D
                  modelUrl={activeAsset ? api.getDownloadUrl(activeAsset.id, 'glb') : null}
                  assetTitle={activeAsset?.title}
                  assetId={activeAsset?.id}
                  options={viewerOptions}
                  onOptionsChange={setViewerOptions}
                  onStatsCalculated={setLiveStats}
                  onTransformChange={setTransformData}
                  explodeFactor={explodeFactor}
                  onExplodeChange={setExplodeFactor}
                  annotations={annotations}
                  onAnnotationsChange={setAnnotations}
                  measurementData={measurementData}
                  onMeasurementChange={setMeasurementData}
                  onFocusAnnotationRef={focusAnnotationRef}
                  captureSnapshotRef={captureSnapshotRef}
                  isZenMode={isZenMode}
                  onToggleZenMode={() => setIsZenMode(!isZenMode)}
                  onAssetProcessed={handleAssetProcessed}
                  className="w-full h-full"
                />

                {/* Bottom Model Quick-Switch Strip */}
                {assets.length > 0 && !isZenMode && (
                  <div className="absolute bottom-12 left-4 right-4 z-10 flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
                    <span className="text-[10px] font-bold text-slate-500 uppercase px-2 shrink-0">
                      Models:
                    </span>
                    {assets.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setActiveAsset(a)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                          activeAsset?.id === a.id
                            ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                            : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Model Inspector (hidden in Zen Mode) */}
              {!isZenMode && (
                <div className="w-full lg:w-80 p-4 border-l border-slate-800/80 bg-slate-950/90 overflow-y-auto shrink-0 flex flex-col gap-4">
                  <ModelInspector
                    asset={activeAsset}
                    liveStats={liveStats}
                    options={viewerOptions}
                    onOptionsChange={setViewerOptions}
                    onDeleteAsset={handleDeleteAsset}
                    transformData={transformData}
                    explodeFactor={explodeFactor}
                    onExplodeChange={setExplodeFactor}
                    annotations={annotations}
                    onAnnotationsChange={setAnnotations}
                    onFocusAnnotation={(ann) => focusAnnotationRef.current?.(ann)}
                    measurementData={measurementData}
                    onResetMeasurement={() => setMeasurementData(null)}
                    onResetTransform={() => {
                      setTransformData({
                        position: [0, 0, 0],
                        rotation: [0, 0, 0],
                        scale: [1, 1, 1],
                      });
                      const resetBtn = document.querySelector('button[title*="Reset Position"]') as HTMLButtonElement;
                      if (resetBtn) resetBtn.click();
                    }}
                    onCaptureSnapshot={() => setIsRenderStudioOpen(true)}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Generation Progress Modal */}
      <JobProgressModal
        job={activeJob}
        onInspect={(assetId) => {
          const found = assets.find((a) => a.id === assetId);
          if (found) {
            setActiveAsset(found);
            setCurrentView('studio');
          }
          setActiveJob(null);
        }}
        onClose={() => setActiveJob(null)}
      />

      {/* Generation History & Queue Modal */}
      <GenerationHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onInspectAsset={handleInspectAsset}
        onReusePrompt={(promptText) => {
          setGenerationSettings((prev) => ({ ...prev, prompt: promptText }));
          setCurrentView('studio');
        }}
        assets={assets}
      />

      {/* Global Interactive Modals */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={(view) => {
          setCurrentView(view);
          setIsCommandPaletteOpen(false);
        }}
        onSelectAsset={handleInspectAsset}
        assets={assets}
      />

      <ConfigApiModal
        isOpen={isConfigApiOpen}
        onClose={() => setIsConfigApiOpen(false)}
        providers={providers}
      />

      {helpModalSection && (
        <HelpModal
          isOpen={Boolean(helpModalSection)}
          onClose={() => setHelpModalSection(null)}
          section={helpModalSection}
        />
      )}

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
      />

      {/* 4K High-Res Render Studio Modal */}
      <RenderStudioModal
        isOpen={isRenderStudioOpen}
        onClose={() => setIsRenderStudioOpen(false)}
        assetTitle={activeAsset?.title}
        onCapture={(opts) => {
          if (captureSnapshotRef.current) {
            return captureSnapshotRef.current(opts);
          }
          const canvas = document.querySelector('canvas');
          return canvas ? canvas.toDataURL('image/png') : null;
        }}
      />
    </div>
  );
};

export default App;
