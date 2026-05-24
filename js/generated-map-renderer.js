(function () {
  const TERRAIN_RULES = window.CampaignTerrainRules || {};
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
    ["wastes", "Wastes"],
    ["chaos", "Chaos"]
  ];
  const TERRAIN_FEATURE_LABELS = {
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

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 1.25;
  const ZOOM_STEPS = [0.25, 0.5, 0.85, 1.25];
  const REGION_LABEL_REFERENCE_ZOOM = 0.85;
  const COORD_LABEL_MIN_ZOOM = 0.6;
  const PAN_PADDING_RATIO = 0.45;
  const TERRAIN_CACHE_SCALE = 1.5;
  const FEATURE_IMAGE_SUPERSAMPLE = 3;
  const BULK_OVERLAY_LOADING_THRESHOLD = 10;
  const PATH_REVEAL_MIN_DURATION = 320;
  const PATH_REVEAL_MAX_DURATION = 820;
  const PATH_WOBBLE_BASE = 0.08;
  const PATH_WOBBLE_MAX = 0.22;
  const ROAD_WATER_CROSSING_MAX_ELEVATION_DELTA = 1;
  const STEEP_ROUTE_ELEVATION_DELTA = 2;
  const EXTREME_ROUTE_ELEVATION_DELTA = 3;
  const RIVER_FALLS_ELEVATION_DELTA = 2;
  const RIVER_FALLS_CHANCE = 58;
  const COASTAL_RIVER_FALLS_CHANCE = 18;
  const ROAD_WATER_PATH_COST = 8;
  const MAJOR_ROAD_WATER_PATH_COST = 10;
  const ROAD_IMPASSABLE_WATER_TERRAINS = new Set(["sea", "deep_sea"]);
  const ROUGH_PATH_BASE_TERRAINS = new Set(["rock", "barrens", "bleak_barrens", "wastes", "desert", "deep_desert"]);
  const ROUGH_PATH_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "ridges", "cliffs"]);
  const ROAD_PASS_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"]);
  const ROAD_PASS_RIDGE_BASE_TERRAINS = new Set(["rock", "snow", "barrens", "bleak_barrens", "wastes"]);
  const FEATURE_ASSET_PATH = "hex-mapper/assets/features/";
  const ROUTE_ICON_ASSET_PATH = "hex-mapper/assets/other/";
  const ROUTE_ICON_FILES = {
    road: "cart.svg",
    river: "barge.svg",
    sea_route: "ship.svg"
  };
  const EDGE_NAMES = ["E", "SE", "SW", "W", "NW", "NE"];
  const UNCLAIMED_REGION_REF = "REG-0000";
  const DRAWABLE_OVERLAY_TYPES = new Set(["road", "river", "sea_route", "path", "wall", "mist", "region", "unregion", "political-region", "clear-political-region", "erase", "terrain", "terrain-eyedropper", "feature", "feature-erase", "feature-eyedropper"]);
  const REGION_PAINT_TYPES = new Set(["region", "unregion", "political-region", "clear-political-region"]);
  const PATH_OVERLAY_TYPES = new Set(["road", "river", "sea_route", "path"]);
  const ALL_TERRAIN_FEATURES = Object.keys(TERRAIN_FEATURE_LABELS);
  const CHAOS_BASE_TERRAIN_OPTIONS = BASE_TERRAIN_OPTIONS
    .map(([base]) => base)
    .filter(base => base !== "chaos");
  const FEATURE_BRUSH_OPTIONS = [
    { id: "generated", label: "Generated Detail", mode: "generated" },
    { id: "vegetation", label: "Vegetation", features: ["woods", "forest", "jungle", "shrub", "kelp", "marsh", "cactus_scrub"] },
    { id: "highlands", label: "Highlands", features: ["ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"] },
    { id: "water", label: "Water Detail", features: ["waves", "shoals", "reef", "kelp", "water_rocks", "whirlpool", "rapids", "falls", "marsh", "ice"] },
    { id: "farmland", label: "Farmland", features: ["farmland"] },
    { id: "sand", label: "Sand", features: ["sand"] },
    { id: "chaos", label: "Chaos", features: ALL_TERRAIN_FEATURES, ignoreCompatibility: true }
  ];
  const FEATURE_BRUSH_NOTES = {
    farmland: "Farmland only paints on plains, grassland, and lush grassland.",
    sand: "Sand only paints on beaches, desert, and deep desert."
  };
  const EXCLUSIVE_TERRAIN_FEATURE_GROUPS = [
    ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"],
    ["woods", "forest"]
  ];
  const ROAD_STYLE_COLORS = {
    dark_brown: "#5b351c",
    tan: "#c99a5c"
  };
  const OVERLAY_STYLE_FLAG_SEPARATOR = "|";
  const OVERLAY_STYLE_FLAGS = {
    roadWaterOverride: "water_override",
    roadNoAutoPass: "no_auto_pass",
    riverNoAutoFalls: "no_auto_falls"
  };
  const MAP_EDIT_SECTION_COPY = {
    view: {
      title: "View",
      copy: "Toggle the map layers you want visible while you inspect the world."
    },
    terrain: {
      title: "Terrain",
      copy: "Paint base ground, elevation, and optional generated terrain detail."
    },
    features: {
      title: "Features",
      copy: "Brush compatible terrain features with density and noise."
    },
    overlay: {
      title: "Overlay",
      copy: "Draw roads, rivers, paths, walls, and mist on the generated map."
    },
    regions: {
      title: "Regions",
      copy: "Assign geographic and political regions without leaving the map."
    },
    nuke: {
      title: "Utilities",
      copy: "Manage map-wide actions like clearing generated map edits and future import/export tools."
    },
    generation: {
      title: "Generation",
      copy: "Run shared-rule passes now, with full natural terrain generation coming next."
    }
  };
  const RIVER_WATER_TERRAINS = new Set(["deep_sea", "sea", "coastal_water", "inland_water"]);
  const REGION_BORDER_COLORS = {
    red: "#ff2d2d",
    blue: "#1f7cff",
    yellow: "#ffe600",
    green: "#39ff14",
    orange: "#ff8a00",
    purple: "#bf4dff",
    black: "#070707",
    white: "#ffffff",
    brown: "#d9782d",
    gold: "#ffd84d"
  };
  const EVEN_Q_NEIGHBORS = {
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
  const WATER_TERRAINS = new Set(["deep_sea", "sea", "coastal_water", "inland_water"]);
  const LAND_TERRAINS = new Set(["beach", "plains", "grassland", "lush_grassland", "wetland", "jungle_floor", "desert", "deep_desert", "barrens", "bleak_barrens", "snow", "rock", "wastes"]);
  const HIGHLAND_TERRAINS = new Set(["rock", "snow"]);
  const COLD_TERRAINS = new Set(["snow"]);
  const HUMID_TERRAINS = new Set(["wetland", "lush_grassland", "jungle_floor"]);
  const FEATURE_ART_FILES = {
    cactus_scrub: "cactus_scrub.svg",
    cliffs: "cliffs.svg",
    reef: "coral.svg",
    falls: "falls.svg",
    farmland: "farmland.svg",
    ice: "ice.svg",
    kelp: "kelp.svg",
    lone_mountain: "lone_mountain.svg",
    marsh: "marsh.svg",
    mist: "mist.svg",
    mountains: "mountains.svg",
    snowcapped_mountains: "mountains_snow.svg",
    mountains_snow: "mountains_snow.svg",
    rapids: "rapids.svg",
    ridges: "ridges.svg",
    sand: "sand.svg",
    shoals: "shoals.svg",
    shrub: "shrub.svg",
    volcano: "volcano.svg",
    water_rocks: "water_rocks.svg",
    waves: "waves.svg",
    whirlpool: "whirlpool.svg"
  };
  const FEATURE_LAYER_BY_ID = {
    farmland: 10,
    sand: 10,
    waves: 10,
    shoals: 10,
    reef: 10,
    kelp: 10,
    ice: 20,
    ridges: 30,
    cliffs: 35,
    water_rocks: 35,
    lone_mountain: 40,
    mountains: 40,
    snowcapped_mountains: 40,
    volcano: 45,
    rapids: 60,
    falls: 60,
    whirlpool: 60,
    shrub: 80,
    cactus_scrub: 80,
    woods: 80,
    forest: 80,
    jungle: 80,
    marsh: 80,
    mist: 90
  };
  const FEATURE_ART_OPACITY = {
    farmland: 0.64,
    waves: 0.62,
    shoals: 0.60,
    reef: 0.60,
    kelp: 0.60,
    ice: 0.84,
    marsh: 0.64,
    ridges: 0.70,
    cliffs: 0.70,
    water_rocks: 0.70,
    lone_mountain: 0.72,
    mountains: 0.72,
    volcano: 0.78,
    shrub: 0.66,
    cactus_scrub: 0.68,
    woods: 0.70,
    forest: 0.70,
    jungle: 0.72,
    rapids: 0.66,
    falls: 0.70,
    whirlpool: 0.70,
    mist: 0.24
  };
  const BASE_FEATURE_TINTS = {
    deep_sea: { vegetation: "#7fb2c8", relief: "#6fa4b8", water: "#8eb8c8", surface: "#8eb8c8" },
    sea: { vegetation: "#1f5a45", relief: "#6f8790", water: "#8eb8c8", surface: "#8eb8c8" },
    coastal_water: { vegetation: "#1f5a45", relief: "#58747a", water: "#103f56", surface: "#103f56" },
    inland_water: { vegetation: "#245a45", relief: "#526a70", water: "#103f56", surface: "#103f56" },
    beach: { vegetation: "#6a6535", relief: "#735336", surface: "#7b6a48" },
    plains: { vegetation: "#3f5a32", relief: "#6f6336", surface: "#6f6336" },
    grassland: { vegetation: "#2f4f2f", relief: "#5d5638", surface: "#6f6336" },
    lush_grassland: { vegetation: "#255235", relief: "#465638", surface: "#496b3b" },
    wetland: { vegetation: "#234d43", relief: "#3f534a", surface: "#2f6254" },
    jungle_floor: { vegetation: "#155c38", relief: "#244a35", surface: "#1f5a45" },
    desert: { vegetation: "#5f6134", relief: "#735336", surface: "#8a693d" },
    deep_desert: { vegetation: "#5a5430", relief: "#68472f", surface: "#7b5636" },
    barrens: { vegetation: "#5b5a35", relief: "#6a4435", surface: "#754c3a" },
    bleak_barrens: { vegetation: "#514b34", relief: "#56352f", surface: "#664039" },
    snow: { vegetation: "#203f35", relief: "#68777c", surface: "#d8eef2" },
    rock: { vegetation: "#203f35", relief: "#4d463d", surface: "#5b5147" },
    wastes: { vegetation: "#40382f", relief: "#2b2020", surface: "#4b3030" }
  };
  const FEATURE_ART_ASSET_FILES = [...new Set([
    ...Object.values(FEATURE_ART_FILES),
    "forest_con.svg",
    "forest_dead.svg",
    "forest_dec.svg",
    "woods_con.svg",
    "woods_dead.svg",
    "woods_dec.svg",
    "jungle_temp_1.svg",
    "jungle_temp_2.svg",
    "jungle_trop_1.svg",
    "jungle_trop_2.svg"
  ])];
  const POI_GLYPHS = {
    settlement: "●",
    city: "◎",
    town: "●",
    village: "●",
    farm: "▦",
    castle: "♜",
    ruins: "✦",
    ruin: "✦",
    dungeon: "◆",
    lair: "▲",
    camp: "♢"
  };

  const renderer = {
    root: null,
    canvas: null,
    ctx: null,
    cacheCanvas: document.createElement("canvas"),
    cacheCtx: null,
    cacheDirty: true,
    featureAssets: new Map(),
    featureImages: new Map(),
    featureAssetsLoading: null,
    routeIconAssets: new Map(),
    routeIconAssetsLoading: null,
    poiHexIds: new Set(),
    poisByHexId: new Map(),
    mapOverlays: [],
    routeLabelCache: { key: "", labels: [] },
    svg: null,
    popup: null,
    loadingVeil: null,
    hexes: [],
    hexesByCoord: new Map(),
    campaignId: null,
    hoveredHexId: null,
    selectedHexId: null,
    view: {
      zoom: 1,
      panX: 0,
      panY: 0,
      width: 1,
      height: 1,
      dragging: false,
      dragMoved: false,
      lastX: 0,
      lastY: 0,
      zoomAnimationFrame: null,
      animatingZoom: false,
      wheelLockedUntil: 0,
      routeLabelsHiddenUntil: 0,
      routeLabelRestoreTimer: null,
      touchPointers: new Map(),
      pinching: false,
      pinchStartDistance: 0,
      pinchStartZoom: 1,
      pinchAnchorWorldX: 0,
      pinchAnchorWorldY: 0,
      suppressClickUntil: 0
    },
    drawing: {
      enabled: false,
      tool: "road",
      roadStyle: "dark_brown",
      roadWaterOverride: false,
      autoPass: true,
      autoFalls: true,
      roadRouteMajor: false,
      roadRouteName: "",
      riverRouteMajor: false,
      riverRouteName: "",
      seaRouteName: "",
      mistBrushSize: 1,
      mistNoise: 0,
      regionId: UNCLAIMED_REGION_REF,
      politicalRegionId: "",
      terrainBase: "plains",
      terrainFeatures: [],
      terrainElevation: "auto",
      terrainBrushSize: 1,
      terrainNoise: 0,
      terrainFeatureDensity: 50,
      terrainMaxFeatures: 1,
      terrainChaosEnabled: false,
      featureBrush: "generated",
      featureBrushSize: 1,
      featureNoise: 0,
      featureDensity: 50,
      featureMaxFeatures: 1,
      featureChaosEnabled: false,
      generationSeed: "",
      generationRegionStyle: "balanced",
      generationFeatureDensity: 100,
      generationMaxFeatures: 2,
      generationRefreshExisting: false,
      generationWater: 100,
      generationCoastalEdge: 0,
      generationIslands: 0,
      generationWetness: 100,
      generationHeat: 100,
      generationForest: 100,
      generationDesert: 100,
      generationMountains: 100,
      generationCompression: 100,
      generationContinuity: 100,
      generationRoadAmount: 100,
      generationRiverAmount: 100,
      generationRiverLength: 100,
      generationSection: "terrain",
      generationPreviewOriginals: new Map(),
      generationPreviewActions: [],
      undoStack: [],
      redoStack: [],
      visibleOverlays: {
        road: true,
        river: true,
        sea_route: true,
        path: true,
        wall: true,
        mist: true,
        geographic: false,
        political: true,
        geographicLabels: true,
        politicalLabels: true,
        features: true,
        pois: true
      },
      preEditVisibleOverlays: null,
      lastHexId: null,
      dragLastHexId: null,
      paintedThisDrag: new Set(),
      dragActionBatch: null,
      dragActionCommitTimer: null,
      activePathReveal: null,
      pathRevealFrame: null,
      pendingTerrainSaves: new Map(),
      terrainSaveRunning: false,
      terrainSaveErrorShown: false,
      saving: false,
      hoverEdge: null,
      hoverEraseHexId: null,
      hoverMistHexIds: [],
      hoverBrushHexIds: [],
      touchDrawPointerId: null,
      touchDrawTimer: null,
      touchDrawStartX: 0,
      touchDrawStartY: 0,
      touchDrawArmed: false
    }
  };

  function ensureMounted() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return false;

    if (renderer.root?.isConnected) return true;

    renderer.root = document.createElement("div");
    renderer.root.id = "generated-map-renderer";
    renderer.root.innerHTML = `
      <canvas class="generated-map-terrain-canvas"></canvas>
      <svg class="generated-map-grid-overlay" aria-hidden="true"></svg>
      <div class="generated-map-popup" hidden></div>
      <div class="generated-map-loading-veil" hidden>
        <div class="generated-map-loading-message">Map Loading...</div>
      </div>
    `;

    renderer.canvas = renderer.root.querySelector("canvas");
    renderer.ctx = renderer.canvas.getContext("2d");
    renderer.cacheCtx = renderer.cacheCanvas.getContext("2d");
    renderer.svg = renderer.root.querySelector("svg");
    renderer.popup = renderer.root.querySelector(".generated-map-popup");
    renderer.loadingVeil = renderer.root.querySelector(".generated-map-loading-veil");
    if (renderer.loadingVeil) {
      document.body.appendChild(renderer.loadingVeil);
    }
    ["click", "pointerdown", "pointermove", "pointerup", "wheel"].forEach(eventName => {
      renderer.popup.addEventListener(eventName, event => event.stopPropagation());
    });

    renderer.root.addEventListener("wheel", handleWheel, { passive: false });
    renderer.root.addEventListener("pointerdown", handlePointerDown);
    renderer.root.addEventListener("pointermove", handlePointerMove);
    renderer.root.addEventListener("pointerup", handlePointerUp);
    renderer.root.addEventListener("pointercancel", handlePointerCancel);
    renderer.root.addEventListener("pointerleave", clearEditorBrushHover);
    renderer.root.addEventListener("click", handleClick);
    renderer.root.addEventListener("contextmenu", event => event.preventDefault());
    setupDrawControls();
    window.addEventListener("resize", () => {
      if (!isActive()) return;
      clampView();
      render();
    });

    mapElement.appendChild(renderer.root);
    return true;
  }

  function setLoading(isLoading) {
    const veil = renderer.loadingVeil;
    if (!veil) return;
    veil.hidden = !isLoading;
    renderer.root?.classList.toggle("generated-map-is-loading", Boolean(isLoading));
  }

  function beginLoading() {
    setActive(true);
    setLoading(true);
  }

  function setActive(active) {
    if (!ensureMounted()) return;
    if (!active) setLoading(false);
    renderer.root.hidden = !active;
    document.getElementById("map")?.classList.toggle("generated-renderer-active", active);
    updateDrawControlsVisibility();
  }

  function isActive() {
    return Boolean(renderer.root && !renderer.root.hidden && isGeneratedMapCampaign?.());
  }

  function getHexId(hexRecord) {
    return hexRecord?.Map_XY || hexRecord?.Hex_ID || "";
  }

  function buildHexModel(hexRecord) {
    const parsed = parseMapHexId(getHexId(hexRecord));
    if (!parsed) return null;

    const dimensions = getGeneratedMapDimensions();
    const center = getPrototypeHexCenter(parsed.x, parsed.y, dimensions);
    const points = makeWorldHex(center.x, center.y, dimensions.radius, dimensions.hexHeight);

    return {
      record: hexRecord,
      id: hexRecord.Hex_ID,
      label: getHexId(hexRecord),
      x: parsed.x,
      y: parsed.y,
      baseTerrain: hexRecord.Base_Terrain,
      features: Array.isArray(hexRecord.Terrain_Features) ? hexRecord.Terrain_Features : [],
      regionId: hexRecord.Region_ID_Ref || "",
      politicalRegionId: hexRecord.Political_Region_ID_Ref || "",
      elevation: getHexElevation(hexRecord),
      center,
      points,
      fill: TERRAIN_COLORS[hexRecord.Base_Terrain] || "#7f7a66"
    };
  }

  function getHexElevation(hexRecord) {
    const stored = Number(hexRecord?.Elevation);
    return Number.isFinite(stored) ? stored : 0;
  }

  function groupPoisByHexId(pois) {
    const groups = new Map();
    pois.forEach(poi => {
      const hexId = poi.Hex_ID_Ref;
      if (!hexId) return;
      if (!groups.has(hexId)) groups.set(hexId, []);
      groups.get(hexId).push(poi);
    });
    return groups;
  }

  function getPrototypeHexCenter(x, y, dimensions) {
    return {
      x: 20 + dimensions.radius + (x * dimensions.radius * 1.5),
      y: 20 + (dimensions.hexHeight * 0.5) + (y * dimensions.hexHeight) + (x % 2 ? dimensions.hexHeight * 0.5 : 0)
    };
  }

  function makeWorldHex(centerX, centerY, radius, hexHeight) {
    return [
      { x: centerX + radius, y: centerY },
      { x: centerX + radius * 0.5, y: centerY + hexHeight * 0.5 },
      { x: centerX - radius * 0.5, y: centerY + hexHeight * 0.5 },
      { x: centerX - radius, y: centerY },
      { x: centerX - radius * 0.5, y: centerY - hexHeight * 0.5 },
      { x: centerX + radius * 0.5, y: centerY - hexHeight * 0.5 }
    ];
  }

  function renderFromDatabase() {
    const campaign = getActiveCampaign?.();
    if (!isGeneratedMapCampaign?.(campaign)) {
      resetEditorStateForCampaignSwitch(null);
      setActive(false);
      return;
    }

    setActive(true);
    resetEditorStateForCampaignSwitch(campaign?.id || null);
    const dimensions = getGeneratedMapDimensions();
    renderer.view.width = dimensions.width;
    renderer.view.height = dimensions.height;
    renderer.hexes = (db?.raw?.hexes || []).map(buildHexModel).filter(Boolean);
    renderer.hexesByCoord = new Map(renderer.hexes.map(hex => [`${hex.x}:${hex.y}`, hex]));
    renderer.poisByHexId = groupPoisByHexId(db?.raw?.pois || []);
    renderer.poiHexIds = new Set(renderer.poisByHexId.keys());
    renderer.mapOverlays = db?.raw?.generatedMapOverlays || [];
    renderer.cacheDirty = true;
    updateDrawClearButton();
    setLoading(true);
    populateDrawRegionSelect();
    updateDrawControlsVisibility();
    loadFeatureArtAssets();
    loadRouteIconAssets();
    fitViewToMap();
    render();
  }

  function refreshPoiLayerFromDatabase() {
    if (!isActive()) return;

    renderer.poisByHexId = groupPoisByHexId(db?.raw?.pois || []);
    renderer.poiHexIds = new Set(renderer.poisByHexId.keys());
    renderSvgOnly();
  }

  function refreshRegionLayerFromDatabase() {
    if (!isActive()) return;
    syncRenderedHexRegionsFromDatabase();
    populateDrawRegionSelect();
    renderSvgOnly();
  }

  function syncRenderedHexRegionsFromDatabase() {
    renderer.hexes.forEach(hex => {
      const source = db?.hexesById?.[hex.id];
      if (!source) return;
      hex.regionId = source.Region_ID_Ref || "";
      hex.politicalRegionId = source.Political_Region_ID_Ref || "";
      if (hex.record) {
        hex.record.Region_ID_Ref = hex.regionId;
        hex.record.Political_Region_ID_Ref = hex.politicalRegionId;
      }
    });
  }

  function refreshOverlayLayerFromDatabase() {
    if (!isActive()) return;
    renderer.mapOverlays = db?.raw?.generatedMapOverlays || [];
    renderer.cacheDirty = true;
    updateDrawClearButton();
    render();
  }

  function setupDrawControls() {
    const button = document.getElementById("map-draw-button");
    const panel = document.getElementById("map-draw-panel");
    const viewButton = document.getElementById("map-view-button");
    const viewPanel = document.getElementById("map-view-panel");
    const roadStyle = document.getElementById("map-draw-road-style");
    const roadWaterOverride = document.getElementById("map-road-water-override");
    const roadAutoPass = document.getElementById("map-road-auto-pass");
    const riverAutoFalls = document.getElementById("map-river-auto-falls");
    const routeMajor = document.getElementById("map-route-major");
    const routeName = document.getElementById("map-route-name");
    const namedRoutesButton = document.getElementById("map-named-routes-button");
    const namedRoutesClose = document.getElementById("map-named-routes-close");
    const namedRouteEditForm = document.getElementById("map-named-route-edit-form");
    const namedRouteCancel = document.getElementById("map-named-route-cancel");
    const mistBrushSize = document.getElementById("map-mist-brush-size");
    const mistNoise = document.getElementById("map-mist-noise");
    const regionSelect = document.getElementById("map-draw-region-select");
    const politicalRegionSelect = document.getElementById("map-draw-political-region-select");
    const geoRegionColor = document.getElementById("map-geo-region-color");
    const polRegionColor = document.getElementById("map-pol-region-color");
    const undoButton = document.getElementById("map-draw-undo");
    const redoButton = document.getElementById("map-draw-redo");
    const noToolButton = document.getElementById("map-draw-no-tool");
    const clearButton = document.getElementById("map-draw-clear");
    const clearGeoButton = document.getElementById("map-clear-geo-regions");
    const clearPolButton = document.getElementById("map-clear-pol-regions");
    const clearFeaturesButton = document.getElementById("map-clear-features");
    const addGeoRegionButton = document.getElementById("map-add-geo-region-button");
    const addPolRegionButton = document.getElementById("map-add-pol-region-button");
    const closeEditButton = document.getElementById("map-edit-close-button");
    const closeViewButton = document.getElementById("map-view-close-button");
    const collapseEditButton = document.getElementById("map-edit-collapse-button");
    const terrainElevationInput = document.getElementById("map-terrain-elevation");
    const terrainBrushSize = document.getElementById("map-terrain-brush-size");
    const terrainNoise = document.getElementById("map-terrain-noise");
    const terrainFeatureDensity = document.getElementById("map-terrain-feature-density");
    const terrainMaxFeatures = document.getElementById("map-terrain-max-features");
    const terrainChaosToggle = document.getElementById("map-terrain-chaos-toggle");
    const featureBrushSize = document.getElementById("map-feature-brush-size");
    const featureNoise = document.getElementById("map-feature-noise");
    const featureDensity = document.getElementById("map-feature-density");
    const featureMaxFeatures = document.getElementById("map-feature-max-features");
    const featureChaosToggle = document.getElementById("map-feature-chaos-toggle");
    const generationSeed = document.getElementById("map-generation-seed");
    const generationDensity = document.getElementById("map-generation-density");
    const generationMaxFeatures = document.getElementById("map-generation-max-features");
    const generationRefreshExisting = document.getElementById("map-generation-refresh-existing");
    const generationRunFeatures = document.getElementById("map-generation-run-features");
    const generationRunRoads = document.getElementById("map-generation-run-roads");
    const generationRunRivers = document.getElementById("map-generation-run-rivers");
    const generationResetSliders = document.getElementById("map-generation-reset-sliders");
    const generationPreviewTerrain = document.getElementById("map-generation-preview-terrain");
    const generationApplyPreview = document.getElementById("map-generation-apply-preview");
    const generationDiscardPreview = document.getElementById("map-generation-discard-preview");
    if (!button || !panel) return;

    viewButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const isOpening = viewPanel?.hidden;
      if (viewPanel) viewPanel.hidden = !isOpening;
      viewButton.classList.toggle("active", Boolean(isOpening));
      if (isOpening) {
        panel.hidden = true;
        button.classList.remove("active");
        renderer.drawing.enabled = false;
        restoreMapEditViewState();
        updateMapChromeForEdit(false);
        resetDrawingState();
        render();
      }
    });

    viewPanel?.addEventListener("click", event => event.stopPropagation());
    closeViewButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (viewPanel) viewPanel.hidden = true;
      viewButton?.classList.remove("active");
    });

    collapseEditButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleMapEditPaneCollapsed();
    });

    closeEditButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closeMapEditMode();
      render();
    });

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const isOpening = panel.hidden;
      panel.hidden = !isOpening;
      button.classList.toggle("active", isOpening);
      renderer.drawing.enabled = isOpening;
      updateMapChromeForEdit(isOpening);
      if (isOpening) {
        if (viewPanel) viewPanel.hidden = true;
        viewButton?.classList.remove("active");
        setMapEditSection("terrain");
        enterMapEditMode();
      }
      if (!isOpening) {
        restoreMapEditViewState();
        resetDrawingState();
      }
      updateDrawToolButtons();
      updateDrawRegionControls();
      updateDrawStyleControls();
      updateDrawHint();
      render();
    });

    panel.addEventListener("click", event => event.stopPropagation());
    panel.querySelectorAll("[data-map-edit-section-button]").forEach(sectionButton => {
      sectionButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const selectedSection = sectionButton.dataset.mapEditSectionButton || "overlay";
        const isActiveSection = sectionButton.classList.contains("active");
        if (isActiveSection && isMobileEditorLayout()) {
          toggleMapEditPaneCollapsed();
          return;
        }
        expandMapEditPane();
        setMapEditSection(selectedSection);
      });
    });

    panel.querySelectorAll("[data-terrain-mobile-tab]").forEach(tabButton => {
      tabButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setMobileTerrainTab(tabButton.dataset.terrainMobileTab || "tools");
      });
    });

    panel.querySelectorAll("[data-map-draw-tool]").forEach(toolButton => {
      toolButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setDrawTool(toolButton.dataset.mapDrawTool);
      });
    });

    document.querySelectorAll("[data-map-overlay-toggle]").forEach(toggle => {
      toggle.addEventListener("change", () => {
        const type = toggle.dataset.mapOverlayToggle;
        if (!type || !(type in renderer.drawing.visibleOverlays)) return;
        renderer.drawing.visibleOverlays[type] = toggle.checked;
        syncMapOverlayToggleInputs();
        renderer.cacheDirty = true;
        render();
      });
    });

    roadStyle?.addEventListener("change", () => {
      renderer.drawing.roadStyle = roadStyle.value || "dark_brown";
    });

    roadWaterOverride?.addEventListener("change", () => {
      renderer.drawing.roadWaterOverride = Boolean(roadWaterOverride.checked);
    });

    roadAutoPass?.addEventListener("change", () => {
      renderer.drawing.autoPass = roadAutoPass.checked !== false;
    });

    riverAutoFalls?.addEventListener("change", () => {
      renderer.drawing.autoFalls = riverAutoFalls.checked !== false;
    });

    routeMajor?.addEventListener("change", () => {
      setCurrentRouteMajor(Boolean(routeMajor.checked));
      updateDrawStyleControls();
    });

    routeName?.addEventListener("input", () => {
      setCurrentRouteName(routeName.value || "");
    });

    namedRoutesButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openNamedRoutesMenu();
    });

    namedRoutesClose?.addEventListener("click", event => {
      event.preventDefault();
      closeNamedRoutesMenu();
    });

    namedRouteCancel?.addEventListener("click", event => {
      event.preventDefault();
      clearNamedRouteEditForm();
    });

    namedRouteEditForm?.addEventListener("submit", event => {
      event.preventDefault();
      saveNamedRouteEdit();
    });

    document.addEventListener("pointerdown", event => {
      if (event.target === routeName) return;
      blurRouteNameInput();
    }, true);

    mistBrushSize?.addEventListener("input", () => {
      renderer.drawing.mistBrushSize = clampNumber(Number(mistBrushSize.value), 1, 5, 1);
      updateDrawStyleControls();
      refreshMistBrushPreview();
      renderSvgOnly();
    });

    mistNoise?.addEventListener("input", () => {
      renderer.drawing.mistNoise = clampNumber(Number(mistNoise.value), 0, 90, 0);
      updateDrawStyleControls();
      refreshMistBrushPreview();
      renderSvgOnly();
    });

    terrainElevationInput?.addEventListener("input", () => {
      const elevation = Number(terrainElevationInput.value);
      renderer.drawing.terrainElevation = elevation <= -3 ? "auto" : elevation >= 6 ? "chaos" : Number.isFinite(elevation) ? Math.round(elevation) : "auto";
      updateTerrainControls();
    });

    terrainBrushSize?.addEventListener("input", () => {
      renderer.drawing.terrainBrushSize = getChaosSliderValue(terrainBrushSize.value, 6, 1, 5, 1);
      updateTerrainControls();
      refreshEditorBrushPreview();
      renderSvgOnly();
    });

    terrainNoise?.addEventListener("input", () => {
      renderer.drawing.terrainNoise = getChaosSliderValue(terrainNoise.value, 95, 0, 90, 0);
      updateTerrainControls();
      refreshEditorBrushPreview();
      renderSvgOnly();
    });

    terrainFeatureDensity?.addEventListener("input", () => {
      renderer.drawing.terrainFeatureDensity = getChaosSliderValue(terrainFeatureDensity.value, 105, 5, 100, 50);
      updateTerrainControls();
    });

    terrainMaxFeatures?.addEventListener("input", () => {
      renderer.drawing.terrainMaxFeatures = getChaosSliderValue(terrainMaxFeatures.value, 3, 0, 2, 1);
      updateTerrainControls();
    });

    terrainChaosToggle?.addEventListener("change", () => {
      setTerrainChaosEnabled(Boolean(terrainChaosToggle.checked));
    });

    featureBrushSize?.addEventListener("input", () => {
      renderer.drawing.featureBrushSize = getChaosSliderValue(featureBrushSize.value, 6, 1, 5, 1);
      updateTerrainControls();
      refreshEditorBrushPreview();
      renderSvgOnly();
    });

    featureNoise?.addEventListener("input", () => {
      renderer.drawing.featureNoise = getChaosSliderValue(featureNoise.value, 95, 0, 90, 0);
      updateTerrainControls();
      refreshEditorBrushPreview();
      renderSvgOnly();
    });

    featureDensity?.addEventListener("input", () => {
      renderer.drawing.featureDensity = getChaosSliderValue(featureDensity.value, 105, 5, 100, 50);
      updateTerrainControls();
    });

    featureMaxFeatures?.addEventListener("input", () => {
      renderer.drawing.featureMaxFeatures = getChaosSliderValue(featureMaxFeatures.value, 3, 0, 2, 1);
      updateTerrainControls();
    });

    featureChaosToggle?.addEventListener("change", () => {
      setFeatureChaosEnabled(Boolean(featureChaosToggle.checked));
    });

    generationSeed?.addEventListener("input", () => {
      renderer.drawing.generationSeed = String(generationSeed.value || "").slice(0, 80);
      updateGenerationControls();
    });

    generationDensity?.addEventListener("input", () => {
      renderer.drawing.generationFeatureDensity = clampNumber(Number(generationDensity.value), 50, 165, 100);
      updateGenerationControls();
    });

    generationMaxFeatures?.addEventListener("input", () => {
      renderer.drawing.generationMaxFeatures = clampNumber(Number(generationMaxFeatures.value), 0, 2, 2);
      updateGenerationControls();
    });

    generationRefreshExisting?.addEventListener("change", () => {
      renderer.drawing.generationRefreshExisting = Boolean(generationRefreshExisting.checked);
      updateGenerationControls();
    });

    const generationRegionStyle = document.getElementById("map-generation-region-style");
    generationRegionStyle?.addEventListener("change", () => {
      renderer.drawing.generationRegionStyle = generationRegionStyle.value || "balanced";
      updateGenerationControls();
    });

    generationRunFeatures?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      runGenerationFeaturePass();
    });

    generationRunRoads?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      runGenerationRoadPass();
    });

    generationRunRivers?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      runGenerationRiverPass();
    });

    panel.querySelectorAll("[data-generation-section-button]").forEach(sectionButton => {
      sectionButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setGenerationSection(sectionButton.dataset.generationSectionButton || "terrain");
      });
    });

    generationResetSliders?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      resetGenerationTerrainSliders();
    });

    panel.querySelectorAll("[data-generation-random-seed]").forEach(seedButton => {
      seedButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        randomizeGenerationSeed();
      });
    });

    panel.querySelectorAll("[data-generation-discard-section]").forEach(discardButton => {
      discardButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        discardGenerationPreviewSection(discardButton.dataset.generationDiscardSection || "");
      });
    });

    [
      ["map-generation-water", "generationWater"],
      ["map-generation-coastal-edge", "generationCoastalEdge"],
      ["map-generation-islands", "generationIslands"],
      ["map-generation-wetness", "generationWetness"],
      ["map-generation-heat", "generationHeat"],
      ["map-generation-forest", "generationForest"],
      ["map-generation-desert", "generationDesert"],
      ["map-generation-mountains", "generationMountains"],
      ["map-generation-compression", "generationCompression"],
      ["map-generation-continuity", "generationContinuity"],
      ["map-generation-road", "generationRoadAmount"],
      ["map-generation-river", "generationRiverAmount"],
      ["map-generation-river-length", "generationRiverLength"]
    ].forEach(([inputId, drawingKey]) => {
      const input = document.getElementById(inputId);
      input?.addEventListener("input", () => {
        renderer.drawing[drawingKey] = clampNumber(Number(input.value), 0, 200, 100);
        updateGenerationControls();
      });
    });

    generationPreviewTerrain?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      previewGeneratedTerrain();
    });

    generationApplyPreview?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      applyGeneratedTerrainPreview();
    });

    generationDiscardPreview?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      discardGeneratedTerrainPreview();
    });

    regionSelect?.addEventListener("change", () => {
      renderer.drawing.regionId = regionSelect.value || UNCLAIMED_REGION_REF;
      syncRegionColorInputs();
    });

    politicalRegionSelect?.addEventListener("change", () => {
      renderer.drawing.politicalRegionId = politicalRegionSelect.value || "";
      syncRegionColorInputs();
    });

    geoRegionColor?.addEventListener("change", event => {
      saveSelectedRegionColor("geographic", event.target.value);
    });

    polRegionColor?.addEventListener("change", event => {
      saveSelectedRegionColor("political", event.target.value);
    });

    geoRegionColor?.closest(".map-region-color-control")?.querySelector("[data-color-picker-trigger]")
      ?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        window.openColorPickerForInput?.(geoRegionColor, event.currentTarget);
      });

    polRegionColor?.closest(".map-region-color-control")?.querySelector("[data-color-picker-trigger]")
      ?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        window.openColorPickerForInput?.(polRegionColor, event.currentTarget);
      });

    undoButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      undoLastDrawAction();
    });

    redoButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      redoLastDrawAction();
    });

    noToolButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearDrawTool();
    });

    document.addEventListener("keydown", event => {
      if (!renderer.drawing.enabled || renderer.drawing.saving) return;
      if (event.key === "Escape") {
        if (handleEditorEscapeKey()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        undoLastDrawAction();
      } else if (key === "y") {
        event.preventDefault();
        redoLastDrawAction();
      }
    });

    clearButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearAllDrawnOverlays();
    });

    clearGeoButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearAllGeneratedRegions("geographic");
    });

    clearPolButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearAllGeneratedRegions("political");
    });

    clearFeaturesButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearAllGeneratedFeatures();
    });

    addGeoRegionButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openQuickRegionCreator("geographic");
    });

    addPolRegionButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openQuickRegionCreator("political");
    });

    updateDrawToolButtons();
    populateDrawRegionSelect();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
    syncMapOverlayToggleInputs();
    populateTerrainControls();
    updateGenerationControls();
    updateMapEditSectionHeader("overlay");
    updateDrawHint();
    updateDrawControlsVisibility();
  }

  function closeMapEditMode() {
    discardGeneratedTerrainPreview({ silent: true });
    const button = document.getElementById("map-draw-button");
    const panel = document.getElementById("map-draw-panel");
    const viewPanel = document.getElementById("map-view-panel");
    if (panel) panel.hidden = true;
    if (viewPanel) viewPanel.hidden = true;
    panel?.classList.remove("map-edit-left-collapsed");
    const collapseEditButton = document.getElementById("map-edit-collapse-button");
    if (collapseEditButton) {
      collapseEditButton.textContent = "Collapse";
      collapseEditButton.setAttribute("aria-expanded", "true");
    }
    button?.classList.remove("active");
    renderer.drawing.enabled = false;
    restoreMapEditViewState();
    updateMapChromeForEdit(false);
    resetDrawingState();
  }

  function expandMapEditPane() {
    const panel = document.getElementById("map-draw-panel");
    panel?.classList.remove("map-edit-left-collapsed");
    syncMapEditCollapseButton();
  }

  function toggleMapEditPaneCollapsed() {
    const panel = document.getElementById("map-draw-panel");
    if (!panel) return;
    panel.classList.toggle("map-edit-left-collapsed");
    syncMapEditCollapseButton();
  }

  function syncMapEditCollapseButton() {
    const panel = document.getElementById("map-draw-panel");
    const collapseEditButton = document.getElementById("map-edit-collapse-button");
    const isCollapsed = panel?.classList.contains("map-edit-left-collapsed") || false;
    if (collapseEditButton) {
      collapseEditButton.textContent = isCollapsed ? "Expand" : "Collapse";
      collapseEditButton.setAttribute("aria-expanded", String(!isCollapsed));
    }
  }

  function setMapEditSection(section) {
    const normalized = ["view", "terrain", "features", "overlay", "regions", "nuke", "generation"].includes(section) ? section : "overlay";
    renderer.drawing.tool = "";
    resetDrawingState();
    document.querySelectorAll("[data-map-edit-section]").forEach(sectionPane => {
      sectionPane.classList.toggle("active", sectionPane.dataset.mapEditSection === normalized);
    });
    document.querySelectorAll("[data-map-edit-section-button]").forEach(sectionButton => {
      sectionButton.classList.toggle("active", sectionButton.dataset.mapEditSectionButton === normalized);
    });
    updateMapEditSectionHeader(normalized);
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateDrawHint();
    updateGenerationPopout();
    if (normalized === "terrain") setMobileTerrainTab("tools");
    if (normalized === "generation") setGenerationSection(renderer.drawing.generationSection || "terrain");
  }

  function setGenerationSection(section) {
    const normalized = ["terrain", "features", "overlays"].includes(section) ? section : "terrain";
    renderer.drawing.generationSection = normalized;
    document.querySelectorAll("[data-generation-section]").forEach(sectionPane => {
      sectionPane.classList.toggle("active", sectionPane.dataset.generationSection === normalized);
    });
    document.querySelectorAll("[data-generation-section-button]").forEach(sectionButton => {
      sectionButton.classList.toggle("active", sectionButton.dataset.generationSectionButton === normalized);
    });
    document.querySelectorAll("[data-generation-action-panel]").forEach(actionPanel => {
      actionPanel.classList.toggle("active", actionPanel.dataset.generationActionPanel === normalized);
    });
    updateGenerationPopout();
    updateDrawHint();
  }

  function updateGenerationPopout() {
    const popout = document.querySelector(".map-generation-popout");
    const isGenerationActive = document.querySelector('[data-map-edit-section="generation"]')?.classList.contains("active");
    if (popout) popout.hidden = !isGenerationActive;
  }

  function setMobileTerrainTab(tab) {
    const normalized = ["tools", "base", "features", "elevation"].includes(tab) ? tab : "tools";
    const terrainSection = document.querySelector('[data-map-edit-section="terrain"]');
    if (!terrainSection) return;
    ["tools", "base", "elevation"].forEach(name => {
      terrainSection.classList.toggle(`mobile-terrain-tab-${name}`, name === normalized);
    });
    terrainSection.querySelectorAll("[data-terrain-mobile-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.terrainMobileTab === normalized);
    });
  }

  function isMobileEditorLayout() {
    return window.matchMedia?.("(max-width: 520px), (max-height: 560px)")?.matches || false;
  }

  function updateMapEditSectionHeader(section) {
    const meta = MAP_EDIT_SECTION_COPY[section] || MAP_EDIT_SECTION_COPY.overlay;
    const heading = document.getElementById("map-edit-section-heading");
    const copy = document.getElementById("map-edit-section-copy");
    if (heading) heading.textContent = meta.title;
    if (copy) copy.textContent = meta.copy;
  }

  function updateMapChromeForEdit(isEditing) {
    const canView = isActive();
    const canDraw = canCurrentUserShapeWorld();
    document.getElementById("codex-button")?.toggleAttribute("hidden", Boolean(isEditing));
    document.getElementById("map-reset-button")?.toggleAttribute("hidden", Boolean(isEditing));
    document.getElementById("map-view-button")?.toggleAttribute("hidden", Boolean(isEditing || !canView));
    document.getElementById("map-draw-button")?.toggleAttribute("hidden", Boolean(isEditing || !canDraw));
  }

  function canCurrentUserShapeWorld() {
    return isActive() && ["owner", "superuser"].includes(getActiveCampaign?.()?.currentUserRole || "");
  }

  function syncMapOverlayToggleInputs() {
    document.querySelectorAll("[data-map-overlay-toggle]").forEach(toggle => {
      const type = toggle.dataset.mapOverlayToggle;
      if (!type || !(type in renderer.drawing.visibleOverlays)) return;
      toggle.checked = Boolean(renderer.drawing.visibleOverlays[type]);
    });
  }

  function enterMapEditMode() {
    if (!renderer.drawing.preEditVisibleOverlays) {
      renderer.drawing.preEditVisibleOverlays = { ...renderer.drawing.visibleOverlays };
    }

    Object.keys(renderer.drawing.visibleOverlays).forEach(type => {
      renderer.drawing.visibleOverlays[type] = true;
    });
    syncMapOverlayToggleInputs();
    renderer.cacheDirty = true;
  }

  function restoreMapEditViewState() {
    if (!renderer.drawing.preEditVisibleOverlays) return;

    renderer.drawing.visibleOverlays = { ...renderer.drawing.preEditVisibleOverlays };
    renderer.drawing.preEditVisibleOverlays = null;
    syncMapOverlayToggleInputs();
    renderer.cacheDirty = true;
  }

  function updateDrawControlsVisibility() {
    const viewButton = document.getElementById("map-view-button");
    const viewPanel = document.getElementById("map-view-panel");
    const button = document.getElementById("map-draw-button");
    const panel = document.getElementById("map-draw-panel");
    const canView = isActive();
    const canDraw = canCurrentUserShapeWorld();

    if (viewButton) viewButton.hidden = !canView;
    if (!canView) {
      if (viewPanel) viewPanel.hidden = true;
      viewButton?.classList.remove("active");
    }

    if (button) button.hidden = !canDraw;
    if (!canDraw) {
      if (panel) panel.hidden = true;
      renderer.drawing.enabled = false;
      button?.classList.remove("active");
      restoreMapEditViewState();
      updateMapChromeForEdit(false);
      resetDrawingState();
    }
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
  }

  function setDrawTool(tool) {
    if (!DRAWABLE_OVERLAY_TYPES.has(tool)) return;
    renderer.drawing.tool = renderer.drawing.tool === tool ? "" : tool;
    resetDrawingState();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateDrawHint();
    renderSvgOnly();
  }

  function clearDrawTool() {
    renderer.drawing.tool = "";
    resetDrawingState();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateDrawHint();
    renderSvgOnly();
  }

  function handleEditorEscapeKey() {
    if (closeTopEditorSurface()) return true;
    if (!renderer.drawing.tool) return false;
    clearDrawTool();
    return true;
  }

  function closeTopEditorSurface() {
    const namedRoutesMenu = document.getElementById("map-named-routes-menu");
    if (namedRoutesMenu && !namedRoutesMenu.classList.contains("hidden")) {
      closeNamedRoutesMenu();
      return true;
    }

    if (renderer.popup && !renderer.popup.hidden) {
      clearSelection();
      selectedHexId = null;
      return true;
    }

    return false;
  }

  function resetDrawingState() {
    clearPendingDrawingState();
  }

  function clearPendingDrawingState({ commitBatch = true } = {}) {
    clearTouchDrawIntent();
    if (commitBatch) {
      commitDragActionBatch();
    } else {
      if (renderer.drawing.dragActionCommitTimer) {
        window.clearTimeout(renderer.drawing.dragActionCommitTimer);
      }
      renderer.drawing.dragActionCommitTimer = null;
      renderer.drawing.dragActionBatch = null;
    }
    renderer.drawing.lastHexId = null;
    renderer.drawing.dragLastHexId = null;
    renderer.drawing.paintedThisDrag = new Set();
    renderer.drawing.hoverEdge = null;
    renderer.drawing.hoverEraseHexId = null;
    renderer.drawing.hoverMistHexIds = [];
    renderer.drawing.hoverBrushHexIds = [];
    clearPathRevealAnimation();
  }

  function resetEditorStateForCampaignSwitch(nextCampaignId) {
    const normalizedCampaignId = nextCampaignId || null;
    if (renderer.campaignId === normalizedCampaignId) return;

    renderer.campaignId = normalizedCampaignId;
    renderer.drawing.enabled = false;
    renderer.drawing.tool = "";
    renderer.drawing.roadStyle = "dark_brown";
    renderer.drawing.roadWaterOverride = false;
    renderer.drawing.autoPass = true;
    renderer.drawing.autoFalls = true;
    renderer.drawing.roadRouteMajor = false;
    renderer.drawing.roadRouteName = "";
    renderer.drawing.riverRouteMajor = false;
    renderer.drawing.riverRouteName = "";
    renderer.drawing.seaRouteName = "";
    renderer.drawing.mistBrushSize = 1;
    renderer.drawing.mistNoise = 0;
    renderer.drawing.regionId = UNCLAIMED_REGION_REF;
    renderer.drawing.politicalRegionId = "";
    renderer.drawing.terrainBase = "plains";
    renderer.drawing.terrainFeatures = [];
    renderer.drawing.terrainElevation = "auto";
    renderer.drawing.terrainBrushSize = 1;
    renderer.drawing.terrainNoise = 0;
    renderer.drawing.terrainFeatureDensity = 50;
    renderer.drawing.terrainMaxFeatures = 1;
    renderer.drawing.terrainChaosEnabled = false;
    renderer.drawing.featureBrush = "generated";
    renderer.drawing.featureBrushSize = 1;
    renderer.drawing.featureNoise = 0;
    renderer.drawing.featureDensity = 50;
    renderer.drawing.featureMaxFeatures = 1;
    renderer.drawing.featureChaosEnabled = false;
    renderer.drawing.generationSeed = "";
    renderer.drawing.generationRegionStyle = "balanced";
    renderer.drawing.generationFeatureDensity = 100;
    renderer.drawing.generationMaxFeatures = 2;
    renderer.drawing.generationRefreshExisting = false;
    renderer.drawing.generationWater = 100;
    renderer.drawing.generationCoastalEdge = 0;
    renderer.drawing.generationIslands = 0;
    renderer.drawing.generationWetness = 100;
    renderer.drawing.generationHeat = 100;
    renderer.drawing.generationForest = 100;
    renderer.drawing.generationDesert = 100;
    renderer.drawing.generationMountains = 100;
    renderer.drawing.generationCompression = 100;
    renderer.drawing.generationContinuity = 100;
    renderer.drawing.generationPreviewOriginals.clear();
    renderer.drawing.generationPreviewActions = [];
    renderer.drawing.undoStack = [];
    renderer.drawing.redoStack = [];
    renderer.drawing.visibleOverlays = getDefaultVisibleOverlays();
    renderer.drawing.preEditVisibleOverlays = null;
    renderer.routeLabelCache = { key: "", labels: [] };
    renderer.drawing.pendingTerrainSaves.clear();
    renderer.drawing.terrainSaveRunning = false;
    renderer.drawing.terrainSaveErrorShown = false;
    renderer.drawing.saving = false;
    closeNamedRoutesMenu();
    clearPendingDrawingState({ commitBatch: false });
    cancelZoomAnimation();
    clearRouteLabelRestoreTimer();
    renderer.view.touchPointers.clear();
    renderer.view.pinching = false;
    renderer.view.dragging = false;
    renderer.view.dragMoved = false;
    renderer.view.routeLabelsHiddenUntil = 0;
    renderer.hoveredHexId = null;
    renderer.selectedHexId = null;
    selectedHexId = null;
    if (renderer.popup) {
      renderer.popup.hidden = true;
      renderer.popup.innerHTML = "";
    }

    const drawButton = document.getElementById("map-draw-button");
    const drawPanel = document.getElementById("map-draw-panel");
    const viewButton = document.getElementById("map-view-button");
    const viewPanel = document.getElementById("map-view-panel");
    if (drawPanel) {
      drawPanel.hidden = true;
      drawPanel.classList.remove("map-edit-left-collapsed");
    }
    if (viewPanel) viewPanel.hidden = true;
    drawButton?.classList.remove("active");
    viewButton?.classList.remove("active");
    updateMapChromeForEdit(false);
    syncMapEditCollapseButton();
    syncMapOverlayToggleInputs();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateTerrainControls();
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
    updateGenerationControls();
    updateDrawHint();
  }

  function getDefaultVisibleOverlays() {
    return {
      road: true,
      river: true,
      sea_route: true,
      path: true,
      wall: true,
      mist: true,
      geographic: false,
      political: true,
      geographicLabels: true,
      politicalLabels: true,
      features: true,
      pois: true
    };
  }

  function clearPathRevealAnimation() {
    const reveal = renderer.drawing.activePathReveal;
    if (renderer.drawing.pathRevealFrame) {
      window.cancelAnimationFrame(renderer.drawing.pathRevealFrame);
    }
    renderer.drawing.pathRevealFrame = null;
    renderer.drawing.activePathReveal = null;
    reveal?.resolve?.();
  }

  function clearTouchDrawIntent() {
    if (renderer.drawing.touchDrawTimer) {
      window.clearTimeout(renderer.drawing.touchDrawTimer);
    }
    renderer.drawing.touchDrawTimer = null;
    renderer.drawing.touchDrawPointerId = null;
    renderer.drawing.touchDrawArmed = false;
  }

  function beginTouchDrawIntent(event) {
    clearTouchDrawIntent();
    if (!renderer.drawing.enabled || !renderer.drawing.tool || event.pointerType !== "touch") return;

    renderer.drawing.touchDrawPointerId = event.pointerId;
    renderer.drawing.touchDrawStartX = event.clientX;
    renderer.drawing.touchDrawStartY = event.clientY;
    renderer.drawing.touchDrawTimer = window.setTimeout(() => {
      if (!renderer.drawing.enabled || renderer.drawing.touchDrawPointerId !== event.pointerId || renderer.view.pinching) return;
      renderer.drawing.touchDrawArmed = true;
      renderer.drawing.touchDrawTimer = null;
      renderer.view.dragging = false;
      renderer.view.dragMoved = true;
      renderer.view.suppressClickUntil = performance.now() + 450;
      renderer.drawing.paintedThisDrag = new Set();
      beginDragActionBatch();
      applyDrawingAtEvent(event);
    }, 420);
  }

  function cancelTouchDrawIntentOnMove(event) {
    if (event.pointerId !== renderer.drawing.touchDrawPointerId || !renderer.drawing.touchDrawTimer) return;
    const moved = Math.hypot(
      event.clientX - renderer.drawing.touchDrawStartX,
      event.clientY - renderer.drawing.touchDrawStartY
    );
    if (moved > 10) clearTouchDrawIntent();
  }

  function beginDragActionBatch() {
    if (renderer.drawing.dragActionCommitTimer) {
      window.clearTimeout(renderer.drawing.dragActionCommitTimer);
      renderer.drawing.dragActionCommitTimer = null;
    }
    if (!renderer.drawing.dragActionBatch) {
      renderer.drawing.dragActionBatch = { type: "batch", actions: [] };
    }
  }

  function scheduleDragActionBatchCommit() {
    if (renderer.drawing.dragActionCommitTimer) {
      window.clearTimeout(renderer.drawing.dragActionCommitTimer);
    }
    renderer.drawing.dragActionCommitTimer = window.setTimeout(commitDragActionBatch, 180);
  }

  function commitDragActionBatch() {
    if (renderer.drawing.dragActionCommitTimer) {
      window.clearTimeout(renderer.drawing.dragActionCommitTimer);
      renderer.drawing.dragActionCommitTimer = null;
    }
    const batch = renderer.drawing.dragActionBatch;
    renderer.drawing.dragActionBatch = null;
    if (!batch?.actions?.length) return;
    pushMapEditAction(batch.actions.length === 1 ? batch.actions[0] : batch, { force: true });
  }

  function updateDrawToolButtons() {
    document.querySelectorAll("[data-map-draw-tool]").forEach(button => {
      button.classList.toggle("active", button.dataset.mapDrawTool === renderer.drawing.tool);
    });
    document.getElementById("map-draw-no-tool")?.classList.toggle("active", !renderer.drawing.tool);
  }

  function updateDrawRegionControls() {
    const row = document.querySelector(".map-draw-region-row");
    const politicalRow = document.querySelector(".map-draw-political-region-row");
    if (row) row.hidden = renderer.drawing.tool !== "region";
    if (politicalRow) politicalRow.hidden = renderer.drawing.tool !== "political-region";
    syncRegionColorInputs();
  }

  function syncRegionColorInputs() {
    syncRegionColorInput("map-geo-region-color", renderer.drawing.regionId);
    syncRegionColorInput("map-pol-region-color", renderer.drawing.politicalRegionId);
  }

  function syncRegionColorInput(inputId, regionId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const region = db?.regionsById?.[regionId];
    input.value = getColorInputValue(region?.Border_Color);
    input.disabled = !region || region.Region_ID === UNCLAIMED_REGION_REF;
    input.title = input.disabled
      ? "Select a saved region first."
      : `Change ${region.Region_Name || region.Region_ID || "region"} color`;
    window.syncColorPickerControl?.(input);
  }

  function getColorInputValue(value) {
    return window.normalizeHexColor?.(value, "#ffd84d") || "#ffd84d";
  }

  async function saveSelectedRegionColor(regionType, color) {
    const campaign = getActiveCampaign?.();
    const normalizedType = regionType === "political" ? "political" : "geographic";
    const regionId = normalizedType === "political"
      ? renderer.drawing.politicalRegionId
      : renderer.drawing.regionId;
    const region = db?.regionsById?.[regionId];
    const regionUuid = region?.__uuid || region?.id;
    const nextColor = getColorInputValue(color);

    if (!campaign?.id || !regionUuid || region.Region_ID === UNCLAIMED_REGION_REF) {
      syncRegionColorInputs();
      return;
    }

    const previousColor = region.Border_Color;
    region.Border_Color = nextColor;
    renderSvgOnly();

    try {
      const { data, error } = await campaignSupabase.rpc("update_region_record", {
        target_campaign_id: campaign.id,
        target_region_id: regionUuid,
        region_lore: region.Lore || null,
        region_border_color: nextColor,
        new_region_type: region.Region_Type || normalizedType
      });

      if (error) throw error;

      const updated = Array.isArray(data) ? data[0] : data;
      region.Border_Color = updated?.border_color || nextColor;
      region.Region_Type = updated?.region_type || region.Region_Type || normalizedType;
      region.Lore = updated?.lore || region.Lore || "";
      populateDrawRegionSelect();
      renderSvgOnly();
    } catch (error) {
      console.error("Failed to update region color:", error);
      region.Border_Color = previousColor;
      syncRegionColorInputs();
      renderSvgOnly();
      window.alert?.(error.message || "Unable to update region color.");
    }
  }

  function openQuickRegionCreator(regionType) {
    const normalizedType = regionType === "political" ? "political" : "geographic";
    if (typeof window.openAddRegionEditor !== "function") {
      window.alert?.("Region creation is unavailable. Try opening the Codex and adding a region there.");
      return;
    }

    window.openAddRegionEditor({
      regionType: normalizedType,
      lockType: true,
      quick: true,
      onCreated: region => {
        selectDrawRegion(normalizedType, region?.Region_ID || "");
      }
    });
  }

  function selectDrawRegion(regionType, regionId) {
    const normalizedType = regionType === "political" ? "political" : "geographic";
    if (!regionId) return;

    populateDrawRegionSelect();
    if (normalizedType === "political") {
      renderer.drawing.politicalRegionId = regionId;
      const select = document.getElementById("map-draw-political-region-select");
      if (select) select.value = regionId;
      renderer.drawing.tool = "political-region";
    } else {
      renderer.drawing.regionId = regionId;
      const select = document.getElementById("map-draw-region-select");
      if (select) select.value = regionId;
      renderer.drawing.tool = "region";
    }
    resetDrawingState();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    updateDrawHint();
  }

  function updateDrawStyleControls() {
    const styleRow = document.querySelector(".map-draw-style-row");
    const styleLabel = document.getElementById("map-draw-style-label");
    const roadOverrideRow = document.getElementById("map-road-water-override-row");
    const roadOverrideInput = document.getElementById("map-road-water-override");
    const autoPassRow = document.getElementById("map-road-auto-pass-row");
    const autoPassInput = document.getElementById("map-road-auto-pass");
    const autoFallsRow = document.getElementById("map-river-auto-falls-row");
    const autoFallsInput = document.getElementById("map-river-auto-falls");
    const routeMajorRow = document.getElementById("map-route-major-row");
    const routeMajorInput = document.getElementById("map-route-major");
    const routeNameRow = document.getElementById("map-route-name-row");
    const routeNameInput = document.getElementById("map-route-name");
    const mistBrushRow = document.getElementById("map-mist-brush-size-row");
    const mistBrushInput = document.getElementById("map-mist-brush-size");
    const mistBrushValue = document.getElementById("map-mist-brush-size-value");
    const mistNoiseRow = document.getElementById("map-mist-noise-row");
    const mistNoiseInput = document.getElementById("map-mist-noise");
    const mistNoiseValue = document.getElementById("map-mist-noise-value");
    if (styleRow) styleRow.hidden = !["road", "path"].includes(renderer.drawing.tool);
    if (styleLabel) styleLabel.textContent = renderer.drawing.tool === "path" ? "Path Style" : "Road Style";
    if (roadOverrideRow) roadOverrideRow.hidden = renderer.drawing.tool !== "road";
    if (roadOverrideInput) roadOverrideInput.checked = Boolean(renderer.drawing.roadWaterOverride);
    if (autoPassRow) autoPassRow.hidden = renderer.drawing.tool !== "road";
    if (autoPassInput) autoPassInput.checked = renderer.drawing.autoPass !== false;
    if (autoFallsRow) autoFallsRow.hidden = renderer.drawing.tool !== "river";
    if (autoFallsInput) autoFallsInput.checked = renderer.drawing.autoFalls !== false;
    const isNamedRouteTool = ["road", "river", "sea_route"].includes(renderer.drawing.tool);
    const hasMajorToggle = ["road", "river"].includes(renderer.drawing.tool);
    const currentRouteMajor = getCurrentRouteMajor();
    const currentRouteName = getCurrentRouteName();
    if (routeMajorRow) routeMajorRow.hidden = !hasMajorToggle;
    if (routeMajorInput) routeMajorInput.checked = Boolean(currentRouteMajor);
    if (routeNameRow) routeNameRow.hidden = !isNamedRouteTool || (hasMajorToggle && !currentRouteMajor);
    if (routeNameInput && routeNameInput.value !== currentRouteName) routeNameInput.value = currentRouteName || "";
    if (mistBrushRow) mistBrushRow.hidden = renderer.drawing.tool !== "mist";
    if (mistBrushInput) mistBrushInput.value = String(renderer.drawing.mistBrushSize || 1);
    if (mistBrushValue) mistBrushValue.textContent = String(renderer.drawing.mistBrushSize || 1);
    if (mistNoiseRow) mistNoiseRow.hidden = renderer.drawing.tool !== "mist";
    if (mistNoiseInput) mistNoiseInput.value = String(renderer.drawing.mistNoise || 0);
    if (mistNoiseValue) mistNoiseValue.textContent = `${renderer.drawing.mistNoise || 0}%`;
  }

  function getCurrentRouteMajor(tool = renderer.drawing.tool) {
    if (tool === "road") return Boolean(renderer.drawing.roadRouteMajor);
    if (tool === "river") return Boolean(renderer.drawing.riverRouteMajor);
    return tool === "sea_route";
  }

  function setCurrentRouteMajor(value, tool = renderer.drawing.tool) {
    if (tool === "road") renderer.drawing.roadRouteMajor = Boolean(value);
    if (tool === "river") renderer.drawing.riverRouteMajor = Boolean(value);
  }

  function getCurrentRouteName(tool = renderer.drawing.tool) {
    if (tool === "road") return renderer.drawing.roadRouteName || "";
    if (tool === "river") return renderer.drawing.riverRouteName || "";
    if (tool === "sea_route") return renderer.drawing.seaRouteName || "";
    return "";
  }

  function setCurrentRouteName(value, tool = renderer.drawing.tool) {
    const routeName = value || "";
    if (tool === "road") renderer.drawing.roadRouteName = routeName;
    if (tool === "river") renderer.drawing.riverRouteName = routeName;
    if (tool === "sea_route") renderer.drawing.seaRouteName = routeName;
  }

  function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function getChaosSliderValue(value, chaosAt, min, max, fallback) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= chaosAt) return "chaos";
    return clampNumber(numeric, min, max, fallback);
  }

  function sliderValueForControl(value, chaosValue, fallback) {
    return value === "chaos" ? String(chaosValue) : String(value ?? fallback);
  }

  function sliderLabel(value, suffix = "") {
    return value === "chaos" ? "Chaos" : `${value}${suffix}`;
  }

  function setSliderChaosEndpoint(input, enabled, chaosMax, normalMax) {
    if (!input) return;
    input.max = String(enabled ? chaosMax : normalMax);
  }

  function refreshMistBrushPreview() {
    if (renderer.drawing.tool !== "mist" || !renderer.drawing.hoverMistHexIds?.length) return;
    const centerHex = renderer.hexes.find(hex => hex.id === renderer.drawing.hoverMistHexIds[0]);
    renderer.drawing.hoverMistHexIds = centerHex ? getMistBrushHexIds(centerHex) : [];
  }

  function refreshEditorBrushPreview() {
    if (!["terrain", "terrain-eyedropper", "feature", "feature-erase", "feature-eyedropper"].includes(renderer.drawing.tool) || !renderer.drawing.hoverBrushHexIds?.length) return;
    const centerHex = renderer.hexes.find(hex => hex.id === renderer.drawing.hoverBrushHexIds[0]);
    renderer.drawing.hoverBrushHexIds = centerHex ? getEditorBrushHexIds(centerHex) : [];
  }

  function populateDrawRegionSelect() {
    const select = document.getElementById("map-draw-region-select");
    const politicalSelect = document.getElementById("map-draw-political-region-select");

    populateRegionSelect(select, "geographic", UNCLAIMED_REGION_REF, "regionId");
    populateRegionSelect(politicalSelect, "political", "", "politicalRegionId");
    syncRegionColorInputs();
  }

  function populateRegionSelect(select, regionType, excludedRegionId, drawingKey) {
    if (!select) return;

    const regions = (db?.raw?.regions || [])
      .filter(region => (region.Region_Type || "geographic") === regionType)
      .filter(region => !excludedRegionId || region.Region_ID !== excludedRegionId)
      .sort((a, b) => {
        return String(a.Region_Name || a.Region_ID).localeCompare(String(b.Region_Name || b.Region_ID), undefined, {
          numeric: true,
          sensitivity: "base"
        });
      });

    const currentValue = renderer.drawing[drawingKey] || select.value || "";
    select.innerHTML = regions.map(region => {
      const value = escapeHtml(region.Region_ID || "");
      const label = escapeHtml(region.Region_Name || region.Region_ID || "Unnamed Region");
      return `<option value="${value}">${label}</option>`;
    }).join("");

    if (!regions.length) {
      select.innerHTML = `<option value="">No ${regionType} regions</option>`;
      renderer.drawing[drawingKey] = "";
      return;
    }

    select.value = regions.some(region => region.Region_ID === currentValue)
      ? currentValue
      : regions[0]?.Region_ID || "";
    renderer.drawing[drawingKey] = select.value || "";
  }

  function populateTerrainControls() {
    const baseContainer = document.getElementById("map-terrain-base-options");
    const featureBrushContainer = document.getElementById("map-feature-brush-options");
    if (!baseContainer) return;

    baseContainer.innerHTML = BASE_TERRAIN_OPTIONS.map(([base, label]) => `
      <button class="map-terrain-base-option" type="button" data-map-terrain-base="${escapeHtml(base)}">
        <span class="map-terrain-swatch${base === "chaos" ? " map-terrain-swatch-chaos" : ""}" style="${base === "chaos" ? "" : `background:${escapeHtml(TERRAIN_COLORS[base] || "#7f7a66")}`}"></span>
        <span class="map-terrain-label">${escapeHtml(label)}</span>
      </button>
    `).join("");

    baseContainer.querySelectorAll("[data-map-terrain-base]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setTerrainBase(button.dataset.mapTerrainBase || "plains");
        if (isMobileEditorLayout()) setMobileTerrainTab("elevation");
      });
    });

    if (featureBrushContainer) {
      featureBrushContainer.innerHTML = FEATURE_BRUSH_OPTIONS.map(option => `
        <button class="map-terrain-feature-option map-feature-brush-option" type="button" data-map-feature-brush="${escapeHtml(option.id)}">
          <span>${escapeHtml(option.label)}</span>
        </button>
      `).join("");

      featureBrushContainer.querySelectorAll("[data-map-feature-brush]").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const nextBrush = button.dataset.mapFeatureBrush || "generated";
          if (nextBrush === "chaos" && !renderer.drawing.featureChaosEnabled) return;
          renderer.drawing.featureBrush = nextBrush;
          updateTerrainControls();
          renderSvgOnly();
        });
      });
    }

    updateTerrainControls();
  }

  function setTerrainBase(baseTerrain) {
    if (baseTerrain === "chaos" && !renderer.drawing.terrainChaosEnabled) return;
    if (baseTerrain !== "chaos" && !TERRAIN_COLORS[baseTerrain]) return;
    renderer.drawing.terrainBase = baseTerrain;
    updateTerrainControls();
  }

  function setTerrainChaosEnabled(enabled) {
    renderer.drawing.terrainChaosEnabled = enabled;
    if (enabled) {
      renderer.drawing.terrainBase = "chaos";
      renderer.drawing.terrainBrushSize = "chaos";
      renderer.drawing.terrainNoise = "chaos";
      renderer.drawing.terrainMaxFeatures = "chaos";
      renderer.drawing.terrainFeatureDensity = "chaos";
      renderer.drawing.terrainElevation = "chaos";
    } else {
      renderer.drawing.terrainBase = "plains";
      renderer.drawing.terrainBrushSize = 1;
      renderer.drawing.terrainNoise = 0;
      renderer.drawing.terrainMaxFeatures = 1;
      renderer.drawing.terrainFeatureDensity = 50;
      renderer.drawing.terrainElevation = "auto";
    }
    updateTerrainControls();
    refreshEditorBrushPreview();
    renderSvgOnly();
  }

  function setFeatureChaosEnabled(enabled) {
    renderer.drawing.featureChaosEnabled = enabled;
    if (enabled) {
      renderer.drawing.featureBrush = "chaos";
      renderer.drawing.featureBrushSize = "chaos";
      renderer.drawing.featureNoise = "chaos";
      renderer.drawing.featureDensity = "chaos";
      renderer.drawing.featureMaxFeatures = "chaos";
    } else {
      renderer.drawing.featureBrush = "generated";
      renderer.drawing.featureBrushSize = 1;
      renderer.drawing.featureNoise = 0;
      renderer.drawing.featureDensity = 50;
      renderer.drawing.featureMaxFeatures = 1;
    }
    updateTerrainControls();
    refreshEditorBrushPreview();
    renderSvgOnly();
  }

  function updateTerrainControls() {
    document.querySelectorAll("[data-map-terrain-base]").forEach(button => {
      if (button.dataset.mapTerrainBase === "chaos") button.hidden = !renderer.drawing.terrainChaosEnabled;
      button.classList.toggle("active", button.dataset.mapTerrainBase === renderer.drawing.terrainBase);
    });

    document.querySelectorAll("[data-map-feature-brush]").forEach(button => {
      if (button.dataset.mapFeatureBrush === "chaos") button.hidden = !renderer.drawing.featureChaosEnabled;
      button.classList.toggle("active", button.dataset.mapFeatureBrush === renderer.drawing.featureBrush);
    });

    const elevationInput = document.getElementById("map-terrain-elevation");
    const elevationValue = document.getElementById("map-terrain-elevation-value");
    const terrainBrushSize = document.getElementById("map-terrain-brush-size");
    const terrainBrushSizeValue = document.getElementById("map-terrain-brush-size-value");
    const terrainNoise = document.getElementById("map-terrain-noise");
    const terrainNoiseValue = document.getElementById("map-terrain-noise-value");
    const terrainFeatureDensity = document.getElementById("map-terrain-feature-density");
    const terrainFeatureDensityValue = document.getElementById("map-terrain-feature-density-value");
    const terrainMaxFeatures = document.getElementById("map-terrain-max-features");
    const terrainMaxFeaturesValue = document.getElementById("map-terrain-max-features-value");
    const terrainChaosToggle = document.getElementById("map-terrain-chaos-toggle");
    const featureBrushSize = document.getElementById("map-feature-brush-size");
    const featureBrushSizeValue = document.getElementById("map-feature-brush-size-value");
    const featureNoise = document.getElementById("map-feature-noise");
    const featureNoiseValue = document.getElementById("map-feature-noise-value");
    const featureDensity = document.getElementById("map-feature-density");
    const featureDensityValue = document.getElementById("map-feature-density-value");
    const featureMaxFeatures = document.getElementById("map-feature-max-features");
    const featureMaxFeaturesValue = document.getElementById("map-feature-max-features-value");
    const featureChaosToggle = document.getElementById("map-feature-chaos-toggle");
    const featureBrushNote = document.getElementById("map-feature-brush-note");

    setSliderChaosEndpoint(terrainBrushSize, renderer.drawing.terrainChaosEnabled, 6, 5);
    setSliderChaosEndpoint(terrainNoise, renderer.drawing.terrainChaosEnabled, 95, 90);
    setSliderChaosEndpoint(terrainMaxFeatures, renderer.drawing.terrainChaosEnabled, 2, 2);
    setSliderChaosEndpoint(terrainFeatureDensity, renderer.drawing.terrainChaosEnabled, 105, 100);
    setSliderChaosEndpoint(elevationInput, renderer.drawing.terrainChaosEnabled, 6, 5);
    setSliderChaosEndpoint(featureBrushSize, renderer.drawing.featureChaosEnabled, 6, 5);
    setSliderChaosEndpoint(featureNoise, renderer.drawing.featureChaosEnabled, 95, 90);
    setSliderChaosEndpoint(featureDensity, renderer.drawing.featureChaosEnabled, 105, 100);
    setSliderChaosEndpoint(featureMaxFeatures, renderer.drawing.featureChaosEnabled, 2, 2);

    if (terrainChaosToggle) terrainChaosToggle.checked = Boolean(renderer.drawing.terrainChaosEnabled);
    if (featureChaosToggle) featureChaosToggle.checked = Boolean(renderer.drawing.featureChaosEnabled);

    if (elevationInput) elevationInput.value = renderer.drawing.terrainElevation === "auto" ? "-3" : renderer.drawing.terrainElevation === "chaos" ? "6" : String(renderer.drawing.terrainElevation);
    if (elevationValue) elevationValue.textContent = renderer.drawing.terrainElevation === "auto" ? "Auto" : renderer.drawing.terrainElevation === "chaos" ? "Chaos" : String(renderer.drawing.terrainElevation);
    if (terrainBrushSize) terrainBrushSize.value = sliderValueForControl(renderer.drawing.terrainBrushSize, 6, 1);
    if (terrainBrushSizeValue) terrainBrushSizeValue.textContent = sliderLabel(renderer.drawing.terrainBrushSize ?? 1);
    if (terrainNoise) terrainNoise.value = sliderValueForControl(renderer.drawing.terrainNoise, 95, 0);
    if (terrainNoiseValue) terrainNoiseValue.textContent = sliderLabel(renderer.drawing.terrainNoise ?? 0, "%");
    if (terrainMaxFeatures) terrainMaxFeatures.value = sliderValueForControl(renderer.drawing.terrainMaxFeatures, 2, 1);
    if (terrainMaxFeaturesValue) terrainMaxFeaturesValue.textContent = sliderLabel(renderer.drawing.terrainMaxFeatures ?? 1);
    if (terrainFeatureDensity) terrainFeatureDensity.value = sliderValueForControl(renderer.drawing.terrainFeatureDensity, 105, 50);
    if (terrainFeatureDensityValue) terrainFeatureDensityValue.textContent = sliderLabel(renderer.drawing.terrainFeatureDensity ?? 50, "%");
    if (featureBrushSize) featureBrushSize.value = sliderValueForControl(renderer.drawing.featureBrushSize, 6, 1);
    if (featureBrushSizeValue) featureBrushSizeValue.textContent = sliderLabel(renderer.drawing.featureBrushSize ?? 1);
    if (featureNoise) featureNoise.value = sliderValueForControl(renderer.drawing.featureNoise, 95, 0);
    if (featureNoiseValue) featureNoiseValue.textContent = sliderLabel(renderer.drawing.featureNoise ?? 0, "%");
    if (featureDensity) featureDensity.value = sliderValueForControl(renderer.drawing.featureDensity, 105, 50);
    if (featureDensityValue) featureDensityValue.textContent = sliderLabel(renderer.drawing.featureDensity ?? 50, "%");
    if (featureMaxFeatures) featureMaxFeatures.value = sliderValueForControl(renderer.drawing.featureMaxFeatures, 2, 1);
    if (featureMaxFeaturesValue) featureMaxFeaturesValue.textContent = sliderLabel(renderer.drawing.featureMaxFeatures ?? 1);
    if (featureBrushNote) {
      const note = FEATURE_BRUSH_NOTES[renderer.drawing.featureBrush] || "";
      featureBrushNote.textContent = note;
      featureBrushNote.hidden = !note;
    }
  }

  function updateGenerationControls() {
    const generationSeed = document.getElementById("map-generation-seed");
    const generationRegionStyle = document.getElementById("map-generation-region-style");
    const generationDensity = document.getElementById("map-generation-density");
    const generationDensityValue = document.getElementById("map-generation-density-value");
    const generationMaxFeatures = document.getElementById("map-generation-max-features");
    const generationMaxFeaturesValue = document.getElementById("map-generation-max-features-value");
    const generationRefreshExisting = document.getElementById("map-generation-refresh-existing");
    const generationRunFeatures = document.getElementById("map-generation-run-features");
    const generationRunRoads = document.getElementById("map-generation-run-roads");
    const generationRunRivers = document.getElementById("map-generation-run-rivers");
    const generationResetSliders = document.getElementById("map-generation-reset-sliders");
    const generationPreviewTerrain = document.getElementById("map-generation-preview-terrain");
    const generationApplyPreview = document.getElementById("map-generation-apply-preview");
    const generationDiscardPreview = document.getElementById("map-generation-discard-preview");

    if (generationSeed && generationSeed.value !== renderer.drawing.generationSeed) {
      generationSeed.value = renderer.drawing.generationSeed || "";
    }
    if (generationRegionStyle && generationRegionStyle.value !== (renderer.drawing.generationRegionStyle || "balanced")) {
      generationRegionStyle.value = renderer.drawing.generationRegionStyle || "balanced";
    }
    if (generationDensity) generationDensity.value = String(renderer.drawing.generationFeatureDensity ?? 100);
    if (generationDensityValue) generationDensityValue.textContent = `${renderer.drawing.generationFeatureDensity ?? 100}%`;
    if (generationMaxFeatures) generationMaxFeatures.value = String(renderer.drawing.generationMaxFeatures ?? 2);
    if (generationMaxFeaturesValue) generationMaxFeaturesValue.textContent = String(renderer.drawing.generationMaxFeatures ?? 2);
    if (generationRefreshExisting) generationRefreshExisting.checked = Boolean(renderer.drawing.generationRefreshExisting);
    if (generationRunFeatures) {
      generationRunFeatures.disabled = Boolean(renderer.drawing.saving);
      generationRunFeatures.textContent = renderer.drawing.generationRefreshExisting
        ? "Preview Refresh"
        : "Preview Features";
    }
    if (generationRunRoads) generationRunRoads.disabled = Boolean(renderer.drawing.saving);
    if (generationRunRivers) generationRunRivers.disabled = Boolean(renderer.drawing.saving);
    if (generationResetSliders) generationResetSliders.disabled = Boolean(renderer.drawing.saving);
    document.querySelectorAll("[data-generation-random-seed], [data-generation-discard-section]").forEach(button => {
      button.disabled = Boolean(renderer.drawing.saving);
    });
    [
      ["water", "generationWater"],
      ["coastal-edge", "generationCoastalEdge"],
      ["islands", "generationIslands"],
      ["wetness", "generationWetness"],
      ["heat", "generationHeat"],
      ["forest", "generationForest"],
      ["desert", "generationDesert"],
      ["mountains", "generationMountains"],
      ["compression", "generationCompression"],
      ["continuity", "generationContinuity"],
      ["road", "generationRoadAmount"],
      ["river", "generationRiverAmount"],
      ["river-length", "generationRiverLength"]
    ].forEach(([control, drawingKey]) => {
      const input = document.getElementById(`map-generation-${control}`);
      const value = document.getElementById(`map-generation-${control}-value`);
      const numeric = renderer.drawing[drawingKey] ?? 100;
      if (input) input.value = String(numeric);
      if (value) value.textContent = `${numeric}%`;
    });
    const hasPreview = hasGenerationPreview();
    if (generationPreviewTerrain) generationPreviewTerrain.disabled = Boolean(renderer.drawing.saving);
    if (generationApplyPreview) generationApplyPreview.disabled = Boolean(renderer.drawing.saving || !hasPreview);
    if (generationDiscardPreview) generationDiscardPreview.disabled = Boolean(renderer.drawing.saving || !hasPreview);
  }

  function resetGenerationTerrainSliders() {
    Object.assign(renderer.drawing, {
      generationWater: 100,
      generationCoastalEdge: 0,
      generationIslands: 0,
      generationWetness: 100,
      generationHeat: 100,
      generationForest: 100,
      generationDesert: 100,
      generationMountains: 100,
      generationCompression: 100,
      generationContinuity: 100,
      generationRoadAmount: 100,
      generationRiverAmount: 100,
      generationRiverLength: 100
    });
    updateGenerationControls();
  }

  function randomizeGenerationSeed() {
    const bytes = new Uint32Array(2);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      bytes[0] = Math.floor(Math.random() * 0xffffffff);
      bytes[1] = Date.now() >>> 0;
    }
    renderer.drawing.generationSeed = `seed-${bytes[0].toString(36)}-${bytes[1].toString(36)}`.slice(0, 80);
    updateGenerationControls();
  }

  function hasGenerationPreview() {
    return (renderer.drawing.generationPreviewActions || []).length > 0;
  }

  function getAutoTerrainElevation(baseTerrain, features = []) {
    if (TERRAIN_RULES.getAutoElevation) return TERRAIN_RULES.getAutoElevation(baseTerrain, features);
    return (BASE_ELEVATION[baseTerrain] ?? 1) + getFeatureElevationModifier(features);
  }

  function getFeatureElevationModifier(features = []) {
    if (TERRAIN_RULES.getFeatureElevationModifier) return TERRAIN_RULES.getFeatureElevationModifier(features);
    return Math.max(0, ...(features || []).map(feature => FEATURE_ELEVATION_MODIFIERS[feature] || 0));
  }

  function getValidFeaturesForTerrainSelection(baseTerrain) {
    if (TERRAIN_RULES.getValidFeaturesForBase) return TERRAIN_RULES.getValidFeaturesForBase(baseTerrain);
    return VALID_FEATURES_BY_BASE[baseTerrain] || [];
  }

  function normalizeTerrainFeatureSelection(features = [], preferredFeature = "", maxFeatures = 2) {
    if (TERRAIN_RULES.normalizeFeatures) {
      return TERRAIN_RULES.normalizeFeatures(features, { preferredFeature, maxFeatures });
    }
    let normalized = [...new Set(features || [])].filter(feature => TERRAIN_FEATURE_LABELS[feature]);

    EXCLUSIVE_TERRAIN_FEATURE_GROUPS.forEach(group => {
      const selectedGroupFeatures = normalized.filter(feature => group.includes(feature));
      if (selectedGroupFeatures.length <= 1) return;

      const keepFeature = group.includes(preferredFeature)
        ? preferredFeature
        : selectedGroupFeatures[0];
      normalized = normalized.filter(feature => !group.includes(feature) || feature === keepFeature);
    });

    return normalized.slice(0, clampNumber(Number(maxFeatures), 0, 2, 2));
  }

  function updateDrawHint() {
    const hint = document.getElementById("map-draw-hint");
    if (!hint) return;
    const activeSection = document.querySelector("[data-map-edit-section].active")?.dataset.mapEditSection || "";
    const tool = renderer.drawing.tool;
    if (tool === "terrain") {
      hint.textContent = "Paint base terrain with brush size, noise, and optional generated features.";
      return;
    }
    if (tool === "terrain-eyedropper") {
      hint.textContent = "Pick a hex to copy its base terrain, features, and elevation into the editor.";
      return;
    }
    if (tool === "feature") {
      hint.textContent = "Paint compatible terrain features with brush size, noise, and density.";
      return;
    }
    if (tool === "feature-erase") {
      hint.textContent = "Erase terrain features with brush size, noise, and density.";
      return;
    }
    if (tool === "feature-eyedropper") {
      hint.textContent = "Pick a hex to choose one of its existing features as the active brush.";
      return;
    }
    if (tool === "road" || tool === "path" || tool === "river" || tool === "sea_route") {
      hint.textContent = "Drag across hexes to draw connected overlay lines. Ctrl+Z undoes, Ctrl+Y redoes.";
      return;
    }
    if (tool === "wall") {
      hint.textContent = "Select a hex edge to place or remove a wall segment.";
      return;
    }
    if (tool === "mist") {
      hint.textContent = "Paint mist with the brush. Higher Noise makes the brush patchier.";
      return;
    }
    if (tool === "erase") {
      hint.textContent = "Click a hex to erase connected overlay segments from that location.";
      return;
    }
    if (tool === "region" || tool === "unregion" || tool === "political-region" || tool === "clear-political-region") {
      hint.textContent = "Paint region ownership directly onto hexes. Ctrl+Z undoes, Ctrl+Y redoes.";
      return;
    }
    if (activeSection === "generation") {
      if (renderer.drawing.generationSection === "overlays") {
        hint.textContent = "Generate starter roads and rivers as normal editable overlay segments.";
        return;
      }
      if (renderer.drawing.generationSection === "features") {
        hint.textContent = "Run a shared-rules feature pass to repopulate compatible terrain features without changing base terrain or elevation.";
        return;
      }
      hint.textContent = "Preview a full terrain draft locally before applying it.";
      return;
    }
    hint.textContent = "Right-drag or middle-drag pans. Ctrl+Z undoes, Ctrl+Y redoes.";
  }

  function updateDrawUndoButton() {
    const undoButton = document.getElementById("map-draw-undo");
    if (!undoButton) return;
    undoButton.disabled = renderer.drawing.undoStack.length === 0 || renderer.drawing.saving;
    undoButton.textContent = renderer.drawing.undoStack.length
      ? `Undo (${renderer.drawing.undoStack.length})`
      : "Undo";
  }

  function updateDrawRedoButton() {
    const redoButton = document.getElementById("map-draw-redo");
    if (!redoButton) return;
    redoButton.disabled = renderer.drawing.redoStack.length === 0 || renderer.drawing.saving;
    redoButton.textContent = renderer.drawing.redoStack.length
      ? `Redo (${renderer.drawing.redoStack.length})`
      : "Redo";
  }

  function updateDrawClearButton() {
    [
      "map-draw-clear",
      "map-clear-geo-regions",
      "map-clear-pol-regions",
      "map-clear-features",
      "map-generation-run-features",
      "map-generation-run-roads",
      "map-generation-run-rivers",
      "map-generation-reset-sliders",
      "map-generation-random-seed",
      "map-generation-preview-terrain",
      "map-generation-apply-preview",
      "map-generation-discard-preview"
    ].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) button.disabled = renderer.drawing.saving;
    });
  }

  function getCurrentMapOverlays() {
    return renderer.mapOverlays.length
      ? renderer.mapOverlays
      : (db?.raw?.generatedMapOverlays || []);
  }

  function renderSvgOnly() {
    if (!renderer.root || renderer.root.hidden) return;

    const rect = renderer.root.getBoundingClientRect();
    renderSvg({ width: rect.width, height: rect.height }, getVisibleHexes());
    positionPopup();
  }

  function resizeCanvas() {
    const rect = renderer.root.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));

    if (renderer.canvas.width !== width || renderer.canvas.height !== height) {
      renderer.canvas.width = width;
      renderer.canvas.height = height;
    }

    renderer.canvas.style.width = `${rect.width}px`;
    renderer.canvas.style.height = `${rect.height}px`;
    return { width: rect.width, height: rect.height, scale };
  }

  function fitViewToMap() {
    const rect = renderer.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const fitZoom = Math.min(rect.width / renderer.view.width, rect.height / renderer.view.height);
    renderer.view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
    renderer.view.panX = (renderer.view.width - rect.width / renderer.view.zoom) / 2;
    renderer.view.panY = (renderer.view.height - rect.height / renderer.view.zoom) / 2;
    clampView();
  }

  function clampView() {
    const rect = renderer.root.getBoundingClientRect();
    const visibleWidth = rect.width / renderer.view.zoom;
    const visibleHeight = rect.height / renderer.view.zoom;
    const paddingX = Math.max(160, visibleWidth * PAN_PADDING_RATIO);
    const paddingY = Math.max(160, visibleHeight * PAN_PADDING_RATIO);
    const centeredPanX = (renderer.view.width - visibleWidth) / 2;
    const centeredPanY = (renderer.view.height - visibleHeight) / 2;
    const minPanX = Math.min(-paddingX, centeredPanX);
    const minPanY = Math.min(-paddingY, centeredPanY);
    const maxPanX = Math.max(renderer.view.width - visibleWidth + paddingX, centeredPanX);
    const maxPanY = Math.max(renderer.view.height - visibleHeight + paddingY, centeredPanY);

    renderer.view.panX = Math.max(minPanX, Math.min(maxPanX, renderer.view.panX));
    renderer.view.panY = Math.max(minPanY, Math.min(maxPanY, renderer.view.panY));
  }

  function render() {
    if (!renderer.root || renderer.root.hidden) return;

    const viewport = resizeCanvas();
    clampView();
    const visibleHexes = getVisibleHexes();
    renderTerrain(viewport);
    renderSvg(viewport, visibleHexes);
    positionPopup();
  }

  function renderTerrain({ width, height, scale }) {
    const ctx = renderer.ctx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    updateTerrainCache();
    drawTerrainCacheSlice(ctx, width, height);
  }

  function drawTerrainCacheSlice(ctx, width, height) {
    const sourceWorldX = Math.max(0, renderer.view.panX);
    const sourceWorldY = Math.max(0, renderer.view.panY);
    const sourceWorldRight = Math.min(renderer.view.width, renderer.view.panX + width / renderer.view.zoom);
    const sourceWorldBottom = Math.min(renderer.view.height, renderer.view.panY + height / renderer.view.zoom);
    const sourceWorldWidth = sourceWorldRight - sourceWorldX;
    const sourceWorldHeight = sourceWorldBottom - sourceWorldY;

    if (sourceWorldWidth <= 0 || sourceWorldHeight <= 0) return;

    const destinationX = (sourceWorldX - renderer.view.panX) * renderer.view.zoom;
    const destinationY = (sourceWorldY - renderer.view.panY) * renderer.view.zoom;
    const destinationWidth = sourceWorldWidth * renderer.view.zoom;
    const destinationHeight = sourceWorldHeight * renderer.view.zoom;

    ctx.drawImage(
      renderer.cacheCanvas,
      sourceWorldX * TERRAIN_CACHE_SCALE,
      sourceWorldY * TERRAIN_CACHE_SCALE,
      sourceWorldWidth * TERRAIN_CACHE_SCALE,
      sourceWorldHeight * TERRAIN_CACHE_SCALE,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight
    );
  }

  function updateTerrainCache() {
    const cacheWidth = Math.max(1, Math.ceil(renderer.view.width * TERRAIN_CACHE_SCALE));
    const cacheHeight = Math.max(1, Math.ceil(renderer.view.height * TERRAIN_CACHE_SCALE));

    if (renderer.cacheCanvas.width !== cacheWidth || renderer.cacheCanvas.height !== cacheHeight) {
      renderer.cacheCanvas.width = cacheWidth;
      renderer.cacheCanvas.height = cacheHeight;
      renderer.cacheDirty = true;
    }

    if (!renderer.cacheDirty) return;

    const ctx = renderer.cacheCtx;
    ctx.setTransform(TERRAIN_CACHE_SCALE, 0, 0, TERRAIN_CACHE_SCALE, 0, 0);
    ctx.clearRect(0, 0, renderer.view.width, renderer.view.height);

    renderer.hexes.forEach(hex => {
      drawCanvasPolygon(ctx, hex.points, hex.fill);
    });

    renderCanvasDrawablePaths(ctx);
    renderer.hexes.forEach(hex => renderEdgeBleedForHex(ctx, hex));
    if (renderer.drawing.visibleOverlays.features && shouldRenderFeatureArt()) {
      renderer.hexes.forEach(hex => renderFeatureArtForHex(ctx, hex));
    }
    if (renderer.drawing.visibleOverlays.mist && shouldRenderFeatureArt()) {
      renderCanvasMistOverlays(ctx);
    }
    renderer.cacheDirty = false;
    if (renderer.featureAssets.size > 0 && !hasPendingFeatureImages()) {
      setLoading(false);
    }
  }

  function drawCanvasPolygon(ctx, points, fill, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function renderCanvasDrawablePaths(ctx) {
    const overlays = renderer.mapOverlays || [];

    if (renderer.drawing.visibleOverlays.path) {
      connectedPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "path"), "path").forEach(pathData => {
        drawCanvasOverlayPath(ctx, pathData.d, {
          stroke: ROAD_STYLE_COLORS[getOverlayBaseStyle(pathData.style)] || ROAD_STYLE_COLORS.dark_brown,
          width: 3.5,
          dash: [7, 5],
          lineCap: pathData.isExit ? "butt" : "round"
        });
      });
    }

    if (renderer.drawing.visibleOverlays.river) {
      const drawRiverPaths = segments => {
        const continuationSegments = segments.filter(segment => (
          segment.Is_Major_Route && segmentTouchesRiverTradeContinuationWater(segment)
        ));
        const regularSegments = segments.filter(segment => !(
          segment.Is_Major_Route && segmentTouchesRiverTradeContinuationWater(segment)
        ));
        getCanvasRiverPathStrings(regularSegments).forEach(pathData => {
          drawCanvasOverlayPath(ctx, pathData.d, {
            stroke: "#37b8e8",
            width: pathData.isMajor ? 9 : 6,
            dash: [],
            lineCap: pathData.isExit ? "butt" : "round"
          });
          if (pathData.isMajor) {
            drawCanvasOverlayPath(ctx, pathData.d, {
              stroke: "rgba(218, 247, 255, 0.72)",
              width: 3,
              dash: [],
              lineCap: pathData.isExit ? "butt" : "round"
            });
          }
        });
        renderMajorRiverWaterContinuations(ctx, continuationSegments);
      };
      const riverSegments = overlays.filter(overlay => overlay.Overlay_Type === "river");
      drawRiverPaths(riverSegments.filter(segment => !segment.Is_Major_Route));
      drawRiverPaths(riverSegments.filter(segment => segment.Is_Major_Route));
    }

    if (renderer.drawing.visibleOverlays.sea_route) {
      connectedPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "sea_route"), "sea_route").forEach(pathData => {
        drawCanvasOverlayPath(ctx, pathData.d, {
          stroke: "rgba(236, 227, 176, 0.72)",
          width: 4.5,
          dash: [12, 8],
          lineCap: pathData.isExit ? "butt" : "round"
        });
      });
    }

    if (renderer.drawing.visibleOverlays.road) {
      const roadSegments = overlays.filter(overlay => overlay.Overlay_Type === "road");
      const drawRoadSegments = segments => {
        const passRoadSegments = segments.filter(isAutoPassRoadSegment);
        const baseRoadSegments = segments.filter(segment => !isAutoPassRoadSegment(segment));
        const strictRoadSegments = baseRoadSegments.filter(segment => !overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride));
        renderRoadWaterCrossingDecorations(ctx, strictRoadSegments);
        connectedPathStrings(baseRoadSegments, "road", getAutoPassConnectorHexIds(passRoadSegments, baseRoadSegments)).forEach(pathData => {
          drawCanvasOverlayPath(ctx, pathData.d, {
            stroke: ROAD_STYLE_COLORS[getOverlayBaseStyle(pathData.style)] || ROAD_STYLE_COLORS.dark_brown,
            width: pathData.isMajor ? 9 : 6,
            dash: [],
            lineCap: pathData.isExit ? "butt" : "round"
          });
          if (pathData.isMajor) {
            drawCanvasOverlayPath(ctx, pathData.d, {
              stroke: "rgba(245, 205, 118, 0.62)",
              width: 3,
              dash: [],
              lineCap: pathData.isExit ? "butt" : "round"
            });
          }
        });
        renderSteepRoadPassSegments(ctx, passRoadSegments);
        renderRoadWaterCrossingLines(ctx, strictRoadSegments);
      };
      drawRoadSegments(roadSegments.filter(segment => !segment.Is_Major_Route));
      drawRoadSegments(roadSegments.filter(segment => segment.Is_Major_Route));
      renderMajorRoadRiverBridges(ctx, overlays);
    }

  }

  function drawCanvasOverlayPath(ctx, pathData, options) {
    const commands = parseSvgPathCommands(pathData);
    if (!commands.length) return;

    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.beginPath();
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.width;
    ctx.lineCap = options.lineCap || "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(options.dash || []);

    commands.forEach(command => {
      if (command.type === "M") ctx.moveTo(command.x, command.y);
      if (command.type === "L") ctx.lineTo(command.x, command.y);
      if (command.type === "Q") ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y);
    });

    ctx.stroke();
    ctx.restore();
  }

  function parseSvgPathCommands(pathData) {
    const tokens = String(pathData || "").match(/[MLQT]|-?\d+(?:\.\d+)?/g) || [];
    const commands = [];
    let index = 0;
    let lastControl = null;
    let current = null;

    while (index < tokens.length) {
      const type = tokens[index++];
      if (type === "M" || type === "L") {
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
        commands.push({ type, x, y });
        current = { x, y };
        lastControl = null;
      } else if (type === "Q") {
        const cx = Number(tokens[index++]);
        const cy = Number(tokens[index++]);
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (![cx, cy, x, y].every(Number.isFinite)) break;
        commands.push({ type, cx, cy, x, y });
        lastControl = { x: cx, y: cy };
        current = { x, y };
      } else if (type === "T") {
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
        const reflected = current && lastControl
          ? { x: current.x * 2 - lastControl.x, y: current.y * 2 - lastControl.y }
          : current;
        if (reflected) {
          commands.push({ type: "Q", cx: reflected.x, cy: reflected.y, x, y });
          lastControl = reflected;
        } else {
          commands.push({ type: "L", x, y });
          lastControl = null;
        }
        current = { x, y };
      } else {
        break;
      }
    }

    return commands;
  }

  function renderEdgeBleedForHex(ctx, hex) {
    EDGE_NAMES.forEach(edgeName => {
      const neighbor = getNeighborHex(hex, edgeName);
      const appearance = getEdgeBlendAppearance(hex, neighbor);
      if (!appearance) return;
      drawCanvasPolygon(ctx, edgeBlendPolygon(hex, edgeName), appearance.fill, appearance.opacity);
    });
  }

  function getNeighborHex(hex, edgeName) {
    const offsets = hex.x % 2 ? ODD_Q_NEIGHBORS : EVEN_Q_NEIGHBORS;
    const offset = offsets[edgeName];
    return offset ? renderer.hexesByCoord.get(`${hex.x + offset[0]}:${hex.y + offset[1]}`) : null;
  }

  function edgeBlendPolygon(hex, edgeName) {
    const index = EDGE_NAMES.indexOf(edgeName);
    const originalA = hex.points[index];
    const originalB = hex.points[(index + 1) % hex.points.length];
    const previous = hex.points[(index + hex.points.length - 1) % hex.points.length];
    const next = hex.points[(index + 2) % hex.points.length];

    return [
      {
        x: originalA.x + (previous.x - originalA.x) * 0.24,
        y: originalA.y + (previous.y - originalA.y) * 0.24
      },
      originalA,
      originalB,
      {
        x: originalB.x + (next.x - originalB.x) * 0.24,
        y: originalB.y + (next.y - originalB.y) * 0.24
      }
    ];
  }

  function getEdgeBlendAppearance(hostHex, sourceHex) {
    if (!sourceHex) return null;
    if (isWaterBase(hostHex.baseTerrain) && isWaterBase(sourceHex.baseTerrain)) return null;

    const delta = sourceHex.elevation - hostHex.elevation;
    if (delta <= 0) return null;

    const elevationStep = Math.max(0, delta - 1);
    const shadowOpacity = Math.min(0.28, 0.14 + elevationStep * 0.045);
    return {
      fill: "#201712",
      opacity: Number(shadowOpacity.toFixed(3))
    };
  }

  function isWaterBase(baseTerrain) {
    return WATER_TERRAINS.has(baseTerrain);
  }

  async function loadFeatureArtAssets() {
    if (renderer.featureAssetsLoading) return renderer.featureAssetsLoading;

    renderer.featureAssetsLoading = Promise.all(FEATURE_ART_ASSET_FILES.map(async file => {
      try {
        const response = await fetch(`${FEATURE_ASSET_PATH}${file}`);
        if (!response.ok) return;
        renderer.featureAssets.set(file, parseFeatureSvg(await response.text()));
      } catch {}
    })).then(() => {
      renderer.featureImages.clear();
      renderer.cacheDirty = true;
      render();
    });

    return renderer.featureAssetsLoading;
  }

  async function loadRouteIconAssets() {
    if (renderer.routeIconAssetsLoading) return renderer.routeIconAssetsLoading;

    renderer.routeIconAssetsLoading = Promise.all(Object.entries(ROUTE_ICON_FILES).map(async ([type, file]) => {
      try {
        const response = await fetch(`${ROUTE_ICON_ASSET_PATH}${file}`);
        if (!response.ok) return;
        renderer.routeIconAssets.set(type, parseFeatureSvg(await response.text()));
      } catch {}
    })).then(() => {
      renderer.routeLabelCache = { key: "", labels: [] };
      renderSvgOnly();
    });

    return renderer.routeIconAssetsLoading;
  }

  function parseFeatureSvg(text) {
    const viewBoxMatch = text.match(/\bviewBox=["']([^"']+)["']/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 384 333";
    const values = viewBox.split(/\s+/).map(Number);
    const bodyMatch = text.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
    const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wrapper.innerHTML = bodyMatch ? bodyMatch[1] : text;
    applyFeatureArtTint(wrapper);
    return {
      viewBox,
      width: Number.isFinite(values[2]) && values[2] > 0 ? values[2] : 384,
      height: Number.isFinite(values[3]) && values[3] > 0 ? values[3] : 333,
      body: wrapper.innerHTML
    };
  }

  function applyFeatureArtTint(artSvg) {
    artSvg.style.color = "currentColor";
    artSvg.setAttribute("fill", "currentColor");
    artSvg.querySelectorAll("path, polygon, circle, rect, ellipse, line, polyline").forEach(element => {
      const fill = element.getAttribute("fill");
      const stroke = element.getAttribute("stroke");
      if (fill !== "none") element.setAttribute("fill", "currentColor");
      if (stroke && stroke !== "none") element.setAttribute("stroke", "currentColor");
    });
  }

  function renderFeatureArtForHex(ctx, hex) {
    const stack = getFeatureArtStack(hex);
    const zoomOpacity = getFeatureArtZoomOpacity();

    stack.forEach((item, index) => {
      const image = getFeatureArtImage(item.file, getFeatureArtTint(hex, item));
      if (!image) return;
      drawFeatureArtImage(ctx, image, applyFeatureArtSizeMultiplier(featureArtDrawBox(hex, index), item.featureId), getFeatureArtOpacity(hex, item, zoomOpacity));
    });
  }

  function drawFeatureArtImage(ctx, image, box, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
  }

  function getFeatureArtImage(file, tint) {
    const asset = renderer.featureAssets.get(file);
    if (!asset) return null;

    const cacheKey = `${file}|${tint}|${FEATURE_IMAGE_SUPERSAMPLE}`;
    const cached = renderer.featureImages.get(cacheKey);
    if (cached?.loaded) return cached.image;
    if (cached) return null;

    const image = new Image();
    renderer.featureImages.set(cacheKey, { image, loaded: false });
    image.onload = () => {
      const entry = renderer.featureImages.get(cacheKey);
      if (!entry) return;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(asset.width * FEATURE_IMAGE_SUPERSAMPLE));
      canvas.height = Math.max(1, Math.ceil(asset.height * FEATURE_IMAGE_SUPERSAMPLE));
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      entry.image = canvas;
      entry.loaded = true;
      renderer.cacheDirty = true;
      render();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${asset.viewBox}" color="${tint}" fill="currentColor">${asset.body}</svg>`
    )}`;
    return null;
  }

  function getFeatureArtStack(hex) {
    if (isRiverFallsHex(hex)) {
      return [{
        featureId: "falls",
        layer: FEATURE_LAYER_BY_ID.falls,
        file: FEATURE_ART_FILES.falls,
        opacity: FEATURE_ART_OPACITY.falls || 0.7
      }];
    }

    const features = new Set(hex.features || []);
    const stack = [];
    const hasVegetation = ["jungle", "forest", "woods", "shrub", "cactus_scrub"].some(feature => features.has(feature));
    const hasStructure = ["volcano", "snowcapped_mountains", "mountains", "lone_mountain", "cliffs", "ridges"].some(feature => features.has(feature));
    const structure = ["volcano", "snowcapped_mountains", "mountains", "lone_mountain", "cliffs", "ridges"].find(feature => features.has(feature));
    const surfaceOrder = features.has("ice")
      ? ["ice", "marsh", "reef", "kelp"]
      : features.has("whirlpool")
        ? ["reef", "kelp", "marsh"]
        : ["farmland", "sand", "waves", "shoals", "reef", "kelp", "ice", "marsh"];
    const surface = surfaceOrder.find(feature => features.has(feature) && !(feature === "farmland" && (hasVegetation || hasStructure)));
    const vegetation = ["jungle", "forest", "woods", "shrub", "cactus_scrub"].find(feature => features.has(feature));
    const waterTop = ["falls", "rapids", "whirlpool", "water_rocks"].find(feature => features.has(feature));

    if (structure) stack.push({ featureId: structure, layer: FEATURE_LAYER_BY_ID[structure] });
    if (surface) stack.push({ featureId: surface, layer: FEATURE_LAYER_BY_ID[surface] });
    if (vegetation) stack.push({ featureId: vegetation, layer: FEATURE_LAYER_BY_ID[vegetation] });
    if (waterTop) stack.push({ featureId: waterTop, layer: FEATURE_LAYER_BY_ID[waterTop] });

    return stack
      .map(item => ({
        ...item,
        file: chooseFeatureArtFile(hex, item.featureId, features),
        opacity: FEATURE_ART_OPACITY[item.featureId] || 0.28
      }))
      .filter(item => item.file)
      .sort((a, b) => a.layer - b.layer);
  }

  function isRiverFallsHex(hex) {
    if (!hex || !renderer.drawing.visibleOverlays.river) return false;
    return getRiverFallsHexIds().has(hex.id);
  }

  function getRiverFallsHexIds() {
    const fallsHexIds = new Set();
    (renderer.mapOverlays || [])
      .filter(overlay => (
        overlay.Overlay_Type === "river" &&
        overlay.From_Hex_ID_Ref &&
        overlay.To_Hex_ID_Ref &&
        !overlayHasStyleFlag(overlay, OVERLAY_STYLE_FLAGS.riverNoAutoFalls)
      ))
      .forEach(overlay => {
        const fromHex = hexForPathPoint(overlay.From_Hex_ID_Ref);
        const toHex = hexForPathPoint(overlay.To_Hex_ID_Ref);
        const delta = getElevationDelta(fromHex, toHex);
        if (!fromHex || !toHex || delta < RIVER_FALLS_ELEVATION_DELTA) return;
        const higherHex = Number(fromHex.elevation || 0) >= Number(toHex.elevation || 0) ? fromHex : toHex;
        if (!shouldAutoRenderRiverFalls(overlay, higherHex)) return;
        fallsHexIds.add(higherHex.id);
      });
    return fallsHexIds;
  }

  function shouldAutoRenderRiverFalls(overlay, hex) {
    const chance = isCoastalFallsCandidate(hex)
      ? COASTAL_RIVER_FALLS_CHANCE
      : RIVER_FALLS_CHANCE;
    const seed = `${overlay.__uuid || ""}:${overlay.From_Hex_ID_Ref}:${overlay.To_Hex_ID_Ref}:auto-falls`;
    return stableHash(seed) % 100 < chance;
  }

  function isCoastalFallsCandidate(hex) {
    if (!hex) return false;
    if (hex.baseTerrain === "beach" || hex.baseTerrain === "coastal_water") return true;
    return EDGE_NAMES.some(edgeName => {
      const neighbor = getNeighborHex(hex, edgeName);
      return neighbor && ["deep_sea", "sea", "coastal_water", "beach"].includes(neighbor.baseTerrain);
    });
  }

  function chooseFeatureArtFile(hex, featureId, features) {
    const base = hex.baseTerrain;

    if (["reef", "kelp", "shoals", "water_rocks", "waves", "whirlpool"].includes(featureId)) {
      if (!WATER_TERRAINS.has(base)) return null;
      if (featureId === "reef" && base === "inland_water") return null;
      if (featureId === "kelp" && base === "inland_water") return null;
      if (featureId === "shoals" && base === "deep_sea" && !hasNearbyBase(hex, new Set(["coastal_water", "beach"]), 1)) return null;
      if (featureId === "waves" && (features.has("ice") || features.has("whirlpool"))) return null;
      if (featureId === "shoals" && (features.has("ice") || features.has("whirlpool"))) return null;
      return FEATURE_ART_FILES[featureId];
    }

    if (featureId === "rapids") {
      if (features.has("falls")) return null;
      return base === "inland_water" || (WATER_TERRAINS.has(base) && hasNearbyBase(hex, HIGHLAND_TERRAINS, 1)) ? FEATURE_ART_FILES.rapids : null;
    }
    if (featureId === "falls") {
      return (base === "inland_water" && hasNearbyBase(hex, HIGHLAND_TERRAINS, 1)) || (WATER_TERRAINS.has(base) && hasNearbyAnyFeature(hex, ["cliffs", "mountains", "ridges"], 1)) ? FEATURE_ART_FILES.falls : null;
    }
    if (featureId === "ice") {
      if (!WATER_TERRAINS.has(base) && base !== "snow") return null;
      return base === "snow" || hasNearbyBase(hex, COLD_TERRAINS, 2) || hasNearbyFeature(hex, "ice", 2) ? FEATURE_ART_FILES.ice : null;
    }

    if (featureId === "farmland") return ["plains", "grassland", "lush_grassland"].includes(base) ? FEATURE_ART_FILES.farmland : null;
    if (featureId === "sand") return ["beach", "desert", "deep_desert"].includes(base) ? FEATURE_ART_FILES.sand : null;
    if (featureId === "cactus_scrub") return ["desert", "deep_desert", "barrens"].includes(base) ? FEATURE_ART_FILES.cactus_scrub : null;
    if (featureId === "shrub") return ["plains", "grassland", "desert", "deep_desert", "barrens", "bleak_barrens"].includes(base) ? FEATURE_ART_FILES.shrub : null;
    if (featureId === "marsh") return ["wetland", "inland_water", "lush_grassland"].includes(base) ? FEATURE_ART_FILES.marsh : null;
    if (featureId === "ridges") return LAND_TERRAINS.has(base) && !WATER_TERRAINS.has(base) ? FEATURE_ART_FILES.ridges : null;
    if (featureId === "cliffs") return ["beach", "desert", "deep_desert", "barrens", "bleak_barrens", "rock", "wastes"].includes(base) ? FEATURE_ART_FILES.cliffs : null;
    if (featureId === "snowcapped_mountains") return base === "snow" ? FEATURE_ART_FILES.snowcapped_mountains : null;
    if (featureId === "mountains") return ["rock", "snow"].includes(base) ? (base === "snow" ? FEATURE_ART_FILES.mountains_snow : FEATURE_ART_FILES.mountains) : null;
    if (featureId === "lone_mountain") return ["plains", "grassland", "desert", "deep_desert", "barrens", "rock", "wastes"].includes(base) ? FEATURE_ART_FILES.lone_mountain : null;
    if (featureId === "volcano") return ["rock", "wastes", "bleak_barrens"].includes(base) ? FEATURE_ART_FILES.volcano : null;
    if (featureId === "jungle") return chooseJungleArt(hex);
    if (featureId === "woods") return chooseWoodsArt(hex);
    if (featureId === "forest") return ["mountains", "lone_mountain", "volcano", "cliffs", "ridges"].some(feature => features.has(feature)) ? chooseWoodsArt(hex) : chooseForestArt(hex);

    return FEATURE_ART_FILES[featureId] || null;
  }

  function nearbyHexesWithin(hex, radius = 2) {
    const results = [];
    const visited = new Set([`${hex.x}:${hex.y}`]);
    let frontier = [hex];

    for (let depth = 0; depth < radius; depth++) {
      const next = [];
      frontier.forEach(current => {
        EDGE_NAMES.map(edgeName => getNeighborHex(current, edgeName)).filter(Boolean).forEach(neighbor => {
          const key = `${neighbor.x}:${neighbor.y}`;
          if (visited.has(key)) return;
          visited.add(key);
          results.push(neighbor);
          next.push(neighbor);
        });
      });
      frontier = next;
    }

    return results;
  }

  function hasNearbyBase(hex, baseSet, radius = 2) {
    return nearbyHexesWithin(hex, radius).some(neighbor => baseSet.has(neighbor.baseTerrain));
  }

  function hasNearbyFeature(hex, featureId, radius = 2) {
    return nearbyHexesWithin(hex, radius).some(neighbor => neighbor.features.includes(featureId));
  }

  function hasNearbyAnyFeature(hex, featureIds, radius = 2) {
    const set = new Set(featureIds);
    return nearbyHexesWithin(hex, radius).some(neighbor => neighbor.features.some(feature => set.has(feature)));
  }

  function stableHash(text) {
    let hash = 2166136261;
    const value = String(text);
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pickStableWeighted(hex, featureId, weightedFiles) {
    const pool = [];
    weightedFiles.forEach(([file, weight]) => {
      for (let i = 0; i < weight; i++) pool.push(file);
    });
    return pool.length ? pool[stableHash(`${hex.id}:${hex.baseTerrain}:${featureId}`) % pool.length] : null;
  }

  function chooseWoodsArt(hex) {
    const base = hex.baseTerrain;
    if (["barrens", "bleak_barrens", "wastes"].includes(base)) return "woods_dead.svg";
    if (!["plains", "grassland", "lush_grassland", "wetland", "snow", "rock"].includes(base)) return null;
    if (base === "snow") return pickStableWeighted(hex, "woods", [["woods_con.svg", 6], ["woods_dec.svg", 1]]);
    if (base === "rock") return pickStableWeighted(hex, "woods", [["woods_con.svg", 5], ["woods_dec.svg", 2]]);
    if (base === "wetland") return pickStableWeighted(hex, "woods", [["woods_con.svg", 2], ["woods_dec.svg", 3], ["woods_dead.svg", 1]]);
    if (base === "lush_grassland") return pickStableWeighted(hex, "woods", [["woods_dec.svg", 8], ["woods_con.svg", 1], ["woods_dead.svg", 1]]);
    if (base === "grassland") return pickStableWeighted(hex, "woods", [["woods_dec.svg", 7], ["woods_con.svg", 2], ["woods_dead.svg", 1]]);
    return pickStableWeighted(hex, "woods", [["woods_dec.svg", 6], ["woods_con.svg", 1], ["woods_dead.svg", 1]]);
  }

  function chooseForestArt(hex) {
    const base = hex.baseTerrain;
    if (["barrens", "bleak_barrens", "wastes"].includes(base)) return "forest_dead.svg";
    if (!["grassland", "lush_grassland", "wetland", "snow", "rock"].includes(base)) return null;
    if (base === "snow") return pickStableWeighted(hex, "forest", [["forest_con.svg", 6], ["forest_dec.svg", 1]]);
    if (base === "rock") return pickStableWeighted(hex, "forest", [["forest_con.svg", 5], ["forest_dec.svg", 2]]);
    if (base === "wetland") return pickStableWeighted(hex, "forest", [["forest_con.svg", 3], ["forest_dec.svg", 4], ["forest_dead.svg", 1]]);
    if (base === "lush_grassland") return pickStableWeighted(hex, "forest", [["forest_dec.svg", 8], ["forest_con.svg", 2], ["forest_dead.svg", 1]]);
    return pickStableWeighted(hex, "forest", [["forest_dec.svg", 6], ["forest_con.svg", 3], ["forest_dead.svg", 1]]);
  }

  function chooseJungleArt(hex) {
    if (!["jungle_floor", "wetland", "lush_grassland"].includes(hex.baseTerrain)) return null;
    const nearbyBeach = hasNearbyBase(hex, new Set(["beach", "coastal_water"]), 2);
    const nearbyWet = hasNearbyBase(hex, new Set(["wetland", "inland_water"]), 2);
    const nearbyCold = hasNearbyBase(hex, COLD_TERRAINS, 3);
    const nearbyRock = hasNearbyBase(hex, new Set(["rock"]), 2);
    if (nearbyBeach && nearbyWet && !nearbyCold) return pickStableWeighted(hex, "jungle", [["jungle_trop_1.svg", 3], ["jungle_trop_2.svg", 2], ["jungle_temp_1.svg", 1]]);
    if (nearbyCold || nearbyRock) return pickStableWeighted(hex, "jungle", [["jungle_temp_1.svg", 4], ["jungle_temp_2.svg", 2]]);
    return pickStableWeighted(hex, "jungle", [["jungle_temp_1.svg", 3], ["jungle_temp_2.svg", 2], ["jungle_trop_1.svg", 1]]);
  }

  function getFeatureArtTint(hex, item) {
    const base = hex.baseTerrain;
    const tints = BASE_FEATURE_TINTS[base] || BASE_FEATURE_TINTS.plains;
    const featureId = item.featureId;
    const file = item.file || "";
    const isVegetation = ["woods", "forest", "jungle", "shrub", "cactus_scrub", "marsh"].includes(featureId);
    const isRelief = ["mountains", "snowcapped_mountains", "lone_mountain", "cliffs", "ridges", "volcano"].includes(featureId);
    if (featureId === "ice") return base === "snow" ? "#5f8fa4" : "#d8eef2";
    if (featureId === "sand") return isCoastalSandHex(hex) ? "#f1ead8" : base === "deep_desert" ? "#765033" : "#805b34";
    if (featureId === "marsh") return "#8b6f3d";
    if (["barrens", "bleak_barrens"].includes(base) && isRelief) return "#b88a62";
    if (["barrens", "bleak_barrens"].includes(base) && ["shrub", "cactus_scrub"].includes(featureId)) return "#958a57";
    if (base === "wastes" && isRelief) return "#8f6a5f";
    if (featureId === "jungle") return "#519942";
    if (["wetland", "jungle_floor"].includes(base) && isVegetation) return base === "jungle_floor" ? "#63a56d" : "#5d9380";
    if (featureId === "volcano") return "#2b2020";
    if (featureId === "kelp") return "#1f5a45";
    if (featureId === "reef") return "#7b5a4a";
    if (featureId === "falls") return isRiverFallsHex(hex) ? getReliefFeatureTint(hex) : "#d8eef2";
    if (file.includes("jungle_trop")) return "#155c38";
    if (file.includes("jungle_temp")) return "#244a35";
    if (file.includes("_dead")) return ["barrens", "bleak_barrens", "wastes"].includes(base) ? "#8f6f68" : "#746852";
    if (file.includes("_con")) return base === "wetland" ? "#234d43" : "#203f35";
    if (file.includes("_dec")) return tints.vegetation;
    if (isVegetation) return tints.vegetation;
    if (isRelief) return tints.relief;
    if (["waves", "shoals", "water_rocks", "rapids", "whirlpool"].includes(featureId)) return tints.water || "#103f56";
    if (featureId === "farmland" && ["grassland", "lush_grassland"].includes(base)) return "#9f7a32";
    if (featureId === "farmland") return tints.surface;
    return tints.surface || "#3f3a32";
  }

  function getReliefFeatureTint(hex) {
    const base = hex?.baseTerrain || "plains";
    const tints = BASE_FEATURE_TINTS[base] || BASE_FEATURE_TINTS.plains;
    if (["barrens", "bleak_barrens"].includes(base)) return "#b88a62";
    if (base === "wastes") return "#8f6a5f";
    return tints.relief || tints.surface || "#5d5638";
  }

  function isCoastalSandHex(hex) {
    return hex?.baseTerrain === "beach" || (
      ["desert", "deep_desert"].includes(hex?.baseTerrain) &&
      hasNearbyBase(hex, WATER_TERRAINS, 1)
    );
  }

  function getFeatureArtOpacity(hex, item, zoomOpacity) {
    const waterFeatures = new Set(["waves", "shoals", "reef", "kelp", "water_rocks", "rapids", "falls", "whirlpool", "ice"]);
    if (!waterFeatures.has(item.featureId)) return 1;
    let opacity = item.opacity * zoomOpacity;
    const darkBases = new Set(["deep_sea", "sea", "coastal_water", "wetland", "jungle_floor", "lush_grassland", "rock", "wastes", "bleak_barrens"]);
    if (darkBases.has(hex.baseTerrain)) opacity *= 1.22;
    return Math.min(0.92, opacity);
  }

  function getFeatureArtZoomScale() {
    return 1;
  }

  function shouldRenderFeatureArt() {
    return renderer.featureAssets.size > 0;
  }

  function hasPendingFeatureImages() {
    return [...renderer.featureImages.values()].some(entry => !entry.loaded);
  }

  function getFeatureArtZoomOpacity() {
    return 1;
  }

  function featureArtDrawBox(hex, index) {
    const zoomScale = getFeatureArtZoomScale();
    const size = (index === 0 ? 94 : 74) * zoomScale;
    const offsetY = (index === 0 ? -46 : -34 + index * 8) * zoomScale;
    return {
      x: hex.center.x - size / 2,
      y: hex.center.y + offsetY,
      width: size,
      height: size
    };
  }

  function applyFeatureArtSizeMultiplier(box, featureId) {
    const multiplier = ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "marsh"].includes(featureId) ? 0.9 : 1;
    const width = box.width * multiplier;
    const height = box.height * multiplier;
    return {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height
    };
  }

  function renderSvg({ width, height }, visibleHexes) {
    const visibleWidth = width / renderer.view.zoom;
    const visibleHeight = height / renderer.view.zoom;
    renderer.svg.setAttribute("viewBox", `${renderer.view.panX} ${renderer.view.panY} ${visibleWidth} ${visibleHeight}`);
    renderer.svg.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const gridPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    gridPath.setAttribute("class", "generated-map-grid-lines");
    gridPath.setAttribute("d", buildGridPath(visibleHexes));
    fragment.appendChild(gridPath);

    renderGeographicRegionOverlay(fragment, visibleHexes);
    renderDrawableOverlays(fragment, visibleHexes);
    renderPoliticalRegionBorders(fragment, visibleHexes);
    renderRegionLabels(fragment, visibleHexes);
    if (shouldRenderRouteLabels()) {
      renderRouteLabels(fragment);
    }
    if (renderer.drawing.visibleOverlays.pois) {
      renderPoiMarkers(fragment, visibleHexes);
    }

    if (renderer.view.zoom >= COORD_LABEL_MIN_ZOOM) {
      visibleHexes.forEach(hex => {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const dimensions = getGeneratedMapDimensions();
        text.setAttribute("class", "generated-map-coord-label");
        text.setAttribute("x", hex.center.x);
        text.setAttribute("y", hex.center.y - dimensions.hexHeight * 0.28);
        text.setAttribute("font-size", String(dimensions.radius * 0.20));
        text.textContent = hex.label;
        fragment.appendChild(text);
      });
    }

    const activeHex = renderer.hexes.find(hex => hex.id === renderer.hoveredHexId || hex.id === renderer.selectedHexId);
    if (activeHex) {
      const selected = activeHex.id === renderer.selectedHexId;
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("class", selected ? "generated-map-selected-hex" : "generated-map-hovered-hex");
      polygon.setAttribute("points", activeHex.points.map(point => `${point.x},${point.y}`).join(" "));
      fragment.appendChild(polygon);
    }

    renderDrawingGuides(fragment, visibleHexes);

    renderer.svg.appendChild(fragment);
  }

  function renderDrawableOverlays(fragment, visibleHexes) {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    const overlays = renderer.mapOverlays || [];

    overlays.filter(overlay => renderer.drawing.visibleOverlays.wall && overlay.Overlay_Type === "wall" && visibleIds.has(overlay.Hex_ID_Ref)).forEach(overlay => {
      const hex = renderer.hexes.find(candidate => candidate.id === overlay.Hex_ID_Ref);
      if (!hex) return;

      const edgeIndex = EDGE_NAMES.indexOf(overlay.Edge);
      if (edgeIndex < 0) return;

      const edge = { a: hex.points[edgeIndex], b: hex.points[(edgeIndex + 1) % hex.points.length] };
      ["base", "body", "crenellations"].forEach(layer => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", `generated-map-drawn-wall generated-map-drawn-wall-${layer}`);
        path.setAttribute("d", pathCommand(edge.a, edge.b));
        fragment.appendChild(path);
      });
    });
  }

  function renderDrawingGuides(fragment, visibleHexes) {
    if (!renderer.drawing.enabled) return;

    renderActivePathReveal(fragment);

    const pendingId = PATH_OVERLAY_TYPES.has(renderer.drawing.tool) ? renderer.drawing.lastHexId : null;
    const pendingHex = pendingId ? visibleHexes.find(hex => hex.id === pendingId) : null;
    if (pendingHex) {
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("class", "generated-map-drawing-pending");
      polygon.setAttribute("points", pendingHex.points.map(point => `${point.x},${point.y}`).join(" "));
      fragment.appendChild(polygon);
    }

    if (renderer.drawing.tool === "erase" && renderer.drawing.hoverEraseHexId) {
      renderEraseOverlayPreview(fragment, renderer.drawing.hoverEraseHexId);
    }

    if (renderer.drawing.tool === "mist" && renderer.drawing.hoverMistHexIds?.length) {
      renderMistBrushPreview(fragment, visibleHexes);
    }

    if ((renderer.drawing.tool === "terrain" || renderer.drawing.tool === "terrain-eyedropper" || renderer.drawing.tool === "feature" || renderer.drawing.tool === "feature-erase" || renderer.drawing.tool === "feature-eyedropper") && renderer.drawing.hoverBrushHexIds?.length) {
      renderEditorBrushPreview(fragment, visibleHexes);
    }

    if ((renderer.drawing.tool === "wall" || PATH_OVERLAY_TYPES.has(renderer.drawing.tool)) && renderer.drawing.hoverEdge) {
      const hex = renderer.hexes.find(candidate => candidate.id === renderer.drawing.hoverEdge.hexId);
      const edgeIndex = EDGE_NAMES.indexOf(renderer.drawing.hoverEdge.edge);
      if (hex && edgeIndex >= 0) {
        const edge = { a: hex.points[edgeIndex], b: hex.points[(edgeIndex + 1) % hex.points.length] };
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "generated-map-drawing-edge-preview");
        path.setAttribute("d", pathCommand(edge.a, edge.b));
        fragment.appendChild(path);
      }
    }
  }

  function renderPoiMarkers(fragment, visibleHexes) {
    visibleHexes.forEach(hex => {
      const pois = renderer.poisByHexId.get(hex.id) || renderer.poisByHexId.get(hex.label);
      if (!pois?.length) return;

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

      group.setAttribute("class", "generated-map-poi-marker");
      circle.setAttribute("class", "generated-map-poi-bg");
      circle.setAttribute("cx", hex.center.x);
      circle.setAttribute("cy", hex.center.y - 22);
      circle.setAttribute("r", "14");

      text.setAttribute("class", "generated-map-poi-symbol");
      text.setAttribute("x", hex.center.x);
      text.setAttribute("y", hex.center.y - 21);
      text.textContent = pois.length > 1 ? String(Math.min(pois.length, 9)) : getPoiGlyph(pois[0]);

      group.appendChild(circle);
      group.appendChild(text);
      fragment.appendChild(group);
    });
  }

  function renderGeographicRegionOverlay(fragment, visibleHexes) {
    if (!renderer.drawing.visibleOverlays.geographic) return;

    const borderSegments = [];
    const drawn = new Set();

    visibleHexes.forEach(hex => {
      const fill = getRegionBorderColor(hex.regionId);
      if (!fill) return;

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("class", "generated-map-geographic-region-fill");
      polygon.setAttribute("fill", fill);
      polygon.setAttribute("points", hex.points.map(point => `${point.x},${point.y}`).join(" "));
      fragment.appendChild(polygon);

      EDGE_NAMES.forEach((edgeName, index) => {
        const neighbor = getNeighborHex(hex, edgeName);
        if (neighbor?.regionId === hex.regionId) return;

        const edge = { a: hex.points[index], b: hex.points[(index + 1) % hex.points.length] };
        const key = edgeKey(edge.a, edge.b);
        if (drawn.has(key)) return;
        drawn.add(key);

        borderSegments.push({
          edge,
          color: fill
        });
      });
    });

    const commandsByColor = new Map();
    borderSegments.forEach(({ edge, color }) => {
      addRegionBorderCommand(commandsByColor, color, pathCommand(edge.a, edge.b));
    });

    commandsByColor.forEach((commands, stroke) => {
      if (!commands.length) return;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "generated-map-geographic-region-outline");
      path.setAttribute("stroke", stroke);
      path.setAttribute("d", commands.join(" "));
      fragment.appendChild(path);
    });
  }

  function renderPoliticalRegionBorders(fragment, visibleHexes) {
    if (!renderer.drawing.visibleOverlays.political) return;
    renderRegionBorders(fragment, visibleHexes, {
      getRegionId: hex => hex.politicalRegionId,
      treatUnclaimed: false
    });
  }

  function renderRegionLabels(fragment, visibleHexes) {
    const occupiedLabelBoxes = [];

    if (renderer.drawing.visibleOverlays.politicalLabels) {
      renderRegionLabelLayer(fragment, renderer.hexes, {
        className: "generated-map-region-label generated-map-political-region-label",
        fontSize: 30,
        strokeWidth: 6,
        getRegionId: hex => hex.politicalRegionId,
        skipRegion: () => false,
        occupiedLabelBoxes
      });
    }

    if (renderer.drawing.visibleOverlays.geographicLabels) {
      renderRegionLabelLayer(fragment, renderer.hexes, {
        className: "generated-map-region-label generated-map-geographic-region-label",
        fontSize: 20,
        strokeWidth: 5,
        getRegionId: hex => hex.regionId,
        skipRegion: regionId => isUnclaimedRegion(regionId),
        occupiedLabelBoxes
      });
    }
  }

  function renderMistBrushPreview(fragment, visibleHexes) {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    renderer.drawing.hoverMistHexIds
      .map(hexId => renderer.hexes.find(hex => hex.id === hexId))
      .filter(hex => hex && visibleIds.has(hex.id))
      .forEach(hex => {
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("class", "generated-map-mist-brush-preview");
        polygon.setAttribute("points", hex.points.map(point => `${point.x},${point.y}`).join(" "));
        fragment.appendChild(polygon);
      });
  }

  function renderEditorBrushPreview(fragment, visibleHexes) {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    const previewClass = renderer.drawing.tool === "feature"
      ? "generated-map-editor-brush-preview generated-map-feature-brush-preview"
      : "generated-map-editor-brush-preview generated-map-terrain-brush-preview";
    renderer.drawing.hoverBrushHexIds
      .map(hexId => renderer.hexes.find(hex => hex.id === hexId))
      .filter(hex => hex && visibleIds.has(hex.id))
      .forEach(hex => {
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("class", previewClass);
        polygon.setAttribute("points", hex.points.map(point => `${point.x},${point.y}`).join(" "));
        fragment.appendChild(polygon);
      });
  }

  function renderRouteLabels(fragment) {
    getCachedRouteLabels().forEach(label => {
      if (label.kind === "icon") {
        renderRouteIcon(fragment, label);
        return;
      }
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", `generated-map-route-label generated-map-route-label-${label.type}`);
      text.setAttribute("x", label.x);
      text.setAttribute("y", label.y);
      text.setAttribute("transform", `rotate(${label.angle} ${label.x} ${label.y})`);
      text.textContent = label.text;
      fragment.appendChild(text);
    });
  }

  function renderRouteIcon(fragment, label) {
    const asset = renderer.routeIconAssets.get(label.type);
    if (!asset) return;
    const radius = getGeneratedMapDimensions().radius;
    const size = radius * (label.type === "road" ? 1.24 : 1.08);
    const scale = size / Math.max(asset.width, asset.height);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `generated-map-route-icon generated-map-route-icon-${label.type}`);
    group.setAttribute("transform", [
      `translate(${label.x} ${label.y})`,
      `rotate(${label.iconAngle ?? label.angle})`,
      `scale(${scale})`,
      `translate(${-asset.width / 2} ${-asset.height / 2})`
    ].join(" "));
    group.style.color = getRouteIconColor(label.type);
    group.innerHTML = asset.body;
    fragment.appendChild(group);
  }

  function getRouteIconColor(type) {
    if (type === "road") return "#f1d58a";
    if (type === "river") return "#d9f5ff";
    return "#efe4b0";
  }

  function getCachedRouteLabels() {
    const key = buildRouteLabelCacheKey();
    if (renderer.routeLabelCache?.key === key) return renderer.routeLabelCache.labels;
    const labels = buildRouteLabelEntries();
    renderer.routeLabelCache = { key, labels };
    return labels;
  }

  function buildRouteLabelCacheKey() {
    const visible = renderer.drawing.visibleOverlays;
    const routeRows = (renderer.mapOverlays || [])
      .filter(overlay => ["road", "river", "sea_route"].includes(overlay.Overlay_Type))
      .map(overlay => [
        overlay.__uuid,
        overlay.Overlay_Type,
        overlay.From_Hex_ID_Ref,
        overlay.To_Hex_ID_Ref,
        overlay.Edge,
        overlay.Style,
        overlay.Is_Major_Route ? 1 : 0,
        overlay.Route_Name || ""
      ].join(":"))
      .sort()
      .join("|");
    return [
      visible.road ? 1 : 0,
      visible.river ? 1 : 0,
      visible.sea_route ? 1 : 0,
      routeRows
    ].join("::");
  }

  function buildRouteLabelEntries() {
    const overlays = renderer.mapOverlays || [];
    const labelPaths = [];

    if (renderer.drawing.visibleOverlays.road) {
      connectedPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "road" && overlay.Is_Major_Route && overlay.Route_Name), "road").forEach(pathData => {
        labelPaths.push({ ...pathData, type: "road" });
      });
    }

    if (renderer.drawing.visibleOverlays.river) {
      getCanvasRiverPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "river" && overlay.Is_Major_Route && overlay.Route_Name)).forEach(pathData => {
        labelPaths.push({ ...pathData, type: "river" });
      });
    }

    if (renderer.drawing.visibleOverlays.sea_route) {
      connectedPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "sea_route" && overlay.Route_Name), "sea_route").forEach(pathData => {
        labelPaths.push({ ...pathData, type: "sea_route" });
      });
    }

    return filterOverlappingRouteLabels(labelPaths.flatMap(pathData => {
      const placements = getRouteLabelPlacements(pathData.d);
      return [
        ...placements.labels.map(anchor => ({
          ...anchor,
          type: pathData.type,
          text: pathData.routeName,
          kind: "text"
        })),
        ...placements.icons.map(anchor => ({
          ...anchor,
          type: pathData.type,
          text: pathData.routeName,
          kind: "icon",
          iconAngle: getRouteIconAngle(pathData.type, anchor.angle)
        }))
      ];
    }));
  }

  function getRouteIconAngle(type, pathAngle) {
    const baseOffset = type === "road" ? 0 : 0;
    return pathAngle + baseOffset;
  }

  function filterOverlappingRouteLabels(labels) {
    const radius = getGeneratedMapDimensions().radius;
    const placed = [];
    labels.forEach(label => {
      const box = getRouteLabelBox(label, radius);
      if (placed.some(existing => boxesOverlap(box, existing.box))) return;
      placed.push({ ...label, box });
    });
    return placed.map(({ box, ...label }) => label);
  }

  function getRouteLabelBox(label, radius) {
    const width = label.kind === "icon"
      ? radius * 2.1
      : Math.max(radius * 3.8, String(label.text || "").length * radius * 0.36);
    const height = label.kind === "icon" ? radius * 1.8 : radius * 0.95;
    const padding = radius * 0.95;
    return {
      left: label.x - width / 2 - padding,
      right: label.x + width / 2 + padding,
      top: label.y - height / 2 - padding,
      bottom: label.y + height / 2 + padding
    };
  }

  function boxesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function getRouteLabelPlacements(pathData) {
    const points = parseSvgPathCommands(pathData)
      .map(command => ({ x: command.x, y: command.y }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (points.length < 2) return { labels: [], icons: [] };

    const segments = [];
    let totalLength = 0;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length <= 0) continue;
      segments.push({ from, to, length, start: totalLength });
      totalLength += length;
    }
    if (!segments.length) return { labels: [], icons: [] };

    const repeatDistance = getGeneratedMapDimensions().radius * 20;
    const labelCount = Math.max(1, Math.floor(totalLength / repeatDistance));
    const labelTargets = [];
    for (let index = 0; index < labelCount; index += 1) {
      labelTargets.push(totalLength * ((index + 1) / (labelCount + 1)));
    }
    const virtualTargets = [0, ...labelTargets, totalLength];
    const iconTargets = virtualTargets.slice(0, -1)
      .map((target, index) => (target + virtualTargets[index + 1]) / 2)
      .filter(target => target > totalLength * 0.08 && target < totalLength * 0.92);
    return {
      labels: labelTargets.map(target => getRouteAnchorAtDistance(segments, target)),
      icons: iconTargets.map(target => getRouteAnchorAtDistance(segments, target))
    };
  }

  function getRouteAnchorAtDistance(segments, target) {
    const segment = segments.find(candidate => target >= candidate.start && target <= candidate.start + candidate.length) || segments[Math.floor(segments.length / 2)];
    const t = Math.max(0, Math.min(1, (target - segment.start) / segment.length));
    let angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * t,
      y: segment.from.y + (segment.to.y - segment.from.y) * t,
      angle
    };
  }

  function renderCanvasMistOverlays(ctx) {
    const image = getFeatureArtImage(FEATURE_ART_FILES.mist, "#f0f0e8");
    if (!image) return;

    (renderer.mapOverlays || [])
      .filter(overlay => overlay.Overlay_Type === "mist" && overlay.Hex_ID_Ref)
      .forEach(overlay => {
        const hex = hexForPathPoint(overlay.Hex_ID_Ref);
        if (!hex) return;
        const box = applyFeatureArtSizeMultiplier(featureArtDrawBox(hex, 0), "mist");
        drawFeatureArtImage(ctx, image, box, FEATURE_ART_OPACITY.mist || 0.24);
      });
  }

  function renderEraseOverlayPreview(fragment, hexId) {
    const overlays = getOverlaysAtHex(hexId);
    overlays.forEach(overlay => {
      if (overlay.Overlay_Type === "wall") {
        renderWallErasePreview(fragment, overlay);
        return;
      }

      if (overlay.Overlay_Type === "mist") {
        renderMistErasePreview(fragment, overlay);
        return;
      }

      renderPathErasePreview(fragment, overlay);
    });
  }

  function renderWallErasePreview(fragment, overlay) {
    const hex = hexForPathPoint(overlay.Hex_ID_Ref);
    const edgeIndex = EDGE_NAMES.indexOf(overlay.Edge);
    if (!hex || edgeIndex < 0) return;

    const edge = { a: hex.points[edgeIndex], b: hex.points[(edgeIndex + 1) % hex.points.length] };
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "generated-map-erase-preview generated-map-erase-preview-wall");
    path.setAttribute("d", pathCommand(edge.a, edge.b));
    fragment.appendChild(path);
  }

  function renderMistErasePreview(fragment, overlay) {
    const hex = hexForPathPoint(overlay.Hex_ID_Ref);
    if (!hex) return;

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("class", "generated-map-erase-preview generated-map-erase-preview-mist");
    polygon.setAttribute("points", hex.points.map(point => `${point.x},${point.y}`).join(" "));
    fragment.appendChild(polygon);
  }

  function renderPathErasePreview(fragment, overlay) {
    if (!PATH_OVERLAY_TYPES.has(overlay.Overlay_Type)) return;
    const d = overlay.To_Hex_ID_Ref
      ? pathForEraseOverlaySegment(overlay)
      : pathForExitSegment(overlay, overlay.Overlay_Type);
    if (!d) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `generated-map-erase-preview generated-map-erase-preview-${overlay.Overlay_Type}`);
    path.setAttribute("d", d);
    fragment.appendChild(path);
  }

  function renderActivePathReveal(fragment) {
    const reveal = renderer.drawing.activePathReveal;
    if (!reveal?.visibleSequence?.length || reveal.visibleSequence.length < 2) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `generated-map-drawn-${reveal.tool} generated-map-path-reveal`);
    path.setAttribute("d", getRevealPathData(reveal));
    path.setAttribute("fill", "none");
    if (reveal.tool === "sea_route") {
      path.setAttribute("stroke", "rgba(236, 227, 176, 0.72)");
    } else if (reveal.tool !== "river") {
      path.setAttribute("stroke", ROAD_STYLE_COLORS[getOverlayBaseStyle(reveal.style)] || ROAD_STYLE_COLORS.dark_brown);
    }
    fragment.appendChild(path);
  }

  function getRevealPathData(reveal) {
    if (reveal.tool === "sea_route") {
      return connectedPathStrings(sequenceToPreviewSegments(reveal.visibleSequence, "sea_route", reveal.style), "sea_route")
        .map(pathData => pathData.d)
        .join(" ");
    }
    return pathForPointChain(reveal.visibleSequence, reveal.tool, new Map());
  }

  function sequenceToPreviewSegments(sequence, tool, style) {
    return sequence.slice(0, -1).map((hexId, index) => ({
      __uuid: `preview-${index}`,
      Overlay_Type: tool,
      From_Hex_ID_Ref: hexId,
      To_Hex_ID_Ref: sequence[index + 1],
      Hex_ID_Ref: "",
      Edge: "",
      Style: style || tool,
      Is_Major_Route: tool === "sea_route",
      Route_Name: ""
    }));
  }

  function renderRegionLabelLayer(fragment, visibleHexes, options) {
    const groups = groupVisibleHexesByRegion(visibleHexes, options.getRegionId, options.skipRegion);
    groups.forEach((hexes, regionId) => {
      const region = db?.regionsById?.[regionId];
      const name = region?.Region_Name || regionId;
      if (!name) return;

      const anchor = getRegionLabelAnchor(hexes, name, regionId, options);
      if (!anchor) return;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", options.className);
      text.setAttribute("x", anchor.x);
      text.setAttribute("y", anchor.y);
      text.setAttribute("font-size", String(options.fontSize / REGION_LABEL_REFERENCE_ZOOM));
      text.setAttribute("stroke-width", String(options.strokeWidth / REGION_LABEL_REFERENCE_ZOOM));
      text.textContent = name;
      fragment.appendChild(text);
      options.occupiedLabelBoxes?.push({
        x: anchor.x,
        y: anchor.y,
        halfWidth: anchor.halfWidth,
        halfHeight: anchor.halfHeight
      });
    });
  }

  function groupVisibleHexesByRegion(visibleHexes, getRegionId, skipRegion) {
    const groups = new Map();
    visibleHexes.forEach(hex => {
      const regionId = getRegionId(hex);
      if (!regionId || skipRegion(regionId)) return;
      if (!groups.has(regionId)) groups.set(regionId, []);
      groups.get(regionId).push(hex);
    });
    return groups;
  }

  function getRegionLabelAnchor(hexes, label = "", regionId = "", options = {}) {
    if (!hexes.length) return null;

    const centroid = hexes.reduce((total, hex) => ({
      x: total.x + hex.center.x,
      y: total.y + hex.center.y
    }), { x: 0, y: 0 });
    centroid.x /= hexes.length;
    centroid.y /= hexes.length;

    const poiCenters = getPoiCentersForRegion(regionId, hexes);
    const dimensions = getGeneratedMapDimensions();
    const { halfWidth: labelHalfWidth, halfHeight: labelHalfHeight } = getRegionLabelMetrics(label, options.fontSize);
    const preferredClearance = Math.max(labelHalfWidth * 0.55, dimensions.radius * 4.4);

    return hexes.reduce((best, hex) => {
      const nearestPoiDistance = getNearestPoiDistance(hex.center, poiCenters);
      const centerDistance = Math.hypot(hex.center.x - centroid.x, hex.center.y - centroid.y);
      const overlapPenalty = getLabelPoiOverlapPenalty(hex.center, poiCenters, labelHalfWidth, labelHalfHeight);
      const labelOverlapPenalty = getLabelBoxOverlapPenalty(hex.center, options.occupiedLabelBoxes || [], labelHalfWidth, labelHalfHeight);
      const clearancePenalty = Math.max(0, preferredClearance - nearestPoiDistance) * 18;
      const directHitPenalty = renderer.poiHexIds.has(hex.id) || renderer.poiHexIds.has(hex.label)
        ? preferredClearance * 12
        : 0;
      const score = centerDistance + clearancePenalty + directHitPenalty + overlapPenalty + labelOverlapPenalty;
      return !best || score < best.score
        ? { x: hex.center.x, y: hex.center.y, halfWidth: labelHalfWidth, halfHeight: labelHalfHeight, score }
        : best;
    }, null);
  }

  function getRegionLabelMetrics(label = "", fontSize = 20) {
    const dimensions = getGeneratedMapDimensions();
    const fontScale = Math.max(0.85, Number(fontSize || 20) / 20);
    return {
      halfWidth: Math.max(
        dimensions.radius * 2.8,
        Math.min(dimensions.radius * 9.6, String(label).length * dimensions.radius * 0.34 * fontScale)
      ),
      halfHeight: dimensions.hexHeight * (fontScale > 1.1 ? 0.9 : 0.72)
    };
  }

  function getPoiCentersForRegion(regionId, regionHexes) {
    return [...renderer.poiHexIds]
      .map(hexId => renderer.hexes.find(hex => hex.id === hexId || hex.label === hexId)?.center)
      .filter(Boolean);
  }

  function getLabelPoiOverlapPenalty(anchor, poiCenters, halfWidth, halfHeight) {
    return poiCenters.reduce((penalty, poi) => {
      const dx = Math.abs(poi.x - anchor.x);
      const dy = Math.abs(poi.y - anchor.y);
      const insideLabelBox = dx < halfWidth && dy < halfHeight;
      const nearLabelBox = dx < halfWidth * 1.25 && dy < halfHeight * 1.6;

      if (insideLabelBox) return penalty + halfWidth * 42;
      if (nearLabelBox) return penalty + halfWidth * 14;
      return penalty;
    }, 0);
  }

  function getLabelBoxOverlapPenalty(anchor, occupiedBoxes, halfWidth, halfHeight) {
    return occupiedBoxes.reduce((penalty, box) => {
      const dx = Math.abs(box.x - anchor.x);
      const dy = Math.abs(box.y - anchor.y);
      const overlapX = halfWidth + box.halfWidth - dx;
      const overlapY = halfHeight + box.halfHeight - dy;
      const nearX = dx < (halfWidth + box.halfWidth) * 1.18;
      const nearY = dy < (halfHeight + box.halfHeight) * 1.55;

      if (overlapX > 0 && overlapY > 0) {
        return penalty + (overlapX + overlapY) * 120;
      }
      if (nearX && nearY) {
        return penalty + halfWidth * 24;
      }
      return penalty;
    }, 0);
  }

  function getNearestPoiDistance(point, poiCenters) {
    if (!poiCenters.length) return Infinity;
    return poiCenters.reduce((nearest, poi) => {
      return Math.min(nearest, Math.hypot(point.x - poi.x, point.y - poi.y));
    }, Infinity);
  }

  function renderRegionBorders(fragment, visibleHexes, options = {}) {
    const getRegionId = options.getRegionId || (hex => hex.regionId);
    const treatUnclaimed = options.treatUnclaimed !== false;
    const borderSegments = [];
    const drawn = new Set();

    visibleHexes.forEach(hex => {
      const regionId = getRegionId(hex);
      if (!regionId) return;

      EDGE_NAMES.forEach((edgeName, index) => {
        const neighbor = getNeighborHex(hex, edgeName);
        const neighborRegionId = neighbor ? getRegionId(neighbor) : "";
        if (neighborRegionId === regionId) return;

        const edge = { a: hex.points[index], b: hex.points[(index + 1) % hex.points.length] };
        const key = edgeKey(edge.a, edge.b);
        if (drawn.has(key)) return;
        drawn.add(key);

        borderSegments.push({
          edge,
          regionColor: getRegionBorderColor(regionId),
          neighborColor: neighborRegionId ? getRegionBorderColor(neighborRegionId) : "",
          regionUnclaimed: treatUnclaimed ? isUnclaimedRegion(regionId) : false,
          neighborUnclaimed: neighborRegionId ? (treatUnclaimed ? isUnclaimedRegion(neighborRegionId) : false) : true
        });
      });
    });

    const glowCommandsByColor = new Map();
    const lineCommandsByColor = new Map();

    borderSegments.forEach(segment => {
      addRegionBorderSegment(glowCommandsByColor, lineCommandsByColor, segment);
    });

    glowCommandsByColor.forEach((commands, stroke) => {
      if (!commands.length) return;

      const glowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glowPath.setAttribute("class", "generated-map-region-border-glow");
      glowPath.setAttribute("stroke", stroke);
      glowPath.setAttribute("d", commands.join(" "));
      fragment.appendChild(glowPath);
    });

    lineCommandsByColor.forEach((commands, stroke) => {
      if (!commands.length) return;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "generated-map-region-borders");
      path.setAttribute("stroke", stroke);
      path.setAttribute("d", commands.join(" "));
      fragment.appendChild(path);
    });
  }

  function addRegionBorderSegment(glowCommandsByColor, lineCommandsByColor, segment) {
    const { edge, regionColor, neighborColor, regionUnclaimed, neighborUnclaimed } = segment;

    if (regionUnclaimed && neighborUnclaimed) return;
    if (regionUnclaimed || !regionColor) {
      addRegionBorderCommand(glowCommandsByColor, neighborColor, pathCommand(edge.a, edge.b));
      addRegionBorderCommand(lineCommandsByColor, neighborColor, pathCommand(edge.a, edge.b));
      return;
    }
    if (neighborUnclaimed || !neighborColor) {
      addRegionBorderCommand(glowCommandsByColor, regionColor, pathCommand(edge.a, edge.b));
      addRegionBorderCommand(lineCommandsByColor, regionColor, pathCommand(edge.a, edge.b));
      return;
    }

    if (regionColor === neighborColor) {
      addRegionBorderCommand(glowCommandsByColor, regionColor, pathCommand(edge.a, edge.b));
      addRegionBorderCommand(lineCommandsByColor, regionColor, pathCommand(edge.a, edge.b));
      return;
    }

    const split = splitSharedBorder(edge);
    addRegionBorderCommand(glowCommandsByColor, regionColor, pathCommand(split.region.a, split.region.b));
    addRegionBorderCommand(glowCommandsByColor, neighborColor, pathCommand(split.neighbor.a, split.neighbor.b));
    addRegionBorderCommand(lineCommandsByColor, regionColor, pathCommand(split.region.a, split.region.b));
    addRegionBorderCommand(lineCommandsByColor, neighborColor, pathCommand(split.neighbor.a, split.neighbor.b));
  }

  function addRegionBorderCommand(commandsByColor, stroke, command) {
    if (!stroke || !command) return;
    if (!commandsByColor.has(stroke)) commandsByColor.set(stroke, []);
    commandsByColor.get(stroke).push(command);
  }

  function splitSharedBorder(edge) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const length = Math.hypot(dx, dy) || 1;
    const offsetX = (-dy / length) * 2.4;
    const offsetY = (dx / length) * 2.4;

    return {
      region: {
        a: { x: edge.a.x + offsetX, y: edge.a.y + offsetY },
        b: { x: edge.b.x + offsetX, y: edge.b.y + offsetY }
      },
      neighbor: {
        a: { x: edge.a.x - offsetX, y: edge.a.y - offsetY },
        b: { x: edge.b.x - offsetX, y: edge.b.y - offsetY }
      }
    };
  }

  function pathCommand(a, b) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  function pathPointForHexId(hexId) {
    return renderer.hexes.find(hex => hex.id === hexId)?.center || null;
  }

  function hexForPathPoint(hexId) {
    return renderer.hexes.find(hex => hex.id === hexId) || null;
  }

  function getHexEdgeSegment(hex, edgeName) {
    const edgeIndex = EDGE_NAMES.indexOf(edgeName);
    if (!hex || edgeIndex < 0) return null;
    return {
      a: hex.points[edgeIndex],
      b: hex.points[(edgeIndex + 1) % hex.points.length]
    };
  }

  function getHexEdgeExitPoint(hex, edgeName) {
    const edge = getHexEdgeSegment(hex, edgeName);
    if (!edge) return null;

    const midpoint = {
      x: (edge.a.x + edge.b.x) / 2,
      y: (edge.a.y + edge.b.y) / 2
    };
    return midpoint;
  }

  function overlaySegmentPoints(segment, type) {
    const from = renderer.hexes.find(hex => hex.id === segment.From_Hex_ID_Ref);
    const to = renderer.hexes.find(hex => hex.id === segment.To_Hex_ID_Ref);
    if (!from || !to) return null;

    return { from: from.center, to: to.center };
  }

  function isWaterHex(hex) {
    return RIVER_WATER_TERRAINS.has(hex?.baseTerrain);
  }

  function isInlandWaterHex(hex) {
    return hex?.baseTerrain === "inland_water";
  }

  function isRiverTradeContinuationWaterHex(hex) {
    return ["inland_water", "coastal_water"].includes(hex?.baseTerrain);
  }

  function canRoadCrossWaterHex(hex) {
    return ["inland_water", "coastal_water"].includes(hex?.baseTerrain);
  }

  function canSeaRouteUseHex(hex) {
    return Boolean(hex && (isWaterHex(hex) || isSeaRouteCoastalAnchor(hex)));
  }

  function isSeaRouteCoastalAnchor(hex) {
    if (!hex || isWaterHex(hex)) return false;
    return EDGE_NAMES.some(edgeName => isWaterHex(getNeighborHex(hex, edgeName)));
  }

  function normalizeSeaRouteSequence(sequence, exitEdge = "") {
    const route = (sequence || []).filter(Boolean);
    if (!route.length) return { sequence: [], exitEdge: "" };

    const firstHex = hexForPathPoint(route[0]);
    const lastHex = hexForPathPoint(route[route.length - 1]);
    if (!canSeaRouteUseHex(firstHex) || !canSeaRouteUseHex(lastHex)) return { sequence: [], exitEdge: "" };
    if (exitEdge) return { sequence: route, exitEdge };
    if (route.length < 2) return { sequence: [], exitEdge: "" };

    const middleHexes = route.slice(1, -1).map(hexForPathPoint);
    if (!middleHexes.every(isWaterHex)) return { sequence: [], exitEdge: "" };
    if (route.length === 2 && !isWaterHex(firstHex) && !isWaterHex(lastHex)) return { sequence: [], exitEdge: "" };
    return { sequence: route, exitEdge: "" };
  }

  function pointWhereLineLeavesHex(hex, targetPoint) {
    const center = hex.center;
    const dx = targetPoint.x - center.x;
    const dy = targetPoint.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    const dimensions = getGeneratedMapDimensions();
    const distance = dimensions.radius * 0.78;
    return {
      x: center.x + (dx / length) * distance,
      y: center.y + (dy / length) * distance
    };
  }

  function buildSegmentGraph(segments) {
    const graph = new Map();
    segments.forEach(segment => {
      if (!pathPointForHexId(segment.From_Hex_ID_Ref) || !pathPointForHexId(segment.To_Hex_ID_Ref)) return;
      if (!graph.has(segment.From_Hex_ID_Ref)) graph.set(segment.From_Hex_ID_Ref, new Set());
      if (!graph.has(segment.To_Hex_ID_Ref)) graph.set(segment.To_Hex_ID_Ref, new Set());
      graph.get(segment.From_Hex_ID_Ref).add(segment.To_Hex_ID_Ref);
      graph.get(segment.To_Hex_ID_Ref).add(segment.From_Hex_ID_Ref);
    });
    return graph;
  }

  function overlayEdgeVisitKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function tracePathChain(start, next, graph, visited) {
    const chain = [start, next];
    visited.add(overlayEdgeVisitKey(start, next));

    let previous = start;
    let current = next;

    while ((graph.get(current)?.size || 0) === 2) {
      const onward = [...graph.get(current)].find(hexId => hexId !== previous);
      if (!onward || visited.has(overlayEdgeVisitKey(current, onward))) break;
      chain.push(onward);
      visited.add(overlayEdgeVisitKey(current, onward));
      previous = current;
      current = onward;
    }

    return chain;
  }

  function pathForPointChain(chain, type, segmentByEdge) {
    const snapHexIds = getSnapHexIdsForPathType(type);
    const pointRecords = chain.map((hexId, index) => {
      let point = null;
      if (snapHexIds.has(hexId)) point = pathPointForHexId(hexId);
      else if (["road", "path"].includes(type)) point = getTransportChainPoint(hexId, index, chain, type);
      else if (type !== "river" || index !== 0 && index !== chain.length - 1) point = pathPointForHexId(hexId);
      else {
        const neighborId = index === 0 ? chain[1] : chain[index - 1];
        const segment = segmentByEdge.get(overlayEdgeVisitKey(hexId, neighborId));
        if (!segment) point = pathPointForHexId(hexId);
        else {
          const segmentPoints = overlaySegmentPoints(segment, type);
          point = segmentPoints
            ? segment.From_Hex_ID_Ref === hexId ? segmentPoints.from : segmentPoints.to
            : pathPointForHexId(hexId);
        }
      }

      return point ? { hexId, point } : null;
    }).filter(Boolean);

    const shapedPointRecords = getJitteredPathPointRecords(pointRecords, type, snapHexIds);
    const points = getWobbledPathPoints(shapedPointRecords, type, snapHexIds);

    if (points.length < 2) return "";
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    const commands = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      if (snapHexIds.has(shapedPointRecords[i].hexId)) {
        commands.push(`L ${current.x} ${current.y}`);
        continue;
      }

      const next = points[i + 1];
      const mid = {
        x: current.x + (next.x - current.x) * 0.42,
        y: current.y + (next.y - current.y) * 0.42
      };
      commands.push(`Q ${current.x} ${current.y} ${mid.x} ${mid.y}`);
    }
    const last = points[points.length - 1];
    commands.push(`T ${last.x} ${last.y}`);
    return commands.join(" ");
  }

  function getWobbledPathPoints(pointRecords, type, snapHexIds) {
    if (pointRecords.length < 3 || !PATH_OVERLAY_TYPES.has(type)) {
      return pointRecords.map(record => record.point);
    }

    const dimensions = getGeneratedMapDimensions();
    const routeSeed = `${type}:${pointRecords[0].hexId}:${pointRecords[pointRecords.length - 1].hexId}:${pointRecords.length}`;
    const routeWindiness = type === "path" && seededPathFloat(`${routeSeed}:wild-route`) > 0.68 ? 1.75 : 1;
    const typeModifier = type === "river" ? 1.55 : type === "path" ? 1.05 * routeWindiness : 1;
    return pointRecords.map((record, index) => {
      const point = record.point;
      if (index === 0 || index === pointRecords.length - 1 || snapHexIds.has(record.hexId)) return point;

      const previous = pointRecords[index - 1]?.point;
      const next = pointRecords[index + 1]?.point;
      const dx = (next?.x || point.x) - (previous?.x || point.x);
      const dy = (next?.y || point.y) - (previous?.y || point.y);
      const length = Math.hypot(dx, dy);
      if (!length) return point;

      const strength = getPathWobbleStrength(record.hexId, pointRecords[index - 1]?.hexId, pointRecords[index + 1]?.hexId, type);
      if (!strength) return point;

      const seed = `${type}:${pointRecords[index - 1]?.hexId}:${record.hexId}:${pointRecords[index + 1]?.hexId}`;
      const direction = seededPathFloat(seed) < 0.5 ? -1 : 1;
      const variance = 0.45 + seededPathFloat(`${seed}:variance`) * 0.55;
      const pointWindiness = getElevationDeltaForPathPoint(record.hexId, pointRecords[index - 1]?.hexId, pointRecords[index + 1]?.hexId) >= STEEP_ROUTE_ELEVATION_DELTA
        ? type === "road" ? 1.35 : 1.55
        : type === "path" && seededPathFloat(`${seed}:wild-point`) > 0.76 ? 1.45 : 1;
      const distance = dimensions.radius * strength * typeModifier * pointWindiness * variance;
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;

      return {
        x: point.x + perpendicularX * distance * direction,
        y: point.y + perpendicularY * distance * direction
      };
    });
  }

  function getJitteredPathPointRecords(pointRecords, type, snapHexIds) {
    if (pointRecords.length < 3) return pointRecords;
    if (!["path", "river", "road"].includes(type)) return pointRecords;

    return pointRecords.map((record, index) => {
      if (index === 0 || index === pointRecords.length - 1 || snapHexIds.has(record.hexId)) return record;
      if (type === "road" && !isRoughPathHex(record.hexId) && getElevationDeltaForPathPoint(record.hexId, pointRecords[index - 1]?.hexId, pointRecords[index + 1]?.hexId) < STEEP_ROUTE_ELEVATION_DELTA) return record;

      const seed = `${type}-jitter:${pointRecords[index - 1]?.hexId}:${record.hexId}:${pointRecords[index + 1]?.hexId}`;
      const roll = seededPathFloat(seed);
      if (roll < 0.34) return record;

      const cornerPoint = getPathEntryCornerPoint(record.hexId, pointRecords[index - 1]?.hexId, seed);
      if (!cornerPoint) return record;

      const centerWeight = roll > 0.86 ? 0.08 : 0.18 + seededPathFloat(`${seed}:inset`) * 0.16;
      return {
        ...record,
        point: {
          x: cornerPoint.x + (record.point.x - cornerPoint.x) * centerWeight,
          y: cornerPoint.y + (record.point.y - cornerPoint.y) * centerWeight
        }
      };
    });
  }

  function isRoughPathHex(hexId) {
    const hex = hexForPathPoint(hexId);
    if (!hex) return false;
    return ROUGH_PATH_BASE_TERRAINS.has(hex.baseTerrain)
      || (hex.features || []).some(feature => ROUGH_PATH_FEATURES.has(feature));
  }

  function getPathEntryCornerPoint(hexId, previousHexId, seed) {
    const hex = hexForPathPoint(hexId);
    const previous = hexForPathPoint(previousHexId);
    if (!hex || !previous) return null;

    let bestEdgeIndex = -1;
    let bestDistance = Infinity;
    hex.points.forEach((point, index) => {
      const next = hex.points[(index + 1) % hex.points.length];
      const midpoint = {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2
      };
      const distance = Math.hypot(midpoint.x - previous.center.x, midpoint.y - previous.center.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEdgeIndex = index;
      }
    });

    if (bestEdgeIndex < 0) return null;
    const edgeCorners = [
      hex.points[bestEdgeIndex],
      hex.points[(bestEdgeIndex + 1) % hex.points.length]
    ];
    return edgeCorners[seededPathFloat(`${seed}:corner`) < 0.5 ? 0 : 1];
  }

  function getPathWobbleStrength(hexId, previousHexId, nextHexId, type = "path") {
    const hex = hexForPathPoint(hexId);
    if (!hex) return PATH_WOBBLE_BASE;

    let strength = PATH_WOBBLE_BASE;
    if (ROUGH_PATH_BASE_TERRAINS.has(hex.baseTerrain)) strength += 0.045;
    if ((hex.features || []).some(feature => ROUGH_PATH_FEATURES.has(feature))) strength += 0.07;

    const neighboringElevations = [hexForPathPoint(previousHexId), hexForPathPoint(nextHexId)]
      .map(neighbor => Number(neighbor?.elevation))
      .filter(Number.isFinite);
    if (neighboringElevations.length) {
      const steepestChange = Math.max(...neighboringElevations.map(elevation => Math.abs(elevation - Number(hex.elevation || 0))));
      const elevationWeight = type === "path" ? 0.04 : type === "road" ? 0.032 : 0.02;
      strength += Math.min(0.12, steepestChange * elevationWeight);
    }

    return Math.min(PATH_WOBBLE_MAX, strength);
  }

  function getElevationDeltaForPathPoint(hexId, previousHexId, nextHexId) {
    const hex = hexForPathPoint(hexId);
    if (!hex) return 0;
    return Math.max(getElevationDelta(hex, hexForPathPoint(previousHexId)), getElevationDelta(hex, hexForPathPoint(nextHexId)));
  }

  function getElevationDelta(a, b) {
    if (!a || !b) return 0;
    const first = Number(a.elevation || 0);
    const second = Number(b.elevation || 0);
    return Number.isFinite(first) && Number.isFinite(second) ? Math.abs(first - second) : 0;
  }

  function getOverlayBaseStyle(style) {
    return String(style || "")
      .split(OVERLAY_STYLE_FLAG_SEPARATOR)
      .map(part => part.trim())
      .filter(Boolean)[0] || "";
  }

  function getOverlayStyleFlags(style) {
    return new Set(
      String(style || "")
        .split(OVERLAY_STYLE_FLAG_SEPARATOR)
        .slice(1)
        .map(part => part.trim())
        .filter(Boolean)
    );
  }

  function overlayHasStyleFlag(overlay, flag) {
    return getOverlayStyleFlags(overlay?.Style).has(flag);
  }

  function composeOverlayStyle(baseStyle, flags = []) {
    return [baseStyle, ...flags]
      .map(part => String(part || "").trim())
      .filter(Boolean)
      .join(OVERLAY_STYLE_FLAG_SEPARATOR);
  }

  function getCurrentDrawOverlayStyle(tool) {
    if (tool === "sea_route") return "sea_route";
    if (tool === "river") {
      return composeOverlayStyle("river", renderer.drawing.autoFalls === false
        ? [OVERLAY_STYLE_FLAGS.riverNoAutoFalls]
        : []);
    }

    const baseStyle = renderer.drawing.roadStyle || "dark_brown";
    if (tool === "road") {
      const flags = [];
      if (renderer.drawing.roadWaterOverride) flags.push(OVERLAY_STYLE_FLAGS.roadWaterOverride);
      if (renderer.drawing.autoPass === false) flags.push(OVERLAY_STYLE_FLAGS.roadNoAutoPass);
      return composeOverlayStyle(baseStyle, flags);
    }
    return baseStyle;
  }

  function getCurrentRouteMetadata(tool) {
    const routeName = String(getCurrentRouteName(tool) || "").trim();
    if (tool === "sea_route") {
      return { isMajorRoute: true, routeName };
    }
    if (tool === "road" || tool === "river") {
      const isMajorRoute = getCurrentRouteMajor(tool);
      return {
        isMajorRoute,
        routeName: isMajorRoute ? routeName : ""
      };
    }
    return { isMajorRoute: false, routeName: "" };
  }

  function getPersistedSegmentTool(tool, fromHexId, toHexId) {
    return tool;
  }

  function getSegmentRouteMetadata(tool, routeMetadata) {
    if (tool === "sea_route") {
      return {
        isMajorRoute: true,
        routeName: routeMetadata.routeName || String(renderer.drawing.roadRouteName || "").trim()
      };
    }
    return routeMetadata;
  }

  function seededPathFloat(seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function connectedPathStrings(segments, type, breakHexIds = new Set()) {
    const groups = new Map();
    segments.forEach(segment => {
      const style = type === "river" ? "river" : segment.Style || "dark_brown";
      const key = `${style}::${segment.Is_Major_Route ? "major" : "minor"}::${segment.Route_Name || ""}`;
      if (!groups.has(key)) groups.set(key, { style, isMajor: Boolean(segment.Is_Major_Route), routeName: segment.Route_Name || "", segments: [] });
      groups.get(key).segments.push(segment);
    });

    const paths = [];

    groups.forEach(group => {
      const groupSegments = group.segments;
      if (type === "path" || type === "road") {
        getWaterCutoffPathStrings(groupSegments, type, breakHexIds).forEach(pathData => {
          paths.push({
            d: pathData.d,
            style: group.style,
            isMajor: group.isMajor,
            routeName: group.routeName,
            isExit: pathData.isExit,
            isSteepRoadPass: pathData.isSteepRoadPass
          });
        });
        return;
      }

      const graph = buildSegmentGraph(groupSegments);
      const visited = new Set();
      const routeSegments = groupSegments.filter(segment => segment.To_Hex_ID_Ref);
      const exitSegments = groupSegments.filter(segment => !segment.To_Hex_ID_Ref && segment.Edge);
      const segmentByEdge = new Map(routeSegments.map(segment => [
        overlayEdgeVisitKey(segment.From_Hex_ID_Ref, segment.To_Hex_ID_Ref),
        segment
      ]));

      const starts = [...graph.keys()].filter(hexId => (graph.get(hexId)?.size || 0) !== 2);
      starts.forEach(start => {
        [...graph.get(start)].forEach(next => {
          if (visited.has(overlayEdgeVisitKey(start, next))) return;
          paths.push({ d: pathForPointChain(tracePathChain(start, next, graph, visited), type, segmentByEdge), style: group.style, isMajor: group.isMajor, routeName: group.routeName });
        });
      });

      routeSegments.forEach(segment => {
        if (visited.has(overlayEdgeVisitKey(segment.From_Hex_ID_Ref, segment.To_Hex_ID_Ref))) return;
        paths.push({
          d: pathForPointChain(tracePathChain(segment.From_Hex_ID_Ref, segment.To_Hex_ID_Ref, graph, visited), type, segmentByEdge),
          style: group.style,
          isMajor: group.isMajor,
          routeName: group.routeName
        });
      });

      exitSegments.forEach(segment => {
        paths.push({ d: pathForExitSegment(segment, type), style: group.style, isMajor: group.isMajor, routeName: group.routeName, isExit: true });
      });
    });

    return paths.filter(path => path.d);
  }

  function pathForExitSegment(segment, type) {
    const hex = hexForPathPoint(segment.From_Hex_ID_Ref);
    const exitPoint = getHexEdgeExitPoint(hex, segment.Edge);
    if (!hex || !exitPoint) return "";

    const records = [
      { hexId: `${hex.id}:inner-exit`, point: hex.center },
      { hexId: `${hex.id}:edge-${segment.Edge}`, point: exitPoint }
    ];
    const points = getWobbledPathPoints(records, type, new Set());
    if (points.length < 2) return "";
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  function pathForEraseOverlaySegment(overlay) {
    const type = overlay.Overlay_Type;
    if (type === "river" || type === "path" || (type === "road" && !overlayHasStyleFlag(overlay, OVERLAY_STYLE_FLAGS.roadWaterOverride))) {
      const paths = getWaterCutoffPathStrings([overlay], type);
      return paths.map(path => path.d).filter(Boolean).join(" ");
    }

    return pathForPointChain([overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref], type, new Map([[overlayEdgeVisitKey(overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref), overlay]]));
  }

  function getOverlaysAtHex(hexId) {
    if (!hexId) return [];
    return (renderer.mapOverlays || []).filter(overlay => (
      overlay.From_Hex_ID_Ref === hexId ||
      overlay.To_Hex_ID_Ref === hexId ||
      overlay.Hex_ID_Ref === hexId
    ));
  }

  function getMistBrushHexIds(centerHex) {
    if (!centerHex) return [];
    const radius = Math.max(0, (renderer.drawing.mistBrushSize || 1) - 1);
    const noise = Math.max(0, Math.min(90, renderer.drawing.mistNoise || 0)) / 100;
    return getHexesInRange(centerHex, radius)
      .filter(hex => {
        if (hex.id === centerHex.id || noise <= 0) return true;
        const roll = seededPathFloat(`mist:${centerHex.id}:${hex.id}:${renderer.drawing.mistBrushSize}:${renderer.drawing.mistNoise}`);
        return roll >= noise;
      })
      .map(hex => hex.id);
  }

  function getHexesInRange(centerHex, radius) {
    const visited = new Map([[centerHex.id, centerHex]]);
    let frontier = [centerHex];

    for (let distance = 0; distance < radius; distance += 1) {
      const nextFrontier = [];
      frontier.forEach(hex => {
        EDGE_NAMES.forEach(edgeName => {
          const neighbor = getNeighborHex(hex, edgeName);
          if (!neighbor || visited.has(neighbor.id)) return;
          visited.set(neighbor.id, neighbor);
          nextFrontier.push(neighbor);
        });
      });
      frontier = nextFrontier;
    }

    return [...visited.values()].sort((a, b) => (
      Math.hypot(a.center.x - centerHex.center.x, a.center.y - centerHex.center.y) -
      Math.hypot(b.center.x - centerHex.center.x, b.center.y - centerHex.center.y)
    ));
  }

  function renderRoadWaterCrossingDecorations(ctx, segments) {
    getRoadWaterCrossings(segments).forEach(crossing => {
      crossing.landHexes.forEach(landHex => {
        const polygon = roadWaterCrossingTrapezoid(crossing.waterHex, landHex);
        if (!polygon) return;
        drawCanvasPolygon(ctx, polygon, landHex.fill || "#8f985c", 0.82);
      });
    });
  }

  function renderMajorRoadRiverBridges(ctx, overlays) {
    if (!renderer.drawing.visibleOverlays.river) return;
    const majorRoadPaths = connectedPathStrings(
      overlays.filter(overlay => overlay.Overlay_Type === "road" && overlay.Is_Major_Route && !isAutoPassRoadSegment(overlay)),
      "road"
    );
    const riverPaths = getCanvasRiverPathStrings(overlays.filter(overlay => overlay.Overlay_Type === "river"));
    if (!majorRoadPaths.length || !riverPaths.length) return;

    const roadSegments = majorRoadPaths.flatMap(pathData => pathToLineSegments(pathData.d));
    const riverSegments = riverPaths.flatMap(pathData => pathToLineSegments(pathData.d));
    const radius = getGeneratedMapDimensions().radius;
    const bridgeHalfLength = radius * 0.34;
    const drawn = new Set();

    roadSegments.forEach(roadSegment => {
      riverSegments.forEach(riverSegment => {
        const point = lineIntersectionPoint(roadSegment.a, roadSegment.b, riverSegment.a, riverSegment.b);
        if (!point) return;
        const key = `${Math.round(point.x / 4)}:${Math.round(point.y / 4)}`;
        if (drawn.has(key)) return;
        drawn.add(key);

        const dx = roadSegment.b.x - roadSegment.a.x;
        const dy = roadSegment.b.y - roadSegment.a.y;
        const length = Math.hypot(dx, dy) || 1;
        const from = {
          x: point.x - dx / length * bridgeHalfLength,
          y: point.y - dy / length * bridgeHalfLength
        };
        const to = {
          x: point.x + dx / length * bridgeHalfLength,
          y: point.y + dy / length * bridgeHalfLength
        };
        const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
        drawCanvasOverlayPath(ctx, path, {
          stroke: "rgba(88, 86, 78, 0.92)",
          width: 14,
          dash: [],
          lineCap: "butt"
        });
        drawCanvasOverlayPath(ctx, path, {
          stroke: "rgba(190, 184, 166, 0.72)",
          width: 10,
          dash: [3, 4],
          lineCap: "butt"
        });
      });
    });
  }

  function renderMajorRiverWaterContinuations(ctx, segments) {
    const continuationSegments = segments
      .filter(segment => segment.Is_Major_Route && segmentTouchesRiverTradeContinuationWater(segment));

    // Water continuations should read as smooth blending, not terrain-driven river jitter.
    connectedPathStrings(continuationSegments, "sea_route").forEach(pathData => {
      if (!pathData.d) return;
      drawCanvasOverlayPath(ctx, pathData.d, {
        stroke: "#37b8e8",
        width: 7,
        dash: [12, 8],
        lineCap: "round"
      });
      drawCanvasOverlayPath(ctx, pathData.d, {
        stroke: "rgba(218, 247, 255, 0.72)",
        width: 2.5,
        dash: [12, 8],
        lineCap: "round"
      });
    });
  }

  function segmentTouchesRiverTradeContinuationWater(segment) {
    const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
    const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
    return isRiverTradeContinuationWaterHex(fromHex) || isRiverTradeContinuationWaterHex(toHex);
  }

  function pathToLineSegments(pathData) {
    const points = parseSvgPathCommands(pathData)
      .map(command => ({ x: command.x, y: command.y }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    const segments = [];
    for (let index = 1; index < points.length; index += 1) {
      segments.push({ a: points[index - 1], b: points[index] });
    }
    return segments;
  }

  function lineIntersectionPoint(a, b, c, d) {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 0.001) return null;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y)
    };
  }

  function renderRoadWaterCrossingLines(ctx, segments) {
    getRoadWaterCrossings(segments).forEach(crossing => {
      const points = crossing.landHexes
        .map(landHex => roadWaterCrossingShorePoint(crossing.waterHex, landHex))
        .filter(Boolean);
      if (points.length < 2) return;

      const style = getOverlayBaseStyle(crossing.style) || "dark_brown";
      drawCanvasOverlayPath(ctx, `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`, {
        stroke: ROAD_STYLE_COLORS[style] || ROAD_STYLE_COLORS.dark_brown,
        width: 4,
        dash: [8, 6],
        alpha: 0.58
      });
    });
  }

  function renderSteepRoadPassSegments(ctx, segments) {
    segments.forEach(segment => {
      const d = pathForStraightOverlaySegment(segment);
      if (!d) return;
      drawCanvasOverlayPath(ctx, d, {
        stroke: ROAD_STYLE_COLORS[getOverlayBaseStyle(segment.Style)] || ROAD_STYLE_COLORS.dark_brown,
        width: 4.5,
        dash: [10, 5, 3, 5]
      });
    });
  }

  function isAutoPassRoadSegment(segment) {
    if (!segment || segment.Overlay_Type !== "road" || !segment.To_Hex_ID_Ref) return false;
    if (overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride)) return false;
    if (overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadNoAutoPass)) return false;
    const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
    const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
    if (!fromHex || !toHex) return false;
    if (isRoadPassHex(fromHex) && isRoadPassHex(toHex)) return true;
    return isRoadPassHex(fromHex) && hasRoadPassNeighbor(fromHex, toHex.id)
      || isRoadPassHex(toHex) && hasRoadPassNeighbor(toHex, fromHex.id);
  }

  function isRoadPassHex(hex) {
    if (!hex) return false;
    const features = hex.features || [];
    if (features.some(feature => ROAD_PASS_FEATURES.has(feature))) return true;
    if (!features.includes("ridges")) return false;
    return ROAD_PASS_RIDGE_BASE_TERRAINS.has(hex.baseTerrain)
      || Number(hex.elevation || 0) >= 2
      || hasCoreRoadPassNeighbor(hex);
  }

  function hasCoreRoadPassNeighbor(hex) {
    return EDGE_NAMES.some(edgeName => {
      const neighbor = getNeighborHex(hex, edgeName);
      return Boolean(neighbor && (neighbor.features || []).some(feature => ROAD_PASS_FEATURES.has(feature)));
    });
  }

  function hasRoadPassNeighbor(hex, excludedHexId = "") {
    return EDGE_NAMES.some(edgeName => {
      const neighbor = getNeighborHex(hex, edgeName);
      return neighbor?.id !== excludedHexId && isRoadPassHex(neighbor);
    });
  }

  function pathForStraightOverlaySegment(segment) {
    const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
    const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
    if (!fromHex || !toHex) return "";
    return `M ${fromHex.center.x} ${fromHex.center.y} L ${toHex.center.x} ${toHex.center.y}`;
  }

  function getRoadWaterCrossings(segments) {
    const candidates = new Map();
    segments.forEach(segment => {
      if (!segment.To_Hex_ID_Ref) return;
      if (overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride)) return;
      const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
      const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
      if (!fromHex || !toHex) return;

      const waterHex = isWaterHex(fromHex) ? fromHex : isWaterHex(toHex) ? toHex : null;
      const landHex = waterHex === fromHex ? toHex : waterHex === toHex ? fromHex : null;
      if (!waterHex || !landHex || isWaterHex(landHex) || !canRoadCrossWaterHex(waterHex)) return;

      if (!candidates.has(waterHex.id)) {
        candidates.set(waterHex.id, {
          waterHex,
          landHexesById: new Map(),
          touchesWater: false,
          style: getOverlayBaseStyle(segment.Style) || "dark_brown"
        });
      }
      const candidate = candidates.get(waterHex.id);
      candidate.landHexesById.set(landHex.id, landHex);
      candidate.style = getOverlayBaseStyle(segment.Style) || candidate.style;
    });

    segments.forEach(segment => {
      if (!segment.To_Hex_ID_Ref) return;
      if (overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride)) return;
      const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
      const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
      if (!fromHex || !toHex || !isWaterHex(fromHex) || !isWaterHex(toHex)) return;
      if (candidates.has(fromHex.id)) candidates.get(fromHex.id).touchesWater = true;
      if (candidates.has(toHex.id)) candidates.get(toHex.id).touchesWater = true;
    });

    return [...candidates.values()]
      .filter(candidate => {
        const landHexes = [...candidate.landHexesById.values()];
        return !candidate.touchesWater
          && landHexes.length === 2
          && getElevationDelta(landHexes[0], landHexes[1]) <= ROAD_WATER_CROSSING_MAX_ELEVATION_DELTA;
      })
      .map(candidate => ({
        waterHex: candidate.waterHex,
        landHexes: [...candidate.landHexesById.values()].slice(0, 2),
        style: candidate.style
      }));
  }

  function roadWaterCrossingTrapezoid(waterHex, landHex) {
    const edge = getSharedEdgeTowardNeighbor(waterHex, landHex);
    if (!edge) return null;

    const midpoint = {
      x: (edge.a.x + edge.b.x) / 2,
      y: (edge.a.y + edge.b.y) / 2
    };
    const depth = getGeneratedMapDimensions().radius * 0.48;
    const dx = waterHex.center.x - midpoint.x;
    const dy = waterHex.center.y - midpoint.y;
    const length = Math.hypot(dx, dy) || 1;
    const innerMidpoint = {
      x: midpoint.x + (dx / length) * depth,
      y: midpoint.y + (dy / length) * depth
    };
    const halfInnerWidth = Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) * 0.22;
    const edgeDx = (edge.b.x - edge.a.x) / (Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) || 1);
    const edgeDy = (edge.b.y - edge.a.y) / (Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) || 1);

    return [
      edge.a,
      edge.b,
      {
        x: innerMidpoint.x + edgeDx * halfInnerWidth,
        y: innerMidpoint.y + edgeDy * halfInnerWidth
      },
      {
        x: innerMidpoint.x - edgeDx * halfInnerWidth,
        y: innerMidpoint.y - edgeDy * halfInnerWidth
      }
    ];
  }

  function roadWaterCrossingShorePoint(waterHex, landHex) {
    const edge = getSharedEdgeTowardNeighbor(waterHex, landHex);
    return edge
      ? { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 }
      : null;
  }

  function getSharedEdgeTowardNeighbor(hex, neighbor) {
    const edgeName = EDGE_NAMES.find(candidate => getNeighborHex(hex, candidate)?.id === neighbor?.id);
    return getHexEdgeSegment(hex, edgeName);
  }

  function getCanvasTransportPathStrings(segments, type) {
    return segments
      .map(segment => {
        const points = transportSegmentPoints(segment, type, segments);
        if (!points) return null;

        return {
          d: curvedSegmentPath(points.from, points.to, `${segment.__uuid || ""}:${segment.From_Hex_ID_Ref}:${segment.To_Hex_ID_Ref}`),
          style: segment.Style || "dark_brown"
        };
      })
      .filter(Boolean);
  }

  function transportSegmentPoints(segment, type, allSegments) {
    const from = renderer.hexes.find(hex => hex.id === segment.From_Hex_ID_Ref);
    const to = renderer.hexes.find(hex => hex.id === segment.To_Hex_ID_Ref);
    if (!from || !to) return null;

    const fromContinues = transportContinuesThroughWater(from, type, allSegments);
    const toContinues = transportContinuesThroughWater(to, type, allSegments);
    if (isWaterHex(from) && isWaterHex(to) && !fromContinues && !toContinues) return null;

    return {
      from: isWaterHex(from) && !fromContinues ? pointWhereLineLeavesHex(to, from.center) : from.center,
      to: isWaterHex(to) && !toContinues ? pointWhereLineLeavesHex(from, to.center) : to.center
    };
  }

  function transportContinuesThroughWater(hex, type, allSegments) {
    if (!isWaterHex(hex)) return true;
    return allSegments.filter(segment => (
      segment.Overlay_Type === type &&
      (segment.From_Hex_ID_Ref === hex.id || segment.To_Hex_ID_Ref === hex.id)
    )).length >= 2;
  }

  function getCanvasRiverPathStrings(segments) {
    const groups = new Map();
    segments.forEach(segment => {
      const key = `${segment.Is_Major_Route ? "major" : "minor"}::${segment.Route_Name || ""}`;
      if (!groups.has(key)) groups.set(key, { isMajor: Boolean(segment.Is_Major_Route), routeName: segment.Route_Name || "", segments: [] });
      groups.get(key).segments.push(segment);
    });

    return [...groups.values()].flatMap(group => (
      getWaterCutoffPathStrings(group.segments, "river").map(pathData => ({
        ...pathData,
        isMajor: group.isMajor,
        routeName: group.routeName
      }))
    ));
  }

  function getWaterCutoffPathStrings(segments, type, breakHexIds = new Set()) {
    const riverGraph = buildVisibleWaterCutoffGraph(segments, type, breakHexIds);
    const snapHexIds = getSnapHexIdsForPathType(type);
    const visited = new Set();
    const paths = [];

    const starts = [...riverGraph.graph.keys()].filter(nodeId => (riverGraph.graph.get(nodeId)?.size || 0) !== 2);
    starts.forEach(start => {
      [...riverGraph.graph.get(start)].forEach(next => {
        if (visited.has(overlayEdgeVisitKey(start, next))) return;
      const chain = traceRiverNodeChain(start, next, riverGraph.graph, visited);
      paths.push({
        d: pathForWaterCutoffNodeChain(chain, riverGraph.points, type, snapHexIds),
        isExit: chain.some(nodeId => String(nodeId).includes(":exit")),
        isSteepRoadPass: type === "road" && getChainMaxElevationDelta(chain, riverGraph.points) >= EXTREME_ROUTE_ELEVATION_DELTA
      });
      });
    });

    riverGraph.edges.forEach(edge => {
      if (visited.has(overlayEdgeVisitKey(edge.from, edge.to))) return;
      const chain = traceRiverNodeChain(edge.from, edge.to, riverGraph.graph, visited);
      paths.push({
        d: pathForWaterCutoffNodeChain(chain, riverGraph.points, type, snapHexIds),
        isExit: chain.some(nodeId => String(nodeId).includes(":exit")),
        isSteepRoadPass: type === "road" && getChainMaxElevationDelta(chain, riverGraph.points) >= EXTREME_ROUTE_ELEVATION_DELTA
      });
    });

    return paths.filter(path => path.d);
  }

  function buildVisibleWaterCutoffGraph(segments, type, breakHexIds = new Set()) {
    const graph = new Map();
    const points = new Map();
    const edges = [];
    segments.forEach(segment => {
      const fromHex = renderer.hexes.find(hex => hex.id === segment.From_Hex_ID_Ref);
      const toHex = renderer.hexes.find(hex => hex.id === segment.To_Hex_ID_Ref);
      if (!fromHex) return;
      if (!toHex && !segment.Edge) return;

      if (!toHex && segment.Edge) {
        const exitPoint = getHexEdgeExitPoint(fromHex, segment.Edge);
        if (!exitPoint) return;
        const exitNode = `${segment.__uuid || fromHex.id}:${segment.Edge}:exit`;
        points.set(fromHex.id, { hexId: fromHex.id, point: fromHex.center });
        points.set(exitNode, { hexId: exitNode, point: exitPoint });
        addGraphEdge(graph, fromHex.id, exitNode);
        edges.push({ from: fromHex.id, to: exitNode });
        return;
      }

      if (type === "road" && overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride)) {
        points.set(fromHex.id, { hexId: fromHex.id, point: fromHex.center });
        points.set(toHex.id, { hexId: toHex.id, point: toHex.center });
        addGraphEdge(graph, fromHex.id, toHex.id);
        edges.push({ from: fromHex.id, to: toHex.id });
        return;
      }

      if (type === "river" && isMajorRiverTradeContinuationSegment(segment, fromHex, toHex)) {
        points.set(fromHex.id, { hexId: fromHex.id, point: fromHex.center });
        points.set(toHex.id, { hexId: toHex.id, point: toHex.center });
        addGraphEdge(graph, fromHex.id, toHex.id);
        edges.push({ from: fromHex.id, to: toHex.id });
        return;
      }

      if (isWaterHex(fromHex) && isWaterHex(toHex)) return;

      const fromNode = isWaterHex(fromHex)
        ? `${segment.__uuid || segment.From_Hex_ID_Ref}:water-from`
        : fromHex.id;
      const toNode = isWaterHex(toHex)
        ? `${segment.__uuid || segment.To_Hex_ID_Ref}:water-to`
        : toHex.id;

      const fromPoint = isWaterHex(fromHex)
        ? getWaterCutoffEndpointPoint(type, fromHex, toHex)
        : fromHex.center;
      const toPoint = isWaterHex(toHex)
        ? getWaterCutoffEndpointPoint(type, toHex, fromHex)
        : toHex.center;

      points.set(fromNode, { hexId: fromHex.id, point: fromPoint });
      points.set(toNode, { hexId: toHex.id, point: toPoint });
      addGraphEdge(graph, fromNode, toNode);
      if (breakHexIds.has(fromHex.id)) addGraphBreakNode(graph, fromNode);
      if (breakHexIds.has(toHex.id)) addGraphBreakNode(graph, toNode);
      edges.push({ from: fromNode, to: toNode });
    });

    return { graph, points, edges };
  }

  function getWaterCutoffEndpointPoint(type, waterHex, landHex) {
    return pointWhereLineLeavesHex(landHex, waterHex.center);
  }

  function isMajorRiverTradeContinuationSegment(segment, fromHex, toHex) {
    return Boolean(
      segment?.Is_Major_Route &&
      fromHex &&
      toHex &&
      (isRiverTradeContinuationWaterHex(fromHex) || isRiverTradeContinuationWaterHex(toHex))
    );
  }

  function getChainMaxElevationDelta(chain, pointsByNodeId) {
    let maxDelta = 0;
    for (let index = 0; index < chain.length - 1; index += 1) {
      const current = hexForPathPoint(pointsByNodeId.get(chain[index])?.hexId);
      const next = hexForPathPoint(pointsByNodeId.get(chain[index + 1])?.hexId);
      maxDelta = Math.max(maxDelta, getElevationDelta(current, next));
    }
    return maxDelta;
  }

  function addGraphEdge(graph, from, to) {
    if (!from || !to || from === to) return;
    if (!graph.has(from)) graph.set(from, new Set());
    if (!graph.has(to)) graph.set(to, new Set());
    graph.get(from).add(to);
    graph.get(to).add(from);
  }

  function addGraphBreakNode(graph, nodeId) {
    if (!nodeId || !graph.has(nodeId)) return;
    graph.get(nodeId).add(`${nodeId}:break`);
  }

  function getAutoPassConnectorHexIds(passSegments, baseSegments) {
    const passHexIds = new Set(passSegments.flatMap(segment => [
      segment.From_Hex_ID_Ref,
      segment.To_Hex_ID_Ref
    ]).filter(Boolean));
    if (!passHexIds.size) return passHexIds;

    return new Set([...passHexIds].filter(hexId => baseSegments.some(segment => (
      segment.From_Hex_ID_Ref === hexId ||
      segment.To_Hex_ID_Ref === hexId
    ))));
  }

  function traceRiverNodeChain(start, next, graph, visited) {
    const chain = [start, next];
    visited.add(overlayEdgeVisitKey(start, next));

    let previous = start;
    let current = next;

    while ((graph.get(current)?.size || 0) === 2) {
      const onward = [...graph.get(current)].find(nodeId => nodeId !== previous);
      if (!onward || visited.has(overlayEdgeVisitKey(current, onward))) break;
      chain.push(onward);
      visited.add(overlayEdgeVisitKey(current, onward));
      previous = current;
      current = onward;
    }

    return chain;
  }

  function pathForWaterCutoffNodeChain(chain, pointsByNodeId, type, snapHexIds = new Set()) {
    const pointRecords = chain.map(nodeId => pointsByNodeId.get(nodeId)).filter(Boolean);
    const shapedPointRecords = getJitteredPathPointRecords(pointRecords, type, snapHexIds);
    const points = getWobbledPathPoints(shapedPointRecords, type, snapHexIds);
    if (points.length < 2) return "";
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    const commands = [`M ${points[0].x} ${points[0].y}`];
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      if (snapHexIds.has(shapedPointRecords[index].hexId)) {
        commands.push(`L ${current.x} ${current.y}`);
        continue;
      }

      const next = points[index + 1];
      const mid = {
        x: current.x + (next.x - current.x) * 0.42,
        y: current.y + (next.y - current.y) * 0.42
      };
      commands.push(`Q ${current.x} ${current.y} ${mid.x} ${mid.y}`);
    }
    const last = points[points.length - 1];
    commands.push(`T ${last.x} ${last.y}`);
    return commands.join(" ");
  }

  function curvedSegmentPath(from, to, seed) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const bend = Math.min(18, distance * 0.18);
    const direction = stableHash(seed) % 2 ? 1 : -1;
    const cx = (from.x + to.x) / 2 + (-dy / distance) * bend * direction;
    const cy = (from.y + to.y) / 2 + (dx / distance) * bend * direction;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  }

  function getRegionBorderColor(regionId) {
    if (!regionId || isUnclaimedRegion(regionId)) return "";

    const colorKey = String(db?.regionsById?.[regionId]?.Border_Color || "gold")
      .trim()
      .toLowerCase();
    if (colorKey === "none") return "";
    if (/^#[0-9a-f]{6}$/.test(colorKey)) return colorKey;
    return REGION_BORDER_COLORS[colorKey] || REGION_BORDER_COLORS.gold;
  }

  function isUnclaimedRegion(regionId) {
    return regionId === UNCLAIMED_REGION_REF || db?.regionsById?.[regionId]?.Region_ID === UNCLAIMED_REGION_REF;
  }

  function getPoiGlyph(poi) {
    const type = String(poi?.POI_Type || "")
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, "_");

    return POI_GLYPHS[type] || POI_GLYPHS[type.replaceAll("_", "")] || "✦";
  }

  function buildGridPath(hexes) {
    const drawn = new Set();
    const commands = [];

    hexes.forEach(hex => {
      hex.points.forEach((point, index) => {
        const next = hex.points[(index + 1) % hex.points.length];
        const key = edgeKey(point, next);
        if (drawn.has(key)) return;
        drawn.add(key);
        commands.push(`M ${point.x} ${point.y} L ${next.x} ${next.y}`);
      });
    });

    return commands.join(" ");
  }

  function getTransportChainPoint(hexId, index, chain, type) {
    const hex = renderer.hexes.find(candidate => candidate.id === hexId);
    if (!hex) return null;
    if (!isWaterHex(hex)) return hex.center;

    const sameTypeSegments = (renderer.mapOverlays || []).filter(overlay => overlay.Overlay_Type === type);
    if (transportContinuesThroughWater(hex, type, sameTypeSegments)) return hex.center;

    const neighborId = index === 0 ? chain[1] : chain[index - 1];
    const neighborHex = renderer.hexes.find(candidate => candidate.id === neighborId);
    if (!neighborHex || isWaterHex(neighborHex)) return null;

    return pointWhereLineLeavesHex(neighborHex, hex.center);
  }

  function getSnapHexIdsForPathType(type) {
    if (!["road", "path", "river"].includes(type)) return new Set();

    const counts = {
      road: new Map(),
      path: new Map(),
      river: new Map()
    };

    (renderer.mapOverlays || []).forEach(overlay => {
      if (!["road", "path", "river"].includes(overlay.Overlay_Type)) return;
      [overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref].forEach(hexId => {
        if (!hexId) return;
        const typeCounts = counts[overlay.Overlay_Type];
        typeCounts.set(hexId, (typeCounts.get(hexId) || 0) + 1);
      });
    });

    const snapHexIds = new Set();
    new Set([...counts.road.keys(), ...counts.path.keys(), ...counts.river.keys()]).forEach(hexId => {
      const roadCount = counts.road.get(hexId) || 0;
      const pathCount = counts.path.get(hexId) || 0;
      const riverCount = counts.river.get(hexId) || 0;
      if ((roadCount && pathCount) || roadCount >= 3 || pathCount >= 3) {
        snapHexIds.add(hexId);
      }
      if (riverCount >= 3) {
        snapHexIds.add(hexId);
      }
    });

    return snapHexIds;
  }

  function getVisibleBounds(buffer = getGeneratedMapDimensions().radius * 2) {
    const rect = renderer.root.getBoundingClientRect();
    return {
      left: renderer.view.panX - buffer,
      right: renderer.view.panX + (rect.width / renderer.view.zoom) + buffer,
      top: renderer.view.panY - buffer,
      bottom: renderer.view.panY + (rect.height / renderer.view.zoom) + buffer
    };
  }

  function getVisibleHexes() {
    const bounds = getVisibleBounds();
    return renderer.hexes.filter(hex => hexIntersectsBounds(hex, bounds));
  }

  function hexIntersectsBounds(hex, bounds) {
    return !(
      hex.center.x + getGeneratedMapDimensions().radius < bounds.left ||
      hex.center.x - getGeneratedMapDimensions().radius > bounds.right ||
      hex.center.y + getGeneratedMapDimensions().hexHeight * 0.5 < bounds.top ||
      hex.center.y - getGeneratedMapDimensions().hexHeight * 0.5 > bounds.bottom
    );
  }

  function edgeKey(a, b) {
    const first = `${Math.round(a.x * 100)}:${Math.round(a.y * 100)}`;
    const second = `${Math.round(b.x * 100)}:${Math.round(b.y * 100)}`;
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  }

  function clientToWorld(event) {
    const rect = renderer.root.getBoundingClientRect();
    return {
      x: renderer.view.panX + (event.clientX - rect.left) / renderer.view.zoom,
      y: renderer.view.panY + (event.clientY - rect.top) / renderer.view.zoom
    };
  }

  function worldToClient(point) {
    return {
      x: (point.x - renderer.view.panX) * renderer.view.zoom,
      y: (point.y - renderer.view.panY) * renderer.view.zoom
    };
  }

  function getHexAtWorldPoint(point) {
    return renderer.hexes.find(hex => pointInPolygon(point, hex.points)) || null;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function handleWheel(event) {
    if (!isActive()) return;
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (now < renderer.view.wheelLockedUntil) return;

    const nextZoom = getNextZoomStep(event.deltaY < 0 ? 1 : -1);
    renderer.view.wheelLockedUntil = now + 165;
    animateZoomTo(nextZoom, event.clientX, event.clientY);
  }

  function getNextZoomStep(direction) {
    const current = renderer.view.zoom;

    if (direction > 0) {
      return ZOOM_STEPS.find(step => step > current + 0.01) || MAX_ZOOM;
    }

    return [...ZOOM_STEPS].reverse().find(step => step < current - 0.01) || MIN_ZOOM;
  }

  function setZoom(nextZoom, anchorClientX = null, anchorClientY = null) {
    const rect = renderer.root.getBoundingClientRect();
    const oldZoom = renderer.view.zoom;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    const anchorX = anchorClientX == null ? rect.width / 2 : anchorClientX - rect.left;
    const anchorY = anchorClientY == null ? rect.height / 2 : anchorClientY - rect.top;
    const worldX = renderer.view.panX + anchorX / oldZoom;
    const worldY = renderer.view.panY + anchorY / oldZoom;

    renderer.view.zoom = clampedZoom;
    renderer.view.panX = worldX - anchorX / clampedZoom;
    renderer.view.panY = worldY - anchorY / clampedZoom;
    render();
  }

  function animateZoomTo(nextZoom, anchorClientX = null, anchorClientY = null) {
    const startZoom = renderer.view.zoom;
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    if (Math.abs(targetZoom - startZoom) < 0.0001) return;

    cancelZoomAnimation();

    const rect = renderer.root.getBoundingClientRect();
    const anchorScreenX = anchorClientX === null ? rect.left + rect.width / 2 : anchorClientX;
    const anchorScreenY = anchorClientY === null ? rect.top + rect.height / 2 : anchorClientY;
    const relativeX = anchorScreenX - rect.left;
    const relativeY = anchorScreenY - rect.top;
    const anchorWorldX = renderer.view.panX + relativeX / startZoom;
    const anchorWorldY = renderer.view.panY + relativeY / startZoom;
    const duration = 145;
    const startedAt = performance.now();

    renderer.view.animatingZoom = true;
    renderer.view.routeLabelsHiddenUntil = startedAt + duration + 160;
    scheduleRouteLabelRestore();

    function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const zoom = startZoom + (targetZoom - startZoom) * eased;

      renderer.view.zoom = zoom;
      renderer.view.panX = anchorWorldX - relativeX / zoom;
      renderer.view.panY = anchorWorldY - relativeY / zoom;
      clampView();
      render();

      if (progress < 1) {
        renderer.view.zoomAnimationFrame = requestAnimationFrame(step);
        return;
      }

      renderer.view.zoomAnimationFrame = null;
      renderer.view.animatingZoom = false;
      setZoom(targetZoom, anchorClientX, anchorClientY);
    }

    renderer.view.zoomAnimationFrame = requestAnimationFrame(step);
  }

  function cancelZoomAnimation() {
    if (renderer.view.zoomAnimationFrame) {
      cancelAnimationFrame(renderer.view.zoomAnimationFrame);
      renderer.view.zoomAnimationFrame = null;
    }
    renderer.view.animatingZoom = false;
  }

  function shouldRenderRouteLabels() {
    return !renderer.view.animatingZoom && performance.now() >= renderer.view.routeLabelsHiddenUntil;
  }

  function scheduleRouteLabelRestore() {
    clearRouteLabelRestoreTimer();
    const delay = Math.max(0, renderer.view.routeLabelsHiddenUntil - performance.now());
    renderer.view.routeLabelRestoreTimer = window.setTimeout(() => {
      renderer.view.routeLabelRestoreTimer = null;
      if (isActive()) renderSvgOnly();
    }, delay);
  }

  function clearRouteLabelRestoreTimer() {
    if (!renderer.view.routeLabelRestoreTimer) return;
    window.clearTimeout(renderer.view.routeLabelRestoreTimer);
    renderer.view.routeLabelRestoreTimer = null;
  }

  function rememberTouchPointer(event) {
    if (event.pointerType !== "touch") return false;

    renderer.view.touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (renderer.view.touchPointers.size >= 2) {
      clearTouchDrawIntent();
      beginPinchZoom();
      return true;
    }

    return renderer.view.pinching;
  }

  function updateTouchPointer(event) {
    if (event.pointerType !== "touch" || !renderer.view.touchPointers.has(event.pointerId)) {
      return false;
    }

    renderer.view.touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (renderer.view.pinching) {
      clearTouchDrawIntent();
      applyPinchZoom();
      return true;
    }

    return false;
  }

  function forgetTouchPointer(event) {
    if (event.pointerType !== "touch") return false;

    const wasPinching = renderer.view.pinching;
    renderer.view.touchPointers.delete(event.pointerId);

    if (wasPinching && renderer.view.touchPointers.size < 2) {
      endPinchZoom();
    }

    return wasPinching;
  }

  function getPinchPointers() {
    return [...renderer.view.touchPointers.values()].slice(0, 2);
  }

  function getPointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function getPointerMidpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }

  function beginPinchZoom() {
    const [first, second] = getPinchPointers();
    if (!first || !second) return;

    cancelZoomAnimation();

    const rect = renderer.root.getBoundingClientRect();
    const midpoint = getPointerMidpoint(first, second);
    const relativeX = midpoint.x - rect.left;
    const relativeY = midpoint.y - rect.top;

    renderer.view.pinching = true;
    renderer.view.dragging = false;
    renderer.view.dragMoved = true;
    renderer.view.animatingZoom = false;
    renderer.view.pinchStartDistance = Math.max(1, getPointerDistance(first, second));
    renderer.view.pinchStartZoom = renderer.view.zoom;
    renderer.view.pinchAnchorWorldX = renderer.view.panX + relativeX / renderer.view.zoom;
    renderer.view.pinchAnchorWorldY = renderer.view.panY + relativeY / renderer.view.zoom;
    renderer.view.suppressClickUntil = performance.now() + 450;

    renderer.drawing.dragLastHexId = null;
    renderer.drawing.paintedThisDrag = new Set();
  }

  function applyPinchZoom() {
    const [first, second] = getPinchPointers();
    if (!first || !second) return;

    const distance = Math.max(1, getPointerDistance(first, second));
    const ratio = distance / Math.max(1, renderer.view.pinchStartDistance);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, renderer.view.pinchStartZoom * ratio));
    const rect = renderer.root.getBoundingClientRect();
    const midpoint = getPointerMidpoint(first, second);
    const relativeX = midpoint.x - rect.left;
    const relativeY = midpoint.y - rect.top;

    renderer.view.zoom = nextZoom;
    renderer.view.panX = renderer.view.pinchAnchorWorldX - relativeX / nextZoom;
    renderer.view.panY = renderer.view.pinchAnchorWorldY - relativeY / nextZoom;
    renderer.view.dragMoved = true;
    renderer.view.suppressClickUntil = performance.now() + 450;

    clampView();
    render();
  }

  function endPinchZoom() {
    renderer.view.pinching = false;
    renderer.view.dragging = false;
    renderer.view.dragMoved = true;
    renderer.view.touchPointers.clear();
    renderer.view.suppressClickUntil = performance.now() + 450;
  }

  function handlePointerDown(event) {
    if (!isActive()) return;
    event.stopPropagation();

    if (rememberTouchPointer(event)) {
      event.preventDefault();
      renderer.root.setPointerCapture?.(event.pointerId);
      return;
    }

    cancelZoomAnimation();

    if (renderer.drawing.enabled && (event.pointerType === "touch" || !renderer.drawing.tool || event.button === 1 || event.button === 2)) {
      beginTouchDrawIntent(event);
      renderer.view.dragging = true;
      renderer.view.dragMoved = false;
      renderer.view.lastX = event.clientX;
      renderer.view.lastY = event.clientY;
      renderer.root.setPointerCapture?.(event.pointerId);
      return;
    }

    if (renderer.drawing.enabled && event.pointerType !== "touch") {
      event.preventDefault();
      renderer.root.setPointerCapture?.(event.pointerId);
      renderer.drawing.paintedThisDrag = new Set();
      beginDragActionBatch();
      applyDrawingAtEvent(event);
      renderer.view.suppressClickUntil = performance.now() + 450;
      return;
    }

    renderer.view.dragging = true;
    renderer.view.dragMoved = false;
    renderer.view.lastX = event.clientX;
    renderer.view.lastY = event.clientY;
    renderer.root.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isActive()) return;
    event.stopPropagation();

    if (updateTouchPointer(event)) {
      event.preventDefault();
      return;
    }

    if (renderer.drawing.touchDrawArmed && event.pointerId === renderer.drawing.touchDrawPointerId) {
      event.preventDefault();
      applyDrawingAtEvent(event, true);
      return;
    }

    cancelTouchDrawIntentOnMove(event);

    if (renderer.drawing.enabled && renderer.view.dragging) {
      const dx = event.clientX - renderer.view.lastX;
      const dy = event.clientY - renderer.view.lastY;
      renderer.view.lastX = event.clientX;
      renderer.view.lastY = event.clientY;
      renderer.view.panX -= dx / renderer.view.zoom;
      renderer.view.panY -= dy / renderer.view.zoom;
      renderer.view.dragMoved = renderer.view.dragMoved || Math.abs(dx) + Math.abs(dy) > 3;
      render();
      return;
    }

    if (renderer.drawing.enabled) {
      event.preventDefault();
      const hex = getHexAtWorldPoint(clientToWorld(event));
      const hoverPoint = clientToWorld(event);
      const nextHoverEdge = getDrawingHoverEdge(renderer.drawing.tool, hoverPoint, hex);
      const nextEraseHexId = renderer.drawing.tool === "erase" && hexHasEraseableOverlays(hex?.id) ? hex.id : null;
      const nextMistHexIds = renderer.drawing.tool === "mist" && hex
        ? getMistBrushHexIds(hex)
        : [];
      const nextBrushHexIds = getEditorBrushHexIds(hex);

      const hoverChanged = (
        JSON.stringify(renderer.drawing.hoverEdge) !== JSON.stringify(nextHoverEdge) ||
        renderer.drawing.hoverEraseHexId !== nextEraseHexId ||
        renderer.drawing.hoverMistHexIds.join("|") !== nextMistHexIds.join("|") ||
        renderer.drawing.hoverBrushHexIds.join("|") !== nextBrushHexIds.join("|")
      );
      renderer.drawing.hoverEdge = nextHoverEdge;
      renderer.drawing.hoverEraseHexId = nextEraseHexId;
      renderer.drawing.hoverMistHexIds = nextMistHexIds;
      renderer.drawing.hoverBrushHexIds = nextBrushHexIds;

      if (event.pointerType !== "touch" && (PATH_OVERLAY_TYPES.has(renderer.drawing.tool) || REGION_PAINT_TYPES.has(renderer.drawing.tool) || renderer.drawing.tool === "terrain" || renderer.drawing.tool === "feature" || renderer.drawing.tool === "feature-erase" || renderer.drawing.tool === "mist") && (event.buttons & 1) === 1) {
        applyDrawingAtEvent(event, true);
        return;
      }

      if (hoverChanged) renderSvgOnly();
      return;
    }

    if (renderer.view.dragging) {
      const dx = event.clientX - renderer.view.lastX;
      const dy = event.clientY - renderer.view.lastY;
      renderer.view.lastX = event.clientX;
      renderer.view.lastY = event.clientY;
      renderer.view.panX -= dx / renderer.view.zoom;
      renderer.view.panY -= dy / renderer.view.zoom;
      renderer.view.dragMoved = renderer.view.dragMoved || Math.abs(dx) + Math.abs(dy) > 3;
      render();
      return;
    }

    const hovered = getHexAtWorldPoint(clientToWorld(event));
    const nextHoverId = hovered?.id || null;
    if (renderer.hoveredHexId !== nextHoverId) {
      renderer.hoveredHexId = nextHoverId;
      render();
    }
  }

  function handlePointerUp(event) {
    if (!isActive()) return;
    event.stopPropagation();

    if (forgetTouchPointer(event)) {
      event.preventDefault();
      renderer.root.releasePointerCapture?.(event.pointerId);
      renderSvgOnly();
      return;
    }

    const wasTouchDrawing = renderer.drawing.touchDrawArmed && event.pointerId === renderer.drawing.touchDrawPointerId;
    clearTouchDrawIntent();
    if (wasTouchDrawing) {
      event.preventDefault();
      renderer.view.dragging = false;
      renderer.drawing.dragLastHexId = null;
      renderer.drawing.paintedThisDrag = new Set();
      scheduleDragActionBatchCommit();
      renderer.view.suppressClickUntil = performance.now() + 450;
      renderer.root.releasePointerCapture?.(event.pointerId);
      renderSvgOnly();
      return;
    }

    if (renderer.drawing.enabled) {
      renderer.view.dragging = false;
      renderer.drawing.dragLastHexId = null;
      renderer.drawing.paintedThisDrag = new Set();
      scheduleDragActionBatchCommit();
      renderer.root.releasePointerCapture?.(event.pointerId);
      renderSvgOnly();
      return;
    }
    renderer.view.dragging = false;
    renderer.root.releasePointerCapture?.(event.pointerId);
  }

  function handlePointerCancel(event) {
    handlePointerUp(event);
  }

  function clearEditorBrushHover() {
    if (!renderer.drawing.hoverMistHexIds.length && !renderer.drawing.hoverBrushHexIds.length) return;
    renderer.drawing.hoverMistHexIds = [];
    renderer.drawing.hoverBrushHexIds = [];
    renderSvgOnly();
  }

  function handleClick(event) {
    if (!isActive()) return;
    event.stopPropagation();

    if (renderer.view.pinching || performance.now() < renderer.view.suppressClickUntil) {
      event.preventDefault();
      return;
    }

    if (renderer.view.dragMoved) {
      renderer.view.dragMoved = false;
      return;
    }

    if (renderer.drawing.enabled && renderer.drawing.tool) {
      event.preventDefault();
      applyDrawingAtEvent(event);
      return;
    }

    const hex = getHexAtWorldPoint(clientToWorld(event));
    closePanel?.({ syncHistory: false });
    document.getElementById("codex-button")?.classList.remove("codex-label-visible");

    if (!hex) {
      clearSelection();
      selectedHexId = null;
      return;
    }

    selectGeneratedHex(hex.id, { detailsDisabled: renderer.drawing.enabled && !renderer.drawing.tool });
  }

  function applyDrawingAtEvent(event, fromDrag = false) {
    if (renderer.drawing.saving) return;
    blurRouteNameInput();

    const point = clientToWorld(event);
    const hex = getHexAtWorldPoint(point);
    if (!hex) return;

    const tool = renderer.drawing.tool;
    if (tool === "sea_route" && !canSeaRouteUseHex(hex)) return;
    const dragKey = `${tool}:${hex.id}`;
    if (fromDrag && renderer.drawing.paintedThisDrag.has(dragKey)) return;
    renderer.drawing.paintedThisDrag.add(dragKey);

    if (PATH_OVERLAY_TYPES.has(tool)) {
      const previousHexId = renderer.drawing.dragLastHexId || renderer.drawing.lastHexId;
      const exitEdge = !fromDrag ? getBorderExitEdgeAtPoint(point, hex) : "";
      renderer.drawing.dragLastHexId = hex.id;
      renderer.drawing.lastHexId = hex.id;
      if (!previousHexId || previousHexId === hex.id) {
        if (previousHexId === hex.id && exitEdge) {
          persistPathOverlaySequence(tool, hex.id, hex.id, exitEdge);
          return;
        }
        renderSvgOnly();
        return;
      }
      persistPathOverlaySequence(tool, previousHexId, hex.id, exitEdge);
      return;
    }

    if (tool === "wall") {
      persistWallOverlay(hex.id, nearestEdgeFromWorldPoint(point, hex));
      return;
    }

    if (tool === "mist") {
      persistMistBrush(hex);
      return;
    }

    if (tool === "region") {
      assignHexRegion(hex.id, renderer.drawing.regionId, "geographic");
      return;
    }

    if (tool === "unregion") {
      assignHexRegion(hex.id, UNCLAIMED_REGION_REF, "geographic");
      return;
    }

    if (tool === "political-region") {
      assignHexRegion(hex.id, renderer.drawing.politicalRegionId, "political");
      return;
    }

    if (tool === "clear-political-region") {
      assignHexRegion(hex.id, "", "political");
      return;
    }

    if (tool === "terrain") {
      updateGeneratedHexTerrainBrush(hex);
      return;
    }

    if (tool === "terrain-eyedropper") {
      pickTerrainFromHex(hex.id);
      return;
    }

    if (tool === "feature") {
      updateGeneratedHexFeatureBrush(hex);
      return;
    }

    if (tool === "feature-erase") {
      updateGeneratedHexFeatureEraseBrush(hex);
      return;
    }

    if (tool === "feature-eyedropper") {
      pickFeatureFromHex(hex.id);
      return;
    }

    if (tool === "erase") {
      eraseOverlaysAtHex(hex.id);
    }
  }

  function blurRouteNameInput() {
    const routeNameInput = document.getElementById("map-route-name");
    if (document.activeElement === routeNameInput) routeNameInput.blur();
  }

  function updateGeneratedHexTerrainBrush(centerHex) {
    const brushSize = resolveChaosNumber(renderer.drawing.terrainBrushSize, 1, 5, `terrain-size:${centerHex.id}`);
    const brushNoise = resolveChaosNumber(renderer.drawing.terrainNoise, 0, 90, `terrain-noise:${centerHex.id}`, 5);
    const targets = getBrushHexes(centerHex, brushSize, brushNoise, "terrain");
    const actions = [];

    for (const hex of targets) {
      const before = getTerrainSnapshot(hex.id);
      if (!before) continue;
      const targetBase = getTerrainBrushBase(hex, centerHex);
      const maxFeatures = resolveChaosNumber(renderer.drawing.terrainMaxFeatures, 0, 2, `terrain-max-features:${centerHex.id}:${hex.id}`);
      const featureDensity = resolveChaosNumber(renderer.drawing.terrainFeatureDensity, 5, 100, `terrain-feature-density-setting:${centerHex.id}:${hex.id}`, 5);
      const features = maxFeatures > 0 && shouldApplyTerrainFeatureDensity(centerHex, hex, featureDensity)
        ? generateFeaturesForTerrain(targetBase, renderer.drawing.terrainElevation, `${centerHex.id}:${hex.id}:terrain`, brushNoise, {
          hexId: hex.id,
          baseTerrain: targetBase,
          features: []
        }, maxFeatures)
        : [];
      const targetElevation = renderer.drawing.terrainElevation === "chaos"
        ? getChaosTerrainElevation(hex, centerHex)
        : renderer.drawing.terrainElevation === "auto"
        ? getAutoTerrainElevation(targetBase, features)
        : renderer.drawing.terrainElevation;
      const action = getTerrainUpdateAction(hex.id, {
        baseTerrain: targetBase,
        features,
        elevation: targetElevation
      }, before);
      if (!action) continue;
      applyLocalTerrainSnapshot(action.hexId, action.after);
      queueTerrainSave(action.hexId, action.after);
      actions.push(action);
    }
    pushBrushTerrainActions(actions);
    renderer.cacheDirty = true;
    render();
  }

  function getTerrainBrushBase(hex, centerHex) {
    if (renderer.drawing.terrainBase !== "chaos") return renderer.drawing.terrainBase;
    return CHAOS_BASE_TERRAIN_OPTIONS[stableHash(`chaos-terrain:${centerHex.id}:${hex.id}`) % CHAOS_BASE_TERRAIN_OPTIONS.length] || "plains";
  }

  function getChaosTerrainElevation(hex, centerHex) {
    return -2 + (stableHash(`chaos-elevation:${centerHex.id}:${hex.id}`) % 8);
  }

  function resolveChaosNumber(value, min, max, seed, step = 1) {
    if (value !== "chaos") return clampNumber(Number(value), min, max, min);
    const steps = Math.max(1, Math.floor((max - min) / step) + 1);
    return min + (stableHash(seed) % steps) * step;
  }

  function updateGeneratedHexFeatureBrush(centerHex) {
    const brush = FEATURE_BRUSH_OPTIONS.find(option => option.id === renderer.drawing.featureBrush) || FEATURE_BRUSH_OPTIONS[0];
    const brushSize = resolveChaosNumber(renderer.drawing.featureBrushSize, 1, 5, `feature-size:${centerHex.id}`);
    const brushNoise = resolveChaosNumber(renderer.drawing.featureNoise, 0, 90, `feature-noise:${centerHex.id}`, 5);
    const targets = getBrushHexes(centerHex, brushSize, brushNoise, "feature");
    const actions = [];

    for (const hex of targets) {
      const density = resolveChaosNumber(renderer.drawing.featureDensity, 5, 100, `feature-density-setting:${centerHex.id}:${hex.id}`, 5);
      if (!shouldApplyFeatureDensity(centerHex, hex, density)) continue;
      const before = getTerrainSnapshot(hex.id);
      if (!before) continue;
      const selectedFeature = brush.id === "clear" ? "" : chooseFeatureForBrush(before, brush, `${centerHex.id}:${hex.id}:feature`);
      if (brush.id !== "clear" && !selectedFeature) continue;
      const targetHex = brush.id === "clear" ? hex : getFeatureBrushTargetHex(hex, selectedFeature);
      if (!targetHex) continue;
      const targetBefore = targetHex.id === hex.id ? before : getTerrainSnapshot(targetHex.id);
      if (!targetBefore) continue;
      const features = brush.id === "clear"
        ? []
        : applySpecificFeatureToFeatures(targetBefore, selectedFeature, brush);
      if (!features) continue;
      const action = getTerrainUpdateAction(targetHex.id, {
        baseTerrain: targetBefore.baseTerrain,
        features,
        elevation: targetBefore.elevation
      }, targetBefore);
      if (!action) continue;
      applyLocalTerrainSnapshot(action.hexId, action.after);
      queueTerrainSave(action.hexId, action.after);
      actions.push(action);
    }
    pushBrushTerrainActions(actions);
    renderer.cacheDirty = true;
    render();
  }

  function updateGeneratedHexFeatureEraseBrush(centerHex) {
    const brushSize = resolveChaosNumber(renderer.drawing.featureBrushSize, 1, 5, `feature-erase-size:${centerHex.id}`);
    const brushNoise = resolveChaosNumber(renderer.drawing.featureNoise, 0, 90, `feature-erase-noise:${centerHex.id}`, 5);
    const targets = getBrushHexes(centerHex, brushSize, brushNoise, "feature-erase");
    const actions = [];

    for (const hex of targets) {
      const density = resolveChaosNumber(renderer.drawing.featureDensity, 5, 100, `feature-erase-density-setting:${centerHex.id}:${hex.id}`, 5);
      if (!shouldApplyFeatureDensity(centerHex, hex, density)) continue;
      const before = getTerrainSnapshot(hex.id);
      if (!before?.features?.length) continue;
      const action = getTerrainUpdateAction(hex.id, {
        baseTerrain: before.baseTerrain,
        features: [],
        elevation: before.elevation
      }, before);
      if (!action) continue;
      applyLocalTerrainSnapshot(action.hexId, action.after);
      queueTerrainSave(action.hexId, action.after);
      actions.push(action);
    }
    pushBrushTerrainActions(actions);
    renderer.cacheDirty = true;
    render();
  }

  async function updateGeneratedHexTerrain(hexId, target, before = null) {
    const campaign = getActiveCampaign?.();
    if (!campaign || !hexId) return;
    const action = getTerrainUpdateAction(hexId, target, before);
    if (!action) return null;
    const data = await persistGeneratedHexTerrainSnapshot(campaign.id, hexId, action.after);
    updateLocalHexTerrain(hexId, data, action.after);
    return action;
  }

  function getTerrainUpdateAction(hexId, target, before = null) {
    const snapshotBefore = before || getTerrainSnapshot(hexId);
    if (!snapshotBefore) return null;
    const targetBase = target.baseTerrain;
    const features = getValidTerrainFeatures(targetBase, target.features);
    const targetElevation = target.elevation;
    const normalizedTarget = {
      hexId,
      baseTerrain: targetBase,
      features,
      elevation: Number.isFinite(Number(targetElevation)) ? Number(targetElevation) : targetElevation
    };

    if (terrainSnapshotsEqual(snapshotBefore, normalizedTarget)) return null;
    return {
      type: "terrain",
      hexId,
      before: snapshotBefore,
      after: normalizedTarget
    };
  }

  function pushBrushTerrainActions(actions) {
    const valid = (actions || []).filter(Boolean);
    if (!valid.length) return;
    pushMapEditAction(valid.length === 1 ? valid[0] : { type: "batch", actions: valid });
  }

  function terrainSnapshotsEqual(a, b) {
    if (!a || !b) return false;
    return JSON.stringify(normalizeTerrainSnapshot(a)) === JSON.stringify(normalizeTerrainSnapshot(b));
  }

  function normalizeTerrainSnapshot(snapshot) {
    return {
      hexId: snapshot.hexId,
      baseTerrain: snapshot.baseTerrain,
      features: normalizeTerrainFeatureSelection(snapshot.features || []),
      elevation: Number.isFinite(Number(snapshot.elevation)) ? Number(snapshot.elevation) : snapshot.elevation
    };
  }

  function queueTerrainSave(hexId, snapshot) {
    if (!hexId || !snapshot) return;
    renderer.drawing.pendingTerrainSaves.set(hexId, normalizeTerrainSnapshot(snapshot));
    processTerrainSaveQueue();
  }

  async function processTerrainSaveQueue() {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.terrainSaveRunning) return;
    renderer.drawing.terrainSaveRunning = true;

    try {
      while (renderer.drawing.pendingTerrainSaves.size) {
        const [hexId, snapshot] = renderer.drawing.pendingTerrainSaves.entries().next().value;
        renderer.drawing.pendingTerrainSaves.delete(hexId);
        const data = await persistGeneratedHexTerrainSnapshot(campaign.id, hexId, snapshot);
        if (terrainSnapshotsEqual(getTerrainSnapshot(hexId), snapshot)) {
          updateLocalHexTerrain(hexId, data, snapshot);
        }
      }
      renderer.drawing.terrainSaveErrorShown = false;
    } catch (error) {
      console.error("Unable to save generated hex terrain:", error);
      if (!renderer.drawing.terrainSaveErrorShown) {
        renderer.drawing.terrainSaveErrorShown = true;
        window.alert?.(error.message || "Unable to save hex terrain.");
      }
    } finally {
      renderer.drawing.terrainSaveRunning = false;
      if (renderer.drawing.pendingTerrainSaves.size) processTerrainSaveQueue();
    }
  }

  async function persistGeneratedHexTerrainSnapshot(campaignId, hexId, snapshot) {
    const { data, error } = await campaignSupabase.rpc("update_generated_hex_terrain", {
      target_campaign_id: campaignId,
      target_hex_ref: hexId,
      target_base_terrain: snapshot.baseTerrain,
      target_terrain_features: snapshot.features || [],
      target_elevation: snapshot.elevation
    });

    if (error) throw error;
    return data;
  }

  function getValidTerrainFeatures(baseTerrain, features, maxFeatures = 2) {
    const valid = new Set(getValidFeaturesForTerrainSelection(baseTerrain));
    return normalizeTerrainFeatureSelection(features, "", maxFeatures)
      .filter(feature => valid.has(feature))
      .slice(0, clampNumber(Number(maxFeatures), 0, 2, 2));
  }

  function getBrushHexes(centerHex, size = 1, noise = 0, seedPrefix = "brush") {
    const radius = Math.max(0, clampNumber(Number(size), 1, 5, 1) - 1);
    const candidates = [centerHex, ...nearbyHexesWithin(centerHex, radius)];
    const noiseValue = clampNumber(Number(noise), 0, 90, 0);
    return candidates.filter(hex => {
      if (!hex || hex.id === centerHex.id || noiseValue <= 0) return Boolean(hex);
      const skipChance = Math.min(96, Math.round(noiseValue * 1.05));
      return stableHash(`${seedPrefix}:${centerHex.id}:${hex.id}`) % 100 >= skipChance;
    });
  }

  function getEditorBrushHexIds(hex) {
    if (!hex) return [];
    if (renderer.drawing.tool === "terrain-eyedropper" || renderer.drawing.tool === "feature-eyedropper") {
      return [hex.id];
    }
    if (renderer.drawing.tool === "terrain") {
      const size = resolveChaosNumber(renderer.drawing.terrainBrushSize, 1, 5, `terrain-preview-size:${hex.id}`);
      const noise = resolveChaosNumber(renderer.drawing.terrainNoise, 0, 90, `terrain-preview-noise:${hex.id}`, 5);
      return getBrushHexes(hex, size, noise, "terrain-preview")
        .map(candidate => candidate.id);
    }
    if (renderer.drawing.tool === "feature" || renderer.drawing.tool === "feature-erase") {
      const size = resolveChaosNumber(renderer.drawing.featureBrushSize, 1, 5, `feature-preview-size:${hex.id}`);
      const noise = resolveChaosNumber(renderer.drawing.featureNoise, 0, 90, `feature-preview-noise:${hex.id}`, 5);
      return getBrushHexes(hex, size, noise, "feature-preview")
        .map(candidate => candidate.id);
    }
    return [];
  }

  function generateFeaturesForTerrain(baseTerrain, elevation, seed, noise = renderer.drawing.terrainNoise, contextSnapshot = null, maxFeatures = 2, featureDensityScale = 1) {
    if (TERRAIN_RULES.generateFeaturesForTerrain) {
      return TERRAIN_RULES.generateFeaturesForTerrain({
        baseTerrain,
        elevation,
        seed,
        noise,
        maxFeatures,
        featureDensityScale,
        hex: contextSnapshot,
        context: getTerrainRuleContext(contextSnapshot),
        hashNumber: stableHash
      }).filter(feature => canApplyFeatureByGenerationContext(contextSnapshot, feature, seed));
    }

    const valid = getValidFeaturesForTerrainSelection(baseTerrain)
      .filter(feature => feature !== "falls")
      .filter(feature => !contextSnapshot || canApplyFeatureByGenerationContext(contextSnapshot, feature, seed));
    if (!valid.length) return [];
    const noiseBoost = (noise || 0) / 100;
    const densityScale = Math.max(0.1, Math.min(1.65, Number(featureDensityScale || 1)));
    const firstChance = Math.min(96, (34 + noiseBoost * 30) * densityScale);
    const secondChance = Math.min(92, (9 + noiseBoost * 18) * densityScale);
    const selected = [];
    if (stableHash(`${seed}:feature:0`) % 100 < firstChance) {
      selected.push(valid[stableHash(`${seed}:pick:0`) % valid.length]);
    }
    if (stableHash(`${seed}:feature:1`) % 100 < secondChance) {
      selected.push(valid[stableHash(`${seed}:pick:1`) % valid.length]);
    }
    if (elevation !== "auto" && Number(elevation) >= 4) {
      ["mountains", "snowcapped_mountains", "ridges"].forEach(feature => {
        if (valid.includes(feature) && stableHash(`${seed}:${feature}`) % 100 < 22) selected.push(feature);
      });
    }
    return getValidTerrainFeatures(baseTerrain, selected, maxFeatures);
  }

  function shouldApplyFeatureDensity(centerHex, hex, densityOverride = null) {
    const density = densityOverride ?? clampNumber(Number(renderer.drawing.featureDensity), 5, 100, 50);
    if (hex.id === centerHex.id) return true;
    return stableHash(`feature-density:${centerHex.id}:${hex.id}:${renderer.drawing.featureBrush}`) % 100 < density;
  }

  function shouldApplyTerrainFeatureDensity(centerHex, hex, densityOverride = null) {
    const density = densityOverride ?? clampNumber(Number(renderer.drawing.terrainFeatureDensity), 5, 100, 50);
    if (hex.id === centerHex.id) return true;
    return stableHash(`terrain-feature-density:${centerHex.id}:${hex.id}:${renderer.drawing.terrainBase}`) % 100 < density;
  }

  function getFeatureBrushTargetHex(hex, feature) {
    if (feature !== "falls") return hex;
    return getManualFallsTargetHex(hex);
  }

  function chooseFeatureForBrush(snapshot, brush, seed) {
    if (brush?.mode === "generated") {
      const generated = generateFeaturesForTerrain(snapshot.baseTerrain, snapshot.elevation, seed, renderer.drawing.featureNoise);
      const candidates = generated
        .filter(feature => !(snapshot.features || []).includes(feature))
        .filter(feature => canApplyFeatureByGenerationContext(snapshot, feature, seed));
      return candidates.length ? candidates[0] : null;
    }
    const candidates = getFeatureBrushCandidates(snapshot, brush);
    if (!candidates.length) return null;
    return candidates[stableHash(`${seed}:feature-choice`) % candidates.length];
  }

  function applySpecificFeatureToFeatures(snapshot, feature, brush = null) {
    if (feature === "falls" && !hasStrongWaterDropFromHex(renderer.hexes.find(hex => hex.id === snapshot.hexId))) return null;
    if (brush?.ignoreCompatibility) {
      const maxFeatures = resolveChaosNumber(renderer.drawing.featureMaxFeatures, 0, 2, `feature-max-features:${snapshot.hexId}:${feature}`);
      return normalizeTerrainFeatureSelection([...(snapshot.features || []), feature], feature, maxFeatures);
    }
    const maxFeatures = resolveChaosNumber(renderer.drawing.featureMaxFeatures, 0, 2, `feature-max-features:${snapshot.hexId}:${feature}`);
    return getValidTerrainFeatures(snapshot.baseTerrain, [...(snapshot.features || []), feature], maxFeatures);
  }

  function getFeatureBrushCandidates(hexOrSnapshot, brush) {
    const candidates = TERRAIN_RULES.getBrushCandidates
      ? TERRAIN_RULES.getBrushCandidates(hexOrSnapshot, brush, {
        context: getTerrainRuleContext(hexOrSnapshot),
        hashNumber: stableHash,
        seed: `${hexOrSnapshot?.hexId || "hex"}:${brush?.id || "brush"}`
      })
      : getLegacyFeatureBrushCandidates(hexOrSnapshot, brush);

    return candidates
      .filter(feature => canApplyFeatureByGenerationContext(hexOrSnapshot, feature, `${hexOrSnapshot?.hexId || "hex"}:${brush?.id || "brush"}`));
  }

  function getLegacyFeatureBrushCandidates(hexOrSnapshot, brush) {
    if (brush?.ignoreCompatibility) return brush.features || [];
    const baseTerrain = hexOrSnapshot?.baseTerrain;
    const valid = new Set(getValidFeaturesForTerrainSelection(baseTerrain));
    return (brush?.features || []).filter(feature => valid.has(feature));
  }

  function getTerrainRuleContext(hexOrSnapshot) {
    return {
      hasNearbyBase(targetHex, bases, radius = 2) {
        const hex = findRendererHexForRules(targetHex);
        return hex ? hasNearbyBase(hex, new Set(bases), radius) : false;
      },
      hasNearbyFeature(targetHex, featureId, radius = 2) {
        const hex = findRendererHexForRules(targetHex);
        return hex ? hasNearbyFeature(hex, featureId, radius) : false;
      },
      hasNearbyAnyFeature(targetHex, features, radius = 2) {
        const hex = findRendererHexForRules(targetHex);
        if (!hex) return false;
        const featureSet = new Set(features);
        return nearbyHexesWithin(hex, radius).some(neighbor => (neighbor.features || []).some(feature => featureSet.has(feature)));
      },
      nearbyFeatureCount(targetHex, featureId, radius = 1) {
        const hex = findRendererHexForRules(targetHex);
        if (!hex) return 0;
        return nearbyHexesWithin(hex, radius).filter(neighbor => (neighbor.features || []).includes(featureId)).length;
      },
      hasNearbyPoiType(targetHex, poiTypes, radius = 2) {
        const hex = findRendererHexForRules(targetHex);
        if (!hex) return false;
        const validHexIds = new Set([hex.id, ...nearbyHexesWithin(hex, radius).map(neighbor => neighbor.id)]);
        for (const hexId of validHexIds) {
          const pois = renderer.poisByHexId.get(hexId) || [];
          if (pois.some(poi => poiTypes.includes(String(poi.Type || poi.type || "").toLowerCase()))) return true;
        }
        return false;
      },
      hasStrongWaterDrop(targetHex) {
        const hex = findRendererHexForRules(targetHex);
        return Boolean(hex && hasStrongWaterDropFromHex(hex));
      }
    };
  }

  function findRendererHexForRules(hexOrSnapshot) {
    const hexId = hexOrSnapshot?.hexId || hexOrSnapshot?.id;
    const hex = renderer.hexes.find(candidate => candidate.id === hexId);
    if (!hex) return null;
    return {
      ...hex,
      baseTerrain: hexOrSnapshot?.baseTerrain || hex.baseTerrain,
      features: hexOrSnapshot?.features || hex.features || [],
      elevation: hexOrSnapshot?.elevation ?? hex.elevation
    };
  }

  function canApplyFeatureByGenerationContext(hexOrSnapshot, feature, seed = "") {
    const hex = renderer.hexes.find(candidate => candidate.id === hexOrSnapshot?.hexId);
    if (!hex) return true;
    const contextHex = {
      ...hex,
      baseTerrain: hexOrSnapshot.baseTerrain || hex.baseTerrain,
      features: hexOrSnapshot.features || hex.features || []
    };
    const features = new Set([...(contextHex.features || []), feature]);
    if (feature === "falls") return hasStrongWaterDropFromHex(hex);
    if (feature === "marsh") return canApplyMarshByGenerationContext(contextHex, seed);
    return Boolean(chooseFeatureArtFile(contextHex, feature, features));
  }

  function canApplyMarshByGenerationContext(hex, seed = "") {
    if (!hex) return false;
    if (hex.baseTerrain === "wetland") return true;
    if (hex.baseTerrain === "lush_grassland") {
      return stableHash(`${seed}:marsh-lush:${hex.id}`) % 100 < 8;
    }
    if (hex.baseTerrain !== "inland_water") return false;
    if (hasNearbyBase(hex, new Set(["wetland"]), 2)) {
      return stableHash(`${seed}:marsh-wetland:${hex.id}`) % 100 < 55;
    }

    const nearestWetlandDistance = getNearestBaseDistance(hex, new Set(["wetland"]), 5);
    const marshNeighbors = nearbyHexesWithin(hex, 2).filter(neighbor => neighbor.features?.includes("marsh")).length;
    if (!marshNeighbors || !nearestWetlandDistance) return false;

    const spreadChance = Math.max(6, 34 - nearestWetlandDistance * 5 - Math.max(0, marshNeighbors - 1) * 4);
    return stableHash(`${seed}:marsh-spread:${hex.id}:${marshNeighbors}:${nearestWetlandDistance}`) % 100 < spreadChance;
  }

  function getNearestBaseDistance(hex, baseSet, maxRadius = 5) {
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      if (nearbyHexesWithin(hex, radius).some(neighbor => baseSet.has(neighbor.baseTerrain))) return radius;
    }
    return 0;
  }

  function getManualFallsTargetHex(hex) {
    if (!hex || !["inland_water", "coastal_water"].includes(hex.baseTerrain)) return null;
    if (hasStrongWaterDropFromHex(hex)) return hex;
    const higherNeighbors = EDGE_NAMES
      .map(edge => getNeighborHex(hex, edge))
      .filter(neighbor => hasStrongWaterDropBetween(neighbor, hex) && Number(neighbor.elevation || 0) > Number(hex.elevation || 0));
    return higherNeighbors.length === 1 ? higherNeighbors[0] : null;
  }

  function hasStrongWaterDropFromHex(hex) {
    return EDGE_NAMES
      .map(edge => getNeighborHex(hex, edge))
      .some(neighbor => hasStrongWaterDropBetween(hex, neighbor) && Number(hex.elevation || 0) > Number(neighbor.elevation || 0));
  }

  function hasStrongWaterDropBetween(a, b) {
    return ["inland_water", "coastal_water"].includes(a?.baseTerrain)
      && ["inland_water", "coastal_water"].includes(b?.baseTerrain)
      && Math.abs(Number(a.elevation || 0) - Number(b.elevation || 0)) >= 2;
  }

  function pickTerrainFromHex(hexId) {
    const snapshot = getTerrainSnapshot(hexId);
    if (!snapshot) return;
    renderer.drawing.terrainBase = snapshot.baseTerrain || "plains";
    renderer.drawing.terrainElevation = snapshot.elevation;
    updateTerrainControls();
  }

  function pickFeatureFromHex(hexId) {
    const snapshot = getTerrainSnapshot(hexId);
    const feature = snapshot?.features?.find(candidate => TERRAIN_FEATURE_LABELS[candidate]);
    renderer.drawing.featureBrush = feature ? getFeatureBrushIdForFeature(feature) : "generated";
    updateTerrainControls();
  }

  function getFeatureBrushIdForFeature(feature) {
    if (["woods", "forest", "jungle", "shrub", "kelp", "marsh", "cactus_scrub"].includes(feature)) return "vegetation";
    if (["ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"].includes(feature)) return "highlands";
    if (["waves", "shoals", "reef", "water_rocks", "whirlpool", "rapids", "falls", "ice"].includes(feature)) return "water";
    if (feature === "farmland") return "farmland";
    if (feature === "sand") return "sand";
    return "generated";
  }

  function getGenerationSeedBase(campaignId) {
    const customSeed = String(renderer.drawing.generationSeed || "").trim();
    return customSeed || `${campaignId}:feature-pass`;
  }

  async function runGenerationFeaturePass() {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return;
    if (hasGenerationPreview()) discardGeneratedTerrainPreview({ silent: true });

    const refreshExisting = Boolean(renderer.drawing.generationRefreshExisting);
    if (refreshExisting && typeof window.confirm === "function") {
      const confirmed = window.confirm("Preview refreshed terrain features across the generated map? Existing terrain features will be staged locally until you apply the preview.");
      if (!confirmed) return;
    }

    const seedBase = getGenerationSeedBase(campaign.id);
    const densityScale = Math.max(0.5, Math.min(1.65, Number(renderer.drawing.generationFeatureDensity || 100) / 100));
    const maxFeatures = clampNumber(Number(renderer.drawing.generationMaxFeatures), 0, 2, 2);
    const actions = renderer.hexes
      .map((hex, index) => {
        const before = getTerrainSnapshot(hex.id);
        if (!before?.baseTerrain) return null;
        if (!refreshExisting && before.features?.length) return null;

        const generatedFeatures = generateFeaturesForTerrain(
          before.baseTerrain,
          before.elevation,
          `${seedBase}:${hex.id}:${index}`,
          0,
          before,
          maxFeatures,
          densityScale
        );
        const after = {
          ...before,
          features: generatedFeatures
        };
        if (terrainSnapshotsEqual(before, after)) return null;
        return {
          type: "terrain",
          hexId: hex.id,
          before,
          after
        };
      })
      .filter(Boolean);

    if (!actions.length) {
      window.alert?.(refreshExisting
        ? "The feature pass did not change any hexes."
        : "No empty hexes needed generated features.");
      return;
    }

    renderer.drawing.generationPreviewOriginals = new Map(renderer.hexes.map(hex => [hex.id, getTerrainSnapshot(hex.id)]));
    renderer.drawing.generationPreviewActions = actions.map(action => ({ ...action, previewSection: "features" }));
    actions.forEach(action => applyLocalTerrainSnapshot(action.hexId, action.after));
    renderer.cacheDirty = true;
    render();
    updateGenerationControls();
  }

  async function runGenerationRoadPass() {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return;
    if (!confirmOverlayGeneration("road", "roads")) return;
    const routes = buildGeneratedRoadRoutes(campaign.id);
    if (!routes.length) {
      window.alert?.("No road routes could be generated from the current POI layout.");
      return;
    }

    previewGeneratedOverlayRoutes({
      campaignId: campaign.id,
      routes,
      tool: "road",
      style: "dark_brown",
      routeMetadata: { isMajorRoute: false, routeName: "" },
      emptyMessage: "Generated roads already matched existing road overlays."
    });
  }

  async function runGenerationRiverPass() {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return;
    if (!confirmOverlayGeneration("river", "rivers")) return;
    const routes = buildGeneratedRiverRoutes(campaign.id);
    if (!routes.length) {
      window.alert?.("No river routes could be generated from the current terrain.");
      return;
    }

    previewGeneratedOverlayRoutes({
      campaignId: campaign.id,
      routes,
      tool: "river",
      style: composeOverlayStyle("river", []),
      routeMetadata: { isMajorRoute: false, routeName: "" },
      emptyMessage: "Generated rivers already matched existing river overlays."
    });
  }

  function confirmOverlayGeneration(type, label) {
    const replacingPreview = (renderer.drawing.generationPreviewActions || [])
      .some(action => action.previewSection === "overlays" && action.previewOverlayType === type);
    if (replacingPreview) return true;

    const existing = (renderer.mapOverlays || [])
      .filter(overlay => !overlay.__preview && overlay.Overlay_Type === type && overlay.To_Hex_ID_Ref)
      .length;
    if (!existing || typeof window.confirm !== "function") return true;
    return window.confirm(`Preview ${label} on top of ${existing} existing ${label} segment${existing === 1 ? "" : "s"}? This only stages overlays locally until you apply the preview.`);
  }

  function previewGeneratedOverlayRoutes({ campaignId, routes, tool, style, routeMetadata, emptyMessage }) {
    const replacedActions = (renderer.drawing.generationPreviewActions || [])
      .filter(action => action.previewSection === "overlays" && action.previewOverlayType === tool);
    removeGenerationPreviewOverlays(replacedActions);

    const segments = getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting: true });

    if (!segments.length) {
      window.alert?.(emptyMessage || "No new overlays were generated.");
      return;
    }

    const previewOverlays = segments.map((segment, index) => ({
      __uuid: `preview-${tool}-${Date.now()}-${index}`,
      __preview: true,
      Overlay_Type: segment.tool,
      From_Hex_ID_Ref: segment.fromHexId,
      To_Hex_ID_Ref: segment.toHexId || "",
      Hex_ID_Ref: "",
      Edge: segment.edge || "",
      Style: segment.style,
      Is_Major_Route: Boolean(segment.routeMetadata?.isMajorRoute),
      Route_Name: segment.routeMetadata?.routeName || ""
    }));

    renderer.drawing.generationPreviewActions = [
      ...(renderer.drawing.generationPreviewActions || [])
        .filter(action => !(action.previewSection === "overlays" && action.previewOverlayType === tool)),
      {
        type: "overlay",
        previewSection: "overlays",
        previewOverlayType: tool,
        overlays: previewOverlays
      }
    ];
    previewOverlays.forEach(upsertLocalOverlay);
    renderer.cacheDirty = true;
    render();
    updateGenerationControls();
  }

  async function persistGeneratedOverlayRoutes({ campaignId, routes, tool, style, routeMetadata, emptyMessage }) {
    const existingOverlayIds = new Set((renderer.mapOverlays || []).map(overlay => overlay.__uuid).filter(Boolean));
    const segments = getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting: true });

    if (!segments.length) {
      window.alert?.(emptyMessage || "No new overlays were generated.");
      return;
    }

    await persistGeneratedOverlaySegments(campaignId, segments, existingOverlayIds);
  }

  function getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting = true }) {
    const existingKeys = new Set((renderer.mapOverlays || [])
      .filter(overlay => !overlay.__preview && overlay.Overlay_Type === tool && overlay.From_Hex_ID_Ref && overlay.To_Hex_ID_Ref)
      .map(overlay => overlaySegmentKey(tool, overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref)));
    const queuedKeys = new Set();
    const segments = [];

    routes.forEach(route => {
      const sequence = Array.isArray(route) ? route : route?.sequence || [];
      if (route?.startEdge && sequence.length) {
        const fromHexId = sequence[0];
        const key = `${tool}:${fromHexId}:edge:${route.startEdge}`;
        if (!queuedKeys.has(key)) {
          queuedKeys.add(key);
          segments.push({
            tool,
            fromHexId,
            toHexId: null,
            edge: route.startEdge,
            style,
            routeMetadata
          });
        }
      }
      sequence.slice(0, -1).forEach((fromHexId, index) => {
        const toHexId = sequence[index + 1];
        const segmentTool = getPersistedSegmentTool(tool, fromHexId, toHexId);
        const key = overlaySegmentKey(segmentTool, fromHexId, toHexId);
        if ((skipExisting && existingKeys.has(key)) || queuedKeys.has(key)) return;
        queuedKeys.add(key);
        segments.push({
          tool: segmentTool,
          fromHexId,
          toHexId,
          style: segmentTool === "sea_route" ? "sea_route" : style,
          routeMetadata: getSegmentRouteMetadata(segmentTool, routeMetadata)
        });
      });
      if (route?.exitEdge && sequence.length) {
        const fromHexId = sequence[sequence.length - 1];
        const key = `${tool}:${fromHexId}:edge:${route.exitEdge}`;
        if (!queuedKeys.has(key)) {
          queuedKeys.add(key);
          segments.push({
            tool,
            fromHexId,
            toHexId: null,
            edge: route.exitEdge,
            style,
            routeMetadata
          });
        }
      }
    });

    return segments;
  }

  async function persistGeneratedOverlaySegments(campaignId, segments, existingOverlayIds = new Set()) {
    const showBulkLoading = segments.length >= BULK_OVERLAY_LOADING_THRESHOLD;
    renderer.drawing.saving = true;
    if (showBulkLoading) setLoading(true);
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
    updateGenerationControls();

    try {
      const saved = [];
      for (const segment of segments) {
        const overlay = await savePathOverlaySegment(
          campaignId,
          segment.tool,
          segment.fromHexId,
          segment.toHexId,
          segment.style,
          segment.edge || null,
          segment.routeMetadata
        );
        if (overlay) saved.push(overlay);
      }

      saved.forEach(upsertLocalOverlay);
      pushOverlayUndoAction(saved.filter(overlay => !existingOverlayIds.has(overlay.__uuid)));
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to generate map overlays:", error);
      window.alert?.(error.message || "Unable to generate map overlays.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
      updateGenerationControls();
    }
  }

  function overlaySegmentKey(type, fromHexId, toHexId) {
    const ends = [fromHexId, toHexId].sort();
    return `${type}:${ends[0]}:${ends[1]}`;
  }

  function buildGeneratedRoadRoutes(campaignId) {
    const anchors = getGeneratedRoadAnchors(campaignId);
    if (anchors.length < 2) return [];

    const seedBase = getGenerationSeedBase(campaignId);
    const connected = [anchors[0]];
    const remaining = anchors.slice(1);
    const routes = [];
    const amountScale = Math.max(0.25, Math.min(2, Number(renderer.drawing.generationRoadAmount || 100) / 100));
    const maxRoutes = Math.min(Math.max(1, Math.round(28 * amountScale)), anchors.length - 1);
    let step = 0;

    while (remaining.length && routes.length < maxRoutes) {
      const candidates = [];
      connected.forEach(fromHex => {
        remaining.forEach(toHex => {
          const score = roadPathHeuristic(fromHex, toHex)
            + seededUnit(`${seedBase}:road-route:${step}:${fromHex.id}:${toHex.id}`) * 5.5;
          candidates.push({ fromHex, toHex, score });
        });
      });
      const candidatePool = candidates.sort((a, b) => a.score - b.score).slice(0, Math.min(6, candidates.length));
      const best = candidatePool[Math.floor(seededUnit(`${seedBase}:road-pick:${step}`) * candidatePool.length)];
      if (!best) break;
      const sequence = getPathOverlaySequence("road", best.fromHex.id, best.toHex.id);
      if (sequence && sequence.length >= 2) routes.push(sequence);
      connected.push(best.toHex);
      remaining.splice(remaining.findIndex(hex => hex.id === best.toHex.id), 1);
      step += 1;
    }

    return routes;
  }

  function getGeneratedRoadAnchors(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    const pois = db?.raw?.pois || [];
    const hexById = new Map();
    renderer.hexes.forEach(hex => {
      hexById.set(hex.id, hex);
      if (hex.label) hexById.set(hex.label, hex);
    });
    const bestPoiByHex = new Map();

    pois.forEach(poi => {
      const hex = hexById.get(poi.Hex_ID_Ref);
      if (!hex || isWaterHex(hex)) return;
      const score = getPoiRoadAnchorScore(poi) + seededUnit(`${seedBase}:road-anchor:${poi.POI_ID || poi.Name || hex.id}`) * 8;
      const existing = bestPoiByHex.get(hex.id);
      if (!existing || score < existing.score) bestPoiByHex.set(hex.id, { hex, score });
    });

    const poiAnchors = [...bestPoiByHex.values()]
      .sort((a, b) => a.score - b.score || a.hex.id.localeCompare(b.hex.id))
      .slice(0, 24)
      .map(entry => entry.hex);
    return [...poiAnchors, ...getFallbackRoadAnchors(campaignId, bestPoiByHex)]
      .filter((hex, index, list) => hex && list.findIndex(candidate => candidate.id === hex.id) === index);
  }

  function getFallbackRoadAnchors(campaignId, existingAnchors = new Map()) {
    if (existingAnchors.size >= 2) return [];
    const seedBase = getGenerationSeedBase(campaignId);
    const byRegion = new Map();
    renderer.hexes.forEach(hex => {
      if (!hex.regionId || hex.regionId === UNCLAIMED_REGION_REF || isWaterHex(hex)) return;
      if (!byRegion.has(hex.regionId)) byRegion.set(hex.regionId, []);
      byRegion.get(hex.regionId).push(hex);
    });

    const regionCenters = [...byRegion.entries()].map(([regionId, hexes]) => {
      const center = hexes.reduce((total, hex) => ({
        x: total.x + hex.center.x,
        y: total.y + hex.center.y
      }), { x: 0, y: 0 });
      center.x /= Math.max(1, hexes.length);
      center.y /= Math.max(1, hexes.length);
      return hexes
        .slice()
        .sort((a, b) => (
          Math.hypot(a.center.x - center.x, a.center.y - center.y) - Math.hypot(b.center.x - center.x, b.center.y - center.y) ||
          seededUnit(`${seedBase}:road-region:${regionId}:${a.id}`) - seededUnit(`${seedBase}:road-region:${regionId}:${b.id}`)
        ))[0];
    }).filter(Boolean);

    const broadLand = renderer.hexes
      .filter(hex => !isWaterHex(hex) && !existingAnchors.has(hex.id))
      .sort((a, b) => (
        getRoadLandAnchorScore(a) - getRoadLandAnchorScore(b) ||
        seededUnit(`${seedBase}:road-land:${a.id}`) - seededUnit(`${seedBase}:road-land:${b.id}`)
      ))
      .slice(0, 8);

    return [...regionCenters, ...broadLand]
      .filter((hex, index, list) => hex && !existingAnchors.has(hex.id) && list.findIndex(candidate => candidate.id === hex.id) === index)
      .slice(0, 12);
  }

  function getRoadLandAnchorScore(hex) {
    let score = 5;
    if (["plains", "grassland", "lush_grassland", "beach"].includes(hex.baseTerrain)) score -= 2;
    if ((hex.features || []).includes("farmland")) score -= 2;
    if ((hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "volcano", "cliffs", "jungle", "marsh"].includes(feature))) score += 3;
    score += Math.abs(Number(hex.elevation || 0) - 1) * 0.8;
    return score;
  }

  function getPoiRoadAnchorScore(poi) {
    const text = `${poi?.POI_Type || ""} ${poi?.Name || ""}`.toLowerCase();
    if (/(city|town|village|settlement|district|docks|farm|inn|abbey|castle|hold)/.test(text)) return 0;
    if (/(tower|temple|lodge|oasis|center|entrance|summit)/.test(text)) return 2;
    if (/(ruin|dungeon|cave|tomb|pit|shelter|obelisk)/.test(text)) return 4;
    return 3;
  }

  function buildGeneratedRiverRoutes(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    const amountScale = Math.max(0.25, Math.min(2, Number(renderer.drawing.generationRiverAmount || 100) / 100));
    const maxRivers = Math.max(1, Math.round(7 * amountScale));
    const sources = renderer.hexes
      .filter(hex => !isWaterHex(hex) && getRiverSourceScore(hex) > 0)
      .sort((a, b) => (
        getSeededRiverSourceScore(b, seedBase) - getSeededRiverSourceScore(a, seedBase) ||
        a.id.localeCompare(b.id)
      ));
    const routes = [];
    const usedHexes = new Set();

    for (const source of sources) {
      if (routes.length >= maxRivers) break;
      if (nearbyHexesWithin(source, 4).some(hex => usedHexes.has(hex.id))) continue;
      const route = getGeneratedRiverRoute(source, campaignId);
      const sequence = Array.isArray(route) ? route : route?.sequence || [];
      if (!sequence || sequence.length < 4) continue;
      routes.push(route);
      sequence.forEach(hexId => usedHexes.add(hexId));
    }

    return routes;
  }

  function getRiverSourceScore(hex) {
    if (!hex || isWaterHex(hex)) return 0;
    const elevation = Number(hex.elevation || 0);
    const highlandFeature = (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "ridges", "cliffs"].includes(feature));
    return (elevation >= 3 ? elevation : 0) + (highlandFeature ? 2 : 0);
  }

  function getSeededRiverSourceScore(hex, seedBase) {
    return getRiverSourceScore(hex) + seededUnit(`${seedBase}:river-source:${hex.id}`) * 5;
  }

  function getGeneratedRiverRoute(source, campaignId) {
    const route = [source.id];
    const visited = new Set(route);
    let current = source;
    const lengthScale = Math.max(0.5, Math.min(1.75, Number(renderer.drawing.generationRiverLength || 100) / 100));
    const maxSteps = Math.round(54 * lengthScale);
    const entryEdge = getOuterMapEdge(current);
    const seedBase = getGenerationSeedBase(campaignId);
    const startsOffMap = Boolean(entryEdge && seededUnit(`${seedBase}:river-entry:${source.id}`) < 0.45);

    for (let step = 0; step < maxSteps; step += 1) {
      const neighbors = EDGE_NAMES.map(edgeName => getNeighborHex(current, edgeName)).filter(Boolean);
      const waterNeighbor = neighbors
        .filter(neighbor => isWaterHex(neighbor))
        .sort((a, b) => seededUnit(`${seedBase}:river-water:${current.id}:${a.id}`) - seededUnit(`${seedBase}:river-water:${current.id}:${b.id}`))[0];
      if (waterNeighbor) {
        route.push(waterNeighbor.id);
        return startsOffMap ? { sequence: route, startEdge: entryEdge } : route;
      }

      const next = neighbors
        .filter(neighbor => !visited.has(neighbor.id))
        .map(neighbor => ({
          hex: neighbor,
          score: getRiverStepScore(current, neighbor, seedBase, step)
        }))
        .filter(candidate => Number.isFinite(candidate.score))
        .sort((a, b) => a.score - b.score)[0]?.hex;

      if (!next) break;
      route.push(next.id);
      visited.add(next.id);
      current = next;
    }

    return null;
  }

  function getOuterMapEdge(hex) {
    if (!hex) return "";
    return EDGE_NAMES.find(edgeName => !getNeighborHex(hex, edgeName)) || "";
  }

  function getRiverStepScore(fromHex, toHex, seedBase, step) {
    if (isWaterHex(toHex)) return 0;
    const fromElevation = Number(fromHex.elevation || 0);
    const toElevation = Number(toHex.elevation || 0);
    const climb = Math.max(0, toElevation - fromElevation);
    if (climb > 1) return Infinity;

    const nearbyWaterDistance = getNearestWaterDistance(toHex, 7);
    const descent = Math.max(0, fromElevation - toElevation);
    const terrainPenalty = ["rock", "snow", "barrens", "bleak_barrens", "wastes"].includes(toHex.baseTerrain) ? 0.2 : 0.8;
    return nearbyWaterDistance * 2.6
      + climb * 7
      - descent * 1.4
      + terrainPenalty
      + step * 0.05
      + seededUnit(`${seedBase}:river-step:${fromHex.id}:${toHex.id}`) * 4.8;
  }

  function getNearestWaterDistance(hex, radius = 6) {
    if (!hex) return radius + 1;
    if (isWaterHex(hex)) return 0;
    const queue = [{ hex, distance: 0 }];
    const seen = new Set([hex.id]);
    while (queue.length) {
      const current = queue.shift();
      if (current.distance >= radius) continue;
      for (const edgeName of EDGE_NAMES) {
        const neighbor = getNeighborHex(current.hex, edgeName);
        if (!neighbor || seen.has(neighbor.id)) continue;
        if (isWaterHex(neighbor)) return current.distance + 1;
        seen.add(neighbor.id);
        queue.push({ hex: neighbor, distance: current.distance + 1 });
      }
    }
    return radius + 1;
  }

  function seededUnit(seed) {
    return stableHash(seed) / 0xffffffff;
  }

  function getGeneratorControlScale(key, fallback = 100) {
    const percent = Math.max(0, Math.min(200, Number(renderer.drawing[key] ?? fallback))) / 100;
    if (percent <= 1) return percent * percent;
    return Math.min(2, 1 + Math.pow(percent - 1, 0.72));
  }

  function getGeneratorOptions(campaignId) {
    return {
      seed: getGenerationSeedBase(campaignId).replace(":feature-pass", ":terrain-preview"),
      regionStyle: renderer.drawing.generationRegionStyle || "balanced",
      water: getGeneratorControlScale("generationWater"),
      coastalEdge: getGeneratorControlScale("generationCoastalEdge", 0),
      islands: getGeneratorControlScale("generationIslands", 0),
      wetness: getGeneratorControlScale("generationWetness"),
      heat: getGeneratorControlScale("generationHeat"),
      forest: getGeneratorControlScale("generationForest"),
      desert: getGeneratorControlScale("generationDesert"),
      mountains: getGeneratorControlScale("generationMountains"),
      compression: getGeneratorControlScale("generationCompression"),
      continuity: getGeneratorControlScale("generationContinuity"),
      featureDensity: Math.max(0.5, Math.min(1.65, Number(renderer.drawing.generationFeatureDensity || 100) / 100)),
      maxFeatures: clampNumber(Number(renderer.drawing.generationMaxFeatures), 0, 2, 2)
    };
  }

  function previewGeneratedTerrain() {
    const campaign = getActiveCampaign?.();
    const generator = window.CampaignGeneratedMapGenerator;
    if (!campaign || !generator?.generateNaturalTerrain || renderer.drawing.saving) return;

    if (renderer.drawing.generationPreviewActions.length) discardGeneratedTerrainPreview({ silent: true });
    const originals = new Map(renderer.hexes.map(hex => [hex.id, getTerrainSnapshot(hex.id)]));
    const drafts = generator.generateNaturalTerrain({
      ...getGeneratorOptions(campaign.id),
      hexes: renderer.hexes,
      terrainRules: TERRAIN_RULES
    });

    const actions = drafts
      .map(draft => {
        const before = originals.get(draft.hexId);
        if (!before) return null;
        const after = normalizeTerrainSnapshot({
          hexId: draft.hexId,
          baseTerrain: draft.baseTerrain,
          features: draft.features || [],
          elevation: draft.elevation
        });
        if (terrainSnapshotsEqual(before, after)) return null;
        return {
          type: "terrain",
          hexId: draft.hexId,
          before,
          after
        };
      })
      .filter(Boolean);

    if (!actions.length) {
      window.alert?.("The terrain preview did not change any hexes.");
      return;
    }

    renderer.drawing.generationPreviewOriginals = originals;
    renderer.drawing.generationPreviewActions = actions.map(action => ({ ...action, previewSection: "terrain" }));
    actions.forEach(action => applyLocalTerrainSnapshot(action.hexId, action.after));
    renderer.cacheDirty = true;
    render();
    updateGenerationControls();
  }

  async function applyGeneratedTerrainPreview() {
    const campaign = getActiveCampaign?.();
    const actions = renderer.drawing.generationPreviewActions || [];
    if (!campaign || renderer.drawing.saving || !actions.length) return;
    if (typeof window.confirm !== "function") {
      window.alert?.("Confirmation is unavailable, so the terrain preview was not applied.");
      return;
    }
    const confirmed = window.confirm("Apply this generation preview to the saved map? You can still use map undo during this session.");
    if (!confirmed) return;

    const historyAction = actions.length === 1 ? actions[0] : { type: "batch", actions };
    const showBulkLoading = getMapEditActionSize(historyAction) >= BULK_OVERLAY_LOADING_THRESHOLD;

    renderer.drawing.saving = true;
    if (showBulkLoading) setLoading(true);
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
    updateGenerationControls();

    try {
      removeGenerationPreviewOverlays(actions);
      await applyMapEditAction(campaign.id, historyAction, "redo");
      pushMapEditAction(historyAction, { force: true });
      renderer.drawing.generationPreviewOriginals.clear();
      renderer.drawing.generationPreviewActions = [];
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to apply generated terrain preview:", error);
      window.alert?.(error.message || "Unable to apply terrain preview.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
      updateGenerationControls();
    }
  }

  function discardGeneratedTerrainPreview(options = {}) {
    removeGenerationPreviewOverlays(renderer.drawing.generationPreviewActions || []);
    const originals = renderer.drawing.generationPreviewOriginals;
    if (!originals?.size) {
      renderer.drawing.generationPreviewActions = [];
      updateGenerationControls();
      return;
    }

    originals.forEach((snapshot, hexId) => {
      applyLocalTerrainSnapshot(hexId, snapshot);
    });
    renderer.drawing.generationPreviewOriginals.clear();
    renderer.drawing.generationPreviewActions = [];
    renderer.cacheDirty = true;
    render();
    updateGenerationControls();
    if (!options.silent) updateDrawHint();
  }

  function discardGenerationPreviewSection(section) {
    const normalized = ["terrain", "features", "overlays"].includes(section) ? section : "";
    if (!normalized) return;
    const actions = renderer.drawing.generationPreviewActions || [];
    const removedActions = actions.filter(action => action.previewSection === normalized);
    if (!removedActions.length) return;

    if (normalized === "overlays") {
      removeGenerationPreviewOverlays(removedActions);
      renderer.drawing.generationPreviewActions = actions.filter(action => action.previewSection !== normalized);
    } else {
      const originals = renderer.drawing.generationPreviewOriginals;
      removedActions.forEach(action => {
        const snapshot = originals?.get(action.hexId) || action.before;
        if (snapshot) applyLocalTerrainSnapshot(action.hexId, snapshot);
      });
      renderer.drawing.generationPreviewActions = actions.filter(action => action.previewSection !== normalized);
      if (!renderer.drawing.generationPreviewActions.some(action => action.type === "terrain")) {
        renderer.drawing.generationPreviewOriginals.clear();
      }
    }

    renderer.cacheDirty = true;
    render();
    updateGenerationControls();
    updateDrawHint();
  }

  function removeGenerationPreviewOverlays(actions = []) {
    const previewIds = [];
    const collect = action => {
      if (action?.type === "batch") {
        (action.actions || []).forEach(collect);
        return;
      }
      if (action?.type === "overlay") {
        (action.overlays || []).forEach(overlay => {
          if (overlay?.__preview && overlay.__uuid) previewIds.push(overlay.__uuid);
        });
      }
    };
    actions.forEach(collect);
    if (!previewIds.length) return;

    renderer.mapOverlays = renderer.mapOverlays.filter(overlay => !previewIds.includes(overlay.__uuid));
    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    renderer.cacheDirty = true;
  }

  function getTerrainSnapshot(hexId) {
    const hex = renderer.hexes.find(candidate => candidate.id === hexId);
    if (!hex) return null;
    return {
      hexId,
      baseTerrain: hex.baseTerrain,
      features: [...new Set(hex.features || [])].slice(0, 3),
      elevation: Number.isFinite(Number(hex.elevation)) ? Number(hex.elevation) : 0
    };
  }

  function updateLocalHexTerrain(hexId, rpcRow, fallback) {
    const record = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
    const baseTerrain = record?.base_terrain || fallback.baseTerrain;
    const features = Array.isArray(record?.terrain_features) ? record.terrain_features : fallback.features;
    const elevation = Number.isFinite(Number(record?.elevation)) ? Number(record.elevation) : fallback.elevation;
    const terrainLabel = record?.terrain || getGeneratedTerrainLabel(baseTerrain, features);

    const renderedHex = renderer.hexes.find(hex => hex.id === hexId);
    if (renderedHex) {
      renderedHex.baseTerrain = baseTerrain;
      renderedHex.features = features;
      renderedHex.elevation = elevation;
      renderedHex.fill = TERRAIN_COLORS[baseTerrain] || renderedHex.fill;
      if (renderedHex.record) {
        renderedHex.record.Base_Terrain = baseTerrain;
        renderedHex.record.Terrain_Features = features;
        renderedHex.record.Elevation = String(elevation);
        renderedHex.record.Terrain = terrainLabel;
      }
    }

    const rawHex = db?.raw?.hexes?.find(hex => hex.Hex_ID === hexId);
    if (rawHex) {
      rawHex.Base_Terrain = baseTerrain;
      rawHex.Terrain_Features = features;
      rawHex.Elevation = String(elevation);
      rawHex.Terrain = terrainLabel;
    }

    if (db?.hexesById?.[hexId]) {
      db.hexesById[hexId].Base_Terrain = baseTerrain;
      db.hexesById[hexId].Terrain_Features = features;
      db.hexesById[hexId].Elevation = String(elevation);
      db.hexesById[hexId].Terrain = terrainLabel;
    }

    if (renderer.selectedHexId === hexId && renderer.popup && !renderer.popup.hidden) {
      showPopup(hexId);
    }
  }

  function getGeneratedTerrainLabel(baseTerrain, features) {
    if (TERRAIN_RULES.getTerrainDisplayName) {
      return TERRAIN_RULES.getTerrainDisplayName(baseTerrain, features);
    }

    if (typeof getCodexGeneratedTerrainName === "function") {
      return getCodexGeneratedTerrainName(baseTerrain, features);
    }

    const baseLabel = BASE_TERRAIN_OPTIONS.find(([base]) => base === baseTerrain)?.[1] || baseTerrain || "Unknown";
    const featureLabels = getValidTerrainFeatures(baseTerrain, features)
      .map(feature => TERRAIN_FEATURE_LABELS[feature])
      .filter(Boolean);
    return featureLabels.length ? `${baseLabel} + ${featureLabels.join(" + ")}` : baseLabel;
  }

  async function assignHexRegion(hexId, regionId = "", regionType = "geographic") {
    const campaign = getActiveCampaign?.();
    if (!campaign || !hexId) return;
    if (regionType !== "political" && !regionId) return;
    const before = getRegionSnapshot(hexId);

    try {
      const { error } = await campaignSupabase.rpc("assign_generated_hex_region_layer", {
        target_campaign_id: campaign.id,
        target_hex_ref: hexId,
        target_region_ref: regionId,
        target_region_type: regionType
      });

      if (error) throw error;

      updateLocalHexRegion(hexId, regionId, regionType);
      const after = getRegionSnapshot(hexId);
      if (before && after && JSON.stringify(before) !== JSON.stringify(after)) {
        pushMapEditAction({
          type: "region",
          hexId,
          regionType,
          before,
          after
        });
      }
      renderSvgOnly();
    } catch (error) {
      console.error("Unable to assign generated hex region:", error);
      window.alert?.(error.message || "Unable to assign hex region.");
    }
  }

  function getRegionSnapshot(hexId) {
    const hex = renderer.hexes.find(candidate => candidate.id === hexId);
    if (!hex) return null;
    return {
      geographicRegionId: hex.regionId || "",
      politicalRegionId: hex.politicalRegionId || ""
    };
  }

  function updateLocalHexRegion(hexId, regionId, regionType = "geographic") {
    const renderedHex = renderer.hexes.find(hex => hex.id === hexId);
    if (renderedHex) {
      if (regionType === "political") {
        renderedHex.politicalRegionId = regionId;
        if (renderedHex.record) renderedHex.record.Political_Region_ID_Ref = regionId;
      } else {
        renderedHex.regionId = regionId;
        if (renderedHex.record) renderedHex.record.Region_ID_Ref = regionId;
      }
    }

    const rawHex = db?.raw?.hexes?.find(hex => hex.Hex_ID === hexId);
    if (rawHex) {
      if (regionType === "political") rawHex.Political_Region_ID_Ref = regionId;
      else rawHex.Region_ID_Ref = regionId;
    }

    if (db?.hexesById?.[hexId]) {
      if (regionType === "political") db.hexesById[hexId].Political_Region_ID_Ref = regionId;
      else db.hexesById[hexId].Region_ID_Ref = regionId;
    }

    if (renderer.selectedHexId === hexId && renderer.popup && !renderer.popup.hidden) {
      showPopup(hexId);
    }
  }

  async function persistPathOverlaySequence(tool, fromHexId, toHexId, exitEdge = "") {
    let sequence = getPathOverlaySequence(tool, fromHexId, toHexId, exitEdge);
    let targetExitEdge = exitEdge;
    if (tool === "sea_route") {
      const normalized = normalizeSeaRouteSequence(sequence, targetExitEdge);
      sequence = normalized.sequence;
      targetExitEdge = normalized.exitEdge;
    }
    if (sequence.length < 2 && !targetExitEdge) return;

    const campaign = getActiveCampaign?.();
    if (!campaign) return;

    const style = getCurrentDrawOverlayStyle(tool);
    const routeMetadata = getCurrentRouteMetadata(tool);
    const reveal = beginPathRevealAnimation(tool, sequence, style);
    const existingOverlayIds = new Set((renderer.mapOverlays || []).map(overlay => overlay.__uuid).filter(Boolean));
    renderer.drawing.saving = true;
    updateDrawUndoButton();
    updateDrawRedoButton();

    try {
      const overlays = await Promise.all(sequence.slice(0, -1).map((hexId, index) => {
        const nextHexId = sequence[index + 1];
        const segmentTool = getPersistedSegmentTool(tool, hexId, nextHexId);
        return savePathOverlaySegment(campaign.id, segmentTool, hexId, nextHexId, segmentTool === "sea_route" ? "sea_route" : style, null, getSegmentRouteMetadata(segmentTool, routeMetadata));
      }));
      if (targetExitEdge) {
        overlays.push(await savePathOverlaySegment(campaign.id, tool, toHexId, null, style, targetExitEdge, routeMetadata));
      }
      const validOverlays = overlays.filter(Boolean);

      await reveal.finished;
      validOverlays.forEach(upsertLocalOverlay);
      pushOverlayUndoAction(validOverlays.filter(overlay => !existingOverlayIds.has(overlay.__uuid)));
      renderer.drawing.lastHexId = null;
      renderer.drawing.dragLastHexId = null;
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to save generated map overlay path:", error);
      window.alert?.(error.message || "Unable to save map overlay.");
      await reveal.finished.catch(() => {});
      renderSvgOnly();
    } finally {
      if (renderer.drawing.activePathReveal === reveal) {
        clearPathRevealAnimation();
      }
      renderer.drawing.saving = false;
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
      renderSvgOnly();
    }
  }

  function beginPathRevealAnimation(tool, sequence, style) {
    clearPathRevealAnimation();
    const segmentCount = Math.max(1, sequence.length - 1);
    const duration = Math.max(
      PATH_REVEAL_MIN_DURATION,
      Math.min(PATH_REVEAL_MAX_DURATION, segmentCount * 28)
    );
    const reveal = {
      tool,
      style,
      sequence,
      visibleSequence: sequence.slice(0, 2),
      startTime: performance.now(),
      finished: null,
      resolve: null
    };
    reveal.finished = new Promise(resolve => {
      reveal.resolve = resolve;
    });
    renderer.drawing.activePathReveal = reveal;

    const animate = timestamp => {
      if (renderer.drawing.activePathReveal !== reveal) {
        reveal.resolve?.();
        return;
      }
      const progress = Math.min(1, (timestamp - reveal.startTime) / duration);
      const visibleSegments = Math.max(1, Math.ceil(segmentCount * easeOutCubic(progress)));
      reveal.visibleSequence = sequence.slice(0, visibleSegments + 1);
      renderSvgOnly();
      if (progress < 1) {
        renderer.drawing.pathRevealFrame = window.requestAnimationFrame(animate);
        return;
      }
      renderer.drawing.pathRevealFrame = null;
      reveal.resolve?.();
    };

    renderer.drawing.pathRevealFrame = window.requestAnimationFrame(animate);
    renderSvgOnly();
    return reveal;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  async function savePathOverlaySegment(campaignId, tool, fromHexId, toHexId, style, edge = null, routeMetadata = {}) {
    const { data, error } = await campaignSupabase.rpc("add_generated_map_overlay", {
      target_campaign_id: campaignId,
      target_overlay_type: tool,
      from_hex_ref: fromHexId,
      to_hex_ref: toHexId,
      target_edge: edge,
      target_style: style,
      target_is_major_route: Boolean(routeMetadata.isMajorRoute),
      target_route_name: routeMetadata.routeName || null
    });

    if (error) throw error;
    return adaptOverlayRpcRow(data);
  }

  async function persistWallOverlay(hexId, edge) {
    const campaign = getActiveCampaign?.();
    if (!campaign || !edge) return;
    if (renderer.mapOverlays.some(overlay => (
      overlay.Overlay_Type === "wall" &&
      overlay.Hex_ID_Ref === hexId &&
      overlay.Edge === edge
    ))) {
      return;
    }

    renderer.drawing.saving = true;

    try {
      const { data, error } = await campaignSupabase.rpc("add_generated_map_overlay", {
        target_campaign_id: campaign.id,
        target_overlay_type: "wall",
        from_hex_ref: hexId,
        to_hex_ref: null,
        target_edge: edge,
        target_style: "wall"
      });

      if (error) throw error;

      const overlay = adaptOverlayRpcRow(data);
      upsertLocalOverlay(overlay);
      pushOverlayUndoAction([overlay]);
      renderSvgOnly();
    } catch (error) {
      console.error("Unable to save generated map wall:", error);
      window.alert?.(error.message || "Unable to save map wall.");
    } finally {
      renderer.drawing.saving = false;
      updateDrawUndoButton();
      updateDrawRedoButton();
    }
  }

  async function persistMistOverlay(hexId) {
    const overlays = await persistMistOverlays([hexId]);
    if (!overlays.length) return;
    pushOverlayUndoAction(overlays);
    renderer.cacheDirty = true;
    render();
  }

  async function persistMistBrush(centerHex) {
    const hexIds = getMistBrushHexIds(centerHex);
    if (!hexIds.length) return;
    const overlays = await persistMistOverlays(hexIds);
    if (!overlays.length) return;
    pushOverlayUndoAction(overlays);
    renderer.cacheDirty = true;
    render();
  }

  async function persistMistOverlays(hexIds) {
    const campaign = getActiveCampaign?.();
    if (!campaign) return [];

    const existingMistHexIds = new Set((renderer.mapOverlays || [])
      .filter(overlay => overlay.Overlay_Type === "mist")
      .map(overlay => overlay.Hex_ID_Ref));
    const targetHexIds = [...new Set(hexIds || [])]
      .filter(hexId => hexId && !existingMistHexIds.has(hexId));
    if (!targetHexIds.length) return [];

    renderer.drawing.saving = true;

    try {
      const overlays = [];
      for (const hexId of targetHexIds) {
        const { data, error } = await campaignSupabase.rpc("add_generated_map_overlay", {
          target_campaign_id: campaign.id,
          target_overlay_type: "mist",
          from_hex_ref: hexId,
          to_hex_ref: null,
          target_edge: null,
          target_style: "mist"
        });

        if (error) throw error;
        const overlay = adaptOverlayRpcRow(data);
        if (overlay?.__uuid) {
          overlays.push(overlay);
          upsertLocalOverlay(overlay);
        }
      }
      return overlays;
    } catch (error) {
      console.error("Unable to save generated map mist:", error);
      window.alert?.(error.message || "Unable to save map mist.");
      return [];
    } finally {
      renderer.drawing.saving = false;
      updateDrawUndoButton();
      updateDrawRedoButton();
    }
  }

  async function eraseOverlaysAtHex(hexId) {
    const campaign = getActiveCampaign?.();
    if (!campaign) return;

    renderer.drawing.saving = true;

    try {
      const { error } = await campaignSupabase.rpc("erase_generated_map_overlays_at_hex", {
        target_campaign_id: campaign.id,
        target_hex_ref: hexId
      });

      if (error) throw error;

      const removed = renderer.mapOverlays.filter(overlay => (
        overlay.From_Hex_ID_Ref === hexId ||
        overlay.To_Hex_ID_Ref === hexId ||
        overlay.Hex_ID_Ref === hexId
      ));
      renderer.mapOverlays = renderer.mapOverlays.filter(overlay => (
        overlay.From_Hex_ID_Ref !== hexId &&
        overlay.To_Hex_ID_Ref !== hexId &&
        overlay.Hex_ID_Ref !== hexId
      ));
      if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
      pushOverlayUndoAction(removed.map(overlay => ({ ...overlay, __undoDeleted: true })));
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to erase generated map overlays:", error);
      window.alert?.(error.message || "Unable to erase map overlays.");
    } finally {
      renderer.drawing.saving = false;
      updateDrawUndoButton();
      updateDrawRedoButton();
    }
  }

  function pushOverlayUndoAction(overlays) {
    const valid = (overlays || []).filter(overlay => overlay?.__uuid);
    if (!valid.length) return;
    pushMapEditAction({ type: "overlay", overlays: valid });
  }

  function pushMapEditAction(action, options = {}) {
    if (!action?.type) return;
    if (renderer.drawing.dragActionBatch && !options.force) {
      renderer.drawing.dragActionBatch.actions.push(action);
      return;
    }
    renderer.drawing.undoStack.push(action);
    renderer.drawing.redoStack = [];
    updateDrawUndoButton();
    updateDrawRedoButton();
  }

  async function undoLastDrawAction() {
    const campaign = getActiveCampaign?.();
    const action = renderer.drawing.undoStack.pop();
    if (!campaign || !action?.type) {
      updateDrawUndoButton();
      return;
    }

    renderer.drawing.saving = true;
    const showBulkLoading = getMapEditActionSize(action) >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    updateDrawUndoButton();
    updateDrawRedoButton();

    try {
      await applyMapEditAction(campaign.id, action, "undo");
      renderer.drawing.redoStack.push(action);
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to undo generated map edit:", error);
      window.alert?.(error.message || "Unable to undo map edit.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
    }
  }

  function hexHasEraseableOverlays(hexId) {
    return getOverlaysAtHex(hexId).length > 0;
  }

  async function redoLastDrawAction() {
    const campaign = getActiveCampaign?.();
    const action = renderer.drawing.redoStack.pop();
    if (!campaign || !action?.type) {
      updateDrawRedoButton();
      return;
    }

    renderer.drawing.saving = true;
    const showBulkLoading = getMapEditActionSize(action) >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    updateDrawUndoButton();
    updateDrawRedoButton();

    try {
      await applyMapEditAction(campaign.id, action, "redo");
      renderer.drawing.undoStack.push(action);
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to redo generated map edit:", error);
      window.alert?.(error.message || "Unable to redo map edit.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
    }
  }

  function getMapEditActionSize(action) {
    if (action?.type === "batch") {
      return (action.actions || []).reduce((total, child) => total + getMapEditActionSize(child), 0);
    }
    if (action?.type === "nuke-overlays") return action.overlays?.length || 0;
    if (action?.type === "nuke-regions" || action?.type === "nuke-features") return action.actions?.length || 0;
    if (action?.type === "overlay") return action.overlays?.length || 0;
    return 1;
  }

  async function applyMapEditAction(campaignId, action, direction) {
    if (action.type === "batch") {
      const actions = direction === "undo"
        ? [...(action.actions || [])].reverse()
        : (action.actions || []);
      if (actions.length && actions.every(childAction => childAction?.type === "terrain")) {
        await applyTerrainBatchAction(campaignId, actions, direction);
        return;
      }
      for (const childAction of actions) {
        await applyMapEditAction(campaignId, childAction, direction);
      }
      return;
    }

    if (action.type === "overlay") {
      await applyOverlayHistoryAction(campaignId, action.overlays || [], direction);
      return;
    }

    if (action.type === "nuke-overlays") {
      await applyNukeOverlayAction(campaignId, action, direction);
      return;
    }

    if (action.type === "nuke-regions") {
      await applyNukeRegionAction(campaignId, action, direction);
      return;
    }

    if (action.type === "nuke-features") {
      await applyNukeFeatureAction(campaignId, action, direction);
      return;
    }

    if (action.type === "terrain") {
      const snapshot = direction === "undo" ? action.before : action.after;
      await applyTerrainSnapshot(campaignId, action.hexId, snapshot);
      return;
    }

    if (action.type === "region") {
      const snapshot = direction === "undo" ? action.before : action.after;
      await applyRegionSnapshot(campaignId, action.hexId, snapshot);
    }
  }

  async function applyOverlayHistoryAction(campaignId, overlays, direction) {
    for (const overlay of overlays) {
      const shouldDelete = direction === "redo" ? overlay.__undoDeleted : !overlay.__undoDeleted;
      if (shouldDelete) {
        await deleteOverlayById(campaignId, overlay.__uuid);
        removeLocalOverlayById(overlay.__uuid);
      } else {
        const restored = await restoreDeletedOverlay(campaignId, overlay);
        if (restored?.__uuid) overlay.__uuid = restored.__uuid;
      }
    }
  }

  async function applyTerrainBatchAction(campaignId, actions, direction) {
    const terrainActions = (actions || []).filter(action => action?.type === "terrain");
    if (!terrainActions.length) return;
    terrainActions.forEach(action => renderer.drawing.pendingTerrainSaves.delete(action.hexId));

    const { error } = await campaignSupabase.rpc("restore_generated_hex_terrain_snapshots", {
      target_campaign_id: campaignId,
      terrain_snapshot: serializeTerrainSnapshot(terrainActions, direction)
    });
    if (error) throw error;

    terrainActions.forEach(action => {
      applyLocalTerrainSnapshot(action.hexId, direction === "undo" ? action.before : action.after);
    });
  }

  async function applyNukeOverlayAction(campaignId, action, direction) {
    if (direction === "redo") {
      const { error } = await campaignSupabase.rpc("clear_generated_map_overlays", {
        target_campaign_id: campaignId
      });
      if (error) throw error;
      renderer.mapOverlays = [];
    } else {
      const { error } = await campaignSupabase.rpc("restore_generated_map_overlays", {
        target_campaign_id: campaignId,
        overlay_snapshot: serializeOverlaySnapshot(action.overlays || [])
      });
      if (error) throw error;
      renderer.mapOverlays = await fetchCurrentPersistedOverlays(campaignId);
    }

    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    updateDrawClearButton();
  }

  async function applyNukeRegionAction(campaignId, action, direction) {
    if (direction === "redo") {
      const { error } = await campaignSupabase.rpc("clear_generated_hex_region_layer", {
        target_campaign_id: campaignId,
        target_region_type: action.regionType === "political" ? "political" : "geographic"
      });
      if (error) throw error;
    } else {
      const { error } = await campaignSupabase.rpc("restore_generated_hex_region_snapshots", {
        target_campaign_id: campaignId,
        region_snapshot: serializeRegionSnapshot(action.actions || [])
      });
      if (error) throw error;
    }

    (action.actions || []).forEach(regionAction => {
      applyLocalRegionSnapshot(regionAction.hexId, direction === "undo" ? regionAction.before : regionAction.after);
    });
    renderSvgOnly();
  }

  async function applyNukeFeatureAction(campaignId, action, direction) {
    if (direction === "redo") {
      const { error } = await campaignSupabase.rpc("clear_generated_hex_features", {
        target_campaign_id: campaignId
      });
      if (error) throw error;
    } else {
      const { error } = await campaignSupabase.rpc("restore_generated_hex_feature_snapshots", {
        target_campaign_id: campaignId,
        feature_snapshot: serializeFeatureSnapshot(action.actions || [])
      });
      if (error) throw error;
    }

    (action.actions || []).forEach(terrainAction => {
      applyLocalTerrainSnapshot(terrainAction.hexId, direction === "undo" ? terrainAction.before : terrainAction.after);
    });
  }

  async function applyTerrainSnapshot(campaignId, hexId, snapshot) {
    if (!snapshot) return;
    const { data, error } = await campaignSupabase.rpc("update_generated_hex_terrain", {
      target_campaign_id: campaignId,
      target_hex_ref: hexId,
      target_base_terrain: snapshot.baseTerrain,
      target_terrain_features: snapshot.features || [],
      target_elevation: snapshot.elevation
    });
    if (error) throw error;
    updateLocalHexTerrain(hexId, data, snapshot);
  }

  function applyLocalTerrainSnapshot(hexId, snapshot) {
    if (!snapshot) return;
    updateLocalHexTerrain(hexId, null, snapshot);
  }

  async function applyRegionSnapshot(campaignId, hexId, snapshot) {
    if (!snapshot) return;
    const updates = [
      ["geographic", snapshot.geographicRegionId || UNCLAIMED_REGION_REF],
      ["political", snapshot.politicalRegionId || ""]
    ];

    for (const [regionType, regionId] of updates) {
      const { error } = await campaignSupabase.rpc("assign_generated_hex_region_layer", {
        target_campaign_id: campaignId,
        target_hex_ref: hexId,
        target_region_ref: regionId,
        target_region_type: regionType
      });
      if (error) throw error;
      updateLocalHexRegion(hexId, regionId, regionType);
    }
  }

  function applyLocalRegionSnapshot(hexId, snapshot) {
    if (!snapshot) return;
    updateLocalHexRegion(hexId, snapshot.geographicRegionId || UNCLAIMED_REGION_REF, "geographic");
    updateLocalHexRegion(hexId, snapshot.politicalRegionId || "", "political");
  }

  function serializeOverlaySnapshot(overlays) {
    return (overlays || []).map(overlay => ({
      overlay_type: overlay.Overlay_Type || "",
      from_hex_ref: overlay.From_Hex_ID_Ref || null,
      to_hex_ref: overlay.To_Hex_ID_Ref || null,
      hex_ref: overlay.Hex_ID_Ref || null,
      edge: overlay.Edge || null,
      style: overlay.Style || null,
      is_major_route: Boolean(overlay.Is_Major_Route),
      route_name: overlay.Route_Name || null
    }));
  }

  function serializeRegionSnapshot(actions) {
    return (actions || []).map(action => ({
      hex_ref: action.hexId,
      geographic_region_ref: action.before?.geographicRegionId || UNCLAIMED_REGION_REF,
      political_region_ref: action.before?.politicalRegionId || null
    }));
  }

  function serializeFeatureSnapshot(actions) {
    return (actions || []).map(action => ({
      hex_ref: action.hexId,
      terrain_features: action.before?.features || []
    }));
  }

  function serializeTerrainSnapshot(actions, direction = "undo") {
    return (actions || []).map(action => {
      const snapshot = direction === "undo" ? action.before : action.after;
      return {
        hex_ref: action.hexId,
        base_terrain: snapshot?.baseTerrain || "plains",
        terrain_features: snapshot?.features || [],
        elevation: Number.isFinite(Number(snapshot?.elevation)) ? Number(snapshot.elevation) : null
      };
    });
  }

  async function clearAllDrawnOverlays() {
    const campaign = getActiveCampaign?.();
    if (!campaign) return;

    if (!confirmNukeAction("Clear all drawn roads, rivers, paths, walls, and mist from this generated map?")) return;

    renderer.drawing.saving = true;
    let showBulkLoading = false;
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();

    try {
      const persistedOverlays = await fetchCurrentPersistedOverlays(campaign.id);
      const removed = persistedOverlays.length ? persistedOverlays : [...getCurrentMapOverlays()];
      if (!removed.length) return;

      showBulkLoading = removed.length >= BULK_OVERLAY_LOADING_THRESHOLD;
      if (showBulkLoading) setLoading(true);

      const { error } = await campaignSupabase.rpc("clear_generated_map_overlays", {
        target_campaign_id: campaign.id
      });

      if (error) throw error;

      renderer.mapOverlays = [];
      if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
      pushMapEditAction({ type: "nuke-overlays", overlays: removed }, { force: true });
      renderer.cacheDirty = true;
      render();
    } catch (error) {
      console.error("Unable to clear generated map overlays:", error);
      window.alert?.(error.message || "Unable to clear map overlays.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
    }
  }

  function openNamedRoutesMenu() {
    const menu = document.getElementById("map-named-routes-menu");
    if (!menu || !isActive() || !renderer.drawing.enabled) return;
    renderNamedRoutesList();
    clearNamedRouteEditForm();
    menu.classList.remove("hidden");
  }

  function closeNamedRoutesMenu() {
    document.getElementById("map-named-routes-menu")?.classList.add("hidden");
    clearNamedRouteEditForm();
  }

  function getNamedRouteGroups() {
    const groups = new Map();
    (renderer.mapOverlays || [])
      .filter(overlay => ["road", "river", "sea_route"].includes(overlay.Overlay_Type) && overlay.Route_Name)
      .forEach(overlay => {
        const type = overlay.Overlay_Type;
        const name = overlay.Route_Name || "";
        const key = `${type}::${name}`;
        if (!groups.has(key)) groups.set(key, { type, name, overlays: [] });
        groups.get(key).overlays.push(overlay);
      });
    return [...groups.values()].sort((a, b) => (
      routeTypeLabel(a.type).localeCompare(routeTypeLabel(b.type)) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    ));
  }

  function renderNamedRoutesList() {
    const list = document.getElementById("map-named-routes-list");
    if (!list) return;
    const groups = getNamedRouteGroups();
    if (!groups.length) {
      list.innerHTML = `<p class="map-edit-empty-note">No named routes yet.</p>`;
      return;
    }

    list.innerHTML = groups.map((route, index) => `
      <div class="map-named-route-item" data-route-index="${index}">
        <div>
          <strong>${escapeHtml(route.name)}</strong>
          <span>${escapeHtml(routeTypeLabel(route.type))} · ${route.overlays.length} segment${route.overlays.length === 1 ? "" : "s"}</span>
        </div>
        <button type="button" data-route-draw="${index}">Edit Route</button>
        <button type="button" data-route-edit="${index}">Edit</button>
        <button type="button" data-route-delete="${index}">Delete</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-route-edit]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const route = groups[Number(button.dataset.routeEdit)];
        if (route) startNamedRouteEdit(route);
      });
    });
    list.querySelectorAll("[data-route-draw]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const route = groups[Number(button.dataset.routeDraw)];
        if (route) activateNamedRouteDrawing(route);
      });
    });
    list.querySelectorAll("[data-route-delete]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const route = groups[Number(button.dataset.routeDelete)];
        if (route) deleteNamedRoute(route);
      });
    });
  }

  function routeTypeLabel(type) {
    if (type === "road") return "Road";
    if (type === "river") return "River";
    if (type === "sea_route") return "Sea Route";
    return type || "Route";
  }

  function activateNamedRouteDrawing(route) {
    if (!route?.type || !route.name) return;
    closeNamedRoutesMenu();
    setMapEditSection("overlay");
    renderer.drawing.tool = route.type;
    resetDrawingState();
    if (route.type === "road") {
      renderer.drawing.roadRouteMajor = true;
      renderer.drawing.roadRouteName = route.name;
      renderer.drawing.roadStyle = getOverlayBaseStyle(route.overlays?.[0]?.Style) || renderer.drawing.roadStyle || "dark_brown";
    } else if (route.type === "river") {
      renderer.drawing.riverRouteMajor = true;
      renderer.drawing.riverRouteName = route.name;
    } else if (route.type === "sea_route") {
      renderer.drawing.seaRouteName = route.name;
    }
    updateDrawToolButtons();
    updateDrawStyleControls();
    updateDrawHint();
  }

  function startNamedRouteEdit(route) {
    const form = document.getElementById("map-named-route-edit-form");
    const originalType = document.getElementById("map-named-route-original-type");
    const originalName = document.getElementById("map-named-route-original-name");
    const nameInput = document.getElementById("map-named-route-name");
    if (!form || !originalType || !originalName || !nameInput) return;
    originalType.value = route.type;
    originalName.value = route.name;
    nameInput.value = route.name;
    form.hidden = false;
    nameInput.focus();
  }

  function clearNamedRouteEditForm() {
    const form = document.getElementById("map-named-route-edit-form");
    if (!form) return;
    form.hidden = true;
    form.reset();
  }

  async function saveNamedRouteEdit() {
    const campaign = getActiveCampaign?.();
    const originalType = document.getElementById("map-named-route-original-type")?.value || "";
    const originalName = document.getElementById("map-named-route-original-name")?.value || "";
    const nextName = (document.getElementById("map-named-route-name")?.value || "").trim();
    if (!campaign || !originalType || !originalName || !nextName) return;

    renderer.drawing.saving = true;
    try {
      const { data, error } = await campaignSupabase.rpc("update_named_generated_route", {
        target_campaign_id: campaign.id,
        current_route_type: originalType,
        current_route_name: originalName,
        next_route_name: nextName
      });
      if (error) throw error;
      (data || []).map(adaptOverlayRpcRow).filter(Boolean).forEach(upsertLocalOverlay);
      renderer.routeLabelCache = { key: "", labels: [] };
      renderer.cacheDirty = true;
      clearNamedRouteEditForm();
      renderNamedRoutesList();
      render();
    } catch (error) {
      console.error("Unable to update named route:", error);
      window.alert?.(error.message || "Unable to update named route.");
    } finally {
      renderer.drawing.saving = false;
    }
  }

  async function deleteNamedRoute(route) {
    const campaign = getActiveCampaign?.();
    if (!campaign || !route?.overlays?.length) return;
    if (!window.confirm?.(`Delete ${routeTypeLabel(route.type)} "${route.name}" from the map?`)) return;

    renderer.drawing.saving = true;
    try {
      const removed = [];
      for (const overlay of route.overlays) {
        await deleteOverlayById(campaign.id, overlay.__uuid);
        removeLocalOverlayById(overlay.__uuid);
        removed.push({ ...overlay, __undoDeleted: true });
      }
      pushOverlayUndoAction(removed);
      renderer.routeLabelCache = { key: "", labels: [] };
      renderer.cacheDirty = true;
      renderNamedRoutesList();
      render();
    } catch (error) {
      console.error("Unable to delete named route:", error);
      window.alert?.(error.message || "Unable to delete named route.");
    } finally {
      renderer.drawing.saving = false;
      updateDrawUndoButton();
      updateDrawRedoButton();
    }
  }

  async function clearAllGeneratedRegions(regionType) {
    const campaign = getActiveCampaign?.();
    const normalizedType = regionType === "political" ? "political" : "geographic";
    const label = normalizedType === "political" ? "political" : "geographic";
    if (!campaign) return;
    if (!confirmNukeAction(`Clear all ${label} region paint from this generated map? Region Codex entries will not be deleted.`)) return;

    const actions = renderer.hexes
      .map(hex => {
        const before = getRegionSnapshot(hex.id);
        if (!before) return null;
        const targetRegionId = normalizedType === "political" ? "" : UNCLAIMED_REGION_REF;
        if (normalizedType === "political" && !before.politicalRegionId) return null;
        if (normalizedType === "geographic" && before.geographicRegionId === targetRegionId) return null;
        return {
          type: "region",
          hexId: hex.id,
          regionType: normalizedType,
          before,
          after: {
            geographicRegionId: normalizedType === "geographic" ? targetRegionId : before.geographicRegionId,
            politicalRegionId: normalizedType === "political" ? "" : before.politicalRegionId
          }
        };
      })
      .filter(Boolean);

    if (!actions.length) return;
    await runBulkNukeAction({
      actions,
      rpcName: "clear_generated_hex_region_layer",
      rpcArgs: {
        target_campaign_id: campaign.id,
        target_region_type: normalizedType
      },
      applyLocal: () => {
        actions.forEach(action => {
          applyLocalRegionSnapshot(action.hexId, action.after);
        });
        renderSvgOnly();
      },
      historyAction: { type: "nuke-regions", regionType: normalizedType, actions },
      errorPrefix: `Unable to clear ${label} regions`
    });
  }

  async function clearAllGeneratedFeatures() {
    const campaign = getActiveCampaign?.();
    if (!campaign) return;
    if (!confirmNukeAction("Clear all terrain features from this generated map? Base terrain and elevation will be preserved.")) return;

    const actions = renderer.hexes
      .map(hex => {
        const before = getTerrainSnapshot(hex.id);
        if (!before?.features?.length) return null;
        return {
          type: "terrain",
          hexId: hex.id,
          before,
          after: {
            ...before,
            features: []
          }
        };
      })
      .filter(Boolean);

    if (!actions.length) return;
    await runBulkNukeAction({
      actions,
      rpcName: "clear_generated_hex_features",
      rpcArgs: {
        target_campaign_id: campaign.id
      },
      applyLocal: () => {
        actions.forEach(action => {
          applyLocalTerrainSnapshot(action.hexId, action.after);
        });
        renderer.cacheDirty = true;
        render();
      },
      historyAction: { type: "nuke-features", actions },
      errorPrefix: "Unable to clear terrain features"
    });
  }

  async function runBulkNukeAction({ actions, rpcName, rpcArgs, applyLocal, historyAction, errorPrefix }) {
    renderer.drawing.saving = true;
    const showBulkLoading = actions.length >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();

    try {
      const { error } = await campaignSupabase.rpc(rpcName, rpcArgs);
      if (error) throw error;
      applyLocal?.();
      pushMapEditAction(historyAction || { type: "batch", actions }, { force: true });
    } catch (error) {
      console.error(`${errorPrefix}:`, error);
      window.alert?.(error.message || `${errorPrefix}.`);
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      updateDrawUndoButton();
      updateDrawRedoButton();
      updateDrawClearButton();
    }
  }

  function confirmNukeAction(message) {
    if (typeof window.confirm !== "function") {
      window.alert?.("Confirmation is unavailable, so nothing was changed.");
      return false;
    }
    return window.confirm(message) === true;
  }

  async function fetchCurrentPersistedOverlays(campaignId) {
    const { data, error } = await campaignSupabase
      .from("generated_map_overlays")
      .select("id, overlay_type, from_hex_id, to_hex_id, hex_id, edge, style, is_major_route, route_name")
      .eq("campaign_id", campaignId);

    if (error) throw error;
    return (data || []).map(adaptOverlayRpcRow).filter(Boolean);
  }

  async function deleteOverlayById(campaignId, overlayId) {
    const { error } = await campaignSupabase.rpc("delete_generated_map_overlay", {
      target_campaign_id: campaignId,
      target_overlay_id: overlayId
    });
    if (error) throw error;
  }

  async function restoreDeletedOverlay(campaignId, overlay) {
    const isHexOverlay = overlay.Overlay_Type === "wall" || overlay.Overlay_Type === "mist";
    const { data, error } = await campaignSupabase.rpc("add_generated_map_overlay", {
      target_campaign_id: campaignId,
      target_overlay_type: overlay.Overlay_Type,
      from_hex_ref: isHexOverlay ? overlay.Hex_ID_Ref : overlay.From_Hex_ID_Ref,
      to_hex_ref: isHexOverlay ? null : overlay.To_Hex_ID_Ref,
      target_edge: overlay.Overlay_Type === "wall" || (!isHexOverlay && !overlay.To_Hex_ID_Ref) ? overlay.Edge : null,
      target_style: overlay.Style,
      target_is_major_route: Boolean(overlay.Is_Major_Route),
      target_route_name: overlay.Route_Name || null
    });

    if (error) throw error;
    const restored = adaptOverlayRpcRow(data);
    upsertLocalOverlay(restored);
    return restored;
  }

  function adaptOverlayRpcRow(row) {
    const record = Array.isArray(row) ? row[0] : row;
    if (!record) return null;

    return {
      __uuid: record.id,
      Overlay_Type: record.overlay_type || "",
      From_Hex_ID_Ref: getHexRefForUuid(record.from_hex_id),
      To_Hex_ID_Ref: getHexRefForUuid(record.to_hex_id),
      Hex_ID_Ref: getHexRefForUuid(record.hex_id),
      Edge: record.edge || "",
      Style: record.style || "",
      Is_Major_Route: Boolean(record.is_major_route),
      Route_Name: record.route_name || ""
    };
  }

  function getHexRefForUuid(hexUuid) {
    if (!hexUuid) return "";
    return renderer.hexes.find(hex => hex.record?.__uuid === hexUuid)?.id || "";
  }

  function upsertLocalOverlay(overlay) {
    if (!overlay?.__uuid) return;

    const existingIndex = renderer.mapOverlays.findIndex(candidate => candidate.__uuid === overlay.__uuid);
    if (existingIndex >= 0) {
      renderer.mapOverlays.splice(existingIndex, 1, overlay);
    } else {
      renderer.mapOverlays.push(overlay);
    }

    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    renderer.cacheDirty = true;
    updateDrawClearButton();
  }

  function removeLocalWallOverlay(hexId, edge) {
    const removed = renderer.mapOverlays.filter(overlay => (
      overlay.Overlay_Type === "wall" &&
      overlay.Hex_ID_Ref === hexId &&
      overlay.Edge === edge
    ));
    renderer.mapOverlays = renderer.mapOverlays.filter(overlay => !(
      overlay.Overlay_Type === "wall" &&
      overlay.Hex_ID_Ref === hexId &&
      overlay.Edge === edge
    ));
    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    return removed;
  }

  function removeLocalOverlayById(overlayId) {
    renderer.mapOverlays = renderer.mapOverlays.filter(overlay => overlay.__uuid !== overlayId);
    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    renderer.cacheDirty = true;
    updateDrawClearButton();
  }

  function nearestEdgeFromWorldPoint(point, hex) {
    let bestEdge = EDGE_NAMES[0];
    let bestDistance = Infinity;

    hex.points.forEach((edgeStart, index) => {
      const edgeEnd = hex.points[(index + 1) % hex.points.length];
      const distance = distanceToSegment(point, edgeStart, edgeEnd);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEdge = EDGE_NAMES[index];
      }
    });

    return bestEdge;
  }

  function getDrawingHoverEdge(tool, point, hex) {
    if (!hex) return null;
    if (tool === "wall") {
      return { hexId: hex.id, edge: nearestEdgeFromWorldPoint(point, hex) };
    }

    if (!PATH_OVERLAY_TYPES.has(tool)) return null;
    if (tool === "sea_route" && !canSeaRouteUseHex(hex)) return null;
    const exitEdge = getBorderExitEdgeAtPoint(point, hex);
    return exitEdge ? { hexId: hex.id, edge: exitEdge } : null;
  }

  function getBorderExitEdgeAtPoint(point, hex) {
    if (!hex) return "";
    const edge = nearestEdgeFromWorldPoint(point, hex);
    if (!isBorderEdge(hex, edge)) return "";

    const edgeSegment = getHexEdgeSegment(hex, edge);
    const dimensions = getGeneratedMapDimensions();
    return edgeSegment && distanceToSegment(point, edgeSegment.a, edgeSegment.b) <= dimensions.radius * 0.42
      ? edge
      : "";
  }

  function isBorderEdge(hex, edge) {
    return Boolean(hex && edge && !getNeighborHex(hex, edge));
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    const projection = {
      x: a.x + t * dx,
      y: a.y + t * dy
    };
    return Math.hypot(point.x - projection.x, point.y - projection.y);
  }

  function getHexLineSequence(fromHexId, toHexId) {
    const fromHex = renderer.hexes.find(hex => hex.id === fromHexId);
    const toHex = renderer.hexes.find(hex => hex.id === toHexId);
    if (!fromHex || !toHex) return [fromHexId, toHexId];

    const distance = Math.hypot(toHex.center.x - fromHex.center.x, toHex.center.y - fromHex.center.y);
    const dimensions = getGeneratedMapDimensions();
    const steps = Math.max(1, Math.ceil(distance / (dimensions.radius * 0.55)));
    const sequence = [];

    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const point = {
        x: fromHex.center.x + (toHex.center.x - fromHex.center.x) * t,
        y: fromHex.center.y + (toHex.center.y - fromHex.center.y) * t
      };
      const hex = getHexAtWorldPoint(point);
      if (hex && sequence[sequence.length - 1] !== hex.id) {
        sequence.push(hex.id);
      }
    }

    if (sequence[0] !== fromHexId) sequence.unshift(fromHexId);
    if (sequence[sequence.length - 1] !== toHexId) sequence.push(toHexId);
    return sequence;
  }

  function getPathOverlaySequence(tool, fromHexId, toHexId, exitEdge = "") {
    if (tool === "road" && !exitEdge && fromHexId !== toHexId && !renderer.drawing.roadWaterOverride) {
      return getRoadPathSequence(fromHexId, toHexId) || getHexLineSequence(fromHexId, toHexId);
    }
    if (tool === "sea_route" && !exitEdge && fromHexId !== toHexId) {
      return getSeaRoutePathSequence(fromHexId, toHexId) || getHexLineSequence(fromHexId, toHexId);
    }
    return getHexLineSequence(fromHexId, toHexId);
  }

  function getRoadPathSequence(fromHexId, toHexId) {
    return getWeightedHexPathSequence(fromHexId, toHexId, getRoadPathStepCost, roadPathHeuristic);
  }

  function getSeaRoutePathSequence(fromHexId, toHexId) {
    return getWeightedHexPathSequence(fromHexId, toHexId, getSeaRouteStepCost, roadPathHeuristic);
  }

  function getWeightedHexPathSequence(fromHexId, toHexId, getStepCost, getHeuristic) {
    const start = renderer.hexes.find(hex => hex.id === fromHexId);
    const goal = renderer.hexes.find(hex => hex.id === toHexId);
    if (!start || !goal) return null;

    const open = new Set([start.id]);
    const cameFrom = new Map();
    const bestCost = new Map([[start.id, 0]]);
    const estimatedTotal = new Map([[start.id, getHeuristic(start, goal)]]);

    while (open.size) {
      const currentId = [...open].reduce((bestId, candidateId) => (
        (estimatedTotal.get(candidateId) ?? Infinity) < (estimatedTotal.get(bestId) ?? Infinity)
          ? candidateId
          : bestId
      ));
      const current = renderer.hexes.find(hex => hex.id === currentId);
      if (!current) {
        open.delete(currentId);
        continue;
      }
      if (current.id === goal.id) return reconstructRoadPath(cameFrom, current.id);

      open.delete(current.id);
      EDGE_NAMES.forEach(edgeName => {
        const neighbor = getNeighborHex(current, edgeName);
        if (!neighbor) return;
        const stepCost = getStepCost(current, neighbor, goal, start);
        if (!Number.isFinite(stepCost)) return;

        const nextCost = (bestCost.get(current.id) ?? Infinity) + stepCost;
        if (nextCost >= (bestCost.get(neighbor.id) ?? Infinity)) return;
        cameFrom.set(neighbor.id, current.id);
        bestCost.set(neighbor.id, nextCost);
        estimatedTotal.set(neighbor.id, nextCost + getHeuristic(neighbor, goal));
        open.add(neighbor.id);
      });
    }

    return null;
  }

  function reconstructRoadPath(cameFrom, currentId) {
    const sequence = [currentId];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId);
      sequence.unshift(currentId);
    }
    return sequence;
  }

  function roadPathHeuristic(hex, goal) {
    const dimensions = getGeneratedMapDimensions();
    return Math.hypot(goal.center.x - hex.center.x, goal.center.y - hex.center.y) / Math.max(1, dimensions.radius);
  }

  function getRoadPathStepCost(fromHex, toHex, goalHex) {
    if (ROAD_IMPASSABLE_WATER_TERRAINS.has(toHex.baseTerrain) && toHex.id !== goalHex.id) return Infinity;
    if (canRoadCrossWaterHex(fromHex) && canRoadCrossWaterHex(toHex) && toHex.id !== goalHex.id) return Infinity;

    let cost = ROAD_BASE_TERRAIN_COSTS[toHex.baseTerrain] ?? 3;
    if (canRoadCrossWaterHex(toHex)) {
      cost += renderer.drawing.roadRouteMajor ? MAJOR_ROAD_WATER_PATH_COST : ROAD_WATER_PATH_COST;
    }

    cost += getRoadFeaturePathCost(toHex);
    cost += getRoadElevationPathCost(fromHex, toHex);
    if (hasExistingRoadSegment(fromHex.id, toHex.id)) cost *= 0.42;
    return Math.max(0.2, cost);
  }

  function getSeaRouteStepCost(fromHex, toHex, goalHex, startHex) {
    if (isWaterHex(toHex)) return 1;
    if (toHex.id === goalHex.id && canSeaRouteUseHex(toHex)) return 1.25;
    if (fromHex.id === startHex.id && isWaterHex(toHex)) return 1;
    return Infinity;
  }

  const ROAD_BASE_TERRAIN_COSTS = {
    plains: 1,
    grassland: 1,
    lush_grassland: 1.15,
    beach: 1.2,
    farmland: 1.2,
    wetland: 4.8,
    jungle_floor: 5.8,
    desert: 2.6,
    deep_desert: 4,
    barrens: 3.4,
    bleak_barrens: 4.6,
    snow: 4,
    rock: 4.8,
    wastes: 6,
    coastal_water: 2,
    inland_water: 2,
    sea: 999,
    deep_sea: 999
  };

  function getRoadFeaturePathCost(hex) {
    return (hex.features || []).reduce((total, feature) => {
      if (feature === "woods") return total + 0.5;
      if (feature === "forest") return total + 1.6;
      if (feature === "shrub" || feature === "farmland") return total + 0.35;
      if (feature === "ridges") return total + 0.15;
      if (feature === "marsh") return total + 3.2;
      if (["mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature)) return total + 2.4;
      if (feature === "cliffs") return total + 3.4;
      if (feature === "jungle") return total + 4.6;
      return total;
    }, 0);
  }

  function getRoadElevationPathCost(fromHex, toHex) {
    const delta = Math.abs(Number(toHex.elevation || 0) - Number(fromHex.elevation || 0));
    if (delta <= 0) return 0;
    const passDiscount = isRoadPassHex(fromHex) || isRoadPassHex(toHex) ? 0.45 : 1;
    return (delta * 0.8 + Math.max(0, delta - 1) * 1.35) * passDiscount;
  }

  function hasExistingRoadSegment(fromHexId, toHexId) {
    return (renderer.mapOverlays || []).some(overlay => (
      overlay.Overlay_Type === "road" &&
      overlay.To_Hex_ID_Ref &&
      (
        overlay.From_Hex_ID_Ref === fromHexId && overlay.To_Hex_ID_Ref === toHexId ||
        overlay.From_Hex_ID_Ref === toHexId && overlay.To_Hex_ID_Ref === fromHexId
      )
    ));
  }

  function selectGeneratedHex(hexId, options = {}) {
    renderer.selectedHexId = hexId;
    selectedHexId = hexId;
    selectedHex = { setStyle() {} };
    showPopup(hexId, options);
    render();
  }

  function showPopup(hexId, options = {}) {
    renderer.popup.innerHTML = `<div class="generated-map-popup-content">${buildMobilePopupHtml?.(hexId, options) || ""}</div>`;
    renderer.popup.hidden = false;
    positionPopup();
  }

  function positionPopup() {
    if (!renderer.popup || renderer.popup.hidden || !renderer.selectedHexId) return;

    const hex = renderer.hexes.find(candidate => candidate.id === renderer.selectedHexId);
    if (!hex) return;

    const point = worldToClient(hex.center);
    renderer.popup.style.left = `${point.x}px`;
    renderer.popup.style.top = `${point.y - 34}px`;
  }

  function clearSelection() {
    renderer.selectedHexId = null;
    if (renderer.popup) {
      renderer.popup.hidden = true;
      renderer.popup.innerHTML = "";
    }
    render();
  }

  function centerHexInView(hexId, biasForInspector = false) {
    const hex = renderer.hexes.find(candidate => candidate.id === hexId || candidate.label === hexId);
    const rect = renderer.root?.getBoundingClientRect();
    if (!hex || !rect) return;

    const desiredX = rect.width * (biasForInspector ? 0.33 : 0.5);
    const desiredY = rect.height * 0.5;
    renderer.view.panX = hex.center.x - desiredX / renderer.view.zoom;
    renderer.view.panY = hex.center.y - desiredY / renderer.view.zoom;
    render();
  }

  window.generatedMapRenderer = {
    clearSelection,
    centerHexInView,
    beginLoading,
    deactivate() {
      resetEditorStateForCampaignSwitch(null);
      setActive(false);
    },
    fitViewToMap() {
      fitViewToMap();
      render();
    },
    isActive,
    renderFromDatabase,
    refreshOverlayLayerFromDatabase,
    refreshPoiLayerFromDatabase,
    refreshRegionLayerFromDatabase,
    selectGeneratedHex
  };
})();
