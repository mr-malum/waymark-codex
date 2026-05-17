/* =========================================================
   CODEX MOBILE UTILITY CONTROL MANAGER
   ========================================================= */

let codexMobileUtilityState = {
  type: "none",
  label: "",
  panelTitle: "",
  renderPanel: null,
  bindPanel: null,
  beforeClose: null
};

function isMobileCodexUtilityLayout() {
  return window.matchMedia("(max-width: 1099px), (max-height: 699px)").matches;
}

function ensureCodexMobileUtilityPanel() {
  let panel = document.getElementById("codex-mobile-utility-panel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "codex-mobile-utility-panel";
  panel.className = "codex-mobile-utility-panel";
  panel.setAttribute("aria-hidden", "true");

  panel.addEventListener("click", function (event) {
    if (event.target?.id === "codex-mobile-utility-panel") {
      closeCodexMobileUtilityPanel();
    }
  });

  const stage = document.getElementById("codex-book-stage") || document.getElementById("codex-modal");
  stage?.appendChild(panel);

  return panel;
}

function setCodexMobileUtility(config = {}) {
  codexMobileUtilityState = {
    type: config.type || "none",
    label: config.label || "",
    panelTitle: config.panelTitle || config.label || "",
    renderPanel: config.renderPanel || null,
    bindPanel: config.bindPanel || null,
    beforeClose: config.beforeClose || null
  };

  updateCodexMobileUtilityButton();
}

function clearCodexMobileUtility() {
  closeCodexMobileUtilityPanel();
  setCodexMobileUtility({ type: "none" });
}

function updateCodexMobileUtilityButton() {
  const button = document.getElementById("codex-mobile-page-control");
  if (!button) return;

  const isEnabled = Boolean(
    codexMobileUtilityState.type !== "none" &&
    codexMobileUtilityState.label &&
    typeof codexMobileUtilityState.renderPanel === "function"
  );

  button.hidden = !isEnabled;
  button.disabled = !isEnabled;
  button.textContent = isEnabled ? codexMobileUtilityState.label : "";
  button.setAttribute("aria-label", isEnabled ? codexMobileUtilityState.label : "Mobile page controls");
}

function openCodexMobileUtilityPanel() {
  if (!isMobileCodexUtilityLayout()) return;
  if (typeof codexMobileUtilityState.renderPanel !== "function") return;

  const panel = ensureCodexMobileUtilityPanel();
  if (!panel) return;

  panel.innerHTML = `
    <div class="codex-mobile-utility-sheet" role="dialog" aria-label="${escapeHtml(codexMobileUtilityState.panelTitle)}">
      <div class="codex-mobile-utility-heading">
        <h3>${escapeHtml(codexMobileUtilityState.panelTitle)}</h3>
      </div>
      <div class="codex-mobile-utility-body">
        ${codexMobileUtilityState.renderPanel()}
      </div>
      <button class="codex-mobile-utility-close" type="button">Close</button>
    </div>
  `;

  panel.querySelector(".codex-mobile-utility-close")
    ?.addEventListener("click", closeCodexMobileUtilityPanel);

  if (typeof codexMobileUtilityState.bindPanel === "function") {
    codexMobileUtilityState.bindPanel(panel);
  }

  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
}

function closeCodexMobileUtilityPanel() {
  const panel = document.getElementById("codex-mobile-utility-panel");
  if (!panel) return;

  if (panel.classList.contains("open") && typeof codexMobileUtilityState.beforeClose === "function") {
    codexMobileUtilityState.beforeClose(panel);
  }

  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = "";
}

function patchCodexContentUtilityReset() {
  if (typeof window.setCodexContent !== "function") return;
  if (window.setCodexContent.__mobileUtilityResetPatched) return;

  const originalSetCodexContent = window.setCodexContent;

  window.setCodexContent = function (...args) {
    clearCodexMobileUtility();
    return originalSetCodexContent.apply(this, args);
  };

  window.setCodexContent.__mobileUtilityResetPatched = true;
  setCodexContent = window.setCodexContent;
}

function initializeCodexMobileUtility() {
  ensureCodexMobileUtilityPanel();
  patchCodexContentUtilityReset();

  document
    .getElementById("codex-mobile-page-control")
    ?.addEventListener("click", openCodexMobileUtilityPanel);

  updateCodexMobileUtilityButton();
}

window.setCodexMobileUtility = setCodexMobileUtility;
window.clearCodexMobileUtility = clearCodexMobileUtility;
window.openCodexMobileUtilityPanel = openCodexMobileUtilityPanel;
window.closeCodexMobileUtilityPanel = closeCodexMobileUtilityPanel;
window.initializeCodexMobileUtility = initializeCodexMobileUtility;
