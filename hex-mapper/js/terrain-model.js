// Terrain model and legacy terrain migration for the Waymark Codex hex map prototype.

const TERRAIN = [
  { id: "deep_sea", label: "Deep Sea", color: "#14384f", aliases: ["Deep Sea", "Ocean"] },
  { id: "sea", label: "Sea", color: "#2e6e8f", aliases: ["Sea"] },
  { id: "inland_water", label: "Inland Water", color: "#4d91a8", aliases: ["Inland Water", "Inland Waters"] },
  { id: "beach", label: "Beach", color: "#dbc487", aliases: ["Beach"] },
  { id: "plains", label: "Plains", color: "#c1b06d", aliases: ["Plains"] },
  { id: "grassland", label: "Grassland", color: "#8fa75f", aliases: ["Grassland"] },
  { id: "cultivated_farmland", label: "Cultivated Farmland", color: "#b59a57", aliases: ["Cultivated Farmland"] },
  { id: "light_forest", label: "Light Forest", color: "#5f8c4f", aliases: ["Light Forest"] },
  { id: "heavy_forest", label: "Heavy Forest", color: "#315b39", aliases: ["Heavy Forest"] },
  { id: "jungle", label: "Jungle", color: "#27663c", aliases: ["Jungle"] },
  { id: "evergreen_wetlands", label: "Evergreen Wetlands", color: "#3d6856", aliases: ["Evergreen Wetlands"] },
  { id: "hills", label: "Hills", color: "#9b8658", aliases: ["Hills"] },
  { id: "grassy_hills", label: "Grassy Hills", color: "#87945c", aliases: ["Grassy Hills"] },
  { id: "shrubland_hills", label: "Shrubland Hills", color: "#8c7d54", aliases: ["Shrubland Hills"] },
  { id: "forested_hills", label: "Forested Hills", color: "#557047", aliases: ["Forested Hills"] },
  { id: "mountains", label: "Mountains", color: "#756e66", aliases: ["Mountains"] },
  { id: "forested_mountains", label: "Forested Mountains", color: "#53604d", aliases: ["Forested Mountains"] },
  { id: "snowcapped_mountains", label: "Snowcapped Mountains", color: "#b8bdc0", aliases: ["Snowcapped Mountains"] },
  { id: "snowfield", label: "Snowfield", color: "#dce5e6", aliases: ["Snowfield", "Snow"] },
  { id: "sandy_desert", label: "Sandy Desert", color: "#d4b36f", aliases: ["Sandy Desert"] },
  { id: "deep_desert", label: "Deep Desert", color: "#b88955", aliases: ["Deep Desert", "Rocky Desert"] },
  { id: "coastal_desert", label: "Coastal Desert", color: "#caa567", aliases: ["Coastal Desert"] },
  { id: "barrens", label: "Badlands", color: "#a56545", aliases: ["Badlands"] },
  { id: "bleak_barrens", label: "Deep Badlands", color: "#7d4335", aliases: ["Deep Badlands", "Full Badlands"] },
    { id: "cactus_scrub", label: "Cactus Scrub", color: "#9a9156", aliases: ["Cactus", "Cactus Scrub"] },
  { id: "lone_mountain", label: "Lone Mountain", color: "#5e5a55", aliases: ["Lone Mountain", "Dormant Volcano"] },
  { id: "volcano", label: "Volcano", color: "#453232", aliases: ["Volcano"] }
];


const BASE_TERRAINS = [
  { id: "deep_sea", label: "Deep Sea", color: "#0b263a" },
  { id: "sea", label: "Sea", color: "#245f82" },
  { id: "coastal_water", label: "Coastal Water", color: "#4a91ab" },
  { id: "inland_water", label: "Inland Water", color: "#79b8c8" },
  { id: "beach", label: "Beach", color: "#dbc487" },
  { id: "plains", label: "Plains", color: "#c1b06d" },
  { id: "grassland", label: "Grassland", color: "#8fa75f" },
  { id: "lush_grassland", label: "Lush Grassland", color: "#4e7b45" },
  { id: "wetland", label: "Wetland", color: "#3d6856" },
  { id: "jungle_floor", label: "Jungle Floor", color: "#27663c" },
  { id: "desert", label: "Desert", color: "#d4b36f" },
  { id: "deep_desert", label: "Deep Desert", color: "#b88955" },
  { id: "barrens", label: "Barrens", color: "#a56545" },
  { id: "bleak_barrens", label: "Bleak Barrens", color: "#7d4335" },
  { id: "snow", label: "Snow", color: "#dce5e6" },
  { id: "rock", label: "Rock", color: "#756e66" },
  { id: "wastes", label: "Wastes", color: "#453232" }
];

