// Creates a shadow-DOM overlay so we don't disturb page styles
function ensureOverlay() {
  let host = document.getElementById("__ndh_overlay");
  if (host) return host;
  host = document.createElement("div");
  host.id = "__ndh_overlay";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.top = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647"; // on top
  host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <link rel="stylesheet" href="${chrome.runtime.getURL('assets/opendyslexic.css')}">
    <style>
      .wrap { max-width: 480px; }
      .card {
        background: #101114; color: #fff; border-radius: 12px; padding: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,.45); line-height: 1.6; font-size: 15px;
      }
      .dys { font-family: 'OpenDyslexic', system-ui, sans-serif; letter-spacing: 0.02em; }
      .spaced p, .spaced li { letter-spacing: 0.02em; line-height: 1.75; }
      .hc .card { background: #000; color: #fff; }
      .title { font-weight: 600; margin: 0 0 8px 0; }
      .controls { display: flex; gap: 8px; margin-top: 8px; }
      .btn {
        background: #2b2e36; color: #fff; border: none; border-radius: 8px; padding: 6px 10px;
        cursor: pointer; font-size: 14px;
      }
      .btn:hover { filter: brightness(1.1); }
      .mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); }
      .hide { display: none; }
      .content { white-space: pre-wrap; }
    </style>
    <div class="wrap">
      <div id="mask" class="mask hide" aria-hidden="true"></div>
      <div id="card" class="card">
        <div class="title">NeuroDrive</div>
        <div id="out" class="content"></div>
        <div class="controls">
          <button id="tts" class="btn">🔊 Read</button>
          <button id="copy" class="btn">📋 Copy</button>
          <button id="close" class="btn">✕ Close</button>
        </div>
      </div>
    </div>
  `;
  document.documentElement.appendChild(host);

  const $ = (sel) => shadow.querySelector(sel);
  $("#close").onclick = () => host.remove();
  $("#copy").onclick = async () => {
    const text = $("#out").innerText;
    try { await navigator.clipboard.writeText(text); $("#copy").innerText = "✅ Copied"; setTimeout(()=>$("#copy").innerText="📋 Copy",1200);} catch {}
  };
  $("#tts").onclick = () => {
    const text = $("#out").innerText;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = host.dataset.ttsrate ? parseFloat(host.dataset.ttsrate) : 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return host;
}

function applySettings(host, settings) {
  const card = host.shadowRoot.getElementById("card");
  const out = host.shadowRoot.getElementById("out");
  const mask = host.shadowRoot.getElementById("mask");

  // classes
  card.classList.toggle("dys", !!settings.dyslexia);
  card.classList.toggle("spaced", !!settings.spacing);
  host.shadowRoot.host.classList.toggle("hc", !!settings.highContrast);

  // focus mask
  mask.classList.toggle("hide", !settings.focusMask);

  // tts rate
  host.dataset.ttsrate = String(settings.ttsRate || 0.95);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NDH_SHOW_RESULT") {
    const host = ensureOverlay();
    applySettings(host, msg.settings || {});
    const out = host.shadowRoot.getElementById("out");
    // Render as text with preserved line breaks
    out.textContent = msg.data.output || "";
    // Optionally, scroll result into view (not the page)
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (msg.type === "NDH_ERROR") {
    const host = ensureOverlay();
    applySettings(host, msg.settings || {});
    host.shadowRoot.getElementById("out").textContent = "Error: " + (msg.error || "Unknown");
  }
});
