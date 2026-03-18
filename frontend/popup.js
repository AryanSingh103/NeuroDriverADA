// === DOM refs ===
const statusEl = document.getElementById("ndhStatus");
const progressBar = document.getElementById("progressBar");
const connectionDot = document.getElementById("connectionDot");
const connectionTooltip = document.getElementById("connectionTooltip");
const charCountEl = document.getElementById("charCount");
const manualTextarea = document.getElementById("manual");

// Collect all action buttons for loading state
const actionButtons = document.querySelectorAll(".action-btn, .manual-btn");

// === Status helpers ===
const setStatus = (message, type = "") => {
  statusEl.className = `status-msg ${type}`;
  statusEl.textContent = message || "";

  if (message === "Working…") {
    progressBar.classList.add("active");
    actionButtons.forEach(btn => btn.classList.add("loading"));
  } else {
    progressBar.classList.remove("active");
    actionButtons.forEach(btn => btn.classList.remove("loading"));
  }
};

// === Tab switching ===
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// === Character counter ===
manualTextarea.addEventListener("input", () => {
  const len = manualTextarea.value.length;
  charCountEl.textContent = `${len.toLocaleString()} chars`;
  charCountEl.classList.remove("warn", "over");
  if (len > 90000) charCountEl.classList.add("over");
  else if (len > 50000) charCountEl.classList.add("warn");
});

// === Quick Settings toggles ===
async function loadQuickSettings() {
  const defaults = { dyslexia: true, highContrast: true, spacing: true };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  const cfg = { ...defaults, ...stored };

  document.querySelectorAll(".toggle-chip").forEach(chip => {
    const key = chip.dataset.setting;
    if (cfg[key]) chip.classList.add("active");
    else chip.classList.remove("active");
  });
}

document.querySelectorAll(".toggle-chip").forEach(chip => {
  chip.addEventListener("click", async () => {
    chip.classList.toggle("active");
    const key = chip.dataset.setting;
    const value = chip.classList.contains("active");
    await chrome.storage.sync.set({ [key]: value });
  });
});

loadQuickSettings();

// === Backend health check ===
async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("http://localhost:8000/health", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      connectionDot.className = "status-dot connected";
      connectionTooltip.textContent = "Backend connected";
    } else {
      connectionDot.className = "status-dot error";
      connectionTooltip.textContent = "Backend error";
    }
  } catch {
    connectionDot.className = "status-dot error";
    connectionTooltip.textContent = "Backend offline";
  }
}

checkBackendHealth();

// === Utilities ===
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function canScriptInto(tab) {
  if (!tab || !tab.id) return false;
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
        resolve({ ok: false, error: "Request timed out after 3 minutes. The AI models may be very slow. Please try again." });
      }
    }, timeoutMs);

    chrome.runtime.sendMessage({ type: "NDH_PROCESS_TEXT", mode, text }, (resp) => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      const err = chrome.runtime.lastError;
      if (err) {
        return resolve({ ok: false, error: `Extension error: ${err.message}. Try reloading.` });
      }

      resolve(resp || { ok: false, error: "No response from background. Try reloading." });
    });
  });
}

async function run(mode, text) {
  setStatus("Working…");

  try {
    const resp = await callServiceWorker(mode, text);
    if (!resp?.ok) throw new Error(resp?.error || "Unknown error");

    const tab = await getActiveTab();
    if (!canScriptInto(tab)) {
      setStatus("Result ready — open a normal webpage.", "error");
      return;
    }

    // Try to send message to content script
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
            reject(chrome.runtime.lastError);
          } else {
            messageSent = true;
            resolve();
          }
        });
      });
    } catch (firstError) {
      // Content script not loaded, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        await new Promise(r => setTimeout(r, 300));

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
              messageSent = true;
              resolve();
            }
          });
        });
      } catch (injectError) {
        throw new Error("Could not display result. Try refreshing the page.");
      }
    }

    if (messageSent) {
      setStatus("Done ✓", "success");
      setTimeout(() => setStatus(""), 2000);
    }
  } catch (e) {
    setStatus(e.message || "Error", "error");
    setTimeout(() => setStatus(""), 4000);
  }
}

// === Wire up buttons ===
document.getElementById("simplify").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open a normal webpage first.", "error");
  const text = await getSelection(tab.id);
  if (!text) return setStatus("Select some text first.", "error");
  run("simplify", text);
};

document.getElementById("summarize").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open a normal webpage first.", "error");
  const text = await getSelection(tab.id);
  if (!text) return setStatus("Select some text first.", "error");
  run("summarize", text);
};

document.getElementById("simplifyManual").onclick = async () => {
  const text = manualTextarea.value.trim();
  if (!text) return setStatus("Paste some text first.", "error");
  run("simplify", text);
};

document.getElementById("summarizeManual").onclick = async () => {
  const text = manualTextarea.value.trim();
  if (!text) return setStatus("Paste some text first.", "error");
  run("summarize", text);
};

document.getElementById("analyzePage").onclick = async () => {
  const tab = await getActiveTab();
  if (!canScriptInto(tab)) return setStatus("Open a normal webpage first.", "error");
  let text = await getSelection(tab.id);
  if (!text) text = await getPageText(tab.id);
  if (!text) return setStatus("Could not extract page text.", "error");
  run("analyze", text);
};
