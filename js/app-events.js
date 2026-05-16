/* =========================================================
   APP EVENT WIRING
   ========================================================= */

const HEX_GRID_MIN = 300;
const HEX_GRID_MAX = 350;

let retroCodexSequence = "";
let codexLongPressTimer = null;
let suppressNextCodexClick = false;
let appBrowserHistoryDepth = 0;
let appBrowserHistoryReleaseCount = 0;
let codexDesktopLiveSearchTimer = null;

function initializeHexGrid() {
  for (let xxx = HEX_GRID_MIN; xxx < HEX_GRID_MAX; xxx++) {
    for (let yyy = HEX_GRID_MIN; yyy < HEX_GRID_MAX; yyy++) {
      createHexOverlay(xxx, yyy);
    }
  }
}

function createHexOverlay(xxx, yyy) {
  const { x, y } = getHexCenter(xxx, yyy);
  const hexId = `${xxx}:${yyy}`;

  const hex = L.polygon(
    makeHex(x, y, hexWidth, hexHeight),
    defaultStyle
  ).addTo(map);

  bindHexEvents(hex, hexId);
}

function bindHexEvents(hex, hexId) {
  hex.on("mouseover", function () {
    if (!isTouchDevice && this !== selectedHex) {
      this.setStyle(hoverStyle);
    }
  });

  hex.on("mouseout", function () {
    if (!isTouchDevice && this !== selectedHex) {
      this.setStyle(defaultStyle);
    }
  });

  hex.on("click", function (event) {
    L.DomEvent.stopPropagation(event);

    document
      .getElementById("codex-button")
      .classList.remove("codex-label-visible");

    selectHex(this);
    selectedHexId = hexId;

    if (isTouchDevice) {
      this.bindPopup(buildMobilePopupHtml(hexId)).openPopup();
      return;
    }

    renderHexPreview(hexId);

    const panelWidth =
      document.getElementById("app-panel").offsetWidth;

    if (panelWidth / window.innerWidth > 0.32) {
      panHexIntoInspectorView(hexId);
    }
  });
}

function bindMapEvents() {
  map.on("click", function () {
    closePanel();

    document
      .getElementById("codex-button")
      .classList.remove("codex-label-visible");

    clearSelectedHex();
  });

  map.on("popupclose", function () {
    clearSelectedHex();
  });

  document
    .getElementById("map-reset-button")
    .addEventListener("click", function (event) {
      event.stopPropagation();

      closePanel({ clearSelection: true });
      closeCodex();
      resetMapToAtlasView();
    });
}

function bindPanelEvents() {
  document
    .getElementById("mobile-panel-close")
    .addEventListener("click", function () {
      closePanel({
        clearSelection: true,
        centerSelected: true
      });
    });
}

function bindCodexEvents() {
  document
    .getElementById("codex-button")
    .addEventListener("click", handleCodexButtonClick);

  document
    .getElementById("codex-close")
    .addEventListener("click", function () {
      closeCodex();
    });

  document
    .getElementById("codex-search-button")
    .addEventListener("click", openCodexGlobalSearchModal);

  bindCodexDesktopPersistentSearch();

  document
    .getElementById("codex-back")
    .addEventListener("click", function () {
      if (isMobileBrowserBackEnabled() && appBrowserHistoryDepth > 0) {
        history.back();
        return;
      }

      if (codexHistory.length <= 1) {
        closeCodex();
        return;
      }

      goBackCodex();
    });

  document
    .getElementById("codex-overlay")
    .addEventListener("click", function (event) {
      if (event.target === this) {
        closeCodex();
      }
    });
}

function isDesktopCodexBookLayout() {
  return window.matchMedia("(min-width: 1100px) and (min-height: 700px)").matches;
}

function isTypingInEditableField(event) {
  const target = event.target;
  if (!target) return false;

  const tagName = String(target.tagName || "").toLowerCase();

  return tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target.isContentEditable);
}

function toggleCodexDebugGuides() {
  const modal = document.getElementById("codex-modal");
  if (!modal) return;

  const shouldShow = !modal.classList.contains("codex-debug-guides-visible");
  modal.classList.toggle("codex-debug-guides-visible", shouldShow);
}

function updateCodexDesktopSearchAction() {
  const input = document.getElementById("codex-desktop-search-input");
  const action = document.getElementById("codex-desktop-search-action");
  if (!input || !action) return;

  const hasText = Boolean(String(input.value || "").trim());

  action.textContent = hasText ? "✕" : "⌾";
  action.classList.toggle("has-query", hasText);
  action.setAttribute("aria-label", hasText ? "Clear search" : "Focus search");
}

