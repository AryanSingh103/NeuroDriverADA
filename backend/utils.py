# utils.py
from __future__ import annotations
import hashlib
import json
from typing import Any, Dict, List, Optional

def chunk_text(s: str, size: int) -> List[str]:
    s = (s or "").strip()
    if len(s) <= size:
        return [s]
    out: List[str] = []
    i = 0
    while i < len(s):
        j = min(i + size, len(s))
        cut = s[i:j]
        if j < len(s):
            dot = cut.rfind(". ")
            if dot >= int(size * 0.5):
                j = i + dot + 1
                cut = s[i:j]
        out.append(cut)
        i = j
    return out

class _Memo:
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def make_key(mode: str, text: str, options: Optional[Dict[str, Any]]) -> str:
        blob = json.dumps({"m": mode, "t": text, "o": options}, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        return self._store.get(key)

    def set(self, key: str, value: Dict[str, Any]) -> None:
        self._store[key] = value

memoize_response = _Memo()
