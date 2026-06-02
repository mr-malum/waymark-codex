/* =========================================================
   APP EVENT WIRING
   ========================================================= */

const HEX_GRID_MIN = 300;
const HEX_GRID_MAX = 350;

const generatedTerrainColors = {
  deep_sea: "#0b263a",
  sea: "#245f82",
  coastal_water: "#4a91ab",
  inland_water: "#79b8c8",
  beach: "#dbc487",
  plains: "#c1b06d",
  grassland: "#8fa75f",
  lush_grassland: "#4e7b45",
  wetland: "#3d6856",
  jungle_floor: "#3E855A",
  desert: "#d4b36f",
  deep_desert: "#b88955",
  barrens: "#a56545",
  bleak_barrens: "#7d4335",
  snow: "#dce5e6",
  rock: "#756e66",
  wastes: "#453232"
};

const hexOverlayLayer = L.layerGroup().addTo(map);
const generatedCoordinateLabelLayer = L.layerGroup().addTo(map);
const GENERATED_COORDINATE_LABEL_MIN_ZOOM = -0.75;

let retroCodexSequence = "";
let codexLongPressTimer = null;
let suppressNextCodexClick = false;
let appBrowserHistoryDepth = 0;
let appBrowserHistoryReleaseCount = 0;
let codexDesktopLiveSearchTimer = null;

document.addEventListener("contextmenu", event => event.preventDefault());

function isMobileCodexNav() {
  return window.matchMedia?.("(max-width: 700px)")?.matches === true;
}

function closeCodexNavPockets(exceptPocket = null) {
  document.querySelectorAll(".codex-nav-pocket.open").forEach(pocket => {
    if (pocket === exceptPocket) return;
    pocket.classList.remove("open");
  });

  if (exceptPocket?.id !== "codex-mobile-settings-pocket") {
    document.getElementById("codex-mobile-settings-reveal")?.setAttribute("hidden", "");
    document.getElementById("codex-mobile-close-reveal")?.setAttribute("hidden", "");
  }
}

function openCodexNavPocket(pocketId) {
  const pocket = document.getElementById(pocketId);
  if (!pocket) return;

  closeCodexNavPockets(pocket);
  pocket.classList.add("open");

  if (pocketId === "codex-mobile-settings-pocket") {
    document.getElementById("codex-mobile-settings-reveal")?.removeAttribute("hidden");
    document.getElementById("codex-mobile-close-reveal")?.removeAttribute("hidden");
  }
}

function isCodexNavPocketOpen(pocketId) {
  return document.getElementById(pocketId)?.classList.contains("open") === true;
}

function handleCodexCloseOrSettingsClick(event) {
  if (!isMobileCodexNav()) {
    closeCodex();
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (isCodexNavPocketOpen("codex-mobile-settings-pocket")) {
    closeCodexNavPockets();
    return;
  }

  openCodexNavPocket("codex-mobile-settings-pocket");
}

window.isMobileCodexNav = isMobileCodexNav;
window.closeCodexNavPockets = closeCodexNavPockets;
window.openCodexNavPocket = openCodexNavPocket;
window.isCodexNavPocketOpen = isCodexNavPocketOpen;

function initializeHexGrid() {
  hexOverlayLayer.clearLayers();
  generatedCoordinateLabelLayer.clearLayers();

  if (isGeneratedMapCampaign() && db?.raw?.hexes?.length) {
    window.generatedMapRenderer?.renderFromDatabase();
    return;
  }

  window.generatedMapRenderer?.deactivate();
  updateGeneratedCoordinateLabelVisibility();

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
  ).addTo(hexOverlayLayer);

  hex.__codexBaseStyle = defaultStyle;

  bindHexEvents(hex, hexId);
}

function updateGeneratedCoordinateLabelVisibility() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  mapElement.classList.toggle(
    "generated-coordinate-labels-visible",
    isGeneratedMapCampaign() && map.getZoom() >= GENERATED_COORDINATE_LABEL_MIN_ZOOM
  );
}

function getGeneratedHexStyle(hexRecord) {
  const fillColor = generatedTerrainColors[hexRecord?.Base_Terrain] || "#7f7a66";

  return {
    color: "#f7ead0",
    weight: 1.4,
    opacity: 0.55,
    fillColor,
    fillOpacity: 0.88,
    className: "hex-glow"
  };
}

