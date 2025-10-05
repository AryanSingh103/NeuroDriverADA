// ==== CONFIG (dev) ====
const API_URL = "http://localhost:8000/process";  // <- 8000
const API_KEY = "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9"; // keep in sync with backend

async function sha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSettings() {
  const defaults = {
    readingLevel: "8th grade",
    audience: "general",
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

  const cache = await chrome.storage.local.get([key]);
  if (cache[key]) return { ...cache[key], cached: true };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status} ${msg}`);
  }
  const data = await res.json();
  await chrome.storage.local.set({ [key]: data });
  return data;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "ndh_simplify", title: "Simplify with NeuroDrive", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "ndh_summarize", title: "Summarize with NeuroDrive", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;
  const settings = await getSettings();
  const mode = info.menuItemId === "ndh_summarize" ? "summarize" : "simplify";
  try {
      const payloadOpts = {
        reading_level: settings.readingLevel,
        bullets: !!settings.bullets,
        audience: settings.audience || "general",
      };
      if (settings.simplifierModel) payloadOpts.simplifier_model = settings.simplifierModel;
      if (settings.summarizerModel) payloadOpts.summarizer_model = settings.summarizerModel;

      const payload = await callAPI(mode, info.selectionText, payloadOpts);
    chrome.tabs.sendMessage(tab.id, { type: "NDH_SHOW_RESULT", data: payload, settings, mode });
  } catch (e) {
    chrome.tabs.sendMessage(tab.id, { type: "NDH_ERROR", error: e.message });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Always keep the port open for async work
  let replied = false;
  const safeSend = (payload) => {
    if (!replied) { replied = true; sendResponse(payload); }
  };

  (async () => {
    if (msg.type !== "NDH_PROCESS_TEXT") return safeSend({ ok: false, error: "Unknown message type" });

    try {
      const settings = await getSettings();
      const payloadOpts = {
        reading_level: settings.readingLevel,
        bullets: !!settings.bullets,
        audience: settings.audience || "general",
      };
      if (settings.simplifierModel) payloadOpts.simplifier_model = settings.simplifierModel;
      if (settings.summarizerModel) payloadOpts.summarizer_model = settings.summarizerModel;

      const payload = await callAPI(msg.mode, msg.text, payloadOpts);
      safeSend({ ok: true, payload, settings });
    } catch (e) {
      safeSend({ ok: false, error: e?.message || String(e) });
    }
  })();

  return true; // IMPORTANT: keep channel open for async sendResponse
});