const TERRAIN_FEATURES = [
  { id: "woods", label: "Woods", glyph: "♧", category: "vegetation" },
  { id: "forest", label: "Forest", glyph: "♣", category: "vegetation" },
  { id: "jungle", label: "Jungle", glyph: "♣", category: "vegetation" },
  { id: "shrub", label: "Shrub", glyph: "♤", category: "vegetation" },
  { id: "cactus_scrub", label: "Cactus Scrub", glyph: "♮", category: "vegetation" },
  { id: "marsh", label: "Marsh", glyph: "≈", category: "vegetation" },
  { id: "kelp", label: "Kelp", glyph: "≋", category: "vegetation" },

  { id: "ridges", label: "Ridges", glyph: "⌒", category: "structure" },
  { id: "mountains", label: "Mountains", glyph: "▲", category: "structure" },
  { id: "snowcapped_mountains", label: "Snowcapped Mountains", glyph: "△", category: "structure" },
  { id: "cliffs", label: "Cliffs", glyph: "▴", category: "structure" },
  { id: "lone_mountain", label: "Lone Mountain", glyph: "◆", category: "structure" },
  { id: "volcano", label: "Volcano", glyph: "◭", category: "structure" },
  { id: "reef", label: "Reef", glyph: "◇", category: "structure" },
  { id: "shoals", label: "Shoals", glyph: "⋯", category: "structure" },
  { id: "water_rocks", label: "Water Rocks", glyph: "◦", category: "structure" },
  { id: "rapids", label: "Rapids", glyph: "≋", category: "structure" },
  { id: "falls", label: "Falls", glyph: "⋮", category: "structure" },
  { id: "whirlpool", label: "Whirlpool", glyph: "◎", category: "structure" },

  { id: "farmland", label: "Farmland", glyph: "▦", category: "surface" },
  { id: "sand", label: "Sand", glyph: "∴", category: "surface" },
  { id: "waves", label: "Waves", glyph: "≈", category: "surface" },
  { id: "ice", label: "Ice", glyph: "✧", category: "surface" },

  { id: "snowcap", label: "Snowcap", glyph: "△", category: "accent" },
  { id: "mist", label: "Mist", glyph: "〰", category: "atmosphere" }
];

const baseTerrainById = Object.fromEntries(BASE_TERRAINS.map(t => [t.id, t]));
const featureById = Object.fromEntries(TERRAIN_FEATURES.map(f => [f.id, f]));

const VALID_FEATURES_BY_BASE = {
  deep_sea: ["waves", "mist", "kelp", "water_rocks", "whirlpool", "ice"],
  sea: ["waves", "mist", "reef", "shoals", "water_rocks", "kelp", "ice"],
  coastal_water: ["waves", "mist", "kelp", "water_rocks", "whirlpool", "ice"],
  inland_water: ["waves", "mist", "shoals", "water_rocks", "rapids", "falls", "marsh", "ice"],

  beach: ["sand", "ridges", "cliffs", "mist", "water_rocks"],
  plains: ["woods", "shrub", "ridges", "farmland", "lone_mountain", "mist"],
  grassland: ["woods", "forest", "shrub", "ridges", "farmland", "lone_mountain", "mist"],
  lush_grassland: ["woods", "forest", "shrub", "ridges", "farmland", "marsh", "mist"],
  wetland: ["woods", "forest", "marsh", "mist"],
  jungle_floor: ["jungle", "ridges", "mist"],

  desert: ["sand", "ridges", "cactus_scrub", "cliffs", "lone_mountain", "mist"],
  deep_desert: ["sand", "ridges", "cactus_scrub", "cliffs", "lone_mountain", "mist"],
  barrens: ["shrub", "ridges", "cliffs", "lone_mountain", "mist"],
  bleak_barrens: ["shrub", "ridges", "cliffs", "lone_mountain", "mist"],
  snow: ["ridges", "mountains", "snowcapped_mountains", "woods", "forest", "snowcap", "ice", "mist"],
  rock: ["ridges", "mountains", "woods", "forest", "cliffs", "lone_mountain", "snowcap", "volcano", "mist"],
  wastes: ["ridges", "cliffs", "lone_mountain", "volcano", "mist"]
};

