import type { Asset, JobStatus, ProviderInfo, StatsOverview, GenerationSettings } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api';

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
};
