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

function openCodex() {
  document.getElementById("codex-overlay").classList.add("open");
}

function closeCodex() {
  document.getElementById("codex-overlay").classList.remove("open");
  map.closePopup();
  clearSelectedHex();
}

function setCodexTitle(title) {
  document.getElementById("codex-title").textContent = title;
}

function setCodexContent(html, breadcrumbs = []) {
  const content = document.getElementById("codex-content");

  content.className = "";

  const breadcrumbHtml = breadcrumbs.length
    ? `
      <div id="codex-breadcrumbs">
        ${breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return `
            ${
              crumb.clickable && !isLast
                ? `
                  <button
                    class="codex-breadcrumb-button"
                    type="button"
                    onclick="${crumb.onclick}"
                  >
                    ${escapeHtml(crumb.label)}
                  </button>
                `
                : `
                  <span>${escapeHtml(crumb.label)}</span>
                `
            }

            ${
              !isLast
                ? `<span class="codex-breadcrumb-separator">/</span>`
                : ""
            }
          `;
        }).join("")}
      </div>
    `
    : "";

  content.innerHTML = breadcrumbHtml + html;
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

  map.closePopup();
  closePanel();

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

    <h3>Lore</h3>
    <p>${escapeHtml(poi?.Lore || "No lore recorded.")}</p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(poi?.DM_Journal || "No journal entries.")}</p>

    <h3>NPCs</h3>
    ${renderCodexLinkedList(
      npcs,
      "No known NPCs at this location.",
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
      label: "Points of Interest",
      clickable: true,
      onclick: "openCodexPage('pois')"
    },
    {
      label: poiName
    }
  ]);
}