const LEGACY_TERRAIN_TO_COMBO = {
  "Deep Sea": ["sea", []],
  "Ocean": ["deep_sea", []],
  "Sea": ["coastal_water", []],
  "Inland Waters": ["inland_water", []],
  "Inland Water": ["inland_water", []],
  "Coastal Water": ["coastal_water", []],
  "Beach": ["beach", []],

  "Plains": ["plains", []],
  "Grassland": ["grassland", []],
  "Cultivated Farmland": ["grassland", ["farmland"]],

  "Light Forest": ["lush_grassland", ["woods"]],
  "Heavy Forest": ["lush_grassland", ["forest"]],
  "Jungle": ["jungle_floor", ["jungle"]],
  "Evergreen Wetlands": ["wetland", ["forest"]],

  "Hills": ["plains", ["ridges"]],
  "Grassy Hills": ["grassland", ["ridges"]],
  "Shrubland Hills": ["grassland", ["ridges", "shrub"]],
  "Forested Hills": ["lush_grassland", ["ridges", "forest"]],

  "Mountains": ["rock", ["mountains"]],
  "Forested Mountains": ["rock", ["mountains", "forest"]],
  "Snowcapped Mountains": ["snow", ["snowcapped_mountains"]],

  "Sandy Desert": ["desert", []],
  "Deep Desert": ["deep_desert", []],
  "Rocky Desert": ["deep_desert", ["ridges"]],
  "Coastal Desert": ["desert", ["ridges"]],

  "Badlands": ["barrens", []],
  "Full Badlands": ["bleak_barrens", []],
  "Deep Badlands": ["bleak_barrens", []],
  "Broken Lands": ["bleak_barrens", ["cliffs"]],

  "Cactus": ["desert", ["cactus_scrub"]],
  "Cactus Scrub": ["desert", ["cactus_scrub"]],
  "Dormant Volcano": ["rock", ["lone_mountain"]],
  "Lone Mountain": ["rock", ["lone_mountain"]],
  "Volcano": ["wastes", ["volcano"]],
  "Ashland": ["wastes", []],
  "Wastes": ["wastes", []],
  "Snow": ["snow", []],
  "Snowfield": ["snow", []]
};

const FEATURE_RENDER_ORDER = [
  "ice", "farmland", "sand", "waves",
  "ridges", "cliffs", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "reef", "shoals", "water_rocks", "rapids", "falls", "whirlpool",
  "shrub", "woods", "forest", "jungle", "cactus_scrub", "marsh", "kelp",
  "snowcap",
  "mist"
];

const BLEED_PRIORITY = {
  deep_sea: 100,
  sea: 90,
  coastal_water: 80,
  inland_water: 70,
  rock: 65,
  snow: 63,
  wastes: 61,
  bleak_barrens: 58,
  barrens: 56,
  deep_desert: 52,
  desert: 50,
  wetland: 46,
  jungle_floor: 42,
  lush_grassland: 38,
  grassland: 34,
  plains: 30,
  beach: 20
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
  snowcap: 0,
  reef: 0,
  shoals: 0,
  water_rocks: 0,
  rapids: 0,
  falls: 0
};

const ELEVATION_VARIATION_CHANCE = 0.28;


function getValidFeaturesForBase(baseId) {
  return VALID_FEATURES_BY_BASE[baseId] || [];
}

function normalizeFeatures(features) {
  if (!Array.isArray(features)) return [];
  return [...new Set(features.filter(featureId => featureById[featureId]))];
}

function enforceFeatureCategoryRules(features) {
  const result = [];
  const seenCategory = {};

  normalizeFeatures(features).forEach(featureId => {
    const feature = featureById[featureId];
    const category = feature?.category || "misc";

    if (category !== "atmosphere" && category !== "accent") {
      if (seenCategory[category]) {
        const oldIndex = result.indexOf(seenCategory[category]);
        if (oldIndex >= 0) result.splice(oldIndex, 1);
      }
      seenCategory[category] = featureId;
    }

    result.push(featureId);
  });

  return [...new Set(result)];
}

function ensureValidFeatureArray(baseTerrain, features) {
  const valid = new Set(getValidFeaturesForBase(baseTerrain));
  return enforceFeatureCategoryRules(normalizeFeatures(features).filter(featureId => valid.has(featureId)));
}

function hasFeature(features, featureId) {
  return Array.isArray(features) && features.includes(featureId);
}

function getFeatureElevationModifier(features = []) {
  return normalizeFeatures(features).reduce((highest, featureId) => {
    return Math.max(highest, FEATURE_ELEVATION_MODIFIERS[featureId] || 0);
  }, 0);
}

