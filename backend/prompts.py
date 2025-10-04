def build_prompt_simplify(text: str, opts: dict) -> str:
    level = (opts or {}).get("reading_level", "8th grade")
    rules = (
        "Rewrite in clear, plain language for a "
        f"{level} reader. Use short sentences. Avoid jargon. "
        "Keep names, numbers, and facts unchanged. Preserve meaning."
    )
    return f"{rules}\n\nText:\n{text}\n\nSimplified:"

def build_prompt_summarize(text: str, opts: dict) -> str:
    bullets = (opts or {}).get("bullets", True)
    style = "as 4–7 concise bullet points" if bullets else "as a short single paragraph"
    rules = (
        f"Summarize {style}. Preserve key entities, numbers, and causal links. "
        "Be faithful; do not add new facts."
    )
    return f"{rules}\n\nText:\n{text}\n\nSummary:"
