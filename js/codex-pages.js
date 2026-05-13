function renderCodexHexPage(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const pois = getPoisForHex(hexId);
  const npcs = getNpcsForHex(hexId);

  setCodexTitle(`Hex ${hexId}`);

  setCodexContent(`
    <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>

    <p>
      <strong>Region:</strong>
      ${
        region
          ? `<button class="codex-link-button" type="button" onclick="openCodexPage('region', '${escapeJsString(region.Region_ID)}')">${escapeHtml(region.Region_Name)}</button>`
          : escapeHtml(hex?.Region_ID_Ref || "Unknown")
      }
    </p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(hex?.DM_Journal || "No journal entries.")}</p>

    <h3>Points of Interest</h3>
    ${renderCodexLinkedList(
      pois,
      "No known points of interest in this hex.",
      "poi",
      "POI_ID",
      buildPoiListLabel
    )}

    <h3>NPCs</h3>
    ${renderCodexLinkedList(
      npcs,
      "No known NPCs associated with this hex.",
      "npc",
      "NPC_ID",
      buildNpcListLabel
    )}
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: `Hex ${hexId}`
    }
  ]);
}

function renderCodexRegionPage(regionId) {
  const region = db?.regionsById?.[regionId];
  const hexes = getRowsByField(db?.raw?.hexes, "Region_ID_Ref", regionId);
  const regionName = region?.Region_Name || regionId || "Unknown Region";
  const summary = getRegionSummary(regionId);

  const pois = hexes.flatMap(hex => {
    return getPoisForHex(hex.Hex_ID);
  });

  const npcs = pois.flatMap(poi => {
    return getNpcsForPoi(poi.POI_ID);
  });

  const terrainCounts = hexes.reduce((counts, hex) => {
    const terrain = hex.Terrain || "Unknown";
    counts[terrain] = (counts[terrain] || 0) + 1;
    return counts;
  }, {});

  const terrainSummary = Object.entries(terrainCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([terrain, count]) => `${terrain}: ${count}`)
    .join("<br>");

  setCodexTitle(regionName);

  setCodexContent(`
    <h3>Region Notes</h3>
    <p>${escapeHtml(region?.Lore || region?.DM_Journal || "No region notes recorded.")}</p>

    <h3>Summary</h3>
    <p>
      <strong>Hexes:</strong> ${summary.hexCount}<br>
      <strong>Points of Interest:</strong> ${summary.poiCount}<br>
      <strong>NPCs:</strong> ${summary.npcCount}
    </p>

    <h3>Terrain Profile</h3>
    <p>${terrainSummary || "No terrain data recorded."}</p>

    <h3>Points of Interest</h3>
    ${renderCodexLinkedList(
      pois,
      "No points of interest currently recorded in this region.",
      "poi",
      "POI_ID",
      buildPoiListLabel
    )}

    <h3>NPCs</h3>
    ${renderCodexLinkedList(
      npcs,
      "No NPCs currently recorded in this region.",
      "npc",
      "NPC_ID",
      buildNpcListLabel
    )}

    <h3>Hexes</h3>
    ${renderCodexLinkedList(
      hexes,
      "No hexes currently assigned to this region.",
      "hex",
      "Hex_ID",
      buildHexListLabel
    )}
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "Regions",
      clickable: true,
      onclick: "openCodexPage('regions')"
    },
    {
      label: regionName
    }
  ]);
}

