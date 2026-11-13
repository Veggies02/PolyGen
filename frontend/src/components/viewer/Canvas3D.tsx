import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ViewerOptions } from '../../types';
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
  Plus
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
  className = '',
  isZenMode = false,
  onToggleZenMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gizmoCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const primitivesGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Studio tabs and tools
  const [activeTab, setActiveTab] = useState<'modeling' | 'uv' | 'texturing'>('modeling');
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'rotate' | 'scale' | 'transform' | 'measure'>('select');
  const [objectMode, setObjectMode] = useState<'Object Mode' | 'Edit Mode' | 'Sculpt Mode'>('Object Mode');
  const [coordSystem, setCoordSystem] = useState<'Global' | 'Local'>('Global');
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showModeMenu, setShowModeMenu] = useState<boolean>(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  
  // Animation / Turntable timeline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [liveBounds, setLiveBounds] = useState<{ x: number; y: number; z: number }>({ x: 1, y: 1, z: 1 });

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.backgroundColor || '#0c0e14');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(3.5, 2.8, 4.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = options.exposure || 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
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

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
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
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      drawOrientationGizmo();
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
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
  const handleSnapCamera = (axis: 'x' | 'y' | 'z') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dist = 5.0;
    if (axis === 'x') {
      cameraRef.current.position.set(dist, 1.0, 0);
    } else if (axis === 'y') {
      cameraRef.current.position.set(0.01, dist, 0.01);
    } else {
      cameraRef.current.position.set(0, 1.0, dist);
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

  // Left Tool Action Handlers
  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    if (!modelGroupRef.current) return;

    if (tool === 'select') {
      // Toggle bounding box selection helper
      if (boxHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(boxHelperRef.current);
        boxHelperRef.current = null;
      } else if (sceneRef.current) {
        const box = new THREE.BoxHelper(modelGroupRef.current, 0x84cc16);
        sceneRef.current.add(box);
        boxHelperRef.current = box;
      }
    } else if (tool === 'move') {
      // Step position along X
      modelGroupRef.current.position.x = (modelGroupRef.current.position.x + 0.3) % 1.5;
    } else if (tool === 'rotate') {
      // Rotate 45 degrees
      modelGroupRef.current.rotation.y += Math.PI / 4;
    } else if (tool === 'scale') {
      // Cycle scale 1.0 -> 1.25 -> 1.5 -> 0.8 -> 1.0
      const currentScale = modelGroupRef.current.scale.x;
      const nextScale = currentScale >= 1.5 ? 0.8 : currentScale + 0.25;
      modelGroupRef.current.scale.set(nextScale, nextScale, nextScale);
    } else if (tool === 'transform') {
      // Reset position, rotation, scale to defaults
      modelGroupRef.current.position.set(0, 0, 0);
      modelGroupRef.current.rotation.set(0, 0, 0);
      modelGroupRef.current.scale.set(1, 1, 1);
    } else if (tool === 'measure') {
      setShowDimensions((prev) => !prev);
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

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    group.add(ambient);

    if (options.lightingPreset === 'cyberpunk') {
      const cyanKey = new THREE.DirectionalLight(0x00ffff, 2.0);
      cyanKey.position.set(4, 5, 3);
      group.add(cyanKey);

      const magentaRim = new THREE.DirectionalLight(0xff007f, 2.5);
      magentaRim.position.set(-4, 3, -4);
      group.add(magentaRim);

      const blueFill = new THREE.PointLight(0x3b82f6, 1.5, 10);
      blueFill.position.set(0, -1, 3);
      group.add(blueFill);
    } else if (options.lightingPreset === 'dramatic') {
      const spot = new THREE.SpotLight(0xffffff, 3.5, 20, Math.PI / 4, 0.4);
      spot.position.set(3, 7, 3);
      spot.castShadow = true;
      group.add(spot);

      const rim = new THREE.DirectionalLight(0x60a5fa, 0.8);
      rim.position.set(-3, 2, -3);
      group.add(rim);
    } else if (options.lightingPreset === 'soft') {
      const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
      group.add(hemi);

      const softDir = new THREE.DirectionalLight(0xffffff, 0.8);
      softDir.position.set(2, 4, 2);
      group.add(softDir);
    } else {
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
      keyLight.position.set(5, 6, 4);
      group.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.0);
      fillLight.position.set(-4, 3, 2);
      group.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      rimLight.position.set(0, 4, -5);
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

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(3.5, 2.8, 4.5);
      controlsRef.current.target.set(0, 0.8, 0);
      controlsRef.current.update();
    }
  };

  // Load Model
  useEffect(() => {
    if (!modelGroupRef.current || !modelUrl) return;
    const group = modelGroupRef.current;
    group.clear();

    setLoading(true);
    setLoadError(null);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
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
  }, [modelUrl]);

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
  }, [options.shadingMode, options.wireframe, activeTab]);

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
          {assetTitle && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200">
              <Box className="w-3 h-3 text-lime-400" />
              <span>{assetTitle}</span>
            </div>
          )}

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

            {showDownloadMenu && assetId && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1 text-xs text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">Export 3D Asset</span>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN 3D VIEWPORT CONTAINER */}
      <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* LEFT FLOATING MIXAR TOOLBAR */}
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 p-1 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl text-slate-400">
          <button
            onClick={() => handleToolClick('select')}
            title="Box Select (Toggle Bounding Box)"
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
            title="Translate / Move Object"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'move'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Move className="w-4 h-4" />
            <span className="text-[8px]">Move</span>
          </button>

          <button
            onClick={() => handleToolClick('rotate')}
            title="Rotate 45°"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'rotate'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-[8px]">Rotate</span>
          </button>

          <button
            onClick={() => handleToolClick('scale')}
            title="Cycle Scale"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'scale'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span className="text-[8px]">Scale</span>
          </button>

          <button
            onClick={() => handleToolClick('transform')}
            title="Reset Position / Rotation"
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-0.5 text-[9px] ${
              activeTool === 'transform'
                ? 'bg-lime-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[8px]">Transform</span>
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
              onClick={handleResetCamera}
              title="Reset Orbit"
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
