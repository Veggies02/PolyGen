import type {
  Asset,
  JobStatus,
  ProviderInfo,
  StatsOverview,
  GenerationSettings,
  MeshProcessingCapabilities,
  MeshProcessOptions,
  MeshProcessResponse,
  TextureStyleInfo,
} from '../types';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://127.0.0.1:8000/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE.replace('/api', '')}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async getStats(): Promise<StatsOverview> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch statistics');
    return res.json();
  },

  async getProviders(): Promise<ProviderInfo[]> {
    const res = await fetch(`${API_BASE}/providers`);
    if (!res.ok) throw new Error('Failed to fetch providers');
    return res.json();
  },

  async listAssets(tag?: string, search?: string): Promise<Asset[]> {
    const params = new URLSearchParams();
    if (tag) params.append('tag', tag);
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/assets?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch assets');
    return res.json();
  },

  async getAsset(id: string): Promise<Asset> {
    const res = await fetch(`${API_BASE}/assets/${id}`);
    if (!res.ok) throw new Error('Failed to fetch asset');
    return res.json();
  },

  async deleteAsset(id: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`${API_BASE}/assets/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete asset');
    return res.json();
  },

  getDownloadUrl(assetId: string, format: 'glb' | 'obj' | 'stl') {
    return `${API_BASE}/assets/${assetId}/download/${format}`;
  },

  getBundleUrl(assetId: string) {
    return `${API_BASE}/assets/${assetId}/bundle`;
  },

  async generate(settings: GenerationSettings): Promise<JobStatus> {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Generation request failed' }));
      throw new Error(err.detail || 'Generation request failed');
    }
    return res.json();
  },

  async getJob(id: string): Promise<JobStatus> {
    const res = await fetch(`${API_BASE}/generate/jobs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch job status');
    return res.json();
  },

  async listJobs(): Promise<JobStatus[]> {
    const res = await fetch(`${API_BASE}/generate/jobs`);
    if (!res.ok) throw new Error('Failed to fetch generation jobs');
    return res.json();
  },

  async enhancePrompt(prompt: string, style: string = 'scifi'): Promise<{
    original_prompt: string;
    enhanced_prompt: string;
    suggested_tags: string[];
  }> {
    const res = await fetch(`${API_BASE}/generate/enhance-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style }),
    });
    if (!res.ok) throw new Error('Failed to enhance prompt');
    return res.json();
  },

  async getMeshCapabilities(): Promise<MeshProcessingCapabilities> {
    const res = await fetch(`${API_BASE}/mesh/capabilities`);
    if (!res.ok) throw new Error('Failed to fetch mesh processing capabilities');
    return res.json();
  },

  async processMesh(file: File | Blob, filename: string, options?: MeshProcessOptions): Promise<MeshProcessResponse> {
    const formData = new FormData();
    formData.append('file', file, filename);

    if (options?.texture_provider) formData.append('texture_provider', options.texture_provider);
    if (options?.texture_style) formData.append('texture_style', options.texture_style);
    if (options?.texture_prompt) formData.append('texture_prompt', options.texture_prompt);
    if (options?.texture_resolution) formData.append('texture_resolution', options.texture_resolution.toString());
    if (options?.texture_seed !== undefined) formData.append('texture_seed', options.texture_seed.toString());
    if (options?.negative_prompt) formData.append('negative_prompt', options.negative_prompt);
    if (options?.fallback_to_procedural !== undefined) {
      formData.append('fallback_to_procedural', options.fallback_to_procedural.toString());
    }
    if (options?.title) formData.append('title', options.title);
    if (options?.metallic_factor !== undefined) formData.append('metallic_factor', options.metallic_factor.toString());
    if (options?.roughness_factor !== undefined) formData.append('roughness_factor', options.roughness_factor.toString());
    if (options?.enable_optimization) {
      formData.append('enable_optimization', 'true');
      if (options.target_faces !== undefined && options.target_faces !== null) {
        formData.append('target_faces', options.target_faces.toString());
      }
      if (options.reduction_ratio !== undefined && options.reduction_ratio !== null) {
        formData.append('reduction_ratio', options.reduction_ratio.toString());
      }
    } else if (options?.enable_optimization === false) {
      formData.append('enable_optimization', 'false');
    }

    const res = await fetch(`${API_BASE}/mesh/process`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Mesh processing request failed' }));
      throw new Error(err.detail || 'Mesh processing request failed');
    }
    return res.json();
  },

  async getTextureStyles(): Promise<TextureStyleInfo[]> {
    const res = await fetch(`${API_BASE}/textures/styles`);
    if (!res.ok) throw new Error('Failed to fetch texture styles');
    return res.json();
  },

  async getTextureProviders(): Promise<any> {
    const res = await fetch(`${API_BASE}/textures/providers`);
    if (!res.ok) throw new Error('Failed to fetch texture providers');
    return res.json();
  },
};
