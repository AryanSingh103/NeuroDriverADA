// ---- CONFIG: set these for dev and later for prod ----
const API_URL = "http://localhost:8001/process"; // swap to prod later
const API_KEY = "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9";     // must match backend

// Simple stable hash (for caching identical requests)
async function sha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSettings() {
  const defaults = {
    readingLevel: "8th grade",
    bullets: true,
    dyslexia: true,
    highContrast: true,
    spacing: true,
    ttsRate: 0.95,
    focusMask: true
  };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

async function callAPI(mode, text, options) {
  const payload = { mode, text, options };
  const key = await sha256(JSON.stringify(payload));
  // Check client cache first
  const cacheHit = await chrome.storage.local.get([key]);
  if (cacheHit[key]) return { ...cacheHit[key], cached: true };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status} ${detail}`);
  }
  const data = await res.json();
  // Store in local cache
  await chrome.storage.local.set({ [key]: data });
  return data;
}

// Context menus on first install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ndh_simplify",
    title: "Simplify with NeuroDrive",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "ndh_summarize",
    title: "Summarize with NeuroDrive",
    contexts: ["selection"]
  });
});

// Handle right-click actions
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;
  const settings = await getSettings();
  const mode = info.menuItemId === "ndh_summarize" ? "summarize" : "simplify";
  try {
    const payload = await callAPI(mode, info.selectionText, {
      reading_level: settings.readingLevel,
      bullets: !!settings.bullets
    });
    chrome.tabs.sendMessage(tab.id, { type: "NDH_SHOW_RESULT", data: payload, settings, mode });
  } catch (e) {
    chrome.tabs.sendMessage(tab.id, { type: "NDH_ERROR", error: e.message });
  }
});

// Allow popup.js to invoke processing for full page or selection
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "NDH_PROCESS_TEXT") {
    try {
      const settings = await getSettings();
      const payload = await callAPI(msg.mode, msg.text, {
        reading_level: settings.readingLevel,
        bullets: !!settings.bullets
      });
      sendResponse({ ok: true, payload, settings });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    // Indicate async response
    return true;
  }
});
