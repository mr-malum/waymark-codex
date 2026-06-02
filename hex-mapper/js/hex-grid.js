// Coordinate and flat-top odd-column topology helpers for the Waymark Codex hex map prototype.

function localHexId(col, row) {
  return `${col}:${row}`;
}

function worldHexId(col, row) {
  return `${WORLD_ORIGIN_X + col}:${WORLD_ORIGIN_Y + row}`;
}

function worldToLocalId(sourceHexId) {
  const parsed = parseHexId(sourceHexId);
  if (!parsed) return null;
  return localHexId(parsed.x - WORLD_ORIGIN_X, parsed.y - WORLD_ORIGIN_Y);
}

function parseHexId(value) {
  const match = String(value || "").trim().match(/^(-?\d+)\s*:\s*(-?\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

const EVEN_Q_NEIGHBORS = {
  // These names correspond to the rendered polygon edge order:
  // 0: lower-right, 1: bottom, 2: lower-left,
  // 3: upper-left, 4: top, 5: upper-right.
  E: [1, 0],
  SE: [0, 1],
  SW: [-1, 0],
  W: [-1, -1],
  NW: [0, -1],
  NE: [1, -1]
};

const ODD_Q_NEIGHBORS = {
  E: [1, 1],
  SE: [0, 1],
  SW: [-1, 1],
  W: [-1, 0],
  NW: [0, -1],
  NE: [1, 0]
};


function getNeighborHex(hex, edgeName) {
  const offsets = hex.col % 2 ? ODD_Q_NEIGHBORS : EVEN_Q_NEIGHBORS;
  const offset = offsets[edgeName];
  if (!offset) return null;
  return state.hexes[localHexId(hex.col + offset[0], hex.row + offset[1])] || null;
}

function getNeighborHexes(hex) {
  return EDGE_NAMES.map(edgeName => getNeighborHex(hex, edgeName)).filter(Boolean);
}
