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