function clearCodexDesktopPersistentSearch() {
  const input = document.getElementById("codex-desktop-search-input");
  if (!input) return;

  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

function bindCodexDesktopPersistentSearch() {
  const input = document.getElementById("codex-desktop-search-input");
  const action = document.getElementById("codex-desktop-search-action");
  if (!input) return;

  updateCodexDesktopSearchAction();

  input.addEventListener("input", function () {
    updateCodexDesktopSearchAction();
    window.clearTimeout(codexDesktopLiveSearchTimer);

    const cleanQuery = String(input.value || "").trim();

    codexDesktopLiveSearchTimer = window.setTimeout(() => {
      if (cleanQuery) {
        startCodexLiveSearch(cleanQuery);
        return;
      }

      restoreCodexLiveSearchReturnPage();
    }, 90);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    input.blur();
  });

  action?.addEventListener("click", function () {
    if (String(input.value || "").trim()) {
      clearCodexDesktopPersistentSearch();
      return;
    }

    input.focus();
  });
}

function openCodexGlobalSearchModal() {
  const modal = document.getElementById("codex-global-search-modal");
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  modal.innerHTML = `
    <div class="codex-global-search-panel" role="dialog" aria-modal="true" aria-label="Search the Codex">
      <input
        id="codex-global-search-input"
        type="search"
        placeholder="Consult the Codex..."
        autocomplete="off"
        value=""
      >
    </div>
  `;

  const input = document.getElementById("codex-global-search-input");
  input?.focus();

  input?.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    commitCodexGlobalSearch(input.value);
  });
}

function commitCodexGlobalSearch(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return;

  closeCodexGlobalSearchModal();
  openCodexSearchResults(cleanQuery);
}

function closeCodexGlobalSearchModal() {
  const modal = document.getElementById("codex-global-search-modal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = "";
}

function handleCodexGlobalSearchBackdropClick(event) {
  if (event.target?.id !== "codex-global-search-modal") return;
  closeCodexGlobalSearchModal();
}

function handleCodexButtonClick(event) {
  event.stopPropagation();

  if (suppressNextCodexClick) {
    suppressNextCodexClick = false;
    event.preventDefault();
    return;
  }

  const codexButton = document.getElementById("codex-button");

  map.closePopup();

  if (isTouchDevice && !codexButton.classList.contains("codex-label-visible")) {
    codexButton.classList.add("codex-label-visible");
    return;
  }

  codexButton.classList.remove("codex-label-visible");
  resetMapToAtlasView();
  resetCodexToIndex();
}

function bindKeyboardEasterEggEvents() {
  window.addEventListener("keydown", event => {
    const key = event.key;

    if (key === "`" || key === "~") {
      if (isCodexOpen() && isDesktopCodexBookLayout() && !isTypingInEditableField(event)) {
        event.preventDefault();
        toggleCodexDebugGuides();
        return;
      }
    }

    retroCodexSequence += key.toLowerCase();

    if (retroCodexSequence.length > 2) {
      retroCodexSequence = retroCodexSequence.slice(-2);
    }

    if (retroCodexSequence === "95") {
      toggleRetroCodexMode();
      retroCodexSequence = "";
    }
  });
}

function isMobileCodexLongPressEnabled() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

function isMobileBrowserBackEnabled() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

function isCodexOpen() {
  return document
    .getElementById("codex-overlay")
    ?.classList.contains("open");
}

function isAppPanelOpen() {
  return document
    .getElementById("app-panel")
    ?.classList.contains("open");
}

function ensureAppBrowserBackTrap() {
  if (!isMobileBrowserBackEnabled()) return;

  if (appBrowserHistoryDepth > 0) return;

  appBrowserHistoryDepth = 1;
  history.pushState({ appPanelTrap: true }, "");
}

function releaseAppBrowserBackTrap() {
  if (!isMobileBrowserBackEnabled()) {
    appBrowserHistoryDepth = 0;
    appBrowserHistoryReleaseCount = 0;
    return;
  }

  if (appBrowserHistoryDepth <= 0) return;

  appBrowserHistoryReleaseCount += 1;
  appBrowserHistoryDepth -= 1;

  history.back();
}

window.addEventListener("popstate", function () {
  if (appBrowserHistoryReleaseCount > 0) {
    appBrowserHistoryReleaseCount -= 1;
    return;
  }

  if (appBrowserHistoryDepth > 0) {
    appBrowserHistoryDepth -= 1;
  }

  if (isCodexOpen()) {
    closeCodex({ syncHistory: false });
    return;
  }

  if (isAppPanelOpen()) {
    closePanel({
      clearSelection: true,
      centerSelected: true
    });
  }
});

function bindCodexLongPressEvents() {
  const button = document.getElementById("codex-button");
  if (!button) return;

  const start = event => {
    if (!isMobileCodexLongPressEnabled()) return;

    clearTimeout(codexLongPressTimer);
    suppressNextCodexClick = false;

    codexLongPressTimer = window.setTimeout(() => {
      suppressNextCodexClick = true;
      button.classList.remove("codex-label-visible");
      resetCodexToIndex();
    }, 450);
  };

  const cancel = () => {
    clearTimeout(codexLongPressTimer);
  };

  button.addEventListener("touchstart", start, { passive: true });
  button.addEventListener("mousedown", start);

  button.addEventListener("touchend", cancel);
  button.addEventListener("touchcancel", cancel);
  button.addEventListener("mouseup", cancel);
  button.addEventListener("mouseleave", cancel);
}

function initializeApp() {
  initializeHexGrid();
  bindMapEvents();
  bindPanelEvents();
  bindCodexEvents();
  bindCodexLongPressEvents();
  bindKeyboardEasterEggEvents();

  loadDatabase();
}

initializeApp();