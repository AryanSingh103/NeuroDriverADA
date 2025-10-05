// --- Status helper ---
const statusEl = document.getElementById("ndhStatus");
const allButtons = document.querySelectorAll(".btn");

const setStatus = (message, type = "") => {
  statusEl.className = `status ${type}`;
  if (message === "Working…") {
    statusEl.innerHTML = `<div class="spinner"></div><span>${message}</span>`;
    allButtons.forEach(btn => btn.classList.add("loading"));
  } else {
    statusEl.textContent = message || "";
    allButtons.forEach(btn => btn.classList.remove("loading"));
  }
};

// --- Utilities ---
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function canScriptInto(tab) {
  if (!tab || !tab.id) return false;
  // block special schemes and restricted pages
  try {
    const u = new URL(tab.url || "");
    const blocked = new Set(["chrome:", "chrome-extension:", "edge:", "about:", "chrome-search:"]);
    return ![...blocked].some((p) => u.protocol.startsWith(p));
  } catch {
    return false;
  }
}

async function execInPage(tabId, func) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func });
  return result?.result ?? "";
}

async function getSelection(tabId) {
  return execInPage(tabId, () => window.getSelection()?.toString() || "");
}

async function getPageText(tabId) {
  return execInPage(tabId, () => {
    const primary = document.querySelector("article, main, [role='main'], .article, .post, .entry");
    if (primary?.innerText && primary.innerText.length > 200) return primary.innerText;
    const paras = Array.from(document.querySelectorAll("p"))
      .filter((p) => p.innerText && p.offsetParent !== null)
      .map((p) => p.innerText.trim())
      .filter(Boolean);
    const joined = paras.join("\n\n");
    return joined.length > 200 ? joined : document.body?.innerText || "";
  });
}

function callServiceWorker(mode, text, timeoutMs = 185000) {
  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ ok: false, error: "Request timed out after 3 minutes. The AI models may be very slow. Please try again or wait a bit longer." });
      }
    }, timeoutMs);

    chrome.runtime.sendMessage({ type: "NDH_PROCESS_TEXT", mode, text }, (resp) => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      const err = chrome.runtime.lastError;
      if (err) {
        // This is the "message port closed before a response was received" case
        return resolve({ ok: false, error: `Extension error: ${err.message}. Try reloading the extension.` });
      }

      resolve(resp || { ok: false, error: "No response from background service. Try reloading the extension." });
    });
  });
}

async function ensureContentScriptLoaded(tabId) {
  console.log("[Popup] Pinging content script...");
  
  // Try to ping the content script with retries
  for (let i = 0; i < 3; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: "NDH_PING" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response) {
        console.log("[Popup] Content script responded to PING");
        return; // Content script is ready
      }
    } catch (err) {
      console.log(`[Popup] PING attempt ${i + 1} failed:`, err.message);
      
      // Content script not responding, try to inject it
      if (i === 0) {
        try {
          console.log("[Popup] Injecting content script...");
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"]
          });
          console.log("[Popup] Content script injected");
          await new Promise(r => setTimeout(r, 200)); // Wait for initialization
        } catch (injectErr) {
          console.error("[Popup] Failed to inject content script:", injectErr);
        }
      } else {
        await new Promise(r => setTimeout(r, 100 * i)); // Progressive backoff
      }
    }
  }
  
  console.log("[Popup] Content script ready (or timeout reached)");
}

async function run(mode, text) {
  setStatus("Working…");
  console.log("[Popup] Starting run, mode:", mode, "text length:", text.length);
  
  try {
    console.log("[Popup] Calling service worker...");
    const resp = await callServiceWorker(mode, text);
    console.log("[Popup] Service worker response:", resp);
    
    if (!resp?.ok) throw new Error(resp?.error || "Unknown error");

    const tab = await getActiveTab();
    if (!canScriptInto(tab)) {
      // Fall back: show a friendly message when we can't inject the overlay.
      setStatus("Result ready — open a regular webpage and try again.", "error");
      return;
    }

    console.log("[Popup] Sending message to content script on tab:", tab.id);
    
    // Try to send message directly - the content script should already be loaded from manifest
    let messageSent = false;
    
    try {
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
          type: "NDH_SHOW_RESULT",
          data: resp.payload,
          settings: resp.settings,
          mode,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("[Popup] First attempt failed, trying to inject content script:", chrome.runtime.lastError.message);
            reject(chrome.runtime.lastError);
          } else {
            console.log("[Popup] Message sent successfully!");
            messageSent = true;
            resolve();
          }
        });
      });
    } catch (firstError) {
      // Content script not loaded, inject it manually
      console.log("[Popup] Injecting content script...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        
        // Wait a moment for it to load
        await new Promise(r => setTimeout(r, 300));
        
        // Try sending the message again
        await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, {
            type: "NDH_SHOW_RESULT",
            data: resp.payload,
            settings: resp.settings,
            mode,
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              console.log("[Popup] Message sent after injection!");
              messageSent = true;
              resolve();
            }
          });
        });
      } catch (injectError) {
        console.error("[Popup] Failed to inject/send:", injectError);
        throw new Error("Could not display result. Try refreshing the page.");
      }
    }
    
    if (messageSent) {
      setStatus("Done ✓", "success");
      setTimeout(() => setStatus(""), 1500);
    }
  } catch (e) {
    console.error("[Popup] Error:", e);
    setStatus(e.message || "Error", "error");
    setTimeout(() => setStatus(""), 3000);
  }
}

// --- Wire up buttons (with guards) ---
document.getElementById("simplify").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open this on a normal webpage.");
  const text = await getSelection(tab.id);
  if (!text) return setStatus("No selection found.");
  run("simplify", text);
};

document.getElementById("summarize").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open this on a normal webpage.");
  const text = await getSelection(tab.id);
  if (!text) return setStatus("No selection found.");
  run("summarize", text);
};

document.getElementById("simplifyManual").onclick = async () => {
  const text = document.getElementById("manual").value.trim();
  if (!text) return setStatus("Paste text first.");
  run("simplify", text);
};

document.getElementById("summarizeManual").onclick = async () => {
  const text = document.getElementById("manual").value.trim();
  if (!text) return setStatus("Paste text first.");
  run("summarize", text);
};

document.getElementById("analyzePage").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open this on a normal webpage.");
  let text = await getSelection(tab.id);
  if (!text) text = await getPageText(tab.id);
  if (!text) return setStatus("Could not extract page text.");
  run("analyze", text); // Use analyze mode for accessibility report
};
