# schemas.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

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
    model: Optional[str] = None
    tokens: Optional[int] = None
    chunks: Optional[int] = None
    cached: Optional[bool] = None
    prompt: Optional[str] = None  # The prompt sent to the AI model
    model: str
    tokens: Optional[int] = None
    chunks: Optional[int] = None
    cached: Optional[bool] = None
