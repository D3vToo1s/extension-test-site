// ui.js — front-end controller

function sendToExtension(payload) {
  window.postMessage({ type: "BM_COMMAND", payload }, "*");
}

// Generic response handler
window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;

  const { target, data } = event.data.payload;
  if (!target) return;

  const el = document.getElementById(target);
  if (!el) return;

  el.textContent = JSON.stringify(data, null, 2);
});

// Sidebar navigation
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const panelId = btn.dataset.panel;

    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    document.getElementById(panelId).classList.add("active");
  });
});

// EXTENSION MANAGER
function loadExtensionInfo() {
  sendToExtension({
    action: "GET_EXTENSION_INFO",
    target: "extensionOutput"
  });
}

window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;
  const { target, data } = event.data.payload;

  if (target === "extensionOutput" && data) {
    document.getElementById("extName").textContent = data.name || "";
    document.getElementById("extId").textContent = data.id || "";
    document.getElementById("extDesc").textContent = data.description || "";
    const iconEl = document.getElementById("extIcon");
    if (data.icons && data.icons.length) {
      iconEl.src = data.icons[data.icons.length - 1].url;
    }
    document.getElementById("extEnabledToggle").checked = !!data.enabled;
  }
});

document.getElementById("extEnabledToggle").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  const id = document.getElementById("extId").textContent;
  if (!id) return;

  sendToExtension({
    action: "SET_EXTENSION_ENABLED",
    id,
    enabled,
    target: "extensionOutput"
  });
});

// TABS
let currentTabs = [];

function refreshTabs() {
  sendToExtension({
    action: "LIST_TABS",
    target: "tabsOutput"
  });
}

window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;
  const { target, data } = event.data.payload;

  if (target === "tabsOutput" && Array.isArray(data)) {
    currentTabs = data;
    const list = document.getElementById("tabsList");
    const injectSelect = document.getElementById("injectTabSelect");
    const controlSelect = document.getElementById("tabControlSelect");

    list.innerHTML = "";
    injectSelect.innerHTML = "";
    controlSelect.innerHTML = "";

    data.forEach(tab => {
      const li = document.createElement("li");
      li.textContent = `[${tab.id}] ${tab.title} — ${tab.url}`;
      list.appendChild(li);

      const opt1 = document.createElement("option");
      opt1.value = tab.id;
      opt1.textContent = `[${tab.id}] ${tab.title}`;
      injectSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = tab.id;
      opt2.textContent = `[${tab.id}] ${tab.title}`;
      controlSelect.appendChild(opt2);
    });
  }
});

document.getElementById("refreshTabs").onclick = refreshTabs;

// Per-tab controls
function getSelectedTabId(selectId) {
  const val = document.getElementById(selectId).value;
  return val ? parseInt(val, 10) : null;
}

document.getElementById("closeTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "CLOSE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("reloadTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "RELOAD_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("muteTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "MUTE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("unmuteTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "UNMUTE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("pinTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "PIN_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("unpinTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (!tabId) return;
  sendToExtension({ action: "UNPIN_TAB", tabId, target: "tabsOutput" });
};

// Tab viewer (note: actual video capture requires userMedia bridge; here we just show status)
document.getElementById("captureTab").onclick = () => {
  sendToExtension({
    action: "CAPTURE_TAB",
    target: "tabsOutput"
  });
  // For real video: you'd call getUserMedia with chrome.tabCapture constraints in an extension page.
};

// SCRIPT INJECTOR
document.getElementById("injectScript").onclick = () => {
  const tabId = getSelectedTabId("injectTabSelect");
  const code = document.getElementById("scriptInput").value;
  if (!tabId || !code) return;

  sendToExtension({
    action: "INJECT_SCRIPT",
    tabId,
    code,
    target: "injectOutput"
  });
};

// Script presets
const presets = {
  logUrl: `
    console.log("Current URL:", window.location.href);
  `,
  highlight: `
    document.querySelectorAll('a').forEach(a => {
      a.style.background = 'yellow';
      a.style.color = 'black';
    });
  `,
  alert: `
    alert("Page title: " + document.title);
  `
};

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    if (!key || !presets[key]) return;
    document.getElementById("scriptInput").value = presets[key].trim();
  });
});

// HISTORY
document.getElementById("searchHistory").onclick = () => {
  sendToExtension({
    action: "GET_HISTORY",
    text: document.getElementById("historySearch").value,
    maxResults: 100,
    target: "historyOutput"
  });
};

// DOWNLOADS
document.getElementById("listDownloads").onclick = () => {
  sendToExtension({
    action: "LIST_DOWNLOADS",
    query: {},
    target: "downloadsOutput"
  });
};

// Initial load
loadExtensionInfo();
refreshTabs();
