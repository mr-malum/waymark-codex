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
}

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

function renderCodexDetailRailSection(id, title, content, classes = "", active = false) {
  return `
    <section id="${escapeHtml(id)}" class="codex-detail-rail-section ${active ? "active" : ""} ${classes}">
      <h3>${escapeHtml(title)}</h3>
      <div class="codex-detail-rail-section-content">
        ${content}
      </div>
    </section>
  `;
}

function renderCodexDetailTextContent(text, fallback) {
  return `<p class="codex-detail-text-block">${escapeHtml(text || fallback)}</p>`;
}

function renderCodexDetailRailPage(overviewHtml, items, sectionsHtml) {
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
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(hex?.DM_Journal, "No journal entries."), "", true),
    renderCodexDetailRailSection("codex-detail-pois", "Points of Interest", renderCodexLinkedList(pois, "No known points of interest in this hex.", "poi", "POI_ID", buildPoiListLabel)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs associated with this hex.", "npc", "NPC_ID", buildNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this hex."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(`Hex ${hexId}`, {
    label: "Hexes",
    pageType: "hexes"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-hex-detail-page");
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

  const terrainRows = Object.entries(terrainCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([terrain, count]) => `
      <div class="codex-region-terrain-row">
        <span>${escapeHtml(terrain)}</span>
        <strong>${count}</strong>
      </div>
    `)
    .join("");

  setCodexTitle(regionName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-pois", label: "POIs", icon: getCodexIcon("poi"), count: poiListRows.length },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-hexes", label: "Hexes", icon: getCodexIcon("hex"), count: hexes.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-region">
        <div class="codex-detail-portrait-slot codex-region-detail-image codex-placeholder-region" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta codex-region-detail-summary">
          <p><strong>Hexes:</strong> ${summary.hexCount}</p>
          <p><strong>Points of Interest:</strong> ${summary.poiCount}</p>
          ${summary.mappedAreaCount > summary.poiCount ? `<p><strong>Areas:</strong> ${summary.mappedAreaCount}</p>` : ""}
          <p><strong>NPCs:</strong> ${summary.npcCount}</p>
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>

        <section class="codex-detail-npc-panel codex-region-terrain-profile codex-detail-overview-side codex-detail-terrain-overview">
          <p class="codex-overview-side-label"><strong>Terrain Profile:</strong></p>
          <div class="codex-detail-upper-scrollbox codex-scroll-fade">
            ${terrainRows ? `<div class="codex-region-terrain-list">${terrainRows}</div>` : `<p>No terrain data recorded.</p>`}
          </div>
        </section>
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(region?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(region?.DM_Journal, "No journal entries.")),
    renderCodexDetailRailSection("codex-detail-pois", "Points of Interest", renderCodexLinkedList(poiListRows, "No points of interest currently recorded in this region.", "poi", "POI_ID", buildPoiListLabel)),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No NPCs currently recorded in this region.", "npc", "NPC_ID", buildNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-hexes", "Hexes", renderCodexLinkedList(hexes, "No hexes currently assigned to this region.", "hex", "Hex_ID", buildHexListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this region."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(regionName, {
    label: "Regions",
    pageType: "regions"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page", "codex-region-detail-page");
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

  setCodexTitle(poiName);

  const railItems = [
    { id: "codex-detail-lore", label: "Lore", icon: getCodexIcon("lore") },
    { id: "codex-detail-journal", label: "DM Journal", icon: getCodexIcon("journal") },
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const relatedOverview = `
    <section class="codex-detail-npc-panel codex-detail-overview-side codex-detail-related-overview">
      <p class="codex-overview-side-label"><strong>Related Areas:</strong></p>
      <div class="codex-detail-upper-scrollbox codex-scroll-fade">
        ${group ? `<p><strong>Parent:</strong> ${renderCodexInlineLink("poi-group", group.POI_Group_ID, group.POI_Group_Name || group.POI_Group_ID)}</p>` : `<p>No parent location recorded.</p>`}
        ${renderCodexLinkedList(relatedPois, "No sibling Areas recorded.", "poi", "POI_ID", buildCodexMappedAreaListLabel)}
      </div>
    </section>
  `;

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

        ${relatedOverview}
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(poi?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(poi?.DM_Journal, "No journal entries.")),
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
    { id: "codex-detail-npcs", label: "NPCs", icon: getCodexIcon("npc"), count: npcs.length },
    { id: "codex-detail-maps", label: "Maps", icon: getCodexIcon("map"), count: maps.length }
  ];

  const overviewMappedAreas = `
    <section class="codex-detail-npc-panel codex-detail-overview-side codex-detail-mapped-overview">
      <p class="codex-overview-side-label"><strong>Areas:</strong> ${pois.length}</p>
      <div class="codex-detail-upper-scrollbox codex-scroll-fade">
        ${renderCodexLinkedList(pois, "No Areas currently recorded for this place.", "poi", "POI_ID", buildCodexMappedAreaListLabel)}
      </div>
    </section>
  `;

  const overview = `
    <section class="codex-detail-overview-panel codex-detail-overview-section">
      <h3>Overview</h3>
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(group?.Group_Type || "Grouped POI")}</p>
          ${population ? `<p><strong>Population:</strong> ${escapeHtml(population)}</p>` : ""}
          ${maps.length ? `<p><strong>Maps:</strong> ${maps.length}</p>` : ""}
        </div>

        ${overviewMappedAreas}
      </div>
    </section>
  `;

  const sections = [
    renderCodexDetailRailSection("codex-detail-lore", "Lore", renderCodexDetailTextContent(group?.Lore, "No lore recorded."), "", true),
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(group?.DM_Journal, "No journal entries.")),
    renderCodexDetailRailSection("codex-detail-npcs", "NPCs", renderCodexLinkedList(npcs, "No known NPCs associated with this place.", "npc", "NPC_ID", buildCodexDetailNpcListLabel)),
    renderCodexDetailRailSection("codex-detail-maps", "Maps", renderCodexMapsContent(maps, "No maps recorded for this place."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(groupName, {
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
    renderCodexDetailRailSection("codex-detail-journal", "DM Journal", renderCodexDetailTextContent(npc?.DM_Journal, "No journal entries."))
  ].join("");

  setCodexContent(renderCodexDetailRailPage(overview, railItems, sections), buildCodexBreadcrumbTrail(npcName, {
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
    <button class="codex-region-tile" type="button" onclick="openCodexPage('region', '${escapeJsString(regionId)}')">
      <span class="codex-region-tile-image codex-placeholder-region" ${renderImageStyle(imageUrl)}></span>
      <span class="codex-region-tile-info">
        <span class="codex-region-tile-name">${escapeHtml(regionName)}</span>
        <span class="codex-region-tile-details">${escapeHtml(detailLine)}</span>
      </span>
    </button>
  `;
}

function renderCodexRegionsIndex() {
  const regions = [...(db?.raw?.regions || [])].sort((a, b) => {
    return String(a.Region_Name || a.Region_ID || "")
      .localeCompare(String(b.Region_Name || b.Region_ID || ""));
  });

  setCodexTitle("Regions");

  setCodexContent(`
    <div class="codex-region-tile-grid">
      ${regions.map(renderCodexRegionTile).join("") || `<p>No regions recorded.</p>`}
    </div>
  `, [
    { label: "Codex", clickable: true, onclick: "resetCodexToIndex()" },
    { label: "Regions" }
  ]);

  document.getElementById("codex-content").classList.add("codex-regions-index");
}
