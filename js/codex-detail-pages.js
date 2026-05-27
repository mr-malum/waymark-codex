/* =========================================================
   CODEX DETAIL / INDEX PAGES
   ========================================================= */

function codexRootBreadcrumb() {
  return {
    label: "Codex",
    clickable: true,
    onclick: "resetCodexToIndex()"
  };
}

function codexSectionBreadcrumb(label, pageType) {
  return {
    label,
    clickable: true,
    onclick: `openCodexPage('${pageType}')`
  };
}

function codexCurrentBreadcrumb(label) {
  return { label };
}

function buildCodexBreadcrumbTrail(currentLabel, section = null) {
  return [
    codexRootBreadcrumb(),
    section ? codexSectionBreadcrumb(section.label, section.pageType) : null,
    codexCurrentBreadcrumb(currentLabel)
  ].filter(Boolean);
}

function buildCodexGroupedPoiBreadcrumbTrail(poiName, group) {
  if (!group) {
    return buildCodexBreadcrumbTrail(poiName, {
      label: "Points of Interest",
      pageType: "pois"
    });
  }

  return [
    codexRootBreadcrumb(),
    codexSectionBreadcrumb("Points of Interest", "pois"),
    {
      label: group.POI_Group_Name || group.POI_Group_ID,
      clickable: true,
      onclick: `openCodexPage('poi-group', '${escapeJsString(group.POI_Group_ID)}')`
    },
    codexCurrentBreadcrumb(poiName)
  ];
}

function getCodexImageUrl(record, fieldNames) {
  return fieldNames
    .map(fieldName => record?.[fieldName])
    .find(Boolean) || "";
}

function getRegionImageUrl(region) {
  return getCodexImageUrl(region, [
    "Image",
    "Image_URL",
    "Region_Image",
    "Region_Image_URL"
  ]);
}

function getPoiImageUrl(poi) {
  return getCodexImageUrl(poi, [
    "Image",
    "Image_URL",
    "POI_Image",
    "POI_Image_URL"
  ]);
}

function getPoiGroupImageUrl(group) {
  return getCodexImageUrl(group, [
    "Image",
    "Image_URL",
    "POI_Group_Image",
    "POI_Group_Image_URL",
    "Group_Image",
    "Group_Image_URL"
  ]);
}

function getNpcImageUrl(npc) {
  return getCodexImageUrl(npc, [
    "Image",
    "Image_URL",
    "NPC_Image",
    "NPC_Image_URL",
    "Portrait",
    "Portrait_URL"
  ]);
}

function getCodexMapImageUrl(map) {
  return getCodexImageUrl(map, [
    "Image",
    "Image_URL",
    "Map_Image",
    "Map_Image_URL"
  ]);
}

function getPoiPlaceholderClass(record) {
  const type = String(record?.POI_Type || record?.Group_Type || "").toLowerCase();

  if (
    type.includes("settlement") ||
    type.includes("city") ||
    type.includes("town") ||
    type.includes("village")
  ) {
    return "codex-placeholder-settlement";
  }

  return "codex-placeholder-poi";
}

function renderImageStyle(imageUrl) {
  return imageUrl
    ? `style="--codex-record-image: url('${escapeJsString(imageUrl)}')"`
    : "";
}

function renderRegionImageStyle(imageUrl, region) {
  const color = getRegionDisplayColor(region) || "transparent";
  const regionStyle = `--codex-region-color: ${escapeHtml(color)}`;
  const imageAttrs = renderImageStyle(imageUrl);

  return imageAttrs
    ? imageAttrs.replace("style=\"", `style="${regionStyle}; `)
    : `style="${regionStyle}"`;
}

function renderRegionColorStyle(region) {
  const color = getRegionDisplayColor(region) || "transparent";
  return `style="--codex-region-color: ${escapeHtml(color)}"`;
}

function renderMapTileStyle(imageUrl) {
  return imageUrl
    ? `style="--codex-map-image: url('${escapeJsString(imageUrl)}')"`
    : "";
}

