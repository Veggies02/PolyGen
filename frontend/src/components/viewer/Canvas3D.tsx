import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { ViewerOptions, TransformData } from '../../types';
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
  Scissors
} from 'lucide-react';
import { api } from '../../api/client';

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
  }) => void;
  onTransformChange?: (transform: TransformData) => void;
  explodeFactor?: number;
  onExplodeChange?: (factor: number) => void;
  className?: string;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
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
  className = '',
  isZenMode = false,
  onToggleZenMode,
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
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Studio tabs and tools
  const [activeTab, setActiveTab] = useState<'modeling' | 'uv' | 'texturing'>('modeling');
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'rotate' | 'scale' | 'transform' | 'measure' | 'explode' | 'section'>('select');
  const [objectMode, setObjectMode] = useState<'Object Mode' | 'Edit Mode' | 'Sculpt Mode'>('Object Mode');
  const [coordSystem, setCoordSystem] = useState<'Global' | 'Local'>('Global');
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showModeMenu, setShowModeMenu] = useState<boolean>(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [localExplode, setLocalExplode] = useState<number>(0);
  const effectiveExplode = explodeFactor !== undefined ? explodeFactor : localExplode;
  
  // Animation / Turntable timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [liveBounds, setLiveBounds] = useState<{ x: number; y: number; z: number }>({ x: 1, y: 1, z: 1 });

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
      const cam = activeCameraRef.current || cameraRef.current;
      if (rendererRef.current && sceneRef.current && cam) {
        rendererRef.current.render(sceneRef.current, cam);
      }
      drawOrientationGizmo();
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      transformControls.dispose();
      scene.remove(transformHelper);
      scene.remove(planeHelper);
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
      setShowDimensions((prev) => !prev);
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

  // Keyboard Hotkeys: G (Grab/Move), R (Rotate), S (Scale), Q (Select), E (Explode), X (Section), C (Camera Projection), Space (Turntable)
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

    if (options.lightingPreset === 'cyberpunk') {
      const ambient = new THREE.AmbientLight(0x0f172a, 0.8);
      group.add(ambient);
      const cyanKey = new THREE.DirectionalLight(0x00f0ff, 2.8);
      cyanKey.position.set(5, 5, 4);
      group.add(cyanKey);
      const magentaRim = new THREE.DirectionalLight(0xec4899, 2.5);
      magentaRim.position.set(-5, 3, -4);
      group.add(magentaRim);
      const purpleFill = new THREE.PointLight(0x8b5cf6, 1.8, 12);
      purpleFill.position.set(0, -1, 3);
      group.add(purpleFill);
    } else if (options.lightingPreset === 'sunset') {
      const ambient = new THREE.AmbientLight(0x451a03, 0.7);
      group.add(ambient);
      const amberKey = new THREE.DirectionalLight(0xfbbf24, 3.2);
      amberKey.position.set(6, 4, 3);
      group.add(amberKey);
      const orangeFill = new THREE.DirectionalLight(0xf97316, 1.5);
      orangeFill.position.set(-4, 2, -3);
      group.add(orangeFill);
      const skyRim = new THREE.DirectionalLight(0x38bdf8, 0.8);
      skyRim.position.set(0, 5, -5);
      group.add(skyRim);
    } else if (options.lightingPreset === 'space') {
      const ambient = new THREE.AmbientLight(0x020617, 0.2);
      group.add(ambient);
      const starkDir = new THREE.DirectionalLight(0xf8fafc, 3.8);
      starkDir.position.set(7, 8, 5);
      group.add(starkDir);
      const blueSpec = new THREE.DirectionalLight(0x38bdf8, 1.0);
      blueSpec.position.set(-6, 2, -4);
      group.add(blueSpec);
    } else {
      // Default Studio 3-Point
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      group.add(ambient);
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(5, 7, 5);
      group.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.2);
      fillLight.position.set(-5, 3, 3);
      group.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      rimLight.position.set(0, 5, -5);
      group.add(rimLight);
    }
  }, [options.lightingPreset]);

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

  // Load Model
  useEffect(() => {
    const effectiveUrl = importedModelUrl || modelUrl;
    if (!modelGroupRef.current || !effectiveUrl) return;
    const group = modelGroupRef.current;
    group.clear();

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
        const materialsSet = new Set<string>();

        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const geometry = mesh.geometry;
            if (geometry) {
              if (geometry.index) {
                totalPolys += geometry.index.count / 3;
              } else if (geometry.attributes.position) {
                totalPolys += geometry.attributes.position.count / 3;
              }
              if (geometry.attributes.position) {
                totalVertices += geometry.attributes.position.count;
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
          });
        }

        applyShadingAndWireframe();
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D model:', error);
        setLoadError('Failed to load GLB model. Check network connection or file path.');
        setLoading(false);
      }
    );
  }, [modelUrl, importedModelUrl]);

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
          const physicalMat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(mat.color),
            metalness: mat.metalness,
            roughness: mat.roughness,
            clearcoat: mat.clearcoat,
            clearcoatRoughness: 0.1,
            wireframe: options.wireframe,
          });
          if (mat.emissiveIntensity > 0) {
            physicalMat.emissive = new THREE.Color(mat.emissiveColor || '#000000');
            physicalMat.emissiveIntensity = mat.emissiveIntensity;
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
            title="Measure Topology Dimensions"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              showDimensions || activeTool === 'measure'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span className="text-[8px]">Measure</span>
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

          <select
            value={options.shadingMode}
            onChange={(e) => onOptionsChange?.({ ...options, shadingMode: e.target.value as any })}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="pbr">PBR Shaded</option>
            <option value="clay">Clay Studio</option>
            <option value="normals">Normal Vectors</option>
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
