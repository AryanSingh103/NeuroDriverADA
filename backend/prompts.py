# prompts.py
from __future__ import annotations
from typing import List, Optional
from backend.schemas import ProcessOptions

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
            return f"paraphrase: {text}"
        # Pegasus paraphrase works best with just the text
        return text

    if mode == "analyze":
        # For T5 models, use simple summarize
        if use_t5_prefix:
            return f"summarize: {text}"
        
        # For BART models, use minimal prompt - they work better with less instruction
        prompt = f"""Create an accessibility report for neurodiverse readers:

READING LEVEL: [Grade level and recommendation]
COMPLEXITY: [Score 1-10 and explanation]
TIME TO READ: [Minutes]
ATTENTION POINTS: [Long sentences or difficult terms for ADHD readers]
DYSLEXIA NOTES: [Difficult words or formatting issues]
STRENGTHS: [What's accessible about this text]
KEY POINTS: [3-5 main takeaways]
MAIN ACTION: [What should readers know or do]

Text:
{text}"""
        
        return prompt

    # summarize
    if use_t5_prefix:
        return f"summarize: {text}"
    # BART is pre-trained for summarization - just give it the text
    return text
