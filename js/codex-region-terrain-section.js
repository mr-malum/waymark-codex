/* =========================================================
   REGION TERRAIN SECTION
   =========================================================

   Replaces the Region detail Hexes section with a Terrain section. Terrain
   rows link to the Hexes index with Region + Terrain filters preset.
*/

function renderCodexRegionTerrainRows(regionName, terrainCounts) {
  const entries = Object.entries(terrainCounts)
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]));

  if (!entries.length) {
    return `<p>No terrain data recorded.</p>`;
  }

  return `
    <div class="codex-row-list codex-region-terrain-link-list">
      ${entries.map(([terrain, count]) => renderCodexRow({
        title: terrain,
        meta: `${count} hex${count === 1 ? "" : "es"}`,
        icon: getCodexIcon("hex"),
        classes: "codex-region-terrain-link-row",
        onclick: `openCodexHexesFiltered('${escapeJsString(regionName)}', '${escapeJsString(terrain)}')`
      })).join("")}
    </div>
  `;
}

function renderCodexRegionPage(regionId) {
  const region = db?.regionsById?.[regionId];
  const hexes = getRowsByField(db?.raw?.hexes, "Region_ID_Ref", regionId);
  const regionName = region?.Region_Name || regionId || "Unknown Region";
  const summary = getRegionSummary(regionId);
  const imageUrl = getRegionImageUrl(region);
  const maps = getMapsForRegion(regionId);

  const pois = hexes.flatMap(hex => getPoisForHex(hex.Hex_ID));
  const poiListRows = createPoiGroupListRows(pois);
  const npcs = pois.flatMap(poi => getNpcsForPoi(poi.POI_ID));

  const terrainCounts = hexes.reduce((counts, hex) => {
    const terrain = hex.Terrain || "Unknown";
    counts[terrain] = (counts[terrain] || 0) + 1;
    return counts;
  }, {});

  const terrainTypeCount = Object.keys(terrainCounts).length;

  setCodexTitle(regionName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-pois", label: "POIs", icon: getCodexIcon("poi"), count: poiListRows.length },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-terrain", label: "Terrain", icon: getCodexIcon("hex"), count: terrainTypeCount },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-region">
        <div class="codex-detail-portrait-slot codex-region-detail-image codex-placeholder-region" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta codex-region-detail-summary">
          <p><strong>Hexes:</strong> ${summary.hexCount}</p>
          <p><strong>Terrain Types:</strong> ${terrainTypeCount}</p>
          <p><strong>Points of Interest:</strong> ${summary.poiCount}</p>
          ${summary.mappedAreaCount > summary.poiCount ? `<p><strong>Areas:</strong> ${summary.mappedAreaCount}</p>` : ""}
          <p><strong>NPCs:</strong> ${summary.npcCount}</p>
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>
      </div>
    </section>
  `;

  const terrainSectionContent = renderCodexRegionTerrainRows(regionName, terrainCounts);

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(region?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(region?.DM_Journal, "No journal entries.")),
    renderCodexDetailRailSection("codex-detail-pois", "Points of Interest", renderCodexLinkedList(poiListRows, "No points of interest currently recorded in this region.", "poi", "POI_ID", buildPoiListLabel)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No NPCs currently recorded in this region.", "npc", "NPC_ID", buildNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-terrain", "Terrain", terrainSectionContent),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this region."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(regionName, {
    label: "Regions",
    pageType: "regions"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-region-detail-page");
}

window.renderCodexRegionPage = renderCodexRegionPage;