function getGeneratedHexCoordinates(hexRecord) {
  return parseMapHexId(hexRecord?.Map_XY || hexRecord?.Hex_ID);
}

function createGeneratedHexOverlay(hexRecord) {
  const coordinates = getGeneratedHexCoordinates(hexRecord);
  if (!coordinates) return;

  const center = getGeneratedHexCenter(coordinates.x, coordinates.y);
  const dimensions = getGeneratedMapDimensions();
  const style = getGeneratedHexStyle(hexRecord);
  const hex = L.polygon(
    makeHex(center.x, center.y, dimensions.radius, dimensions.hexHeight),
    style
  ).addTo(hexOverlayLayer);

  createGeneratedCoordinateLabel(hexRecord, center);

  hex.__codexBaseStyle = style;
  hex.__codexHoverStyle = {
    ...style,
    opacity: 0.85,
    fillOpacity: 0.96,
    weight: 2.2
  };
  hex.__codexSelectedStyle = {
    ...style,
    color: "#ffffff",
    opacity: 1,
    fillOpacity: 1,
    weight: 3
  };
  bindHexEvents(hex, hexRecord.Hex_ID);
}

function createGeneratedCoordinateLabel(hexRecord, center) {
  const label = hexRecord?.Map_XY || hexRecord?.Hex_ID || "";
  if (!label) return;

  L.marker([center.y, center.x], {
    interactive: false,
    icon: L.divIcon({
      className: "generated-hex-coordinate-label",
      html: `<span>${escapeHtml(label)}</span>`,
      iconSize: [42, 10],
      iconAnchor: [21, 5]
    })
  }).addTo(generatedCoordinateLabelLayer);
}

function initializeGeneratedHexGrid() {
  (db?.raw?.hexes || []).forEach(createGeneratedHexOverlay);
  updateGeneratedCoordinateLabelVisibility();
}

function renderHexGridForActiveCampaign() {
  initializeHexGrid();
}

window.renderHexGridForActiveCampaign = renderHexGridForActiveCampaign;
window.addEventListener("campaign-database-loaded", renderHexGridForActiveCampaign);
map.on("zoomend", updateGeneratedCoordinateLabelVisibility);

function bindHexEvents(hex, hexId) {
  hex.on("mouseover", function () {
    if (!isTouchDevice && this !== selectedHex) {
      this.setStyle(this.__codexHoverStyle || hoverStyle);
    }
  });

  hex.on("mouseout", function () {
    if (!isTouchDevice && this !== selectedHex) {
      this.setStyle(this.__codexBaseStyle || defaultStyle);
    }
  });

  hex.on("click", function (event) {
    L.DomEvent.stopPropagation(event);

    document
      .getElementById("codex-button")
      .classList.remove("codex-label-visible");

    closePanel({ syncHistory: false });
    selectHex(this);
    selectedHexId = hexId;

    this.bindPopup(buildMobilePopupHtml(hexId)).openPopup();
  });
}

function bindMapEvents() {
  map.on("click", function () {
    closePanel();
    map.closePopup();

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
    .addEventListener("click", handleCodexCloseOrSettingsClick);

  document
    .getElementById("codex-mobile-settings-reveal")
    ?.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeCodexNavPockets();
      window.showCampaignSettings?.();
      window.openCampaignSettingsMenu?.();
    });

  document
    .getElementById("codex-mobile-close-reveal")
    ?.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeCodexNavPockets();
      closeCodex();
    });

  document
    .getElementById("codex-search-button")
    .addEventListener("click", function () {
      closeCodexNavPockets();
      openCodexGlobalSearchModal();
    });

  document
    .getElementById("codex-mobile-debug-toggle")
    ?.addEventListener("click", toggleCodexDebugGuides);

  bindCodexDesktopPersistentSearch();

  document
    .getElementById("codex-back")
    .addEventListener("click", function () {
      closeCodexNavPockets();
      handleCodexBackAction();
    });

  document
    .getElementById("codex-overlay")
    .addEventListener("click", function (event) {
      if (event.target === this) {
        closeCodex();
      }
    });

  document.addEventListener("click", function (event) {
    if (!isMobileCodexNav()) return;
    if (event.target.closest(".codex-nav-pocket")) return;
    closeCodexNavPockets();
  });
}

