"""
ExcelIQ Python Microservice — FastAPI
Handles VBA macro extraction (requires oletools).
Deploy separately on Railway/Render, or run locally.
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import tempfile, os
from parser import extract_vba_modules

app = FastAPI(title="ExcelIQ Parser", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract-vba")
async def extract_vba(file: UploadFile = File(...)):
    """
    Accepts an .xlsm file upload.
    Returns a list of VBA module names + their code.
    """
    with tempfile.NamedTemporaryFile(suffix='.xlsm', delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        modules = extract_vba_modules(tmp_path)
        return JSONResponse(content={"modules": modules})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        os.unlink(tmp_path)
