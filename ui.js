// ui.js — Browser Manager front-end controller (website mode)
// This file is intended to run on your website (e.g., https://d3vtoo1s.github.io).
// Replace EXT_ID with your extension's ID (found at chrome://extensions).
// It uses chrome.runtime.sendMessage(EXT_ID, ...) and chrome.runtime.connect(EXT_ID)
// to communicate with the extension's background service worker.

const EXT_ID = "REPLACE_WITH_YOUR_EXTENSION_ID"; // <<-- set this to your extension id

// Open a long-lived port to receive push messages from the extension (onConnectExternal)
let extPort = null;
try {
  extPort = chrome.runtime.connect(EXT_ID, { name: "web-ui-port" });
  extPort.onMessage.addListener(handlePortMessage);
  extPort.onDisconnect.addListener(() => {
    console.warn("Extension port disconnected");
    extPort = null;
  });
} catch (e) {
  console.error("Failed to connect to extension port. Make sure EXT_ID is correct.", e);
  extPort = null;
}

// Helper: send a one-off message to the extension and return a Promise
function sendToExtension(payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    try {
      chrome.runtime.sendMessage(EXT_ID, payload, (response) => {
        finished = true;
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
      return;
    }

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (!finished) reject(new Error("Extension response timed out"));
      }, timeoutMs);
    }
  });
}

// Handle messages coming over the long-lived port
function handlePortMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  // If extension sends { action: "TABS_UPDATED" } or similar, handle it
  if (msg.action === "TABS_UPDATED") {
    refreshTabs();
    return;
  }

  // If extension sends a direct target/data envelope (internal style), render it
  if (msg.target && msg.data !== undefined) {
    const el = document.getElementById(msg.target);
    if (el) el.textContent = JSON.stringify(msg.data, null, 2);
  }
}

// Utility: safe get element
function $id(id) {
  return document.getElementById(id);
}

// Sidebar navigation
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const panelId = btn.dataset.panel;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add("active");
  });
});

// -----------------------------
// EXTENSION MANAGER
// -----------------------------
async function loadAllExtensions() {
  try {
    const res = await sendToExtension({ action: "GET_ALL_EXTENSIONS", target: "extensionOutput" });
    // extension background returns either envelope or raw depending on implementation
    const data = res?.data ?? res;
    renderExtensions(data || []);
    const out = $id("extensionOutput");
    if (out) out.textContent = JSON.stringify(data || [], null, 2);
  } catch (err) {
    console.error("loadAllExtensions error", err);
    const out = $id("extensionOutput");
    if (out) out.textContent = String(err);
  }
}

function renderExtensions(exts) {
  const grid = $id("extensionsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (exts || []).forEach(ext => {
    const card = document.createElement("div");
    card.className = "extension-card";

    const icon = document.createElement("img");
    icon.className = "extension-icon";
    icon.src = (ext.icons && ext.icons.length) ? ext.icons[ext.icons.length - 1].url : "";

    const info = document.createElement("div");
    info.className = "extension-info";

    const name = document.createElement("div");
    name.className = "extension-name";
    name.textContent = ext.name || ext.id;

    const desc = document.createElement("div");
    desc.className = "extension-desc";
    desc.textContent = ext.description || "";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "switch";

    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = !!ext.enabled;
    toggleInput.addEventListener("change", async () => {
      try {
        await sendToExtension({ action: "SET_EXTENSION_ENABLED", id: ext.id, enabled: toggleInput.checked, target: "extensionOutput" });
        loadAllExtensions();
      } catch (e) {
        console.error("SET_EXTENSION_ENABLED failed", e);
      }
    });

    const slider = document.createElement("span");
    slider.className = "slider";

    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(slider);

    info.appendChild(name);
    info.appendChild(desc);
    info.appendChild(toggleLabel);

    card.appendChild(icon);
    card.appendChild(info);

    grid.appendChild(card);
  });
}

// -----------------------------
// TABS
// -----------------------------
let currentTabs = [];

async function refreshTabs() {
  try {
    const res = await sendToExtension({ action: "LIST_TABS", target: "tabsOutput" });
    const tabs = res?.data ?? res;
    currentTabs = tabs || [];
    renderTabsList(currentTabs);
    const out = $id("tabsOutput");
    if (out) out.textContent = JSON.stringify(currentTabs, null, 2);
  } catch (err) {
    console.error("refreshTabs error", err);
    const out = $id("tabsOutput");
    if (out) out.textContent = String(err);
  }
}

