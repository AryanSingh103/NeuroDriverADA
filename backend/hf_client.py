import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env (if present)
load_dotenv()

HF_API_KEY = os.getenv("HF_API_KEY")

if not HF_API_KEY:
    raise RuntimeError("❌ HF_API_KEY not set. Please create a .env file or export it in your shell.")

HEADERS = {"Authorization": f"Bearer {HF_API_KEY}"}


def query_huggingface(model: str, inputs: str, task: str = "text-generation", **kwargs):
    """
    Calls the Hugging Face Inference API with the given model and input text.
    Returns JSON response or raises RuntimeError on failure.
    """
    url = f"https://api-inference.huggingface.co/models/{model}"

    payload = {"inputs": inputs}
    payload.update(kwargs)

    response = requests.post(url, headers=HEADERS, json=payload, timeout=30)

    if not response.ok:
        raise RuntimeError(f"Hugging Face API error {response.status_code}: {response.text}")

    return response.json()
