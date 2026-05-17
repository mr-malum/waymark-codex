/* =========================================================
   DETAIL PAGE NORMALIZATION
   =========================================================

   Keeps overview panes limited to image + concise metadata and moves
   related/mapped area content into real detail sections.
*/

function renderCodexPoiRelatedAreasContent(group, relatedPois) {
  if (!group && !relatedPois.length) {
    return `<p>No related Areas recorded.</p>`;
  }

  const parentHtml = group
    ? `<p class="codex-detail-related-parent"><strong>Parent:</strong> ${renderCodexInlineLink("poi-group", group.POI_Group_ID, group.POI_Group_Name || group.POI_Group_ID)}</p>`
    : `<p class="codex-detail-related-parent">No parent location recorded.</p>`;

  return `
    <div class="codex-detail-related-areas-content">
      ${parentHtml}
      ${renderCodexLinkedList(
        relatedPois,
        "No sibling Areas recorded.",
        "poi",
        "POI_ID",
        buildCodexMappedAreaListLabel
      )}
    </div>
  `;
}

function renderCodexPoiPage(poiId) {
  const poi = db?.poisById?.[poiId];
  const npcs = getNpcsForPoi(poiId);
  const hexId = poi?.Hex_ID_Ref;
  const poiName = poi?.Name || poiId || "Unknown POI";
  const group = getPoiGroupForPoi(poi);
  const population = getPoiEffectivePopulation(poi);
  const imageUrl = getPoiImageUrl(poi);
  const placeholderClass = getPoiPlaceholderClass(poi);
  const maps = getMapsForPoi(poiId);
  const relatedPois = group
    ? getPoisForGroup(group.POI_Group_ID).filter(row => row.POI_ID !== poiId)
    : [];
  const relatedCount = relatedPois.length + (group ? 1 : 0);

  setCodexTitle(poiName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-related-areas", label: "Related Areas", icon: getCodexIcon("poi"), count: relatedCount },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(poi?.POI_Type || "Unknown")}</p>
          <p><strong>Notoriety Tier:</strong> ${escapeHtml(poi?.["Notoriety Tier"] || "Unknown")}</p>
          ${group ? `<p><strong>Part of:</strong> ${renderCodexInlineLink("poi-group", group.POI_Group_ID, group.POI_Group_Name || group.POI_Group_ID)}</p>` : ""}
          ${hexId ? `<p><strong>Hex:</strong> ${renderCodexInlineLink("hex", hexId, hexId)}</p>` : ""}
          ${!group && (poi?.POI_Type === "Settlement" || population) ? `<p><strong>Population:</strong> ${escapeHtml(formatCodexPopulation(population) || "Unknown")}</p>` : ""}
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(poi?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(poi?.DM_Journal, "No journal entries.")),
    renderCodexDetailRailSection("codex-detail-related-areas", "Related Areas", renderCodexPoiRelatedAreasContent(group, relatedPois)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs at this location.", "npc", "NPC_ID", buildCodexDetailNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this location."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexGroupedPoiBreadcrumbTrail(poiName, group));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-poi-detail-page");
}

function renderCodexPoiGroupPage(groupId) {
  const group = db?.poiGroupsById?.[groupId];
  const groupName = group?.POI_Group_Name || groupId || "Unknown POI Group";
  const pois = getPoisForGroup(groupId);
  const npcs = getNpcsForPoiGroup(groupId);
  const population = formatCodexPopulation(getPoiGroupPopulation(group));
  const imageUrl = getPoiGroupImageUrl(group);
  const placeholderClass = getPoiPlaceholderClass(group);
  const maps = getMapsForPoiGroup(groupId);

  setCodexTitle(groupName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-areas", label: "Areas", icon: getCodexIcon("poi"), count: pois.length },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(group?.Group_Type || "Grouped POI")}</p>
          ${population ? `<p><strong>Population:</strong> ${escapeHtml(population)}</p>` : ""}
          <p><strong>Areas:</strong> ${pois.length}</p>
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(group?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(group?.DM_Journal, "No journal entries.")),
    renderCodexDetailRailSection("codex-detail-areas", "Areas", renderCodexLinkedList(pois, "No Areas currently recorded for this place.", "poi", "POI_ID", buildCodexMappedAreaListLabel)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs associated with this place.", "npc", "NPC_ID", buildCodexDetailNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this place."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(groupName, {
    label: "Points of Interest",
    pageType: "pois"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-poi-group-detail-page");
}

window.renderCodexPoiPage = renderCodexPoiPage;
window.renderCodexPoiGroupPage = renderCodexPoiGroupPage;