function renderCodexNpcPage(npcId) {
  const npc = db?.npcsById?.[npcId];
  const home = npc?.Home_ID_Ref ? db?.poisById?.[npc.Home_ID_Ref] : null;
  const npcName = npc?.Name || npcId || "Unknown NPC";

  setCodexTitle(npcName);

  setCodexContent(`
    ${
      npc?.Title
        ? `<p class="codex-superheader">${escapeHtml(npc.Title)}</p>`
        : ""
    }

    <p>
      <strong>Home:</strong>
      ${
        home
          ? `<button class="codex-link-button" type="button" onclick="openCodexPage('poi', '${escapeJsString(home.POI_ID)}')">${escapeHtml(home.Name)}</button>`
          : escapeHtml(npc?.Home_ID_Ref || "Unknown")
      }
    </p>

    <p><strong>Race:</strong> ${escapeHtml(npc?.Race || "Unknown")}</p>
    <p><strong>Faction:</strong> ${escapeHtml(npc?.Faction || "Unknown")}</p>
    <p><strong>Occupation:</strong> ${escapeHtml(npc?.Occupation || "Unknown")}</p>

    <h3>Lore</h3>
    <p>${escapeHtml(npc?.Lore || "No lore recorded.")}</p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(npc?.DM_Journal || "No journal entries.")}</p>
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
  if (field === "Faction") return npc.Faction || "";
  if (field === "Home") return getNpcHomeLabel(npc);

  return "";
}

function getUniqueValues(rows, getValue) {
  return [...new Set(
    rows
      .map(getValue)
      .filter(Boolean)
  )].sort();
}

function getNpcFilterOptions(field) {
  const npcs = db?.raw?.npcs || [];

  return [
    { value: "all", label: "All" },
    ...getUniqueValues(npcs, npc => getNpcFilterValue(npc, field)).map(value => ({
      value,
      label: value
    }))
  ];
}

function updateNpcFilterValueOptions(fieldSelectId, valueSelectId) {
  const field = document.getElementById(fieldSelectId)?.value || "Race";
  const valueSelect = document.getElementById(valueSelectId);

  if (!valueSelect) return;

  valueSelect.innerHTML = renderCodexSelectOptions(
    getNpcFilterOptions(field),
    "all"
  );
}

function renderPoiListIntoContainer() {
  const listEl = document.getElementById("codex-poi-list");
  const typeFilter = document.getElementById("codex-poi-type-filter")?.value || "all";
  const notorietyFilter = document.getElementById("codex-poi-notoriety-filter")?.value || "all";
  const sortMode = document.getElementById("codex-poi-sort")?.value || "name";
  const directionButton = document.getElementById("codex-poi-direction");
  const sortDirection = directionButton?.dataset?.direction || "asc";

  let pois = [...(db?.raw?.pois || [])];

  pois = applyFilters(pois, [
    {
      field: "POI_Type",
      value: typeFilter
    },
    {
      field: "Notoriety Tier",
      value: notorietyFilter
    }
  ]);

  let compareFn = null;

  if (sortMode === "name") {
    compareFn = (a, b) =>
      compareText(a.Name, b.Name);
  }

  if (sortMode === "type") {
    compareFn = (a, b) => {
      const primary = compareText(a.POI_Type, b.POI_Type);

      return primary !== 0
        ? primary
        : compareText(a.Name, b.Name);
    };
  }

  if (sortMode === "population") {
    compareFn = (a, b) => {
      const aPop = Number(String(a.Population || "").replace(/[^\d]/g, "")) || 0;
      const bPop = Number(String(b.Population || "").replace(/[^\d]/g, "")) || 0;

      const primary = aPop - bPop;

      return primary !== 0
        ? primary
        : compareText(a.Name, b.Name);
    };
  }

  if (sortMode === "notoriety") {
    compareFn = (a, b) => {
      const primary =
        getPoiNotorietyRank(a["Notoriety Tier"]) -
        getPoiNotorietyRank(b["Notoriety Tier"]);

      return primary !== 0
        ? primary
        : compareText(a.Name, b.Name);
    };
  }

  if (compareFn) {
    pois = sortRows(pois, compareFn, sortDirection);
  }

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

  const fieldOne = document.getElementById("codex-npc-filter-1-field")?.value || "Race";
  const valueOne = document.getElementById("codex-npc-filter-1-value")?.value || "all";

  const fieldTwo = document.getElementById("codex-npc-filter-2-field")?.value || "Occupation";
  const valueTwo = document.getElementById("codex-npc-filter-2-value")?.value || "all";

  const sortMode = document.getElementById("codex-npc-sort")?.value || "name";
  const directionButton = document.getElementById("codex-npc-direction");
  const sortDirection = directionButton?.dataset?.direction || "asc";

  let npcs = [...(db?.raw?.npcs || [])];

  npcs = applyFilters(npcs, [
    {
      value: valueOne,
      getValue: npc => getNpcFilterValue(npc, fieldOne)
    },
    {
      value: valueTwo,
      getValue: npc => getNpcFilterValue(npc, fieldTwo)
    }
  ]);

  let compareFn = null;

  if (sortMode === "name") {
    compareFn = (a, b) => compareText(a.Name, b.Name);
  }

  if (sortMode === "race") {
    compareFn = (a, b) => {
      const primary = compareText(a.Race, b.Race);
      return primary !== 0 ? primary : compareText(a.Name, b.Name);
    };
  }

  if (sortMode === "occupation") {
    compareFn = (a, b) => {
      const primary = compareText(a.Occupation, b.Occupation);
      return primary !== 0 ? primary : compareText(a.Name, b.Name);
    };
  }

  if (compareFn) {
    npcs = sortRows(npcs, compareFn, sortDirection);
  }

  listEl.innerHTML = renderCodexLinkedList(
    npcs,
    "No NPCs match these filters.",
    "npc",
    "NPC_ID",
    buildNpcListLabel
  );
}

function renderCodexPoisIndex() {
  const pois = db?.raw?.pois || [];

  const poiTypes = [...new Set(
    pois
      .map(poi => poi.POI_Type)
      .filter(Boolean)
  )].sort();

  const poiNotorietyTiers = [...new Set(
    pois
      .map(poi => poi["Notoriety Tier"])
      .filter(Boolean)
  )].sort();

  setCodexTitle("Points of Interest");

  setCodexContent(`
    ${renderCodexListControls({
      filters: [
        {
          id: "codex-poi-type-filter",
          label: "Type",
          fieldValue: "Type",
          fieldOptions: [
            { value: "Type", label: "Type" },
            { value: "Notoriety", label: "Notoriety" }
          ],
          selectedValue: "all",
          options: [
            { value: "all", label: "All" },
            ...poiTypes.map(type => ({
              value: type,
              label: type
            }))
          ]
        },

        {
          id: "codex-poi-notoriety-filter",
          label: "Notoriety",
          fieldValue: "Notoriety",
          fieldOptions: [
            { value: "Type", label: "Type" },
            { value: "Notoriety", label: "Notoriety" }
          ],
          selectedValue: "all",
          options: [
            { value: "all", label: "All" },
            ...poiNotorietyTiers.map(tier => ({
              value: tier,
              label: tier
            }))
          ]
        }
      ],
      sortId: "codex-poi-sort",
      selectedSort: "name",
      sortOptions: [
        { value: "name", label: "Name" },
        { value: "type", label: "Type" },
        { value: "notoriety", label: "Notoriety" },
        { value: "population", label: "Population" }
      ],
      directionId: "codex-poi-direction",
      direction: "asc"
    })}

    <div id="codex-poi-list"></div>
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "Points of Interest"
    }
  ]);

  document.getElementById("codex-poi-type-filter").addEventListener(
    "change",
    renderPoiListIntoContainer
  );

  document.getElementById("codex-poi-notoriety-filter").addEventListener(
    "change",
    renderPoiListIntoContainer
  );

  document.getElementById("codex-poi-sort").addEventListener(
    "change",
    renderPoiListIntoContainer
  );

  document.getElementById("codex-poi-direction").addEventListener(
    "click",
    function () {
      const current = this.dataset.direction || "asc";
      const next = current === "asc" ? "desc" : "asc";

      this.dataset.direction = next;

      this.textContent = next === "asc"
        ? "↑ ASC"
        : "↓ DESC";

      renderPoiListIntoContainer();
    }
  );

  renderPoiListIntoContainer();
}

