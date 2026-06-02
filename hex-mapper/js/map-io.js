// JSON/CSV import-export helpers for the Waymark Codex hex map prototype.

function exportDataObject() {
  const regions = ensureDefaultRegions();

  return {
    schemaVersion: 1,
    mapType: "waymark-codex-hex-map",
    grid: {
      cols: GRID_COLS,
      rows: GRID_ROWS,
      coordinateSystem: "x,y",
      orientation: "flat-top",
      offset: "odd-column",
      origin: { x: WORLD_ORIGIN_X, y: WORLD_ORIGIN_Y },
      terrainModel: "baseTerrain + features[]"
    },
    regions,
    hexes: Object.values(state.hexes).map(exportHexRecord),
    pois: state.pois.map(exportPoiRecord),
    regionBorders: state.regionBorders.map(exportRegionBorderRecord),
    roads: state.roads.map(exportSegmentRecord),
    rivers: state.rivers.map(exportSegmentRecord),
    editor: {
      version: 2,
      hexRadius: HEX_RADIUS,
      visualEdgeBleed: state.showEdgeBlend,
      edgeBlendMode: state.edgeBlendMode,
      importedCsvCoordinateOrder: getCsvCoordinateOrder(),
      naturalGenerator: {
        seed: getNaturalSeed(),
        biases: getGeneratorBiases()
      }
    }
  };
}

function getHexWorldCoordinates(hex) {
  const parsed = parseHexId(hex.worldId);
  if (parsed) return parsed;
  return {
    x: WORLD_ORIGIN_X + Number(hex.col || 0),
    y: WORLD_ORIGIN_Y + Number(hex.row || 0)
  };
}

function exportHexRecord(hex) {
  const hydrated = hydrateHexTerrainFields({ ...hex });
  const { x, y } = getHexWorldCoordinates(hydrated);

  return {
    x,
    y,
    baseTerrain: hydrated.baseTerrain,
    features: [...(hydrated.features || [])],
    elevation: getHexElevation(hydrated),
    geographicRegionId: normalizeGeographicRegionId(hydrated.geographicRegionId || hydrated.regionId),
    politicalRegionId: normalizePoliticalRegionId(hydrated.politicalRegionId)
  };
}

function exportPoiRecord(poi) {
  const hex = state.hexes[poi.hexId];
  const coordinates = hex ? getHexWorldCoordinates(hex) : parseHexId(poi.worldHexId);

  return {
    id: poi.id,
    name: poi.name,
    type: poi.type,
    x: coordinates?.x,
    y: coordinates?.y
  };
}

function exportRegionBorderRecord(border) {
  const hex = state.hexes[border.hexId];
  const coordinates = hex ? getHexWorldCoordinates(hex) : parseHexId(border.worldHexId);

  return {
    x: coordinates?.x,
    y: coordinates?.y,
    edge: border.edge,
    regionName: border.regionName,
    color: border.color
  };
}

function exportSegmentRecord(segment) {
  const fromHex = state.hexes[segment.from];
  const toHex = state.hexes[segment.to];
  const from = fromHex ? getHexWorldCoordinates(fromHex) : parseHexId(segment.fromWorld);
  const to = toHex ? getHexWorldCoordinates(toHex) : parseHexId(segment.toWorld);

  return {
    id: segment.id,
    from,
    to
  };
}

function downloadJson() {
  const data = JSON.stringify(exportDataObject(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kadesh-hex-editor-prototype-v2.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function copyJson() {
  const data = JSON.stringify(exportDataObject(), null, 2);
  await navigator.clipboard.writeText(data);
  alert("Prototype JSON copied.");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (value || row.length) {
        row.push(value.trim());
        rows.push(row);
        row = [];
        value = "";
      }
      if (char === "\r" && next === "\n") i++;
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter(currentRow => currentRow.some(cell => cell !== ""))
    .map(currentRow => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = currentRow[index] || "";
      });
      return obj;
    });
}

function getCsvCoordinateOrder() {
  return document.getElementById("csv-coordinate-order")?.value || "xy";
}

function sourceHexToCanonicalWorld(sourceHexId, order) {
  const parsed = parseHexId(sourceHexId);
  if (!parsed) return null;

  if (order === "yx") {
    return {
      x: parsed.y,
      y: parsed.x,
      sourceX: parsed.x,
      sourceY: parsed.y,
      sourceHexId: `${parsed.x}:${parsed.y}`
    };
  }

  return {
    x: parsed.x,
    y: parsed.y,
    sourceX: parsed.x,
    sourceY: parsed.y,
    sourceHexId: `${parsed.x}:${parsed.y}`
  };
}

