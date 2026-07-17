// ui.js — Website UI controller (Scripts integrated with userScripts flow)
// Requires window.EXT_ID to be set in index.html to your extension ID.

const EXT_ID = window.EXT_ID || "REPLACE_WITH_YOUR_EXTENSION_ID";

function sendToExtension(payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let done = false;
    try {
      chrome.runtime.sendMessage(EXT_ID, payload, (resp) => {
        done = true;
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(resp);
      });
    } catch (e) {
      return reject(e);
    }
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (!done) reject(new Error("Extension response timed out"));
      }, timeoutMs);
    }
  });
}

// Optional long-lived port for push events
let extPort = null;
function openPort() {
  if (extPort) return;
  try {
    extPort = chrome.runtime.connect(EXT_ID, { name: "web-ui-port" });
    extPort.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.action === "TABS_UPDATED") refreshTabs();
      if (msg.target && msg.data !== undefined) {
        const el = document.getElementById(msg.target);
        if (el) el.textContent = JSON.stringify(msg.data, null, 2);
      }
    });
    extPort.onDisconnect.addListener(() => { extPort = null; });
    // handshake
    try { extPort.postMessage({ action: "WEB_UI_HANDSHAKE", origin: location.origin }); } catch (e) {}
  } catch (e) {
    console.warn("Port connect failed", e);
    extPort = null;
  }
}

// DOM helpers
const $ = id => document.getElementById(id);

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

// Presets
const presets = {
  alertHi: `alert("hi");`,
  logUrl: `console.log("URL:", window.location.href);`,
  highlightLinks: `document.querySelectorAll('a').forEach(a=>{a.style.background='yellow';a.style.color='black'});`,
  removeImages: `document.querySelectorAll('img').forEach(i=>i.remove());`,
  rainbowBg: `document.body.style.background='linear-gradient(45deg, red, orange, yellow, green, blue, purple)';`,
  invertColors: `document.documentElement.style.filter='invert(1)';`
};
(function populatePresets(){
  const sel = $("presetDropdown");
  if (!sel) return;
  Object.keys(presets).forEach(k=>{
    const o = document.createElement("option");
    o.value = k; o.textContent = k;
    sel.appendChild(o);
  });
  sel.addEventListener("change", ()=> {
    const v = sel.value;
    if (v && presets[v]) $("scriptInput").value = presets[v];
  });
})();

// -----------------------------
// Extensions
// -----------------------------
async function loadAllExtensions() {
  try {
    const resp = await sendToExtension({ action: "GET_ALL_EXTENSIONS", target: "extensionOutput" });
    const data = resp?.data ?? resp;
    renderExtensions(data || []);
    if ($("extensionOutput")) $("extensionOutput").textContent = JSON.stringify(data || [], null, 2);
  } catch (e) {
    console.error("loadAllExtensions", e);
    if ($("extensionOutput")) $("extensionOutput").textContent = String(e);
  }
}
function renderExtensions(exts) {
  const grid = $("extensionsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (exts||[]).forEach(ext=>{
    const card = document.createElement("div"); card.className="extension-card";
    const icon = document.createElement("img"); icon.className="extension-icon";
    icon.src = (ext.icons && ext.icons.length) ? ext.icons[ext.icons.length-1].url : "";
    const info = document.createElement("div"); info.className="extension-info";
    const name = document.createElement("div"); name.className="extension-name"; name.textContent = ext.name || ext.id;
    const desc = document.createElement("div"); desc.className="extension-desc"; desc.textContent = ext.description || "";
    const toggleLabel = document.createElement("label"); toggleLabel.className="switch";
    const toggleInput = document.createElement("input"); toggleInput.type = "checkbox"; toggleInput.checked = !!ext.enabled;
    toggleInput.addEventListener("change", async ()=>{
      try {
        await sendToExtension({ action: "SET_EXTENSION_ENABLED", id: ext.id, enabled: toggleInput.checked, target: "extensionOutput" });
        loadAllExtensions();
      } catch (err) { console.error(err); }
    });
    const slider = document.createElement("span"); slider.className="slider";
    toggleLabel.appendChild(toggleInput); toggleLabel.appendChild(slider);
    info.appendChild(name); info.appendChild(desc); info.appendChild(toggleLabel);
    card.appendChild(icon); card.appendChild(info);
    grid.appendChild(card);
  });
}

