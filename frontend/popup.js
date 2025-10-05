// --- Status helper ---
const statusEl = document.getElementById("ndhStatus");
const setStatus = (m) => (statusEl.textContent = m || "");

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

function callServiceWorker(mode, text, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ ok: false, error: "Timed out waiting for background response." });
      }
    }, timeoutMs);

    chrome.runtime.sendMessage({ type: "NDH_PROCESS_TEXT", mode, text }, (resp) => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      const err = chrome.runtime.lastError;
      if (err) {
        // This is the “message port closed before a response was received” case
        return resolve({ ok: false, error: err.message || "Background not available." });
      }

      resolve(resp || { ok: false, error: "No response from background." });
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
      // Fall back: show a friendly message when we can’t inject the overlay.
      setStatus("Result ready — open a regular webpage and try again.");
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: "NDH_SHOW_RESULT",
      data: resp.payload,
      settings: resp.settings,
      mode,
    });

    setStatus("Done ✓");
    setTimeout(() => setStatus(""), 1200);
  } catch (e) {
    setStatus(e.message || "Error");
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
  run("summarize", text); // default behavior
};
