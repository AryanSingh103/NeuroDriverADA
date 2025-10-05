// Creates a shadow-DOM overlay so we don't disturb page styles
function ensureOverlay() {
  let host = document.getElementById("__ndh_overlay");
  if (host) return host;
  host = document.createElement("div");
  host.id = "__ndh_overlay";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.top = "80px";
  host.style.right = "20px";
  host.style.zIndex = "2147483647"; // max z-index
  host.style.pointerEvents = "auto";
  host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <link rel="stylesheet" href="${chrome.runtime.getURL('assets/opendyslexic.css')}">
    <style>
      .wrap { 
        max-width: 680px;
        width: 90vw;
      }
      .card {
        background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
        color: #fff;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.1);
        line-height: 1.8;
        font-size: 17px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }
      .dys { font-family: 'OpenDyslexic', system-ui, sans-serif; letter-spacing: 0.03em; }
      .spaced p, .spaced li { letter-spacing: 0.03em; line-height: 2; }
      .hc .card { background: #000; color: #fff; border: 2px solid #fff; }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .title { 
        font-weight: 700;
        font-size: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .badge {
        background: rgba(102, 126, 234, 0.2);
        color: #93c5fd;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .content-wrapper {
        flex: 1;
        overflow-y: auto;
        margin-bottom: 16px;
        padding-right: 8px;
      }
      .content-wrapper::-webkit-scrollbar {
        width: 8px;
      }
      .content-wrapper::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
      }
      .content-wrapper::-webkit-scrollbar-thumb {
        background: rgba(102, 126, 234, 0.5);
        border-radius: 4px;
      }
      .content-wrapper::-webkit-scrollbar-thumb:hover {
        background: rgba(102, 126, 234, 0.7);
      }
      .content { 
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .controls { 
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }
      .btn:hover { 
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
      }
      .btn:active {
        transform: translateY(0);
      }
      .btn.secondary {
        background: rgba(255,255,255,0.1);
        box-shadow: none;
      }
      .btn.secondary:hover {
        background: rgba(255,255,255,0.15);
      }
      .mask { 
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0);
        backdrop-filter: none;
        pointer-events: none;
      }
      .hide { display: none; }
    </style>
    <div class="wrap">
      <div id="mask" class="mask hide" aria-hidden="true"></div>
      <div id="card" class="card">
        <div class="header">
          <div class="title">🧠 NeuroDrive</div>
          <div id="modeBadge" class="badge"></div>
        </div>
        <div class="content-wrapper">
          <div id="out" class="content"></div>
        </div>
        <div class="controls">
          <button id="tts" class="btn">🔊 Read Aloud</button>
          <button id="copy" class="btn secondary">📋 Copy</button>
          <button id="viewPrompt" class="btn secondary">📝 View Prompt</button>
          <button id="close" class="btn secondary">✕ Close</button>
        </div>
      </div>
    </div>
  `;
  
  // Append to body
  (document.body || document.documentElement).appendChild(host);

  const $ = (sel) => shadow.querySelector(sel);
  $("#close").onclick = () => host.remove();
  $("#copy").onclick = async () => {
    const text = $("#out").innerText;
    try { await navigator.clipboard.writeText(text); $("#copy").innerText = "✅ Copied"; setTimeout(()=>$("#copy").innerText="📋 Copy",1200);} catch {}
  };
  $("#viewPrompt").onclick = () => {
    const prompt = host.dataset.prompt || "No prompt available";
    // Create a modal-like display for the prompt
    const promptOverlay = document.createElement("div");
    promptOverlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;";
    
    const promptBox = document.createElement("div");
    promptBox.style.cssText = "background:#1e1e2e;color:#fff;padding:30px;border-radius:12px;max-width:800px;max-height:80vh;overflow:auto;font-family:monospace;font-size:14px;line-height:1.6;box-shadow:0 20px 60px rgba(0,0,0,0.6);";
    
    const title = document.createElement("h3");
    title.textContent = "📝 Prompt Sent to AI";
    title.style.cssText = "margin:0 0 15px 0;color:#a78bfa;";
    
    const pre = document.createElement("pre");
    pre.textContent = prompt;
    pre.style.cssText = "margin:0;white-space:pre-wrap;word-wrap:break-word;";
    
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Close";
    closeBtn.style.cssText = "margin-top:20px;padding:10px 20px;background:#7c5cff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;";
    closeBtn.onclick = () => promptOverlay.remove();
    
    promptBox.appendChild(title);
    promptBox.appendChild(pre);
    promptBox.appendChild(closeBtn);
    promptOverlay.appendChild(promptBox);
    promptOverlay.onclick = (e) => { if(e.target === promptOverlay) promptOverlay.remove(); };
    document.body.appendChild(promptOverlay);
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

  // focus mask - ALWAYS HIDDEN (disabled blur feature)
  mask.classList.add("hide");

  // tts rate
  host.dataset.ttsrate = String(settings.ttsRate || 0.95);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Content Script] Received message:", msg.type);
  
  if (msg.type === "NDH_SHOW_RESULT") {
    const host = ensureOverlay();
    applySettings(host, msg.settings || {});
    const out = host.shadowRoot.getElementById("out");
    const badge = host.shadowRoot.getElementById("modeBadge");
    
    // Store the prompt for the View Prompt button
    if (msg.data && msg.data.prompt) {
      host.dataset.prompt = msg.data.prompt;
      console.log("[Content Script] Prompt stored:", msg.data.prompt.substring(0, 100) + "...");
    } else {
      host.dataset.prompt = "No prompt available in response";
    }
    
    // Set mode badge
    if (msg.mode === "simplify") {
      badge.textContent = "✨ Simplified";
    } else if (msg.mode === "summarize") {
      badge.textContent = "📊 Summarized";
    } else {
      badge.textContent = "📝 Processed";
    }
    
    // Render as text with preserved line breaks
    out.textContent = msg.data.output || "";
    
    // Make sure the overlay is visible and scrolled into view
    host.style.display = 'block';
    setTimeout(() => {
      host.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, 100);
    
    console.log("[Content Script] Overlay displayed, sending response");
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === "NDH_ERROR") {
    const host = ensureOverlay();
    applySettings(host, msg.settings || {});
    const out = host.shadowRoot.getElementById("out");
    const badge = host.shadowRoot.getElementById("modeBadge");
    badge.textContent = "⚠️ Error";
    badge.style.background = "rgba(239, 68, 68, 0.2)";
    badge.style.color = "#fca5a5";
    out.innerHTML = `<div style="color: #fca5a5;">❌ ${msg.error || "Unknown error occurred"}</div>`;
    
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === "NDH_PING") {
    // Respond to ping to confirm content script is loaded
    console.log("[Content Script] Received PING, responding...");
    sendResponse({ pong: true });
    return true;
  }
});

