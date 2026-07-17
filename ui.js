// ui.js — Clean Scripts UI
// Requires window.EXT_ID set in index.html
const EXT_ID = window.EXT_ID || "jldkgbjadfmjfnjlnkpbmbkogimecpng";
const $ = id => document.getElementById(id);

// Basic RPC helper
function sendToExtension(payload, timeout = 8000) {
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
    if (!done && timeout) setTimeout(() => { if (!done) reject(new Error("Extension timed out")); }, timeout);
  });
}

// Try open port for push updates (optional)
function tryOpenPort() {
  try {
    const port = chrome.runtime.connect(EXT_ID, { name: "web-ui-port" });
    port.onMessage.addListener(msg => {
      if (!msg) return;
      if (msg.action === "TABS_UPDATED") refreshTabs();
    });
    port.onDisconnect.addListener(() => {});
  } catch (e) {}
}

/* ---------------- Tabs ---------------- */
let currentTabs = [];
async function refreshTabs() {
  try {
    const res = await sendToExtension({ action: "LIST_TABS" });
    const tabs = res?.data ?? res ?? [];
    currentTabs = tabs;
    renderTabs();
  } catch (e) {
    console.error("refreshTabs", e);
  }
}
function renderTabs() {
  const list = $("tabsList"), inject = $("injectTabSelect"), control = $("tabControlSelect"), exp = $("expCSPTabSelect");
  if (list) list.innerHTML = "";
  [inject, control, exp].forEach(s => { if (s) s.innerHTML = ""; });
  (currentTabs || []).forEach(t => {
    if (list) {
      const li = document.createElement("li");
      li.textContent = `[${t.id}] ${t.title || t.url}`;
      list.appendChild(li);
    }
    const addOpt = sel => {
      if (!sel) return;
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = `[${t.id}] ${t.title || t.url}`;
      sel.appendChild(o);
    };
    addOpt(inject); addOpt(control); addOpt(exp);
  });
}
$("refreshTabs").onclick = refreshTabs;
$("reloadTab").onclick = async () => { await sendToExtension({ action: "RELOAD_TAB", tabId: parseInt($("tabControlSelect").value||0) }).catch(()=>{}); refreshTabs(); };
$("closeTab").onclick = async () => { await sendToExtension({ action: "CLOSE_TAB", tabId: parseInt($("tabControlSelect").value||0) }).catch(()=>{}); refreshTabs(); };
$("muteTab").onclick = async () => { await sendToExtension({ action: "MUTE_TAB", tabId: parseInt($("tabControlSelect").value||0) }).catch(()=>{}); refreshTabs(); };
$("unmuteTab").onclick = async () => { await sendToExtension({ action: "UNMUTE_TAB", tabId: parseInt($("tabControlSelect").value||0) }).catch(()=>{}); refreshTabs(); };

/* --------------- Extensions --------------- */
async function loadAllExtensions() {
  try {
    const res = await sendToExtension({ action: "GET_ALL_EXTENSIONS" });
    const exts = res?.data ?? res ?? [];
    renderExtensions(exts);
    if ($("extensionOutput")) $("extensionOutput").textContent = JSON.stringify(exts, null, 2);
  } catch (e) { console.error("loadAllExtensions", e); }
}
function renderExtensions(exts) {
  const grid = $("extensionsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (exts||[]).forEach(ext => {
    const card = document.createElement("div"); card.className = "extension-card";
    const icon = document.createElement("img"); icon.className = "extension-icon"; icon.src = (ext.icons && ext.icons.length) ? ext.icons[ext.icons.length-1].url : "";
    const info = document.createElement("div"); info.className = "extension-info";
    const name = document.createElement("div"); name.className = "extension-name"; name.textContent = ext.name || ext.id;
    const desc = document.createElement("div"); desc.className = "extension-desc"; desc.textContent = ext.description || "";
    const toggle = document.createElement("label"); toggle.className = "switch";
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!ext.enabled;
    input.addEventListener("change", async () => { await sendToExtension({ action: "SET_EXTENSION_ENABLED", id: ext.id, enabled: input.checked }).catch(()=>{}); loadAllExtensions(); });
    const slider = document.createElement("span"); slider.className = "slider";
    toggle.appendChild(input); toggle.appendChild(slider);
    info.appendChild(name); info.appendChild(desc); info.appendChild(toggle);
    card.appendChild(icon); card.appendChild(info);
    grid.appendChild(card);
  });
}

