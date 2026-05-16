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
}

function closeCodex(options = {}) {
  const overlay = getCodexOverlay();
  const wasOpen = overlay.classList.contains("open");

  codexSearchQuery = "";
  codexLiveSearchActive = false;
  codexLiveSearchReturnPage = null;
  codexLastManuscriptPageType = null;
  syncCodexDesktopPersistentSearchInput("");

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
  getCodexTitle().textContent = title;
}

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

  const mobileCrumbs = displayCrumbs.slice(-2);

  const mobileHtml = `
    ${displayCrumbs.length > 2
      ? `<span class="codex-breadcrumb-ellipsis">...</span><span class="codex-breadcrumb-separator">/</span>`
      : ""
    }

    ${mobileCrumbs
      .map((crumb, index) => renderCodexBreadcrumbItem(
        crumb,
        index === mobileCrumbs.length - 1
      ))
      .join("")}
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
  updateCodexBackButton();
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
  maybeRefreshCodexLeftManuscript(type);

  if (databaseLoadError) {
    setCodexTitle("The Codex of Kadesh");
    setCodexContent(`
      <p>The records could not be gathered.</p>
      <p>Please refresh the page and consult the Codex again.</p>
    `);
    return;
  }

  if (!db) {
    setCodexTitle("The Codex of Kadesh");
    setCodexContent(`<p>The records are still being gathered...</p>`);
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
  setCodexTitle("The Codex of Kadesh");
  renderCodexBreadcrumbs([]);

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