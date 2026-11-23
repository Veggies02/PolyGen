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

export interface ViewerOptions {
  wireframe: boolean;
  wireframeOverlay?: boolean;
  grid: boolean;
  autoRotate: boolean;
  shadingMode: 'pbr' | 'clay' | 'normals' | 'wireframe' | 'albedo' | 'roughness' | 'metalness' | 'matcap' | 'depth';
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

export interface MeshProcessingCapabilities {
  pipeline_version?: string;
  supported_formats: string[];
  supported_input_formats?: string[];
  supported_output_formats?: string[];
  max_upload_size_bytes: number;
  max_upload_size_mb: number;
  texture_providers: {
    procedural: {
      available: boolean;
      supported_styles: string[];
    };
    stable_diffusion: {
      available: boolean;
      default_model?: string;
      device_info?: {
        device: string;
        torch_dtype: string;
        mps_available: boolean;
        cuda_available: boolean;
        backend_description: string;
      };
    };
  };
  qem_simplification?: {
    available: boolean;
    algorithm: string;
  };
}

export interface MeshOptimizationMetrics {
  optimized: boolean;
  algorithm: string;
  original_face_count: number;
  final_face_count: number;
  reduction_percentage: number;
  requested_target_faces?: number | null;
  target_reached: boolean;
  execution_time_seconds: number;
  warnings: string[];
}

export interface MeshProcessOptions {
  texture_provider?: 'procedural' | 'stable_diffusion';
  texture_style?: string;
  texture_prompt?: string;
  texture_resolution?: number;
  texture_seed?: number;
  negative_prompt?: string;
  fallback_to_procedural?: boolean;
  title?: string;
  metallic_factor?: number;
  roughness_factor?: number;
  enable_optimization?: boolean;
  target_faces?: number;
  reduction_ratio?: number;
}

export interface MeshProcessResponse {
  success: boolean;
  asset_id: string;
  title: string;
  format_uploaded: string;
  poly_count: number;
  vertex_count: number;
  requested_texture_provider: string;
  actual_texture_provider: string;
  is_fallback: boolean;
  texture_style?: string | null;
  texture_resolution: [number, number];
  formats: Record<string, string>;
  download_url: string;
  metrics: {
    is_watertight: boolean;
    surface_area: number;
    dimensions: [number, number, number];
    uv_chart_count: number;
    seam_vertex_duplications: number;
    round_trip_success: boolean;
    optimization?: MeshOptimizationMetrics;
  };
  warnings: string[];
}

export interface TextureStyleInfo {
  id: string;
  name: string;
  description: string;
}

