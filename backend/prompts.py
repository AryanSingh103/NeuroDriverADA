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
        # Generate a neurodiverse accessibility report
        prompt = f"""Analyze this text for accessibility and create a report with these sections:

READING LEVEL: Estimate grade level (e.g., "10th grade") and recommend simpler level if needed
COMPLEXITY: Rate 1-10 and note if text is dense or clear
TIME TO READ: Estimate in minutes

ATTENTION POINTS (for ADHD readers):
- List long sentences (>25 words)
- Note complex jargon or medical terms
- Suggest which sections to simplify

STRENGTHS:
- What makes this text accessible
- Good formatting or structure

KEY TAKEAWAYS:
- List 3-5 main points in simple language

MAIN ACTION:
- What does this page want the reader to know or do?

Text to analyze:
{text}

Generate the accessibility report:"""
        
        if use_t5_prefix:
            # T5 models need simpler prompts
            return f"summarize: {text}"
        
        return prompt

    # summarize
    if use_t5_prefix:
        return f"summarize: {text}"
    # BART is pre-trained for summarization - just give it the text
    return text