function importKadeshHexCsvText(text) {
  const rows = parseCSV(text);
  const coordinateOrder = getCsvCoordinateOrder();

  const parsedRows = rows
    .map(row => {
      const sourceHexId = row.Hex_ID || row.hex_id || row.id;
      return { row, canonical: sourceHexToCanonicalWorld(sourceHexId, coordinateOrder) };
    })
    .filter(item => item.canonical);

  if (!parsedRows.length) {
    alert("No valid Hex_ID values found.");
    return;
  }

  const minX = Math.min(...parsedRows.map(item => item.canonical.x));
  const minY = Math.min(...parsedRows.map(item => item.canonical.y));
  const maxX = Math.max(...parsedRows.map(item => item.canonical.x));
  const maxY = Math.max(...parsedRows.map(item => item.canonical.y));

  WORLD_ORIGIN_X = 0;
  WORLD_ORIGIN_Y = 0;
  GRID_COLS = maxX - minX + 1;
  GRID_ROWS = maxY - minY + 1;

  state.hexes = {};
  state.regions = createDefaultRegions();
  state.pois = [];
  state.regionBorders = [];
  state.roads = [];
  state.rivers = [];
  state.selectedHexId = null;

  if (GRID_COLS * GRID_ROWS > 400) {
    state.showTerrainLabels = false;
    state.showCoordLabels = false;
  }
  updateLabelToggleText();

  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const id = localHexId(col, row);
      state.hexes[id] = hydrateHexTerrainFields({
        id,
        worldId: worldHexId(col, row),
        sourceHexId: "",
        col,
        row,
        terrain: "Plains",
        baseTerrain: "plains",
        features: [],
        elevation: getDerivedHexElevation({ baseTerrain: "plains", features: [] }),
        geographicRegionId: DEFAULT_GEOGRAPHIC_REGION_ID,
        politicalRegionId: DEFAULT_POLITICAL_REGION_ID,
        regionId: DEFAULT_REGION_ID
      });
    }
  }

  parsedRows.forEach(({ row, canonical }) => {
    const col = canonical.x - minX;
    const localRow = canonical.y - minY;
    const id = localHexId(col, localRow);
    if (!state.hexes[id]) return;

    state.hexes[id].worldId = `${col}:${localRow}`;
    state.hexes[id].sourceHexId = canonical.sourceHexId;
    const combo = legacyTerrainToCombo(row.Terrain);
    state.hexes[id].baseTerrain = combo.baseTerrain;
    state.hexes[id].features = combo.features;
    state.hexes[id].terrainFeature = combo.features[0] || "none";
    state.hexes[id].terrain = getTerrainDisplayName(combo.baseTerrain, combo.features);
    state.hexes[id].elevation = String(row.Elevation ?? "").trim() !== "" && Number.isFinite(Number(row.Elevation))
      ? Number(row.Elevation)
      : getDerivedHexElevation(state.hexes[id]);
    state.hexes[id].geographicRegionId = normalizeGeographicRegionId(row.Region_ID_Ref);
    state.hexes[id].politicalRegionId = DEFAULT_POLITICAL_REGION_ID;
    state.hexes[id].regionId = state.hexes[id].geographicRegionId;
  });

  state.regions = ensureDefaultRegions(state.regions, state.hexes);
  markTerrainCanvasDirty?.();

  render();

  const modeLabel = coordinateOrder === "yx"
    ? "legacy row:column imported and swapped to future X:Y"
    : "future X:Y / column:row";

  alert(`Imported ${parsedRows.length} hex rows into a ${GRID_COLS}x${GRID_ROWS} grid using ${modeLabel}.`);
}

function getImportGridOrigin(data, hexes) {
  if (data.grid?.origin) {
    return {
      x: Number(data.grid.origin.x) || 0,
      y: Number(data.grid.origin.y) || 0
    };
  }

  if (data.grid?.worldOrigin) {
    return {
      x: Number(data.grid.worldOrigin.x) || 0,
      y: Number(data.grid.worldOrigin.y) || 0
    };
  }

  const coordinates = hexes.map(getImportedHexCoordinates).filter(Boolean);
  if (!coordinates.length) return { x: 0, y: 0 };

  return {
    x: Math.min(...coordinates.map(coord => coord.x)),
    y: Math.min(...coordinates.map(coord => coord.y))
  };
}

function getImportedHexCoordinates(hex) {
  if (Number.isFinite(Number(hex.x)) && Number.isFinite(Number(hex.y))) {
    return { x: Number(hex.x), y: Number(hex.y) };
  }

  const parsedWorld = parseHexId(hex.worldId);
  if (parsedWorld) return parsedWorld;

  if (Number.isFinite(Number(hex.col)) && Number.isFinite(Number(hex.row))) {
    return {
      x: WORLD_ORIGIN_X + Number(hex.col),
      y: WORLD_ORIGIN_Y + Number(hex.row)
    };
  }

  return null;
}