function renderCodexInlineLink(type, id, label) {
  return `
    <button
      class="codex-link-button"
      type="button"
      onclick="openCodexPage('${escapeJsString(type)}', '${escapeJsString(id)}')"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderCodexPoiTagField(record, recordType = "") {
  const target = getCodexPoiTagEditorTarget(record, recordType);
  if (!target) return "";

  return `
    <div class="codex-detail-tag-row">
      <strong>Tags:</strong>
      ${renderCodexTagList(getCodexRecordTagValues(record), {
        onclick: `openPoiTagsEditor('${escapeJsString(target.recordType)}', '${escapeJsString(target.recordId)}')`,
        emptyText: "Add tags"
      })}
    </div>
  `;
}

function renderCodexMapCard(map) {
  const imageUrl = getCodexMapImageUrl(map);
  const mapName = map.Map_Name || map.Map_ID || "Unnamed Map";
  const content = `<span class="codex-map-card-title">${escapeHtml(mapName)}</span>`;

  if (!imageUrl) {
    return `
      <div class="codex-map-card codex-map-card-disabled">
        <span class="codex-map-card-info">${content}</span>
      </div>
    `;
  }

  return `
    <a
      class="codex-map-card"
      href="${escapeHtml(imageUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      ${renderMapTileStyle(imageUrl)}
    >
      <span class="codex-map-card-info">${content}</span>
    </a>
  `;
}

function getRegionDisplayColor(region) {
  const namedColors = {
    red: "#ff2d2d",
    blue: "#1f7cff",
    yellow: "#ffe600",
    green: "#39ff14",
    orange: "#ff8a00",
    purple: "#bf4dff",
    black: "#070707",
    white: "#ffffff",
    brown: "#d9782d",
    gold: "#ffd84d"
  };
  const value = String(region?.Border_Color || "#ffd84d").trim().toLowerCase();
  if (value === "none") return "";
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  return namedColors[value] || "#ffd84d";
}

function renderRegionColorSwatch(region) {
  const color = getRegionDisplayColor(region);
  if (!color) return `<span class="codex-region-color-none">None</span>`;
  return `<span class="codex-region-color-swatch" style="--codex-region-color: ${escapeHtml(color)}" aria-label="Region color"></span>`;
}

function renderCodexMapsPanel(maps, fallback = "No maps recorded.") {
  return `
    <section class="codex-maps-panel">
      <h3>Maps</h3>
      ${renderCodexMapsContent(maps, fallback)}
    </section>
  `;
}

function renderCodexMapsContent(maps, fallback = "No maps recorded.") {
  return maps.length
    ? `<div class="codex-map-tile-grid">${maps.map(renderCodexMapCard).join("")}</div>`
    : `<p>${escapeHtml(fallback)}</p>`;
}

function renderCodexDetailTextPanel(title, text, fallback) {
  return `
    <section class="codex-detail-scroll-panel">
      <h3>${escapeHtml(title)}</h3>
      <div class="codex-detail-scrollbox codex-scroll-fade">
        <p>${escapeHtml(text || fallback)}</p>
      </div>
    </section>
  `;
}

function setCodexDetailSection(sectionId) {
  const root = document.querySelector(".codex-detail-rail-page");
  if (!root || !sectionId) return;

  root.querySelectorAll(".codex-detail-rail-section").forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  root.querySelectorAll("[data-codex-detail-section]").forEach(button => {
    button.classList.toggle("active", button.dataset.codexDetailSection === sectionId);
    button.classList.toggle("codex-row-active", button.dataset.codexDetailSection === sectionId);
  });

  updateCodexMobileDetailSwipeIndicators?.();
}

const codexDetailSectionStateCache = {};

function getCodexDetailSectionStateKey() {
  const current = getCurrentCodexPage?.();
  if (!current || !current.type || !current.id) return "";

  if (!["hex", "region", "poi", "poi-group", "npc"].includes(current.type)) {
    return "";
  }

  return `${current.type}:${current.id}`;
}

function clearCodexDetailSectionStateCache() {
  Object.keys(codexDetailSectionStateCache).forEach(key => {
    delete codexDetailSectionStateCache[key];
  });
}

function getCachedCodexDetailSection(sectionIds = []) {
  const key = getCodexDetailSectionStateKey();
  if (!key) return "";

  const cached = codexDetailSectionStateCache[key] || "";
  return sectionIds.includes(cached) ? cached : "";
}

function cacheCodexDetailSection(sectionId) {
  const key = getCodexDetailSectionStateKey();
  if (!key || !sectionId) return;

  codexDetailSectionStateCache[key] = sectionId;
}

const originalSetCodexDetailSection = setCodexDetailSection;

setCodexDetailSection = function (sectionId, options = {}) {
  originalSetCodexDetailSection(sectionId);

  if (options.cache !== false) {
    cacheCodexDetailSection(sectionId);
  }
};

function getCodexRailIconClass(icon) {
  return icon === getCodexIcon("hex") ? " codex-row-icon-hex" : "";
}

function renderCodexDetailRail(items) {
  return `
    <nav class="codex-row-list codex-row-list-rail codex-detail-section-rail" aria-label="Detail sections">
      ${items.map((item, index) => `
        <button
          class="codex-row codex-detail-section-rail-row ${index === 0 ? "active codex-row-active" : ""}"
          type="button"
          data-codex-detail-section="${escapeHtml(item.id)}"
          onclick="setCodexDetailSection('${escapeJsString(item.id)}')"
        >
          ${item.icon ? `<span class="codex-row-icon${getCodexRailIconClass(item.icon)}" aria-hidden="true">${escapeHtml(item.icon)}</span>` : ""}
          <span class="codex-row-main">
            <span class="codex-row-title">${escapeHtml(item.label)}</span>
          </span>
          ${
            item.count !== undefined && item.count !== null
              ? `<span class="codex-row-count">${escapeHtml(String(item.count))}</span>`
              : `<span class="codex-row-arrow" aria-hidden="true">›</span>`
          }
        </button>
      `).join("")}
    </nav>
  `;
}

function renderCodexDetailSectionAction(label, onclick) {
  return `
    <button
      class="codex-detail-section-action"
      type="button"
      onclick="${onclick}"
    >${escapeHtml(label)}</button>
  `;
}

function renderMapSectionActions(ownerType, ownerId, maps = []) {
  const addAction = renderCodexDetailSectionAction(
    "Add Map",
    `openAddMapEditor('${escapeJsString(ownerType)}', '${escapeJsString(ownerId)}')`
  );

  const manageAction = renderCodexDetailSectionAction(
    "Manage Maps",
    `openManageMapsEditor('${escapeJsString(ownerType)}', '${escapeJsString(ownerId)}')`
  );

  return `<div class="codex-detail-section-actions">${addAction}${manageAction}</div>`;
}

function renderAddJournalAction(sourceType, sourceId) {
  return renderCodexDetailSectionAction(
    "Add Entry",
    `openAddJournalEditor('${escapeJsString(sourceType)}', '${escapeJsString(sourceId)}')`
  );
}

function renderCodexDetailRailSection(id, title, content, classes = "", active = false, actionHtml = "") {
  return `
    <section id="${escapeHtml(id)}" class="codex-detail-rail-section ${active ? "active" : ""} ${classes}">
      <div class="codex-detail-rail-section-header">
        <h3>${escapeHtml(title)}</h3>
        ${actionHtml || ""}
      </div>
      <div class="codex-detail-rail-section-content">
        ${content}
      </div>
    </section>
  `;
}

function renderCodexDetailTextContent(text, fallback) {
  return `<p class="codex-detail-text-block">${escapeHtml(text || fallback)}</p>`;
}

function renderCodexJournalContent(record) {
  const entries = record?.DM_Journal_Entries || [];

  if (!entries.length) {
    return `<p class="codex-detail-text-block">No journal entries.</p>`;
  }

  return `
    <div class="codex-journal-entry-list">
      ${entries.map(entry => {
        const meta = [
          entry.Created_By_Username ? `by ${entry.Created_By_Username}` : "",
          typeof formatJournalTimestamp === "function" ? formatJournalTimestamp(entry.Timestamp) : entry.Timestamp
        ].filter(Boolean).join(" - ");

        return `
          ${renderCodexRow({
            title: entry.Entry_Title || "Journal Entry",
            meta,
            icon: getCodexIcon("journal"),
            onclick: `openJournalEntryModal('${escapeJsString(entry.Entry_ID)}')`
          })}
        `;
      }).join("")}
    </div>
  `;
}

function renderCodexDetailRailPage(overviewHtml, items, sectionsHtml, auditOptions = {}) {
  const auditDetail = appendCodexAuditDetailRail?.(items, sectionsHtml, auditOptions) || { items, sectionsHtml };
  items = auditDetail.items;
  sectionsHtml = auditDetail.sectionsHtml;

  const sectionIds = Array.isArray(items) ? items.map(item => item.id).filter(Boolean) : [];
  const activeSectionId = getCachedCodexDetailSection(sectionIds);

  if (activeSectionId) {
    requestAnimationFrame(() => setCodexDetailSection(activeSectionId, { cache: false }));
  } else if (sectionIds[0]) {
    requestAnimationFrame(() => cacheCodexDetailSection(sectionIds[0]));
  }

  return `
    <div class="codex-detail-page-shell codex-detail-rail-page">
      <div class="codex-detail-overview-locked">
        ${overviewHtml}
      </div>

      <div class="codex-detail-lower-pane">
        <aside class="codex-detail-rail">
          ${renderCodexDetailRail(items)}
        </aside>

        <main class="codex-detail-main codex-scroll-fade">
          ${sectionsHtml}
        </main>
      </div>
    </div>
  `;
}

function buildCodexDetailNpcListLabel(npc) {
  return joinCodexLabel(
    [npc.Title, npc.Name].filter(Boolean).join(" "),
    [
      [
        npc.Organization,
        npc.Race,
        npc.Occupation
      ].filter(Boolean).join(" • ")
    ]
  );
}

function buildCodexMappedAreaListLabel(poi) {
  const meta = [];

  const typeLine = [
    poi.POI_Type || "",
    poi["Notoriety Tier"] ? `Notoriety: ${poi["Notoriety Tier"]}` : ""
  ].filter(Boolean).join(" • ");

  if (typeLine) meta.push(typeLine);

  const npcCount = getNpcsForPoi(poi.POI_ID).length;

  const locationNpcLine = [
    poi.Hex_ID_Ref ? `Hex ${poi.Hex_ID_Ref}` : "",
    npcCount > 0 ? `${npcCount} NPC${npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  if (locationNpcLine) meta.push(locationNpcLine);

  return joinCodexLabel(
    poi.Name || poi.POI_ID || "Unnamed Area",
    meta
  );
}

function renderCodexUpperListPanel(title, rows, emptyText, type, idField, getLabel, extraClass = "") {
  return `
    <section class="codex-detail-npc-panel codex-detail-overview-side ${extraClass}">
      <h3>${escapeHtml(title)}</h3>
      <div class="codex-detail-upper-scrollbox codex-scroll-fade">
        ${renderCodexLinkedList(rows, emptyText, type, idField, getLabel)}
      </div>
    </section>
  `;
}

function renderCodexHexPage(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const politicalRegion = hex?.Political_Region_ID_Ref ? db?.regionsById?.[hex.Political_Region_ID_Ref] : null;
  const pois = getPoisForHex(hexId);
  const npcs = getNpcsForHex(hexId);
  const maps = getMapsForOwner("hex", hexId);

  setCodexTitle(`Hex ${hexId}`);

  const railItems = [
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-pois", label: "POIs", icon: getCodexIcon("poi"), count: pois.length },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-meta codex-detail-overview-meta">
        <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>
        <p><strong>Region:</strong> ${
          region
            ? renderCodexInlineLink("region", region.Region_ID, region.Region_Name)
            : escapeHtml(hex?.Region_ID_Ref || "Unknown")
        }</p>
        ${politicalRegion || hex?.Political_Region_ID_Ref ? `
          <p><strong>Political Region:</strong> ${
            politicalRegion
              ? renderCodexInlineLink("region", politicalRegion.Region_ID, politicalRegion.Region_Name)
              : escapeHtml(hex?.Political_Region_ID_Ref || "Unknown")
          }</p>
        ` : ""}
      </div>
    </section>
  `;

  const addPoiAction = renderCodexDetailSectionAction(
    "Add POI",
    `openAddPoiEditor({ regionId: '${escapeJsString(hex?.Region_ID_Ref || "")}', hexId: '${escapeJsString(hexId)}', lockRegion: true, lockHex: true, lockCreateGroup: true })`
  );

  const addNpcAction = renderCodexDetailSectionAction(
    "Add NPC",
    `openAddNpcEditor({ hexId: '${escapeJsString(hexId)}' })`
  );

  const sections = [
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexJournalContent(hex), "", true, renderAddJournalAction("hex", hexId)),
    renderCodexDetailRailSection("codex-detail-pois", "Points of Interest", renderCodexPoiLinkedList(pois, "No known points of interest in this hex.", "poi", "POI_ID", buildPoiListLabel), "", false, addPoiAction),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs associated with this hex.", "npc", "NPC_ID", buildNpcListLabel), "", false, addNpcAction),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this hex."), "", false, renderMapSectionActions("hex", hexId, maps))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections, {
    targetType: "hexes",
    targetId: hex?.__uuid || ""
  }), buildCodexBreadcrumbTrail(`Hex ${hexId}`, {
    label: "Hexes",
    pageType: "hexes"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-hex-detail-page");
}

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
  const regionField = region?.Region_Type === "political"
    ? "Political_Region_ID_Ref"
    : "Region_ID_Ref";
  const hexes = getRowsByField(db?.raw?.hexes, regionField, regionId);
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

  setCodexTitle(regionName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-pois", label: "POIs", icon: getCodexIcon("poi"), count: poiListRows.length },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-terrain", label: "Terrain", icon: getCodexIcon("hex"), count: Object.keys(terrainCounts).length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-region">
        <div class="codex-detail-portrait-slot codex-region-detail-image codex-placeholder-region" ${renderRegionImageStyle(imageUrl, region)}>
          <span class="codex-region-detail-stroke" aria-hidden="true"></span>
        </div>

        <div class="codex-detail-meta codex-region-detail-summary">
          <p><strong>Type:</strong> ${escapeHtml(region?.Region_Type === "political" ? "Political" : "Geographic")}</p>
          <p><strong>Hexes:</strong> ${summary.hexCount}</p>
          <p><strong>Terrain Types:</strong> ${Object.keys(terrainCounts).length}</p>
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
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexJournalContent(region), "", false, renderAddJournalAction("region", regionId)),
    renderCodexDetailRailSection("codex-detail-pois", "Points of Interest", renderCodexPoiLinkedList(poiListRows, "No points of interest currently recorded in this region.", "poi", "POI_ID", buildPoiListLabel)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No NPCs currently recorded in this region.", "npc", "NPC_ID", buildNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-terrain", "Terrain", terrainSectionContent),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this region."), "", false, renderMapSectionActions("region", regionId, maps))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections, {
    targetType: "regions",
    targetId: region?.__uuid || ""
  }), buildCodexBreadcrumbTrail(regionName, {
    label: "Regions",
    pageType: "regions"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-region-detail-page");
}

function renderCodexRelatedAreaGroup(
  title,
  rows,
  fallback,
  type = "poi",
  idField = "POI_ID",
  getLabel = buildCodexMappedAreaListLabel
) {
  const listHtml = ["poi", "poi-group"].includes(type)
    ? renderCodexPoiLinkedList(rows, fallback, type, idField, getLabel)
    : renderCodexLinkedList(rows, fallback, type, idField, getLabel);

  return `
    <section class="codex-detail-related-area-group">
      <h4>${escapeHtml(title)}</h4>
      ${listHtml}
    </section>
  `;
}

function buildCodexParentAreaListLabel(group) {
  return joinCodexLabel(
    group?.POI_Group_Name || group?.POI_Group_ID || "Unnamed Parent",
    [
      [
        group?.Group_Type || "Grouped POI",
        getPoisForGroup(group?.POI_Group_ID).length
          ? `${getPoisForGroup(group.POI_Group_ID).length} Area${getPoisForGroup(group.POI_Group_ID).length === 1 ? "" : "s"}`
          : ""
      ].filter(Boolean).join(" • ")
    ]
  );
}

function renderCodexPoiRelatedAreasContent(poi, group, siblingPois, localPois) {
  if (!group && !siblingPois.length && !localPois.length) {
    return `<p>No related Areas recorded.</p>`;
  }

  const groups = [];

  if (group) {
    groups.push(renderCodexRelatedAreaGroup(
      "Parent",
      [group],
      "No parent location recorded.",
      "poi-group",
      "POI_Group_ID",
      buildCodexParentAreaListLabel
    ));
  }

  if (siblingPois.length) {
    groups.push(renderCodexRelatedAreaGroup(
      "Sibling Areas",
      siblingPois,
      "No sibling Areas recorded."
    ));
  }

  if (localPois.length) {
    groups.push(renderCodexRelatedAreaGroup(
      "Local Areas",
      localPois,
      "No local Areas recorded."
    ));
  }

  return `
    <div class="codex-detail-related-areas-content">
      ${groups.join("")}
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
  const isSettlement = window.CampaignPoiTypes?.isSettlementType?.(poi?.POI_Type_Value || poi?.POI_Type) || poi?.POI_Type === "Settlement";
  const customImageUrl = getPoiImageUrl(poi);
  const imageUrl = getPoiDisplayImageUrl(poi);
  const imageKind = customImageUrl ? "record" : "icon";
  const placeholderClass = imageUrl ? "" : getPoiPlaceholderClass(poi);
  const maps = getMapsForPoi(poiId);
  const siblingPois = getSiblingPoisForPoi(poi);
  const localPois = getLocalPoisForPoi(poi);
  const relatedCount = siblingPois.length + localPois.length + (group ? 1 : 0);

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
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl, imageKind)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(poi?.POI_Type || "Unknown")}</p>
          <p><strong>Notoriety Tier:</strong> ${escapeHtml(window.CampaignPoiTypes?.getNotorietyDetailLabel?.(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"]) || poi?.["Notoriety Tier"] || "Unknown")}</p>
          ${group ? `<p><strong>Part of:</strong> ${renderCodexInlineLink("poi-group", group.POI_Group_ID, group.POI_Group_Name || group.POI_Group_ID)}</p>` : ""}
          ${hexId ? `<p><strong>Hex:</strong> ${renderCodexInlineLink("hex", hexId, hexId)}</p>` : ""}
          ${!group && (isSettlement || population) ? `<p><strong>Population:</strong> ${escapeHtml(formatCodexPopulation(population) || "Unknown")}</p>` : ""}
          ${renderCodexPoiTagField(poi, "poi")}
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>
      </div>
    </section>
  `;

  const addNpcAction = renderCodexDetailSectionAction(
    "Add NPC",
    `openAddNpcEditor({ homePoiId: '${escapeJsString(poiId)}', lockHome: true })`
  );

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(poi?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexJournalContent(poi), "", false, renderAddJournalAction("poi", poiId)),
    renderCodexDetailRailSection("codex-detail-related-areas", "Related Areas", renderCodexPoiRelatedAreasContent(poi, group, siblingPois, localPois)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs at this location.", "npc", "NPC_ID", buildCodexDetailNpcListLabel), "", false, addNpcAction),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this location."), "", false, renderMapSectionActions("poi", poiId, maps))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections, {
    targetType: "pois",
    targetId: poi?.__uuid || ""
  }), buildCodexGroupedPoiBreadcrumbTrail(poiName, group));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-poi-detail-page");
}

function renderCodexPoiGroupPage(groupId) {
  const group = db?.poiGroupsById?.[groupId];
  const groupName = group?.POI_Group_Name || groupId || "Unknown POI Group";
  const pois = getPoisForGroup(groupId);
  const npcs = getNpcsForPoiGroup(groupId);
  const population = formatCodexPopulation(getPoiGroupPopulation(group));
  const notorietyRange = getPoiGroupNotorietyRange(group);
  const inheritedNotorietyLabel = window.CampaignPoiTypes?.getNotorietyDetailLabel?.(notorietyRange?.lowest) || notorietyRange?.lowest || "";
  const customImageUrl = getPoiGroupImageUrl(group);
  const imageUrl = getPoiGroupDisplayImageUrl(group);
  const imageKind = customImageUrl ? "record" : "icon";
  const placeholderClass = imageUrl ? "" : getPoiPlaceholderClass(group);
  const maps = getMapsForPoiGroup(groupId);

  document.getElementById("codex-title").innerHTML = `
    <div class="codex-superheader codex-grouped-poi-superheader">Grouped POI</div>
    <div class="codex-mainheader">${escapeHtml(groupName)}</div>
  `;

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
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl, imageKind)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(group?.Group_Type || "Grouped POI")}</p>
          ${inheritedNotorietyLabel ? `<p><strong>Notoriety Tier:</strong> ${escapeHtml(inheritedNotorietyLabel)}</p>` : ""}
          ${population ? `<p><strong>Population:</strong> ${escapeHtml(population)}</p>` : ""}
          ${renderCodexPoiTagField(group, "poi-group")}
          <p><strong>Areas:</strong> ${pois.length}</p>
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>
      </div>
    </section>
  `;

  const addChildPoiAction = renderCodexDetailSectionAction(
    "Add POI",
    `openAddPoiEditor({ parentGroupId: '${escapeJsString(groupId)}', lockParentGroup: true, lockCreateGroup: true })`
  );

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(group?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexJournalContent(group), "", false, renderAddJournalAction("poi_group", groupId)),
    renderCodexDetailRailSection("codex-detail-areas", "Areas", renderCodexRelatedAreaGroup("Child Areas", pois, "No child Areas recorded."), "", false, addChildPoiAction),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs associated with this place.", "npc", "NPC_ID", buildCodexDetailNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this place."), "", false, renderMapSectionActions("poi-group", groupId, maps))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections, {
    targetType: "poi_groups",
    targetId: group?.__uuid || ""
  }), buildCodexBreadcrumbTrail(groupName, {
    label: "Points of Interest",
    pageType: "pois"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-poi-group-detail-page");
}

function renderCodexNpcPage(npcId) {
  const npc = db?.npcsById?.[npcId];
  const home = npc?.Home_ID_Ref ? db?.poisById?.[npc.Home_ID_Ref] : null;
  const homeGroup = home ? getPoiGroupForPoi(home) : null;
  const npcName = npc?.Name || npcId || "Unknown NPC";
  const imageUrl = getNpcImageUrl(npc);

  document.getElementById("codex-title").innerHTML = `
    ${npc?.Title ? `<div class="codex-superheader">${escapeHtml(npc.Title)}</div>` : ""}
    <div class="codex-mainheader">${escapeHtml(npcName)}</div>
    ${npc?.Organization ? `<div class="codex-subheader">${escapeHtml(npc.Organization)}</div>` : ""}
  `;

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") }
  ];

  const homeLine = homeGroup
    ? renderCodexInlineLink("poi-group", homeGroup.POI_Group_ID, homeGroup.POI_Group_Name || homeGroup.POI_Group_ID)
    : home
      ? renderCodexInlineLink("poi", home.POI_ID, home.Name)
      : escapeHtml(npc?.Home_ID_Ref || "Unknown");

  const locationLine = homeGroup && home
    ? `<p><strong>Area:</strong> ${renderCodexInlineLink("poi", home.POI_ID, home.Name)}</p>`
    : "";

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed">
        <div class="codex-detail-portrait-slot codex-placeholder-npc" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Race:</strong> ${escapeHtml(npc?.Race || "Unknown")}</p>
          <p><strong>Occupation:</strong> ${escapeHtml(npc?.Occupation || "Unknown")}</p>
          <p><strong>Home:</strong> ${homeLine}</p>
          ${locationLine}
        </div>
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(npc?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexJournalContent(npc), "", false, renderAddJournalAction("npc", npcId))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections, {
    targetType: "npcs",
    targetId: npc?.__uuid || ""
  }), buildCodexBreadcrumbTrail(npcName, {
    label: "NPCs",
    pageType: "npcs"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-npc-detail-page");
}

function renderCodexRegionTile(region) {
  const regionId = region.Region_ID;
  const regionName = region.Region_Name || regionId || "Unnamed Region";
  const summary = getRegionSummary(regionId);
  const imageUrl = getRegionImageUrl(region);

  const detailLine = [
    `${summary.hexCount} hexes`,
    `${summary.poiCount} POIs`,
    summary.mappedAreaCount > summary.poiCount ? `${summary.mappedAreaCount} Areas` : "",
    `${summary.npcCount} NPCs`
  ].filter(Boolean).join(" • ");

  return `
    <button class="codex-region-tile" type="button" ${renderRegionColorStyle(region)} onclick="openCodexPage('region', '${escapeJsString(regionId)}')">
      <span class="codex-region-tile-image codex-placeholder-region" ${renderRegionImageStyle(imageUrl, region)} data-codex-image-expand="false"></span>
      <span class="codex-region-tile-hover" aria-hidden="true"></span>
      <span class="codex-region-tile-stroke" aria-hidden="true"></span>
      <span class="codex-region-tile-info">
        <span class="codex-region-tile-name">${escapeHtml(regionName)}</span>
        <span class="codex-region-tile-details">${escapeHtml(detailLine)}</span>
      </span>
    </button>
  `;
}

function renderCodexRegionsIndex() {
  const regions = [...(db?.raw?.regions || [])]
    .filter(region => region.Region_ID !== "REG-0000")
    .sort((a, b) => {
      return String(a.Region_Name || a.Region_ID || "")
        .localeCompare(String(b.Region_Name || b.Region_ID || ""), undefined, {
          numeric: true,
          sensitivity: "base"
        });
    });
  const geographicRegions = regions.filter(region => (region.Region_Type || "geographic") === "geographic");
  const politicalRegions = regions.filter(region => region.Region_Type === "political");

  setCodexTitle("Regions");

  setCodexContent(`
    <div class="codex-list-page-shell codex-region-index-shell">
      <div class="codex-list-control-split-view">
        <aside class="codex-list-control-rail">
          <div class="codex-list-controls-shell">
            <nav class="codex-row-list codex-row-list-rail codex-detail-section-rail" aria-label="Region type">
              ${renderCodexRegionIndexRailButton("geographic", "Geographic", geographicRegions.length, true)}
              ${renderCodexRegionIndexRailButton("political", "Political", politicalRegions.length)}
            </nav>
          </div>
        </aside>

        <div class="codex-list-scroll-shell codex-scroll-fade">
          ${renderCodexAuditIndexButton?.({
            title: "Regions Audit",
            targetTypes: ["regions"]
          }) || ""}

          <section id="codex-region-index-geographic" class="codex-region-index-section active">
            <h3>Geographic</h3>
            ${
              geographicRegions.length
                ? `<div class="codex-region-tile-grid">${geographicRegions.map(renderCodexRegionTile).join("")}</div>`
                : `<p>No geographic regions recorded.</p>`
            }
          </section>

          <section id="codex-region-index-political" class="codex-region-index-section">
            <h3>Political</h3>
            ${
              politicalRegions.length
                ? `<div class="codex-region-tile-grid">${politicalRegions.map(renderCodexRegionTile).join("")}</div>`
                : `<p>No political regions recorded.</p>`
            }
          </section>
        </div>
      </div>
    </div>
  `, [
    { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
    { label: "Regions" }
  ]);

  document.getElementById("codex-content").classList.add("codex-list-page", "codex-regions-index");
  registerCodexRegionIndexMobileSectionsUtility();
}

function renderCodexRegionIndexRailButton(type, label, count, active = false) {
  return `
    <button
      class="codex-row codex-detail-section-rail-row ${active ? "active codex-row-active" : ""}"
      type="button"
      data-codex-region-index-type="${escapeHtml(type)}"
      onclick="setCodexRegionIndexSection('${escapeJsString(type)}')"
    >
      <span class="codex-row-icon" aria-hidden="true">${escapeHtml(getCodexIcon("region"))}</span>
      <span class="codex-row-main">
        <span class="codex-row-title">${escapeHtml(label)}</span>
      </span>
      <span class="codex-row-count">${escapeHtml(String(count))}</span>
    </button>
  `;
}

function setCodexRegionIndexSection(type) {
  const normalized = type === "political" ? "political" : "geographic";
  document.querySelectorAll(".codex-region-index-section").forEach(section => {
    section.classList.toggle("active", section.id === `codex-region-index-${normalized}`);
  });
  document.querySelectorAll("[data-codex-region-index-type]").forEach(button => {
    const active = button.dataset.codexRegionIndexType === normalized;
    button.classList.toggle("active", active);
    button.classList.toggle("codex-row-active", active);
  });
}

function getCodexRegionIndexSectionItems() {
  return [...document.querySelectorAll("[data-codex-region-index-type]")].map(button => ({
    type: button.dataset.codexRegionIndexType,
    label: button.querySelector(".codex-row-title")?.textContent?.trim() || button.dataset.codexRegionIndexType,
    count: button.querySelector(".codex-row-count")?.textContent?.trim() || ""
  })).filter(item => item.type);
}

function renderCodexRegionIndexMobileSectionsPanel() {
  const items = getCodexRegionIndexSectionItems();

  return `
    <nav class="codex-row-list codex-mobile-detail-section-picker" aria-label="Region sections">
      ${items.map(item => `
        <button
          class="codex-row codex-mobile-detail-section-row ${document.getElementById(`codex-region-index-${item.type}`)?.classList.contains("active") ? "active codex-row-active" : ""}"
          type="button"
          data-codex-mobile-region-section="${escapeHtml(item.type)}"
        >
          <span class="codex-row-icon" aria-hidden="true">${escapeHtml(getCodexIcon("region"))}</span>
          <span class="codex-row-main">
            <span class="codex-row-title">${escapeHtml(item.label)}</span>
          </span>
          <span class="codex-row-count">${escapeHtml(item.count)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function bindCodexRegionIndexMobileSectionsPanel(panel) {
  panel.querySelectorAll("[data-codex-mobile-region-section]").forEach(button => {
    button.addEventListener("click", function () {
      setCodexRegionIndexSection(button.dataset.codexMobileRegionSection);
      closeCodexMobileUtilityPanel?.();
    });
  });
}

function registerCodexRegionIndexMobileSectionsUtility() {
  if (typeof setCodexMobileUtility !== "function") return;

  setCodexMobileUtility({
    type: "region-index-sections",
    label: "Sections",
    panelTitle: "Regions",
    renderPanel: renderCodexRegionIndexMobileSectionsPanel,
    bindPanel: bindCodexRegionIndexMobileSectionsPanel
  });
}

window.cacheCodexDetailSection = cacheCodexDetailSection;
window.clearCodexDetailSectionStateCache = clearCodexDetailSectionStateCache;
