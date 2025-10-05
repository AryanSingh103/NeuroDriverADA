# prompts.py
from __future__ import annotations
from typing import List, Optional
from schemas import ProcessOptions

def _is_t5_family(models: List[str]) -> bool:
    m = " ".join(models).lower()
    return "t5" in m  # catches t5-, flan-t5, etc.

def make_prompt(
    mode: str,
    text: str,
    opts: Optional[ProcessOptions],
    preferred_models: Optional[List[str]] = None,
) -> str:
    level = (opts.reading_level or "8th grade").lower() if opts else "8th grade"
    bullets = bool(opts and opts.bullets)
    audience = (opts.audience or "general").lower()
    use_t5_prefix = _is_t5_family(preferred_models or [])

    if mode == "simplify":
        if use_t5_prefix:
            return f"paraphrase: simplify for {level} and {audience}. {'Use bullet points.' if bullets else 'Use short sentences.'} {text}"
        return (
            f"Simplify the following text for a {level} reader and a {audience} audience. "
            f"Use short, concrete sentences and plain words. "
            f"{'Output concise bullet points.' if bullets else 'Output a short paragraph.'}\n\n"
            f"Text:\n{text}"
        )

    if mode == "analyze":
        if use_t5_prefix:
            return (
                f"summarize: {text}\n\n"
                f"Then provide 2-3 study tips for attention support at a {level} level for a {audience} audience."
                f"{' Use bullet points.' if bullets else ' Use a short paragraph.'}"
            )
        return (
            f"Summarize the key points for a {level} reader and a {audience} audience. "
            f"Then add 2-3 focus-friendly study tips. "
            f"{'Use bullet points.' if bullets else 'Use a short paragraph.'}\n\n"
            f"Text:\n{text}"
        )

    # summarize
    if use_t5_prefix:
        return f"summarize: {text} {' Use bullet points.' if bullets else ' Use 3-4 clear sentences.'}"
    return (
        f"Summarize the following text for a {level} reader and a {audience} audience. "
        f"{'Use bullet points.' if bullets else 'Use 3-4 clear sentences.'}\n\n"
        f"Text:\n{text}"
    )
