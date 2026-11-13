import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ViewerOptions } from '../../types';
import { Loader2, AlertCircle } from 'lucide-react';

interface Canvas3DProps {
  modelUrl?: string | null;
  options: ViewerOptions;
  onStatsCalculated?: (stats: {
    polyCount: number;
    vertexCount: number;
    dimensions: { x: number; y: number; z: number };
    materialCount: number;
  }) => void;
  className?: string;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  modelUrl,
  options,
  onStatsCalculated,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x00f0ff, 0x1f2638);
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

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
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
      // Default Studio
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

  // Update Background & Exposure & Controls
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

  // Load Model when modelUrl changes
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

        // Compute Bounding Box
        const bbox = new THREE.Box3().setFromObject(object);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        // Center object
        object.position.x = -center.x;
        object.position.z = -center.z;
        // Place base firmly on grid (y = 0)
        object.position.y = -bbox.min.y;

        // Calculate stats
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

        // Adjust camera to fit model size nicely
        if (cameraRef.current && controlsRef.current) {
          const maxDim = Math.max(size.x, size.y, size.z, 1.0);
          const fov = cameraRef.current.fov * (Math.PI / 180);
          const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.9;
          
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
        setLoadError('Failed to load GLB model. Check network connection or file validity.');
        setLoading(false);
      }
    );
  }, [modelUrl]);

  // Apply Shading Mode & Wireframe
  const applyShadingAndWireframe = useCallback(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const origMat = mesh.userData.originalMaterial;

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
          // PBR / Original
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
  }, [options.shadingMode, options.wireframe]);

  useEffect(() => {
    applyShadingAndWireframe();
  }, [applyShadingAndWireframe]);

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-300 tracking-wider uppercase">Loading 3D Model...</p>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-500/40 text-rose-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-md z-30">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{loadError}</span>
        </div>
      )}
    </div>
  );
};
