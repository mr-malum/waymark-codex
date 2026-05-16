/* =========================================================
   CODEX LIST PAGES
   ========================================================= */

function bindCodexListControls(config) {
  config.filters.forEach(filter => {
    document.getElementById(filter.fieldId)?.addEventListener(
      "change",
      function () {
        filter.updateOptions();
        config.render();
      }
    );

    document.getElementById(filter.valueId)?.addEventListener(
      "change",
      config.render
    );
  });

  document.getElementById(config.sortId)?.addEventListener(
    "change",
    config.render
  );

  document.getElementById(config.directionId)?.addEventListener(
    "click",
    function () {
      const current = this.dataset.direction || "asc";
      const next = current === "asc" ? "desc" : "asc";

      this.dataset.direction = next;
      this.textContent = next === "asc" ? "↑ ASC" : "↓ DESC";

      config.render();
    }
  );
}

function readCodexFilterState(config) {
  return config.filters.map(filter => {
    const field =
      document.getElementById(filter.fieldId)?.value ||
      filter.fieldValue;

    const value =
      document.getElementById(filter.id)?.value ||
      filter.selectedValue ||
      "all";

    return {
      field,
      value
    };
  });
}

function readCodexSortState(config) {
  const sortMode =
    document.getElementById(config.sortId)?.value ||
    config.selectedSort;

  const direction =
    document.getElementById(config.directionId)?.dataset?.direction ||
    "asc";

  return {
    sortMode,
    direction
  };
}

