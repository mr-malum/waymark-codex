/* =========================================================
   CODEX SEARCH PAGE
   ========================================================= */

const CODEX_SEARCH_GROUPS = [
  { type: "poi", label: "POIs" },
  { type: "npc", label: "NPCs" },
  { type: "hex", label: "Hexes" },
  { type: "region", label: "Regions" }
];

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
  `;

  bindCodexSearchInput();
}

function bindCodexSearchInput() {
  const input = document.getElementById("codex-search-input");

  input.addEventListener("input", function () {
    codexSearchQuery = input.value;
    renderCodexSearchResults(input.value);
  });

  if (codexSearchQuery.trim()) {
    renderCodexSearchResults(codexSearchQuery);
  }

  input.focus();
}

function renderCodexSearchResults(query) {
  const resultsEl = document.getElementById("codex-search-results");
  const cleanQuery = normalizeCodexSearchQuery(query);

  if (!cleanQuery) {
    resultsEl.innerHTML = renderCodexEmptySearchMessage();
    return;
  }

  const results = buildCodexSearchResults(cleanQuery);
  resultsEl.innerHTML = renderCodexSearchResultGroups(results);
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
  (db?.raw?.pois || []).forEach(poi => {
    if (!codexSearchTextMatches([
      poi.POI_ID,
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

    collector.add(
      "poi",
      poi.POI_ID,
      buildPoiListLabel(poi)
    );
  });
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

function renderCodexSearchResultGroups(results) {
  return CODEX_SEARCH_GROUPS
    .map(group => renderCodexSearchResultGroup(group, results))
    .join("");
}

function renderCodexSearchResultGroup(group, results) {
  const groupRows = results.filter(result => result.type === group.type);

  return `
    <section class="codex-search-result-panel">
      <h3 class="codex-search-result-heading">${escapeHtml(group.label)}</h3>

      <div class="codex-search-group-scroll codex-scroll-fade">
        ${renderCodexLinkedList(
          groupRows,
          `No matching ${group.label}.`,
          null,
          "id",
          row => row.label,
          row => row.type
        )}
      </div>
    </section>
  `;
}