function getDerivedHexElevation(hex) {
  if (!hex) return 0;
  const valid = ensureValidCombo(hex.baseTerrain, hex.features);
  return (BASE_ELEVATION[valid.baseTerrain] ?? 1) + getFeatureElevationModifier(valid.features);
}

function getVariedHexElevation(hex, randomFn = Math.random) {
  const baseElevation = getDerivedHexElevation(hex);
  if (randomFn() >= ELEVATION_VARIATION_CHANCE) return baseElevation;
  return baseElevation + (randomFn() < 0.5 ? -1 : 1);
}

function getHexElevation(hex) {
  if (!hex) return 0;
  if (String(hex.elevation ?? "").trim() === "") return getDerivedHexElevation(hex);
  const stored = Number(hex.elevation);
  if (Number.isFinite(stored)) return stored;
  return getDerivedHexElevation(hex);
}

function getTerrainDisplayName(baseId, featuresInput = []) {
  const base = baseTerrainById[baseId]?.label || baseId || "Unknown";
  const features = ensureValidFeatureArray(baseId, featuresInput);
  const has = featureId => hasFeature(features, featureId);
  const misty = has("mist");
  const prefix = value => misty && !String(value).startsWith("Misty ") ? `Misty ${value}` : value;

  if (!features.length) return base;

  if (["deep_sea", "sea", "coastal_water", "inland_water"].includes(baseId)) {
    if (has("whirlpool")) return prefix("Whirlpool");
    if (has("falls")) return prefix("Falls");
    if (has("rapids")) return prefix("Rapids");
    if (has("reef")) return prefix("Reef");
    if (has("shoals")) return prefix("Shoals");
    if (has("water_rocks")) return prefix("Rocky Waters");
    if (has("kelp")) return prefix("Kelp Beds");
    if (has("ice")) return prefix(baseId === "deep_sea" ? "Frozen Deep Sea" : baseId === "sea" ? "Frozen Sea" : baseId === "coastal_water" ? "Frozen Coastal Water" : "Frozen Inland Water");
    if (has("waves")) return prefix(baseId === "deep_sea" ? "Rough Deep Sea" : baseId === "sea" ? "Rough Sea" : baseId === "coastal_water" ? "Rough Coastal Water" : "Rough Inland Water");
    return misty ? prefix(base) : base;
  }

  if (baseId === "beach") {
    if (misty) return "Misty Coast";
    if (has("sand")) return "Sandy Beach";
    if (has("cliffs")) return "Coastal Cliffs";
    if (has("ridges")) return "Beach Dunes";
    if (has("water_rocks")) return "Rocky Coast";
    return base;
  }

  if (has("volcano")) return prefix("Volcano");
  if (has("lone_mountain")) return prefix("Lone Mountain");

  if (baseId === "rock") {
    if (has("mountains") && has("forest")) return prefix("Forested Mountains");
    if (has("mountains") && has("woods")) return prefix("Wooded Mountains");
    if (has("mountains") && has("snowcap")) return prefix("Snowcapped Mountains");
    if (has("mountains")) return prefix("Mountains");
    if (has("cliffs")) return prefix("Cliffs");
    if (has("ridges")) return prefix("Rocky Hills");
  }

  if (baseId === "snow") {
    if (has("snowcapped_mountains") || has("mountains") || has("snowcap")) return prefix("Snowcapped Mountains");
    if (has("ridges")) return prefix("Snowy Hills");
    if (has("forest")) return prefix("Snowy Forest");
    if (has("woods")) return prefix("Snowy Woods");
    if (has("ice")) return prefix("Ice Fields");
  }

  if (baseId === "wetland") {
    if (has("forest")) return prefix("Evergreen Wetlands");
    if (has("woods")) return prefix("Wet Woods");
    if (has("marsh")) return prefix("Marsh");
  }

  if (baseId === "jungle_floor") {
    if (has("ridges")) return prefix("Jungle Hills");
    if (has("jungle")) return prefix("Jungle");
  }

  if (has("farmland")) return prefix("Cultivated Farmland");

  if (baseId === "desert") {
    if (has("sand")) return prefix("Sandy Desert");
    if (has("ridges")) return prefix("Dunes");
    if (has("cactus_scrub")) return prefix("Cactus Scrub");
    if (has("cliffs")) return prefix("Desert Cliffs");
  }

  if (baseId === "deep_desert") {
    if (has("sand")) return prefix("Sandy Deep Desert");
    if (has("ridges")) return prefix("Rocky Desert");
    if (has("cactus_scrub")) return prefix("Cactus Scrub");
    if (has("cliffs")) return prefix("Desert Cliffs");
  }

  if (baseId === "barrens" || baseId === "bleak_barrens") {
    if (has("cliffs")) return prefix(baseId === "bleak_barrens" ? "Bleak Cliffs" : "Barren Cliffs");
    if (has("ridges") && has("shrub")) return prefix(baseId === "bleak_barrens" ? "Bleak Shrubland Hills" : "Shrubland Hills");
    if (has("ridges")) return prefix(baseId === "bleak_barrens" ? "Bleak Hills" : "Barren Hills");
    if (has("shrub")) return prefix(baseId === "bleak_barrens" ? "Bleak Shrubland" : "Shrubland");
  }

  if (baseId === "wastes") {
    if (has("cliffs")) return prefix("Wasted Cliffs");
    if (has("ridges")) return prefix("Wasted Hills");
  }

  if (baseId === "plains") {
    if (has("ridges") && has("shrub")) return prefix("Shrubland Hills");
    if (has("ridges")) return prefix("Hills");
    if (has("shrub")) return prefix("Shrubland");
    if (has("woods")) return prefix("Woods");
  }

  if (baseId === "grassland") {
    if (has("ridges") && has("forest")) return prefix("Forested Hills");
    if (has("ridges") && has("woods")) return prefix("Wooded Hills");
    if (has("ridges") && has("shrub")) return prefix("Shrubland Hills");
    if (has("ridges")) return prefix("Grassy Hills");
    if (has("forest")) return prefix("Forest");
    if (has("woods")) return prefix("Woods");
    if (has("shrub")) return prefix("Brushland");
  }

  if (baseId === "lush_grassland") {
    if (has("ridges") && has("forest")) return prefix("Forested Hills");
    if (has("ridges") && has("woods")) return prefix("Wooded Hills");
    if (has("ridges") && has("shrub")) return prefix("Thicketed Hills");
    if (has("ridges")) return prefix("Lush Hills");
    if (has("forest")) return prefix("Forest");
    if (has("woods")) return prefix("Woods");
    if (has("shrub")) return prefix("Thicket");
    if (has("marsh")) return prefix("Marshy Grassland");
  }

  const featureNames = features
    .filter(featureId => featureId !== "mist")
    .map(featureId => featureById[featureId]?.label)
    .filter(Boolean);

  return prefix(featureNames.length ? `${base} + ${featureNames.join(" + ")}` : base);
}

