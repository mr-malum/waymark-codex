/* =========================================================
   CODEX LIST CONFIGURATION
   ========================================================= */

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

const hexCodexListConfig = {
  sortId: "codex-hex-sort",
  directionId: "codex-hex-direction",
  selectedSort: "hex-id",

  sortOptions: [
    { value: "hex-id", label: "Hex ID" },
    { value: "poi-count", label: "POI Count" },
    { value: "npc-count", label: "NPC Count" }
  ],

  sortComparators: {
    "hex-id": (a, b) => String(a.Hex_ID || "").localeCompare(
      String(b.Hex_ID || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    ),

    "poi-count": compareByNumberThenName(row =>
      getHexCounts(row.Hex_ID).poiCount
    ),

    "npc-count": compareByNumberThenName(row =>
      getHexCounts(row.Hex_ID).npcCount
    )
  }
};
