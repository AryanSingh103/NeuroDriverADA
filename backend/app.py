import os
import orjson
from typing import List
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseSettings
from schemas import ProcessIn, ProcessOut
from prompts import build_prompt_simplify, build_prompt_summarize
from hf_client import hf_text_to_text, HFError
from utils import strip_html, chunk_text, cache_key, postprocess_summary

class Settings(BaseSettings):
    API_KEY: str
    HF_API_KEY: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    SIMPLIFIER_MODEL: str = "google/flan-t5-base"
    SUMMARIZER_MODEL: str = "google/flan-t5-base"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    HF_TIMEOUT: int = 30
    HF_RETRIES: int = 3
    MAX_BODY_BYTES: int = 102400
    CHUNK_SIZE: int = 3000
    LOG_LEVEL: str = "info"

    class Config:
        env_file = ".env"

settings = Settings()
app = FastAPI(title="NeuroDrive Helper API", version="0.1.0")

allowed = [s.strip() for s in settings.ALLOWED_ORIGINS.split(",") if s.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache (mode+text+opts hash -> output/model)
CACHE = {}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/process", response_model=ProcessOut)
async def process(payload: ProcessIn, request: Request, x_api_key: str = Header(default="")):
    # Auth
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Size guard (raw body)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Payload too large")

    # Sanitize/normalize
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    if "<" in text and ">" in text:
        # likely innerHTML pasted; sanitize
        text = strip_html(text)

    opts = payload.options or {}

    # Cache
    k = cache_key(payload.mode, text, opts)
    if k in CACHE:
        hit = CACHE[k]
        return ProcessOut(output=hit["output"], model=hit["model"], cached=True)

    # Chunking
    chunks = chunk_text(text, max_chars=settings.CHUNK_SIZE)
    outs: List[str] = []

    try:
        if payload.mode == "simplify":
            model = settings.SIMPLIFIER_MODEL
            for c in chunks:
                prompt = build_prompt_simplify(c, opts)
                gen = await hf_text_to_text(model, prompt, max_new_tokens=400)
                # Strip leading "Simplified:" if model echoes it
                outs.append(gen.replace("Simplified:", "").strip())
            final = "\n\n".join(outs)
        else:  # summarize
            model = settings.SUMMARIZER_MODEL
            bullets = bool(opts.get("bullets", True))
            for c in chunks:
                prompt = build_prompt_summarize(c, opts)
                gen = await hf_text_to_text(model, prompt, max_new_tokens=220)
                clean = gen.replace("Summary:", "").strip()
                outs.append(postprocess_summary(clean, bullets))
            final = "\n".join(outs)
    except HFError as e:
        raise HTTPException(status_code=502, detail=f"Hugging Face error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {e}")

    CACHE[k] = {"output": final, "model": model}
    return ProcessOut(output=final, model=model, cached=False, chunks=chunks if len(chunks) > 1 else None)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level=settings.LOG_LEVEL)