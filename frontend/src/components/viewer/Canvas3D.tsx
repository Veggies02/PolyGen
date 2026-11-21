import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { 
  Loader2, 
  AlertCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Grid, 
  Box, 
  Sliders, 
  MousePointer, 
  Move, 
  RotateCw, 
  Scale, 
  Ruler, 
  ChevronDown, 
  Minimize2, 
  Maximize2,
  Plus,
  Camera,
  Archive,
  UploadCloud,
  Video,
  Layers,
  Scissors,
  MapPin,
  Crosshair,
  Trash2,
  Sun,
  Sparkles,
  Upload,
  CheckCircle2,
  Info,
  FileText,
  X,
  Gauge
} from 'lucide-react';
import { api } from '../../api/client';
import type {
  ViewerOptions,
  TransformData,
  ModelAnnotation,
  MeasurementData,
  Asset,
  MeshProcessingCapabilities,
  MeshProcessResponse,
  TextureStyleInfo,
} from '../../types';

function createProceduralMatcapTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(96, 80, 8, 128, 128, 128);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.2, '#94a3b8');
    grad.addColorStop(0.55, '#475569');
    grad.addColorStop(0.85, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const patternCache = new Map<string, THREE.CanvasTexture>();

function getProceduralPatternTexture(pattern: string): THREE.CanvasTexture | null {
  if (!pattern || pattern === 'none') return null;
  if (patternCache.has(pattern)) return patternCache.get(pattern)!;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (pattern === 'checker') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
  } else if (pattern === 'hex-armor') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    const r = 18;
    const a = (2 * Math.PI) / 6;
    for (let x = -20; x < 150; x += 32) {
      for (let y = -20; y < 150; y += 28) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          ctx.lineTo(x + r * Math.cos(a * i), y + r * Math.sin(a * i));
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (pattern === 'carbon-weave') {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#27272a';
    for (let x = 0; x < 128; x += 16) {
      for (let y = 0; y < 128; y += 16) {
        if ((x / 16 + y / 16) % 2 === 0) {
          ctx.fillRect(x, y, 16, 16);
        }
      }
    }
  } else if (pattern === 'tech-circuit') {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 20); ctx.lineTo(50, 20); ctx.lineTo(70, 40); ctx.lineTo(120, 40);
    ctx.moveTo(20, 100); ctx.lineTo(60, 100); ctx.lineTo(80, 80); ctx.lineTo(120, 80);
    ctx.stroke();
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(10, 20, 3, 0, Math.PI * 2);
    ctx.arc(120, 40, 3, 0, Math.PI * 2);
    ctx.arc(20, 100, 3, 0, Math.PI * 2);
    ctx.arc(120, 80, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  patternCache.set(pattern, tex);
  return tex;
}

interface Canvas3DProps {
  modelUrl?: string | null;
  assetTitle?: string;
  assetId?: string;
  options: ViewerOptions;
  onOptionsChange?: (options: ViewerOptions) => void;
  onStatsCalculated?: (stats: {
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
    surfaceArea?: number;
    volume?: number;
  }) => void;
  onTransformChange?: (transform: TransformData) => void;
  explodeFactor?: number;
  onExplodeChange?: (factor: number) => void;
  annotations?: ModelAnnotation[];
  onAnnotationsChange?: (annotations: ModelAnnotation[]) => void;
  measurementData?: MeasurementData | null;
  onMeasurementChange?: (measurement: MeasurementData | null) => void;
  onFocusAnnotationRef?: React.MutableRefObject<((ann: ModelAnnotation) => void) | null>;
  captureSnapshotRef?: React.MutableRefObject<((options: { width: number; height: number; transparent: boolean; watermark: boolean }) => string) | null>;
  className?: string;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  onAssetProcessed?: (newAsset: Asset, newModelUrl: string) => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  modelUrl,
  assetTitle,
  assetId,
  options,
  onOptionsChange,
  onStatsCalculated,
  onTransformChange,
  explodeFactor = 0,
  onExplodeChange,
  annotations,
  onAnnotationsChange,
  measurementData,
  onMeasurementChange,
  onFocusAnnotationRef,
  captureSnapshotRef,
  className = '',
  isZenMode = false,
  onToggleZenMode,
  onAssetProcessed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null);
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.8));
  const planeHelperRef = useRef<THREE.PlaneHelper | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const transformHelperRef = useRef<THREE.Object3D | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const primitivesGroupRef = useRef<THREE.Group | null>(null);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const annotationsGroupRef = useRef<THREE.Group | null>(null);
  const wireframeOverlayGroupRef = useRef<THREE.Group | null>(null);
  const matcapTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const uvCanvasRef = useRef<HTMLCanvasElement>(null);
  const firstMeshRef = useRef<THREE.Mesh | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  const [activeModelUrl, setActiveModelUrl] = useState<string | null>(modelUrl || null);
  const [loadedMeshRevision, setLoadedMeshRevision] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync internal activeModelUrl with external prop
  useEffect(() => {
    setActiveModelUrl(modelUrl || null);
  }, [modelUrl]);

  // UV Inspection telemetry state
  const [uvStats, setUvStats] = useState<{
    hasUV: boolean;
    uvVertexCount: number;
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
    in01Range: boolean;
  } | null>(null);

  // Texturing Studio state (Milestones 6 & 7A)
  const [modelSource, setModelSource] = useState<'current' | 'upload'>('current');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [textureProvider, setTextureProvider] = useState<'procedural' | 'stable_diffusion'>('procedural');
  const [textureStyle, setTextureStyle] = useState<string>('scifi');
  const [texturePrompt, setTexturePrompt] = useState<string>('');
  const [textureResolution, setTextureResolution] = useState<number>(512);
  const [metallicFactor, setMetallicFactor] = useState<number>(0.5);
  const [roughnessFactor, setRoughnessFactor] = useState<number>(0.5);
  const [fallbackToProcedural, setFallbackToProcedural] = useState<boolean>(true);

  // QEM Mesh Simplification Options (Milestone 7A)
  const [enableOptimization, setEnableOptimization] = useState<boolean>(false);
  const [targetPreset, setTargetPreset] = useState<'high' | 'medium' | 'low' | 'custom'>('medium');
  const [customTargetFaces, setCustomTargetFaces] = useState<number>(10000);
  const [optimizationMode, setOptimizationMode] = useState<'faces' | 'ratio'>('faces');
  const [reductionPercentage, setReductionPercentage] = useState<number>(50);

  // Capabilities & Style list fetched from backend
  const [capabilities, setCapabilities] = useState<MeshProcessingCapabilities | null>(null);
  const [availableStyles, setAvailableStyles] = useState<TextureStyleInfo[]>([]);

  // Processing execution & telemetry
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processSuccess, setProcessSuccess] = useState<MeshProcessResponse | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processWarning, setProcessWarning] = useState<string | null>(null);

  // Studio tabs and tools
  const [activeTab, setActiveTab] = useState<'modeling' | 'uv' | 'texturing'>('modeling');
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'rotate' | 'scale' | 'transform' | 'measure' | 'explode' | 'section' | 'annotate'>('select');
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const [objectMode, setObjectMode] = useState<'Object Mode' | 'Edit Mode' | 'Sculpt Mode'>('Object Mode');
  const [coordSystem, setCoordSystem] = useState<'Global' | 'Local'>('Global');
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showModeMenu, setShowModeMenu] = useState<boolean>(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [localExplode, setLocalExplode] = useState<number>(0);
  const effectiveExplode = explodeFactor !== undefined ? explodeFactor : localExplode;

  // Annotations & Precision Caliper State
  const [localAnnotations, setLocalAnnotations] = useState<ModelAnnotation[]>([]);
  const effectiveAnnotations = annotations !== undefined ? annotations : localAnnotations;
  const effectiveAnnotationsRef = useRef(effectiveAnnotations);
  effectiveAnnotationsRef.current = effectiveAnnotations;

  const [localMeasurement, setLocalMeasurement] = useState<MeasurementData | null>(null);
  const effectiveMeasurement = measurementData !== undefined ? measurementData : localMeasurement;

  const [measurePointA, setMeasurePointA] = useState<THREE.Vector3 | null>(null);
  const [measurePointB, setMeasurePointB] = useState<THREE.Vector3 | null>(null);
  const measurePointARef = useRef<THREE.Vector3 | null>(null);
  const measurePointBRef = useRef<THREE.Vector3 | null>(null);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [projectedAnnotations, setProjectedAnnotations] = useState<
    Array<{ id: string; x: number; y: number; title: string; index: number; visible: boolean }>
  >([]);
  
  // Animation / Turntable timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [liveBounds, setLiveBounds] = useState<{ x: number; y: number; z: number }>({ x: 1, y: 1, z: 1 });

  // Sync external measurementData reset
  useEffect(() => {
    if (measurementData === null) {
      setMeasurePointA(null);
      setMeasurePointB(null);
      measurePointARef.current = null;
      measurePointBRef.current = null;
      setLocalMeasurement(null);
    }
  }, [measurementData]);

  // Local File Import & Video Recording State
  const [importedModelUrl, setImportedModelUrl] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.backgroundColor || '#0c0e14');
    sceneRef.current = scene;

    const perspCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    perspCamera.position.set(3.5, 2.8, 4.5);
    cameraRef.current = perspCamera;
    perspCameraRef.current = perspCamera;

    const aspect = width / height;
    const frustumSize = 4.5;
    const orthoCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    orthoCamera.position.set(3.5, 2.8, 4.5);
    orthoCameraRef.current = orthoCamera;

    const initialCamera = options.cameraProjection === 'orthographic' ? orthoCamera : perspCamera;
    activeCameraRef.current = initialCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = options.exposure || 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(initialCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    // Dual-Tier Ground Grid
    const grid = new THREE.GridHelper(16, 32, 0x00f0ff, 0x1f2638);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // CAD Cross-Section Plane Helper
    const planeHelper = new THREE.PlaneHelper(clipPlaneRef.current, 5, 0x06b6d4);
    planeHelper.visible = Boolean(options.clipping?.enabled && options.clipping?.showPlane);
    scene.add(planeHelper);
    planeHelperRef.current = planeHelper;

    // Lights
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;

    // Model Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Primitives Group (for Add menu shapes)
    const primitivesGroup = new THREE.Group();
    scene.add(primitivesGroup);
    primitivesGroupRef.current = primitivesGroup;

    // Measurement Group (for 3D Caliper lines & locator spheres)
    const measurementGroup = new THREE.Group();
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    // Annotations Group (for surface hotspot pins)
    const annotationsGroup = new THREE.Group();
    scene.add(annotationsGroup);
    annotationsGroupRef.current = annotationsGroup;

    // Wireframe Overlay Group (for superimposed topological wireframe cage)
    const wireframeOverlayGroup = new THREE.Group();
    scene.add(wireframeOverlayGroup);
    wireframeOverlayGroupRef.current = wireframeOverlayGroup;

    // Pointer Raycasting for Measure & Annotation clicks
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const duration = Date.now() - downTime;
      if (dist > 5 || duration > 600) return;
      handleRaycastClick(e);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Transform Controls for Interactive Viewport Manipulation
    const transformControls = new TransformControls(initialCamera, renderer.domElement);
    transformControls.size = 0.75;
    const transformHelper = transformControls.getHelper();
    scene.add(transformHelper);
    transformControlsRef.current = transformControls;
    transformHelperRef.current = transformHelper;

    transformControls.addEventListener('dragging-changed', (event: any) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    });

    transformControls.addEventListener('change', () => {
      if (boxHelperRef.current) {
        boxHelperRef.current.update();
      }
      if (modelGroupRef.current) {
        const p = modelGroupRef.current.position;
        const r = modelGroupRef.current.rotation;
        const s = modelGroupRef.current.scale;
        onTransformChangeRef.current?.({
          position: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
          rotation: [
            Number(THREE.MathUtils.radToDeg(r.x).toFixed(1)),
            Number(THREE.MathUtils.radToDeg(r.y).toFixed(1)),
            Number(THREE.MathUtils.radToDeg(r.z).toFixed(1)),
          ],
          scale: [Number(s.x.toFixed(2)), Number(s.y.toFixed(2)), Number(s.z.toFixed(2))],
        });
      }
    });

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0 && rendererRef.current) {
          if (perspCameraRef.current) {
            perspCameraRef.current.aspect = w / h;
            perspCameraRef.current.updateProjectionMatrix();
          }
          if (orthoCameraRef.current) {
            const asp = w / h;
            const fSize = 4.5;
            orthoCameraRef.current.left = (-fSize * asp) / 2;
            orthoCameraRef.current.right = (fSize * asp) / 2;
            orthoCameraRef.current.top = fSize / 2;
            orthoCameraRef.current.bottom = -fSize / 2;
            orthoCameraRef.current.updateProjectionMatrix();
          }
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (wireframeOverlayGroupRef.current && modelGroupRef.current) {
        wireframeOverlayGroupRef.current.position.copy(modelGroupRef.current.position);
        wireframeOverlayGroupRef.current.quaternion.copy(modelGroupRef.current.quaternion);
        wireframeOverlayGroupRef.current.scale.copy(modelGroupRef.current.scale);
      }
      const cam = activeCameraRef.current || cameraRef.current;
      if (rendererRef.current && sceneRef.current && cam) {
        rendererRef.current.render(sceneRef.current, cam);
      }
      drawOrientationGizmo();

      // Screen space projections for 3D annotations
      if (containerRef.current && effectiveAnnotationsRef.current.length > 0 && cam) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const projected = effectiveAnnotationsRef.current.map((ann, idx) => {
          const v = new THREE.Vector3(...ann.point).project(cam);
          return {
            id: ann.id,
            x: ((v.x + 1) * cw) / 2,
            y: ((-v.y + 1) * ch) / 2,
            title: ann.title,
            index: idx + 1,
            visible: v.z < 1,
          };
        });
        setProjectedAnnotations(projected);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      transformControls.dispose();
      scene.remove(transformHelper);
      scene.remove(planeHelper);
      scene.remove(wireframeOverlayGroup);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Draw 3D Orientation Gizmo (X/Y/Z)
  const drawOrientationGizmo = () => {
    const canvas = gizmoCanvasRef.current;
    if (!canvas || !cameraRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 30;

    const camera = cameraRef.current;
    const rotMat = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);

    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: '#ef4444', label: 'X' },
      { dir: new THREE.Vector3(0, 1, 0), color: '#22c55e', label: 'Y' },
      { dir: new THREE.Vector3(0, 0, 1), color: '#3b82f6', label: 'Z' },
    ];

    axes.forEach((axis) => {
      const v = axis.dir.clone().applyMatrix4(rotMat);
      const px = cx + v.x * radius;
      const py = cy - v.y * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.fillStyle = axis.color;
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axis.label, px, py);
    });
  };

  // Click on Gizmo to snap camera
  const handleSnapCamera = (axis: 'x' | 'y' | 'z' | 'iso') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dist = 5.0;
    if (axis === 'x') {
      cameraRef.current.position.set(dist, 1.0, 0);
    } else if (axis === 'y') {
      cameraRef.current.position.set(0.01, dist, 0.01);
    } else if (axis === 'z') {
      cameraRef.current.position.set(0, 1.0, dist);
    } else {
      cameraRef.current.position.set(dist * 0.7, dist * 0.6, dist * 0.7);
    }
    controlsRef.current.target.set(0, 0.8, 0);
    controlsRef.current.update();
  };

  // Add 3D Primitive Shape into Scene (Cube, Sphere, Cylinder, Torus)
  const handleAddPrimitive = (type: 'cube' | 'sphere' | 'cylinder' | 'torus') => {
    if (!primitivesGroupRef.current) return;
    let geom: THREE.BufferGeometry;
    if (type === 'cube') {
      geom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    } else if (type === 'sphere') {
      geom = new THREE.SphereGeometry(0.5, 24, 24);
    } else if (type === 'cylinder') {
      geom = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 24);
    } else {
      geom = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 2.0,
      0.6,
      (Math.random() - 0.5) * 2.0
    );
    mesh.castShadow = true;
    primitivesGroupRef.current.add(mesh);
    setShowAddMenu(false);
  };

  // Update transform telemetry for parent/inspector
  const updateTransformTelemetry = useCallback(() => {
    if (!modelGroupRef.current) return;
    const p = modelGroupRef.current.position;
    const r = modelGroupRef.current.rotation;
    const s = modelGroupRef.current.scale;
    onTransformChangeRef.current?.({
      position: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
      rotation: [
        Number(THREE.MathUtils.radToDeg(r.x).toFixed(1)),
        Number(THREE.MathUtils.radToDeg(r.y).toFixed(1)),
        Number(THREE.MathUtils.radToDeg(r.z).toFixed(1)),
      ],
      scale: [Number(s.x.toFixed(2)), Number(s.y.toFixed(2)), Number(s.z.toFixed(2))],
    });
  }, []);

  // Sync TransformControls mode when activeTool or coordSystem changes
  useEffect(() => {
    if (!transformControlsRef.current || !modelGroupRef.current) return;
    const tc = transformControlsRef.current;
    tc.setSpace(coordSystem === 'Global' ? 'world' : 'local');

    if (activeTool === 'move') {
      tc.attach(modelGroupRef.current);
      tc.setMode('translate');
    } else if (activeTool === 'rotate') {
      tc.attach(modelGroupRef.current);
      tc.setMode('rotate');
    } else if (activeTool === 'scale') {
      tc.attach(modelGroupRef.current);
      tc.setMode('scale');
    } else {
      tc.detach();
    }
  }, [activeTool, coordSystem]);

  // Camera Projection Switcher: Perspective (3D depth) vs Orthographic (CAD isometric)
  useEffect(() => {
    const isOrtho = options.cameraProjection === 'orthographic';
    const targetCam = isOrtho ? orthoCameraRef.current : perspCameraRef.current;
    if (!targetCam || !controlsRef.current) return;

    const currentCam = activeCameraRef.current;
    if (currentCam && currentCam !== targetCam) {
      targetCam.position.copy(currentCam.position);
      targetCam.quaternion.copy(currentCam.quaternion);
    }

    activeCameraRef.current = targetCam;
    cameraRef.current = isOrtho ? (targetCam as any) : perspCameraRef.current;
    controlsRef.current.object = targetCam;
    controlsRef.current.update();
  }, [options.cameraProjection]);

  // CAD Cross-Section Clipping Effect
  useEffect(() => {
    const clip = options.clipping;
    if (!clipPlaneRef.current || !modelGroupRef.current) return;

    if (!clip || !clip.enabled) {
      if (planeHelperRef.current) planeHelperRef.current.visible = false;
      modelGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              m.clippingPlanes = [];
              m.needsUpdate = true;
            });
          } else if (mesh.material) {
            mesh.material.clippingPlanes = [];
            mesh.material.needsUpdate = true;
          }
        }
      });
      return;
    }

    const normal = new THREE.Vector3();
    if (clip.axis === 'x') normal.set(-1, 0, 0);
    else if (clip.axis === 'y') normal.set(0, -1, 0);
    else normal.set(0, 0, -1);

    if (clip.inverted) normal.negate();

    clipPlaneRef.current.normal.copy(normal);
    clipPlaneRef.current.constant = clip.offset;

    if (planeHelperRef.current) {
      planeHelperRef.current.visible = Boolean(clip.showPlane);
      planeHelperRef.current.updateMatrixWorld();
    }

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            m.clippingPlanes = [clipPlaneRef.current];
            m.clipShadows = true;
            m.needsUpdate = true;
          });
        } else if (mesh.material) {
          mesh.material.clippingPlanes = [clipPlaneRef.current];
          mesh.material.clipShadows = true;
          mesh.material.needsUpdate = true;
        }
      }
    });
  }, [options.clipping]);

  // Raycast Click Handler for Surface Measurement and 3D Annotation Pins
  const handleRaycastClick = useCallback((e: PointerEvent) => {
    if (!containerRef.current || !modelGroupRef.current) return;
    const cam = activeCameraRef.current || cameraRef.current;
    if (!cam) return;

    if (activeToolRef.current !== 'measure' && activeToolRef.current !== 'annotate') return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    const intersects = raycaster.intersectObjects(modelGroupRef.current.children, true);

    if (intersects.length === 0) return;
    const hitPoint = intersects[0].point.clone();

    if (activeToolRef.current === 'measure') {
      if (!measurePointARef.current || (measurePointARef.current && measurePointBRef.current)) {
        setMeasurePointA(hitPoint);
        setMeasurePointB(null);
        measurePointARef.current = hitPoint;
        measurePointBRef.current = null;
        const newMeas: MeasurementData = {
          pointA: [Number(hitPoint.x.toFixed(3)), Number(hitPoint.y.toFixed(3)), Number(hitPoint.z.toFixed(3))],
          pointB: null,
          distance: null,
          delta: null,
        };
        setLocalMeasurement(newMeas);
        onMeasurementChange?.(newMeas);
      } else {
        const pA = measurePointARef.current;
        const pB = hitPoint;
        setMeasurePointB(pB);
        measurePointBRef.current = pB;
        const dist = pA.distanceTo(pB);
        const newMeas: MeasurementData = {
          pointA: [Number(pA.x.toFixed(3)), Number(pA.y.toFixed(3)), Number(pA.z.toFixed(3))],
          pointB: [Number(pB.x.toFixed(3)), Number(pB.y.toFixed(3)), Number(pB.z.toFixed(3))],
          distance: Number(dist.toFixed(3)),
          delta: {
            x: Number(Math.abs(pB.x - pA.x).toFixed(3)),
            y: Number(Math.abs(pB.y - pA.y).toFixed(3)),
            z: Number(Math.abs(pB.z - pA.z).toFixed(3)),
          },
        };
        setLocalMeasurement(newMeas);
        onMeasurementChange?.(newMeas);
      }
    } else if (activeToolRef.current === 'annotate') {
      const newAnn: ModelAnnotation = {
        id: `ann-${Date.now()}`,
        point: [Number(hitPoint.x.toFixed(3)), Number(hitPoint.y.toFixed(3)), Number(hitPoint.z.toFixed(3))],
        title: `Point #${effectiveAnnotationsRef.current.length + 1}`,
        comment: 'CAD surface inspection mark',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const updated = [...effectiveAnnotationsRef.current, newAnn];
      setLocalAnnotations(updated);
      onAnnotationsChange?.(updated);
      setSelectedAnnotationId(newAnn.id);
    }
  }, [onMeasurementChange, onAnnotationsChange]);

  // Visual Caliper Group Update Effect (Lines & Endpoint Spheres)
  useEffect(() => {
    if (!measurementGroupRef.current) return;
    const group = measurementGroupRef.current;
    group.clear();

    if (measurePointA) {
      const sA = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      sA.position.copy(measurePointA);
      group.add(sA);
    }

    if (measurePointA && measurePointB) {
      const sB = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      sB.position.copy(measurePointB);
      group.add(sB);

      const geom = new THREE.BufferGeometry().setFromPoints([measurePointA, measurePointB]);
      const mat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
      const line = new THREE.Line(geom, mat);
      group.add(line);
    }
  }, [measurePointA, measurePointB]);

  // Visual Annotations Pinpoints Update Effect
  useEffect(() => {
    if (!annotationsGroupRef.current) return;
    const group = annotationsGroupRef.current;
    group.clear();

    effectiveAnnotations.forEach((ann) => {
      const isSel = ann.id === selectedAnnotationId;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 16, 16),
        new THREE.MeshStandardMaterial({
          color: isSel ? 0xf59e0b : 0x06b6d4,
          emissive: isSel ? 0xf59e0b : 0x06b6d4,
          emissiveIntensity: 0.6,
          roughness: 0.2,
        })
      );
      sphere.position.set(...ann.point);
      group.add(sphere);
    });
  }, [effectiveAnnotations, selectedAnnotationId]);

  // Smooth Camera Fly-to on Annotation Hotspot
  const handleFocusAnnotation = useCallback((ann: ModelAnnotation) => {
    if (!controlsRef.current) return;
    const target = new THREE.Vector3(...ann.point);
    const cam = activeCameraRef.current || cameraRef.current;
    if (!cam) return;

    controlsRef.current.target.copy(target);
    const offset = cam.position.clone().sub(target).normalize().multiplyScalar(2.0);
    cam.position.copy(target.clone().add(offset));
    controlsRef.current.update();
    setSelectedAnnotationId(ann.id);
  }, []);

  useEffect(() => {
    if (onFocusAnnotationRef) {
      onFocusAnnotationRef.current = handleFocusAnnotation;
    }
  }, [handleFocusAnnotation, onFocusAnnotationRef]);

  // High-Resolution Snapshot Capture Engine
  const captureHighResRender = useCallback((opts: { width: number; height: number; transparent: boolean; watermark: boolean }): string => {
    if (!rendererRef.current || !sceneRef.current) return '';
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const cam = activeCameraRef.current || cameraRef.current;
    if (!cam) return '';

    const { width, height, transparent, watermark } = opts;
    const prevSize = new THREE.Vector2();
    renderer.getSize(prevSize);
    const prevClearColor = new THREE.Color();
    renderer.getClearColor(prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();
    const prevBg = scene.background;

    renderer.setSize(width, height, false);
    if (transparent) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    }

    renderer.render(scene, cam);

    let dataUrl = renderer.domElement.toDataURL('image/png');
    if (watermark) {
      const compCanvas = document.createElement('canvas');
      compCanvas.width = width;
      compCanvas.height = height;
      const ctx = compCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(renderer.domElement, 0, 0);
        const badgeW = 220;
        const badgeH = 38;
        const bx = width - badgeW - 20;
        const by = height - badgeH - 20;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('PolyGen', bx + 16, by + 24);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('3D Studio • Core', bx + 84, by + 24);
        dataUrl = compCanvas.toDataURL('image/png');
      }
    }

    renderer.setSize(prevSize.x, prevSize.y, false);
    scene.background = prevBg;
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.render(scene, cam);

    return dataUrl;
  }, []);

  useEffect(() => {
    if (captureSnapshotRef) {
      captureSnapshotRef.current = captureHighResRender;
    }
  }, [captureHighResRender, captureSnapshotRef]);

  // Explode effect: Disassembles submeshes along radial vectors
  useEffect(() => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.userData.originalPosition && mesh.userData.explodeVector) {
          mesh.position.copy(mesh.userData.originalPosition).addScaledVector(
            mesh.userData.explodeVector,
            effectiveExplode
          );
        }
      }
    });
    if (boxHelperRef.current) {
      boxHelperRef.current.update();
    }
  }, [effectiveExplode]);

  // Wireframe Topology Superimposition Overlay Effect
  useEffect(() => {
    if (!wireframeOverlayGroupRef.current || !modelGroupRef.current) return;
    const group = wireframeOverlayGroupRef.current;
    group.clear();

    if (!options.wireframeOverlay) return;

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geom = mesh.geometry;
        if (!geom) return;
        const wireframeGeom = new THREE.WireframeGeometry(geom);
        const wireframeMat = new THREE.LineBasicMaterial({
          color: 0x06b6d4,
          transparent: true,
          opacity: 0.55,
          depthTest: true,
        });
        const line = new THREE.LineSegments(wireframeGeom, wireframeMat);
        line.position.copy(mesh.position);
        line.quaternion.copy(mesh.quaternion);
        line.scale.copy(mesh.scale);
        group.add(line);
      }
    });
  }, [options.wireframeOverlay, effectiveExplode]);

  // Left Tool Action Handlers
  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    if (!modelGroupRef.current) return;
    const tc = transformControlsRef.current;

    if (tool === 'select') {
      if (tc) tc.detach();
      if (boxHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(boxHelperRef.current);
        boxHelperRef.current = null;
      } else if (sceneRef.current) {
        const box = new THREE.BoxHelper(modelGroupRef.current, 0x84cc16);
        sceneRef.current.add(box);
        boxHelperRef.current = box;
      }
    } else if (tool === 'move') {
      if (tc) {
        tc.attach(modelGroupRef.current);
        tc.setMode('translate');
      }
    } else if (tool === 'rotate') {
      if (tc) {
        tc.attach(modelGroupRef.current);
        tc.setMode('rotate');
      }
    } else if (tool === 'scale') {
      if (tc) {
        tc.attach(modelGroupRef.current);
        tc.setMode('scale');
      }
    } else if (tool === 'transform') {
      if (tc) tc.detach();
      modelGroupRef.current.position.set(0, 0, 0);
      modelGroupRef.current.rotation.set(0, 0, 0);
      modelGroupRef.current.scale.set(1, 1, 1);
      if (boxHelperRef.current) boxHelperRef.current.update();
      updateTransformTelemetry();
    } else if (tool === 'measure') {
      if (tc) tc.detach();
      setShowDimensions(true);
    } else if (tool === 'annotate') {
      if (tc) tc.detach();
    } else if (tool === 'explode') {
      if (tc) tc.detach();
    } else if (tool === 'section') {
      if (tc) tc.detach();
      if (!options.clipping?.enabled) {
        onOptionsChange?.({
          ...options,
          clipping: {
            enabled: true,
            axis: 'y',
            offset: 0.8,
            inverted: false,
            showPlane: true,
            ...(options.clipping || {}),
          },
        });
      }
    }
  };

  // Keyboard Hotkeys: G (Grab/Move), R (Rotate), S (Scale), Q (Select), E (Explode), X (Section), M (Measure), A (Annotate), C (Camera Projection), Space (Turntable)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'g' || e.key === 'G') {
        setActiveTool('move');
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTool('rotate');
      } else if (e.key === 's' || e.key === 'S') {
        setActiveTool('scale');
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
        setActiveTool('select');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool((prev) => (prev === 'explode' ? 'select' : 'explode'));
      } else if (e.key === 'x' || e.key === 'X') {
        setActiveTool((prev) => (prev === 'section' ? 'select' : 'section'));
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTool((prev) => (prev === 'measure' ? 'select' : 'measure'));
      } else if (e.key === 'a' || e.key === 'A') {
        setActiveTool((prev) => (prev === 'annotate' ? 'select' : 'annotate'));
      } else if (e.key === 'c' || e.key === 'C') {
        const next = (options.cameraProjection || 'perspective') === 'perspective' ? 'orthographic' : 'perspective';
        onOptionsChange?.({ ...options, cameraProjection: next });
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Client-Side 3D Exporters (Exports current live transformed mesh directly from Three.js scene)
  const handleClientExport = (format: 'glb' | 'obj' | 'stl') => {
    if (!modelGroupRef.current) return;
    const target = modelGroupRef.current;
    const baseName = (importedName || assetTitle || 'PolyGen_Model').replace(/\s+/g, '_');

    if (format === 'obj') {
      try {
        const exporter = new OBJExporter();
        const result = exporter.parse(target);
        const blob = new Blob([result], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_live.obj`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('OBJ Export failed:', err);
      }
    } else if (format === 'stl') {
      try {
        const exporter = new STLExporter();
        const result = exporter.parse(target, { binary: true });
        const blob = new Blob([result], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_live.stl`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('STL Export failed:', err);
      }
    } else if (format === 'glb') {
      try {
        const exporter = new GLTFExporter();
        exporter.parse(
          target,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_live.glb`;
            a.click();
            URL.revokeObjectURL(url);
          },
          (error) => {
            console.error('GLB Export error:', error);
          },
          { binary: true }
        );
      } catch (err) {
        console.error('GLB Export failed:', err);
      }
    }
  };

  // Timeline Scrubber
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = prev >= 250 ? 1 : prev + 1;
          if (modelGroupRef.current) {
            modelGroupRef.current.rotation.y = (next / 250) * Math.PI * 2;
          }
          return next;
        });
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update Lighting Preset
  useEffect(() => {
    if (!lightsGroupRef.current) return;
    const group = lightsGroupRef.current;
    group.clear();

    const angle = options.lightAngle ?? 45;
    const rad = (angle * Math.PI) / 180;
    const keyX = Math.cos(rad) * 7.0;
    const keyZ = Math.sin(rad) * 7.0;
    const keyY = 6.5;

    if (options.lightingPreset === 'cyberpunk') {
      const ambient = new THREE.AmbientLight(0x0f172a, 0.8);
      group.add(ambient);
      const cyanKey = new THREE.DirectionalLight(0x00f0ff, 2.8);
      cyanKey.position.set(keyX, keyY, keyZ);
      cyanKey.castShadow = true;
      group.add(cyanKey);
      const magentaRim = new THREE.DirectionalLight(0xec4899, 2.5);
      magentaRim.position.set(-keyX, 3, -keyZ);
      group.add(magentaRim);
      const purpleFill = new THREE.PointLight(0x8b5cf6, 1.8, 12);
      purpleFill.position.set(0, -1, 3);
      group.add(purpleFill);
    } else if (options.lightingPreset === 'sunset') {
      const ambient = new THREE.AmbientLight(0x451a03, 0.7);
      group.add(ambient);
      const amberKey = new THREE.DirectionalLight(0xfbbf24, 3.2);
      amberKey.position.set(keyX, keyY, keyZ);
      amberKey.castShadow = true;
      group.add(amberKey);
      const orangeFill = new THREE.DirectionalLight(0xf97316, 1.5);
      orangeFill.position.set(-keyX * 0.7, 2, -keyZ * 0.7);
      group.add(orangeFill);
      const skyRim = new THREE.DirectionalLight(0x38bdf8, 0.8);
      skyRim.position.set(0, 5, -5);
      group.add(skyRim);
    } else if (options.lightingPreset === 'space') {
      const ambient = new THREE.AmbientLight(0x020617, 0.2);
      group.add(ambient);
      const starkDir = new THREE.DirectionalLight(0xf8fafc, 3.8);
      starkDir.position.set(keyX, keyY, keyZ);
      starkDir.castShadow = true;
      group.add(starkDir);
      const blueSpec = new THREE.DirectionalLight(0x38bdf8, 1.0);
      blueSpec.position.set(-keyX * 0.8, 2, -keyZ * 0.8);
      group.add(blueSpec);
    } else {
      // Default Studio 3-Point
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      group.add(ambient);
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
      keyLight.position.set(keyX, keyY, keyZ);
      keyLight.castShadow = true;
      group.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.2);
      fillLight.position.set(-keyX * 0.8, 3, keyZ * 0.5);
      group.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      rimLight.position.set(0, 5, -5);
      group.add(rimLight);
    }
  }, [options.lightingPreset, options.lightAngle]);

  // Update Background & Controls
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(options.backgroundColor);
    }
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = options.exposure || 1.1;
    }
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = options.grid;
    }
    if (controlsRef.current) {
      controlsRef.current.autoRotate = options.autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [options.backgroundColor, options.exposure, options.grid, options.autoRotate]);

  const handleCaptureSnapshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `PolyGen-Render-${(importedName || assetTitle || 'Asset').replace(/\s+/g, '_')}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleFileUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'glb' && ext !== 'gltf') {
      alert('Please upload a valid .glb or .gltf 3D file.');
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setImportedModelUrl(blobUrl);
    setImportedName(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleRecordVideo = () => {
    if (!rendererRef.current || isRecording) return;
    const canvas = rendererRef.current.domElement;
    
    // Capture 30fps canvas stream
    const stream = canvas.captureStream ? canvas.captureStream(30) : null;
    if (!stream) {
      alert('Canvas captureStream is not supported in this browser.');
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    } catch {
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch (e) {
        alert('MediaRecorder for WebM is not supported in this browser.');
        return;
      }
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PolyGen-Turntable-${(importedName || assetTitle || 'Asset').replace(/\s+/g, '_')}.webm`;
      a.click();
      setIsRecording(false);
      setRecordProgress(0);
    };

    setIsRecording(true);
    setRecordProgress(0);
    recorder.start();

    // Rotate 360 degrees smoothly over 4 seconds (120 frames at 30 fps)
    let frame = 0;
    const totalFrames = 120;
    const initialRot = modelGroupRef.current ? modelGroupRef.current.rotation.y : 0;
    const interval = setInterval(() => {
      frame++;
      setRecordProgress(Math.round((frame / totalFrames) * 100));
      if (modelGroupRef.current) {
        modelGroupRef.current.rotation.y = initialRot + (frame / totalFrames) * Math.PI * 2;
      }
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / 30);
  };

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (modelGroupRef.current && modelGroupRef.current.children.length > 0) {
      const bbox = new THREE.Box3().setFromObject(modelGroupRef.current);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1.0);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.95;

      cameraRef.current.position.set(distance * 0.9, distance * 0.7, distance * 1.1);
      controlsRef.current.target.copy(center);
    } else {
      cameraRef.current.position.set(3.5, 2.8, 4.5);
      controlsRef.current.target.set(0, 0.8, 0);
    }
    controlsRef.current.update();
  };

  // Reset imported model if a library model is clicked
  useEffect(() => {
    setImportedModelUrl(null);
    setImportedName(null);
  }, [modelUrl]);

  // Load Capabilities & Styles
  useEffect(() => {
    api.getMeshCapabilities()
      .then((caps) => {
        setCapabilities(caps);
      })
      .catch((err) => console.warn('Could not fetch mesh capabilities:', err));

    api.getTextureStyles()
      .then((styles) => {
        if (Array.isArray(styles) && styles.length > 0) {
          setAvailableStyles(styles);
          if (!textureStyle || textureStyle === 'scifi') {
            setTextureStyle(styles[0].id);
          }
        }
      })
      .catch((err) => console.warn('Could not fetch texture styles:', err));
  }, []);

  // Draw 2D UV Wireframe Atlas on Canvas
  const drawUVAtlas = (canvas: HTMLCanvasElement, mesh: THREE.Mesh | null) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!mesh || !mesh.geometry || !mesh.geometry.attributes.uv) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No UV Coordinates Found on Mesh', w / 2, h / 2);
      return;
    }

    const geom = mesh.geometry;
    const uvAttr = geom.attributes.uv as THREE.BufferAttribute;
    const padding = 24;
    const plotW = w - padding * 2;
    const plotH = h - padding * 2;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Sub-grid lines (0.25 intervals)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let s = 0; s <= 4; s++) {
      const x = padding + (plotW * s) / 4;
      const y = padding + (plotH * s) / 4;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + plotH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotW, y);
      ctx.stroke();
    }

    // [0, 1] Bounds Box
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding, padding, plotW, plotH);

    // Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('(0,1)', padding + 2, padding - 6);
    ctx.fillText('(0,0)', padding + 2, padding + plotH + 14);
    ctx.textAlign = 'right';
    ctx.fillText('(1,1)', padding + plotW, padding - 6);
    ctx.fillText('(1,0)', padding + plotW, padding + plotH + 14);

    // Draw UV Triangles
    const toCanvas = (u: number, v: number) => ({
      x: padding + u * plotW,
      y: padding + (1 - v) * plotH,
    });

    const index = geom.index;
    const triangleCount = index ? index.count / 3 : uvAttr.count / 3;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 0.75;

    const maxTriangles = Math.min(triangleCount, 6000);
    const step = Math.max(1, Math.floor(triangleCount / maxTriangles));

    for (let t = 0; t < triangleCount; t += step) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

      const p0 = toCanvas(uvAttr.getX(i0), uvAttr.getY(i0));
      const p1 = toCanvas(uvAttr.getX(i1), uvAttr.getY(i1));
      const p2 = toCanvas(uvAttr.getX(i2), uvAttr.getY(i2));

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  };

  // UV Inspection extraction effect
  useEffect(() => {
    if (activeTab === 'uv') {
      const mesh = firstMeshRef.current;
      if (mesh && mesh.geometry && mesh.geometry.attributes.uv) {
        const uvAttr = mesh.geometry.attributes.uv as THREE.BufferAttribute;
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        for (let i = 0; i < uvAttr.count; i++) {
          const u = uvAttr.getX(i);
          const v = uvAttr.getY(i);
          if (u < uMin) uMin = u;
          if (u > uMax) uMax = u;
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
        }
        const in01 = uMin >= -0.01 && uMax <= 1.01 && vMin >= -0.01 && vMax <= 1.01;
        setUvStats({
          hasUV: true,
          uvVertexCount: uvAttr.count,
          uMin: Number(uMin.toFixed(3)),
          uMax: Number(uMax.toFixed(3)),
          vMin: Number(vMin.toFixed(3)),
          vMax: Number(vMax.toFixed(3)),
          in01Range: in01,
        });
        if (uvCanvasRef.current) {
          drawUVAtlas(uvCanvasRef.current, mesh);
        }
      } else {
        setUvStats({
          hasUV: false,
          uvVertexCount: 0,
          uMin: 0,
          uMax: 0,
          vMin: 0,
          vMax: 0,
          in01Range: false,
        });
        if (uvCanvasRef.current) {
          drawUVAtlas(uvCanvasRef.current, null);
        }
      }
    }
  }, [activeTab, loadedMeshRevision]);

  // Load Model
  useEffect(() => {
    const effectiveUrl = importedModelUrl || activeModelUrl || modelUrl;
    if (!modelGroupRef.current || !effectiveUrl) return;
    const group = modelGroupRef.current;
    group.clear();
    firstMeshRef.current = null;

    setLoading(true);
    setLoadError(null);

    const loader = new GLTFLoader();
    loader.load(
      effectiveUrl,
      (gltf) => {
        const object = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(object);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        object.position.x = -center.x;
        object.position.z = -center.z;
        object.position.y = -bbox.min.y;

        setLiveBounds({
          x: Number(size.x.toFixed(2)),
          y: Number(size.y.toFixed(2)),
          z: Number(size.z.toFixed(2)),
        });

        let totalVertices = 0;
        let totalPolys = 0;
        let totalSurfaceArea = 0;
        let totalSignedVolume = 0;
        const materialsSet = new Set<string>();

        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const cb = new THREE.Vector3();
        const ab = new THREE.Vector3();

        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (!firstMeshRef.current) {
              firstMeshRef.current = mesh;
            }
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const geometry = mesh.geometry;
            if (geometry) {
              const pos = geometry.attributes.position;
              const idx = geometry.index;
              if (idx) {
                totalPolys += idx.count / 3;
              } else if (pos) {
                totalPolys += pos.count / 3;
              }
              if (pos) {
                totalVertices += pos.count;
                const triCount = idx ? idx.count / 3 : pos.count / 3;
                for (let i = 0; i < triCount; i++) {
                  const a = idx ? idx.getX(i * 3) : i * 3;
                  const b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
                  const c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
                  vA.fromBufferAttribute(pos, a);
                  vB.fromBufferAttribute(pos, b);
                  vC.fromBufferAttribute(pos, c);

                  cb.subVectors(vC, vB);
                  ab.subVectors(vA, vB);
                  cb.cross(ab);
                  totalSurfaceArea += cb.length() * 0.5;
                  totalSignedVolume += vA.dot(vB.cross(vC)) / 6.0;
                }
              }
            }

            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => materialsSet.add(m.uuid));
              } else {
                materialsSet.add(mesh.material.uuid);
              }
            }

            mesh.userData.originalMaterial = mesh.material;
            mesh.userData.originalPosition = mesh.position.clone();

            // Compute radial vector from bounding center for explode disassembly
            const childBox = new THREE.Box3().setFromObject(mesh);
            const childCenter = childBox.getCenter(new THREE.Vector3());
            const radial = childCenter.clone().sub(center);
            if (radial.lengthSq() < 0.001) {
              radial.set(
                Math.sin(mesh.id * 1.5),
                Math.abs(Math.cos(mesh.id * 2.1)) + 0.5,
                Math.cos(mesh.id * 1.5)
              );
            }
            mesh.userData.explodeVector = radial.normalize().multiplyScalar(1.25);
          }
        });

        group.add(object);

        if (cameraRef.current && controlsRef.current) {
          const maxDim = Math.max(size.x, size.y, size.z, 1.0);
          const fov = cameraRef.current.fov * (Math.PI / 180);
          const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.95;
          cameraRef.current.position.set(distance * 0.9, distance * 0.7, distance * 1.1);
          controlsRef.current.target.set(0, size.y / 2, 0);
          controlsRef.current.update();
        }

        if (onStatsCalculated) {
          onStatsCalculated({
            polyCount: Math.round(totalPolys),
            vertexCount: Math.round(totalVertices),
            dimensions: {
              x: Number(size.x.toFixed(2)),
              y: Number(size.y.toFixed(2)),
              z: Number(size.z.toFixed(2)),
            },
            materialCount: materialsSet.size,
            surfaceArea: Number(totalSurfaceArea.toFixed(3)),
            volume: Number(Math.abs(totalSignedVolume).toFixed(4)),
          });
        }

        applyShadingAndWireframe();
        setLoadedMeshRevision((r) => r + 1);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D model:', error);
        setLoadError('Failed to load GLB model. Check network connection or file path.');
        setLoading(false);
      }
    );
  }, [modelUrl, activeModelUrl, importedModelUrl]);

  // Handle Mesh Processing & Texturing (Milestones 6 & 7A)
  const handleProcessMesh = async () => {
    setIsProcessing(true);
    setProcessError(null);
    setProcessWarning(null);
    setProcessSuccess(null);
    setProcessingStage('Ingesting 3D mesh geometry...');

    try {
      let fileToProcess: File | Blob;
      let filenameToProcess: string;

      if (modelSource === 'upload') {
        if (!uploadedFile) {
          throw new Error('Please select an OBJ or GLB file to upload.');
        }
        fileToProcess = uploadedFile;
        filenameToProcess = uploadedFile.name;
      } else {
        const currentUrl = importedModelUrl || activeModelUrl || modelUrl;
        if (!currentUrl) {
          throw new Error('No active model in viewport. Please upload an external mesh or select a model.');
        }
        setProcessingStage('Fetching current viewport model...');
        const resp = await fetch(currentUrl);
        if (!resp.ok) {
          throw new Error(`Failed to fetch current model from ${currentUrl}`);
        }
        fileToProcess = await resp.blob();
        filenameToProcess = `${assetTitle || assetId || 'active_model'}.glb`;
      }

      // Prepare QEM Optimization options
      const optOptions: {
        enable_optimization?: boolean;
        target_faces?: number;
        reduction_ratio?: number;
      } = {};

      if (enableOptimization) {
        optOptions.enable_optimization = true;
        if (optimizationMode === 'ratio') {
          optOptions.reduction_ratio = Math.min(Math.max(reductionPercentage / 100, 0.01), 0.99);
        } else {
          let resolvedFaces = 10000;
          if (targetPreset === 'high') resolvedFaces = 25000;
          else if (targetPreset === 'medium') resolvedFaces = 10000;
          else if (targetPreset === 'low') resolvedFaces = 2500;
          else if (targetPreset === 'custom') resolvedFaces = Math.max(1, Math.round(customTargetFaces || 10000));
          optOptions.target_faces = resolvedFaces;
        }
      } else {
        optOptions.enable_optimization = false;
      }

      setProcessingStage(
        enableOptimization
          ? 'Optimizing mesh polygons (QEM) & unwrapping UVs (xatlas)...'
          : 'Validating geometry & unwrapping UV coordinates (xatlas)...'
      );

      const stageTimer1 = setTimeout(() => {
        setProcessingStage(
          textureProvider === 'stable_diffusion'
            ? 'Synthesizing neural texture via Stable Diffusion (MPS)...'
            : 'Synthesizing procedural texture pattern...'
        );
      }, 1400);

      const stageTimer2 = setTimeout(() => {
        setProcessingStage('Mapping UVs, constructing PBR materials & exporting GLB...');
      }, 3000);

      const response = await api.processMesh(fileToProcess, filenameToProcess, {
        texture_provider: textureProvider,
        texture_style: textureStyle,
        texture_prompt: texturePrompt.trim() || undefined,
        texture_resolution: textureResolution,
        fallback_to_procedural: fallbackToProcedural,
        title: assetTitle ? `${assetTitle} (Textured)` : `${filenameToProcess.replace(/\.[^/.]+$/, '')} (Textured)`,
        metallic_factor: metallicFactor,
        roughness_factor: roughnessFactor,
        ...optOptions,
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      setProcessSuccess(response);

      if (response.warnings && response.warnings.length > 0) {
        setProcessWarning(response.warnings.join(' | '));
      } else if (response.is_fallback) {
        setProcessWarning(`Requested ${response.requested_texture_provider}, but fell back to ${response.actual_texture_provider}.`);
      }

      // Reload newly generated GLB into Three.js Viewport
      const newGlbUrl = api.getDownloadUrl(response.asset_id, 'glb');
      setActiveModelUrl(newGlbUrl);

      // Notify parent App component
      if (onAssetProcessed) {
        const newAsset: Asset = {
          id: response.asset_id,
          title: response.title,
          prompt: texturePrompt.trim() || `${response.texture_style || 'scifi'} textured model`,
          style: response.texture_style || 'scifi',
          tags: [response.format_uploaded, response.actual_texture_provider, response.texture_style || 'scifi'],
          created_at: new Date().toISOString(),
          poly_count: response.poly_count,
          vertex_count: response.vertex_count,
          formats: {
            glb: response.formats?.glb || api.getDownloadUrl(response.asset_id, 'glb'),
            obj: response.formats?.obj || api.getDownloadUrl(response.asset_id, 'obj'),
            stl: response.formats?.stl || api.getDownloadUrl(response.asset_id, 'stl'),
          },
          file_size_bytes: 0,
          provider: response.actual_texture_provider,
          is_demo: false,
          attributes: {
            optimization_metrics: response.metrics.optimization,
            validation: {
              is_watertight: response.metrics.is_watertight,
              surface_area: response.metrics.surface_area,
              dimensions: response.metrics.dimensions,
              uv_chart_count: response.metrics.uv_chart_count,
              seam_vertex_duplications: response.metrics.seam_vertex_duplications,
              round_trip_success: response.metrics.round_trip_success,
            },
            texture_resolution: response.texture_resolution,
          },
        };
        onAssetProcessed(newAsset, newGlbUrl);
      }
    } catch (err: any) {
      console.error('Mesh processing failed:', err);
      setProcessError(err.message || 'Mesh processing pipeline encountered an unexpected error.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Apply Shading Mode & Tab Mode
  const applyShadingAndWireframe = useCallback(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const origMat = mesh.userData.originalMaterial;

        // If in UV Editing tab, apply UV grid texture
        if (activeTab === 'uv') {
          // Procedural checkerboard canvas texture
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillRect(64, 64, 64, 64);
          }
          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(4, 4);
          mesh.material = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.5,
            wireframe: options.wireframe,
          });
          return;
        }

        if (options.materials && options.materials.preset !== 'default') {
          const mat = options.materials;
          const isGlass = mat.preset === 'frosted-glass' || mat.preset === 'emerald-gem';
          const physicalMat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(mat.color),
            metalness: mat.metalness,
            roughness: mat.roughness,
            clearcoat: mat.clearcoat,
            clearcoatRoughness: 0.1,
            transmission: mat.transmission ?? (mat.preset === 'frosted-glass' ? 0.92 : mat.preset === 'emerald-gem' ? 0.85 : 0),
            ior: mat.ior ?? (mat.preset === 'frosted-glass' ? 1.52 : mat.preset === 'emerald-gem' ? 1.6 : 1.5),
            thickness: isGlass || (mat.transmission && mat.transmission > 0) ? 1.2 : 0,
            wireframe: options.wireframe,
          });
          if (mat.emissiveIntensity > 0) {
            physicalMat.emissive = new THREE.Color(mat.emissiveColor || '#000000');
            physicalMat.emissiveIntensity = mat.emissiveIntensity;
          }
          if (mat.proceduralPattern && mat.proceduralPattern !== 'none') {
            const patTex = getProceduralPatternTexture(mat.proceduralPattern);
            if (patTex) {
              physicalMat.map = patTex;
              physicalMat.roughnessMap = patTex;
            }
          }
          mesh.material = physicalMat;
          return;
        }

        if (options.shadingMode === 'clay') {
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0xc4c9d4,
            roughness: 0.65,
            metalness: 0.1,
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'normals') {
          mesh.material = new THREE.MeshNormalMaterial({
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            wireframe: true,
          });
        } else if (options.shadingMode === 'albedo') {
          const baseColor = origMat?.color ? origMat.color.clone() : new THREE.Color(0xffffff);
          const map = origMat?.map || null;
          mesh.material = new THREE.MeshBasicMaterial({
            color: baseColor,
            map: map,
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'roughness') {
          const r = origMat?.roughness !== undefined ? origMat.roughness : 0.5;
          mesh.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(r, r, r),
            map: origMat?.roughnessMap || null,
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'metalness') {
          const m = origMat?.metalness !== undefined ? origMat.metalness : 0.0;
          mesh.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(m, m, m),
            map: origMat?.metalnessMap || null,
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'matcap') {
          if (!matcapTextureRef.current) {
            matcapTextureRef.current = createProceduralMatcapTexture();
          }
          mesh.material = new THREE.MeshMatcapMaterial({
            matcap: matcapTextureRef.current,
            wireframe: options.wireframe,
          });
        } else if (options.shadingMode === 'depth') {
          mesh.material = new THREE.MeshDepthMaterial({
            wireframe: options.wireframe,
          });
        } else {
          if (origMat) {
            mesh.material = origMat;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m: any) => {
                if ('wireframe' in m) m.wireframe = options.wireframe;
              });
            } else {
              if ('wireframe' in mesh.material) {
                (mesh.material as any).wireframe = options.wireframe;
              }
            }
          }
        }
      }
    });
  }, [options.shadingMode, options.wireframe, activeTab, options.materials]);

  useEffect(() => {
    applyShadingAndWireframe();
  }, [applyShadingAndWireframe]);

  return (
    <div className={`relative w-full h-full overflow-hidden select-none flex flex-col bg-[#0c0e14] ${className}`}>
      {/* 1. TOP MIXAR STUDIO WORKSPACE HEADER STRIP */}
      <div className="h-10 px-4 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-1.5 text-xs">
          {/* Zen Mode Button */}
          <button
            onClick={onToggleZenMode}
            className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
              isZenMode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Zen Mode (Fullscreen Viewport)"
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>Zen Mode</span>
          </button>

          {/* Modeling tab */}
          <button
            onClick={() => setActiveTab('modeling')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'modeling'
                ? 'bg-lime-500 text-slate-950 shadow-md shadow-lime-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Modeling
          </button>

          {/* UV Editing tab */}
          <button
            onClick={() => setActiveTab('uv')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === 'uv' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            UV Editing
          </button>

          {/* Texturing tab */}
          <button
            onClick={() => setActiveTab('texturing')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === 'texturing' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Texturing
          </button>
        </div>

        {/* Action strip with Object Mode, Add, Global, Options */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {(importedName || assetTitle) && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200">
              <Box className={`w-3 h-3 ${importedName ? 'text-indigo-400' : 'text-lime-400'}`} />
              <span>{importedName ? `Imported: ${importedName}` : assetTitle}</span>
            </div>
          )}

          {/* Import Local 3D Model Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors"
            title="Import Local 3D Model (.GLB or .GLTF)"
          >
            <UploadCloud className="w-3 h-3 text-indigo-400" />
            <span>Import</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".glb,.gltf"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
            className="hidden"
          />

          {/* Object Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 hover:text-white"
            >
              <Box className="w-3.5 h-3.5 text-lime-400" />
              <span className="font-medium">{objectMode}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            {showModeMenu && (
              <div className="absolute left-0 top-full mt-1 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-40 flex flex-col gap-0.5 text-xs">
                {(['Object Mode', 'Edit Mode', 'Sculpt Mode'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setObjectMode(m);
                      setShowModeMenu(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs ${
                      objectMode === m ? 'bg-lime-500/20 text-lime-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Primitive Mesh Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 hover:text-white"
            >
              <Plus className="w-3 h-3 text-cyan-400" />
              <span>Add</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showAddMenu && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-40 flex flex-col gap-1 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-500 px-2 py-0.5">3D Primitives</span>
                <button
                  onClick={() => handleAddPrimitive('cube')}
                  className="px-2.5 py-1 rounded-lg text-left hover:bg-slate-800 text-slate-200"
                >
                  Cube
                </button>
                <button
                  onClick={() => handleAddPrimitive('sphere')}
                  className="px-2.5 py-1 rounded-lg text-left hover:bg-slate-800 text-slate-200"
                >
                  Sphere
                </button>
                <button
                  onClick={() => handleAddPrimitive('cylinder')}
                  className="px-2.5 py-1 rounded-lg text-left hover:bg-slate-800 text-slate-200"
                >
                  Cylinder
                </button>
                <button
                  onClick={() => handleAddPrimitive('torus')}
                  className="px-2.5 py-1 rounded-lg text-left hover:bg-slate-800 text-slate-200"
                >
                  Torus
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-slate-800 mx-1 hidden sm:block" />

          {/* Global / Local Coordinate Space */}
          <button
            onClick={() => setCoordSystem(coordSystem === 'Global' ? 'Local' : 'Global')}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
            title="Toggle Coordinate Space (Global / Local)"
          >
            <span>{coordSystem}</span>
          </button>

          {/* Options Dropdown for Exports */}
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition-colors text-[11px]"
            >
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1 text-xs text-slate-300">
                {assetId && (
                  <>
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Stored 3D Asset</span>
                    <a
                      href={api.getDownloadUrl(assetId, 'glb')}
                      download={`${assetId}.glb`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-cyan-300"
                    >
                      <span className="font-semibold">GLB</span>
                      <span className="text-[10px] text-slate-500">glTF Binary</span>
                    </a>
                    <a
                      href={api.getDownloadUrl(assetId, 'obj')}
                      download={`${assetId}.obj`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100"
                    >
                      <span className="font-semibold">OBJ</span>
                      <span className="text-[10px] text-slate-500">Wavefront</span>
                    </a>
                    <a
                      href={api.getDownloadUrl(assetId, 'stl')}
                      download={`${assetId}.stl`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-slate-100"
                    >
                      <span className="font-semibold">STL</span>
                      <span className="text-[10px] text-slate-500">3D Printing</span>
                    </a>
                    <div className="w-full h-px bg-slate-800 my-0.5" />
                    <a
                      href={api.getBundleUrl(assetId)}
                      download={`PolyGen_${assetId}_bundle.zip`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors font-medium"
                    >
                      <div className="flex items-center gap-1.5">
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Bundle (.ZIP)</span>
                      </div>
                      <span className="text-[9px] text-amber-400 font-mono">ALL</span>
                    </a>
                    <div className="w-full h-px bg-slate-800 my-0.5" />
                  </>
                )}
                <span className="text-[10px] uppercase font-bold text-cyan-400 px-2 py-1">Export Live Viewport Scene</span>
                <button
                  onClick={() => {
                    handleClientExport('glb');
                    setShowDownloadMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-cyan-300 text-left cursor-pointer"
                >
                  <span className="font-semibold">Live GLB</span>
                  <span className="text-[9px] text-cyan-400">Client Gen</span>
                </button>
                <button
                  onClick={() => {
                    handleClientExport('obj');
                    setShowDownloadMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-cyan-300 text-left cursor-pointer"
                >
                  <span className="font-semibold">Live OBJ</span>
                  <span className="text-[9px] text-slate-500">Wavefront</span>
                </button>
                <button
                  onClick={() => {
                    handleClientExport('stl');
                    setShowDownloadMenu(false);
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-cyan-300 text-left cursor-pointer"
                >
                  <span className="font-semibold">Live STL</span>
                  <span className="text-[9px] text-slate-500">3D Print</span>
                </button>
              </div>
            )}
          </div>

          {/* Viewport 4K Snapshot Button */}
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 hover:text-amber-300 hover:border-amber-500/40 transition-colors text-[11px]"
            title="Capture Viewport Screenshot (.PNG)"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Render PNG</span>
          </button>

          {/* Record 360 Turntable Video */}
          <button
            onClick={handleRecordVideo}
            disabled={isRecording}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-all text-[11px] ${
              isRecording
                ? 'border-rose-500 text-rose-300 bg-rose-950/60 shadow-md shadow-rose-950/50'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:text-rose-400 hover:border-rose-500/40'
            }`}
            title="Record 360° Turntable Video (.WebM)"
          >
            {isRecording ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
            ) : (
              <Video className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden sm:inline">
              {isRecording ? `Recording ${recordProgress}%` : '360° Video'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 3D VIEWPORT CONTAINER (With Drag & Drop Support) */}
      <div 
        className="flex-1 relative w-full h-full min-h-0 overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
      >
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Drag & Drop Visual Overlay */}
        {isDragOver && (
          <div className="absolute inset-4 z-40 rounded-2xl border-2 border-dashed border-indigo-400 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-fadeIn">
            <UploadCloud className="w-12 h-12 text-indigo-400 animate-bounce" />
            <span className="text-base font-bold text-white">Drop your .GLB or .GLTF 3D model here</span>
            <span className="text-xs text-slate-400">Instantly inspects topology, geometry bounds, and applies PBR shaders</span>
          </div>
        )}

        {/* VIEWPORT HOTKEY & MODE HUD */}
        <div className="absolute top-4 left-20 z-20 hidden md:flex items-center gap-2 px-3 py-1 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl text-[10px] text-slate-400 font-mono shadow-xl">
          <span className="text-cyan-400 font-bold uppercase tracking-wider">{activeTool}</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">G</kbd> Move
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">R</kbd> Rotate
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">S</kbd> Scale
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">E</kbd> Explode
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">X</kbd> Slice
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">M</kbd> Measure
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">A</kbd> Pin
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">C</kbd> {options.cameraProjection === 'orthographic' ? 'Ortho' : 'Persp'}
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[9px] text-slate-200 border border-slate-700 font-mono">Space</kbd> Spin
          </span>
        </div>

        {/* LEFT FLOATING MIXAR TOOLBAR */}
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 p-1 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl text-slate-400">
          <button
            onClick={() => handleToolClick('select')}
            title="Box Select (Toggle Bounding Box) [Q]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'select'
                ? 'bg-lime-500 text-slate-950 font-bold shadow-md shadow-lime-500/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            <span className="text-[8px]">Select</span>
          </button>

          <button
            onClick={() => handleToolClick('move')}
            title="Translate / Move Object [G]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'move'
                ? 'bg-lime-500 text-slate-950 font-bold shadow-md shadow-lime-500/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Move className="w-4 h-4" />
            <span className="text-[8px]">Move</span>
          </button>

          <button
            onClick={() => handleToolClick('rotate')}
            title="Rotate Object [R]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'rotate'
                ? 'bg-lime-500 text-slate-950 font-bold shadow-md shadow-lime-500/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-[8px]">Rotate</span>
          </button>

          <button
            onClick={() => handleToolClick('scale')}
            title="Scale Object [S]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'scale'
                ? 'bg-lime-500 text-slate-950 font-bold shadow-md shadow-lime-500/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span className="text-[8px]">Scale</span>
          </button>

          <button
            onClick={() => handleToolClick('explode')}
            title="Explode / Disassemble Submeshes [E]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'explode'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[8px]">Explode</span>
          </button>

          <button
            onClick={() => handleToolClick('section')}
            title="CAD Cross-Section Slice [X]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'section' || options.clipping?.enabled
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="text-[8px]">Section</span>
          </button>

          <button
            onClick={() => handleToolClick('transform')}
            title="Reset Position / Rotation to Origin"
            className="p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] hover:bg-slate-800 hover:text-slate-200"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[8px]">Reset</span>
          </button>

          <button
            onClick={() => handleToolClick('measure')}
            title="Surface Caliper & Dimensions [M]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              showDimensions || activeTool === 'measure'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span className="text-[8px]">Measure</span>
          </button>

          <button
            onClick={() => handleToolClick('annotate')}
            title="Surface 3D Pinpoint Annotations [A]"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'annotate'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="text-[8px]">Pinpoint</span>
          </button>
        </div>

        {/* CROSS-SECTION CAD SLICING OVERLAY */}
        {activeTool === 'section' && (
          <div className="absolute left-20 top-24 z-20 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/50 text-xs font-mono text-cyan-300 backdrop-blur-md shadow-2xl flex flex-col gap-2.5 w-64 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-white font-sans font-semibold flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                CAD Cross-Section Slice
              </span>
              <button
                onClick={() =>
                  onOptionsChange?.({
                    ...options,
                    clipping: {
                      enabled: !options.clipping?.enabled,
                      axis: options.clipping?.axis || 'y',
                      offset: options.clipping?.offset ?? 0.8,
                      inverted: Boolean(options.clipping?.inverted),
                      showPlane: options.clipping?.showPlane ?? true,
                    },
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase tracking-wider transition-colors ${
                  options.clipping?.enabled
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {options.clipping?.enabled ? 'Active' : 'Off'}
              </button>
            </div>

            {/* Slicing Axis Selector: X / Y / Z */}
            <div className="flex items-center gap-1.5 font-sans">
              <span className="text-[10px] text-slate-400 mr-1">Axis:</span>
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() =>
                    onOptionsChange?.({
                      ...options,
                      clipping: {
                        enabled: true,
                        axis: ax,
                        offset: options.clipping?.offset ?? 0.8,
                        inverted: Boolean(options.clipping?.inverted),
                        showPlane: options.clipping?.showPlane ?? true,
                      },
                    })
                  }
                  className={`flex-1 py-1 rounded-lg text-xs font-mono uppercase font-bold transition-all ${
                    (options.clipping?.axis || 'y') === ax
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>

            {/* Offset Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Slice Offset</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {(options.clipping?.offset ?? 0.8).toFixed(2)}m
                </span>
              </div>
              <input
                type="range"
                min={-3}
                max={3}
                step={0.05}
                value={options.clipping?.offset ?? 0.8}
                onChange={(e) =>
                  onOptionsChange?.({
                    ...options,
                    clipping: {
                      enabled: true,
                      axis: options.clipping?.axis || 'y',
                      offset: Number(e.target.value),
                      inverted: Boolean(options.clipping?.inverted),
                      showPlane: options.clipping?.showPlane ?? true,
                    },
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Invert & Guide Options */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-sans">
              <button
                onClick={() =>
                  onOptionsChange?.({
                    ...options,
                    clipping: {
                      enabled: true,
                      axis: options.clipping?.axis || 'y',
                      offset: options.clipping?.offset ?? 0.8,
                      inverted: !options.clipping?.inverted,
                      showPlane: options.clipping?.showPlane ?? true,
                    },
                  })
                }
                className="text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <span>Flip Normal</span>
                <span className="font-mono text-cyan-400">
                  {options.clipping?.inverted ? '[Inverted]' : '[Normal]'}
                </span>
              </button>
              <button
                onClick={() =>
                  onOptionsChange?.({
                    ...options,
                    clipping: {
                      enabled: true,
                      axis: options.clipping?.axis || 'y',
                      offset: options.clipping?.offset ?? 0.8,
                      inverted: Boolean(options.clipping?.inverted),
                      showPlane: !(options.clipping?.showPlane ?? true),
                    },
                  })
                }
                className="text-slate-400 hover:text-white transition-colors"
              >
                {options.clipping?.showPlane ?? true ? 'Hide Plane' : 'Show Plane'}
              </button>
            </div>
          </div>
        )}

        {/* EXPLODE SUBMESH SLIDER OVERLAY */}
        {activeTool === 'explode' && (
          <div className="absolute left-20 top-20 z-20 p-3 rounded-2xl bg-slate-950/95 border border-amber-500/50 text-xs font-mono text-amber-300 backdrop-blur-md shadow-2xl flex flex-col gap-2 w-56">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-sans font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Explode Assembly
              </span>
              <span className="font-bold text-amber-400">{Math.round(effectiveExplode * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={effectiveExplode}
              onChange={(e) => {
                const val = Number(e.target.value);
                setLocalExplode(val);
                onExplodeChange?.(val);
              }}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
              <span>Packed</span>
              <button
                onClick={() => {
                  setLocalExplode(0);
                  onExplodeChange?.(0);
                }}
                className="text-amber-400/80 hover:text-amber-300 font-medium cursor-pointer"
              >
                Reset (0%)
              </button>
              <span>Disassembled</span>
            </div>
          </div>
        )}

        {/* DIMENSIONS CALLOUT OVERLAY (when Measure tool active) */}
        {showDimensions && (
          <div className="absolute left-20 top-4 z-20 p-2.5 rounded-xl bg-slate-950/90 border border-lime-500/40 text-xs font-mono text-lime-400 backdrop-blur-md shadow-2xl flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Mesh Bounding Bounds</span>
            <span>X (Width):  {liveBounds.x} m</span>
            <span>Y (Height): {liveBounds.y} m</span>
            <span>Z (Depth):  {liveBounds.z} m</span>
          </div>
        )}

        {/* CALIPER 3D SURFACE MEASUREMENT OVERLAY */}
        {activeTool === 'measure' && (
          <div className="absolute left-20 top-24 z-20 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/50 text-xs font-mono text-cyan-300 backdrop-blur-md shadow-2xl flex flex-col gap-2.5 w-72 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-white font-sans font-semibold flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                3D Surface Caliper
              </span>
              <button
                onClick={() => {
                  setMeasurePointA(null);
                  setMeasurePointB(null);
                  measurePointARef.current = null;
                  measurePointBRef.current = null;
                  setLocalMeasurement(null);
                  onMeasurementChange?.(null);
                }}
                className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-slate-800 text-slate-300 hover:bg-rose-950 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 transition-colors"
              >
                Clear
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Click two points directly on the 3D model surface to measure Euclidean distance and coordinate deltas.
            </p>

            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-sans">Point A:</span>
                <span className="text-cyan-400 font-mono">
                  {effectiveMeasurement?.pointA
                    ? `[${effectiveMeasurement.pointA.map((v) => v.toFixed(2)).join(', ')}]`
                    : 'Click surface...'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-sans">Point B:</span>
                <span className="text-amber-400 font-mono">
                  {effectiveMeasurement?.pointB
                    ? `[${effectiveMeasurement.pointB.map((v) => v.toFixed(2)).join(', ')}]`
                    : effectiveMeasurement?.pointA
                    ? 'Click 2nd point...'
                    : 'Waiting for Point A'}
                </span>
              </div>

              {effectiveMeasurement?.distance != null && (
                <div className="mt-2 p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-sans font-medium text-[11px]">Surface Distance:</span>
                    <span className="text-cyan-300 font-bold text-sm">
                      {effectiveMeasurement.distance.toFixed(3)} m
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Millimeters:</span>
                    <span className="font-semibold text-slate-200">
                      {(effectiveMeasurement.distance * 1000).toFixed(1)} mm
                    </span>
                  </div>
                  {effectiveMeasurement.delta && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 pt-1 border-t border-cyan-900/40">
                      <span>ΔX: {effectiveMeasurement.delta.x.toFixed(2)}</span>
                      <span>ΔY: {effectiveMeasurement.delta.y.toFixed(2)}</span>
                      <span>ΔZ: {effectiveMeasurement.delta.z.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3D SURFACE ANNOTATIONS CONTROLLER OVERLAY */}
        {activeTool === 'annotate' && (
          <div className="absolute left-20 top-24 z-20 p-3 rounded-2xl bg-slate-950/95 border border-amber-500/50 text-xs font-mono text-amber-300 backdrop-blur-md shadow-2xl flex flex-col gap-2.5 w-72 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-white font-sans font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                3D Pinpoint Hotspots
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-950/60 border border-amber-500/40 text-amber-300">
                {effectiveAnnotations.length} pinned
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Click any mesh surface to pin an inspection marker. Click a pin to focus camera.
            </p>

            {effectiveAnnotations.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {effectiveAnnotations.map((ann, idx) => (
                  <div
                    key={ann.id}
                    onClick={() => handleFocusAnnotation(ann)}
                    className={`p-2 rounded-xl border text-[11px] cursor-pointer transition-all flex items-center justify-between ${
                      selectedAnnotationId === ann.id
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center font-sans">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-sans font-semibold">{ann.title}</span>
                        <span className="text-[10px] text-slate-400">{ann.comment}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = effectiveAnnotations.filter((a) => a.id !== ann.id);
                        setLocalAnnotations(next);
                        onAnnotationsChange?.(next);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Pin"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FLOATING 2D SCREEN-SPACE ANNOTATION BADGES */}
        {projectedAnnotations.map((p) => {
          if (!p.visible) return null;
          const isSel = p.id === selectedAnnotationId;
          const ann = effectiveAnnotations.find((a) => a.id === p.id);
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}px`,
                top: `${p.y}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'auto',
              }}
              className="z-20 group cursor-pointer"
              onClick={() => ann && handleFocusAnnotation(ann)}
            >
              <div
                className={`relative flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold shadow-lg transition-all ${
                  isSel
                    ? 'bg-amber-400 text-slate-950 scale-110 shadow-amber-500/50 ring-2 ring-amber-300'
                    : 'bg-slate-950/90 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500 hover:text-slate-950'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>{p.index}</span>
                {/* Tooltip on Hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap z-30">
                  <div className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-200 shadow-xl">
                    <span className="font-semibold text-amber-400">{p.title}</span>
                    {ann?.comment && <span className="block text-slate-400">{ann.comment}</span>}
                  </div>
                  <div className="w-2 h-2 bg-slate-950 rotate-45 border-r border-b border-slate-800 -mt-1" />
                </div>
              </div>
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mx-auto mt-0.5 animate-ping opacity-75" />
            </div>
          );
        })}

        {/* TOP-RIGHT 3D ORIENTATION GIZMO (X/Y/Z) */}
        <div className="absolute right-4 top-4 z-20 flex flex-col items-center gap-2">
          <div 
            onClick={() => handleSnapCamera('z')}
            title="Click to snap Front View (Z)"
            className="relative w-20 h-20 bg-slate-950/80 border border-slate-800/80 rounded-2xl backdrop-blur-md p-1 shadow-2xl flex items-center justify-center cursor-pointer hover:border-slate-600 transition-colors"
          >
            <canvas ref={gizmoCanvasRef} width={76} height={76} className="pointer-events-none" />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSnapCamera('x')}
              title="Snap Right View (X)"
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-red-400 hover:bg-slate-800 font-bold"
            >
              X
            </button>
            <button
              onClick={() => handleSnapCamera('y')}
              title="Snap Top View (Y)"
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-green-400 hover:bg-slate-800 font-bold"
            >
              Y
            </button>
            <button
              onClick={() => handleSnapCamera('z')}
              title="Snap Front View (Z)"
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-blue-400 hover:bg-slate-800 font-bold"
            >
              Z
            </button>
            <button
              onClick={() => handleSnapCamera('iso')}
              title="Snap Isometric 3D View"
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-amber-400 hover:bg-slate-800 font-bold"
            >
              Iso
            </button>
            <button
              onClick={() => {
                const next = (options.cameraProjection || 'perspective') === 'perspective' ? 'orthographic' : 'perspective';
                onOptionsChange?.({ ...options, cameraProjection: next });
              }}
              title="Toggle Camera Projection: Perspective (3D Depth) vs Orthographic (CAD Technical View) [C]"
              className={`px-1.5 py-0.5 rounded border text-[9px] font-bold transition-all ${
                options.cameraProjection === 'orthographic'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-cyan-400 hover:bg-slate-800'
              }`}
            >
              {options.cameraProjection === 'orthographic' ? 'Ortho' : 'Persp'}
            </button>
            <button
              onClick={handleResetCamera}
              title="Auto-Fit Camera to Model Bounds"
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-slate-300 hover:bg-slate-800 font-bold"
            >
              Fit
            </button>
          </div>
        </div>

        {/* UV ATLAS WIREFRAME INSPECTOR PANEL */}
        {activeTab === 'uv' && (
          <div className="absolute right-4 top-24 bottom-20 z-20 w-80 max-h-[calc(100%-10rem)] bg-slate-950/90 backdrop-blur-md border border-sky-500/30 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 text-xs text-slate-300 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>UV Atlas Inspector</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                uvStats?.hasUV ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {uvStats?.hasUV ? 'Unwrapped' : 'No UVs'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-slate-800">
              <canvas
                ref={uvCanvasRef}
                width={260}
                height={260}
                className="w-[260px] h-[260px] rounded-lg shadow-inner bg-[#090d16]"
              />
              <div className="w-full flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5 px-1">
                <span>UV Origin: (0, 0)</span>
                <span>Bounds: 1.0 × 1.0</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">UV Vertices</span>
                <span className="font-mono font-semibold text-slate-200">
                  {uvStats?.uvVertexCount?.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Range [0, 1]</span>
                <span className={`font-mono font-semibold ${uvStats?.in01Range ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {uvStats?.in01Range ? '✓ Normalized' : '⚠ Out of Bounds'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">U Bounds</span>
                <span className="font-mono text-slate-300">
                  [{uvStats?.uMin ?? 0}, {uvStats?.uMax ?? 0}]
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">V Bounds</span>
                <span className="font-mono text-slate-300">
                  [{uvStats?.vMin ?? 0}, {uvStats?.vMax ?? 0}]
                </span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-500/20 text-[10px] text-sky-300 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>3D Viewport displays UV calibration checkerboard with coordinates to check distortion and seams.</span>
            </div>
          </div>
        )}

        {/* TEXTURING ENGINE & QEM STUDIO PANEL */}
        {activeTab === 'texturing' && (
          <div className="absolute right-4 top-24 bottom-18 z-20 w-96 max-h-[calc(100%-10rem)] bg-slate-950/95 backdrop-blur-md border border-indigo-500/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-xs text-slate-300 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Texturing Engine Studio</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                QEM Decimation
              </span>
            </div>

            {/* Model Source Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Model Source
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setModelSource('current')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    modelSource === 'current'
                      ? 'bg-indigo-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Current Model
                </button>
                <button
                  onClick={() => setModelSource('upload')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    modelSource === 'upload'
                      ? 'bg-indigo-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upload Mesh (.obj/.glb)
                </button>
              </div>

              {modelSource === 'current' ? (
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <Box className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                    <span className="font-medium text-slate-200 truncate">
                      {assetTitle || (activeModelUrl ? 'Active Viewport Model' : 'No model loaded')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {liveBounds ? `${liveBounds.x}×${liveBounds.y}×${liveBounds.z}` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 cursor-pointer transition-all">
                    <input
                      type="file"
                      accept=".obj,.glb"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 text-indigo-300">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span className="font-semibold text-xs truncate max-w-[200px]">
                          {uploadedFile.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({(uploadedFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 text-center">
                        <Upload className="w-4 h-4 text-indigo-400 mb-0.5" />
                        <span className="text-xs font-medium text-slate-300">Select OBJ or GLB mesh</span>
                        <span className="text-[10px] text-slate-500">Max size 50 MB</span>
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* QEM Mesh Optimization Section (Milestone 7A) */}
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    QEM Mesh Optimization
                  </span>
                </div>
                {capabilities?.qem_simplification?.available ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    QEM Ready
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/30">
                    Engine Unavailable
                  </span>
                )}
              </div>

              {/* Enable Toggle */}
              <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">
                    Enable QEM Simplification
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Decimate polygon faces prior to UV unwrapping
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableOptimization}
                  disabled={!capabilities?.qem_simplification?.available}
                  onChange={(e) => setEnableOptimization(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer disabled:opacity-40"
                />
              </label>

              {/* Controls when Optimization is Enabled */}
              {enableOptimization && (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                  {/* Mode Selector: Target Faces vs Reduction Ratio */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setOptimizationMode('faces')}
                      className={`py-1 px-2 rounded-md font-medium transition-all ${
                        optimizationMode === 'faces'
                          ? 'bg-cyan-600 text-white font-semibold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Target Face Count
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptimizationMode('ratio')}
                      className={`py-1 px-2 rounded-md font-medium transition-all ${
                        optimizationMode === 'ratio'
                          ? 'bg-cyan-600 text-white font-semibold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Reduction Percentage
                    </button>
                  </div>

                  {optimizationMode === 'faces' ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">
                        Quality Presets & Target
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: 'high', label: 'High', count: '25,000', desc: 'High Quality (25k faces)' },
                          { id: 'medium', label: 'Medium', count: '10,000', desc: 'Balanced Quality (10k faces)' },
                          { id: 'low', label: 'Low', count: '2,500', desc: 'Low Poly / Mobile (2.5k faces)' },
                          { id: 'custom', label: 'Custom', count: 'Custom', desc: 'User-specified target faces' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setTargetPreset(p.id as any)}
                            title={p.desc}
                            className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center gap-0.5 border transition-all ${
                              targetPreset === p.id
                                ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 font-bold'
                                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-[11px] font-medium leading-none">{p.label}</span>
                            <span className="text-[9px] opacity-75 font-mono">{p.count}</span>
                          </button>
                        ))}
                      </div>

                      {targetPreset === 'custom' && (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Custom Target Face Count:</span>
                            <span className="font-mono text-cyan-400">{customTargetFaces.toLocaleString()}</span>
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            step={500}
                            value={customTargetFaces}
                            onChange={(e) => setCustomTargetFaces(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-slate-400 uppercase">Polygon Reduction</span>
                        <span className="font-mono text-cyan-400 font-bold">{reductionPercentage}% cut</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        step={5}
                        value={reductionPercentage}
                        onChange={(e) => setReductionPercentage(parseInt(e.target.value))}
                        className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>5% (Subtle)</span>
                        <span>50% (Balanced)</span>
                        <span>95% (Aggressive)</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>QEM decimates raw 3D geometry; new UV coordinates are generated automatically via xatlas.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Texture Synthesis Engine Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Synthesis Engine
                </label>
                {capabilities && (
                  <span className="text-[9px] font-mono text-cyan-400">
                    {capabilities.texture_providers?.stable_diffusion?.available ? 'MPS Neural Ready' : 'CPU Engine'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setTextureProvider('procedural')}
                  className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                    textureProvider === 'procedural'
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold text-xs">Procedural (CPU)</span>
                  <span className="text-[10px] opacity-75">Instant 2D patterns</span>
                </button>

                <button
                  onClick={() => setTextureProvider('stable_diffusion')}
                  className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                    textureProvider === 'stable_diffusion'
                      ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold text-xs">Stable Diffusion</span>
                  <span className="text-[10px] opacity-75">Neural diffusion (MPS)</span>
                </button>
              </div>
            </div>

            {/* Material Style Preset */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Material Style Preset
              </label>
              <select
                value={textureStyle}
                onChange={(e) => setTextureStyle(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {(availableStyles.length > 0 ? availableStyles : [
                  { id: 'scifi', name: 'Sci-Fi Hull' },
                  { id: 'metallic', name: 'Brushed Metal' },
                  { id: 'wood', name: 'Fine Wood Grain' },
                  { id: 'stone', name: 'Stone & Granite' },
                  { id: 'marble', name: 'Polished Marble' },
                  { id: 'carbon_fiber', name: 'Carbon Fiber' },
                  { id: 'fabric', name: 'Woven Fabric' },
                  { id: 'ceramic', name: 'Glazed Ceramic' },
                  { id: 'organic', name: 'Organic / Bio' },
                ]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Texture Prompt */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Custom Texture Prompt
              </label>
              <input
                type="text"
                value={texturePrompt}
                onChange={(e) => setTexturePrompt(e.target.value)}
                placeholder="e.g. seamless brushed titanium with glowing cyan conduits"
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Resolution & PBR Tuning */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Resolution
                </label>
                <div className="flex items-center gap-1">
                  {[256, 512, 1024].map((res) => (
                    <button
                      key={res}
                      onClick={() => setTextureResolution(res)}
                      className={`flex-1 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                        textureResolution === res
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-400 uppercase">Metallic</span>
                  <span className="font-mono text-indigo-400">{metallicFactor.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={metallicFactor}
                  onChange={(e) => setMetallicFactor(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-400 uppercase">Roughness</span>
                <span className="font-mono text-indigo-400">{roughnessFactor.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={roughnessFactor}
                onChange={(e) => setRoughnessFactor(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fallback Checkbox */}
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fallbackToProcedural}
                onChange={(e) => setFallbackToProcedural(e.target.checked)}
                className="accent-indigo-500 rounded"
              />
              <span>Allow procedural fallback if neural model is busy</span>
            </label>

            {/* Action Button */}
            <button
              onClick={handleProcessMesh}
              disabled={isProcessing || (modelSource === 'upload' && !uploadedFile) || (modelSource === 'current' && !activeModelUrl && !modelUrl)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processingStage || 'Processing Mesh...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>Process & Apply Texture</span>
                </>
              )}
            </button>

            {/* Feedback Messages */}
            {processError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px] leading-relaxed">{processError}</div>
                <button onClick={() => setProcessError(null)} className="text-rose-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {processWarning && (
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="flex-1">{processWarning}</span>
              </div>
            )}

            {processSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Texture Generated Successfully</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-900/60 text-emerald-300 border border-emerald-500/30">
                    {processSuccess.actual_texture_provider}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-emerald-400/90">
                  <span>Polys: {processSuccess.poly_count.toLocaleString()}</span>
                  <span>Verts: {processSuccess.vertex_count.toLocaleString()}</span>
                  <span>Resolution: {processSuccess.texture_resolution[0]}×{processSuccess.texture_resolution[1]}</span>
                  <span>Format: {processSuccess.format_uploaded.toUpperCase()}</span>
                </div>

                {/* QEM Optimization Telemetry Card */}
                {processSuccess.metrics.optimization && (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Mesh Decimation Telemetry
                        </span>
                      </div>
                      {/* Optimization Status Badge */}
                      {processSuccess.metrics.optimization.optimized && processSuccess.metrics.optimization.reduction_percentage > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Successfully Optimized
                        </span>
                      ) : processSuccess.metrics.optimization.warnings?.some(w => w.toLowerCase().includes('already at or below')) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          Optimization Skipped (At/Below Target)
                        </span>
                      ) : enableOptimization ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Optimization Skipped (Mesh Retained)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Optimization Disabled
                        </span>
                      )}
                    </div>

                    {/* Algorithm */}
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Algorithm:</span>
                      <span className="font-mono text-slate-200">
                        {processSuccess.metrics.optimization.algorithm}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Original Faces:</span>
                        <span className="text-slate-200 font-bold">
                          {processSuccess.metrics.optimization.original_face_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Final Faces:</span>
                        <span className="text-cyan-400 font-bold">
                          {processSuccess.metrics.optimization.final_face_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Reduction:</span>
                        <span className="text-emerald-400 font-bold">
                          {processSuccess.metrics.optimization.reduction_percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Requested Target:</span>
                        <span className="text-slate-200">
                          {processSuccess.metrics.optimization.requested_target_faces != null
                            ? processSuccess.metrics.optimization.requested_target_faces.toLocaleString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Reached:</span>
                        <span className={processSuccess.metrics.optimization.target_reached ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                          {processSuccess.metrics.optimization.target_reached ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Execution Time:</span>
                        <span className="text-indigo-400">
                          {processSuccess.metrics.optimization.execution_time_seconds > 0
                            ? `${(processSuccess.metrics.optimization.execution_time_seconds * 1000).toFixed(2)} ms`
                            : '< 0.1 ms'}
                        </span>
                      </div>
                    </div>

                    {/* Warnings / Fallback messages if any */}
                    {processSuccess.metrics.optimization.warnings && processSuccess.metrics.optimization.warnings.length > 0 && (
                      <div className="text-[10px] text-amber-300/90 bg-amber-950/40 p-1.5 rounded border border-amber-500/20">
                        {processSuccess.metrics.optimization.warnings.join(' | ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
                  <a
                    href={api.getDownloadUrl(processSuccess.asset_id, 'glb')}
                    download={`${processSuccess.asset_id}.glb`}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 text-center font-semibold text-xs text-white transition-colors"
                  >
                    Download GLB
                  </a>
                  <a
                    href={api.getDownloadUrl(processSuccess.asset_id, 'obj')}
                    download={`${processSuccess.asset_id}.obj`}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-center font-medium text-xs text-slate-200 transition-colors"
                  >
                    Download OBJ
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FLOATING BOTTOM TRIPO/MIXAR PILL UTILITY BAR */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-slate-950/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300">
          <button
            onClick={() => onOptionsChange?.({ ...options, wireframe: !options.wireframe })}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
              options.wireframe
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Wireframe</span>
          </button>

          <button
            onClick={() => onOptionsChange?.({ ...options, wireframeOverlay: !options.wireframeOverlay })}
            title="Toggle Wireframe Edge Overlay on Shaded Geometry"
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
              options.wireframeOverlay
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Edges</span>
          </button>

          <button
            onClick={() => onOptionsChange?.({ ...options, grid: !options.grid })}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
              options.grid
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            onClick={() => onOptionsChange?.({ ...options, autoRotate: !options.autoRotate })}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
              options.autoRotate
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${options.autoRotate ? 'animate-spin' : ''}`} />
            <span>360° Turntable</span>
          </button>

          {/* Key Light Orbit Slider */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={options.lightAngle ?? 45}
              onChange={(e) => onOptionsChange?.({ ...options, lightAngle: Number(e.target.value) })}
              className="w-16 accent-amber-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
              title={`Sun Orbit Angle: ${options.lightAngle ?? 45}°`}
            />
            <span className="font-mono text-[10px] text-amber-300 w-6">{options.lightAngle ?? 45}°</span>
          </div>

          <select
            value={options.shadingMode}
            onChange={(e) => onOptionsChange?.({ ...options, shadingMode: e.target.value as any })}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="pbr">PBR Shaded</option>
            <option value="clay">Clay Studio</option>
            <option value="normals">Normal Vectors</option>
            <option value="albedo">Base Color (Albedo)</option>
            <option value="roughness">Roughness Map</option>
            <option value="metalness">Metalness Map</option>
            <option value="matcap">Curvature Matcap</option>
            <option value="depth">Z-Depth Gradient</option>
            <option value="wireframe">Cyber Mesh</option>
          </select>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30">
            <Loader2 className="w-10 h-10 text-lime-400 animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-200 tracking-wider uppercase">Loading 3D Viewport Geometry...</p>
          </div>
        )}

        {/* Error Banner */}
        {loadError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-500/40 text-rose-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-md z-30">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{loadError}</span>
          </div>
        )}
      </div>

      {/* 3. BOTTOM MIXAR TIMELINE / SCRUBBER BAR */}
      <div className="h-10 px-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors"
            title={isPlaying ? 'Pause' : 'Play animation turntable'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-lime-400" /> : <Play className="w-3.5 h-3.5 text-lime-400 fill-lime-400" />}
          </button>
          <button
            onClick={() => {
              setCurrentFrame(1);
              if (modelGroupRef.current) modelGroupRef.current.rotation.y = 0;
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset frame"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 max-w-xl mx-4 flex items-center gap-3">
          <span className="font-mono text-[11px] text-lime-400 font-bold w-7 text-right">{currentFrame}</span>
          <input
            type="range"
            min={1}
            max={250}
            value={currentFrame}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentFrame(val);
              if (modelGroupRef.current) {
                modelGroupRef.current.rotation.y = (val / 250) * Math.PI * 2;
              }
            }}
            className="w-full accent-lime-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="font-mono text-[11px] text-slate-500">250</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-slate-500">Start: <span className="text-slate-300">1</span></span>
          <span className="text-slate-500">End: <span className="text-slate-300">250</span></span>
        </div>
      </div>
    </div>
  );
};