function renderTabsList(tabs) {
  const list = $id("tabsList");
  const injectSelect = $id("injectTabSelect");
  const controlSelect = $id("tabControlSelect");
  const expCSPTabSelect = $id("expCSPTabSelect");

  if (list) list.innerHTML = "";
  if (injectSelect) injectSelect.innerHTML = "";
  if (controlSelect) controlSelect.innerHTML = "";
  if (expCSPTabSelect) expCSPTabSelect.innerHTML = "";

  (tabs || []).forEach(tab => {
    if (list) {
      const li = document.createElement("li");
      li.textContent = `[${tab.id}] ${tab.title} — ${tab.url}`;
      list.appendChild(li);
    }

    const makeOpt = (sel) => {
      if (!sel) return;
      const opt = document.createElement("option");
      opt.value = tab.id;
      opt.textContent = `[${tab.id}] ${tab.title}`;
      sel.appendChild(opt);
    };

    makeOpt(injectSelect);
    makeOpt(controlSelect);
    makeOpt(expCSPTabSelect);
  });
}

$id("refreshTabs").onclick = refreshTabs;

function getSelectedTabId(selectId) {
  const sel = $id(selectId);
  if (!sel) return 0;
  return parseInt(sel.value || "0", 10);
}

$id("closeTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "CLOSE_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("reloadTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "RELOAD_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("muteTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "MUTE_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("unmuteTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "UNMUTE_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("pinTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "PIN_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("unpinTab").onclick = async () => {
  const tabId = getSelectedTabId("tabControlSelect");
  await sendToExtension({ action: "UNPIN_TAB", tabId, target: "tabsOutput" }).catch(e => console.error(e));
  refreshTabs();
};

$id("openViewer").onclick = async () => {
  await sendToExtension({ action: "OPEN_TAB_VIEWER", target: "tabsOutput" }).catch(e => console.error(e));
};

// -----------------------------
// SCRIPT INJECTOR
// -----------------------------
$id("injectScript").onclick = async () => {
  const tabId = getSelectedTabId("injectTabSelect");
  const code = $id("scriptInput").value;
  if (!tabId || !code) return alert("Select a tab and provide script code");
  try {
    const res = await sendToExtension({ action: "INJECT_SCRIPT", tabId, code, useScripting: true, target: "injectOutput" });
    const out = $id("injectOutput");
    if (out) out.textContent = JSON.stringify(res, null, 2);
  } catch (err) {
    console.error("injectScript error", err);
    const out = $id("injectOutput");
    if (out) out.textContent = String(err);
  }
};

// Presets
const presets = {
  alertHi: `alert("hi");`,
  logUrl: `console.log("URL:", window.location.href);`,
  highlightLinks: `
document.querySelectorAll('a').forEach(a => {
  a.style.background = 'yellow';
  a.style.color = 'black';
});
  `,
  removeImages: `
document.querySelectorAll('img').forEach(img => img.remove());
  `,
  rainbowBg: `
document.body.style.background = "linear-gradient(45deg, red, orange, yellow, green, blue, purple)";
  `,
  invertColors: `
document.documentElement.style.filter = "invert(1)";
  `,
  bigCursor: `
document.body.style.cursor = "crosshair";
  `,
  removeCSS: `
document.querySelectorAll('style, link[rel="stylesheet"]').forEach(e => e.remove());
  `,
  autoScroll: `
setInterval(() => window.scrollBy(0, 50), 200);
  `,
  spamConsole: `
setInterval(() => console.log("Browser Manager!"), 100);
  `
};

(function populatePresets() {
  const presetDropdown = $id("presetDropdown");
  if (!presetDropdown) return;
  Object.entries(presets).forEach(([key]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key;
    presetDropdown.appendChild(opt);
  });

  presetDropdown.addEventListener("change", () => {
    const key = presetDropdown.value;
    if (presets[key]) {
      $id("scriptInput").value = presets[key].trim();
    }
  });
})();

// -----------------------------
// HISTORY
// -----------------------------
$id("searchHistory").onclick = async () => {
  const text = $id("historySearch").value || "";
  try {
    const res = await sendToExtension({ action: "GET_HISTORY", text, maxResults: 100, target: "historyOutput" });
    const data = res?.data ?? res;
    $id("historyOutput").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("searchHistory error", err);
    $id("historyOutput").textContent = String(err);
  }
};

// -----------------------------
// DOWNLOADS
// -----------------------------
$id("listDownloads").onclick = async () => {
  try {
    const res = await sendToExtension({ action: "LIST_DOWNLOADS", query: {}, target: "downloadsOutput" });
    const data = res?.data ?? res;
    $id("downloadsOutput").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("listDownloads error", err);
    $id("downloadsOutput").textContent = String(err);
  }
};

// -----------------------------
// USER SCRIPTS
// -----------------------------
$id("loadUserScripts").onclick = async () => {
  try {
    const res = await sendToExtension({ action: "LIST_USER_SCRIPTS", target: "userScriptsOutput" });
    const scripts = res?.data ?? res;
    renderUserScripts(scripts || []);
    populateSavedScriptDropdown(scripts || []);
    $id("userScriptsOutput").textContent = JSON.stringify(scripts || [], null, 2);
  } catch (err) {
    console.error("loadUserScripts error", err);
    $id("userScriptsOutput").textContent = String(err);
  }
};

$id("saveUserScript").onclick = async () => {
  const id = $id("usId").value.trim() || crypto.randomUUID();
  const name = $id("usName").value.trim() || id;
  const matchesRaw = $id("usMatches").value.trim();
  const code = $id("usCode").value;
  const auto = $id("usAuto").checked;
  const runAt = $id("usRunAt").value || "document_end";

  const matches = matchesRaw ? matchesRaw.split("\n").map(s => s.trim()).filter(Boolean) : ["<all_urls>"];
  const script = { id, name, matches, code, auto, runAt };

  try {
    const res = await sendToExtension({ action: "SAVE_USER_SCRIPT", script, target: "userScriptsOutput" });
    $id("userScriptsOutput").textContent = JSON.stringify(res, null, 2);
    // reload list
    await $id("loadUserScripts").click();
  } catch (err) {
    console.error("saveUserScript error", err);
    $id("userScriptsOutput").textContent = String(err);
  }
};

function renderUserScripts(scripts) {
  const list = $id("userScriptsList");
  if (!list) return;
  list.innerHTML = "";

  (scripts || []).forEach(script => {
    const item = document.createElement("div");
    item.className = "user-script-item";

    const title = document.createElement("div");
    title.className = "user-script-title";
    title.textContent = `${script.name} (${script.id})`;

    const meta = document.createElement("div");
    meta.className = "user-script-meta";
    meta.textContent = `Matches: ${script.matches?.join(", ") || "<all_urls>"} | runAt: ${script.runAt || "document_end"} | auto: ${script.auto ? "yes" : "no"}`;

    const buttons = document.createElement("div");
    buttons.className = "user-script-buttons";

    const runBtn = document.createElement("button");
    runBtn.textContent = "Run now (current tab)";
    runBtn.onclick = async () => {
      const tabId = getSelectedTabId("injectTabSelect");
      if (!tabId) return alert("Select a tab first");
      try {
        const res = await sendToExtension({ action: "INJECT_SCRIPT", tabId, code: script.code, target: "injectOutput" });
        $id("injectOutput").textContent = JSON.stringify(res, null, 2);
      } catch (e) {
        console.error(e);
      }
    };

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load into editor";
    loadBtn.onclick = () => {
      $id("usId").value = script.id;
      $id("usName").value = script.name || "";
      $id("usMatches").value = (script.matches || ["<all_urls>"]).join("\n");
      $id("usCode").value = script.code || "";
      $id("usAuto").checked = !!script.auto;
      $id("usRunAt").value = script.runAt || "document_end";
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      if (!confirm("Delete script " + script.name + "?")) return;
      try {
        const res = await sendToExtension({ action: "DELETE_USER_SCRIPT", id: script.id, target: "userScriptsOutput" });
        $id("userScriptsOutput").textContent = JSON.stringify(res, null, 2);
        await $id("loadUserScripts").click();
      } catch (e) {
        console.error(e);
      }
    };

    buttons.appendChild(runBtn);
    buttons.appendChild(loadBtn);
    buttons.appendChild(deleteBtn);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(buttons);

    list.appendChild(item);
  });
}

function populateSavedScriptDropdown(scripts) {
  const dropdown = $id("savedScriptDropdown");
  if (!dropdown) return;
  dropdown.innerHTML = `<option value="">Select a saved script...</option>`;
  (scripts || []).forEach(script => {
    const opt = document.createElement("option");
    opt.value = script.id;
    opt.textContent = script.name;
    dropdown.appendChild(opt);
  });
}

$id("runSavedScript").onclick = async () => {
  const tabId = getSelectedTabId("injectTabSelect");
  if (!tabId) return alert("Select a tab first");
  const scriptId = $id("savedScriptDropdown").value;
  if (!scriptId) return alert("Select a saved script first");

  try {
    // Request list and then inject the selected script
    const res = await sendToExtension({ action: "LIST_USER_SCRIPTS", target: "injectOutput" });
    const scripts = res?.data ?? res;
    const script = (scripts || []).find(s => s.id === scriptId);
    if (!script) return alert("Script not found");
    const inj = await sendToExtension({ action: "INJECT_SCRIPT", tabId, code: script.code, target: "injectOutput" });
    $id("injectOutput").textContent = JSON.stringify(inj, null, 2);
  } catch (err) {
    console.error("runSavedScript error", err);
  }
};

// -----------------------------
// NOTIFICATIONS
// -----------------------------
function updateNotificationStatus() {
  $id("notifPermission").textContent = Notification.permission;
}
updateNotificationStatus();

$id("requestNotifPermission").onclick = async () => {
  const result = await Notification.requestPermission();
  $id("notifPermission").textContent = result;
};

$id("sendCustomNotif").onclick = async () => {
  const title = $id("notifTitle").value.trim();
  const body = $id("notifBody").value.trim();
  const icon = $id("notifIcon").value.trim();
  if (!title) return alert("Notification title required");
  try {
    const res = await sendToExtension({ action: "SEND_CUSTOM_NOTIFICATION", title, body, icon, target: "notifOutput" });
    $id("notifOutput").textContent = JSON.stringify(res, null, 2);
  } catch (err) {
    console.error("sendCustomNotif error", err);
    $id("notifOutput").textContent = String(err);
  }
};

// -----------------------------
// EXPERIMENTAL SETTINGS — CSP Disable
// -----------------------------
$id("applyExperimental").onclick = async () => {
  const disableCSP = $id("expDisableCSP").checked;
  const tabId = getSelectedTabId("expCSPTabSelect");
  if (!tabId) return alert("Select a tab for experimental CSP change");
  try {
    const res = await sendToExtension({ action: "EXPERIMENTAL_UPDATE", disableCSP, tabId, target: "experimentalOutput" });
    $id("experimentalOutput").textContent = JSON.stringify(res, null, 2);
  } catch (err) {
    console.error("applyExperimental error", err);
    $id("experimentalOutput").textContent = String(err);
  }
};

// -----------------------------
// Port-based push subscription (optional)
// -----------------------------
function requestPushSubscription() {
  if (!extPort) {
    try {
      extPort = chrome.runtime.connect(EXT_ID, { name: "web-ui-port" });
      extPort.onMessage.addListener(handlePortMessage);
      extPort.onDisconnect.addListener(() => { extPort = null; });
    } catch (e) {
      console.warn("Could not open port to extension", e);
    }
  }
  // Send a handshake so the extension can register this port if it wants
  try {
    if (extPort) extPort.postMessage({ action: "WEB_UI_HANDSHAKE", origin: location.origin });
  } catch (e) {}
}

// -----------------------------
// Initial load
// -----------------------------
(async function init() {
  if (EXT_ID === "REPLACE_WITH_YOUR_EXTENSION_ID") {
    console.warn("EXT_ID not set in ui.js. Set EXT_ID to your extension id (chrome://extensions).");
  }

  // Try to open port and handshake
  requestPushSubscription();

  // Load initial data
  await loadAllExtensions().catch(e => console.error(e));
  await refreshTabs().catch(e => console.error(e));
  // Trigger load user scripts
  try { $id("loadUserScripts").click(); } catch (e) {}
})();
