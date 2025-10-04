const fields = ["readingLevel","bullets","dyslexia","highContrast","spacing","ttsRate","focusMask"];

async function load() {
  const defaults = { readingLevel: "8th grade", bullets: true, dyslexia: true, highContrast: true, spacing: true, ttsRate: 0.95, focusMask: true };
  const stored = await chrome.storage.sync.get(fields);
  const cfg = { ...defaults, ...stored };

  document.getElementById("readingLevel").value = cfg.readingLevel;
  document.getElementById("bullets").checked = !!cfg.bullets;
  document.getElementById("dyslexia").checked = !!cfg.dyslexia;
  document.getElementById("highContrast").checked = !!cfg.highContrast;
  document.getElementById("spacing").checked = !!cfg.spacing;
  document.getElementById("focusMask").checked = !!cfg.focusMask;
  document.getElementById("ttsRate").value = cfg.ttsRate;
}

async function save() {
  const cfg = {
    readingLevel: document.getElementById("readingLevel").value,
    bullets: document.getElementById("bullets").checked,
    dyslexia: document.getElementById("dyslexia").checked,
    highContrast: document.getElementById("highContrast").checked,
    spacing: document.getElementById("spacing").checked,
    focusMask: document.getElementById("focusMask").checked,
    ttsRate: parseFloat(document.getElementById("ttsRate").value || "0.95")
  };
  await chrome.storage.sync.set(cfg);
  const status = document.getElementById("status");
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1200);
}

document.getElementById("save").onclick = save;
load();
