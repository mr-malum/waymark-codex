/* =========================================================
   CODEX CORE / ROUTING / HISTORY
   ========================================================= */

let codexLiveSearchActive = false;
let codexLiveSearchReturnPage = null;
let codexLastManuscriptPageType = null;

function getCodexOverlay() {
  return document.getElementById("codex-overlay");
}

function getCodexContent() {
  return document.getElementById("codex-content");
}

function getCodexTitle() {
  return document.getElementById("codex-title");
}

function openCodex() {
  getCodexOverlay().classList.add("open");

  if (typeof ensureAppBrowserBackTrap === "function") {
    ensureAppBrowserBackTrap();
  }

  requestAnimationFrame(fitCodexHeaderText);
}

function closeCodex(options = {}) {
  const overlay = getCodexOverlay();
  const wasOpen = overlay.classList.contains("open");

  codexSearchQuery = "";
  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;
  codexLastManuscriptPageType = null;
  codexHistory = [];
  syncCodexDesktopPersistentSearchInput("");
  clearCodexDetailSectionStateCache?.();

  closeCodexGlobalSearchModal?.();
  overlay.classList.remove("open");
  map.closePopup();
  clearSelectedHex();

  if (
    wasOpen &&
    options.syncHistory !== false &&
    typeof releaseAppBrowserBackTrap === "function"
  ) {
    releaseAppBrowserBackTrap();
  }
}

function setCodexTitle(title) {
  const titleEl = getCodexTitle();
  titleEl.textContent = title;
  titleEl.querySelectorAll?.("[data-codex-fit-line]").forEach(line => {
    line.removeAttribute("data-codex-fit-line");
  });
  requestAnimationFrame(fitCodexHeaderText);
}

function getActiveCampaignCodexTitle() {
  const campaignName = getActiveCampaign?.()?.name?.trim();
  return campaignName
    ? `The Codex of ${campaignName}`
    : "The Codex";
}

function getCodexHeaderFitLines() {
  const titleEl = getCodexTitle();
  if (!titleEl) return [];

  const explicitLines = [...titleEl.querySelectorAll(".codex-superheader, .codex-mainheader, .codex-subheader")];
  if (explicitLines.length) return explicitLines;

  return [titleEl];
}

function shouldFitCodexHeaderTextForMobile() {
  return window.matchMedia?.(
    "(hover: none) and (pointer: coarse), (max-width: 700px)"
  )?.matches === true;
}

function resetCodexHeaderFitStyles() {
  const titleEl = getCodexTitle();
  if (!titleEl) return;

  const lines = [
    titleEl,
    ...titleEl.querySelectorAll?.(
      ".codex-superheader, .codex-mainheader, .codex-subheader"
    ) || []
  ];

  lines.forEach(line => {
    line.style.fontSize = "";
    line.style.whiteSpace = "";
    delete line.dataset.codexBaseFontSize;
  });
}

function fitCodexHeaderText() {
  const titleEl = getCodexTitle();
  const headerEl = document.getElementById("codex-header");
  if (!titleEl || !headerEl) return;

  if (!shouldFitCodexHeaderTextForMobile()) {
    resetCodexHeaderFitStyles();
    return;
  }

  const availableWidth = titleEl.clientWidth || headerEl.clientWidth;
  if (!availableWidth) return;

  getCodexHeaderFitLines().forEach(line => {
    if (!line.dataset.codexBaseFontSize) {
      line.dataset.codexBaseFontSize = String(parseFloat(getComputedStyle(line).fontSize) || 16);
    }

    const baseFontSize = Number(line.dataset.codexBaseFontSize) || 16;
    line.style.fontSize = `${baseFontSize}px`;
    line.style.whiteSpace = "nowrap";

    const lineWidth = line.scrollWidth;
    if (lineWidth <= availableWidth) return;

    const nextFontSize = Math.max(10, baseFontSize * (availableWidth / lineWidth));
    line.style.fontSize = `${nextFontSize}px`;
  });
}

window.addEventListener("resize", function () {
  requestAnimationFrame(fitCodexHeaderText);
});

function getCodexBreadcrumbLabel(label) {
  if (label === "Points of Interest") return "POIs";
  return label;
}

function normalizeCodexBreadcrumbs(breadcrumbs = []) {
  return breadcrumbs.map(crumb => ({
    ...crumb,
    label: getCodexBreadcrumbLabel(crumb.label)
  }));
}

