async function getSelectionInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString() || ""
  });
  return { tabId: tab.id, text: result || "" };
}

async function processText(mode, text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "NDH_PROCESS_TEXT", mode, text }, (resp) => resolve(resp));
  });
}

document.getElementById("simplify").onclick = async () => {
  const { tabId, text } = await getSelectionInActiveTab();
  if (!text) return alert("No selection found.");
  const resp = await processText("simplify", text);
  if (!resp.ok) return alert(resp.error || "Error");
  chrome.tabs.sendMessage(tabId, { type: "NDH_SHOW_RESULT", data: resp.payload, settings: resp.settings, mode: "simplify" });
};

document.getElementById("summarize").onclick = async () => {
  const { tabId, text } = await getSelectionInActiveTab();
  if (!text) return alert("No selection found.");
  const resp = await processText("summarize", text);
  if (!resp.ok) return alert(resp.error || "Error");
  chrome.tabs.sendMessage(tabId, { type: "NDH_SHOW_RESULT", data: resp.payload, settings: resp.settings, mode: "summarize" });
};

document.getElementById("simplifyManual").onclick = async () => {
  const text = document.getElementById("manual").value.trim();
  if (!text) return alert("Paste text first.");
  const { tabId } = await getSelectionInActiveTab();
  const resp = await processText("simplify", text);
  if (!resp.ok) return alert(resp.error || "Error");
  chrome.tabs.sendMessage(tabId, { type: "NDH_SHOW_RESULT", data: resp.payload, settings: resp.settings, mode: "simplify" });
};

document.getElementById("summarizeManual").onclick = async () => {
  const text = document.getElementById("manual").value.trim();
  if (!text) return alert("Paste text first.");
  const { tabId } = await getSelectionInActiveTab();
  const resp = await processText("summarize", text);
  if (!resp.ok) return alert(resp.error || "Error");
  chrome.tabs.sendMessage(tabId, { type: "NDH_SHOW_RESULT", data: resp.payload, settings: resp.settings, mode: "summarize" });
};
