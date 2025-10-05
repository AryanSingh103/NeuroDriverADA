# hf_client.py
from __future__ import annotations

import time
from typing import List, Optional, Tuple

import requests
from fastapi import HTTPException

HF_API_BASE = "https://api-inference.huggingface.co/models"

def _try_once(model: str, prompt: str, timeout: int, api_key: str) -> Tuple[Optional[str], Optional[str]]:
    url = f"{HF_API_BASE}/{model}"
    payload = {"inputs": prompt}
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=timeout)
    except Exception as e:
        return None, f"request error: {e}"

    if r.status_code == 503:
        return None, "503"  # cold start; retry
    if r.status_code == 404:
        return None, "404"  # not found; next model
    if not r.ok:
        return None, f"{r.status_code} {r.text}"

    try:
        data = r.json()
    except Exception as e:
        return None, f"json error: {e}"

    # normalize response
    if isinstance(data, list) and data:
        item = data[0]
        if isinstance(item, dict):
            if "generated_text" in item:
                return item["generated_text"], None
            if "summary_text" in item:
                return item["summary_text"], None
        return str(item), None
    if isinstance(data, dict):
        for k in ("generated_text", "summary_text", "text"):
            if k in data and isinstance(data[k], str):
                return data[k], None
    return str(data), None

def call_hf(*, models: List[str], prompt: str, api_key: str, timeout: int = 30, retries: int = 3) -> Tuple[str, str]:
    """
    Try each model. Retry on 503 (cold) with small backoff. Skip immediately on 404.
    Returns (output_text, model_used). Raises HTTPException(502) if all fail.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="HF_API_KEY not configured")
    
    last_err: Optional[str] = None

    for model in models:
        for attempt in range(1, retries + 1):
            text, err = _try_once(model, prompt, timeout, api_key)
            if text is not None:
                return text, model
            if err == "503":
                time.sleep(min(2 * attempt, 6))
                last_err = f"{model}: 503 (cold)"
                continue
            if err == "404":
                last_err = f"{model}: 404 (not found)"
                break
            last_err = f"{model}: {err}"
            time.sleep(min(1.5 * attempt, 4))

    raise HTTPException(status_code=502, detail=f"Hugging Face error: {last_err or 'all models failed'}")
