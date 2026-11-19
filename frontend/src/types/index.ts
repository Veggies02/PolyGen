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
  preset: 'default' | 'titanium' | 'cyberpunk-neon' | 'obsidian' | 'gold' | 'iridescent' | 'matte-carbon';
  color: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  emissiveIntensity: number;
  clearcoat: number;
  wireframeOverlay: boolean;
}

export interface ClippingOptions {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  offset: number;
  inverted: boolean;
  showPlane: boolean;
}

export interface ViewerOptions {
  wireframe: boolean;
  grid: boolean;
  autoRotate: boolean;
  shadingMode: 'pbr' | 'clay' | 'normals' | 'wireframe';
  lightingPreset: 'studio' | 'cyberpunk' | 'sunset' | 'space' | 'dramatic' | 'soft';
  backgroundColor: string;
  exposure: number;
  cameraProjection?: 'perspective' | 'orthographic';
  clipping?: ClippingOptions;
  materials?: MaterialCustomization;
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
