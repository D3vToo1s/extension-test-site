// ui.js

function sendToExtension(payload) {
  window.postMessage({ type: "BM_COMMAND", payload }, "*");
}

window.addEventListener("message", (event) => {
  if (event.data.type !== "BM_RESPONSE") return;

  const { target, data } = event.data.payload;

  if (target && data) {
    document.getElementById(target).textContent =
      JSON.stringify(data, null, 2);
  }
});

// Tabs
document.getElementById("listTabs").onclick = () => {
  sendToExtension({
    action: "LIST_TABS",
    target: "tabsOutput"
  });
};

// Inject Script
document.getElementById("injectScript").onclick = () => {
  sendToExtension({
    action: "INJECT_SCRIPT",
    code: document.getElementById("scriptInput").value,
    target: "injectOutput"
  });
};

// Wipe Data
document.getElementById("wipeData").onclick = () => {
  sendToExtension({
    action: "WIPE_DATA",
    options: { since: 0 },
    dataTypes: ["cookies", "cache", "history"],
    target: "wipeOutput"
  });
};

// Downloads
document.getElementById("listDownloads").onclick = () => {
  sendToExtension({
    action: "LIST_DOWNLOADS",
    query: {},
    target: "downloadsOutput"
  });
};

// History
document.getElementById("searchHistory").onclick = () => {
  sendToExtension({
    action: "GET_HISTORY",
    text: document.getElementById("historySearch").value,
    maxResults: 100,
    target: "historyOutput"
  });
};
