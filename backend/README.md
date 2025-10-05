# NeuroDrive Helper – Backend

FastAPI backend that simplifies/summarizes text using Hugging Face (FLAN-T5) with chunking, retries, memo cache, and API-key auth.

## Run

1) Create and activate venv, install deps:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