function renderCodexPoiPage(poiId) {
  const poi = db?.poisById?.[poiId];
  const npcs = getNpcsForPoi(poiId);
  const hexId = poi?.Hex_ID_Ref;
  const poiName = poi?.Name || poiId || "Unknown POI";

  setCodexTitle(poiName);

  setCodexContent(`
    <div class="codex-detail-page-shell">
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot"></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(poi?.POI_Type || "Unknown")}</p>
          <p><strong>Notoriety Tier:</strong> ${escapeHtml(poi?.["Notoriety Tier"] || "Unknown")}</p>

          ${
            hexId
              ? `<p><strong>Hex:</strong> <button class="codex-link-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">${escapeHtml(hexId)}</button></p>`
              : ""
          }

          ${
            poi?.POI_Type === "Settlement"
              ? `<p><strong>Population:</strong> ${escapeHtml(poi?.Population || "Unknown")}</p>`
              : ""
          }
        </div>

        <section class="codex-detail-npc-panel">
          <h3>NPCs</h3>

          <div class="codex-detail-upper-scrollbox codex-scroll-fade">
            ${renderCodexLinkedList(
              npcs,
              "No known NPCs at this location.",
              "npc",
              "NPC_ID",
              npc => joinCodexLabel(
                [npc.Title, npc.Name].filter(Boolean).join(" "),
                [
                  [
                    npc.Organization,
                    npc.Race,
                    npc.Occupation 
                  ].filter(Boolean).join(" • ")
                ]
              )
            )}
          </div>
        </section>
      </div>

      <div class="codex-detail-scroll-grid">
        <section class="codex-detail-scroll-panel">
          <h3>DM Journal</h3>

          <div class="codex-detail-scrollbox codex-scroll-fade">
            <p>${escapeHtml(poi?.DM_Journal || "No journal entries.")}</p>
          </div>
        </section>

        <section class="codex-detail-scroll-panel">
          <h3>Lore</h3>

          <div class="codex-detail-scrollbox codex-scroll-fade">
            <p>${escapeHtml(poi?.Lore || "No lore recorded.")}</p>
          </div>
        </section>
      </div>
    </div>
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "Points of Interest",
      clickable: true,
      onclick: "openCodexPage('pois')"
    },
    {
      label: poiName
    }
  ]);

  document.getElementById("codex-content").classList.add("codex-detail-page");
}

function renderCodexNpcPage(npcId) {
  const npc = db?.npcsById?.[npcId];
  const home = npc?.Home_ID_Ref
    ? db?.poisById?.[npc.Home_ID_Ref]
    : null;

  const npcName = npc?.Name || npcId || "Unknown NPC";

  document.getElementById("codex-title").innerHTML = `
    ${npc?.Title ? `
      <div class="codex-superheader">
        ${escapeHtml(npc.Title)}
      </div>
    ` : ""}

    <div class="codex-mainheader">
      ${escapeHtml(npcName)}
    </div>

    ${npc?.Organization ? `
      <div class="codex-subheader">
        ${escapeHtml(npc.Organization)}
      </div>
    ` : ""}
  `;

  setCodexContent(`
    <div class="codex-detail-page-shell">
      <div class="codex-detail-fixed">
        <div class="codex-detail-portrait-slot"></div>

        <div class="codex-detail-meta">
          <p><strong>Home:</strong> ${
            home
              ? `<button class="codex-link-button" type="button" onclick="openCodexPage('poi', '${escapeJsString(home.POI_ID)}')">${escapeHtml(home.Name)}</button>`
              : escapeHtml(npc?.Home_ID_Ref || "Unknown")
          }</p>

          <p><strong>Race:</strong> ${escapeHtml(
            npc?.Race || "Unknown"
          )}</p>

          <p><strong>Occupation:</strong> ${escapeHtml(
            npc?.Occupation || "Unknown"
          )}</p>
        </div>
      </div>

      <div class="codex-detail-scroll-grid">
        <section class="codex-detail-scroll-panel">
          <h3>DM Journal</h3>

          <div class="codex-detail-scrollbox codex-scroll-fade">
            <p>${escapeHtml(
              npc?.DM_Journal || "No journal entries."
            )}</p>
          </div>
        </section>

        <section class="codex-detail-scroll-panel">
          <h3>Lore</h3>

          <div class="codex-detail-scrollbox codex-scroll-fade">
            <p>${escapeHtml(
              npc?.Lore || "No lore recorded."
            )}</p>
          </div>
        </section>
      </div>
    </div>
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "NPCs",
      clickable: true,
      onclick: "openCodexPage('npcs')"
    },
    {
      label: npcName
    }
  ]);

  document
    .getElementById("codex-content")
    .classList.add("codex-detail-page");
}

