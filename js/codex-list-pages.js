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

  listEl.innerHTML = renderCodexLinkedList(
    pois,
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

      <div class="codex-list-scroll-shell codex-scroll-fade">
        <div id="${escapeHtml(config.listId)}"></div>
      </div>
    </div>
  `, config.breadcrumbs);

  document.getElementById("codex-content").classList.add("codex-list-page");

  config.bindControls();
  config.renderList();
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
