// ui.js — front-end controller

function sendToExtension(payload) {
  window.postMessage({ type: "BM_COMMAND", payload }, "*");
}

// Generic response handler for raw output
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

// EXTENSION MANAGER (ALL extensions)
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
      if (ext.icons && ext.icons.length) {
        icon.src = ext.icons[ext.icons.length - 1].url;
      } else {
        icon.src = "";
      }

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
      toggleInput.checked = !!ext.enabled;
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

// Tab viewer: open extension page
document.getElementById("openViewer").onclick = () => {
  sendToExtension({
    action: "OPEN_TAB_VIEWER",
    target: "tabsOutput"
  });
};

// SCRIPT INJECTOR — Immediate execution (no reload)
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

// 10 SCRIPT PRESETS
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
    document.body.style.cursor = "url('https://cur.cursors-4u.net/cursors/cur-2/cur115.cur'), auto";
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

// Populate dropdown
const presetDropdown = document.getElementById("presetDropdown");
Object.entries(presets).forEach(([key, value]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = key;
  presetDropdown.appendChild(opt);
});

// Load preset into textarea
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

// Initial load
loadAllExtensions();
refreshTabs();