function importHexes(data) {
  const hexes = Array.isArray(data.hexes) ? data.hexes : [];
  const origin = getImportGridOrigin(data, hexes);
  const coordinates = hexes.map(getImportedHexCoordinates).filter(Boolean);

  WORLD_ORIGIN_X = origin.x;
  WORLD_ORIGIN_Y = origin.y;
  GRID_COLS = Number(data.grid?.cols) || (coordinates.length ? Math.max(...coordinates.map(coord => coord.x)) - WORLD_ORIGIN_X + 1 : GRID_COLS);
  GRID_ROWS = Number(data.grid?.rows) || (coordinates.length ? Math.max(...coordinates.map(coord => coord.y)) - WORLD_ORIGIN_Y + 1 : GRID_ROWS);

  state.hexes = {};

  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const id = localHexId(col, row);
      state.hexes[id] = hydrateHexTerrainFields({
        id,
        worldId: worldHexId(col, row),
        col,
        row,
        baseTerrain: "plains",
        features: [],
        elevation: getDerivedHexElevation({ baseTerrain: "plains", features: [] }),
        geographicRegionId: DEFAULT_GEOGRAPHIC_REGION_ID,
        politicalRegionId: DEFAULT_POLITICAL_REGION_ID,
        regionId: DEFAULT_GEOGRAPHIC_REGION_ID
      });
    }
  }

  hexes.forEach(hex => {
    const coordinates = getImportedHexCoordinates(hex);
    if (!coordinates) return;

    const col = coordinates.x - WORLD_ORIGIN_X;
    const row = coordinates.y - WORLD_ORIGIN_Y;
    const id = localHexId(col, row);
    if (!state.hexes[id]) return;

    state.hexes[id] = hydrateHexTerrainFields({
      ...hex,
      id,
      worldId: `${coordinates.x}:${coordinates.y}`,
      col,
      row,
      elevation: String(hex.elevation ?? "").trim() !== "" && Number.isFinite(Number(hex.elevation)) ? Number(hex.elevation) : undefined,
      geographicRegionId: normalizeGeographicRegionId(hex.geographicRegionId || hex.geographic_region_id || hex.regionRef || hex.regionId),
      politicalRegionId: normalizePoliticalRegionId(hex.politicalRegionId || hex.political_region_id),
      regionId: normalizeGeographicRegionId(hex.geographicRegionId || hex.geographic_region_id || hex.regionRef || hex.regionId)
    });
  });
}

function worldCoordinatesToLocalId(coordinates) {
  if (!coordinates) return "";
  const x = Number(coordinates.x);
  const y = Number(coordinates.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  return localHexId(x - WORLD_ORIGIN_X, y - WORLD_ORIGIN_Y);
}

function importPois(pois) {
  return (Array.isArray(pois) ? pois : []).map(poi => {
    const localId = poi.hexId || worldCoordinatesToLocalId(poi);
    return {
      ...poi,
      hexId: localId,
      worldHexId: state.hexes[localId]?.worldId || poi.worldHexId || `${poi.x}:${poi.y}`
    };
  }).filter(poi => state.hexes[poi.hexId]);
}

function importRegionBorders(regionBorders) {
  return (Array.isArray(regionBorders) ? regionBorders : []).map(border => {
    const localId = border.hexId || worldCoordinatesToLocalId(border);
    return {
      ...border,
      key: border.key || `${localId}:${border.edge}`,
      hexId: localId,
      worldHexId: state.hexes[localId]?.worldId || border.worldHexId || `${border.x}:${border.y}`
    };
  }).filter(border => state.hexes[border.hexId]);
}

function importSegments(segments, prefix) {
  return (Array.isArray(segments) ? segments : []).map((segment, index) => {
    const from = segment.from?.x !== undefined ? worldCoordinatesToLocalId(segment.from) : segment.from;
    const to = segment.to?.x !== undefined ? worldCoordinatesToLocalId(segment.to) : segment.to;
    return {
      id: segment.id || `${prefix}_${index + 1}`,
      from,
      to,
      fromWorld: state.hexes[from]?.worldId || segment.fromWorld,
      toWorld: state.hexes[to]?.worldId || segment.toWorld
    };
  }).filter(segment => state.hexes[segment.from] && state.hexes[segment.to]);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (Array.isArray(data.hexes)) {
        importHexes(data);
      }

      state.regions = ensureDefaultRegions(data.regions, state.hexes);
      state.pois = importPois(data.pois);
      state.regionBorders = importRegionBorders(data.regionBorders);
      state.roads = importSegments(data.roads, "road");
      state.rivers = importSegments(data.rivers, "river");
      state.edgeBlendMode = (data.editor?.edgeBlendMode || data.grid?.edgeBlendMode) === "off" ? "off" : "elevation";
      state.showEdgeBlend = state.edgeBlendMode !== "off";
      state.selectedHexId = null;
      state.lastRoadHexId = null;
      state.lastRiverHexId = null;

      updateLabelToggleText();
      markTerrainCanvasDirty?.();
      render();
    } catch {
      alert("Could not import JSON.");
    }
  };
  reader.readAsText(file);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => importKadeshHexCsvText(String(reader.result || ""));
  reader.readAsText(file);
}