function renderCodexBreadcrumbItem(crumb, isLast) {
  return `
    ${crumb.clickable && !isLast
      ? `<button class="codex-breadcrumb-button" type="button" onclick="${crumb.onclick}">
          ${escapeHtml(crumb.label)}
        </button>`
      : `<span>${escapeHtml(crumb.label)}</span>`
    }
    ${!isLast ? `<span class="codex-breadcrumb-separator">/</span>` : ""}
  `;
}

function renderCodexMobileBreadcrumbItem(crumb, isLast, className = "") {
  const labelClass = className ? ` class="${className}"` : "";

  return `
    ${crumb.clickable && !isLast
      ? `<button class="codex-breadcrumb-button ${className}" type="button" onclick="${crumb.onclick}">
          ${escapeHtml(crumb.label)}
        </button>`
      : `<span${labelClass}>${escapeHtml(crumb.label)}</span>`
    }
    ${!isLast ? `<span class="codex-breadcrumb-separator">/</span>` : ""}
  `;
}

function renderCodexBreadcrumbs(breadcrumbs = []) {
  const breadcrumbsEl = document.getElementById("codex-breadcrumbs");
  if (!breadcrumbsEl) return;

  if (!breadcrumbs.length) {
    breadcrumbsEl.innerHTML = "";
    return;
  }

  const displayCrumbs = normalizeCodexBreadcrumbs(breadcrumbs);

  const desktopHtml = displayCrumbs
    .map((crumb, index) => renderCodexBreadcrumbItem(
      crumb,
      index === displayCrumbs.length - 1
    ))
    .join("");

  const hasGroupedPoiTrail = displayCrumbs.length === 4
    && displayCrumbs[1]?.label === "POIs";

  const leadingMobileCrumbs = hasGroupedPoiTrail
    ? displayCrumbs.slice(0, -1)
    : displayCrumbs.length > 2
      ? displayCrumbs.slice(0, 2)
      : displayCrumbs.slice(0, -1);
  const currentMobileCrumb = displayCrumbs[displayCrumbs.length - 1];

  const mobileHtml = `
    ${leadingMobileCrumbs
      .map((crumb, index) => renderCodexMobileBreadcrumbItem(
        crumb,
        false,
        hasGroupedPoiTrail && index === 2
          ? "codex-breadcrumb-parent-group"
          : "codex-breadcrumb-fixed"
      ))
      .join("")}

    ${currentMobileCrumb
      ? renderCodexMobileBreadcrumbItem(
        currentMobileCrumb,
        true,
        "codex-breadcrumb-current"
      )
      : ""
    }
  `;

  breadcrumbsEl.innerHTML = `
    <div id="codex-breadcrumbs-inner" class="codex-breadcrumbs-desktop">
      ${desktopHtml}
    </div>

    <div class="codex-breadcrumbs-mobile">
      ${mobileHtml}
    </div>
  `;
}

function setCodexContent(html, breadcrumbs = []) {
  const content = getCodexContent();
  content.className = "";
  content.scrollTop = 0;

  renderCodexBreadcrumbs(breadcrumbs);

  content.innerHTML = html;
}

function renderCodexSplitView({ railHtml = "", mainHtml = "", className = "" } = {}) {
  return `
    <div class="codex-split-view ${className}">
      <aside class="codex-split-rail">
        <div class="codex-split-rail-inner">
          ${railHtml}
        </div>
      </aside>

      <main class="codex-split-main codex-scroll-fade">
        ${mainHtml}
      </main>
    </div>
  `;
}

function getCurrentCodexPage() {
  return codexHistory[codexHistory.length - 1] || null;
}

function createCodexHistoryEntry(type, id, state = {}) {
  return {
    type,
    id,
    ...state
  };
}

function pushCodexHistory(type, id, state = {}) {
  codexHistory.push(createCodexHistoryEntry(type, id, state));
}

function replaceCurrentCodexHistory(type, id, state = {}) {
  if (!codexHistory.length) {
    pushCodexHistory(type, id, state);
    return;
  }

  codexHistory[codexHistory.length - 1] = createCodexHistoryEntry(type, id, state);
}

function popCodexHistory() {
  codexHistory.pop();
  return getCurrentCodexPage();
}