function legacyTerrainToCombo(value) {
  const raw = String(value || "").trim();
  const exact = LEGACY_TERRAIN_TO_COMBO[raw];
  if (exact) return { baseTerrain: exact[0], features: exact[1] };

  const normalizedId = normalizeTerrainName(raw);
  const terrain = terrainById[normalizedId]?.label || raw;
  const fallback = LEGACY_TERRAIN_TO_COMBO[terrain] || ["plains", []];
  return { baseTerrain: fallback[0], features: fallback[1] };
}

function ensureValidCombo(baseTerrain, features) {
  const base = baseTerrainById[baseTerrain] ? baseTerrain : "plains";
  return { baseTerrain: base, features: ensureValidFeatureArray(base, features) };
}

function hydrateHexTerrainFields(hex) {
  if (!hex.features) {
    if (hex.terrainFeature && hex.terrainFeature !== "none") {
      hex.features = [hex.terrainFeature];
    } else {
      const combo = legacyTerrainToCombo(hex.terrain);
      hex.baseTerrain = combo.baseTerrain;
      hex.features = combo.features;
    }
  }

  const valid = ensureValidCombo(hex.baseTerrain, hex.features);
  hex.baseTerrain = valid.baseTerrain;
  hex.features = valid.features;
  hex.terrainFeature = hex.features[0] || "none";
  hex.terrain = getTerrainDisplayName(hex.baseTerrain, hex.features);
  if (String(hex.elevation ?? "").trim() === "" || !Number.isFinite(Number(hex.elevation))) {
    hex.elevation = getDerivedHexElevation(hex);
  }
  return hex;
}

const terrainById = Object.fromEntries(TERRAIN.map(t => [t.id, t]));
const terrainAliasToId = {};
TERRAIN.forEach(t => {
  terrainAliasToId[t.id.toLowerCase()] = t.id;
  terrainAliasToId[t.label.toLowerCase()] = t.id;
  (t.aliases || []).forEach(alias => terrainAliasToId[String(alias).trim().toLowerCase()] = t.id);
});

function normalizeTerrainName(value) {
  const key = String(value || "").trim().toLowerCase();
  return terrainAliasToId[key] || "plains";
}
