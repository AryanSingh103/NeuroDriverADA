# 🧠 NeuroDrive Helper

**NeuroDrive Helper** is an AI-powered browser extension designed to make online reading more accessible for individuals with ADHD, dyslexia, and other neurodiverse conditions. It simplifies complex web text, highlights key ideas, and offers features like focus mode, dyslexia-friendly fonts, and text-to-speech — creating an inclusive and distraction-free reading experience.

---

## 🚀 Features

- 🪶 **Text Simplification** — Uses NLP models to rewrite complex text into clearer, more readable language.  
- 🎯 **Focus Mode** — Dims distractions and improves visual clarity for better attention and comprehension.  
- 🔊 **Text-to-Speech** — Converts text into natural-sounding speech for auditory learners and users with reading difficulties.  
- 🧩 **Dyslexia-Friendly View** — Applies specialized fonts, spacing, and contrast settings to reduce visual stress.  
- ⚙️ **Real-Time Analysis** — Simplifies or summarizes directly from the web page without manual copy/paste.  

---

## 🧰 Built With

**Frontend:**
- Chrome Extension (HTML, CSS, JavaScript)
- Manifest v3 configuration
- Service Worker for background tasks
- Tailwind CSS and custom styles for accessibility UI

**Backend:**
- FastAPI (Python)
- Hugging Face Transformers for NLP text simplification/summarization
- Uvicorn for API serving
- Docker for containerization

**APIs / Services:**
- Hugging Face API (language model)
- ElevenLabs API (text-to-speech)

---

## 🏗️ How It Works

1. The **Chrome Extension** captures text from the active browser tab when the user presses **“Analyze.”**  
2. The selected content is sent to the **FastAPI backend**, which processes it through a Hugging Face model for simplification or summarization.  
3. The response is displayed directly in the extension’s UI in an accessible, distraction-free format.  
4. Optionally, ElevenLabs generates a speech version for auditory playback.

---

## 📂 Project Structure

```plaintext
NeuroDrive-Helper/
│
├── backend/
│   ├── __pycache__/              # Cached Python files
│   ├── app.py                    # FastAPI main server
│   ├── hf_client.py              # Handles Hugging Face API requests
│   ├── prompts.py                # NLP prompt templates and logic
│   ├── schemas.py                # Pydantic models for data validation
│   ├── utils.py                  # Helper functions for text and API calls
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Backend container configuration
│   └── README.md                 # Backend documentation
│
├── frontend/
│   ├── manifest.json             # Chrome extension configuration (Manifest v3)
│   ├── popup.html                # Main user interface
│   ├── popup.js                  # Handles UI interactions and API calls
│   ├── content.js                # Injected script for text extraction
│   ├── service_worker.js         # Background service worker logic
│   ├── options.html              # Extension settings page
│   ├── options.js                # Logic for options page
│   ├── assets.css                # Additional component styles
│   └── styles.css                # Core styling for the popup and layout
│
└── README.md
