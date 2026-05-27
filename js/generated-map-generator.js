(function () {
  const WATER_BASES = new Set(["deep_sea", "sea", "coastal_water", "inland_water"]);
  const OCEAN_BASES = new Set(["deep_sea", "sea", "coastal_water"]);
  const LAND_STARTERS = ["plains", "plains", "grassland", "grassland", "lush_grassland"];
  const REGION_STYLE_BIASES = {
    balanced: {},
    coastal_realm: {
      water: 1.12,
      coastalEdge: 1.55,
      islands: 1.12,
      inlandWater: 0.45,
      desert: 0.85
    },
    island_chain: {
      water: 1.18,
      islands: 1.75,
      inlandWater: 0.25,
      continuity: 0.85
    },
    mountain_frontier: {
      mountains: 1.72,
      forest: 0.78,
      desert: 0.48,
      water: 0.76,
      wetness: 0.82,
      heat: 1.04,
      continuity: 1.12
    },
    wetlands_lakes: {
      wetness: 1.45,
      forest: 1.12,
      inlandWater: 1.85,
      water: 0.92,
      desert: 0.35,
      mountains: 0.72
    },
    dry_expanse: {
      heat: 1.22,
      wetness: 0.48,
      forest: 0.42,
      desert: 1.75,
      inlandWater: 0.28,
      mountains: 0.9
    },
    frozen_north: {
      heat: 0.28,
      wetness: 0.72,
      forest: 0.42,
      desert: 0.18,
      mountains: 1.45,
      inlandWater: 0.62
    },
    tropical_basin: {
      heat: 1.42,
      wetness: 1.55,
      forest: 1.5,
      desert: 0.22,
      mountains: 0.72,
      inlandWater: 1.15
    },
    volcanic_arc: {
      heat: 1.12,
      water: 1.12,
      islands: 1.42,
      mountains: 1.82,
      forest: 0.72,
      desert: 1.12,
      inlandWater: 0.28
    }
  };
  const REGION_STYLE_NUDGES = {
    coastal_realm: { water: 0.08, coastalEdge: 0.82, islands: 0.04 },
    island_chain: { water: 0.2, islands: 1.28 },
    mountain_frontier: { mountains: 0.28, compression: 0.08 },
    wetlands_lakes: { wetness: 0.16, inlandWater: 0.34 },
    dry_expanse: { heat: 0.12, desert: 0.28 },
    frozen_north: { mountains: 0.18 },
    tropical_basin: { heat: 0.12, wetness: 0.22, forest: 0.24 },
    volcanic_arc: { water: 0.18, islands: 0.82, mountains: 0.34 }
  };
  const REGION_STYLE_STARTERS = {
    mountain_frontier: ["grassland", "grassland", "plains", "plains", "barrens"],
    wetlands_lakes: ["lush_grassland", "wetland", "grassland", "plains"],
    dry_expanse: ["barrens", "desert", "plains", "bleak_barrens"],
    frozen_north: ["snow", "snow", "rock", "grassland", "barrens"],
    tropical_basin: ["lush_grassland", "jungle_floor", "grassland", "wetland"],
    volcanic_arc: ["rock", "barrens", "grassland", "wastes"]
  };
  const EVEN_Q_NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ODD_Q_NEIGHBORS = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];
  const TERRAIN_PROFILES = {
    deep_sea: { climate: 0, moisture: 3, elevation: -3, group: "water" },
    sea: { climate: 0, moisture: 3, elevation: -2, group: "water" },
    coastal_water: { climate: 0, moisture: 3, elevation: -1, group: "coast" },
    inland_water: { climate: 0, moisture: 3, elevation: 0, group: "freshwater" },
    beach: { climate: 0, moisture: 1, elevation: 0, group: "coast" },
    plains: { climate: 0, moisture: 0, elevation: 1, group: "fertile" },
    grassland: { climate: 0, moisture: 0, elevation: 1, group: "fertile" },
    lush_grassland: { climate: 1, moisture: 1, elevation: 1, group: "fertile" },
    wetland: { climate: 1, moisture: 2, elevation: 0, group: "wet" },
    jungle_floor: { climate: 2, moisture: 2, elevation: 1, group: "tropical" },
    desert: { climate: 1, moisture: -1, elevation: 1, group: "arid" },
    deep_desert: { climate: 1, moisture: -2, elevation: 1, group: "arid" },
    barrens: { climate: 0, moisture: -1, elevation: 1, group: "dry" },
    bleak_barrens: { climate: -1, moisture: -1, elevation: 2, group: "dry" },
    snow: { climate: -2, moisture: -1, elevation: 2, group: "cold" },
    rock: { climate: -1, moisture: -1, elevation: 3, group: "highland" },
    wastes: { climate: 0, moisture: -2, elevation: 2, group: "waste" }
  };

  function hashNumber(text) {
    let hash = 2166136261;
    for (let index = 0; index < String(text).length; index += 1) {
      hash ^= String(text).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeRandom(seedText) {
    let state = hashNumber(seedText) || 1;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeRegionStyle(style) {
    return REGION_STYLE_BIASES[style] ? style : "balanced";
  }

  function normalizeOptions(options = {}) {
    const settings = {
      seed: String(options.seed || "campaign-codex"),
      regionStyle: normalizeRegionStyle(options.regionStyle),
      water: clamp(options.water, 0, 2, 1),
      coastalEdge: clamp(options.coastalEdge, 0, 2, 0),
      islands: clamp(options.islands, 0, 2, 0),
      inlandWater: 1,
      wetness: clamp(options.wetness, 0, 2, 1),
      heat: clamp(options.heat, 0, 2, 1),
      forest: clamp(options.forest, 0, 2, 1),
      desert: clamp(options.desert, 0, 2, 1),
      mountains: clamp(options.mountains, 0, 2, 1),
      compression: clamp(options.compression, 0, 2, 1),
      continuity: clamp(options.continuity, 0, 2, 1),
      featureDensity: clamp(options.featureDensity, 0.5, 1.65, 1),
      maxFeatures: Math.round(clamp(options.maxFeatures, 0, 2, 2))
    };
    return applyRegionStyleBias(settings);
  }

  function applyRegionStyleBias(settings) {
    const bias = REGION_STYLE_BIASES[settings.regionStyle] || {};
    Object.entries(bias).forEach(([key, multiplier]) => {
      if (typeof settings[key] !== "number") return;
      settings[key] = clamp(settings[key] * multiplier, 0, 2, settings[key]);
    });
    Object.entries(REGION_STYLE_NUDGES[settings.regionStyle] || {}).forEach(([key, amount]) => {
      if (typeof settings[key] !== "number") return;
      settings[key] = clamp(settings[key] + amount * Math.max(0, 1 - settings[key] / 2), 0, 2, settings[key]);
    });
    return settings;
  }

  function generateNaturalTerrain(options = {}) {
    const settings = normalizeOptions(options);
    const random = makeRandom(settings.seed);
    const rules = options.terrainRules || window.CampaignTerrainRules || {};
    const hexes = cloneHexes(options.hexes || []);
    const byCoord = new Map(hexes.map(hex => [`${hex.x}:${hex.y}`, hex]));
    const byId = new Map(hexes.map(hex => [hex.id, hex]));
    const dimensions = getDimensions(hexes);
    const context = makeRuleContext(byId, byCoord);
    const helpers = { random, rules, byCoord, dimensions, settings };

    if (!hexes.length) return [];

    hexes.forEach(hex => {
      hex.baseTerrain = chooseStarterTerrain(settings, random);
      hex.features = [];
      hex.elevation = rules.getAutoElevation?.(hex.baseTerrain, []) ?? TERRAIN_PROFILES[hex.baseTerrain]?.elevation ?? 1;
    });

    growMajorTerrain(hexes, helpers);
    smoothBaseTerrains(hexes, helpers);
    applyCoastlineCleanup(hexes, helpers);
    applyCoastlineCleanup(hexes, helpers);
    smoothBaseTerrains(hexes, helpers, Math.max(0, Math.round(settings.continuity)));
    carveIslandChannels(hexes, helpers);
    applyBadAdjacencyCleanup(hexes, helpers);
    applyCoastlineCleanup(hexes, helpers);
    const finalCoastalOceanIds = applyFinalCoastalRealmEdge(hexes, helpers);
    pruneStrayCoastalRealmOcean(hexes, helpers, finalCoastalOceanIds);
    applyCoastlineCleanup(hexes, helpers);
    assignFeaturesAndElevations(hexes, { settings, rules, context });

    return hexes.map(hex => ({
      hexId: hex.id,
      baseTerrain: hex.baseTerrain,
      features: hex.features || [],
      elevation: hex.elevation
    }));
  }

  function cloneHexes(hexes) {
    return (hexes || [])
      .map(hex => ({
        id: hex.id,
        x: Number(hex.x),
        y: Number(hex.y),
        baseTerrain: hex.baseTerrain || "plains",
        features: Array.isArray(hex.features) ? [...hex.features] : [],
        elevation: Number.isFinite(Number(hex.elevation)) ? Number(hex.elevation) : 1
      }))
      .filter(hex => hex.id && Number.isFinite(hex.x) && Number.isFinite(hex.y));
  }

  function getDimensions(hexes) {
    return {
      minX: Math.min(...hexes.map(hex => hex.x)),
      maxX: Math.max(...hexes.map(hex => hex.x)),
      minY: Math.min(...hexes.map(hex => hex.y)),
      maxY: Math.max(...hexes.map(hex => hex.y))
    };
  }

  function chooseStarterTerrain(settings, random) {
    const starters = REGION_STYLE_STARTERS[settings.regionStyle];
    if (starters?.length && random() < (settings.regionStyle === "frozen_north" ? 0.78 : 0.58)) return pick(starters, random);
    if (settings.wetness > 1.35 && random() < 0.18) return "lush_grassland";
    if (settings.heat > 1.35 && settings.wetness < 0.85 && random() < 0.22) return "plains";
    return pick(LAND_STARTERS, random) || "plains";
  }

  function growMajorTerrain(hexes, helpers) {
    const { random, settings, dimensions } = helpers;
    const compressionCount = 0.65 + settings.compression * 0.7;
    const compressionSize = 1.25 - settings.compression * 0.35;
    const area = hexes.length;
    const borderHexes = hexes.filter(hex => isBorderHex(hex, dimensions));

    applyIslandStart(hexes, helpers);
    applyCoastalEdge(hexes, helpers);

    repeatCount(area, 380, settings.water * compressionCount, 1).forEach(() => {
      growBlob(pick(borderHexes, random), Math.round(area * randomBetween(random, 0.025, 0.055) * settings.water * compressionSize), "coastal_water", helpers);
    });

    const inlandWaterScale = settings.water * settings.inlandWater * Math.max(0, 1 - settings.islands * 0.7);
    repeatCount(area, 620, inlandWaterScale * compressionCount, 0).forEach(() => {
      const inlandSeeds = hexes.filter(hex => !isBorderHex(hex, dimensions) && !neighbors(hex, helpers.byCoord).some(neighbor => OCEAN_BASES.has(neighbor.baseTerrain)));
      growBlob(pick(inlandSeeds.length ? inlandSeeds : hexes, random), Math.round(area * randomBetween(random, 0.006, 0.014) * inlandWaterScale * compressionSize), "inland_water", helpers);
    });

    repeatCount(area, 470, settings.forest * settings.wetness * compressionCount, 1).forEach(() => {
      const type = settings.heat > 1.2 && settings.wetness > 0.9 && random() < 0.35 ? "jungle_floor" : random() < 0.22 * settings.wetness ? "wetland" : "lush_grassland";
      growTerrainRegion(pickTerrainSeed(hexes, random, settings), Math.round(area * randomBetween(random, 0.018, 0.04) * settings.forest * compressionSize), type, helpers);
    });

    repeatCount(area, 720, settings.desert * compressionCount, settings.desert > 0 ? 1 : 0).forEach(() => {
      const dryTypes = settings.heat > 1.1
        ? ["desert", "deep_desert", "barrens", "bleak_barrens", "wastes"]
        : ["barrens", "bleak_barrens", "wastes", "desert"];
      growTerrainRegion(pickTerrainSeed(hexes, random, settings), Math.round(area * randomBetween(random, 0.016, 0.038) * settings.desert * compressionSize), pick(dryTypes, random), helpers);
    });

    repeatCount(area, settings.regionStyle === "mountain_frontier" ? 340 : 420, settings.mountains * compressionCount, settings.mountains > 0 ? 1 : 0).forEach(() => {
      growTerrainChain(pickTerrainSeed(hexes, random, settings), Math.round(randomBetween(random, 10, settings.regionStyle === "mountain_frontier" ? 28 : 20) * Math.max(0.35, settings.mountains) * compressionSize), "rock", helpers);
    });

    const coldStyleScale = settings.regionStyle === "frozen_north" ? 1.25 : settings.regionStyle === "mountain_frontier" ? 0.42 : 1;
    const coldScale = Math.max(0, (1.75 - settings.heat) * (0.65 + settings.mountains * 0.65) * coldStyleScale);
    repeatCount(area, 700, coldScale * compressionCount, coldScale > 0.25 ? 1 : 0).forEach(() => {
      const highlandSeeds = hexes.filter(hex => hex.baseTerrain === "rock");
      growTerrainRegion(
        pick(highlandSeeds.length ? highlandSeeds : hexes.filter(hex => isLandBase(hex.baseTerrain)), random),
        Math.round(area * randomBetween(random, 0.010, 0.026) * Math.max(0.7, coldScale) * compressionSize),
        "snow",
        helpers
      );
    });
  }

  function repeatCount(area, divisor, scale, min) {
    return Array.from({ length: Math.max(min, Math.round((area / divisor) * Math.max(0, scale))) });
  }

  function randomBetween(random, min, max) {
    return min + random() * (max - min);
  }

  function applyIslandStart(hexes, helpers) {
    const { random, settings } = helpers;
    if (settings.islands <= 0 || !hexes.length) return;

    const area = hexes.length;
    const oceanChance = Math.min(0.88, settings.islands * 0.38);
    const oceanFirstThreshold = settings.regionStyle === "island_chain"
      ? 0.75
      : settings.regionStyle === "volcanic_arc"
        ? 0.95
        : 1.55;
    hexes.forEach(hex => {
      if (settings.islands >= oceanFirstThreshold || random() < oceanChance) {
        hex.baseTerrain = "sea";
      }
    });

    const chainBias = settings.regionStyle === "island_chain" ? 1 : settings.regionStyle === "volcanic_arc" ? 0.55 : 0;
    const islandScale = settings.islands * (0.85 + settings.compression * 0.62) * (1 + chainBias * 0.18);
    const landSizeScale = (1.14 - Math.min(0.42, settings.islands * 0.18)) * (1 - chainBias * 0.32);
    repeatCount(area, chainBias ? 180 : 220, islandScale, 1).forEach(() => {
      growBlob(
        pick(hexes, random),
        Math.round(area * randomBetween(random, chainBias ? 0.014 : 0.022, chainBias ? 0.042 : 0.062) * landSizeScale),
        chooseIslandLandTerrain(settings, random),
        helpers
      );
    });
  }

  function chooseIslandLandTerrain(settings, random) {
    if (settings.heat > 1.35 && settings.wetness < 0.8 && random() < 0.42) return "barrens";
    if (settings.heat > 1.25 && settings.wetness > 1.15 && random() < 0.38) return "jungle_floor";
    if (settings.wetness > 1.25 && random() < 0.36) return "lush_grassland";
    if (settings.heat < 0.72 && random() < 0.26) return "snow";
    return chooseStarterTerrain(settings, random);
  }

  function pickTerrainSeed(hexes, random, settings) {
    if (settings.islands < 0.65) return pick(hexes, random);
    const landHexes = hexes.filter(hex => isLandBase(hex.baseTerrain));
    return pick(landHexes.length ? landHexes : hexes, random);
  }

  function growTerrainRegion(seedHex, size, baseTerrain, helpers) {
    if (helpers.settings.islands < 0.65) {
      growBlob(seedHex, size, baseTerrain, helpers);
      return;
    }
    growBlob(seedHex, size, baseTerrain, helpers, isLandBase);
  }

  function growTerrainChain(seedHex, length, baseTerrain, helpers) {
    if (helpers.settings.islands < 0.65) {
      growChain(seedHex, length, baseTerrain, helpers);
      return;
    }
    growChain(seedHex, length, baseTerrain, helpers, isLandBase);
  }

  function pick(items, random) {
    return items[Math.floor(random() * items.length)] || items[0] || null;
  }

  function isBorderHex(hex, dimensions) {
    return hex.x === dimensions.minX || hex.x === dimensions.maxX || hex.y === dimensions.minY || hex.y === dimensions.maxY;
  }

  function applyCoastalEdge(hexes, helpers) {
    const { random, settings, dimensions } = helpers;
    if (settings.coastalEdge <= 0) return;

    const edges = ["north", "south", "west", "east"];
    const corners = ["northwest", "northeast", "southwest", "southeast"];
    const cornerThreshold = settings.regionStyle === "coastal_realm" ? 0.7 : 1.15;
    const cornerChance = settings.regionStyle === "coastal_realm" ? 0.62 : 0.48;
    const mode = settings.coastalEdge > cornerThreshold && random() < cornerChance ? "corner" : "edge";
    const target = mode === "corner" ? pick(corners, random) : pick(edges, random);
    const edgeDepth = Math.max(1, Math.round(1 + settings.coastalEdge * 4));
    const cornerDepth = Math.max(2, Math.round(2 + settings.coastalEdge * 5));

    hexes.forEach(hex => {
      const distance = mode === "corner"
        ? Math.min(distanceToCoastalRealmCorner(hex, target, dimensions), distanceToCoastalRealmCornerWrap(hex, target, dimensions))
        : distanceToEdge(hex, target, dimensions);
      const depth = mode === "corner" ? cornerDepth : edgeDepth;
      const ragged = hashNumber(`${settings.seed}:coastal-edge:${target}:${hex.id}`) % 3;
      if (distance <= Math.max(1, depth - ragged)) {
        hex.baseTerrain = "coastal_water";
      }
    });
  }

  function applyFinalCoastalRealmEdge(hexes, helpers) {
    const { settings, dimensions } = helpers;
    const coastalOceanIds = new Set();
    if (settings.regionStyle !== "coastal_realm") return coastalOceanIds;

    const edges = ["north", "south", "west", "east"];
    const corners = ["northwest", "northeast", "southwest", "southeast"];
    const mode = hashNumber(`${settings.seed}:coastal-realm-final-mode`) % 10 < 4 ? "corner" : "edge";
    const targetOptions = mode === "corner" ? corners : edges;
    const target = targetOptions[hashNumber(`${settings.seed}:coastal-realm-final-target`) % targetOptions.length];
    const strength = Math.max(0.9, settings.coastalEdge);
    const edgeDepth = Math.max(6, Math.round(4 + strength * 5));
    const cornerDepth = Math.max(14, Math.round(10 + strength * 11));

    hexes.forEach(hex => {
      const distance = mode === "corner"
        ? distanceToCorner(hex, target, dimensions)
        : distanceToEdge(hex, target, dimensions);
      const depth = mode === "corner" ? cornerDepth : edgeDepth;
      const ragged = hashNumber(`${settings.seed}:coastal-realm-final:${target}:${hex.id}`) % 4;
      if (distance <= Math.max(2, depth - ragged)) {
        hex.baseTerrain = "sea";
        hex.features = [];
        coastalOceanIds.add(hex.id);
      }
    });
    return coastalOceanIds;
  }

  function pruneStrayCoastalRealmOcean(hexes, helpers, coastalOceanIds) {
    const { settings, byCoord } = helpers;
    if (settings.regionStyle !== "coastal_realm" || !coastalOceanIds?.size) return;

    const allowedOceanIds = new Set(coastalOceanIds);
    const frontier = [...coastalOceanIds]
      .map(id => hexes.find(hex => hex.id === id))
      .filter(Boolean);
    while (frontier.length) {
      const current = frontier.shift();
      neighbors(current, byCoord).forEach(neighbor => {
        if (allowedOceanIds.has(neighbor.id) || !OCEAN_BASES.has(neighbor.baseTerrain)) return;
        allowedOceanIds.add(neighbor.id);
        frontier.push(neighbor);
      });
    }

    hexes.forEach(hex => {
      if (!OCEAN_BASES.has(hex.baseTerrain) || allowedOceanIds.has(hex.id)) return;
      hex.baseTerrain = chooseCoastalRealmLandfill(hex, helpers);
      hex.features = [];
    });
  }

  function chooseCoastalRealmLandfill(hex, helpers) {
    const roll = hashNumber(`${helpers.settings.seed}:coastal-realm-landfill:${hex.id}`) % 100;
    if (roll < 42) return "grassland";
    if (roll < 72) return "plains";
    if (roll < 88) return "lush_grassland";
    return "beach";
  }

  function distanceToCoastalRealmCorner(hex, corner, dimensions) {
    const xDistance = corner.includes("west") ? hex.x - dimensions.minX : dimensions.maxX - hex.x;
    const yDistance = corner.includes("north") ? hex.y - dimensions.minY : dimensions.maxY - hex.y;
    return Math.min(xDistance, yDistance) + Math.floor(Math.max(xDistance, yDistance) * 0.24);
  }

  function distanceToCoastalRealmCornerWrap(hex, corner, dimensions) {
    const xDistance = corner.includes("west") ? hex.x - dimensions.minX : dimensions.maxX - hex.x;
    const yDistance = corner.includes("north") ? hex.y - dimensions.minY : dimensions.maxY - hex.y;
    const width = dimensions.maxX - dimensions.minX + 1;
    const height = dimensions.maxY - dimensions.minY + 1;
    const horizontalReach = Math.floor(width * 0.28);
    const verticalReach = Math.floor(height * 0.28);
    const alongTopOrBottom = yDistance + (xDistance <= horizontalReach ? 0 : Math.floor((xDistance - horizontalReach) * 0.9));
    const alongLeftOrRight = xDistance + (yDistance <= verticalReach ? 0 : Math.floor((yDistance - verticalReach) * 0.9));
    return Math.min(alongTopOrBottom, alongLeftOrRight);
  }

  function distanceToEdge(hex, edge, dimensions) {
    if (edge === "north") return hex.y - dimensions.minY;
    if (edge === "south") return dimensions.maxY - hex.y;
    if (edge === "west") return hex.x - dimensions.minX;
    return dimensions.maxX - hex.x;
  }

  function distanceToCorner(hex, corner, dimensions) {
    const xDistance = corner.includes("west") ? hex.x - dimensions.minX : dimensions.maxX - hex.x;
    const yDistance = corner.includes("north") ? hex.y - dimensions.minY : dimensions.maxY - hex.y;
    return xDistance + yDistance;
  }

  function growBlob(seedHex, size, baseTerrain, helpers, canPaint = null) {
    if (!seedHex || size <= 0 || canPaint && !canPaint(seedHex.baseTerrain)) return;
    const { random, byCoord } = helpers;
    const frontier = [seedHex];
    const visited = new Set([seedHex.id]);
    let placed = 0;

    while (frontier.length && placed < size) {
      const current = frontier.splice(Math.floor(random() * frontier.length), 1)[0];
      if (!current) continue;
      if (canPaint && !canPaint(current.baseTerrain)) continue;
      current.baseTerrain = baseTerrain;
      placed += 1;
      shuffle(neighbors(current, byCoord), random).forEach(neighbor => {
        if (visited.has(neighbor.id) || random() >= 0.88 || canPaint && !canPaint(neighbor.baseTerrain)) return;
        visited.add(neighbor.id);
        frontier.push(neighbor);
      });
    }
  }

  function growChain(seedHex, length, baseTerrain, helpers, canPaint = null) {
    if (!seedHex || canPaint && !canPaint(seedHex.baseTerrain)) return;
    const { random, byCoord } = helpers;
    let current = seedHex;
    let previous = null;
    let direction = Math.floor(random() * 6);

    for (let index = 0; index < length && current; index += 1) {
      if (!canPaint || canPaint(current.baseTerrain)) current.baseTerrain = baseTerrain;
      const ordered = neighborSlots(current, byCoord);
      const candidates = ordered.filter(hex => hex && (!previous || hex.id !== previous.id) && (!canPaint || canPaint(hex.baseTerrain)));
      if (!candidates.length) break;

      if (random() < 0.34) direction = (direction + pick([-1, 0, 1], random) + 6) % 6;
      const preferred = [direction, (direction + 1) % 6, (direction + 5) % 6]
        .map(slot => ordered[slot])
        .filter(hex => hex && (!previous || hex.id !== previous.id));
      const next = preferred.length && random() < 0.72 ? pick(preferred, random) : pick(candidates, random);
      previous = current;
      current = next;

      neighbors(previous, byCoord).forEach(neighbor => {
        if (random() < 0.11 && (!canPaint || canPaint(neighbor.baseTerrain)) && ["plains", "grassland", "lush_grassland", "barrens", "desert"].includes(neighbor.baseTerrain)) {
          neighbor.baseTerrain = "rock";
        }
      });
    }
  }

  function shuffle(items, random) {
    return [...items].sort(() => random() - 0.5);
  }

  function neighborSlots(hex, byCoord) {
    return (hex.x % 2 ? ODD_Q_NEIGHBORS : EVEN_Q_NEIGHBORS)
      .map(([dx, dy]) => byCoord.get(`${hex.x + dx}:${hex.y + dy}`) || null);
  }

  function neighbors(hex, byCoord) {
    return neighborSlots(hex, byCoord).filter(Boolean);
  }

  function smoothBaseTerrains(hexes, helpers, extraPasses = 0) {
    const passes = Math.max(0, 1 + Math.round(helpers.settings.continuity) + extraPasses);
    for (let pass = 0; pass < passes; pass += 1) {
      const updates = [];
      hexes.forEach(hex => {
        const counts = {};
        neighbors(hex, helpers.byCoord).forEach(neighbor => {
          counts[neighbor.baseTerrain] = (counts[neighbor.baseTerrain] || 0) + 1;
        });
        const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (!winner) return;
        const [baseTerrain, count] = winner;
        const threshold = helpers.settings.continuity > 1 ? 3 : 4;
        if (helpers.settings.islands >= 0.85 && isWaterBase(hex.baseTerrain) && isLandBase(baseTerrain)) return;
        if (count >= threshold && helpers.random() < 0.62 + helpers.settings.continuity * 0.12) updates.push([hex, baseTerrain]);
      });
      updates.forEach(([hex, baseTerrain]) => {
        hex.baseTerrain = baseTerrain;
      });
    }
  }

  function isWaterBase(baseTerrain) {
    return WATER_BASES.has(baseTerrain);
  }

  function isOpenOceanBase(baseTerrain) {
    return baseTerrain === "sea" || baseTerrain === "deep_sea";
  }

  function isLandBase(baseTerrain) {
    return !isWaterBase(baseTerrain);
  }

  function carveIslandChannels(hexes, helpers) {
    const { random, settings, byCoord } = helpers;
    if (settings.islands < 0.85) return;

    const landComponents = getLandComponents(hexes, byCoord);
    const targetMaxLandmass = Math.max(10, Math.round(hexes.length * (settings.regionStyle === "island_chain" ? 0.05 : 0.09)));
    landComponents
      .filter(component => component.length > targetMaxLandmass)
      .forEach(component => {
        const cuts = Math.min(5, Math.max(1, Math.round(component.length / targetMaxLandmass) - 1));
        for (let index = 0; index < cuts; index += 1) {
          carveWaterChannel(component, helpers);
        }
      });
  }

  function getLandComponents(hexes, byCoord) {
    const seen = new Set();
    const components = [];
    hexes.forEach(hex => {
      if (seen.has(hex.id) || !isLandBase(hex.baseTerrain)) return;
      const component = [];
      const frontier = [hex];
      seen.add(hex.id);
      while (frontier.length) {
        const current = frontier.shift();
        component.push(current);
        neighbors(current, byCoord).forEach(neighbor => {
          if (seen.has(neighbor.id) || !isLandBase(neighbor.baseTerrain)) return;
          seen.add(neighbor.id);
          frontier.push(neighbor);
        });
      }
      components.push(component);
    });
    return components.sort((a, b) => b.length - a.length);
  }

  function carveWaterChannel(component, helpers) {
    const { random, byCoord, settings } = helpers;
    const componentIds = new Set(component.map(hex => hex.id));
    const shoreHexes = component.filter(hex => neighbors(hex, byCoord).some(neighbor => isWaterBase(neighbor.baseTerrain)));
    let current = pick(shoreHexes.length ? shoreHexes : component, random);
    if (!current) return;
    let previous = null;
    const length = Math.round(randomBetween(random, 6, 14) * Math.max(0.7, settings.islands));
    const widthChance = settings.regionStyle === "island_chain" ? 0.52 : 0.34;

    for (let step = 0; step < length && current; step += 1) {
      current.baseTerrain = "sea";
      neighbors(current, byCoord).forEach(neighbor => {
        if (componentIds.has(neighbor.id) && random() < widthChance) neighbor.baseTerrain = "sea";
      });

      const candidates = neighbors(current, byCoord)
        .filter(neighbor => componentIds.has(neighbor.id) && neighbor.id !== previous?.id && isLandBase(neighbor.baseTerrain));
      previous = current;
      current = pick(candidates, random);
    }
  }

  function applyCoastlineCleanup(hexes, helpers) {
    const updates = [];
    hexes.forEach(hex => {
      const adjacent = neighbors(hex, helpers.byCoord);
      const touchesWater = adjacent.some(neighbor => isWaterBase(neighbor.baseTerrain));
      const touchesLand = adjacent.some(neighbor => isLandBase(neighbor.baseTerrain));
      if (OCEAN_BASES.has(hex.baseTerrain) && touchesLand) {
        updates.push([hex, "coastal_water"]);
        return;
      }
      if (hex.baseTerrain === "beach" && touchesWater && shouldAvoidSandyCoast(helpers.settings) && helpers.random() < 0.88) {
        updates.push([hex, chooseCoastalLandTransition(hex, helpers)]);
        return;
      }
      if (!isWaterBase(hex.baseTerrain) && hex.baseTerrain !== "beach" && touchesWater && helpers.random() < 0.72) {
        updates.push([hex, chooseCoastalLandTransition(hex, helpers)]);
        return;
      }
      if (hex.baseTerrain === "beach" && !adjacent.some(neighbor => isWaterBase(neighbor.baseTerrain))) {
        updates.push([hex, helpers.random() < 0.65 ? "plains" : "grassland"]);
      }
    });
    updates.forEach(([hex, baseTerrain]) => {
      hex.baseTerrain = baseTerrain;
    });
    normalizeOceanDepths(hexes, helpers);
  }

  function shouldAvoidSandyCoast(settings) {
    return ["dry_expanse", "frozen_north", "mountain_frontier", "volcanic_arc", "wetlands_lakes"].includes(settings.regionStyle) ||
      settings.heat < 0.72 ||
      settings.wetness > 1.45;
  }

  function chooseCoastalLandTransition(hex, helpers) {
    const { random, settings } = helpers;
    if (settings.regionStyle === "wetlands_lakes") {
      if (random() < 0.46) return "wetland";
      if (random() < 0.72) return "lush_grassland";
      return settings.heat < 0.75 ? "grassland" : "beach";
    }
    if (settings.regionStyle === "frozen_north" || settings.heat < 0.48) {
      if (random() < 0.52) return "snow";
      if (random() < 0.82) return "rock";
      return "grassland";
    }
    if (settings.heat < 0.72) {
      if (random() < 0.48) return "rock";
      if (random() < 0.72) return "grassland";
      return "beach";
    }
    if (settings.regionStyle === "mountain_frontier") {
      if (random() < 0.58) return "rock";
      if (random() < 0.78) return "grassland";
      return "beach";
    }
    if (settings.regionStyle === "volcanic_arc") {
      if (random() < 0.62) return "rock";
      if (random() < 0.84) return "barrens";
      return "beach";
    }
    if (settings.regionStyle === "dry_expanse") {
      if (random() < 0.42) return settings.heat > 1.1 ? "desert" : "barrens";
      if (random() < 0.68) return "barrens";
      return "beach";
    }
    if (settings.regionStyle === "tropical_basin") {
      if (random() < 0.38) return "beach";
      if (random() < 0.72) return "lush_grassland";
      return "jungle_floor";
    }
    if (settings.regionStyle === "coastal_realm") {
      if (random() < 0.68) return "beach";
      if (random() < 0.84) return "grassland";
      return "plains";
    }
    if (settings.regionStyle === "island_chain" && settings.heat > 1.2 && settings.wetness > 1.05) {
      if (random() < 0.55) return "beach";
      if (random() < 0.78) return "lush_grassland";
      return "jungle_floor";
    }
    return "beach";
  }

  function normalizeOceanDepths(hexes, helpers) {
    const updates = [];
    const edgeOceanIds = getEdgeConnectedOceanIds(hexes, helpers);
    hexes.forEach(hex => {
      if (!OCEAN_BASES.has(hex.baseTerrain) && hex.baseTerrain !== "inland_water") return;
      if (hex.baseTerrain === "inland_water" && neighbors(hex, helpers.byCoord).some(neighbor => isOpenOceanBase(neighbor.baseTerrain))) {
        updates.push([hex, "coastal_water"]);
        return;
      }
      if (!OCEAN_BASES.has(hex.baseTerrain)) return;
      const distance = distanceToLand(hex, helpers.byCoord, 4);
      const isEdgeOcean = edgeOceanIds.has(hex.id);
      updates.push([hex, distance <= 1 ? "coastal_water" : distance <= 3 || !isEdgeOcean ? "sea" : "deep_sea"]);
    });
    updates.forEach(([hex, baseTerrain]) => {
      hex.baseTerrain = baseTerrain;
    });
  }

  function getEdgeConnectedOceanIds(hexes, helpers) {
    const edgeOceanIds = new Set();
    const visited = new Set();
    const frontier = hexes.filter(hex => isBorderHex(hex, helpers.dimensions) && OCEAN_BASES.has(hex.baseTerrain));
    frontier.forEach(hex => {
      visited.add(hex.id);
      edgeOceanIds.add(hex.id);
    });

    while (frontier.length) {
      const current = frontier.shift();
      neighbors(current, helpers.byCoord).forEach(neighbor => {
        if (visited.has(neighbor.id) || !OCEAN_BASES.has(neighbor.baseTerrain)) return;
        visited.add(neighbor.id);
        edgeOceanIds.add(neighbor.id);
        frontier.push(neighbor);
      });
    }

    return edgeOceanIds;
  }

  function distanceToLand(hex, byCoord, maxDistance) {
    const visited = new Set([hex.id]);
    let frontier = [hex];
    for (let distance = 1; distance <= maxDistance; distance += 1) {
      const next = [];
      frontier.forEach(current => {
        neighbors(current, byCoord).forEach(neighbor => {
          if (visited.has(neighbor.id)) return;
          visited.add(neighbor.id);
          if (isLandBase(neighbor.baseTerrain) || neighbor.baseTerrain === "beach") next.push(neighbor);
          else next.push(neighbor);
        });
      });
      if (next.some(neighbor => isLandBase(neighbor.baseTerrain) || neighbor.baseTerrain === "beach")) return distance;
      frontier = next.filter(neighbor => isWaterBase(neighbor.baseTerrain));
    }
    return maxDistance + 1;
  }

  function terrainAdjacencyScore(a, b) {
    if (a === b) return 0;
    const profileA = TERRAIN_PROFILES[a];
    const profileB = TERRAIN_PROFILES[b];
    if (!profileA || !profileB) return 0;
    let score = Math.abs(profileA.climate - profileB.climate) + Math.abs(profileA.moisture - profileB.moisture) + Math.abs(profileA.elevation - profileB.elevation);
    const waterish = new Set(["water", "coast", "freshwater"]);
    if (waterish.has(profileA.group) !== waterish.has(profileB.group)) score += profileA.group === "coast" || profileB.group === "coast" ? 1 : 2;
    return score;
  }

  function transitionTerrainForClash(baseTerrain, neighborBaseTerrain, random) {
    const profile = TERRAIN_PROFILES[baseTerrain];
    const neighborProfile = TERRAIN_PROFILES[neighborBaseTerrain];
    if (!profile || !neighborProfile) return null;
    if (OCEAN_BASES.has(baseTerrain) && isLandBase(neighborBaseTerrain)) return "coastal_water";
    if (baseTerrain === "beach" && !isWaterBase(neighborBaseTerrain)) return random() < 0.5 ? "plains" : "grassland";
    if (profile.group === "cold" && ["tropical", "arid"].includes(neighborProfile.group)) return random() < 0.55 ? "rock" : "barrens";
    if (profile.group === "tropical" && neighborProfile.moisture < 0) return "lush_grassland";
    if (profile.group === "wet" && neighborProfile.moisture < -1) return "grassland";
    if (profile.group === "arid" && neighborProfile.moisture > 1) return baseTerrain === "deep_desert" ? "desert" : "plains";
    if (profile.group === "waste" && neighborProfile.moisture > 0) return "barrens";
    if (profile.group === "fertile" && neighborProfile.group === "waste") return "grassland";
    if (profile.group === "highland" && neighborProfile.group === "water") return "coastal_water";
    if (Math.abs(profile.elevation - neighborProfile.elevation) >= 2 && isLandBase(baseTerrain) && isLandBase(neighborBaseTerrain)) {
      return profile.elevation > neighborProfile.elevation ? "rock" : "barrens";
    }
    return null;
  }

  function applyBadAdjacencyCleanup(hexes, helpers) {
    const passes = Math.max(1, Math.round(helpers.settings.continuity));
    for (let pass = 0; pass < passes; pass += 1) {
      const updates = new Map();
      hexes.forEach(hex => {
        neighbors(hex, helpers.byCoord).forEach(neighbor => {
          if (hex.id > neighbor.id) return;
          if (terrainAdjacencyScore(hex.baseTerrain, neighbor.baseTerrain) < 5 || helpers.random() >= 0.62) return;
          const nextHexTerrain = transitionTerrainForClash(hex.baseTerrain, neighbor.baseTerrain, helpers.random);
          const nextNeighborTerrain = transitionTerrainForClash(neighbor.baseTerrain, hex.baseTerrain, helpers.random);
          if (nextHexTerrain) updates.set(hex, nextHexTerrain);
          if (nextNeighborTerrain) updates.set(neighbor, nextNeighborTerrain);
        });
      });
      if (!updates.size) break;
      updates.forEach((baseTerrain, hex) => {
        hex.baseTerrain = baseTerrain;
      });
    }
  }

  function assignFeaturesAndElevations(hexes, options) {
    const { settings, rules, context } = options;
    hexes.forEach((hex, index) => {
      const seed = `${settings.seed}:features:${hex.id}:${index}`;
      const snapshot = { hexId: hex.id, id: hex.id, baseTerrain: hex.baseTerrain, features: [], elevation: hex.elevation };
      const features = rules.generateFeaturesForTerrain
        ? rules.generateFeaturesForTerrain({
          baseTerrain: hex.baseTerrain,
          elevation: "auto",
          seed,
          noise: 0,
          maxFeatures: settings.maxFeatures,
          featureDensityScale: settings.featureDensity,
          hex: snapshot,
          context,
          hashNumber
        })
        : [];
      hex.features = rules.ensureValidFeatures ? rules.ensureValidFeatures(hex.baseTerrain, features, { maxFeatures: settings.maxFeatures }) : features.slice(0, settings.maxFeatures);
      hex.elevation = rules.getAutoElevation?.(hex.baseTerrain, hex.features) ?? TERRAIN_PROFILES[hex.baseTerrain]?.elevation ?? 1;
    });

    hexes.forEach(hex => {
      if (!isLandBase(hex.baseTerrain)) return;
      if (hex.features?.some(feature => ["mountains", "snowcapped_mountains", "volcano"].includes(feature))) return;
      const nearRange = nearbyAnyFeature(hex, ["mountains", "snowcapped_mountains", "volcano"], context.byId, context.byCoord, 1)
        ? 1
        : nearbyAnyFeature(hex, ["mountains", "snowcapped_mountains", "volcano"], context.byId, context.byCoord, 2)
          ? 2
          : 0;
      if (nearRange) hex.elevation = Math.max(Number(hex.elevation) || 0, nearRange === 1 ? 2 : 1);
    });
  }

  function makeRuleContext(byId, byCoord) {
    return {
      byId,
      byCoord,
      hasNearbyBase(targetHex, bases, radius = 2) {
        const hex = byId.get(targetHex?.hexId || targetHex?.id);
        const baseSet = new Set(bases || []);
        return Boolean(hex && nearbyWithin(hex, byCoord, radius).some(neighbor => baseSet.has(neighbor.baseTerrain)));
      },
      hasNearbyFeature(targetHex, featureId, radius = 2) {
        const hex = byId.get(targetHex?.hexId || targetHex?.id);
        return Boolean(hex && nearbyWithin(hex, byCoord, radius).some(neighbor => (neighbor.features || []).includes(featureId)));
      },
      hasNearbyAnyFeature(targetHex, features, radius = 2) {
        const hex = byId.get(targetHex?.hexId || targetHex?.id);
        return Boolean(hex && nearbyAnyFeature(hex, features, byId, byCoord, radius));
      },
      nearbyFeatureCount(targetHex, featureId, radius = 1) {
        const hex = byId.get(targetHex?.hexId || targetHex?.id);
        return hex ? nearbyWithin(hex, byCoord, radius).filter(neighbor => (neighbor.features || []).includes(featureId)).length : 0;
      },
      hasNearbyPoiType() {
        return false;
      },
      hasStrongWaterDrop() {
        return false;
      }
    };
  }

  function nearbyAnyFeature(hex, features, byId, byCoord, radius) {
    const featureSet = new Set(features || []);
    return nearbyWithin(hex, byCoord, radius).some(neighbor => (neighbor.features || []).some(feature => featureSet.has(feature)));
  }

  function nearbyWithin(hex, byCoord, radius) {
    const visited = new Set([hex.id]);
    let frontier = [hex];
    const result = [];
    for (let distance = 1; distance <= radius; distance += 1) {
      const next = [];
      frontier.forEach(current => {
        neighbors(current, byCoord).forEach(neighbor => {
          if (visited.has(neighbor.id)) return;
          visited.add(neighbor.id);
          result.push(neighbor);
          next.push(neighbor);
        });
      });
      frontier = next;
    }
    return result;
  }

  function normalizePoiOptions(options = {}) {
    return {
      seed: String(options.seed || "campaign-codex-pois"),
      settlementDensity: clamp(options.settlementDensity, 0.4, 1.8, 1),
      populationConcentration: clamp(options.populationConcentration, 0.5, 1.5, 1),
      resourceAmount: clamp(options.resourceAmount, 0.5, 1.5, 1),
      waypointAmount: clamp(options.waypointAmount, 0.5, 1.5, 1)
    };
  }

  function clonePoiHexes(hexes) {
    return (hexes || [])
      .map(hex => ({
        id: hex.id,
        x: Number(hex.x),
        y: Number(hex.y),
        baseTerrain: String(hex.baseTerrain || "plains").trim() || "plains",
        features: Array.isArray(hex.features) ? [...hex.features] : [],
        elevation: Number.isFinite(Number(hex.elevation)) ? Number(hex.elevation) : 1,
        regionId: hex.regionId || hex.Region_ID_Ref || "",
        politicalRegionId: hex.politicalRegionId || hex.Political_Region_ID_Ref || ""
      }))
      .filter(hex => hex.id && Number.isFinite(hex.x) && Number.isFinite(hex.y));
  }

  function generatePoiDrafts(options = {}) {
    const settings = normalizePoiOptions(options);
    const random = makeRandom(`${settings.seed}:poi-pass`);
    const hexes = clonePoiHexes(options.hexes || []);
    if (!hexes.length) return [];

    const byId = new Map(hexes.map(hex => [hex.id, hex]));
    const byCoord = new Map(hexes.map(hex => [`${hex.x}:${hex.y}`, hex]));
    const dimensions = getDimensions(hexes);
    const riverData = buildPoiRiverData(options.mapOverlays || []);
    const existingPois = Array.isArray(options.existingPois) ? options.existingPois.filter(Boolean) : [];
    const occupiedHexIds = new Set(existingPois.map(poi => poi?.Hex_ID_Ref).filter(Boolean));
    const usedNames = new Set(existingPois.map(poi => normalizeGeneratedNameKey(poi?.Name || "")));
    const existingSettlementAnchors = getExistingSettlementAnchors(existingPois, byId, riverData, settings);
    const candidateHexes = hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex));

    const settlementScoreFloor = getSettlementCandidateScoreFloor(settings);
    const settlementCandidates = candidateHexes
      .map(hex => buildSettlementCandidate(hex, byId, byCoord, dimensions, riverData, settings))
      .filter(candidate => candidate && candidate.score >= settlementScoreFloor);

    const targetSettlements = getTargetSettlementCount(candidateHexes, settings, existingSettlementAnchors.length);
    const settlementDrafts = buildSettlementDrafts({
      candidates: settlementCandidates,
      targetCount: targetSettlements,
      existingAnchors: existingSettlementAnchors,
      occupiedHexIds,
      settings,
      usedNames,
      random
    }).slice(0, targetSettlements);

    settlementDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

    const settlementAnchors = [
      ...existingSettlementAnchors,
      ...settlementDrafts.map((draft, index) => makeGeneratedSettlementAnchor(draft, index))
    ];

    const resourceDrafts = buildResourceSiteDrafts({
      candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
      settlementAnchors,
      occupiedHexIds,
      byId,
      byCoord,
      dimensions,
      riverData,
      settings,
      usedNames,
      random,
      existingPois
    });
    resourceDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

    const waypointDrafts = buildWaypointDrafts({
      candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
      settlementAnchors,
      occupiedHexIds,
      byId,
      byCoord,
      dimensions,
      riverData,
      settings,
      usedNames,
      random,
      existingPois
    });

    return [...settlementDrafts, ...resourceDrafts, ...waypointDrafts].map(({ meta, ...draft }) => draft);
  }

  function buildPoiRiverData(overlays) {
    const riverHexIds = new Set();
    const degreeByHexId = new Map();
    (overlays || [])
      .filter(overlay => String(overlay?.Overlay_Type || "").toLowerCase() === "river")
      .forEach(overlay => {
        const fromHexId = overlay?.Hex_ID_Ref || overlay?.From_Hex_ID_Ref || "";
        const toHexId = overlay?.To_Hex_ID_Ref || "";
        if (fromHexId) riverHexIds.add(fromHexId);
        if (toHexId) riverHexIds.add(toHexId);
        if (fromHexId && toHexId) {
          degreeByHexId.set(fromHexId, (degreeByHexId.get(fromHexId) || 0) + 1);
          degreeByHexId.set(toHexId, (degreeByHexId.get(toHexId) || 0) + 1);
        }
      });
    return { riverHexIds, degreeByHexId };
  }

  function getExistingSettlementAnchors(existingPois, byId, riverData, settings) {
    const byPlace = new Map();
    existingPois.forEach(poi => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type !== "settlement") return;
      const placeKey = poi?.POI_Group_ID ? `group:${poi.POI_Group_ID}` : `poi:${poi.POI_ID}`;
      const candidate = {
        poi,
        type,
        hex: byId.get(poi?.Hex_ID_Ref || ""),
        notoriety: Number(window.CampaignPoiTypes?.normalizeNotorietyValue?.(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"] || "") || 7),
        population: parsePopulationNumber(poi?.Population)
      };
      if (!candidate.hex) return;
      const existing = byPlace.get(placeKey);
      if (!existing || compareExistingSettlementAnchors(candidate, existing) < 0) {
        byPlace.set(placeKey, candidate);
      }
    });

    return [...byPlace.values()].map((record, index) => {
      const fallbackCandidate = buildSettlementCandidate(record.hex, byId, null, null, riverData, settings);
      const importance = Math.max(
        0.35,
        record.population ? clamp(record.population / 22000, 0.25, 1.8, 0.5) : 0.4,
        1.15 - ((record.notoriety || 7) - 1) * 0.12,
        fallbackCandidate?.score || 0.4
      );
      return {
        id: record.poi?.POI_ID || `existing-settlement-${index}`,
        hex: record.hex,
        importance,
        notoriety: String(Math.max(1, Math.min(10, record.notoriety || 7))),
        population: record.poi?.Population || "",
        name: String(record.poi?.Name || "").trim() || "Settlement"
      };
    });
  }

  function compareExistingSettlementAnchors(left, right) {
    return (
      (left.notoriety || 10) - (right.notoriety || 10) ||
      (right.population || 0) - (left.population || 0) ||
      String(left.poi?.Name || "").localeCompare(String(right.poi?.Name || ""))
    );
  }

  function getTargetSettlementCount(candidateHexes, settings, existingCount = 0) {
    const viableCount = candidateHexes.filter(hex => isViableSettlementHex(hex)).length;
    const totalTarget = Math.max(0, Math.min(40, Math.round((viableCount / 72) * settings.settlementDensity)));
    return Math.max(0, totalTarget - Math.max(0, existingCount));
  }

  function getSettlementCandidateScoreFloor(settings) {
    const density = settings?.settlementDensity ?? 1;
    return clamp(0.24 - (density - 1) * 0.10, 0.16, 0.32, 0.24);
  }

  function getSettlementSelectionFloor(settings) {
    const density = settings?.settlementDensity ?? 1;
    return clamp(0.22 - (density - 1) * 0.12, 0.12, 0.30, 0.22);
  }

  function getSettlementSpacingScale(settings) {
    const density = settings?.settlementDensity ?? 1;
    if (density >= 1) {
      return clamp(1 - (density - 1) * 0.45, 0.55, 1, 1);
    }
    return clamp(1 + (1 - density) * 0.8, 1, 1.5, 1);
  }

  function buildSettlementDrafts({ candidates, targetCount, existingAnchors, occupiedHexIds, settings, usedNames, random }) {
    const chosen = [];
    const remaining = [...candidates];
    const selectionFloor = getSettlementSelectionFloor(settings);
    while (remaining.length && chosen.length < targetCount) {
      let bestIndex = -1;
      let bestScore = 0;
      remaining.forEach((candidate, index) => {
        if (!candidate?.hex || occupiedHexIds.has(candidate.hex.id)) return;
        const score = candidate.score
          - getSettlementSpacingPenalty(candidate.hex, chosen, existingAnchors, settings)
          + seededNoise(`${settings.seed}:settlement-candidate:${candidate.hex.id}`, -0.04, 0.04);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      if (bestIndex < 0 || bestScore < selectionFloor) break;
      const [candidate] = remaining.splice(bestIndex, 1);
      chosen.push({ ...candidate, adjustedScore: bestScore });
      occupiedHexIds.add(candidate.hex.id);
    }

    const ranked = chosen
      .sort((a, b) => b.adjustedScore - a.adjustedScore || a.hex.id.localeCompare(b.hex.id))
      .map((candidate, index, list) => {
        const sizeTier = getSettlementSizeTier(index, list.length);
        const population = formatGeneratedPopulation(generateSettlementPopulation(sizeTier, index, list.length, settings, candidate));
        const tags = getGeneratedSettlementTags(candidate, sizeTier);
        const notoriety = getGeneratedSettlementNotoriety(candidate, sizeTier, index, list.length);
        const icon = chooseSettlementIcon(candidate, sizeTier, tags);
        const name = reserveGeneratedName(
          generateSettlementName(candidate, sizeTier, settings, usedNames),
          usedNames,
          buildSettlementFallbackName(candidate, sizeTier),
          { seed: `${settings.seed}:settlement-name:${candidate.hex.id}` }
        );
        return {
          name,
          type: "settlement",
          icon,
          hexId: candidate.hex.id,
          tags,
          notoriety,
          population,
          lore: "",
          meta: {
            importance: getSettlementImportanceFromTier(sizeTier, index, list.length),
            sizeTier,
            hex: { ...candidate.hex }
          }
        };
      });

    return ranked;
  }

  function makeGeneratedSettlementAnchor(draft, index) {
    return {
      id: `generated-settlement-${index}:${draft.hexId}`,
      hex: draft.meta?.hex ? { ...draft.meta.hex } : { id: draft.hexId },
      importance: draft.meta?.importance || 0.5,
      notoriety: draft.notoriety,
      population: draft.population,
      name: draft.name
    };
  }

  function buildSettlementCandidate(hex, byId, byCoord, dimensions, riverData, settings) {
    if (!hex || !isPoiLandHex(hex) || !isViableSettlementHex(hex)) return null;
    const localByCoord = byCoord || new Map([...byId.values()].map(entry => [`${entry.x}:${entry.y}`, entry]));
    const localDimensions = dimensions || getDimensions([...byId.values()]);
    const adjacent = neighbors(hex, localByCoord);
    const nearby = nearbyWithin(hex, localByCoord, 2);
    const edgeDistance = distanceToMapEdge(hex, localDimensions);
    const waterAccess = scoreSettlementWaterAccess(hex, adjacent, riverData);
    const fertility = scoreSettlementFertility(hex, nearby);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const strategic = scoreSettlementStrategicValue(hex, nearby, localDimensions, riverData);
    const resources = scoreSettlementResourceDiversity(hex, nearby);
    const score = (
      waterAccess * 0.19 +
      fertility * 0.34 +
      routeability * 0.25 +
      strategic * 0.10 +
      resources * 0.12
    ) - getSettlementEdgePenalty({
      edgeDistance,
      coastal: adjacent.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain)),
      inlandWater: adjacent.some(neighbor => neighbor.baseTerrain === "inland_water"),
      riverAccess: hasRiverAccess(hex, adjacent, riverData),
      settings
    });
    return {
      hex,
      score,
      waterAccess,
      fertility,
      routeability,
      strategic,
      resources,
      coastal: adjacent.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain)),
      inlandWater: adjacent.some(neighbor => neighbor.baseTerrain === "inland_water"),
      riverAccess: hasRiverAccess(hex, adjacent, riverData),
      highland: getNearbyTerrainCount(nearby, ["rock", "snow"]) >= 2 || (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature)),
      frontier: edgeDistance <= 1
    };
  }

  function scoreSettlementWaterAccess(hex, nearby, riverData) {
    let score = 0;
    const adjacentWater = nearby.filter(neighbor => isWaterBase(neighbor.baseTerrain));
    if (adjacentWater.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain))) score += 0.34;
    if (adjacentWater.some(neighbor => neighbor.baseTerrain === "inland_water")) score += 0.24;
    if (adjacentWater.some(neighbor => neighbor.baseTerrain === "coastal_water") && adjacentWater.some(neighbor => neighbor.baseTerrain === "inland_water")) score += 0.06;
    if (riverData.riverHexIds.has(hex.id)) score += 0.06;
    if (nearby.some(neighbor => riverData.riverHexIds.has(neighbor.id))) score += 0.03;
    const confluence = Math.max(
      riverData.degreeByHexId.get(hex.id) || 0,
      ...nearby.map(neighbor => riverData.degreeByHexId.get(neighbor.id) || 0)
    );
    if (confluence >= 3) score += 0.1;
    if (adjacentWater.length >= 2) score += 0.03;
    return Math.min(1.05, score);
  }

  function scoreSettlementFertility(hex, nearby) {
    const own = getTerrainFertility(hex.baseTerrain, hex.features);
    const neighborhood = nearby
      .filter(neighbor => !isWaterBase(neighbor.baseTerrain))
      .map(neighbor => getTerrainFertility(neighbor.baseTerrain, neighbor.features));
    const nearbyAverage = neighborhood.length
      ? neighborhood.reduce((sum, value) => sum + value, 0) / neighborhood.length
      : own;
    return Math.max(0, Math.min(1.2, own * 0.6 + nearbyAverage * 0.4));
  }

  function scoreSettlementRouteability(hex, nearby, riverData) {
    const landHexes = [hex, ...nearby].filter(neighbor => !isWaterBase(neighbor.baseTerrain));
    const averageRoughness = landHexes.length
      ? landHexes.reduce((sum, neighbor) => sum + getTerrainRoughness(neighbor.baseTerrain, neighbor.features), 0) / landHexes.length
      : 1;
    let score = 1 - averageRoughness;
    if (getNearbyTerrainCount(nearby, ["rock", "snow"]) >= 2 && averageRoughness < 0.58) score += 0.08;
    return Math.max(0.05, Math.min(1.1, score));
  }

  function scoreSettlementStrategicValue(hex, nearby, dimensions, riverData) {
    let score = 0;
    const highlands = getNearbyTerrainCount(nearby, ["rock", "snow"]);
    if (highlands >= 2) score += 0.14;
    if (highlands >= 3) score += 0.08;
    if ((hex.features || []).some(feature => ["cliffs", "mountains", "snowcapped_mountains", "lone_mountain"].includes(feature))) score += 0.08;
    return Math.min(1, score);
  }

  function scoreSettlementResourceDiversity(hex, nearby) {
    const terrainKinds = new Set();
    [hex, ...nearby].forEach(neighbor => {
      const group = TERRAIN_PROFILES[neighbor.baseTerrain]?.group || "other";
      if (!["water", "coast", "freshwater"].includes(group)) terrainKinds.add(group);
      (neighbor.features || [])
        .filter(feature => ["forest", "dead_trees", "farmland", "waves", "shoals", "reef", "water_rocks"].includes(feature))
        .forEach(feature => terrainKinds.add(feature));
    });
    return Math.min(1, terrainKinds.size / 6);
  }

  function getSettlementEdgePenalty({ edgeDistance, coastal, inlandWater, riverAccess, settings }) {
    if (!Number.isFinite(edgeDistance) || edgeDistance >= 3) return 0;

    let penalty = edgeDistance <= 0
      ? 0.18
      : edgeDistance === 1
        ? 0.1
        : 0.04;

    if (coastal && !inlandWater && !riverAccess) {
      penalty += edgeDistance <= 0 ? 0.08 : 0.04;
    }

    if (settings?.regionStyle === "island_chain") {
      penalty *= 0.6;
    } else if (settings?.regionStyle === "coastal_realm") {
      penalty *= 0.78;
    }

    return penalty;
  }

  function getSettlementSpacingPenalty(hex, chosen, existingAnchors, settings) {
    const anchors = [
      ...chosen.map(candidate => candidate.hex),
      ...existingAnchors.map(anchor => anchor.hex).filter(Boolean)
    ];
    const spacingScale = getSettlementSpacingScale(settings);
    return anchors.reduce((penalty, anchorHex) => {
      const distance = hexDistance(hex, anchorHex);
      if (distance <= 2) return penalty + 1.7 * spacingScale;
      if (distance === 3) return penalty + 0.5 * spacingScale;
      if (distance === 4) return penalty + 0.18 * spacingScale;
      return penalty;
    }, 0);
  }

  function getSettlementSizeTier(index, total) {
    if (index === 0 && total >= 8) return "grand_hub";
    if (index <= Math.max(1, Math.floor(total * 0.18))) return "city";
    if (index <= Math.max(3, Math.floor(total * 0.52))) return "town";
    return "village";
  }

  function getSettlementImportanceFromTier(sizeTier, index, total) {
    if (sizeTier === "grand_hub") return 1.45;
    if (sizeTier === "city") return 1.08 - index / Math.max(12, total * 10);
    if (sizeTier === "town") return 0.78;
    return 0.52;
  }

  function generateSettlementPopulation(sizeTier, index, total, settings, candidate) {
    const concentration = settings.populationConcentration;
    const topScale = 0.7 + concentration * 0.8;
    const broadScale = 1.25 - (concentration - 0.5) * 0.35;
    const scoreScale = 0.85 + Math.max(0, candidate.score - 0.35);
    if (sizeTier === "grand_hub") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 22000, 52000) * topScale * scoreScale;
    if (sizeTier === "city") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 7000, 22000) * topScale * scoreScale;
    if (sizeTier === "town") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 1800, 8000) * broadScale * scoreScale;
    return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 250, 2600) * broadScale * Math.max(0.7, scoreScale * 0.95);
  }

  function getGeneratedSettlementTags(candidate, sizeTier) {
    const tags = [];
    if (candidate.coastal || candidate.inlandWater || candidate.riverAccess) tags.push("trade");
    if (candidate.coastal || candidate.inlandWater) tags.push("fishing");
    if (candidate.fertility >= 0.72) tags.push("farming");
    if (candidate.routeability >= 0.72) tags.push("crossroads");
    if (candidate.riverAccess && !candidate.coastal && candidate.routeability >= 0.56) tags.push("river_crossing");
    if (candidate.frontier && sizeTier !== "grand_hub") tags.push("frontier");
    if (candidate.frontier && candidate.strategic >= 0.22) tags.push("borderland");
    if (sizeTier === "grand_hub" || sizeTier === "city") tags.push("administration");
    return coerceGeneratedTags(tags);
  }

  function chooseSettlementIcon(candidate, sizeTier, tags) {
    if (candidate.coastal && (sizeTier === "grand_hub" || sizeTier === "city")) return "port_town";
    if (candidate.highland && (sizeTier === "grand_hub" || sizeTier === "city")) return "mountain_city";
    if (candidate.highland && sizeTier === "town") return "hilltop_town";
    if (tags.includes("frontier") && sizeTier === "village") return "walled_encampment";
    if (sizeTier === "grand_hub" || sizeTier === "city") return candidate.strategic >= 0.22 ? "walled_city" : "city";
    if (sizeTier === "town") return "hilltop_town";
    return "village";
  }

  function getGeneratedSettlementNotoriety(candidate, sizeTier, index, total) {
    let value = sizeTier === "grand_hub"
      ? 2
      : sizeTier === "city"
        ? 4
        : sizeTier === "town"
          ? 6
          : 7;
    if (sizeTier === "grand_hub" && candidate.coastal && candidate.routeability >= 0.72) value = 1;
    if (candidate.coastal || candidate.inlandWater) value -= 1;
    if (candidate.frontier && sizeTier === "village") value += 1;
    if (candidate.routeability >= 0.78 && index <= Math.max(1, Math.floor(total * 0.2))) value -= 1;
    return String(Math.max(1, Math.min(10, value)));
  }

  function buildSettlementFallbackName(candidate, sizeTier) {
    const fallbackPatterns = [];
    if (candidate.riverAccess) {
      fallbackPatterns.push({
        prefixes: ["Stone", "Willow", "Alder", "Grey", "Otter", "Reed", "White", "Kings", "Moss"],
        suffixes: ["ford", "bridge", "reach", "weir", "brook"],
        forceSpace: false
      });
    }
    if (candidate.highland) {
      fallbackPatterns.push({
        prefixes: ["Iron", "Raven", "Stone", "High", "Ash", "Wolf", "Cold", "Black", "Crag"],
        suffixes: ["hold", "crest", "gate", "watch", "fell"],
        forceSpace: false
      });
    }
    if (candidate.fertility >= 0.8) {
      fallbackPatterns.push({
        prefixes: ["Amber", "Oak", "Willow", "Green", "Fair", "Elm", "Honey", "Harvest"],
        suffixes: ["stead", "vale", "mead", "field", "grove"],
        forceSpace: false
      });
    }
    fallbackPatterns.push({
      prefixes: ["Grey", "Stone", "Kings", "Queens", "Bracken", "White", "Red", "Oak", "Deep"],
      suffixes: ["wick", "holm", "mere", "hurst", "croft", "combe", "burg", "bury", "dale", "thorpe", "ham"],
      forceSpace: false
    });
    fallbackPatterns.push({
      prefixes: ["Crown", "Lantern", "Guild", "Saint", "Oath", "Gloam", "Rune", "Star", "Banner", "Warden"],
      suffixes: ["ward", "mark", "watch", "hall", "court", "gate", "rest", "veil", "burg", "vale", "dale"],
      forceSpace: false
    });
    return buildGeneratedPatternName(`fallback:settlement:${candidate.hex.id}:${sizeTier}`, fallbackPatterns);
  }

  function generateSettlementName(candidate, sizeTier, settings, usedNames) {
    const seed = `${settings.seed}:settlement-name:${candidate.hex.id}`;
    const patterns = [];

    if (candidate.riverAccess) {
      patterns.push({
        prefixes: ["Stone", "Willow", "Alder", "Grey", "Reed", "Otter", "White", "Kings", "Bracken", "Long", "Moss", "Clear", "Ash", "Mill", "Red", "Elm"],
        suffixes: ["ford", "bridge", "reach", "weir", "brook", "mouth", "cross", "flow"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["Lower", "Upper", "Grey", "Stone", "Reed", "Willow", "Alder", "King's", "Otter"],
        suffixes: ["Ford", "Bridge", "Crossing", "Reach"],
        forceSpace: true
      });
    }

    if (candidate.highland) {
      patterns.push({
        prefixes: ["Iron", "Raven", "Stone", "High", "Ash", "Wolf", "Cold", "Black", "Crag", "Crown", "Frost", "Granite", "Storm", "Red", "North", "Cinder"],
        suffixes: ["hold", "crest", "gate", "watch", "fell", "peak", "keep", "cairn", "spire", "cliff"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["High", "Cold", "Wolf", "Stone", "Raven", "Iron", "Black", "North"],
        suffixes: ["Keep", "Watch", "Gate"],
        forceSpace: true
      });
    }

    if (candidate.fertility >= 0.8) {
      patterns.push({
        prefixes: ["Amber", "Oak", "Willow", "Green", "Fair", "Elm", "Honey", "Harvest", "Meadow", "Barley", "Sun", "Silver", "Alder", "Golden", "Moss", "Red"],
        suffixes: ["stead", "vale", "mead", "field", "grove", "lea", "brook", "hollow", "croft", "meadow"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["Amber", "Harvest", "Green", "Willow", "Elm", "Sun", "Oak", "Fair"],
        suffixes: ["Market", "Fields", "Meadow"],
        forceSpace: true
      });
    }

    if (candidate.coastal && (sizeTier === "grand_hub" || sizeTier === "city")) {
      patterns.push({
        prefixes: ["Storm", "Grey", "Salt", "Tide", "Wave", "Drift", "Seabreak", "Windward", "Anchor", "Harrow", "West", "North", "Blackwater", "Breaker"],
        suffixes: ["Harbor", "Port", "Quay", "Haven", "Roads", "Sound", "Anchorage"],
        forceSpace: true
      });
    }

    if (candidate.coastal || candidate.inlandWater) {
      patterns.push({
        prefixes: ["Reed", "Marsh", "Drift", "Willow", "Low", "Tide", "Salt", "Shore", "Lagoon", "Mud", "Wave", "Cove", "Wash", "Mere"],
        suffixes: ["strand", "shore", "haven", "ness", "cove", "mere", "wash", "fleet"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["Willow", "Reed", "Grey", "Low", "Marsh", "Salt", "Mud", "Drift"],
        suffixes: ["Shore", "Cove", "Strand"],
        forceSpace: true
      });
    }

    patterns.push(
      {
        prefixes: ["Grey", "White", "Kings", "Queens", "Bracken", "Deep", "Oak", "Red", "Moon", "Low", "West", "East", "South", "North", "Stone", "Long"],
        suffixes: ["wick", "holm", "mere", "mark", "hurst", "croft", "combe", "stead", "barrow", "byre", "burg", "bury", "dale", "vale", "hollow", "by", "thorpe", "ham", "minster", "chester", "caster"],
        forceSpace: false
      },
      {
        prefixes: ["Crown", "King's", "Queen's", "Regent", "Royal", "Guild", "Coin", "Mercer", "Lantern", "Bell", "Candle", "Saint", "Oath", "Vigil", "Gloam", "Sable", "Bright", "Whisper", "Rune", "Star", "Moon", "Ivory", "Glass", "Banner", "Warden", "Marshal", "Tinker", "Charter", "Heir's", "Pilgrim's", "Morrow", "Ember", "Sentinel", "Astral", "Sigil"],
        suffixes: ["ward", "mark", "rest", "court", "hall", "watch", "gate", "veil", "grace", "banner", "burg", "bury", "vale", "dale", "wick", "stead", "holm", "mere", "croft", "combe", "ham", "thorpe", "minster", "haven", "port"],
        forceSpace: false
      },
      {
        prefixes: ["Old", "South", "North", "West", "East", "Kings", "Queens", "White", "Grey", "High", "Low", "Lantern", "Guild", "Saint", "Gloam", "Rune", "Banner"],
        suffixes: ["Market", "Gate", "Watch", "Court", "Hall", "Exchange", "Post"],
        forceSpace: true
      },
      {
        prefixes: ["King's", "Queen's", "Royal", "Lantern", "Pilgrim's", "Mercers", "Wayfarers", "Vigil", "Saint's", "Marshal's", "Heir's"],
        suffixes: ["Gate", "Hall", "Court", "Market", "Watch", "Exchange", "Rest"],
        forceSpace: true
      }
    );

    return buildGeneratedPatternName(seed, patterns, usedNames);
  }

  function buildResourceSiteDrafts({ candidateHexes, settlementAnchors, occupiedHexIds, byId, byCoord, dimensions, riverData, settings, usedNames, random, existingPois }) {
    const existingCount = getExistingPoiTypeCount(existingPois, "resource_site");
    const targetCount = Math.max(0, Math.round(settlementAnchors.length * 1.05 * settings.resourceAmount) - existingCount);
    if (!targetCount || !settlementAnchors.length) return [];

    const candidates = candidateHexes
      .map(hex => buildResourceCandidate(hex, settlementAnchors, byId, byCoord, dimensions, riverData, settings))
      .filter(candidate => candidate && candidate.score >= 0.34)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));

    const chosen = [];
    candidates.forEach(candidate => {
      if (chosen.length >= targetCount || occupiedHexIds.has(candidate.hex.id)) return;
      if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return;
      chosen.push(candidate);
      occupiedHexIds.add(candidate.hex.id);
    });

    return chosen.map(candidate => {
      const name = reserveGeneratedName(
        generateResourceSiteName(candidate, settings),
        usedNames,
        buildResourceSiteFallbackName(candidate),
        { seed: `${settings.seed}:resource-name:${candidate.hex.id}` }
      );
      return {
        name,
        type: "resource_site",
        icon: candidate.icon,
        hexId: candidate.hex.id,
        tags: candidate.tags,
        notoriety: candidate.notoriety,
        population: "",
        lore: "",
        meta: candidate.meta
      };
    });
  }

  function buildResourceCandidate(hex, settlementAnchors, byId, byCoord, dimensions, riverData, settings) {
    const nearby = nearbyWithin(hex, byCoord, 2);
    const nearestSettlement = findNearestSettlementAnchor(hex, settlementAnchors);
    if (!nearestSettlement || nearestSettlement.distance < 1 || nearestSettlement.distance > 6) return null;
    const specialization = chooseResourceSpecialization(hex, nearby, riverData);
    if (!specialization) return null;
    const proximityScore = nearestSettlement.distance <= 3
      ? 1 - (nearestSettlement.distance - 1) * 0.18
      : 0.52 - (nearestSettlement.distance - 4) * 0.11;
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const remoteness = Math.min(1, nearestSettlement.distance / 6);
    const score = specialization.score * 0.5 + proximityScore * 0.28 + routeability * 0.12 + remoteness * 0.10;
    if (score < 0.3) return null;
    const tags = getResourceTags(specialization, nearestSettlement.distance);
    return {
      hex,
      score,
      icon: specialization.icon,
      tags,
      notoriety: getResourceNotoriety(specialization, nearestSettlement.distance),
      meta: {
        kind: specialization.kind,
        label: specialization.label,
        nearestSettlement: nearestSettlement.anchor?.name || ""
      }
    };
  }

  function chooseResourceSpecialization(hex, nearby, riverData) {
    const candidates = [];
    const rockCount = getNearbyTerrainCount([hex, ...nearby], ["rock", "snow"]);
    const forestCount = (hex.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length
      + nearby.reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const fertility = scoreSettlementFertility(hex, nearby);
    const waterish = hasRiverAccess(hex, nearby, riverData) || nearby.some(neighbor => ["coastal_water", "sea", "inland_water"].includes(neighbor.baseTerrain));

    if (rockCount >= 3 || (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature))) {
      candidates.push({ kind: "mine", label: "Mine", icon: "mine", score: 0.92 });
    }
    if (rockCount >= 2) {
      candidates.push({ kind: "quarry", label: "Quarry", icon: "quarry", score: 0.74 });
    }
    if (forestCount >= 2 || ["jungle_floor", "lush_grassland", "wetland"].includes(hex.baseTerrain)) {
      candidates.push({ kind: "lumber", label: "Lumber Camp", icon: "lumber_camp", score: 0.76 });
    }
    if (fertility >= 0.78) {
      candidates.push({ kind: "farm", label: "Farms", icon: "farmstead", score: 0.88 });
    }
    if (waterish) {
      candidates.push({ kind: "fishery", label: "Fishery", icon: nearby.some(neighbor => ["coastal_water", "sea"].includes(neighbor.baseTerrain)) ? "docks" : "windmill", score: 0.72 });
    }

    return candidates.sort((a, b) => b.score - a.score)[0] || null;
  }

  function getResourceTags(specialization, distance) {
    const tags = [];
    if (specialization.kind === "mine") tags.push("mining");
    if (specialization.kind === "quarry") tags.push("craftwork");
    if (specialization.kind === "lumber") tags.push("craftwork");
    if (specialization.kind === "farm") tags.push("farming");
    if (specialization.kind === "fishery") tags.push("fishing");
    if (distance >= 4) tags.push("remote");
    if (distance <= 2) tags.push("occupied");
    return coerceGeneratedTags(tags);
  }

  function getResourceNotoriety(specialization, distance) {
    let value = 7;
    if (specialization.kind === "mine") value = 6;
    if (specialization.kind === "farm") value = 7;
    if (specialization.kind === "fishery") value = 7;
    if (distance >= 4) value += 1;
    return String(Math.max(4, Math.min(9, value)));
  }

  function generateResourceSiteName(candidate, settings) {
    const seed = `${settings.seed}:resource-name:${candidate.hex.id}`;
    const nearestSettlement = String(candidate.meta?.nearestSettlement || "").trim();
    const kind = candidate.meta?.kind || "resource";
    const relatedSuffixes = kind === "mine"
      ? ["Mine", "Diggings", "Delve", "Pit", "Shaft"]
      : kind === "quarry"
        ? ["Quarry", "Stoneworks", "Cut", "Face"]
        : kind === "lumber"
          ? ["Timber Camp", "Logging Camp", "Mill", "Woodlot", "Yard"]
          : kind === "fishery"
            ? ["Fishery", "Fish Weir", "Docks", "Net Yard"]
            : ["Farms", "Fields", "Grange", "Holdings", "Meadows"];
    const relatedQualifiers = kind === "mine"
      ? ["Old", "Upper", "Lower", "North", "South", "Red", "Black", "Deep"]
      : kind === "quarry"
        ? ["Old", "Upper", "Lower", "Grey", "White", "East", "West"]
        : kind === "lumber"
          ? ["Upper", "Lower", "Old", "North", "South", "Green", "Outer"]
          : kind === "fishery"
            ? ["Upper", "Lower", "Reed", "Willow", "North", "South"]
            : ["North", "South", "East", "West", "Upper", "Lower", "Outer"];

    if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.72) {
      return buildRelatedGeneratedSiteName(seed, nearestSettlement, relatedSuffixes, relatedQualifiers, {
        qualifierChance: kind === "farm" ? 0.58 : 0.38
      });
    }

    const patterns = kind === "mine"
      ? [
          {
            prefixes: ["Iron", "Copper", "Black", "Stone", "Deep", "Cinder", "Ash", "Red", "Tin", "Silver", "Lead", "Cold", "Raven", "Torch", "Crag", "Hammer"],
            suffixes: ["Mine", "Delve", "Diggings", "Pit", "Shaft"],
            forceSpace: true
          }
        ]
      : kind === "quarry"
        ? [
            {
              prefixes: ["Grey", "Stone", "King's", "Old", "White", "Brass", "Slate", "Hard", "Hill", "Red", "Cold", "Marble", "Flint"],
              suffixes: ["Quarry", "Cut", "Stoneworks", "Face"],
              forceSpace: true
            }
          ]
        : kind === "lumber"
          ? [
              {
                prefixes: ["Pine", "Oak", "Willow", "Moss", "Bracken", "Timber", "Green", "Cedar", "Alder", "Ash", "Birch", "Fern", "Southwood", "Lantern", "Warden's"],
                suffixes: ["Camp", "Mill", "Woodlot", "Yard"],
                forceSpace: true
              }
            ]
          : kind === "fishery"
            ? [
                {
                  prefixes: ["Reed", "Marsh", "River", "Salt", "Shore", "Tide", "Eel", "Mud", "Delta", "Shallows", "Willow", "Netter's"],
                  suffixes: ["Fishery", "Fish Weir", "Docks", "Net Yard"],
                  forceSpace: true
                }
              ]
            : [
                {
                  prefixes: ["South", "West", "Green", "Amber", "Meadow", "Willow", "Barley", "Harvest", "Sun", "Long", "Mill", "Elm", "Red", "Candle", "Bell"],
                  suffixes: ["Farms", "Fields", "Grange", "Holdings", "Meadows", "Croft", "Dale"],
                  forceSpace: true
                }
              ];
    return buildGeneratedPatternName(seed, patterns);
  }

  function buildWaypointDrafts({ candidateHexes, settlementAnchors, occupiedHexIds, byId, byCoord, dimensions, riverData, settings, usedNames, random, existingPois }) {
    const existingCount = getExistingPoiTypeCount(existingPois, "waypoint");
    const targetCount = Math.max(0, Math.round(settlementAnchors.length * 0.7 * settings.waypointAmount) - existingCount);
    if (!targetCount || settlementAnchors.length < 2) return [];

    const routes = buildWaypointRouteCandidates(settlementAnchors, byId, byCoord, dimensions, riverData, settings);
    const byHex = new Map();
    routes.forEach(route => {
      const startTrim = Math.max(1, Math.floor(route.path.length * 0.2));
      const endTrim = Math.max(startTrim + 1, Math.ceil(route.path.length * 0.8));
      route.path.slice(startTrim, endTrim).forEach((hexId, index) => {
        if (occupiedHexIds.has(hexId)) return;
        const hex = byId.get(hexId);
        if (!hex || !isPoiLandHex(hex)) return;
        const nearby = nearbyWithin(hex, byCoord, 1);
        const crossing = hasRiverAccess(hex, nearby, riverData) ? 1 : 0;
        const pass = getNearbyTerrainCount([hex, ...nearby], ["rock", "snow"]) >= 2 ? 1 : 0;
        const midpointBias = 1 - Math.abs((index / Math.max(1, route.path.length - 1)) - 0.5);
        const record = byHex.get(hexId) || { hex, corridorCount: 0, crossing: 0, pass: 0, midpoint: 0, nearby };
        record.corridorCount += 1;
        record.crossing = Math.max(record.crossing, crossing);
        record.pass = Math.max(record.pass, pass);
        record.midpoint = Math.max(record.midpoint, midpointBias);
        if (!record.routeNames) record.routeNames = new Set();
        if (route.from?.name) record.routeNames.add(route.from.name);
        if (route.to?.name) record.routeNames.add(route.to.name);
        byHex.set(hexId, record);
      });
    });

    const candidates = [...byHex.values()]
      .map(record => {
        const nearestSettlement = findNearestSettlementAnchor(record.hex, settlementAnchors);
        if (!nearestSettlement || nearestSettlement.distance < 2) return null;
        const baseScore = Math.min(1, record.corridorCount / 3) * 0.4 + record.crossing * 0.22 + record.pass * 0.16 + record.midpoint * 0.12;
        const frontier = distanceToMapEdge(record.hex, dimensions) <= 2 ? 0.08 : 0;
        const routeability = scoreSettlementRouteability(record.hex, record.nearby, riverData) * 0.1;
        const score = baseScore + frontier + routeability;
        if (score < 0.32) return null;
        const icon = chooseWaypointIcon(record);
        const tags = getWaypointTags(record);
        return {
          hex: record.hex,
          score,
          icon,
          tags,
          notoriety: getWaypointNotoriety(record, nearestSettlement.distance),
          meta: {
            corridorCount: record.corridorCount,
            crossing: record.crossing,
            pass: record.pass,
            nearestSettlement: nearestSettlement.anchor?.name || "",
            routeNames: record.routeNames ? [...record.routeNames].filter(Boolean).slice(0, 4) : []
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));

    const chosen = [];
    candidates.forEach(candidate => {
      if (chosen.length >= targetCount || occupiedHexIds.has(candidate.hex.id)) return;
      if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return;
      chosen.push(candidate);
      occupiedHexIds.add(candidate.hex.id);
    });

    return chosen.map(candidate => ({
      name: reserveGeneratedName(
        generateWaypointName(candidate, settings),
        usedNames,
        buildWaypointFallbackName(candidate),
        { seed: `${settings.seed}:waypoint-name:${candidate.hex.id}` }
      ),
      type: "waypoint",
      icon: candidate.icon,
      hexId: candidate.hex.id,
      tags: candidate.tags,
      notoriety: candidate.notoriety,
      population: "",
      lore: "",
      meta: candidate.meta
    }));
  }

  function buildWaypointRouteCandidates(settlementAnchors, byId, byCoord, dimensions, riverData, settings) {
    const pairs = [];
    settlementAnchors.forEach((anchor, index) => {
      const nearest = settlementAnchors
        .filter((_, candidateIndex) => candidateIndex !== index)
        .map(other => ({
          from: anchor,
          to: other,
          distance: hexDistance(anchor.hex, other.hex)
        }))
        .filter(candidate => candidate.distance >= 5 && candidate.distance <= 14)
        .sort((a, b) => a.distance - b.distance || (b.to.importance || 0) - (a.to.importance || 0))
        .slice(0, 2);
      nearest.forEach(candidate => {
        const key = [candidate.from.hex.id, candidate.to.hex.id].sort().join(":");
        if (!pairs.some(existing => existing.key === key)) {
          pairs.push({ ...candidate, key });
        }
      });
    });

    return pairs
      .map(pair => {
        const path = findPoiLandPath(pair.from.hex.id, pair.to.hex.id, byId, byCoord);
        return path && path.length >= 7 ? { ...pair, path } : null;
      })
      .filter(Boolean);
  }

  function chooseWaypointIcon(record) {
    if (record.crossing) return "ford";
    if (record.pass) return "mountain_pass";
    if (record.corridorCount >= 3) return "market";
    return record.midpoint >= 0.65 ? "tavern" : "lodge";
  }

  function getWaypointTags(record) {
    const tags = ["rest"];
    if (record.corridorCount >= 2) tags.push("trade");
    if (record.corridorCount >= 3) tags.push("crossroads");
    else tags.push("roadside");
    if (record.crossing) tags.push("river_crossing");
    if (record.pass) tags.push("frontier");
    return coerceGeneratedTags(tags);
  }

  function getWaypointNotoriety(record, settlementDistance) {
    let value = record.corridorCount >= 3 ? 5 : 6;
    if (record.crossing) value -= 1;
    if (settlementDistance >= 5) value += 1;
    return String(Math.max(4, Math.min(9, value)));
  }

  function generateWaypointName(candidate, settings) {
    const seed = `${settings.seed}:waypoint-name:${candidate.hex.id}`;
    const routeNames = Array.isArray(candidate.meta?.routeNames) ? candidate.meta.routeNames.filter(Boolean) : [];
    const nearestSettlement = String(candidate.meta?.nearestSettlement || "").trim();
    const relatedBaseName = routeNames.length
      ? seededPick(routeNames, `${seed}:route-name`)
      : nearestSettlement;

    if (candidate.icon === "ford") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.58) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Ford", "Crossing", "Bridge"], ["Old", "Upper", "Lower", "Reed", "Willow", "North", "South"], {
          qualifierChance: 0.28
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Stone", "Grey", "Willow", "Reed", "Otter", "Low", "South", "North", "Alder", "White", "Moss", "Old", "Three", "Kings", "Bracken", "Lantern", "Bell", "Wayfarers"],
          suffixes: ["Ford", "Crossing", "Bridge"],
          forceSpace: true
        },
        {
          prefixes: ["Stone", "Grey", "Willow", "Otter", "Moss", "Alder", "Reed", "Kings"],
          suffixes: ["ford", "bridge", "cross"],
          forceSpace: false
        }
      ]);
    }

    if (candidate.icon === "mountain_pass") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.46) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Pass", "Gate", "Rest"], ["High", "Cold", "North", "South", "Old"], {
          qualifierChance: 0.24
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["High", "Wind", "Stone", "Cold", "Grey", "Wolf", "Iron", "North", "Raven", "Storm", "Cairn", "Frost", "Crag", "Sentinel", "Warden's", "Banner"],
          suffixes: ["Pass", "Gate", "Rest", "Watch"],
          forceSpace: true
        },
        {
          prefixes: ["High", "Cold", "Wolf", "Stone", "Frost", "Crag", "North", "Iron"],
          suffixes: ["gate", "rest", "watch"],
          forceSpace: false
        }
      ]);
    }

    if (candidate.icon === "market") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.44) {
        return `${relatedBaseName} ${seededPick(["Market", "Exchange", "Post", "Hall"], `${seed}:related-suffix`) || "Market"}`;
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Three Roads", "Crossways", "Wayfarers", "Old Road", "Greyroad", "Merchants", "King's Road", "South Road", "River Road", "Long Way", "Lantern", "Coin", "Guild", "Charter", "Mercers"],
          suffixes: ["Market", "Exchange", "Post", "Hall", "Court"],
          forceSpace: true
        }
      ]);
    }

    if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.42) {
      return `${relatedBaseName} ${seededPick(["Inn", "Lodge", "Roadhouse", "Rest", "Camp"], `${seed}:related-suffix`) || "Inn"}`;
    }

    return buildGeneratedPatternName(seed, [
      {
        prefixes: ["Three Pines", "Old Road", "Willow", "Moss", "Grey", "Wayfarers", "Traveler's", "South Road", "Northwatch", "Bracken", "Elm", "Reed", "Crosswind", "Lantern", "Bell", "Candle", "Gloam", "Vigil", "Pilgrim's", "Oath", "Whisper"],
        suffixes: ["Inn", "Lodge", "Roadhouse", "Rest", "Camp", "House", "Post", "Hall"],
        forceSpace: true
      },
      {
        prefixes: ["Lantern", "Bell", "Candle", "Gloam", "Whisper", "Rune", "Banner", "Vigil", "Wayfarers", "Pilgrim's", "Marshal's", "Warden's"],
        suffixes: ["Rest", "Post", "Watch", "Hall", "Lodge", "House"],
        forceSpace: true
      }
    ]);
  }

  function buildResourceSiteFallbackName(candidate) {
    const nearestSettlement = String(candidate?.meta?.nearestSettlement || "").trim();
    const label = String(candidate?.meta?.label || "Works").trim() || "Works";
    return nearestSettlement ? `${nearestSettlement} ${label}` : `Outlying ${label}`;
  }

  function buildWaypointFallbackName(candidate) {
    if (candidate?.icon === "ford") return "Stone Ford";
    if (candidate?.icon === "mountain_pass") return "High Pass";
    if (candidate?.icon === "market") return "Crossroads Market";
    return "Wayfarers Inn";
  }

  function getExistingPoiTypeCount(existingPois, typeValue) {
    const normalizedType = window.CampaignPoiTypes?.getStoredTypeValue?.(typeValue) || typeValue;
    const seen = new Set();
    return (existingPois || []).reduce((count, poi) => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type !== normalizedType) return count;
      const key = poi?.POI_Group_ID ? `group:${poi.POI_Group_ID}` : `poi:${poi?.POI_ID || count}`;
      if (seen.has(key)) return count;
      seen.add(key);
      return count + 1;
    }, 0);
  }

  function findNearestSettlementAnchor(hex, settlementAnchors) {
    let best = null;
    settlementAnchors.forEach(anchor => {
      if (!anchor?.hex) return;
      const distance = hexDistance(hex, anchor.hex);
      if (!best || distance < best.distance || (distance === best.distance && (anchor.importance || 0) > (best.anchor?.importance || 0))) {
        best = { anchor, distance };
      }
    });
    return best;
  }

  function isTooCloseToExistingPoi(hex, otherHexes, maxDistance) {
    return (otherHexes || []).some(otherHex => hexDistance(hex, otherHex) <= maxDistance);
  }

  function isPoiLandHex(hex) {
    return Boolean(hex && !isWaterBase(hex.baseTerrain));
  }

  function isViableSettlementHex(hex) {
    return Boolean(hex && isPoiLandHex(hex) && !["deep_desert", "wastes"].includes(hex.baseTerrain));
  }

  function hasRiverAccess(hex, nearby, riverData) {
    return riverData.riverHexIds.has(hex.id) || nearby.some(neighbor => riverData.riverHexIds.has(neighbor.id));
  }

  function getNearbyTerrainCount(neighborsList, terrains) {
    const allowed = new Set(terrains || []);
    return (neighborsList || []).filter(neighbor => allowed.has(neighbor.baseTerrain)).length;
  }

  function getTerrainFertility(baseTerrain, features = []) {
    const profile = TERRAIN_PROFILES[baseTerrain];
    let score = {
      lush_grassland: 1,
      grassland: 0.9,
      plains: 0.84,
      wetland: 0.62,
      jungle_floor: 0.7,
      beach: 0.24,
      barrens: 0.2,
      bleak_barrens: 0.12,
      desert: 0.08,
      deep_desert: 0.03,
      snow: 0.12,
      rock: 0.1,
      wastes: 0.04
    }[baseTerrain] ?? (profile?.group === "fertile" ? 0.8 : 0.25);
    if ((features || []).includes("farmland")) score += 0.18;
    if ((features || []).includes("forest")) score -= 0.05;
    return Math.max(0, Math.min(1.05, score));
  }

  function getTerrainRoughness(baseTerrain, features = []) {
    let score = {
      beach: 0.24,
      plains: 0.14,
      grassland: 0.12,
      lush_grassland: 0.16,
      wetland: 0.58,
      jungle_floor: 0.66,
      desert: 0.38,
      deep_desert: 0.54,
      barrens: 0.42,
      bleak_barrens: 0.48,
      snow: 0.58,
      rock: 0.84,
      wastes: 0.72
    }[baseTerrain] ?? 0.5;
    if ((features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"].includes(feature))) score += 0.14;
    if ((features || []).some(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature))) score += 0.08;
    if ((features || []).includes("farmland")) score -= 0.06;
    return Math.max(0.05, Math.min(1, score));
  }

  function distanceToMapEdge(hex, dimensions) {
    return Math.min(
      Math.abs(hex.x - dimensions.minX),
      Math.abs(dimensions.maxX - hex.x),
      Math.abs(hex.y - dimensions.minY),
      Math.abs(dimensions.maxY - hex.y)
    );
  }

  function hexDistance(left, right) {
    if (!left || !right) return Infinity;
    const leftCube = offsetToCube(left.x, left.y);
    const rightCube = offsetToCube(right.x, right.y);
    return Math.max(
      Math.abs(leftCube.x - rightCube.x),
      Math.abs(leftCube.y - rightCube.y),
      Math.abs(leftCube.z - rightCube.z)
    );
  }

  function offsetToCube(x, y) {
    const z = y - ((x + (x & 1)) >> 1);
    const cubeY = -x - z;
    return { x, y: cubeY, z };
  }

  function findPoiLandPath(startHexId, goalHexId, byId, byCoord) {
    const start = byId.get(startHexId);
    const goal = byId.get(goalHexId);
    if (!start || !goal) return null;
    const open = [{ hex: start, f: 0 }];
    const openIds = new Set([start.id]);
    const cameFrom = new Map();
    const gScore = new Map([[start.id, 0]]);

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()?.hex;
      if (!current) break;
      openIds.delete(current.id);
      if (current.id === goal.id) return reconstructPoiPath(cameFrom, current.id);

      neighbors(current, byCoord).forEach(neighbor => {
        if (!isPoiLandHex(neighbor)) return;
        const tentative = (gScore.get(current.id) || 0) + 1 + getTerrainRoughness(neighbor.baseTerrain, neighbor.features) * 1.8;
        if (tentative >= (gScore.get(neighbor.id) ?? Infinity)) return;
        cameFrom.set(neighbor.id, current.id);
        gScore.set(neighbor.id, tentative);
        const f = tentative + hexDistance(neighbor, goal);
        if (!openIds.has(neighbor.id)) {
          open.push({ hex: neighbor, f });
          openIds.add(neighbor.id);
        }
      });
    }

    return null;
  }

  function reconstructPoiPath(cameFrom, currentId) {
    const path = [currentId];
    let cursor = currentId;
    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor);
      path.unshift(cursor);
    }
    return path;
  }

  function lowerCaseGeneratedNamePart(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function buildGeneratedPatternName(seed, patterns, usedNames = null) {
    const availablePatterns = Array.isArray(patterns) && patterns.length
      ? patterns
      : [{
          prefixes: ["Grey", "Stone", "Oak", "Kings"],
          suffixes: ["wick", "ford", "stead", "mere"],
          forceSpace: false
        }];
    const pattern = seededPick(availablePatterns, `${seed}:pattern`) || availablePatterns[0];
    return buildGeneratedCompositeName(seed, pattern.prefixes, pattern.suffixes, usedNames, { forceSpace: pattern.forceSpace === true });
  }

  function buildRelatedGeneratedSiteName(seed, anchorName, suffixes, qualifiers = [], options = {}) {
    const baseName = String(anchorName || "").trim();
    if (!baseName) return "";
    const suffix = seededPick(suffixes, `${seed}:related-suffix`) || "Site";
    const qualifier = Array.isArray(qualifiers) && qualifiers.length && seededUnit(`${seed}:related-qualifier-roll`) < (options.qualifierChance ?? 0.42)
      ? seededPick(qualifiers, `${seed}:related-qualifier`)
      : "";
    if (!qualifier) return `${baseName} ${suffix}`;
    return options.qualifierAfter
      ? `${baseName} ${qualifier} ${suffix}`
      : `${qualifier} ${baseName} ${suffix}`;
  }

  function buildGeneratedCompositeName(seed, prefixes, suffixes, usedNames = null, options = {}) {
    const prefix = seededPick(prefixes, `${seed}:prefix`) || "Grey";
    const suffix = seededPick(suffixes, `${seed}:suffix`) || "wick";
    const separator = options.forceSpace === true
      ? " "
      : options.forceSpace === false
        ? ""
        : /^(Camp|Cut|Mine|Mill|Port|Quay|Rest|Vale|Keep|Peak|Gate|Bridge|Crossing|Fields|Farms|Docks|Fishery|Stoneworks|Market|Exchange|Post|Inn|Lodge|Roadhouse|Hall|Harbor|Pass|Watch)$/.test(suffix)
          ? " "
          : "";
    const suffixText = separator ? suffix : lowerCaseGeneratedNamePart(suffix);
    return `${prefix}${separator}${suffixText}`;
  }

  function reserveGeneratedName(preferredName, usedNames, fallbackName, options = {}) {
    const baseName = String(preferredName || "").trim() || String(fallbackName || "").trim() || "New Place";
    const normalizedBase = normalizeGeneratedNameKey(baseName);
    if (!usedNames.has(normalizedBase)) {
      usedNames.add(normalizedBase);
      return baseName;
    }

    const fallbackLabel = String(fallbackName || baseName).trim() || baseName;
    const seed = String(options.seed || `${baseName}|${fallbackLabel}`);
    const baseVariants = [...new Set([baseName, fallbackLabel].map(value => String(value || "").trim()).filter(Boolean))];
    const prefixVariants = ["North", "South", "East", "West", "Upper", "Lower", "Old", "Outer", "High", "Low", "River", "Hill", "Far", "Near", "Red", "White", "Grey", "Black"];
    const suffixVariants = ["Watch", "Gate", "Market", "Rest", "Reach", "Cross", "Point", "End", "View", "Hold", "Landing", "Bridge"];

    for (let index = 0; index < prefixVariants.length * baseVariants.length; index += 1) {
      const base = baseVariants[index % baseVariants.length];
      const qualifier = prefixVariants[(hashNumber(`${seed}:prefix:${index}`) + index) % prefixVariants.length];
      const candidate = normalizeGeneratedNameKey(base).startsWith(normalizeGeneratedNameKey(qualifier))
        ? base
        : `${qualifier} ${base}`;
      const key = normalizeGeneratedNameKey(candidate);
      if (usedNames.has(key)) continue;
      usedNames.add(key);
      return candidate;
    }

    for (let index = 0; index < suffixVariants.length * baseVariants.length; index += 1) {
      const base = baseVariants[index % baseVariants.length];
      const suffix = suffixVariants[(hashNumber(`${seed}:suffix:${index}`) + index) % suffixVariants.length];
      const candidate = normalizeGeneratedNameKey(base).endsWith(normalizeGeneratedNameKey(suffix))
        ? base
        : `${base} ${suffix}`;
      const key = normalizeGeneratedNameKey(candidate);
      if (usedNames.has(key)) continue;
      usedNames.add(key);
      return candidate;
    }

    for (let index = 0; index < 10; index += 1) {
      const candidate = buildGeneratedPatternName(`${seed}:final:${index}`, [
        {
          prefixes: ["Grey", "Stone", "Oak", "Kings", "Queens", "Willow", "Raven", "Amber", "Deep", "Bracken", "Lantern", "Crown", "Guild", "Saint", "Gloam", "Rune", "Banner"],
          suffixes: ["ford", "stead", "reach", "wick", "cross", "watch", "mark", "gate", "rest", "mere", "burg", "vale", "dale", "ward", "hall"],
          forceSpace: false
        },
        {
          prefixes: ["Old", "Upper", "Lower", "North", "South", "West", "East", "Crossways", "Wayfarers", "Lantern", "Guild", "Pilgrim's", "Marshal's"],
          suffixes: ["Market", "Bridge", "Watch", "Rest", "Hall", "Gate", "Post"],
          forceSpace: true
        }
      ]);
      const key = normalizeGeneratedNameKey(candidate);
      if (usedNames.has(key)) continue;
      usedNames.add(key);
      return candidate;
    }

    usedNames.add(normalizeGeneratedNameKey(fallbackLabel));
    return fallbackLabel;
  }

  function normalizeGeneratedNameKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  }

  function randomIntegerFromSeed(seed, min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const value = seededUnit(seed);
    return Math.round(low + value * (high - low));
  }

  function formatGeneratedPopulation(value) {
    const numeric = Math.max(0, Math.round(Number(value) || 0));
    return numeric ? numeric.toLocaleString("en-US") : "";
  }

  function parsePopulationNumber(value) {
    const match = String(value || "").replace(/,/g, "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function coerceGeneratedTags(values) {
    return window.CampaignPoiTags?.coerceTagValues?.(values) || [];
  }

  function seededUnit(seed) {
    return (hashNumber(String(seed || "")) % 100000) / 100000;
  }

  function seededNoise(seed, min, max) {
    return min + seededUnit(seed) * (max - min);
  }

  function seededPick(options, seed) {
    if (!Array.isArray(options) || !options.length) return "";
    return options[Math.floor(seededUnit(seed) * options.length)] || options[0];
  }

  window.CampaignGeneratedMapGenerator = {
    generateNaturalTerrain,
    generatePoiDrafts,
    hashNumber
  };
})();
