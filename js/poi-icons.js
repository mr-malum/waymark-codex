(function() {
  const ASSET_BASE_PATH = "hex-mapper/assets/POIs/";
  const FALLBACK_ICON = "unknown_marker";
  const CATEGORY_DEFINITIONS = Object.freeze([
    {
      value: "settlements",
      label: "Settlements",
      family: "settlement",
      icons: [
        "city",
        "walled_city",
        "village",
        "hilltop_town",
        "mountain_city",
        "mountain_hold",
        "port_town"
      ]
    },
    {
      value: "strongholds",
      label: "Strongholds",
      family: "stronghold",
      icons: [
        "castle",
        "fort",
        "watchtower",
        "stone_tower",
        "sea_fort",
        "mountain_gate",
        "walled_encampment",
        "gate"
      ]
    },
    {
      value: "waypoints_travel",
      label: "Waypoints & Travel",
      family: "waypoint",
      icons: [
        "inn",
        "tavern",
        "lodge",
        "campsite",
        "market",
        "trader",
        "watch_fire",
        "border_post",
        "bridge",
        "bridge_gate",
        "ford",
        "ferry",
        "rowboat",
        "sloop",
        "galleon",
        "mountain_pass",
        "canyon_pass"
      ]
    },
    {
      value: "resources_worksites",
      label: "Resources & Worksites",
      family: "resource_site",
      icons: [
        "farmstead",
        "windmill",
        "mine",
        "quarry",
        "lumber_camp",
        "lumber_mill",
        "hunting_blind",
        "fishing_camp",
        "docks",
        "harbor",
        "warehouse"
      ]
    },
    {
      value: "ruins",
      label: "Ruins",
      family: "ruin",
      icons: [
        "ruins",
        "abandoned_shack",
        "shipwreck",
        "pyramid"
      ]
    },
    {
      value: "dungeons",
      label: "Dungeons",
      family: "dungeon",
      icons: [
        "dungeon",
        "cave",
        "catacombs",
        "crypt",
        "lair",
        "dragon_lair"
      ]
    },
    {
      value: "holy_sites",
      label: "Holy Sites",
      family: "holy_site",
      icons: [
        "abbey",
        "temple",
        "shrine",
        "roadside_shrine",
        "sacred_grove",
        "graveyard",
        "mausoleum",
        "ziggurat"
      ]
    },
    {
      value: "arcane_sites",
      label: "Arcane Sites",
      family: "arcane_site",
      icons: [
        "wizard_tower",
        "arcane_portal",
        "ley_nexus",
        "observatory",
        "laboratory"
      ]
    },
    {
      value: "wilderness_sites",
      label: "Wilderness Sites",
      family: "wilderness_site",
      icons: [
        "tree",
        "dead_tree",
        "oasis",
        "spring",
        "geyser",
        "waterfall",
        "swamp",
        "island",
        "island_2"
      ]
    },
    {
      value: "hazards",
      label: "Hazards",
      family: "hazard",
      icons: [
        "bandit_camp",
        "battlefield",
        "kraken",
        "reef",
        "whirlpool",
        "volcano",
        "crater"
      ]
    },
    {
      value: "landmarks",
      label: "Landmarks",
      family: "landmark",
      icons: [
        "standing_stones",
        "monolith",
        "obelisk",
        "lighthouse"
      ]
    },
    {
      value: "fallback_reserve",
      label: "Fallback / Reserve",
      family: "reserve",
      icons: [
        "unknown_marker",
        "compass_rose",
        "anchor",
        "trade_goods",
        "ship_stern",
        "pirate_flag",
        "plague_marker",
        "skull_marker",
        "chest"
      ]
    }
  ]);

  const ICON_METADATA_OVERRIDES = Object.freeze({
    city: { traits: ["urban", "major", "trade"] },
    walled_city: { traits: ["urban", "major", "fortified", "trade"] },
    village: { traits: ["rural", "small"] },
    hilltop_town: { traits: ["upland"] },
    mountain_city: { traits: ["mountain", "mountain_only", "urban", "major"] },
    mountain_hold: { traits: ["mountain", "mountain_only", "undermountain", "fortified", "road_anchor"] },
    port_town: { traits: ["coastal", "coastal_only", "trade", "fishing"] },
    farmstead: { family: "resource_site", traits: ["farming", "rural"] },

    castle: { traits: ["fortified", "strategic", "occupied"] },
    fort: { traits: ["fortified", "strategic", "frontier"] },
    watchtower: { traits: ["watch", "frontier", "high_ground"] },
    stone_tower: { traits: ["watch", "fortified", "isolated"] },
    sea_fort: { traits: ["coastal", "coastal_only", "fortified", "strategic"] },
    mountain_gate: { traits: ["mountain", "mountain_only", "pass_control", "fortified", "road_anchor", "pass_anchor"] },
    walled_encampment: { traits: ["frontier", "occupied", "fortified"] },
    gate: { traits: ["urban_adjacent", "fortified", "threshold"] },

    inn: { traits: ["rest", "settled", "roadside"] },
    tavern: { traits: ["rest", "roadside", "low_intensity"] },
    lodge: { traits: ["rest", "frontier", "upland"] },
    campsite: { traits: ["rest", "rough", "remote"] },
    market: { traits: ["trade", "crossroads", "settled"] },
    trader: { traits: ["trade", "caravan", "roadside"] },
    watch_fire: { traits: ["signal", "frontier", "high_ground"] },
    border_post: { traits: ["frontier", "borderland", "watch", "road_anchor", "frontier_anchor"] },
    bridge: { traits: ["crossing", "river", "built", "road_anchor", "river_crossing_anchor"] },
    bridge_gate: { traits: ["crossing", "river", "fortified", "road_anchor", "river_crossing_anchor"] },
    ford: { traits: ["crossing", "river", "road_anchor", "river_crossing_anchor"] },
    ferry: { traits: ["crossing", "river_or_coastal", "road_anchor", "river_crossing_anchor"] },
    anchor: { family: "reserve", traits: ["reserve", "maritime", "anchorage", "manual_only"] },
    rowboat: { traits: ["river_or_coastal", "small_crossing"] },
    sloop: { traits: ["coastal", "sea_route", "trade"] },
    galleon: { traits: ["coastal", "sea_route", "major_trade"] },
    mountain_pass: { traits: ["mountain", "mountain_only", "pass", "frontier", "road_anchor", "pass_anchor"] },
    canyon_pass: { traits: ["canyon", "canyon_only", "pass", "frontier", "road_anchor", "pass_anchor"] },

    windmill: { traits: ["farming", "open_land", "settlement_supported"] },
    mine: { traits: ["mining", "mountain_or_hill"] },
    quarry: { traits: ["stonework", "rocky"] },
    lumber_camp: { traits: ["forest", "craftwork", "rough"] },
    lumber_mill: { traits: ["forest", "craftwork", "settlement_supported"] },
    hunting_blind: { traits: ["hunting", "forest", "remote"] },
    fishing_camp: { traits: ["fishing", "river_or_coastal", "rural"] },
    docks: { traits: ["trade", "river_or_coastal", "settlement_adjacent"] },
    harbor: { traits: ["trade", "coastal", "coastal_only", "major_port", "settlement_adjacent"] },
    warehouse: { traits: ["trade", "storage", "settlement_adjacent"] },

    ruins: { traits: ["abandoned", "ancient"] },
    abandoned_shack: { traits: ["abandoned", "small", "frontier"] },
    shipwreck: { traits: ["maritime", "lost", "coastal"] },
    pyramid: { traits: ["ancient", "tomb", "old_empire"] },

    dungeon: { traits: ["underground", "sealed"] },
    cave: { traits: ["underground", "natural"] },
    catacombs: { traits: ["underground", "funerary", "sealed"] },
    crypt: { traits: ["underground", "funerary", "hidden"] },
    lair: { traits: ["monster_lair", "remote"] },
    dragon_lair: { traits: ["monster_lair", "major", "remote"] },
    chest: { family: "reserve", traits: ["reserve", "hidden", "loot", "manual_only"] },

    abbey: { traits: ["worship", "settled"] },
    temple: { traits: ["worship", "ceremonial"] },
    shrine: { traits: ["worship", "small"] },
    roadside_shrine: { traits: ["worship", "roadside", "pilgrimage"] },
    sacred_grove: { traits: ["sacred", "wilderness"] },
    graveyard: { traits: ["funerary", "settlement_adjacent"] },
    mausoleum: { traits: ["funerary", "ancient"] },
    ziggurat: { traits: ["ancient", "ceremonial", "monumental"] },

    wizard_tower: { traits: ["research", "isolated"] },
    arcane_portal: { traits: ["anomalous", "otherworldly"] },
    ley_nexus: { traits: ["anomalous", "power_node"] },
    observatory: { traits: ["research", "scholarly"] },
    laboratory: { traits: ["research", "experimental"] },

    tree: { family: "wilderness_site", traits: ["natural", "notable"] },
    dead_tree: { traits: ["natural", "ominous"] },
    oasis: { traits: ["water_source", "life_giving"] },
    spring: { traits: ["water_source", "freshwater"] },
    geyser: { traits: ["water_feature", "anomalous"] },
    waterfall: { traits: ["water_feature", "spectacle"] },
    swamp: { traits: ["wetland", "remote"] },
    island: { traits: ["isolated", "waterbound"] },
    island_2: { traits: ["isolated", "waterbound", "variant"] },

    bandit_camp: { traits: ["lawless", "occupied"] },
    battlefield: { traits: ["warzone", "contested"] },
    kraken: { traits: ["maritime", "monster"] },
    reef: { traits: ["maritime", "shoal"] },
    whirlpool: { traits: ["maritime", "deadly"] },
    volcano: { traits: ["destructive", "mountain"] },
    crater: { traits: ["destructive", "anomalous"] },

    standing_stones: { traits: ["ancient", "sacred_or_anomalous"] },
    monolith: { traits: ["ancient", "monumental"] },
    obelisk: { traits: ["ancient", "monumental"] },
    lighthouse: { traits: ["coastal", "coastal_only", "navigation"] },

    unknown_marker: { traits: ["reserve", "unknown"] },
    compass_rose: { traits: ["reserve", "navigational", "manual_only"] },
    trade_goods: { traits: ["reserve", "trade", "manual_only"] },
    ship_stern: { traits: ["reserve", "maritime", "manual_only"] },
    pirate_flag: { traits: ["reserve", "lawless", "manual_only"] },
    plague_marker: { traits: ["reserve", "blighted", "manual_only"] },
    skull_marker: { traits: ["reserve", "deadly", "manual_only"] }
  });

  const ICON_METADATA = Object.freeze(CATEGORY_DEFINITIONS.reduce((lookup, category) => {
    category.icons.forEach(value => {
      const override = ICON_METADATA_OVERRIDES[value] || {};
      lookup[value] = Object.freeze({
        category: category.value,
        family: override.family || category.family,
        traits: Object.freeze([...(override.traits || [])])
      });
    });
    return lookup;
  }, {}));

  const CATEGORY_OPTIONS = Object.freeze(CATEGORY_DEFINITIONS.map(category => ({
    value: category.value,
    label: category.label,
    options: category.icons.slice()
  })));

  const ICON_VALUES = Object.freeze([
    ...new Set(CATEGORY_DEFINITIONS.flatMap(category => category.icons))
  ]);

  function normalizeToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.svg$/i, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function buildLabel(value) {
    return String(value || "")
      .split("_")
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  const ICON_OPTIONS = Object.freeze(ICON_VALUES.map(value => ({
    value,
    label: buildLabel(value),
    assetUrl: `${ASSET_BASE_PATH}${value}.svg`,
    category: ICON_METADATA[value]?.category || "",
    family: ICON_METADATA[value]?.family || "",
    traits: [...(ICON_METADATA[value]?.traits || [])]
  })));

  const ICON_OPTION_BY_VALUE = Object.freeze(ICON_OPTIONS.reduce((lookup, option) => {
    lookup[option.value] = option;
    return lookup;
  }, {}));

  const VALUE_BY_NORMALIZED_INPUT = Object.freeze(ICON_OPTIONS.reduce((lookup, option) => {
    lookup[normalizeToken(option.value)] = option.value;
    lookup[normalizeToken(option.label)] = option.value;
    return lookup;
  }, {}));

  function normalizeIconValue(value) {
    const token = normalizeToken(value);
    if (!token) return "";
    return VALUE_BY_NORMALIZED_INPUT[token] || "";
  }

  function getStoredIconValue(value) {
    return normalizeIconValue(value);
  }

  function getDisplayIconValue(value) {
    return normalizeIconValue(value) || FALLBACK_ICON;
  }

  function getIconOption(value) {
    const normalizedValue = normalizeIconValue(value);
    if (!normalizedValue) return null;
    return ICON_OPTION_BY_VALUE[normalizedValue] || null;
  }

  function getIconLabel(value) {
    return getIconOption(value)?.label || buildLabel(normalizeToken(value));
  }

  function getIconMeta(value) {
    const option = getIconOption(value);
    if (!option) return null;
    return {
      value: option.value,
      label: option.label,
      assetUrl: option.assetUrl,
      category: option.category,
      family: option.family,
      traits: [...option.traits]
    };
  }

  function getIconTraits(value) {
    return getIconMeta(value)?.traits || [];
  }

  function getIconFamily(value) {
    return getIconMeta(value)?.family || "";
  }

  function iconHasTrait(value, trait) {
    const normalizedTrait = normalizeToken(trait);
    if (!normalizedTrait) return false;
    return getIconTraits(value).some(candidate => normalizeToken(candidate) === normalizedTrait);
  }

  function getIconValuesForFamily(family) {
    const normalizedFamily = normalizeToken(family);
    if (!normalizedFamily) return [];
    return ICON_VALUES.filter(value => normalizeToken(getIconFamily(value)) === normalizedFamily);
  }

  function getIconAssetUrl(value, options = {}) {
    const normalizedValue = options.fallback === false
      ? normalizeIconValue(value)
      : getDisplayIconValue(value);
    if (!normalizedValue) return "";
    return `${ASSET_BASE_PATH}${normalizedValue}.svg`;
  }

  function getCategoryOptions() {
    return CATEGORY_OPTIONS.map(category => ({
      ...category,
      options: category.options
        .map(value => getIconOption(value))
        .filter(Boolean)
        .map(option => ({ ...option }))
    }));
  }

  function getIconOptions() {
    return ICON_OPTIONS.map(option => ({ ...option }));
  }

  window.CampaignPoiIcons = Object.freeze({
    ASSET_BASE_PATH,
    CATEGORY_OPTIONS,
    CATEGORY_DEFINITIONS,
    FALLBACK_ICON,
    ICON_METADATA,
    ICON_OPTIONS,
    getCategoryOptions,
    getDisplayIconValue,
    getIconAssetUrl,
    getIconFamily,
    getIconLabel,
    getIconMeta,
    getIconOption,
    getIconOptions,
    getIconTraits,
    getIconValuesForFamily,
    getStoredIconValue,
    iconHasTrait,
    normalizeIconValue
  });
})();
