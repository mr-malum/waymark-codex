(function () {
  const shared = window.CampaignGeneratedMapGeneratorShared;
  if (!shared) {
    console.error("CampaignGeneratedMapGeneratorShared must load before generated-map-terrain-generator.js.");
    return;
  }

  const {
    OCEAN_BASES,
    TERRAIN_PROFILES,
    hashNumber,
    makeRandom,
    clamp,
    getDimensions,
    randomBetween,
    pick,
    shuffle,
    neighborSlots,
    neighbors,
    isWaterBase,
    isOpenOceanBase,
    isLandBase,
    nearbyWithin
  } = shared;

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
      mountains: 1.18,
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
    frozen_north: { mountains: 0.08 },
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
    return ["dry_expanse", "frozen_north", "mountain_frontier", "volcanic_arc", "wetlands_lakes"].includes(settings.regionStyle)
      || settings.heat < 0.72
      || settings.wetness > 1.45;
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
          next.push(neighbor);
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

  window.CampaignGeneratedTerrainGenerator = {
    generateNaturalTerrain,
    hashNumber
  };

  window.CampaignGeneratedMapGenerator = {
    ...(window.CampaignGeneratedMapGenerator || {}),
    generateNaturalTerrain,
    hashNumber
  };
})();
