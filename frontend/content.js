// Apply distraction reducer
async function applyDistractionReducer() {
  const { distractionReducer } = await chrome.storage.sync.get(['distractionReducer']);
  
  let style = document.getElementById('ndh-distraction-reducer');
  if (style) {
    style.remove();
  }
  
  if (!distractionReducer) return;
  
  style = document.createElement('style');
  style.id = 'ndh-distraction-reducer';
  style.textContent = `
    img:not([alt]), video, iframe:not([title]), 
    .ad, .advertisement, [class*="banner"],
    [class*="sidebar"], [class*="promoted"] {
      filter: blur(8px) grayscale(1) opacity(0.3) !important;
      transition: filter 0.3s ease !important;
    }
    img:not([alt]):hover, video:hover, iframe:not([title]):hover {
      filter: blur(0) grayscale(0) opacity(1) !important;
    }
    /* Disable animations for focus */
    * {
      animation-duration: 0.01s !important;
      transition-duration: 0.01s !important;
    }
  `;
  document.head.appendChild(style);
}

// Apply color blindness mode
async function applyColorBlindnessMode() {
  const { colorBlindnessMode } = await chrome.storage.sync.get(['colorBlindnessMode']);
  
  let style = document.getElementById('ndh-color-blindness');
  if (style) {
    style.remove();
  }
  
  if (!colorBlindnessMode || colorBlindnessMode === 'none') return;
  
  // Color blindness simulation filters based on research
  const filters = {
    deuteranopia: 'url(#deuteranopia-filter)',
    protanopia: 'url(#protanopia-filter)',
    tritanopia: 'url(#tritanopia-filter)'
  };
  
  // SVG filter matrices for color blindness simulation
  const svgFilters = {
    deuteranopia: `
      <svg style="display:none">
        <defs>
          <filter id="deuteranopia-filter">
            <feColorMatrix type="matrix" values="0.625 0.375 0   0 0
                                                   0.7   0.3   0   0 0
                                                   0     0.3   0.7 0 0
                                                   0     0     0   1 0"/>
          </filter>
        </defs>
      </svg>`,
    protanopia: `
      <svg style="display:none">
        <defs>
          <filter id="protanopia-filter">
            <feColorMatrix type="matrix" values="0.567 0.433 0     0 0
                                                   0.558 0.442 0     0 0
                                                   0     0.242 0.758 0 0
                                                   0     0     0     1 0"/>
          </filter>
        </defs>
      </svg>`,
    tritanopia: `
      <svg style="display:none">
        <defs>
          <filter id="tritanopia-filter">
            <feColorMatrix type="matrix" values="0.95  0.05  0     0 0
                                                   0     0.433 0.567 0 0
                                                   0     0.475 0.525 0 0
                                                   0     0     0     1 0"/>
          </filter>
        </defs>
      </svg>`
  };
  
  if (svgFilters[colorBlindnessMode]) {
    // Add SVG filter to page
    const svgContainer = document.createElement('div');
    svgContainer.id = 'ndh-cb-svg-filter';
    svgContainer.innerHTML = svgFilters[colorBlindnessMode];
    document.body.appendChild(svgContainer);
    
    // Apply filter to entire page
    style = document.createElement('style');
    style.id = 'ndh-color-blindness';
    style.textContent = `
      html {
        filter: ${filters[colorBlindnessMode]} !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Apply on page load
applyDistractionReducer();
applyColorBlindnessMode();

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
      /* Accessibility Report Styling */
      .analyze-report {
        white-space: normal;
      }
      .analyze-report h3 {
        color: #93c5fd;
        font-size: 16px;
        margin: 16px 0 8px 0;
        font-weight: 700;
        border-bottom: 1px solid rgba(147, 197, 253, 0.3);
        padding-bottom: 4px;
      }
      .analyze-report h3:first-child {
        margin-top: 0;
      }
      .analyze-report p {
        margin: 8px 0;
        line-height: 1.6;
      }
      .analyze-report ul {
        margin: 8px 0;
        padding-left: 20px;
      }
      .analyze-report li {
        margin: 4px 0;
        line-height: 1.6;
      }
      .analyze-report .metric {
        background: rgba(102, 126, 234, 0.2);
        padding: 8px 12px;
        border-radius: 8px;
        margin: 8px 0;
        border-left: 3px solid #667eea;
      }
      .analyze-report .warning {
        background: rgba(251, 191, 36, 0.2);
        border-left-color: #fbbf24;
      }
      .analyze-report .success {
        background: rgba(34, 197, 94, 0.2);
        border-left-color: #22c55e;
      }
      .analyze-report .action {
        background: rgba(139, 92, 246, 0.2);
        border-left-color: #8b5cf6;
        font-weight: 600;
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
          <button id="close" class="btn secondary">✕ Close</button>
        </div>
      </div>
    </div>
  `;
  
  // Append to body
  (document.body || document.documentElement).appendChild(host);

  const $ = (sel) => shadow.querySelector(sel);
  $("#close")?.addEventListener("click", () => host.remove());
  $("#copy")?.addEventListener("click", async () => {
    const text = $("#out").innerText;
    try { await navigator.clipboard.writeText(text); $("#copy").innerText = "✅ Copied"; setTimeout(()=>$("#copy").innerText="📋 Copy",1200);} catch {}
  });
  
  const ttsBtn = $("#tts");
  if (ttsBtn) {
    ttsBtn.addEventListener("click", async () => {
      const text = $("#out").innerText;
      const btn = $("#tts");
      
      console.log("[Content Script] TTS button clicked, text length:", text.length);
      
      // Disable button and show loading state
      btn.disabled = true;
      btn.textContent = "🔊 Loading...";
      
      try {
        console.log("[Content Script] Calling TTS endpoint...");
        
        // Call backend TTS endpoint
        const response = await fetch("http://localhost:8000/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "460975e97dbaee9cf9719e0a57f706a47c6377aca6083e6641077188e64d97c9"
          },
          body: JSON.stringify({
            text: text,
            voice_id: "21m00Tcm4TlvDq8ikWAM"  // Rachel voice (clear and professional)
          })
        });
        
        console.log("[Content Script] TTS response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[Content Script] TTS API error:", response.status, errorText);
          throw new Error(`TTS API error: ${response.status} - ${errorText}`);
        }
        
        // Get audio blob and play it
        const audioBlob = await response.blob();
        console.log("[Content Script] Audio blob size:", audioBlob.size, "type:", audioBlob.type);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        console.log("[Content Script] Playing audio...");
        
        // Play audio
        await audio.play();
        
        // Update button text while playing
        btn.textContent = "🔊 Playing...";
        
        // Reset button when done
        audio.onended = () => {
          console.log("[Content Script] Audio playback finished");
          btn.textContent = "🔊 Read Aloud";
          btn.disabled = false;
          URL.revokeObjectURL(audioUrl);  // Clean up
        };
        
        // Handle errors during playback
        audio.onerror = (e) => {
          console.error("[Content Script] Audio playback error:", e);
          btn.textContent = "🔊 Read Aloud";
          btn.disabled = false;
          URL.revokeObjectURL(audioUrl);
        };
        
      } catch (error) {
        console.error("[Content Script] TTS error:", error);
        btn.textContent = "🔊 Error";
        setTimeout(() => {
          btn.textContent = "🔊 Read Aloud";
          btn.disabled = false;
        }, 2000);
      }
    });
  }

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