function getHexRegionFilterOptions() {
  return [...(db?.raw?.regions || [])]
    .map(region => ({
      id: region.Region_ID,
      label: region.Region_Name || region.Region_ID || "Unnamed Region"
    }))
    .filter(region => region.id)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getHexRegionCheckboxes() {
  return [...document.querySelectorAll("[data-codex-hex-region-filter]")];
}

function updateHexRegionAllCheckbox() {
  const allCheckbox = document.getElementById("codex-hex-region-filter-all");
  const checkboxes = getHexRegionCheckboxes();
  if (!allCheckbox || !checkboxes.length) return;

  const checkedCount = checkboxes.filter(checkbox => checkbox.checked).length;

  allCheckbox.checked = checkedCount === checkboxes.length;
  allCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function readCheckedHexRegionIds() {
  const checkboxes = getHexRegionCheckboxes();

  if (!checkboxes.length) {
    return new Set(getHexRegionFilterOptions().map(region => region.id));
  }

  return new Set(
    checkboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value)
  );
}

function renderHexRegionChecklist() {
  const regions = getHexRegionFilterOptions();

  return `
    <div class="codex-hex-region-filter-panel">
      <div class="codex-hex-region-filter-heading">Regions</div>

      <div class="codex-hex-region-checklist codex-scroll-fade">
        ${regions.length ? `
          <label class="codex-hex-region-check-row codex-hex-region-check-all-row">
            <input
              id="codex-hex-region-filter-all"
              type="checkbox"
              checked
            >
            <span>(ALL)</span>
          </label>
        ` : ""}

        ${regions.map(region => `
          <label class="codex-hex-region-check-row">
            <input
              type="checkbox"
              value="${escapeHtml(region.id)}"
              data-codex-hex-region-filter
              checked
            >
            <span>${escapeHtml(region.label)}</span>
          </label>
        `).join("") || `<p>No regions recorded.</p>`}
      </div>
    </div>
  `;
}

function renderHexListControls() {
  return `
    <div class="codex-filter-row codex-hex-filter-row">
      <div class="codex-sort-label">
        <div class="codex-sort-topline">
          <span>Sort</span>

          <button
            id="${escapeHtml(hexCodexListConfig.directionId)}"
            class="codex-sort-direction"
            type="button"
            data-direction="asc"
          >
            ↑ ASC
          </button>
        </div>

        <select
          id="${escapeHtml(hexCodexListConfig.sortId)}"
          aria-label="Sort hexes by"
        >
          ${renderCodexSelectOptions(hexCodexListConfig.sortOptions, hexCodexListConfig.selectedSort)}
        </select>
      </div>

      ${renderHexRegionChecklist()}
    </div>
  `;
}

function bindHexListControls() {
  document.getElementById(hexCodexListConfig.sortId)?.addEventListener(
    "change",
    renderHexListIntoContainer
  );

  document.getElementById(hexCodexListConfig.directionId)?.addEventListener(
    "click",
    function () {
      const current = this.dataset.direction || "asc";
      const next = current === "asc" ? "desc" : "asc";

      this.dataset.direction = next;
      this.textContent = next === "asc" ? "↑ ASC" : "↓ DESC";

      renderHexListIntoContainer();
    }
  );

  document.getElementById("codex-hex-region-filter-all")?.addEventListener(
    "change",
    function () {
      getHexRegionCheckboxes().forEach(checkbox => {
        checkbox.checked = this.checked;
      });

      this.indeterminate = false;
      renderHexListIntoContainer();
    }
  );

  getHexRegionCheckboxes().forEach(checkbox => {
    checkbox.addEventListener("change", function () {
      updateHexRegionAllCheckbox();
      renderHexListIntoContainer();
    });
  });

  updateHexRegionAllCheckbox();
}

function renderPoiListIntoContainer() {
  const listEl = document.getElementById("codex-poi-list");

  const [filterOne, filterTwo] = readCodexFilterState(
    poiCodexListConfig
  );

  const {
    sortMode,
    direction: sortDirection
  } = readCodexSortState(poiCodexListConfig);

  let pois = [...(db?.raw?.pois || [])];

  pois = applyConfiguredFilters(
    pois,
    [filterOne, filterTwo],
    getPoiFilterValue
  );

  const compareFn =
    poiCodexListConfig.sortComparators?.[sortMode] || null;

  pois = applyConfiguredSort(
    pois,
    compareFn,
    sortDirection
  );

  const listRows = createPoiGroupListRows(pois);

  listEl.innerHTML = renderCodexLinkedList(
    listRows,
    "No points of interest match these filters.",
    "poi",
    "POI_ID",
    buildPoiListLabel
  );
}

function renderNpcListIntoContainer() {
  const listEl = document.getElementById("codex-npc-list");

  const [filterOne, filterTwo] = readCodexFilterState(
    npcCodexListConfig
  );

  const {
    sortMode,
    direction: sortDirection
  } = readCodexSortState(npcCodexListConfig);

  let npcs = [...(db?.raw?.npcs || [])];

  npcs = applyConfiguredFilters(
    npcs,
    [filterOne, filterTwo],
    getNpcFilterValue
  );

  const compareFn =
    npcCodexListConfig.sortComparators?.[sortMode] || null;
  
  npcs = applyConfiguredSort(
    npcs,
    compareFn,
    sortDirection
  );

  listEl.innerHTML = renderCodexLinkedList(
    npcs,
    "No NPCs match these filters.",
    "npc",
    "NPC_ID",
    buildNpcListLabel
  );
}

function renderHexListIntoContainer() {
  const listEl = document.getElementById("codex-hex-list");
  if (!listEl) return;

  const allowedRegionIds = readCheckedHexRegionIds();
  const { sortMode, direction: sortDirection } = readCodexSortState(hexCodexListConfig);

  let hexes = [...(db?.raw?.hexes || [])].filter(hex => {
    return allowedRegionIds.has(hex.Region_ID_Ref);
  });

  const compareFn = hexCodexListConfig.sortComparators?.[sortMode] || null;
  hexes = applyConfiguredSort(hexes, compareFn, sortDirection);

  listEl.innerHTML = renderCodexLinkedList(
    hexes,
    "No hexes match these filters.",
    "hex",
    "Hex_ID",
    buildHexListLabel
  );
}

function renderCodexListPage(config) {
  setCodexTitle(config.title);

  const controlsHtml = renderCodexListControls({
    filters: config.filters.map(filter => ({
      ...filter,
      fieldOptions: config.fieldOptions,
      options: config.getFilterOptions(filter.fieldValue)
    })),
    sortId: config.sortId,
    selectedSort: config.selectedSort,
    sortOptions: config.sortOptions,
    directionId: config.directionId,
    direction: "asc"
  });

  setCodexContent(`
    <div class="codex-list-page-shell">
      <button
        class="codex-mobile-filter-toggle"
        type="button"
        onclick="openCodexMobileControls()"
      >
        Filter & Sort
      </button>

      <div class="codex-list-control-split-view">
        <aside class="codex-list-control-rail">
          <div class="codex-list-controls-shell" id="codex-list-controls-shell">
            <div class="codex-mobile-controls-panel">
              <div class="codex-mobile-controls-heading">
                <h3>Filter & Sort</h3>
              </div>

              ${controlsHtml}

              <button
                class="codex-mobile-controls-apply"
                type="button"
                onclick="closeCodexMobileControls()"
              >
                Apply
              </button>
            </div>
          </div>
        </aside>

        <div class="codex-list-scroll-shell codex-scroll-fade">
          <div id="${escapeHtml(config.listId)}"></div>
        </div>
      </div>
    </div>
  `, config.breadcrumbs);

  document.getElementById("codex-content").classList.add("codex-list-page");

  config.bindControls();
  config.renderList();
}

function renderCodexHexListPage() {
  setCodexTitle("Hexes");

  setCodexContent(`
    <div class="codex-list-page-shell codex-hex-list-page-shell">
      <button
        class="codex-mobile-filter-toggle"
        type="button"
        onclick="openCodexMobileControls()"
      >
        Filter & Sort
      </button>

      <div class="codex-list-control-split-view">
        <aside class="codex-list-control-rail codex-hex-list-control-rail">
          <div class="codex-list-controls-shell" id="codex-list-controls-shell">
            <div class="codex-mobile-controls-panel">
              <div class="codex-mobile-controls-heading">
                <h3>Filter & Sort</h3>
              </div>

              ${renderHexListControls()}

              <button
                class="codex-mobile-controls-apply"
                type="button"
                onclick="closeCodexMobileControls()"
              >
                Apply
              </button>
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
  renderHexListIntoContainer();
}

function renderCodexPoisIndex() {
  renderCodexListPage({
    ...poiCodexListConfig,

    title: "Points of Interest",

    listId: "codex-poi-list",

    breadcrumbs: [
      { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
      { label: "Points of Interest" }
    ],

    getFilterOptions: getPoiFilterOptions,

    renderList: renderPoiListIntoContainer
  });
}

function renderCodexNpcsIndex() {
  renderCodexListPage({
    ...npcCodexListConfig,

    title: "NPCs",

    listId: "codex-npc-list",

    breadcrumbs: [
      { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
      { label: "NPCs" }
    ],

    getFilterOptions: getNpcFilterOptions,

    renderList: renderNpcListIntoContainer
  });
}

function renderCodexHexesIndex() {
  renderCodexHexListPage();
}
