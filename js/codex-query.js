function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function applySortDirection(result, direction) {
  return direction === "desc" ? -result : result;
}

function sortRows(rows, compareFn, direction = "asc") {
  return [...rows].sort((a, b) => {
    return applySortDirection(compareFn(a, b), direction);
  });
}

function applyFilters(rows, filters) {
  return rows.filter(row => {
    return filters.every(filter => {
      if (!filter.value || filter.value === "all") {
        return true;
      }

      const rowValue = filter.getValue
        ? filter.getValue(row)
        : row?.[filter.field];

      return String(rowValue || "") === String(filter.value);
    });
  });
}

function getPoiNotorietyRank(value) {
  const clean = String(value || "").trim();

  const numberMatch = clean.match(/\d+/);

  if (numberMatch) {
    return Number(numberMatch[0]);
  }

  const fallbackOrder = {
    "Mythic": 1,
    "Legendary": 2,
    "Major": 3,
    "Regional": 4,
    "Local": 5
  };

  return fallbackOrder[clean] || 999;
}

function getNpcHomeLabel(npc) {
  const home = npc.Home_ID_Ref
    ? db?.poisById?.[npc.Home_ID_Ref]
    : null;

  return home?.Name || npc.Home_ID_Ref || "";
}

function getNpcFilterValue(npc, field) {
  if (field === "Race") return npc.Race || "";
  if (field === "Occupation") return npc.Occupation || "";
  if (field === "Organization") return npc?.Organization || "";
  if (field === "Home") return getNpcHomeLabel(npc);
  return "";
}

function getPoiRegionLabel(poi) {
  const hex = poi.Hex_ID_Ref ? db?.hexesById?.[poi.Hex_ID_Ref] : null;
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  return region?.Region_Name || hex?.Region_ID_Ref || "";
}

function getPoiFilterValue(poi, field) {
  if (field === "Type") return poi.POI_Type || "";
  if (field === "Notoriety") return poi["Notoriety Tier"] || "";
  if (field === "Region") return getPoiRegionLabel(poi);
  return "";
}

function getUniqueValues(rows, getValue) {
  return [...new Set(
    rows
      .map(getValue)
      .filter(Boolean)
  )].sort();
}

function getDynamicFilterOptions(rows, getValue) {
  return [
    { value: "all", label: "All" },
    ...getUniqueValues(rows, getValue).map(value => ({
      value,
      label: value
    }))
  ];
}

function getNpcFilterOptions(field) {
  const npcs = db?.raw?.npcs || [];
  return getDynamicFilterOptions(npcs, npc => getNpcFilterValue(npc, field));
}

function getPoiFilterOptions(field) {
  const pois = db?.raw?.pois || [];
  return getDynamicFilterOptions(pois, poi => getPoiFilterValue(poi, field));
}

function updateDynamicFilterValueOptions(fieldSelectId, valueSelectId, getOptions, fallbackField) {
  const field = document.getElementById(fieldSelectId)?.value || fallbackField;
  const valueSelect = document.getElementById(valueSelectId);

  if (!valueSelect) return;

  valueSelect.innerHTML = renderCodexSelectOptions(
    getOptions(field),
    "all"
  );
}

function updateNpcFilterValueOptions(fieldSelectId, valueSelectId) {
  updateDynamicFilterValueOptions(
    fieldSelectId,
    valueSelectId,
    getNpcFilterOptions,
    "Race"
  );
}

function updatePoiFilterValueOptions(fieldSelectId, valueSelectId) {
  updateDynamicFilterValueOptions(
    fieldSelectId,
    valueSelectId,
    getPoiFilterOptions,
    "Type"
  );
}

function compareByTextThenName(getPrimary) {
  return (a, b) => {
    const primary = compareText(getPrimary(a), getPrimary(b));
    return primary !== 0 ? primary : compareText(a.Name, b.Name);
  };
}

function compareByNumberThenName(getPrimary) {
  return (a, b) => {
    const primary = getPrimary(a) - getPrimary(b);
    return primary !== 0 ? primary : compareText(a.Name, b.Name);
  };
}

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

function applyConfiguredSort(rows, compareFn, sortDirection) {
  if (!compareFn) {
    return rows;
  }

  return sortRows(rows, compareFn, sortDirection);
}