function renderCodexRegionsIndex() {
  const regions = db?.raw?.regions || [];

  setCodexTitle("Regions");

  setCodexContent(renderCodexLinkedList(
    regions,
    "No regions recorded.",
    "region",
    "Region_ID",
    buildRegionListLabel
  ));
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
            placeholder="Search records..."
            autocomplete="off"
            value="${escapeHtml(codexSearchQuery)}"
          >
        </div>
      </div>

      <div id="codex-search-results" class="codex-search-results-shell">
        <p>Begin typing to search the records of Kadesh.</p>
      </div>
    </div>
  `;

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
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    resultsEl.innerHTML = `
      <p>Begin typing to search the records of Kadesh.</p>
    `;
    return;
  }

  const results = [];
  const resultKeys = new Set();

  function addSearchResult(type, id, label) {
    const key = `${type}:${id}`;
    if (resultKeys.has(key)) return;

    resultKeys.add(key);
    results.push({ type, id, label });
  }

  function textMatches(values) {
    return values.join(" ").toLowerCase().includes(cleanQuery);
  }

  const matchingRegionIds = new Set();
  const matchingPoiHexIds = new Set();
  const matchingNpcHexIds = new Set();

  (db?.raw?.regions || []).forEach(region => {
    if (textMatches([
      region.Region_ID,
      region.Region_Name,
      region.Lore,
      region.DM_Journal
    ])) {
      matchingRegionIds.add(region.Region_ID);

      addSearchResult(
        "region",
        region.Region_ID,
        joinCodexLabel(region.Region_Name || region.Region_ID, ["Region"])
      );
    }
  });

  (db?.raw?.pois || []).forEach(poi => {
    if (textMatches([
      poi.POI_ID,
      poi.Name,
      poi.POI_Type,
      poi.Hex_ID_Ref,
      poi.Population,
      poi["Notoriety Tier"],
      poi.Lore,
      poi.DM_Journal
    ])) {
      if (poi.Hex_ID_Ref) {
        matchingPoiHexIds.add(poi.Hex_ID_Ref);
      }

      addSearchResult(
        "poi",
        poi.POI_ID,
        buildPoiListLabel(poi)
      );
    }
  });

  (db?.raw?.npcs || []).forEach(npc => {
    const home = npc.Home_ID_Ref ? db?.poisById?.[npc.Home_ID_Ref] : null;

    if (textMatches([
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
    ])) {
      if (home?.Hex_ID_Ref) {
        matchingNpcHexIds.add(home.Hex_ID_Ref);
      }

      addSearchResult(
        "npc",
        npc.NPC_ID,
        buildNpcListLabel(npc)
      );
    }
  });

  (db?.raw?.hexes || []).forEach(hex => {
    const directMatch = textMatches([
      hex.Hex_ID,
      hex.Terrain,
      hex.Region_ID_Ref,
      hex.DM_Journal
    ]);

    const regionMatch = matchingRegionIds.has(hex.Region_ID_Ref);
    const poiMatch = matchingPoiHexIds.has(hex.Hex_ID);
    const npcMatch = matchingNpcHexIds.has(hex.Hex_ID);

    if (directMatch || regionMatch || poiMatch || npcMatch) {
      const matchReasons = [
        regionMatch ? "Matching Region" : "",
        poiMatch ? "Matching POI" : "",
        npcMatch ? "Matching NPC" : ""
      ].filter(Boolean);

      const label = matchReasons.length
        ? joinCodexLabel(`Hex ${hex.Hex_ID}`, [
            hex.Terrain || "Unknown Terrain",
            ...matchReasons
          ])
        : buildHexListLabel(hex);

      addSearchResult("hex", hex.Hex_ID, label);
    }
  });

  const resultGroups = [
    { type: "hex", label: "Hexes" },
    { type: "region", label: "Regions" },
    { type: "poi", label: "POIs" },
    { type: "npc", label: "NPCs" }
  ];

  resultsEl.innerHTML = resultGroups
    .map(group => {
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
    })
    .join("");
}