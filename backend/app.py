# app.py
from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------- Load environment ---------- #
load_dotenv()

API_KEY = os.getenv("API_KEY")  # shared secret with the extension
HF_API_KEY = os.getenv("HF_API_KEY")
ALLOWED_ORIGINS = (os.getenv("ALLOWED_ORIGINS") or "").split(",")

SIMPLIFIER_MODEL = os.getenv("SIMPLIFIER_MODEL", "google/flan-t5-base")
SUMMARIZER_MODEL = os.getenv("SUMMARIZER_MODEL", "google/flan-t5-base")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

HF_TIMEOUT = int(os.getenv("HF_TIMEOUT", "30"))
HF_RETRIES = int(os.getenv("HF_RETRIES", "3"))

MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", "102400"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "3000"))

LOG_LEVEL = os.getenv("LOG_LEVEL", "info")


# ---------- FastAPI app ---------- #
app = FastAPI(title="NeuroDrive Helper API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ---------- #
class ProcessOptions(BaseModel):
    reading_level: Optional[str] = Field(default=None)
    bullets: Optional[bool] = Field(default=None)
    audience: Optional[str] = Field(default=None)


class ProcessRequest(BaseModel):
    mode: str = Field(pattern="^(simplify|summarize|analyze)$")
    text: str
    options: Optional[ProcessOptions] = None


class ProcessResponse(BaseModel):
    output: str
    simplify: Optional[str] = None
    summarize: Optional[str] = None
    analyze: Optional[str] = None
    model: str
    tokens: Optional[int] = None
    chunks: Optional[int] = None
    cached: Optional[bool] = None


# ---------- Auth dependency ---------- #
def require_api_key(request: Request):
    header_key = request.headers.get("x-api-key")
    if not API_KEY:
        # developer misconfig—fail loudly
        raise HTTPException(status_code=500, detail="Server misconfigured: API_KEY not set")
    if header_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------- Helpers ---------- #
def _hf_headers() -> Dict[str, str]:
    if not HF_API_KEY:
        raise HTTPException(status_code=502, detail="Hugging Face error: HF_API_KEY not set")
    return {"Authorization": f"Bearer {HF_API_KEY}"}


def _hf_url(model: str) -> str:
    return f"https://api-inference.huggingface.co/models/{model}"


def call_hf(model: str, prompt: str, timeout: int = HF_TIMEOUT, retries: int = HF_RETRIES) -> str:
    """
    Calls HF Inference API with a text2text model (e.g., FLAN-T5) and returns string output.
    We use the generic "inputs" schema. FLAN-T5 returns [{"generated_text": "..."}] or similar.
    """
    payload = {"inputs": prompt}
    headers = _hf_headers()
    url = _hf_url(model)

    last_err: Optional[str] = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=timeout)
            if r.status_code == 503:
                # model cold; HF returns queue info — backoff then retry
                time.sleep(min(2 * attempt, 6))
                last_err = r.text
                continue
            if not r.ok:
                raise HTTPException(status_code=502, detail=f"Hugging Face error: {r.text}")

            data = r.json()
            # HF response shapes vary; handle common ones
            if isinstance(data, list) and data:
                # flan-t5 on Inference API often returns [{"generated_text": "..."}]
                item = data[0]
                if isinstance(item, dict):
                    if "generated_text" in item:
                        return item["generated_text"]
                    # some summarizers return {"summary_text": "..."}
                    if "summary_text" in item:
                        return item["summary_text"]
                # Fallback: stringify
                return str(item)
            # If it’s a dict or something else:
            if isinstance(data, dict):
                # try common keys
                for k in ("generated_text", "summary_text", "text"):
                    if k in data and isinstance(data[k], str):
                        return data[k]
            return str(data)
        except HTTPException:
            raise
        except Exception as e:
            last_err = str(e)
            time.sleep(min(2 * attempt, 6))

    raise HTTPException(status_code=502, detail=f"Hugging Face error: {last_err or 'unknown'}")


def chunk_text(s: str, size: int = CHUNK_SIZE) -> List[str]:
    s = s.strip()
    if len(s) <= size:
        return [s]
    chunks: List[str] = []
    i = 0
    while i < len(s):
        j = min(i + size, len(s))
        # try to break on a sentence boundary
        cut = s[i:j]
        if j < len(s):
            period = cut.rfind(". ")
            if period > size // 2:
                j = i + period + 1
                cut = s[i:j]
        chunks.append(cut)
        i = j
    return chunks


def instruct_prompt(mode: str, txt: str, opts: ProcessOptions | None) -> str:
    lvl = (opts.reading_level or "8th grade").lower() if opts else "8th grade"
    bullets = bool(opts and opts.bullets)
    audience = (opts.audience or "general").lower()

    if mode == "simplify":
        return (
            f"Simplify the following text for a {lvl} reader and a {audience} audience. "
            f"Use short, clear sentences. {'Return concise bullet points.' if bullets else 'Return a short paragraph.'}\n\n"
            f"Text:\n{txt}"
        )
    # summarize & analyze both return a summary; analyze can add study cues
    if mode == "analyze":
        return (
            f"Summarize the key points for a {lvl} reader and a {audience} audience. "
            f"Then add 2-3 study tips tailored for attention support. {'Use bullet points.' if bullets else 'Use a short paragraph.'}\n\n"
            f"Text:\n{txt}"
        )
    # default summarize
    return (
        f"Summarize the following text for a {lvl} reader and a {audience} audience. "
        f"{'Use bullet points.' if bullets else 'Use 3-4 sentences.'}\n\n"
        f"Text:\n{txt}"
    )


# ---------- Routes ---------- #
@app.get("/health")
def health():
    return {
        "ok": True,
        "hf_key": "present" if bool(HF_API_KEY) else "missing",
        "models": {"simplifier": SIMPLIFIER_MODEL, "summarizer": SUMMARIZER_MODEL},
        "cors": ALLOWED_ORIGINS,
    }


@app.post("/process", response_model=ProcessResponse, dependencies=[Depends(require_api_key)])
async def process(req: ProcessRequest) -> ProcessResponse:
    # quick size guard (optional)
    body_bytes = len((req.text or "").encode("utf-8"))
    if MAX_BODY_BYTES and body_bytes > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail=f"Payload too large ({body_bytes} bytes)")

    # choose model by mode
    if req.mode == "simplify":
        model = SIMPLIFIER_MODEL
    elif req.mode == "summarize":
        model = SUMMARIZER_MODEL
    else:  # analyze -> summarize then add tips (same model is fine)
        model = SUMMARIZER_MODEL

    # chunking for long inputs
    pieces = chunk_text(req.text, CHUNK_SIZE)
    outputs: List[str] = []
    for p in pieces:
        prompt = instruct_prompt(req.mode, p, req.options)
        out = call_hf(model, prompt)
        outputs.append(out.strip())

    joined = ("\n\n".join(outputs)).strip()

    # shape response for the extension overlay
    resp: Dict[str, Any] = {
        "output": joined,
        "model": model,
        "tokens": None,     # you can fill if you track usage
        "chunks": len(pieces),
    }
    # also set the mode-specific key so tabs/overlay can pick it
    resp[req.mode] = joined

    return ProcessResponse(**resp)
