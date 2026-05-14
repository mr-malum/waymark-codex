/* =========================================================
   CODEX CORE / ROUTING / HISTORY
   ========================================================= */

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

function getCurrentCodexPage() {
  return codexHistory[codexHistory.length - 1] || null;
}

function pushCodexHistory(type, id) {
  codexHistory.push({ type, id });
}

function popCodexHistory() {
  codexHistory.pop();
  return getCurrentCodexPage();
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

  prepareCodexNavigation();

  if (shouldPush) {
    pushCodexHistory(type, id);
  }

  renderCodexPage(type, id);
  updateCodexBackButton();
}

function goBackCodex() {
  if (codexHistory.length <= 1) return;

  const previous = popCodexHistory();

  if (!previous) return;

  renderCodexPage(previous.type, previous.id);
  updateCodexBackButton();
}

function resetCodexToIndex() {
  codexHistory = [];
  openCodexPage("index", null);
}

function renderCodexPage(type, id) {
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

  return renderCodexIndex();
}

function renderCodexIndex() {
  setCodexTitle("The Codex of Kadesh");
  renderCodexBreadcrumbs([]);

  codexSearchQuery = "";

  const content = getCodexContent();
  content.className = "codex-home codex-home-search-page";

  content.innerHTML = `
    <div class="codex-home-search-page-shell">
      <div class="codex-home-search-controls-shell">
        <div class="codex-search-shell codex-home-search-shell">
          <input
            id="codex-search-input"
            type="search"
            placeholder="Consult the Codex..."
            autocomplete="off"
            value=""
          >
        </div>
      </div>

      <div id="codex-home-section-buttons" class="codex-home-section-buttons">
        <button class="codex-section-button" type="button" onclick="openCodexPage('regions')">Regions</button>
        <button class="codex-section-button" type="button" onclick="openCodexPage('pois')">Points of Interest</button>
        <button class="codex-section-button" type="button" onclick="openCodexPage('npcs')">NPCs</button>
      </div>

      <div id="codex-search-results" class="codex-search-results-shell"></div>
    </div>

    <div
      id="codex-search-results-modal"
      class="codex-search-results-modal"
      aria-hidden="true"
      onclick="handleCodexSearchModalBackdropClick(event)"
    ></div>
  `;

  bindCodexHomeSearchInput();
}

function updateCodexHomeSearchState(query) {
  const content = getCodexContent();
  const buttons = document.getElementById("codex-home-section-buttons");
  const hasQuery = Boolean(String(query || "").trim());

  content.classList.toggle("codex-home-search-active", hasQuery);

  if (buttons) {
    buttons.setAttribute("aria-hidden", hasQuery ? "true" : "false");
  }
}

function bindCodexHomeSearchInput() {
  const input = document.getElementById("codex-search-input");
  if (!input) return;

  input.addEventListener("input", function () {
    codexSearchQuery = input.value;
    updateCodexHomeSearchState(input.value);
    renderCodexSearchResults(input.value);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    input.blur();
  });

  updateCodexHomeSearchState(input.value);
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
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;
window.openCodexMobileControls = openCodexMobileControls;
window.closeCodexMobileControls = closeCodexMobileControls;
