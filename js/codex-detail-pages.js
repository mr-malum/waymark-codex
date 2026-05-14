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
    ? `style="background-image: url('${escapeJsString(imageUrl)}')"`
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

  if (typeLine) {
    meta.push(typeLine);
  }

  const npcCount = getNpcsForPoi(poi.POI_ID).length;

  const locationNpcLine = [
    poi.Hex_ID_Ref ? `Hex ${poi.Hex_ID_Ref}` : "",
    npcCount > 0 ? `${npcCount} NPC${npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  if (locationNpcLine) {
    meta.push(locationNpcLine);
  }

  return joinCodexLabel(
    poi.Name || poi.POI_ID || "Unnamed Mapped Area",
    meta
  );
}

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
          ? renderCodexInlineLink("region", region.Region_ID, region.Region_Name)
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
  `, buildCodexBreadcrumbTrail(`Hex ${hexId}`));
}

function renderCodexRegionPage(regionId) {
  const region = db?.regionsById?.[regionId];
  const hexes = getRowsByField(db?.raw?.hexes, "Region_ID_Ref", regionId);
  const regionName = region?.Region_Name || regionId || "Unknown Region";
  const summary = getRegionSummary(regionId);
  const imageUrl = getRegionImageUrl(region);

  const pois = hexes.flatMap(hex => {
    return getPoisForHex(hex.Hex_ID);
  });

  const poiListRows = createPoiGroupListRows(pois);

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
    <div class="codex-region-detail-shell">
      <div class="codex-region-detail-fixed">
        <div
          class="codex-detail-portrait-slot codex-region-detail-image codex-placeholder-region"
          ${renderImageStyle(imageUrl)}
        ></div>

        <div class="codex-detail-meta codex-region-detail-summary">
          <p><strong>Hexes:</strong> ${summary.hexCount}</p>
          <p><strong>Points of Interest:</strong> ${summary.poiCount}</p>
          ${
            summary.mappedAreaCount > summary.poiCount
              ? `<p><strong>Mapped Areas:</strong> ${summary.mappedAreaCount}</p>`
              : ""
          }
          <p><strong>NPCs:</strong> ${summary.npcCount}</p>
        </div>

        <div class="codex-region-terrain-profile">
          <h3>Terrain Profile</h3>
          <p>${terrainSummary || "No terrain data recorded."}</p>
        </div>
      </div>

      <h3>Region Notes</h3>
      <p>${escapeHtml(region?.Lore || region?.DM_Journal || "No region notes recorded.")}</p>

      <h3>Points of Interest</h3>
      ${renderCodexLinkedList(
        poiListRows,
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
    </div>
  `, buildCodexBreadcrumbTrail(regionName, {
    label: "Regions",
    pageType: "regions"
  }));

  document.getElementById("codex-content").classList.add("codex-region-detail-page");
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

  setCodexTitle(poiName);

  setCodexContent(`
    <div class="codex-detail-page-shell">
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(poi?.POI_Type || "Unknown")}</p>
          <p><strong>Notoriety Tier:</strong> ${escapeHtml(poi?.["Notoriety Tier"] || "Unknown")}</p>

          ${
            group
              ? `<p><strong>Part of:</strong> ${renderCodexInlineLink("poi-group", group.POI_Group_ID, group.POI_Group_Name || group.POI_Group_ID)}</p>`
              : ""
          }

          ${
            hexId
              ? `<p><strong>Hex:</strong> ${renderCodexInlineLink("hex", hexId, hexId)}</p>`
              : ""
          }

          ${
            !group && (poi?.POI_Type === "Settlement" || population)
              ? `<p><strong>Population:</strong> ${escapeHtml(formatCodexPopulation(population) || "Unknown")}</p>`
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
              buildCodexDetailNpcListLabel
            )}
          </div>
        </section>
      </div>

      <div class="codex-detail-scroll-grid">
        ${renderCodexDetailTextPanel(
          "DM Journal",
          poi?.DM_Journal,
          "No journal entries."
        )}

        ${renderCodexDetailTextPanel(
          "Lore",
          poi?.Lore,
          "No lore recorded."
        )}
      </div>
    </div>
  `, buildCodexGroupedPoiBreadcrumbTrail(poiName, group));

  document.getElementById("codex-content").classList.add("codex-detail-page");
}

function renderCodexPoiGroupPage(groupId) {
  const group = db?.poiGroupsById?.[groupId];
  const groupName = group?.POI_Group_Name || groupId || "Unknown POI Group";
  const pois = getPoisForGroup(groupId);
  const npcs = getNpcsForPoiGroup(groupId);
  const population = formatCodexPopulation(getPoiGroupPopulation(group));
  const imageUrl = getPoiGroupImageUrl(group);
  const placeholderClass = getPoiPlaceholderClass(group);

  setCodexTitle(groupName);

  setCodexContent(`
    <div class="codex-detail-page-shell">
      <div class="codex-detail-fixed codex-detail-fixed-poi">
        <div class="codex-detail-portrait-slot ${placeholderClass}" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Type:</strong> ${escapeHtml(group?.Group_Type || "Grouped POI")}</p>

          ${
            population
              ? `<p><strong>Population:</strong> ${escapeHtml(population)}</p>`
              : ""
          }

          <p><strong>Mapped Areas:</strong> ${pois.length}</p>
        </div>

        <section class="codex-detail-npc-panel">
          <h3>NPCs</h3>

          <div class="codex-detail-upper-scrollbox codex-scroll-fade">
            ${renderCodexLinkedList(
              npcs,
              "No known NPCs associated with this place.",
              "npc",
              "NPC_ID",
              buildCodexDetailNpcListLabel
            )}
          </div>
        </section>
      </div>

      <h3>Mapped Areas</h3>
      ${renderCodexLinkedList(
        pois,
        "No mapped areas currently recorded for this place.",
        "poi",
        "POI_ID",
        buildCodexMappedAreaListLabel
      )}

      <div class="codex-detail-scroll-grid">
        ${renderCodexDetailTextPanel(
          "DM Journal",
          group?.DM_Journal,
          "No journal entries."
        )}

        ${renderCodexDetailTextPanel(
          "Lore",
          group?.Lore,
          "No lore recorded."
        )}
      </div>
    </div>
  `, buildCodexBreadcrumbTrail(groupName, {
    label: "Points of Interest",
    pageType: "pois"
  }));

  document.getElementById("codex-content").classList.add("codex-detail-page");
}

function renderCodexNpcPage(npcId) {
  const npc = db?.npcsById?.[npcId];
  const home = npc?.Home_ID_Ref
    ? db?.poisById?.[npc.Home_ID_Ref]
    : null;

  const homeGroup = home ? getPoiGroupForPoi(home) : null;
  const npcName = npc?.Name || npcId || "Unknown NPC";
  const imageUrl = getNpcImageUrl(npc);

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
        <div class="codex-detail-portrait-slot codex-placeholder-npc" ${renderImageStyle(imageUrl)}></div>

        <div class="codex-detail-meta">
          <p><strong>Home:</strong> ${
            homeGroup
              ? renderCodexInlineLink("poi-group", homeGroup.POI_Group_ID, homeGroup.POI_Group_Name || homeGroup.POI_Group_ID)
              : home
                ? renderCodexInlineLink("poi", home.POI_ID, home.Name)
                : escapeHtml(npc?.Home_ID_Ref || "Unknown")
          }</p>

          ${
            homeGroup && home
              ? `<p><strong>Location:</strong> ${renderCodexInlineLink("poi", home.POI_ID, home.Name)}</p>`
              : ""
          }

          <p><strong>Race:</strong> ${escapeHtml(
            npc?.Race || "Unknown"
          )}</p>

          <p><strong>Occupation:</strong> ${escapeHtml(
            npc?.Occupation || "Unknown"
          )}</p>
        </div>
      </div>

      <div class="codex-detail-scroll-grid">
        ${renderCodexDetailTextPanel(
          "DM Journal",
          npc?.DM_Journal,
          "No journal entries."
        )}

        ${renderCodexDetailTextPanel(
          "Lore",
          npc?.Lore,
          "No lore recorded."
        )}
      </div>
    </div>
  `, buildCodexBreadcrumbTrail(npcName, {
    label: "NPCs",
    pageType: "npcs"
  }));

  document
    .getElementById("codex-content")
    .classList.add("codex-detail-page");
}

function renderCodexRegionTile(region) {
  const regionId = region.Region_ID;
  const regionName = region.Region_Name || regionId || "Unnamed Region";
  const summary = getRegionSummary(regionId);
  const imageUrl = getRegionImageUrl(region);

  const detailLine = [
    `${summary.hexCount} hexes`,
    `${summary.poiCount} POIs`,
    summary.mappedAreaCount > summary.poiCount
      ? `${summary.mappedAreaCount} mapped areas`
      : "",
    `${summary.npcCount} NPCs`
  ].filter(Boolean).join(" • ");

  return `
    <button
      class="codex-region-tile"
      type="button"
      onclick="openCodexPage('region', '${escapeJsString(regionId)}')"
    >
      <span
        class="codex-region-tile-image codex-placeholder-region"
        ${renderImageStyle(imageUrl)}
      ></span>

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