function isCodexGlobalSearchModalOpen() {
  return document
    .getElementById("codex-global-search-modal")
    ?.classList.contains("open") || false;
}

function closeTopCodexLayer() {
  if (isCodexGlobalSearchModalOpen()) {
    closeCodexGlobalSearchModal();
    return true;
  }

  if (typeof isCodexImageModalOpen === "function" && isCodexImageModalOpen()) {
    closeCodexImageModal();
    return true;
  }

  if (document.getElementById("codex-mobile-utility-panel")?.classList.contains("open")) {
    closeCodexMobileUtilityPanel?.();
    return true;
  }

  return false;
}

function handleCodexBackAction() {
  if (closeTopCodexLayer()) return;

  if (codexHistory.length > 1) {
    goBackCodex();
    return;
  }

  closeCodex();
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
  document.getElementById("campaign-settings-guides-button")?.classList.toggle("active", shouldShow);
  document.getElementById("campaign-settings-guides-button")?.setAttribute(
    "aria-pressed",
    shouldShow ? "true" : "false"
  );
}

function updateCodexDesktopSearchAction() {
  const input = document.getElementById("codex-desktop-search-input");
  const action = document.getElementById("codex-desktop-search-action");
  if (!input || !action) return;

  const hasText = Boolean(String(input.value || "").trim());

  action.textContent = hasText ? "✕" : getCodexIcon("search");
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

  const currentQuery = String(codexSearchQuery || "");

  modal.innerHTML = `
    <div class="codex-global-search-panel" role="dialog" aria-modal="true" aria-label="Search the Codex">
      <input
        id="codex-global-search-input"
        type="search"
        placeholder="Consult the Codex..."
        autocomplete="off"
        value="${escapeHtml(currentQuery)}"
      >
    </div>
  `;

  const input = document.getElementById("codex-global-search-input");
  input?.focus();
  input?.select?.();

  input?.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    input.blur();
    commitCodexGlobalSearch(input.value);
  });
}

function commitCodexGlobalSearch(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return;

  document.activeElement?.blur?.();
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

function pushAppBrowserHistoryState() {
  if (!isMobileBrowserBackEnabled()) return;

  appBrowserHistoryDepth += 1;
  history.pushState({ kadeshApp: true }, "");
}

function ensureAppBrowserBackTrap() {
  if (!isMobileBrowserBackEnabled()) return;
  if (appBrowserHistoryDepth > 0) return;

  pushAppBrowserHistoryState();
}

function pushAppBrowserHistoryStep() {
  if (!isMobileBrowserBackEnabled()) return;
  if (!isCodexOpen()) return;

  pushAppBrowserHistoryState();
}

function releaseAppBrowserBackTrap() {
  if (!isMobileBrowserBackEnabled()) {
    appBrowserHistoryDepth = 0;
    appBrowserHistoryReleaseCount = 0;
    return;
  }

  if (appBrowserHistoryDepth <= 0) return;

  const stepsToRelease = appBrowserHistoryDepth;

  appBrowserHistoryReleaseCount += stepsToRelease;
  appBrowserHistoryDepth = 0;

  history.go(-stepsToRelease);
}

window.addEventListener("popstate", function () {
  if (appBrowserHistoryReleaseCount > 0) {
    appBrowserHistoryReleaseCount -= 1;
    return;
  }

  if (appBrowserHistoryDepth > 0) {
    appBrowserHistoryDepth -= 1;
  }

  if (closeTopCodexLayer()) {
    return;
  }

  if (isCodexOpen()) {
    if (codexHistory.length > 1) {
      goBackCodex();
      return;
    }

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
  bindMapEvents();
  bindPanelEvents();
  bindCodexEvents();
  initializeCodexMobileUtility?.();
  bindCodexLongPressEvents();
  bindKeyboardEasterEggEvents();
}

window.pushAppBrowserHistoryStep = pushAppBrowserHistoryStep;

initializeApp();
