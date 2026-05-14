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
  `, buildCodexBreadcrumbTrail(regionName, {
    label: "Regions",
    pageType: "regions"
  }));
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
              ? `<p><strong>Hex:</strong> ${renderCodexInlineLink("hex", hexId, hexId)}</p>`
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
  `, buildCodexBreadcrumbTrail(poiName, {
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
              ? renderCodexInlineLink("poi", home.POI_ID, home.Name)
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
