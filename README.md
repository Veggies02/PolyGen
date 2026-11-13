# PolyGen — Generative Text-to-3D Asset Pipeline

<p align="center">
  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80" alt="PolyGen 3D Studio" width="100%" style="border-radius: 12px; max-height: 380px; object-fit: cover;" />
</p>

PolyGen is a production-grade full-stack 3D generative asset studio. It connects prompt engineering, real-time procedural and neural 3D synthesis, interactive Three.js viewport inspection, and multi-format CAD/mesh exports (`GLB`, `OBJ`, `STL`).

Inspired by professional 3D tools (Blender, Mixar, Cargo by KitBash3D, and Tripo AI), PolyGen provides a deep charcoal workspace with topology telemetry, custom studio lighting rigs, turntable inspection, and a modular AI model provider interface.

---

## 🌟 Key Architecture & Highlights

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **3D Viewport**: Native Three.js with ACES Filmic tone mapping, OrbitControls turntable, dual-tier ground grid, custom studio/cyberpunk lighting rigs, wireframe toggles, and shading modes (PBR, Clay Matte, Normals, Wireframe).
- **Backend**: Python 3.14 + FastAPI + Pydantic v2 + Uvicorn with asynchronous background job state machines.
- **Genuine 3D File Generation**: Unlike static prototypes with fake mock buttons, PolyGen contains a local procedural synthesis core that compiles actual, binary-compliant `glTF 2.0` (`.glb`), Wavefront (`.obj`), and stereolithography (`.stl`) files with real vertices, normals, and face indices.
- **Modular Model Provider Layer**: Ready for external AI engines (e.g. Tripo3D, Meshy, Shap-E). PolyGen runs in **Explicit Demo Mode** by default so you never spend money or hit quota limits blindly.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- **Node.js** (v18+) & **npm**
- **Python** (3.10+)

### 1. Start with Launcher Scripts (Windows)
Double-click `start.bat` in the project root, or launch backend and frontend individually:
- **Backend**: double-click `start-backend.bat` (runs FastAPI at `http://127.0.0.1:8000`)
- **Frontend**: double-click `start-frontend.bat` (runs Vite at `http://localhost:5173`)

### 2. Manual Terminal Commands

#### Backend:
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```
The FastAPI documentation will be live at `http://127.0.0.1:8000/docs`.

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing the Pipeline

### Backend Pytest Suite
Run the 6 comprehensive async API and geometry test cases:
```bash
cd backend
# Windows:
$env:PYTHONPATH="."
..\backend\.venv\Scripts\pytest.exe tests/test_api.py -v

# macOS/Linux:
PYTHONPATH=. pytest tests/test_api.py -v
```

Tests verify:
1. `test_health`: System status and asset registry availability.
2. `test_list_providers`: Ensures demo provider is configured and available without API keys.
3. `test_list_and_download_assets`: Validates real binary headers (`glTF`, `v`, binary `STL`).
4. `test_enhance_prompt`: Tests heuristic style and PBR token expansion.
5. `test_generate_job_lifecycle`: Full asynchronous job queue, progress callbacks, and asset creation.
6. `test_stats`: Dynamic KPI counters and storage metric aggregations.

### Frontend Typecheck & Production Build
```bash
cd frontend
npm run build
```

---

## 🧩 AI Model Provider System

PolyGen abstracts 3D generation into `Base3DProvider`:

```
backend/app/providers/
├── base.py           # Abstract Base Class
├── demo_provider.py   # PolyGen Local Procedural Core (Active by default)
├── tripo_provider.py  # Tripo3D Cloud API Provider
└── meshy_provider.py  # Meshy.ai Text-to-3D Provider
```

### Adding Real Cloud AI API Keys
Copy `.env.example` to `.env` and supply your credentials when you are ready to connect a paid API:
```ini
POLYGEN_HOST=127.0.0.1
POLYGEN_PORT=8000
POLYGEN_DEFAULT_PROVIDER=demo

# Optional Production Text-to-3D APIs:
TRIPO_API_KEY=your_tripo_api_key_here
MESHY_API_KEY=your_meshy_api_key_here
```
When configured, the providers automatically flip from `Key Required` to `Ready` in the UI without restarting the application.

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check, active version & total assets |
| `GET` | `/api/stats` | KPI metrics (storage, active jobs, providers) |
| `GET` | `/api/providers` | Registered AI providers and configuration status |
| `POST` | `/api/generate` | Submit text-to-3D generation job |
| `GET` | `/api/generate/jobs` | List recent generation jobs |
| `GET` | `/api/generate/jobs/{id}` | Poll generation job progress and stage |
| `POST` | `/api/generate/enhance-prompt` | Enhance prompt with PBR and lighting modifiers |
| `GET` | `/api/assets` | Query generated assets (supports `?tag=` and `?search=`) |
| `GET` | `/api/assets/{id}` | Inspect asset geometry metadata |
| `GET` | `/api/assets/{id}/download/{fmt}` | Stream `.glb`, `.obj`, or `.stl` binary files |

---

## 🎨 UI Features

1. **Dashboard**:
   - Executive telemetry: Total assets, pipeline status, storage volume, connected engines.
   - Quick launch generation portal.
   - Model provider status cards highlighting Demo Mode vs. Cloud engines.
   - Recent generation cards with one-click "Inspect in 3D Studio" or quick GLB download.
2. **Text-to-3D Studio**:
   - High-contrast prompt editor with "Enhance Prompt" AI assistant.
   - Inspiration chips (Stealth Recon Drone, Obsidian Monolith, Exo Combat Helmet, Kinetic Gyroscope).
   - Negative prompt expansion.
   - Pipeline settings: Model Provider selection, Aesthetic presets, Polygon budget targets (Low 5k, Mid 25k, High 60k), Bilateral symmetry toggle, Deterministic seed input.
   - Real-time 4-stage synthesis progress dialog (Prompt semantics $\to$ Geometry $\to$ Topology $\to$ Material baking).
3. **Interactive 3D Viewport**:
   - Real-time Three.js canvas with smooth OrbitControls turntable and zoom clamping.
   - Shading modes: **PBR Metallic**, **Clay Matte**, **Normal Vectors**, and **Cyber Wireframe**.
   - Dual-tier cyan/slate coordinate ground grid.
   - 4 Lighting environments: **Studio Neutral**, **Cyberpunk Neon**, **Dramatic Key**, **Soft Ambient**.
   - Turntable 360° auto-rotation.
   - Live geometry telemetry: Polygon count, vertex count, dimensions ($X \times Y \times Z$), and active materials.
   - Asset quick-switch carousel bar.
4. **Asset Gallery**:
   - Filter by tag chips or full-text search across titles and prompts.
   - Detailed asset inspection modal with direct downloads for `.GLB`, `.OBJ`, and `.STL`.