// -----------------------------
// Tabs
// -----------------------------
let currentTabs = [];
async function refreshTabs() {
  try {
    const resp = await sendToExtension({ action: "LIST_TABS", target: "tabsOutput" });
    const tabs = resp?.data ?? resp;
    currentTabs = tabs || [];
    renderTabsList(currentTabs);
    if ($("tabsOutput")) $("tabsOutput").textContent = JSON.stringify(currentTabs, null, 2);
  } catch (e) {
    console.error("refreshTabs", e);
    if ($("tabsOutput")) $("tabsOutput").textContent = String(e);
  }
}
function renderTabsList(tabs) {
  const list = $("tabsList"), inject = $("injectTabSelect"), control = $("tabControlSelect"), exp = $("expCSPTabSelect");
  if (list) list.innerHTML = "";
  if (inject) inject.innerHTML = "";
  if (control) control.innerHTML = "";
  if (exp) exp.innerHTML = "";
  (tabs||[]).forEach(tab=>{
    if (list) { const li = document.createElement("li"); li.textContent = `[${tab.id}] ${tab.title} — ${tab.url}`; list.appendChild(li); }
    const addOpt = (sel) => {
      if (!sel) return;
      const o = document.createElement("option"); o.value = tab.id; o.textContent = `[${tab.id}] ${tab.title}`;
      sel.appendChild(o);
    };
    addOpt(inject); addOpt(control); addOpt(exp);
  });
}
$("refreshTabs").onclick = refreshTabs;
function getSelectedTabId(selId) {
  const sel = $(selId); if (!sel) return 0; return parseInt(sel.value||"0",10);
}
$("closeTab").onclick = async ()=> { await sendToExtension({ action:"CLOSE_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("reloadTab").onclick = async ()=> { await sendToExtension({ action:"RELOAD_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("muteTab").onclick = async ()=> { await sendToExtension({ action:"MUTE_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("unmuteTab").onclick = async ()=> { await sendToExtension({ action:"UNMUTE_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("pinTab").onclick = async ()=> { await sendToExtension({ action:"PIN_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("unpinTab").onclick = async ()=> { await sendToExtension({ action:"UNPIN_TAB", tabId:getSelectedTabId("tabControlSelect"), target:"tabsOutput" }).catch(()=>{}); refreshTabs(); };
$("openViewer").onclick = async ()=> { await sendToExtension({ action:"OPEN_TAB_VIEWER", target:"tabsOutput" }).catch(()=>{}); };

// -----------------------------
// Scripts (userScripts integrated)
// -----------------------------

// Load saved scripts into UI
async function loadSavedScripts() {
  try {
    const resp = await sendToExtension({ action: "LIST_USER_SCRIPTS", target: "userScriptsOutput" });
    const scripts = resp?.data ?? resp;
    renderUserScripts(scripts || []);
    populateSavedScriptDropdown(scripts || []);
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = JSON.stringify(scripts || [], null, 2);
  } catch (e) {
    console.error("loadSavedScripts", e);
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = String(e);
  }
}

function populateSavedScriptDropdown(scripts) {
  const dd = $("savedScriptDropdown");
  if (!dd) return;
  dd.innerHTML = `<option value="">Select a saved script...</option>`;
  (scripts||[]).forEach(s => {
    const o = document.createElement("option"); o.value = s.id; o.textContent = s.name || s.id;
    dd.appendChild(o);
  });
}

function renderUserScripts(scripts) {
  const list = $("userScriptsList");
  if (!list) return;
  list.innerHTML = "";
  (scripts||[]).forEach(script => {
    const item = document.createElement("div"); item.className = "user-script-item";
    const title = document.createElement("div"); title.textContent = `${script.name} (${script.id})`; title.style.fontWeight="600";
    const meta = document.createElement("div"); meta.style.color="#a0a4a8"; meta.textContent = `Matches: ${script.matches?.join(", ")||"<all_urls>"} | runAt: ${script.runAt||"document_end"} | auto: ${script.auto?"yes":"no"}`;
    const btns = document.createElement("div"); btns.style.marginTop="8px";
    const run = document.createElement("button"); run.textContent="Run"; run.onclick = async ()=>{
      const tabId = getSelectedTabId("injectTabSelect");
      if (!tabId) return alert("Select a tab first");
      await ensureScriptRegisteredForTab(script, tabId);
      const res = await sendToExtension({ action:"INJECT_SCRIPT", tabId, code: script.code, target:"injectOutput" }).catch(e=>{console.error(e); return {error:String(e)}});
      if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(res, null, 2);
    };
    const load = document.createElement("button"); load.textContent="Load"; load.onclick = ()=> {
      $("usId").value = script.id;
      $("usName").value = script.name || "";
      $("usMatches").value = (script.matches || ["<all_urls>"]).join("\n");
      $("usCode").value = script.code || "";
      $("usRunAt").value = script.runAt || "document_end";
      $("toggleAuto").textContent = script.auto ? "Auto: On" : "Auto: Off";
      $("toggleAuto").dataset.auto = script.auto ? "true" : "false";
      $("autoStatus").textContent = script.auto ? "Auto-execute enabled" : "Auto-execute disabled";
    };
    const del = document.createElement("button"); del.textContent="Delete"; del.onclick = async ()=>{
      if (!confirm("Delete script "+script.name+"?")) return;
      const resp = await sendToExtension({ action:"DELETE_USER_SCRIPT", id: script.id, target:"userScriptsOutput" }).catch(e=>{console.error(e); return {error:String(e)}});
      await loadSavedScripts();
      if ($("userScriptsOutput")) $("userScriptsOutput").textContent = JSON.stringify(resp, null, 2);
    };
    btns.appendChild(run); btns.appendChild(load); btns.appendChild(del);
    item.appendChild(title); item.appendChild(meta); item.appendChild(btns);
    list.appendChild(item);
  });
}

// Save script (creates or updates savedScripts and registers if auto)
$("saveUserScript").onclick = async () => {
  const id = ($("usId").value || "").trim() || crypto.randomUUID();
  const name = ($("usName").value || "").trim() || id;
  const matchesRaw = ($("usMatches").value || "").trim();
  const code = ($("usCode").value || "");
  const auto = $("toggleAuto").dataset?.auto === "true";
  const runAt = $("usRunAt").value || "document_end";
  const matches = matchesRaw ? matchesRaw.split("\n").map(s=>s.trim()).filter(Boolean) : ["<all_urls>"];
  const script = { id, name, matches, code, auto, runAt };
  try {
    const resp = await sendToExtension({ action:"SAVE_USER_SCRIPT", script, target:"userScriptsOutput" });
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = JSON.stringify(resp, null, 2);
    await loadSavedScripts();
  } catch (e) {
    console.error("saveUserScript", e);
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = String(e);
  }
};

// Save and run: save script, ensure registration for the selected tab, then inject
$("saveAndRun").onclick = async () => {
  const tabId = getSelectedTabId("injectTabSelect");
  if (!tabId) return alert("Select a tab first");
  await $("saveUserScript").click();
  // After save, load saved scripts and find the script by id
  const id = ($("usId").value || "").trim();
  try {
    const resp = await sendToExtension({ action:"LIST_USER_SCRIPTS", target:"injectOutput" });
    const scripts = resp?.data ?? resp;
    const script = (scripts||[]).find(s=>s.id===id) || scripts?.[scripts.length-1];
    if (!script) return alert("Saved script not found");
    await ensureScriptRegisteredForTab(script, tabId);
    const inj = await sendToExtension({ action:"INJECT_SCRIPT", tabId, code: script.code, target:"injectOutput" });
    if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(inj, null, 2);
  } catch (e) {
    console.error("saveAndRun", e);
  }
};

// Ensure a script is registered for a specific tab's URL (registers a userScript with matches containing the tab's origin if needed)
async function ensureScriptRegisteredForTab(script, tabId) {
  try {
    // Get tab info to build a match for this tab
    const tabsResp = await sendToExtension({ action:"LIST_TABS", target:"tabsOutput" });
    const tabs = tabsResp?.data ?? tabsResp;
    const tab = (tabs||[]).find(t=>t.id === tabId) || null;
    if (!tab) return;
    const url = new URL(tab.url);
    const originMatch = `${url.protocol}//${url.host}/*`;

    // If script already matches this origin, nothing to do
    if ((script.matches||[]).some(m => m === "<all_urls>" || m === originMatch || m === url.origin || m === tab.url)) {
      return;
    }

    // Otherwise, create a temporary registration for this tab by saving a copy with the origin added (non-destructive)
    const tempScript = Object.assign({}, script);
    tempScript.matches = Array.from(new Set([...(script.matches||[]), originMatch]));

    // Save the temp script under same id (this will update savedScripts and register/unregister as background handles)
    await sendToExtension({ action:"SAVE_USER_SCRIPT", script: tempScript, target:"userScriptsOutput" });
    // small delay to allow background to register
    await new Promise(r => setTimeout(r, 250));
  } catch (e) {
    console.error("ensureScriptRegisteredForTab", e);
  }
}

// Run saved script (selected in dropdown)
$("runSavedScript").onclick = async () => {
  const tabId = getSelectedTabId("injectTabSelect");
  if (!tabId) return alert("Select a tab first");
  const scriptId = $("savedScriptDropdown").value;
  if (!scriptId) return alert("Select a saved script first");
  try {
    const resp = await sendToExtension({ action:"LIST_USER_SCRIPTS", target:"injectOutput" });
    const scripts = resp?.data ?? resp;
    const script = (scripts||[]).find(s=>s.id===scriptId);
    if (!script) return alert("Script not found");
    await ensureScriptRegisteredForTab(script, tabId);
    const inj = await sendToExtension({ action:"INJECT_SCRIPT", tabId, code: script.code, target:"injectOutput" });
    if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(inj, null, 2);
  } catch (e) {
    console.error("runSavedScript", e);
  }
};

// Load selected script into editor
$("loadSelectedScript").onclick = async () => {
  const id = $("savedScriptDropdown").value;
  if (!id) return alert("Select a saved script");
  try {
    const resp = await sendToExtension({ action:"LIST_USER_SCRIPTS", target:"userScriptsOutput" });
    const scripts = resp?.data ?? resp;
    const script = (scripts||[]).find(s=>s.id===id);
    if (!script) return alert("Script not found");
    $("usId").value = script.id;
    $("usName").value = script.name || "";
    $("usMatches").value = (script.matches || ["<all_urls>"]).join("\n");
    $("usCode").value = script.code || "";
    $("usRunAt").value = script.runAt || "document_end";
    $("toggleAuto").textContent = script.auto ? "Auto: On" : "Auto: Off";
    $("toggleAuto").dataset.auto = script.auto ? "true" : "false";
    $("autoStatus").textContent = script.auto ? "Auto-execute enabled" : "Auto-execute disabled";
  } catch (e) {
    console.error("loadSelectedScript", e);
  }
};

// Delete selected script
$("deleteSelectedScript").onclick = async () => {
  const id = $("savedScriptDropdown").value;
  if (!id) return alert("Select a saved script");
  if (!confirm("Delete script?")) return;
  try {
    const resp = await sendToExtension({ action:"DELETE_USER_SCRIPT", id, target:"userScriptsOutput" });
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = JSON.stringify(resp, null, 2);
    await loadSavedScripts();
  } catch (e) {
    console.error("deleteSelectedScript", e);
  }
};

// Toggle auto-execute button
$("toggleAuto").onclick = () => {
  const cur = $("toggleAuto").dataset.auto === "true";
  $("toggleAuto").dataset.auto = (!cur).toString();
  $("toggleAuto").textContent = !cur ? "Auto: On" : "Auto: Off";
  $("autoStatus").textContent = !cur ? "Auto-execute enabled" : "Auto-execute disabled";
};

// One-off injection (quick editor)
$("injectScript").onclick = async () => {
  const tabId = getSelectedTabId("injectTabSelect");
  const code = $("scriptInput").value;
  if (!tabId || !code) return alert("Select a tab and provide script code");
  try {
    const resp = await sendToExtension({ action:"INJECT_SCRIPT", tabId, code, useScripting: true, target:"injectOutput" });
    if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(resp, null, 2);
  } catch (e) {
    console.error("injectScript", e);
    if ($("injectOutput")) $("injectOutput").textContent = String(e);
  }
};

// -----------------------------
// History / Downloads / Notifications
// -----------------------------
$("searchHistory").onclick = async () => {
  const text = $("historySearch").value || "";
  try {
    const resp = await sendToExtension({ action:"GET_HISTORY", text, maxResults:100, target:"historyOutput" });
    const data = resp?.data ?? resp;
    if ($("historyOutput")) $("historyOutput").textContent = JSON.stringify(data, null, 2);
  } catch (e) { console.error(e); if ($("historyOutput")) $("historyOutput").textContent = String(e); }
};

$("listDownloads").onclick = async () => {
  try {
    const resp = await sendToExtension({ action:"LIST_DOWNLOADS", query:{}, target:"downloadsOutput" });
    const data = resp?.data ?? resp;
    if ($("downloadsOutput")) $("downloadsOutput").textContent = JSON.stringify(data, null, 2);
  } catch (e) { console.error(e); if ($("downloadsOutput")) $("downloadsOutput").textContent = String(e); }
};

function updateNotificationStatus() { $("notifPermission").textContent = Notification.permission; }
updateNotificationStatus();
$("requestNotifPermission").onclick = async () => { const r = await Notification.requestPermission(); $("notifPermission").textContent = r; };
$("sendCustomNotif").onclick = async () => {
  const title = $("notifTitle").value.trim(); const body = $("notifBody").value.trim(); const icon = $("notifIcon").value.trim();
  if (!title) return alert("Notification title required");
  try {
    const resp = await sendToExtension({ action:"SEND_CUSTOM_NOTIFICATION", title, body, icon, target:"notifOutput" });
    if ($("notifOutput")) $("notifOutput").textContent = JSON.stringify(resp, null, 2);
  } catch (e) { console.error(e); if ($("notifOutput")) $("notifOutput").textContent = String(e); }
};

// -----------------------------
// Experimental CSP toggle (static declarativeNetRequest ruleset integration)
// -----------------------------
// This replaces the previous debugger-based approach and toggles the static ruleset declared in manifest.rule_resources.
// It sends EXPRIMENTAL_UPDATE with useStaticRuleset: true so the background enables/disables the "csp_ruleset".

let cspRulesetEnabled = false;

function updateCspToggleUI(enabled) {
  cspRulesetEnabled = !!enabled;
  const btn = document.getElementById("expToggleCSP");
  const status = document.getElementById("expCSPStatus");
  if (btn) btn.textContent = `Remove CSP Headers: ${cspRulesetEnabled ? "On" : "Off"}`;
  if (status) status.textContent = cspRulesetEnabled ? "CSP removal active (static ruleset)" : "CSP removal inactive";
}

async function toggleStaticCspForTab() {
  const tabSel = document.getElementById("expCSPTabSelect");
  const out = document.getElementById("experimentalOutput");
  const tabId = parseInt(tabSel?.value || 0, 10);
  if (!tabId) {
    alert("Select a tab to scope the action (UI uses tab for context).");
    return;
  }

  const newState = !cspRulesetEnabled;
  if (out) out.textContent = "Updating ruleset…";

  try {
    const resp = await sendToExtension({
      action: "EXPERIMENTAL_UPDATE",
      disableCSP: newState,
      tabId,
      useStaticRuleset: true,
      target: "experimentalOutput"
    });

    const data = resp?.data ?? resp;
    if (data?.error) {
      if (out) out.textContent = `Error: ${data.error}`;
      return;
    }

    updateCspToggleUI(newState);
    if (out) out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    if (out) out.textContent = `RPC error: ${String(err)}`;
  }
}

$("expToggleCSP").onclick = toggleStaticCspForTab;

// Initialize CSP UI to off (background is authoritative; UI assumes off until toggled)
updateCspToggleUI(false);

// -----------------------------
// Initial load
// -----------------------------
(async function init() {
  if (EXT_ID === "REPLACE_WITH_YOUR_EXTENSION_ID") {
    console.warn("EXT_ID not set. Set window.EXT_ID in index.html to your extension id.");
  }
  openPort();
  await loadAllExtensions().catch(()=>{});
  await refreshTabs().catch(()=>{});
  await loadSavedScripts().catch(()=>{});
})();
