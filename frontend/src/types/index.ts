export interface Asset {
  id: string;
  title: string;
  prompt: string;
  negative_prompt?: string | null;
  provider: string;
  style: string;
  poly_count: number;
  vertex_count: number;
  file_size_bytes: number;
  formats: {
    glb: string;
    obj: string;
    stl: string;
  };
  thumbnail_url?: string | null;
  tags: string[];
  created_at: string;
  is_demo: boolean;
  attributes?: Record<string, any>;
}

export interface JobStatus {
  id: string;
  prompt: string;
  provider: string;
  status: 'queued' | 'synthesizing' | 'meshing' | 'texturing' | 'completed' | 'failed';
  progress: number;
  current_stage: string;
  error?: string | null;
  created_at: string;
  updated_at: string;
  asset_id?: string | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  is_configured: boolean;
  is_demo: boolean;
  supported_formats: string[];
  capabilities: string[];
  speed_estimate: string;
}

export interface StatsOverview {
  total_assets: number;
  active_jobs: number;
  completed_jobs: number;
  storage_used_bytes: number;
  available_providers: number;
}

export interface GenerationSettings {
  prompt: string;
  negative_prompt?: string;
  provider: string;
  style: string;
  poly_budget: string;
  symmetry: boolean;
  seed?: number;
}

export interface MaterialCustomization {
  preset: 'default' | 'titanium' | 'cyberpunk-neon' | 'obsidian' | 'gold' | 'iridescent' | 'matte-carbon' | 'frosted-glass' | 'emerald-gem' | 'hologram';
  color: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  emissiveIntensity: number;
  clearcoat: number;
  transmission?: number;
  ior?: number;
  wireframeOverlay: boolean;
  proceduralPattern?: 'none' | 'checker' | 'hex-armor' | 'carbon-weave' | 'tech-circuit';
}

export interface ClippingOptions {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  offset: number;
  inverted: boolean;
  showPlane: boolean;
}

export type ToneMappingMode = 'aces' | 'agx' | 'cineon' | 'neutral' | 'reinhard' | 'linear';
export type MotionMode = 'none' | 'hover-float' | 'turntable-spin' | 'cinematic-pulse' | 'model-clip';
export type StudioBackdrop = 'void' | 'studio-vignette' | 'cyber-grid' | 'warm-sunset' | 'blueprint';

export type EnvironmentPreset = 'studio-softbox' | 'cyber-neon' | 'sunset-radiance' | 'industrial-loft' | 'deep-cosmos' | 'neutral';

export interface EnvironmentOptions {
  preset: EnvironmentPreset;
  intensity: number; // 0.0 to 3.0
  rotation: number; // 0 to 360 deg
  showSkybox: boolean;
  groundShadow: boolean;
  groundShadowOpacity?: number; // 0.0 to 1.0
}

export interface LightingRigOptions {
  keyColor?: string;
  keyIntensity?: number;
  fillColor?: string;
  fillIntensity?: number;
  rimColor?: string;
  rimIntensity?: number;
  shadows?: boolean;
  showLightGizmos?: boolean;
}

export interface CameraBookmark {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  projection?: 'perspective' | 'orthographic';
  createdAt?: string;
}

export interface ViewerOptions {
  wireframe: boolean;
  wireframeOverlay?: boolean;
  grid: boolean;
  autoRotate: boolean;
  shadingMode: 'pbr' | 'clay' | 'normals' | 'wireframe' | 'albedo' | 'roughness' | 'metalness' | 'matcap' | 'depth' | 'face-orientation' | 'curvature';
  lightingPreset: 'studio' | 'cyberpunk' | 'sunset' | 'space' | 'dramatic' | 'soft';
  lightAngle?: number;
  backgroundColor: string;
  exposure: number;
  cameraProjection?: 'perspective' | 'orthographic';
  clipping?: ClippingOptions;
  materials?: MaterialCustomization;
  toneMapping?: ToneMappingMode;
  motionMode?: MotionMode;
  playbackSpeed?: number;
  studioBackdrop?: StudioBackdrop;
  lightingRig?: LightingRigOptions;
  cameraBookmarks?: CameraBookmark[];
  triggerView?: { view: string; timestamp: number };
  environment?: EnvironmentOptions;
  showDimensions?: boolean;
}

export interface LiveGeometryStats {
  polyCount: number;
  vertexCount: number;
  dimensions: { x: number; y: number; z: number };
  materialCount: number;
  surfaceArea?: number;
  volume?: number;
  animationClips?: string[];
}

export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface ModelAnnotation {
  id: string;
  point: [number, number, number];
  title: string;
  comment?: string;
  createdAt: string;
}

export interface MeasurementData {
  pointA: [number, number, number] | null;
  pointB: [number, number, number] | null;
  distance: number | null;
  delta: {
    x: number;
    y: number;
    z: number;
  } | null;
}
