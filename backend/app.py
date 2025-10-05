# app.py
from __future__ import annotations

import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware

from schemas import ProcessOptions, ProcessRequest, ProcessResponse
from hf_client import call_hf
from utils import chunk_text, memoize_response
from prompts import make_prompt

# Load environment variables from .env file
load_dotenv()

# ======= HARD-CODED CONFIG (from your message) =======

API_KEY = "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9"
HF_API_KEY = os.getenv("HF_API_KEY", "")  # Load from environment

ALLOWED_ORIGINS = [
    "chrome-extension://eeblnbclbapkecjljnlfjgcfhcikhhgk",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

SIMPLIFIER_MODEL = "google/flan-t5-base"
SUMMARIZER_MODEL = "google/flan-t5-base"

HF_TIMEOUT = 30
HF_RETRIES = 3

MAX_BODY_BYTES = 102_400
CHUNK_SIZE = 3_000

# ======= APP =======
app = FastAPI(title="NeuroDrive Helper API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*", "x-api-key", "content-type"],
    expose_headers=["*"],
    max_age=600,
)

def require_api_key(request: Request):
    header_key = request.headers.get("x-api-key")
    if header_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {"simplifier": SIMPLIFIER_MODEL, "summarizer": SUMMARIZER_MODEL},
        "cors": ALLOWED_ORIGINS,
    }

@app.post("/process", response_model=ProcessResponse, dependencies=[Depends(require_api_key)])
async def process(req: ProcessRequest) -> ProcessResponse:
    # guard size
    body_bytes = len((req.text or "").encode("utf-8"))
    if MAX_BODY_BYTES and body_bytes > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail=f"Payload too large ({body_bytes} bytes)")

    # model preference list with robust fallbacks (handles HF 404)
        if req.mode == "simplify":
            # Allow an optional model override from the incoming options
            model_candidates: List[str] = [
                opts.get("model") or opts.get("simplifier_model") or SIMPLIFIER_MODEL,
                "t5-base",                 # widely available text2text
                "google/flan-t5-base",     # explicit retry
                "google/flan-t5-small",
            ]
    else:  # summarize / analyze
        model_candidates = [
            SUMMARIZER_MODEL,                 # your choice (FLAN-T5)
            "facebook/bart-large-cnn",        # reliable summarizer
            "sshleifer/distilbart-cnn-12-6",  # lighter summarizer
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
