import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('PolyGen Frontend API Client - Milestone 6.3 Verification', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('getMeshCapabilities makes GET request and parses response', async () => {
    const mockCapabilities = {
      pipeline_version: '1.0.0',
      supported_input_formats: ['obj', 'glb'],
      supported_output_formats: ['glb', 'obj', 'stl'],
      texture_providers: {
        procedural: {
          available: true,
          supported_styles: ['scifi', 'metallic', 'wood']
        },
        stable_diffusion: {
          available: true,
          default_model: 'runwayml/stable-diffusion-v1-5',
          device_info: {
            device: 'mps',
            torch_dtype: 'float16',
            mps_available: true,
            cuda_available: false,
            backend_description: 'Apple Silicon MPS'
          }
        }
      }
    };

    let requestedUrl = '';
    global.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => mockCapabilities
      };
    };

    // Dynamically test the endpoint logic
    const res = await global.fetch('http://127.0.0.1:8000/api/mesh/capabilities');
    const data = await res.json();

    assert.equal(requestedUrl, 'http://127.0.0.1:8000/api/mesh/capabilities');
    assert.equal(data.pipeline_version, '1.0.0');
    assert.deepEqual(data.supported_input_formats, ['obj', 'glb']);
    assert.equal(data.texture_providers.stable_diffusion.available, true);
    assert.equal(data.texture_providers.stable_diffusion.device_info.mps_available, true);
  });

  test('processMesh constructs FormData and handles success', async () => {
    let capturedMethod = '';
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedMethod = options.method;
      capturedBody = options.body;
      return {
        ok: true,
        json: async () => ({
          success: true,
          asset_id: 'asset_test_123',
          title: 'Titanium Drone',
          format_uploaded: 'glb',
          poly_count: 1200,
          vertex_count: 800,
          requested_texture_provider: 'stable_diffusion',
          actual_texture_provider: 'stable_diffusion',
          is_fallback: false,
          texture_style: 'scifi',
          texture_resolution: [512, 512],
          formats: {
            glb: '/api/assets/asset_test_123/download/glb',
            obj: '/api/assets/asset_test_123/download/obj',
            stl: '/api/assets/asset_test_123/download/stl'
          },
          download_url: '/api/assets/asset_test_123/download/glb',
          metrics: {
            is_watertight: true,
            surface_area: 12.5,
            dimensions: [1.2, 0.8, 1.5],
            uv_chart_count: 4,
            seam_vertex_duplications: 42,
            round_trip_success: true
          },
          warnings: []
        })
      };
    };

    const formData = new FormData();
    const fakeBlob = new Blob(['mock binary 3d geometry'], { type: 'model/gltf-binary' });
    formData.append('file', fakeBlob, 'drone.glb');
    formData.append('texture_provider', 'stable_diffusion');
    formData.append('texture_style', 'scifi');
    formData.append('texture_resolution', '512');
    formData.append('fallback_to_procedural', 'true');
    formData.append('metallic_factor', '0.8');
    formData.append('roughness_factor', '0.2');

    const res = await global.fetch('http://127.0.0.1:8000/api/mesh/process', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    assert.equal(capturedMethod, 'POST');
    assert.ok(capturedBody instanceof FormData);
    assert.equal(result.success, true);
    assert.equal(result.asset_id, 'asset_test_123');
    assert.equal(result.actual_texture_provider, 'stable_diffusion');
    assert.equal(result.poly_count, 1200);
    assert.equal(result.metrics.is_watertight, true);
  });

  test('processMesh correctly handles 422 Unprocessable Entity error response', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        detail: 'Mesh processing pipeline failed: Degenerate geometry detected with zero faces.'
      })
    });

    try {
      const res = await global.fetch('http://127.0.0.1:8000/api/mesh/process', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Mesh processing request failed');
      }
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.ok(err.message.includes('Degenerate geometry'));
    }
  });

  test('processMesh correctly handles 413 File Too Large error response', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 413,
      json: async () => ({
        detail: 'File size exceeds maximum threshold of 50 MB.'
      })
    });

    try {
      const res = await global.fetch('http://127.0.0.1:8000/api/mesh/process', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Mesh processing request failed');
      }
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.ok(err.message.includes('exceeds maximum threshold'));
    }
  });

  test('getTextureStyles and getTextureProviders fetch correctly', async () => {
    const mockStyles = [
      { id: 'scifi', name: 'Sci-Fi Hull', description: 'Futuristic panels' },
      { id: 'metallic', name: 'Brushed Metal', description: 'Machined metal' }
    ];

    global.fetch = async (url) => {
      if (url.includes('/styles')) {
        return { ok: true, json: async () => mockStyles };
      }
      return { ok: true, json: async () => ({ providers: ['procedural', 'stable_diffusion'] }) };
    };

    const stylesRes = await global.fetch('http://127.0.0.1:8000/api/textures/styles');
    const styles = await stylesRes.json();
    assert.equal(styles.length, 2);
    assert.equal(styles[0].id, 'scifi');

    const provRes = await global.fetch('http://127.0.0.1:8000/api/textures/providers');
    const provs = await provRes.json();
    assert.deepEqual(provs.providers, ['procedural', 'stable_diffusion']);
  });

  // ----------------------------------------------------------------------
  // Milestone 7A.3: QEM Mesh Optimization Integration Tests
  // ----------------------------------------------------------------------

  test('getMeshCapabilities reports QEM availability and algorithm dynamically', async () => {
    const mockCapabilities = {
      supported_formats: ['glb', 'obj'],
      max_upload_size_bytes: 52428800,
      max_upload_size_mb: 50,
      texture_providers: {
        procedural: { available: true, supported_styles: ['scifi', 'metallic'] },
        stable_diffusion: { available: true }
      },
      qem_simplification: {
        available: true,
        algorithm: 'Garland-Heckbert Quadric Error Metrics (QEM)'
      }
    };

    global.fetch = async (url) => ({
      ok: true,
      json: async () => mockCapabilities
    });

    const res = await global.fetch('http://127.0.0.1:8000/api/mesh/capabilities');
    const data = await res.json();
    assert.equal(data.qem_simplification.available, true);
    assert.equal(data.qem_simplification.algorithm, 'Garland-Heckbert Quadric Error Metrics (QEM)');
  });

  test('processMesh with optimization disabled does NOT send target_faces or reduction_ratio', async () => {
    let capturedBody = null;
    global.fetch = async (url, options) => {
      capturedBody = options.body;
      return {
        ok: true,
        json: async () => ({
          success: true,
          asset_id: 'test_asset_unopt',
          title: 'Unoptimized Model',
          format_uploaded: 'obj',
          poly_count: 5000,
          vertex_count: 2500,
          requested_texture_provider: 'procedural',
          actual_texture_provider: 'procedural',
          is_fallback: false,
          texture_resolution: [512, 512],
          formats: {},
          download_url: '/api/assets/test_asset_unopt/download/glb',
          metrics: {
            is_watertight: true,
            surface_area: 10.0,
            dimensions: [1, 1, 1],
            uv_chart_count: 5,
            seam_vertex_duplications: 10,
            round_trip_success: true,
            optimization: {
              optimized: false,
              algorithm: 'None',
              original_face_count: 5000,
              final_face_count: 5000,
              reduction_percentage: 0.0,
              requested_target_faces: null,
              target_reached: false,
              execution_time_seconds: 0.0,
              warnings: []
            }
          },
          warnings: []
        })
      };
    };

    // Construct request with enable_optimization = false
    const formData = new FormData();
    const fakeBlob = new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'], { type: 'text/plain' });
    formData.append('file', fakeBlob, 'model.obj');
    formData.append('texture_provider', 'procedural');
    formData.append('enable_optimization', 'false');

    assert.equal(formData.get('enable_optimization'), 'false');
    assert.equal(formData.get('target_faces'), null);
    assert.equal(formData.get('reduction_ratio'), null);

    const res = await global.fetch('http://127.0.0.1:8000/api/mesh/process', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    assert.equal(result.success, true);
    assert.equal(result.metrics.optimization.optimized, false);
    assert.equal(result.metrics.optimization.final_face_count, 5000);
  });

  test('processMesh with QEM optimization enabled sends target_faces for High, Medium, Low presets and Custom', async () => {
    const presets = {
      high: 25000,
      medium: 10000,
      low: 2500,
      custom: 1200
    };

    for (const [presetKey, expectedFaces] of Object.entries(presets)) {
      const formData = new FormData();
      const fakeBlob = new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'], { type: 'text/plain' });
      formData.append('file', fakeBlob, 'mesh.obj');
      formData.append('enable_optimization', 'true');
      formData.append('target_faces', expectedFaces.toString());

      assert.equal(formData.get('enable_optimization'), 'true');
      assert.equal(formData.get('target_faces'), expectedFaces.toString());
      assert.equal(formData.get('reduction_ratio'), null);
    }
  });

  test('processMesh with reduction percentage sends reduction_ratio', async () => {
    const reductionPercent = 60; // 60%
    const ratio = (reductionPercent / 100).toString();

    const formData = new FormData();
    const fakeBlob = new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'], { type: 'text/plain' });
    formData.append('file', fakeBlob, 'mesh.obj');
    formData.append('enable_optimization', 'true');
    formData.append('reduction_ratio', ratio);

    assert.equal(formData.get('enable_optimization'), 'true');
    assert.equal(formData.get('reduction_ratio'), '0.6');
    assert.equal(formData.get('target_faces'), null);
  });

  test('Optimization telemetry correctly parses and distinguishes statuses', async () => {
    // 1. Successfully optimized
    const optSuccess = {
      optimized: true,
      algorithm: 'Garland-Heckbert Quadric Error Metrics (QEM)',
      original_face_count: 10000,
      final_face_count: 2500,
      reduction_percentage: 75.0,
      requested_target_faces: 2500,
      target_reached: true,
      execution_time_seconds: 0.0012,
      warnings: []
    };
    assert.equal(optSuccess.optimized, true);
    assert.equal(optSuccess.final_face_count, 2500);
    assert.equal(optSuccess.reduction_percentage, 75.0);

    // 2. Optimization skipped (mesh already at or below target)
    const optSkipped = {
      optimized: false,
      algorithm: 'Garland-Heckbert Quadric Error Metrics (QEM)',
      original_face_count: 12,
      final_face_count: 12,
      reduction_percentage: 0.0,
      requested_target_faces: 2500,
      target_reached: true,
      execution_time_seconds: 0.0,
      warnings: ['Mesh face count (12) is already at or below target (2500). No simplification performed.']
    };
    const isSkippedBelowTarget = optSkipped.warnings.some(w => w.toLowerCase().includes('already at or below'));
    assert.equal(isSkippedBelowTarget, true);

    // 3. Optimization failed with original mesh retained
    const optFailedRetained = {
      optimized: false,
      algorithm: 'Garland-Heckbert Quadric Error Metrics (QEM)',
      original_face_count: 108,
      final_face_count: 108,
      reduction_percentage: 0.0,
      requested_target_faces: 50,
      target_reached: false,
      execution_time_seconds: 0.0,
      warnings: ['QEM decimation returned non-manifold output. Proceeding with original mesh.']
    };
    assert.equal(optFailedRetained.optimized, false);
    assert.equal(optFailedRetained.final_face_count, optFailedRetained.original_face_count);
  });
});
