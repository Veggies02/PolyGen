import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Asset } from '../../types';
import { api } from '../../api/client';
import { 
  X, 
  GitCompare, 
  Sliders, 
  Layers, 
  RotateCw, 
  Box, 
  Download,
  Columns,
  Eye,
  Loader2
} from 'lucide-react';

interface ModelCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetA: Asset | null;
  assetB: Asset | null;
}

export const ModelCompareModal: React.FC<ModelCompareModalProps> = ({
  isOpen,
  onClose,
  assetA,
  assetB,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const groupARef = useRef<THREE.Group | null>(null);
  const groupBRef = useRef<THREE.Group | null>(null);

  const [compareMode, setCompareMode] = useState<'ghost' | 'split'>('ghost');
  const [blendFactor, setBlendFactor] = useState<number>(0.5); // 0 = Model A, 1 = Model B
  const [wireframeOverlay, setWireframeOverlay] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [loadingA, setLoadingA] = useState<boolean>(true);
  const [loadingB, setLoadingB] = useState<boolean>(true);

  // Initialize Three.js Viewport
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    // Studio gradient backdrop
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 360);
      grad.addColorStop(0, '#1a2234');
      grad.addColorStop(1, '#070a10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 512; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }
    }
    scene.background = new THREE.CanvasTexture(canvas);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.8, 2.2, 3.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Dual ground grid
    const grid = new THREE.GridHelper(10, 20, 0x06b6d4, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Studio Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x06b6d4, 1.8);
    cyanRim.position.set(-5, 4, -4);
    scene.add(cyanRim);

    const amberFill = new THREE.DirectionalLight(0xf59e0b, 1.5);
    amberFill.position.set(4, 2, -5);
    scene.add(amberFill);

    const groupA = new THREE.Group();
    const groupB = new THREE.Group();
    scene.add(groupA);
    scene.add(groupB);
    groupARef.current = groupA;
    groupBRef.current = groupB;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isOpen]);

  // Load Model A
  useEffect(() => {
    if (!isOpen || !assetA || !groupARef.current) return;
    const groupA = groupARef.current;
    groupA.clear();
    setLoadingA(true);

    const loader = new GLTFLoader();
    loader.load(
      api.getDownloadUrl(assetA.id, 'glb'),
      (gltf) => {
        const obj = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(obj);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const normScale = 2.0 / maxDim;

        obj.scale.setScalar(normScale);
        obj.position.x = -center.x * normScale;
        obj.position.z = -center.z * normScale;
        obj.position.y = -bbox.min.y * normScale;

        groupA.add(obj);
        setLoadingA(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load assetA in compare modal:', err);
        setLoadingA(false);
      }
    );
  }, [isOpen, assetA]);

  // Load Model B
  useEffect(() => {
    if (!isOpen || !assetB || !groupBRef.current) return;
    const groupB = groupBRef.current;
    groupB.clear();
    setLoadingB(true);

    const loader = new GLTFLoader();
    loader.load(
      api.getDownloadUrl(assetB.id, 'glb'),
      (gltf) => {
        const obj = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(obj);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const normScale = 2.0 / maxDim;

        obj.scale.setScalar(normScale);
        obj.position.x = -center.x * normScale;
        obj.position.z = -center.z * normScale;
        obj.position.y = -bbox.min.y * normScale;

        groupB.add(obj);
        setLoadingB(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load assetB in compare modal:', err);
        setLoadingB(false);
      }
    );
  }, [isOpen, assetB]);

  // Update Materials & Positions based on compareMode, blendFactor, and wireframeOverlay
  useEffect(() => {
    if (!groupARef.current || !groupBRef.current) return;
    const groupA = groupARef.current;
    const groupB = groupBRef.current;

    // Positioning: In ghost mode, overlap at origin; in split mode, offset by X +/- 1.4
    if (compareMode === 'ghost') {
      groupA.position.set(0, 0, 0);
      groupB.position.set(0, 0, 0);
    } else {
      groupA.position.set(-1.4, 0, 0);
      groupB.position.set(1.4, 0, 0);
    }

    // Material Styling
    // Model A: Cyan Holographic
    const alphaA = compareMode === 'ghost' ? Math.max(0.08, (1 - blendFactor) * 0.85) : 0.9;
    groupA.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#06b6d4'),
          metalness: 0.2,
          roughness: 0.3,
          transparent: true,
          opacity: alphaA,
          wireframe: wireframeOverlay,
        });
      }
    });

    // Model B: Amber Gold Holographic
    const alphaB = compareMode === 'ghost' ? Math.max(0.08, blendFactor * 0.85) : 0.9;
    groupB.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#f59e0b'),
          metalness: 0.2,
          roughness: 0.3,
          transparent: true,
          opacity: alphaB,
          wireframe: wireframeOverlay,
        });
      }
    });
  }, [compareMode, blendFactor, wireframeOverlay, loadingA, loadingB]);

  // Auto Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [autoRotate]);

  if (!isOpen || !assetA || !assetB) return null;

  const polyDelta = assetB.poly_count - assetA.poly_count;
  const polyDeltaPercent = ((polyDelta / (assetA.poly_count || 1)) * 100).toFixed(1);
  const vertexDelta = assetB.vertex_count - assetA.vertex_count;
  const sizeDeltaKB = ((assetB.file_size_bytes - assetA.file_size_bytes) / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                3D Model A/B Diff & Geometry Comparison
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono">
                  Real-Time Hologram
                </span>
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400" />
                  Model A: {assetA.title}
                </span>
                <span>vs</span>
                <span className="flex items-center gap-1.5 font-medium text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400" />
                  Model B: {assetB.title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Comparison (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 3D Diff Canvas (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-[380px]">
            {/* Viewport Toolbar */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCompareMode('ghost')}
                  className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                    compareMode === 'ghost'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ghost Overlap</span>
                </button>
                <button
                  onClick={() => setCompareMode('split')}
                  className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                    compareMode === 'split'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Side-by-Side</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWireframeOverlay(!wireframeOverlay)}
                  className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                    wireframeOverlay
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Wireframe Edges"
                >
                  <Layers className="w-3 h-3" />
                  <span>Wireframe</span>
                </button>

                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`p-1.5 rounded-lg border transition-all ${
                    autoRotate
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Turntable Rotation"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Interactive Viewport Container */}
            <div className="relative flex-1 min-h-[320px] rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

              {(loadingA || loadingB) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                  <span className="text-xs font-semibold text-slate-300">Synchronizing 3D Meshes...</span>
                </div>
              )}

              {/* Viewport Badge */}
              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 font-mono">
                  {compareMode === 'ghost' ? 'Overlap Diff (0,0,0)' : 'Split Synchronized (-1.4m / +1.4m)'}
                </span>
              </div>
            </div>

            {/* Opacity Cross-Dissolve Slider (Ghost Mode) */}
            {compareMode === 'ghost' && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-medium">Model A (Cyan): {Math.round((1 - blendFactor) * 100)}%</span>
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-slate-500" />
                    Cross-Dissolve Blend
                  </span>
                  <span className="text-amber-400 font-medium">Model B (Amber): {Math.round(blendFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={blendFactor}
                  onChange={(e) => setBlendFactor(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Right Column: Comparative Metric Telemetry Table (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              Comparative Telemetry & Delta (Δ)
            </div>

            {/* Metric Comparison Cards */}
            <div className="space-y-2.5">
              {/* Polygons */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Polygon Count</span>
                  <span className={`font-mono text-xs font-bold ${
                    polyDelta < 0 ? 'text-emerald-400' : polyDelta > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {polyDelta > 0 ? `+${polyDelta.toLocaleString()}` : polyDelta.toLocaleString()} ({polyDeltaPercent}%)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px]">
                    <span className="text-cyan-400/80 block text-[10px]">Model A:</span>
                    <span className="font-mono font-bold text-cyan-200">{assetA.poly_count.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px]">
                    <span className="text-amber-400/80 block text-[10px]">Model B:</span>
                    <span className="font-mono font-bold text-amber-200">{assetB.poly_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Vertices */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Vertex Count</span>
                  <span className={`font-mono text-xs font-bold ${
                    vertexDelta < 0 ? 'text-emerald-400' : vertexDelta > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {vertexDelta > 0 ? `+${vertexDelta.toLocaleString()}` : vertexDelta.toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px]">
                    <span className="text-cyan-400/80 block text-[10px]">Model A:</span>
                    <span className="font-mono font-bold text-cyan-200">{assetA.vertex_count.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px]">
                    <span className="text-amber-400/80 block text-[10px]">Model B:</span>
                    <span className="font-mono font-bold text-amber-200">{assetB.vertex_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* File Size */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">GLTF File Size</span>
                  <span className="font-mono text-xs font-bold text-slate-300">
                    {Number(sizeDeltaKB) > 0 ? `+${sizeDeltaKB} KB` : `${sizeDeltaKB} KB`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                    <span className="text-slate-400 block text-[10px]">Model A:</span>
                    <span className="font-mono text-slate-200">{(assetA.file_size_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                    <span className="text-slate-400 block text-[10px]">Model B:</span>
                    <span className="font-mono text-slate-200">{(assetB.file_size_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              {/* Engine Provider & Generation Styles */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Synthesis Engine:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-medium">{assetA.provider}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-amber-300 font-medium">{assetB.provider}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Aesthetic Style:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-medium capitalize">{assetA.style}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-amber-300 font-medium capitalize">{assetB.style}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Export Both */}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <a
                href={api.getDownloadUrl(assetA.id, 'glb')}
                download={`${assetA.id}.glb`}
                className="flex-1 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Model A</span>
              </a>
              <a
                href={api.getDownloadUrl(assetB.id, 'glb')}
                download={`${assetB.id}.glb`}
                className="flex-1 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Model B</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
