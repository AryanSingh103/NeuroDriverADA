import hashlib
import html
import re
import json
from typing import List

def strip_html(text: str) -> str:
    # Remove tags and decode entities; keep text content only.
    # Quick-and-safe for typical pasted HTML.
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    # Collapse whitespace
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text: str, max_chars: int = 3000) -> List[str]:
    text = text.strip()
    if not text:
        return [""]
    return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]

def cache_key(mode: str, text: str, options: dict) -> str:
    blob = json.dumps({"m": mode, "t": text, "o": options or {}}, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()

def postprocess_summary(output: str, bullets: bool) -> str:
    out = output.strip()
    if bullets:
        # Ensure each line is a bullet if the model returned newlines
        lines = [l.strip("•- \t") for l in out.splitlines() if l.strip()]
        if len(lines) >= 2:
            return "\n".join(f"• {l}" for l in lines)
    return out