function renderCodexNpcsIndex() {
  const npcFieldOptions = [
    { value: "Race", label: "Race" },
    { value: "Occupation", label: "Occupation" },
    { value: "Faction", label: "Faction" },
    { value: "Home", label: "Home" }
  ];

  setCodexTitle("NPCs");

  setCodexContent(`
    ${renderCodexListControls({
      filters: [
        {
          id: "codex-npc-filter-1-value",
          fieldId: "codex-npc-filter-1-field",
          label: "Race",
          fieldValue: "Race",
          fieldOptions: npcFieldOptions,
          selectedValue: "all",
          options: getNpcFilterOptions("Race")
        },

        {
          id: "codex-npc-filter-2-value",
          fieldId: "codex-npc-filter-2-field",
          label: "Occupation",
          fieldValue: "Occupation",
          fieldOptions: npcFieldOptions,
          selectedValue: "all",
          options: getNpcFilterOptions("Occupation")
        }
      ],
      sortId: "codex-npc-sort",
      selectedSort: "name",
      sortOptions: [
        { value: "name", label: "Name" },
        { value: "race", label: "Race" },
        { value: "occupation", label: "Occupation" }
      ],
      directionId: "codex-npc-direction",
      direction: "asc"
    })}

    <div id="codex-npc-list"></div>
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "NPCs"
    }
  ]);

  document.getElementById("codex-npc-filter-1-field").addEventListener(
    "change",
    function () {
      updateNpcFilterValueOptions(
        "codex-npc-filter-1-field",
        "codex-npc-filter-1-value"
      );

      renderNpcListIntoContainer();
    }
  );

  document.getElementById("codex-npc-filter-2-field").addEventListener(
    "change",
    function () {
      updateNpcFilterValueOptions(
        "codex-npc-filter-2-field",
        "codex-npc-filter-2-value"
      );

      renderNpcListIntoContainer();
    }
  );

  document.getElementById("codex-npc-filter-1-value").addEventListener(
    "change",
    renderNpcListIntoContainer
  );

  document.getElementById("codex-npc-filter-2-value").addEventListener(
    "change",
    renderNpcListIntoContainer
  );

  document.getElementById("codex-npc-sort").addEventListener(
    "change",
    renderNpcListIntoContainer
  );

  document.getElementById("codex-npc-direction").addEventListener(
    "click",
    function () {
      const current = this.dataset.direction || "asc";
      const next = current === "asc" ? "desc" : "asc";

      this.dataset.direction = next;

      this.textContent = next === "asc"
        ? "↑ ASC"
        : "↓ DESC";

      renderNpcListIntoContainer();
    }
  );

  renderNpcListIntoContainer();
}

function renderCodexSearchPage() {
  setCodexTitle("Search the Codex");

  const content = document.getElementById("codex-content");

  content.className = "codex-search-page";

  content.innerHTML = `
    <div class="codex-search-shell">
      <input
        id="codex-search-input"
        type="search"
        placeholder="Search regions, POIs, NPCs..."
        autocomplete="off"
      />
    </div>

    <div id="codex-search-results">
      <p>Begin typing to search the records of Kadesh.</p>
    </div>
  `;

  const input = document.getElementById("codex-search-input");

  input.addEventListener("input", function () {
    renderCodexSearchResults(input.value);
  });

  input.focus();
}

function renderCodexSearchResults(query) {
  const resultsEl = document.getElementById("codex-search-results");
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    resultsEl.innerHTML = `<p>Begin typing to search the records of Kadesh.</p>`;
    return;
  }

  const results = [];

  (db?.raw?.regions || []).forEach(region => {
    const haystack = [
      region.Region_ID,
      region.Region_Name,
      region.Lore,
      region.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "region",
        id: region.Region_ID,
        label: joinCodexLabel(
          region.Region_Name || region.Region_ID,
          ["Region"]
        )
      });
    }
  });

  (db?.raw?.hexes || []).forEach(hex => {
    const haystack = [
      hex.Hex_ID,
      hex.Terrain,
      hex.Region_ID_Ref,
      hex.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "hex",
        id: hex.Hex_ID,
        label: buildHexListLabel(hex)
      });
    }
  });

  (db?.raw?.pois || []).forEach(poi => {
    const haystack = [
      poi.POI_ID,
      poi.Name,
      poi.POI_Type,
      poi.Hex_ID_Ref,
      poi.Population,
      poi["Notoriety Tier"],
      poi.Lore,
      poi.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "poi",
        id: poi.POI_ID,
        label: buildPoiListLabel(poi)
      });
    }
  });

  (db?.raw?.npcs || []).forEach(npc => {
    const haystack = [
      npc.NPC_ID,
      npc.Name,
      npc.Race,
      npc.Occupation,
      npc.Home_ID_Ref,
      npc.Lore,
      npc.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "npc",
        id: npc.NPC_ID,
        label: buildNpcListLabel(npc)
      });
    }
  });

  if (!results.length) {
    resultsEl.innerHTML = `<p>No matching records found.</p>`;
    return;
  }

  resultsEl.innerHTML = renderCodexLinkedList(
    results,
    "No matching records found.",
    null,
    "id",
    row => row.label,
    row => row.type
  );
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

window.openPanelForHex = openPanelForHex;
window.openCodex = openCodex;
window.closeCodex = closeCodex;
window.openCodexPage = openCodexPage;
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;

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

  resetCodexToIndex();
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
