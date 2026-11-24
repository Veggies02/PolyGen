"""Shap-E GPU server for PolyGen. Runs in Google Colab, not on the backend machine.

Usage in Colab (T4 GPU):
  1. Install and load the models (shap-e install cell, then the load_model cell), so these
     names exist: xm, model, diffusion, sample_latents, decode_latent_mesh.
  2. Paste this file into a cell and run it.
  3. Expose port 8000 with ngrok (key in Colab Secrets as NGROK_TOKEN), then put the URL and
     the printed TOKEN into backend/.env as SHAPE_REMOTE_URL and SHAPE_API_TOKEN.
Never commit the URL or token.
"""
import random, threading, secrets, torch, uvicorn
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

TOKEN = secrets.token_urlsafe(16)
app = FastAPI()
gpu_lock = threading.Lock()


class Req(BaseModel):
    prompt: str
    seed: Optional[int] = None
    steps: int = 64
    guidance_scale: float = 15.0


@app.get("/health")
def health():
    return {"status": "ok", "gpu": torch.cuda.get_device_name(0)}


@app.post("/generate")
def generate(req: Req, x_api_token: str = Header(None)):
    if x_api_token != TOKEN:
        raise HTTPException(401, "bad token")
    with gpu_lock:
        seed = req.seed if req.seed is not None else random.randint(0, 2**31 - 1)
        torch.manual_seed(seed)
        latents = sample_latents(
            batch_size=1, model=model, diffusion=diffusion,
            guidance_scale=req.guidance_scale,
            model_kwargs=dict(texts=[req.prompt]), progress=False,
            clip_denoised=True, use_fp16=True, use_karras=True,
            karras_steps=req.steps, sigma_min=1e-3, sigma_max=160, s_churn=0,
        )
        mesh = decode_latent_mesh(xm, latents[0]).tri_mesh()
        with open("/content/_tmp.obj", "w") as f:
            mesh.write_obj(f)
        obj = open("/content/_tmp.obj").read()
    return {"obj": obj, "vertices": len(mesh.verts), "faces": len(mesh.faces), "seed": seed}


server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning"))
threading.Thread(target=server.run, daemon=True).start()
print("Server started")