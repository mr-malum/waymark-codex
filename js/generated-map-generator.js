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
  let activeGeneratedNameUsage = null;
  const GENERATED_ICON_TRAIT_TAGS = Object.freeze({
    trade: "trade",
    fishing: "fishing",
    farming: "farming",
    crossroads: "crossroads",
    crossing: "river_crossing",
    frontier: "frontier",
    borderland: "borderland",
    mining: "mining",
    stonework: "craftwork",
    craftwork: "craftwork",
    worship: "worship",
    research: "research",
    underground: "underground",
    monster_lair: "monster_lair",
    remote: "remote",
    roadside: "roadside"
  });
  const SITE_POI_TYPES = Object.freeze(["ruin", "holy_site", "arcane_site", "wilderness_site", "hazard", "landmark"]);

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
      settlementDensity: clamp(options.settlementDensity, 0, 1, 0.5),
      populationConcentration: clamp(options.populationConcentration, 0.5, 1.5, 1),
      resourceAmount: clamp(options.resourceAmount, 0, 1, 0.5),
      waypointAmount: clamp(options.waypointAmount, 0, 1, 0.5),
      strongholdAmount: clamp(options.strongholdAmount, 0, 1, 0.5),
      dungeonAmount: clamp(options.dungeonAmount, 0, 1, 0.5),
      dungeonComplexAmount: clamp(options.dungeonComplexAmount, 0, 1, 0.5),
      siteAmount: clamp(options.siteAmount, 0, 1, 0.5)
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
    activeGeneratedNameUsage = createGeneratedNameUsageTracker();

    try {
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
        .filter(candidate => candidate && candidate.score >= getSettlementCandidateEntryFloor(candidate, settlementScoreFloor));

      const targetSettlements = getTargetSettlementCount(candidateHexes, settings, existingSettlementAnchors.length);
      const settlementDrafts = buildSettlementDrafts({
        candidates: settlementCandidates,
        targetCount: targetSettlements,
        existingAnchors: existingSettlementAnchors,
        occupiedHexIds,
        settings,
        usedNames,
        random,
        dimensions
      }).slice(0, targetSettlements);

      settlementDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

      const settlementAnchors = [
        ...existingSettlementAnchors,
        ...settlementDrafts.map((draft, index) => makeGeneratedSettlementAnchor(draft, index))
      ];
      const existingStrongholdAnchors = getExistingStrongholdAnchors(existingPois, byId);

      const strongholdDrafts = buildStrongholdDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        occupiedHexIds,
        byCoord,
        dimensions,
        riverData,
        settings,
        usedNames,
        existingPois
      });
      strongholdDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));
      const strongholdAnchors = [
        ...existingStrongholdAnchors,
        ...strongholdDrafts.map((draft, index) => makeGeneratedStrongholdAnchor(draft, index, byId))
      ];

      const dungeonComplexDrafts = buildDungeonDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        occupiedHexIds,
        byCoord,
        dimensions,
        riverData,
        settings,
        usedNames,
        existingPois,
        complex: true
      });
      dungeonComplexDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

      const dungeonDrafts = buildDungeonDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        occupiedHexIds,
        byCoord,
        dimensions,
        riverData,
        settings,
        usedNames,
        existingPois,
        complex: false
      });
      dungeonDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

      const siteDrafts = buildSiteDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        occupiedHexIds,
        byCoord,
        dimensions,
        riverData,
        settings,
        usedNames,
        existingPois
      });
      siteDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

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

      return [...settlementDrafts, ...strongholdDrafts, ...dungeonComplexDrafts, ...dungeonDrafts, ...siteDrafts, ...resourceDrafts, ...waypointDrafts].map(({ meta, ...draft }) => draft);
    } finally {
      activeGeneratedNameUsage = null;
    }
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

  function getStrongholdAnchorImportance(icon) {
    const normalizedIcon = String(icon || "").trim();
    if (normalizedIcon === "mountain_gate") return 0.96;
    if (normalizedIcon === "castle") return 0.86;
    if (normalizedIcon === "sea_fort" || normalizedIcon === "fort") return 0.8;
    if (normalizedIcon === "watchtower" || normalizedIcon === "stone_tower") return 0.72;
    if (normalizedIcon === "walled_encampment") return 0.62;
    return 0.7;
  }

  function getExistingStrongholdAnchors(existingPois, byId) {
    const byPlace = new Map();
    (existingPois || []).forEach(poi => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type !== "stronghold") return;
      const hex = byId.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const placeKey = poi?.POI_Group_ID ? `group:${poi.POI_Group_ID}` : `poi:${poi?.POI_ID || hex.id}`;
      const normalizedIcon = window.CampaignPoiIcons?.getStoredIconValue?.(
        poi?.POI_Icon || poi?.Group_Icon || poi?.Icon_Name || poi?.Icon || poi?.icon || ""
      ) || "fort";
      const notoriety = Number(window.CampaignPoiTypes?.normalizeNotorietyValue?.(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"] || "") || 7);
      const existing = byPlace.get(placeKey);
      const candidate = {
        id: poi?.POI_ID || placeKey,
        hex,
        icon: normalizedIcon,
        notoriety,
        name: String(poi?.Name || "").trim() || "Stronghold"
      };
      if (!existing || candidate.notoriety < existing.notoriety || (candidate.notoriety === existing.notoriety && candidate.name.localeCompare(existing.name) < 0)) {
        byPlace.set(placeKey, candidate);
      }
    });
    return [...byPlace.values()].map((anchor, index) => ({
      id: anchor.id || `existing-stronghold-${index}`,
      hex: anchor.hex,
      icon: anchor.icon,
      importance: getStrongholdAnchorImportance(anchor.icon),
      notoriety: String(Math.max(1, Math.min(10, anchor.notoriety || 7))),
      name: anchor.name
    }));
  }

  function getTargetSettlementCount(candidateHexes, settings, existingCount = 0) {
    const viableCount = candidateHexes.filter(hex => isViableSettlementHex(hex)).length;
    const totalTarget = Math.max(0, Math.min(40, Math.round((viableCount / 72) * settings.settlementDensity)));
    return Math.max(0, totalTarget - Math.max(0, existingCount));
  }

  function getTargetResourceSiteCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const totalTarget = settlementAnchors.length
      ? Math.round(settlementAnchors.length * 1.05 * settings.resourceAmount)
      : Math.round(candidateHexes.length / 96 * settings.resourceAmount);
    return Math.max(0, Math.min(32, totalTarget) - Math.max(0, existingCount));
  }

  function getTargetWaypointCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const totalTarget = settlementAnchors.length >= 2
      ? Math.round(settlementAnchors.length * 1.0 * settings.waypointAmount)
      : Math.round(candidateHexes.length / 120 * settings.waypointAmount);
    return Math.max(0, Math.min(24, totalTarget) - Math.max(0, existingCount));
  }

  function getTargetStrongholdCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const terrainTarget = Math.round((candidateHexes.length / 220) * settings.strongholdAmount);
    const settlementTarget = settlementAnchors.length
      ? Math.round(settlementAnchors.length * 0.22 * settings.strongholdAmount)
      : 0;
    const totalTarget = Math.max(terrainTarget, settlementTarget);
    return Math.max(0, Math.min(12, totalTarget) - Math.max(0, existingCount));
  }

  function getTargetDungeonComplexCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 720) * settings.dungeonComplexAmount);
    return Math.max(0, Math.min(4, totalTarget) - Math.max(0, existingCount));
  }

  function getTargetDungeonCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 260) * settings.dungeonAmount);
    return Math.max(0, Math.min(10, totalTarget) - Math.max(0, existingCount));
  }

  function getTargetSiteCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 92) * settings.siteAmount);
    return Math.max(0, Math.min(18, totalTarget) - Math.max(0, existingCount));
  }

  function getSettlementCandidateScoreFloor(settings) {
    const density = settings?.settlementDensity ?? 1;
    return clamp(0.24 - (density - 1) * 0.10, 0.16, 0.32, 0.24);
  }

  function getSettlementCandidateEntryFloor(candidate, defaultFloor) {
    if (!candidate) return defaultFloor;
    if (String(candidate.hex?.baseTerrain || "").trim() === "snow" || Number(candidate.snowSettlementBias || 0) >= 0.14) {
      return Math.max(0.08, defaultFloor - 0.12);
    }
    return defaultFloor;
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

  function getPoiVariantDiminishingFactor(icon, count) {
    if (count <= 0) return 1;
    const normalizedIcon = String(icon || "").trim();
    const rareVariant = [
      "dragon_lair",
      "wizard_tower",
      "arcane_portal",
      "ley_nexus",
      "ziggurat",
      "mausoleum",
      "lighthouse"
    ].includes(normalizedIcon);
    if (rareVariant) {
      return count === 1
        ? 0.3
        : count === 2
          ? 0.14
          : count === 3
            ? 0.07
            : 0.04;
    }
    return count === 1
      ? 0.58
      : count === 2
        ? 0.34
        : count === 3
          ? 0.2
          : count === 4
            ? 0.12
            : 0.08;
  }

  function getPoiRegionalCrowdingPenalty(hex, chosen, options = {}) {
    if (!hex || !Array.isArray(chosen) || !chosen.length) return 0;
    const radius = Math.max(2, Number(options.radius || 0) || 6);
    const stepPenalty = Math.max(0.01, Number(options.stepPenalty || 0) || 0.05);
    const maxPenalty = Math.max(stepPenalty, Number(options.maxPenalty || 0) || 0.24);
    let penalty = 0;
    chosen.forEach(entry => {
      const otherHex = entry?.hex || entry;
      if (!otherHex) return;
      const distance = hexDistance(hex, otherHex);
      if (!Number.isFinite(distance) || distance <= 0 || distance > radius) return;
      penalty += ((radius - distance + 1) / radius) * stepPenalty;
    });
    return Math.min(maxPenalty, penalty);
  }

  function getPoiCoverageFactor(hex, chosen, dimensions, options = {}) {
    if (!hex || !dimensions || !Array.isArray(chosen) || !chosen.length) return 1.18;
    const width = Math.max(1, Number(dimensions.maxX) - Number(dimensions.minX) + 1);
    const height = Math.max(1, Number(dimensions.maxY) - Number(dimensions.minY) + 1);
    const cols = Math.max(2, Number(options.cols || 0) || (width >= 28 ? 4 : 3));
    const rows = Math.max(2, Number(options.rows || 0) || (height >= 28 ? 4 : 3));
    const sectorX = Math.max(0, Math.min(cols - 1, Math.floor(((Number(hex.x) - Number(dimensions.minX)) / width) * cols)));
    const sectorY = Math.max(0, Math.min(rows - 1, Math.floor(((Number(hex.y) - Number(dimensions.minY)) / height) * rows)));
    let count = 0;
    chosen.forEach(entry => {
      const otherHex = entry?.hex || entry;
      if (!otherHex) return;
      const otherSectorX = Math.max(0, Math.min(cols - 1, Math.floor(((Number(otherHex.x) - Number(dimensions.minX)) / width) * cols)));
      const otherSectorY = Math.max(0, Math.min(rows - 1, Math.floor(((Number(otherHex.y) - Number(dimensions.minY)) / height) * rows)));
      if (otherSectorX === sectorX && otherSectorY === sectorY) count += 1;
    });
    return count <= 0
      ? 1.2
      : count === 1
        ? 1.08
        : count === 2
          ? 0.92
          : count === 3
            ? 0.8
            : 0.7;
  }

  function getPoiSectorKey(hex, dimensions, options = {}) {
    if (!hex || !dimensions) return "";
    const width = Math.max(1, Number(dimensions.maxX) - Number(dimensions.minX) + 1);
    const height = Math.max(1, Number(dimensions.maxY) - Number(dimensions.minY) + 1);
    const cols = Math.max(2, Number(options.cols || 0) || (width >= 28 ? 4 : 3));
    const rows = Math.max(2, Number(options.rows || 0) || (height >= 28 ? 4 : 3));
    const sectorX = Math.max(0, Math.min(cols - 1, Math.floor(((Number(hex.x) - Number(dimensions.minX)) / width) * cols)));
    const sectorY = Math.max(0, Math.min(rows - 1, Math.floor(((Number(hex.y) - Number(dimensions.minY)) / height) * rows)));
    return `${sectorX}:${sectorY}`;
  }

  function bumpPoiUsageCount(usageMap, key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return 0;
    const nextValue = (usageMap.get(normalizedKey) || 0) + 1;
    usageMap.set(normalizedKey, nextValue);
    return nextValue;
  }

  function getPoiContextCoverageFactor(contextKey, usageMap, options = {}) {
    const normalizedKey = String(contextKey || "").trim();
    if (!normalizedKey || !(usageMap instanceof Map)) return 1;
    const count = usageMap.get(normalizedKey) || 0;
    const emptyFactor = Number.isFinite(Number(options.emptyFactor)) ? Number(options.emptyFactor) : 1.14;
    const lightFactor = Number.isFinite(Number(options.lightFactor)) ? Number(options.lightFactor) : 1.03;
    const mediumFactor = Number.isFinite(Number(options.mediumFactor)) ? Number(options.mediumFactor) : 0.9;
    const heavyFactor = Number.isFinite(Number(options.heavyFactor)) ? Number(options.heavyFactor) : 0.8;
    const crowdedFactor = Number.isFinite(Number(options.crowdedFactor)) ? Number(options.crowdedFactor) : 0.72;
    return count <= 0
      ? emptyFactor
      : count === 1
        ? lightFactor
        : count === 2
          ? mediumFactor
          : count === 3
            ? heavyFactor
            : crowdedFactor;
  }

  function buildPoiHabitatTargets(candidates, targetCount, getHabitatKey, options = {}) {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    if (!list.length || !targetCount || typeof getHabitatKey !== "function") return new Map();
    const minimumShare = Number.isFinite(Number(options.minimumShare)) ? Number(options.minimumShare) : 0.16;
    const minimumCount = Number.isFinite(Number(options.minimumCount)) ? Number(options.minimumCount) : 3;
    const availability = new Map();
    list.forEach(candidate => {
      const key = String(getHabitatKey(candidate) || "").trim();
      if (!key) return;
      availability.set(key, (availability.get(key) || 0) + 1);
    });
    const totalAvailable = Math.max(1, [...availability.values()].reduce((sum, count) => sum + count, 0));
    const targets = new Map();
    let assigned = 0;
    [...availability.entries()].forEach(([key, count]) => {
      const share = count / totalAvailable;
      let target = Math.round(targetCount * share);
      if (count >= minimumCount && share >= minimumShare) {
        target = Math.max(1, target);
      }
      if (target > 0) {
        targets.set(key, target);
        assigned += target;
      }
    });
    while (assigned > targetCount) {
      const worst = [...targets.entries()]
        .filter(([, count]) => count > 0)
        .sort((left, right) => right[1] - left[1])[0];
      if (!worst) break;
      targets.set(worst[0], worst[1] - 1);
      if (targets.get(worst[0]) <= 0) targets.delete(worst[0]);
      assigned -= 1;
    }
    while (assigned < targetCount) {
      const best = [...availability.entries()]
        .sort((left, right) => {
          const leftDeficit = left[1] - (targets.get(left[0]) || 0);
          const rightDeficit = right[1] - (targets.get(right[0]) || 0);
          return rightDeficit - leftDeficit || right[1] - left[1];
        })[0];
      if (!best) break;
      targets.set(best[0], (targets.get(best[0]) || 0) + 1);
      assigned += 1;
    }
    return targets;
  }

  function getPoiHabitatNeedFactor(candidate, habitatTargets, habitatUsage, getHabitatKey, options = {}) {
    if (!(habitatTargets instanceof Map) || !(habitatUsage instanceof Map) || typeof getHabitatKey !== "function") return 1;
    const key = String(getHabitatKey(candidate) || "").trim();
    if (!key) return 1;
    const target = habitatTargets.get(key) || 0;
    const usage = habitatUsage.get(key) || 0;
    const underfillFactor = Number.isFinite(Number(options.underfillFactor)) ? Number(options.underfillFactor) : 1.34;
    const atTargetFactor = Number.isFinite(Number(options.atTargetFactor)) ? Number(options.atTargetFactor) : 0.88;
    const overTargetFactor = Number.isFinite(Number(options.overTargetFactor)) ? Number(options.overTargetFactor) : 0.7;
    const missingFactor = Number.isFinite(Number(options.missingFactor)) ? Number(options.missingFactor) : 0.82;
    if (target <= 0) return missingFactor;
    if (usage < target) {
      const remaining = Math.max(1, target - usage);
      return underfillFactor + Math.min(0.18, (remaining - 1) * 0.05);
    }
    if (usage === target) return atTargetFactor;
    return overTargetFactor;
  }

  function bumpPoiHabitatUsage(candidate, habitatUsage, getHabitatKey) {
    if (!(habitatUsage instanceof Map) || typeof getHabitatKey !== "function") return;
    const key = String(getHabitatKey(candidate) || "").trim();
    if (!key) return;
    habitatUsage.set(key, (habitatUsage.get(key) || 0) + 1);
  }

  function chooseBestPoiCandidate(remaining, occupiedHexIds, filterFn, scoreFn, minimumScore) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    remaining.forEach((candidate, index) => {
      if (!candidate?.hex || occupiedHexIds.has(candidate.hex.id)) return;
      if (typeof filterFn === "function" && !filterFn(candidate)) return;
      const score = Number(scoreFn(candidate, index));
      if (!Number.isFinite(score)) return;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex < 0 || bestScore < minimumScore) return null;
    const [candidate] = remaining.splice(bestIndex, 1);
    return { candidate, effectiveScore: bestScore };
  }

  function selectPoiCandidatesByHabitat({
    candidates,
    targetCount,
    chosen = [],
    occupiedHexIds,
    habitatKeyFn,
    habitatTargetOptions,
    minimumScore,
    dimensions,
    sectorOptions,
    habitatMinimumScoreFn,
    scoreFn,
    onChoose
  }) {
    const remaining = Array.isArray(candidates) ? [...candidates] : [];
    const habitatTargets = buildPoiHabitatTargets(remaining, targetCount, habitatKeyFn, habitatTargetOptions);
    const habitatEntries = [...habitatTargets.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const habitatSectorUsage = new Map();

    const getHabitatSectorFactor = (candidate, habitatKey) => {
      const sectorKey = getPoiSectorKey(candidate?.hex, dimensions, sectorOptions);
      if (!sectorKey) return 1;
      const sectorUsage = habitatSectorUsage.get(habitatKey) || new Map();
      const count = sectorUsage.get(sectorKey) || 0;
      return count <= 0
        ? 1.34
        : count === 1
          ? 0.94
          : count === 2
            ? 0.78
            : 0.66;
    };

    const registerHabitatSectorUsage = (candidate, habitatKey) => {
      const sectorKey = getPoiSectorKey(candidate?.hex, dimensions, sectorOptions);
      if (!sectorKey) return;
      let sectorUsage = habitatSectorUsage.get(habitatKey);
      if (!(sectorUsage instanceof Map)) {
        sectorUsage = new Map();
        habitatSectorUsage.set(habitatKey, sectorUsage);
      }
      sectorUsage.set(sectorKey, (sectorUsage.get(sectorKey) || 0) + 1);
    };

    habitatEntries.forEach(([habitatKey, target]) => {
      let remainingTarget = target;
      while (remainingTarget > 0 && chosen.length < targetCount) {
        const localMinimum = typeof habitatMinimumScoreFn === "function"
          ? habitatMinimumScoreFn(habitatKey, minimumScore)
          : minimumScore;
        const picked = chooseBestPoiCandidate(
          remaining,
          occupiedHexIds,
          candidate => String(habitatKeyFn(candidate) || "").trim() === habitatKey,
          candidate => scoreFn(candidate) * getHabitatSectorFactor(candidate, habitatKey),
          localMinimum
        );
        if (!picked) break;
        chosen.push(picked.candidate);
        registerHabitatSectorUsage(picked.candidate, habitatKey);
        if (typeof onChoose === "function") onChoose(picked.candidate, picked.effectiveScore);
        remainingTarget -= 1;
      }
    });

    while (chosen.length < targetCount) {
      const picked = chooseBestPoiCandidate(
        remaining,
        occupiedHexIds,
        null,
        scoreFn,
        minimumScore
      );
      if (!picked) break;
      chosen.push(picked.candidate);
      const habitatKey = String(habitatKeyFn(picked.candidate) || "").trim();
      if (habitatKey) registerHabitatSectorUsage(picked.candidate, habitatKey);
      if (typeof onChoose === "function") onChoose(picked.candidate, picked.effectiveScore);
    }

    return chosen;
  }

  function getSettlementHabitatKey(candidate) {
    if (!candidate) return "";
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    if (baseTerrain === "snow" || candidate.snowSettlementBias >= 0.14) return "snow";
    if (candidate.mountainHex && candidate.mountainInteriorStrength >= 0.28) return "mountain";
    if (baseTerrain === "wetland") return "wetland";
    if (candidate.coastal) return "coastal";
    if (candidate.inlandWater || candidate.onRiverHex || candidate.riverAccess) return "riverland";
    if (candidate.fertility >= 0.74 && candidate.routeability >= 0.52 && !candidate.highland) return "greenland";
    if (["barrens", "bleak_barrens", "desert", "deep_desert", "wastes"].includes(baseTerrain)) return "dryland";
    if (candidate.frontier) return "frontier";
    return "inland";
  }

  function getStrongholdHabitatKey(candidate) {
    if (!candidate) return "";
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    if (baseTerrain === "snow" || candidate.snowStrongholdBias >= 0.14) return "snow";
    if (candidate.mountainHex && candidate.mountainInteriorStrength >= 0.24) return "mountain";
    if (candidate.coastal) return "coastal";
    if (candidate.onRiverHex || candidate.riverNearby) return "riverland";
    if (candidate.frontier) return "frontier";
    if (candidate.chokepoint >= 0.76 || candidate.passStrength > 0) return "chokepoint";
    return "inland";
  }

  function getDungeonHabitatKey(candidate) {
    if (!candidate) return "";
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    const snowAffinity = Number(candidate.snowAffinity ?? candidate.meta?.snowAffinity ?? 0);
    const mountainInterior = Number(candidate.mountainInterior ?? candidate.meta?.mountainInterior ?? 0);
    const mountainAffinity = Number(candidate.mountainAffinity ?? candidate.meta?.mountainAffinity ?? 0);
    if (baseTerrain === "snow" || snowAffinity >= 0.46) return "snow";
    if (mountainInterior >= 0.34 || mountainAffinity >= 0.56) return "mountain";
    if (["wastes", "bleak_barrens", "deep_desert"].includes(baseTerrain)) return "waste";
    if (baseTerrain === "wetland") return "wetland";
    return "remote";
  }

  function getSiteHabitatKey(candidate) {
    if (!candidate) return "";
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    const snowAffinity = Number(candidate.snowAffinity ?? candidate.meta?.snowAffinity ?? 0);
    const greenAffinity = Number(candidate.greenAffinity ?? candidate.meta?.greenAffinity ?? 0);
    const coastalWaterAdjacent = Number(candidate.coastalWaterAdjacent ?? candidate.meta?.coastalWaterAdjacent ?? 0);
    const mountainInterior = Number(candidate.mountainInterior ?? candidate.meta?.mountainInterior ?? 0);
    const mountainAffinity = Number(candidate.mountainAffinity ?? candidate.meta?.mountainAffinity ?? 0);
    if (baseTerrain === "snow" || snowAffinity >= 0.46) return "snow";
    if (baseTerrain === "wetland") return "wetland";
    if (["wastes", "bleak_barrens", "deep_desert"].includes(baseTerrain)) return "waste";
    if (["coastal_water", "sea", "deep_sea"].includes(baseTerrain) || coastalWaterAdjacent > 0) return "coastal";
    if (greenAffinity >= 0.48) return "greenland";
    if (mountainInterior >= 0.3 || mountainAffinity >= 0.56) return "mountain";
    return "inland";
  }

  function getSettlementCandidateContextKey(candidate) {
    if (!candidate) return "";
    if (candidate.mountainHex && candidate.mountainInteriorStrength >= 0.28) return "mountain";
    if (candidate.hex?.baseTerrain === "snow" || candidate.snowSettlementBias >= 0.1) return "snow";
    if (candidate.coastal) return "coastal";
    if (candidate.inlandWater || candidate.onRiverHex) return "waterside";
    if (candidate.fertility >= 0.74 && candidate.routeability >= 0.54 && !candidate.highland) return "greenland";
    if (candidate.frontier) return "frontier";
    if (candidate.routeability >= 0.6) return "corridor";
    return "inland";
  }

  function getResourceCandidateContextKey(candidate) {
    const kind = String(candidate?.meta?.kind || "").trim();
    if (kind) return kind;
    return String(candidate?.icon || "").trim();
  }

  function getWaypointCandidateContextKey(candidate) {
    if (!candidate?.meta) return String(candidate?.icon || "").trim();
    if (candidate.meta.crossing) return "crossing";
    if (candidate.meta.pass) return "pass";
    if (candidate.meta.frontier && (candidate.icon === "lodge" || candidate.icon === "campsite")) return "frontier_rest";
    if (candidate.icon === "market") return "trade_stop";
    if (candidate.icon === "inn" || candidate.icon === "tavern" || candidate.icon === "lodge" || candidate.icon === "campsite") return "rest_stop";
    return String(candidate.icon || "").trim();
  }

  function getPoiVariantHardCap(icon) {
    if (String(icon || "").trim() === "dragon_lair") return 1;
    return Infinity;
  }

  function buildSettlementDrafts({ candidates, targetCount, existingAnchors, occupiedHexIds, settings, usedNames, random, dimensions }) {
    const chosen = [];
    const contextUsage = new Map();
    const habitatUsage = new Map();
    const selectionFloor = getSettlementSelectionFloor(settings);
    selectPoiCandidatesByHabitat({
      candidates,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getSettlementHabitatKey,
      habitatTargetOptions: { minimumShare: 0.14, minimumCount: 3 },
      minimumScore: selectionFloor,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? Math.max(0.04, floor - 0.12)
        : habitatKey === "dryland"
          ? Math.max(0.08, floor - 0.06)
          : floor,
      scoreFn: candidate => {
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const contextFactor = getPoiContextCoverageFactor(
          getSettlementCandidateContextKey(candidate),
          contextUsage,
          { emptyFactor: 1.18, lightFactor: 1.05, mediumFactor: 0.9, heavyFactor: 0.8, crowdedFactor: 0.72 }
        );
        return candidate.score * coverageFactor * contextFactor
          - getSettlementSpacingPenalty(candidate.hex, chosen, existingAnchors, settings)
          + seededNoise(`${settings.seed}:settlement-candidate:${candidate.hex.id}`, -0.04, 0.04);
      },
      onChoose: (candidate, adjustedScore) => {
        candidate.adjustedScore = adjustedScore;
        bumpPoiUsageCount(contextUsage, getSettlementCandidateContextKey(candidate));
        bumpPoiHabitatUsage(candidate, habitatUsage, getSettlementHabitatKey);
        occupiedHexIds.add(candidate.hex.id);
      }
    });

    const ranked = chosen
      .sort((a, b) => b.adjustedScore - a.adjustedScore || a.hex.id.localeCompare(b.hex.id))
      .map((candidate, index, list) => {
        const sizeTier = getSettlementSizeTier(index, list.length);
        const populationValue = generateSettlementPopulation(sizeTier, index, list.length, settings, candidate);
        const population = formatGeneratedPopulation(populationValue);
        const visualTier = getSettlementVisualTier(populationValue, settings, sizeTier);
        const icon = chooseSettlementIcon(candidate, sizeTier, visualTier);
        const tags = getGeneratedSettlementTags(candidate, sizeTier, icon);
        const notoriety = getGeneratedSettlementNotoriety(candidate, sizeTier, index, list.length);
        const name = reserveGeneratedName(
          generateSettlementName(candidate, sizeTier, settings, usedNames, icon),
          usedNames,
          buildSettlementFallbackName(candidate, sizeTier, icon),
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

  function makeGeneratedStrongholdAnchor(draft, index, byId) {
    const hex = draft?.meta?.hex
      ? { ...draft.meta.hex }
      : byId?.get(draft?.hexId || "") || { id: draft?.hexId || "" };
    return {
      id: `generated-stronghold-${index}:${draft?.hexId || index}`,
      hex,
      icon: String(draft?.icon || "").trim() || "fort",
      importance: getStrongholdAnchorImportance(draft?.icon),
      notoriety: String(draft?.notoriety || "6"),
      name: String(draft?.name || "").trim() || "Stronghold"
    };
  }

  function buildSettlementCandidate(hex, byId, byCoord, dimensions, riverData, settings) {
    if (!hex || !isPoiLandHex(hex) || !isViableSettlementHex(hex)) return null;
    const localByCoord = byCoord || new Map([...byId.values()].map(entry => [`${entry.x}:${entry.y}`, entry]));
    const localDimensions = dimensions || getDimensions([...byId.values()]);
    const adjacent = neighbors(hex, localByCoord);
    const nearby = nearbyWithin(hex, localByCoord, 2);
    const localArea = [hex, ...nearby];
    const elevation = Number(hex.elevation || 0);
    const edgeDistance = distanceToMapEdge(hex, localDimensions);
    const waterAccess = scoreSettlementWaterAccess(hex, adjacent, riverData);
    const fertility = scoreSettlementFertility(hex, nearby);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const strategic = scoreSettlementStrategicValue(hex, nearby, localDimensions, riverData);
    const resources = scoreSettlementResourceDiversity(hex, nearby);
    const rockLocal = getNearbyTerrainCount(localArea, ["rock", "snow"]);
    const forestLocal = localArea.reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const adjacentLandHexes = adjacent.filter(neighbor => isPoiLandHex(neighbor));
    const snowHex = hex.baseTerrain === "snow" || (hex.features || []).includes("snowcapped_mountains");
    const snowNearby = [hex, ...nearby].filter(neighbor => (
      neighbor?.baseTerrain === "snow"
      || (neighbor?.features || []).includes("snowcapped_mountains")
    )).length;
    const mountainHex = ["rock", "snow"].includes(hex.baseTerrain)
      || (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature));
    const hillHex = elevation >= 2
      || (hex.features || []).some(feature => ["ridges", "cliffs"].includes(feature));
    const adjacentHighlandCount = adjacentLandHexes.filter(neighbor => (
      ["rock", "snow"].includes(neighbor.baseTerrain)
      || (neighbor.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"].includes(feature))
    )).length;
    const adjacentLowlandCount = Math.max(0, adjacentLandHexes.length - adjacentHighlandCount);
    const passStrength = getWaypointPassStrength(hex, adjacent);
    const mountainSettlementBias = mountainHex && (passStrength > 0 || strategic >= 0.14 || rockLocal >= 3)
      ? 0.08
        + Math.min(0.05, passStrength * 0.04)
        + Math.min(0.04, strategic * 0.14)
        + (routeability >= 0.5 ? 0.03 : 0)
        + (rockLocal >= 3 ? 0.03 : 0)
      : 0;
    const snowSettlementBias = hex.baseTerrain === "snow" && (
      passStrength > 0
      || strategic >= 0.08
      || rockLocal >= 3
      || routeability >= 0.42
      || forestLocal >= 2
      || riverData.riverHexIds.has(hex.id)
      || hasRiverAccess(hex, adjacent, riverData)
    )
      ? 0.14
        + Math.min(0.06, passStrength * 0.05)
        + Math.min(0.05, strategic * 0.18)
        + (routeability >= 0.42 ? 0.06 : routeability >= 0.36 ? 0.03 : 0)
        + (rockLocal >= 3 ? 0.05 : 0)
        + (forestLocal >= 2 ? 0.04 : 0)
        + (riverData.riverHexIds.has(hex.id) ? 0.05 : 0)
        + (hasRiverAccess(hex, adjacent, riverData) ? 0.03 : 0)
      : 0;
    const mountainInteriorStrength = mountainHex
      ? clamp(
          adjacentHighlandCount * 0.14
          - adjacentLowlandCount * 0.08
          + (rockLocal >= 4 ? 0.16 : rockLocal >= 3 ? 0.1 : 0)
          + (elevation >= 4 ? 0.12 : elevation >= 3 ? 0.08 : 0)
          + (routeability <= 0.5 ? 0.14 : routeability <= 0.6 ? 0.06 : 0)
          + (passStrength <= 0.24 ? 0.08 : passStrength <= 0.6 ? 0.03 : 0),
          0,
          1,
          0
        )
      : 0;
    const inlandSettlementBias = !riverData.riverHexIds.has(hex.id)
      && !adjacent.some(neighbor => isWaterBase(neighbor.baseTerrain))
      && fertility >= 0.72
      && routeability >= 0.54
      && !mountainHex
      ? 0.08
        + Math.min(0.05, (fertility - 0.72) * 0.38)
        + Math.min(0.04, Math.max(0, routeability - 0.54) * 0.34)
        + (forestLocal <= 3 ? 0.02 : 0)
      : 0;
    const score = (
      waterAccess * 0.08 +
      fertility * 0.39 +
      routeability * 0.29 +
      strategic * 0.10 +
      resources * 0.14 +
      mountainSettlementBias +
      snowSettlementBias +
      mountainInteriorStrength * 0.08 +
      inlandSettlementBias
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
      onRiverHex: riverData.riverHexIds.has(hex.id),
      riverAccess: hasRiverAccess(hex, adjacent, riverData),
      mountainHex,
      hillHex,
      passStrength,
      mountainSettlementBias,
      snowSettlementBias,
      mountainInteriorStrength,
      inlandSettlementBias,
      highland: getNearbyTerrainCount(nearby, ["rock", "snow"]) >= 2 || mountainHex,
      miningPotential: mountainHex
        ? 1
        : rockLocal >= 4
          ? 0.88
          : rockLocal >= 3
            ? 0.74
            : Number(hex.elevation || 0) >= 3
              ? 0.58
              : 0,
      timberPotential: forestLocal >= 7
        ? 0.92
        : forestLocal >= 5
          ? 0.78
          : forestLocal >= 3
            ? 0.62
            : 0,
      frontier: edgeDistance <= 1
    };
  }

  function scoreSettlementWaterAccess(hex, nearby, riverData) {
    let score = 0;
    const adjacentWater = nearby.filter(neighbor => isWaterBase(neighbor.baseTerrain));
    if (adjacentWater.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain))) score += 0.24;
    if (adjacentWater.some(neighbor => neighbor.baseTerrain === "inland_water")) score += 0.16;
    if (adjacentWater.some(neighbor => neighbor.baseTerrain === "coastal_water") && adjacentWater.some(neighbor => neighbor.baseTerrain === "inland_water")) score += 0.04;
    if (riverData.riverHexIds.has(hex.id)) score += 0.04;
    if (nearby.some(neighbor => riverData.riverHexIds.has(neighbor.id))) score += 0.02;
    const confluence = Math.max(
      riverData.degreeByHexId.get(hex.id) || 0,
      ...nearby.map(neighbor => riverData.degreeByHexId.get(neighbor.id) || 0)
    );
    if (confluence >= 3) score += 0.06;
    if (adjacentWater.length >= 2) score += 0.02;
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

  function getSettlementVisualTier(populationValue, settings, sizeTier) {
    const concentration = clamp(settings?.populationConcentration, 0.5, 1.5, 1);
    const cityThreshold = 12000 - (concentration - 1) * 4000;
    const townThreshold = 2200 - (concentration - 1) * 700;
    if (sizeTier === "grand_hub" || populationValue >= cityThreshold * 1.8) return "grand_hub";
    if (populationValue >= cityThreshold || (sizeTier === "city" && populationValue >= cityThreshold * 0.78)) return "city";
    if (populationValue >= townThreshold || sizeTier === "town") return "town";
    return "village";
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

  function getGeneratedSettlementTags(candidate, sizeTier, icon) {
    const tags = [];
    const weightedTags = [];
    const tradeScale = sizeTier === "grand_hub"
      ? 1.15
      : sizeTier === "city"
        ? 1.02
        : sizeTier === "town"
          ? 0.8
          : 0.5;
    const addWeightedTag = (tag, score) => {
      if (score <= 0) return;
      weightedTags.push({ tag, score });
    };

    addWeightedTag(
      "trade",
      (
        candidate.coastal
          ? 0.98
          : candidate.inlandWater
            ? 0.78
            : candidate.riverAccess && candidate.waterAccess >= 0.28
              ? 0.58
              : candidate.routeability >= 0.82 && (sizeTier === "grand_hub" || sizeTier === "city" || sizeTier === "town")
                ? 0.42
                : sizeTier === "grand_hub" || sizeTier === "city"
                  ? 0.3
                  : 0
      ) * tradeScale
    );
    addWeightedTag(
      "fishing",
      candidate.coastal
        ? 1.08
        : candidate.inlandWater
          ? 0.82
          : candidate.riverAccess && candidate.waterAccess >= 0.32
            ? 0.64
            : 0
    );
    addWeightedTag(
      "farming",
      icon === "farmstead"
        ? 1.2
        : candidate.fertility >= 0.9 && !candidate.coastal && !candidate.inlandWater && sizeTier !== "grand_hub" && sizeTier !== "city"
          ? 0.92
          : candidate.fertility >= 0.84 && !candidate.coastal && !candidate.inlandWater && sizeTier === "village"
            ? 0.72
            : 0
    );
    addWeightedTag(
      "crossroads",
      candidate.routeability >= 0.86 && !candidate.coastal && !candidate.inlandWater
        ? candidate.routeability - candidate.waterAccess * 0.28 + (candidate.strategic >= 0.18 ? 0.06 : 0)
        : 0
    );
    addWeightedTag(
      "river_crossing",
      candidate.onRiverHex && !candidate.coastal && candidate.routeability >= 0.68 && candidate.waterAccess < 0.44
        ? 0.72 + Math.min(0.18, candidate.routeability - 0.68)
        : 0
    );
    addWeightedTag(
      "mining",
      candidate.miningPotential >= 0.58 && !candidate.coastal
        ? candidate.miningPotential + (icon === "mountain_hold" || icon === "mountain_city" ? 0.12 : 0)
        : 0
    );
    addWeightedTag(
      "craftwork",
      candidate.timberPotential >= 0.62 && !candidate.coastal
        ? candidate.timberPotential - 0.08 + (candidate.routeability >= 0.72 ? 0.06 : 0)
        : 0
    );

    weightedTags
      .sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag))
      .slice(0, 2)
      .forEach(entry => tags.push(entry.tag));

    if (candidate.frontier && sizeTier !== "grand_hub") tags.push("frontier");
    if (candidate.frontier && candidate.strategic >= 0.22) tags.push("borderland");
    if (sizeTier === "grand_hub" || sizeTier === "city") tags.push("administration");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function chooseSettlementIcon(candidate, sizeTier, visualTier) {
    const seed = `settlement-icon:${candidate.hex.id}:${sizeTier}:${visualTier}`;
    if (
      candidate.mountainHex
      && (visualTier === "grand_hub" || visualTier === "city")
      && (candidate.mountainInteriorStrength >= 0.34 || candidate.passStrength >= 1 || candidate.miningPotential >= 0.82)
    ) {
      return "mountain_city";
    }
    if (
      candidate.mountainHex
      && (
        candidate.passStrength >= 1
        || candidate.strategic >= 0.14
        || candidate.miningPotential >= 0.74
        || candidate.mountainSettlementBias >= 0.14
        || candidate.mountainInteriorStrength >= 0.34
      )
    ) {
      return "mountain_hold";
    }
    if (candidate.coastal && (visualTier === "grand_hub" || visualTier === "city")) return "port_town";
    if (visualTier === "grand_hub" || visualTier === "city") {
      return seededPick(candidate.strategic >= 0.22 ? ["walled_city", "city"] : ["city", "walled_city"], seed) || "city";
    }
    if (candidate.coastal && visualTier === "town") return "port_town";
    if (visualTier === "town") {
      const eligible = ["village"];
      if (candidate.hillHex) eligible.push("hilltop_town");
      if (candidate.fertility >= 0.82 && candidate.routeability < 0.64 && !candidate.coastal && !candidate.highland) eligible.push("farmstead");
      return seededPick(eligible, seed) || "village";
    }
    const eligible = ["village"];
    if (candidate.frontier) eligible.push("walled_encampment");
    if (candidate.fertility >= 0.82 && candidate.routeability < 0.64 && !candidate.coastal && !candidate.highland) eligible.push("farmstead");
    return seededPick(eligible, seed) || "village";
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

  function buildSettlementFallbackName(candidate, sizeTier, icon = "") {
    const fallbackPatterns = [];
    const mountainNaming = icon === "mountain_hold" || icon === "mountain_city";
    const hillNaming = icon === "hilltop_town";

    if (mountainNaming) {
      fallbackPatterns.push({
        prefixes: ["Iron", "Raven", "Stone", "High", "Ash", "Wolf", "Cold", "Black", "Crag", "Granite", "Frost", "North"],
        suffixes: ["Hold", "Keep", "Gate", "Cairn", "Watch", "Delve"],
        forceSpace: true
      });
      fallbackPatterns.push({
        prefixes: ["Iron", "Raven", "Stone", "High", "Black", "Crag", "Frost", "North"],
        suffixes: ["hold", "keep", "gate", "delve", "cairn"],
        forceSpace: false
      });
      return buildGeneratedPatternName(`fallback:settlement:${candidate.hex.id}:${sizeTier}:${icon}`, fallbackPatterns);
    }

    if (hillNaming) {
      fallbackPatterns.push({
        prefixes: ["High", "Hill", "Stone", "Grey", "Barrow", "Cairn", "Oak", "North"],
        suffixes: ["Crest", "Crown", "Hill", "Watch", "Rise"],
        forceSpace: true
      });
    }

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
    return buildGeneratedPatternName(`fallback:settlement:${candidate.hex.id}:${sizeTier}:${icon}`, fallbackPatterns);
  }

  function generateSettlementName(candidate, sizeTier, settings, usedNames, icon = "") {
    const seed = `${settings.seed}:settlement-name:${candidate.hex.id}`;
    const patterns = [];
    const mountainNaming = icon === "mountain_hold" || icon === "mountain_city";
    const hillNaming = icon === "hilltop_town";

    if (mountainNaming) {
      patterns.push({
        prefixes: ["Iron", "Raven", "Stone", "High", "Ash", "Wolf", "Cold", "Black", "Crag", "Crown", "Frost", "Granite", "Storm", "North", "Cinder", "Ember"],
        suffixes: ["hold", "keep", "gate", "watch", "fell", "peak", "cairn", "spire", "delve", "hall"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["High", "Cold", "Wolf", "Stone", "Raven", "Iron", "Black", "North", "Granite", "Frost"],
        suffixes: ["Hold", "Keep", "Gate", "Watch", "Delve", "Hall"],
        forceSpace: true
      });
    }

    if (hillNaming) {
      patterns.push({
        prefixes: ["High", "Hill", "Stone", "Grey", "Barrow", "Oak", "Ash", "North", "South", "Cairn", "Bracken", "Willow"],
        suffixes: ["crest", "crown", "rise", "watch", "hill", "barrow"],
        forceSpace: false
      });
      patterns.push({
        prefixes: ["High", "Stone", "Grey", "North", "South", "Cairn", "Bracken", "Oak"],
        suffixes: ["Crest", "Crown", "Rise", "Watch", "Hill"],
        forceSpace: true
      });
    }

    if (!mountainNaming && candidate.riverAccess) {
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

    if (!mountainNaming && candidate.highland) {
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

    if (!mountainNaming && (candidate.coastal || candidate.inlandWater)) {
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

    return buildGeneratedPatternName(seed, filterSettlementNamePatternsForTier(patterns, sizeTier), usedNames);
  }

  function buildStrongholdDrafts({ candidateHexes, settlementAnchors, occupiedHexIds, byCoord, dimensions, riverData, settings, usedNames, existingPois }) {
    const existingCount = getExistingPoiTypeCount(existingPois, "stronghold");
    const targetCount = getTargetStrongholdCount(candidateHexes, settlementAnchors, settings, existingCount);
    if (!targetCount) return [];

    const candidates = candidateHexes
      .map(hex => buildStrongholdCandidate(hex, settlementAnchors, byCoord, dimensions, riverData, settings))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));

    const chosen = [];
    const supportUsage = new Map();
    const iconUsage = new Map();
    const habitatUsage = new Map();
    selectPoiCandidatesByHabitat({
      candidates,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getStrongholdHabitatKey,
      habitatTargetOptions: { minimumShare: 0.14, minimumCount: 2 },
      minimumScore: 0.18,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? 0.08
        : habitatKey === "waste"
          ? 0.1
          : floor,
      scoreFn: candidate => {
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 3)) return -Infinity;
        if (!canChooseStrongholdCandidate(candidate, supportUsage, iconUsage, targetCount)) return -Infinity;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, { radius: 7, stepPenalty: 0.055, maxPenalty: 0.22 });
        return candidate.score * variantFactor * coverageFactor - crowdPenalty;
      },
      onChoose: candidate => {
        registerStrongholdCandidateSupport(candidate, supportUsage);
        registerStrongholdCandidateIcon(candidate, iconUsage);
        bumpPoiHabitatUsage(candidate, habitatUsage, getStrongholdHabitatKey);
        occupiedHexIds.add(candidate.hex.id);
      }
    });

    return chosen.map(candidate => ({
      name: reserveGeneratedName(
        generateStrongholdName(candidate, settings),
        usedNames,
        buildStrongholdFallbackName(candidate),
        { seed: `${settings.seed}:stronghold-name:${candidate.hex.id}` }
      ),
      type: "stronghold",
      icon: candidate.icon,
      hexId: candidate.hex.id,
      tags: candidate.tags,
      notoriety: candidate.notoriety,
      population: "",
      lore: "",
      meta: candidate.meta
    }));
  }

  function buildStrongholdCandidate(hex, settlementAnchors, byCoord, dimensions, riverData, settings = {}) {
    const nearby = nearbyWithin(hex, byCoord, 2);
    const adjacent = nearbyWithin(hex, byCoord, 1);
    const edgeDistance = distanceToMapEdge(hex, dimensions);
    const nearestSettlement = settlementAnchors.length ? findNearestSettlementAnchor(hex, settlementAnchors) : null;
    const elevation = Number(hex.elevation || 0);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const strategic = scoreSettlementStrategicValue(hex, nearby, dimensions, riverData);
    const passStrength = getWaypointPassStrength(hex, adjacent);
    const snowHex = hex.baseTerrain === "snow" || (hex.features || []).includes("snowcapped_mountains");
    const snowNearby = [hex, ...nearby].filter(neighbor => (
      neighbor?.baseTerrain === "snow"
      || (neighbor?.features || []).includes("snowcapped_mountains")
    )).length;
    const mountainHex = ["rock", "snow"].includes(hex.baseTerrain)
      || (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature));
    const hillHex = elevation >= 2
      || (hex.features || []).some(feature => ["ridges", "cliffs"].includes(feature));
    const adjacentLandHexes = adjacent.filter(neighbor => isPoiLandHex(neighbor));
    const adjacentHighlandCount = adjacentLandHexes.filter(neighbor => (
      ["rock", "snow"].includes(neighbor.baseTerrain)
      || (neighbor.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"].includes(feature))
    )).length;
    const adjacentLowlandCount = Math.max(0, adjacentLandHexes.length - adjacentHighlandCount);
    const coastal = adjacent.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const onRiverHex = riverData.riverHexIds.has(hex.id);
    const riverNearby = hasRiverAccess(hex, adjacent, riverData);
    const easyExits = neighbors(hex, byCoord)
      .filter(neighbor => isPoiLandHex(neighbor) && getTerrainRoughness(neighbor.baseTerrain, neighbor.features) <= 0.48)
      .length;
    const chokepoint = easyExits <= 2
      ? 1
      : easyExits === 3
        ? 0.76
        : easyExits === 4
          ? 0.42
          : 0.12;
    const frontier = edgeDistance <= 2;
    const nearestSettlementDistance = nearestSettlement?.distance ?? 7;
    const nearestSettlementImportance = Number(nearestSettlement?.anchor?.importance || 0);
    const adjacentMountainSettlement = nearestSettlementDistance === 1 && (
      ["rock", "snow"].includes(nearestSettlement?.anchor?.hex?.baseTerrain)
      || (nearestSettlement?.anchor?.hex?.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature))
    );
    const settlementSupport = nearestSettlement
      ? nearestSettlementDistance <= 2
        ? 0.84 + nearestSettlementImportance * 0.08
        : nearestSettlementDistance <= 4
          ? 0.64 + nearestSettlementImportance * 0.08
          : nearestSettlementDistance <= 6
            ? 0.42 + nearestSettlementImportance * 0.06
            : (frontier || passStrength > 0 || coastal ? 0.36 : 0.18) + nearestSettlementImportance * 0.04
      : frontier || passStrength > 0 || coastal
        ? 0.34
        : 0.14;
    const riverControl = onRiverHex
      ? 0.78
      : riverNearby && chokepoint >= 0.42
        ? 0.5
        : 0;
    const coastalWatch = coastal
      ? frontier
        ? 0.82
        : hillHex
          ? 0.72
          : 0.58
      : 0;
    const highGround = mountainHex
      ? 1
      : hillHex
        ? 0.72
        : elevation >= 2
          ? 0.56
          : 0;
    const mountainInteriorStrength = mountainHex
      ? clamp(
          adjacentHighlandCount * 0.16
          - adjacentLowlandCount * 0.08
          + (elevation >= 4 ? 0.12 : elevation >= 3 ? 0.08 : 0)
          + (routeability <= 0.48 ? 0.12 : routeability <= 0.6 ? 0.05 : 0)
          + (passStrength <= 0.3 ? 0.1 : 0),
          0,
          1,
          0
        )
      : 0;
    const snowStrongholdBias = snowHex
      ? clamp(
          0.14
          + Math.min(0.14, snowNearby * 0.03)
          + (routeability >= 0.42 ? 0.06 : 0)
          + (passStrength > 0 ? 0.06 : 0)
          + (strategic >= 0.16 ? 0.04 : 0),
          0,
          0.36,
          0
        )
      : 0;

    const archetypeScores = {
      sea_fort: coastal
        ? coastalWatch * 0.44 + strategic * 0.18 + chokepoint * 0.12 + settlementSupport * 0.12 + (frontier ? 0.08 : 0) + routeability * 0.04
        : 0,
      mountain_gate: passStrength >= 1.35 && adjacentLowlandCount >= 2 && (chokepoint >= 0.76 || adjacentMountainSettlement)
        ? passStrength * 0.16 + chokepoint * 0.14 + highGround * 0.06 + settlementSupport * 0.08 + (frontier ? 0.04 : 0) + strategic * 0.04 + (adjacentMountainSettlement ? 0.18 : 0) - mountainInteriorStrength * 0.1
        : 0,
      castle: !coastal && nearestSettlementDistance <= 3 && nearestSettlementImportance >= 0.55
        ? settlementSupport * 0.38
          + strategic * 0.16
          + routeability * 0.18
          + chokepoint * 0.12
          + riverControl * 0.08
          + (nearestSettlementDistance <= 2 ? 0.12 : 0.06)
          - (passStrength > 0 ? 0.06 : 0)
          - (mountainHex ? 0.05 : 0)
        : 0,
      watchtower: frontier || chokepoint >= 0.48 || strategic >= 0.52
        ? strategic * 0.18 + chokepoint * 0.18 + routeability * 0.14 + settlementSupport * 0.1 + (frontier ? 0.14 : 0.04) + highGround * 0.04 + riverControl * 0.04 + (nearestSettlementDistance >= 3 ? 0.04 : 0) + mountainInteriorStrength * 0.06 + snowStrongholdBias * 0.26
        : 0,
      stone_tower: !coastal && nearestSettlementDistance >= 3 && (strategic >= 0.5 || chokepoint >= 0.5 || highGround >= 0.56)
        ? strategic * 0.2 + chokepoint * 0.16 + routeability * 0.12 + settlementSupport * 0.06 + (frontier ? 0.08 : 0.03) + highGround * 0.05 + riverControl * 0.04 + (nearestSettlementDistance >= 4 ? 0.05 : 0) + mountainInteriorStrength * 0.12 + snowStrongholdBias * 0.24
        : 0,
      walled_encampment: frontier && nearestSettlementDistance >= 4 && routeability >= 0.54 && passStrength <= 0
        ? 0.22 + routeability * 0.18 + settlementSupport * 0.14 + chokepoint * 0.14 + highGround * 0.02 + snowStrongholdBias * 0.14
        : 0,
      fort: highGround * 0.04 + chokepoint * 0.2 + strategic * 0.2 + settlementSupport * 0.2 + (frontier ? 0.06 : 0) + riverControl * 0.16 + routeability * 0.14 + mountainInteriorStrength * 0.06 + snowStrongholdBias * 0.18
    };
    const bestScore = Math.max(0, ...Object.values(archetypeScores));
    const eligibleIcons = Object.entries(archetypeScores)
      .filter(([icon, archetypeScore]) => (
        icon === "fort"
          ? archetypeScore >= 0.36 && bestScore < 0.42
          : archetypeScore >= 0.34
      ))
      .map(([icon]) => icon);
    const iconPool = eligibleIcons.length ? eligibleIcons : ["fort"];
    const icon = seededPick(iconPool, `${settings.seed || "poi"}:stronghold-icon:${hex.id}`) || iconPool[0] || "fort";
    const score = bestScore;
    const minimumScore = snowHex || snowStrongholdBias >= 0.14 ? 0.24 : 0.36;
    if (score < minimumScore) return null;

    const candidate = {
      hex,
      score,
      routeability,
      strategic,
      passStrength,
      mountainHex,
      hillHex,
      coastal,
      onRiverHex,
      riverNearby,
      chokepoint,
      frontier,
      nearestSettlement,
      nearestSettlementDistance,
      nearestSettlementImportance,
      adjacentMountainSettlement,
      riverControl,
      coastalWatch,
      highGround,
      snowHex,
      snowNearby,
      snowStrongholdBias,
      mountainInteriorStrength,
      archetypeScores
    };
    const tags = getStrongholdTags(candidate, icon);
    return {
      ...candidate,
      icon,
      tags,
      notoriety: getStrongholdNotoriety(candidate, icon),
      meta: {
        nearestSettlement: nearestSettlement?.anchor?.name || "",
        nearestSettlementId: nearestSettlement?.anchor?.id || "",
        nearestSettlementImportance,
        supportDistance: nearestSettlementDistance,
        passStrength,
        frontier,
        coastal,
        riverControl
      }
    };
  }

  function canChooseStrongholdCandidate(candidate, supportUsage, iconUsage, targetCount) {
    const supportKey = String(candidate?.meta?.nearestSettlementId || "").trim();
    if (supportKey) {
      const distance = Number(candidate?.meta?.supportDistance || 0);
      const importance = Number(candidate?.meta?.nearestSettlementImportance || 0);
      let limit = importance >= 1.1 ? 2 : 1;
      if (distance >= 4) limit = 1;
      if ((supportUsage.get(supportKey) || 0) >= limit) return false;
    }
    const iconKey = String(candidate?.icon || "").trim();
    if (!iconKey) return true;
    const iconLimit = getStrongholdIconCapacity(iconKey, targetCount);
    return (iconUsage.get(iconKey) || 0) < iconLimit;
  }

  function registerStrongholdCandidateSupport(candidate, supportUsage) {
    const supportKey = String(candidate?.meta?.nearestSettlementId || "").trim();
    if (!supportKey) return;
    supportUsage.set(supportKey, (supportUsage.get(supportKey) || 0) + 1);
  }

  function getStrongholdIconCapacity(icon, targetCount) {
    if (icon === "mountain_gate") return Math.max(1, Math.floor(Math.max(1, targetCount) * 0.22));
    return Math.max(1, targetCount);
  }

  function registerStrongholdCandidateIcon(candidate, iconUsage) {
    const iconKey = String(candidate?.icon || "").trim();
    if (!iconKey) return;
    iconUsage.set(iconKey, (iconUsage.get(iconKey) || 0) + 1);
  }

  function chooseStrongholdIcon(candidate) {
    if (candidate.coastal && candidate.strategic >= 0.16) return "sea_fort";
    if (candidate.passStrength >= 1.25 && candidate.chokepoint >= 0.42) return "mountain_gate";
    if (candidate.nearestSettlementDistance <= 2 && candidate.nearestSettlementImportance >= 0.75 && !candidate.frontier && !candidate.coastal) {
      return "castle";
    }
    if (candidate.frontier && candidate.highGround >= 0.72) return "watchtower";
    if (candidate.highGround >= 0.82 && candidate.nearestSettlementDistance >= 4 && !candidate.coastal) return "stone_tower";
    if (candidate.frontier && candidate.nearestSettlementDistance >= 4 && candidate.routeability >= 0.56 && !candidate.coastal && candidate.passStrength <= 0) {
      return "walled_encampment";
    }
    return "fort";
  }

  function getStrongholdTags(candidate, icon) {
    const tags = ["occupied"];
    if (candidate.frontier || ["watchtower", "walled_encampment", "mountain_gate"].includes(icon)) tags.push("frontier");
    if ((candidate.frontier && candidate.nearestSettlementDistance >= 3) || icon === "sea_fort" || icon === "mountain_gate") tags.push("borderland");
    if (candidate.passStrength > 0 || candidate.riverControl >= 0.5 || candidate.coastalWatch >= 0.72) tags.push("contested");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getStrongholdNotoriety(candidate, icon) {
    let value = icon === "castle"
      ? 5
      : icon === "sea_fort" || icon === "mountain_gate"
        ? 6
        : icon === "fort"
          ? 6
          : 7;
    if (candidate.frontier) value += 1;
    if (candidate.nearestSettlementImportance >= 1.1) value -= 1;
    return String(Math.max(3, Math.min(9, value)));
  }

  function buildStrongholdFallbackName(candidate) {
    if (candidate.icon === "sea_fort") return "Grey Sea Fort";
    if (candidate.icon === "mountain_gate") return "Stone Gate";
    if (candidate.icon === "watchtower" || candidate.icon === "stone_tower") return "High Watch";
    if (candidate.icon === "walled_encampment") return "Frontier Redoubt";
    if (candidate.icon === "castle") return "Old Keep";
    return "Stone Fort";
  }

  function generateStrongholdName(candidate, settings) {
    const seed = `${settings.seed}:stronghold-name:${candidate.hex.id}`;
    const nearestSettlement = getGeneratedRelatedSettlementBaseName(candidate.meta, 3);
    const relatedSuffixes = candidate.icon === "sea_fort"
      ? ["Sea Fort", "Watch", "Fort"]
      : candidate.icon === "mountain_gate"
        ? ["Gate", "Pass Keep", "Gatehouse"]
        : candidate.icon === "watchtower" || candidate.icon === "stone_tower"
          ? ["Tower", "Watch", "Spire"]
          : candidate.icon === "walled_encampment"
            ? ["Camp", "Redoubt", "Hold"]
            : candidate.icon === "castle"
              ? ["Keep", "Castle", "Hold"]
              : ["Fort", "Keep", "Redoubt"];
    const relatedQualifiers = candidate.icon === "sea_fort"
      ? ["North", "South", "Outer", "Old", "West"]
      : candidate.icon === "mountain_gate"
        ? ["High", "North", "South", "Old", "Upper"]
        : ["North", "South", "East", "West", "Old", "High"];

    if (nearestSettlement && seededUnit(`${seed}:related-roll`) < (candidate.icon === "castle" ? 0.78 : 0.64)) {
      return buildRelatedGeneratedSiteName(seed, nearestSettlement, relatedSuffixes, relatedQualifiers, { qualifierChance: 0.42 });
    }

    const patterns = candidate.icon === "sea_fort"
      ? [
          {
            prefixes: ["Grey", "Salt", "Storm", "Black", "Tide", "West", "North", "Warden's", "Breakwater", "Iron"],
            suffixes: ["Sea Fort", "Watch", "Fort"],
            forceSpace: true
          }
        ]
      : candidate.icon === "mountain_gate"
        ? [
            {
              prefixes: ["High", "Stone", "Iron", "North", "Black", "Cold", "Wolf", "Raven", "Granite", "Crag"],
              suffixes: ["Gate", "Pass Keep", "Gatehouse"],
              forceSpace: true
            }
          ]
        : candidate.icon === "watchtower" || candidate.icon === "stone_tower"
          ? [
              {
                prefixes: ["High", "Grey", "Stone", "North", "Warden's", "Raven", "Black", "Far", "Cold", "Lantern"],
                suffixes: ["Watch", "Tower", "Spire"],
                forceSpace: true
              }
            ]
          : candidate.icon === "walled_encampment"
            ? [
                {
                  prefixes: ["Frontier", "Ash", "Black", "Stone", "North", "South", "Warden's", "Dust", "Red", "Iron"],
                  suffixes: ["Camp", "Redoubt", "Hold"],
                  forceSpace: true
                }
              ]
            : candidate.icon === "castle"
              ? [
                  {
                    prefixes: ["King's", "Queen's", "Grey", "Stone", "Iron", "Raven", "High", "Black", "Oath", "Banner"],
                    suffixes: ["Keep", "Castle", "Hold"],
                    forceSpace: true
                  }
                ]
              : [
                  {
                    prefixes: ["Stone", "Iron", "Grey", "High", "Raven", "Black", "North", "South", "Ash", "Warden's"],
                    suffixes: ["Fort", "Keep", "Redoubt", "Hold"],
                    forceSpace: true
                  }
                ];
    return buildGeneratedPatternName(seed, patterns);
  }

  function buildDungeonDrafts({ candidateHexes, settlementAnchors, strongholdAnchors, occupiedHexIds, byCoord, dimensions, riverData, settings, usedNames, existingPois, complex = false }) {
    const typeValue = complex ? "dungeon_complex" : "dungeon";
    const existingCount = getExistingPoiTypeCount(existingPois, typeValue);
    const targetCount = complex
      ? getTargetDungeonComplexCount(candidateHexes, settings, existingCount)
      : getTargetDungeonCount(candidateHexes, settings, existingCount);
    if (!targetCount) return [];

    const candidates = (candidateHexes || [])
      .map(hex => buildDungeonCandidate(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData, settings, { complex }))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));

    const chosen = [];
    const iconUsage = new Map();
    const habitatUsage = new Map();
    const minSpacing = complex ? 3 : 2;
    selectPoiCandidatesByHabitat({
      candidates,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getDungeonHabitatKey,
      habitatTargetOptions: { minimumShare: 0.12, minimumCount: 2 },
      minimumScore: complex ? 0.14 : 0.12,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? (complex ? 0.08 : 0.06)
        : habitatKey === "waste"
          ? Math.max(0.08, floor - 0.03)
          : floor,
      scoreFn: candidate => {
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), minSpacing)) return -Infinity;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        if (iconCount >= getPoiVariantHardCap(candidate.icon)) return -Infinity;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, {
          radius: complex ? 8 : 7,
          stepPenalty: complex ? 0.06 : 0.05,
          maxPenalty: complex ? 0.24 : 0.2
        });
        return candidate.score * variantFactor * coverageFactor - crowdPenalty;
      },
      onChoose: candidate => {
        occupiedHexIds.add(candidate.hex.id);
        iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
        bumpPoiHabitatUsage(candidate, habitatUsage, getDungeonHabitatKey);
      }
    });

    return chosen.map(candidate => ({
      name: reserveGeneratedName(
        generateDungeonName(candidate, settings),
        usedNames,
        buildDungeonFallbackName(candidate),
        { seed: `${settings.seed}:dungeon-name:${candidate.hex.id}` }
      ),
      type: candidate.type,
      icon: candidate.icon,
      hexId: candidate.hex.id,
      tags: candidate.tags,
      notoriety: candidate.notoriety,
      population: "",
      lore: "",
      meta: candidate.meta
    }));
  }

  function buildDungeonCandidate(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData, settings = {}, options = {}) {
    const complex = Boolean(options?.complex);
    const signals = buildPoiAdventureSignals(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData);
    if (signals.coastalWaterAdjacent && signals.roughness < 0.34 && !signals.gateLinked) return null;
    if (!complex && signals.settlementDistance <= 2 && !signals.gateLinked) return null;
    if (complex && signals.settlementDistance <= 3 && !signals.gateLinked) return null;

    let score = signals.remoteness * (complex ? 0.32 : 0.28)
      + signals.roughness * 0.24
      + signals.concealment * 0.2
      + signals.wasteAffinity * 0.18
      + signals.mountainAffinity * 0.08
      + signals.mountainInterior * (complex ? 0.14 : 0.1)
      + signals.snowAffinity * (complex ? 0.16 : 0.13)
      + signals.oldCivilization * 0.14
      + (signals.gateLinked ? (complex ? 0.18 : 0.08) : 0)
      + (signals.coastalCave ? 0.06 : 0)
      - signals.settlementPressure * (complex ? 0.3 : 0.24)
      - signals.routeability * (complex ? 0.06 : 0.04);

    if (complex) {
      if (signals.oldCivilization >= 0.72) score += 0.06;
      if (signals.mountainInterior >= 0.58) score += 0.08;
      else if (signals.mountainAffinity >= 0.72) score += 0.04;
      if (signals.snowAffinity >= 0.62) score += 0.11;
      if (signals.frontier) score += 0.04;
    } else if (signals.forestCover >= 0.68 || signals.deadForestCover >= 0.34) {
      score += 0.04;
      if (signals.mountainInterior >= 0.56) score += 0.04;
      if (signals.snowAffinity >= 0.6) score += 0.07;
    }

    const minimumScore = complex
      ? (signals.snowAffinity >= 0.5 || signals.wasteAffinity >= 0.56 ? 0.3 : 0.42)
      : (signals.snowAffinity >= 0.46 || signals.wasteAffinity >= 0.56 ? 0.24 : 0.36);
    if (score < minimumScore) return null;

    const icon = chooseDungeonIcon(signals, settings, { complex });
    const type = complex ? "dungeon_complex" : "dungeon";
    const tags = getDungeonTags(signals, icon, { complex });
    return {
      hex,
      score,
      type,
      icon,
      snowAffinity: signals.snowAffinity,
      mountainAffinity: signals.mountainAffinity,
      mountainInterior: signals.mountainInterior,
      wasteAffinity: signals.wasteAffinity,
      tags,
      notoriety: getDungeonNotoriety(signals, icon, { complex }),
      meta: {
        nearestSettlement: signals.nearestSettlement?.anchor?.name || "",
        supportDistance: signals.settlementDistance,
        gateName: signals.nearestGate?.anchor?.name || "",
        gateDistance: signals.gateDistance,
        gateLinked: signals.gateLinked,
        oldCivilization: signals.oldCivilization,
        remoteness: signals.remoteness,
        mountainAffinity: signals.mountainAffinity,
        mountainInterior: signals.mountainInterior
      }
    };
  }

  function chooseDungeonIcon(signals, settings = {}, options = {}) {
    const complex = Boolean(options?.complex);
    const iconScores = {
      dungeon: signals.roughness * 0.22 + signals.oldCivilization * 0.18 + signals.mountainAffinity * 0.06 + signals.mountainInterior * 0.08 + signals.snowAffinity * 0.06 + (complex ? 0.08 : 0.04),
      cave: signals.mountainAffinity * 0.14 + signals.mountainInterior * 0.18 + signals.snowAffinity * 0.08 + signals.roughness * 0.18 + (signals.coastalCave ? 0.12 : 0),
      catacombs: signals.oldCivilization * 0.34 + (signals.settlementDistance <= 5 ? 0.04 : 0) + (complex ? 0.06 : 0),
      crypt: signals.oldCivilization * 0.28 + signals.concealment * 0.08 + (complex ? 0.04 : 0),
      lair: !complex ? signals.remoteness * 0.24 + signals.concealment * 0.16 + signals.wasteAffinity * 0.12 + signals.forestCover * 0.08 : 0,
      dragon_lair: signals.remoteness * 0.2 + signals.mountainAffinity * 0.06 + signals.mountainInterior * 0.14 + signals.snowAffinity * 0.06 + signals.wasteAffinity * 0.12 + (complex ? 0.12 : 0.02)
    };
    const bestScore = Math.max(0, ...Object.values(iconScores));
    const eligible = Object.entries(iconScores)
      .filter(([, value]) => value >= Math.max(0.18, bestScore - (complex ? 0.08 : 0.1)))
      .map(([icon]) => icon);
    const fallbackPool = complex ? ["dungeon", "cave", "catacombs"] : ["dungeon", "cave", "lair"];
    const pool = eligible.length ? eligible : fallbackPool;
    return seededPick(pool, `${settings.seed || "poi"}:dungeon-icon:${signals.hex.id}:${complex ? "complex" : "ordinary"}`) || pool[0] || "dungeon";
  }

  function getDungeonTags(signals, icon, options = {}) {
    const complex = Boolean(options?.complex);
    const tags = complex
      ? ["sealed", "forbidden", "underground"]
      : ["hidden", "underground"];
    if (signals.remoteness >= 0.72) tags.push("remote");
    if (signals.gateLinked || signals.oldCivilization >= 0.66 || ["catacombs", "crypt"].includes(icon)) tags.push("ancient");
    if (signals.gateLinked || signals.concealment >= 0.74) tags.push("sealed");
    if (["lair", "dragon_lair"].includes(icon)) tags.push("monster_lair");
    if (signals.wasteAffinity >= 0.66 && !tags.includes("forbidden")) tags.push("forbidden");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getDungeonNotoriety(signals, icon, options = {}) {
    const complex = Boolean(options?.complex);
    let value = complex ? 3 : 5;
    if (signals.remoteness >= 0.76) value += 1;
    if (signals.gateLinked || icon === "dragon_lair") value -= 1;
    if (signals.oldCivilization >= 0.74) value -= 1;
    return String(Math.max(2, Math.min(9, value)));
  }

  function buildDungeonFallbackName(candidate) {
    if (candidate.type === "dungeon_complex") {
      if (candidate.icon === "catacombs" || candidate.icon === "crypt") return "The Old Vaults";
      if (candidate.icon === "cave") return "The Deep Caves";
      if (candidate.icon === "dragon_lair") return "The Ash Maw";
      return "The Iron Deeps";
    }
    if (candidate.icon === "catacombs") return "Old Catacombs";
    if (candidate.icon === "crypt") return "Black Crypt";
    if (candidate.icon === "cave") return "Grey Caves";
    if (candidate.icon === "lair" || candidate.icon === "dragon_lair") return "Wolf Lair";
    return "Stone Delve";
  }

  function generateDungeonName(candidate, settings) {
    const seed = `${settings.seed}:dungeon-name:${candidate.hex.id}`;
    const gateName = String(candidate.meta?.gateName || "").trim();
    const nearestSettlement = getGeneratedRelatedSettlementBaseName(candidate.meta, 3);
    const relatedBaseName = gateName || nearestSettlement;
    const complex = candidate.type === "dungeon_complex";
    const relatedSuffixes = candidate.icon === "cave"
      ? ["Caves", "Cavern", "Hollow", "Grotto"]
      : candidate.icon === "catacombs"
        ? ["Catacombs", "Vaults", "Tombs"]
        : candidate.icon === "crypt"
          ? ["Crypt", "Tomb", "Vault"]
          : candidate.icon === "lair" || candidate.icon === "dragon_lair"
            ? ["Lair", "Maw", "Den"]
            : complex
              ? ["Deeps", "Vaults", "Pits", "Labyrinth"]
              : ["Delve", "Dungeon", "Pits", "Depths"];
    const relatedQualifiers = complex
      ? ["Deep", "Old", "Lower", "Lost", "Black"]
      : ["Old", "Lower", "Black", "Hidden", "Lost"];

    if (relatedBaseName && seededUnit(`${seed}:related-roll`) < (complex ? 0.54 : 0.46)) {
      return buildRelatedGeneratedSiteName(seed, relatedBaseName, relatedSuffixes, relatedQualifiers, { qualifierChance: 0.26 });
    }

    const patterns = candidate.icon === "cave"
      ? [{
          prefixes: ["Grey", "Stone", "Cold", "Black", "Wolf", "Raven", "Deep", "North", "Crag", "Mourn"],
          suffixes: ["Caves", "Cavern", "Hollow", "Grotto"],
          forceSpace: true
        }]
      : candidate.icon === "catacombs"
        ? [{
            prefixes: ["Old", "Black", "Hollow", "Saint", "Grey", "Dust", "Ash", "King's", "Queen's", "Bone"],
            suffixes: ["Catacombs", "Vaults", "Tombs"],
            forceSpace: true
          }]
        : candidate.icon === "crypt"
          ? [{
              prefixes: ["Black", "Old", "Stone", "Ash", "Grey", "Lost", "Saint", "Dust", "Bone", "Veil"],
              suffixes: ["Crypt", "Tomb", "Vault"],
              forceSpace: true
            }]
          : candidate.icon === "lair" || candidate.icon === "dragon_lair"
            ? [{
                prefixes: ["Ash", "Black", "Wolf", "Raven", "Red", "Storm", "Wyrm", "Ember", "Fell", "Cold"],
                suffixes: candidate.icon === "dragon_lair" ? ["Maw", "Lair", "Eyrie"] : ["Lair", "Den", "Nest"],
                forceSpace: true
              }]
            : [{
                prefixes: ["Iron", "Black", "Deep", "Stone", "Grey", "Lost", "Cold", "Ash", "Mourn", "Crag"],
                suffixes: complex ? ["Deeps", "Vaults", "Labyrinth", "Pits"] : ["Delve", "Dungeon", "Pits", "Depths"],
                forceSpace: true
              }];
    return buildGeneratedPatternName(seed, patterns);
  }

  function buildSiteDrafts({ candidateHexes, settlementAnchors, strongholdAnchors, occupiedHexIds, byCoord, dimensions, riverData, settings, usedNames, existingPois }) {
    const existingCount = getExistingPoiTypeCountForSet(existingPois, SITE_POI_TYPES);
    const targetCount = getTargetSiteCount(candidateHexes, settings, existingCount);
    if (!targetCount) return [];

    const familyBiases = getGeneratedSiteFamilyBiases(settings);
    const variants = (candidateHexes || [])
      .flatMap(hex => buildSiteFamilyCandidates(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData, settings))
      .filter(Boolean);

    const chosen = [];
    const familyUsage = new Map();
    const iconUsage = new Map();
    const habitatUsage = new Map();
    selectPoiCandidatesByHabitat({
      candidates: variants,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getSiteHabitatKey,
      habitatTargetOptions: { minimumShare: 0.14, minimumCount: 3 },
      minimumScore: 0.16,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? 0.08
        : habitatKey === "wetland" || habitatKey === "waste"
          ? 0.1
          : floor,
      scoreFn: candidate => {
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), candidate.type === "landmark" ? 3 : 2)) return -Infinity;
        const familyCount = familyUsage.get(candidate.type) || 0;
        const bias = familyBiases[candidate.type] || 1;
        const diminishing = getSiteDiminishingFactor(familyCount);
        const capFactor = getSiteFamilyCapFactor(candidate.type, familyCount, targetCount);
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, {
          radius: candidate.type === "landmark" ? 8 : 7,
          stepPenalty: candidate.type === "landmark" ? 0.05 : 0.045,
          maxPenalty: candidate.type === "landmark" ? 0.2 : 0.18
        });
        return candidate.score * bias * diminishing * capFactor * variantFactor * coverageFactor - crowdPenalty;
      },
      onChoose: candidate => {
        occupiedHexIds.add(candidate.hex.id);
        familyUsage.set(candidate.type, (familyUsage.get(candidate.type) || 0) + 1);
        iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
        bumpPoiHabitatUsage(candidate, habitatUsage, getSiteHabitatKey);
      }
    });

    return chosen.map(candidate => ({
      name: reserveGeneratedName(
        generateSiteName(candidate, settings),
        usedNames,
        buildSiteFallbackName(candidate),
        { seed: `${settings.seed}:site-name:${candidate.hex.id}:${candidate.type}` }
      ),
      type: candidate.type,
      icon: candidate.icon,
      hexId: candidate.hex.id,
      tags: candidate.tags,
      notoriety: candidate.notoriety,
      population: "",
      lore: "",
      meta: candidate.meta
    }));
  }

  function getGeneratedSiteFamilyBiases(settings = {}) {
    const seed = `${settings.seed || "poi"}:site-family-bias`;
    const biases = {};
    SITE_POI_TYPES.forEach((family, index) => {
      biases[family] = clamp(1 + seededNoise(`${seed}:${family}:${index}`, -0.12, 0.12), 0.78, 1.22, 1);
    });
    const favored = seededPick(SITE_POI_TYPES, `${seed}:favored`) || "ruin";
    const secondary = seededPick(SITE_POI_TYPES.filter(family => family !== favored), `${seed}:secondary`) || "landmark";
    const reduced = seededPick(SITE_POI_TYPES.filter(family => family !== favored && family !== secondary), `${seed}:reduced`) || "holy_site";
    biases[favored] = clamp(biases[favored] + 0.1, 0.78, 1.28, 1);
    biases[secondary] = clamp(biases[secondary] + 0.05, 0.78, 1.28, 1);
    biases[reduced] = clamp(biases[reduced] - 0.08, 0.72, 1.28, 1);
    return biases;
  }

  function getSiteDiminishingFactor(count) {
    return count <= 0
      ? 1
      : count === 1
        ? 0.78
        : count === 2
          ? 0.6
          : count === 3
            ? 0.46
            : 0.34;
  }

  function getSiteFamilyCapFactor(type, count, targetCount) {
    const ratio = type === "ruin" || type === "wilderness_site" || type === "landmark"
      ? 0.35
      : type === "hazard"
        ? 0.28
        : 0.24;
    const softCap = Math.max(1, Math.round(Math.max(1, targetCount) * ratio));
    return count >= softCap ? 0.42 : 1;
  }

  function buildSiteFamilyCandidates(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData, settings = {}) {
    const signals = buildPoiAdventureSignals(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData);
    return SITE_POI_TYPES
      .map(type => buildSiteFamilyCandidate(type, signals, settings))
      .filter(Boolean);
  }

  function buildSiteFamilyCandidate(type, signals, settings = {}) {
    let score = 0;
    let icon = "";
    const snowThresholdRelief = signals.snowAffinity >= 0.54
      ? 0.12
      : signals.snowAffinity >= 0.4
        ? 0.06
        : 0;
    if (type === "ruin") {
      score = signals.oldCivilization * 0.38 + signals.remoteness * 0.12 + signals.strategic * 0.08 + signals.coastalWaterAdjacent * 0.05 + signals.routeability * 0.08 + signals.greenAffinity * 0.1 + signals.snowAffinity * 0.18 - signals.settlementPressure * 0.18 - signals.mountainAffinity * 0.04;
      if (score < 0.34 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    } else if (type === "holy_site") {
      score = signals.freshwaterAffinity * 0.22 + signals.forestCover * 0.12 + signals.greenAffinity * 0.14 + signals.oldCivilization * 0.12 + signals.routeability * 0.12 + signals.wetAffinity * 0.1 + signals.prominence * 0.08 + signals.snowAffinity * 0.12 - signals.wasteAffinity * 0.04;
      if (score < 0.3 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    } else if (type === "arcane_site") {
      score = signals.anomaly * 0.28 + signals.remoteness * 0.14 + signals.oldCivilization * 0.12 + signals.prominence * 0.08 + signals.mountainAffinity * 0.02 + signals.mountainInterior * 0.08 + signals.snowAffinity * 0.14 + signals.wasteAffinity * 0.06 + signals.forestCover * 0.04;
      if (score < 0.3 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    } else if (type === "wilderness_site") {
      score = signals.naturalWonder * 0.28 + signals.greenAffinity * 0.14 + signals.forestCover * 0.12 + signals.wetAffinity * 0.14 + signals.freshwaterAffinity * 0.1 + signals.remoteness * 0.1 + signals.coastalWaterAdjacent * 0.06 + signals.mountainInterior * 0.03 + signals.snowAffinity * 0.16;
      if (score < 0.3 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    } else if (type === "hazard") {
      score = signals.anomaly * 0.2 + signals.strategic * 0.16 + signals.wasteAffinity * 0.14 + signals.remoteness * 0.14 + signals.frontier * 0.12 + signals.roughness * 0.08 + signals.mountainInterior * 0.06 + signals.snowAffinity * 0.1 - signals.greenAffinity * 0.08;
      if (score < 0.28 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    } else if (type === "landmark") {
      score = signals.prominence * 0.18 + signals.oldCivilization * 0.12 + signals.anomaly * 0.08 + signals.routeability * 0.12 + signals.coastalWaterAdjacent * 0.08 + signals.naturalWonder * 0.16 + signals.greenAffinity * 0.08 + signals.mountainInterior * 0.04 + signals.snowAffinity * 0.14;
      if (score < 0.28 - snowThresholdRelief) return null;
      icon = chooseSiteIcon(type, signals, settings);
    }
    if (!icon) return null;
    const tags = getSiteTags(type, signals, icon);
    return {
      hex: signals.hex,
      score,
      type,
      icon,
      snowAffinity: signals.snowAffinity,
      greenAffinity: signals.greenAffinity,
      coastalWaterAdjacent: signals.coastalWaterAdjacent ? 1 : 0,
      mountainAffinity: signals.mountainAffinity,
      mountainInterior: signals.mountainInterior,
      tags,
      notoriety: getSiteNotoriety(type, signals, icon),
      meta: {
        nearestSettlement: signals.nearestSettlement?.anchor?.name || "",
        supportDistance: signals.settlementDistance,
        oldCivilization: signals.oldCivilization,
        remoteness: signals.remoteness
      }
    };
  }

  function chooseSiteIcon(type, signals, settings = {}) {
    const seed = `${settings.seed || "poi"}:site-icon:${signals.hex.id}:${type}`;
    if (type === "ruin") {
      const options = [];
      if (signals.coastalWaterAdjacent && signals.oldCivilization >= 0.56) options.push("shipwreck");
      if (signals.aridAffinity >= 0.56 && signals.oldCivilization >= 0.66) options.push("pyramid");
      if ((signals.remoteness >= 0.74 || signals.snowAffinity >= 0.56) && signals.oldCivilization < 0.54) options.push("abandoned_shack");
      options.push("ruins");
      return seededPick(options, seed) || "ruins";
    }
    if (type === "holy_site") {
      const options = [];
      if (signals.forestCover >= 0.62 && signals.greenAffinity >= 0.54) options.push("sacred_grove");
      if (signals.routeability >= 0.78 && signals.settlementDistance <= 4) options.push("roadside_shrine");
      if (signals.oldCivilization >= 0.62 && signals.aridAffinity >= 0.52) options.push("ziggurat");
      if (signals.oldCivilization >= 0.62) options.push("mausoleum");
      if (signals.settlementDistance <= 3 && signals.routeability >= 0.58 && signals.greenAffinity >= 0.42) options.push("abbey");
      if (signals.settlementDistance <= 3 && signals.oldCivilization >= 0.54) options.push("graveyard");
      options.push("temple", "shrine");
      return seededPick(options, seed) || "shrine";
    }
    if (type === "arcane_site") {
      const options = [];
      if (signals.anomaly >= 0.74) options.push("arcane_portal", "ley_nexus");
      if (signals.prominence >= 0.62) options.push("observatory");
      if (signals.settlementDistance <= 4 && signals.routeability >= 0.56) options.push("laboratory");
      options.push("wizard_tower");
      return seededPick(options, seed) || "wizard_tower";
    }
    if (type === "wilderness_site") {
      const options = [];
      if (signals.aridAffinity >= 0.58 && signals.freshwaterAffinity >= 0.28) options.push("oasis");
      if (signals.wetAffinity >= 0.66) options.push("swamp");
      if (signals.volcanicAffinity >= 0.6) options.push("geyser");
      if (signals.riverNearby && signals.prominence >= 0.52) options.push("waterfall");
      if (signals.freshwaterAffinity >= 0.44) options.push("spring");
      if (signals.forestCover >= 0.62 && signals.greenAffinity >= 0.48) options.push("tree");
      if (signals.deadForestCover >= 0.3 || signals.wasteAffinity >= 0.54) options.push("dead_tree");
      return seededPick(options, seed) || "spring";
    }
    if (type === "hazard") {
      const options = [];
      if (signals.volcanicAffinity >= 0.58) options.push("volcano");
      if (signals.anomaly >= 0.64 || signals.wasteAffinity >= 0.62) options.push("crater");
      if (signals.strategic >= 0.2 && signals.frontier) options.push("battlefield");
      if (signals.routeability >= 0.54 && signals.remoteness >= 0.46) options.push("bandit_camp");
      return seededPick(options, seed) || (signals.volcanicAffinity >= 0.5 ? "volcano" : "crater");
    }
    if (type === "landmark") {
      const options = [];
      if (signals.coastalWaterAdjacent && signals.routeability >= 0.54) options.push("lighthouse");
      if (signals.anomaly >= 0.56 || (signals.oldCivilization >= 0.56 && signals.routeability >= 0.46)) options.push("standing_stones");
      if (signals.aridAffinity >= 0.46 || (signals.oldCivilization >= 0.6 && signals.prominence >= 0.56)) options.push("obelisk");
      options.push("monolith");
      return seededPick(options, seed) || "monolith";
    }
    return "";
  }

  function getSiteTags(type, signals, icon) {
    const tags = [];
    if (type === "ruin") {
      tags.push("abandoned", "ancient");
      if (signals.remoteness >= 0.72) tags.push("lost");
      if (signals.strategic >= 0.18) tags.push("contested");
    } else if (type === "holy_site") {
      tags.push("worship");
      if (signals.routeability >= 0.72) tags.push("pilgrimage");
      if (signals.forestCover >= 0.62 || icon === "sacred_grove") tags.push("sacred");
      if (signals.remoteness >= 0.68) tags.push("hidden");
    } else if (type === "arcane_site") {
      tags.push("research", "anomalous");
      if (signals.remoteness >= 0.68) tags.push("hidden");
      if (signals.anomaly >= 0.74) tags.push("forbidden");
    } else if (type === "wilderness_site") {
      tags.push("remote");
      if (signals.forestCover >= 0.62 || signals.wetAffinity >= 0.66) tags.push("frontier");
      if (icon === "spring" || icon === "waterfall") tags.push("sacred");
    } else if (type === "hazard") {
      if (icon === "bandit_camp") tags.push("lawless");
      if (icon === "battlefield") tags.push("warzone");
      if (icon === "volcano" || icon === "crater") tags.push("blighted");
      if (signals.remoteness >= 0.62) tags.push("forbidden");
    } else if (type === "landmark") {
      tags.push("ancient");
      if (icon === "lighthouse") tags.push("roadside");
      if (signals.anomaly >= 0.56) tags.push("mythic");
      if (signals.remoteness >= 0.66) tags.push("remote");
    }
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getSiteNotoriety(type, signals, icon) {
    let value = type === "landmark"
      ? 5
      : type === "hazard"
        ? 6
        : type === "holy_site" || type === "arcane_site"
          ? 6
          : 7;
    if (signals.routeability >= 0.72 || signals.coastalWaterAdjacent) value -= 1;
    if (signals.remoteness >= 0.76) value += 1;
    if (icon === "lighthouse" || icon === "monolith" || icon === "obelisk") value -= 1;
    return String(Math.max(3, Math.min(9, value)));
  }

  function getHolySiteRelatedSuffixes(icon) {
    if (icon === "sacred_grove") return ["Grove", "Glade"];
    if (icon === "temple") return ["Temple"];
    if (icon === "abbey") return ["Abbey"];
    if (icon === "shrine") return ["Shrine"];
    if (icon === "roadside_shrine") return ["Wayshrine", "Shrine"];
    if (icon === "graveyard") return ["Graveyard", "Cemetery"];
    if (icon === "mausoleum") return ["Mausoleum"];
    if (icon === "ziggurat") return ["Ziggurat"];
    return ["Shrine"];
  }

  function getHolySitePatternPrefixes(icon) {
    if (icon === "sacred_grove") return ["Sacred", "Whispering", "Old", "Green", "Silver", "Sun"];
    if (icon === "graveyard" || icon === "mausoleum") return ["Saint", "Pilgrim's", "Blessed", "Grey", "Old", "Mercy's", "Ash"];
    if (icon === "ziggurat") return ["High", "Sun", "Old", "Blessed", "Grey", "Stone"];
    return ["Saint", "Pilgrim's", "Blessed", "Grey", "Old", "Mercy's", "High"];
  }

  function getHolySitePatternSuffixes(icon) {
    if (icon === "sacred_grove") return ["Grove", "Glade"];
    if (icon === "temple") return ["Temple"];
    if (icon === "abbey") return ["Abbey"];
    if (icon === "shrine") return ["Shrine"];
    if (icon === "roadside_shrine") return ["Wayshrine", "Road Shrine", "Shrine"];
    if (icon === "graveyard") return ["Graveyard", "Cemetery"];
    if (icon === "mausoleum") return ["Mausoleum"];
    if (icon === "ziggurat") return ["Ziggurat"];
    return ["Shrine"];
  }

  function getHolySiteFallbackName(icon) {
    if (icon === "sacred_grove") return "Sacred Grove";
    if (icon === "temple") return "Old Temple";
    if (icon === "abbey") return "Grey Abbey";
    if (icon === "shrine" || icon === "roadside_shrine") return "Old Shrine";
    if (icon === "graveyard") return "Old Cemetery";
    if (icon === "mausoleum") return "Stone Mausoleum";
    if (icon === "ziggurat") return "Old Ziggurat";
    return "Old Shrine";
  }

  function buildSiteFallbackName(candidate) {
    if (candidate.type === "ruin") {
      if (candidate.icon === "shipwreck") return "Lost Wreck";
      if (candidate.icon === "abandoned_shack") return "Old Shack";
      if (candidate.icon === "pyramid") return "Old Pyramid";
      return "Old Ruins";
    }
    if (candidate.type === "holy_site") return getHolySiteFallbackName(candidate.icon);
    if (candidate.type === "arcane_site") return candidate.icon === "observatory" ? "High Observatory" : "Arcane Nexus";
    if (candidate.type === "wilderness_site") return candidate.icon === "waterfall" ? "Grey Falls" : "Old Spring";
    if (candidate.type === "hazard") return candidate.icon === "volcano" ? "Black Volcano" : "Blasted Ground";
    return candidate.icon === "lighthouse" ? "North Light" : "Stone Marker";
  }

  function generateSiteName(candidate, settings) {
    const seed = `${settings.seed}:site-name:${candidate.hex.id}:${candidate.type}`;
    const nearestSettlement = getGeneratedRelatedSettlementBaseName(candidate.meta, 3);
    if (candidate.type === "ruin") {
      if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.52) {
        return buildRelatedGeneratedSiteName(
          seed,
          nearestSettlement,
          candidate.icon === "shipwreck"
            ? ["Wreck", "Hulk"]
            : candidate.icon === "abandoned_shack"
              ? ["Shack", "Cabin", "Hut"]
              : ["Ruins", "Old Stones", "Remains"],
          candidate.icon === "abandoned_shack"
            ? ["Old", "Broken", "Lost", "Windblown", "Frost"]
            : ["Old", "Broken", "Lost", "Sunken"],
          { qualifierChance: 0.24 }
        );
      }
      return buildGeneratedPatternName(seed, [{
        prefixes: candidate.icon === "abandoned_shack"
          ? ["Broken", "Old", "Lost", "Frost", "Wind", "Last", "Grey", "Snow", "Shuttered", "Lonely"]
          : ["Broken", "Old", "Lost", "Fallen", "Black", "Dust", "Ash", "Sunken", "Grey", "Shattered"],
        suffixes: candidate.icon === "shipwreck"
          ? ["Wreck", "Hulk", "Bones"]
          : candidate.icon === "abandoned_shack"
            ? ["Shack", "Cabin", "Hut", "Lean-to"]
            : candidate.icon === "pyramid"
              ? ["Pyramid", "Steps", "Tomb"]
              : ["Ruins", "Remains", "Stones"],
        forceSpace: true
      }]);
    }
    if (candidate.type === "holy_site") {
      if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.42) {
        return buildRelatedGeneratedSiteName(
          seed,
          nearestSettlement,
          getHolySiteRelatedSuffixes(candidate.icon),
          ["Saint's", "Blessed", "Old", "Pilgrim's"],
          { qualifierChance: 0.22, qualifierAfter: false }
        );
      }
      return buildGeneratedPatternName(seed, [{
        prefixes: getHolySitePatternPrefixes(candidate.icon),
        suffixes: getHolySitePatternSuffixes(candidate.icon),
        forceSpace: true
      }]);
    }
    if (candidate.type === "arcane_site") {
      if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.34) {
        return buildRelatedGeneratedSiteName(seed, nearestSettlement, ["Tower", "Nexus", "Observatory", "Portal"], ["Old", "High", "Veiled", "Star"], { qualifierChance: 0.18 });
      }
      return buildGeneratedPatternName(seed, [{
        prefixes: ["Arcane", "Star", "Rune", "Veiled", "Astral", "Black", "Glass", "Silver", "Moon", "Whisper"],
        suffixes: candidate.icon === "arcane_portal" ? ["Portal", "Gate", "Rift"] : candidate.icon === "ley_nexus" ? ["Nexus", "Convergence", "Knot"] : candidate.icon === "observatory" ? ["Observatory", "Watch", "Spire"] : candidate.icon === "laboratory" ? ["Laboratory", "Works", "Hall"] : ["Tower", "Spire", "Aerie"],
        forceSpace: true
      }]);
    }
    if (candidate.type === "wilderness_site") {
      return buildGeneratedPatternName(seed, [{
        prefixes: candidate.icon === "oasis" ? ["Amber", "Last", "Hidden", "Silver", "Palm", "Sun"] : candidate.icon === "swamp" ? ["Black", "Mire", "Willow", "Ghost", "Still", "Fen"] : candidate.icon === "waterfall" ? ["Grey", "Silver", "Stone", "North", "White", "Twin"] : candidate.icon === "spring" ? ["Clear", "Sweet", "Old", "Silver", "Moon", "Still"] : ["Ancient", "Green", "Ash", "Dead", "Whisper", "Wild"],
        suffixes: candidate.icon === "oasis" ? ["Oasis", "Well", "Pool"] : candidate.icon === "swamp" ? ["Swamp", "Fen", "Mire"] : candidate.icon === "waterfall" ? ["Falls", "Cataract", "Drop"] : candidate.icon === "spring" ? ["Spring", "Source", "Well"] : candidate.icon === "geyser" ? ["Geyser", "Vent", "Steam"] : candidate.icon === "tree" ? ["Tree", "Grove", "Bole"] : ["Tree", "Stump", "Marker"],
        forceSpace: true
      }]);
    }
    if (candidate.type === "hazard") {
      return buildGeneratedPatternName(seed, [{
        prefixes: candidate.icon === "bandit_camp" ? ["Black", "Wolf", "Red", "Dust", "Outlaw", "Broken"] : candidate.icon === "battlefield" ? ["Ash", "Broken", "Blood", "Old", "Fallen", "Banner"] : candidate.icon === "volcano" ? ["Black", "Ash", "Fire", "Cinder", "Red", "Smoke"] : ["Blasted", "Fallen", "Cracked", "Ash", "Broken", "Dead"],
        suffixes: candidate.icon === "bandit_camp" ? ["Camp", "Hideout", "Den"] : candidate.icon === "battlefield" ? ["Field", "Ground", "March"] : candidate.icon === "volcano" ? ["Volcano", "Peak", "Mount"] : ["Crater", "Pit", "Scar"],
        forceSpace: true
      }]);
    }
    if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.32) {
      return buildRelatedGeneratedSiteName(seed, nearestSettlement, ["Stone", "Marker", "Light", "Obelisk"], ["Old", "High", "North", "South"], { qualifierChance: 0.18 });
    }
    return buildGeneratedPatternName(seed, [{
      prefixes: candidate.icon === "lighthouse" ? ["North", "Grey", "Storm", "Salt", "West", "Lantern"] : ["Stone", "Old", "Grey", "Whisper", "High", "Rune"],
      suffixes: candidate.icon === "lighthouse" ? ["Light", "Beacon", "Watch"] : candidate.icon === "standing_stones" ? ["Stones", "Circle", "Ring"] : candidate.icon === "obelisk" ? ["Obelisk", "Needle", "Pillar"] : ["Monolith", "Stone", "Marker"],
      forceSpace: true
    }]);
  }

  function buildResourceSiteDrafts({ candidateHexes, settlementAnchors, occupiedHexIds, byId, byCoord, dimensions, riverData, settings, usedNames, random, existingPois }) {
    const existingCount = getExistingPoiTypeCount(existingPois, "resource_site");
    const targetCount = getTargetResourceSiteCount(candidateHexes, settlementAnchors, settings, existingCount);
    if (!targetCount) return [];

    const candidates = candidateHexes
      .map(hex => buildResourceCandidate(hex, settlementAnchors, byId, byCoord, dimensions, riverData, settings))
      .filter(candidate => candidate && candidate.score >= 0.34)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));

    const chosen = [];
    const supportUsage = new Map();
    const iconUsage = new Map();
    const contextUsage = new Map();
    const remaining = [...candidates];
    while (remaining.length && chosen.length < targetCount) {
      let bestIndex = -1;
      let bestScore = 0;
      remaining.forEach((candidate, index) => {
        if (!candidate?.hex || occupiedHexIds.has(candidate.hex.id)) return;
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return;
        if (!canChooseResourceCandidate(candidate, supportUsage)) return;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const contextFactor = getPoiContextCoverageFactor(
          getResourceCandidateContextKey(candidate),
          contextUsage,
          { emptyFactor: 1.16, lightFactor: 1.04, mediumFactor: 0.88, heavyFactor: 0.78, crowdedFactor: 0.7 }
        );
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, { radius: 6, stepPenalty: 0.04, maxPenalty: 0.16 });
        const effectiveScore = candidate.score * variantFactor * coverageFactor * contextFactor - crowdPenalty;
        if (effectiveScore > bestScore) {
          bestScore = effectiveScore;
          bestIndex = index;
        }
      });
      if (bestIndex < 0 || bestScore < 0.18) break;
      const [candidate] = remaining.splice(bestIndex, 1);
      chosen.push(candidate);
      registerResourceCandidateSupport(candidate, supportUsage);
      iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
      bumpPoiUsageCount(contextUsage, getResourceCandidateContextKey(candidate));
      occupiedHexIds.add(candidate.hex.id);
    }

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
    const nearestSettlement = settlementAnchors.length ? findNearestSettlementAnchor(hex, settlementAnchors) : null;
    if (settlementAnchors.length && (!nearestSettlement || nearestSettlement.distance < 1 || nearestSettlement.distance > 6)) return null;
    const specialization = chooseResourceSpecialization(hex, nearby, riverData, { nearestSettlement, byCoord });
    if (!specialization) return null;
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const supportDistance = nearestSettlement?.distance ?? 5;
    const proximityScore = nearestSettlement
      ? nearestSettlement.distance <= 3
        ? 1 - (nearestSettlement.distance - 1) * 0.18
        : 0.52 - (nearestSettlement.distance - 4) * 0.11
      : 0.44 + Math.max(0, routeability - 0.34) * 0.32;
    const remoteness = nearestSettlement ? Math.min(1, supportDistance / 6) : 0.92;
    const score = nearestSettlement
      ? specialization.score * 0.5 + proximityScore * 0.28 + routeability * 0.12 + remoteness * 0.10
      : specialization.score * 0.7 + proximityScore * 0.12 + routeability * 0.08 + remoteness * 0.10;
    if (score < 0.3) return null;
    const tags = getResourceTags(specialization, supportDistance, specialization.icon);
    return {
      hex,
      score,
      icon: specialization.icon,
      tags,
      notoriety: getResourceNotoriety(specialization, supportDistance),
      meta: {
        kind: specialization.kind,
        label: specialization.label,
        nearestSettlement: nearestSettlement?.anchor?.name || "",
        nearestSettlementId: nearestSettlement?.anchor?.id || "",
        nearestSettlementImportance: Number(nearestSettlement?.anchor?.importance || 0),
        supportDistance
      }
    };
  }

  function getResourceCandidateSupportCapacity(candidate) {
    const supportDistance = Number(candidate?.meta?.supportDistance || 0);
    const importance = Number(candidate?.meta?.nearestSettlementImportance || 0);
    let capacity = importance >= 1.1
      ? 3
      : importance >= 0.75
        ? 2
        : 1;
    if (supportDistance >= 5) capacity = Math.min(capacity, 1);
    return Math.max(1, capacity);
  }

  function canChooseResourceCandidate(candidate, supportUsage) {
    const supportKey = String(candidate?.meta?.nearestSettlementId || "").trim();
    if (!supportKey) return true;
    const limit = getResourceCandidateSupportCapacity(candidate);
    return (supportUsage.get(supportKey) || 0) < limit;
  }

  function registerResourceCandidateSupport(candidate, supportUsage) {
    const supportKey = String(candidate?.meta?.nearestSettlementId || "").trim();
    if (!supportKey) return;
    supportUsage.set(supportKey, (supportUsage.get(supportKey) || 0) + 1);
  }

  function getSettlementWaterContext(hex, byCoord, riverData) {
    if (!hex) return { coastal: false, river: false };
    const nearby = nearbyWithin(hex, byCoord, 1);
    return {
      coastal: nearby.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain)),
      river: hasRiverAccess(hex, nearby, riverData)
    };
  }

  function chooseResourceSpecialization(hex, nearby, riverData, context = {}) {
    const candidates = [];
    const seed = `resource-specialization:${hex.id}`;
    const elevation = Number(hex.elevation || 0);
    const rockCount = getNearbyTerrainCount([hex, ...nearby], ["rock", "snow"]);
    const highlandFeature = (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"].includes(feature));
    const forestCount = (hex.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length
      + nearby.reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const fertility = scoreSettlementFertility(hex, nearby);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const nearestSettlement = context?.nearestSettlement || null;
    const immediateNearby = context?.byCoord ? nearbyWithin(hex, context.byCoord, 1) : nearby;
    const coastalWater = nearby.some(neighbor => ["coastal_water", "sea"].includes(neighbor.baseTerrain));
    const riverWater = hasRiverAccess(hex, nearby, riverData);
    const inlandWater = nearby.some(neighbor => neighbor.baseTerrain === "inland_water");
    const waterish = riverWater || coastalWater || inlandWater;
    const immediateCoastalWater = immediateNearby.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const immediateRiverWater = hasRiverAccess(hex, immediateNearby, riverData);
    const immediateInlandWater = immediateNearby.some(neighbor => neighbor.baseTerrain === "inland_water");
    const immediateWaterish = immediateCoastalWater || immediateRiverWater || immediateInlandWater;
    const openFarmland = forestCount <= 1 && !highlandFeature && elevation <= 2;
    const coastalMiningPenalty = coastalWater && !highlandFeature && elevation < 4
      ? 0.18
      : coastalWater && elevation < 5
        ? 0.1
        : 0;
    const nearestSettlementWater = nearestSettlement?.anchor?.hex
      ? getSettlementWaterContext(nearestSettlement.anchor.hex, context?.byCoord, riverData)
      : { coastal: false, river: false };

    if (rockCount >= 2 || highlandFeature || elevation >= 3) {
      const mineScore = highlandFeature || elevation >= 4
        ? 0.98
        : rockCount >= 3 || elevation >= 3
          ? 0.94
          : 0.86;
      candidates.push({ kind: "mine", label: "Mine", icon: "mine", score: mineScore - coastalMiningPenalty });
    }
    if (rockCount >= 2 || elevation >= 2) {
      const quarryScore = rockCount >= 3 || elevation >= 3 ? 0.82 : 0.74;
      candidates.push({ kind: "quarry", label: "Quarry", icon: "quarry", score: quarryScore - coastalMiningPenalty * 0.85 });
    }
    if (forestCount >= 2 || ["jungle_floor", "lush_grassland", "wetland"].includes(hex.baseTerrain)) {
      const lumberScore = forestCount >= 4 ? 0.9 : forestCount >= 2 ? 0.82 : 0.74;
      candidates.push({
        kind: "lumber",
        label: "Lumber Camp",
        icon: "lumber_camp",
        score: lumberScore + (nearestSettlement?.distance >= 4 ? 0.04 : 0)
      });
      if (forestCount >= 3 || routeability >= 0.56 || (nearestSettlement && nearestSettlement.distance <= 3)) {
        candidates.push({
          kind: "lumber",
          label: "Lumber Mill",
          icon: "lumber_mill",
          score: lumberScore + 0.02
        });
      }
    }
    if (fertility >= 0.78 && !highlandFeature && rockCount < 3) {
      const farmScore = waterish && fertility < 0.9 ? 0.8 : 0.88;
      candidates.push({
        kind: "farm",
        label: "Farms",
        icon: "farmstead",
        score: farmScore
      });
      if (openFarmland && routeability >= 0.58 && fertility >= 0.82 && !coastalWater) {
        candidates.push({
          kind: "farm",
          label: "Windmill",
          icon: "windmill",
          score: farmScore + 0.02
        });
      }
    }
    if (immediateWaterish) {
      const dockEligible = nearestSettlement?.distance === 1
        && (nearestSettlementWater.coastal || nearestSettlementWater.river)
        && (immediateCoastalWater || (immediateRiverWater && Number(nearestSettlement?.anchor?.importance || 0) >= 0.75 && routeability >= 0.62));
      const fisheryScore = immediateCoastalWater
        ? 0.96
        : immediateRiverWater
          ? 0.9 + (riverData.riverHexIds.has(hex.id) ? 0.06 : 0)
          : immediateInlandWater
            ? 0.78
            : 0.72;
      candidates.push({
        kind: "fishery",
        label: "Fishing Camp",
        icon: "fishing_camp",
        score: fisheryScore
      });
      if (dockEligible) {
        candidates.push({
          kind: "fishery",
          label: "Docks",
          icon: "docks",
          score: fisheryScore + 0.02
        });
      }
      if (
        dockEligible &&
        immediateCoastalWater &&
        Number(nearestSettlement?.anchor?.importance || 0) >= 1.05
      ) {
        candidates.push({
          kind: "fishery",
          label: "Harbor",
          icon: "harbor",
          score: fisheryScore + 0.02
        });
      }
    }

    const bestScore = Math.max(0, ...candidates.map(candidate => candidate.score));
    const eligible = candidates.filter(candidate => candidate.score >= bestScore - 0.18);
    if (!eligible.length) return null;
    const icon = seededPick(eligible.map(candidate => candidate.icon), `${seed}:icon`);
    return eligible.find(candidate => candidate.icon === icon) || eligible[0];
  }

  function getResourceTags(specialization, distance, icon) {
    const tags = [];
    if (specialization.kind === "mine") tags.push("mining");
    if (specialization.kind === "quarry") tags.push("craftwork");
    if (specialization.kind === "lumber") tags.push("craftwork");
    if (specialization.kind === "farm") tags.push("farming");
    if (specialization.kind === "fishery") tags.push("fishing");
    if (distance >= 4) tags.push("remote");
    if (distance <= 2) tags.push("occupied");
    return mergeGeneratedTagsForIcon(tags, icon);
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
    const nearestSettlement = getGeneratedRelatedSettlementBaseName(candidate.meta, 3);
    const kind = candidate.meta?.kind || "resource";
    const icon = String(candidate?.icon || "").trim();
    const relatedSuffixes = icon === "mine"
      ? ["Mine", "Diggings", "Delve", "Pit", "Shaft"]
      : icon === "quarry"
        ? ["Quarry", "Stoneworks", "Cut", "Face"]
        : icon === "lumber_camp"
          ? ["Timber Camp", "Logging Camp", "Woodlot", "Yard"]
          : icon === "lumber_mill"
            ? ["Mill", "Timber Mill", "Woodworks", "Yard"]
            : icon === "fishing_camp"
              ? ["Fishery", "Fish Weir", "Net Yard", "Camp"]
              : icon === "docks"
                ? ["Docks", "Landing", "Wharf", "Quay"]
                : icon === "harbor"
                  ? ["Harbor", "Port", "Quay", "Wharf"]
                  : icon === "windmill"
                    ? ["Windmill", "Mill", "Grange", "Fields"]
                    : ["Farms", "Fields", "Grange", "Holdings", "Meadows"];
    const relatedQualifiers = icon === "mine"
      ? ["Old", "Upper", "Lower", "North", "South", "Red", "Black", "Deep"]
      : icon === "quarry"
        ? ["Old", "Upper", "Lower", "Grey", "White", "East", "West"]
        : icon === "lumber_camp" || icon === "lumber_mill"
          ? ["Upper", "Lower", "Old", "North", "South", "Green", "Outer"]
          : icon === "fishing_camp" || icon === "docks" || icon === "harbor"
            ? ["Upper", "Lower", "North", "South", "Outer"]
            : ["North", "South", "East", "West", "Upper", "Lower", "Outer"];

    if (nearestSettlement && seededUnit(`${seed}:related-roll`) < 0.72) {
      return buildRelatedGeneratedSiteName(seed, nearestSettlement, relatedSuffixes, relatedQualifiers, {
        qualifierChance: kind === "farm" ? 0.58 : 0.38
      });
    }

    const patterns = icon === "mine"
      ? [
          {
            prefixes: ["Iron", "Copper", "Black", "Stone", "Deep", "Cinder", "Ash", "Red", "Tin", "Silver", "Lead", "Cold", "Raven", "Torch", "Crag", "Hammer"],
            suffixes: ["Mine", "Delve", "Diggings", "Pit", "Shaft"],
            forceSpace: true
          }
        ]
      : icon === "quarry"
        ? [
            {
              prefixes: ["Grey", "Stone", "King's", "Old", "White", "Brass", "Slate", "Hard", "Hill", "Red", "Cold", "Marble", "Flint"],
              suffixes: ["Quarry", "Cut", "Stoneworks", "Face"],
              forceSpace: true
            }
          ]
        : icon === "lumber_camp"
          ? [
              {
                prefixes: ["Pine", "Oak", "Willow", "Moss", "Bracken", "Timber", "Green", "Cedar", "Alder", "Ash", "Birch", "Fern", "Southwood", "Lantern", "Warden's"],
                suffixes: ["Camp", "Woodlot", "Yard", "Cut"],
                forceSpace: true
              }
            ]
          : icon === "lumber_mill"
            ? [
                {
                  prefixes: ["Pine", "Oak", "Timber", "Green", "Cedar", "Alder", "Ash", "Southwood", "Lantern", "Warden's", "Mill", "Wood"],
                  suffixes: ["Mill", "Timber Mill", "Woodworks", "Yard"],
                  forceSpace: true
                }
              ]
            : icon === "fishing_camp"
              ? [
                  {
                    prefixes: ["Reed", "Marsh", "River", "Salt", "Shore", "Tide", "Eel", "Mud", "Delta", "Shallows", "Willow", "Netter's"],
                    suffixes: ["Fishery", "Fish Weir", "Net Yard", "Camp"],
                    forceSpace: true
                  }
                ]
              : icon === "docks"
                ? [
                    {
                      prefixes: ["Reed", "River", "Southbank", "Grey", "Stone", "Willow", "Lantern", "Bell", "Moss", "Otter", "Marsh"],
                      suffixes: ["Docks", "Landing", "Wharf", "Quay"],
                      forceSpace: true
                    }
                  ]
                : icon === "harbor"
                  ? [
                      {
                        prefixes: ["Grey", "Salt", "Tide", "Breakwater", "Southbank", "Willow", "Lantern", "Bell", "Harbor", "Drift"],
                        suffixes: ["Harbor", "Port", "Quay", "Wharf"],
                        forceSpace: true
                      }
                    ]
                  : icon === "windmill"
                    ? [
                        {
                          prefixes: ["South", "West", "Green", "Amber", "Meadow", "Willow", "Barley", "Harvest", "Sun", "Long", "Elm", "Red", "Candle", "Bell", "Turning", "Lantern"],
                          suffixes: ["Windmill", "Mill", "Grange", "Fields"],
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
    const targetCount = getTargetWaypointCount(candidateHexes, settlementAnchors, settings, existingCount);
    if (!targetCount) return [];

    const candidates = settlementAnchors.length >= 2
      ? buildRoutedWaypointCandidates({ settlementAnchors, byId, byCoord, dimensions, riverData, settings })
      : buildFallbackWaypointCandidates({ candidateHexes, settlementAnchors, byCoord, dimensions, riverData, settings });

    const chosen = [];
    const routeUsage = new Map();
    const iconUsage = new Map();
    const contextUsage = new Map();
    const remaining = [...candidates];
    const chooseNextWaypointCandidate = filterFn => {
      let bestIndex = -1;
      let bestScore = 0;
      remaining.forEach((candidate, index) => {
        if (!candidate?.hex || occupiedHexIds.has(candidate.hex.id)) return;
        if (filterFn && !filterFn(candidate)) return;
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return;
        if (!canChooseWaypointCandidate(candidate, routeUsage)) return;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const contextFactor = getPoiContextCoverageFactor(
          getWaypointCandidateContextKey(candidate),
          contextUsage,
          { emptyFactor: 1.16, lightFactor: 1.05, mediumFactor: 0.9, heavyFactor: 0.8, crowdedFactor: 0.72 }
        );
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, { radius: 5, stepPenalty: 0.035, maxPenalty: 0.14 });
        const effectiveScore = candidate.score * variantFactor * coverageFactor * contextFactor - crowdPenalty;
        if (effectiveScore > bestScore) {
          bestScore = effectiveScore;
          bestIndex = index;
        }
      });
      if (bestIndex < 0 || bestScore < 0.16) return null;
      const [candidate] = remaining.splice(bestIndex, 1);
      chosen.push(candidate);
      registerWaypointRouteUsage(candidate, routeUsage);
      iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
      bumpPoiUsageCount(contextUsage, getWaypointCandidateContextKey(candidate));
      occupiedHexIds.add(candidate.hex.id);
      return candidate;
    };

    const settledRestTarget = settlementAnchors.length >= 2
      ? Math.min(targetCount, Math.max(1, Math.round(targetCount * 0.28)))
      : 0;
    while (settledRestTarget > 0 && chosen.length < settledRestTarget) {
      if (!chooseNextWaypointCandidate(candidate => candidate.icon === "inn" || candidate.icon === "tavern")) break;
    }

    while (chosen.length < targetCount) {
      if (!chooseNextWaypointCandidate()) break;
    }

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

  function buildRoutedWaypointCandidates({ settlementAnchors, byId, byCoord, dimensions, riverData, settings }) {
    const routes = buildWaypointRouteCandidates(settlementAnchors, byId, byCoord, dimensions, riverData, settings);
    const byHex = new Map();
    routes.forEach(route => {
      const startTrim = Math.max(1, Math.floor(route.path.length * 0.2));
      const endTrim = Math.max(startTrim + 1, Math.ceil(route.path.length * 0.8));
      route.path.slice(startTrim, endTrim).forEach((hexId, index) => {
        const hex = byId.get(hexId);
        if (!hex || !isPoiLandHex(hex)) return;
        const nearby = nearbyWithin(hex, byCoord, 1);
        const crossing = riverData.riverHexIds.has(hex.id) ? 1 : 0;
        const passStrength = getWaypointPassStrength(hex, nearby);
        const pass = passStrength > 0 ? 1 : 0;
        const frontier = distanceToMapEdge(hex, dimensions) <= 2 ? 1 : 0;
        const midpointBias = 1 - Math.abs((index / Math.max(1, route.path.length - 1)) - 0.5);
        const fullPathIndex = startTrim + index;
        const endpointDistance = Math.min(fullPathIndex, Math.max(0, route.path.length - 1 - fullPathIndex));
        const record = byHex.get(hexId) || { hex, corridorCount: 0, crossing: 0, pass: 0, passStrength: 0, frontier: 0, midpoint: 0, nearby };
        record.corridorCount += 1;
        record.crossing = Math.max(record.crossing, crossing);
        record.pass = Math.max(record.pass, pass);
        record.passStrength = Math.max(record.passStrength || 0, passStrength);
        record.frontier = Math.max(record.frontier, frontier);
        record.midpoint = Math.max(record.midpoint, midpointBias);
        record.endpointDistance = Math.max(Number(record.endpointDistance || 0), endpointDistance);
        if (!record.routeNames) record.routeNames = new Set();
        if (!record.routeKeys) record.routeKeys = new Set();
        if (route.from?.name) record.routeNames.add(route.from.name);
        if (route.to?.name) record.routeNames.add(route.to.name);
        if (route.key) record.routeKeys.add(route.key);
        byHex.set(hexId, record);
      });
    });

    return [...byHex.values()]
      .map(record => buildWaypointCandidateFromRecord(record, settlementAnchors, riverData, settings))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));
  }

  function buildFallbackWaypointCandidates({ candidateHexes, settlementAnchors, byCoord, dimensions, riverData, settings }) {
    return (candidateHexes || [])
      .map(hex => {
        const nearby = nearbyWithin(hex, byCoord, 1);
        const crossing = riverData.riverHexIds.has(hex.id) ? 1 : 0;
        const passStrength = getWaypointPassStrength(hex, nearby);
        const pass = passStrength > 0 ? 1 : 0;
        const frontier = distanceToMapEdge(hex, dimensions) <= 2 ? 1 : 0;
        const waterside = nearby.some(neighbor => ["coastal_water", "sea", "deep_sea", "inland_water"].includes(neighbor.baseTerrain));
        const snowNearby = [hex, ...nearby].filter(neighbor => (
          neighbor?.baseTerrain === "snow"
          || (neighbor?.features || []).includes("snowcapped_mountains")
        )).length;
        const easyExits = neighbors(hex, byCoord)
          .filter(neighbor => isPoiLandHex(neighbor) && getTerrainRoughness(neighbor.baseTerrain, neighbor.features) <= 0.42)
          .length;
        const routeability = scoreSettlementRouteability(hex, nearby, riverData);
        const corridorCount = easyExits >= 5 ? 3 : easyExits >= 4 ? 2 : 1;
        const restStop = waterside && routeability >= 0.82 && easyExits >= 5 ? 1 : 0;
        const coldRestStop = snowNearby >= 3 && routeability >= 0.38 && easyExits >= 3 ? 1 : 0;
        if (!crossing && !pass && !frontier && !restStop && !coldRestStop) return null;
        const midpoint = clamp(0.42 + routeability * 0.5, 0.42, 0.9, 0.62);
        return buildWaypointCandidateFromRecord({
          hex,
          nearby,
          corridorCount: coldRestStop ? Math.max(2, corridorCount) : corridorCount,
          crossing,
          pass,
          passStrength,
          frontier,
          midpoint,
          coldRestStop,
          routeNames: new Set()
        }, settlementAnchors, riverData, settings);
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.hex.id.localeCompare(b.hex.id));
  }

  function buildWaypointCandidateFromRecord(record, settlementAnchors, riverData, settings = {}) {
    const nearestSettlement = settlementAnchors.length ? findNearestSettlementAnchor(record.hex, settlementAnchors) : null;
    if (nearestSettlement && nearestSettlement.distance < 2) return null;
    const endpointDistance = Math.max(0, Number(record.endpointDistance || 0));
    if (!record.crossing && !record.pass && endpointDistance > 0 && endpointDistance < 3) return null;
    const passWeight = record.pass ? Math.max(1, Number(record.passStrength || 1)) : 0;
    const baseScore = Math.min(1, record.corridorCount / 3) * 0.4 + record.crossing * 0.16 + passWeight * 0.16 + record.midpoint * 0.12;
    const frontierBias = record.frontier ? 0.08 : 0;
    const routeability = scoreSettlementRouteability(record.hex, record.nearby, riverData) * 0.1;
    const settlementGapBias = nearestSettlement
      ? nearestSettlement.distance >= 4
        ? 0.08
        : nearestSettlement.distance === 3
          ? 0.03
          : -0.06
      : 0.04;
    const endpointGapBias = endpointDistance >= 5
      ? 0.08
      : endpointDistance >= 4
        ? 0.05
        : endpointDistance >= 3
          ? 0.02
          : endpointDistance > 0
            ? -0.08
            : 0;
    const coldRestBias = record.coldRestStop ? 0.12 : 0;
    const score = baseScore + frontierBias + routeability + settlementGapBias + endpointGapBias + coldRestBias;
    if (score < 0.32) return null;
    const icon = chooseWaypointIcon(record, settings);
    const tags = getWaypointTags(record, icon);
    return {
      hex: record.hex,
      score,
      icon,
      tags,
      notoriety: getWaypointNotoriety(record, nearestSettlement?.distance ?? 6),
      meta: {
        corridorCount: record.corridorCount,
        crossing: record.crossing,
        pass: record.pass,
        passStrength: record.passStrength || 0,
        frontier: record.frontier,
        nearestSettlement: nearestSettlement?.anchor?.name || "",
        nearestSettlementDistance: nearestSettlement?.distance ?? 0,
        routeNames: record.routeNames ? [...record.routeNames].filter(Boolean).slice(0, 4) : [],
        routeKeys: record.routeKeys ? [...record.routeKeys].filter(Boolean).slice(0, 6) : []
      }
    };
  }

  function getWaypointRouteCapacity(candidate) {
    return candidate?.meta?.crossing || candidate?.meta?.pass || Number(candidate?.meta?.corridorCount || 0) >= 3
      ? 2
      : 1;
  }

  function canChooseWaypointCandidate(candidate, routeUsage) {
    const routeKeys = Array.isArray(candidate?.meta?.routeKeys) ? candidate.meta.routeKeys.filter(Boolean) : [];
    if (!routeKeys.length) return true;
    const limit = getWaypointRouteCapacity(candidate);
    return routeKeys.some(routeKey => (routeUsage.get(routeKey) || 0) < limit);
  }

  function registerWaypointRouteUsage(candidate, routeUsage) {
    const routeKeys = Array.isArray(candidate?.meta?.routeKeys) ? candidate.meta.routeKeys.filter(Boolean) : [];
    routeKeys.forEach(routeKey => {
      routeUsage.set(routeKey, (routeUsage.get(routeKey) || 0) + 1);
    });
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

  function chooseWaypointIcon(record, settings = {}) {
    const concentration = clamp(settings?.populationConcentration, 0.5, 1.5, 1);
    const highConcentration = concentration >= 1.08;
    const lowConcentration = concentration <= 0.84;
    const passStrength = Number(record.passStrength || 0);
    const seed = `waypoint-icon:${record.hex.id}:${record.corridorCount}:${record.crossing}:${record.pass}:${Math.round(concentration * 100)}`;

    if (record.crossing && !record.pass) {
      const eligible = record.corridorCount >= 3
        ? (highConcentration ? ["bridge", "bridge", "bridge_gate", "ford", "ferry"] : ["bridge", "bridge", "ford", "ferry"])
        : record.corridorCount >= 2
          ? (highConcentration ? ["bridge", "bridge_gate", "ford", "ferry"] : ["bridge", "ford", "ferry"])
          : ["ford", "ferry", "bridge"];
      return seededPick(eligible, seed) || "ford";
    }
    if (record.pass) {
      const eligible = ["mountain_pass", "lodge"];
      if (record.frontier || lowConcentration) eligible.push("campsite");
      return seededPick(eligible, `${seed}:${passStrength}`) || "mountain_pass";
    }
    if (record.coldRestStop) {
      const eligible = highConcentration
        ? ["inn", "tavern", "lodge"]
        : lowConcentration
          ? ["lodge", "inn", "campsite"]
          : ["inn", "lodge", "tavern"];
      return seededPick(eligible, `${seed}:cold`) || "lodge";
    }
    if (record.corridorCount >= 3) {
      const eligible = highConcentration
        ? ["market", "inn", "tavern"]
        : lowConcentration
          ? ["inn", "tavern", "lodge"]
          : ["market", "inn", "tavern"];
      return seededPick(eligible, seed) || "inn";
    }
    if (record.frontier) {
      const eligible = lowConcentration ? ["campsite", "lodge"] : ["lodge", "inn", "campsite"];
      return seededPick(eligible, seed) || "lodge";
    }
    if (record.corridorCount >= 2) {
      const eligible = lowConcentration ? ["inn", "tavern", "lodge"] : ["inn", "tavern"];
      return seededPick(eligible, seed) || "inn";
    }
    if (record.midpoint >= 0.66) return seededPick(["inn", "tavern"], seed) || "inn";
    if (record.midpoint >= 0.48) return seededPick(lowConcentration ? ["tavern", "inn", "campsite"] : ["inn", "tavern"], seed) || "inn";
    return seededPick(lowConcentration ? ["tavern", "campsite", "inn"] : ["inn", "tavern"], seed) || "inn";
  }

  function getWaypointTags(record, icon) {
    const tags = ["rest"];
    if (icon === "ford") {
      if (record.corridorCount >= 2) tags.push("trade");
      if (record.corridorCount >= 3) tags.push("crossroads");
      else tags.push("roadside");
      tags.push("river_crossing");
      return mergeGeneratedTagsForIcon(tags, icon);
    }
    if (icon === "bridge" || icon === "bridge_gate") {
      if (record.corridorCount >= 2) tags.push("trade");
      if (record.corridorCount >= 3) tags.push("crossroads");
      else tags.push("roadside");
      tags.push("river_crossing");
      return mergeGeneratedTagsForIcon(tags, icon);
    }
    if (icon === "mountain_pass" || icon === "border_post") {
      if (record.corridorCount >= 2) tags.push("trade");
      tags.push("frontier");
      return mergeGeneratedTagsForIcon(tags, icon);
    }
    if (record.corridorCount >= 2) tags.push("trade");
    if (record.corridorCount >= 3) tags.push("crossroads");
    else tags.push("roadside");
    if (record.frontier && (icon === "lodge" || icon === "campsite")) tags.push("frontier");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getWaypointNotoriety(record, settlementDistance) {
    let value = record.corridorCount >= 3 ? 5 : 6;
    if (record.crossing) value -= 1;
    if (settlementDistance >= 5) value += 1;
    return String(Math.max(4, Math.min(9, value)));
  }

  function generateWaypointName(candidate, settings) {
    const seed = `${settings.seed}:waypoint-name:${candidate.hex.id}`;
    const relatedBaseName = getGeneratedRelatedSettlementBaseName(candidate.meta, 3);

    if (candidate.icon === "ford") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.58) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Ford", "Crossing"], ["Old", "Upper", "Lower", "Reed", "Willow", "North", "South"], {
          qualifierChance: 0.28
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Stone", "Grey", "Willow", "Reed", "Otter", "Low", "South", "North", "Alder", "White", "Moss", "Old", "Three", "Kings", "Bracken", "Lantern", "Bell", "Wayfarers"],
          suffixes: ["Ford", "Crossing"],
          forceSpace: true
        },
        {
          prefixes: ["Stone", "Grey", "Willow", "Otter", "Moss", "Alder", "Reed", "Kings"],
          suffixes: ["ford", "cross"],
          forceSpace: false
        }
      ]);
    }

    if (candidate.icon === "bridge") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.56) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Bridge"], ["Old", "Stone", "Upper", "Lower", "North", "South"], {
          qualifierChance: 0.24
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Stone", "Grey", "King's", "Lantern", "River", "Reed", "Old", "South", "North", "Moss", "Willow", "Bell", "Warden's"],
          suffixes: ["Bridge", "Span"],
          forceSpace: true
        },
        {
          prefixes: ["Stone", "Grey", "Willow", "Reed", "Otter", "Moss", "Kings", "Southbank"],
          suffixes: ["bridge", "span"],
          forceSpace: false
        }
      ]);
    }

    if (candidate.icon === "bridge_gate") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.54) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Bridge", "Gate", "Post"], ["Old", "Stone", "Upper", "Lower", "North", "South"], {
          qualifierChance: 0.26
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Stone", "Grey", "King's", "Lantern", "River", "Reed", "Old", "South", "North", "Moss", "Willow", "Bell", "Warden's"],
          suffixes: ["Bridge", "Gate", "Post", "Crossing"],
          forceSpace: true
        }
      ]);
    }

    if (candidate.icon === "ferry") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.54) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Ferry", "Landing", "Crossing"], ["Old", "Upper", "Lower", "North", "South", "East", "West"], {
          qualifierChance: 0.24
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Grey", "Stone", "Willow", "Reed", "Otter", "South", "North", "Lower", "Upper", "Mud", "Marsh", "Bell", "Lantern", "Three Oars", "Crosswater", "Southbank"],
          suffixes: ["Ferry", "Landing", "Crossing", "Wharf"],
          forceSpace: true
        },
        {
          prefixes: ["Stone", "Willow", "Otter", "Reed", "Mud", "Marsh", "Crosswater", "Southbank"],
          suffixes: ["ferry", "landing", "crossing"],
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

    if (candidate.icon === "border_post") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.46) {
        return buildRelatedGeneratedSiteName(seed, relatedBaseName, ["Post", "Gate", "Watch"], ["North", "South", "East", "West", "Old", "High"], {
          qualifierChance: 0.24
        });
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["North", "South", "East", "West", "High", "Grey", "Stone", "Wolf", "Banner", "Sentinel", "Watcher's", "Warden's"],
          suffixes: ["Post", "Gate", "Watch", "Station"],
          forceSpace: true
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

    if (candidate.icon === "campsite") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.38) {
        return `${relatedBaseName} ${seededPick(["Camp", "Rest", "Fire"], `${seed}:related-suffix`) || "Camp"}`;
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Old Road", "Wayfarers", "Lantern", "Cold", "Pine", "Grey", "North", "South", "Warden's", "Pilgrim's"],
          suffixes: ["Camp", "Rest", "Fire", "Watch"],
          forceSpace: true
        }
      ]);
    }

    if (candidate.icon === "lodge") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.5) {
        return `${relatedBaseName} ${seededPick(["Lodge", "Rest", "House", "Hall"], `${seed}:related-suffix`) || "Lodge"}`;
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Pine", "Cedar", "Bracken", "High Road", "Wayfarers", "Pilgrim's", "Warden's", "Stone", "Grey", "North Road", "South Road", "Three Pines", "Fox", "Stag", "Lantern", "Bell", "Crosswind", "Willow"],
          suffixes: ["Lodge", "Rest", "House", "Hall", "Roost"],
          forceSpace: true
        }
      ]);
    }

    if (candidate.icon === "tavern") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.48) {
        return `${relatedBaseName} ${seededPick(["Tavern", "Alehouse", "Tap", "Hearth"], `${seed}:related-suffix`) || "Tavern"}`;
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["White Hart", "Silver Cup", "Fox", "Stag", "Lantern", "Bell", "Candle", "Crosswind", "Wayfarers", "Pilgrim's", "Old Road", "South Road", "North Road", "Wagoner's", "Three Cups", "Gloam", "Marshal's", "Reed", "Willow"],
          suffixes: ["Tavern", "Alehouse", "Tap", "Hearth", "Flagon"],
          forceSpace: true
        }
      ]);
    }

    if (candidate.icon === "inn") {
      if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.5) {
        return `${relatedBaseName} ${seededPick(["Inn", "House", "Rest", "Hall"], `${seed}:related-suffix`) || "Inn"}`;
      }
      return buildGeneratedPatternName(seed, [
        {
          prefixes: ["Three Pines", "Wayfarers", "Traveler's", "Pilgrim's", "Lantern", "Bell", "Candle", "Crosswind", "Grey", "Willow", "Stone", "Bracken", "South Road", "North Road", "Golden", "Warden's", "Elm", "River Road"],
          suffixes: ["Inn", "House", "Rest", "Hall", "Hostel"],
          forceSpace: true
        }
      ]);
    }

    if (relatedBaseName && seededUnit(`${seed}:related-roll`) < 0.42) {
      return `${relatedBaseName} ${seededPick(["Rest", "Post", "Watch", "Landing"], `${seed}:related-suffix`) || "Rest"}`;
    }

    return buildGeneratedPatternName(seed, [
      {
        prefixes: ["Grey", "Stone", "Willow", "Moss", "Wayfarers", "South Road", "Northwatch", "Bracken", "Elm", "Reed", "Crosswind", "Lantern", "Bell", "Candle", "Gloam", "Vigil", "Oath", "Whisper", "Fox", "Stag", "Cedar"],
        suffixes: ["Post", "Rest", "Watch", "Landing", "Crossing"],
        forceSpace: true
      },
      {
        prefixes: ["Lantern", "Bell", "Candle", "Gloam", "Whisper", "Rune", "Banner", "Vigil", "Wayfarers", "Marshal's", "Warden's", "Fox", "Stag"],
        suffixes: ["Rest", "Watch", "Post", "Landing", "Crossing"],
        forceSpace: true
      }
    ]);
  }

  function buildResourceSiteFallbackName(candidate) {
    const nearestSettlement = getGeneratedRelatedSettlementBaseName(candidate?.meta, 3);
    const label = String(candidate?.meta?.label || "Works").trim() || "Works";
    return nearestSettlement ? `${nearestSettlement} ${label}` : `Outlying ${label}`;
  }

  function buildWaypointFallbackName(candidate) {
    if (candidate?.icon === "ford") return "Stone Ford";
    if (candidate?.icon === "bridge") return "Stone Bridge";
    if (candidate?.icon === "bridge_gate") return "Old Bridge Gate";
    if (candidate?.icon === "ferry") return "Old Ferry";
    if (candidate?.icon === "mountain_pass") return "High Pass";
    if (candidate?.icon === "border_post") return "North Border Post";
    if (candidate?.icon === "market") return "Crossroads Market";
    if (candidate?.icon === "campsite") return "Wayfarers Camp";
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

  function getExistingPoiTypeCountForSet(existingPois, typeValues) {
    const allowedTypes = new Set(
      (Array.isArray(typeValues) ? typeValues : [])
        .map(value => window.CampaignPoiTypes?.getStoredTypeValue?.(value) || value)
        .filter(Boolean)
    );
    if (!allowedTypes.size) return 0;
    const seen = new Set();
    return (existingPois || []).reduce((count, poi) => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (!allowedTypes.has(type)) return count;
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

  function findNearestPoiAnchor(hex, anchors, filterFn = null) {
    let best = null;
    (anchors || []).forEach(anchor => {
      if (!anchor?.hex || (typeof filterFn === "function" && !filterFn(anchor))) return;
      const distance = hexDistance(hex, anchor.hex);
      const importance = Number(anchor?.importance || 0);
      if (!best || distance < best.distance || (distance === best.distance && importance > Number(best.anchor?.importance || 0))) {
        best = { anchor, distance };
      }
    });
    return best;
  }

  function buildPoiAdventureSignals(hex, settlementAnchors, strongholdAnchors, byCoord, dimensions, riverData) {
    const adjacent = neighbors(hex, byCoord);
    const nearby = nearbyWithin(hex, byCoord, 2);
    const localArea = [hex, ...nearby];
    const elevation = Number(hex?.elevation || 0);
    const roughness = getTerrainRoughness(hex?.baseTerrain, hex?.features);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const strategic = scoreSettlementStrategicValue(hex, nearby, dimensions, riverData);
    const waterAccess = scoreSettlementWaterAccess(hex, adjacent, riverData);
    const fertility = scoreSettlementFertility(hex, nearby);
    const resourceDiversity = scoreSettlementResourceDiversity(hex, nearby);
    const passStrength = getWaypointPassStrength(hex, adjacent);
    const edgeDistance = distanceToMapEdge(hex, dimensions);
    const mountainHere = ["rock", "snow"].includes(hex?.baseTerrain)
      || (hex?.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"].includes(feature));
    const ridgeHere = (hex?.features || []).some(feature => ["ridges", "cliffs"].includes(feature));
    const mountainNearby = localArea.filter(neighbor => (
      ["rock", "snow"].includes(neighbor?.baseTerrain)
      || (neighbor?.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"].includes(feature))
    )).length;
    const adjacentLandHexes = adjacent.filter(neighbor => isPoiLandHex(neighbor));
    const adjacentHighlandCount = adjacentLandHexes.filter(neighbor => (
      ["rock", "snow"].includes(neighbor?.baseTerrain)
      || (neighbor?.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"].includes(feature))
    )).length;
    const adjacentLowlandCount = Math.max(0, adjacentLandHexes.length - adjacentHighlandCount);
    const forestHexes = localArea.filter(neighbor => (neighbor?.features || []).some(feature => ["forest", "jungle", "jungle_trees"].includes(feature))).length;
    const deadForestHexes = localArea.filter(neighbor => (neighbor?.features || []).includes("dead_trees")).length;
    const snowHexes = localArea.filter(neighbor => (
      neighbor?.baseTerrain === "snow"
      || (neighbor?.features || []).includes("snowcapped_mountains")
    )).length;
    const wetlandHexes = localArea.filter(neighbor => neighbor?.baseTerrain === "wetland").length;
    const localCount = Math.max(1, localArea.length);
    const adjacentCoastal = adjacent.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const adjacentInland = adjacent.some(neighbor => neighbor.baseTerrain === "inland_water");
    const onRiverHex = Boolean(riverData?.riverHexIds?.has(hex?.id));
    const riverNearby = hasRiverAccess(hex, adjacent, riverData);
    const highGroundDelta = adjacent.length
      ? adjacent.reduce((sum, neighbor) => sum + Math.max(0, elevation - Number(neighbor?.elevation || 0)), 0) / adjacent.length
      : 0;
    const wasteAffinity = clamp(
      (hex?.baseTerrain === "wastes" ? 0.78 : 0)
      + (hex?.baseTerrain === "bleak_barrens" ? 0.52 : 0)
      + (hex?.baseTerrain === "deep_desert" ? 0.42 : 0)
      + (hex?.baseTerrain === "barrens" ? 0.3 : 0)
      + localArea.filter(neighbor => ["wastes", "bleak_barrens", "deep_desert", "barrens"].includes(neighbor?.baseTerrain)).length / localCount * 0.28,
      0,
      1,
      0
    );
    const mountainAffinity = clamp(
      (mountainHere ? 0.4 : 0)
      + (ridgeHere ? 0.1 : 0)
      + Math.min(0.18, Math.max(0, mountainNearby - 1) * 0.04)
      + Math.max(0, elevation - 2) * 0.05,
      0,
      1,
      0
    );
    const mountainInterior = clamp(
      (mountainHere ? 0.22 : 0)
      + Math.min(0.3, adjacentHighlandCount * 0.08)
      - Math.min(0.22, adjacentLowlandCount * 0.06)
      + Math.min(0.26, Math.max(0, mountainNearby - 2) * 0.06)
      + (elevation >= 4 ? 0.08 : elevation >= 3 ? 0.05 : 0)
      + (routeability <= 0.42 ? 0.16 : routeability <= 0.56 ? 0.08 : 0)
      + (passStrength <= 0 ? 0.08 : passStrength <= 0.24 ? 0.04 : 0)
      - (adjacentCoastal ? 0.08 : 0)
      - (strategic >= 0.22 ? 0.05 : 0),
      0,
      1,
      0
    );
    const forestCover = clamp((forestHexes / localCount) * 1.18, 0, 1, 0);
    const deadForestCover = clamp((deadForestHexes / localCount) * 1.5, 0, 1, 0);
    const freshwaterAffinity = clamp(
      (adjacentInland ? 0.42 : 0)
      + (onRiverHex ? 0.36 : 0)
      + (riverNearby ? 0.18 : 0)
      + Math.min(0.16, wetlandHexes * 0.04),
      0,
      1,
      0
    );
    const wetAffinity = clamp(
      (hex?.baseTerrain === "wetland" ? 0.48 : 0)
      + Math.min(0.24, wetlandHexes * 0.06)
      + (adjacentInland ? 0.12 : 0)
      + (onRiverHex ? 0.1 : 0),
      0,
      1,
      0
    );
    const greenAffinity = clamp(
      (["lush_grassland", "grassland", "plains"].includes(hex?.baseTerrain) ? 0.3 : 0)
      + (hex?.baseTerrain === "wetland" ? 0.18 : 0)
      + fertility * 0.26
      + routeability * 0.12
      + freshwaterAffinity * 0.08
      - roughness * 0.08,
      0,
      1,
      0.22
    );
    const snowAffinity = clamp(
      (hex?.baseTerrain === "snow" ? 0.58 : 0)
      + ((hex?.features || []).includes("snowcapped_mountains") ? 0.2 : 0)
      + Math.min(0.24, snowHexes / localCount * 0.42)
      + (mountainHere && elevation >= 3 ? 0.06 : 0),
      0,
      1,
      0
    );
    const aridAffinity = clamp(
      (["desert", "deep_desert"].includes(hex?.baseTerrain) ? 0.46 : 0)
      + (["barrens", "bleak_barrens", "wastes"].includes(hex?.baseTerrain) ? 0.32 : 0)
      + localArea.filter(neighbor => ["desert", "deep_desert", "barrens", "bleak_barrens", "wastes"].includes(neighbor?.baseTerrain)).length / localCount * 0.24,
      0,
      1,
      0
    );
    const volcanicAffinity = clamp(
      ((hex?.features || []).includes("volcano") ? 0.82 : 0)
      + localArea.filter(neighbor => (neighbor?.features || []).includes("volcano")).length / localCount * 0.32
      + mountainAffinity * 0.12
      + wasteAffinity * 0.08,
      0,
      1,
      0
    );
    const prominence = clamp(
      Math.max(0, elevation - 1) * 0.1
      + Math.min(0.18, highGroundDelta * 0.14)
      + (ridgeHere ? 0.1 : 0)
      + (mountainHere ? 0.06 : 0)
      + (adjacentCoastal && elevation >= 2 ? 0.06 : 0),
      0,
      1,
      0.16
    );
    const anomaly = clamp(
      volcanicAffinity * 0.42
      + wasteAffinity * 0.18
      + (deadForestCover >= 0.24 ? 0.12 : 0)
      + (hex?.baseTerrain === "wetland" ? 0.08 : 0)
      + (prominence >= 0.72 && roughness >= 0.68 ? 0.05 : 0),
      0,
      1,
      0.12
    );
    const naturalWonder = clamp(
      prominence * 0.2
      + freshwaterAffinity * 0.22
      + wetAffinity * 0.16
      + greenAffinity * 0.16
      + forestCover * 0.08
      + (adjacentCoastal ? 0.08 : 0)
      + (mountainAffinity >= 0.72 ? 0.04 : 0),
      0,
      1,
      0.22
    );
    const concealment = clamp(
      forestCover * 0.34
      + deadForestCover * 0.18
      + roughness * 0.18
      + (hex?.baseTerrain === "wetland" ? 0.12 : 0)
      + (adjacentCoastal && (roughness >= 0.58 || mountainAffinity >= 0.66) ? 0.14 : 0)
      + wasteAffinity * 0.08,
      0,
      1,
      0.18
    );
    const oldCivilization = clamp(
      waterAccess * 0.28
      + fertility * 0.24
      + routeability * 0.16
      + strategic * 0.14
      + resourceDiversity * 0.1
      + Math.min(0.12, passStrength * 0.08)
      + (adjacentCoastal ? 0.06 : 0)
      + (freshwaterAffinity >= 0.48 ? 0.04 : 0)
      - roughness * 0.06,
      0,
      1,
      0.3
    );
    const nearestSettlement = settlementAnchors?.length ? findNearestSettlementAnchor(hex, settlementAnchors) : null;
    const settlementDistance = nearestSettlement?.distance ?? 99;
    const localSettlementPressure = (settlementAnchors || []).reduce((sum, anchor) => {
      if (!anchor?.hex) return sum;
      const distance = hexDistance(hex, anchor.hex);
      if (!Number.isFinite(distance) || distance > 6) return sum;
      const distanceWeight = Math.max(0, (7 - distance) / 6);
      const importance = clamp(Number(anchor?.importance || 0.5), 0.2, 1.8, 0.5);
      return sum + distanceWeight * importance;
    }, 0);
    const settlementPressureBase = settlementDistance <= 1
      ? 0.92
      : settlementDistance === 2
        ? 0.76
        : settlementDistance === 3
          ? 0.58
          : settlementDistance === 4
            ? 0.42
            : settlementDistance === 5
              ? 0.24
              : settlementDistance === 6
                ? 0.12
                : 0;
    const settlementPressure = clamp(settlementPressureBase + localSettlementPressure * 0.18, 0, 1, 0);
    const frontier = edgeDistance <= 2;
    const remoteness = clamp(
      (settlementDistance >= 8 ? 0.82 : settlementDistance >= 6 ? 0.66 : settlementDistance >= 4 ? 0.46 : settlementDistance >= 3 ? 0.3 : settlementDistance >= 2 ? 0.16 : 0.04)
      + (1 - routeability) * 0.12
      + roughness * 0.1
      + (frontier ? 0.06 : 0),
      0,
      1,
      0.36
    );
    const nearestGate = strongholdAnchors?.length
      ? findNearestPoiAnchor(hex, strongholdAnchors, anchor => String(anchor?.icon || "").trim() === "mountain_gate")
      : null;
    const gateDistance = nearestGate?.distance ?? 99;
    const gateLinked = Boolean(
      nearestGate
      && gateDistance >= 2
      && gateDistance <= 4
      && mountainAffinity >= 0.56
      && (passStrength > 0 || roughness >= 0.58)
    );

    return {
      hex,
      adjacent,
      nearby,
      edgeDistance,
      routeability,
      strategic,
      waterAccess,
      fertility,
      resourceDiversity,
      roughness,
      concealment,
      remoteness,
      settlementPressure,
      settlementDistance,
      nearestSettlement,
      nearestGate,
      gateDistance,
      gateLinked,
      frontier,
      passStrength,
      coastalWaterAdjacent: adjacentCoastal,
      freshwaterAffinity,
      wetAffinity,
      greenAffinity,
      snowAffinity,
      riverNearby,
      onRiverHex,
      wasteAffinity,
      mountainAffinity,
      mountainInterior,
      oldCivilization,
      coastalCave: adjacentCoastal && (roughness >= 0.58 || mountainAffinity >= 0.66),
      forestCover,
      deadForestCover,
      prominence,
      anomaly,
      naturalWonder,
      aridAffinity,
      volcanicAffinity
    };
  }

  function getWaypointPassStrength(hex, nearby) {
    const highlandFeatures = ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"];
    const elevation = Number(hex?.elevation || 0);
    const highlandHere = ["rock", "snow"].includes(hex?.baseTerrain)
      || (hex?.features || []).some(feature => highlandFeatures.includes(feature));
    const adjacentHighland = (nearby || []).filter(neighbor => (
      ["rock", "snow"].includes(neighbor?.baseTerrain)
      || (neighbor?.features || []).some(feature => highlandFeatures.includes(feature))
    )).length;
    if (!highlandHere || elevation < 3) return 0;
    if (adjacentHighland < 1 && elevation < 4) return 0;
    return elevation >= 4
      ? 1.4 + Math.min(0.2, Math.max(0, adjacentHighland - 1) * 0.1)
      : 1;
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

  function createGeneratedNameUsageTracker() {
    return {
      prefix: new Map(),
      suffix: new Map(),
      qualifier: new Map()
    };
  }

  function normalizeGeneratedNamePartKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getGeneratedNameUsageCount(kind, value) {
    const key = normalizeGeneratedNamePartKey(value);
    if (!activeGeneratedNameUsage || !key) return 0;
    return activeGeneratedNameUsage[kind]?.get(key) || 0;
  }

  function registerGeneratedNameUsage(kind, value) {
    const key = normalizeGeneratedNamePartKey(value);
    if (!activeGeneratedNameUsage || !key) return;
    const bucket = activeGeneratedNameUsage[kind];
    if (!bucket) return;
    bucket.set(key, (bucket.get(key) || 0) + 1);
  }

  function pickGeneratedNamePart(options, seed, kind, fallback = "") {
    const values = Array.isArray(options) ? options.filter(Boolean) : [];
    if (!values.length) return fallback;
    let bestValue = values[0];
    let bestScore = -Infinity;
    values.forEach((value, index) => {
      const usageCount = getGeneratedNameUsageCount(kind, value);
      const reusePenalty = 1 / (1 + usageCount * 0.95);
      const score = reusePenalty * (0.92 + seededUnit(`${seed}:${kind}:${normalizeGeneratedNamePartKey(value)}:${index}`) * 0.16);
      if (score > bestScore) {
        bestScore = score;
        bestValue = value;
      }
    });
    return bestValue || fallback;
  }

  function filterSettlementNamePatternsForTier(patterns, sizeTier) {
    if (sizeTier !== "village") return patterns;
    const blockedSuffixes = new Set(["burg", "bury", "minster", "chester", "caster", "market", "exchange", "court", "hall", "gate", "post", "port", "watch"]);
    const filtered = (patterns || [])
      .map(pattern => {
        const suffixes = (pattern?.suffixes || []).filter(suffix => !blockedSuffixes.has(normalizeGeneratedNamePartKey(suffix)));
        return suffixes.length ? { ...pattern, suffixes } : null;
      })
      .filter(Boolean);
    return filtered.length ? filtered : patterns;
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
    const filteredSuffixes = (Array.isArray(suffixes) ? suffixes : []).filter(suffix => !generatedNamePartDuplicatesBase(baseName, suffix));
    const suffix = pickGeneratedNamePart(filteredSuffixes.length ? filteredSuffixes : suffixes, `${seed}:related-suffix`, "suffix", "Site") || "Site";
    const qualifier = Array.isArray(qualifiers) && qualifiers.length && seededUnit(`${seed}:related-qualifier-roll`) < (options.qualifierChance ?? 0.42)
      ? pickGeneratedNamePart(qualifiers, `${seed}:related-qualifier`, "qualifier", "")
      : "";
    registerGeneratedNameUsage("suffix", suffix);
    if (qualifier) registerGeneratedNameUsage("qualifier", qualifier);
    if (!qualifier) return `${baseName} ${suffix}`;
    return options.qualifierAfter
      ? `${baseName} ${qualifier} ${suffix}`
      : `${qualifier} ${baseName} ${suffix}`;
  }

  function buildGeneratedCompositeName(seed, prefixes, suffixes, usedNames = null, options = {}) {
    const prefix = pickGeneratedNamePart(prefixes, `${seed}:prefix`, "prefix", "Grey") || "Grey";
    const filteredSuffixes = (Array.isArray(suffixes) ? suffixes : []).filter(suffix => (
      normalizeGeneratedNamePartKey(suffix) !== normalizeGeneratedNamePartKey(prefix)
    ));
    const suffix = pickGeneratedNamePart(filteredSuffixes.length ? filteredSuffixes : suffixes, `${seed}:suffix`, "suffix", "wick") || "wick";
    let separator = options.forceSpace === true
      ? " "
      : options.forceSpace === false
        ? ""
        : /^(Camp|Cut|Mine|Mill|Port|Quay|Rest|Vale|Keep|Peak|Gate|Bridge|Crossing|Fields|Farms|Docks|Fishery|Stoneworks|Market|Exchange|Post|Inn|Lodge|Roadhouse|Hall|Harbor|Pass|Watch)$/.test(suffix)
          ? " "
          : "";
    if (!separator && /['’]s?$/.test(prefix)) separator = " ";
    const suffixText = separator ? suffix : lowerCaseGeneratedNamePart(suffix);
    registerGeneratedNameUsage("prefix", prefix);
    registerGeneratedNameUsage("suffix", suffix);
    return `${prefix}${separator}${suffixText}`;
  }

  function getGeneratedRelatedSettlementBaseName(meta, maxDistance = 3) {
    const name = String(meta?.nearestSettlement || "").trim();
    const distance = Number(meta?.supportDistance ?? meta?.nearestSettlementDistance ?? 0);
    return name && distance > 0 && distance <= maxDistance ? name : "";
  }

  function generatedNamePartDuplicatesBase(baseName, part) {
    const baseKey = normalizeGeneratedNamePartKey(baseName);
    const partKey = normalizeGeneratedNamePartKey(part);
    if (!baseKey || !partKey) return false;
    return baseKey === partKey || baseKey.endsWith(` ${partKey}`) || baseKey.endsWith(partKey);
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

  function getPoiIconTraits(icon) {
    return window.CampaignPoiIcons?.getIconTraits?.(icon) || [];
  }

  function mergeGeneratedTagsForIcon(tags, icon) {
    const nextTags = Array.isArray(tags) ? [...tags] : [];
    getPoiIconTraits(icon).forEach(trait => {
      const mappedTag = GENERATED_ICON_TRAIT_TAGS[String(trait || "").trim()];
      if (mappedTag) nextTags.push(mappedTag);
    });
    return coerceGeneratedTags(nextTags);
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