function applyConfiguredFilters(rows, filterState, getFilterValue) {
  return applyFilters(
    rows,
    filterState.map(filter => ({
      value: filter.value,
      getValue: row => getFilterValue(row, filter.field)
    }))
  );
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

const poiCodexListConfig = {
  fieldOptions: [
    { value: "Type", label: "Type" },
    { value: "Notoriety", label: "Notoriety" },
    { value: "Region", label: "Region" }
  ],

  filters: [
    {
      id: "codex-poi-filter-1-value",
      fieldId: "codex-poi-filter-1-field",
      label: "Type",
      fieldValue: "Type",
      selectedValue: "all"
    },
    {
      id: "codex-poi-filter-2-value",
      fieldId: "codex-poi-filter-2-field",
      label: "Notoriety",
      fieldValue: "Notoriety",
      selectedValue: "all"
    }
  ],

  sortId: "codex-poi-sort",
  directionId: "codex-poi-direction",
  selectedSort: "name",

  sortOptions: [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
    { value: "notoriety", label: "Notoriety" },
    { value: "population", label: "Population" },
    { value: "npc-count", label: "NPC Count" }
  ],

  sortComparators: {
    name: (a, b) => compareText(a.Name, b.Name),

    type: compareByTextThenName(row => row.POI_Type),

    notoriety: (a, b) => {
      const primary =
        getPoiNotorietyRank(a["Notoriety Tier"]) -
        getPoiNotorietyRank(b["Notoriety Tier"]);

      return primary !== 0
        ? primary
        : compareText(a.Name, b.Name);
    },

    population: compareByNumberThenName(row =>
      Number(String(row.Population || "").replace(/[^\d]/g, "")) || 0
    ),

    "npc-count": compareByNumberThenName(row =>
      getNpcsForPoi(row.POI_ID).length
    )
  },

  bindControls: () => bindCodexListControls({
    filters: [
      {
        fieldId: "codex-poi-filter-1-field",
        valueId: "codex-poi-filter-1-value",
        updateOptions: () => updatePoiFilterValueOptions(
          "codex-poi-filter-1-field",
          "codex-poi-filter-1-value"
        )
      },
      {
        fieldId: "codex-poi-filter-2-field",
        valueId: "codex-poi-filter-2-value",
        updateOptions: () => updatePoiFilterValueOptions(
          "codex-poi-filter-2-field",
          "codex-poi-filter-2-value"
        )
      }
    ],
    sortId: "codex-poi-sort",
    directionId: "codex-poi-direction",
    render: renderPoiListIntoContainer
  })
};

const npcCodexListConfig = {
  fieldOptions: [
    { value: "Race", label: "Race" },
    { value: "Occupation", label: "Occupation" },
    { value: "Organization", label: "Organization" },
    { value: "Home", label: "Home" }
  ],

  filters: [
    {
      id: "codex-npc-filter-1-value",
      fieldId: "codex-npc-filter-1-field",
      label: "Race",
      fieldValue: "Race",
      selectedValue: "all"
    },
    {
      id: "codex-npc-filter-2-value",
      fieldId: "codex-npc-filter-2-field",
      label: "Occupation",
      fieldValue: "Occupation",
      selectedValue: "all"
    }
  ],

  sortId: "codex-npc-sort",
  directionId: "codex-npc-direction",
  selectedSort: "name",

  sortOptions: [
    { value: "name", label: "Name" },
    { value: "race", label: "Race" },
    { value: "occupation", label: "Occupation" }
  ],

  sortComparators: {
    name: (a, b) => compareText(a.Name, b.Name),

    race: compareByTextThenName(row => row.Race),

    occupation: compareByTextThenName(row => row.Occupation)
  },
  
  bindControls: () => bindCodexListControls({
    filters: [
      {
        fieldId: "codex-npc-filter-1-field",
        valueId: "codex-npc-filter-1-value",
        updateOptions: () => updateNpcFilterValueOptions(
          "codex-npc-filter-1-field",
          "codex-npc-filter-1-value"
        )
      },
      {
        fieldId: "codex-npc-filter-2-field",
        valueId: "codex-npc-filter-2-value",
        updateOptions: () => updateNpcFilterValueOptions(
          "codex-npc-filter-2-field",
          "codex-npc-filter-2-value"
        )
      }
    ],
    sortId: "codex-npc-sort",
    directionId: "codex-npc-direction",
    render: renderNpcListIntoContainer
  })
};