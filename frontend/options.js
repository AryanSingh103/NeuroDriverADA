const fields = ["readingLevel","bullets","dyslexia","highContrast","spacing","ttsRate","focusMask","audience","simplifierModel","summarizerModel","distractionReducer","colorBlindnessMode"];

async function load() {
  const defaults = { readingLevel: "8th grade", bullets: true, dyslexia: true, highContrast: true, spacing: true, ttsRate: 0.95, focusMask: true, distractionReducer: false, colorBlindnessMode: "none" };
  const stored = await chrome.storage.sync.get(fields);
  const cfg = { ...defaults, ...stored };

  document.getElementById("readingLevel").value = cfg.readingLevel;
  document.getElementById("audience").value = cfg.audience || 'general';
  document.getElementById("simplifierModel").value = cfg.simplifierModel || '';
  document.getElementById("summarizerModel").value = cfg.summarizerModel || '';
  document.getElementById("bullets").checked = !!cfg.bullets;
  document.getElementById("dyslexia").checked = !!cfg.dyslexia;
  document.getElementById("highContrast").checked = !!cfg.highContrast;
  document.getElementById("spacing").checked = !!cfg.spacing;
  document.getElementById("focusMask").checked = !!cfg.focusMask;
  document.getElementById("distractionReducer").checked = !!cfg.distractionReducer;
  document.getElementById("colorBlindnessMode").value = cfg.colorBlindnessMode;
  document.getElementById("ttsRate").value = cfg.ttsRate;
}

async function save() {
  const cfg = {
    readingLevel: document.getElementById("readingLevel").value,
    audience: document.getElementById("audience").value || 'general',
    simplifierModel: document.getElementById("simplifierModel").value.trim(),
    summarizerModel: document.getElementById("summarizerModel").value.trim(),
    bullets: document.getElementById("bullets").checked,
    dyslexia: document.getElementById("dyslexia").checked,
    highContrast: document.getElementById("highContrast").checked,
    spacing: document.getElementById("spacing").checked,
    focusMask: document.getElementById("focusMask").checked,
    distractionReducer: document.getElementById("distractionReducer").checked,
    colorBlindnessMode: document.getElementById("colorBlindnessMode").value,
    ttsRate: parseFloat(document.getElementById("ttsRate").value || "0.95")
  };
  await chrome.storage.sync.set(cfg);
  
  // Apply distraction reducer immediately to all tabs
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { 
      type: 'APPLY_DISTRACTION_REDUCER', 
      enabled: cfg.distractionReducer 
    }).catch(() => {}); // Ignore errors for tabs without content script
    
    chrome.tabs.sendMessage(tab.id, { 
      type: 'APPLY_COLOR_BLINDNESS_MODE', 
      mode: cfg.colorBlindnessMode 
    }).catch(() => {}); // Ignore errors for tabs without content script
  });
  
  const status = document.getElementById("status");
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1200);
}

document.getElementById("save").onclick = save;
load();
