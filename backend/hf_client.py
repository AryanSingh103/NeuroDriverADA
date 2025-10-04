import os
import httpx
import asyncio
from typing import Any, Dict

HF_API_KEY = os.getenv("HF_API_KEY", "")
HF_TIMEOUT = float(os.getenv("HF_TIMEOUT", "30"))
HF_RETRIES = int(os.getenv("HF_RETRIES", "3"))

class HFError(RuntimeError):
    pass

async def hf_text_to_text(model: str, prompt: str, max_new_tokens: int = 256) -> str:
    if not HF_API_KEY:
        raise HFError("HF_API_KEY not set")
    url = f"https://api-inference.huggingface.co/models/{model}"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload: Dict[str, Any] = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": max_new_tokens}
    }
    for attempt in range(HF_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=HF_TIMEOUT) as client:
                r = await client.post(url, headers=headers, json=payload)
                # Handle warmup 503 explicitly by retrying
                if r.status_code == 503:
                    await asyncio.sleep(1.0 + attempt)
                    continue
                r.raise_for_status()
                data = r.json()
                if isinstance(data, list) and data and "generated_text" in data[0]:
                    return data[0]["generated_text"]
                if isinstance(data, dict) and "error" in data:
                    # model warming or other issue; retry
                    await asyncio.sleep(1.0 + attempt)
                    continue
                # Fallback: stringify
                return str(data)
        except httpx.HTTPError:
            await asyncio.sleep(1.0 + attempt)
    raise HFError("HF API failed after retries")