// Format the accessibility report with structured HTML
function formatAccessibilityReport(text) {
  // Parse the text and add structure
  let html = text;
  
  // Convert section headers to styled headings
  html = html.replace(/READING LEVEL:([^\n]+)/gi, '<div class="metric"><h3>📚 Reading Level</h3><p>$1</p></div>');
  html = html.replace(/COMPLEXITY:([^\n]+)/gi, '<div class="metric"><h3>🧩 Complexity Score</h3><p>$1</p></div>');
  html = html.replace(/TIME TO READ:([^\n]+)/gi, '<div class="metric"><h3>⏱️ Estimated Reading Time</h3><p>$1</p></div>');
  
  html = html.replace(/ATTENTION POINTS.*?:/gi, '<h3>⚠️ Attention Points (ADHD-Friendly)</h3>');
  html = html.replace(/STRENGTHS.*?:/gi, '<h3>✅ Strengths</h3>');
  html = html.replace(/KEY TAKEAWAYS.*?:/gi, '<h3>💡 Key Takeaways</h3>');
  html = html.replace(/MAIN ACTION.*?:/gi, '<h3>🎯 Main Action</h3>');
  
  // Convert bullet points (- or •) to proper list items
  const lines = html.split('\n');
  let inList = false;
  const formatted = [];
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      if (!inList) {
        formatted.push('<ul>');
        inList = true;
      }
      formatted.push(`<li>${trimmed.substring(1).trim()}</li>`);
    } else {
      if (inList) {
        formatted.push('</ul>');
        inList = false;
      }
      formatted.push(line);
    }
  }
  
  if (inList) formatted.push('</ul>');
  
  html = formatted.join('\n');
  
  // Wrap action items in special styling
  html = html.replace(/<h3>🎯 Main Action<\/h3>([\s\S]*?)(?=<h3|$)/gi, 
    '<h3>🎯 Main Action</h3><div class="metric action">$1</div>');
  
  return html;
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
    } else if (msg.mode === "analyze") {
      badge.textContent = "🔍 Accessibility Report";
    } else {
      badge.textContent = "📝 Processed";
    }
    
    // Format analyze mode with special styling
    if (msg.mode === "analyze") {
      out.innerHTML = formatAccessibilityReport(msg.data.output || "");
      out.classList.add("analyze-report");
    } else {
      // Render as text with preserved line breaks
      out.textContent = msg.data.output || "";
      out.classList.remove("analyze-report");
    }
    
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
  if (msg.type === "APPLY_DISTRACTION_REDUCER") {
    // Apply distraction reducer when settings change
    applyDistractionReducer();
    return true;
  }
  if (msg.type === "APPLY_COLOR_BLINDNESS_MODE") {
    // Apply color blindness mode when settings change
    applyColorBlindnessMode();
    return true;
  }
});

