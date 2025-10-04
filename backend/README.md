# NeuroDrive Helper – Backend

FastAPI backend that simplifies or summarizes selected text using Hugging Face (FLAN-T5), with in-memory caching and strict CORS.

## Setup

1. Python 3.10+ (3.11 recommended)
2. Create `.env` (fill values)
3. Install & run:
   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
