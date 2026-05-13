let db = null;

loadDatabase().then(loadedDb => {
  db = loadedDb;
  console.log("Database loaded:", db);
});

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 0,
  maxBoundsViscosity: 0.5
});

const imageWidth = 6417;
const imageHeight = 7575;
const bounds = [[0, 0], [imageHeight, imageWidth]];

L.imageOverlay("assets/Kadesh.png", bounds).addTo(map);
map.fitBounds(bounds);

function updatePanBounds() {
  const zoom = map.getZoom();
  const isMobile = window.innerWidth <= 768;

  let padding;

  if (isMobile) {
    padding = zoom < -2 ? 2600 : zoom < -1 ? 1100 : zoom < 0 ? 700 : 350;
  } else {
    padding = zoom < -2 ? 5200 : zoom < -1 ? 1700 : zoom < 0 ? 1100 : 600;
  }

  const rightPadding = isMobile
    ? padding
    : padding * 1.35;

  map.setMaxBounds([
    [-padding, -padding],
    [imageHeight + padding, imageWidth + rightPadding]
  ]);
}

map.on("zoomend", updatePanBounds);
map.on("load", updatePanBounds);
map.whenReady(updatePanBounds);
updatePanBounds();

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

const centerX = (1.33 / 100) * imageWidth;
const centerY = imageHeight - ((1 / 100) * imageHeight);

const hexWidth = 82.25;
const hexHeight = 143.32;

const startX = centerX;
const startY = centerY;

const rowStepY = 150;
const colStepX = 255;
const oddColY = rowStepY / -2;
const oddColX = colStepX / 2;

let selectedHex = null;
let selectedHexId = null;
let codexHistory = [];
let codexSearchQuery = "";
let retroCodexMode = false;

const defaultStyle = {
  color: "#ffffff",
  weight: 4,
  opacity: 0.10,
  fillColor: "#ffffff",
  fillOpacity: 0.015,
  className: "hex-glow"
};

const hoverStyle = {
  opacity: 0.30,
  fillOpacity: 0.05,
  weight: 6
};

const selectedStyle = {
  opacity: 0.60,
  fillOpacity: 0.10,
  weight: 8
};

function makeHex(centerX, centerY, width, height) {
  return [
    [centerY, centerX + width],
    [centerY + height * 0.5, centerX + width * 0.5],
    [centerY + height * 0.5, centerX - width * 0.5],
    [centerY, centerX - width],
    [centerY - height * 0.5, centerX - width * 0.5],
    [centerY - height * 0.5, centerX + width * 0.5]
  ];
}

function getHexCenter(xxx, yyy) {
  const row = xxx - 300;
  const col = yyy - 300;
  const pair = Math.floor(col / 2);
  const odd = col % 2;

  const x = startX + (pair * colStepX) + (odd * oddColX);
  const y = startY - (row * rowStepY) + (odd * oddColY);

  return { x, y };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJsString(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

function getRowsByField(rows, fieldName, value) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row?.[fieldName] === value);
}

function getPoisForHex(hexId) {
  return db?.poisByHexId?.[hexId] || getRowsByField(db?.raw?.pois, "Hex_ID_Ref", hexId);
}

function getNpcsForPoi(poiId) {
  return db?.npcsByHomeId?.[poiId] || [];
}

function getNpcsForHex(hexId) {
  const pois = getPoisForHex(hexId);

  return pois.flatMap(poi => {
    return getNpcsForPoi(poi.POI_ID);
  });
}

function getHexCounts(hexId) {
  const pois = getPoisForHex(hexId);
  const npcCount = pois.reduce((total, poi) => {
    return total + getNpcsForPoi(poi.POI_ID).length;
  }, 0);

  return {
    poiCount: pois.length,
    npcCount
  };
}

function getRegionSummary(regionId) {
  const hexes = getRowsByField(db?.raw?.hexes, "Region_ID_Ref", regionId);

  const pois = hexes.flatMap(hex => {
    return getPoisForHex(hex.Hex_ID);
  });

  const npcCount = pois.reduce((total, poi) => {
    return total + getNpcsForPoi(poi.POI_ID).length;
  }, 0);

  return {
    hexCount: hexes.length,
    poiCount: pois.length,
    npcCount
  };
}

