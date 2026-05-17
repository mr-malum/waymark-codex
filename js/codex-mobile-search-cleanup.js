/* =========================================================
   MOBILE SEARCH RESULTS CLEANUP
   =========================================================

   Mobile search results should behave like a rendered page, not like a
   persistent search form. Desktop live search remains owned by
   codex-search-page.js.
*/

function renderCodexSearchPage() {
  const isMobile = isMobileCodexSearchLayout();
  const hasQuery = Boolean(String(codexSearchQuery || "").trim());

  setCodexTitle(isMobile && hasQuery ? "Search Results" : "Search the Codex");

  renderCodexBreadcrumbs([
    { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
    { label: "Search" }
  ]);

  const content = document.getElementById("codex-content");
  content.className = "codex-search-page";

  if (isMobile && hasQuery) {
    registerCodexMobileSearchCategoryUtility();

    content.innerHTML = `
      <div class="codex-search-page-shell codex-mobile-search-page-shell">
        <div id="codex-mobile-search-query-summary" class="codex-mobile-search-query-summary">
          ${renderCodexMobileSearchQuerySummary()}
        </div>

        <div id="codex-search-results" class="codex-search-results-shell"></div>
      </div>
    `;

    renderCodexSearchResults(codexSearchQuery);
    return;
  }

  clearCodexMobileUtility?.();

  content.innerHTML = `
    <div class="codex-search-page-shell">
      <div class="codex-search-controls-shell">
        <div class="codex-search-shell">
          <input
            id="codex-search-input"
            type="search"
            placeholder="Consult the Codex..."
            autocomplete="off"
            value="${escapeHtml(codexSearchQuery)}"
          >
        </div>
      </div>

      <div id="codex-search-results" class="codex-search-results-shell"></div>
    </div>
  `;

  bindCodexSearchInput();
}

function getCodexMobileSearchActiveCategoryLabel() {
  if (codexSearchActiveGroup === "all") return "All";

  const activeGroup = CODEX_SEARCH_GROUPS.find(group => group.type === codexSearchActiveGroup);
  return activeGroup?.label || "All";
}

function getCodexMobileSearchActiveMatchCount(results) {
  const activeGroup = CODEX_SEARCH_GROUPS.find(group => group.type === codexSearchActiveGroup);
  return activeGroup
    ? getCodexSearchGroupRows(activeGroup, results).length
    : getCodexSearchTotalCount(results);
}

function renderCodexMobileSearchQuerySummary(results = null) {
  const cleanQuery = normalizeCodexSearchQuery(codexSearchQuery);
  const searchResults = results || (cleanQuery ? buildCodexSearchResults(cleanQuery) : []);
  const categoryLabel = getCodexMobileSearchActiveCategoryLabel().toUpperCase();
  const matchLabel = getCodexSearchMatchLabel(
    getCodexMobileSearchActiveMatchCount(searchResults)
  );

  return `
    <span class="codex-mobile-search-summary-query">
      For &ldquo;${escapeHtml(codexSearchQuery)}&rdquo;
    </span>
    <span class="codex-mobile-search-summary-count">
      ${escapeHtml(categoryLabel)}: ${escapeHtml(matchLabel)}
    </span>
  `;
}

function updateCodexMobileSearchQuerySummary(results = null) {
  const summary = document.getElementById("codex-mobile-search-query-summary");
  if (!summary) return;

  summary.innerHTML = renderCodexMobileSearchQuerySummary(results);
}

function getCodexSearchCategoryOptions(results) {
  return [
    {
      type: "all",
      label: "All",
      count: getCodexSearchTotalCount(results)
    },
    ...CODEX_SEARCH_GROUPS.map(group => ({
      type: group.type,
      label: group.label,
      count: getCodexSearchGroupCount(group, results)
    }))
  ];
}

function registerCodexMobileSearchCategoryUtility() {
  if (typeof setCodexMobileUtility !== "function") return;

  setCodexMobileUtility({
    type: "category",
    label: "Category",
    panelTitle: "Category",
    renderPanel: renderCodexMobileSearchCategoryPanel,
    bindPanel: bindCodexMobileSearchCategoryPanel
  });
}

function renderCodexMobileSearchCategoryPanel() {
  const cleanQuery = normalizeCodexSearchQuery(codexSearchQuery);
  const results = cleanQuery ? buildCodexSearchResults(cleanQuery) : [];
  const options = getCodexSearchCategoryOptions(results);

  return options.map(option => {
    const isActive = codexSearchActiveGroup === option.type;
    const isDisabled = option.count === 0;

    return `
      <button
        class="codex-mobile-utility-option ${isActive ? "is-active" : ""}"
        type="button"
        data-codex-search-category="${escapeHtml(option.type)}"
        ${isDisabled ? "disabled" : ""}
      >
        ${escapeHtml(option.label)} — ${escapeHtml(getCodexSearchMatchLabel(option.count))}
      </button>
    `;
  }).join("");
}

function bindCodexMobileSearchCategoryPanel(panel) {
  panel
    .querySelectorAll("[data-codex-search-category]")
    .forEach(button => {
      button.addEventListener("click", function () {
        setCodexSearchActiveGroup(this.dataset.codexSearchCategory || "all");
        closeCodexMobileUtilityPanel?.();
      });
    });
}
