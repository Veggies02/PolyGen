@echo off
echo Starting PolyGen Full-Stack Application...
start "PolyGen Backend (FastAPI)" cmd /c "%~dp0start-backend.bat"
start "PolyGen Frontend (Vite)" cmd /c "%~dp0start-frontend.bat"
echo PolyGen launched! Backend: http://127.0.0.1:8000 | Frontend: http://localhost:5173