function applyCodexHistoryEntryState(entry) {
  if (!entry) return;

  if (entry.type === "search") {
    codexSearchQuery = entry.query || "";
    syncCodexDesktopPersistentSearchInput(codexSearchQuery);
    return;
  }

  codexSearchQuery = "";
  syncCodexDesktopPersistentSearchInput("");
}

function updateCodexBackButton() {
  const backButton = document.getElementById("codex-back");

  backButton.disabled = false;
  backButton.textContent = "❮";
}

function prepareCodexNavigation() {
  closePanel({ clearSelection: true });
  resetMapToAtlasView();
  openCodex();
}

function openCodexPage(type = "index", id = null, options = {}) {
  const shouldPush = options.push !== false;
  const state = options.state || {};
  const wasOpen = getCodexOverlay().classList.contains("open");

  prepareCodexNavigation();

  if (codexLiveSearchActive && type !== "search") {
    endCodexLiveSearch({ clearInput: true });
  }

  if (shouldPush) {
    pushCodexHistory(type, id, state);
  }

  const currentPage = getCurrentCodexPage();
  applyCodexHistoryEntryState(currentPage);
  renderCodexPage(type, id);
  fitCodexHeaderText();
  updateCodexBackButton();

  if (
    wasOpen &&
    shouldPush &&
    typeof pushAppBrowserHistoryStep === "function"
  ) {
    pushAppBrowserHistoryStep();
  }
}

function openCodexSearchResults(query, options = {}) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return;

  const shouldPush = options.push !== false;
  const shouldReplace = options.replace === true;

  codexSearchQuery = cleanQuery;

  if (shouldReplace) {
    prepareCodexNavigation();
    replaceCurrentCodexHistory("search", null, { query: cleanQuery });
    renderCodexPage("search", null);
    fitCodexHeaderText();
    updateCodexBackButton();
    return;
  }

  openCodexPage("search", null, {
    push: shouldPush,
    state: { query: cleanQuery }
  });
}

function startCodexLiveSearch(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return;

  if (!codexLiveSearchActive) {
    codexLiveSearchActive = true;
    codexLiveSearchReturnPage = getCurrentCodexPage()
      ? { ...getCurrentCodexPage() }
      : { type: "index", id: null };

    openCodexSearchResults(cleanQuery, { push: true });
    return;
  }

  openCodexSearchResults(cleanQuery, { replace: true });
}

function restoreCodexLiveSearchReturnPage() {
  const returnPage = codexLiveSearchReturnPage || { type: "index", id: null };

  if (getCurrentCodexPage()?.type === "search") {
    codexHistory.pop();
  }

  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;
  codexSearchQuery = "";
  syncCodexDesktopPersistentSearchInput("");

  renderCodexPage(returnPage.type, returnPage.id);
  fitCodexHeaderText();
  updateCodexBackButton();
}

function endCodexLiveSearch({ clearInput = false } = {}) {
  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;

  if (clearInput) {
    syncCodexDesktopPersistentSearchInput("");
  }
}

function openCodexSearchResult(type, id) {
  endCodexLiveSearch({ clearInput: true });
  openCodexPage(type, id);
}

function syncCodexDesktopPersistentSearchInput(value = codexSearchQuery) {
  const input = document.getElementById("codex-desktop-search-input");
  if (!input) return;

  input.value = value || "";
}

function goBackCodex() {
  if (codexHistory.length <= 1) return;

  const previous = popCodexHistory();

  if (!previous) return;

  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;

  applyCodexHistoryEntryState(previous);
  renderCodexPage(previous.type, previous.id);
  fitCodexHeaderText();
  updateCodexBackButton();
}

function resetCodexToIndex() {
  codexHistory = [];
  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;
  codexSearchQuery = "";
  syncCodexDesktopPersistentSearchInput("");
  openCodexPage("index", null);
}

function maybeRefreshCodexLeftManuscript(type) {
  if (typeof renderCodexLeftManuscript !== "function") return;

  if (type === "search" && codexLastManuscriptPageType === "search") {
    return;
  }

  codexLastManuscriptPageType = type;
  renderCodexLeftManuscript();
}