/* --------------- Scripts (clean) --------------- */

async function loadSavedScripts() {
  try {
    const resp = await sendToExtension({ action: "LIST_USER_SCRIPTS" });
    const scripts = resp?.data ?? resp ?? [];
    populateSavedDropdown(scripts);
    renderSavedList(scripts);
    if ($("userScriptsOutput")) $("userScriptsOutput").textContent = JSON.stringify(scripts, null, 2);
  } catch (e) { console.error("loadSavedScripts", e); }
}

function populateSavedDropdown(scripts) {
  const dd = $("savedScriptDropdown");
  if (!dd) return;
  dd.innerHTML = `<option value="">— select —</option>`;
  (scripts||[]).forEach(s => {
    const o = document.createElement("option"); o.value = s.id; o.textContent = s.name || s.id;
    dd.appendChild(o);
  });
}

function renderSavedList(scripts) {
  const container = $("userScriptsList");
  if (!container) return;
  container.innerHTML = "";
  (scripts||[]).forEach(s => {
    const item = document.createElement("div"); item.className = "user-script-item";
    item.style.padding = "8px"; item.style.marginBottom = "8px"; item.style.borderRadius = "6px"; item.style.background = "rgba(255,255,255,0.02)";
    const title = document.createElement("div"); title.style.fontWeight = 600; title.textContent = s.name || s.id;
    const meta = document.createElement("div"); meta.style.color = "#a0a4a8"; meta.style.fontSize = "0.9rem"; meta.style.marginTop = "6px";
    meta.textContent = `runAt: ${s.runAt || "document_end"} • auto: ${s.auto ? "yes" : "no"}`;
    const btnRow = document.createElement("div"); btnRow.style.marginTop = "8px"; btnRow.style.display = "flex"; btnRow.style.gap = "8px";
    const runBtn = document.createElement("button"); runBtn.textContent = "Run"; runBtn.onclick = async () => runSavedScriptById(s.id);
    const editBtn = document.createElement("button"); editBtn.textContent = "Edit"; editBtn.onclick = () => loadScriptIntoEditor(s);
    btnRow.appendChild(runBtn); btnRow.appendChild(editBtn);
    item.appendChild(title); item.appendChild(meta); item.appendChild(btnRow);
    container.appendChild(item);
  });
}

function loadScriptIntoEditor(script) {
  $("savedScriptDropdown").value = script.id;
  $("usName").value = script.name || "";
  $("usMatches").value = (script.matches || ["<all_urls>"]).join("\n");
  $("usCode").value = script.code || "";
  $("usRunAt").value = script.runAt || "document_end";
  $("toggleAuto").dataset.auto = script.auto ? "true" : "false";
  $("toggleAuto").textContent = script.auto ? "Auto: On" : "Auto: Off";
}

$("loadSelectedScript").onclick = async () => {
  const id = $("savedScriptDropdown").value;
  if (!id) return alert("Select a script");
  const resp = await sendToExtension({ action: "LIST_USER_SCRIPTS" }).catch(()=>null);
  const scripts = resp?.data ?? resp ?? [];
  const script = scripts.find(s => s.id === id);
  if (script) loadScriptIntoEditor(script);
};

$("deleteSelectedScript").onclick = async () => {
  const id = $("savedScriptDropdown").value;
  if (!id) return alert("Select a script");
  if (!confirm("Delete script?")) return;
  await sendToExtension({ action: "DELETE_USER_SCRIPT", id }).catch(e => console.error(e));
  await loadSavedScripts();
};

$("toggleAuto").onclick = () => {
  const cur = $("toggleAuto").dataset.auto === "true";
  $("toggleAuto").dataset.auto = (!cur).toString();
  $("toggleAuto").textContent = !cur ? "Auto: On" : "Auto: Off";
};

