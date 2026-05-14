/* =========================================================
   CODEX QUERY / SORT / FILTER HELPERS
   ========================================================= */

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
