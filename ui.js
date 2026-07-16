// ui.js — front-end controller + userScripts UI

function sendToExtension(payload) {
  window.postMessage({ type: "BM_COMMAND", payload }, "*");
}

// Handle extension responses + dynamic tab updates
window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;

  const payload = event.data.payload || {};
  const { target, data, action } = payload;

  if (action === "TABS_UPDATED") {
    refreshTabs();
    return;
  }

  if (target) {
    const el = document.getElementById(target);
    if (el) el.textContent = JSON.stringify(data, null, 2);
  }

  if (target === "userScriptsOutput") {
    renderUserScripts(data || []);
  }
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
function loadAllExtensions() {
  sendToExtension({
    action: "GET_ALL_EXTENSIONS",
    target: "extensionOutput"
  });
}

window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;
  const { target, data } = event.data.payload;

  if (target === "extensionOutput" && Array.isArray(data)) {
    const grid = document.getElementById("extensionsGrid");
    grid.innerHTML = "";

    data.forEach(ext => {
      const card = document.createElement("div");
      card.className = "extension-card";

      const icon = document.createElement("img");
      icon.className = "extension-icon";
      icon.src = ext.icons?.[ext.icons.length - 1]?.url || "";

      const info = document.createElement("div");
      info.className = "extension-info";

      const name = document.createElement("div");
      name.className = "extension-name";
      name.textContent = ext.name;

      const desc = document.createElement("div");
      desc.className = "extension-desc";
      desc.textContent = ext.description || "";

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "switch";

      const toggleInput = document.createElement("input");
      toggleInput.type = "checkbox";
      toggleInput.checked = ext.enabled;
      toggleInput.addEventListener("change", () => {
        sendToExtension({
          action: "SET_EXTENSION_ENABLED",
          id: ext.id,
          enabled: toggleInput.checked,
          target: "extensionOutput"
        });
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

function getSelectedTabId(selectId) {
  return parseInt(document.getElementById(selectId).value || "0", 10);
}

document.getElementById("closeTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "CLOSE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("reloadTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "RELOAD_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("muteTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "MUTE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("unmuteTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "UNMUTE_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("pinTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "PIN_TAB", tabId, target: "tabsOutput" });
};

document.getElementById("unpinTab").onclick = () => {
  const tabId = getSelectedTabId("tabControlSelect");
  if (tabId) sendToExtension({ action: "UNPIN_TAB", tabId, target: "tabsOutput" });
};

// Tab viewer
document.getElementById("openViewer").onclick = () => {
  sendToExtension({
    action: "OPEN_TAB_VIEWER",
    target: "tabsOutput"
  });
};

// SCRIPT INJECTOR — immediate execution
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

// Presets (same as before)
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

const presetDropdown = document.getElementById("presetDropdown");
Object.entries(presets).forEach(([key]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = key;
  presetDropdown.appendChild(opt);
});

presetDropdown.addEventListener("change", () => {
  const key = presetDropdown.value;
  if (presets[key]) {
    document.getElementById("scriptInput").value = presets[key].trim();
  }
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

// USER SCRIPTS UI

document.getElementById("loadUserScripts").onclick = () => {
  sendToExtension({
    action: "LIST_USER_SCRIPTS",
    target: "userScriptsOutput"
  });
};

document.getElementById("saveUserScript").onclick = () => {
  const id = document.getElementById("usId").value.trim() || crypto.randomUUID();
  const name = document.getElementById("usName").value.trim() || id;
  const matchesRaw = document.getElementById("usMatches").value.trim();
  const code = document.getElementById("usCode").value;
  const auto = document.getElementById("usAuto").checked;
  const runAt = document.getElementById("usRunAt").value || "document_end";

  const matches = matchesRaw
    ? matchesRaw.split("\n").map(s => s.trim()).filter(Boolean)
    : ["<all_urls>"];

  const script = { id, name, matches, code, auto, runAt };

  sendToExtension({
    action: "SAVE_USER_SCRIPT",
    script,
    target: "userScriptsOutput"
  });
};

function renderUserScripts(scripts) {
  const list = document.getElementById("userScriptsList");
  list.innerHTML = "";

  scripts.forEach(script => {
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
    runBtn.onclick = () => {
      const tabId = getSelectedTabId("injectTabSelect");
      if (!tabId) return;
      sendToExtension({
        action: "INJECT_SCRIPT",
        tabId,
        code: script.code,
        target: "injectOutput"
      });
    };

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load into editor";
    loadBtn.onclick = () => {
      document.getElementById("usId").value = script.id;
      document.getElementById("usName").value = script.name || "";
      document.getElementById("usMatches").value = (script.matches || ["<all_urls>"]).join("\n");
      document.getElementById("usCode").value = script.code || "";
      document.getElementById("usAuto").checked = !!script.auto;
      document.getElementById("usRunAt").value = script.runAt || "document_end";
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = () => {
      sendToExtension({
        action: "DELETE_USER_SCRIPT",
        id: script.id,
        target: "userScriptsOutput"
      });
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

// Initial load
loadAllExtensions();
refreshTabs();
document.getElementById("loadUserScripts").click();
