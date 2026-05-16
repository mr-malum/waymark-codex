/* =========================================================
   MOBILE LIST FILTER UTILITY
   =========================================================

   Reuses the existing list control DOM for mobile instead of cloning controls
   and creating duplicate IDs. Desktop rail remains the source location.
*/

let originalRenderCodexListPage = renderCodexListPage;
let originalRenderCodexHexListPage = renderCodexHexListPage;
let codexListStateCache = {};
let codexCurrentListConfig = null;
let codexHexListStateCache = null;

function resetCodexMobileListState() {
  codexListStateCache = {};
  codexCurrentListConfig = null;
  codexHexListStateCache = null;
}

function getCodexListStateKey(config) {
  return config?.listId || config?.title || "default-list";
}

function getCodexCachedListState(config) {
  return codexListStateCache[getCodexListStateKey(config)] || null;
}

function cacheCodexListState(config = codexCurrentListConfig) {
  if (!config) return;

  const filters = config.filters.map(filter => ({
    field: document.getElementById(filter.fieldId)?.value || filter.fieldValue,
    value: document.getElementById(filter.id)?.value || "all"
  }));

  const sortMode = document.getElementById(config.sortId)?.value || config.selectedSort;
  const direction = document.getElementById(config.directionId)?.dataset?.direction || "asc";

  codexListStateCache[getCodexListStateKey(config)] = {
    filters,
    sortMode,
    direction
  };
}

function getCodexListFilterOptionLabel(config, field, value) {
  if (!value || value === "all") return "All";

  const option = config.getFilterOptions(field).find(item => item.value === value);
  return option?.label || value;
}

function getCodexListSortLabel(config, sortMode) {
  return config.sortOptions.find(option => option.value === sortMode)?.label || sortMode || "Name";
}

function getCodexListSummaryState(config) {
  return getCodexCachedListState(config) || {
    filters: config.filters.map(filter => ({
      field: filter.fieldValue,
      value: filter.selectedValue || "all"
    })),
    sortMode: config.selectedSort,
    direction: "asc"
  };
}

function renderCodexListSummaryInner(config, state = getCodexListSummaryState(config)) {
  const filterSummary = state.filters
    .map(filter => `${filter.field}: ${getCodexListFilterOptionLabel(config, filter.field, filter.value)}`)
    .join(" • ");

  const sortLabel = getCodexListSortLabel(config, state.sortMode);
  const directionArrow = state.direction === "desc" ? "↓" : "↑";

  return `
    <span class="codex-mobile-list-summary-filters">${escapeHtml(filterSummary)}</span>
    <span class="codex-mobile-list-summary-sort">${escapeHtml(sortLabel)} ${directionArrow}</span>
  `;
}

function renderCodexListSummary(config) {
  return `
    <div id="codex-mobile-list-summary" class="codex-mobile-list-summary">
      ${renderCodexListSummaryInner(config)}
    </div>
  `;
}

function updateCodexListSummary(config = codexCurrentListConfig) {
  const summary = document.getElementById("codex-mobile-list-summary");
  if (!summary || !config) return;

  summary.innerHTML = renderCodexListSummaryInner(config);
}

function updateCodexListStateFromControls(config = codexCurrentListConfig) {
  cacheCodexListState(config);
  updateCodexListSummary(config);
}

function applyCodexCachedListState(config) {
  const cached = getCodexCachedListState(config);
  if (!cached) {
    cacheCodexListState(config);
    updateCodexListSummary(config);
    return;
  }

  cached.filters.forEach((cachedFilter, index) => {
    const filter = config.filters[index];
    if (!filter) return;

    const fieldEl = document.getElementById(filter.fieldId);

    if (fieldEl) {
      fieldEl.value = cachedFilter.field;
    }

    const valueEl = document.getElementById(filter.id);
    if (valueEl) {
      valueEl.innerHTML = renderCodexSelectOptions(
        config.getFilterOptions(cachedFilter.field),
        cachedFilter.value
      );
      valueEl.value = cachedFilter.value;
    }
  });

  const sortEl = document.getElementById(config.sortId);
  if (sortEl) {
    sortEl.value = cached.sortMode;
  }

  const directionEl = document.getElementById(config.directionId);
  if (directionEl) {
    directionEl.dataset.direction = cached.direction;
    directionEl.textContent = cached.direction === "asc" ? "↑ ASC" : "↓ DESC";
  }

  updateCodexListSummary(config);
}

function openCodexListResult(type, id) {
  updateCodexListStateFromControls();
  cacheCodexHexListState();
  openCodexPage(type, id);
}

