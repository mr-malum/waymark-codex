let db = null;
let databaseLoadError = null;

function refreshOpenCodexAfterDatabaseLoad() {
  const overlay = document.getElementById("codex-overlay");
  const currentPage = codexHistory[codexHistory.length - 1];

  if (!overlay?.classList.contains("open") || !currentPage) {
    return;
  }

  renderCodexPage(currentPage.type, currentPage.id);
  updateCodexBackButton();
}

function initializeDatabaseLoad() {
  loadDatabase()
    .then(loadedDb => {
      if (!loadedDb) return;

      db = loadedDb;
      databaseLoadError = null;

      console.log("Database loaded:", db);
      window.dispatchEvent(new CustomEvent("campaign-database-loaded", { detail: { db } }));
      refreshOpenCodexAfterDatabaseLoad();
    })
    .catch(error => {
      databaseLoadError = error;

      console.error("Database failed to load:", error);
      refreshOpenCodexAfterDatabaseLoad();
    });
}

initializeDatabaseLoad();

window.addEventListener("campaign-authenticated", () => {
  setCampaignMainMapImage(getActiveCampaign?.());
  initializeDatabaseLoad();
});

const GENERATED_MAP_MARGIN = 20;

function isGeneratedMapCampaign(campaign = getActiveCampaign?.()) {
  return campaign?.map_mode === "generated";
}

function getGeneratedMapConfig(campaign = getActiveCampaign?.()) {
  return campaign?.generated_map_config || {};
}

function getGeneratedGridConfig(campaign = getActiveCampaign?.()) {
  return getGeneratedMapConfig(campaign)?.grid || {};
}

function getGeneratedHexRadius(campaign = getActiveCampaign?.()) {
  return Number(getGeneratedMapConfig(campaign)?.editor?.hexRadius) || 42;
}

function getGeneratedMapDimensions(campaign = getActiveCampaign?.()) {
  const grid = getGeneratedGridConfig(campaign);
  const cols = Math.max(1, Number(grid.cols) || 50);
  const rows = Math.max(1, Number(grid.rows) || 50);
  const radius = getGeneratedHexRadius(campaign);
  const hexHeight = Math.sqrt(3) * radius;
  const lastCenterX = GENERATED_MAP_MARGIN + radius + ((cols - 1) * radius * 1.5);
  const lastCenterY = GENERATED_MAP_MARGIN + (hexHeight * 0.5) + ((rows - 1) * hexHeight) + ((cols - 1) % 2 ? hexHeight * 0.5 : 0);
  const width = Math.ceil(lastCenterX + (radius * 2) + 40);
  const height = Math.ceil(lastCenterY + hexHeight + 40);

  return { width, height, cols, rows, radius, hexHeight };
}

function setCampaignMainMapImage(campaign = null) {
  if (isGeneratedMapCampaign(campaign)) {
    window.generatedMapRenderer?.beginLoading?.();
  }
}

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

let selectedHexId = null;
let codexHistory = [];
let codexSearchQuery = "";
let retroCodexMode = false;

function parseMapHexId(hexId) {
  const match = String(hexId || "").trim().match(/^(-?\d+)\s*:\s*(-?\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function getGeneratedHexCenter(x, y, campaign = getActiveCampaign?.()) {
  const dimensions = getGeneratedMapDimensions(campaign);
  const centerX = GENERATED_MAP_MARGIN + dimensions.radius + (x * dimensions.radius * 1.5);
  const mapperY = GENERATED_MAP_MARGIN + (dimensions.hexHeight * 0.5) + (y * dimensions.hexHeight) + (x % 2 ? dimensions.hexHeight * 0.5 : 0);
  const centerY = dimensions.height - mapperY;

  return { x: centerX, y: centerY };
}

function getMapHexCenter(hexId) {
  const parsed = parseMapHexId(hexId);
  if (!parsed) return { x: 0, y: 0 };

  return getGeneratedHexCenter(parsed.x, parsed.y);
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

function formatCodexNumber(value) {
  const cleanValue = String(value ?? "").trim();
  if (!cleanValue) return "";

  const numericValue = Number(cleanValue.replaceAll(",", ""));
  if (!Number.isFinite(numericValue)) return cleanValue;

  return new Intl.NumberFormat("en-US").format(numericValue);
}

function formatCodexPopulation(value) {
  return formatCodexNumber(value);
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

function getDedupedPoiCount(pois) {
  const counted = new Set();

  pois.forEach(poi => {
    const groupId = poi.POI_Group_ID;
    counted.add(groupId ? `group:${groupId}` : `poi:${poi.POI_ID}`);
  });

  return counted.size;
}

function getRegionSummary(regionId) {
  const region = regionId ? db?.regionsById?.[regionId] : null;
  const regionField = region?.Region_Type === "political"
    ? "Political_Region_ID_Ref"
    : "Region_ID_Ref";
  const hexes = getRowsByField(db?.raw?.hexes, regionField, regionId);

  const pois = hexes.flatMap(hex => {
    return getPoisForHex(hex.Hex_ID);
  });

  const npcCount = pois.reduce((total, poi) => {
    return total + getNpcsForPoi(poi.POI_ID).length;
  }, 0);

  return {
    hexCount: hexes.length,
    poiCount: getDedupedPoiCount(pois),
    mappedAreaCount: pois.length,
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
