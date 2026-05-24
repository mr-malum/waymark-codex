(function () {
  const TERRAIN_COLORS = {
    deep_sea: "#0b263a",
    sea: "#245f82",
    coastal_water: "#4a91ab",
    inland_water: "#79b8c8",
    beach: "#dbc487",
    plains: "#c1b06d",
    grassland: "#8fa75f",
    lush_grassland: "#4e7b45",
    wetland: "#3d6856",
    jungle_floor: "#27663c",
    desert: "#d4b36f",
    deep_desert: "#b88955",
    barrens: "#a56545",
    bleak_barrens: "#7d4335",
    snow: "#dce5e6",
    rock: "#756e66",
    wastes: "#453232"
  };

  const BASE_TERRAIN_OPTIONS = [
    ["deep_sea", "Deep Sea"],
    ["sea", "Sea"],
    ["coastal_water", "Coastal Water"],
    ["inland_water", "Inland Water"],
    ["beach", "Beach"],
    ["plains", "Plains"],
    ["grassland", "Grassland"],
    ["lush_grassland", "Lush Grassland"],
    ["wetland", "Wetland"],
    ["jungle_floor", "Jungle Floor"],
    ["desert", "Desert"],
    ["deep_desert", "Deep Desert"],
    ["barrens", "Barrens"],
    ["bleak_barrens", "Bleak Barrens"],
    ["snow", "Snow"],
    ["rock", "Rock"],
    ["wastes", "Wastes"]
  ];

  const FEATURE_LABELS = {
    woods: "Woods",
    forest: "Forest",
    jungle: "Jungle",
    shrub: "Shrub",
    cactus_scrub: "Cactus Scrub",
    marsh: "Marsh",
    kelp: "Kelp",
    ridges: "Ridges",
    mountains: "Mountains",
    snowcapped_mountains: "Snowcapped Mountains",
    cliffs: "Cliffs",
    lone_mountain: "Lone Mountain",
    volcano: "Volcano",
    reef: "Reef",
    shoals: "Shoals",
    water_rocks: "Water Rocks",
    rapids: "Rapids",
    falls: "Falls",
    whirlpool: "Whirlpool",
    farmland: "Farmland",
    sand: "Sand",
    waves: "Waves",
    ice: "Ice"
  };

  const FEATURE_CATEGORIES = {
    woods: "vegetation",
    forest: "vegetation",
    jungle: "vegetation",
    shrub: "vegetation",
    cactus_scrub: "vegetation",
    marsh: "vegetation",
    kelp: "vegetation",
    ridges: "structure",
    mountains: "structure",
    snowcapped_mountains: "structure",
    cliffs: "structure",
    lone_mountain: "structure",
    volcano: "structure",
    reef: "structure",
    shoals: "structure",
    water_rocks: "structure",
    rapids: "structure",
    falls: "structure",
    whirlpool: "structure",
    farmland: "surface",
    sand: "surface",
    waves: "surface",
    ice: "surface"
  };

  const VALID_FEATURES_BY_BASE = {
    deep_sea: ["waves", "kelp", "water_rocks", "whirlpool", "ice"],
    sea: ["waves", "reef", "shoals", "water_rocks", "kelp", "ice"],
    coastal_water: ["waves", "kelp", "water_rocks", "whirlpool", "ice"],
    inland_water: ["waves", "shoals", "water_rocks", "rapids", "falls", "marsh", "ice"],
    beach: ["sand", "ridges", "cliffs", "water_rocks"],
    plains: ["woods", "shrub", "ridges", "farmland", "lone_mountain"],
    grassland: ["woods", "forest", "shrub", "ridges", "farmland", "lone_mountain"],
    lush_grassland: ["woods", "forest", "shrub", "ridges", "farmland", "marsh"],
    wetland: ["woods", "forest", "marsh"],
    jungle_floor: ["jungle", "ridges"],
    desert: ["sand", "ridges", "cactus_scrub", "cliffs", "lone_mountain"],
    deep_desert: ["sand", "ridges", "cactus_scrub", "cliffs", "lone_mountain"],
    barrens: ["woods", "forest", "shrub", "ridges", "cliffs", "lone_mountain"],
    bleak_barrens: ["woods", "forest", "shrub", "ridges", "cliffs", "lone_mountain"],
    snow: ["ridges", "mountains", "snowcapped_mountains", "woods", "forest", "ice"],
    rock: ["ridges", "mountains", "woods", "forest", "cliffs", "lone_mountain", "volcano"],
    wastes: ["woods", "forest", "ridges", "cliffs", "lone_mountain", "volcano"]
  };

  const BASE_ELEVATION = {
    deep_sea: -3,
    sea: -2,
    coastal_water: -1,
    inland_water: 0,
    beach: 0,
    wetland: 0,
    plains: 1,
    grassland: 1,
    lush_grassland: 1,
    jungle_floor: 1,
    desert: 1,
    deep_desert: 1,
    barrens: 1,
    bleak_barrens: 2,
    wastes: 2,
    snow: 2,
    rock: 3
  };

  const FEATURE_ELEVATION_MODIFIERS = {
    ridges: 1,
    cliffs: 1,
    mountains: 2,
    snowcapped_mountains: 2,
    lone_mountain: 2,
    volcano: 2,
    reef: 0,
    shoals: 0,
    water_rocks: 0,
    rapids: 0,
    falls: 0
  };

  const EXCLUSIVE_FEATURE_GROUPS = [
    ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"],
    ["woods", "forest"]
  ];

  const FEATURE_BRUSH_OPTIONS = [
    { id: "generated", label: "Generated Detail", mode: "generated" },
    { id: "vegetation", label: "Vegetation", features: ["woods", "forest", "jungle", "shrub", "kelp", "marsh", "cactus_scrub"] },
    { id: "highlands", label: "Highlands", features: ["ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"] },
    { id: "water", label: "Water Detail", features: ["waves", "shoals", "reef", "kelp", "water_rocks", "whirlpool", "rapids", "falls", "marsh", "ice"] },
    { id: "farmland", label: "Farmland", features: ["farmland"] },
    { id: "sand", label: "Sand", features: ["sand"] },
    { id: "chaos", label: "Chaos", features: Object.keys(FEATURE_LABELS), ignoreCompatibility: true }
  ];

  const FEATURE_PROBABILITY_RULES = {
    deep_sea: { chance: 0.20, weights: { waves: 8, whirlpool: 0.25, kelp: 1, ice: 1 } },
    sea: { chance: 0.25, weights: { waves: 8, kelp: 3, reef: 1.5, shoals: 2, water_rocks: 0.4, whirlpool: 0.25, ice: 1 } },
    coastal_water: { chance: 0.32, weights: { waves: 7, reef: 4, shoals: 3, kelp: 3, water_rocks: 0.8, whirlpool: 0.2, ice: 1 } },
    inland_water: { chance: 0.28, weights: { waves: 5, shoals: 2, water_rocks: 0.8, marsh: 3, rapids: 0.8, ice: 1 } },
    beach: { chance: 0.86, weights: { sand: 12, ridges: 2.5, cliffs: 0.45, water_rocks: 1.5 } },
    plains: { chance: 0.35, weights: { woods: 3, shrub: 2, ridges: 2, farmland: 0.25, lone_mountain: 1 } },
    grassland: { chance: 0.45, weights: { woods: 4, forest: 2, shrub: 2, ridges: 3, farmland: 0.35, lone_mountain: 1 } },
    lush_grassland: { chance: 0.60, weights: { woods: 4, forest: 4, shrub: 1, ridges: 2, farmland: 0.35, marsh: 1, jungle: 1 } },
    wetland: { chance: 0.75, weights: { marsh: 5, woods: 3, forest: 3, jungle: 2 } },
    jungle_floor: { chance: 0.90, weights: { jungle: 7, ridges: 2, marsh: 1 } },
    desert: { chance: 0.45, weights: { sand: 2, ridges: 5, cactus_scrub: 4, cliffs: 2, lone_mountain: 1, shrub: 1 } },
    deep_desert: { chance: 0.50, weights: { sand: 2, ridges: 5, cactus_scrub: 2, cliffs: 3, lone_mountain: 2, shrub: 1 } },
    barrens: { chance: 0.45, weights: { shrub: 3, ridges: 4, cliffs: 3, lone_mountain: 1, cactus_scrub: 1, woods: 0.28, forest: 0.06 } },
    bleak_barrens: { chance: 0.50, weights: { shrub: 2, ridges: 4, cliffs: 4, lone_mountain: 2, volcano: 1, woods: 0.20, forest: 0.04 } },
    snow: { chance: 0.55, weights: { ridges: 3, snowcapped_mountains: 4, woods: 2, forest: 2, ice: 2 } },
    rock: { chance: 0.75, weights: { mountains: 5, ridges: 4, cliffs: 3, lone_mountain: 2, woods: 2, forest: 1, volcano: 1 } },
    wastes: { chance: 0.50, weights: { ridges: 4, cliffs: 3, lone_mountain: 2, volcano: 2, woods: 0.12, forest: 0.02 } }
  };

  const SECONDARY_FEATURE_RULES = [
    { id: "woods", chance: 0.20, requiresAnyFeature: ["mountains", "ridges", "cliffs"], allowedBases: ["rock", "snow", "grassland", "lush_grassland"], maxChance: 0.35 },
    { id: "forest", chance: 0.12, requiresAnyFeature: ["mountains", "ridges"], allowedBases: ["rock", "snow", "lush_grassland"], maxChance: 0.25 },
    { id: "ridges", chance: 0.42, requiresAnyFeature: ["sand"], allowedBases: ["beach"], maxChance: 0.55 },
    { id: "waves", chance: 0.25, allowedBases: ["deep_sea", "sea", "coastal_water"], suppressIfAnyFeature: ["ice", "whirlpool"] },
    { id: "water_rocks", chance: 0.15, allowedBases: ["deep_sea", "sea", "coastal_water", "inland_water"] }
  ];

  function hashPercent(seed, hashNumber) {
    return Math.abs(hashNumber(String(seed))) % 100;
  }

  function hashUnit(seed, hashNumber) {
    return hashPercent(seed, hashNumber) / 100;
  }

  function getValidFeaturesForBase(baseTerrain) {
    return VALID_FEATURES_BY_BASE[baseTerrain] || [];
  }

  function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function normalizeFeatures(features = [], options = {}) {
    const preferredFeature = options.preferredFeature || "";
    const maxFeatures = clampNumber(Number(options.maxFeatures), 0, 2, 2);
    let normalized = [...new Set(features || [])].filter(feature => FEATURE_LABELS[feature]);

    EXCLUSIVE_FEATURE_GROUPS.forEach(group => {
      const selectedGroupFeatures = normalized.filter(feature => group.includes(feature));
      if (selectedGroupFeatures.length <= 1) return;

      const keepFeature = group.includes(preferredFeature)
        ? preferredFeature
        : selectedGroupFeatures[0];
      normalized = normalized.filter(feature => !group.includes(feature) || feature === keepFeature);
    });

    return normalized.slice(0, maxFeatures);
  }

  function ensureValidFeatures(baseTerrain, features = [], options = {}) {
    const valid = new Set(getValidFeaturesForBase(baseTerrain));
    return normalizeFeatures(features, options)
      .filter(feature => valid.has(feature))
      .slice(0, clampNumber(Number(options.maxFeatures), 0, 2, 2));
  }

  function getFeatureElevationModifier(features = []) {
    return Math.max(0, ...normalizeFeatures(features).map(feature => FEATURE_ELEVATION_MODIFIERS[feature] || 0));
  }

  function getAutoElevation(baseTerrain, features = []) {
    return (BASE_ELEVATION[baseTerrain] ?? 1) + getFeatureElevationModifier(features);
  }

  function getTerrainDisplayName(baseTerrain, featuresInput = []) {
    const base = BASE_TERRAIN_OPTIONS.find(([id]) => id === baseTerrain)?.[1] || baseTerrain || "Unknown";
    const features = ensureValidFeatures(baseTerrain, featuresInput);
    const featureSet = new Set(features);
    const has = feature => featureSet.has(feature);

    if (!features.length) return base;

    const named = getAuthoredTerrainName(baseTerrain, featureSet);
    if (named) return named;

    const composed = getComposedTerrainName(baseTerrain, features);
    if (composed) return composed;

    const featureNames = features
      .map(feature => FEATURE_LABELS[feature])
      .filter(Boolean);
    return featureNames.length ? `${base} / ${featureNames.join(" / ")}` : base;
  }

  function getAuthoredTerrainName(baseTerrain, features) {
    const has = feature => features.has(feature);

    if (["deep_sea", "sea", "coastal_water", "inland_water"].includes(baseTerrain)) {
      if (has("falls")) return "Falls";
      if (has("rapids")) return "Rapids";
      if (has("whirlpool")) return "Whirlpool";
      if (has("reef")) return "Reef";
      if (has("shoals")) return "Shoals";
      if (has("water_rocks")) return "Rocky Waters";
      if (has("kelp")) return "Kelp Beds";
      if (has("marsh")) return "Marsh Waters";
      if (has("ice")) return baseTerrain === "deep_sea" ? "Frozen Deep Sea" : baseTerrain === "sea" ? "Frozen Sea" : baseTerrain === "coastal_water" ? "Frozen Coastal Water" : "Frozen Inland Water";
      if (has("waves")) return baseTerrain === "deep_sea" ? "Rough Deep Sea" : baseTerrain === "sea" ? "Rough Sea" : baseTerrain === "coastal_water" ? "Rough Coastal Water" : "Rough Inland Water";
    }

    if (baseTerrain === "beach") {
      if (has("cliffs")) return has("sand") ? "Sandy Coastal Cliffs" : "Coastal Cliffs";
      if (has("water_rocks")) return has("sand") ? "Rocky Sandbar" : "Rocky Coast";
      if (has("sand") && has("ridges")) return "Sandy Dunes";
      if (has("ridges")) return "Beach Dunes";
      if (has("sand")) return "Sandy Beach";
    }

    if (has("volcano")) return "Volcano";
    if (has("lone_mountain")) return baseTerrain === "snow" ? "Snowy Lone Mountain" : "Lone Mountain";

    if (baseTerrain === "rock") {
      if (has("mountains") && has("forest")) return "Forested Mountains";
      if (has("mountains") && has("woods")) return "Wooded Mountains";
      if (has("mountains")) return "Mountains";
      if (has("cliffs") && has("forest")) return "Forested Cliffs";
      if (has("cliffs") && has("woods")) return "Wooded Cliffs";
      if (has("cliffs")) return "Cliffs";
      if (has("ridges") && has("forest")) return "Forested Rocky Hills";
      if (has("ridges") && has("woods")) return "Wooded Rocky Hills";
      if (has("ridges")) return "Rocky Hills";
      if (has("forest")) return "Rocky Forest";
      if (has("woods")) return "Rocky Woods";
    }

    if (baseTerrain === "snow") {
      if (has("snowcapped_mountains") || has("mountains")) return has("forest") ? "Snowy Forested Mountains" : has("woods") ? "Snowy Wooded Mountains" : "Snowcapped Mountains";
      if (has("ridges") && has("forest")) return "Snowy Forested Hills";
      if (has("ridges") && has("woods")) return "Snowy Wooded Hills";
      if (has("ridges")) return "Snowy Hills";
      if (has("forest")) return "Snowy Forest";
      if (has("woods")) return "Snowy Woods";
      if (has("ice")) return "Ice Fields";
    }

    if (baseTerrain === "wetland") {
      if (has("forest")) return has("marsh") ? "Forested Marsh" : "Evergreen Wetlands";
      if (has("woods")) return has("marsh") ? "Wooded Marsh" : "Wet Woods";
      if (has("marsh")) return "Marsh";
    }

    if (baseTerrain === "jungle_floor") {
      if (has("ridges") && has("jungle")) return "Jungle Hills";
      if (has("ridges")) return "Overgrown Ridges";
      if (has("jungle")) return "Jungle";
    }

    if (has("farmland")) {
      if (has("ridges")) return "Terraced Farmland";
      if (has("woods")) return "Wooded Farmland";
      if (has("forest")) return "Farmsteads";
      return "Cultivated Farmland";
    }

    if (baseTerrain === "desert") {
      if (has("cliffs")) return has("sand") ? "Sandy Desert Cliffs" : "Desert Cliffs";
      if (has("ridges") && has("cactus_scrub")) return "Cactus Dunes";
      if (has("ridges")) return has("sand") ? "Sandy Dunes" : "Dunes";
      if (has("cactus_scrub")) return "Cactus Scrub";
      if (has("sand")) return "Sandy Desert";
      if (has("shrub")) return "Desert Scrub";
    }

    if (baseTerrain === "deep_desert") {
      if (has("cliffs")) return has("sand") ? "Sandy Deep Desert Cliffs" : "Desert Cliffs";
      if (has("ridges") && has("cactus_scrub")) return "Rocky Cactus Dunes";
      if (has("ridges")) return has("sand") ? "Sandy Rocky Desert" : "Rocky Desert";
      if (has("cactus_scrub")) return "Sparse Cactus Scrub";
      if (has("sand")) return "Sandy Deep Desert";
      if (has("shrub")) return "Dry Scrubland";
    }

    if (baseTerrain === "barrens" || baseTerrain === "bleak_barrens") {
      const bleak = baseTerrain === "bleak_barrens";
      if (has("forest")) return bleak ? "Bleak Dead Forest" : "Barren Dead Forest";
      if (has("woods")) return bleak ? "Bleak Dead Woods" : "Barren Dead Woods";
      if (has("cliffs")) return bleak ? "Bleak Cliffs" : "Barren Cliffs";
      if (has("ridges") && has("shrub")) return bleak ? "Bleak Shrubland Hills" : "Shrubland Hills";
      if (has("ridges")) return bleak ? "Bleak Hills" : "Barren Hills";
      if (has("shrub")) return bleak ? "Bleak Shrubland" : "Shrubland";
      if (has("cactus_scrub")) return bleak ? "Bleak Cactus Scrub" : "Barren Cactus Scrub";
    }

    if (baseTerrain === "wastes") {
      if (has("forest")) return "Dead Forest Wastes";
      if (has("woods")) return "Dead Woods Wastes";
      if (has("cliffs")) return "Wasted Cliffs";
      if (has("ridges")) return "Wasted Hills";
      if (has("shrub")) return "Ashen Scrub";
    }

    if (baseTerrain === "plains") {
      if (has("ridges") && has("shrub")) return "Shrubland Hills";
      if (has("ridges") && has("woods")) return "Wooded Hills";
      if (has("ridges")) return "Hills";
      if (has("shrub")) return "Shrubland";
      if (has("woods")) return "Woods";
    }

    if (baseTerrain === "grassland") {
      if (has("ridges") && has("forest")) return "Forested Hills";
      if (has("ridges") && has("woods")) return "Wooded Hills";
      if (has("ridges") && has("shrub")) return "Shrubland Hills";
      if (has("ridges")) return "Grassy Hills";
      if (has("forest")) return "Forest";
      if (has("woods")) return "Woods";
      if (has("shrub")) return "Brushland";
    }

    if (baseTerrain === "lush_grassland") {
      if (has("ridges") && has("forest")) return "Forested Hills";
      if (has("ridges") && has("woods")) return "Wooded Hills";
      if (has("ridges") && has("shrub")) return "Thicketed Hills";
      if (has("ridges")) return "Lush Hills";
      if (has("forest")) return "Forest";
      if (has("woods")) return "Woods";
      if (has("shrub")) return "Thicket";
      if (has("marsh")) return "Marshy Grassland";
    }

    return "";
  }

  const BASE_TERRAIN_NOUNS = {
    deep_sea: "Deep Sea",
    sea: "Sea",
    coastal_water: "Coastal Water",
    inland_water: "Inland Water",
    beach: "Beach",
    plains: "Plains",
    grassland: "Grassland",
    lush_grassland: "Meadow",
    wetland: "Wetland",
    jungle_floor: "Jungle",
    desert: "Desert",
    deep_desert: "Deep Desert",
    barrens: "Barrens",
    bleak_barrens: "Bleak Barrens",
    snow: "Snowfield",
    rock: "Highlands",
    wastes: "Wastes"
  };

  const FEATURE_NAME_PARTS = {
    waves: { adjective: "Rough", noun: "Rough Waters" },
    kelp: { adjective: "Kelp-Choked", noun: "Kelp Beds" },
    water_rocks: { adjective: "Rocky", noun: "Rocky Waters" },
    whirlpool: { adjective: "Churning", noun: "Whirlpool" },
    ice: { adjective: "Frozen", noun: "Ice Fields" },
    reef: { adjective: "Reef-Strewn", noun: "Reef" },
    shoals: { adjective: "Shallow", noun: "Shoals" },
    rapids: { adjective: "Rapid", noun: "Rapids" },
    falls: { adjective: "Falling", noun: "Falls" },
    marsh: { adjective: "Marshy", noun: "Marsh" },
    sand: { adjective: "Sandy", noun: "Dunes" },
    ridges: { adjective: "Ridged", noun: "Hills" },
    cliffs: { adjective: "Cliffside", noun: "Cliffs" },
    woods: { adjective: "Wooded", noun: "Woods" },
    forest: { adjective: "Forested", noun: "Forest" },
    jungle: { adjective: "Jungled", noun: "Jungle" },
    shrub: { adjective: "Shrubby", noun: "Scrubland" },
    cactus_scrub: { adjective: "Cactus-Studded", noun: "Cactus Scrub" },
    farmland: { adjective: "Cultivated", noun: "Farmland" },
    mountains: { adjective: "Mountainous", noun: "Mountains" },
    snowcapped_mountains: { adjective: "Snowcapped", noun: "Snowcapped Mountains" },
    lone_mountain: { adjective: "Mountain-Shadowed", noun: "Lone Mountain" },
    volcano: { adjective: "Volcanic", noun: "Volcano" }
  };

  const PRIMARY_FEATURE_PRIORITY = [
    "falls",
    "rapids",
    "whirlpool",
    "volcano",
    "snowcapped_mountains",
    "mountains",
    "lone_mountain",
    "cliffs",
    "ridges",
    "reef",
    "shoals",
    "water_rocks",
    "ice",
    "kelp",
    "waves",
    "farmland",
    "jungle",
    "forest",
    "woods",
    "marsh",
    "cactus_scrub",
    "shrub",
    "sand"
  ];

  function getComposedTerrainName(baseTerrain, features = []) {
    const filtered = features.filter(feature => FEATURE_NAME_PARTS[feature]);
    if (!filtered.length) return "";

    const baseAware = getBaseAwareTerrainName(baseTerrain, filtered);
    if (baseAware) return baseAware;

    const primaryFeature = filtered
      .slice()
      .sort((a, b) => PRIMARY_FEATURE_PRIORITY.indexOf(a) - PRIMARY_FEATURE_PRIORITY.indexOf(b))[0];
    const modifiers = filtered.filter(feature => feature !== primaryFeature);
    const primary = FEATURE_NAME_PARTS[primaryFeature];
    const baseNoun = BASE_TERRAIN_NOUNS[baseTerrain] || BASE_TERRAIN_OPTIONS.find(([id]) => id === baseTerrain)?.[1] || "Terrain";

    if (!modifiers.length) return getSingleFeatureTerrainName(baseTerrain, primaryFeature, primary, baseNoun);

    const modifierText = modifiers
      .map(feature => FEATURE_NAME_PARTS[feature]?.adjective)
      .filter(Boolean)
      .join(" ");
    const noun = getFeatureNounForBase(baseTerrain, primaryFeature, primary, baseNoun);
    return [modifierText, noun].filter(Boolean).join(" ");
  }

  const BASE_AWARE_NOUNS = {
    deep_sea: {
      waves: "Rough Deep Sea",
      kelp: "Deep Kelp Beds",
      water_rocks: "Deep Rocky Waters",
      whirlpool: "Deep Whirlpool",
      ice: "Frozen Deep Sea"
    },
    sea: {
      waves: "Rough Sea",
      kelp: "Kelp Sea",
      water_rocks: "Rocky Sea",
      whirlpool: "Whirlpool",
      ice: "Frozen Sea",
      reef: "Sea Reef",
      shoals: "Sea Shoals"
    },
    coastal_water: {
      waves: "Rough Coastal Water",
      kelp: "Coastal Kelp Beds",
      water_rocks: "Rocky Coast",
      whirlpool: "Coastal Whirlpool",
      ice: "Frozen Coastal Water",
      reef: "Coastal Reef",
      shoals: "Coastal Shoals"
    },
    inland_water: {
      waves: "Wind-Rippled Water",
      shoals: "Shallow Water",
      water_rocks: "Rocky Water",
      rapids: "Rapids",
      falls: "Falls",
      marsh: "Marsh Water",
      ice: "Frozen Inland Water"
    },
    beach: {
      sand: "Sandy Beach",
      ridges: "Beach Dunes",
      cliffs: "Coastal Cliffs",
      water_rocks: "Rocky Coast"
    },
    plains: {
      woods: "Plain Woods",
      shrub: "Open Shrubland",
      ridges: "Rolling Hills",
      farmland: "Open Farmland",
      lone_mountain: "Lone Mountain"
    },
    grassland: {
      woods: "Grassland Woods",
      forest: "Grassland Forest",
      shrub: "Brushland",
      ridges: "Grassy Hills",
      farmland: "Grassland Farms",
      lone_mountain: "Lone Mountain"
    },
    lush_grassland: {
      woods: "Lush Woods",
      forest: "Lush Forest",
      shrub: "Thicket",
      ridges: "Lush Hills",
      farmland: "Green Farmland",
      marsh: "Marshy Grassland"
    },
    wetland: {
      woods: "Wet Woods",
      forest: "Evergreen Wetlands",
      marsh: "Marsh"
    },
    jungle_floor: {
      jungle: "Jungle",
      ridges: "Jungle Hills"
    },
    desert: {
      sand: "Sandy Desert",
      ridges: "Dunes",
      cactus_scrub: "Cactus Scrub",
      cliffs: "Desert Cliffs",
      lone_mountain: "Desert Lone Mountain"
    },
    deep_desert: {
      sand: "Sandy Deep Desert",
      ridges: "Rocky Desert",
      cactus_scrub: "Sparse Cactus Scrub",
      cliffs: "Deep Desert Cliffs",
      lone_mountain: "Deep Desert Lone Mountain"
    },
    barrens: {
      shrub: "Barren Shrubland",
      ridges: "Barren Hills",
      cliffs: "Barren Cliffs",
      lone_mountain: "Barren Lone Mountain"
    },
    bleak_barrens: {
      shrub: "Bleak Shrubland",
      ridges: "Bleak Hills",
      cliffs: "Bleak Cliffs",
      lone_mountain: "Bleak Lone Mountain"
    },
    snow: {
      ridges: "Snowy Hills",
      mountains: "Snowy Mountains",
      snowcapped_mountains: "Snowcapped Mountains",
      woods: "Snowy Woods",
      forest: "Snowy Forest",
      ice: "Ice Fields"
    },
    rock: {
      ridges: "Rocky Hills",
      mountains: "Mountains",
      woods: "Rocky Woods",
      forest: "Rocky Forest",
      cliffs: "Cliffs",
      lone_mountain: "Lone Mountain",
      volcano: "Volcano"
    },
    wastes: {
      ridges: "Wasted Hills",
      cliffs: "Wasted Cliffs",
      lone_mountain: "Wasted Lone Mountain",
      volcano: "Volcano"
    }
  };

  const BASE_AWARE_PAIR_NAMES = {
    beach: {
      "sand+ridges": "Sandy Dunes",
      "sand+cliffs": "Sandy Coastal Cliffs",
      "sand+water_rocks": "Rocky Sandbar",
      "ridges+water_rocks": "Rocky Beach Dunes",
      "cliffs+water_rocks": "Rocky Coastal Cliffs"
    },
    plains: {
      "ridges+woods": "Wooded Rolling Hills",
      "ridges+shrub": "Shrubland Hills",
      "ridges+farmland": "Terraced Plains",
      "woods+farmland": "Wooded Farmland",
      "shrub+farmland": "Scrubland Farms"
    },
    grassland: {
      "ridges+woods": "Wooded Grassy Hills",
      "ridges+forest": "Forested Hills",
      "ridges+shrub": "Shrubland Hills",
      "ridges+farmland": "Terraced Grassland",
      "woods+farmland": "Wooded Farms",
      "forest+farmland": "Forest Farms",
      "shrub+farmland": "Brushland Farms"
    },
    lush_grassland: {
      "ridges+woods": "Wooded Lush Hills",
      "ridges+forest": "Forested Lush Hills",
      "ridges+shrub": "Thicketed Hills",
      "ridges+farmland": "Terraced Green Farmland",
      "ridges+marsh": "Marshy Lush Hills",
      "woods+farmland": "Wooded Green Farmland",
      "forest+farmland": "Forest Farms",
      "shrub+farmland": "Thicketed Farmland",
      "marsh+woods": "Wooded Marshland",
      "marsh+forest": "Forested Marshland",
      "marsh+farmland": "Lowland Farms"
    },
    wetland: {
      "marsh+woods": "Wooded Marsh",
      "forest+marsh": "Forested Marsh",
      "forest+woods": "Dense Wet Woods"
    },
    jungle_floor: {
      "jungle+ridges": "Jungle Hills"
    },
    desert: {
      "sand+ridges": "Sandy Dunes",
      "sand+cactus_scrub": "Cactus Dunes",
      "sand+cliffs": "Sandy Desert Cliffs",
      "ridges+cactus_scrub": "Cactus Dunes",
      "ridges+cliffs": "Broken Desert Cliffs",
      "cactus_scrub+cliffs": "Cactus Cliffs"
    },
    deep_desert: {
      "sand+ridges": "Sandy Rocky Desert",
      "sand+cactus_scrub": "Sparse Cactus Dunes",
      "sand+cliffs": "Sandy Deep Desert Cliffs",
      "ridges+cactus_scrub": "Rocky Cactus Dunes",
      "ridges+cliffs": "Broken Deep Desert",
      "cactus_scrub+cliffs": "Sparse Cactus Cliffs"
    },
    barrens: {
      "ridges+shrub": "Shrubland Hills",
      "ridges+cliffs": "Broken Barren Hills",
      "shrub+cliffs": "Barren Scrub Cliffs"
    },
    bleak_barrens: {
      "ridges+shrub": "Bleak Shrubland Hills",
      "ridges+cliffs": "Broken Bleak Hills",
      "shrub+cliffs": "Bleak Scrub Cliffs"
    },
    snow: {
      "ridges+woods": "Snowy Wooded Hills",
      "ridges+forest": "Snowy Forested Hills",
      "ridges+ice": "Icy Snowy Hills",
      "mountains+woods": "Snowy Wooded Mountains",
      "mountains+forest": "Snowy Forested Mountains",
      "snowcapped_mountains+woods": "Snowy Wooded Mountains",
      "snowcapped_mountains+forest": "Snowy Forested Mountains",
      "woods+ice": "Icy Snowy Woods",
      "forest+ice": "Icy Snowy Forest"
    },
    rock: {
      "ridges+woods": "Wooded Rocky Hills",
      "ridges+forest": "Forested Rocky Hills",
      "ridges+cliffs": "Broken Rocky Hills",
      "ridges+mountains": "Mountain Foothills",
      "mountains+woods": "Wooded Mountains",
      "mountains+forest": "Forested Mountains",
      "mountains+cliffs": "Mountain Cliffs",
      "cliffs+woods": "Wooded Cliffs",
      "cliffs+forest": "Forested Cliffs"
    },
    wastes: {
      "ridges+cliffs": "Broken Wasted Hills",
      "ridges+volcano": "Volcanic Wasted Hills",
      "cliffs+volcano": "Volcanic Cliffs"
    },
    inland_water: {
      "waves+shoals": "Rippling Shallows",
      "waves+water_rocks": "Rough Rocky Water",
      "waves+marsh": "Rippling Marsh Water",
      "shoals+marsh": "Marshy Shallows",
      "water_rocks+rapids": "Rocky Rapids",
      "rapids+falls": "Falls",
      "water_rocks+falls": "Rocky Falls",
      "marsh+ice": "Frozen Marsh Water"
    },
    coastal_water: {
      "waves+reef": "Rough Coastal Reef",
      "waves+shoals": "Rough Coastal Shoals",
      "waves+kelp": "Rough Kelp Beds",
      "waves+water_rocks": "Rough Rocky Coast",
      "reef+shoals": "Shallow Reef",
      "reef+kelp": "Kelp Reef",
      "shoals+kelp": "Kelp Shoals",
      "water_rocks+kelp": "Rocky Kelp Coast"
    },
    sea: {
      "waves+reef": "Rough Sea Reef",
      "waves+shoals": "Rough Sea Shoals",
      "waves+kelp": "Rough Kelp Sea",
      "waves+water_rocks": "Rough Rocky Sea",
      "reef+shoals": "Shallow Sea Reef",
      "reef+kelp": "Kelp Sea Reef",
      "shoals+kelp": "Kelp Shoals"
    },
    deep_sea: {
      "waves+kelp": "Rough Deep Kelp Beds",
      "waves+water_rocks": "Rough Deep Rocky Waters",
      "waves+whirlpool": "Churning Deep Sea",
      "kelp+water_rocks": "Deep Rocky Kelp Beds",
      "whirlpool+ice": "Frozen Deep Whirlpool"
    }
  };

  function getBaseAwareTerrainName(baseTerrain, features = []) {
    const pairName = getBaseAwarePairName(baseTerrain, features);
    if (pairName) return pairName;

    if (features.length === 1) return BASE_AWARE_NOUNS[baseTerrain]?.[features[0]] || "";

    const primaryFeature = features
      .slice()
      .sort((a, b) => PRIMARY_FEATURE_PRIORITY.indexOf(a) - PRIMARY_FEATURE_PRIORITY.indexOf(b))[0];
    const primaryBaseName = BASE_AWARE_NOUNS[baseTerrain]?.[primaryFeature] || "";
    if (!primaryBaseName) return "";

    const modifiers = features
      .filter(feature => feature !== primaryFeature)
      .map(feature => FEATURE_NAME_PARTS[feature]?.adjective)
      .filter(Boolean);
    return [...modifiers, primaryBaseName].join(" ");
  }

  function getBaseAwarePairName(baseTerrain, features = []) {
    if (features.length !== 2) return "";
    const table = BASE_AWARE_PAIR_NAMES[baseTerrain] || {};
    const [first, second] = features;
    return table[`${first}+${second}`] || table[`${second}+${first}`] || "";
  }

  function getSingleFeatureTerrainName(baseTerrain, feature, parts, baseNoun) {
    if (["deep_sea", "sea", "coastal_water", "inland_water"].includes(baseTerrain)) {
      if (["waves", "kelp", "water_rocks", "whirlpool", "ice", "reef", "shoals", "rapids", "falls", "marsh"].includes(feature)) {
        return parts.noun;
      }
    }

    if (["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges", "forest", "woods", "jungle", "marsh", "farmland"].includes(feature)) {
      return parts.noun;
    }

    if (feature === "sand" && ["desert", "deep_desert", "beach"].includes(baseTerrain)) return `${parts.adjective} ${baseNoun}`;
    if (feature === "cactus_scrub") return parts.noun;
    if (feature === "shrub") return baseTerrain.includes("barrens") ? "Shrubland" : parts.noun;

    return `${parts.adjective} ${baseNoun}`;
  }

  function getFeatureNounForBase(baseTerrain, feature, parts, baseNoun) {
    if (feature === "ridges") {
      if (baseTerrain === "rock") return "Rocky Hills";
      if (baseTerrain === "snow") return "Snowy Hills";
      if (baseTerrain === "desert" || baseTerrain === "deep_desert" || baseTerrain === "beach") return "Dunes";
      return "Hills";
    }
    if (feature === "cliffs") return baseTerrain === "beach" ? "Coastal Cliffs" : parts.noun;
    if (feature === "sand") return baseTerrain === "beach" ? "Beach" : baseTerrain === "deep_desert" ? "Deep Desert" : "Desert";
    if (feature === "woods" || feature === "forest" || feature === "jungle" || feature === "marsh" || feature === "farmland") return parts.noun;
    if (["waves", "kelp", "water_rocks", "whirlpool", "reef", "shoals", "rapids", "falls", "ice"].includes(feature)) return parts.noun;
    if (["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature)) return parts.noun;
    if (feature === "cactus_scrub" || feature === "shrub") return parts.noun;
    return `${parts.adjective} ${baseNoun}`;
  }

  function contextualFeatureWeight(hex, featureId, weight, context) {
    let result = weight;

    if (["woods", "forest"].includes(featureId)) {
      const woodsNearby = context?.nearbyFeatureCount?.(hex, "woods", 1) || 0;
      const forestNearby = context?.nearbyFeatureCount?.(hex, "forest", 1) || 0;
      if (featureId === "woods") result *= 1 + woodsNearby * 0.65 + forestNearby * 0.45;
      if (featureId === "forest") result *= 1 + forestNearby * 0.75 + woodsNearby * 0.25;
    }

    if (featureId === "jungle") {
      result *= 1 + (context?.nearbyFeatureCount?.(hex, "jungle", 1) || 0) * 0.75;
      if (context?.hasNearbyBase?.(hex, ["beach", "coastal_water"], 2)) result *= 1.25;
    }

    if (featureId === "reef") {
      if (hex.baseTerrain === "coastal_water" && context?.hasNearbyBase?.(hex, ["beach"], 2)) result *= 2.2;
      if (hex.baseTerrain === "sea") result *= 0.45;
    }

    if (featureId === "mountains") {
      result *= context?.hasNearbyAnyFeature?.(hex, ["mountains", "snowcapped_mountains"], 2) ? 2.4 : 0.65;
    }

    if (featureId === "snowcapped_mountains") {
      result *= context?.hasNearbyAnyFeature?.(hex, ["mountains", "snowcapped_mountains"], 2) ? 2.1 : 0.85;
    }

    if (featureId === "lone_mountain") {
      result *= context?.hasNearbyAnyFeature?.(hex, ["mountains", "snowcapped_mountains"], 2) ? 1.8 : 0.2;
    }

    if (featureId === "ridges" && context?.hasNearbyAnyFeature?.(hex, ["mountains", "snowcapped_mountains", "lone_mountain"], 2)) {
      result *= 1.8;
    }

    if (featureId === "waves" && context?.hasNearbyFeature?.(hex, "whirlpool", 1)) {
      result *= 2.5;
    }

    if (featureId === "marsh" && hex.baseTerrain === "inland_water") {
      const marshNeighbors = context?.nearbyFeatureCount?.(hex, "marsh", 2) || 0;
      if (context?.hasNearbyBase?.(hex, ["wetland"], 2)) result *= 2.4;
      if (marshNeighbors) result *= Math.max(0.5, 1.8 - marshNeighbors * 0.18);
    }

    return result;
  }

  function canFeatureAppearNaturally(hex, featureId, existingFeatures = [], options = {}) {
    const base = hex?.baseTerrain;
    const existing = new Set(existingFeatures || []);
    const context = options.context;
    const hashNumber = options.hashNumber || defaultHashNumber;
    const seed = options.seed || `${hex?.id || "hex"}:${featureId}`;
    const manualBrush = Boolean(options.manualBrush);

    if (!getValidFeaturesForBase(base).includes(featureId)) return false;
    if (["barrens", "bleak_barrens", "wastes"].includes(base) && ["woods", "forest"].includes(featureId)) {
      if (manualBrush) return true;
      const chanceByBase = {
        barrens: { woods: 24, forest: 6 },
        bleak_barrens: { woods: 16, forest: 4 },
        wastes: { woods: 10, forest: 2 }
      };
      return hashPercent(`${seed}:dead-tree:${base}:${featureId}`, hashNumber) < (chanceByBase[base]?.[featureId] || 0);
    }
    if (featureId === "falls") return Boolean(context?.hasStrongWaterDrop?.(hex));

    if (featureId === "ice") {
      return ["deep_sea", "sea", "coastal_water", "inland_water", "snow"].includes(base) &&
        (base === "snow" ||
          context?.hasNearbyBase?.(hex, ["snow"], 2) ||
          context?.hasNearbyFeature?.(hex, "snowcapped_mountains", 2) ||
          context?.hasNearbyFeature?.(hex, "ice", 2));
    }

    if (featureId === "rapids") {
      return base === "inland_water" &&
        (context?.hasNearbyBase?.(hex, ["rock", "snow"], 1) || context?.hasNearbyAnyFeature?.(hex, ["ridges", "mountains"], 1));
    }

    if (featureId === "reef") {
      if (base === "coastal_water") return context?.hasNearbyBase?.(hex, ["beach"], 2);
      return base === "sea" && context?.hasNearbyBase?.(hex, ["beach", "coastal_water"], 2) && (manualBrush || hashPercent(`${seed}:reef`, hashNumber) < 16);
    }

    if (featureId === "kelp") return ["deep_sea", "sea", "coastal_water"].includes(base);
    if (featureId === "shoals") return ["coastal_water", "inland_water"].includes(base) || (base === "sea" && context?.hasNearbyBase?.(hex, ["coastal_water", "beach"], 1));
    if (featureId === "water_rocks") return ["deep_sea", "sea", "coastal_water", "inland_water"].includes(base) || context?.hasNearbyBase?.(hex, ["beach", "rock"], 1) || context?.hasNearbyAnyFeature?.(hex, ["ridges", "cliffs", "mountains"], 1);
    if (featureId === "whirlpool") return ["deep_sea", "sea", "coastal_water"].includes(base) && (manualBrush || hashPercent(`${seed}:whirlpool`, hashNumber) < 35);
    if (featureId === "snowcapped_mountains") return base === "snow";
    if (featureId === "jungle") return ["jungle_floor", "wetland", "lush_grassland"].includes(base);

    if (featureId === "farmland") {
      if (!["plains", "grassland", "lush_grassland"].includes(base)) return false;
      if (context?.hasNearbyBase?.(hex, ["wastes", "bleak_barrens", "deep_desert"], 1)) return false;
      if (context?.hasNearbyPoiType?.(hex, ["farm", "settlement", "city"], 2)) return true;
      return manualBrush || hashPercent(`${seed}:farmland`, hashNumber) < 6;
    }

    if (featureId === "marsh") {
      if (base === "wetland") return true;
      if (base === "lush_grassland") return manualBrush || hashPercent(`${seed}:marsh-lush`, hashNumber) < 8;
      if (base !== "inland_water") return false;
      if (context?.hasNearbyBase?.(hex, ["wetland"], 2)) return hashPercent(`${seed}:marsh-wetland`, hashNumber) < 55;
      const marshNeighbors = context?.nearbyFeatureCount?.(hex, "marsh", 2) || 0;
      if (!marshNeighbors) return false;
      const chance = Math.max(6, 34 - Math.max(0, marshNeighbors - 1) * 4);
      return hashPercent(`${seed}:marsh-spread:${marshNeighbors}`, hashNumber) < chance;
    }

    if (featureId === "lone_mountain") return ["plains", "grassland", "desert", "deep_desert", "barrens", "rock", "wastes"].includes(base) && context?.hasNearbyAnyFeature?.(hex, ["mountains"], 2);
    if (featureId === "mountains") return ["rock", "snow"].includes(base) && (manualBrush || context?.hasNearbyAnyFeature?.(hex, ["mountains", "snowcapped_mountains"], 2) || hashPercent(`${seed}:mountains`, hashNumber) < 45);
    if (featureId === "volcano") return ["rock", "wastes", "bleak_barrens"].includes(base);

    return true;
  }

  function weightedPickFeature(hex, rule, existingFeatures, options) {
    const existing = new Set(existingFeatures || []);
    const hashNumber = options.hashNumber || defaultHashNumber;
    const entries = Object.entries(rule.weights)
      .filter(([featureId]) => !existing.has(featureId))
      .filter(([featureId]) => canFeatureAppearNaturally(hex, featureId, existingFeatures, options))
      .map(([featureId, weight]) => [featureId, contextualFeatureWeight(hex, featureId, weight, options.context)])
      .filter(([, weight]) => weight > 0);

    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) return null;

    let roll = hashUnit(`${options.seed}:weighted:${existing.size}`, hashNumber) * total;
    for (const [featureId, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return featureId;
    }

    return entries[entries.length - 1]?.[0] || null;
  }

  function secondaryChanceForHex(hex, rule, options) {
    let chance = rule.chance;
    const context = options.context;
    if (rule.id === "water_rocks" && (context?.hasNearbyBase?.(hex, ["rock", "beach"], 1) || context?.hasNearbyAnyFeature?.(hex, ["ridges", "cliffs", "mountains"], 1))) {
      chance += 0.10;
    }
    return Math.min(rule.maxChance || 0.95, chance * (options.featureDensityScale || 1));
  }

  function applySecondaryFeatureRules(hex, features, options = {}) {
    const result = [...features];
    SECONDARY_FEATURE_RULES.forEach(rule => {
      if (result.length >= 3) return;
      if (!rule.allowedBases.includes(hex.baseTerrain)) return;
      if (rule.requiresAnyFeature && !rule.requiresAnyFeature.some(featureId => result.includes(featureId))) return;
      if (rule.suppressIfAnyFeature?.some(featureId => result.includes(featureId))) return;
      if (result.includes(rule.id)) return;
      if (!canFeatureAppearNaturally(hex, rule.id, result, options)) return;
      if (hashUnit(`${options.seed}:secondary:${rule.id}`, options.hashNumber || defaultHashNumber) < secondaryChanceForHex(hex, rule, options)) result.push(rule.id);
    });
    return result;
  }

  function cleanFeatureStack(features) {
    let result = [...features];
    if (result.includes("falls")) result = result.filter(featureId => featureId !== "rapids");
    if (result.includes("whirlpool")) result = result.filter(featureId => !["waves", "shoals"].includes(featureId));
    if (result.some(featureId => ["forest", "jungle", "mountains", "snowcapped_mountains"].includes(featureId))) {
      result = result.filter(featureId => featureId !== "farmland");
    }
    if (result.includes("jungle")) result = result.filter(featureId => !["farmland", "cactus_scrub"].includes(featureId));
    return result;
  }

  function generateFeaturesForTerrain(options = {}) {
    const baseTerrain = options.baseTerrain;
    const rule = FEATURE_PROBABILITY_RULES[baseTerrain];
    const hashNumber = options.hashNumber || defaultHashNumber;
    const seed = options.seed || `${baseTerrain}:generated`;
    const noiseBoost = Math.max(0, Math.min(1, Number(options.noise || 0) / 100));
    const featureDensityScale = Math.max(0.1, Math.min(1.65, Number(options.featureDensityScale || 1) + noiseBoost * 0.55));
    const maxFeatures = clampNumber(Number(options.maxFeatures), 0, 2, 2);
    const hex = options.hex || { id: seed, baseTerrain, features: [] };
    hex.baseTerrain = baseTerrain;

    if (!rule || maxFeatures <= 0) return [];
    if (hashUnit(`${seed}:chance`, hashNumber) >= Math.min(0.98, rule.chance * featureDensityScale)) return [];

    const selected = [];
    const primary = weightedPickFeature(hex, rule, selected, { ...options, seed, hashNumber, featureDensityScale });
    if (primary) selected.push(primary);

    const stacked = cleanFeatureStack(applySecondaryFeatureRules(hex, selected, { ...options, seed, hashNumber, featureDensityScale }));

    if (options.elevation !== "auto" && Number(options.elevation) >= 4) {
      ["mountains", "snowcapped_mountains", "ridges"].forEach(feature => {
        if (getValidFeaturesForBase(baseTerrain).includes(feature) && hashPercent(`${seed}:${feature}:elevation`, hashNumber) < 22) stacked.push(feature);
      });
    }

    return ensureValidFeatures(baseTerrain, stacked, { maxFeatures });
  }

  function getBrushCandidates(snapshot, brush, options = {}) {
    if (brush?.ignoreCompatibility) return brush.features || [];
    const valid = new Set(getValidFeaturesForBase(snapshot?.baseTerrain));
    return (brush?.features || [])
      .filter(feature => valid.has(feature))
      .filter(feature => canFeatureAppearNaturally(snapshot, feature, snapshot?.features || [], {
        ...options,
        manualBrush: true,
        seed: `${options.seed || snapshot?.hexId || snapshot?.id || "hex"}:${feature}`
      }));
  }

  function defaultHashNumber(text) {
    let hash = 2166136261;
    for (let index = 0; index < String(text).length; index += 1) {
      hash ^= String(text).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  window.CampaignTerrainRules = {
    TERRAIN_COLORS,
    BASE_TERRAIN_OPTIONS,
    FEATURE_LABELS,
    FEATURE_CATEGORIES,
    VALID_FEATURES_BY_BASE,
    BASE_ELEVATION,
    FEATURE_ELEVATION_MODIFIERS,
    EXCLUSIVE_FEATURE_GROUPS,
    FEATURE_BRUSH_OPTIONS,
    getValidFeaturesForBase,
    normalizeFeatures,
    ensureValidFeatures,
    getTerrainDisplayName,
    getAutoElevation,
    getFeatureElevationModifier,
    canFeatureAppearNaturally,
    generateFeaturesForTerrain,
    getBrushCandidates
  };
})();