function registerCodexMobileListFilterUtility() {
  if (typeof setCodexMobileUtility !== "function") return;

  setCodexMobileUtility({
    type: "filter-sort",
    label: "Filter & Sort",
    panelTitle: "Filter & Sort",
    renderPanel: renderCodexMobileListUtilityPanel,
    bindPanel: bindCodexMobileListUtilityPanel,
    beforeClose: restoreCodexMobileListControls
  });
}

function renderCodexMobileListUtilityPanel() {
  return `<div id="codex-mobile-list-controls-mount" class="codex-mobile-list-controls-mount"></div>`;
}

function bindCodexMobileListUtilityPanel(panel) {
  const mount = panel.querySelector("#codex-mobile-list-controls-mount");
  const controls = document.getElementById("codex-list-controls-shell");

  if (!mount || !controls) return;

  controls.dataset.mobileMounted = "true";
  mount.appendChild(controls);
}

function restoreCodexMobileListControls() {
  const controls = document.getElementById("codex-list-controls-shell");
  const home = document.getElementById("codex-list-controls-home");

  if (!controls || !home) return;

  controls.dataset.mobileMounted = "false";
  home.appendChild(controls);
}

function wrapCodexListRender(config) {
  const originalRenderList = config.renderList;

  return {
    ...config,
    renderList() {
      updateCodexListStateFromControls(config);
      originalRenderList();
    }
  };
}

function bindCodexListStateListeners(config) {
  const root = document.getElementById("codex-list-controls-shell");
  if (!root) return;

  root.addEventListener("change", function () {
    window.setTimeout(() => updateCodexListStateFromControls(config), 0);
  });

  document.getElementById(config.directionId)?.addEventListener("click", function () {
    window.setTimeout(() => updateCodexListStateFromControls(config), 0);
  });

  document.getElementById(config.listId)?.addEventListener("click", function (event) {
    if (!event.target.closest?.(".codex-linked-record-row")) return;
    updateCodexListStateFromControls(config);
  }, true);
}

function renderCodexListPage(config) {
  const listConfig = wrapCodexListRender(config);
  codexCurrentListConfig = listConfig;

  setCodexTitle(listConfig.title);

  const cached = getCodexCachedListState(listConfig);

  const filtersForRender = listConfig.filters.map((filter, index) => {
    const cachedFilter = cached?.filters?.[index];
    const fieldValue = cachedFilter?.field || filter.fieldValue;
    const selectedValue = cachedFilter?.value || filter.selectedValue || "all";

    return {
      ...filter,
      fieldValue,
      selectedValue,
      fieldOptions: listConfig.fieldOptions,
      options: listConfig.getFilterOptions(fieldValue)
    };
  });

  const controlsHtml = renderCodexListControls({
    filters: filtersForRender,
    sortId: listConfig.sortId,
    selectedSort: cached?.sortMode || listConfig.selectedSort,
    sortOptions: listConfig.sortOptions,
    directionId: listConfig.directionId,
    direction: cached?.direction || "asc"
  });

  setCodexContent(`
    <div class="codex-list-page-shell">
      ${renderCodexListSummary(listConfig)}

      <div class="codex-list-control-split-view">
        <aside class="codex-list-control-rail">
          <div id="codex-list-controls-home">
            <div class="codex-list-controls-shell" id="codex-list-controls-shell" data-mobile-mounted="false">
              <div class="codex-mobile-controls-panel">
                <div class="codex-mobile-controls-heading">
                  <h3>Filter & Sort</h3>
                </div>

                ${controlsHtml}
              </div>
            </div>
          </div>
        </aside>

        <div class="codex-list-scroll-shell codex-scroll-fade">
          <div id="${escapeHtml(listConfig.listId)}"></div>
        </div>
      </div>
    </div>
  `, listConfig.breadcrumbs);

  document.getElementById("codex-content").classList.add("codex-list-page");

  listConfig.bindControls();
  bindCodexListStateListeners(listConfig);
  applyCodexCachedListState(listConfig);
  listConfig.renderList();
  registerCodexMobileListFilterUtility();
}

function getCodexHexListSortLabel(sortMode) {
  return hexCodexListConfig.sortOptions.find(option => option.value === sortMode)?.label || sortMode || "Hex ID";
}

function getCheckedHexRegionLabels() {
  const selectedIds = readCheckedHexRegionIds();
  const allRegions = getHexRegionFilterOptions();

  if (selectedIds.size === allRegions.length) return ["All Regions"];
  if (selectedIds.size === 0) return ["No Regions"];

  return allRegions
    .filter(region => selectedIds.has(region.id))
    .map(region => region.label);
}

