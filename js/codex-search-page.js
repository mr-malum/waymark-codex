/* =========================================================
   CODEX SEARCH PAGE
   ========================================================= */

const CODEX_SEARCH_GROUPS = [
  { type: "poi", label: "POIs", icon: "✦" },
  { type: "npc", label: "NPCs", icon: "♟" },
  { type: "region", label: "Regions", icon: "◇" },
  { type: "hex", label: "Hexes", icon: "⬡" }
];

let codexSearchActiveGroup = "all";
let codexSearchRenderTimer = null;

function scheduleCodexSearchResultsRender(query) {
  window.clearTimeout(codexSearchRenderTimer);

  codexSearchRenderTimer = window.setTimeout(() => {
    renderCodexSearchResults(query);
  }, 85);
}

function renderCodexSearchPage() {
  setCodexTitle("Search the Codex");

  renderCodexBreadcrumbs([
    { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
    { label: "Search" }
  ]);

  const content = document.getElementById("codex-content");
  content.className = "codex-search-page";

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

    <div
      id="codex-search-results-modal"
      class="codex-search-results-modal"
      aria-hidden="true"
      onclick="handleCodexSearchModalBackdropClick(event)"
    ></div>
  `;

  bindCodexSearchInput();
}

function bindCodexSearchInput() {
  const input = document.getElementById("codex-search-input");

  input.addEventListener("input", function () {
    codexSearchQuery = input.value;
    codexSearchActiveGroup = "all";
    scheduleCodexSearchResultsRender(input.value);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    input.blur();
  });

  if (codexSearchQuery.trim()) {
    renderCodexSearchResults(codexSearchQuery);
  }

  input.focus();
}

function isMobileCodexSearchLayout() {
  return window.matchMedia("(max-width: 700px)").matches;
}

function renderCodexSearchResults(query) {
  const resultsEl = document.getElementById("codex-search-results");
  const cleanQuery = normalizeCodexSearchQuery(query);

  if (!resultsEl) return;

  closeCodexSearchResultsModal();

  if (!cleanQuery) {
    resultsEl.innerHTML = renderCodexEmptySearchMessage();
    return;
  }

  const results = buildCodexSearchResults(cleanQuery);
  resultsEl.innerHTML = isMobileCodexSearchLayout()
    ? renderMobileCodexSearchResultGroups(results)
    : renderCodexSearchResultGroups(results);
}

function normalizeCodexSearchQuery(query) {
  return String(query || "").trim().toLowerCase();
}

function renderCodexEmptySearchMessage() {
  return "";
}

function codexSearchTextMatches(values, cleanQuery) {
  return values.join(" ").toLowerCase().includes(cleanQuery);
}

function createCodexSearchCollector() {
  const results = [];
  const resultKeys = new Set();

  return {
    results,

    add(type, id, label) {
      const key = `${type}:${id}`;
      if (resultKeys.has(key)) return;

      resultKeys.add(key);
      results.push({ type, id, label });
    }
  };
}

function createCodexSearchContext() {
  return {
    matchingRegionIds: new Set(),
    matchingPoiHexIds: new Set(),
    matchingNpcHexIds: new Set()
  };
}

function buildCodexSearchResults(cleanQuery) {
  const collector = createCodexSearchCollector();
  const context = createCodexSearchContext();

  collectMatchingRegions(cleanQuery, collector, context);
  collectMatchingPois(cleanQuery, collector, context);
  collectMatchingNpcs(cleanQuery, collector, context);
  collectMatchingHexes(cleanQuery, collector, context);

  return collector.results;
}

function collectMatchingRegions(cleanQuery, collector, context) {
  (db?.raw?.regions || []).forEach(region => {
    if (!codexSearchTextMatches([
      region.Region_ID,
      region.Region_Name,
      region.Lore,
      region.DM_Journal
    ], cleanQuery)) {
      return;
    }

    context.matchingRegionIds.add(region.Region_ID);

    collector.add(
      "region",
      region.Region_ID,
      joinCodexLabel(region.Region_Name || region.Region_ID, ["Region"])
    );
  });
}

function collectMatchingPois(cleanQuery, collector, context) {
  const matchingGroupedPois = new Map();

  (db?.raw?.pois || []).forEach(poi => {
    if (!codexSearchTextMatches([
      poi.POI_ID,
      poi.POI_Group_ID,
      poi.Name,
      poi.POI_Type,
      poi.Hex_ID_Ref,
      poi.Population,
      poi["Notoriety Tier"],
      poi.Lore,
      poi.DM_Journal
    ], cleanQuery)) {
      return;
    }

    if (poi.Hex_ID_Ref) {
      context.matchingPoiHexIds.add(poi.Hex_ID_Ref);
    }

    const group = getPoiGroupForPoi(poi);

    if (group) {
      if (!matchingGroupedPois.has(group.POI_Group_ID)) {
        matchingGroupedPois.set(group.POI_Group_ID, {
          group,
          matchingPois: []
        });
      }

      matchingGroupedPois
        .get(group.POI_Group_ID)
        .matchingPois
        .push(poi);

      return;
    }

    collector.add(
      "poi",
      poi.POI_ID,
      buildPoiListLabel(poi)
    );
  });

  (db?.raw?.poiGroups || []).forEach(group => {
    if (!codexSearchTextMatches([
      group.POI_Group_ID,
      group.POI_Group_Name,
      group.Group_Type,
      group.Population,
      group.Lore,
      group.DM_Journal
    ], cleanQuery)) {
      return;
    }

    if (!matchingGroupedPois.has(group.POI_Group_ID)) {
      matchingGroupedPois.set(group.POI_Group_ID, {
        group,
        matchingPois: []
      });
    }
  });

  matchingGroupedPois.forEach(({ group, matchingPois }) => {
    getPoisForGroup(group.POI_Group_ID).forEach(poi => {
      if (poi.Hex_ID_Ref) {
        context.matchingPoiHexIds.add(poi.Hex_ID_Ref);
      }
    });

    collector.add(
      "poi-group",
      group.POI_Group_ID,
      buildPoiGroupSearchLabel(group, matchingPois)
    );
  });
}

function buildPoiGroupSearchLabel(group, matchingPois) {
  const allMappedAreas = getPoisForGroup(group.POI_Group_ID);
  const npcs = getNpcsForPoiGroup(group.POI_Group_ID);
  const population = formatCodexPopulation(group.Population);
  const meta = [];

  const typeLine = [
    group.Group_Type || "Grouped POI",
    `${allMappedAreas.length} mapped area${allMappedAreas.length !== 1 ? "s" : ""}`
  ].filter(Boolean).join(" • ");

  if (typeLine) {
    meta.push(typeLine);
  }

  const matchLine = matchingPois.length > 0
    ? `${matchingPois.length} matching mapped area${matchingPois.length !== 1 ? "s" : ""}`
    : "Group match";

  const populationNpcLine = [
    population ? `Population: ${population}` : "",
    npcs.length > 0 ? `${npcs.length} NPC${npcs.length !== 1 ? "s" : ""}` : "",
    matchLine
  ].filter(Boolean).join(" • ");

  if (populationNpcLine) {
    meta.push(populationNpcLine);
  }

  return joinCodexLabel(
    group.POI_Group_Name || group.POI_Group_ID || "Unnamed POI Group",
    meta
  );
}

function collectMatchingNpcs(cleanQuery, collector, context) {
  (db?.raw?.npcs || []).forEach(npc => {
    const home = npc.Home_ID_Ref ? db?.poisById?.[npc.Home_ID_Ref] : null;

    if (!codexSearchTextMatches([
      npc.NPC_ID,
      npc.Name,
      npc.Title,
      npc.Race,
      npc.Organization,
      npc.Occupation,
      npc.Home_ID_Ref,
      getNpcHomeLabel(npc),
      npc.Lore,
      npc.DM_Journal
    ], cleanQuery)) {
      return;
    }

    if (home?.Hex_ID_Ref) {
      context.matchingNpcHexIds.add(home.Hex_ID_Ref);
    }

    collector.add(
      "npc",
      npc.NPC_ID,
      buildNpcListLabel(npc)
    );
  });
}

function collectMatchingHexes(cleanQuery, collector, context) {
  (db?.raw?.hexes || []).forEach(hex => {
    const directMatch = codexSearchTextMatches([
      hex.Hex_ID,
      hex.Terrain,
      hex.Region_ID_Ref,
      hex.DM_Journal
    ], cleanQuery);

    const regionMatch = context.matchingRegionIds.has(hex.Region_ID_Ref);
    const poiMatch = context.matchingPoiHexIds.has(hex.Hex_ID);
    const npcMatch = context.matchingNpcHexIds.has(hex.Hex_ID);

    if (!directMatch && !regionMatch && !poiMatch && !npcMatch) {
      return;
    }

    collector.add(
      "hex",
      hex.Hex_ID,
      buildCodexHexSearchLabel(hex, {
        regionMatch,
        poiMatch,
        npcMatch
      })
    );
  });
}

function buildCodexHexSearchLabel(hex, matches) {
  const matchReasons = [
    matches.regionMatch ? "Matching Region" : "",
    matches.poiMatch ? "Matching POI" : "",
    matches.npcMatch ? "Matching NPC" : ""
  ].filter(Boolean);

  if (!matchReasons.length) {
    return buildHexListLabel(hex);
  }

  return joinCodexLabel(`Hex ${hex.Hex_ID}`, [
    hex.Terrain || "Unknown Terrain",
    ...matchReasons
  ]);
}

function getCodexSearchGroupRows(group, results) {
  if (group.type === "poi") {
    return results.filter(result => {
      return result.type === "poi" || result.type === "poi-group";
    });
  }

  return results.filter(result => result.type === group.type);
}

function getCodexSearchGroupCount(group, results) {
  return getCodexSearchGroupRows(group, results).length;
}

function getCodexSearchMatchLabel(count) {
  if (count === 1) return "1 match";
  return `${count} matches`;
}

function renderMobileCodexSearchResultGroups(results) {
  return `
    <div class="codex-mobile-search-summary">
      ${CODEX_SEARCH_GROUPS
        .map(group => renderMobileCodexSearchSummaryButton(group, results))
        .join("")}
    </div>
  `;
}

function renderMobileCodexSearchSummaryButton(group, results) {
  const count = getCodexSearchGroupCount(group, results);

  return `
    <button
      class="codex-mobile-search-summary-button"
      type="button"
      onclick="openCodexSearchResultsModal('${escapeJsString(group.type)}')"
    >
      <span class="codex-mobile-search-summary-label">${escapeHtml(group.label)}</span>
      <span class="codex-mobile-search-summary-count">${escapeHtml(getCodexSearchMatchLabel(count))}</span>
    </button>
  `;
}

function openCodexSearchResultsModal(type) {
  const modal = document.getElementById("codex-search-results-modal");
  const group = CODEX_SEARCH_GROUPS.find(item => item.type === type);
  const cleanQuery = normalizeCodexSearchQuery(codexSearchQuery);

  if (!modal || !group || !cleanQuery) return;

  const results = buildCodexSearchResults(cleanQuery);
  const groupRows = getCodexSearchGroupRows(group, results);
  const matchLabel = getCodexSearchMatchLabel(groupRows.length);

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  modal.innerHTML = `
    <div class="codex-search-results-modal-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(group.label)} search results">
      <div class="codex-search-results-modal-header">
        <h3>${escapeHtml(group.label)}</h3>
        <p>${escapeHtml(matchLabel)}</p>
      </div>

      <div class="codex-search-results-modal-list codex-scroll-fade">
        ${renderCodexLinkedList(
          groupRows,
          `No matching ${group.label}.`,
          null,
          "id",
          row => row.label,
          row => row.type,
          row => getCodexSearchResultIcon(row.type)
        )}
      </div>

      <button
        class="codex-search-results-modal-close"
        type="button"
        onclick="closeCodexSearchResultsModal()"
      >
        Close
      </button>
    </div>
  `;
}

function closeCodexSearchResultsModal() {
  const modal = document.getElementById("codex-search-results-modal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = "";
}

function handleCodexSearchModalBackdropClick(event) {
  if (event.target?.id !== "codex-search-results-modal") return;
  closeCodexSearchResultsModal();
}

function normalizeCodexSearchActiveGroup(results) {
  if (codexSearchActiveGroup === "all") return;

  const group = CODEX_SEARCH_GROUPS.find(item => item.type === codexSearchActiveGroup);

  if (!group || getCodexSearchGroupCount(group, results) === 0) {
    codexSearchActiveGroup = "all";
  }
}

function setCodexSearchActiveGroup(type) {
  codexSearchActiveGroup = type || "all";
  renderCodexSearchResults(codexSearchQuery);
}

function getCodexSearchTotalCount(results) {
  return results.length;
}

function renderCodexSearchResultGroups(results) {
  normalizeCodexSearchActiveGroup(results);

  return renderCodexSplitView({
    className: "codex-search-split-view",
    railHtml: renderCodexSearchCategoryRail(results),
    mainHtml: renderCodexSearchMainPaneContent(results)
  });
}

function getCodexSearchGroupIcon(type) {
  if (type === "all") return "✧";

  const group = CODEX_SEARCH_GROUPS.find(item => item.type === type);
  return group?.icon || "•";
}

function getCodexSearchResultIcon(type) {
  if (type === "poi-group") return getCodexSearchGroupIcon("poi");
  return getCodexSearchGroupIcon(type);
}

function renderCodexSearchRowList(rows, emptyText) {
  return renderCodexLinkedList(
    rows,
    emptyText,
    null,
    "id",
    row => row.label,
    row => row.type,
    row => getCodexSearchResultIcon(row.type)
  );
}

function renderCodexSearchCategoryRail(results) {
  const totalCount = getCodexSearchTotalCount(results);

  return `
    <nav class="codex-row-list codex-row-list-rail codex-search-category-rail" aria-label="Search result categories">
      ${renderCodexSearchCategoryButton({
        type: "all",
        label: "All",
        count: totalCount
      })}

      ${CODEX_SEARCH_GROUPS
        .map(group => renderCodexSearchCategoryButton({
          type: group.type,
          label: group.label,
          count: getCodexSearchGroupCount(group, results)
        }))
        .join("")}
    </nav>
  `;
}

function renderCodexSearchCategoryButton(category) {
  const isActive = codexSearchActiveGroup === category.type;
  const isDisabled = category.count === 0;

  return renderCodexRow({
    title: category.label,
    icon: getCodexSearchGroupIcon(category.type),
    count: category.count,
    active: isActive,
    disabled: isDisabled,
    classes: "codex-search-category-button",
    onclick: `setCodexSearchActiveGroup('${escapeJsString(category.type)}')`
  });
}

function renderCodexSearchMainPaneContent(results) {
  const activeGroup = CODEX_SEARCH_GROUPS.find(group => group.type === codexSearchActiveGroup);

  if (!activeGroup) {
    return renderCodexSearchAllResultsPaneContent(results);
  }

  const groupRows = getCodexSearchGroupRows(activeGroup, results);

  return `
    <section class="codex-search-focused-section">
      <div class="codex-search-focused-heading">
        <h3>${escapeHtml(activeGroup.label)}</h3>
        <p>${escapeHtml(getCodexSearchMatchLabel(groupRows.length))}</p>
      </div>

      ${renderCodexSearchRowList(
        groupRows,
        `No matching ${activeGroup.label}.`
      )}
    </section>
  `;
}

function renderCodexSearchAllResultsPaneContent(results) {
  return CODEX_SEARCH_GROUPS
    .map(group => renderCodexSearchAllResultSection(group, results))
    .join("");
}

function renderCodexSearchAllResultSection(group, results) {
  const groupRows = getCodexSearchGroupRows(group, results);

  return `
    <section class="codex-search-all-section">
      <div class="codex-search-focused-heading">
        <h3>${escapeHtml(group.label)}</h3>
        <p>${escapeHtml(getCodexSearchMatchLabel(groupRows.length))}</p>
      </div>

      ${renderCodexSearchRowList(
        groupRows,
        `No matching ${group.label}.`
      )}
    </section>
  `;
}

window.openCodexSearchResultsModal = openCodexSearchResultsModal;
window.closeCodexSearchResultsModal = closeCodexSearchResultsModal;
window.handleCodexSearchModalBackdropClick = handleCodexSearchModalBackdropClick;
window.setCodexSearchActiveGroup = setCodexSearchActiveGroup;
window.scheduleCodexSearchResultsRender = scheduleCodexSearchResultsRender;
