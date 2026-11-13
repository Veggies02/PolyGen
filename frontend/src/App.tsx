import React, { useState, useEffect, useCallback } from 'react';
import type { Asset, JobStatus, ProviderInfo, StatsOverview, GenerationSettings, ViewerOptions } from './types';
import { api } from './api/client';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Canvas3D } from './components/viewer/Canvas3D';
import { ViewerControls } from './components/viewer/ViewerControls';
import { ModelInspector } from './components/viewer/ModelInspector';
import { PromptBox } from './components/studio/PromptBox';
import { SettingsPanel } from './components/studio/SettingsPanel';
import { JobProgressModal } from './components/studio/JobProgressModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { AssetGalleryView } from './components/gallery/AssetGalleryView';
import { Box, AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'studio' | 'gallery'>('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Live Three.js Geometry Telemetry
  const [liveStats, setLiveStats] = useState<{
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
  }>({
    polyCount: 0,
    vertexCount: 0,
    dimensions: { x: 0, y: 0, z: 0 },
    materialCount: 0,
  });

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
          // Refresh assets and stats
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

  return (
    <div className="flex h-screen w-screen bg-[#090a0f] text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        assetCount={assets.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentView={currentView}
          onNavigateStudio={() => setCurrentView('studio')}
        />

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
            />
          )}

          {currentView === 'studio' && (
            <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">
              {/* Left Column: Generation Controls */}
              <div className="w-full lg:w-96 p-4 border-r border-slate-800/80 bg-slate-950/60 overflow-y-auto flex flex-col gap-4 shrink-0">
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

              {/* Center: 3D Viewport Workspace */}
              <div className="flex-1 relative flex flex-col min-w-0 h-[50vh] lg:h-full bg-[#0c0e14]">
                {/* Floating Top Controls Toolbar */}
                <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                  <div className="pointer-events-auto">
                    <ViewerControls
                      options={viewerOptions}
                      onChange={setViewerOptions}
                    />
                  </div>

                  {activeAsset && (
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs backdrop-blur-md pointer-events-auto">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-medium text-white max-w-[200px] truncate">
                        {activeAsset.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3D Canvas */}
                <Canvas3D
                  modelUrl={activeAsset ? api.getDownloadUrl(activeAsset.id, 'glb') : null}
                  options={viewerOptions}
                  onStatsCalculated={setLiveStats}
                  className="w-full h-full"
                />

                {/* Bottom Model Quick-Switch Strip */}
                {assets.length > 0 && (
                  <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-2 overflow-x-auto p-2 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
                    <span className="text-[11px] font-medium text-slate-500 uppercase px-2 shrink-0">
                      Models:
                    </span>
                    {assets.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setActiveAsset(a)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                          activeAsset?.id === a.id
                            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm shadow-cyan-500/30'
                            : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                        }`}
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Model Inspector */}
              <div className="w-full lg:w-80 p-4 border-l border-slate-800/80 bg-slate-950/60 overflow-y-auto shrink-0 flex flex-col gap-4">
                <ModelInspector
                  asset={activeAsset}
                  liveStats={liveStats}
                />
              </div>
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
    </div>
  );
};

export default App;