function cacheCodexHexListState() {
  const sortMode = document.getElementById(hexCodexListConfig.sortId)?.value || hexCodexListConfig.selectedSort;
  const direction = document.getElementById(hexCodexListConfig.directionId)?.dataset?.direction || "asc";
  const regionIds = [...readCheckedHexRegionIds()];

  codexHexListStateCache = { sortMode, direction, regionIds };
}

function applyCodexHexListState() {
  if (!codexHexListStateCache) {
    cacheCodexHexListState();
    updateCodexHexListSummary();
    return;
  }

  const sortEl = document.getElementById(hexCodexListConfig.sortId);
  if (sortEl) sortEl.value = codexHexListStateCache.sortMode;

  const directionEl = document.getElementById(hexCodexListConfig.directionId);
  if (directionEl) {
    directionEl.dataset.direction = codexHexListStateCache.direction;
    directionEl.textContent = codexHexListStateCache.direction === "asc" ? "↑ ASC" : "↓ DESC";
  }

  const selectedIds = new Set(codexHexListStateCache.regionIds || []);
  getHexRegionCheckboxes().forEach(checkbox => {
    checkbox.checked = selectedIds.has(checkbox.value);
  });

  updateHexRegionAllCheckbox();
  updateCodexHexListSummary();
}

function renderCodexHexListSummaryInner() {
  const state = codexHexListStateCache || {
    sortMode: hexCodexListConfig.selectedSort,
    direction: "asc"
  };

  const regions = getCheckedHexRegionLabels().join(" • ");
  const sortLabel = getCodexHexListSortLabel(state.sortMode);
  const directionArrow = state.direction === "desc" ? "↓" : "↑";

  return `
    <span class="codex-mobile-list-summary-filters">${escapeHtml(regions)}</span>
    <span class="codex-mobile-list-summary-sort">${escapeHtml(sortLabel)} ${directionArrow}</span>
  `;
}

function renderCodexHexListSummary() {
  return `
    <div id="codex-mobile-list-summary" class="codex-mobile-list-summary codex-mobile-hex-list-summary">
      ${renderCodexHexListSummaryInner()}
    </div>
  `;
}

function updateCodexHexListSummary() {
  const summary = document.getElementById("codex-mobile-list-summary");
  if (!summary) return;

  summary.innerHTML = renderCodexHexListSummaryInner();
}

function renderCodexHexListPage() {
  setCodexTitle("Hexes");

  setCodexContent(`
    <div class="codex-list-page-shell codex-hex-list-page-shell">
      ${renderCodexHexListSummary()}

      <div class="codex-list-control-split-view">
        <aside class="codex-list-control-rail codex-hex-list-control-rail">
          <div id="codex-list-controls-home">
            <div class="codex-list-controls-shell" id="codex-list-controls-shell" data-mobile-mounted="false">
              <div class="codex-mobile-controls-panel">
                <div class="codex-mobile-controls-heading">
                  <h3>Filter & Sort</h3>
                </div>

                ${renderHexListControls()}
              </div>
            </div>
          </div>
        </aside>

        <div class="codex-list-scroll-shell codex-scroll-fade">
          <div id="codex-hex-list"></div>
        </div>
      </div>
    </div>
  `, [
    { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
    { label: "Hexes" }
  ]);

  document.getElementById("codex-content").classList.add("codex-list-page", "codex-hexes-index-page");

  bindHexListControls();
  applyCodexHexListState();

  const controls = document.getElementById("codex-list-controls-shell");
  controls?.addEventListener("change", function () {
    window.setTimeout(() => {
      cacheCodexHexListState();
      updateCodexHexListSummary();
    }, 0);
  });

  document.getElementById(hexCodexListConfig.directionId)?.addEventListener("click", function () {
    window.setTimeout(() => {
      cacheCodexHexListState();
      updateCodexHexListSummary();
    }, 0);
  });

  document.getElementById("codex-hex-list")?.addEventListener("click", function (event) {
    if (!event.target.closest?.(".codex-linked-record-row")) return;
    cacheCodexHexListState();
  }, true);

  renderHexListIntoContainer();
  registerCodexMobileListFilterUtility();
}

window.registerCodexMobileListFilterUtility = registerCodexMobileListFilterUtility;
window.openCodexListResult = openCodexListResult;
window.resetCodexMobileListState = resetCodexMobileListState;