$("saveUserScript").onclick = async () => {
  const id = ($("savedScriptDropdown").value) || crypto.randomUUID();
  const name = ($("usName").value || id).trim();
  const matches = ($("usMatches").value || "<all_urls>").split("\n").map(s => s.trim()).filter(Boolean);
  const code = $("usCode").value || "";
  const runAt = $("usRunAt").value || "document_end";
  const auto = $("toggleAuto").dataset.auto === "true";
  const script = { id, name, matches, code, runAt, auto };
  await sendToExtension({ action: "SAVE_USER_SCRIPT", script }).catch(e => console.error(e));
  await loadSavedScripts();
};

$("saveAndRun").onclick = async () => {
  await $("saveUserScript").click();
  let id = $("savedScriptDropdown").value;
  if (!id) {
    const res = await sendToExtension({ action: "LIST_USER_SCRIPTS" }).catch(()=>null);
    const scripts = res?.data ?? res ?? [];
    if (scripts && scripts.length) id = scripts[scripts.length-1].id;
  }
  if (!id) return alert("No script saved");
  await runSavedScriptById(id);
};

async function runSavedScriptById(id) {
  try {
    const res = await sendToExtension({ action: "LIST_USER_SCRIPTS" });
    const scripts = res?.data ?? res ?? [];
    const script = (scripts||[]).find(s => s.id === id);
    if (!script) return alert("Script not found");
    const tabId = parseInt($("injectTabSelect").value || 0);
    if (!tabId) return alert("Select a tab");
    await ensureScriptMatchesTab(script, tabId);
    const inj = await sendToExtension({ action: "INJECT_SCRIPT", tabId, code: script.code, useScripting: true }).catch(e => ({ error: String(e) }));
    if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(inj, null, 2);
  } catch (e) { console.error("runSavedScriptById", e); }
}

$("injectScript").onclick = async () => {
  const tabId = parseInt($("injectTabSelect").value || 0);
  const code = $("scriptInput").value || "";
  if (!tabId || !code) return alert("Select a tab and enter code");
  const res = await sendToExtension({ action: "INJECT_SCRIPT", tabId, code, useScripting: true }).catch(e => ({ error: String(e) }));
  if ($("injectOutput")) $("injectOutput").textContent = JSON.stringify(res, null, 2);
};

$("runSavedScript").onclick = async () => {
  const id = $("savedScriptDropdown").value;
  if (!id) return alert("Select a saved script");
  await runSavedScriptById(id);
};

async function ensureScriptMatchesTab(script, tabId) {
  try {
    const tabsResp = await sendToExtension({ action: "LIST_TABS" });
    const tabs = tabsResp?.data ?? tabsResp ?? [];
    const tab = (tabs||[]).find(t => t.id === tabId);
    if (!tab) return;
    const url = new URL(tab.url);
    const originMatch = `${url.protocol}//${url.host}/*`;
    if ((script.matches || []).includes("<all_urls>") || (script.matches || []).includes(originMatch)) return;
    const updated = Object.assign({}, script, { matches: Array.from(new Set([...(script.matches || []), originMatch])) });
    await sendToExtension({ action: "SAVE_USER_SCRIPT", script: updated });
    await new Promise(r => setTimeout(r, 200));
  } catch (e) { console.error("ensureScriptMatchesTab", e); }
}

/* --------------- Experimental CSP toggle --------------- */
let expEnabled = false;
$("expToggleCSP").onclick = async () => {
  const tabId = parseInt($("expCSPTabSelect").value || 0);
  if (!tabId) return alert("Select a tab");
  expEnabled = !expEnabled;
  const res = await sendToExtension({ action: "EXPERIMENTAL_UPDATE", disableCSP: expEnabled, tabId }).catch(e => ({ error: String(e) }));
  $("expToggleCSP").textContent = `Disable CSP: ${expEnabled ? "On" : "Off"}`;
  if ($("experimentalOutput")) $("experimentalOutput").textContent = JSON.stringify(res, null, 2);
};

/* --------------- Init --------------- */
(async function init() {
  if (EXT_ID === "REPLACE_WITH_YOUR_EXTENSION_ID") console.warn("Set window.EXT_ID in index.html");
  tryOpenPort();
  await loadAllExtensions();
  await refreshTabs();
  await loadSavedScripts();
})();