function buildCountLine(poiCount, npcCount) {
  return [
    poiCount > 0 ? `${poiCount} POI${poiCount !== 1 ? "s" : ""}` : "",
    npcCount > 0 ? `${npcCount} NPC${npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");
}

function getLimitedLines(value, maxLines = 4, fallback = "No journal entries.") {
  const lines = String(value || fallback)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const limited = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    limited.push("...");
  }

  return limited.join("\n");
}

function renderMultilineText(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function selectHex(hex) {
  if (selectedHex && selectedHex !== hex) {
    selectedHex.setStyle(defaultStyle);
  }

  selectedHex = hex;
  hex.setStyle(selectedStyle);
}

function clearSelectedHex() {
  if (selectedHex) {
    selectedHex.setStyle(defaultStyle);
    selectedHex = null;
  }
}

function closePanel(options = {}) {
  document.getElementById("app-panel").classList.remove("open");

  if (options.centerSelected && selectedHexId) {
    centerHexInView(selectedHexId);
  }

  if (options.clearSelection) {
    clearSelectedHex();
    map.closePopup();
  }
}

function openPanel() {
  const panel = document.getElementById("app-panel");

  requestAnimationFrame(() => {
    panel.classList.add("open");
  });
}

function renderHexPreview(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const counts = getHexCounts(hexId);

  openPanel();

  document.getElementById("panel-title").textContent = `HEX ${hexId}`;
  document.getElementById("panel-subtitle").textContent = "Field Notes";

  const countLine = buildCountLine(counts.poiCount, counts.npcCount);
  const journalPreview = getLimitedLines(hex?.DM_Journal, 4);

  document.getElementById("panel-content").innerHTML = `
    <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>
    <p><strong>Region:</strong> ${escapeHtml(region?.Region_Name || hex?.Region_ID_Ref || "Unknown")}</p>

    ${countLine ? `<p><strong>Known Records:</strong> ${escapeHtml(countLine)}</p>` : ""}

    <h3>Field Notes</h3>
    <p class="panel-journal-preview">
      ${renderMultilineText(journalPreview)}
    </p>

    <button class="codex-section-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">
      Open Details
    </button>
  `;
}

function openPanelForHex(hexId) {
  renderHexPreview(hexId);
}

function panHexIntoInspectorView(hexId) {
  const [xxx, yyy] = hexId.split(":").map(Number);
  const center = getHexCenter(xxx, yyy);
  const targetLatLng = L.latLng(center.y, center.x);

  const targetPoint = map.latLngToContainerPoint(targetLatLng);
  const desiredPoint = L.point(
    map.getSize().x * 0.33,
    map.getSize().y * 0.5
  );

  const offset = targetPoint.subtract(desiredPoint);

  map.panBy(offset, {
    animate: true,
    duration: 0.35
  });
}

function resetMapToAtlasView() {
  map.closePopup();
  clearSelectedHex();
  selectedHexId = null;
  map.fitBounds(bounds, { animate: true, duration: 0.5 });
}

function centerHexInView(hexId) {
  const [xxx, yyy] = hexId.split(":").map(Number);
  const center = getHexCenter(xxx, yyy);

  map.panTo(
    L.latLng(center.y, center.x),
    {
      animate: true,
      duration: 0.35
    }
  );
}

function toggleRetroCodexMode() {
  retroCodexMode = !retroCodexMode;

  const codexButton = document.getElementById("codex-button");

  if (retroCodexMode) {
    codexButton.style.backgroundImage =
      "url('assets/Win95SwordShield_Upscaled.png')";
  
    codexButton.style.backgroundSize = "75%";
  }
  else {
    codexButton.style.backgroundImage =
      "url('assets/Codex_Book_Button.png')";
  
    codexButton.style.backgroundSize = "";
  }
}

function openCodex() {
  document.getElementById("codex-overlay").classList.add("open");
}

function closeCodex() {
  codexSearchQuery = "";

  document.getElementById("codex-overlay").classList.remove("open");
  map.closePopup();
  clearSelectedHex();
}

function setCodexTitle(title) {
  document.getElementById("codex-title").textContent = title;
}

function getCodexBreadcrumbLabel(label) {
  if (label === "Points of Interest") return "POIs";
  return label;
}

function getCodexBreadcrumbLabel(label) {
  if (label === "Points of Interest") return "POIs";
  return label;
}

function renderCodexBreadcrumbs(breadcrumbs = []) {
  const breadcrumbsEl = document.getElementById("codex-breadcrumbs");
  if (!breadcrumbsEl) return;

  if (!breadcrumbs.length) {
    breadcrumbsEl.innerHTML = "";
    return;
  }

  const displayCrumbs = breadcrumbs.map(crumb => ({
    ...crumb,
    label: getCodexBreadcrumbLabel(crumb.label)
  }));

  const desktopHtml = displayCrumbs.map((crumb, index) => {
    const isLast = index === displayCrumbs.length - 1;

    return `
      ${crumb.clickable && !isLast
        ? `<button class="codex-breadcrumb-button" type="button" onclick="${crumb.onclick}">
            ${escapeHtml(crumb.label)}
          </button>`
        : `<span>${escapeHtml(crumb.label)}</span>`
      }
      ${!isLast ? `<span class="codex-breadcrumb-separator">/</span>` : ""}
    `;
  }).join("");

  const mobileCrumbs = displayCrumbs.slice(-2);

  const mobileHtml = `
    ${displayCrumbs.length > 2
      ? `<span class="codex-breadcrumb-ellipsis">...</span><span class="codex-breadcrumb-separator">/</span>`
      : ""
    }

    ${mobileCrumbs.map((crumb, index) => {
      const isLast = index === mobileCrumbs.length - 1;

      return `
        ${crumb.clickable && !isLast
          ? `<button class="codex-breadcrumb-button" type="button" onclick="${crumb.onclick}">
              ${escapeHtml(crumb.label)}
            </button>`
          : `<span>${escapeHtml(crumb.label)}</span>`
        }

        ${!isLast
          ? `<span class="codex-breadcrumb-separator">/</span>`
          : ""
        }
      `;
    }).join("")}
  `;

  breadcrumbsEl.innerHTML = `
    <div id="codex-breadcrumbs-inner" class="codex-breadcrumbs-desktop">
      ${desktopHtml}
    </div>

    <div class="codex-breadcrumbs-mobile">
      ${mobileHtml}
    </div>
  `;
}

function setCodexContent(html, breadcrumbs = []) {
  const content = document.getElementById("codex-content");
  content.className = "";
  content.scrollTop = 0;

  renderCodexBreadcrumbs(breadcrumbs);

  content.innerHTML = html;
}

function updateCodexBackButton() {
  const backButton = document.getElementById("codex-back");

  if (codexHistory.length <= 1) {
    backButton.disabled = false;
    backButton.textContent = "← Map";
  } else {
    backButton.disabled = false;
    backButton.textContent = "← Back";
  }
}

function openCodexPage(type = "index", id = null, options = {}) {
  const shouldPush = options.push !== false;

  closePanel({ clearSelection: true });
  resetMapToAtlasView();
  openCodex();

  if (shouldPush) {
    codexHistory.push({ type, id });
  }

  renderCodexPage(type, id);
  updateCodexBackButton();
}

function goBackCodex() {
  if (codexHistory.length <= 1) return;

  codexHistory.pop();

  const previous = codexHistory[codexHistory.length - 1];
  renderCodexPage(previous.type, previous.id);
  updateCodexBackButton();
}

function resetCodexToIndex() {
  codexHistory = [];
  openCodexPage("index", null);
}

function renderCodexPage(type, id) {
  if (!db) {
    setCodexTitle("The Codex of Kadesh");
    setCodexContent(`<p>The records are still being gathered...</p>`);
    return;
  }

  if (type === "hex") return renderCodexHexPage(id);
  if (type === "region") return renderCodexRegionPage(id);
  if (type === "poi") return renderCodexPoiPage(id);
  if (type === "npc") return renderCodexNpcPage(id);
  if (type === "search") return renderCodexSearchPage();
  if (type === "regions") return renderCodexRegionsIndex();
  if (type === "pois") return renderCodexPoisIndex();
  if (type === "npcs") return renderCodexNpcsIndex();

  return renderCodexIndex();
}

function renderCodexIndex() {
  setCodexTitle("The Codex of Kadesh");
  renderCodexBreadcrumbs([]);

  codexSearchQuery = "";

  const content = document.getElementById("codex-content");
  content.className = "codex-home";

  content.innerHTML = `
    <button class="codex-section-button" type="button" onclick="openCodexPage('search')">Search</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('regions')">Regions</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('pois')">Points of Interest</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('npcs')">NPCs</button>
  `;
}

// ======================
// CODEX LABEL HELPERS
// ======================

function joinCodexLabel(title, meta = []) {
  return [
    title,
    ...meta.filter(Boolean)
  ].filter(Boolean).join(" — ");
}

function buildPoiListLabel(row) {
  const meta = [];

  const typeLine = [
    row.POI_Type || "",
    row["Notoriety Tier"] ? `Notoriety: ${row["Notoriety Tier"]}` : ""
  ].filter(Boolean).join(" • ");

  if (typeLine) {
    meta.push(typeLine);
  }

  const npcCount = getNpcsForPoi(row.POI_ID).length;

  const populationNpcLine = [
    row.Population ? `Population: ${row.Population}` : "",
    npcCount > 0 ? `${npcCount} NPC${npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  if (populationNpcLine) {
    meta.push(populationNpcLine);
  }

  return joinCodexLabel(
    row.Name || row.POI_ID || "Unnamed POI",
    meta
  );
}

function buildNpcListLabel(row) {
  const meta = [];

  const raceOccupation = [
    row.Race,
    row.Occupation
  ].filter(Boolean).join(" • ");

  if (raceOccupation) {
    meta.push(raceOccupation);
  }

  const home = row.Home_ID_Ref
    ? db?.poisById?.[row.Home_ID_Ref]
    : null;

  const homeLabel = home?.Name || row.Home_ID_Ref;

  if (homeLabel) {
    meta.push(homeLabel);
  }

  return joinCodexLabel(
    row.Name || row.NPC_ID || "Unnamed NPC",
    meta
  );
}

function buildRegionListLabel(row) {
  const summary = getRegionSummary(row.Region_ID);

  return joinCodexLabel(
    row.Region_Name || row.Region_ID || "Unnamed Region",
    [
      `${summary.hexCount} hexes • ${summary.poiCount} POIs • ${summary.npcCount} NPCs`
    ]
  );
}

function buildHexListLabel(row) {
  const counts = getHexCounts(row.Hex_ID);
  const countLine = buildCountLine(counts.poiCount, counts.npcCount);

  return joinCodexLabel(
    `Hex ${row.Hex_ID}`,
    [
      row.Terrain || "Unknown Terrain",
      countLine
    ]
  );
}

function buildSearchResultLabel(result) {
  return joinCodexLabel(
    result.title,
    result.meta || []
  );
}

// ======================
// SORT / FILTER HELPERS
// ======================

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

function renderCodexSelectOptions(options, selectedValue = null) {
  return options.map(option => {
    const value = typeof option === "string" ? option : option.value;
    const label = typeof option === "string" ? option : option.label;

    return `
      <option
        value="${escapeHtml(value)}"
        ${selectedValue === value ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `;
  }).join("");
}

function renderCodexListControls(config) {
  const filters = config.filters || [];

  return `
    <div class="codex-filter-row">
      ${filters.map(filter => `
        <label class="codex-dynamic-filter">
          <select
            id="${escapeHtml(filter.fieldId || `${filter.id}-field`)}"
            class="codex-filter-field-select"
          >
              ${renderCodexSelectOptions(
                filter.fieldOptions || [
                  {
                    value: filter.fieldValue || filter.id,
                    label: filter.label
                  }
                ],
                filter.fieldValue || filter.id
              )}
          </select>

          <select id="${escapeHtml(filter.id)}">
            ${renderCodexSelectOptions(filter.options, filter.selectedValue)}
          </select>
        </label>
      `).join("")}

      <label class="codex-sort-label">
        <span class="codex-sort-topline">
          Sort

          <button
            id="${escapeHtml(config.directionId)}"
            class="codex-sort-direction"
            type="button"
            data-direction="${escapeHtml(config.direction || "asc")}"
          >
            ${config.direction === "desc" ? "↓ DESC" : "↑ ASC"}
          </button>
        </span>

        <select id="${escapeHtml(config.sortId)}">
          ${renderCodexSelectOptions(config.sortOptions, config.selectedSort)}
        </select>
      </label>
    </div>
  `;
}

// ======================
// PAGE RENDERER HELPERS
// ======================

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

function bindCodexListControls(config) {
  config.filters.forEach(filter => {

    document.getElementById(filter.fieldId)?.addEventListener(
      "change",
      function () {
        filter.updateOptions();
        config.render();
      }
    );

    document.getElementById(filter.valueId)?.addEventListener(
      "change",
      config.render
    );

  });

  document.getElementById(config.sortId)?.addEventListener(
    "change",
    config.render
  );

  document.getElementById(config.directionId)?.addEventListener(
    "click",
    function () {
      const current = this.dataset.direction || "asc";
      const next = current === "asc" ? "desc" : "asc";

      this.dataset.direction = next;
      this.textContent = next === "asc" ? "↑ ASC" : "↓ DESC";

      config.render();
    }
  );
}

function readCodexFilterState(config) {
  return config.filters.map(filter => {
    const field =
      document.getElementById(filter.fieldId)?.value ||
      filter.fieldValue;

    const value =
      document.getElementById(filter.id)?.value ||
      filter.selectedValue ||
      "all";

    return {
      field,
      value
    };
  });
}

function readCodexSortState(config) {
  const sortMode =
    document.getElementById(config.sortId)?.value ||
    config.selectedSort;

  const direction =
    document.getElementById(config.directionId)?.dataset?.direction ||
    "asc";

  return {
    sortMode,
    direction
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

function renderPoiListIntoContainer() {
  const listEl = document.getElementById("codex-poi-list");

  const [filterOne, filterTwo] = readCodexFilterState(
      poiCodexListConfig
    );

  const {
      sortMode,
      direction: sortDirection
    } = readCodexSortState(poiCodexListConfig);

  let pois = [...(db?.raw?.pois || [])];

   pois = applyConfiguredFilters(
    pois,
    [filterOne, filterTwo],
    getPoiFilterValue
  );

   const compareFn =
    poiCodexListConfig.sortComparators?.[sortMode] || null;

  pois = applyConfiguredSort(
      pois,
      compareFn,
      sortDirection
    );

  listEl.innerHTML = renderCodexLinkedList(
    pois,
    "No points of interest match these filters.",
    "poi",
    "POI_ID",
    buildPoiListLabel
  );
}

function renderNpcListIntoContainer() {
  const listEl = document.getElementById("codex-npc-list");

  const [filterOne, filterTwo] = readCodexFilterState(
      npcCodexListConfig
    );

  const {
      sortMode,
      direction: sortDirection
    } = readCodexSortState(npcCodexListConfig);

  let npcs = [...(db?.raw?.npcs || [])];

  npcs = applyConfiguredFilters(
    npcs,
    [filterOne, filterTwo],
    getNpcFilterValue
  );

  const compareFn =
    npcCodexListConfig.sortComparators?.[sortMode] || null;
  
  npcs = applyConfiguredSort(
      npcs,
      compareFn,
      sortDirection
    );

  listEl.innerHTML = renderCodexLinkedList(
    npcs,
    "No NPCs match these filters.",
    "npc",
    "NPC_ID",
    buildNpcListLabel
  );
}


const poiCodexListConfig = {
  fieldOptions: [
    { value: "Type", label: "Type" },
    { value: "Notoriety", label: "Notoriety" },
    { value: "Region", label: "Region" }
  ],

  filters: [
    {
      id: "codex-poi-filter-1-value",
      fieldId: "codex-poi-filter-1-field",
      label: "Type",
      fieldValue: "Type",
      selectedValue: "all"
    },
    {
      id: "codex-poi-filter-2-value",
      fieldId: "codex-poi-filter-2-field",
      label: "Notoriety",
      fieldValue: "Notoriety",
      selectedValue: "all"
    }
  ],

  sortId: "codex-poi-sort",
  directionId: "codex-poi-direction",
  selectedSort: "name",

sortOptions: [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
    { value: "notoriety", label: "Notoriety" },
    { value: "population", label: "Population" },
    { value: "npc-count", label: "NPC Count" }
  ],

    sortComparators: {
    name: (a, b) => compareText(a.Name, b.Name),

    type: compareByTextThenName(row => row.POI_Type),

    notoriety: (a, b) => {
      const primary =
        getPoiNotorietyRank(a["Notoriety Tier"]) -
        getPoiNotorietyRank(b["Notoriety Tier"]);

      return primary !== 0
        ? primary
        : compareText(a.Name, b.Name);
    },

    population: compareByNumberThenName(row =>
      Number(String(row.Population || "").replace(/[^\d]/g, "")) || 0
    ),

    "npc-count": compareByNumberThenName(row =>
      getNpcsForPoi(row.POI_ID).length
    )
  },

  bindControls: () => bindCodexListControls({
    filters: [
      {
        fieldId: "codex-poi-filter-1-field",
        valueId: "codex-poi-filter-1-value",
        updateOptions: () => updatePoiFilterValueOptions(
          "codex-poi-filter-1-field",
          "codex-poi-filter-1-value"
        )
      },
      {
        fieldId: "codex-poi-filter-2-field",
        valueId: "codex-poi-filter-2-value",
        updateOptions: () => updatePoiFilterValueOptions(
          "codex-poi-filter-2-field",
          "codex-poi-filter-2-value"
        )
      }
    ],
    sortId: "codex-poi-sort",
    directionId: "codex-poi-direction",
    render: renderPoiListIntoContainer
  })
};

const npcCodexListConfig = {
  fieldOptions: [
    { value: "Race", label: "Race" },
    { value: "Occupation", label: "Occupation" },
    { value: "Organization", label: "Organization" },
    { value: "Home", label: "Home" }
  ],

  filters: [
    {
      id: "codex-npc-filter-1-value",
      fieldId: "codex-npc-filter-1-field",
      label: "Race",
      fieldValue: "Race",
      selectedValue: "all"
    },
    {
      id: "codex-npc-filter-2-value",
      fieldId: "codex-npc-filter-2-field",
      label: "Occupation",
      fieldValue: "Occupation",
      selectedValue: "all"
    }
  ],

  sortId: "codex-npc-sort",
  directionId: "codex-npc-direction",
  selectedSort: "name",

sortOptions: [
    { value: "name", label: "Name" },
    { value: "race", label: "Race" },
    { value: "occupation", label: "Occupation" }
  ],

  sortComparators: {
    name: (a, b) => compareText(a.Name, b.Name),

    race: compareByTextThenName(row => row.Race),

    occupation: compareByTextThenName(row => row.Occupation)
  },
  
  bindControls: () => bindCodexListControls({
    filters: [
      {
        fieldId: "codex-npc-filter-1-field",
        valueId: "codex-npc-filter-1-value",
        updateOptions: () => updateNpcFilterValueOptions(
          "codex-npc-filter-1-field",
          "codex-npc-filter-1-value"
        )
      },
      {
        fieldId: "codex-npc-filter-2-field",
        valueId: "codex-npc-filter-2-value",
        updateOptions: () => updateNpcFilterValueOptions(
          "codex-npc-filter-2-field",
          "codex-npc-filter-2-value"
        )
      }
    ],
    sortId: "codex-npc-sort",
    directionId: "codex-npc-direction",
    render: renderNpcListIntoContainer
  })
};

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

function renderCodexLinkedList(
  rows,
  emptyText,
  type,
  idField,
  getLabel,
  getType = null
) {
  if (!rows.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="codex-list">
      ${rows.map(row => {
        const id = row?.[idField];

        const resolvedType = getType
          ? getType(row)
          : type;

        const label = getLabel(row) || id || "Unnamed Record";

        const parts = String(label).split(" — ");

        const title = parts.shift() || "Unnamed Record";

        const metaLines = parts;

        return `
          <button
            class="codex-section-button codex-record-button"
            type="button"
            onclick="openCodexPage('${escapeJsString(resolvedType)}', '${escapeJsString(id)}')"
          >
            <span class="codex-record-main">
              <span class="codex-record-title">${escapeHtml(title)}</span>

              ${metaLines.map(line => `
                <span class="codex-record-meta">${escapeHtml(line)}</span>
              `).join("")}
            </span>

            <span class="codex-record-arrow">›</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function buildMobilePopupHtml(hexId) {
  const data = db?.hexesById?.[hexId];
  const counts = getHexCounts(hexId);

  const info = [];

  if (counts.poiCount > 0) {
    info.push(`${counts.poiCount} POI${counts.poiCount !== 1 ? "s" : ""}`);
  }

  if (counts.npcCount > 0) {
    info.push(`${counts.npcCount} NPC${counts.npcCount !== 1 ? "s" : ""}`);
  }

  return `
    <strong>${escapeHtml(hexId)}</strong><br>
    ${escapeHtml(data?.Terrain || "Unknown")}

    ${
      info.length
        ? `<br><span>${escapeHtml(info.join(" • "))}</span>`
        : ""
    }

    <br>
    <button
      class="popup-open-details"
      type="button"
      onclick="openCodexPage('hex', '${escapeJsString(hexId)}')"
    >
      Open Details
    </button>
  `;
}

function openCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.add("open");
}

function closeCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.remove("open");
}

window.openPanelForHex = openPanelForHex;
window.openCodex = openCodex;
window.closeCodex = closeCodex;
window.openCodexPage = openCodexPage;
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;
window.openCodexMobileControls = openCodexMobileControls;
window.closeCodexMobileControls = closeCodexMobileControls;

for (let xxx = 300; xxx < 350; xxx++) {
  for (let yyy = 300; yyy < 350; yyy++) {
    const { x, y } = getHexCenter(xxx, yyy);
    const hexId = `${xxx}:${yyy}`;

    const hex = L.polygon(
      makeHex(x, y, hexWidth, hexHeight),
      defaultStyle
    ).addTo(map);

    hex.on("mouseover", function () {
      if (!isTouchDevice && this !== selectedHex) {
        this.setStyle(hoverStyle);
      }
    });

    hex.on("mouseout", function () {
      if (!isTouchDevice && this !== selectedHex) {
        this.setStyle(defaultStyle);
      }
    });

    hex.on("click", function (e) {
      L.DomEvent.stopPropagation(e);

      document.getElementById("codex-button").classList.remove("codex-label-visible");

      selectHex(this);
      selectedHexId = hexId;

    if (isTouchDevice) {
      this.bindPopup(buildMobilePopupHtml(hexId)).openPopup();
    } else {
      renderHexPreview(hexId);
    
      const panelWidth =
        document.getElementById("app-panel").offsetWidth;
    
      if (panelWidth / window.innerWidth > 0.32) {
        panHexIntoInspectorView(hexId);
      }
    }
    });
  }
}

map.on("click", function () {
  closePanel();

  document.getElementById("codex-button").classList.remove("codex-label-visible");

  clearSelectedHex();
});

document.getElementById("mobile-panel-close").addEventListener("click", function () {
  closePanel({
  clearSelection: true,
  centerSelected: true
});
});

map.on("popupclose", function () {
  clearSelectedHex();
});

document.getElementById("codex-button").addEventListener("click", function (event) {
  event.stopPropagation();

  const codexButton = document.getElementById("codex-button");

  map.closePopup();

  if (isTouchDevice && !codexButton.classList.contains("codex-label-visible")) {
    codexButton.classList.add("codex-label-visible");
    return;
  }

  codexButton.classList.remove("codex-label-visible");
  resetMapToAtlasView();
  resetCodexToIndex();
});

document.getElementById("map-reset-button").addEventListener("click", function (event) {
  event.stopPropagation();

  closePanel({ clearSelection: true });
  closeCodex();
  resetMapToAtlasView();
  });

document.getElementById("codex-close").addEventListener("click", function () {
  closeCodex();
});

document.getElementById("codex-back").addEventListener("click", function () {
  if (codexHistory.length <= 1) {
    closeCodex();
    return;
  }

  goBackCodex();
});

document.getElementById("codex-overlay").addEventListener("click", function (event) {
  if (event.target === this) {
    closeCodex();
  }
});

let retroCodexSequence = "";

window.addEventListener("keydown", event => {
  retroCodexSequence += event.key.toLowerCase();

  if (retroCodexSequence.length > 2) {
    retroCodexSequence = retroCodexSequence.slice(-2);
  }

  if (retroCodexSequence === "95") {
    toggleRetroCodexMode();
    retroCodexSequence = "";
  }
});

let codexLongPressTimer = null;
let suppressNextCodexClick = false;

function isMobileCodexLongPressEnabled() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

const codexLongPressButton = document.getElementById("codex-button");

codexLongPressButton.addEventListener("pointerdown", event => {
  if (!isMobileCodexLongPressEnabled()) return;

  codexLongPressTimer = window.setTimeout(() => {
    suppressNextCodexClick = true;
    toggleRetroCodexMode();
  }, 650);
});

codexLongPressButton.addEventListener("pointerup", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("pointercancel", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("pointerleave", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("contextmenu", event => {
  if (!isMobileCodexLongPressEnabled()) return;

  event.preventDefault();
});
