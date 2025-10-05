# app.py
from __future__ import annotations

import os
from typing import Any, Dict, List
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from schemas import ProcessOptions, ProcessRequest, ProcessResponse
from hf_client import call_hf
from utils import chunk_text, memoize_response
from prompts import make_prompt

# Load environment variables from .env file
load_dotenv()

# ======= HARD-CODED CONFIG (from your message) =======

API_KEY = "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9"
HF_API_KEY = os.getenv("HF_API_KEY", "")  # Load from environment
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")  # ElevenLabs API key

ALLOWED_ORIGINS = [
    "chrome-extension://eeblnbclbapkecjljnlfjgcfhcikhhgk",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

SIMPLIFIER_MODEL = os.getenv("SIMPLIFIER_MODEL", "google/flan-t5-base")
SUMMARIZER_MODEL = os.getenv("SUMMARIZER_MODEL", "google/flan-t5-base")

HF_TIMEOUT = 30
HF_RETRIES = 3

MAX_BODY_BYTES = 102_400
CHUNK_SIZE = 3_000

# ======= APP =======
app = FastAPI(title="NeuroDrive Helper API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for extension to work on any website
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

def require_api_key(request: Request):
    # Skip authentication for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        return
    header_key = request.headers.get("x-api-key")
    if header_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# Schema for TTS request
class TTSRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice (default)

@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {"simplifier": SIMPLIFIER_MODEL, "summarizer": SUMMARIZER_MODEL},
        "cors": ALLOWED_ORIGINS,
        "elevenlabs": bool(ELEVENLABS_API_KEY),
    }

@app.options("/tts")
async def tts_options():
    """Handle CORS preflight for TTS endpoint"""
    return {"ok": True}

@app.post("/tts", dependencies=[Depends(require_api_key)])
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech using ElevenLabs API.
    Returns audio/mpeg stream.
    """
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    try:
        from elevenlabs.client import ElevenLabs
        
        # Initialize ElevenLabs client
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        
        # Generate audio using ElevenLabs
        audio = client.generate(
            text=req.text,
            voice=req.voice_id,
            model="eleven_monolingual_v1"  # Fast and efficient
        )
        
        # Convert generator to bytes
        audio_bytes = b"".join(audio)
        
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs error: {str(e)}")

@app.post("/process", response_model=ProcessResponse, dependencies=[Depends(require_api_key)])
async def process(req: ProcessRequest) -> ProcessResponse:
    # guard size
    body_bytes = len((req.text or "").encode("utf-8"))
    if MAX_BODY_BYTES and body_bytes > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail=f"Payload too large ({body_bytes} bytes)")

    # model preference list with robust fallbacks (handles HF 404)
    if req.mode == "simplify":
        model_candidates: List[str] = [
            SIMPLIFIER_MODEL,                 # tuner007/pegasus_paraphrase
            "sshleifer/distilbart-cnn-12-6",  # Lighter/faster fallback
        ]
    else:  # summarize / analyze
        model_candidates = [
            SUMMARIZER_MODEL,                 # facebook/bart-large-cnn
            "sshleifer/distilbart-cnn-12-6",  # Lighter/faster fallback
        ]

    # simple per-process memo
    cache_key = memoize_response.make_key(
        req.mode, req.text, req.options.dict() if req.options else None
    )
    cached = memoize_response.get(cache_key)
    if cached is not None:
        return ProcessResponse(**cached, cached=True)

    pieces = chunk_text(req.text, CHUNK_SIZE)
    outputs: List[str] = []
    actual_model_used: str | None = None
    first_prompt: str | None = None  # Store the first prompt for debugging

    for p in pieces:
        prompt = make_prompt(req.mode, p, req.options, preferred_models=model_candidates)
        if first_prompt is None:
            first_prompt = prompt  # Save the first prompt
        out, used = call_hf(
            models=model_candidates,
            prompt=prompt,
            api_key=HF_API_KEY,
            timeout=HF_TIMEOUT,
            retries=HF_RETRIES,
        )
        actual_model_used = actual_model_used or used
        outputs.append(out.strip())

    joined = ("\n\n".join(outputs)).strip()

    payload: Dict[str, Any] = {
        "output": joined,
        "model": actual_model_used or model_candidates[0],
        "tokens": None,
        "chunks": len(pieces),
        "prompt": first_prompt,  # Include the prompt in the response
    }
    payload[req.mode] = joined

    memoize_response.set(cache_key, payload)
    return ProcessResponse(**payload)
