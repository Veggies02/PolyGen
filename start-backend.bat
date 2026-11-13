@echo off
echo ============================================================
echo Starting PolyGen FastAPI Backend...
echo ============================================================
cd /d "%~dp0backend"
set PYTHONPATH=.
..\backend\.venv\Scripts\python.exe run.py
pause
