#!/usr/bin/env python3
import requests
import json

url = "http://localhost:8000/process"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9"
}
payload = {
    "mode": "summarize",
    "text": "This is a test sentence to summarize.",
    "options": {
        "reading_level": "8th grade",
        "bullets": True,
        "audience": "general"
    }
}

print("Sending request to:", url)
print("Payload:", json.dumps(payload, indent=2))

try:
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"\nError: {e}")