function renderCodexPage(type, id) {
  updateCodexContextAction?.(type);
  maybeRefreshCodexLeftManuscript(type);

  if (databaseLoadError) {
    setCodexTitle(getActiveCampaignCodexTitle());
    setCodexContent(`
      <p>The records could not be gathered.</p>
      <p>Please refresh the page and consult the Codex again.</p>
    `);
    fitCodexHeaderText();
    return;
  }

  if (!db) {
    setCodexTitle(getActiveCampaignCodexTitle());
    setCodexContent(`<p>The records are still being gathered...</p>`);
    fitCodexHeaderText();
    return;
  }

  if (type === "hex") return renderCodexHexPage(id);
  if (type === "region") return renderCodexRegionPage(id);
  if (type === "poi") return renderCodexPoiPage(id);
  if (type === "poi-group") return renderCodexPoiGroupPage(id);
  if (type === "npc") return renderCodexNpcPage(id);
  if (type === "search") return renderCodexSearchPage();
  if (type === "regions") return renderCodexRegionsIndex();
  if (type === "pois") return renderCodexPoisIndex();
  if (type === "npcs") return renderCodexNpcsIndex();
  if (type === "hexes") return renderCodexHexesIndex();

  return renderCodexIndex();
}

function renderCodexIndex() {
  setCodexTitle(getActiveCampaignCodexTitle());
  renderCodexBreadcrumbs([]);

  clearCodexMobileUtility?.();
  resetCodexMobileListState?.();
  clearCodexDetailSectionStateCache?.();
  codexSearchActiveGroup = "all";

  codexSearchQuery = "";
  syncCodexDesktopPersistentSearchInput("");

  const content = getCodexContent();
  content.className = "codex-home";

  content.innerHTML = `
    <div id="codex-home-section-buttons" class="codex-home-section-buttons codex-row-list">
      <button class="codex-row codex-home-section-row" type="button" onclick="openCodexPage('regions')">
        <span class="codex-row-icon" aria-hidden="true">${getCodexIcon("region")}</span>
        <span class="codex-row-main">
          <span class="codex-row-title">Regions</span>
          <span class="codex-row-meta">Browse lands, territories, and terrain profiles</span>
        </span>
        <span class="codex-row-arrow" aria-hidden="true">›</span>
      </button>

      <button class="codex-row codex-home-section-row" type="button" onclick="openCodexPage('pois')">
        <span class="codex-row-icon" aria-hidden="true">${getCodexIcon("poi")}</span>
        <span class="codex-row-main">
          <span class="codex-row-title">Points of Interest</span>
          <span class="codex-row-meta">Settlements, ruins, landmarks, and mapped places</span>
        </span>
        <span class="codex-row-arrow" aria-hidden="true">›</span>
      </button>

      <button class="codex-row codex-home-section-row" type="button" onclick="openCodexPage('npcs')">
        <span class="codex-row-icon" aria-hidden="true">${getCodexIcon("npc")}</span>
        <span class="codex-row-main">
          <span class="codex-row-title">NPCs</span>
          <span class="codex-row-meta">The denizens of Kadesh</span>
        </span>
        <span class="codex-row-arrow" aria-hidden="true">›</span>
      </button>

      <button class="codex-row codex-home-section-row" type="button" onclick="openCodexPage('hexes')">
        <span class="codex-row-icon codex-row-icon-hex" aria-hidden="true">${getCodexIcon("hex")}</span>
        <span class="codex-row-main">
          <span class="codex-row-title">Hexes</span>
          <span class="codex-row-meta">Browse map hexes by terrain and region</span>
        </span>
        <span class="codex-row-arrow" aria-hidden="true">›</span>
      </button>
    </div>
  `;

  requestAnimationFrame(fitCodexHeaderText);
}

function openCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.add("open");
}

function closeCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.remove("open");
}

window.addEventListener("campaign-renamed", () => {
  const overlay = getCodexOverlay();
  const currentPage = getCurrentCodexPage();
  if (!overlay?.classList.contains("open") || !currentPage) return;

  renderCodexPage(currentPage.type, currentPage.id);
  fitCodexHeaderText();
});

window.openCodex = openCodex;
window.closeCodex = closeCodex;
window.openCodexPage = openCodexPage;
window.openCodexSearchResults = openCodexSearchResults;
window.openCodexSearchResult = openCodexSearchResult;
window.startCodexLiveSearch = startCodexLiveSearch;
window.restoreCodexLiveSearchReturnPage = restoreCodexLiveSearchReturnPage;
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;
window.openCodexMobileControls = openCodexMobileControls;
window.closeCodexMobileControls = closeCodexMobileControls;
window.fitCodexHeaderText = fitCodexHeaderText;
window.resetCodexHeaderFitStyles = resetCodexHeaderFitStyles;
