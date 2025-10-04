from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any

class ProcessIn(BaseModel):
    mode: Literal["simplify", "summarize"]
    text: str = Field(min_length=1, max_length=200000)  # app will also enforce MAX_BODY_BYTES
    options: Optional[Dict[str, Any]] = None  # e.g. {"reading_level":"8th grade","bullets":True}

class ProcessOut(BaseModel):
    output: str
    model: str
    cached: bool = False
    chunks: Optional[List[str]] = None
