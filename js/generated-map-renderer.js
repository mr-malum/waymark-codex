(function () {
  const TERRAIN_RULES = window.CampaignTerrainRules || {};
  const TERRAIN_COLORS = {
    deep_sea: "#0b263a",
    sea: "#245f82",
    coastal_water: "#4a91ab",
    inland_water: "#79b8c8",
    beach: "#dbc487",
    plains: "#9DC156",
    grassland: "#6AA754",
    lush_grassland: "#47942C",
    wetland: "#3d6856",
    jungle_floor: "#3E855A",
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
    plains: ["woods", "shrub", "ridges", "lone_mountain"],
    grassland: ["woods", "forest", "shrub", "ridges", "lone_mountain"],
    lush_grassland: ["woods", "forest", "shrub", "ridges", "marsh"],
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
  const FEATURE_IMAGE_BATCH_SIZE = 8;
  const BULK_OVERLAY_LOADING_THRESHOLD = 10;
  const INITIAL_MAP_LOADING_VEIL_MS = 650;
  const PATH_REVEAL_MIN_DURATION = 320;
  const PATH_REVEAL_MAX_DURATION = 820;
  const ZOOM_STEP_LOCK_MS = 260;
  const PATH_WOBBLE_BASE = 0.08;
  const PATH_WOBBLE_MAX = 0.22;
  const ROAD_WATER_CROSSING_MAX_ELEVATION_DELTA = 1;
  const STEEP_ROUTE_ELEVATION_DELTA = 2;
  const EXTREME_ROUTE_ELEVATION_DELTA = 3;
  const RIVER_FALLS_ELEVATION_DELTA = 2;
  const RIVER_FALLS_CHANCE = 58;
  const COASTAL_RIVER_FALLS_CHANCE = 18;
  const ROAD_WATER_PATH_COST = 5;
  const MAJOR_ROAD_WATER_PATH_COST = 7;
  const ROAD_IMPASSABLE_WATER_TERRAINS = new Set(["sea", "deep_sea"]);
  const ROUGH_PATH_BASE_TERRAINS = new Set(["rock", "barrens", "bleak_barrens", "wastes", "desert", "deep_desert"]);
  const ROUGH_PATH_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "ridges", "cliffs"]);
  const ROAD_PASS_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"]);
  const MAJOR_RIVER_CULVERT_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"]);
  const FEATURE_ASSET_PATH = "hex-mapper/assets/features/";
  const ROUTE_ICON_ASSET_PATH = "hex-mapper/assets/other/";
  const POI_ICON_ASSET_PATH = window.CampaignPoiIcons?.ASSET_BASE_PATH || "hex-mapper/assets/POIs/";
  const POI_ICON_FALLBACK = window.CampaignPoiIcons?.FALLBACK_ICON || "unknown_marker";
  const ROUTE_ICON_FILES = {
    road: "cart.svg",
    river: "barge.svg",
    sea_route: "ship.svg"
  };
  const POI_ICON_FILES = (window.CampaignPoiIcons?.getIconOptions?.() || []).map(option => ({
    value: option.value,
    file: `${option.value}.svg`
  }));
  const EDGE_NAMES = ["E", "SE", "SW", "W", "NW", "NE"];
  const UNCLAIMED_REGION_REF = "REG-0000";
  const DRAWABLE_OVERLAY_TYPES = new Set(["road", "river", "sea_route", "path", "wall", "mist", "farmland", "region", "unregion", "political-region", "clear-political-region", "erase", "terrain", "terrain-eyedropper", "feature", "feature-erase", "feature-eyedropper"]);
  const HEX_STYLE_OVERLAY_TYPES = new Set(["wall", "mist", "farmland"]);
  const REGION_PAINT_TYPES = new Set(["region", "unregion", "political-region", "clear-political-region"]);
  const PATH_OVERLAY_TYPES = new Set(["road", "river", "sea_route", "path"]);
  const OVERLAY_TYPE_LABELS = {
    road: "roads",
    river: "rivers",
    path: "paths",
    sea_route: "sea routes",
    wall: "walls",
    mist: "mist",
    farmland: "farmland"
  };
  const POI_GENERATION_GLOBAL_CONTROL_KEYS = Object.freeze([
    "generationSettlementDensity",
    "generationResourceAmount",
    "generationWaypointAmount",
    "generationStrongholdAmount",
    "generationDungeonAmount",
    "generationDungeonComplexAmount",
    "generationSiteAmount"
  ]);
  const FARMLAND_OVERLAY_BASES = new Set(["plains", "grassland", "lush_grassland"]);
  const FARMLAND_RESOURCE_ICONS = new Set(["farmstead", "windmill"]);
  const FARMLAND_WAYPOINT_ICONS = new Set(["inn", "tavern", "lodge", "campsite"]);
  const FARMLAND_ALLOWED_FEATURES = new Set(["ridges", "woods", "forest"]);
  const FARMLAND_BLOCKING_FEATURES = new Set(["marsh", "jungle", "cactus_scrub", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ice"]);
  const ALL_TERRAIN_FEATURES = Object.keys(TERRAIN_FEATURE_LABELS);
  const CHAOS_BASE_TERRAIN_OPTIONS = BASE_TERRAIN_OPTIONS
    .map(([base]) => base)
    .filter(base => base !== "chaos");
  const FEATURE_BRUSH_OPTIONS = [
    { id: "generated", label: "Generated Detail", mode: "generated" },
    { id: "vegetation", label: "Vegetation", features: ["woods", "forest", "jungle", "shrub", "kelp", "marsh", "cactus_scrub"] },
    { id: "highlands", label: "Highlands", features: ["ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"] },
    { id: "water", label: "Water Detail", features: ["waves", "shoals", "reef", "kelp", "water_rocks", "whirlpool", "rapids", "falls", "marsh", "ice"] },
    { id: "sand", label: "Sand", features: ["sand"] },
    { id: "chaos", label: "Chaos", features: ALL_TERRAIN_FEATURES, ignoreCompatibility: true }
  ];
  const FEATURE_BRUSH_NOTES = {
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
  const WALL_BASE_STYLES = new Set(["wall", "palisade"]);
  const WALL_VARIANTS = new Set(["", "gatehouse", "sluice", "broken", "gate", "water_gate"]);
  const MAP_EDIT_SECTION_COPY = {
    chooser: {
      title: "Map Tools",
      copy: "Choose Surveyor for live map management or Cartographer for staged preview editing."
    },
    surveyor: {
      title: "Surveyor",
      copy: "Manage saved map data directly. Changes here write to the live map immediately."
    },
    cartographer: {
      title: "Cartographer",
      copy: "Stage terrain and feature changes locally before you apply them."
    },
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
      copy: "Draw roads, rivers, paths, walls, mist, and farmland directly onto the saved map."
    },
    pois: {
      title: "POIs",
      copy: "Generate and manage live-map points of interest directly in the codex."
    },
    regions: {
      title: "Regions",
      copy: "Assign geographic and political regions without leaving the map."
    },
    purge: {
      title: "Purge",
      copy: "Clean up saved live-map overlays, POIs, and region paint from one place."
    },
    nuke: {
      title: "Archive",
      copy: "Placeholder for future map import and export tools."
    },
    generation: {
      title: "Generation",
      copy: "Run map generation passes for the active tool section."
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
    wetland: { vegetation: "#53993A", relief: "#3f534a", surface: "#2f6254" },
    jungle_floor: { vegetation: "#167311", relief: "#244a35", surface: "#1f5a45" },
    desert: { vegetation: "#5f6134", relief: "#735336", surface: "#8a693d" },
    deep_desert: { vegetation: "#5a5430", relief: "#68472f", surface: "#7b5636" },
    barrens: { vegetation: "#5b5a35", relief: "#6a4435", surface: "#754c3a" },
    bleak_barrens: { vegetation: "#514b34", relief: "#56352f", surface: "#664039" },
    snow: { vegetation: "#203f35", relief: "#68777c", surface: "#d8eef2" },
    rock: { vegetation: "#203f35", relief: "#4d463d", surface: "#5b5147" },
    wastes: { vegetation: "#5f4b41", relief: "#7f5f54", surface: "#74554a" }
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
    stronghold: "♜",
    farm: "▦",
    castle: "♜",
    ruins: "✦",
    ruin: "✦",
    dungeon: "◆",
    dungeon_complex: "⬢",
    holy_site: "✜",
    arcane_site: "✶",
    waypoint: "◈",
    resource_site: "▦",
    wilderness_site: "▲",
    hazard: "⚠",
    landmark: "✦",
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
    routeCacheCanvas: document.createElement("canvas"),
    routeCacheCtx: null,
    routeCacheDirty: true,
    featureCacheCanvas: document.createElement("canvas"),
    featureCacheCtx: null,
    featureCacheDirty: true,
    initialMapLoadingTimer: null,
    overlayCacheCanvas: document.createElement("canvas"),
    overlayCacheCtx: null,
    overlayCacheDirty: true,
    featureAssets: new Map(),
    featureSourceImages: new Map(),
    featureImages: new Map(),
    featureImageUsage: new Map(),
    featureImageQueue: [],
    featureImageQueued: new Set(),
    featureImageFrame: null,
    featureImageActiveLoads: 0,
    featureImageStartupBatchDirty: false,
    featureAssetsLoading: null,
    featureAssetsLoaded: false,
    routeIconAssets: new Map(),
    routeIconAssetsLoading: null,
    routeIconAssetsLoaded: false,
    poiIconAssets: new Map(),
    poiIconAssetsLoading: null,
    poiIconAssetsLoaded: false,
    initialMapLoadingActive: false,
    initialMapLoadingStartedAt: 0,
    poiHexIds: new Set(),
    poisByHexId: new Map(),
    mapOverlays: [],
    routeLabelCache: { key: "", labels: [] },
    svg: null,
    popup: null,
    popupOptions: {},
    loadingVeil: null,
    hexes: [],
    hexesById: new Map(),
    hexIdsByUuid: new Map(),
    hexesByCoord: new Map(),
    overlayRevision: 0,
    overlaysByTypeCache: { revision: -1, groups: null },
    snapHexIdsCache: { revision: -1, type: "", hexIds: new Set() },
    riverFallsHexIdsCache: { revision: -1, hexIds: new Set() },
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
      toolsMode: "chooser",
      surveyorSection: "overlay",
      surveyorOverlaySubview: "paint",
      surveyorPoiSubview: "generate",
      surveyorMode: "manual",
      surveyorManualSection: "overlay",
      surveyorGenerationSection: "pois",
      cartographerMode: "manual",
      cartographerSection: "terrain",
      tool: "road",
      roadStyle: "dark_brown",
      wallStyle: "wall",
      wallVariant: "auto",
      wallMode: "regular",
      wallSize: 1,
      wallShape: "round_keep",
      wallPlaneDrag: null,
      roadWaterOverride: false,
      autoPass: true,
      autoFalls: true,
      roadRouteMajor: false,
      roadRouteName: "",
      riverRouteMajor: false,
      riverRouteName: "",
      riverWaterPull: 100,
      riverWildness: 100,
      riverTerrainRespect: 100,
      riverStraightness: 0,
      riverTributaries: true,
      riverWetlandVanish: false,
      seaRouteName: "",
      mistBrushSize: 1,
      mistNoise: 0,
      regionBrushSize: 1,
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
      generationRoadLength: 100,
      generationIncludePaths: true,
      generationIncludeTradeRoutes: false,
      generationRiverAmount: 100,
      generationRiverLength: 100,
      generationRiverWildcards: 100,
      generationPoiGlobalAmount: 100,
      generationSettlementDensity: 100,
      generationPopulationConcentration: 100,
      generationResourceAmount: 100,
      generationWaypointAmount: 100,
      generationStrongholdAmount: 100,
      generationDungeonAmount: 100,
      generationDungeonComplexAmount: 100,
      generationSiteAmount: 100,
      generationReplaceGeneratedPois: true,
      generationSection: "terrain",
      stagedTerrainOriginals: new Map(),
      terrainDirtyHexIds: new Set(),
      stagedOverlayBaseline: null,
      stagedUndoStack: [],
      stagedRedoStack: [],
      editorIntroSeen: false,
      beforeUnloadBound: false,
      generationPreviewOriginals: new Map(),
      generationPreviewActions: [],
      surveyorUndoStack: [],
      surveyorRedoStack: [],
      cartographerUndoStack: [],
      cartographerRedoStack: [],
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
        coords: true,
        features: true,
        pois: true
      },
      preEditVisibleOverlays: null,
      lastHexId: null,
      dragLastHexId: null,
      paintedThisDrag: new Set(),
      hexStyleBrushPreview: {
        mist: { pending: new Set(), inflight: new Set() },
        farmland: { pending: new Set(), inflight: new Set() }
      },
      dragActionBatch: null,
      dragActionCommitTimer: null,
      queuedRenderFrame: null,
      queuedFullRender: false,
      featureViewportKey: "",
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
    renderer.routeCacheCtx = renderer.routeCacheCanvas.getContext("2d");
    renderer.featureCacheCtx = renderer.featureCacheCanvas.getContext("2d");
    renderer.overlayCacheCtx = renderer.overlayCacheCanvas.getContext("2d");
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
    const loadingLockCount = Number(renderer?.drawing?.loadingVeilLockCount || 0);
    if (!isLoading && loadingLockCount > 0) return;
    veil.hidden = !isLoading;
    renderer.root?.classList.toggle("generated-map-is-loading", Boolean(isLoading));
  }

  function lockLoadingVeil() {
    if (!renderer?.drawing) return;
    renderer.drawing.loadingVeilLockCount = Number(renderer.drawing.loadingVeilLockCount || 0) + 1;
    setLoading(true);
  }

  function unlockLoadingVeil() {
    if (!renderer?.drawing) return;
    renderer.drawing.loadingVeilLockCount = Math.max(0, Number(renderer.drawing.loadingVeilLockCount || 0) - 1);
    if (!renderer.drawing.loadingVeilLockCount) setLoading(false);
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
    syncMapInteractionCursor();
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
    rebuildHexIndexes();
    renderer.hexesByCoord = new Map(renderer.hexes.map(hex => [`${hex.x}:${hex.y}`, hex]));
    renderer.poisByHexId = groupPoisByHexId(db?.raw?.pois || []);
    renderer.poiHexIds = new Set(renderer.poisByHexId.keys());
    renderer.mapOverlays = db?.raw?.generatedMapOverlays || [];
    bumpOverlayRevision();
    markAllMapCachesDirty();
    updateDrawClearButton();
    beginInitialMapLoadingVeil();
    populateDrawRegionSelect();
    updateDrawControlsVisibility();
    loadFeatureArtAssets();
    loadRouteIconAssets();
    loadPoiIconAssets();
    fitViewToMap();
    render();
  }

  function beginInitialMapLoadingVeil() {
    setLoading(true);
    renderer.initialMapLoadingActive = true;
    renderer.initialMapLoadingStartedAt = performance.now();
    scheduleInitialMapLoadingVeilCheck();
  }

  function scheduleInitialMapLoadingVeilCheck() {
    if (renderer.initialMapLoadingTimer) window.clearTimeout(renderer.initialMapLoadingTimer);
    renderer.initialMapLoadingTimer = window.setTimeout(checkInitialMapLoadingVeil, 80);
  }

  function checkInitialMapLoadingVeil() {
    renderer.initialMapLoadingTimer = null;
    if (!renderer.initialMapLoadingActive) return;
    const minimumElapsed = performance.now() - renderer.initialMapLoadingStartedAt >= INITIAL_MAP_LOADING_VEIL_MS;
    if (!minimumElapsed || hasInitialMapLoadingWork()) {
      scheduleInitialMapLoadingVeilCheck();
      return;
    }
    renderer.initialMapLoadingActive = false;
    if (!renderer.drawing.saving) setLoading(false);
  }

  function hasInitialMapLoadingWork() {
    return renderer.cacheDirty
      || renderer.routeCacheDirty
      || renderer.featureCacheDirty
      || renderer.overlayCacheDirty
      || renderer.drawing.terrainDirtyHexIds.size > 0
      || Boolean(renderer.drawing.queuedRenderFrame)
      || !renderer.featureAssetsLoaded
      || !renderer.routeIconAssetsLoaded
      || !renderer.poiIconAssetsLoaded
      || renderer.featureImageQueue.length > 0
      || renderer.featureImageActiveLoads > 0;
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
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
    updateDrawClearButton();
    render();
  }

  function setupDrawControls() {
    const button = document.getElementById("map-draw-button");
    const panel = document.getElementById("map-draw-panel");
    const viewButton = document.getElementById("map-view-button");
    const viewPanel = document.getElementById("map-view-panel");
    const roadStyle = document.getElementById("map-draw-road-style");
    const wallStyle = document.getElementById("map-wall-style");
    const wallVariant = document.getElementById("map-wall-variant");
    const wallMode = document.getElementById("map-wall-mode");
    const wallSize = document.getElementById("map-wall-size");
    const wallShape = document.getElementById("map-wall-shape");
    const roadWaterOverride = document.getElementById("map-road-water-override");
    const roadAutoPass = document.getElementById("map-road-auto-pass");
    const riverAutoFalls = document.getElementById("map-river-auto-falls");
    const riverWaterPull = document.getElementById("map-river-water-pull");
    const riverWildness = document.getElementById("map-river-wildness");
    const riverTerrainRespect = document.getElementById("map-river-terrain-respect");
    const riverStraightness = document.getElementById("map-river-straightness");
    const riverTributaries = document.getElementById("map-river-tributaries");
    const riverWetlandVanish = document.getElementById("map-river-wetland-vanish");
    const routeMajor = document.getElementById("map-route-major");
    const routeName = document.getElementById("map-route-name");
    const namedRoutesButton = document.getElementById("map-named-routes-button");
    const namedRoutesClose = document.getElementById("map-named-routes-close");
    const namedRouteEditForm = document.getElementById("map-named-route-edit-form");
    const namedRouteCancel = document.getElementById("map-named-route-cancel");
    const mistBrushSize = document.getElementById("map-mist-brush-size");
    const mistNoise = document.getElementById("map-mist-noise");
    const regionBrushSize = document.getElementById("map-region-brush-size");
    const regionSelect = document.getElementById("map-draw-region-select");
    const politicalRegionSelect = document.getElementById("map-draw-political-region-select");
    const geoRegionColor = document.getElementById("map-geo-region-color");
    const polRegionColor = document.getElementById("map-pol-region-color");
    const undoButton = document.getElementById("map-draw-undo");
    const redoButton = document.getElementById("map-draw-redo");
    const noToolButton = document.getElementById("map-draw-no-tool");
    const clearOverlayTypeButtons = panel.querySelectorAll("[data-clear-overlay-type]");
    const clearGeoButton = document.getElementById("map-clear-geo-regions");
    const clearPolButton = document.getElementById("map-clear-pol-regions");
    const clearFeaturesButton = document.getElementById("map-clear-features");
    const addGeoRegionButton = document.getElementById("map-add-geo-region-button");
    const addPolRegionButton = document.getElementById("map-add-pol-region-button");
    const closeEditButton = document.getElementById("map-edit-close-button");
    const modeViewButton = document.getElementById("map-edit-view-button");
    const surveyorModeButton = document.getElementById("map-tools-surveyor-button");
    const cartographerModeButton = document.getElementById("map-tools-cartographer-button");
    const surveyorOverlayButton = document.getElementById("map-surveyor-overlay-button");
    const surveyorPoisButton = document.getElementById("map-surveyor-pois-button");
    const surveyorRegionsButton = document.getElementById("map-surveyor-regions-button");
    const surveyorUtilitiesButton = document.getElementById("map-surveyor-utilities-button");
    const cartographerManualButton = document.getElementById("map-cartographer-terrain-button");
    const cartographerGenerationButton = document.getElementById("map-cartographer-features-button");
    const cartographerTerrainSectionButton = document.getElementById("map-cartographer-subsection-paint");
    const cartographerFeatureSectionButton = document.getElementById("map-cartographer-subsection-generate");
    const cartographerSubsectionPurgeButton = document.getElementById("map-cartographer-subsection-purge");
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
    const generationDensity = document.getElementById("map-generation-density");
    const generationMaxFeatures = document.getElementById("map-generation-max-features");
    const generationRefreshExisting = document.getElementById("map-generation-refresh-existing");
    const generationRunFeatures = document.getElementById("map-generation-run-features");
    const generationRunRoads = document.getElementById("map-generation-run-roads");
    const generationRunRivers = document.getElementById("map-generation-run-rivers");
    const generationRunRegions = document.getElementById("map-generation-run-geographic-regions");
    const generationRunPois = document.getElementById("map-generation-run-pois");
    const poiGenerationGlobalAmount = document.getElementById("map-generation-poi-global-amount");
    const clearAllOverlaysButton = document.getElementById("map-clear-all-overlays");
    const clearGeneratedPoisButton = document.getElementById("map-clear-generated-pois");
    const clearPoisButton = document.getElementById("map-clear-pois");
    const poiGenerationResetSliders = document.getElementById("map-poi-generation-reset-sliders");
    const poiGenerationReplaceGenerated = document.getElementById("map-poi-generation-replace-generated");
    const generationResetSliders = document.getElementById("map-generation-reset-sliders");
    const generationPreviewTerrain = document.getElementById("map-generation-preview-terrain");
    const sharedApplyButton = document.getElementById("map-editor-apply-staged");
    const sharedDiscardButton = document.getElementById("map-editor-discard-staged");
    const introCloseButton = document.getElementById("map-editor-intro-close");
    if (!button || !panel) return;

    if (!renderer.drawing.beforeUnloadBound) {
      window.addEventListener("beforeunload", handleMapEditorBeforeUnload);
      renderer.drawing.beforeUnloadBound = true;
    }

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
        renderer.drawing.tool = "";
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
      modeViewButton?.classList.remove("active");
    });

    modeViewButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = Boolean(viewPanel?.hidden);
      if (viewPanel) viewPanel.hidden = !willOpen;
      viewButton?.classList.toggle("active", willOpen);
      modeViewButton?.classList.toggle("active", willOpen);
    });

    collapseEditButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleMapEditPaneCollapsed();
    });

    closeEditButton?.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if ((renderer.drawing.toolsMode || "chooser") === "chooser") await requestCloseMapEditMode();
      else await requestReturnToToolsChooser();
      render();
    });

    button.addEventListener("click", async event => {
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
        modeViewButton?.classList.remove("active");
        randomizeGenerationSeed();
        setMapToolsMode("chooser");
        enterMapEditMode();
      }
      if (!isOpening) {
        if (!await requestCloseMapEditMode()) {
          panel.hidden = false;
          button.classList.add("active");
          renderer.drawing.enabled = true;
        }
      }
      updateDrawToolButtons();
      updateDrawRegionControls();
      updateDrawStyleControls();
      updateDrawHint();
      render();
    });

    panel.addEventListener("click", event => event.stopPropagation());
    surveyorModeButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setMapToolsMode("surveyor");
    });
    cartographerModeButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setMapToolsMode("cartographer");
    });
    surveyorRegionsButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateSurveyorMode("purge");
    });
    surveyorOverlayButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateSurveyorMode("manual");
    });
    surveyorPoisButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateSurveyorMode("generation");
    });
    surveyorUtilitiesButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateSurveyorMode("archive");
    });
    cartographerManualButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateCartographerMode("manual");
    });
    cartographerGenerationButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      activateCartographerMode("generation");
    });
    cartographerTerrainSectionButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if ((renderer.drawing.toolsMode || "chooser") === "surveyor") {
        if (getSurveyorMode() === "generation") {
          setSurveyorGenerationSection("pois");
        } else {
          setSurveyorManualSection("overlay");
        }
      } else {
        setCartographerSection("terrain");
      }
      updateMapEditSurface();
    });
    cartographerFeatureSectionButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if ((renderer.drawing.toolsMode || "chooser") === "surveyor") {
        if (getSurveyorMode() === "generation") {
          setSurveyorGenerationSection("regions");
        } else {
          setSurveyorManualSection("regions");
        }
      } else {
        setCartographerSection("features");
      }
      updateMapEditSurface();
    });
    cartographerSubsectionPurgeButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if ((renderer.drawing.toolsMode || "chooser") === "surveyor") {
        if (getSurveyorMode() === "generation") {
          setSurveyorGenerationSection("overlay");
          updateMapEditSurface();
        }
        return;
      }
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
        markAllMapCachesDirty();
        render();
      });
    });

    roadStyle?.addEventListener("change", () => {
      renderer.drawing.roadStyle = roadStyle.value || "dark_brown";
    });

    wallStyle?.addEventListener("change", () => {
      renderer.drawing.wallStyle = getValidWallStyle(wallStyle.value);
      updateDrawStyleControls();
      renderSvgOnly();
    });

    wallVariant?.addEventListener("change", () => {
      renderer.drawing.wallVariant = getValidWallVariant(wallVariant.value);
      updateDrawStyleControls();
      renderSvgOnly();
    });

    wallMode?.addEventListener("change", () => {
      renderer.drawing.wallMode = getValidWallMode(wallMode.value);
      if (renderer.drawing.wallMode === "plane" && (renderer.drawing.wallSize || 1) < 2) {
        renderer.drawing.wallSize = 2;
      }
      updateDrawStyleControls();
      renderSvgOnly();
    });

    wallSize?.addEventListener("input", () => {
      const minSize = getValidWallMode(renderer.drawing.wallMode) === "plane" ? 2 : 1;
      const maxSize = getValidWallMode(renderer.drawing.wallMode) === "regular" ? 2 : 8;
      renderer.drawing.wallSize = clampNumber(Number(wallSize.value), minSize, maxSize, minSize);
      updateDrawStyleControls();
      renderSvgOnly();
    });

    wallShape?.addEventListener("change", () => {
      renderer.drawing.wallShape = getValidWallShape(wallShape.value);
      updateDrawStyleControls();
      renderSvgOnly();
    });

    roadWaterOverride?.addEventListener("change", () => {
      renderer.drawing.roadWaterOverride = Boolean(roadWaterOverride.checked);
    });

    roadAutoPass?.addEventListener("change", () => {
      renderer.drawing.autoPass = roadAutoPass.checked !== false;
    });

    riverAutoFalls?.addEventListener("change", () => {
      if (getCurrentRouteMajor("river")) {
        renderer.drawing.autoFalls = false;
        updateDrawStyleControls();
        return;
      }
      renderer.drawing.autoFalls = riverAutoFalls.checked !== false;
    });

    riverWaterPull?.addEventListener("input", () => {
      renderer.drawing.riverWaterPull = clampNumber(Number(riverWaterPull.value), 0, 200, 100);
      updateDrawStyleControls();
    });

    riverWildness?.addEventListener("input", () => {
      renderer.drawing.riverWildness = clampNumber(Number(riverWildness.value), 0, 200, 100);
      updateDrawStyleControls();
    });

    riverTerrainRespect?.addEventListener("input", () => {
      renderer.drawing.riverTerrainRespect = clampNumber(Number(riverTerrainRespect.value), 0, 200, 100);
      updateDrawStyleControls();
    });

    riverStraightness?.addEventListener("input", () => {
      renderer.drawing.riverStraightness = clampNumber(Number(riverStraightness.value), 0, 100, 0);
      updateDrawStyleControls();
    });

    riverTributaries?.addEventListener("change", () => {
      renderer.drawing.riverTributaries = riverTributaries.checked !== false;
      updateDrawStyleControls();
    });

    riverWetlandVanish?.addEventListener("change", () => {
      renderer.drawing.riverWetlandVanish = riverWetlandVanish.checked !== false;
      updateDrawStyleControls();
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

    regionBrushSize?.addEventListener("input", () => {
      renderer.drawing.regionBrushSize = clampNumber(Number(regionBrushSize.value), 1, 5, 1);
      updateDrawRegionControls();
      refreshEditorBrushPreview();
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

    panel.querySelectorAll("[data-generation-seed-input]").forEach(seedInput => {
      seedInput.addEventListener("input", () => {
        renderer.drawing.generationSeed = String(seedInput.value || "").slice(0, 80);
        updateGenerationControls();
      });
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

    generationRunRegions?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      runGenerationGeographicRegionPass();
    });

    generationRunPois?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      runGenerationPoiPass();
    });

    poiGenerationGlobalAmount?.addEventListener("input", () => {
      applyPoiGenerationGlobalAmountShift(clampNumber(Number(poiGenerationGlobalAmount.value), 0, 200, 100));
      updateGenerationControls();
    });

    clearPoisButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      purgePois();
    });

    clearGeneratedPoisButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      purgePois({ generatedOnly: true });
    });

    clearAllOverlaysButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      purgeAllSavedOverlays();
    });

    generationResetSliders?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      resetGenerationTerrainSliders();
    });

    poiGenerationResetSliders?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      resetPoiGenerationSliders();
    });
    poiGenerationReplaceGenerated?.addEventListener("change", () => {
      renderer.drawing.generationReplaceGeneratedPois = Boolean(poiGenerationReplaceGenerated.checked);
      updateGenerationControls();
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
      ["map-generation-road-length", "generationRoadLength"],
      ["map-generation-river", "generationRiverAmount"],
      ["map-generation-river-length", "generationRiverLength"],
      ["map-generation-river-wildcards", "generationRiverWildcards"],
      ["map-generation-settlement-density", "generationSettlementDensity"],
      ["map-generation-population-concentration", "generationPopulationConcentration"],
      ["map-generation-resource-amount", "generationResourceAmount"],
      ["map-generation-waypoint-amount", "generationWaypointAmount"],
      ["map-generation-stronghold-amount", "generationStrongholdAmount"],
      ["map-generation-dungeon-amount", "generationDungeonAmount"],
      ["map-generation-dungeon-complex-amount", "generationDungeonComplexAmount"],
      ["map-generation-site-amount", "generationSiteAmount"]
    ].forEach(([inputId, drawingKey]) => {
      const input = document.getElementById(inputId);
      input?.addEventListener("input", () => {
        const inputMin = Number(input.min || 0);
        const inputMax = Number(input.max || 200);
        renderer.drawing[drawingKey] = clampNumber(Number(input.value), inputMin, inputMax, 100);
        if (POI_GENERATION_GLOBAL_CONTROL_KEYS.includes(drawingKey)) {
          syncPoiGenerationGlobalAmountFromSliders();
        }
        updateGenerationControls();
      });
    });

    const includePathsInput = document.getElementById("map-generation-include-paths");
    includePathsInput?.addEventListener("change", () => {
      renderer.drawing.generationIncludePaths = Boolean(includePathsInput.checked);
      updateGenerationControls();
    });

    const includeTradeRoutesInput = document.getElementById("map-generation-include-trade-routes");
    includeTradeRoutesInput?.addEventListener("change", () => {
      renderer.drawing.generationIncludeTradeRoutes = Boolean(includeTradeRoutesInput.checked);
      updateGenerationControls();
    });

    generationPreviewTerrain?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      previewGeneratedTerrain();
    });

    sharedApplyButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      applyGeneratedTerrainPreview();
    });

    sharedDiscardButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      discardGeneratedTerrainPreview();
    });

    introCloseButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closeMapEditorIntro();
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

    document.addEventListener("keydown", handleEditorKeydown, true);

    clearOverlayTypeButtons.forEach(clearTypeButton => {
      clearTypeButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        clearDrawnOverlaysByType(clearTypeButton.dataset.clearOverlayType || "");
      });
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
      stageAllGeneratedFeaturePurge();
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
    refreshEditorActionControls();
    syncMapOverlayToggleInputs();
    populateTerrainControls();
    updateGenerationControls();
    updateMapEditSurface();
    updateDrawHint();
    updateDrawControlsVisibility();
    syncMapInteractionCursor();
  }

  function closeMapEditMode() {
    discardGeneratedTerrainPreview({ silent: true });
    document.getElementById("map-editor-intro")?.classList.add("hidden");
    document.getElementById("map-editor-intro")?.setAttribute("aria-hidden", "true");
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
    document.getElementById("map-edit-view-button")?.classList.remove("active");
    renderer.drawing.enabled = false;
    renderer.drawing.toolsMode = "chooser";
    renderer.drawing.tool = "";
    restoreMapEditViewState();
    updateMapChromeForEdit(false);
    resetDrawingState();
    updateMapEditSurface();
  }

  async function requestReturnToToolsChooser() {
    if ((renderer.drawing.toolsMode || "chooser") !== "cartographer") {
      setMapToolsMode("chooser");
      return true;
    }
    const confirmed = await confirmDiscardUnappliedEdits("Leave Cartographer and discard unapplied preview changes? Regions save immediately and will stay saved.");
    if (!confirmed) return false;
    discardGeneratedTerrainPreview({ silent: true });
    setMapToolsMode("chooser");
    render();
    return true;
  }

  async function requestCloseMapEditMode() {
    if ((renderer.drawing.toolsMode || "chooser") === "cartographer") {
      const confirmed = await confirmDiscardUnappliedEdits("Leave Map Tools and discard unapplied preview changes? Regions save immediately and will stay saved.");
      if (!confirmed) return false;
    }
    closeMapEditMode();
    return true;
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

  function getCartographerMode() {
    return renderer.drawing.cartographerMode === "generation"
      ? renderer.drawing.cartographerMode
      : "manual";
  }

  function setCartographerMode(mode) {
    renderer.drawing.cartographerMode = mode === "generation" ? "generation" : "manual";
  }

  function getCartographerSection() {
    return ["terrain", "features"].includes(renderer.drawing.cartographerSection)
      ? renderer.drawing.cartographerSection
      : "terrain";
  }

  function activateCartographerMode(mode) {
    renderer.drawing.tool = "";
    resetDrawingState();
    setCartographerMode(mode);
    if (getCartographerMode() === "generation") {
      renderer.drawing.generationSection = getCartographerSection();
    }
    setMapToolsMode("cartographer");
  }

  function setCartographerSection(section) {
    renderer.drawing.tool = "";
    resetDrawingState();
    renderer.drawing.cartographerSection = ["terrain", "features"].includes(section) ? section : "terrain";
    if (getCartographerMode() !== "manual") {
      renderer.drawing.generationSection = getCartographerSection();
    }
    setMapToolsMode("cartographer");
  }

  function getSurveyorMode() {
    if (["manual", "generation", "purge", "archive"].includes(renderer.drawing.surveyorMode)) {
      return renderer.drawing.surveyorMode;
    }
    if (renderer.drawing.surveyorSection === "nuke") return "archive";
    if (renderer.drawing.surveyorSection === "purge") return "purge";
    if (renderer.drawing.surveyorSection === "pois" || renderer.drawing.surveyorOverlaySubview === "generate") {
      return "generation";
    }
    return "manual";
  }

  function getSurveyorManualSection() {
    if (["overlay", "regions"].includes(renderer.drawing.surveyorManualSection)) {
      return renderer.drawing.surveyorManualSection;
    }
    return renderer.drawing.surveyorSection === "regions" ? "regions" : "overlay";
  }

  function getSurveyorGenerationSection() {
    if (["overlay", "pois", "regions"].includes(renderer.drawing.surveyorGenerationSection)) {
      return renderer.drawing.surveyorGenerationSection;
    }
    if (renderer.drawing.surveyorSection === "pois") return "pois";
    if (renderer.drawing.generationSection === "regions") return "regions";
    if (renderer.drawing.generationSection === "overlays") return "overlay";
    return "pois";
  }

  function syncSurveyorSectionFromMode() {
    const mode = getSurveyorMode();
    if (mode === "generation") {
      renderer.drawing.surveyorSection = getSurveyorGenerationSection();
      return;
    }
    if (mode === "purge") {
      renderer.drawing.surveyorSection = "purge";
      return;
    }
    if (mode === "archive") {
      renderer.drawing.surveyorSection = "nuke";
      return;
    }
    renderer.drawing.surveyorSection = getSurveyorManualSection();
  }

  function setSurveyorMode(mode) {
    renderer.drawing.surveyorMode = ["generation", "purge", "archive"].includes(mode) ? mode : "manual";
    syncSurveyorSectionFromMode();
  }

  function activateSurveyorMode(mode) {
    renderer.drawing.tool = "";
    resetDrawingState();
    setSurveyorMode(mode);
    if (getSurveyorMode() === "generation") {
      const generationSection = getSurveyorGenerationSection();
      renderer.drawing.generationSection = generationSection === "overlay" ? "overlays" : generationSection;
    }
    setMapToolsMode("surveyor");
  }

  function setSurveyorManualSection(section) {
    renderer.drawing.tool = "";
    resetDrawingState();
    renderer.drawing.surveyorManualSection = section === "regions" ? "regions" : "overlay";
    if (getSurveyorMode() === "manual") {
      syncSurveyorSectionFromMode();
    }
    setMapToolsMode("surveyor");
  }

  function setSurveyorGenerationSection(section) {
    renderer.drawing.tool = "";
    resetDrawingState();
    renderer.drawing.surveyorGenerationSection = ["pois", "regions", "overlay"].includes(section) ? section : "pois";
    renderer.drawing.generationSection = renderer.drawing.surveyorGenerationSection === "overlay"
      ? "overlays"
      : renderer.drawing.surveyorGenerationSection;
    if (getSurveyorMode() === "generation") {
      syncSurveyorSectionFromMode();
    }
    setMapToolsMode("surveyor");
  }

  function getVisibleMapEditSection() {
    const mode = renderer.drawing.toolsMode || "chooser";
    if (mode === "surveyor") {
      const surveyorMode = getSurveyorMode();
      if (surveyorMode === "generation") {
        return getSurveyorGenerationSection() === "pois" ? "pois" : "generation";
      }
      if (surveyorMode === "purge") return "purge";
      if (surveyorMode === "archive") return "nuke";
      return getSurveyorManualSection();
    }
    if (mode === "cartographer") {
      if (getCartographerMode() !== "manual") return "generation";
      return getCartographerSection();
    }
    return "";
  }

  function updateMapToolsRail() {
    const mode = renderer.drawing.toolsMode || "chooser";
    const closeLabel = document.querySelector("#map-edit-close-button .map-edit-mode-label");
    const closeIcon = document.querySelector("#map-edit-close-button .map-edit-mode-icon");
    if (closeLabel) closeLabel.textContent = mode === "chooser" ? "Close" : "Back";
    if (closeIcon) closeIcon.textContent = mode === "chooser" ? "✕" : "↩";
    document.querySelectorAll("[data-map-tool-mode-panel]").forEach(panel => {
      panel.hidden = panel.dataset.mapToolModePanel !== mode;
    });
    document.getElementById("map-tools-surveyor-button")?.classList.toggle("active", mode === "surveyor");
    document.getElementById("map-tools-cartographer-button")?.classList.toggle("active", mode === "cartographer");
    document.getElementById("map-surveyor-overlay-button")?.classList.toggle("active", mode === "surveyor" && getSurveyorMode() === "manual");
    document.getElementById("map-surveyor-pois-button")?.classList.toggle("active", mode === "surveyor" && getSurveyorMode() === "generation");
    document.getElementById("map-surveyor-regions-button")?.classList.toggle("active", mode === "surveyor" && getSurveyorMode() === "purge");
    document.getElementById("map-surveyor-utilities-button")?.classList.toggle("active", mode === "surveyor" && getSurveyorMode() === "archive");
    document.getElementById("map-cartographer-terrain-button")?.classList.toggle("active", mode === "cartographer" && getCartographerMode() === "manual");
    document.getElementById("map-cartographer-features-button")?.classList.toggle("active", mode === "cartographer" && getCartographerMode() === "generation");
  }

  function updateGenerationPopout() {
    const popout = document.getElementById("map-cartographer-subsection-popout");
    const mode = renderer.drawing.toolsMode || "chooser";
    const cartographerMode = getCartographerMode();
    const surveyorMode = getSurveyorMode();
    const section = mode === "surveyor"
      ? (surveyorMode === "generation" ? getSurveyorGenerationSection() : getSurveyorManualSection())
      : getCartographerSection();
    const isVisible = (
      mode === "surveyor" && ["manual", "generation"].includes(surveyorMode) ||
      mode === "cartographer"
    );
    if (!popout) return;
    popout.hidden = !isVisible;
    if (!isVisible) return;
    const title = document.getElementById("map-cartographer-subsection-title");
    const paintButton = document.getElementById("map-cartographer-subsection-paint");
    const generateButton = document.getElementById("map-cartographer-subsection-generate");
    const purgeButton = document.getElementById("map-cartographer-subsection-purge");
    popout.classList.toggle("map-generation-popout-three", mode === "surveyor" && surveyorMode === "generation");
    if (title) {
      if (mode === "cartographer") {
        title.textContent = cartographerMode === "generation" ? "Generation" : "Manual";
      } else {
        title.textContent = surveyorMode === "generation" ? "Generation" : "Manual";
      }
    }
    if (paintButton) {
      paintButton.hidden = false;
      paintButton.textContent = mode === "cartographer" ? "Terrain" : surveyorMode === "generation" ? "POIs" : "Overlays";
      paintButton.classList.toggle("active",
        mode === "cartographer"
          ? section === "terrain"
          : surveyorMode === "generation" ? section === "pois" : section === "overlay"
      );
    }
    if (generateButton) {
      generateButton.hidden = false;
      generateButton.textContent = mode === "cartographer" ? "Features" : "Regions";
      generateButton.classList.toggle("active",
        mode === "cartographer"
          ? section === "features"
          : section === "regions"
      );
    }
    if (purgeButton) {
      purgeButton.hidden = !(mode === "surveyor" && surveyorMode === "generation");
      purgeButton.textContent = "Overlays";
      purgeButton.classList.toggle("active", mode === "surveyor" && surveyorMode === "generation" && section === "overlay");
    }
  }

  function updateMapEditSectionHeader(section) {
    const mode = renderer.drawing.toolsMode || "chooser";
    const meta = mode === "chooser"
      ? MAP_EDIT_SECTION_COPY.chooser
      : mode === "surveyor"
      ? MAP_EDIT_SECTION_COPY.surveyor
      : MAP_EDIT_SECTION_COPY.cartographer;
    const detailMeta = MAP_EDIT_SECTION_COPY[section] || null;
    const heading = document.getElementById("map-edit-section-heading");
    const copy = document.getElementById("map-edit-section-copy");
    const kicker = document.querySelector(".map-edit-pane-kicker");
    if (kicker) kicker.textContent = mode === "surveyor" ? "Surveyor" : mode === "cartographer" ? "Cartographer" : "Hex Mapper";
    if (heading) heading.textContent = detailMeta?.title || meta.title;
    if (copy) copy.textContent = detailMeta?.copy || meta.copy;
  }

  function syncGenerationSectionUi(section) {
    document.querySelectorAll("[data-generation-section]").forEach(sectionPane => {
      sectionPane.classList.toggle("active", sectionPane.dataset.generationSection === section);
    });
    document.querySelectorAll("[data-generation-action-panel]").forEach(actionPanel => {
      actionPanel.classList.toggle("active", actionPanel.dataset.generationActionPanel === section);
    });
  }

  function updateMapEditSurface() {
    const visibleSection = getVisibleMapEditSection();
    const mode = renderer.drawing.toolsMode || "chooser";
    const isChooser = mode === "chooser";
    const pane = document.querySelector(".map-edit-pane");
    const applyRow = document.querySelector(".map-edit-apply-row");
    if (pane) pane.hidden = isChooser;
    if (applyRow) applyRow.hidden = mode !== "cartographer";
    if (visibleSection === "generation") {
      const generationSection = mode === "surveyor"
        ? (getSurveyorGenerationSection() === "overlay" ? "overlays" : getSurveyorGenerationSection())
        : getCartographerSection();
      renderer.drawing.generationSection = generationSection;
      syncGenerationSectionUi(generationSection);
    }
    document.querySelectorAll("[data-map-edit-section]").forEach(sectionPane => {
      sectionPane.classList.toggle("active", Boolean(visibleSection) && sectionPane.dataset.mapEditSection === visibleSection);
    });
    if (visibleSection === "terrain") setMobileTerrainTab("tools");
    updateMapToolsRail();
    updateMapEditSectionHeader(visibleSection || renderer.drawing.toolsMode || "chooser");
    updateGenerationPopout();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    syncMapInteractionCursor();
    updateDrawHint();
    updateOverlaySubviewGroups();
    updatePoiSubviewGroups();
    refreshEditorActionControls();
  }

  function updateOverlaySubviewGroups() {
    const isOverlayVisible = (renderer.drawing.toolsMode || "chooser") === "surveyor" && getVisibleMapEditSection() === "overlay";
    document.querySelectorAll("[data-overlay-subview-group]").forEach(element => {
      const group = element.dataset.overlaySubviewGroup || "drawing";
      if (isOverlayVisible && group !== "drawing") {
        element.hidden = true;
        return;
      }
      if (isOverlayToolSpecificControl(element)) return;
      element.hidden = false;
    });
  }

  function updatePoiSubviewGroups() {
    const isPoiVisible = (renderer.drawing.toolsMode || "chooser") === "surveyor" && getVisibleMapEditSection() === "pois";
    document.querySelectorAll("[data-poi-subview-group]").forEach(element => {
      const group = element.dataset.poiSubviewGroup || "generation";
      element.hidden = isPoiVisible ? group !== "generation" : false;
    });
  }

  function isOverlayToolSpecificControl(element) {
    if (element.classList.contains("map-draw-tool-setting")) return true;
    return [
      "map-draw-style-label",
      "map-draw-road-style",
      "map-road-water-override-row",
      "map-road-auto-pass-row",
      "map-river-auto-falls-row",
      "map-route-major-row",
      "map-route-name-row"
    ].includes(element.id) || element.classList.contains("map-draw-style-row");
  }

  function setMapToolsMode(mode) {
    const normalized = ["chooser", "surveyor", "cartographer"].includes(mode) ? mode : "chooser";
    const previousMode = renderer.drawing.toolsMode || "chooser";
    renderer.drawing.toolsMode = normalized;
    if (previousMode !== normalized) {
      renderer.drawing.tool = "";
      resetDrawingState();
    }
    if (normalized === "surveyor") {
      syncSurveyorSectionFromMode();
    }
    if (normalized === "cartographer") showMapEditorIntroIfNeeded();
    else {
      document.getElementById("map-editor-intro")?.classList.add("hidden");
      document.getElementById("map-editor-intro")?.setAttribute("aria-hidden", "true");
    }
    updateMapEditSurface();
  }

  function setMapEditSection(section) {
    const normalized = ["terrain", "features", "overlay", "pois", "purge", "regions", "nuke", "generation"].includes(section) ? section : "terrain";
    renderer.drawing.tool = "";
    resetDrawingState();
    if (normalized === "overlay") {
      renderer.drawing.surveyorManualSection = "overlay";
      setSurveyorMode("manual");
      setMapToolsMode("surveyor");
      return;
    }
    if (normalized === "regions") {
      renderer.drawing.surveyorManualSection = "regions";
      setSurveyorMode("manual");
      setMapToolsMode("surveyor");
      return;
    }
    if (normalized === "pois") {
      renderer.drawing.surveyorGenerationSection = "pois";
      setSurveyorMode("generation");
      setMapToolsMode("surveyor");
      return;
    }
    if (normalized === "purge") {
      setSurveyorMode("purge");
      setMapToolsMode("surveyor");
      return;
    }
    if (normalized === "nuke") {
      setSurveyorMode("archive");
      setMapToolsMode("surveyor");
      return;
    }
    if (normalized === "generation") {
      const generationSection = renderer.drawing.generationSection || "terrain";
      if (generationSection === "overlays") {
        renderer.drawing.surveyorGenerationSection = "overlay";
        setSurveyorMode("generation");
        setMapToolsMode("surveyor");
      } else if (generationSection === "regions") {
        renderer.drawing.surveyorGenerationSection = "regions";
        setSurveyorMode("generation");
        setMapToolsMode("surveyor");
      } else {
        renderer.drawing.cartographerSection = ["terrain", "features"].includes(generationSection) ? generationSection : "terrain";
        setCartographerMode("generation");
        setMapToolsMode("cartographer");
      }
      return;
    }
    renderer.drawing.cartographerSection = normalized;
    setCartographerMode("manual");
    setMapToolsMode("cartographer");
  }

  function setGenerationSection(section) {
    const normalized = ["terrain", "features", "regions", "overlays"].includes(section) ? section : "terrain";
    renderer.drawing.generationSection = normalized;
    if (["terrain", "features"].includes(normalized)) {
      renderer.drawing.cartographerSection = normalized;
    }
    syncGenerationSectionUi(normalized);
    if ((renderer.drawing.toolsMode || "chooser") === "cartographer" && getCartographerMode() !== "manual") {
      updateMapEditSurface();
    } else {
      updateDrawHint();
    }
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
    markAllMapCachesDirty();
  }

  function showMapEditorIntroIfNeeded() {
    const campaignId = getActiveCampaign?.()?.id || "default";
    const storageKey = `waymark-codex-map-editor-intro:${campaignId}`;
    const legacyStorageKey = `campaign-codex-map-editor-intro:${campaignId}`;
    let alreadySeen = renderer.drawing.editorIntroSeen;
    try {
      const storage = window.sessionStorage;
      const seenCurrent = storage?.getItem(storageKey) === "1";
      const seenLegacy = storage?.getItem(legacyStorageKey) === "1";
      if (!seenCurrent && seenLegacy) storage?.setItem(storageKey, "1");
      alreadySeen = alreadySeen || seenCurrent || seenLegacy;
    } catch (error) {
      // Ignore storage failures and fall back to the in-memory flag.
    }
    if (alreadySeen) return;

    const intro = document.getElementById("map-editor-intro");
    const body = document.getElementById("map-editor-intro-body");
    if (body) {
      body.innerHTML = `
        <p>Cartographer terrain and feature edits preview locally first. Nothing in those sections is saved until you apply.</p>
        <p>Discard All throws away unapplied Cartographer preview edits. Surveyor overlays and regions save immediately, so they are not part of Discard All.</p>
        <p>If you try to close the editor or refresh with unapplied preview edits, you will get a warning first.</p>
      `;
    }
    intro?.classList.remove("hidden");
    intro?.setAttribute("aria-hidden", "false");
  }

  function closeMapEditorIntro() {
    const campaignId = getActiveCampaign?.()?.id || "default";
    const storageKey = `waymark-codex-map-editor-intro:${campaignId}`;
    const intro = document.getElementById("map-editor-intro");
    intro?.classList.add("hidden");
    intro?.setAttribute("aria-hidden", "true");
    renderer.drawing.editorIntroSeen = true;
    try {
      window.sessionStorage?.setItem(storageKey, "1");
    } catch (error) {
      // Ignore storage failures and keep the in-memory flag.
    }
  }

  function restoreMapEditViewState() {
    if (!renderer.drawing.preEditVisibleOverlays) return;

    renderer.drawing.visibleOverlays = { ...renderer.drawing.preEditVisibleOverlays };
    renderer.drawing.preEditVisibleOverlays = null;
    syncMapOverlayToggleInputs();
    markAllMapCachesDirty();
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
      document.getElementById("map-edit-view-button")?.classList.remove("active");
    }

    if (button) button.hidden = !canDraw;
    if (!canDraw) {
      if (panel) panel.hidden = true;
      renderer.drawing.enabled = false;
      button?.classList.remove("active");
      restoreMapEditViewState();
      updateMapChromeForEdit(false);
      renderer.drawing.tool = "";
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
    syncMapInteractionCursor();
    updateDrawHint();
    renderSvgOnly();
  }

  function clearDrawTool() {
    renderer.drawing.tool = "";
    resetDrawingState();
    updateDrawToolButtons();
    updateDrawRegionControls();
    updateDrawStyleControls();
    syncMapInteractionCursor();
    updateDrawHint();
    renderSvgOnly();
  }

  function handleEditorKeydown(event) {
    if (!renderer.drawing.enabled || renderer.drawing.saving) return;
    if (event.key === "Escape") {
      if (handleEditorEscapeKey()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "z" && event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      redoLastDrawAction();
    } else if (key === "z") {
      event.preventDefault();
      event.stopPropagation();
      undoLastDrawAction();
    } else if (key === "y") {
      event.preventDefault();
      event.stopPropagation();
      redoLastDrawAction();
    }
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
      clearHexStyleBrushPreview();
    }
    renderer.drawing.lastHexId = null;
    renderer.drawing.dragLastHexId = null;
    renderer.drawing.wallPlaneDrag = null;
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
    renderer.drawing.wallStyle = "wall";
    renderer.drawing.wallVariant = "auto";
    renderer.drawing.roadWaterOverride = false;
    renderer.drawing.autoPass = true;
    renderer.drawing.autoFalls = true;
    renderer.drawing.roadRouteMajor = false;
    renderer.drawing.roadRouteName = "";
    renderer.drawing.riverRouteMajor = false;
    renderer.drawing.riverRouteName = "";
    renderer.drawing.riverWaterPull = 100;
    renderer.drawing.riverWildness = 100;
    renderer.drawing.riverTerrainRespect = 100;
    renderer.drawing.riverStraightness = 0;
    renderer.drawing.riverTributaries = true;
    renderer.drawing.riverWetlandVanish = false;
    renderer.drawing.seaRouteName = "";
    renderer.drawing.mistBrushSize = 1;
    renderer.drawing.mistNoise = 0;
    renderer.drawing.regionBrushSize = 1;
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
    renderer.drawing.toolsMode = "chooser";
    renderer.drawing.surveyorSection = "overlay";
    renderer.drawing.surveyorOverlaySubview = "paint";
    renderer.drawing.surveyorPoiSubview = "generate";
    renderer.drawing.surveyorMode = "manual";
    renderer.drawing.surveyorManualSection = "overlay";
    renderer.drawing.surveyorGenerationSection = "pois";
    renderer.drawing.cartographerMode = "manual";
    renderer.drawing.cartographerSection = "terrain";
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
    renderer.drawing.generationRoadAmount = 100;
    renderer.drawing.generationRoadLength = 100;
    renderer.drawing.generationIncludePaths = true;
    renderer.drawing.generationIncludeTradeRoutes = false;
    renderer.drawing.generationPoiGlobalAmount = 100;
    renderer.drawing.generationSettlementDensity = 100;
    renderer.drawing.generationPopulationConcentration = 100;
    renderer.drawing.generationResourceAmount = 100;
    renderer.drawing.generationWaypointAmount = 100;
    renderer.drawing.generationStrongholdAmount = 100;
    renderer.drawing.generationDungeonAmount = 100;
    renderer.drawing.generationDungeonComplexAmount = 100;
    renderer.drawing.generationSiteAmount = 100;
    renderer.drawing.stagedTerrainOriginals.clear();
    renderer.drawing.stagedOverlayBaseline = null;
    renderer.drawing.stagedUndoStack = [];
    renderer.drawing.stagedRedoStack = [];
    renderer.drawing.generationPreviewOriginals.clear();
    renderer.drawing.generationPreviewActions = [];
    renderer.drawing.surveyorUndoStack = [];
    renderer.drawing.surveyorRedoStack = [];
    renderer.drawing.cartographerUndoStack = [];
    renderer.drawing.cartographerRedoStack = [];
    renderer.drawing.undoStack = [];
    renderer.drawing.redoStack = [];
    renderer.drawing.visibleOverlays = getDefaultVisibleOverlays();
    renderer.drawing.preEditVisibleOverlays = null;
    renderer.routeLabelCache = { key: "", labels: [] };
    if (renderer.drawing.queuedRenderFrame) {
      window.cancelAnimationFrame(renderer.drawing.queuedRenderFrame);
    }
    renderer.drawing.queuedRenderFrame = null;
    renderer.drawing.queuedFullRender = false;
    renderer.initialMapLoadingActive = false;
    renderer.initialMapLoadingStartedAt = 0;
    if (renderer.initialMapLoadingTimer) {
      window.clearTimeout(renderer.initialMapLoadingTimer);
    }
    renderer.initialMapLoadingTimer = null;
    renderer.drawing.featureViewportKey = "";
    renderer.drawing.terrainDirtyHexIds.clear();
    renderer.cacheDirty = true;
    renderer.routeCacheDirty = true;
    renderer.featureCacheDirty = true;
    renderer.overlayCacheDirty = true;
    renderer.featureImageUsage.clear();
    renderer.featureImageQueue = [];
    renderer.featureImageQueued.clear();
    if (renderer.featureImageFrame) {
      window.cancelAnimationFrame(renderer.featureImageFrame);
    }
    renderer.featureImageFrame = null;
    renderer.featureImageActiveLoads = 0;
    renderer.featureImageStartupBatchDirty = false;
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
    renderer.hexesById = new Map();
    renderer.hexIdsByUuid = new Map();
    renderer.hexesByCoord = new Map();
    bumpOverlayRevision();
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
    refreshEditorPreviewControls();
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
      coords: true,
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

  function queueMapRender(full = true) {
    if (full) renderer.drawing.queuedFullRender = true;
    if (renderer.drawing.queuedRenderFrame) return;
    renderer.drawing.queuedRenderFrame = window.requestAnimationFrame(() => {
      renderer.drawing.queuedRenderFrame = null;
      const shouldFullRender = renderer.drawing.queuedFullRender;
      renderer.drawing.queuedFullRender = false;
      if (shouldFullRender) render();
      else renderSvgOnly();
    });
  }

  function markTerrainCacheDirty() {
    renderer.cacheDirty = true;
    renderer.featureCacheDirty = true;
    renderer.drawing.terrainDirtyHexIds.clear();
  }

  function markRouteCacheDirty() {
    renderer.routeCacheDirty = true;
  }

  function markFeatureCacheDirty() {
    renderer.featureCacheDirty = true;
  }

  function markOverlayCacheDirty() {
    renderer.overlayCacheDirty = true;
  }

  function rebuildHexIndexes() {
    renderer.hexesById = new Map(renderer.hexes.map(hex => [hex.id, hex]));
    renderer.hexIdsByUuid = new Map(renderer.hexes
      .map(hex => [hex.record?.__uuid, hex.id])
      .filter(([uuid]) => Boolean(uuid)));
  }

  function bumpOverlayRevision() {
    renderer.overlayRevision += 1;
    renderer.overlaysByTypeCache = { revision: -1, groups: null };
    renderer.snapHexIdsCache = { revision: -1, type: "", hexIds: new Set() };
    renderer.riverFallsHexIdsCache = { revision: -1, hexIds: new Set() };
  }

  function markAllMapCachesDirty() {
    markTerrainCacheDirty();
    markRouteCacheDirty();
    markFeatureCacheDirty();
    markOverlayCacheDirty();
  }

  function markTerrainHexesDirty(hexes, radius = 3, enforceThreshold = true) {
    const candidates = (hexes || []).filter(Boolean);
    if (!candidates.length) return;
    candidates.forEach(hex => {
      if (!hex?.id) return;
      renderer.drawing.terrainDirtyHexIds.add(hex.id);
      nearbyHexesWithin(hex, radius).forEach(neighbor => {
        if (neighbor?.id) renderer.drawing.terrainDirtyHexIds.add(neighbor.id);
      });
    });
    if (enforceThreshold && renderer.drawing.terrainDirtyHexIds.size > Math.max(180, Math.floor(renderer.hexes.length * 0.35))) {
      markTerrainCacheDirty();
    }
  }

  function markTerrainHexDirty(hexId, radius = 3) {
    const hex = renderer.hexesById.get(hexId);
    if (!hex) {
      markTerrainCacheDirty();
      return;
    }
    markTerrainHexesDirty([hex], radius, true);
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
      renderer.drawing.dragActionBatch = {
        type: "batch",
        actions: [],
        pending: [],
        committing: false,
        localStage: false,
        historyOwner: "surveyor"
      };
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
    queuePendingHexStyleOverlaySaves(batch);
    if (batch?.pending?.length) {
      if (batch.committing) return;
      const pending = batch.pending.splice(0);
      batch.committing = true;
      Promise.allSettled(pending).then(() => {
        batch.committing = false;
        if (renderer.drawing.dragActionBatch === batch) {
          commitDragActionBatch();
        }
      });
      return;
    }
    renderer.drawing.dragActionBatch = null;
    if (!batch?.actions?.length) return;
    const action = batch.actions.length === 1 ? batch.actions[0] : {
      type: "batch",
      actions: batch.actions,
      previewSection: batch.previewSection || ""
    };
    if (batch.localStage) {
      pushStagedMapEditAction(action, { force: true });
      return;
    }
    pushMapEditAction(action, { force: true, owner: batch.historyOwner });
  }

  function updateDrawToolButtons() {
    document.querySelectorAll("[data-map-draw-tool]").forEach(button => {
      button.classList.toggle("active", button.dataset.mapDrawTool === renderer.drawing.tool);
    });
    document.getElementById("map-draw-no-tool")?.classList.toggle("active", !renderer.drawing.tool);
  }

  function syncMapInteractionCursor() {
    renderer.root?.classList.toggle("generated-map-wall-brush-active", Boolean(renderer.drawing.enabled && renderer.drawing.tool === "wall"));
  }

  function updateDrawRegionControls() {
    const row = document.querySelector(".map-draw-region-row");
    const politicalRow = document.querySelector(".map-draw-political-region-row");
    const regionBrushInput = document.getElementById("map-region-brush-size");
    const regionBrushValue = document.getElementById("map-region-brush-size-value");
    if (row) row.hidden = renderer.drawing.tool !== "region";
    if (politicalRow) politicalRow.hidden = renderer.drawing.tool !== "political-region";
    if (regionBrushInput) regionBrushInput.value = String(renderer.drawing.regionBrushSize || 1);
    if (regionBrushValue) regionBrushValue.textContent = String(renderer.drawing.regionBrushSize || 1);
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
        region_name: region.Region_Name || region.Region_ID || "Unnamed Region",
        region_lore: region.Lore || null,
        region_border_color: nextColor,
        new_region_type: region.Region_Type || normalizedType
      });

      if (error) throw error;

      const updated = Array.isArray(data) ? data[0] : data;
      region.Region_Name = updated?.name || region.Region_Name || "";
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
    const wallStyleRow = document.getElementById("map-wall-style-row");
    const wallStyleInput = document.getElementById("map-wall-style");
    const wallVariantRow = document.getElementById("map-wall-variant-row");
    const wallVariantInput = document.getElementById("map-wall-variant");
    const wallModeRow = document.getElementById("map-wall-mode-row");
    const wallModeInput = document.getElementById("map-wall-mode");
    const wallSizeRow = document.getElementById("map-wall-size-row");
    const wallSizeInput = document.getElementById("map-wall-size");
    const wallSizeValue = document.getElementById("map-wall-size-value");
    const wallShapeRow = document.getElementById("map-wall-shape-row");
    const wallShapeInput = document.getElementById("map-wall-shape");
    const roadOverrideRow = document.getElementById("map-road-water-override-row");
    const roadOverrideInput = document.getElementById("map-road-water-override");
    const autoPassRow = document.getElementById("map-road-auto-pass-row");
    const autoPassInput = document.getElementById("map-road-auto-pass");
    const autoFallsRow = document.getElementById("map-river-auto-falls-row");
    const autoFallsInput = document.getElementById("map-river-auto-falls");
    const riverWaterPullRow = document.getElementById("map-river-water-pull-row");
    const riverWaterPullInput = document.getElementById("map-river-water-pull");
    const riverWaterPullValue = document.getElementById("map-river-water-pull-value");
    const riverWildnessRow = document.getElementById("map-river-wildness-row");
    const riverWildnessInput = document.getElementById("map-river-wildness");
    const riverWildnessValue = document.getElementById("map-river-wildness-value");
    const riverTerrainRespectRow = document.getElementById("map-river-terrain-respect-row");
    const riverTerrainRespectInput = document.getElementById("map-river-terrain-respect");
    const riverTerrainRespectValue = document.getElementById("map-river-terrain-respect-value");
    const riverStraightnessRow = document.getElementById("map-river-straightness-row");
    const riverStraightnessInput = document.getElementById("map-river-straightness");
    const riverStraightnessValue = document.getElementById("map-river-straightness-value");
    const riverTributariesRow = document.getElementById("map-river-tributaries-row");
    const riverTributariesInput = document.getElementById("map-river-tributaries");
    const riverWetlandVanishRow = document.getElementById("map-river-wetland-vanish-row");
    const riverWetlandVanishInput = document.getElementById("map-river-wetland-vanish");
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
    const currentRouteMajor = getCurrentRouteMajor();
    if (styleRow) styleRow.hidden = !["road", "path"].includes(renderer.drawing.tool);
    if (styleLabel) styleLabel.textContent = renderer.drawing.tool === "path" ? "Path Style" : "Road Style";
    const isWallTool = renderer.drawing.tool === "wall";
    const wallMode = getValidWallMode(renderer.drawing.wallMode);
    if (wallStyleRow) wallStyleRow.hidden = !isWallTool;
    if (wallStyleInput) wallStyleInput.value = getValidWallStyle(renderer.drawing.wallStyle);
    if (wallVariantRow) wallVariantRow.hidden = !isWallTool || wallMode !== "regular";
    if (wallVariantInput) wallVariantInput.value = getValidWallVariant(renderer.drawing.wallVariant);
    if (wallModeRow) wallModeRow.hidden = !isWallTool;
    if (wallModeInput) wallModeInput.value = wallMode;
    if (wallSizeRow) wallSizeRow.hidden = !isWallTool || wallMode !== "shape";
    const wallMinSize = wallMode === "plane" ? 2 : 1;
    const wallMaxSize = wallMode === "regular" ? 2 : 8;
    if (isWallTool) renderer.drawing.wallSize = clampNumber(Number(renderer.drawing.wallSize), wallMinSize, wallMaxSize, wallMinSize);
    if (wallSizeInput) {
      wallSizeInput.min = String(wallMinSize);
      wallSizeInput.max = String(wallMaxSize);
      wallSizeInput.value = String(renderer.drawing.wallSize || wallMinSize);
    }
    if (wallSizeValue) wallSizeValue.textContent = String(renderer.drawing.wallSize || wallMinSize);
    if (wallShapeRow) wallShapeRow.hidden = !isWallTool || wallMode !== "shape";
    if (wallShapeInput) wallShapeInput.value = getValidWallShape(renderer.drawing.wallShape);
    if (roadOverrideRow) roadOverrideRow.hidden = renderer.drawing.tool !== "road";
    if (roadOverrideInput) roadOverrideInput.checked = Boolean(renderer.drawing.roadWaterOverride);
    if (autoPassRow) autoPassRow.hidden = renderer.drawing.tool !== "road";
    if (autoPassInput) autoPassInput.checked = renderer.drawing.autoPass !== false;
    const isRiverTool = renderer.drawing.tool === "river";
    const riverMajorTrade = isRiverTool && currentRouteMajor;
    if (autoFallsRow) autoFallsRow.hidden = !isRiverTool;
    if (autoFallsInput) {
      autoFallsInput.disabled = riverMajorTrade;
      autoFallsInput.checked = riverMajorTrade ? false : renderer.drawing.autoFalls !== false;
    }
    if (riverWaterPullRow) riverWaterPullRow.hidden = !isRiverTool;
    if (riverWaterPullInput) riverWaterPullInput.value = String(renderer.drawing.riverWaterPull ?? 100);
    if (riverWaterPullValue) riverWaterPullValue.textContent = `${renderer.drawing.riverWaterPull ?? 100}%`;
    if (riverWildnessRow) riverWildnessRow.hidden = !isRiverTool;
    if (riverWildnessInput) riverWildnessInput.value = String(renderer.drawing.riverWildness ?? 100);
    if (riverWildnessValue) riverWildnessValue.textContent = `${renderer.drawing.riverWildness ?? 100}%`;
    if (riverTerrainRespectRow) riverTerrainRespectRow.hidden = !isRiverTool;
    if (riverTerrainRespectInput) riverTerrainRespectInput.value = String(renderer.drawing.riverTerrainRespect ?? 100);
    if (riverTerrainRespectValue) riverTerrainRespectValue.textContent = `${renderer.drawing.riverTerrainRespect ?? 100}%`;
    if (riverStraightnessRow) riverStraightnessRow.hidden = !isRiverTool;
    if (riverStraightnessInput) riverStraightnessInput.value = String(renderer.drawing.riverStraightness ?? 0);
    if (riverStraightnessValue) riverStraightnessValue.textContent = `${renderer.drawing.riverStraightness ?? 0}%`;
    if (riverTributariesRow) riverTributariesRow.hidden = !isRiverTool;
    if (riverTributariesInput) riverTributariesInput.checked = renderer.drawing.riverTributaries !== false;
    if (riverWetlandVanishRow) riverWetlandVanishRow.hidden = !isRiverTool;
    if (riverWetlandVanishInput) {
      const disableWetlandVanish = riverMajorTrade;
      riverWetlandVanishInput.disabled = disableWetlandVanish;
      riverWetlandVanishInput.checked = disableWetlandVanish ? false : renderer.drawing.riverWetlandVanish !== false;
    }
    const isNamedRouteTool = ["road", "river", "sea_route"].includes(renderer.drawing.tool);
    const hasMajorToggle = ["road", "river"].includes(renderer.drawing.tool);
    const currentRouteName = getCurrentRouteName();
    if (routeMajorRow) routeMajorRow.hidden = !hasMajorToggle;
    if (routeMajorInput) routeMajorInput.checked = Boolean(currentRouteMajor);
    if (routeNameRow) routeNameRow.hidden = !isNamedRouteTool || (hasMajorToggle && !currentRouteMajor);
    if (routeNameInput && routeNameInput.value !== currentRouteName) routeNameInput.value = currentRouteName || "";
    if (mistBrushRow) mistBrushRow.hidden = !["mist", "farmland"].includes(renderer.drawing.tool);
    if (mistBrushInput) mistBrushInput.value = String(renderer.drawing.mistBrushSize || 1);
    if (mistBrushValue) mistBrushValue.textContent = String(renderer.drawing.mistBrushSize || 1);
    if (mistNoiseRow) mistNoiseRow.hidden = !["mist", "farmland"].includes(renderer.drawing.tool);
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
    if (!["mist", "farmland"].includes(renderer.drawing.tool) || !renderer.drawing.hoverMistHexIds?.length) return;
    const centerHex = hexForPathPoint(renderer.drawing.hoverMistHexIds[0]);
    renderer.drawing.hoverMistHexIds = centerHex ? getMistBrushHexIds(centerHex, renderer.drawing.tool) : [];
  }

  function refreshEditorBrushPreview() {
    if (!["terrain", "terrain-eyedropper", "feature", "feature-erase", "feature-eyedropper", "region", "unregion", "political-region", "clear-political-region"].includes(renderer.drawing.tool) || !renderer.drawing.hoverBrushHexIds?.length) return;
    const centerHex = hexForPathPoint(renderer.drawing.hoverBrushHexIds[0]);
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
    const generationRegionStyle = document.getElementById("map-generation-region-style");
    const generationDensity = document.getElementById("map-generation-density");
    const generationDensityValue = document.getElementById("map-generation-density-value");
    const generationMaxFeatures = document.getElementById("map-generation-max-features");
    const generationMaxFeaturesValue = document.getElementById("map-generation-max-features-value");
    const generationRefreshExisting = document.getElementById("map-generation-refresh-existing");
    const generationRunFeatures = document.getElementById("map-generation-run-features");
    const generationRunRoads = document.getElementById("map-generation-run-roads");
    const generationRunRivers = document.getElementById("map-generation-run-rivers");
    const generationRunRegions = document.getElementById("map-generation-run-geographic-regions");
    const generationRunPois = document.getElementById("map-generation-run-pois");
    const poiGenerationGlobalAmount = document.getElementById("map-generation-poi-global-amount");
    const poiGenerationGlobalAmountValue = document.getElementById("map-generation-poi-global-amount-value");
    const clearAllOverlaysButton = document.getElementById("map-clear-all-overlays");
    const clearGeneratedPoisButton = document.getElementById("map-clear-generated-pois");
    const clearPoisButton = document.getElementById("map-clear-pois");
    const poiGenerationResetSliders = document.getElementById("map-poi-generation-reset-sliders");
    const poiGenerationReplaceGenerated = document.getElementById("map-poi-generation-replace-generated");
    const generationResetSliders = document.getElementById("map-generation-reset-sliders");
    const generationPreviewTerrain = document.getElementById("map-generation-preview-terrain");
    const sharedApplyButton = document.getElementById("map-editor-apply-staged");
    const sharedDiscardButton = document.getElementById("map-editor-discard-staged");
    const overlayTypeCounts = getCurrentMapOverlays().reduce((counts, overlay) => {
      const type = String(overlay?.Overlay_Type || "").trim();
      if (!type) return counts;
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    const hasSavedOverlays = Object.values(overlayTypeCounts).some(count => count > 0);
    const hasSavedPois = ((db?.raw?.pois?.length || 0) + (db?.raw?.poiGroups?.length || 0)) > 0;
    const hasGeneratedPois = ((db?.raw?.pois || []).filter(poi => poi?.Generation_Source).length + (db?.raw?.poiGroups || []).filter(group => group?.Generation_Source).length) > 0;
    const globalPoiAmount = syncPoiGenerationGlobalAmountFromSliders();

    document.querySelectorAll("[data-generation-seed-input]").forEach(seedInput => {
      if (seedInput.value !== (renderer.drawing.generationSeed || "")) {
        seedInput.value = renderer.drawing.generationSeed || "";
      }
    });
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
    if (generationRunRegions) generationRunRegions.disabled = Boolean(renderer.drawing.saving);
    if (generationRunPois) generationRunPois.disabled = Boolean(renderer.drawing.saving);
    if (poiGenerationGlobalAmount) {
      poiGenerationGlobalAmount.value = String(globalPoiAmount);
      poiGenerationGlobalAmount.disabled = Boolean(renderer.drawing.saving);
    }
    if (poiGenerationGlobalAmountValue) poiGenerationGlobalAmountValue.textContent = `${globalPoiAmount}%`;
    if (clearAllOverlaysButton) clearAllOverlaysButton.disabled = Boolean(renderer.drawing.saving || hasStagedMapEdits() || !hasSavedOverlays);
    if (clearGeneratedPoisButton) clearGeneratedPoisButton.disabled = Boolean(renderer.drawing.saving || !hasGeneratedPois);
    if (clearPoisButton) clearPoisButton.disabled = Boolean(renderer.drawing.saving || !hasSavedPois);
    if (poiGenerationResetSliders) poiGenerationResetSliders.disabled = Boolean(renderer.drawing.saving);
    if (poiGenerationReplaceGenerated) {
      poiGenerationReplaceGenerated.checked = Boolean(renderer.drawing.generationReplaceGeneratedPois);
      poiGenerationReplaceGenerated.disabled = Boolean(renderer.drawing.saving);
    }
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
      ["road-length", "generationRoadLength"],
      ["river", "generationRiverAmount"],
      ["river-length", "generationRiverLength"],
      ["river-wildcards", "generationRiverWildcards"],
      ["settlement-density", "generationSettlementDensity"],
      ["population-concentration", "generationPopulationConcentration"],
      ["resource-amount", "generationResourceAmount"],
      ["waypoint-amount", "generationWaypointAmount"],
      ["stronghold-amount", "generationStrongholdAmount"],
      ["dungeon-amount", "generationDungeonAmount"],
      ["dungeon-complex-amount", "generationDungeonComplexAmount"],
      ["site-amount", "generationSiteAmount"]
    ].forEach(([control, drawingKey]) => {
      const input = document.getElementById(`map-generation-${control}`);
      const value = document.getElementById(`map-generation-${control}-value`);
      const numeric = renderer.drawing[drawingKey] ?? 100;
      if (input) input.value = String(numeric);
      if (value) value.textContent = `${numeric}%`;
    });
    const includePathsInput = document.getElementById("map-generation-include-paths");
    if (includePathsInput) {
      includePathsInput.checked = renderer.drawing.generationIncludePaths !== false;
      includePathsInput.disabled = Boolean(renderer.drawing.saving);
    }
    const includeTradeRoutesInput = document.getElementById("map-generation-include-trade-routes");
    if (includeTradeRoutesInput) {
      includeTradeRoutesInput.checked = Boolean(renderer.drawing.generationIncludeTradeRoutes);
      includeTradeRoutesInput.disabled = Boolean(renderer.drawing.saving);
    }
    const hasPreview = hasGenerationPreview();
    if (generationPreviewTerrain) generationPreviewTerrain.disabled = Boolean(renderer.drawing.saving);
    if (sharedApplyButton) sharedApplyButton.disabled = Boolean(renderer.drawing.saving || !hasPreview);
    if (sharedDiscardButton) sharedDiscardButton.disabled = Boolean(renderer.drawing.saving || !hasPreview);
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
      generationRoadLength: 100,
      generationIncludePaths: true,
      generationIncludeTradeRoutes: false,
      generationRiverAmount: 100,
      generationRiverLength: 100,
      generationRiverWildcards: 100,
      generationPoiGlobalAmount: 100,
      generationSettlementDensity: 100,
      generationPopulationConcentration: 100,
      generationResourceAmount: 100,
      generationWaypointAmount: 100,
      generationStrongholdAmount: 100
    });
    updateGenerationControls();
  }

  function resetPoiGenerationSliders() {
    Object.assign(renderer.drawing, {
      generationPoiGlobalAmount: 100,
      generationSettlementDensity: 100,
      generationPopulationConcentration: 100,
      generationResourceAmount: 100,
      generationWaypointAmount: 100,
      generationStrongholdAmount: 100,
      generationDungeonAmount: 100,
      generationDungeonComplexAmount: 100,
      generationSiteAmount: 100
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

  function hasStagedMapEdits() {
    return getStagedUndoStack().length > 0;
  }

  function editorUsesStagedHistoryOnly() {
    return Boolean(renderer.drawing.enabled && (renderer.drawing.toolsMode || "chooser") === "cartographer");
  }

  function ensurePersistedHistoryQueues() {
    if (!Array.isArray(renderer.drawing.surveyorUndoStack)) {
      renderer.drawing.surveyorUndoStack = Array.isArray(renderer.drawing.undoStack) ? [...renderer.drawing.undoStack] : [];
    }
    if (!Array.isArray(renderer.drawing.surveyorRedoStack)) {
      renderer.drawing.surveyorRedoStack = Array.isArray(renderer.drawing.redoStack) ? [...renderer.drawing.redoStack] : [];
    }
    if (!Array.isArray(renderer.drawing.cartographerUndoStack)) renderer.drawing.cartographerUndoStack = [];
    if (!Array.isArray(renderer.drawing.cartographerRedoStack)) renderer.drawing.cartographerRedoStack = [];
    renderer.drawing.cartographerUndoStack = renderer.drawing.cartographerUndoStack.filter(isCartographerPersistedHistoryAction);
    renderer.drawing.cartographerRedoStack = renderer.drawing.cartographerRedoStack.filter(isCartographerPersistedHistoryAction);
    renderer.drawing.undoStack = renderer.drawing.surveyorUndoStack;
    renderer.drawing.redoStack = renderer.drawing.surveyorRedoStack;
  }

  function normalizePersistedHistoryOwner(owner) {
    return owner === "cartographer" ? "cartographer" : "surveyor";
  }

  function getActivePersistedHistoryOwner() {
    return (renderer.drawing.toolsMode || "chooser") === "cartographer"
      ? "cartographer"
      : "surveyor";
  }

  function isCartographerPersistedHistoryAction(action) {
    if (!action?.type) return false;
    if (action.type === "terrain") return true;
    if (action.type !== "batch" || !Array.isArray(action.actions) || !action.actions.length) return false;
    return action.actions.every(entry => entry?.type === "terrain");
  }

  function cartographerHasStagedHistory() {
    return getStagedUndoStack().length > 0 || getStagedRedoStack().length > 0;
  }

  function getActiveHistoryTarget() {
    if ((renderer.drawing.toolsMode || "chooser") === "cartographer" && cartographerHasStagedHistory()) {
      return { kind: "staged", owner: "cartographer" };
    }
    return { kind: "persisted", owner: getActivePersistedHistoryOwner() };
  }

  function getStagedUndoStack() {
    return renderer.drawing.stagedUndoStack || [];
  }

  function getStagedRedoStack() {
    return renderer.drawing.stagedRedoStack || [];
  }

  function getPersistedUndoStack(owner = "surveyor") {
    ensurePersistedHistoryQueues();
    return normalizePersistedHistoryOwner(owner) === "cartographer"
      ? renderer.drawing.cartographerUndoStack
      : renderer.drawing.surveyorUndoStack;
  }

  function getPersistedRedoStack(owner = "surveyor") {
    ensurePersistedHistoryQueues();
    return normalizePersistedHistoryOwner(owner) === "cartographer"
      ? renderer.drawing.cartographerRedoStack
      : renderer.drawing.surveyorRedoStack;
  }

  function clearStagedRedoStack() {
    renderer.drawing.stagedRedoStack = [];
  }

  function clearPersistedRedoStack(owner = "surveyor") {
    ensurePersistedHistoryQueues();
    if (normalizePersistedHistoryOwner(owner) === "cartographer") {
      renderer.drawing.cartographerRedoStack = [];
    } else {
      renderer.drawing.surveyorRedoStack = [];
      renderer.drawing.redoStack = [];
    }
  }

  function pushStagedUndoAction(action) {
    renderer.drawing.stagedUndoStack.push(action);
  }

  function pushStagedRedoAction(action) {
    renderer.drawing.stagedRedoStack.push(action);
  }

  function pushPersistedUndoAction(action, owner = "surveyor") {
    const target = getPersistedUndoStack(owner);
    if (action && typeof action === "object") action.__historyOwner = normalizePersistedHistoryOwner(owner);
    target.push(action);
    if (normalizePersistedHistoryOwner(owner) === "surveyor") renderer.drawing.undoStack = target;
  }

  function pushPersistedRedoAction(action, owner = "surveyor") {
    const target = getPersistedRedoStack(owner);
    if (action && typeof action === "object") action.__historyOwner = normalizePersistedHistoryOwner(owner);
    target.push(action);
    if (normalizePersistedHistoryOwner(owner) === "surveyor") renderer.drawing.redoStack = target;
  }

  function removePersistedHistoryAction(action, owner = "surveyor", kind = "undo") {
    const target = kind === "redo"
      ? getPersistedRedoStack(owner)
      : getPersistedUndoStack(owner);
    const index = target.lastIndexOf(action);
    if (index >= 0) {
      target.splice(index, 1);
      return;
    }
    if (target.length && target[target.length - 1]?.type === action?.type) {
      target.pop();
    }
  }

  function hasGenerationPreview() {
    return hasStagedMapEdits();
  }

  function isLocalStagedAction(action) {
    return Boolean(action?.localStage);
  }

  function cloneOverlayRecord(overlay) {
    if (!overlay) return overlay;
    return {
      ...overlay
    };
  }

  function cloneMapEditAction(action) {
    if (!action?.type) return null;
    if (action.type === "batch") {
      return {
        type: "batch",
        previewSection: action.previewSection || "",
        previewOverlayType: action.previewOverlayType || "",
        generatedRegions: (action.generatedRegions || []).map(cloneRegionHistoryRecord),
        actions: (action.actions || []).map(cloneMapEditAction).filter(Boolean)
      };
    }
    if (action.type === "overlay") {
      return {
        type: "overlay",
        previewSection: action.previewSection || "",
        previewOverlayType: action.previewOverlayType || "",
        overlays: (action.overlays || []).map(cloneOverlayRecord)
      };
    }
    if (action.type === "nuke-regions") {
      return {
        type: "nuke-regions",
        regionType: action.regionType || "geographic",
        generatedRegions: (action.generatedRegions || []).map(cloneRegionHistoryRecord),
        actions: (action.actions || []).map(cloneMapEditAction).filter(Boolean)
      };
    }
    return JSON.parse(JSON.stringify({
      type: action.type,
      hexId: action.hexId,
      regionType: action.regionType,
      before: action.before,
      after: action.after,
      previewSection: action.previewSection || ""
    }));
  }

  function isHexStyleOverlayType(type) {
    return HEX_STYLE_OVERLAY_TYPES.has(String(type || "").toLowerCase());
  }

  function createLocalOverlayRecord(segment, prefix = "staged") {
    renderer.localOverlayNonce = (renderer.localOverlayNonce || 0) + 1;
    const isHexOverlay = isHexStyleOverlayType(segment.tool);
    return {
      __uuid: `${prefix}-${renderer.localOverlayNonce}`,
      __preview: prefix === "preview",
      __staged: true,
      Overlay_Type: segment.tool,
      From_Hex_ID_Ref: !isHexOverlay ? segment.fromHexId : "",
      To_Hex_ID_Ref: segment.toHexId || "",
      Hex_ID_Ref: isHexOverlay ? segment.fromHexId : "",
      Edge: segment.edge || "",
      Style: segment.style || "",
      Is_Major_Route: Boolean(segment.routeMetadata?.isMajorRoute),
      Route_Name: segment.routeMetadata?.routeName || ""
    };
  }

  function ensureStagedOverlayBaseline() {
    if (renderer.drawing.stagedOverlayBaseline) return;
    renderer.drawing.stagedOverlayBaseline = (renderer.mapOverlays || []).map(cloneOverlayRecord);
  }

  function captureStagedTerrainOriginals(action) {
    if (!action?.type) return;
    if (action.type === "batch") {
      (action.actions || []).forEach(captureStagedTerrainOriginals);
      return;
    }
    if (action.type === "terrain" && action.before && !renderer.drawing.stagedTerrainOriginals.has(action.hexId)) {
      renderer.drawing.stagedTerrainOriginals.set(action.hexId, normalizeTerrainSnapshot(action.before));
    }
  }

  function pushStagedMapEditAction(action, options = {}) {
    if (!action?.type) return;
    if (renderer.drawing.dragActionBatch && !options.force) {
      renderer.drawing.dragActionBatch.localStage = true;
      if (!renderer.drawing.dragActionBatch.previewSection && action.previewSection) {
        renderer.drawing.dragActionBatch.previewSection = action.previewSection;
      }
      renderer.drawing.dragActionBatch.actions.push(action);
      return;
    }
    captureStagedTerrainOriginals(action);
    action.localStage = true;
    pushStagedUndoAction(action);
    clearStagedRedoStack();
    refreshEditorActionControls();
  }

  function applyLocalMapEditAction(action, direction) {
    if (!action?.type) return;
    if (action.type === "batch") {
      const actions = direction === "undo"
        ? [...(action.actions || [])].reverse()
        : (action.actions || []);
      actions.forEach(childAction => applyLocalMapEditAction(childAction, direction));
      return;
    }

    if (action.type === "terrain") {
      applyLocalTerrainSnapshot(action.hexId, direction === "undo" ? action.before : action.after);
      return;
    }

    if (action.type === "overlay") {
      (action.overlays || []).forEach(overlay => {
        const shouldRemove = direction === "redo" ? overlay.__undoDeleted : !overlay.__undoDeleted;
        if (shouldRemove) removeLocalOverlayById(overlay.__uuid);
        else upsertLocalOverlay(overlay);
      });
    }
  }

  function pruneTemporaryOverlaysFromAction(action, overlayIds) {
    if (!action?.type) return null;
    if (action.type === "batch") {
      const actions = (action.actions || [])
        .map(childAction => pruneTemporaryOverlaysFromAction(childAction, overlayIds))
        .filter(Boolean);
      if (!actions.length) return null;
      return {
        ...action,
        actions
      };
    }
    if (action.type !== "overlay") return action;
    const overlays = (action.overlays || []).filter(overlay => !overlayIds.has(overlay.__uuid));
    if (!overlays.length) return null;
    return {
      ...action,
      overlays
    };
  }

  function dropTemporaryOverlaysFromStagedActions(overlayIds) {
    if (!overlayIds?.size) return;
    const transformStack = stack => (stack || [])
      .map(action => pruneTemporaryOverlaysFromAction(action, overlayIds))
      .filter(Boolean);
    renderer.drawing.stagedUndoStack = transformStack(getStagedUndoStack());
    renderer.drawing.stagedRedoStack = transformStack(getStagedRedoStack());
  }

  function restoreStagedOverlayBaseline() {
    if (!renderer.drawing.stagedOverlayBaseline) return;
    renderer.mapOverlays = renderer.drawing.stagedOverlayBaseline.map(cloneOverlayRecord);
    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    bumpOverlayRevision();
  }

  function restoreStagedTerrainOriginals() {
    renderer.drawing.stagedTerrainOriginals.forEach((snapshot, hexId) => {
      applyLocalTerrainSnapshot(hexId, snapshot);
    });
  }

  function rebuildStagedTerrainOriginals() {
    const originals = new Map();
    const collect = action => {
      if (!action?.type) return;
      if (action.type === "batch") {
        (action.actions || []).forEach(collect);
        return;
      }
      if (action.type === "terrain" && action.before && !originals.has(action.hexId)) {
        originals.set(action.hexId, normalizeTerrainSnapshot(action.before));
      }
    };
    getStagedUndoStack().forEach(collect);
    getStagedRedoStack().forEach(collect);
    renderer.drawing.stagedTerrainOriginals = originals;
  }

  function collectTerrainHexIdsFromAction(action, hexIds = new Set()) {
    if (!action?.type) return hexIds;
    if (action.type === "batch") {
      (action.actions || []).forEach(childAction => collectTerrainHexIdsFromAction(childAction, hexIds));
      return hexIds;
    }
    if (action.type === "terrain" && action.hexId) hexIds.add(action.hexId);
    return hexIds;
  }

  function actionHasOverlayEdits(action) {
    if (!action?.type) return false;
    if (action.type === "batch") return (action.actions || []).some(actionHasOverlayEdits);
    return action.type === "overlay";
  }

  function applyLocalTerrainActionsForHexes(action, direction, hexIds) {
    if (!action?.type || !hexIds?.size) return;
    if (action.type === "batch") {
      const actions = direction === "undo"
        ? [...(action.actions || [])].reverse()
        : (action.actions || []);
      actions.forEach(childAction => applyLocalTerrainActionsForHexes(childAction, direction, hexIds));
      return;
    }
    if (action.type !== "terrain" || !hexIds.has(action.hexId)) return;
    applyLocalTerrainSnapshot(action.hexId, direction === "undo" ? action.before : action.after);
  }

  function applyLocalOverlayActions(action, direction) {
    if (!action?.type) return;
    if (action.type === "batch") {
      const actions = direction === "undo"
        ? [...(action.actions || [])].reverse()
        : (action.actions || []);
      actions.forEach(childAction => applyLocalOverlayActions(childAction, direction));
      return;
    }
    if (action.type !== "overlay") return;
    (action.overlays || []).forEach(overlay => {
      const shouldRemove = direction === "redo" ? overlay.__undoDeleted : !overlay.__undoDeleted;
      if (shouldRemove) removeLocalOverlayById(overlay.__uuid);
      else upsertLocalOverlay(overlay);
    });
  }

  function removeStagedActionsByPredicate(predicate, options = {}) {
    const matches = action => predicate(action);
    const previousUndo = getStagedUndoStack();
    const previousRedo = getStagedRedoStack();
    const removedUndo = previousUndo.filter(matches);
    const removedRedo = previousRedo.filter(matches);
    if (!removedUndo.length && !removedRedo.length) return false;

    renderer.drawing.stagedUndoStack = previousUndo.filter(action => !matches(action));
    renderer.drawing.stagedRedoStack = previousRedo.filter(action => !matches(action));

    const affectedTerrainHexIds = removedUndo.reduce((set, action) => collectTerrainHexIdsFromAction(action, set), new Set());
    const affectedOverlays = removedUndo.some(actionHasOverlayEdits);

    if (affectedTerrainHexIds.size) {
      [...removedUndo].reverse().forEach(action => applyLocalTerrainActionsForHexes(action, "undo", affectedTerrainHexIds));
      getStagedUndoStack().forEach(action => applyLocalTerrainActionsForHexes(action, "redo", affectedTerrainHexIds));
      affectedTerrainHexIds.forEach(hexId => markTerrainHexDirty(hexId));
    }

    if (affectedOverlays) {
      [...removedUndo].reverse().forEach(action => applyLocalOverlayActions(action, "undo"));
      getStagedUndoStack().forEach(action => applyLocalOverlayActions(action, "redo"));
      markRouteCacheDirty();
      markOverlayCacheDirty();
    }

    rebuildStagedTerrainOriginals();
    if (!options.silent) {
      render();
      updateDrawHint();
    }
    refreshEditorActionControls();
    return true;
  }

  function rebuildStagedLocalState() {
    restoreStagedOverlayBaseline();
    restoreStagedTerrainOriginals();
    getStagedUndoStack().forEach(action => applyLocalMapEditAction(action, "redo"));
    markTerrainCacheDirty();
    render();
  }

  function clearStagedMapEditState() {
    renderer.drawing.stagedTerrainOriginals.clear();
    renderer.drawing.stagedOverlayBaseline = null;
    renderer.drawing.stagedUndoStack = [];
    renderer.drawing.stagedRedoStack = [];
    renderer.drawing.generationPreviewOriginals.clear();
    renderer.drawing.generationPreviewActions = [];
  }

  function discardAllStagedMapEdits(options = {}) {
    if (!hasStagedMapEdits()) return;
    restoreStagedOverlayBaseline();
    restoreStagedTerrainOriginals();
    clearStagedMapEditState();
    markAllMapCachesDirty();
    render();
    refreshEditorActionControls();
    if (!options.silent) updateDrawHint();
  }

  function discardStagedMapEditSection(section, options = {}) {
    const normalized = ["terrain", "features", "overlays"].includes(section) ? section : "";
    if (!normalized || !hasStagedMapEdits()) return;
    removeStagedActionsByPredicate(action => action?.previewSection === normalized, options);
  }

  function hasPendingEditorExitWarning() {
    return renderer.drawing.enabled && hasStagedMapEdits();
  }

  async function confirmDiscardUnappliedEdits(message) {
    if (!hasPendingEditorExitWarning()) return true;
    return window.codexConfirm
      ? window.codexConfirm(message, { title: "Discard Preview?", confirmLabel: "Discard", tone: "danger" })
      : window.confirm?.(message) === true;
  }

  function isTextEditingTarget(target) {
    const tagName = String(target?.tagName || "").toUpperCase();
    if (tagName === "TEXTAREA" || tagName === "SELECT") return true;
    if (target?.isContentEditable) return true;
    if (tagName !== "INPUT") return false;
    const inputType = String(target.type || "text").toLowerCase();
    return ["", "email", "number", "password", "search", "tel", "text", "url"].includes(inputType);
  }

  function handleMapEditorBeforeUnload(event) {
    if (!hasPendingEditorExitWarning()) return;
    event.preventDefault();
    event.returnValue = "";
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
    if (tool === "farmland") {
      hint.textContent = "Paint farmland with the brush. Higher Noise makes the brush patchier.";
      return;
    }
    if (tool === "erase") {
      hint.textContent = "Click a hex to erase connected overlay segments from that location.";
      return;
    }
    if (tool === "region" || tool === "unregion" || tool === "political-region" || tool === "clear-political-region") {
      hint.textContent = "Paint region ownership directly onto hexes with the region brush. Ctrl+Z undoes, Ctrl+Y redoes.";
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
      if (renderer.drawing.generationSection === "regions") {
        hint.textContent = "Generate geographic Codex regions from current terrain and paint unclaimed land hexes. Ctrl+Z undoes during this session.";
        return;
      }
      hint.textContent = "Preview a full terrain draft locally before applying it.";
      return;
    }
    if (activeSection === "pois") {
      hint.textContent = "Generate settlements, strongholds, dungeons, places of note, resource sites, and waypoints directly into the live POI system.";
      return;
    }
    if (activeSection === "purge") {
      hint.textContent = "Purge saved live-map overlays, POIs, and region paint from one place. Ctrl+Z can undo supported actions during this session.";
      return;
    }
    hint.textContent = "Right-drag or middle-drag pans. Ctrl+Z undoes, Ctrl+Y redoes.";
  }

  function updateDrawUndoButton() {
    const undoButton = document.getElementById("map-draw-undo");
    if (!undoButton) return;
    const historyTarget = getActiveHistoryTarget();
    const count = historyTarget.kind === "staged"
      ? getStagedUndoStack().length
      : getPersistedUndoStack(historyTarget.owner).length;
    undoButton.disabled = count === 0 || renderer.drawing.saving;
    undoButton.textContent = count
      ? `Undo (${count})`
      : "Undo";
  }

  function updateDrawRedoButton() {
    const redoButton = document.getElementById("map-draw-redo");
    if (!redoButton) return;
    const historyTarget = getActiveHistoryTarget();
    const count = historyTarget.kind === "staged"
      ? getStagedRedoStack().length
      : getPersistedRedoStack(historyTarget.owner).length;
    redoButton.disabled = count === 0 || renderer.drawing.saving;
    redoButton.textContent = count
      ? `Redo (${count})`
      : "Redo";
  }

  function refreshEditorActionControls() {
    updateDrawUndoButton();
    updateDrawRedoButton();
    updateDrawClearButton();
  }

  function refreshEditorPreviewControls() {
    refreshEditorActionControls();
    updateGenerationControls();
  }

  function updateDrawClearButton() {
    const hasStagedEdits = hasStagedMapEdits();
    const overlayTypeCounts = getCurrentMapOverlays().reduce((counts, overlay) => {
      const type = String(overlay?.Overlay_Type || "").trim();
      if (!type) return counts;
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    [
      "map-generation-run-features",
      "map-generation-run-roads",
      "map-generation-run-rivers",
      "map-generation-reset-sliders",
      "map-generation-random-seed",
      "map-generation-preview-terrain",
      "map-clear-features"
    ].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) button.disabled = renderer.drawing.saving;
    });
    [
      "map-clear-geo-regions",
      "map-clear-pol-regions"
    ].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) button.disabled = renderer.drawing.saving || hasStagedEdits;
    });
    document.querySelectorAll("[data-clear-overlay-type]").forEach(button => {
      button.disabled = renderer.drawing.saving || hasStagedEdits || !overlayTypeCounts[button.dataset.clearOverlayType || ""];
    });
    const clearAllOverlaysButton = document.getElementById("map-clear-all-overlays");
    if (clearAllOverlaysButton) {
      clearAllOverlaysButton.disabled = renderer.drawing.saving || hasStagedEdits || !Object.values(overlayTypeCounts).some(count => count > 0);
    }
    updateGenerationControls();
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
    renderTerrain(viewport, visibleHexes);
    renderSvg(viewport, visibleHexes);
    positionPopup();
  }

  function renderTerrain({ width, height, scale }, visibleHexes) {
    const ctx = renderer.ctx;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const deferOverlayCaches = shouldDeferOverlayCacheRefresh();
    updateTerrainCache(visibleHexes);
    updateFeatureCache();
    // Heavy live overlays should not block the first terrain/feature paint on dense maps.
    if (deferOverlayCaches) queueMapRender(true);
    else {
      // Keep routes in their own under-feature layer so route edits do not rebuild feature art.
      updateRouteCache();
      updateOverlayCache();
    }
    drawCacheSlice(ctx, renderer.cacheCanvas, width, height);
    drawCacheSlice(ctx, renderer.routeCacheCanvas, width, height);
    drawCacheSlice(ctx, renderer.featureCacheCanvas, width, height);
    drawCacheSlice(ctx, renderer.overlayCacheCanvas, width, height);
    renderer.drawing.terrainDirtyHexIds.clear();
    if (!renderer.drawing.saving && !renderer.initialMapLoadingActive) {
      setLoading(false);
    }
  }

  function shouldDeferOverlayCacheRefresh() {
    if (!renderer.routeCacheDirty && !renderer.overlayCacheDirty) return false;
    return renderer.cacheDirty
      || renderer.featureCacheDirty
      || renderer.drawing.terrainDirtyHexIds.size > 0;
  }

  function drawCacheSlice(ctx, sourceCanvas, width, height) {
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
      sourceCanvas,
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

  function updateTerrainCache(visibleHexes = []) {
    const cacheWidth = Math.max(1, Math.ceil(renderer.view.width * TERRAIN_CACHE_SCALE));
    const cacheHeight = Math.max(1, Math.ceil(renderer.view.height * TERRAIN_CACHE_SCALE));

    if (renderer.cacheCanvas.width !== cacheWidth || renderer.cacheCanvas.height !== cacheHeight) {
      renderer.cacheCanvas.width = cacheWidth;
      renderer.cacheCanvas.height = cacheHeight;
      markTerrainCacheDirty();
    }

    if (!renderer.cacheDirty && !renderer.drawing.terrainDirtyHexIds.size) return;

    const ctx = renderer.cacheCtx;
    ctx.setTransform(TERRAIN_CACHE_SCALE, 0, 0, TERRAIN_CACHE_SCALE, 0, 0);
    if (renderer.cacheDirty) {
      ctx.clearRect(0, 0, renderer.view.width, renderer.view.height);

      renderer.hexes.forEach(hex => {
        drawCanvasPolygon(ctx, hex.points, hex.fill);
      });
    } else {
      const dirtyBounds = getTerrainDirtyBounds();
      if (!dirtyBounds) return;
      const patchHexes = renderer.hexes.filter(hex => hexIntersectsBounds(hex, dirtyBounds));
      ctx.clearRect(
        dirtyBounds.left,
        dirtyBounds.top,
        dirtyBounds.right - dirtyBounds.left,
        dirtyBounds.bottom - dirtyBounds.top
      );
      patchHexes.forEach(hex => {
        drawCanvasPolygon(ctx, hex.points, hex.fill);
      });
    }
    renderer.cacheDirty = false;
  }

  function updateRouteCache() {
    const cacheWidth = Math.max(1, Math.ceil(renderer.view.width * TERRAIN_CACHE_SCALE));
    const cacheHeight = Math.max(1, Math.ceil(renderer.view.height * TERRAIN_CACHE_SCALE));

    if (renderer.routeCacheCanvas.width !== cacheWidth || renderer.routeCacheCanvas.height !== cacheHeight) {
      renderer.routeCacheCanvas.width = cacheWidth;
      renderer.routeCacheCanvas.height = cacheHeight;
      renderer.routeCacheDirty = true;
    }

    if (!renderer.routeCacheDirty) return;

    const ctx = renderer.routeCacheCtx;
    ctx.setTransform(TERRAIN_CACHE_SCALE, 0, 0, TERRAIN_CACHE_SCALE, 0, 0);
    ctx.clearRect(0, 0, renderer.view.width, renderer.view.height);
    if (renderer.drawing.visibleOverlays.features && shouldRenderFeatureArt()) {
      renderer.hexes.forEach(hex => renderFarmlandOverlayForHex(ctx, hex));
    }
    renderCanvasDrawablePaths(ctx);
    renderer.routeCacheDirty = false;
  }

  function updateFeatureCache() {
    const cacheWidth = Math.max(1, Math.ceil(renderer.view.width * TERRAIN_CACHE_SCALE));
    const cacheHeight = Math.max(1, Math.ceil(renderer.view.height * TERRAIN_CACHE_SCALE));

    if (renderer.featureCacheCanvas.width !== cacheWidth || renderer.featureCacheCanvas.height !== cacheHeight) {
      renderer.featureCacheCanvas.width = cacheWidth;
      renderer.featureCacheCanvas.height = cacheHeight;
      renderer.featureCacheDirty = true;
    }

    if (!renderer.featureCacheDirty && !renderer.drawing.terrainDirtyHexIds.size) return;

    const ctx = renderer.featureCacheCtx;
    ctx.setTransform(TERRAIN_CACHE_SCALE, 0, 0, TERRAIN_CACHE_SCALE, 0, 0);
    if (renderer.featureCacheDirty) {
      ctx.clearRect(0, 0, renderer.view.width, renderer.view.height);
      renderer.hexes.forEach(hex => renderEdgeBleedForHex(ctx, hex));
      if (renderer.drawing.visibleOverlays.features && shouldRenderFeatureArt()) {
        renderer.hexes.forEach(hex => renderFeatureArtForHex(ctx, hex));
      }
    } else {
      const dirtyBounds = getTerrainDirtyBounds();
      if (!dirtyBounds) return;
      const contributorBounds = getFeatureDirtyBounds(dirtyBounds);
      const patchHexes = renderer.hexes.filter(hex => hexIntersectsBounds(hex, contributorBounds));
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        dirtyBounds.left,
        dirtyBounds.top,
        dirtyBounds.right - dirtyBounds.left,
        dirtyBounds.bottom - dirtyBounds.top
      );
      ctx.clip();
      ctx.clearRect(
        dirtyBounds.left,
        dirtyBounds.top,
        dirtyBounds.right - dirtyBounds.left,
        dirtyBounds.bottom - dirtyBounds.top
      );
      patchHexes.forEach(hex => renderEdgeBleedForHex(ctx, hex));
      if (renderer.drawing.visibleOverlays.features && shouldRenderFeatureArt()) {
        patchHexes.forEach(hex => renderFeatureArtForHex(ctx, hex));
      }
      ctx.restore();
    }
    renderer.featureCacheDirty = false;
  }

  function getTerrainDirtyBounds() {
    if (!renderer.drawing.terrainDirtyHexIds.size) return null;
    const dimensions = getGeneratedMapDimensions();
    const padX = Math.max(110, dimensions.radius * 2.4);
    const padTop = Math.max(130, dimensions.hexHeight * 2.1);
    const padBottom = Math.max(90, dimensions.hexHeight * 1.2);
    let bounds = null;

    renderer.drawing.terrainDirtyHexIds.forEach(hexId => {
      const hex = hexForPathPoint(hexId);
      if (!hex) return;
      const next = {
        left: Math.max(0, hex.center.x - padX),
        right: Math.min(renderer.view.width, hex.center.x + padX),
        top: Math.max(0, hex.center.y - padTop),
        bottom: Math.min(renderer.view.height, hex.center.y + padBottom)
      };
      if (!bounds) {
        bounds = next;
        return;
      }
      bounds.left = Math.min(bounds.left, next.left);
      bounds.right = Math.max(bounds.right, next.right);
      bounds.top = Math.min(bounds.top, next.top);
      bounds.bottom = Math.max(bounds.bottom, next.bottom);
    });

    return bounds;
  }

  function getFeatureDirtyBounds(bounds = null) {
    bounds = bounds || getTerrainDirtyBounds();
    if (!bounds) return null;
    const dimensions = getGeneratedMapDimensions();
    // Edge bleed and feature art can spill across the base terrain patch boundary.
    return expandRenderBounds(bounds, {
      left: Math.max(90, dimensions.radius * 2),
      right: Math.max(90, dimensions.radius * 2),
      top: Math.max(110, dimensions.hexHeight * 1.8),
      bottom: Math.max(110, dimensions.hexHeight * 1.8)
    });
  }

  function expandRenderBounds(bounds, padding = {}) {
    if (!bounds) return null;
    return {
      left: Math.max(0, bounds.left - Math.max(0, Number(padding.left) || 0)),
      right: Math.min(renderer.view.width, bounds.right + Math.max(0, Number(padding.right) || 0)),
      top: Math.max(0, bounds.top - Math.max(0, Number(padding.top) || 0)),
      bottom: Math.min(renderer.view.height, bounds.bottom + Math.max(0, Number(padding.bottom) || 0))
    };
  }

  function updateOverlayCache() {
    const cacheWidth = Math.max(1, Math.ceil(renderer.view.width * TERRAIN_CACHE_SCALE));
    const cacheHeight = Math.max(1, Math.ceil(renderer.view.height * TERRAIN_CACHE_SCALE));

    if (renderer.overlayCacheCanvas.width !== cacheWidth || renderer.overlayCacheCanvas.height !== cacheHeight) {
      renderer.overlayCacheCanvas.width = cacheWidth;
      renderer.overlayCacheCanvas.height = cacheHeight;
      renderer.overlayCacheDirty = true;
    }

    if (!renderer.overlayCacheDirty) return;

    const ctx = renderer.overlayCacheCtx;
    ctx.setTransform(TERRAIN_CACHE_SCALE, 0, 0, TERRAIN_CACHE_SCALE, 0, 0);
    ctx.clearRect(0, 0, renderer.view.width, renderer.view.height);

    if (renderer.drawing.visibleOverlays.mist && shouldRenderFeatureArt()) {
      renderCanvasMistOverlays(ctx);
    }
    renderer.overlayCacheDirty = false;
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
    const overlaysByType = getOverlaysByType();

    if (renderer.drawing.visibleOverlays.path) {
      connectedPathStrings(overlaysByType.path, "path").forEach(pathData => {
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
        renderMajorRiverMountainCulverts(ctx, regularSegments);
      };
      const riverSegments = overlaysByType.river;
      drawRiverPaths(riverSegments.filter(segment => !segment.Is_Major_Route));
      drawRiverPaths(riverSegments.filter(segment => segment.Is_Major_Route));
    }

    if (renderer.drawing.visibleOverlays.sea_route) {
      connectedPathStrings(overlaysByType.sea_route, "sea_route").forEach(pathData => {
        drawCanvasOverlayPath(ctx, pathData.d, {
          stroke: "rgba(236, 227, 176, 0.72)",
          width: 4.5,
          dash: [12, 8],
          lineCap: pathData.isExit ? "butt" : "round"
        });
      });
    }

    if (renderer.drawing.visibleOverlays.road) {
      const roadSegments = overlaysByType.road;
      const drawRoadSegments = segments => {
        const passRoadSegments = segments.filter(isAutoPassRoadSegment);
        const baseRoadSegments = segments.filter(segment => !isAutoPassRoadSegment(segment));
        const strictRoadSegments = baseRoadSegments.filter(segment => !overlayHasStyleFlag(segment, OVERLAY_STYLE_FLAGS.roadWaterOverride));
        const roadBreakHexIds = new Set([
          ...getAutoPassConnectorHexIds(passRoadSegments, baseRoadSegments),
          ...getRoadVisualAnchorBreakHexIds(baseRoadSegments)
        ]);
        renderRoadWaterCrossingDecorations(ctx, strictRoadSegments);
        connectedPathStrings(baseRoadSegments, "road", roadBreakHexIds).forEach(pathData => {
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
    }

  }

  function getOverlaysByType() {
    if (renderer.overlaysByTypeCache.revision === renderer.overlayRevision && renderer.overlaysByTypeCache.groups) {
      return renderer.overlaysByTypeCache.groups;
    }
    const groups = groupOverlaysByType(renderer.mapOverlays || []);
    renderer.overlaysByTypeCache = { revision: renderer.overlayRevision, groups };
    return groups;
  }

  function groupOverlaysByType(overlays) {
    return (overlays || []).reduce((groups, overlay) => {
      const type = overlay?.Overlay_Type;
      if (type && groups[type]) groups[type].push(overlay);
      return groups;
    }, { road: [], river: [], path: [], sea_route: [], wall: [], mist: [], farmland: [] });
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
    renderer.featureAssetsLoaded = false;

    renderer.featureAssetsLoading = Promise.all(FEATURE_ART_ASSET_FILES.map(async file => {
      try {
        const response = await fetch(`${FEATURE_ASSET_PATH}${file}`);
        if (!response.ok) return;
        renderer.featureAssets.set(file, parseFeatureSvg(await response.text()));
      } catch {}
    })).then(() => {
      renderer.featureAssetsLoaded = true;
      renderer.featureSourceImages.clear();
      renderer.featureImages.clear();
      markRouteCacheDirty();
      markFeatureCacheDirty();
      queueMapRender(true);
    });

    return renderer.featureAssetsLoading;
  }

  function getFeatureImageCacheKey(file, tint) {
    return `${file}|${tint}|${FEATURE_IMAGE_SUPERSAMPLE}`;
  }

  function ensureFeatureImageUsage(cacheKey) {
    let usage = renderer.featureImageUsage.get(cacheKey);
    if (!usage) {
      usage = { terrainHexIds: new Set(), overlayTypes: new Set() };
      renderer.featureImageUsage.set(cacheKey, usage);
    }
    return usage;
  }

  function registerFeatureImageUsage(cacheKey, usage) {
    if (!cacheKey || !usage) return;
    const entry = ensureFeatureImageUsage(cacheKey);
    if (usage.type === "terrain" && usage.hexId) {
      entry.terrainHexIds.add(usage.hexId);
      return;
    }
    if (usage.type === "overlay" && usage.overlayType) {
      entry.overlayTypes.add(usage.overlayType);
    }
  }

  function queueFeatureImageLoad(cacheKey, file, tint) {
    const asset = renderer.featureAssets.get(file);
    if (!asset) return;
    let entry = renderer.featureImages.get(cacheKey);
    if (!entry) {
      entry = { image: null, loaded: false, loading: false, file, tint };
      renderer.featureImages.set(cacheKey, entry);
    } else {
      entry.file = file;
      entry.tint = tint;
    }
    if (entry.loaded || entry.loading || renderer.featureImageQueued.has(cacheKey)) return;
    renderer.featureImageQueued.add(cacheKey);
    renderer.featureImageQueue.push(cacheKey);
    scheduleFeatureImageQueue();
  }

  function scheduleFeatureImageQueue() {
    if (renderer.featureImageFrame) return;
    renderer.featureImageFrame = window.requestAnimationFrame(() => {
      renderer.featureImageFrame = null;
      processFeatureImageQueue();
    });
  }

  function processFeatureImageQueue() {
    while (renderer.featureImageActiveLoads < FEATURE_IMAGE_BATCH_SIZE && renderer.featureImageQueue.length) {
      const cacheKey = renderer.featureImageQueue.shift();
      renderer.featureImageQueued.delete(cacheKey);
      startFeatureImageLoad(cacheKey);
    }
    if (renderer.featureImageQueue.length && !renderer.featureImageFrame) {
      scheduleFeatureImageQueue();
    }
  }

  function startFeatureImageLoad(cacheKey) {
    const entry = renderer.featureImages.get(cacheKey);
    if (!entry?.file || entry.loaded || entry.loading) return;
    const asset = renderer.featureAssets.get(entry.file);
    if (!asset) return;

    entry.loading = true;
    renderer.featureImageActiveLoads += 1;
    loadFeatureSourceImage(entry.file, asset)
      .then(sourceImage => {
        const current = renderer.featureImages.get(cacheKey);
        if (!current) {
          renderer.featureImageActiveLoads = Math.max(0, renderer.featureImageActiveLoads - 1);
          processFeatureImageQueue();
          flushInitialFeatureImageBatchIfReady();
          return;
        }

        const canvas = sourceImage ? tintFeatureSourceImage(sourceImage, asset, current.tint) : null;
        current.image = canvas;
        current.loaded = Boolean(canvas);
        current.loading = false;
        renderer.featureImageActiveLoads = Math.max(0, renderer.featureImageActiveLoads - 1);
        if (renderer.initialMapLoadingActive) {
          renderer.featureImageStartupBatchDirty = true;
        } else {
          markFeatureImageUsageDirty(cacheKey);
        }
        processFeatureImageQueue();
        flushInitialFeatureImageBatchIfReady();
      })
      .catch(() => {
        const current = renderer.featureImages.get(cacheKey);
        if (current) current.loading = false;
        renderer.featureImageActiveLoads = Math.max(0, renderer.featureImageActiveLoads - 1);
        processFeatureImageQueue();
        flushInitialFeatureImageBatchIfReady();
      });
  }

  function loadFeatureSourceImage(file, asset) {
    const cached = renderer.featureSourceImages.get(file);
    if (cached?.image) return Promise.resolve(cached.image);
    if (cached?.promise) return cached.promise;

    const image = new Image();
    const sourceEntry = { image: null, promise: null };
    sourceEntry.promise = new Promise(resolve => {
      image.onload = () => {
        sourceEntry.image = image;
        resolve(image);
      };
      image.onerror = () => resolve(null);
    });
    renderer.featureSourceImages.set(file, sourceEntry);
    image.src = featureSourceDataUrl(asset);
    return sourceEntry.promise;
  }

  function featureSourceDataUrl(asset) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${asset.viewBox}" color="#ffffff" fill="currentColor">${asset.body}</svg>`
    )}`;
  }

  function tintFeatureSourceImage(sourceImage, asset, tint) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(asset.width * FEATURE_IMAGE_SUPERSAMPLE));
    canvas.height = Math.max(1, Math.ceil(asset.height * FEATURE_IMAGE_SUPERSAMPLE));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = tint || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    return canvas;
  }

  function flushInitialFeatureImageBatchIfReady() {
    if (!renderer.initialMapLoadingActive || !renderer.featureImageStartupBatchDirty) return;
    if (renderer.featureImageQueue.length || renderer.featureImageActiveLoads > 0) return;
    renderer.featureImageStartupBatchDirty = false;
    markRouteCacheDirty();
    markFeatureCacheDirty();
    markOverlayCacheDirty();
    queueMapRender(true);
  }

  function markFeatureImageUsageDirty(cacheKey) {
    const usage = renderer.featureImageUsage.get(cacheKey);
    if (!usage) {
      queueMapRender(true);
      return;
    }
    if (usage.terrainHexIds.size) {
      const affectedHexes = [...usage.terrainHexIds]
        .map(hexId => hexForPathPoint(hexId))
        .filter(Boolean);
      markTerrainHexesDirty(affectedHexes, 0, false);
    }
    if (usage.overlayTypes.size) {
      markOverlayCacheDirty();
      if (usage.overlayTypes.has("farmland")) markRouteCacheDirty();
    }
    queueMapRender(true);
  }

  async function loadRouteIconAssets() {
    if (renderer.routeIconAssetsLoading) return renderer.routeIconAssetsLoading;
    renderer.routeIconAssetsLoaded = false;

    renderer.routeIconAssetsLoading = Promise.all(Object.entries(ROUTE_ICON_FILES).map(async ([type, file]) => {
      try {
        const response = await fetch(`${ROUTE_ICON_ASSET_PATH}${file}`);
        if (!response.ok) return;
        renderer.routeIconAssets.set(type, parseFeatureSvg(await response.text()));
      } catch {}
    })).then(() => {
      renderer.routeIconAssetsLoaded = true;
      renderer.routeLabelCache = { key: "", labels: [] };
      renderSvgOnly();
    });

    return renderer.routeIconAssetsLoading;
  }

  async function loadPoiIconAssets() {
    if (renderer.poiIconAssetsLoading) return renderer.poiIconAssetsLoading;
    renderer.poiIconAssetsLoaded = false;

    renderer.poiIconAssetsLoading = Promise.all(POI_ICON_FILES.map(async ({ value, file }) => {
      try {
        const response = await fetch(`${POI_ICON_ASSET_PATH}${file}`);
        if (!response.ok) return;
        renderer.poiIconAssets.set(value, parseFeatureSvg(await response.text()));
      } catch {}
    })).then(() => {
      renderer.poiIconAssetsLoaded = true;
      renderSvgOnly();
    });

    return renderer.poiIconAssetsLoading;
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
      const image = getFeatureArtImage(item.file, getFeatureArtTint(hex, item), { type: "terrain", hexId: hex.id });
      if (!image) return;
      drawFeatureArtImage(ctx, image, applyFeatureArtSizeMultiplier(featureArtDrawBox(hex, index), item.featureId), getFeatureArtOpacity(hex, item, zoomOpacity));
    });
  }

  function renderFarmlandOverlayForHex(ctx, hex) {
    if (!hex?.id || (hex.features || []).includes("farmland") || !getFarmlandOverlayHexIds().has(hex.id)) return;
    const image = getFeatureArtImage(
      FEATURE_ART_FILES.farmland,
      getFeatureArtTint(hex, { featureId: "farmland", file: FEATURE_ART_FILES.farmland }),
      { type: "overlay", overlayType: "farmland", hexId: hex.id }
    );
    if (!image) return;
    drawFeatureArtImage(
      ctx,
      image,
      applyFeatureArtSizeMultiplier(featureArtDrawBox(hex, 0), "farmland"),
      getFeatureArtOpacity(hex, { featureId: "farmland", opacity: FEATURE_ART_OPACITY.farmland || 0.64 }, getFeatureArtZoomOpacity())
    );
  }

  function getFarmlandOverlayHexIds() {
    if (renderer.farmlandOverlayHexIdsCache?.revision === renderer.overlayRevision && renderer.farmlandOverlayHexIdsCache.hexIds) {
      return renderer.farmlandOverlayHexIdsCache.hexIds;
    }
    const hexIds = new Set((getOverlaysByType().farmland || []).map(overlay => overlay?.Hex_ID_Ref).filter(Boolean));
    renderer.farmlandOverlayHexIdsCache = { revision: renderer.overlayRevision, hexIds };
    return hexIds;
  }

  function drawFeatureArtImage(ctx, image, box, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
  }

  function getFeatureArtImage(file, tint, usage = null) {
    const asset = renderer.featureAssets.get(file);
    if (!asset) return null;

    const cacheKey = getFeatureImageCacheKey(file, tint);
    registerFeatureImageUsage(cacheKey, usage);
    const cached = renderer.featureImages.get(cacheKey);
    if (cached?.loaded) return cached.image;
    queueFeatureImageLoad(cacheKey, file, tint);
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
    if (renderer.riverFallsHexIdsCache.revision === renderer.overlayRevision) {
      return renderer.riverFallsHexIdsCache.hexIds;
    }
    const fallsHexIds = new Set();
    getOverlaysByType().river
      .filter(overlay => (
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
    renderer.riverFallsHexIdsCache = { revision: renderer.overlayRevision, hexIds: fallsHexIds };
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
    if (base === "snow") return pickStableWeighted(hex, "woods", [["woods_con.svg", 5], ["woods_dec.svg", 1], ["woods_dead.svg", 2]]);
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
    if (base === "snow") return pickStableWeighted(hex, "forest", [["forest_con.svg", 5], ["forest_dec.svg", 1], ["forest_dead.svg", 2]]);
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
    if (base === "wastes" && isRelief) return "#8a675b";
    if (featureId === "jungle") return base === "jungle_floor" ? "#167311" : base === "wetland" ? "#53993A" : "#519942";
    if (["wetland", "jungle_floor"].includes(base) && isVegetation) {
      return base === "jungle_floor" ? "#167311" : "#53993A";
    }
    if (featureId === "volcano") return "#2b2020";
    if (featureId === "kelp") return "#1f5a45";
    if (featureId === "reef") return "#7b5a4a";
    if (featureId === "falls") return isRiverFallsHex(hex) ? getReliefFeatureTint(hex) : "#d8eef2";
    if (file.includes("jungle_trop")) return "#155c38";
    if (file.includes("jungle_temp")) return "#244a35";
    if (file.includes("_dead")) {
      if (base === "wastes") return "#8e9294";
      if (base === "lush_grassland" || base === "wetland") return "#8a5f4f";
      if (["barrens", "bleak_barrens"].includes(base)) return "#8f6f68";
      return "#746852";
    }
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
    if (base === "wastes") return "#8a675b";
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
    if (renderer.drawing.visibleOverlays.pois) {
      renderPoiMarkers(fragment, visibleHexes);
    }
    renderCoordinateLabels(fragment, visibleHexes);
    renderRegionLabels(fragment, visibleHexes);
    if (shouldRenderRouteLabels()) {
      renderRouteLabels(fragment);
    }

    const activeHex = hexForPathPoint(renderer.hoveredHexId) || hexForPathPoint(renderer.selectedHexId);
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

  function renderCoordinateLabels(fragment, visibleHexes) {
    if (renderer.view.zoom < COORD_LABEL_MIN_ZOOM || !renderer.drawing.visibleOverlays.coords) return;
    const dimensions = getGeneratedMapDimensions();
    visibleHexes.forEach(hex => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "generated-map-coord-label");
      text.setAttribute("x", String(hex.center.x));
      text.setAttribute("y", String(hex.center.y - dimensions.hexHeight * 0.37));
      text.setAttribute("font-size", String(dimensions.radius * 0.2));
      text.textContent = hex.label;
      fragment.appendChild(text);
    });
  }

  function renderDrawableOverlays(fragment, visibleHexes) {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    const wallDecorations = document.createDocumentFragment();
    const wallsBySegment = new Map();

    getOverlaysByType().wall.filter(overlay => renderer.drawing.visibleOverlays.wall && visibleIds.has(overlay.Hex_ID_Ref)).forEach(overlay => {
      const hex = hexForPathPoint(overlay.Hex_ID_Ref);
      if (!hex) return;

      const edgeIndex = EDGE_NAMES.indexOf(overlay.Edge);
      if (edgeIndex < 0) return;

      const edge = { a: hex.points[edgeIndex], b: hex.points[(edgeIndex + 1) % hex.points.length] };
      const segmentKey = edgeKey(edge.a, edge.b);
      const existing = wallsBySegment.get(segmentKey);
      if (!existing || shouldPreferWallRenderOverlay(overlay, existing.overlay)) {
        wallsBySegment.set(segmentKey, { overlay, edge });
      }
    });
    wallsBySegment.forEach(({ overlay, edge }) => {
      renderWallOverlay(fragment, wallDecorations, overlay, edge);
    });
    fragment.appendChild(wallDecorations);
  }

  function shouldPreferWallRenderOverlay(nextOverlay, currentOverlay) {
    const nextVariant = getWallVariant(nextOverlay?.Style);
    const currentVariant = getWallVariant(currentOverlay?.Style);
    if (nextVariant && !currentVariant) return true;
    if (!nextVariant && currentVariant) return false;
    return String(nextOverlay?.Updated_At || nextOverlay?.updated_at || "") > String(currentOverlay?.Updated_At || currentOverlay?.updated_at || "");
  }

  function renderWallOverlay(fragment, decorationFragment, overlay, edge) {
    const baseStyle = getWallBaseStyle(overlay?.Style);
    const variant = getRenderedWallVariant(overlay, edge);
    const segments = variant ? splitWallEdgeForVariant(edge) : [edge];
    if (baseStyle === "palisade") {
      segments.forEach(segment => renderPalisadeWallOverlay(fragment, segment));
      if (variant) renderWallVariantDecoration(decorationFragment, edge, baseStyle, variant);
      return;
    }
    segments.forEach(segment => {
      getWallRenderLayers(overlay).forEach(layer => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", `generated-map-drawn-wall generated-map-drawn-wall-${layer}`);
        path.setAttribute("d", pathCommand(segment.a, segment.b));
        fragment.appendChild(path);
      });
    });
    if (variant) renderWallVariantDecoration(decorationFragment, edge, baseStyle, variant);
  }

  function renderPalisadeWallOverlay(fragment, edge) {
    ["palisade-shadow", "palisade-rail"].forEach(layer => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", `generated-map-drawn-wall generated-map-drawn-wall-${layer}`);
      path.setAttribute("d", pathCommand(edge.a, edge.b));
      fragment.appendChild(path);
    });

    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    const stakeLength = 5;
    const stakeCount = 4;
    const commands = [];
    for (let index = 1; index <= stakeCount; index += 1) {
      const t = index / (stakeCount + 1);
      const center = {
        x: edge.a.x + dx * t,
        y: edge.a.y + dy * t
      };
      const from = {
        x: center.x - normal.x * stakeLength * 0.5,
        y: center.y - normal.y * stakeLength * 0.5
      };
      const to = {
        x: center.x + normal.x * stakeLength * 0.5,
        y: center.y + normal.y * stakeLength * 0.5
      };
      commands.push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`);
    }
    const stakes = document.createElementNS("http://www.w3.org/2000/svg", "path");
    stakes.setAttribute("class", "generated-map-drawn-wall generated-map-drawn-wall-palisade-stakes");
    stakes.setAttribute("d", commands.join(" "));
    fragment.appendChild(stakes);
  }

  function getWallRenderLayers(overlay) {
    return getWallBaseStyle(overlay?.Style) === "palisade"
      ? ["palisade-shadow", "palisade-rail", "palisade-stakes"]
      : ["base", "body", "crenellations"];
  }

  function splitWallEdgeForVariant(edge) {
    const gap = 0.18;
    return [
      {
        a: edge.a,
        b: {
          x: edge.a.x + (edge.b.x - edge.a.x) * (0.5 - gap),
          y: edge.a.y + (edge.b.y - edge.a.y) * (0.5 - gap)
        }
      },
      {
        a: {
          x: edge.a.x + (edge.b.x - edge.a.x) * (0.5 + gap),
          y: edge.a.y + (edge.b.y - edge.a.y) * (0.5 + gap)
        },
        b: edge.b
      }
    ];
  }

  function renderWallVariantDecoration(fragment, edge, baseStyle, variant) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const length = Math.hypot(dx, dy) || 1;
    const along = { x: dx / length, y: dy / length };
    const normal = { x: -along.y, y: along.x };
    const center = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };
    const radius = getGeneratedMapDimensions().radius;
    const isPalisade = baseStyle === "palisade";
    const decoration = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const normalized = variant === "gatehouse" || variant === "gate" ? "gate" : variant === "sluice" || variant === "water_gate" ? "sluice" : "broken";
    const commands = [];

    if (normalized === "gate") {
      [-1, 1].forEach(side => {
        const post = {
          x: center.x + along.x * radius * 0.18 * side,
          y: center.y + along.y * radius * 0.18 * side
        };
        commands.push(pathCommand(
          { x: post.x - normal.x * radius * 0.24, y: post.y - normal.y * radius * 0.24 },
          { x: post.x + normal.x * radius * 0.24, y: post.y + normal.y * radius * 0.24 }
        ));
      });
      commands.push(pathCommand(
        { x: center.x - along.x * radius * 0.20 - normal.x * radius * 0.18, y: center.y - along.y * radius * 0.20 - normal.y * radius * 0.18 },
        { x: center.x + along.x * radius * 0.20 - normal.x * radius * 0.18, y: center.y + along.y * radius * 0.20 - normal.y * radius * 0.18 }
      ));
    } else if (normalized === "sluice") {
      [-0.22, 0, 0.22].forEach(offset => {
        const rib = {
          x: center.x + along.x * radius * offset,
          y: center.y + along.y * radius * offset
        };
        commands.push(pathCommand(
          { x: rib.x - normal.x * radius * 0.22, y: rib.y - normal.y * radius * 0.22 },
          { x: rib.x + normal.x * radius * 0.22, y: rib.y + normal.y * radius * 0.22 }
        ));
      });
    } else {
      [-0.12, 0.12].forEach(offset => {
        const chip = {
          x: center.x + along.x * radius * offset,
          y: center.y + along.y * radius * offset
        };
        commands.push(pathCommand(
          { x: chip.x - along.x * radius * 0.07 - normal.x * radius * 0.10, y: chip.y - along.y * radius * 0.07 - normal.y * radius * 0.10 },
          { x: chip.x + along.x * radius * 0.07 + normal.x * radius * 0.10, y: chip.y + along.y * radius * 0.07 + normal.y * radius * 0.10 }
        ));
      });
    }

    decoration.setAttribute("class", `generated-map-drawn-wall generated-map-wall-variant generated-map-wall-variant-${isPalisade ? "palisade" : "stone"} generated-map-wall-variant-${normalized}`);
    decoration.setAttribute("d", commands.join(" "));
    fragment.appendChild(decoration);
  }

  function getRenderedWallVariant(overlay, edge) {
    return getWallVariant(overlay?.Style);
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

    if (["mist", "farmland"].includes(renderer.drawing.tool) && (
      renderer.drawing.hoverMistHexIds?.length ||
      hasHexStyleBrushPreview(renderer.drawing.tool)
    )) {
      renderMistBrushPreview(fragment, visibleHexes, renderer.drawing.tool);
    }

    if ((renderer.drawing.tool === "terrain" || renderer.drawing.tool === "terrain-eyedropper" || renderer.drawing.tool === "feature" || renderer.drawing.tool === "feature-erase" || renderer.drawing.tool === "feature-eyedropper" || REGION_PAINT_TYPES.has(renderer.drawing.tool)) && renderer.drawing.hoverBrushHexIds?.length) {
      renderEditorBrushPreview(fragment, visibleHexes);
    }

    if (renderer.drawing.tool === "wall" && (renderer.drawing.hoverEdge || renderer.drawing.wallPlaneDrag?.previewEdges?.length)) {
      const wallPreviewEdges = renderer.drawing.wallPlaneDrag?.previewEdges?.length
        ? renderer.drawing.wallPlaneDrag.previewEdges
        : getWallPreviewEdges(renderer.drawing.hoverEdge);
      renderWallBrushCursor(fragment, renderer.drawing.wallPlaneDrag?.cursorPoint || renderer.drawing.hoverEdge?.point);
      wallPreviewEdges.forEach(edgeRef => {
        const segment = getWallEdgeSegment(edgeRef);
        if (!segment) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "generated-map-drawing-edge-preview");
        path.setAttribute("d", pathCommand(segment.a, segment.b));
        fragment.appendChild(path);
      });
    } else if (PATH_OVERLAY_TYPES.has(renderer.drawing.tool) && renderer.drawing.hoverEdge) {
      const hex = hexForPathPoint(renderer.drawing.hoverEdge.hexId);
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

  function renderWallBrushCursor(fragment, point) {
    if (!point) return;
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "generated-map-wall-brush-cursor");
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
    dot.setAttribute("r", "4");
    fragment.appendChild(dot);
  }

  function renderPoiMarkers(fragment, visibleHexes) {
    const dimensions = getGeneratedMapDimensions();
    const markerDiameter = Math.min(70, Math.max(56, (dimensions.radius * 2) - 6));
    const markerRadius = markerDiameter / 2;
    const baseIconSize = Math.min(markerDiameter - 12, 54);
    const badgeRadius = Math.max(10, Math.round(markerRadius * 0.34));

    visibleHexes.forEach(hex => {
      const pois = renderer.poisByHexId.get(hex.id) || renderer.poisByHexId.get(hex.label);
      if (!pois?.length) return;

      const markerPoi = getPrimaryPoiMarkerRecord(pois);
      const markerProfile = getPoiMarkerShapeProfile(markerPoi, markerRadius, baseIconSize);
      const markerX = hex.center.x;
      const markerY = hex.center.y;
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const clipId = `generated-map-poi-clip-${String(hex.id || hex.label || "hex").replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
      const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      const iconGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const backgroundNode = createPoiMarkerBackgroundNode(markerProfile, markerX, markerY);
      const clipNode = createPoiMarkerBackgroundNode(markerProfile, markerX, markerY);

      group.setAttribute("class", `generated-map-poi-marker generated-map-poi-marker-${markerProfile.classKey}`);
      clipPath.setAttribute("id", clipId);
      clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
      clipPath.appendChild(clipNode);
      defs.appendChild(clipPath);
      iconGroup.setAttribute("clip-path", `url(#${clipId})`);
      iconGroup.appendChild(createPoiMarkerSymbolNode(markerPoi, markerX, markerY, markerProfile.iconSize));

      group.appendChild(defs);
      group.appendChild(backgroundNode);
      group.appendChild(iconGroup);
      if (pois.length > 1) {
        group.appendChild(createPoiMarkerCountNode(pois.length, markerX, markerY, markerRadius, badgeRadius));
      }
      fragment.appendChild(group);
    });
  }

  function getPrimaryPoiMarkerRecord(pois) {
    return [...(pois || [])].sort((left, right) => {
      const primaryDelta = getPoiMarkerPrimaryDisplayRank(left) - getPoiMarkerPrimaryDisplayRank(right);
      if (primaryDelta !== 0) return primaryDelta;
      const notorietyDelta = getPoiMarkerNotorietyRank(left) - getPoiMarkerNotorietyRank(right);
      if (notorietyDelta !== 0) return notorietyDelta;
      return String(left?.Name || left?.POI_ID || "")
        .localeCompare(String(right?.Name || right?.POI_ID || ""), undefined, { sensitivity: "base" });
    })[0] || null;
  }

  function getPoiMarkerNotorietyRank(poi) {
    const rawValue = String(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"] || "");
    const matchedValue = rawValue.match(/\d+/)?.[0] || "";
    const rank = Number.parseInt(matchedValue, 10);
    return Number.isFinite(rank) && rank > 0 ? rank : 99;
  }

  function getPoiMarkerIconValue(poi) {
    return window.CampaignPoiIcons?.getDisplayIconValue?.(poi?.POI_Icon || poi?.poi_icon || "") || POI_ICON_FALLBACK;
  }

  function getPoiMarkerAsset(poi) {
    const iconValue = getPoiMarkerIconValue(poi);
    return renderer.poiIconAssets.get(iconValue)
      || renderer.poiIconAssets.get(POI_ICON_FALLBACK)
      || null;
  }

  function getPoiMarkerTypeValue(poi) {
    return window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || poi?.type || "")
      || String(poi?.POI_Type_Value || poi?.POI_Type || poi?.type || "").trim().toLowerCase();
  }

  function getPoiMarkerPrimaryDisplayRank(poi) {
    const type = getPoiMarkerTypeValue(poi);
    if (type === "settlement") return 0;
    if (type === "stronghold") return 1;
    if (["ruin", "holy_site", "arcane_site", "wilderness_site", "hazard", "landmark"].includes(type)) return 2;
    if (type === "resource_site") return 3;
    if (type === "waypoint") return 4;
    if (type === "dungeon_complex") return 6;
    if (type === "dungeon") return 7;

    const family = window.CampaignPoiIcons?.getIconFamily?.(poi?.POI_Icon || poi?.poi_icon || "") || "";
    if (family === "settlement") return 0;
    if (family === "stronghold") return 1;
    if (family === "resource_site") return 3;
    if (family === "waypoint") return 4;
    if (family === "dungeon") return 7;
    return 5;
  }

  function getPoiMarkerShapeKind(poi) {
    const type = getPoiMarkerTypeValue(poi);
    if (type === "settlement") return "settlement";
    if (type === "stronghold") return "stronghold";
    if (type === "resource_site") return "resource";
    if (type === "waypoint") return "waypoint";
    if (type === "dungeon_complex") return "dungeon_complex";
    if (type === "dungeon") return "dungeon";

    const family = window.CampaignPoiIcons?.getIconFamily?.(poi?.POI_Icon || poi?.poi_icon || "") || "";
    if (family === "settlement") return "settlement";
    if (family === "stronghold") return "stronghold";
    if (family === "resource_site") return "resource";
    if (family === "waypoint") return "waypoint";
    if (family === "dungeon") return "dungeon";
    return "site";
  }

  function getPoiMarkerShapeProfile(poi, markerRadius, baseIconSize) {
    const kind = getPoiMarkerShapeKind(poi);
    switch (kind) {
      case "settlement":
        return {
          kind,
          classKey: "settlement",
          iconSize: Math.max(24, Math.round(baseIconSize)),
          radius: markerRadius
        };
      case "waypoint":
        return {
          kind,
          classKey: "waypoint",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.8)),
          radius: markerRadius * 0.84
        };
      case "resource":
        return {
          kind,
          classKey: "resource",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.72)),
          size: markerRadius * 1.4,
          cornerRadius: markerRadius * 0.24
        };
      case "stronghold":
        return {
          kind,
          classKey: "stronghold",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.72)),
          radius: markerRadius * 0.96,
          cornerRadius: markerRadius * 0.18
        };
      case "dungeon_complex":
        return {
          kind,
          classKey: "dungeon-complex",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.78)),
          outerRadius: markerRadius * 0.98,
          innerRadius: markerRadius * 0.82
        };
      case "dungeon":
        return {
          kind,
          classKey: "dungeon",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.72)),
          widthRadius: markerRadius * 0.86,
          heightRadius: markerRadius * 0.92,
          faceBulge: 0.16
        };
      default:
        return {
          kind: "site",
          classKey: "site",
          iconSize: Math.max(24, Math.round(baseIconSize * 0.72)),
          widthRadius: markerRadius * 0.88,
          heightRadius: markerRadius * 0.8,
          shoulderInset: markerRadius * 0.38,
          sideShoulder: markerRadius * 0.34,
          notchInset: markerRadius * 0.2,
          notchDepth: markerRadius * 0.18,
          cornerRadius: markerRadius * 0.18
        };
    }
  }

  function createPoiMarkerBackgroundNode(profile, centerX, centerY) {
    const className = `generated-map-poi-bg generated-map-poi-bg-${profile.classKey}`;
    if (profile.kind === "settlement" || profile.kind === "waypoint") {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", className);
      circle.setAttribute("cx", String(centerX));
      circle.setAttribute("cy", String(centerY));
      circle.setAttribute("r", String(profile.radius));
      return circle;
    }

    if (profile.kind === "resource") {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", className);
      rect.setAttribute("x", String(centerX - (profile.size / 2)));
      rect.setAttribute("y", String(centerY - (profile.size / 2)));
      rect.setAttribute("width", String(profile.size));
      rect.setAttribute("height", String(profile.size));
      rect.setAttribute("rx", String(profile.cornerRadius));
      rect.setAttribute("ry", String(profile.cornerRadius));
      return rect;
    }

    if (profile.kind === "stronghold") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const vertices = buildRegularPolygonVertices(centerX, centerY, 6, profile.radius, 0);
      path.setAttribute("class", className);
      path.setAttribute("d", buildRoundedPolygonPath(vertices, profile.cornerRadius));
      return path;
    }

    if (profile.kind === "site") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const vertices = buildNotchedHexagonVertices(
        centerX,
        centerY,
        profile.widthRadius,
        profile.heightRadius,
        profile.shoulderInset,
        profile.sideShoulder,
        profile.notchInset,
        profile.notchDepth
      );
      path.setAttribute("class", className);
      path.setAttribute("d", buildRoundedPolygonPath(vertices, profile.cornerRadius));
      return path;
    }

    if (profile.kind === "dungeon") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", className);
      path.setAttribute("d", buildPointedCurvedDiamondPath(centerX, centerY, profile.widthRadius, profile.heightRadius, profile.faceBulge));
      return path;
    }

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("class", className);
    polygon.setAttribute("points", buildStarPolygonPoints(centerX, centerY, 8, profile.outerRadius, profile.innerRadius, -Math.PI / 2));
    return polygon;
  }

  function buildRegularPolygonVertices(centerX, centerY, sides, radius, rotation = 0) {
    return Array.from({ length: Math.max(3, sides) }, (_, index) => {
      const angle = rotation + (Math.PI * 2 * index / sides);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });
  }

  function buildNotchedHexagonVertices(centerX, centerY, widthRadius, heightRadius, shoulderInset, sideShoulder, notchInset, notchDepth) {
    const width = Math.max(8, Number(widthRadius) || 0);
    const height = Math.max(8, Number(heightRadius) || 0);
    const shoulder = Math.max(3, Math.min(width * 0.76, Number(shoulderInset) || width * 0.38));
    const side = Math.max(3, Math.min(height * 0.82, Number(sideShoulder) || height * 0.34));
    const inset = Math.max(2, Math.min(width * 0.34, Number(notchInset) || width * 0.2));
    const depth = Math.max(2, Math.min(height * 0.34, Number(notchDepth) || height * 0.18));
    const topNotchHalf = Math.max(3, shoulder * 0.18);
    return [
      { x: centerX - shoulder, y: centerY - height },
      { x: centerX - topNotchHalf, y: centerY - height },
      { x: centerX, y: centerY - height + depth },
      { x: centerX + topNotchHalf, y: centerY - height },
      { x: centerX + shoulder, y: centerY - height },
      { x: centerX + width, y: centerY - side },
      { x: centerX + width - inset, y: centerY },
      { x: centerX + width, y: centerY + side },
      { x: centerX + shoulder, y: centerY + height },
      { x: centerX + topNotchHalf, y: centerY + height },
      { x: centerX, y: centerY + height - depth },
      { x: centerX - topNotchHalf, y: centerY + height },
      { x: centerX - shoulder, y: centerY + height },
      { x: centerX - width, y: centerY + side },
      { x: centerX - width + inset, y: centerY },
      { x: centerX - width, y: centerY - side }
    ];
  }

  function buildPointedCurvedDiamondPath(centerX, centerY, widthRadius, heightRadius, faceBulge = 0.16) {
    const width = Math.max(8, Number(widthRadius) || 0);
    const height = Math.max(8, Number(heightRadius) || 0);
    const bulge = Math.max(0, Math.min(0.32, Number(faceBulge) || 0.16));
    const top = `${centerX} ${centerY - height}`;
    const right = `${centerX + width} ${centerY}`;
    const bottom = `${centerX} ${centerY + height}`;
    const left = `${centerX - width} ${centerY}`;
    const topRightControl = `${centerX + width * (0.5 + bulge)} ${centerY - height * (0.5 + bulge)}`;
    const bottomRightControl = `${centerX + width * (0.5 + bulge)} ${centerY + height * (0.5 + bulge)}`;
    const bottomLeftControl = `${centerX - width * (0.5 + bulge)} ${centerY + height * (0.5 + bulge)}`;
    const topLeftControl = `${centerX - width * (0.5 + bulge)} ${centerY - height * (0.5 + bulge)}`;
    return `M ${top} Q ${topRightControl} ${right} Q ${bottomRightControl} ${bottom} Q ${bottomLeftControl} ${left} Q ${topLeftControl} ${top} Z`;
  }

  function buildRoundedPolygonPath(points, cornerRadius = 0) {
    if (!Array.isArray(points) || points.length < 3) return "";
    if (!(cornerRadius > 0)) {
      return `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")} Z`;
    }

    const rounded = points.map((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const previousLength = Math.hypot(previous.x - point.x, previous.y - point.y);
      const nextLength = Math.hypot(next.x - point.x, next.y - point.y);
      const previousUnit = {
        x: (previous.x - point.x) / Math.max(previousLength, 0.001),
        y: (previous.y - point.y) / Math.max(previousLength, 0.001)
      };
      const nextUnit = {
        x: (next.x - point.x) / Math.max(nextLength, 0.001),
        y: (next.y - point.y) / Math.max(nextLength, 0.001)
      };
      const angleCosine = Math.max(-1, Math.min(1, (previousUnit.x * nextUnit.x) + (previousUnit.y * nextUnit.y)));
      const angle = Math.acos(angleCosine);
      const maxOffset = Math.max(0, Math.min(previousLength, nextLength) / 2 - 0.01);
      const offset = Math.min(cornerRadius / Math.max(Math.tan(angle / 2), 0.001), maxOffset);
      return {
        start: {
          x: point.x + previousUnit.x * offset,
          y: point.y + previousUnit.y * offset
        },
        corner: point,
        end: {
          x: point.x + nextUnit.x * offset,
          y: point.y + nextUnit.y * offset
        }
      };
    });

    return rounded.map((entry, index) => {
      if (index === 0) {
        return `M ${entry.end.x} ${entry.end.y}`;
      }
      return `L ${entry.start.x} ${entry.start.y} Q ${entry.corner.x} ${entry.corner.y} ${entry.end.x} ${entry.end.y}`;
    }).join(" ")
      + ` L ${rounded[0].start.x} ${rounded[0].start.y} Q ${rounded[0].corner.x} ${rounded[0].corner.y} ${rounded[0].end.x} ${rounded[0].end.y} Z`;
  }

  function buildStarPolygonPoints(centerX, centerY, points, outerRadius, innerRadius, rotation = 0) {
    const totalPoints = Math.max(4, points) * 2;
    return Array.from({ length: totalPoints }, (_, index) => {
      const angle = rotation + (Math.PI * index / points);
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      return `${x},${y}`;
    }).join(" ");
  }

  function createPoiMarkerSymbolNode(poi, centerX, centerY, iconSize = 24) {
    const asset = getPoiMarkerAsset(poi);
    if (asset) {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "generated-map-poi-icon");
      icon.setAttribute("viewBox", asset.viewBox);
      icon.setAttribute("x", String(centerX - (iconSize / 2)));
      icon.setAttribute("y", String(centerY - (iconSize / 2)));
      icon.setAttribute("width", String(iconSize));
      icon.setAttribute("height", String(iconSize));
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = asset.body;
      return icon;
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "generated-map-poi-symbol");
    text.setAttribute("x", centerX);
    text.setAttribute("y", centerY + 1);
    text.setAttribute("font-size", String(Math.max(18, iconSize - 4)));
    text.textContent = getPoiGlyph(poi);
    return text;
  }

  function createPoiMarkerCountNode(count, centerX, centerY, markerRadius = 17, badgeRadius = 8) {
    const badge = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const badgeX = centerX + markerRadius - badgeRadius + 1;
    const badgeY = centerY - markerRadius + badgeRadius - 1;

    badge.setAttribute("class", "generated-map-poi-count-badge");
    badgeCircle.setAttribute("class", "generated-map-poi-count-bg");
    badgeCircle.setAttribute("cx", String(badgeX));
    badgeCircle.setAttribute("cy", String(badgeY));
    badgeCircle.setAttribute("r", String(badgeRadius));

    badgeText.setAttribute("class", "generated-map-poi-count");
    badgeText.setAttribute("x", String(badgeX));
    badgeText.setAttribute("y", String(badgeY + 0.5));
    badgeText.setAttribute("font-size", String(Math.max(10, badgeRadius + 3)));
    badgeText.textContent = String(Math.min(count, 9));

    badge.appendChild(badgeCircle);
    badge.appendChild(badgeText);
    return badge;
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

  function renderMistBrushPreview(fragment, visibleHexes, overlayType = "mist") {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    const previewIds = new Set([
      ...(renderer.drawing.hoverMistHexIds || []),
      ...getHexStyleBrushPreviewHexIds(overlayType)
    ]);
    [...previewIds]
      .map(hexId => hexForPathPoint(hexId))
      .filter(hex => hex && visibleIds.has(hex.id))
      .forEach(hex => {
        const previewNode = createHexStyleBrushPreviewNode(hex, overlayType);
        if (previewNode) {
          fragment.appendChild(previewNode);
          return;
        }
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("class", "generated-map-mist-brush-preview");
        polygon.setAttribute("points", hex.points.map(point => `${point.x},${point.y}`).join(" "));
        fragment.appendChild(polygon);
      });
  }

  function createHexStyleBrushPreviewNode(hex, overlayType = "mist") {
    if (!hex || !shouldRenderFeatureArt()) return null;
    const file = overlayType === "farmland" ? FEATURE_ART_FILES.farmland : FEATURE_ART_FILES.mist;
    const asset = renderer.featureAssets.get(file);
    if (!asset) return null;

    const color = overlayType === "farmland"
      ? getFeatureArtTint(hex, { featureId: "farmland", file })
      : "#f0f0e8";
    const opacity = overlayType === "farmland"
      ? getFeatureArtOpacity(hex, { featureId: "farmland", opacity: FEATURE_ART_OPACITY.farmland || 0.64 }, getFeatureArtZoomOpacity())
      : FEATURE_ART_OPACITY.mist || 0.24;
    const box = applyFeatureArtSizeMultiplier(featureArtDrawBox(hex, 0), overlayType);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", `generated-map-${overlayType}-brush-art-preview`);
    icon.setAttribute("viewBox", asset.viewBox);
    icon.setAttribute("x", String(box.x));
    icon.setAttribute("y", String(box.y));
    icon.setAttribute("width", String(box.width));
    icon.setAttribute("height", String(box.height));
    icon.setAttribute("opacity", String(opacity));
    icon.setAttribute("aria-hidden", "true");
    icon.style.color = color;
    icon.innerHTML = asset.body;
    return icon;
  }

  function renderEditorBrushPreview(fragment, visibleHexes) {
    const visibleIds = new Set(visibleHexes.map(hex => hex.id));
    const previewClass = REGION_PAINT_TYPES.has(renderer.drawing.tool)
      ? "generated-map-editor-brush-preview generated-map-region-brush-preview"
      : renderer.drawing.tool === "feature"
      ? "generated-map-editor-brush-preview generated-map-feature-brush-preview"
      : "generated-map-editor-brush-preview generated-map-terrain-brush-preview";
    renderer.drawing.hoverBrushHexIds
      .map(hexId => hexForPathPoint(hexId))
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
    return [
      visible.road ? 1 : 0,
      visible.river ? 1 : 0,
      visible.sea_route ? 1 : 0,
      renderer.overlayRevision
    ].join("::");
  }

  function buildRouteLabelEntries() {
    const overlaysByType = getOverlaysByType();
    const labelPaths = [];

    if (renderer.drawing.visibleOverlays.road) {
      connectedPathStrings(overlaysByType.road.filter(overlay => overlay.Is_Major_Route && overlay.Route_Name), "road").forEach(pathData => {
        labelPaths.push({ ...pathData, type: "road" });
      });
    }

    if (renderer.drawing.visibleOverlays.river) {
      getCanvasRiverPathStrings(overlaysByType.river.filter(overlay => overlay.Is_Major_Route && overlay.Route_Name)).forEach(pathData => {
        labelPaths.push({ ...pathData, type: "river" });
      });
    }

    if (renderer.drawing.visibleOverlays.sea_route) {
      connectedPathStrings(overlaysByType.sea_route.filter(overlay => overlay.Route_Name), "sea_route").forEach(pathData => {
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
    const image = getFeatureArtImage(FEATURE_ART_FILES.mist, "#f0f0e8", { type: "overlay", overlayType: "mist" });
    if (!image) return;

    getOverlaysByType().mist
      .filter(overlay => overlay.Hex_ID_Ref)
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

      if (overlay.Overlay_Type === "mist" || overlay.Overlay_Type === "farmland") {
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
      .map(hexId => (hexForPathPoint(hexId) || renderer.hexes.find(hex => hex.label === hexId))?.center)
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
    return renderer.hexesById.get(hexId)?.center || null;
  }

  function hexForPathPoint(hexId) {
    return renderer.hexesById.get(hexId) || null;
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
    const from = hexForPathPoint(segment.From_Hex_ID_Ref);
    const to = hexForPathPoint(segment.To_Hex_ID_Ref);
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
    return ["inland_water", "coastal_water", "wetland"].includes(hex?.baseTerrain);
  }

  function canRoadCrossWaterHex(hex) {
    return ["inland_water", "coastal_water"].includes(hex?.baseTerrain);
  }

  function canRoadUseOneHexWaterCrossing(fromHex, waterHex, goalHex) {
    if (!fromHex || !waterHex || isWaterHex(fromHex) || !canRoadCrossWaterHex(waterHex)) return false;
    return EDGE_NAMES.some(edgeName => {
      const exitHex = getNeighborHex(waterHex, edgeName);
      if (!exitHex || exitHex.id === fromHex.id || isWaterHex(exitHex)) return false;
      if (getElevationDelta(fromHex, exitHex) > ROAD_WATER_CROSSING_MAX_ELEVATION_DELTA) return false;
      return exitHex.id === goalHex?.id || !ROAD_IMPASSABLE_WATER_TERRAINS.has(exitHex.baseTerrain);
    });
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
    if (!middleHexes.every(hex => isWaterHex(hex) || isSeaRouteIslandAnchor(hex))) return { sequence: [], exitEdge: "" };
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
    if (tool === "wall") return getCurrentWallStyle();
    if (tool === "river") {
      const autoFallsDisabled = getCurrentRouteMajor("river") || renderer.drawing.autoFalls === false;
      return composeOverlayStyle("river", autoFallsDisabled
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

  function getValidWallStyle(style) {
    return getWallBaseStyle(style);
  }

  function getValidWallVariant(variant) {
    return ["auto", "broken", "gate", "sluice"].includes(variant) ? variant : "auto";
  }

  function getCurrentWallStyle() {
    const mode = getValidWallMode(renderer.drawing.wallMode);
    return composeWallStyle(renderer.drawing.wallStyle, mode === "regular" ? renderer.drawing.wallVariant : "auto");
  }

  function composeWallStyle(style, variant) {
    const base = getWallBaseStyle(style);
    const normalizedVariant = getValidWallVariant(variant);
    if (normalizedVariant === "auto") return base;
    if (normalizedVariant === "broken") return `${base}:broken`;
    if (normalizedVariant === "gate") return base === "palisade" ? "palisade:gate" : "wall:gatehouse";
    if (normalizedVariant === "sluice") return base === "palisade" ? "palisade:water_gate" : "wall:sluice";
    return base;
  }

  function getWallBaseStyle(style) {
    const base = String(style || "").split(":")[0];
    return WALL_BASE_STYLES.has(base) ? base : "wall";
  }

  function getWallVariant(style) {
    const variant = String(style || "").split(":")[1] || "";
    return WALL_VARIANTS.has(variant) ? variant : "";
  }

  function getValidWallMode(mode) {
    return ["regular", "plane", "shape"].includes(mode) ? mode : "regular";
  }

  function getValidWallShape(shape) {
    return ["round_keep", "long_keep", "square_keep"].includes(shape) ? shape : "round_keep";
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
        routeName: routeMetadata.routeName || ""
      };
    }
    return routeMetadata;
  }

  function getRouteMetadataForOverlayRoute(route, tool, fallbackRouteMetadata = {}) {
    if (route && !Array.isArray(route) && route.routeMetadata) return route.routeMetadata;
    return fallbackRouteMetadata || getCurrentRouteMetadata(tool);
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
      const style = type === "river"
        ? segment.Style || "river"
        : segment.Style || "dark_brown";
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

  function getMistBrushHexIds(centerHex, tool = "mist") {
    if (!centerHex) return [];
    const radius = Math.max(0, (renderer.drawing.mistBrushSize || 1) - 1);
    const noise = Math.max(0, Math.min(90, renderer.drawing.mistNoise || 0)) / 100;
    const hexIds = getHexesInRange(centerHex, radius)
      .filter(hex => {
        if (hex.id === centerHex.id || noise <= 0) return true;
        const roll = seededPathFloat(`${tool}:${centerHex.id}:${hex.id}:${renderer.drawing.mistBrushSize}:${renderer.drawing.mistNoise}`);
        return roll >= noise;
      })
      .map(hex => hex.id);
    return tool === "farmland" ? filterFarmlandBrushHexIds(hexIds) : hexIds;
  }

  function filterFarmlandBrushHexIds(hexIds = []) {
    return [...new Set(hexIds || [])]
      .map(hexId => renderer.hexesById.get(hexId))
      .filter(isEligibleFarmlandHex)
      .map(hex => hex.id);
  }

  function getHexStyleBrushPreviewState(overlayType) {
    return renderer.drawing.hexStyleBrushPreview?.[overlayType] || null;
  }

  function getHexStyleBrushPreviewHexIds(overlayType) {
    const state = getHexStyleBrushPreviewState(overlayType);
    if (!state) return [];
    return [...new Set([...(state.pending || []), ...(state.inflight || [])])];
  }

  function hasHexStyleBrushPreview(overlayType) {
    return getHexStyleBrushPreviewHexIds(overlayType).length > 0;
  }

  function clearHexStyleBrushPreview(overlayType = "") {
    const overlayTypes = overlayType ? [overlayType] : ["mist", "farmland"];
    overlayTypes.forEach(type => {
      const state = getHexStyleBrushPreviewState(type);
      if (!state) return;
      state.pending.clear();
      state.inflight.clear();
    });
  }

  function queueHexStyleBrushPreview(overlayType, hexIds = []) {
    const state = getHexStyleBrushPreviewState(overlayType);
    if (!state) return [];
    const existingHexIds = new Set((renderer.mapOverlays || [])
      .filter(overlay => overlay.Overlay_Type === overlayType)
      .map(overlay => overlay.Hex_ID_Ref)
      .filter(Boolean));
    const added = [];
    [...new Set(hexIds || [])].forEach(hexId => {
      if (!hexId || existingHexIds.has(hexId) || state.pending.has(hexId) || state.inflight.has(hexId)) return;
      state.pending.add(hexId);
      added.push(hexId);
    });
    return added;
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

  function getOverlayTouchedHexIds(overlays) {
    const ids = new Set();
    overlays.forEach(overlay => {
      [overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref, overlay.Hex_ID_Ref].forEach(hexId => {
        if (hexId) ids.add(hexId);
      });
    });
    return ids;
  }

  function pointDistanceToSegment(point, a, b) {
    const projection = projectPointToSegment(point, a, b);
    return Math.hypot(point.x - projection.point.x, point.y - projection.point.y);
  }

  function lineSegmentIntersectionPoint(a, b, c, d, options = {}) {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 0.001) return null;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
    const roadPadding = options.roadPadding ?? 0.02;
    const riverPadding = options.riverPadding ?? 0.02;
    if (t < roadPadding || t > 1 - roadPadding || u < -riverPadding || u > 1 + riverPadding) return null;
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y)
    };
  }

  function projectPointToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    return {
      t,
      point: {
        x: a.x + t * dx,
        y: a.y + t * dy
      }
    };
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

  function renderMajorRiverMountainCulverts(ctx, segments) {
    const radius = getGeneratedMapDimensions().radius;
    const targetHexes = new Map();
    const majorSegments = segments.filter(segment => segment.Is_Major_Route && segment.To_Hex_ID_Ref);
    majorSegments.forEach(segment => {
      [segment.From_Hex_ID_Ref, segment.To_Hex_ID_Ref].forEach(hexId => {
        const hex = hexForPathPoint(hexId);
        if (isMajorRiverCulvertHex(hex)) targetHexes.set(hex.id, hex);
      });
    });
    if (!targetHexes.size) return;

    const pathSegments = connectedPathStrings(majorSegments, "river")
      .flatMap(pathData => flattenSvgPathToLineSegments(pathData.d, 10));
    if (!pathSegments.length) return;

    targetHexes.forEach(hex => {
      const projection = getClosestPathProjection(hex.center, pathSegments);
      if (!projection || projection.distance > radius * 1.08) return;
      drawMajorRiverCulvertMarker(ctx, projection.point, projection.segment.a, projection.segment.b, radius);
    });
  }

  function isMajorRiverCulvertHex(hex) {
    return Boolean(hex && (hex.features || []).some(feature => MAJOR_RIVER_CULVERT_FEATURES.has(feature)));
  }

  function getClosestPathProjection(point, pathSegments) {
    return pathSegments.reduce((best, segment) => {
      const projection = projectPointToSegment(point, segment.a, segment.b);
      const distance = Math.hypot(point.x - projection.point.x, point.y - projection.point.y);
      return !best || distance < best.distance
        ? { ...projection, distance, segment }
        : best;
    }, null);
  }

  function flattenSvgPathToLineSegments(pathData, curveSteps = 8) {
    const commands = parseSvgPathCommands(pathData);
    const segments = [];
    let current = null;

    commands.forEach(command => {
      if (command.type === "M") {
        current = { x: command.x, y: command.y };
        return;
      }

      if (command.type === "L" && current) {
        const next = { x: command.x, y: command.y };
        segments.push({ a: current, b: next });
        current = next;
        return;
      }

      if (command.type === "Q" && current) {
        let previous = current;
        for (let step = 1; step <= curveSteps; step += 1) {
          const t = step / curveSteps;
          const next = quadraticPoint(current, { x: command.cx, y: command.cy }, { x: command.x, y: command.y }, t);
          segments.push({ a: previous, b: next });
          previous = next;
        }
        current = { x: command.x, y: command.y };
      }
    });

    return segments;
  }

  function quadraticPoint(start, control, end, t) {
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
    };
  }

  function drawMajorRiverCulvertMarker(ctx, centerPoint, fromPoint, toPoint, radius) {
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const length = Math.hypot(dx, dy) || 1;
    const along = { x: dx / length, y: dy / length };
    const normal = { x: -along.y, y: along.x };
    const ribOffsets = [-0.26, 0, 0.26];
    const ribHalfLength = radius * 0.24;

    ribOffsets.forEach(offset => {
      const center = {
        x: centerPoint.x + along.x * radius * offset,
        y: centerPoint.y + along.y * radius * offset
      };
      const from = {
        x: center.x - normal.x * ribHalfLength,
        y: center.y - normal.y * ribHalfLength
      };
      const to = {
        x: center.x + normal.x * ribHalfLength,
        y: center.y + normal.y * ribHalfLength
      };
      const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
      drawCanvasOverlayPath(ctx, path, {
        stroke: "rgba(48, 34, 24, 0.9)",
        width: 4.5,
        dash: [],
        lineCap: "round"
      });
      drawCanvasOverlayPath(ctx, path, {
        stroke: "rgba(226, 184, 94, 0.88)",
        width: 2,
        dash: [],
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
    return features.some(feature => ROAD_PASS_FEATURES.has(feature));
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
    const from = hexForPathPoint(segment.From_Hex_ID_Ref);
    const to = hexForPathPoint(segment.To_Hex_ID_Ref);
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

  function getCanvasRiverPathStrings(segments, options = {}) {
    const groups = new Map();
    segments.forEach(segment => {
      const style = segment.Style || "river";
      const key = `${style}::${segment.Is_Major_Route ? "major" : "minor"}::${segment.Route_Name || ""}`;
      if (!groups.has(key)) groups.set(key, { style, isMajor: Boolean(segment.Is_Major_Route), routeName: segment.Route_Name || "", segments: [] });
      groups.get(key).segments.push(segment);
    });

    return [...groups.values()].flatMap(group => (
      getWaterCutoffPathStrings(group.segments, "river", new Set(), options).map(pathData => ({
        ...pathData,
        style: group.style,
        isMajor: group.isMajor,
        routeName: group.routeName
      }))
    ));
  }

  function getWaterCutoffPathStrings(segments, type, breakHexIds = new Set(), options = {}) {
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
        d: pathForWaterCutoffNodeChain(chain, riverGraph.points, type, snapHexIds, options),
        isExit: chain.some(nodeId => String(nodeId).includes(":exit")),
        isSteepRoadPass: type === "road" && getChainMaxElevationDelta(chain, riverGraph.points) >= EXTREME_ROUTE_ELEVATION_DELTA
      });
      });
    });

    riverGraph.edges.forEach(edge => {
      if (visited.has(overlayEdgeVisitKey(edge.from, edge.to))) return;
      const chain = traceRiverNodeChain(edge.from, edge.to, riverGraph.graph, visited);
      paths.push({
        d: pathForWaterCutoffNodeChain(chain, riverGraph.points, type, snapHexIds, options),
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
      const fromHex = hexForPathPoint(segment.From_Hex_ID_Ref);
      const toHex = hexForPathPoint(segment.To_Hex_ID_Ref);
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

  function pathForWaterCutoffNodeChain(chain, pointsByNodeId, type, snapHexIds = new Set(), options = {}) {
    const basePointRecords = chain.map(nodeId => pointsByNodeId.get(nodeId)).filter(Boolean);
    const pointRecords = basePointRecords;
    const sharedLaneSnapHexIds = getSharedRoadRiverLaneSnapHexIds(pointRecords, type);
    const sluiceSnapHexIds = type === "river" ? getRiverWallSluiceSnapHexIds(pointRecords) : new Set();
    const pathSnapHexIds = (sharedLaneSnapHexIds.size || sluiceSnapHexIds.size)
      ? new Set([...snapHexIds, ...sharedLaneSnapHexIds, ...sluiceSnapHexIds])
      : snapHexIds;
    const hardLineSnapHexIds = sluiceSnapHexIds.size
      ? new Set([...snapHexIds, ...sluiceSnapHexIds])
      : snapHexIds;
    const shapedPointRecords = getJitteredPathPointRecords(pointRecords, type, pathSnapHexIds);
    const points = applyRiverRoadLaneOffsets(getWobbledPathPoints(shapedPointRecords, type, pathSnapHexIds), shapedPointRecords, type);
    if (points.length < 2) return "";
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    const commands = [`M ${points[0].x} ${points[0].y}`];
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      if (hardLineSnapHexIds.has(shapedPointRecords[index].hexId)) {
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

  function getSharedRoadRiverLaneSnapHexIds(pointRecords, type) {
    if (!["road", "river"].includes(type) || pointRecords.length < 2) return new Set();
    const sharedLaneEdgeKeys = type === "river" ? getRoadEdgeKeySet() : getRiverEdgeKeySet();
    const snapHexIds = new Set();
    for (let index = 0; index < pointRecords.length - 1; index += 1) {
      const fromRecord = pointRecords[index];
      const toRecord = pointRecords[index + 1];
      if (!fromRecord?.hexId || !toRecord?.hexId) continue;
      if (!sharedLaneEdgeKeys.has(overlayEdgeVisitKey(fromRecord.hexId, toRecord.hexId))) continue;
      [index - 1, index, index + 1, index + 2].forEach(pointIndex => {
        const hexId = pointRecords[pointIndex]?.hexId;
        if (hexId) snapHexIds.add(hexId);
      });
    }
    return snapHexIds;
  }

  function getRiverWallSluiceSnapHexIds(pointRecords) {
    const snapHexIds = new Set();
    const wallSegments = getWallSluiceSegments();
    if (!wallSegments.length) return snapHexIds;
    const radius = getGeneratedMapDimensions().radius;
    for (let index = 0; index < pointRecords.length - 1; index += 1) {
      const fromRecord = pointRecords[index];
      const toRecord = pointRecords[index + 1];
      if (!fromRecord?.hexId || !toRecord?.hexId) continue;
      const riverSegment = { a: fromRecord.point, b: toRecord.point };
      if (!wallSegments.some(wallSegment => wallRouteSegmentIntersectsRoute(wallSegment, riverSegment))) continue;
      [index - 1, index, index + 1, index + 2].forEach(pointIndex => {
        const record = pointRecords[pointIndex];
        if (!record?.hexId) return;
        if (pointIndex === index - 1 || pointIndex === index + 2) {
          const projection = projectPointToSegment(record.point, fromRecord.point, toRecord.point);
          if (Math.hypot(record.point.x - projection.point.x, record.point.y - projection.point.y) > radius * 1.2) return;
        }
        snapHexIds.add(record.hexId);
      });
    }
    return snapHexIds;
  }

  function getWallSluiceSegments() {
    if (renderer.wallSluiceSegmentCache?.revision === renderer.overlayRevision) return renderer.wallSluiceSegmentCache.segments;
    const segments = [];
    (getOverlaysByType().wall || []).forEach(wallOverlay => {
      const wallHex = renderer.hexesById.get(wallOverlay.Hex_ID_Ref);
      const wallEdge = getHexEdgeSegment(wallHex, wallOverlay.Edge);
      if (wallEdge) segments.push(wallEdge);
    });
    renderer.wallSluiceSegmentCache = { revision: renderer.overlayRevision, segments };
    return segments;
  }

  function applyRiverRoadLaneOffsets(points, pointRecords, type) {
    if (type !== "river" || points.length < 2) return points;
    const roadEdgeKeys = getRoadEdgeKeySet();
    if (!roadEdgeKeys.size) return points;
    const radius = getGeneratedMapDimensions().radius;
    const offsetDistance = radius * 0.18;
    const routeSign = seededPathFloat(`river-road-lane:${pointRecords[0]?.hexId || ""}:${pointRecords[pointRecords.length - 1]?.hexId || ""}`) < 0.5 ? -1 : 1;
    const offsetFlags = points.map(() => false);
    for (let index = 0; index < pointRecords.length - 1; index += 1) {
      const fromRecord = pointRecords[index];
      const toRecord = pointRecords[index + 1];
      if (!fromRecord?.hexId || !toRecord?.hexId) continue;
      if (!roadEdgeKeys.has(overlayEdgeVisitKey(fromRecord.hexId, toRecord.hexId))) continue;
      [index - 1, index, index + 1, index + 2].forEach(pointIndex => {
        if (pointIndex < 0 || pointIndex >= offsetFlags.length) return;
        offsetFlags[pointIndex] = true;
      });
    }
    if (!offsetFlags.some(Boolean)) return points;

    return points.map((point, index) => {
      if (!offsetFlags[index]) return point;
      const direction = getRiverLaneDirection(points, offsetFlags, index);
      if (!direction) return point;
      return {
        x: point.x + (-direction.y) * offsetDistance * routeSign,
        y: point.y + direction.x * offsetDistance * routeSign
      };
    });
  }

  function getRiverLaneDirection(points, offsetFlags, index) {
    let beforeIndex = index - 1;
    while (beforeIndex >= 0 && !offsetFlags[beforeIndex]) beforeIndex -= 1;
    let afterIndex = index + 1;
    while (afterIndex < points.length && !offsetFlags[afterIndex]) afterIndex += 1;
    const beforePoint = points[beforeIndex] || points[index - 1] || points[index];
    const afterPoint = points[afterIndex] || points[index + 1] || points[index];
    const dx = afterPoint.x - beforePoint.x;
    const dy = afterPoint.y - beforePoint.y;
    const length = Math.hypot(dx, dy);
    return length ? { x: dx / length, y: dy / length } : null;
  }

  function getRoadEdgeKeySet() {
    if (renderer.roadEdgeKeyCache?.revision === renderer.overlayRevision) return renderer.roadEdgeKeyCache.keys;
    const keys = new Set();
    (getOverlaysByType().road || []).forEach(overlay => {
      if (isAutoPassRoadSegment(overlay) || !overlay.From_Hex_ID_Ref || !overlay.To_Hex_ID_Ref) return;
      keys.add(overlayEdgeVisitKey(overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref));
    });
    renderer.roadEdgeKeyCache = { revision: renderer.overlayRevision, keys };
    return keys;
  }

  function getRiverEdgeKeySet() {
    if (renderer.riverEdgeKeyCache?.revision === renderer.overlayRevision) return renderer.riverEdgeKeyCache.keys;
    const keys = new Set();
    (getOverlaysByType().river || []).forEach(overlay => {
      if (!overlay.From_Hex_ID_Ref || !overlay.To_Hex_ID_Ref) return;
      keys.add(overlayEdgeVisitKey(overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref));
    });
    renderer.riverEdgeKeyCache = { revision: renderer.overlayRevision, keys };
    return keys;
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
    const type = String(poi?.POI_Type_Value || poi?.POI_Type || "")
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
    const hex = hexForPathPoint(hexId);
    if (!hex) return null;
    if (!isWaterHex(hex)) return hex.center;

    const sameTypeSegments = getOverlaysByType()[type] || [];
    if (transportContinuesThroughWater(hex, type, sameTypeSegments)) return hex.center;

    const neighborId = index === 0 ? chain[1] : chain[index - 1];
    const neighborHex = hexForPathPoint(neighborId);
    if (!neighborHex || isWaterHex(neighborHex)) return null;

    return pointWhereLineLeavesHex(neighborHex, hex.center);
  }

  function getSnapHexIdsForPathType(type) {
    if (!["road", "path", "river"].includes(type)) return new Set();
    if (renderer.snapHexIdsCache.revision === renderer.overlayRevision && renderer.snapHexIdsCache.type === type) {
      return renderer.snapHexIdsCache.hexIds;
    }

    const counts = {
      road: new Map(),
      path: new Map(),
      river: new Map(),
      majorRiver: new Map(),
      regularRiver: new Map()
    };

    ["road", "path", "river"].forEach(overlayType => {
      (getOverlaysByType()[overlayType] || []).forEach(overlay => {
      if (!["road", "path", "river"].includes(overlay.Overlay_Type)) return;
      [overlay.From_Hex_ID_Ref, overlay.To_Hex_ID_Ref].forEach(hexId => {
        if (!hexId) return;
        const typeCounts = counts[overlay.Overlay_Type];
        typeCounts.set(hexId, (typeCounts.get(hexId) || 0) + 1);
        if (overlay.Overlay_Type === "river") {
          const routeCounts = overlay.Is_Major_Route ? counts.majorRiver : counts.regularRiver;
          routeCounts.set(hexId, (routeCounts.get(hexId) || 0) + 1);
        }
      });
      });
    });

    const snapHexIds = new Set();
    new Set([...counts.road.keys(), ...counts.path.keys(), ...counts.river.keys()]).forEach(hexId => {
      const roadCount = counts.road.get(hexId) || 0;
      const pathCount = counts.path.get(hexId) || 0;
      const riverCount = counts.river.get(hexId) || 0;
      const majorRiverCount = counts.majorRiver.get(hexId) || 0;
      const regularRiverCount = counts.regularRiver.get(hexId) || 0;
      if ((roadCount && pathCount) || roadCount >= 3 || pathCount >= 3) {
        snapHexIds.add(hexId);
      }
      if (riverCount >= 3 || majorRiverCount && regularRiverCount) {
        snapHexIds.add(hexId);
      }
    });

    getDecoratedCrossingSnapHexIds(type).forEach(hexId => snapHexIds.add(hexId));

    renderer.snapHexIdsCache = { revision: renderer.overlayRevision, type, hexIds: snapHexIds };
    return snapHexIds;
  }

  function getDecoratedCrossingSnapHexIds(type) {
    if (!["road", "river"].includes(type)) return new Set();
    const snapHexIds = new Set();
    const overlaysByType = getOverlaysByType();
    const majorRoadSegments = getCenteredOverlaySegments(
      overlaysByType.road.filter(overlay => overlay.Is_Major_Route && !isAutoPassRoadSegment(overlay))
    );
    const majorRiverSegments = getCenteredOverlaySegments(
      overlaysByType.river.filter(overlay => overlay.Is_Major_Route)
    );

    if (type === "road") {
      addWallDecorationSnapHexes(snapHexIds, majorRoadSegments);
    }

    if (type === "river") {
      addWallDecorationSnapHexes(snapHexIds, majorRiverSegments);
    }

    return snapHexIds;
  }

  function addWallDecorationSnapHexes(snapHexIds, routeSegments) {
    if (!routeSegments.length) return;
    (getOverlaysByType().wall || []).forEach(wallOverlay => {
      const wallHex = renderer.hexesById.get(wallOverlay.Hex_ID_Ref);
      const wallEdge = getHexEdgeSegment(wallHex, wallOverlay.Edge);
      if (!wallEdge) return;
      routeSegments.forEach(routeSegment => {
        if (!wallRouteSegmentIntersectsRoute(wallEdge, routeSegment)) return;
        addOverlaySegmentSnapHexes(snapHexIds, routeSegment.overlay);
      });
    });
  }

  function wallRouteSegmentIntersectsRoute(wallEdge, routeSegment) {
    const radius = getGeneratedMapDimensions().radius;
    return Boolean(lineSegmentIntersectionPoint(wallEdge.a, wallEdge.b, routeSegment.a, routeSegment.b, {
      roadPadding: 0.08,
      riverPadding: 0.08
    }) || pointDistanceToSegment({
      x: (wallEdge.a.x + wallEdge.b.x) / 2,
      y: (wallEdge.a.y + wallEdge.b.y) / 2
    }, routeSegment.a, routeSegment.b) <= radius * 0.18);
  }

  function addOverlaySegmentSnapHexes(target, overlay) {
    [overlay?.From_Hex_ID_Ref, overlay?.To_Hex_ID_Ref].forEach(hexId => {
      if (hexId) target.add(hexId);
    });
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
    if (renderer.view.animatingZoom || now < renderer.view.wheelLockedUntil) return;

    const nextZoom = getNextZoomStep(event.deltaY < 0 ? 1 : -1);
    renderer.view.wheelLockedUntil = now + ZOOM_STEP_LOCK_MS;
    if (Math.abs(nextZoom - renderer.view.zoom) < 0.0001) return;
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

      renderer.view.zoom = targetZoom;
      renderer.view.panX = anchorWorldX - relativeX / targetZoom;
      renderer.view.panY = anchorWorldY - relativeY / targetZoom;
      clampView();
      renderer.view.zoomAnimationFrame = null;
      renderer.view.animatingZoom = false;
      renderer.view.wheelLockedUntil = Math.max(renderer.view.wheelLockedUntil, performance.now() + 80);
      render();
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
    return performance.now() >= renderer.view.routeLabelsHiddenUntil;
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

    if (renderer.drawing.enabled && (event.pointerType === "touch" || event.button === 1 || event.button === 2)) {
      beginTouchDrawIntent(event);
      renderer.view.dragging = true;
      renderer.view.dragMoved = false;
      renderer.view.lastX = event.clientX;
      renderer.view.lastY = event.clientY;
      renderer.root.setPointerCapture?.(event.pointerId);
      return;
    }

    if (renderer.drawing.enabled && renderer.drawing.tool && event.pointerType !== "touch") {
      event.preventDefault();
      renderer.root.setPointerCapture?.(event.pointerId);
      renderer.drawing.paintedThisDrag = new Set();
      beginDragActionBatch();
      if (renderer.drawing.tool === "wall" && getValidWallMode(renderer.drawing.wallMode) === "plane") {
        beginWallPlaneDragPreview(event);
        renderer.view.suppressClickUntil = performance.now() + 450;
        renderSvgOnly();
        return;
      }
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
      if (!renderer.drawing.tool) {
        const hovered = getHexAtWorldPoint(clientToWorld(event));
        const nextHoverId = hovered?.id || null;
        if (renderer.hoveredHexId !== nextHoverId) {
          renderer.hoveredHexId = nextHoverId;
          renderSvgOnly();
        }
        return;
      }

      event.preventDefault();
      const hex = getHexAtWorldPoint(clientToWorld(event));
      const hoverPoint = clientToWorld(event);
      const nextHoverEdge = getDrawingHoverEdge(renderer.drawing.tool, hoverPoint, hex);
      const nextEraseHexId = renderer.drawing.tool === "erase" && hexHasEraseableOverlays(hex?.id) ? hex.id : null;
      const nextMistHexIds = ["mist", "farmland"].includes(renderer.drawing.tool) && hex
        ? getMistBrushHexIds(hex, renderer.drawing.tool)
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

      if (event.pointerType !== "touch" && renderer.drawing.tool === "wall" && getValidWallMode(renderer.drawing.wallMode) === "plane" && (event.buttons & 1) === 1) {
        if (updateWallPlaneDragPreview(event)) renderSvgOnly();
        return;
      }

      if (event.pointerType !== "touch" && (PATH_OVERLAY_TYPES.has(renderer.drawing.tool) || REGION_PAINT_TYPES.has(renderer.drawing.tool) || renderer.drawing.tool === "terrain" || renderer.drawing.tool === "feature" || renderer.drawing.tool === "feature-erase" || renderer.drawing.tool === "mist" || renderer.drawing.tool === "farmland") && (event.buttons & 1) === 1) {
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

    if (renderer.drawing.enabled && renderer.drawing.tool) {
      if (renderer.drawing.tool === "wall" && getValidWallMode(renderer.drawing.wallMode) === "plane" && renderer.drawing.wallPlaneDrag?.previewEdges?.length) {
        const wallEdges = renderer.drawing.wallPlaneDrag.previewEdges;
        renderer.drawing.wallPlaneDrag = null;
        persistWallOverlays(wallEdges);
      }
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
      renderer.root.releasePointerCapture?.(event.pointerId);
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

    const isEditorPreview = renderer.drawing.enabled && !renderer.drawing.tool;
    selectGeneratedHex(hex.id, {
      detailsDisabled: isEditorPreview,
      disablePoiLinks: isEditorPreview
    });
  }

  function applyDrawingAtEvent(event, fromDrag = false) {
    if (renderer.drawing.saving) return;
    blurRouteNameInput();

    const point = clientToWorld(event);
    const hex = getHexAtWorldPoint(point);
    if (!hex) return;

    const tool = renderer.drawing.tool;
    if (tool === "sea_route" && !canSeaRouteUseHex(hex)) return;

    if (tool === "wall") {
      const wallEdges = getWallPlacementEdges(point, hex);
      persistWallOverlays(wallEdges);
      return;
    }

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

    if (tool === "mist") {
      persistMistBrush(hex);
      return;
    }

    if (tool === "farmland") {
      if (isWaterHex(hex)) return;
      persistFarmlandBrush(hex);
      return;
    }

    if (tool === "region") {
      assignHexRegionBrush(hex, renderer.drawing.regionId, "geographic");
      return;
    }

    if (tool === "unregion") {
      assignHexRegionBrush(hex, UNCLAIMED_REGION_REF, "geographic");
      return;
    }

    if (tool === "political-region") {
      assignHexRegionBrush(hex, renderer.drawing.politicalRegionId, "political");
      return;
    }

    if (tool === "clear-political-region") {
      assignHexRegionBrush(hex, "", "political");
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
      actions.push(action);
    }
    pushBrushTerrainActions(actions, "terrain-manual");
    queueMapRender(true);
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
      actions.push(action);
    }
    pushBrushTerrainActions(actions, "features-manual");
    queueMapRender(true);
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
      actions.push(action);
    }
    pushBrushTerrainActions(actions, "features-manual");
    queueMapRender(true);
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

  function pushBrushTerrainActions(actions, previewSection = "") {
    const valid = (actions || []).filter(Boolean);
    if (!valid.length) return;
    const historyAction = valid.length === 1
      ? { ...valid[0], previewSection }
      : { type: "batch", previewSection, actions: valid };
    pushStagedMapEditAction(historyAction);
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
    if (REGION_PAINT_TYPES.has(renderer.drawing.tool)) {
      const size = clampNumber(Number(renderer.drawing.regionBrushSize), 1, 5, 1);
      return getBrushHexes(hex, size, 0, "region-preview")
        .map(candidate => candidate.id);
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
    if (feature === "falls" && !hasStrongWaterDropFromHex(hexForPathPoint(snapshot.hexId))) return null;
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
    const hex = hexForPathPoint(hexId);
    if (!hex) return null;
    return {
      ...hex,
      baseTerrain: hexOrSnapshot?.baseTerrain || hex.baseTerrain,
      features: hexOrSnapshot?.features || hex.features || [],
      elevation: hexOrSnapshot?.elevation ?? hex.elevation
    };
  }

  function canApplyFeatureByGenerationContext(hexOrSnapshot, feature, seed = "") {
    const hex = hexForPathPoint(hexOrSnapshot?.hexId);
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
    discardStagedMapEditSection("features", { silent: true });

    const refreshExisting = Boolean(renderer.drawing.generationRefreshExisting);
    if (refreshExisting) {
      const confirmed = await showMapConfirm("Preview refreshed terrain features across the generated map? Existing terrain features will be staged locally until you apply the preview.", {
        title: "Refresh Features?",
        confirmLabel: "Preview"
      });
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

    const historyAction = {
      type: "batch",
      previewSection: "features",
      actions
    };
    actions.forEach(action => applyLocalTerrainSnapshot(action.hexId, action.after));
    pushStagedMapEditAction(historyAction);
    render();
    updateGenerationControls();
  }

  async function runGenerationRoadPass(options = {}) {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return false;
    if (!options.skipConfirm && !await confirmOverlayGeneration("road", "roads")) return false;
    const routes = buildGeneratedRoadRoutes(campaign.id);
    if (!routes.length) {
      window.alert?.("No road routes could be generated from the current POI layout.");
      return false;
    }

    return persistGeneratedOverlayRoutes({
      campaignId: campaign.id,
      routes,
      tool: "road",
      style: "dark_brown",
      routeMetadata: { isMajorRoute: false, routeName: "" },
      emptyMessage: "Generated roads already matched existing road overlays.",
      existingKeyMode: renderer.drawing.generationIncludeTradeRoutes ? "route" : "type"
    });
  }

  async function runGenerationRiverPass(options = {}) {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return false;
    if (!options.skipConfirm && !await confirmOverlayGeneration("river", "rivers")) return false;
    try {
      const routes = buildGeneratedRiverRoutes(campaign.id);
      if (!routes.length) {
        window.alert?.("No river routes could be generated from the current terrain.");
        return false;
      }

      return persistGeneratedOverlayRoutes({
        campaignId: campaign.id,
        routes,
        tool: "river",
        style: composeOverlayStyle("river", []),
        routeMetadata: { isMajorRoute: false, routeName: "" },
        emptyMessage: "Generated rivers already matched existing river overlays."
      });
    } catch (error) {
      console.error("Unable to generate rivers:", error);
      window.alert?.(error?.message || "Unable to generate rivers.");
      return false;
    }
  }

  async function runGenerationGeographicRegionPass() {
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return false;

    const drafts = buildGeneratedGeographicRegionDrafts(campaign.id);
    if (!drafts.length) {
      window.alert?.("No region-worthy unclaimed biome pockets were found for geographic region generation.");
      return false;
    }

    const confirmed = await showMapConfirm(
      `Generate ${drafts.length} geographic region${drafts.length === 1 ? "" : "s"} and paint unclaimed land hexes now? This saves directly to the live map and can be undone during this session.`,
      {
        title: "Generate Regions?",
        confirmLabel: "Generate Regions"
      }
    );
    if (!confirmed) return false;

    renderer.drawing.saving = true;
    setLoading(true);
    refreshEditorActionControls();

    try {
      const createdRegions = [];
      for (const draft of drafts) {
        const region = await createGeneratedGeographicRegion(campaign.id, draft);
        if (region?.Region_ID) {
          draft.regionId = region.Region_ID;
          createdRegions.push(region);
        }
      }

      const actions = drafts
        .filter(draft => draft.regionId)
        .flatMap(draft => draft.hexIds.map(hexId => {
          const before = getRegionSnapshot(hexId);
          if (!before) return null;
          const after = {
            ...before,
            geographicRegionId: draft.regionId
          };
          return regionSnapshotsEqual(before, after)
            ? null
            : {
              type: "region",
              hexId,
              regionType: "geographic",
              before,
              after
            };
        }))
        .filter(Boolean);

      if (!actions.length) {
        await deleteGeneratedRegionRecords(campaign.id, createdRegions.map(region => buildGeneratedRegionHistoryRecord(region)));
        window.alert?.("Generated region records, but no unclaimed hex paint needed to change.");
        populateDrawRegionSelect();
        return true;
      }

      const { error } = await campaignSupabase.rpc("restore_generated_hex_region_snapshots", {
        target_campaign_id: campaign.id,
        region_snapshot: serializeRegionSnapshot(actions, "redo")
      });
      if (error) throw error;

      actions.forEach(action => applyLocalRegionSnapshot(action.hexId, action.after));
      pushMapEditAction({
        type: "batch",
        generatedRegions: createdRegions.map(region => buildGeneratedRegionHistoryRecord(region, drafts.find(draft => draft.regionId === region.Region_ID)?.family || "")),
        actions
      }, { force: true });
      populateDrawRegionSelect();
      renderSvgOnly();
      window.alert?.(`Generated ${createdRegions.length} geographic region${createdRegions.length === 1 ? "" : "s"} across ${actions.length} hex${actions.length === 1 ? "" : "es"}.`);
      return true;
    } catch (error) {
      console.error("Unable to generate geographic regions:", error);
      window.alert?.(error?.message || "Unable to generate geographic regions.");
      return false;
    } finally {
      renderer.drawing.saving = false;
      setLoading(false);
      refreshEditorActionControls();
    }
  }

  async function createGeneratedGeographicRegion(campaignId, draft) {
    const { data, error } = await campaignSupabase.rpc("create_region_with_next_ref_code", {
      target_campaign_id: campaignId,
      region_name: draft.name,
      region_type_input: "geographic",
      region_border_color: draft.color,
      region_lore: draft.lore || buildGeneratedGeographicRegionLore(draft.family)
    });
    if (error) throw error;
    const region = adaptGeneratedRegionRow(data);
    addGeneratedRegionToLocalDb(region);
    return region;
  }

  function adaptGeneratedRegionRow(row) {
    const createdRow = Array.isArray(row) ? row[0] : row;
    return {
      __uuid: createdRow?.id,
      Region_ID: createdRow?.ref_code || "",
      Region_Name: createdRow?.name || "",
      Region_Type: createdRow?.region_type || "geographic",
      Border_Color: createdRow?.border_color || "#ffd84d",
      Lore: createdRow?.lore || "",
      Image: ""
    };
  }

  function addGeneratedRegionToLocalDb(region) {
    if (!region?.Region_ID) return;
    if (isGeneratedGeographicRegionRecord(region)) {
      region.Generation_Source = "geographic-region-generator";
    }
    if (!db.raw.regions) db.raw.regions = [];
    if (!db.regionsById) db.regionsById = {};
    if (!db.raw.regions.some(existing => existing.Region_ID === region.Region_ID)) {
      db.raw.regions.push(region);
    }
    db.regionsById[region.Region_ID] = region;
  }

  function removeGeneratedRegionFromLocalDb(region) {
    const regionId = region?.Region_ID || "";
    if (!regionId || regionId === UNCLAIMED_REGION_REF) return;
    if (db?.raw?.regions) {
      db.raw.regions = db.raw.regions.filter(existing => existing?.Region_ID !== regionId);
    }
    if (db?.regionsById) delete db.regionsById[regionId];
    Object.values(db?.hexesById || {}).forEach(hex => {
      if (hex.Region_ID_Ref === regionId) hex.Region_ID_Ref = UNCLAIMED_REGION_REF;
      if (hex.Political_Region_ID_Ref === regionId) hex.Political_Region_ID_Ref = "";
    });
  }

  function cloneRegionHistoryRecord(region) {
    if (!region) return region;
    return { ...region };
  }

  function buildGeneratedRegionHistoryRecord(region, family = "") {
    return {
      __uuid: region?.__uuid || null,
      Region_ID: region?.Region_ID || "",
      Region_Name: region?.Region_Name || "",
      Region_Type: region?.Region_Type || "geographic",
      Border_Color: region?.Border_Color || "#ffd84d",
      Lore: region?.Lore || "",
      Generated_Family: family || region?.Generated_Family || "",
      Generation_Source: "geographic-region-generator"
    };
  }

  function isGeneratedGeographicRegionRecord(region) {
    if (!region || region.Region_ID === UNCLAIMED_REGION_REF) return false;
    if (region.Generation_Source === "geographic-region-generator") return true;
    return String(region.Lore || "").includes(getGeneratedRegionLoreMarker());
  }

  function getGeneratedRegionLoreMarker() {
    return "[[waymark:generated-geographic-region]]";
  }

  function buildGeneratedGeographicRegionLore(family) {
    const label = family ? `Family: ${family}.` : "Family: unknown.";
    return `${getGeneratedRegionLoreMarker()}\nGenerated by the Surveyor geographic region pass. ${label}`;
  }

  function buildGeneratedGeographicRegionDrafts(campaignId) {
    const seedBase = `${getGenerationSeedBase(campaignId)}:geo-regions`;
    const eligibleHexes = renderer.hexes
      .filter(hex => hex?.id)
      .filter(hex => !hex.regionId || hex.regionId === UNCLAIMED_REGION_REF);
    if (eligibleHexes.length < 18) return [];

    const usedNames = new Set((db?.raw?.regions || []).map(region => String(region.Region_Name || "").toLowerCase()));
    const usedColors = new Set((db?.raw?.regions || [])
      .filter(region => String(region.Border_Color || "").toLowerCase() !== "none")
      .map(region => getColorInputValue(region.Border_Color))
      .filter(Boolean));
    const familyCounts = getGeneratedGeographicRegionFamilyCounts(eligibleHexes);
    const clusters = mergeGeneratedGeographicRegionSiblingClusters(
      buildGeneratedGeographicRegionClusters(eligibleHexes, seedBase, familyCounts),
      seedBase
    );
    const targetCount = Math.max(1, Math.min(12, Math.round(eligibleHexes.length / 260)));
    const selectedClusters = selectGeneratedGeographicRegionClusters(clusters, targetCount, eligibleHexes.length, familyCounts);

    return selectedClusters.map((cluster, index) => ({
      name: buildGeneratedGeographicRegionName(cluster.family, cluster.seed, seedBase, index, usedNames, cluster),
      color: chooseGeneratedGeographicRegionColor(cluster.family, seedBase, index, usedColors),
      family: cluster.family,
      hexIds: cluster.hexIds
    }));
  }

  function getGeneratedGeographicRegionFamilyCounts(hexes) {
    return (hexes || []).reduce((counts, hex) => {
      const family = getGeneratedGeographicRegionFamily(hex);
      counts.set(family, (counts.get(family) || 0) + 1);
      return counts;
    }, new Map());
  }

  function buildGeneratedGeographicRegionClusters(hexes, seedBase, familyCounts = new Map()) {
    const eligibleIds = new Set(hexes.map(hex => hex.id));
    const visited = new Set();
    const clusters = [];

    hexes.forEach(startHex => {
      if (!startHex?.id || visited.has(startHex.id)) return;
      const family = getGeneratedGeographicRegionFamily(startHex);
      const config = getGeneratedGeographicRegionClusterConfig(family);
      if (!config) return;

      const cluster = [];
      const queue = [startHex];
      visited.add(startHex.id);
      while (queue.length) {
        const hex = queue.shift();
        cluster.push(hex);
        EDGE_NAMES.forEach(edge => {
          const neighbor = getNeighborHex(hex, edge);
          if (!neighbor?.id || visited.has(neighbor.id) || !eligibleIds.has(neighbor.id)) return;
          if (getGeneratedGeographicRegionFamily(neighbor) !== family) return;
          visited.add(neighbor.id);
          queue.push(neighbor);
        });
      }

      clusters.push(...buildGeneratedGeographicRegionClusterCandidates(cluster, family, config, seedBase, hexes.length, familyCounts.get(family) || 0));
    });

    return clusters.sort((left, right) => right.score - left.score || left.seed.id.localeCompare(right.seed.id));
  }

  function buildGeneratedGeographicRegionClusterCandidates(cluster, family, config, seedBase, totalEligibleHexes, familyHexCount) {
    const qualityHexes = getGeneratedGeographicRegionQualityHexes(cluster, family, config);
    const wholeClusterCandidate = () => {
      if (!isGeneratedGeographicRegionClusterEligible(cluster, qualityHexes, config, totalEligibleHexes, familyHexCount, family)) return null;
      const seed = chooseGeneratedGeographicRegionClusterSeed(qualityHexes, family, seedBase);
      return {
        family,
        seed,
        hexIds: cluster.map(hex => hex.id),
        sourceHexIds: cluster.map(hex => hex.id),
        score: getGeneratedGeographicRegionClusterScore(cluster, qualityHexes, family, seedBase)
      };
    };

    if (!shouldBuildGeneratedGeographicRegionSubclusters(cluster, family, config)) {
      return [wholeClusterCandidate()].filter(Boolean);
    }

    const subclusters = buildGeneratedGeographicRegionSubclusters(cluster, family, config, seedBase, totalEligibleHexes, familyHexCount);
    if (subclusters.length) return subclusters;
    return [wholeClusterCandidate()].filter(Boolean);
  }

  function shouldBuildGeneratedGeographicRegionSubclusters(cluster, family, config) {
    const threshold = Number(config?.splitThreshold || 0);
    return threshold > 0 && cluster.length >= threshold && ["marine", "lowland", "woodland", "highland", "snow", "jungle"].includes(family);
  }

  function buildGeneratedGeographicRegionSubclusters(cluster, family, config, seedBase, totalEligibleHexes, familyHexCount) {
    const qualityHexes = getGeneratedGeographicRegionQualityHexes(cluster, family, config);
    const seedPool = (qualityHexes.length ? qualityHexes : cluster)
      .slice()
      .sort((left, right) => {
        const leftScore = getGeneratedGeographicRegionCoreScore(left, family, seedBase) + seededUnit(`${seedBase}:subregion-seed:${family}:${left.id}`) * 5;
        const rightScore = getGeneratedGeographicRegionCoreScore(right, family, seedBase) + seededUnit(`${seedBase}:subregion-seed:${family}:${right.id}`) * 5;
        return rightScore - leftScore || left.id.localeCompare(right.id);
      });
    const targetSize = Math.max(config.minClusterSize, Number(config.splitTargetSize || config.minClusterSize * 2));
    const attemptCount = Math.min(Number(config.splitAttempts || 4), Math.max(2, Math.ceil(cluster.length / Math.max(1, targetSize * 1.25))));
    const candidates = [];

    seedPool.slice(0, Math.max(attemptCount * 3, attemptCount)).forEach((seedHex, seedIndex) => {
      if (candidates.length >= attemptCount) return;
      const sizeJitter = 0.82 + seededUnit(`${seedBase}:subregion-size:${family}:${seedHex.id}`) * 0.38;
      const desiredSize = Math.max(config.minClusterSize, Math.min(cluster.length, Math.round(targetSize * sizeJitter)));
      const subcluster = growGeneratedGeographicRegionSubcluster(cluster, family, seedHex, desiredSize, seedBase, seedIndex);
      const subQualityHexes = getGeneratedGeographicRegionQualityHexes(subcluster, family, config);
      if (!isGeneratedGeographicRegionClusterEligible(subcluster, subQualityHexes, config, totalEligibleHexes, familyHexCount, family)) return;
      candidates.push({
        family,
        seed: chooseGeneratedGeographicRegionClusterSeed(subQualityHexes.length ? subQualityHexes : subcluster, family, seedBase),
        hexIds: subcluster.map(hex => hex.id),
        sourceHexIds: subcluster.map(hex => hex.id),
        score: getGeneratedGeographicRegionClusterScore(subcluster, subQualityHexes.length ? subQualityHexes : subcluster, family, `${seedBase}:subregion:${seedIndex}`)
      });
    });

    return candidates;
  }

  function growGeneratedGeographicRegionSubcluster(cluster, family, seedHex, desiredSize, seedBase, seedIndex) {
    const allowedIds = new Set(cluster.map(hex => hex.id));
    const selectedIds = new Set([seedHex.id]);
    const selected = [seedHex];
    let frontier = EDGE_NAMES
      .map(edge => getNeighborHex(seedHex, edge))
      .filter(hex => hex?.id && allowedIds.has(hex.id) && getGeneratedGeographicRegionFamily(hex) === family);

    while (frontier.length && selected.length < desiredSize) {
      frontier = frontier
        .filter(hex => hex?.id && !selectedIds.has(hex.id))
        .sort((left, right) => getGeneratedGeographicRegionSubclusterStepScore(left, seedHex, family, seedBase, seedIndex) - getGeneratedGeographicRegionSubclusterStepScore(right, seedHex, family, seedBase, seedIndex) || left.id.localeCompare(right.id));
      const next = frontier.shift();
      if (!next?.id || selectedIds.has(next.id)) continue;
      selectedIds.add(next.id);
      selected.push(next);
      EDGE_NAMES.forEach(edge => {
        const neighbor = getNeighborHex(next, edge);
        if (!neighbor?.id || selectedIds.has(neighbor.id) || !allowedIds.has(neighbor.id)) return;
        if (getGeneratedGeographicRegionFamily(neighbor) !== family) return;
        frontier.push(neighbor);
      });
    }

    return selected;
  }

  function getGeneratedGeographicRegionSubclusterStepScore(hex, seedHex, family, seedBase, seedIndex) {
    const sameNearby = nearbyHexesWithin(hex, 1)
      .filter(candidate => getGeneratedGeographicRegionFamily(candidate) === family)
      .length;
    return roadPathHeuristic(hex, seedHex)
      - sameNearby * 0.28
      + seededUnit(`${seedBase}:subregion-step:${family}:${seedIndex}:${seedHex.id}:${hex.id}`) * 3.5;
  }

  function mergeGeneratedGeographicRegionSiblingClusters(clusters, seedBase) {
    const grouped = new Map();
    clusters.forEach(cluster => {
      if (!grouped.has(cluster.family)) grouped.set(cluster.family, []);
      grouped.get(cluster.family).push({ ...cluster, hexIds: [...cluster.hexIds], sourceHexIds: [...(cluster.sourceHexIds || cluster.hexIds)] });
    });

    const merged = [];
    grouped.forEach((familyClusters, family) => {
      const config = getGeneratedGeographicRegionClusterConfig(family);
      const mergeDistance = Number(config?.mergeDistance || 0);
      const consumed = new Set();
      familyClusters
        .sort((left, right) => right.score - left.score || left.seed.id.localeCompare(right.seed.id))
        .forEach((cluster, index) => {
          if (consumed.has(index)) return;
          let current = { ...cluster, hexIds: [...cluster.hexIds], sourceHexIds: [...cluster.sourceHexIds] };
          consumed.add(index);
          familyClusters.forEach((candidate, candidateIndex) => {
            if (consumed.has(candidateIndex) || candidateIndex === index) return;
            if (!shouldMergeGeneratedGeographicRegionClusters(current, candidate, mergeDistance)) return;
            current = mergeGeneratedGeographicRegionClusters(current, candidate, seedBase);
            consumed.add(candidateIndex);
          });
          merged.push(current);
        });
    });

    return merged.sort((left, right) => right.score - left.score || left.seed.id.localeCompare(right.seed.id));
  }

  function shouldMergeGeneratedGeographicRegionClusters(left, right, mergeDistance) {
    if (!mergeDistance || mergeDistance < 1) return false;
    const leftIds = left.sourceHexIds || left.hexIds || [];
    const rightIds = right.sourceHexIds || right.hexIds || [];
    if (!leftIds.length || !rightIds.length) return false;
    const smallest = leftIds.length <= rightIds.length ? leftIds : rightIds;
    const largestSet = new Set(leftIds.length <= rightIds.length ? rightIds : leftIds);
    return smallest.some(hexId => {
      const hex = hexForPathPoint(hexId);
      if (!hex) return false;
      return nearbyHexesWithin(hex, mergeDistance).some(nearbyHex => largestSet.has(nearbyHex.id));
    });
  }

  function mergeGeneratedGeographicRegionClusters(left, right, seedBase) {
    const family = left.family;
    const sourceHexIds = [...new Set([...(left.sourceHexIds || left.hexIds || []), ...(right.sourceHexIds || right.hexIds || [])])];
    const bridgeHexIds = getGeneratedRegionBridgeHexIds(left.sourceHexIds || left.hexIds || [], right.sourceHexIds || right.hexIds || []);
    const bridgeCorridorHexIds = getGeneratedRegionBridgeCorridorHexIds(bridgeHexIds, family);
    const hexIds = [...new Set([...(left.hexIds || []), ...(right.hexIds || []), ...bridgeHexIds, ...bridgeCorridorHexIds])];
    const seed = [left.seed, right.seed]
      .filter(Boolean)
      .sort((a, b) => getGeneratedGeographicRegionCoreScore(b, family, seedBase) - getGeneratedGeographicRegionCoreScore(a, family, seedBase) || a.id.localeCompare(b.id))[0] || left.seed || right.seed;
    const score = left.score + right.score * 0.72 + Math.min(120, (bridgeHexIds.length + bridgeCorridorHexIds.length) * 4);
    return {
      family,
      seed,
      hexIds,
      sourceHexIds,
      score
    };
  }

  function getGeneratedRegionBridgeHexIds(leftHexIds, rightHexIds) {
    const leftHexes = (leftHexIds || []).map(hexForPathPoint).filter(Boolean);
    const rightHexes = (rightHexIds || []).map(hexForPathPoint).filter(Boolean);
    if (!leftHexes.length || !rightHexes.length) return [];
    const bestPair = leftHexes
      .flatMap(left => rightHexes.map(right => ({ left, right, distance: roadPathHeuristic(left, right) })))
      .sort((a, b) => a.distance - b.distance || a.left.id.localeCompare(b.left.id) || a.right.id.localeCompare(b.right.id))[0];
    if (!bestPair || bestPair.distance > 5) return [];
    const sequence = getSimpleGeneratedRegionBridgeSequence(bestPair.left, bestPair.right);
    return sequence.slice(1, -1);
  }

  function getGeneratedRegionBridgeCorridorHexIds(bridgeHexIds, family) {
    if (!["wetland", "jungle", "highland", "snow", "desert", "barrens"].includes(family)) return [];
    const corridorIds = new Set();
    (bridgeHexIds || []).forEach(hexId => {
      const hex = hexForPathPoint(hexId);
      if (!hex?.id) return;
      nearbyHexesWithin(hex, 1).forEach(candidate => {
        if (!candidate?.id) return;
        if (candidate.regionId && candidate.regionId !== UNCLAIMED_REGION_REF) return;
        const candidateFamily = getGeneratedGeographicRegionFamily(candidate);
        if (family !== "wetland" && candidateFamily !== family) return;
        if (family === "wetland" && candidateFamily === "marine") return;
        corridorIds.add(candidate.id);
      });
    });
    return [...corridorIds];
  }

  function getSimpleGeneratedRegionBridgeSequence(fromHex, toHex) {
    const sequence = [fromHex.id];
    const visited = new Set(sequence);
    let current = fromHex;
    let guard = 0;
    while (current?.id !== toHex.id && guard < 8) {
      const next = EDGE_NAMES
        .map(edge => getNeighborHex(current, edge))
        .filter(hex => hex?.id && !visited.has(hex.id))
        .sort((left, right) => roadPathHeuristic(left, toHex) - roadPathHeuristic(right, toHex) || left.id.localeCompare(right.id))[0];
      if (!next) break;
      sequence.push(next.id);
      visited.add(next.id);
      current = next;
      guard += 1;
    }
    return current?.id === toHex.id ? sequence : [fromHex.id, toHex.id];
  }

  function selectGeneratedGeographicRegionClusters(clusters, targetCount, totalEligibleHexes, familyCounts) {
    const selected = [];
    const selectedByFamily = new Map();
    const selectedHexIds = new Set();
    for (const cluster of clusters) {
      if (selected.length >= targetCount) break;
      if ((cluster.hexIds || []).some(hexId => selectedHexIds.has(hexId))) continue;
      const familyCount = familyCounts.get(cluster.family) || 0;
      const familyShare = totalEligibleHexes > 0 ? familyCount / totalEligibleHexes : 0;
      const familyLimit = getGeneratedGeographicRegionFamilyLimit(familyShare, targetCount, cluster.family);
      const currentFamilyCount = selectedByFamily.get(cluster.family) || 0;
      if (currentFamilyCount >= familyLimit) continue;
      selected.push(cluster);
      (cluster.hexIds || []).forEach(hexId => selectedHexIds.add(hexId));
      selectedByFamily.set(cluster.family, currentFamilyCount + 1);
    }
    return selected;
  }

  function getGeneratedGeographicRegionFamilyLimit(familyShare, targetCount, family = "") {
    if (family === "marine") {
      if (familyShare >= 0.32) return Math.min(3, targetCount);
      if (familyShare >= 0.22) return Math.min(2, targetCount);
    }
    if (familyShare >= 0.46) return Math.min(1, targetCount);
    if (familyShare >= 0.32) return Math.min(2, targetCount);
    if (familyShare >= 0.22) return Math.min(3, targetCount);
    return targetCount;
  }

  function getGeneratedGeographicRegionClusterConfig(family) {
    const configs = {
      lowland: { minClusterSize: 34, minCoreSize: 10, qualityRadius: 1, priority: 2.4, splitThreshold: 120, splitTargetSize: 58, splitAttempts: 4 },
      woodland: { minClusterSize: 42, minCoreSize: 12, qualityRadius: 1, priority: 2.7, splitThreshold: 140, splitTargetSize: 72, splitAttempts: 4 },
      wetland: { minClusterSize: 18, minCoreSize: 6, qualityRadius: 1, priority: 7.2, mergeDistance: 4 },
      snow: { minClusterSize: 16, minCoreSize: 5, qualityRadius: 1, priority: 6.8, mergeDistance: 3, splitThreshold: 110, splitTargetSize: 48, splitAttempts: 4 },
      highland: { minClusterSize: 24, minCoreSize: 7, qualityRadius: 1, priority: 5.2, mergeDistance: 3, splitThreshold: 96, splitTargetSize: 52, splitAttempts: 4 },
      desert: { minClusterSize: 24, minCoreSize: 7, qualityRadius: 1, priority: 4.8, mergeDistance: 3 },
      barrens: { minClusterSize: 24, minCoreSize: 7, qualityRadius: 1, priority: 4.4, mergeDistance: 3 },
      jungle: { minClusterSize: 38, minCoreSize: 12, qualityRadius: 1, priority: 3.8, mergeDistance: 3, splitThreshold: 130, splitTargetSize: 70, splitAttempts: 4 },
      inland_water: { minClusterSize: 12, minCoreSize: 4, qualityRadius: 1, priority: 5.4, mergeDistance: 2 },
      marine: { minClusterSize: 24, minCoreSize: 7, qualityRadius: 1, priority: 4.2, mergeDistance: 2, splitThreshold: 70, splitTargetSize: 56, splitAttempts: 7 }
    };
    return configs[family] || null;
  }

  function isGeneratedGeographicRegionClusterEligible(cluster, coreHexes, config, totalEligibleHexes, familyHexCount, family = "") {
    if (cluster.length < config.minClusterSize || coreHexes.length < config.minCoreSize) return false;
    const familyShare = totalEligibleHexes > 0 ? familyHexCount / totalEligibleHexes : 0;
    const clusterShare = totalEligibleHexes > 0 ? cluster.length / totalEligibleHexes : 0;
    const familyClusterShare = familyHexCount > 0 ? cluster.length / familyHexCount : 0;
    if (family === "marine") return clusterShare <= 0.58;
    if (clusterShare > getGeneratedGeographicRegionMaxClusterShare(familyShare)) return false;
    if (familyShare >= 0.38 && familyClusterShare > 0.52) return false;
    return true;
  }

  function getGeneratedGeographicRegionMaxClusterShare(familyShare) {
    if (familyShare >= 0.46) return 0.16;
    if (familyShare >= 0.32) return 0.20;
    if (familyShare >= 0.22) return 0.26;
    return 0.34;
  }

  function getGeneratedGeographicRegionQualityHexes(cluster, family, config) {
    return filterGeneratedGeographicRegionQualityHexes(cluster, family, config.qualityRadius || 1);
  }

  function filterGeneratedGeographicRegionQualityHexes(cluster, family, qualityRadius = 1) {
    const clusterIds = new Set(cluster.map(hex => hex.id));
    return cluster.filter(hex => {
      if (getOuterMapEdge(hex)) return false;
      const nearby = nearbyHexesWithin(hex, qualityRadius);
      const sameFamilyCount = nearby.filter(nearbyHex => clusterIds.has(nearbyHex.id) && getGeneratedGeographicRegionFamily(nearbyHex) === family).length;
      return sameFamilyCount >= Math.min(4, nearby.length);
    });
  }

  function chooseGeneratedGeographicRegionClusterSeed(coreHexes, family, seedBase) {
    return [...coreHexes]
      .sort((left, right) => {
        const leftScore = getGeneratedGeographicRegionCoreScore(left, family, seedBase);
        const rightScore = getGeneratedGeographicRegionCoreScore(right, family, seedBase);
        return rightScore - leftScore || left.id.localeCompare(right.id);
      })[0] || coreHexes[0];
  }

  function getGeneratedGeographicRegionCoreScore(hex, family, seedBase) {
    const sameNearby = nearbyHexesWithin(hex, 2)
      .filter(candidate => getGeneratedGeographicRegionFamily(candidate) === family)
      .length;
    return sameNearby
      + Math.min(2, Number(hex.elevation || 0) * 0.16)
      + seededUnit(`${seedBase}:cluster-seed:${family}:${hex.id}`) * 1.8;
  }

  function getGeneratedGeographicRegionClusterScore(cluster, coreHexes, family, seedBase) {
    const config = getGeneratedGeographicRegionClusterConfig(family) || { priority: 1 };
    const sizeScore = Math.min(420, cluster.length * 6);
    const coreScore = Math.min(260, coreHexes.length * 9);
    const seedScore = seededUnit(`${seedBase}:cluster:${family}:${coreHexes[0]?.id || cluster[0]?.id || ""}`) * 16;
    return config.priority * 1000 + sizeScore + coreScore + seedScore;
  }

  function getGeneratedGeographicRegionFamily(hex) {
    const base = String(hex?.baseTerrain || "").toLowerCase();
    const features = new Set((hex?.features || []).map(feature => String(feature || "").toLowerCase()));
    if (base === "deep_sea" || base === "sea" || base === "coastal_water") return "marine";
    if (base === "inland_water") return "inland_water";
    const rangeFeatures = ["mountains", "mountains_snow", "snowcapped_mountains", "lone_mountain", "ridges", "cliffs", "volcano"];
    if (["rock", "volcanic", "ashland"].includes(base) || rangeFeatures.some(feature => features.has(feature)) || (Number(hex?.elevation || 0) >= 4 && base !== "snow")) return "highland";
    if (base === "snow" || features.has("ice")) return "snow";
    if (base === "desert" || base === "deep_desert") return "desert";
    if (base === "bleak_barrens" || base === "barrens" || base === "wastes") return "barrens";
    if (base === "wetland" || features.has("marsh")) return "wetland";
    if (base === "jungle_floor" || features.has("jungle")) return "jungle";
    if (features.has("forest") || features.has("woods") || base === "lush_grassland") return "woodland";
    return "lowland";
  }

  function buildGeneratedGeographicRegionName(family, seedHex, seedBase, index, usedNames, cluster = null) {
    const nameParts = {
      lowland: ["Greenvale", "Meadowmarch", "Sunfield", "Lowmere", "Brightmead", "Goldfield", "Southvale", "Windplain", "Hearthvale", "Amberlea", "Greenmarch", "Fairmeadow"],
      woodland: ["Thornwood", "Greenwold", "Elderbough", "Wildgrove", "Oakmere", "Ashenwood", "Pinewold", "Deepbough", "Briarglen", "Wolfswood", "Greenholt", "The Oldwood"],
      wetland: ["Reedmere", "Mossfen", "Mistmarsh", "Blackfen", "Greyfen", "Siltmere", "Fenreach", "Mirewold", "Lowmire", "Reedwater", "Duskfen", "Marshmere"],
      jungle: ["Verdant Deep", "Emerald Wilds", "Vinewold", "Greenhollow", "The Greendeep", "Rainwold", "Vinefall", "Jadewild", "Canopy Reach", "Rootmere", "Gloomgreen", "The Deep Canopy"],
      highland: ["Stonewold", "Highcrag", "Ironridge", "Greyspine", "Stormridge", "Cloudcrag", "Oldpeak", "Stoneback", "Frostspine", "Blackridge", "The High Teeth", "Embercrag"],
      snow: ["Frostmere", "Whitewold", "Snowreach", "Rimefield", "Wintermere", "Pale Reach", "Icewold", "Frostmarch", "Whitebarrow", "Coldmead", "Rimevale", "Snowmere"],
      desert: ["Sunglass Expanse", "Amber Waste", "Dunereach", "Goldbarrow", "Sunscar", "The Brass Flats", "Dunefield", "Ashdune", "Redglass", "Windreach", "Saltplain", "Cinderwaste"],
      barrens: ["Ashen March", "Grey Barrens", "Bleakwold", "Dustreach", "Stonewaste", "The Old Scars", "Cairnfield", "Ruinmarch", "Blackbarrow", "Drymere", "Wraithfield", "The Grey Reach"],
      inland_water: ["Blueglass Mere", "Stillmere", "Mirrorwater", "Reedwater", "Willowmere", "Glassmere", "Moonmere", "Silverpond", "Frogwater", "Lake Aurel", "Lake Windmere", "Brightwater Lake"],
      inland_water_large: ["Inner Sea", "Brightwater Sea", "Blueglass Sea", "Silvermere", "The Great Mere", "Reedwater Sea", "Lake Aurel", "Lake Windmere", "The Mirror Sea", "Stillwater Sea"],
      marine: ["Greysea", "Bluewater", "Saltreach", "Windsea", "Deepwater", "Farwater", "The Sapphire Sea", "Outer Sea", "Stormreach", "Dawnwater", "Whitewake Sea", "The Long Blue", "Gulf of Glass", "Blackwater", "Western Ocean", "Eastern Ocean", "Starfall Sea", "Tideward Sea"]
    };
    const hexCount = Array.isArray(cluster?.hexIds) ? cluster.hexIds.length : 0;
    const pool = family === "inland_water" && hexCount >= 34 ? nameParts.inland_water_large : (nameParts[family] || nameParts.lowland);
    const start = stableHash(`${seedBase}:name:${seedHex.id}:${index}`) % pool.length;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(start + offset) % pool.length];
      if (!usedNames.has(candidate.toLowerCase())) {
        usedNames.add(candidate.toLowerCase());
        return candidate;
      }
    }
    const fallback = `${pool[start]} ${index + 1}`;
    usedNames.add(fallback.toLowerCase());
    return fallback;
  }

  function chooseGeneratedGeographicRegionColor(family, seedBase, index, usedColors) {
    const palettes = {
      lowland: ["#8fbf57", "#b6bd5f", "#d0b85f", "#74a85a"],
      woodland: ["#3f8f49", "#2f7650", "#5d9443", "#4d7f3f"],
      wetland: ["#3e7067", "#4f867a", "#547e5b", "#386d63"],
      jungle: ["#2f855a", "#247245", "#3e8a4e", "#2d6f52"],
      highland: ["#8a7f70", "#776f63", "#9a8468", "#6f746f"],
      snow: ["#9fc8d3", "#b9d4dd", "#d8e4e8", "#aabdc9"],
      desert: ["#d1a24f", "#c78f42", "#d0b066", "#b9843c"],
      barrens: ["#a66c52", "#8f6f5d", "#b07a55", "#8a7469"],
      inland_water: ["#4f9ab0", "#5aa8b8", "#3d8fa8", "#6baebd"],
      marine: ["#245f82", "#2b6d8e", "#1f5878", "#346f8a", "#123953", "#0b304a"]
    };
    const pool = palettes[family] || palettes.lowland;
    const start = stableHash(`${seedBase}:color:${family}:${index}`) % pool.length;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(start + offset) % pool.length];
      if (!usedColors.has(candidate.toLowerCase())) {
        usedColors.add(candidate.toLowerCase());
        return candidate;
      }
    }
    const fallback = pool[start];
    usedColors.add(fallback.toLowerCase());
    return fallback;
  }

  async function runGenerationPoiPass() {
    const campaign = getActiveCampaign?.();
    const generator = window.CampaignGeneratedMapGenerator;
    if (!campaign || renderer.drawing.saving || !generator?.generatePoiDrafts) return;
    if (!await confirmPoiGeneration()) return;
    let loadingLocked = false;

    try {
      lockLoadingVeil();
      loadingLocked = true;
      if (!await ensurePoiGenerationRiverBackdrop()) return;
      const existingPois = Array.isArray(db?.raw?.pois) ? db.raw.pois : [];
      const replaceGeneratedPois = Boolean(renderer.drawing.generationReplaceGeneratedPois);
      let purgedGeneratedPoiHistory = [];
      let purgedGeneratedGroupHistory = [];
      const drafts = generator.generatePoiDrafts({
        ...getPoiGeneratorOptions(campaign.id),
        hexes: renderer.hexes,
        existingPois: replaceGeneratedPois
          ? existingPois.filter(poi => !poi?.Generation_Source)
          : existingPois,
        mapOverlays: renderer.mapOverlays || []
      });

      if (!drafts.length) {
        window.alert?.("No new POIs could be generated from the current map state.");
        return;
      }

      if (replaceGeneratedPois) {
        const purgeResult = await purgePois({
          generatedOnly: true,
          skipConfirm: true,
          silentIfEmpty: true,
          showSuccessAlert: false,
          deferHistory: true
        });
        if (purgeResult?.success === false) return;
        purgedGeneratedPoiHistory = Array.isArray(purgeResult?.historyPois) ? purgeResult.historyPois : [];
        purgedGeneratedGroupHistory = Array.isArray(purgeResult?.historyGroups) ? purgeResult.historyGroups : [];
      }

      const result = await persistGeneratedPois(campaign.id, drafts, { showSuccessAlert: false });
      const historyPois = [
        ...purgedGeneratedPoiHistory.map(poi => ({ ...poi, __undoDeleted: true })),
        ...((result?.historyPois || []).map(poi => ({ ...poi, __undoDeleted: false })))
      ];
      const historyGroups = purgedGeneratedGroupHistory.map(group => ({ ...group, __undoDeleted: true }));
      const poiHistoryAction = (historyPois.length || historyGroups.length)
        ? { type: "poi", pois: historyPois, groups: historyGroups }
        : null;
      let farmlandHistoryAction = null;
      if (result?.success) {
        try {
          const farmlandResult = await regenerateGeneratedFarmlandOverlays(campaign.id, {
            pois: Array.isArray(db?.raw?.pois) ? db.raw.pois : [],
            replaceExisting: replaceGeneratedPois
          });
          if (Array.isArray(farmlandResult?.historyOverlays) && farmlandResult.historyOverlays.length) {
            farmlandHistoryAction = {
              type: "overlay",
              overlays: farmlandResult.historyOverlays
            };
          }
        } catch (error) {
          if (poiHistoryAction) pushMapEditAction(poiHistoryAction);
          throw error;
        }
      }
      const historyActions = [poiHistoryAction, farmlandHistoryAction].filter(Boolean);
      if (historyActions.length === 1) pushMapEditAction(historyActions[0]);
      else if (historyActions.length > 1) pushMapEditAction({ type: "batch", actions: historyActions });
      if (!result?.success) return;
      const summary = `Generated ${result.createdCount} POIs: ${result.settlementCount} settlement${result.settlementCount === 1 ? "" : "s"}, ${result.strongholdCount} stronghold${result.strongholdCount === 1 ? "" : "s"}, ${result.dungeonComplexCount} dungeon complex${result.dungeonComplexCount === 1 ? "" : "es"}, ${result.dungeonCount} dungeon${result.dungeonCount === 1 ? "" : "s"}, ${result.siteCount} place${result.siteCount === 1 ? "" : "s"} of note, ${result.resourceCount} resource site${result.resourceCount === 1 ? "" : "s"}, and ${result.waypointCount} waypoint${result.waypointCount === 1 ? "" : "s"}.`;
      await maybeGenerateRoadsAfterPoiGeneration(summary);
    } catch (error) {
      console.error("Unable to prepare generated POIs:", error);
      window.alert?.(error?.message || "Unable to generate POIs.");
    } finally {
      if (loadingLocked) unlockLoadingVeil();
    }
  }

  function removePoiFromLocalDbFallback(poiUuid) {
    const poi = (db?.raw?.pois || []).find(row => row?.__uuid === poiUuid);
    if (!poi) return;

    db.raw.pois = (db.raw.pois || []).filter(row => row?.__uuid !== poiUuid);
    if (db.poisById) delete db.poisById[poi.POI_ID];

    if (poi.Hex_ID_Ref && Array.isArray(db.poisByHexId?.[poi.Hex_ID_Ref])) {
      db.poisByHexId[poi.Hex_ID_Ref] = db.poisByHexId[poi.Hex_ID_Ref]
        .filter(row => row.POI_ID !== poi.POI_ID);
    }
    if (poi.POI_Group_ID && Array.isArray(db.poisByGroupId?.[poi.POI_Group_ID])) {
      db.poisByGroupId[poi.POI_Group_ID] = db.poisByGroupId[poi.POI_Group_ID]
        .filter(row => row.POI_ID !== poi.POI_ID);
    }

    (db?.raw?.npcs || []).forEach(npc => {
      if (npc.Home_ID_Ref === poi.POI_ID) npc.Home_ID_Ref = "";
    });
    Object.values(db?.npcsById || {}).forEach(npc => {
      if (npc.Home_ID_Ref === poi.POI_ID) npc.Home_ID_Ref = "";
    });
    db.npcsByHomeId = {};
    (db?.raw?.npcs || []).forEach(npc => {
      if (!npc.Home_ID_Ref) return;
      if (!db.npcsByHomeId[npc.Home_ID_Ref]) db.npcsByHomeId[npc.Home_ID_Ref] = [];
      db.npcsByHomeId[npc.Home_ID_Ref].push(npc);
    });
  }

  function removePoiGroupFromLocalDbFallback(groupUuid) {
    const group = (db?.raw?.poiGroups || []).find(row => row?.__uuid === groupUuid);
    if (!group) return;

    db.raw.poiGroups = (db.raw.poiGroups || []).filter(row => row?.__uuid !== groupUuid);
    if (db.poiGroupsById) delete db.poiGroupsById[group.POI_Group_ID];
    if (db.poisByGroupId?.[group.POI_Group_ID]) delete db.poisByGroupId[group.POI_Group_ID];
    Object.values(db.poisById || {}).forEach(poi => {
      if (poi.POI_Group_ID === group.POI_Group_ID) poi.POI_Group_ID = "";
    });
  }

  function refreshPoiViewsAfterPurgeFallback() {
    refreshPoiLayerFromDatabase();
    const currentPage = typeof getCurrentCodexPage === "function" ? getCurrentCodexPage() : null;
    if (currentPage?.type === "poi") {
      renderCodexPage?.(db?.poisById?.[currentPage.id] ? "poi" : "pois", db?.poisById?.[currentPage.id] ? currentPage.id : null);
      fitCodexHeaderText?.();
      updateCodexBackButton?.();
      return;
    }
    if (currentPage?.type === "poi-group") {
      renderCodexPage?.(db?.poiGroupsById?.[currentPage.id] ? "poi-group" : "pois", db?.poiGroupsById?.[currentPage.id] ? currentPage.id : null);
      fitCodexHeaderText?.();
      updateCodexBackButton?.();
      return;
    }
    if (currentPage?.type === "pois") {
      renderCodexPage?.("pois", null);
      fitCodexHeaderText?.();
      updateCodexBackButton?.();
      return;
    }
    if (currentPage?.type === "hex" || currentPage?.type === "npc") {
      renderCodexPage?.(currentPage.type, currentPage.id);
      fitCodexHeaderText?.();
      updateCodexBackButton?.();
      return;
    }
    window.renderPoiListIntoContainer?.();
  }

  async function purgePois(options = {}) {
    const generatedOnly = options.generatedOnly === true;
    const skipConfirm = options.skipConfirm === true;
    const silentIfEmpty = options.silentIfEmpty === true;
    const showSuccessAlert = options.showSuccessAlert !== false;
    const deferHistory = options.deferHistory === true;
    const campaign = getActiveCampaign?.();
    if (!campaign || renderer.drawing.saving) return { success: false, cancelled: true };

    const poiRows = Array.isArray(db?.raw?.pois)
      ? db.raw.pois.filter(poi => !generatedOnly || poi?.Generation_Source).map(poi => ({ ...poi }))
      : [];
    const groupRows = Array.isArray(db?.raw?.poiGroups)
      ? db.raw.poiGroups.filter(group => !generatedOnly || group?.Generation_Source).map(group => ({ ...group }))
      : [];
    const totalCount = poiRows.length + groupRows.length;
    if (!totalCount) {
      if (!silentIfEmpty) {
        window.alert?.(generatedOnly ? "There are no generated POIs to purge." : "There are no saved POIs to purge.");
      }
      return { success: true, empty: true, deletedPoiCount: 0, deletedGroupCount: 0 };
    }

    const poiLabel = `${poiRows.length} ${generatedOnly ? "generated " : ""}POI${poiRows.length === 1 ? "" : "s"}`;
    const groupLabel = groupRows.length ? ` and ${groupRows.length} ${generatedOnly ? "generated " : ""}grouped POI${groupRows.length === 1 ? "" : "s"}` : "";
    const message = generatedOnly
      ? `Purge all saved ${poiLabel}${groupLabel} from the live map and codex immediately? Manually created POIs will be kept.`
      : `Purge all saved ${poiLabel}${groupLabel} from the live map and codex immediately? You can undo this from the editor.`;
    if (!skipConfirm && !await confirmNukeAction(message)) return { success: false, cancelled: true };

    const removeLocalPoi = window.CampaignCodexPoiMutations?.removePoiByUuidFromLocalDb || removePoiFromLocalDbFallback;
    const removeLocalPoiGroup = window.CampaignCodexPoiMutations?.removePoiGroupByUuidFromLocalDb || removePoiGroupFromLocalDbFallback;
    const refreshPoiViews = window.CampaignCodexPoiMutations?.refreshPoiViewsAfterPurge || refreshPoiViewsAfterPurgeFallback;

    renderer.drawing.saving = true;
    const showBulkLoading = totalCount >= 8;
    if (showBulkLoading) setLoading(true);
    refreshEditorPreviewControls();

    let deletedPoiCount = 0;
    let deletedGroupCount = 0;
    try {
      for (const poi of poiRows) {
        if (!poi?.__uuid) continue;
        const { error } = await campaignSupabase.rpc("delete_campaign_record", {
          target_campaign_id: campaign.id,
          target_record_type: "poi",
          target_record_id: poi.__uuid
        });
        if (error) throw error;
        removeLocalPoi?.(poi.__uuid);
        deletedPoiCount += 1;
      }

      for (const group of groupRows) {
        if (!group?.__uuid) continue;
        const { error } = await campaignSupabase.rpc("delete_campaign_record", {
          target_campaign_id: campaign.id,
          target_record_type: "poi_group",
          target_record_id: group.__uuid
        });
        if (error) throw error;
        removeLocalPoiGroup?.(group.__uuid);
        deletedGroupCount += 1;
      }

      refreshPoiViews?.();
      const poiHistory = getPoiHistoryRecords(poiRows, { undoDeleted: true });
      const groupHistory = getPoiGroupHistoryRecords(groupRows, { undoDeleted: true });
      if (!deferHistory && (poiHistory.length || groupHistory.length)) {
        pushMapEditAction({
          type: "poi",
          purgeAction: true,
          pois: poiHistory,
          groups: groupHistory
        });
      }
      const successSummary = deletedGroupCount
        ? `${deletedPoiCount} ${generatedOnly ? "generated " : ""}POI${deletedPoiCount === 1 ? "" : "s"} and ${deletedGroupCount} ${generatedOnly ? "generated " : ""}grouped POI${deletedGroupCount === 1 ? "" : "s"}`
        : `${deletedPoiCount} ${generatedOnly ? "generated " : ""}POI${deletedPoiCount === 1 ? "" : "s"}`;
      if (showSuccessAlert) window.alert?.(`Purged ${successSummary}.`);
      return {
        success: true,
        deletedPoiCount,
        deletedGroupCount,
        historyPois: poiHistory,
        historyGroups: groupHistory
      };
    } catch (error) {
      console.error(`Unable to purge ${generatedOnly ? "generated " : ""}POIs:`, error);
      if (deletedPoiCount || deletedGroupCount) {
        refreshPoiViews?.();
      }
      const deletedSummary = (deletedPoiCount || deletedGroupCount)
        ? (deletedGroupCount
          ? ` ${deletedPoiCount} ${generatedOnly ? "generated " : ""}POI${deletedPoiCount === 1 ? "" : "s"} and ${deletedGroupCount} ${generatedOnly ? "generated " : ""}grouped POI${deletedGroupCount === 1 ? "" : "s"} were purged before the error.`
          : ` ${deletedPoiCount} ${generatedOnly ? "generated " : ""}POI${deletedPoiCount === 1 ? "" : "s"} were purged before the error.`)
        : "";
      window.alert?.(`${error?.message || `Unable to purge ${generatedOnly ? "generated " : ""}POIs.`}${deletedSummary}`);
      return { success: false, deletedPoiCount, deletedGroupCount, error };
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorPreviewControls();
    }
  }

  async function confirmOverlayGeneration(type, label) {
    const existing = (renderer.mapOverlays || [])
      .filter(overlay => !overlay.__preview && overlay.Overlay_Type === type && overlay.To_Hex_ID_Ref)
      .length;
    if (!existing) return true;
    return showMapConfirm(`Generate ${label} on top of ${existing} existing saved ${label} segment${existing === 1 ? "" : "s"}? This saves new overlays to the live map immediately.`, {
      title: "Generate Overlays?",
      confirmLabel: "Generate"
    });
  }

  async function confirmPoiGeneration() {
    const existing = (db?.raw?.pois || []).length;
    if (!existing) return true;
    const replaceGeneratedPois = Boolean(renderer.drawing.generationReplaceGeneratedPois);
    const message = replaceGeneratedPois
      ? "Replace existing generated POIs and farmland overlays before creating new POIs? Manually created POIs will be kept, and new POIs still save directly to the live map."
      : `Generate new POIs on top of ${existing} existing saved POI${existing === 1 ? "" : "s"}? This saves directly to the live map and avoids occupied hexes when possible.`;
    return showMapConfirm(message, {
      title: replaceGeneratedPois ? "Replace POIs?" : "Generate POIs?",
      confirmLabel: replaceGeneratedPois ? "Replace POIs" : "Generate"
    });
  }

  function hasSavedRiverOverlays() {
    return (renderer.mapOverlays || []).some(overlay => (
      !overlay?.__preview &&
      String(overlay?.Overlay_Type || "").toLowerCase() === "river" &&
      (overlay?.Hex_ID_Ref || overlay?.From_Hex_ID_Ref || overlay?.To_Hex_ID_Ref)
    ));
  }

  function countSavedOverlaySegmentsByType(type) {
    return (renderer.mapOverlays || [])
      .filter(overlay => (
        !overlay?.__preview &&
        String(overlay?.Overlay_Type || "").toLowerCase() === String(type || "").toLowerCase() &&
        overlay?.To_Hex_ID_Ref
      ))
      .length;
  }

  async function maybeGenerateRoadsAfterPoiGeneration(summary) {
    const existingRoads = countSavedOverlaySegmentsByType("road");
    if (existingRoads > 0) {
      const shouldReplaceRoads = await showMapConfirm(
        `${summary}\n\nReplace ${existingRoads} existing saved road segment${existingRoads === 1 ? "" : "s"} so the road network fits the newly generated POIs?`,
        {
          title: "Replace Roads?",
          confirmLabel: "Replace Roads",
          cancelLabel: "Not Now"
        }
      );
      if (!shouldReplaceRoads) return;
      const purged = await purgeSavedOverlayType("road", { skipConfirm: true, showSuccessAlert: false });
      if (!purged) return;
      await runGenerationRoadPass({ skipConfirm: true });
      return;
    }

    const shouldGenerateRoads = await showMapConfirm(
      `${summary}\n\nGenerate roads now from the current settlement backbone?`,
      {
        title: "Generate Roads Now?",
        confirmLabel: "Generate Roads",
        cancelLabel: "Not Now"
      }
    );
    if (shouldGenerateRoads) {
      await runGenerationRoadPass({ skipConfirm: true });
    }
  }

  async function ensurePoiGenerationRiverBackdrop() {
    if (hasSavedRiverOverlays()) return true;
    const generateFirst = await showMapConfirm(
      "POI generation works best with rivers already generated or drawn. Generate rivers first?",
      {
        title: "Generate Rivers First?",
        confirmLabel: "Generate Rivers First",
        cancelLabel: "More Options"
      }
    );
    if (generateFirst) {
      return await runGenerationRiverPass({ skipConfirm: true }) === true;
    }
    return showMapConfirm(
      "Continue POI generation without rivers? Settlements will lean more on coasts, lakes, and broad terrain fertility.",
      {
        title: "Continue Without Rivers?",
        confirmLabel: "Continue",
        cancelLabel: "Cancel"
      }
    );
  }

  function adaptGeneratedPoiRpcRow(row) {
    const record = Array.isArray(row) ? row[0] : row;
    if (!record?.id || !record?.ref_code) return null;
    return {
      __uuid: record.id,
      POI_ID: record.ref_code,
      POI_Group_ID: db?.raw?.poiGroups?.find(group => group.__uuid === record.poi_group_id)?.POI_Group_ID || "",
      Name: record.name || "",
      Hex_ID_Ref: db?.raw?.hexes?.find(hex => hex.__uuid === record.hex_id)?.Hex_ID || "",
      POI_Type: window.CampaignPoiTypes?.getTypeLabel?.(record.poi_type) || record.poi_type || "",
      POI_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(record.poi_type) || record.poi_type || "",
      POI_Icon: record.poi_icon || "",
      POI_Tags: Array.isArray(record.poi_tags) ? record.poi_tags.filter(Boolean) : [],
      Generation_Source: record.generation_source || "",
      "Notoriety Tier": window.CampaignPoiTypes?.getNotorietyLabel?.(record.notoriety_tier) || record.notoriety_tier || "",
      "Notoriety Tier_Value": window.CampaignPoiTypes?.getStoredNotorietyValue?.(record.notoriety_tier) || record.notoriety_tier || "",
      Population: record.population || "",
      Lore: record.lore || "",
      Image: ""
    };
  }

  function buildPoiHistoryRecord(poi, options = {}) {
    if (!poi?.Hex_ID_Ref) return null;
    const storedType = window.CampaignPoiTypes?.getStoredTypeValue?.(poi.POI_Type_Value || poi.POI_Type || "")
      || poi.POI_Type_Value
      || poi.POI_Type
      || "";
    const storedNotoriety = window.CampaignPoiTypes?.getStoredNotorietyValue?.(poi["Notoriety Tier_Value"] || poi["Notoriety Tier"] || "")
      || poi["Notoriety Tier_Value"]
      || poi["Notoriety Tier"]
      || "";
    return {
      __uuid: poi.__uuid || "",
      POI_ID: poi.POI_ID || "",
      POI_Group_ID: poi.POI_Group_ID || "",
      Name: poi.Name || "",
      Hex_ID_Ref: poi.Hex_ID_Ref || "",
      POI_Type_Value: storedType,
      POI_Icon: poi.POI_Icon || "",
      POI_Tags: Array.isArray(poi.POI_Tags) ? [...poi.POI_Tags] : [],
      Generation_Source: poi.Generation_Source || "",
      "Notoriety Tier_Value": storedNotoriety,
      Population: poi.Population || "",
      Lore: poi.Lore || "",
      __undoDeleted: options.undoDeleted === true
    };
  }

  function getPoiHistoryRecords(rows, options = {}) {
    const list = Array.isArray(rows) ? rows : [rows];
    return list
      .map(poi => buildPoiHistoryRecord(poi, options))
      .filter(Boolean);
  }

  function buildPoiGroupHistoryRecord(group, options = {}) {
    if (!group?.POI_Group_ID) return null;
    const storedType = window.CampaignPoiTypes?.getStoredTypeValue?.(group.Group_Type_Value || group.Group_Type || "")
      || group.Group_Type_Value
      || group.Group_Type
      || "";
    return {
      __uuid: group.__uuid || "",
      POI_Group_ID: group.POI_Group_ID || "",
      POI_Group_Name: group.POI_Group_Name || "",
      Group_Type_Value: storedType,
      Group_Icon: group.Group_Icon || "",
      Group_Tags: Array.isArray(group.Group_Tags) ? [...group.Group_Tags] : [],
      Generation_Source: group.Generation_Source || "",
      Population: group.Population || "",
      Lore: group.Lore || "",
      __undoDeleted: options.undoDeleted === true
    };
  }

  function getPoiGroupHistoryRecords(rows, options = {}) {
    const list = Array.isArray(rows) ? rows : [rows];
    return list
      .map(group => buildPoiGroupHistoryRecord(group, options))
      .filter(Boolean);
  }

  function serializePoiSnapshot(rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    return list
      .filter(poi => poi?.Hex_ID_Ref)
      .map((poi, index) => ({
        snapshot_order: index + 1,
        ref_code: poi.POI_ID || "",
        name: poi.Name || "",
        hex_ref: poi.Hex_ID_Ref || "",
        group_ref: poi.POI_Group_ID || "",
        poi_type: poi.POI_Type_Value || poi.POI_Type || "",
        poi_icon: poi.POI_Icon || "",
        poi_tags: Array.isArray(poi.POI_Tags) ? [...poi.POI_Tags] : [],
        notoriety_tier: poi["Notoriety Tier_Value"] || poi["Notoriety Tier"] || "",
        population: poi.Population || "",
        lore: poi.Lore || "",
        generation_source: poi.Generation_Source || ""
      }));
  }

  function serializePoiGroupSnapshot(rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    return list
      .filter(group => group?.POI_Group_ID)
      .map((group, index) => ({
        snapshot_order: index + 1,
        group_ref: group.POI_Group_ID || "",
        name: group.POI_Group_Name || "",
        group_type: group.Group_Type_Value || group.Group_Type || "",
        group_icon: group.Group_Icon || "",
        group_tags: Array.isArray(group.Group_Tags) ? [...group.Group_Tags] : [],
        generation_source: group.Generation_Source || "",
        population: group.Population || "",
        lore: group.Lore || ""
      }));
  }

  function resolvePoiHexUuid(hexRef) {
    return db?.hexesById?.[hexRef]?.__uuid
      || db?.raw?.hexes?.find(hex => hex.Hex_ID === hexRef)?.__uuid
      || "";
  }

  function resolvePoiHistoryUuid(poi) {
    const uuid = poi?.__uuid || "";
    if (uuid && (db?.raw?.pois || []).some(row => row?.__uuid === uuid)) return uuid;
    const refCode = String(poi?.POI_ID || "").trim();
    if (!refCode) return uuid;
    return (db?.raw?.pois || []).find(row => row?.POI_ID === refCode)?.__uuid || uuid;
  }

  function resolvePoiGroupUuid(groupRef) {
    return db?.poiGroupsById?.[groupRef]?.__uuid
      || db?.raw?.poiGroups?.find(group => group.POI_Group_ID === groupRef)?.__uuid
      || null;
  }

  function addGeneratedPoiToLocalDb(poi) {
    if (!poi?.POI_ID || !db?.raw) return;
    if (!Array.isArray(db.raw.pois)) db.raw.pois = [];
    if (!db.poisById) db.poisById = {};
    if (!db.poisByHexId) db.poisByHexId = {};
    if (!db.poisByGroupId) db.poisByGroupId = {};

    const existing = db.poisById[poi.POI_ID] || null;
    if (existing?.Hex_ID_Ref && Array.isArray(db.poisByHexId[existing.Hex_ID_Ref])) {
      db.poisByHexId[existing.Hex_ID_Ref] = db.poisByHexId[existing.Hex_ID_Ref].filter(candidate => candidate.POI_ID !== poi.POI_ID);
    }
    if (existing?.POI_Group_ID && Array.isArray(db.poisByGroupId[existing.POI_Group_ID])) {
      db.poisByGroupId[existing.POI_Group_ID] = db.poisByGroupId[existing.POI_Group_ID].filter(candidate => candidate.POI_ID !== poi.POI_ID);
    }

    const existingIndex = db.raw.pois.findIndex(candidate => candidate.POI_ID === poi.POI_ID || candidate.__uuid === poi.__uuid);
    if (existingIndex >= 0) db.raw.pois.splice(existingIndex, 1, poi);
    else db.raw.pois.push(poi);

    db.poisById[poi.POI_ID] = poi;
    if (poi.Hex_ID_Ref) {
      if (!Array.isArray(db.poisByHexId[poi.Hex_ID_Ref])) db.poisByHexId[poi.Hex_ID_Ref] = [];
      db.poisByHexId[poi.Hex_ID_Ref].push(poi);
    }
    if (poi.POI_Group_ID) {
      if (!Array.isArray(db.poisByGroupId[poi.POI_Group_ID])) db.poisByGroupId[poi.POI_Group_ID] = [];
      db.poisByGroupId[poi.POI_Group_ID].push(poi);
    }
  }

  function registerGeneratedPoiRowsInLocalDb(rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    const createdPois = list
      .map(adaptGeneratedPoiRpcRow)
      .filter(Boolean);
    createdPois.forEach(addGeneratedPoiToLocalDb);
    return createdPois;
  }

  function adaptPoiGroupRpcRow(row) {
    const record = Array.isArray(row) ? row[0] : row;
    if (!record?.id || !record?.slug) return null;
    return {
      __uuid: record.id,
      POI_Group_ID: record.slug,
      POI_Group_Name: record.name || "",
      Group_Type: window.CampaignPoiTypes?.getTypeLabel?.(record.group_type) || record.group_type || "",
      Group_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(record.group_type) || record.group_type || "",
      Group_Icon: record.group_icon || "",
      Group_Tags: Array.isArray(record.group_tags) ? record.group_tags.filter(Boolean) : [],
      Generation_Source: record.generation_source || "",
      Population: record.population || "",
      Lore: record.lore || "",
      Image: ""
    };
  }

  function addPoiGroupToLocalDb(group) {
    if (!group?.POI_Group_ID || !db?.raw) return;
    if (!Array.isArray(db.raw.poiGroups)) db.raw.poiGroups = [];
    if (!db.poiGroupsById) db.poiGroupsById = {};
    if (!db.poisByGroupId) db.poisByGroupId = {};

    const existingIndex = db.raw.poiGroups.findIndex(candidate => (
      candidate.POI_Group_ID === group.POI_Group_ID || candidate.__uuid === group.__uuid
    ));
    if (existingIndex >= 0) db.raw.poiGroups.splice(existingIndex, 1, group);
    else db.raw.poiGroups.push(group);

    db.poiGroupsById[group.POI_Group_ID] = group;
    if (!Array.isArray(db.poisByGroupId[group.POI_Group_ID])) db.poisByGroupId[group.POI_Group_ID] = [];
  }

  function registerPoiGroupRowsInLocalDb(rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    const createdGroups = list
      .map(adaptPoiGroupRpcRow)
      .filter(Boolean);
    createdGroups.forEach(addPoiGroupToLocalDb);
    return createdGroups;
  }

  async function recreatePoiFromHistoryRecord(campaignId, poi, registerCreatedPois) {
    const hexUuid = resolvePoiHexUuid(poi?.Hex_ID_Ref || "");
    if (!hexUuid) {
      throw new Error(`Unable to locate saved hex ${poi?.Hex_ID_Ref || ""} for POI undo/redo.`);
    }
    const groupUuid = poi?.POI_Group_ID ? resolvePoiGroupUuid(poi.POI_Group_ID) : null;

    const { data, error } = await campaignSupabase.rpc("create_poi_with_next_ref_code", {
      target_campaign_id: campaignId,
      poi_name: poi?.Name || "",
      poi_type: poi?.POI_Type_Value || "",
      poi_icon: poi?.POI_Icon || "",
      poi_hex_id: hexUuid,
      poi_tags: Array.isArray(poi?.POI_Tags) ? poi.POI_Tags : [],
      poi_notoriety_tier: poi?.["Notoriety Tier_Value"] || null,
      poi_population: poi?.Population || null,
      poi_lore: poi?.Lore || null,
      poi_generation_source: poi?.Generation_Source || null,
      poi_visibility: "shared",
      poi_group_id: groupUuid
    });
    if (error) throw error;
    const created = registerCreatedPois(data, { refresh: false });
    return (Array.isArray(created) ? created : [created]).filter(Boolean)[0] || null;
  }

  function previewGeneratedOverlayRoutes({ campaignId, routes, tool, style, routeMetadata, emptyMessage, existingKeyMode = "type" }) {
    discardOverlayPreviewType(tool, { silent: true });

    const segments = getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting: true, existingKeyMode });

    if (!segments.length) {
      window.alert?.(emptyMessage || "No new overlays were generated.");
      return;
    }

    const previewOverlays = segments.map(segment => createLocalOverlayRecord(segment, "preview"));
    ensureStagedOverlayBaseline();
    previewOverlays.forEach(upsertLocalOverlay);
    pushStagedMapEditAction({
      type: "overlay",
      previewSection: "overlays",
      previewOverlayType: tool,
      overlays: previewOverlays
    });
    markRouteCacheDirty();
    markOverlayCacheDirty();
    render();
    updateGenerationControls();
  }

  async function persistGeneratedOverlayRoutes({ campaignId, routes, tool, style, routeMetadata, emptyMessage, existingKeyMode = "type" }) {
    const existingOverlayIds = new Set((renderer.mapOverlays || []).map(overlay => overlay.__uuid).filter(Boolean));
    const segments = getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting: true, existingKeyMode });

    if (!segments.length) {
      window.alert?.(emptyMessage || "No new overlays were generated.");
      return false;
    }

    const saved = await persistGeneratedOverlaySegments(campaignId, segments, existingOverlayIds);
    return Array.isArray(saved) && saved.length > 0;
  }

  function getGeneratedOverlaySegments({ routes, tool, style, routeMetadata, skipExisting = true, existingKeyMode = "type" }) {
    const existingKeys = new Set((renderer.mapOverlays || [])
      .filter(overlay => !overlay.__preview && PATH_OVERLAY_TYPES.has(overlay.Overlay_Type) && overlay.From_Hex_ID_Ref && overlay.To_Hex_ID_Ref)
      .map(overlay => overlaySegmentExistingKey(
        overlay.Overlay_Type,
        overlay.From_Hex_ID_Ref,
        overlay.To_Hex_ID_Ref,
        {
          isMajorRoute: Boolean(overlay.Is_Major_Route),
          routeName: overlay.Route_Name || ""
        },
        existingKeyMode
      )));
    const existingEdgeKeys = new Set((renderer.mapOverlays || [])
      .filter(overlay => !overlay.__preview && PATH_OVERLAY_TYPES.has(overlay.Overlay_Type) && overlay.From_Hex_ID_Ref && overlay.Edge)
      .map(overlay => overlayEdgeExistingKey(
        overlay.Overlay_Type,
        overlay.From_Hex_ID_Ref,
        overlay.Edge,
        {
          isMajorRoute: Boolean(overlay.Is_Major_Route),
          routeName: overlay.Route_Name || ""
        },
        existingKeyMode
      )));
    const queuedKeys = new Set();
    const segments = [];

    routes.forEach(route => {
      const sequence = Array.isArray(route) ? route : route?.sequence || [];
      const routeTool = route && !Array.isArray(route) && route.tool ? route.tool : tool;
      const segmentRouteMetadata = getRouteMetadataForOverlayRoute(route, routeTool, routeMetadata);
      const routeStyle = route && !Array.isArray(route) && route.style
        ? route.style
        : style;
      if (route?.startEdge && sequence.length) {
        const fromHexId = sequence[0];
        const key = overlayEdgeExistingKey(routeTool, fromHexId, route.startEdge, segmentRouteMetadata, existingKeyMode);
        const queuedKey = `${routeTool}:${fromHexId}:edge:${route.startEdge}`;
        if (!(skipExisting && existingEdgeKeys.has(key)) && !queuedKeys.has(queuedKey)) {
          queuedKeys.add(queuedKey);
          segments.push({
            tool: routeTool,
            fromHexId,
            toHexId: null,
            edge: route.startEdge,
            style: routeStyle,
            routeMetadata: segmentRouteMetadata
          });
        }
      }
      sequence.slice(0, -1).forEach((fromHexId, index) => {
        const toHexId = sequence[index + 1];
        const segmentTool = getPersistedSegmentTool(routeTool, fromHexId, toHexId);
        const persistedRouteMetadata = getSegmentRouteMetadata(segmentTool, segmentRouteMetadata);
        const existingKey = overlaySegmentExistingKey(segmentTool, fromHexId, toHexId, persistedRouteMetadata, existingKeyMode);
        const queuedKey = overlaySegmentKey(segmentTool, fromHexId, toHexId);
        if ((skipExisting && existingKeys.has(existingKey)) || queuedKeys.has(queuedKey)) return;
        queuedKeys.add(queuedKey);
        segments.push({
          tool: segmentTool,
          fromHexId,
          toHexId,
          style: segmentTool === "sea_route" ? "sea_route" : routeStyle,
          routeMetadata: persistedRouteMetadata
        });
      });
      if (route?.exitEdge && sequence.length) {
        const fromHexId = sequence[sequence.length - 1];
        const key = overlayEdgeExistingKey(routeTool, fromHexId, route.exitEdge, segmentRouteMetadata, existingKeyMode);
        const queuedKey = `${routeTool}:${fromHexId}:edge:${route.exitEdge}`;
        if (!(skipExisting && existingEdgeKeys.has(key)) && !queuedKeys.has(queuedKey)) {
          queuedKeys.add(queuedKey);
          segments.push({
            tool: routeTool,
            fromHexId,
            toHexId: null,
            edge: route.exitEdge,
            style: routeStyle,
            routeMetadata: segmentRouteMetadata
          });
        }
      }
    });

    return segments;
  }

  async function persistGeneratedOverlaySegments(campaignId, segments, existingOverlayIds = new Set()) {
    renderer.drawing.saving = true;
    refreshEditorPreviewControls();

    const pendingOverlays = segments.map(segment => createLocalOverlayRecord(segment, "saving"));
    pendingOverlays.forEach(overlay => {
      overlay.__saving = true;
    });
    if (pendingOverlays.length) {
      upsertLocalOverlays(pendingOverlays);
      render();
    }

    let saved = [];
    try {
      const results = await Promise.allSettled(segments.map(segment => (
        savePathOverlaySegment(
          campaignId,
          segment.tool,
          segment.fromHexId,
          segment.toHexId,
          segment.style,
          segment.edge || null,
          segment.routeMetadata
        )
      )));
      const failed = results.find(result => result.status === "rejected");
      saved = results
        .filter(result => result.status === "fulfilled" && result.value)
        .map(result => result.value);

      removeLocalOverlaysById(pendingOverlays.map(overlay => overlay.__uuid));
      upsertLocalOverlays(saved);

      if (failed) {
        throw failed.reason;
      }

      pushOverlayUndoAction(saved.filter(overlay => !existingOverlayIds.has(overlay.__uuid)));
      render();
      return saved;
    } catch (error) {
      removeLocalOverlaysById(pendingOverlays.map(overlay => overlay.__uuid));
      pushOverlayUndoAction(saved.filter(overlay => !existingOverlayIds.has(overlay.__uuid)));
      if (saved.length) {
        upsertLocalOverlays(saved);
      }
      render();
      console.error("Unable to generate map overlays:", error);
      window.alert?.(error.message || "Unable to generate map overlays.");
      return [];
    } finally {
      renderer.drawing.saving = false;
      refreshEditorPreviewControls();
    }
  }

  async function persistGeneratedPois(campaignId, drafts, options = {}) {
    const showSuccessAlert = options.showSuccessAlert !== false;
    const registerCreatedPois = registerGeneratedPoiRowsInLocalDb;
    const refreshPoiViews = window.CampaignCodexPoiMutations?.refreshPoiViews || (() => {
      refreshPoiLayerFromDatabase();
    });

    const showBulkLoading = drafts.length >= 8;
    renderer.drawing.saving = true;
    if (showBulkLoading) setLoading(true);
    refreshEditorPreviewControls();

    let createdCount = 0;
    const createdPois = [];
    try {
      for (const draft of drafts) {
        const hexUuid = resolvePoiHexUuid(draft.hexId);
        if (!hexUuid) throw new Error(`Unable to locate generated hex ${draft.hexId} in this campaign.`);

        const { data, error } = await campaignSupabase.rpc("create_poi_with_next_ref_code", {
          target_campaign_id: campaignId,
          poi_name: draft.name,
          poi_type: draft.type,
          poi_icon: draft.icon,
          poi_hex_id: hexUuid,
          poi_tags: draft.tags || [],
          poi_notoriety_tier: draft.notoriety || null,
          poi_population: draft.population || null,
          poi_lore: draft.lore || null,
          poi_generation_source: "poi_generation_v1",
          poi_visibility: "shared",
          poi_group_id: null
        });

        if (error) throw error;

        const registered = registerCreatedPois(data, { refresh: false });
        const registeredList = (Array.isArray(registered) ? registered : [registered]).filter(Boolean);
        createdPois.push(...registeredList);
        createdCount += 1;
      }

      refreshPoiViews?.();
      const settlementCount = drafts.filter(draft => draft.type === "settlement").length;
      const strongholdCount = drafts.filter(draft => draft.type === "stronghold").length;
      const dungeonComplexCount = drafts.filter(draft => draft.type === "dungeon_complex").length;
      const dungeonCount = drafts.filter(draft => draft.type === "dungeon").length;
      const siteCount = drafts.filter(draft => ["ruin", "holy_site", "arcane_site", "wilderness_site", "hazard", "landmark"].includes(draft.type)).length;
      const resourceCount = drafts.filter(draft => draft.type === "resource_site").length;
      const waypointCount = drafts.filter(draft => draft.type === "waypoint").length;
      if (showSuccessAlert) {
        window.alert?.(`Generated ${createdCount} POIs: ${settlementCount} settlement${settlementCount === 1 ? "" : "s"}, ${strongholdCount} stronghold${strongholdCount === 1 ? "" : "s"}, ${dungeonComplexCount} dungeon complex${dungeonComplexCount === 1 ? "" : "es"}, ${dungeonCount} dungeon${dungeonCount === 1 ? "" : "s"}, ${siteCount} place${siteCount === 1 ? "" : "s"} of note, ${resourceCount} resource site${resourceCount === 1 ? "" : "s"}, and ${waypointCount} waypoint${waypointCount === 1 ? "" : "s"}.`);
      }
      return {
        success: true,
        createdCount,
        settlementCount,
        strongholdCount,
        dungeonComplexCount,
        dungeonCount,
        siteCount,
        resourceCount,
        waypointCount,
        historyPois: getPoiHistoryRecords(createdPois)
      };
    } catch (error) {
      console.error("Unable to generate POIs:", error);
      refreshPoiViews?.();
      const createdText = createdCount ? ` ${createdCount} POI${createdCount === 1 ? "" : "s"} were created before the error.` : "";
      window.alert?.(`${error.message || "Unable to generate POIs."}${createdText}`);
      return {
        success: false,
        createdCount,
        error,
        historyPois: getPoiHistoryRecords(createdPois)
      };
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorPreviewControls();
    }
  }

  function getStoredPoiTypeValue(poi) {
    return window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || poi?.POI_Type_Value || poi?.POI_Type || "";
  }

  function getStoredPoiIconValue(poi) {
    return window.CampaignPoiIcons?.getStoredIconValue?.(poi?.POI_Icon || "") || poi?.POI_Icon || "";
  }

  function getPoiTagSet(poi) {
    return new Set((Array.isArray(poi?.POI_Tags) ? poi.POI_Tags : [])
      .map(tag => String(tag || "").trim().toLowerCase())
      .filter(Boolean));
  }

  function isEligibleFarmlandHex(hex) {
    if (!hex?.id || !FARMLAND_OVERLAY_BASES.has(hex.baseTerrain)) return false;
    const features = Array.isArray(hex.features) ? hex.features : [];
    if (features.some(feature => FARMLAND_BLOCKING_FEATURES.has(feature))) return false;
    return features.every(feature => FARMLAND_ALLOWED_FEATURES.has(feature));
  }

  function getFarmlandFeaturePreference(hex) {
    const features = Array.isArray(hex?.features) ? hex.features : [];
    if (!features.length) return 4;
    if (features.length === 1 && features[0] === "ridges") return 3;
    if (features.length === 1 && features[0] === "woods") return 2;
    if (features.length === 2 && features.includes("ridges") && features.includes("woods")) return 1.5;
    if (features.every(feature => feature === "forest" || feature === "ridges")) return 1;
    return 0;
  }

  function getFarmlandSettlementFieldCount(poi) {
    const icon = getStoredPoiIconValue(poi);
    if (["city", "walled_city", "port_town", "mountain_city"].includes(icon)) return 4;
    if (["hilltop_town", "mountain_hold"].includes(icon)) return 2;
    if (icon === "village") return 2;
    return 3;
  }

  function buildFarmlandSeedSignature(poi, hex, role) {
    return `${role}:${poi?.POI_ID || poi?.__uuid || hex?.id || ""}:${hex?.id || ""}`;
  }

  function collectFarmlandCandidateHexIds(centerHex, options = {}) {
    if (!centerHex?.id) return [];
    const radius = Math.max(0, Math.min(3, Number(options.radius || 1)));
    const includeCenter = options.includeCenter === true;
    const maxCount = Math.max(0, Math.round(Number(options.maxCount || 0)));
    const excludeHexIds = options.excludeHexIds instanceof Set ? options.excludeHexIds : new Set();
    const seed = String(options.seed || centerHex.id);
    const ranked = getHexesWithinRadius(centerHex, radius)
      .filter(hex => (includeCenter || hex.id !== centerHex.id) && !excludeHexIds.has(hex.id))
      .filter(isEligibleFarmlandHex)
      .map(hex => {
        const preference = getFarmlandFeaturePreference(hex);
        if (preference <= 0) return null;
        const distance = Math.max(0, getHexLineSequence(centerHex.id, hex.id).length - 1);
        return {
          hex,
          score: preference * 1.8
            - distance * 0.42
            + (hex.baseTerrain === "lush_grassland" ? 0.28 : hex.baseTerrain === "grassland" ? 0.16 : 0)
            + ((stableHash(`${seed}:${hex.id}`) % 1000) / 100000)
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
    return ranked.slice(0, maxCount).map(entry => entry.hex.id);
  }

  function buildGeneratedFarmlandSegments(pois = []) {
    const allPois = Array.isArray(pois) ? pois : [];
    const farmlandHexIds = new Set();
    const farmingAnchorHexIds = new Set();
    const settlementSeeds = [];
    const resourceSeeds = [];
    const waypointSeeds = [];

    allPois.forEach(poi => {
      const hex = renderer.hexesById.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const type = getStoredPoiTypeValue(poi);
      const icon = getStoredPoiIconValue(poi);
      const tags = getPoiTagSet(poi);
      if (type === "resource_site" && (tags.has("farming") || FARMLAND_RESOURCE_ICONS.has(icon))) {
        resourceSeeds.push({ poi, hex, icon });
        farmingAnchorHexIds.add(hex.id);
        return;
      }
      if (type === "settlement" && tags.has("farming")) {
        settlementSeeds.push({ poi, hex, icon });
        farmingAnchorHexIds.add(hex.id);
        return;
      }
      if (type === "waypoint" && FARMLAND_WAYPOINT_ICONS.has(icon)) {
        waypointSeeds.push({ poi, hex, icon });
      }
    });

    resourceSeeds.forEach(seed => {
      if (isEligibleFarmlandHex(seed.hex)) farmlandHexIds.add(seed.hex.id);
      collectFarmlandCandidateHexIds(seed.hex, {
        radius: 2,
        includeCenter: false,
        maxCount: seed.icon === "windmill" ? 4 : 3,
        excludeHexIds: farmlandHexIds,
        seed: buildFarmlandSeedSignature(seed.poi, seed.hex, "resource")
      }).forEach(hexId => farmlandHexIds.add(hexId));
    });

    settlementSeeds.forEach(seed => {
      collectFarmlandCandidateHexIds(seed.hex, {
        radius: 2,
        includeCenter: false,
        maxCount: getFarmlandSettlementFieldCount(seed.poi),
        excludeHexIds: farmlandHexIds,
        seed: buildFarmlandSeedSignature(seed.poi, seed.hex, "settlement")
      }).forEach(hexId => farmlandHexIds.add(hexId));
    });

    waypointSeeds.forEach(seed => {
      const closeToFarming = getHexesWithinRadius(seed.hex, 3).some(hex => farmingAnchorHexIds.has(hex.id));
      if (!closeToFarming) return;
      const seedRoll = (stableHash(buildFarmlandSeedSignature(seed.poi, seed.hex, "waypoint")) % 1000) / 1000;
      if (seedRoll > 0.48) return;
      collectFarmlandCandidateHexIds(seed.hex, {
        radius: 1,
        includeCenter: true,
        maxCount: 1,
        excludeHexIds: farmlandHexIds,
        seed: buildFarmlandSeedSignature(seed.poi, seed.hex, "waypoint-spur")
      }).forEach(hexId => farmlandHexIds.add(hexId));
    });

    return [...farmlandHexIds].map(hexId => ({
      tool: "farmland",
      fromHexId: hexId,
      toHexId: "",
      edge: null,
      style: "farmland",
      routeMetadata: {}
    }));
  }

  function normalizeFarmlandOverlaySaveError(error) {
    const message = String(error?.message || "");
    if (/unsupported overlay type|schema cache|generated_map_overlays_type_check|generated_map_overlays_shape_check/i.test(message)) {
      return new Error("Farmland overlays need the latest generated map overlay SQL. Run sql/generated_map_overlay_management.sql in Supabase, then generate POIs again.");
    }
    return error instanceof Error ? error : new Error(message || "Unable to generate farmland overlays.");
  }

  async function regenerateGeneratedFarmlandOverlays(campaignId, options = {}) {
    const replaceExisting = options.replaceExisting === true;
    const existingFarmlandOverlays = (renderer.mapOverlays || [])
      .filter(overlay => overlay?.Overlay_Type === "farmland");
    const existingFarmlandHexIds = new Set(existingFarmlandOverlays.map(overlay => overlay?.Hex_ID_Ref).filter(Boolean));
    const farmlandSnapshot = replaceExisting
      ? existingFarmlandOverlays.map(overlay => ({ ...cloneOverlayRecord(overlay), __undoDeleted: true }))
      : [];
    const createdOverlays = [];

    try {
      if (farmlandSnapshot.length) {
        await Promise.all(farmlandSnapshot.map(overlay => deleteOverlayById(campaignId, overlay.__uuid, { allowMissing: true })));
        removeLocalOverlaysById(farmlandSnapshot.map(overlay => overlay.__uuid));
      }

      const segments = buildGeneratedFarmlandSegments(options.pois || [])
        .filter(segment => replaceExisting || !existingFarmlandHexIds.has(segment.fromHexId));
      if (!segments.length) {
        return {
          historyOverlays: farmlandSnapshot,
          createdCount: 0
        };
      }

      const savedOverlays = (await Promise.all(segments.map(segment => (
        savePathOverlaySegment(campaignId, segment.tool, segment.fromHexId, null, segment.style, null, segment.routeMetadata)
      )))).filter(Boolean);
      if (savedOverlays.length) {
        upsertLocalOverlays(savedOverlays);
        createdOverlays.push(...savedOverlays);
      }

      return {
        historyOverlays: [
          ...farmlandSnapshot,
          ...createdOverlays.map(overlay => ({ ...cloneOverlayRecord(overlay), __undoDeleted: false }))
        ],
        createdCount: createdOverlays.length
      };
    } catch (error) {
      if (farmlandSnapshot.length) {
        const restored = (await Promise.all(farmlandSnapshot.map(overlay => restoreDeletedOverlay(campaignId, overlay).catch(() => null)))).filter(Boolean);
        if (restored.length) upsertLocalOverlays(restored);
      }
      throw normalizeFarmlandOverlaySaveError(error);
    }
  }

  function overlaySegmentKey(type, fromHexId, toHexId) {
    const ends = [fromHexId, toHexId].sort();
    return `${type}:${ends[0]}:${ends[1]}`;
  }

  function overlaySegmentExistingKey(type, fromHexId, toHexId, routeMetadata = {}, mode = "type") {
    const baseKey = overlaySegmentKey(type, fromHexId, toHexId);
    if (mode !== "route") return baseKey;
    return `${baseKey}:${routeMetadata.isMajorRoute ? "major" : "minor"}:${routeMetadata.routeName || ""}`;
  }

  function overlayEdgeExistingKey(type, fromHexId, edge, routeMetadata = {}, mode = "type") {
    const baseKey = `${type}:${fromHexId}:edge:${edge || ""}`;
    if (mode !== "route") return baseKey;
    return `${baseKey}:${routeMetadata.isMajorRoute ? "major" : "minor"}:${routeMetadata.routeName || ""}`;
  }

  function buildGeneratedTradeRoutes(campaignId) {
    const anchors = getGeneratedTradeRouteAnchors(campaignId);
    const seedBase = getGenerationSeedBase(campaignId);
    const usedRouteNames = new Set();
    const landAnchors = chooseGeneratedTradeLoopAnchors(anchors, seedBase, 8);
    if (landAnchors.length < 2) return [];
    const loopAnchors = chooseGeneratedTradeLoopAnchorOrder(landAnchors, seedBase, Math.min(10, landAnchors.length));
    const sequence = buildGeneratedTradeLoopSequence(loopAnchors, getGeneratedRoadAnchors(campaignId), seedBase);
    if (!sequence?.length || sequence.length < 2) return [];

    return [{
      tool: "road",
      style: "dark_brown",
      sequence,
      routeMetadata: {
        isMajorRoute: true,
        routeName: buildGeneratedTradeRouteName("land", loopAnchors[0], loopAnchors[Math.max(1, loopAnchors.length - 1)], seedBase, usedRouteNames, 0)
      }
    }];
  }

  function chooseGeneratedTradeLoopAnchors(anchors, seedBase, maxCount = 8) {
    const settlementAnchors = (anchors || [])
      .filter(anchor => anchor?.type === "settlement" && !isWaterHex(anchor.hex));
    const selected = [];
    const selectedIds = new Set();
    const addAnchor = anchor => {
      if (!anchor?.hex?.id || selectedIds.has(anchor.hex.id) || selected.length >= maxCount) return;
      selected.push(anchor);
      selectedIds.add(anchor.hex.id);
    };

    settlementAnchors
      .filter(anchor => ["city", "walled_city", "mountain_city"].includes(anchor.icon))
      .sort((left, right) => right.population - left.population || right.landScore - left.landScore || left.hex.id.localeCompare(right.hex.id))
      .forEach(addAnchor);

    const portTown = settlementAnchors
      .filter(anchor => anchor.icon === "port_town" && !selectedIds.has(anchor.hex.id))
      .sort((left, right) => right.population - left.population || right.landScore - left.landScore || left.hex.id.localeCompare(right.hex.id))[0];
    addAnchor(portTown);

    settlementAnchors
      .filter(anchor => !selectedIds.has(anchor.hex.id))
      .sort((left, right) => (
        right.population - left.population ||
        right.landScore - left.landScore ||
        seededUnit(`${seedBase}:trade-loop-populous:${left.hex.id}`) - seededUnit(`${seedBase}:trade-loop-populous:${right.hex.id}`) ||
        left.hex.id.localeCompare(right.hex.id)
      ))
      .forEach(addAnchor);

    return selected;
  }

  function chooseGeneratedTradeLoopAnchorOrder(anchors, seedBase, maxCount = 8) {
    const selected = (anchors || []).slice(0, Math.max(2, maxCount));
    if (selected.length <= 2) return selected;
    const center = selected.reduce((sum, anchor) => ({
      x: sum.x + anchor.hex.center.x,
      y: sum.y + anchor.hex.center.y
    }), { x: 0, y: 0 });
    center.x /= selected.length;
    center.y /= selected.length;

    const clockwise = seededUnit(`${seedBase}:trade-loop-direction`) < 0.5;
    const startOffset = stableHash(`${seedBase}:trade-loop-start`) % selected.length;
    const ordered = selected
      .map(anchor => ({
        anchor,
        angle: Math.atan2(anchor.hex.center.y - center.y, anchor.hex.center.x - center.x)
      }))
      .sort((left, right) => clockwise
        ? left.angle - right.angle || left.anchor.hex.id.localeCompare(right.anchor.hex.id)
        : right.angle - left.angle || left.anchor.hex.id.localeCompare(right.anchor.hex.id))
      .map(entry => entry.anchor);
    return ordered.slice(startOffset).concat(ordered.slice(0, startOffset));
  }

  function buildGeneratedTradeLoopSequence(orderedAnchors, detourAnchors, seedBase) {
    if (!Array.isArray(orderedAnchors) || orderedAnchors.length < 2) return [];
    const usedDetourIds = new Set();
    const stops = orderedAnchors.length >= 3
      ? orderedAnchors.concat(orderedAnchors[0])
      : orderedAnchors;
    const sequence = [];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const fromAnchor = stops[index];
      const toAnchor = stops[index + 1];
      const detours = chooseGeneratedRoadDetours(fromAnchor, toAnchor, detourAnchors, usedDetourIds, seedBase, index, 1.35, {
        maxDetours: 1
      });
      const leg = buildGeneratedAnchorRouteSequence("road", fromAnchor, toAnchor, detours, {
        majorRoute: true,
        generatedRoadMode: true,
        pathSalt: `${seedBase}:trade-loop:${index}:${fromAnchor.hex.id}:${toAnchor.hex.id}`
      });
      if (!leg?.length || leg.length < 2) continue;
      if (!sequence.length) sequence.push(...leg);
      else sequence.push(...leg.slice(1));
      detours.forEach(anchor => usedDetourIds.add(anchor.hex.id));
    }
    return sequence;
  }

  function addGeneratedLandTradeRoutes({ routes, anchors, detourAnchors = [], seedBase, usedRouteNames, maxCount }) {
    if (!Array.isArray(anchors) || anchors.length < 2 || maxCount <= 0) return;
    const primaryAnchors = anchors.slice(0, Math.min(8, anchors.length));
    const connected = [primaryAnchors[0]];
    const remaining = primaryAnchors.slice(1);
    const usedDetourIds = new Set();
    let step = 0;

    while (remaining.length && step < maxCount) {
      const candidate = connected
        .flatMap(fromAnchor => remaining.map(toAnchor => ({
          fromAnchor,
          toAnchor,
          score: getGeneratedTradePairScore(fromAnchor, toAnchor, seedBase, "land", step)
        })))
        .sort((left, right) => left.score - right.score || left.toAnchor.hex.id.localeCompare(right.toAnchor.hex.id))[0];
      if (!candidate) break;

      const detours = chooseGeneratedRoadDetours(candidate.fromAnchor, candidate.toAnchor, detourAnchors, usedDetourIds, seedBase, step, 1.25, {
        maxDetours: 2
      });
      const sequence = buildGeneratedAnchorRouteSequence("road", candidate.fromAnchor, candidate.toAnchor, detours, {
        majorRoute: true,
        generatedRoadMode: true,
        pathSalt: `${seedBase}:trade-road:${step}:${candidate.fromAnchor.hex.id}:${candidate.toAnchor.hex.id}`
      });
      remaining.splice(remaining.findIndex(anchor => anchor.hex.id === candidate.toAnchor.hex.id), 1);
      if (!sequence?.length || sequence.length < 2) continue;

      const routeName = buildGeneratedTradeRouteName("land", candidate.fromAnchor, candidate.toAnchor, seedBase, usedRouteNames, step);
      routes.push({
        tool: "road",
        style: "dark_brown",
        sequence,
        routeMetadata: {
          isMajorRoute: true,
          routeName
        }
      });
      detours.forEach(anchor => usedDetourIds.add(anchor.hex.id));
      connected.push(candidate.toAnchor);
      step += 1;
    }
  }

  function addGeneratedSeaTradeRoutes({ routes, anchors, seedBase, usedRouteNames, dangerHexIds, usedSeaAnchorIds, maxCount }) {
    if (!Array.isArray(anchors) || anchors.length < 2 || maxCount <= 0) return;
    const pairKeySet = new Set();
    const candidates = [];
    anchors.slice(0, Math.min(12, anchors.length)).forEach((fromAnchor, fromIndex) => {
      anchors.slice(fromIndex + 1, Math.min(12, anchors.length)).forEach(toAnchor => {
        if (!fromAnchor.seaAccess || !toAnchor.seaAccess) return;
        const distance = roadPathHeuristic(fromAnchor.seaAccess, toAnchor.seaAccess);
        if (distance < 5) return;
        candidates.push({
          fromAnchor,
          toAnchor,
          distance,
          score: getGeneratedTradePairScore(fromAnchor, toAnchor, seedBase, "sea", candidates.length)
        });
      });
    });

    candidates
      .sort((left, right) => left.score - right.score || left.fromAnchor.hex.id.localeCompare(right.fromAnchor.hex.id))
      .some((candidate, index) => {
        if (routes.filter(route => route.tool === "sea_route").length >= maxCount) return true;
        const pairKey = [candidate.fromAnchor.hex.id, candidate.toAnchor.hex.id].sort().join(":");
        if (pairKeySet.has(pairKey)) return false;
        const fromEndpoint = getGeneratedSeaTradeEndpointHex(candidate.fromAnchor);
        const toEndpoint = getGeneratedSeaTradeEndpointHex(candidate.toAnchor);
        if (!fromEndpoint?.id || !toEndpoint?.id || fromEndpoint.id === toEndpoint.id) return false;
        const sequence = getSeaRoutePathSequence(fromEndpoint.id, toEndpoint.id, {
          seaDangerHexIds: dangerHexIds
        });
        if (!sequence?.length || sequence.length < 6) return false;
        pairKeySet.add(pairKey);
        const routeName = buildGeneratedTradeRouteName("sea", candidate.fromAnchor, candidate.toAnchor, seedBase, usedRouteNames, index);
        addGeneratedSeaTradeLandConnector(routes, candidate.fromAnchor, fromEndpoint, routeName, seedBase, `sea-from:${index}`);
        addGeneratedSeaTradeLandConnector(routes, candidate.toAnchor, toEndpoint, routeName, seedBase, `sea-to:${index}`);
        routes.push({
          tool: "sea_route",
          style: "sea_route",
          sequence,
          routeMetadata: {
            isMajorRoute: true,
            routeName
          }
        });
        usedSeaAnchorIds?.add(candidate.fromAnchor.hex.id);
        usedSeaAnchorIds?.add(candidate.toAnchor.hex.id);
        return false;
      });
  }

  function addGeneratedOffMapSeaTradeRoutes({ routes, anchors, seedBase, usedRouteNames, dangerHexIds, usedSeaAnchorIds, maxCount }) {
    if (!Array.isArray(anchors) || !anchors.length || maxCount <= 0) return;
    const candidates = anchors
      .slice(0, Math.min(8, anchors.length))
      .filter(anchor => isGeneratedOffMapSeaTradeAnchor(anchor))
      .map((anchor, index) => ({
        anchor,
        exit: getGeneratedSeaTradeExit(anchor, seedBase, index),
        score: -anchor.seaScore + seededUnit(`${seedBase}:offmap-trade:${anchor.hex.id}`) * 22
      }))
      .filter(candidate => candidate.exit?.hex?.id && candidate.exit.edge)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));

    let added = 0;
    candidates.forEach((candidate, index) => {
      if (added >= maxCount) return;
      const endpoint = getGeneratedSeaTradeEndpointHex(candidate.anchor);
      if (!endpoint?.id || endpoint.id === candidate.exit.hex.id) return;
      const sequence = getSeaRoutePathSequence(endpoint.id, candidate.exit.hex.id, {
        seaDangerHexIds: dangerHexIds
      });
      if (!sequence?.length || sequence.length < 6) return;
      const routeName = buildGeneratedTradeRouteName("offmap-sea", candidate.anchor, null, seedBase, usedRouteNames, index);
      addGeneratedSeaTradeLandConnector(routes, candidate.anchor, endpoint, routeName, seedBase, `offmap:${index}`);
      routes.push({
        tool: "sea_route",
        style: "sea_route",
        sequence,
        exitEdge: candidate.exit.edge,
        routeMetadata: {
          isMajorRoute: true,
          routeName
        }
      });
      usedSeaAnchorIds?.add(candidate.anchor.hex.id);
      added += 1;
    });
  }

  function addGeneratedSeaLandNetworkConnectors({ routes, seaAnchors, landAnchors, usedSeaAnchorIds, seedBase, usedRouteNames, maxCount }) {
    if (!usedSeaAnchorIds?.size || !Array.isArray(seaAnchors) || !Array.isArray(landAnchors) || maxCount <= 0) return;
    const inlandAnchors = landAnchors
      .filter(anchor => !anchor.seaAccess && anchor.landScore >= 58)
      .slice(0, 12);
    const fallbackLandAnchors = landAnchors
      .filter(anchor => anchor.landScore >= 68)
      .slice(0, 12);
    const targets = inlandAnchors.length ? inlandAnchors : fallbackLandAnchors;
    if (!targets.length) return;

    let added = 0;
    seaAnchors
      .filter(anchor => usedSeaAnchorIds.has(anchor.hex.id) && !isWaterHex(anchor.hex))
      .map(anchor => {
        const target = targets
          .filter(candidate => candidate.hex.id !== anchor.hex.id)
          .map(candidate => ({
            anchor: candidate,
            distance: roadPathHeuristic(anchor.hex, candidate.hex),
            score: roadPathHeuristic(anchor.hex, candidate.hex)
              - candidate.landScore * 0.08
              + seededUnit(`${seedBase}:sea-land-network:${anchor.hex.id}:${candidate.hex.id}`) * 2.5
          }))
          .filter(candidate => candidate.distance >= 4)
          .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id))[0];
        return target ? { anchor, target, score: target.score } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id))
      .forEach((candidate, index) => {
        if (added >= maxCount) return;
        const sequence = getPathOverlaySequence("road", candidate.anchor.hex.id, candidate.target.anchor.hex.id, "", {
          majorRoute: true,
          generatedRoadMode: true,
          pathSalt: `${seedBase}:sea-land-network:${index}:${candidate.anchor.hex.id}:${candidate.target.anchor.hex.id}`
        });
        if (!sequence?.length || sequence.length < 5) return;
        routes.push({
          tool: "road",
          style: "dark_brown",
          sequence,
          routeMetadata: {
            isMajorRoute: true,
            routeName: getGeneratedTradeConnectorRouteName(
              buildGeneratedTradeRouteName("land", candidate.anchor, candidate.target.anchor, seedBase, usedRouteNames, index),
              sequence,
              7
            )
          }
        });
        added += 1;
      });
  }

  function addGeneratedMajorTradeAnchorCompletion({ routes, anchors, seedBase, usedRouteNames, maxCount }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors) || maxCount <= 0) return;
    const networkHexIds = getGeneratedRouteHexIdSet(routes);
    if (!networkHexIds.size) return;
    const candidates = anchors
      .filter(isGeneratedMajorTradeAnchor)
      .filter(anchor => !networkHexIds.has(anchor.hex.id))
      .map(anchor => {
        const target = getNearestGeneratedTradeNetworkAnchor(anchor, networkHexIds, seedBase);
        return target ? {
          anchor,
          target,
          score: target.score - anchor.landScore * 0.12 + seededUnit(`${seedBase}:major-trade-completion:${anchor.hex.id}`) * 2
        } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));

    let added = 0;
    candidates.forEach((candidate, index) => {
      if (added >= maxCount) return;
      const sequence = getPathOverlaySequence("road", candidate.anchor.hex.id, candidate.target.anchor.hex.id, "", {
        majorRoute: true,
        generatedRoadMode: true,
        pathSalt: `${seedBase}:major-trade-completion:${index}:${candidate.anchor.hex.id}:${candidate.target.anchor.hex.id}`
      });
      if (!sequence?.length || sequence.length < 2) return;
      routes.push({
        tool: "road",
        style: "dark_brown",
        sequence,
        routeMetadata: {
          isMajorRoute: true,
          routeName: getGeneratedTradeConnectorRouteName(
            buildGeneratedTradeRouteName("land", candidate.anchor, candidate.target.anchor, seedBase, usedRouteNames, index),
            sequence,
            6
          )
        }
      });
      sequence.forEach(hexId => networkHexIds.add(hexId));
      added += 1;
    });
  }

  function addGeneratedRiverTradeRoutes({ routes, anchors, riverNetwork, seedBase, usedRouteNames, maxCount }) {
    if (!riverNetwork?.nodes?.size || !Array.isArray(anchors) || maxCount <= 0) return;
    const riverAnchors = anchors
      .filter(anchor => anchor.riverAccess?.hex?.id && anchor.riverAccess?.componentId)
      .sort((left, right) => right.landScore - left.landScore || left.hex.id.localeCompare(right.hex.id))
      .slice(0, 12);
    if (riverAnchors.length < 2) return;

    const candidates = [];
    riverAnchors.forEach((fromAnchor, fromIndex) => {
      riverAnchors.slice(fromIndex + 1).forEach(toAnchor => {
        if (fromAnchor.riverAccess.componentId !== toAnchor.riverAccess.componentId) return;
        const distance = roadPathHeuristic(fromAnchor.riverAccess.hex, toAnchor.riverAccess.hex);
        if (distance < 5) return;
        candidates.push({
          fromAnchor,
          toAnchor,
          score: distance * 1.55
            - (fromAnchor.landScore + toAnchor.landScore) * 0.22
            + seededUnit(`${seedBase}:trade-river-pair:${fromAnchor.hex.id}:${toAnchor.hex.id}`) * 5
        });
      });
    });

    let added = 0;
    candidates
      .sort((left, right) => left.score - right.score || left.fromAnchor.hex.id.localeCompare(right.fromAnchor.hex.id))
      .forEach((candidate, index) => {
        if (added >= maxCount) return;
        const sequence = getTradeRiverNetworkSequence(
          riverNetwork,
          candidate.fromAnchor.riverAccess.hex.id,
          candidate.toAnchor.riverAccess.hex.id
        );
        if (!sequence?.length || sequence.length < 4) return;
        const routeName = buildGeneratedTradeRouteName("river", candidate.fromAnchor, candidate.toAnchor, seedBase, usedRouteNames, index);
        addGeneratedRiverTradeLandConnector(routes, candidate.fromAnchor, candidate.fromAnchor.riverAccess.hex, routeName, seedBase, `river-from:${index}`);
        addGeneratedRiverTradeLandConnector(routes, candidate.toAnchor, candidate.toAnchor.riverAccess.hex, routeName, seedBase, `river-to:${index}`);
        routes.push({
          tool: "river",
          style: composeOverlayStyle("river", [OVERLAY_STYLE_FLAGS.riverNoAutoFalls]),
          sequence,
          routeMetadata: {
            isMajorRoute: true,
            routeName
          }
        });
        added += 1;
      });
  }

  function getGeneratedTradeRouteAnchors(campaignId, riverNetwork = null) {
    const seedBase = getGenerationSeedBase(campaignId);
    const hexById = new Map();
    renderer.hexes.forEach(hex => {
      hexById.set(hex.id, hex);
      if (hex.label) hexById.set(hex.label, hex);
    });
    const bestByHex = new Map();

    (db?.raw?.pois || []).forEach(poi => {
      const hex = hexById.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const profile = getGeneratedTradeAnchorProfile(poi, hex, campaignId, seedBase, riverNetwork);
      if (!profile) return;
      const existing = bestByHex.get(hex.id);
      if (!existing || profile.totalScore > existing.totalScore) bestByHex.set(hex.id, profile);
    });

    return [...bestByHex.values()]
      .sort((left, right) => right.totalScore - left.totalScore || left.hex.id.localeCompare(right.hex.id));
  }

  function getGeneratedTradeAnchorProfile(poi, hex, campaignId, seedBase, riverNetwork = null) {
    if (!poi || !hex) return null;
    const icon = getStoredPoiIconValue(poi).toLowerCase();
    const type = getStoredPoiTypeValue(poi);
    const iconMeta = getPoiIconMetaForRoads(poi);
    const family = iconMeta?.family || "";
    const traitSet = new Set(iconMeta?.traits || []);
    const tagSet = getPoiTagSet(poi);
    const population = parseRoadPoiPopulation(poi);
    const text = `${poi?.Name || ""} ${poi?.POI_Type || ""} ${icon} ${[...tagSet].join(" ")}`.toLowerCase();
    const isSettlement = type === "settlement" || family === "settlement";
    const isStronghold = type === "stronghold" || family === "stronghold";
    const isResource = type === "resource_site" || family === "resource_site";
    const isRoadstop = family === "waypoint" && (traitSet.has("roadside") || traitSet.has("rest") || traitSet.has("crossroads") || tagSet.has("crossroads"));
    const isTradeSite = traitSet.has("trade") || tagSet.has("trade") || /market|port|harbor|harbour|dock|crossroads|mill|mine|quarry|fish|farm|inn/.test(text);
    const isWaterAnchor = isTradeSeaWaterHex(hex);
    const seaAccess = isWaterAnchor ? hex : getTradeSeaAccessHex(hex, campaignId);
    const riverAccess = !isWaterAnchor ? getTradeRiverAccess(hex, riverNetwork) : null;
    let landScore = 0;
    let seaScore = 0;

    if (isSettlement && !isWaterAnchor) {
      landScore += 48;
      if (traitSet.has("major") || traitSet.has("urban") || ["city", "walled_city", "port_town", "mountain_city"].includes(icon)) landScore += 30;
      if (population >= 9000) landScore += 26;
      else if (population >= 3500) landScore += 16;
      else if (population >= 900) landScore += 8;
      if (traitSet.has("lawless") || tagSet.has("lawless")) landScore -= 6;
    }
    if (isStronghold && !isWaterAnchor) landScore += 34;
    if (isResource && isTradeSite && !isWaterAnchor) landScore += 30;
    else if (isResource && !isWaterAnchor) landScore += 14;
    if (isRoadstop && !isWaterAnchor) landScore += 18;
    if ((traitSet.has("crossroads") || tagSet.has("crossroads")) && !isWaterAnchor) landScore += 24;
    if (seaAccess && (isSettlement || isTradeSite || traitSet.has("coastal") || traitSet.has("major_port"))) seaScore += landScore + 28;
    if (seaAccess && ["port_town", "harbor", "docks", "lighthouse", "sea_fort", "fishing_camp"].includes(icon)) seaScore += 36;
    if (isWaterAnchor && isStronghold) seaScore += 26;
    if (icon === "sea_fort") seaScore += 18;
    landScore += seededUnit(`${seedBase}:trade-anchor-land:${poi.POI_ID || poi.__uuid || hex.id}`) * 10;
    seaScore += seededUnit(`${seedBase}:trade-anchor-sea:${poi.POI_ID || poi.__uuid || hex.id}`) * 10;

    const totalScore = Math.max(landScore, seaScore);
    if (totalScore < 34) return null;
    return {
      poi,
      hex,
      name: String(poi.Name || "").trim() || getGeneratedTradeFallbackAnchorName(hex),
      icon,
      type,
      family,
      traitSet,
      tagSet,
      population,
      seaAccess,
      riverAccess,
      landScore,
      seaScore,
      totalScore
    };
  }

  function getTradeSeaAccessHex(hex, campaignId) {
    if (!hex) return null;
    if (isTradeSeaWaterHex(hex)) return hex;
    const candidates = [hex, ...nearbyHexesWithin(hex, 2)]
      .flatMap(candidate => EDGE_NAMES.map(edgeName => getNeighborHex(candidate, edgeName)))
      .filter(candidate => candidate?.id && isTradeSeaWaterHex(candidate))
      .map(candidate => ({
        hex: candidate,
        score: roadPathHeuristic(hex, candidate)
          + (candidate.baseTerrain === "coastal_water" ? -1.2 : 0)
          + (candidate.baseTerrain === "deep_sea" ? 0.8 : 0)
          + seededUnit(`${getGenerationSeedBase(campaignId)}:trade-sea-access:${hex.id}:${candidate.id}`) * 0.35
      }))
      .sort((left, right) => left.score - right.score || left.hex.id.localeCompare(right.hex.id));
    return candidates[0]?.hex || null;
  }

  function isTradeSeaWaterHex(hex) {
    return ["coastal_water", "sea", "deep_sea"].includes(hex?.baseTerrain);
  }

  function getGeneratedSeaTradeEndpointHex(anchor) {
    if (!anchor?.hex) return null;
    if (canGeneratedSeaTradeConnectDirectly(anchor)) return anchor.hex;
    return anchor.seaAccess || null;
  }

  function canGeneratedSeaTradeConnectDirectly(anchor) {
    if (!anchor?.hex || isWaterHex(anchor.hex) || !canSeaRouteUseHex(anchor.hex)) return false;
    const traits = anchor.traitSet instanceof Set ? anchor.traitSet : new Set();
    return anchor.type === "settlement" && (
      anchor.icon === "port_town" ||
      traits.has("coastal") ||
      traits.has("major_port") ||
      /port|harbor|harbour|dock|quay|wharf/i.test(anchor.name || "")
    );
  }

  function addGeneratedSeaTradeLandConnector(routes, anchor, endpoint, routeName, seedBase, salt) {
    if (!anchor?.hex?.id || !endpoint?.id || anchor.hex.id === endpoint.id) return;
    const sequence = getPathOverlaySequence("road", anchor.hex.id, endpoint.id, "", {
      majorRoute: true,
      generatedRoadMode: true,
      pathSalt: `${seedBase}:trade-sea-connector:${salt}:${anchor.hex.id}:${endpoint.id}`
    });
    if (!sequence?.length || sequence.length < 2) return;
    routes.push({
      tool: "road",
      style: "dark_brown",
      sequence,
      routeMetadata: {
        isMajorRoute: true,
        routeName: getGeneratedTradeConnectorRouteName(routeName, sequence)
      }
    });
  }

  function addGeneratedRiverTradeLandConnector(routes, anchor, endpoint, routeName, seedBase, salt) {
    if (!anchor?.hex?.id || !endpoint?.id || anchor.hex.id === endpoint.id) return;
    const sequence = getPathOverlaySequence("road", anchor.hex.id, endpoint.id, "", {
      majorRoute: true,
      generatedRoadMode: true,
      pathSalt: `${seedBase}:trade-river-connector:${salt}:${anchor.hex.id}:${endpoint.id}`
    });
    if (!sequence?.length || sequence.length < 2) return;
    routes.push({
      tool: "road",
      style: "dark_brown",
      sequence,
      routeMetadata: {
        isMajorRoute: true,
        routeName: getGeneratedTradeConnectorRouteName(routeName, sequence)
      }
    });
  }

  function isGeneratedOffMapSeaTradeAnchor(anchor) {
    if (!anchor?.seaAccess || anchor.seaScore < 70) return false;
    if (anchor.type !== "settlement") return false;
    const traits = anchor.traitSet instanceof Set ? anchor.traitSet : new Set();
    return anchor.icon === "port_town" || traits.has("coastal") || traits.has("major_port") || /port|harbor|harbour|dock/i.test(anchor.name || "");
  }

  function isGeneratedPrimarySeaTradeAnchor(anchor) {
    if (!anchor?.seaAccess || anchor.seaScore < 54) return false;
    if (anchor.type === "settlement") return true;
    const traits = anchor.traitSet instanceof Set ? anchor.traitSet : new Set();
    return anchor.icon === "sea_fort" || traits.has("major_port");
  }

  function isGeneratedMajorTradeAnchor(anchor) {
    if (!anchor?.hex?.id || isWaterHex(anchor.hex)) return false;
    return anchor.type === "settlement" && ["city", "walled_city", "mountain_city"].includes(anchor.icon);
  }

  function getNearestGeneratedTradeNetworkAnchor(anchor, networkHexIds, seedBase) {
    if (!anchor?.hex?.id || !(networkHexIds instanceof Set) || !networkHexIds.size) return null;
    return [...networkHexIds]
      .map(hexId => {
        const hex = hexForPathPoint(hexId);
        if (!hex || hex.id === anchor.hex.id || isWaterHex(hex)) return null;
        const distance = roadPathHeuristic(anchor.hex, hex);
        if (distance > 32) return null;
        return {
          anchor: {
            hex,
            name: "",
            landScore: 0
          },
          distance,
          score: distance + seededUnit(`${seedBase}:trade-network-target:${anchor.hex.id}:${hex.id}`) * 1.5
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id))[0] || null;
  }

  function getGeneratedTradeConnectorRouteName(routeName, sequence, minNamedLength = 5) {
    return (sequence || []).length >= minNamedLength ? routeName : "";
  }

  function getTradeRiverOverlayNetwork() {
    const graph = new Map();
    const nodes = new Map();
    (renderer.mapOverlays || []).forEach(overlay => {
      if (overlay?.__preview || overlay?.Overlay_Type !== "river" || !overlay.From_Hex_ID_Ref || !overlay.To_Hex_ID_Ref) return;
      const fromHex = hexForPathPoint(overlay.From_Hex_ID_Ref);
      const toHex = hexForPathPoint(overlay.To_Hex_ID_Ref);
      if (!fromHex || !toHex) return;
      nodes.set(fromHex.id, fromHex);
      nodes.set(toHex.id, toHex);
      if (!graph.has(fromHex.id)) graph.set(fromHex.id, new Set());
      if (!graph.has(toHex.id)) graph.set(toHex.id, new Set());
      graph.get(fromHex.id).add(toHex.id);
      graph.get(toHex.id).add(fromHex.id);
    });
    const componentByHexId = new Map();
    let componentIndex = 0;
    nodes.forEach((hex, hexId) => {
      if (componentByHexId.has(hexId)) return;
      componentIndex += 1;
      const componentId = `river-${componentIndex}`;
      const queue = [hexId];
      componentByHexId.set(hexId, componentId);
      while (queue.length) {
        const currentId = queue.shift();
        (graph.get(currentId) || []).forEach(nextId => {
          if (componentByHexId.has(nextId)) return;
          componentByHexId.set(nextId, componentId);
          queue.push(nextId);
        });
      }
    });
    return { graph, nodes, componentByHexId };
  }

  function getTradeRiverAccess(hex, riverNetwork) {
    if (!hex?.id || !riverNetwork?.nodes?.size) return null;
    const candidates = [hex, ...nearbyHexesWithin(hex, 2)]
      .map(candidate => {
        const riverHex = riverNetwork.nodes.get(candidate.id);
        if (!riverHex) return null;
        return {
          hex: riverHex,
          componentId: riverNetwork.componentByHexId.get(riverHex.id) || "",
          distance: roadPathHeuristic(hex, riverHex)
        };
      })
      .filter(candidate => candidate?.componentId)
      .sort((left, right) => left.distance - right.distance || left.hex.id.localeCompare(right.hex.id));
    return candidates[0] || null;
  }

  function getTradeRiverNetworkSequence(riverNetwork, fromHexId, toHexId) {
    if (!riverNetwork?.graph?.has(fromHexId) || !riverNetwork.graph.has(toHexId)) return [];
    const queue = [fromHexId];
    const visited = new Set([fromHexId]);
    const previous = new Map();
    while (queue.length) {
      const current = queue.shift();
      if (current === toHexId) break;
      [...(riverNetwork.graph.get(current) || [])]
        .sort((left, right) => {
          const leftHex = riverNetwork.nodes.get(left);
          const rightHex = riverNetwork.nodes.get(right);
          const goalHex = riverNetwork.nodes.get(toHexId);
          return roadPathHeuristic(leftHex, goalHex) - roadPathHeuristic(rightHex, goalHex) || left.localeCompare(right);
        })
        .forEach(next => {
          if (visited.has(next)) return;
          visited.add(next);
          previous.set(next, current);
          queue.push(next);
        });
    }
    if (!visited.has(toHexId)) return [];
    const sequence = [toHexId];
    let current = toHexId;
    while (previous.has(current)) {
      current = previous.get(current);
      sequence.unshift(current);
    }
    return sequence;
  }

  function getGeneratedTradePairScore(fromAnchor, toAnchor, seedBase, mode, step = 0) {
    const fromHex = mode === "sea" ? fromAnchor.seaAccess : fromAnchor.hex;
    const toHex = mode === "sea" ? toAnchor.seaAccess : toAnchor.hex;
    const distance = roadPathHeuristic(fromHex, toHex);
    const combinedScore = mode === "sea"
      ? fromAnchor.seaScore + toAnchor.seaScore
      : fromAnchor.landScore + toAnchor.landScore;
    const tooClosePenalty = distance < 7 ? (7 - distance) * 4 : 0;
    const veryLongPenalty = distance > 36 ? (distance - 36) * 0.65 : 0;
    const seed = seededUnit(`${seedBase}:trade-pair:${mode}:${step}:${fromAnchor.hex.id}:${toAnchor.hex.id}`) * 6;
    return distance * 1.8 + tooClosePenalty + veryLongPenalty - combinedScore * 0.28 + seed;
  }

  function buildGeneratedTradeRouteName(mode, fromAnchor, toAnchor, seedBase, usedRouteNames, index = 0) {
    const namesByMode = {
      land: ["High Road", "Old Way", "Market Way", "Stone Road", "Greenway", "Kingroad", "Caravan Way", "South Road", "North Road", "West Road", "Pilgrim Way", "Copper Road", "Amber Way", "Hill Road"],
      river: ["River Road", "Reedway", "Silver Run", "Bargeway", "Low Road", "Waterway", "Willow Run", "Mill Run", "Bluewater", "Fenway"],
      sea: ["Saltway", "Blue Run", "Coastway", "Tideway", "Deep Road", "Sailway", "White Wake", "Longwake", "Harbor Run", "Grey Tide", "Goldwake"],
      "offmap-sea": ["Outer Run", "Far Tide", "Deep Run", "Salt Road", "Blue Road", "Seaway", "Farwake", "Outer Tide"]
    };
    const names = namesByMode[mode] || namesByMode.land;
    const seed = `${seedBase}:trade-route-name:${mode}:${fromAnchor?.hex?.id || ""}:${toAnchor?.hex?.id || ""}:${index}`;
    const startIndex = stableHash(seed) % names.length;
    for (let offset = 0; offset < names.length; offset += 1) {
      const candidate = names[(startIndex + offset) % names.length] || "";
      if (candidate && !usedRouteNames.has(candidate)) {
        usedRouteNames.add(candidate);
        return candidate;
      }
    }
    return names[startIndex] || "Trade Route";
  }

  function sanitizeGeneratedRouteAnchorName(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .replace(/^(the|a|an)\s+/i, "")
      .trim()
      .slice(0, 36);
  }

  function getGeneratedTradeFallbackAnchorName(hex) {
    return hex?.label || hex?.id || "Trade Anchor";
  }

  function getSeaTradeDangerHexIds(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    const dangerHexIds = new Set();
    (db?.raw?.pois || []).forEach(poi => {
      const hex = renderer.hexesById.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const type = getStoredPoiTypeValue(poi);
      const icon = getStoredPoiIconValue(poi).toLowerCase();
      const tags = getPoiTagSet(poi);
      const dangerous = ["dungeon", "dungeon_complex", "hazard"].includes(type)
        || tags.has("lawless")
        || ["pirate_flag", "lair", "dragon_lair", "kraken", "whirlpool", "sea_monster"].includes(icon);
      if (!dangerous) return;
      nearbyHexesWithin(hex, 2).forEach(candidate => {
        if (isTradeSeaWaterHex(candidate) && seededUnit(`${seedBase}:sea-danger:${hex.id}:${candidate.id}`) < 0.92) {
          dangerHexIds.add(candidate.id);
        }
      });
    });
    return dangerHexIds;
  }

  function getGeneratedSeaTradeExit(anchor, seedBase, index = 0) {
    if (!anchor?.seaAccess) return null;
    const candidates = [];
    renderer.hexes.forEach(hex => {
      if (!isTradeSeaWaterHex(hex)) return;
      EDGE_NAMES.forEach(edgeName => {
        if (getNeighborHex(hex, edgeName)) return;
        candidates.push({
          hex,
          edge: edgeName,
          score: roadPathHeuristic(anchor.seaAccess, hex)
            + (hex.baseTerrain === "deep_sea" ? -1.4 : 0)
            + (hex.baseTerrain === "coastal_water" ? 0.8 : 0)
            + seededUnit(`${seedBase}:trade-exit:${index}:${anchor.hex.id}:${hex.id}:${edgeName}`) * 3
        });
      });
    });
    return candidates
      .sort((left, right) => left.score - right.score || left.hex.id.localeCompare(right.hex.id))[0] || null;
  }

  function buildGeneratedRoadRoutes(campaignId) {
    const anchors = getGeneratedRoadAnchors(campaignId);
    if (anchors.length < 2) return [];

    const seedBase = getGenerationSeedBase(campaignId);
    const routes = [];
    const amountScale = Math.max(0.25, Math.min(2, Number(renderer.drawing.generationRoadAmount || 100) / 100));
    const lengthScale = Math.max(0.5, Math.min(2, Number(renderer.drawing.generationRoadLength || 100) / 100));
    const includePaths = renderer.drawing.generationIncludePaths !== false;
    if (renderer.drawing.generationIncludeTradeRoutes) {
      routes.push(...buildGeneratedTradeRoutes(campaignId));
    }
    const anchorPressureBonus = Math.round(Math.max(0, anchors.length - 28) * 0.28);
    const maxRoadRoutes = Math.min(Math.max(3, Math.round((20 + anchorPressureBonus) * amountScale)), Math.max(2, anchors.length - 1));
    const maxPathRoutes = includePaths ? Math.max(2, Math.round(maxRoadRoutes * 0.85)) : 0;
    const roadAnchors = anchors.filter(anchor => anchor.routeClass === "seat" || anchor.routeClass === "road" || anchor.routeClass === "detour");
    const seatAnchors = roadAnchors.filter(anchor => anchor.routeClass === "seat");
    const primaryAnchors = seatAnchors.length >= 2
      ? seatAnchors
      : roadAnchors.slice(0, Math.min(8, roadAnchors.length));
    if (primaryAnchors.length < 2) return [];

    const connectedAnchors = [primaryAnchors[0]];
    const connectedRoadIds = new Set([primaryAnchors[0].hex.id]);
    const remainingPrimaryAnchors = primaryAnchors.slice(1);
    const usedDetourIds = new Set();
    const crossingAnchorHexIds = getGeneratedCrossingAnchorHexIds(anchors);
    let step = 0;

    while (remainingPrimaryAnchors.length && routes.length < maxRoadRoutes) {
      const candidates = [];
      connectedAnchors.forEach(fromAnchor => {
        remainingPrimaryAnchors.forEach(toAnchor => {
          candidates.push({
            fromAnchor,
            toAnchor,
            score: getGeneratedRoadBackboneScore(fromAnchor, toAnchor, seedBase, step, lengthScale)
          });
        });
      });

      const candidatePool = candidates
        .sort((a, b) => a.score - b.score)
        .slice(0, Math.min(14, candidates.length));
      const best = candidatePool.find(candidate => {
        const detours = chooseGeneratedRoadDetours(candidate.fromAnchor, candidate.toAnchor, anchors, usedDetourIds, seedBase, step, lengthScale);
        const sequence = buildGeneratedAnchorRouteSequence("road", candidate.fromAnchor, candidate.toAnchor, detours, {
          majorRoute: false,
          generatedRoadMode: true,
          pathSalt: `${seedBase}:road-path:${step}`
        });
        if (!sequence?.length || sequence.length < 2) return false;
        if (wouldGeneratedRouteOverloadCrossings(sequence, routes, crossingAnchorHexIds)) return false;
        routes.push({
          tool: "road",
          sequence,
          routeMetadata: {
            isMajorRoute: false,
            routeName: ""
          }
        });
        detours.forEach(anchor => {
          usedDetourIds.add(anchor.hex.id);
          connectedRoadIds.add(anchor.hex.id);
        });
        connectedAnchors.push(candidate.toAnchor);
        connectedRoadIds.add(candidate.toAnchor.hex.id);
        remainingPrimaryAnchors.splice(remainingPrimaryAnchors.findIndex(anchor => anchor.hex.id === candidate.toAnchor.hex.id), 1);
        return true;
      });
      if (!best) break;
      step += 1;
    }

    const roadTargets = roadAnchors
      .filter(anchor => !connectedRoadIds.has(anchor.hex.id) && anchor.routeClass === "road")
      .sort((left, right) => right.priority - left.priority || left.hex.id.localeCompare(right.hex.id));
    while (roadTargets.length && routes.length < maxRoadRoutes) {
      const best = roadTargets
        .map(anchor => ({
          anchor,
          target: getNearestGeneratedConnectedRoadAnchor(anchor, connectedAnchors, seedBase, lengthScale)
      }))
      .filter(candidate => candidate.target?.anchor)
      .sort((a, b) => a.target.score - b.target.score)[0];
      if (!best?.target?.anchor) break;

      const detours = chooseGeneratedRoadDetours(best.anchor, best.target.anchor, anchors, usedDetourIds, seedBase, step, lengthScale, { maxDetours: 1 });
      const sequence = buildGeneratedAnchorRouteSequence("road", best.anchor, best.target.anchor, detours, {
        majorRoute: false,
        generatedRoadMode: true,
        pathSalt: `${seedBase}:road-spur:${step}`
      });
      roadTargets.splice(roadTargets.findIndex(anchor => anchor.hex.id === best.anchor.hex.id), 1);
      if (!sequence?.length || sequence.length < 2) continue;
      if (wouldGeneratedRouteOverloadCrossings(sequence, routes, crossingAnchorHexIds)) continue;
      routes.push({
        tool: "road",
        sequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      detours.forEach(anchor => {
        usedDetourIds.add(anchor.hex.id);
        connectedRoadIds.add(anchor.hex.id);
      });
      connectedAnchors.push(best.anchor);
      connectedRoadIds.add(best.anchor.hex.id);
      step += 1;
    }

    addGeneratedSettlementCoverageRoutes({
      routes,
      anchors,
      seedBase,
      lengthScale,
      amountScale,
      crossingAnchorHexIds
    });
    addGeneratedNetworkCompletionSpurs({
      routes,
      anchors,
      seedBase,
      lengthScale,
      includePaths,
      crossingAnchorHexIds,
      maxCount: Math.max(5, Math.round((16 + anchorPressureBonus) * amountScale))
    });
    addGeneratedCrossingContinuationRoutes({
      routes,
      anchors,
      seedBase,
      lengthScale,
      crossingAnchorHexIds,
      maxCount: Math.max(2, Math.round((4 + Math.round(anchorPressureBonus * 0.35)) * amountScale))
    });
    addGeneratedLocalConnectorRoutes({
      routes,
      anchors,
      seedBase,
      lengthScale,
      includePaths,
      crossingAnchorHexIds,
      maxCount: Math.max(2, Math.round((5 + Math.round(anchorPressureBonus * 0.4)) * amountScale))
    });
    addGeneratedPathFeederRoutes({
      routes,
      anchors,
      seedBase,
      lengthScale,
      maxCount: maxPathRoutes
    });
    addGeneratedCoastalVillagePaths({
      routes,
      anchors,
      seedBase,
      lengthScale,
      includePaths,
      maxCount: Math.max(1, Math.round((4 + Math.round(anchorPressureBonus * 0.25)) * amountScale))
    });

    return routes;
  }

  function getNearestGeneratedConnectedRoadAnchor(anchor, connectedAnchors, seedBase, lengthScale = 1) {
    return connectedAnchors
      .map(connectedAnchor => ({
        anchor: connectedAnchor,
        score: getGeneratedRoadFeederScore(anchor, connectedAnchor, seedBase, lengthScale)
      }))
      .sort((a, b) => a.score - b.score)[0] || null;
  }

  function addGeneratedSettlementCoverageRoutes({ routes, anchors, seedBase, lengthScale = 1, amountScale = 1, crossingAnchorHexIds = new Set() }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors)) return;
    const settlementAnchors = anchors
      .filter(isGeneratedRoadSettlementAnchor)
      .sort((left, right) => right.priority - left.priority || left.hex.id.localeCompare(right.hex.id));
    if (settlementAnchors.length < 2) return;

    const roadNetworkHexIds = getGeneratedRouteHexIdSet(routes.filter(route => route?.tool === "road"));
    if (!roadNetworkHexIds.size) return;
    const targetCount = getGeneratedSettlementCoverageTargetCount(settlementAnchors.length, amountScale);
    let coveredCount = settlementAnchors.filter(anchor => roadNetworkHexIds.has(anchor.hex.id)).length;
    if (coveredCount >= targetCount) return;

    const maxDistance = getGeneratedSettlementCoverageMaxDistance(lengthScale, amountScale);
    const remaining = settlementAnchors.filter(anchor => !roadNetworkHexIds.has(anchor.hex.id));
    while (remaining.length && coveredCount < targetCount) {
      const candidate = remaining
        .map(anchor => {
          const target = getNearestGeneratedRouteHexAnchor(anchor, roadNetworkHexIds, "road", seedBase, lengthScale);
          return {
            anchor,
            target,
            score: target
              ? target.score - Math.min(4, anchor.priority / 26) + seededUnit(`${seedBase}:settlement-coverage:${anchor.hex.id}`) * 1.3
              : Infinity
          };
        })
        .filter(entry => entry.target?.anchor && entry.target.distance <= maxDistance)
        .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id))[0];
      if (!candidate) break;
      remaining.splice(remaining.findIndex(anchor => anchor.hex.id === candidate.anchor.hex.id), 1);
      const sequence = buildGeneratedAnchorRouteSequence("road", candidate.target.anchor, candidate.anchor, [], {
        generatedRoadMode: true,
        pathSalt: `${seedBase}:settlement-coverage-route:${candidate.anchor.hex.id}`
      });
      if (!sequence?.length || sequence.length < 2) continue;
      if (wouldGeneratedRouteOverloadCrossings(sequence, routes, crossingAnchorHexIds)) continue;
      routes.push({
        tool: "road",
        sequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      sequence.forEach(hexId => roadNetworkHexIds.add(hexId));
      coveredCount += 1;
    }
  }

  function isGeneratedRoadSettlementAnchor(anchor) {
    return Boolean(anchor?.hex?.id && (anchor.anchorKind === "settlement" || anchor.anchorKind === "province_seat"));
  }

  function getGeneratedSettlementCoverageTargetCount(settlementCount, amountScale = 1) {
    if (settlementCount <= 0) return 0;
    const coverageRatio = Math.max(0.7, Math.min(0.94, 0.78 + amountScale * 0.08));
    return Math.min(settlementCount, Math.ceil(settlementCount * coverageRatio));
  }

  function getGeneratedSettlementCoverageMaxDistance(lengthScale = 1, amountScale = 1) {
    return 16 + lengthScale * 12 + Math.min(6, amountScale * 3);
  }

  function addGeneratedPathFeederRoutes({ routes, anchors, seedBase, lengthScale = 1, maxCount = 0 }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors) || maxCount <= 0) return;
    const roadNetworkHexIds = getGeneratedRouteHexIdSet(routes.filter(route => route?.tool === "road"));
    if (!roadNetworkHexIds.size) return;
    const anyNetworkHexIds = getGeneratedRouteHexIdSet(routes);
    const pathTargets = anchors
      .filter(anchor => anchor?.hex?.id && anchor.routeClass === "path")
      .filter(anchor => !isGeneratedRoadSettlementAnchor(anchor))
      .filter(anchor => !anyNetworkHexIds.has(anchor.hex.id))
      .map(anchor => {
        const target = getNearestGeneratedRouteHexAnchor(anchor, roadNetworkHexIds, "path", seedBase, lengthScale);
        return {
          anchor,
          target,
          score: target
            ? target.score - Math.min(2.4, anchor.priority / 32) + seededUnit(`${seedBase}:path-feeder-target:${anchor.hex.id}`) * 1.2
            : Infinity
        };
      })
      .filter(candidate => candidate.target?.anchor)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));

    let added = 0;
    pathTargets.forEach(candidate => {
      if (added >= maxCount) return;
      const maxDistance = getGeneratedPathFeederMaxDistance(candidate.anchor, lengthScale);
      if (candidate.target.distance > maxDistance) return;
      const sequence = buildGeneratedAnchorRouteSequence("path", candidate.target.anchor, candidate.anchor, [], {
        generatedPathMode: true,
        pathSalt: `${seedBase}:path-feeder:${candidate.anchor.hex.id}`
      });
      const finalSequence = candidate.anchor.stopShort ? trimGeneratedPathBeforeTarget(sequence) : sequence;
      if (!finalSequence?.length || finalSequence.length < 2) return;
      routes.push({
        tool: "path",
        sequence: finalSequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      added += 1;
    });
  }

  function getGeneratedPathFeederMaxDistance(anchor, lengthScale = 1) {
    const anchorBonus = anchor?.anchorKind === "settlement" ? 2
      : anchor?.anchorKind === "site" ? 1.5
      : anchor?.anchorKind === "hazard" ? 1
      : anchor?.anchorKind === "camp" ? -1
      : 0;
    return 5 + lengthScale * 5 + anchorBonus;
  }

  function buildGeneratedAnchorRouteSequence(tool, fromAnchor, toAnchor, detours = [], options = {}) {
    const stops = [fromAnchor, ...detours, toAnchor].filter(anchor => anchor?.hex?.id);
    const sequence = [];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const fromHexId = stops[index].hex.id;
      const toHexId = stops[index + 1].hex.id;
      const leg = tool === "path"
        ? getGeneratedPathSequence(fromHexId, toHexId, options)
        : getPathOverlaySequence("road", fromHexId, toHexId, "", options);
      if (!leg?.length || leg.length < 2) return [];
      if (!sequence.length) sequence.push(...leg);
      else sequence.push(...leg.slice(1));
    }
    return sequence;
  }

  function chooseGeneratedRoadDetours(fromAnchor, toAnchor, anchors, usedDetourIds, seedBase, step = 0, lengthScale = 1, options = {}) {
    const directDistance = roadPathHeuristic(fromAnchor.hex, toAnchor.hex);
    const maxDetours = Math.max(0, Math.min(2, Number(options.maxDetours ?? 2)));
    if (!maxDetours || directDistance < 5) return [];
    const maxExtraDistance = Math.max(3, directDistance * (0.18 + lengthScale * 0.08));
    const candidates = anchors
      .filter(anchor => isGeneratedRoadDetourAnchor(anchor) && !usedDetourIds.has(anchor.hex.id))
      .filter(anchor => anchor.hex.id !== fromAnchor.hex.id && anchor.hex.id !== toAnchor.hex.id)
      .map(anchor => {
        const viaDistance = roadPathHeuristic(fromAnchor.hex, anchor.hex) + roadPathHeuristic(anchor.hex, toAnchor.hex);
        const extraDistance = viaDistance - directDistance;
        return {
          anchor,
          extraDistance,
          score: extraDistance
            - getGeneratedRoadDetourValue(anchor)
            + seededUnit(`${seedBase}:road-detour:${step}:${fromAnchor.hex.id}:${toAnchor.hex.id}:${anchor.hex.id}`) * 1.2
        };
      })
      .filter(candidate => candidate.extraDistance >= 0 && candidate.extraDistance <= maxExtraDistance)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));
    const chosen = [];
    candidates.forEach(candidate => {
      if (chosen.length >= maxDetours) return;
      if (chosen.some(existing => roadPathHeuristic(existing.hex, candidate.anchor.hex) <= 2)) return;
      chosen.push(candidate.anchor);
    });
    return chosen;
  }

  function getGeneratedRoadDetourValue(anchor) {
    if (anchor.anchorKind === "crossing") return 4.2;
    if (anchor.anchorKind === "pass") return 3.8;
    if (anchor.anchorKind === "roadstop") return 2.4;
    if (anchor.anchorKind === "soft_crossing") return 2.2;
    return 1.4;
  }

  function trimGeneratedPathBeforeTarget(sequence) {
    if (!Array.isArray(sequence) || sequence.length <= 4) return sequence;
    return sequence.slice(0, -1);
  }

  function getGeneratedCrossingAnchorHexIds(anchors = []) {
    return new Set((anchors || [])
      .filter(anchor => anchor?.anchorKind === "crossing")
      .map(anchor => anchor.hex?.id)
      .filter(Boolean));
  }

  function wouldGeneratedRouteOverloadCrossings(sequence, routes, crossingAnchorHexIds, maxDegree = 2) {
    if (!Array.isArray(sequence) || !crossingAnchorHexIds?.size) return false;
    const degrees = getGeneratedCrossingDegrees(routes, crossingAnchorHexIds);
    for (let index = 0; index < sequence.length; index += 1) {
      const hexId = sequence[index];
      if (!crossingAnchorHexIds.has(hexId)) continue;
      const neighbors = degrees.get(hexId) || new Set();
      if (sequence[index - 1]) neighbors.add(sequence[index - 1]);
      if (sequence[index + 1]) neighbors.add(sequence[index + 1]);
      if (neighbors.size > maxDegree) return true;
    }
    return false;
  }

  function getGeneratedCrossingDegrees(routes, crossingAnchorHexIds) {
    const degrees = new Map();
    (routes || []).forEach(route => {
      if (route?.tool && route.tool !== "road") return;
      const sequence = route?.sequence || [];
      sequence.forEach((hexId, index) => {
        if (!crossingAnchorHexIds.has(hexId)) return;
        if (!degrees.has(hexId)) degrees.set(hexId, new Set());
        const neighbors = degrees.get(hexId);
        if (sequence[index - 1]) neighbors.add(sequence[index - 1]);
        if (sequence[index + 1]) neighbors.add(sequence[index + 1]);
      });
    });
    return degrees;
  }

  function addGeneratedNetworkCompletionSpurs({ routes, anchors, seedBase, lengthScale = 1, includePaths = true, crossingAnchorHexIds = new Set(), maxCount = 6 }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors) || maxCount <= 0) return;
    const networkHexIds = getGeneratedRouteHexIdSet(routes);
    const candidates = anchors
      .filter(anchor => anchor?.hex?.id && !networkHexIds.has(anchor.hex.id))
      .filter(anchor => shouldAddGeneratedNetworkCompletionSpur(anchor, includePaths, seedBase))
      .map(anchor => {
        const tool = getGeneratedCompletionSpurTool(anchor, includePaths);
        const target = getNearestGeneratedRouteHexAnchor(anchor, networkHexIds, tool, seedBase, lengthScale);
        return {
          anchor,
          tool,
          target,
          score: target
            ? target.score - getGeneratedCompletionSpurPriority(anchor) + seededUnit(`${seedBase}:completion-spur:${anchor.hex.id}`) * 1.8
            : Infinity
        };
      })
      .filter(candidate => candidate.target?.anchor)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));

    let added = 0;
    candidates.forEach(candidate => {
      if (added >= maxCount) return;
      const maxDistance = getGeneratedCompletionSpurMaxDistance(candidate.anchor, candidate.tool, lengthScale);
      if (candidate.target.distance > maxDistance) return;
      const sequence = buildGeneratedAnchorRouteSequence(candidate.tool, candidate.target.anchor, candidate.anchor, [], {
        generatedRoadMode: candidate.tool === "road",
        generatedPathMode: candidate.tool === "path",
        pathSalt: `${seedBase}:completion-route:${candidate.tool}:${candidate.anchor.hex.id}`
      });
      const finalSequence = candidate.anchor.stopShort ? trimGeneratedPathBeforeTarget(sequence) : sequence;
      if (!finalSequence?.length || finalSequence.length < 2) return;
      if (candidate.tool === "road" && wouldGeneratedRouteOverloadCrossings(finalSequence, routes, crossingAnchorHexIds)) return;
      routes.push({
        tool: candidate.tool,
        sequence: finalSequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      finalSequence.forEach(hexId => networkHexIds.add(hexId));
      added += 1;
    });
  }

  function getGeneratedRouteHexIdSet(routes) {
    const hexIds = new Set();
    (routes || []).forEach(route => {
      (route?.sequence || []).forEach(hexId => {
        if (hexId) hexIds.add(hexId);
      });
    });
    return hexIds;
  }

  function addGeneratedCrossingContinuationRoutes({ routes, anchors, seedBase, lengthScale = 1, crossingAnchorHexIds = new Set(), maxCount = 4 }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors) || !crossingAnchorHexIds?.size || maxCount <= 0) return;
    const networkHexIds = getGeneratedRouteHexIdSet(routes);
    const degrees = getGeneratedCrossingDegrees(routes, crossingAnchorHexIds);
    const crossingAnchors = anchors
      .filter(anchor => anchor?.anchorKind === "crossing" && networkHexIds.has(anchor.hex?.id))
      .filter(anchor => (degrees.get(anchor.hex.id)?.size || 0) < 2);
    const targetAnchors = anchors
      .filter(anchor => anchor?.hex?.id && anchor.routeClass !== "path" && anchor.anchorKind !== "crossing")
      .filter(anchor => networkHexIds.has(anchor.hex.id));
    let added = 0;
    crossingAnchors.forEach(crossingAnchor => {
      if (added >= maxCount) return;
      const existingNeighbors = degrees.get(crossingAnchor.hex.id) || new Set();
      const target = targetAnchors
        .map(anchor => {
          const sequence = getPathOverlaySequence("road", crossingAnchor.hex.id, anchor.hex.id, "", {
            majorRoute: false,
            generatedRoadMode: true,
            pathSalt: `${seedBase}:crossing-continuation-probe:${crossingAnchor.hex.id}:${anchor.hex.id}`
          });
          const firstStep = sequence?.[1] || "";
          if (!sequence?.length || sequence.length < 2 || existingNeighbors.has(firstStep)) return null;
          const distance = roadPathHeuristic(crossingAnchor.hex, anchor.hex);
          return {
            anchor,
            sequence,
            score: distance
              - Math.min(2.2, anchor.priority / 45)
              + seededUnit(`${seedBase}:crossing-continuation:${crossingAnchor.hex.id}:${anchor.hex.id}`) * 1.2
          };
        })
        .filter(Boolean)
        .filter(candidate => candidate.sequence.length <= Math.max(4, Math.round(7 + lengthScale * 5)))
        .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id))[0];
      if (!target) return;
      if (wouldGeneratedRouteOverloadCrossings(target.sequence, routes, crossingAnchorHexIds)) return;
      routes.push({
        tool: "road",
        sequence: target.sequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      added += 1;
    });
  }

  function shouldAddGeneratedNetworkCompletionSpur(anchor, includePaths, seedBase = "") {
    if (!anchor?.hex?.id) return false;
    if (anchor.routeClass === "detour") return true;
    if (anchor.anchorKind === "resource" || anchor.anchorKind === "soft_crossing" || anchor.anchorKind === "roadstop" || anchor.anchorKind === "stronghold") return true;
    if (anchor.anchorKind === "settlement") return true;
    if (includePaths && anchor.routeClass === "path" && anchor.anchorKind === "site") return true;
    if (includePaths && anchor.routeClass === "path" && anchor.anchorKind === "camp") return seededUnit(`${seedBase}:camp-completion:${anchor.hex.id}`) < 0.28;
    if (includePaths && anchor.routeClass === "path" && anchor.anchorKind === "hazard") return true;
    return false;
  }

  function getGeneratedCompletionSpurTool(anchor, includePaths) {
    if (isGeneratedRoadSettlementAnchor(anchor) || anchor.routeClass === "road" || anchor.anchorKind === "crossing" || anchor.anchorKind === "pass" || anchor.anchorKind === "roadstop") return "road";
    if (!includePaths) return "road";
    if (anchor.anchorKind === "soft_crossing" && anchor.priority >= 64) return "road";
    if (anchor.anchorKind === "resource" && anchor.priority >= 70) return "road";
    return "path";
  }

  function getGeneratedCompletionSpurPriority(anchor) {
    if (anchor.anchorKind === "crossing") return 7.2;
    if (anchor.anchorKind === "stronghold") return 7.1;
    if (anchor.anchorKind === "roadstop") return 7;
    if (anchor.anchorKind === "soft_crossing") return 6.2;
    if (anchor.anchorKind === "resource") return 6;
    if (anchor.anchorKind === "settlement") return 5.2;
    if (anchor.anchorKind === "site") return 3.6;
    if (anchor.anchorKind === "hazard") return 2.4;
    return 2.8;
  }

  function getGeneratedCompletionSpurMaxDistance(anchor, tool, lengthScale = 1) {
    const base = tool === "road" ? 5 : 7;
    const scale = tool === "road" ? 4 : 5;
    const anchorBonus = anchor.anchorKind === "crossing" || anchor.anchorKind === "roadstop" || anchor.anchorKind === "stronghold" ? 4 : anchor.anchorKind === "resource" || anchor.anchorKind === "soft_crossing" ? 3 : 0;
    return base + lengthScale * scale + anchorBonus;
  }

  function getNearestGeneratedRouteHexAnchor(anchor, networkHexIds, tool, seedBase, lengthScale = 1) {
    const candidates = [...(networkHexIds || [])]
      .map(hexId => hexForPathPoint(hexId))
      .filter(hex => hex && hex.id !== anchor.hex.id)
      .map(hex => {
        const distance = roadPathHeuristic(anchor.hex, hex);
        const reachPenalty = Math.max(0, distance - (tool === "road" ? 8 + lengthScale * 8 : 5 + lengthScale * 8));
        return {
          anchor: {
            hex,
            name: "",
            priority: 0,
            tier: "minor",
            routeClass: tool,
            anchorKind: "network"
          },
          distance,
          score: distance + reachPenalty + seededUnit(`${seedBase}:nearest-network:${tool}:${anchor.hex.id}:${hex.id}`) * 0.8
        };
      })
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));
    return candidates[0] || null;
  }

  function addGeneratedLocalConnectorRoutes({ routes, anchors, seedBase, lengthScale = 1, includePaths = true, crossingAnchorHexIds = new Set(), maxCount = 3 }) {
    if (!Array.isArray(routes) || !Array.isArray(anchors) || maxCount <= 0) return;
    const networkHexIds = getGeneratedRouteHexIdSet(routes);
    const localAnchors = anchors
      .filter(anchor => anchor?.hex?.id && networkHexIds.has(anchor.hex.id))
      .filter(anchor => !anchor.stopShort)
      .filter(anchor => ["settlement", "stronghold", "resource", "soft_crossing", "site", "roadstop"].includes(anchor.anchorKind));
    const candidates = [];
    localAnchors.forEach((fromAnchor, fromIndex) => {
      localAnchors.slice(fromIndex + 1).forEach(toAnchor => {
        if (fromAnchor.hex.id === toAnchor.hex.id) return;
        const distance = roadPathHeuristic(fromAnchor.hex, toAnchor.hex);
        const maxDistance = 5 + lengthScale * 7;
        if (distance > maxDistance) return;
        const seed = `${seedBase}:local-connector:${fromAnchor.hex.id}:${toAnchor.hex.id}`;
        const roll = seededUnit(seed);
        const affinity = getGeneratedLocalConnectorAffinity(fromAnchor, toAnchor);
        if (roll > affinity) return;
        candidates.push({
          fromAnchor,
          toAnchor,
          tool: getGeneratedLocalConnectorTool(fromAnchor, toAnchor, includePaths),
          score: distance - affinity * 4 + roll * 2
        });
      });
    });

    let added = 0;
    candidates
      .sort((left, right) => left.score - right.score || left.fromAnchor.hex.id.localeCompare(right.fromAnchor.hex.id))
      .forEach(candidate => {
        if (added >= maxCount) return;
        if (generatedRouteAlreadyHasConnection(routes, candidate.fromAnchor.hex.id, candidate.toAnchor.hex.id)) return;
        const sequence = buildGeneratedAnchorRouteSequence(candidate.tool, candidate.fromAnchor, candidate.toAnchor, [], {
          generatedRoadMode: candidate.tool === "road",
          generatedPathMode: candidate.tool === "path",
          pathSalt: `${seedBase}:local-route:${candidate.fromAnchor.hex.id}:${candidate.toAnchor.hex.id}`
        });
        if (!sequence?.length || sequence.length < 2) return;
        if (candidate.tool === "road" && wouldGeneratedRouteOverloadCrossings(sequence, routes, crossingAnchorHexIds)) return;
        routes.push({
          tool: candidate.tool,
          sequence,
          routeMetadata: {
            isMajorRoute: false,
            routeName: ""
          }
        });
        added += 1;
      });
  }

  function getGeneratedLocalConnectorAffinity(fromAnchor, toAnchor) {
    const kinds = new Set([fromAnchor.anchorKind, toAnchor.anchorKind]);
    if (kinds.has("stronghold") && kinds.has("settlement")) return 0.52;
    if (kinds.has("roadstop")) return 0.48;
    if (kinds.has("resource") || kinds.has("soft_crossing")) return 0.44;
    if (kinds.has("site")) return 0.34;
    return 0.28;
  }

  function getGeneratedLocalConnectorTool(fromAnchor, toAnchor, includePaths) {
    if (!includePaths) return "road";
    const kinds = new Set([fromAnchor.anchorKind, toAnchor.anchorKind]);
    if (kinds.has("stronghold")) return "road";
    if (fromAnchor.routeClass === "road" && toAnchor.routeClass === "road") return "road";
    return "path";
  }

  function generatedRouteAlreadyHasConnection(routes, fromHexId, toHexId) {
    return (routes || []).some(route => {
      const sequence = route?.sequence || [];
      for (let index = 0; index < sequence.length - 1; index += 1) {
        const left = sequence[index];
        const right = sequence[index + 1];
        if ((left === fromHexId && right === toHexId) || (left === toHexId && right === fromHexId)) return true;
      }
      return false;
    });
  }

  function addGeneratedCoastalVillagePaths({ routes, anchors, seedBase, lengthScale = 1, includePaths = true, maxCount = 3 }) {
    if (!includePaths || !Array.isArray(routes) || !Array.isArray(anchors) || maxCount <= 0) return;
    const candidates = anchors
      .filter(anchor => anchor?.anchorKind === "settlement" && anchor.routeClass !== "seat")
      .filter(anchor => anchor.priority < 86)
      .filter(anchor => !hasNearbyCoastalServicePoiForRoads(anchor.hex, 2))
      .map(anchor => {
        const target = getGeneratedCoastalPathTarget(anchor.hex, seedBase, lengthScale);
        if (!target) return null;
        const chance = 0.22 + Math.min(0.16, lengthScale * 0.08);
        const roll = seededUnit(`${seedBase}:coastal-village-path-roll:${anchor.hex.id}:${target.id}`);
        if (roll > chance) return null;
        return {
          anchor,
          target,
          score: roadPathHeuristic(anchor.hex, target)
            + seededUnit(`${seedBase}:coastal-village-path-score:${anchor.hex.id}:${target.id}`) * 1.4
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.anchor.hex.id.localeCompare(right.anchor.hex.id));

    let added = 0;
    candidates.forEach(candidate => {
      if (added >= maxCount) return;
      const sequence = getGeneratedPathSequence(candidate.anchor.hex.id, candidate.target.id, {
        generatedPathMode: true,
        pathSalt: `${seedBase}:coastal-village-route:${candidate.anchor.hex.id}:${candidate.target.id}`
      });
      if (!sequence?.length || sequence.length < 2) return;
      routes.push({
        tool: "path",
        sequence,
        routeMetadata: {
          isMajorRoute: false,
          routeName: ""
        }
      });
      added += 1;
    });
  }

  function getGeneratedCoastalPathTarget(hex, seedBase, lengthScale = 1) {
    if (!hex?.id) return null;
    const maxRadius = Math.max(2, Math.min(6, Math.round(3 + lengthScale * 2)));
    return nearbyHexesWithin(hex, maxRadius)
      .filter(isGeneratedCoastalLandingHex)
      .map(candidate => ({
        hex: candidate,
        score: roadPathHeuristic(hex, candidate)
          + getRoadLandAnchorScore(candidate) * 0.22
          + seededUnit(`${seedBase}:coastal-path-target:${hex.id}:${candidate.id}`) * 1.1
      }))
      .sort((left, right) => left.score - right.score || left.hex.id.localeCompare(right.hex.id))[0]?.hex || null;
  }

  function isGeneratedCoastalLandingHex(hex) {
    if (!hex || WATER_TERRAINS.has(hex.baseTerrain)) return false;
    return EDGE_NAMES
      .map(edgeName => getNeighborHex(hex, edgeName))
      .some(isCoastalTravelWaterHex);
  }

  function isCoastalTravelWaterHex(hex) {
    return Boolean(hex && ["coastal_water", "sea", "deep_sea"].includes(hex.baseTerrain));
  }

  function hasNearbyCoastalServicePoiForRoads(hex, radius = 2) {
    if (!hex?.id) return false;
    return [hex, ...nearbyHexesWithin(hex, radius)].some(candidate => (
      getPoisAtRoadHex(candidate).some(poi => {
        const icon = String(poi?.POI_Icon || "").toLowerCase();
        return ["port_town", "docks", "harbor", "fishing_camp", "sea_fort", "lighthouse"].includes(icon);
      })
    ));
  }

  function getGeneratedRoadAnchors(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    const pois = db?.raw?.pois || [];
    renderer.generatedRoadPoiBiasCache = new Map();
    renderer.generatedRoadSettlementAdjacencyCache = new Map();
    const hexById = new Map();
    renderer.hexes.forEach(hex => {
      hexById.set(hex.id, hex);
      if (hex.label) hexById.set(hex.label, hex);
    });
    const bestPoiByHex = new Map();

    pois.forEach(poi => {
      const hex = hexById.get(poi.Hex_ID_Ref);
      if (!hex || isWaterHex(hex)) return;
      const profile = getGeneratedRoadAnchorProfile(poi, hex, seedBase);
      const existing = bestPoiByHex.get(hex.id);
      if (!existing || profile.priority > existing.priority) bestPoiByHex.set(hex.id, profile);
    });

    const sortedPoiAnchorEntries = [...bestPoiByHex.values()]
      .sort((a, b) => b.priority - a.priority || a.hex.id.localeCompare(b.hex.id));
    const requiredPoiAnchorEntries = sortedPoiAnchorEntries.filter(isRequiredGeneratedRoadAnchorEntry);
    const requiredHexIds = new Set(requiredPoiAnchorEntries.map(entry => entry.hex.id));
    const optionalPoiAnchorLimit = Math.max(60, 140 - requiredPoiAnchorEntries.length);
    const optionalPoiAnchorEntries = sortedPoiAnchorEntries
      .filter(entry => !requiredHexIds.has(entry.hex.id))
      .slice(0, optionalPoiAnchorLimit);
    const poiAnchors = [...requiredPoiAnchorEntries, ...optionalPoiAnchorEntries]
      .map(entry => ({
        hex: entry.hex,
        name: entry.name,
        priority: entry.priority,
        tier: entry.tier,
        routeClass: entry.routeClass,
        anchorKind: entry.anchorKind,
        stopShort: entry.stopShort
      }));
    return [...poiAnchors, ...getFallbackRoadAnchors(campaignId, new Set(poiAnchors.map(anchor => anchor.hex.id)))]
      .filter((anchor, index, list) => anchor?.hex && list.findIndex(candidate => candidate.hex.id === anchor.hex.id) === index);
  }

  function isRequiredGeneratedRoadAnchorEntry(entry) {
    if (!entry?.hex?.id) return false;
    if (entry.routeClass === "seat" || entry.routeClass === "road" || entry.routeClass === "detour") return true;
    return ["province_seat", "settlement", "stronghold", "crossing", "pass", "roadstop"].includes(entry.anchorKind || "");
  }

  function getPoiIconMetaForRoads(poi) {
    return window.CampaignPoiIcons?.getIconMeta?.(poi?.POI_Icon || "") || null;
  }

  function getPoisAtRoadHex(hex) {
    if (!hex?.id) return [];
    if (renderer.poisByHexId instanceof Map) {
      return renderer.poisByHexId.get(hex.id) || renderer.poisByHexId.get(hex.label) || [];
    }
    if (db?.poisByHexId) {
      return db.poisByHexId[hex.id] || db.poisByHexId[hex.label] || [];
    }
    return [];
  }

  function isSettlementPoiForRoads(poi) {
    const normalizedType = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "")
      || String(poi?.POI_Type_Value || poi?.POI_Type || "").trim().toLowerCase();
    return normalizedType === "settlement";
  }

  function hasSettlementPoiNearRoadHex(hex, radius = 1) {
    if (!hex?.id) return false;
    const cacheKey = `${hex.id}:${radius}`;
    if (renderer.generatedRoadSettlementAdjacencyCache?.has(cacheKey)) {
      return renderer.generatedRoadSettlementAdjacencyCache.get(cacheKey);
    }
    const nearbyHexes = [hex, ...nearbyHexesWithin(hex, radius)];
    const result = nearbyHexes.some(candidate => getPoisAtRoadHex(candidate).some(isSettlementPoiForRoads));
    if (renderer.generatedRoadSettlementAdjacencyCache) renderer.generatedRoadSettlementAdjacencyCache.set(cacheKey, result);
    return result;
  }

  function getGeneratedRoadAnchorProfile(poi, hex, seedBase) {
    const text = `${poi?.POI_Type || ""} ${poi?.Name || ""} ${poi?.POI_Icon || ""} ${(Array.isArray(poi?.POI_Tags) ? poi.POI_Tags.join(" ") : poi?.POI_Tags || "")}`.toLowerCase();
    const name = String(poi?.Name || "").trim();
    const icon = String(poi?.POI_Icon || "").toLowerCase();
    const iconMeta = getPoiIconMetaForRoads(poi);
    const traitSet = new Set(iconMeta?.traits || []);
    const family = iconMeta?.family || "";
    const tagSet = new Set(Array.isArray(poi?.POI_Tags) ? poi.POI_Tags.map(tag => String(tag || "").toLowerCase()) : []);
    const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "")
      || String(poi?.POI_Type_Value || poi?.POI_Type || "").trim().toLowerCase();
    const population = parseRoadPoiPopulation(poi);
    const nearSettlement = hasSettlementPoiNearRoadHex(hex, 1);
    let priority = 10;
    let tier = "minor";
    if (traitSet.has("river_crossing_anchor")) {
      if (icon === "bridge_gate") {
        priority = 84;
        tier = "major";
      } else if (icon === "ford") {
        priority = 66;
        tier = "minor";
      } else if (icon === "ferry") {
        priority = nearSettlement ? 46 : 62;
        tier = nearSettlement ? "minor" : "major";
      } else {
        priority = 58;
        tier = "minor";
      }
    } else if (traitSet.has("pass_anchor")) {
      priority = nearSettlement ? 52 : 74;
      tier = "major";
    } else if (traitSet.has("frontier_anchor")) {
      priority = nearSettlement ? 48 : 70;
      tier = "major";
    } else if (tagSet.has("crossroads") || traitSet.has("crossroads")) {
      priority = 82;
      tier = "major";
    } else if (family === "settlement") {
      priority = traitSet.has("major") || traitSet.has("urban") ? 100 : 78;
      tier = "major";
    } else if (family === "stronghold") {
      priority = 76;
      tier = "major";
    } else if (family === "resource_site" && (traitSet.has("trade") || traitSet.has("settlement_adjacent"))) {
      priority = 72;
      tier = "major";
    } else if (family === "resource_site") {
      priority = 48;
      tier = "minor";
    } else if (family === "waypoint" && (traitSet.has("trade") || traitSet.has("roadside"))) {
      priority = 46;
      tier = "minor";
    } else if (family === "holy_site" || family === "arcane_site") {
      priority = 42;
      tier = "minor";
    } else if (family === "ruin" || family === "dungeon" || family === "hazard") {
      priority = 18;
      tier = "minor";
    } else if (icon === "bridge_gate") {
      priority = 84;
      tier = "major";
    } else if (icon === "ford" || tagSet.has("river_crossing")) {
      priority = 66;
      tier = "minor";
    } else if (/(capital|metropolis|city|harbor|harbour|port|market|crossroads)/.test(text)) {
      priority = 100;
      tier = "major";
    } else if (/(town|village|settlement|district|docks|fort|castle|keep|hold|abbey|farm|inn)/.test(text)) {
      priority = 76;
      tier = "major";
    } else if (/(tower|temple|oasis|bridge|ford|lodge|camp|outpost|mine|quarry|mill)/.test(text)) {
      priority = 48;
      tier = "minor";
    } else if (/(ruin|dungeon|cave|tomb|pit|obelisk|barrow|crypt)/.test(text)) {
      priority = 18;
      tier = "minor";
    } else {
      priority = 36;
    }
    priority -= getRoadLandAnchorScore(hex) * 1.5;
    priority += seededUnit(`${seedBase}:road-anchor:${poi.POI_ID || name || hex.id}`) * 6;
    const routeProfile = getGeneratedRoadAnchorRouteProfile({
      type,
      family,
      icon,
      traitSet,
      tagSet,
      priority,
      tier,
      population,
      text
    });
    return { hex, name, priority, tier, ...routeProfile };
  }

  function parseRoadPoiPopulation(poi) {
    const value = String(poi?.Population || "").replace(/[^\d]/g, "");
    return value ? Number(value) || 0 : 0;
  }

  function getGeneratedRoadAnchorRouteProfile({ type, family, icon, traitSet, tagSet, priority, tier, population, text }) {
    const isSettlement = type === "settlement" || family === "settlement";
    const isStronghold = type === "stronghold" || family === "stronghold";
    const isResource = type === "resource_site" || family === "resource_site";
    const isWaypoint = type === "waypoint" || family === "waypoint";
    const isDungeonOrHazard = ["dungeon", "dungeon_complex", "hazard"].includes(type) || ["dungeon", "hazard"].includes(family);
    const isSite = ["ruin", "holy_site", "arcane_site", "wilderness_site", "landmark"].includes(type) || ["ruin", "holy_site", "arcane_site", "wilderness_site", "landmark"].includes(family);
    const isCrossing = traitSet.has("river_crossing_anchor") || icon === "bridge_gate" || icon === "ford" || icon === "bridge" || icon === "ferry" || tagSet.has("river_crossing");
    const isPass = traitSet.has("pass_anchor") || icon === "mountain_pass" || icon === "canyon_pass" || icon === "mountain_gate";
    const isCampsite = icon === "campsite";
    const isRoadstop = isWaypoint && !isCampsite && (traitSet.has("roadside") || traitSet.has("rest") || traitSet.has("crossroads") || tagSet.has("crossroads"));
    const isSoftCrossing = isResource && (traitSet.has("river_or_coastal") || traitSet.has("fishing") || traitSet.has("farming") || traitSet.has("settlement_adjacent") || /mill|dock|fish|farm|ford|bridge/.test(text || ""));

    if (isCrossing) return { routeClass: "detour", anchorKind: "crossing", stopShort: false };
    if (isPass) return { routeClass: icon === "mountain_gate" ? "road" : "detour", anchorKind: "pass", stopShort: false };
    if (isSettlement) {
      const seat = traitSet.has("major")
        || traitSet.has("urban")
        || ["city", "walled_city", "port_town", "mountain_city"].includes(icon)
        || population >= 9000
        || priority >= 92;
      return {
        routeClass: seat ? "seat" : priority >= 72 || tier === "major" ? "road" : "path",
        anchorKind: seat ? "province_seat" : "settlement",
        stopShort: false
      };
    }
    if (isStronghold) return { routeClass: "road", anchorKind: "stronghold", stopShort: false };
    if (isRoadstop) return { routeClass: "road", anchorKind: "roadstop", stopShort: false };
    if (isCampsite) return { routeClass: "path", anchorKind: "camp", stopShort: false };
    if (isResource) {
      return {
        routeClass: priority >= 58 || traitSet.has("trade") || traitSet.has("settlement_adjacent") ? "road" : "path",
        anchorKind: isSoftCrossing ? "soft_crossing" : "resource",
        stopShort: false
      };
    }
    if (isDungeonOrHazard) return { routeClass: "path", anchorKind: "hazard", stopShort: true };
    if (isSite) return { routeClass: "path", anchorKind: "site", stopShort: false };
    return { routeClass: priority >= 70 ? "road" : "path", anchorKind: "minor", stopShort: false };
  }

  function isGeneratedRoadDetourAnchor(anchor) {
    return ["crossing", "pass", "roadstop", "soft_crossing"].includes(anchor?.anchorKind || "");
  }

  function getRoadVisualAnchorBreakHexIds(segments = []) {
    const touchedHexIds = new Set();
    (segments || []).forEach(segment => {
      if (segment?.From_Hex_ID_Ref) touchedHexIds.add(segment.From_Hex_ID_Ref);
      if (segment?.To_Hex_ID_Ref) touchedHexIds.add(segment.To_Hex_ID_Ref);
    });
    const breakHexIds = new Set();
    touchedHexIds.forEach(hexId => {
      const hex = hexForPathPoint(hexId);
      if (!hex) return;
      if (getPoisAtRoadHex(hex).some(isRoadVisualAnchorPoi)) breakHexIds.add(hex.id);
    });
    return breakHexIds;
  }

  function isRoadVisualAnchorPoi(poi) {
    const icon = String(poi?.POI_Icon || "").toLowerCase();
    const iconMeta = getPoiIconMetaForRoads(poi);
    const traits = new Set(iconMeta?.traits || []);
    const family = iconMeta?.family || "";
    const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "")
      || String(poi?.POI_Type_Value || poi?.POI_Type || "").trim().toLowerCase();
    return traits.has("river_crossing_anchor")
      || traits.has("pass_anchor")
      || traits.has("roadside")
      || traits.has("settlement_adjacent")
      || icon === "bridge"
      || icon === "bridge_gate"
      || icon === "ford"
      || icon === "ferry"
      || icon === "inn"
      || icon === "tavern"
      || icon === "lodge"
      || type === "resource_site"
      || family === "resource_site";
  }

  function getRoadCrossingPoiBias(hex) {
    if (!hex?.id) return 0;
    if (renderer.generatedRoadPoiBiasCache?.has(hex.id)) return renderer.generatedRoadPoiBiasCache.get(hex.id);
    const nearSettlement = hasSettlementPoiNearRoadHex(hex, 1);
    const bias = getPoisAtRoadHex(hex).reduce((best, poi) => {
      const icon = String(poi?.POI_Icon || "").toLowerCase();
      const iconMeta = getPoiIconMetaForRoads(poi);
      const traitSet = new Set(iconMeta?.traits || []);
      const tags = Array.isArray(poi?.POI_Tags) ? poi.POI_Tags.map(tag => String(tag || "").toLowerCase()) : [];
      if (traitSet.has("river_crossing_anchor")) {
        if (icon === "bridge_gate") return Math.max(best, 3.2);
        if (icon === "ford") return Math.max(best, 2.5);
        if (icon === "ferry") return Math.max(best, nearSettlement ? 1.1 : 2.2);
        return Math.max(best, nearSettlement ? 1 : 1.8);
      }
      if (traitSet.has("pass_anchor")) return Math.max(best, nearSettlement ? 1.1 : 2.1);
      if (traitSet.has("frontier_anchor")) return Math.max(best, nearSettlement ? 0.9 : 1.8);
      if (icon === "bridge_gate") return Math.max(best, 3.2);
      if (icon === "ford") return Math.max(best, 2.5);
      if (tags.includes("river_crossing")) return Math.max(best, 1.4);
      return best;
    }, 0);
    if (renderer.generatedRoadPoiBiasCache) renderer.generatedRoadPoiBiasCache.set(hex.id, bias);
    return bias;
  }

  function getFallbackRoadAnchors(campaignId, existingAnchorIds = new Set()) {
    if (existingAnchorIds.size >= 2) return [];
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
      const regionHex = hexes
        .slice()
        .sort((a, b) => (
          Math.hypot(a.center.x - center.x, a.center.y - center.y) - Math.hypot(b.center.x - center.x, b.center.y - center.y) ||
          seededUnit(`${seedBase}:road-region:${regionId}:${a.id}`) - seededUnit(`${seedBase}:road-region:${regionId}:${b.id}`)
        ))[0];
      return regionHex ? {
        hex: regionHex,
        name: "",
        priority: 28 + seededUnit(`${seedBase}:road-fallback-region:${regionId}`) * 4,
        tier: "minor",
        routeClass: "path",
        anchorKind: "fallback"
      } : null;
    }).filter(Boolean);

    const broadLand = renderer.hexes
      .filter(hex => !isWaterHex(hex) && !existingAnchorIds.has(hex.id))
      .sort((a, b) => (
        getRoadLandAnchorScore(a) - getRoadLandAnchorScore(b) ||
        seededUnit(`${seedBase}:road-land:${a.id}`) - seededUnit(`${seedBase}:road-land:${b.id}`)
      ))
      .slice(0, 8)
      .map(hex => ({
        hex,
        name: "",
        priority: 20 - getRoadLandAnchorScore(hex),
        tier: "minor",
        routeClass: "path",
        anchorKind: "fallback"
      }));

    return [...regionCenters, ...broadLand]
      .filter((anchor, index, list) => (
        anchor?.hex &&
        !existingAnchorIds.has(anchor.hex.id) &&
        list.findIndex(candidate => candidate.hex.id === anchor.hex.id) === index
      ))
      .slice(0, 12);
  }

  function getGeneratedRoadBackboneScore(fromAnchor, toAnchor, seedBase, step = 0, lengthScale = 1) {
    const distance = roadPathHeuristic(fromAnchor.hex, toAnchor.hex);
    const importanceBonus = (fromAnchor.priority + toAnchor.priority) / 55;
    const majorBias = fromAnchor.tier === "major" && toAnchor.tier === "major" ? -1.2 : 0;
    const reachPenalty = Math.max(0, distance - (12 + lengthScale * 15)) * (0.9 / Math.max(0.5, lengthScale));
    const roll = seededUnit(`${seedBase}:road-backbone:${step}:${fromAnchor.hex.id}:${toAnchor.hex.id}`) * 1.8;
    return distance * 1.35 + reachPenalty - importanceBonus + majorBias + roll;
  }

  function getGeneratedRoadFeederScore(anchor, connectedAnchor, seedBase, lengthScale = 1) {
    const distance = roadPathHeuristic(anchor.hex, connectedAnchor.hex);
    const reachPenalty = Math.max(0, distance - (8 + lengthScale * 10)) * (1.25 / Math.max(0.5, lengthScale));
    return distance
      + reachPenalty
      + Math.max(0, connectedAnchor.priority - anchor.priority) * 0.015
      + seededUnit(`${seedBase}:road-feeder:${anchor.hex.id}:${connectedAnchor.hex.id}`) * 0.9;
  }

  function getGeneratedPathFeederScore(anchor, connectedAnchor, seedBase, lengthScale = 1) {
    const distance = roadPathHeuristic(anchor.hex, connectedAnchor.hex);
    const reachPenalty = Math.max(0, distance - (5 + lengthScale * 8)) * (0.85 / Math.max(0.5, lengthScale));
    const hazardPenalty = anchor.stopShort ? -0.6 : 0;
    return distance
      + reachPenalty
      + hazardPenalty
      - Math.min(1.2, anchor.priority / 90)
      + seededUnit(`${seedBase}:path-feeder:${anchor.hex.id}:${connectedAnchor.hex.id}`) * 1.1;
  }

  function buildGeneratedRoadRouteName(fromAnchor, toAnchor, seedBase, routeIndex, usedNames = new Set()) {
    const first = sanitizeGeneratedRoadNamePart(fromAnchor?.name);
    const second = sanitizeGeneratedRoadNamePart(toAnchor?.name);
    const ordered = [first, second].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const baseName = ordered.length >= 2
      ? `${ordered[0]}-${ordered[1]} Road`
      : ordered[0]
      ? `${ordered[0]} Road`
      : `${getGeneratedRoadDirectionName(fromAnchor?.hex, toAnchor?.hex)} Road`;
    return ensureUniqueGeneratedRoadName(baseName, usedNames, `${seedBase}:road-name:${routeIndex}`);
  }

  function sanitizeGeneratedRoadNamePart(name) {
    return String(name || "")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s'-]/g, "")
      .trim()
      .slice(0, 40);
  }

  function getGeneratedRoadDirectionName(fromHex, toHex) {
    if (!fromHex || !toHex) return "High";
    const dx = Number(toHex.center?.x || 0) - Number(fromHex.center?.x || 0);
    const dy = Number(toHex.center?.y || 0) - Number(fromHex.center?.y || 0);
    if (Math.abs(dx) > Math.abs(dy) * 1.35) return dx >= 0 ? "Eastmarch" : "Westreach";
    if (Math.abs(dy) > Math.abs(dx) * 1.35) return dy >= 0 ? "Southroad" : "Northroad";
    if (dx >= 0 && dy >= 0) return "Sunward";
    if (dx >= 0 && dy < 0) return "Dawnward";
    if (dx < 0 && dy >= 0) return "Duskwatch";
    return "Highroad";
  }

  function ensureUniqueGeneratedRoadName(baseName, usedNames, seed) {
    const normalizedBase = String(baseName || "").trim() || "High Road";
    let candidate = normalizedBase;
    let counter = 2 + Math.floor(seededUnit(seed) * 2);
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${normalizedBase} ${counter}`;
      counter += 1;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
  }

  function getRoadLandAnchorScore(hex) {
    let score = 5;
    if (["plains", "grassland", "lush_grassland", "beach"].includes(hex.baseTerrain)) score -= 2;
    if ((hex.features || []).includes("farmland")) score -= 2;
    if ((hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "volcano", "cliffs", "jungle", "marsh"].includes(feature))) score += 3;
    score += Math.abs(Number(hex.elevation || 0) - 1) * 0.8;
    return score;
  }

  function buildGeneratedRiverRoutes(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    const amountScale = Math.max(0.25, Math.min(2, Number(renderer.drawing.generationRiverAmount || 100) / 100));
    const lengthScale = Math.max(0.6, Math.min(3, Number(renderer.drawing.generationRiverLength || 100) / 100));
    const wildcardScale = Math.max(0, Math.min(2, Number(renderer.drawing.generationRiverWildcards || 100) / 100));
    const maxRivers = Math.max(1, Math.round(7 * amountScale));
    const sources = renderer.hexes
      .filter(hex => !isWaterHex(hex) && getRiverSourceScore(hex) > 0)
      .sort((a, b) => (
        getSeededRiverSourceScore(b, seedBase) - getSeededRiverSourceScore(a, seedBase) ||
        a.id.localeCompare(b.id)
      ));
    const wildcardSources = getGeneratedRiverWildcardSourceEntries(sources, seedBase, amountScale, wildcardScale);
    const sourceEntries = injectGeneratedRiverWildcardSourceEntries(sources, wildcardSources, seedBase, maxRivers, wildcardScale);
    const wildcardRouteTarget = getGeneratedRiverWildcardRouteTarget(wildcardSources, wildcardScale, maxRivers);
    const routes = [];
    const existingRiverHexIds = getExistingRiverOverlayHexIds();
    const usedHexes = new Set();
    const selectedSources = [];
    const sourceDensityById = new Map(sources.map(source => [source.id, getGeneratedRiverSourceLocalDensity(source, sources)]));
    let trunkCount = 0;
    let wildcardTrunkCount = 0;

    for (const sourceEntry of sourceEntries) {
      if (trunkCount >= maxRivers) break;
      const source = sourceEntry?.source || sourceEntry;
      const isWildcardSource = Boolean(sourceEntry?.wildcard);
      const wildcardRoutesRemaining = Math.max(0, wildcardRouteTarget - wildcardTrunkCount);
      const remainingSlots = Math.max(0, maxRivers - trunkCount);
      if (!isWildcardSource && wildcardRoutesRemaining > 0 && remainingSlots <= wildcardRoutesRemaining) continue;
      const localDensity = isWildcardSource
        ? Math.max(0.7, 0.65 + Number(sourceEntry?.nearbyCoreCount || 0) * 0.3)
        : (sourceDensityById.get(source.id) || 1);
      const preferredSpacing = getGeneratedRiverPreferredSourceSpacing(amountScale, trunkCount, maxRivers);
      const effectiveSpacing = isWildcardSource
        ? Math.max(3, preferredSpacing - Math.round(2 + wildcardScale * 2.5))
        : preferredSpacing;
      const nearestSelectedDistance = selectedSources.reduce((best, candidate) => (
        Math.min(best, getGeneratedRiverSourceDistance(candidate, source))
      ), Infinity);
      if (
        nearestSelectedDistance < effectiveSpacing
        && trunkCount < Math.max(1, Math.round(maxRivers * 0.7))
        && !(isWildcardSource && wildcardRoutesRemaining > 0)
      ) continue;
      const nearbySelectedCount = selectedSources.filter(candidate => (
        getGeneratedRiverSourceDistance(candidate, source) <= 3
      )).length;
      const clusterAllowance = isWildcardSource
        ? 1
        : getGeneratedRiverSourceClusterAllowance(source, localDensity, amountScale, seedBase);
      if (nearbySelectedCount >= clusterAllowance && !(isWildcardSource && wildcardRoutesRemaining > 0)) continue;
      const joinPressure = getGeneratedRiverJoinPressure({
        localDensity,
        siblingIndex: nearbySelectedCount,
        nearestSelectedDistance,
        wildcardSource: isWildcardSource
      });
      const blockedHexIds = new Set([...existingRiverHexIds, ...usedHexes]);
      const route = getGeneratedRiverRoute(source, campaignId, {
        seedBase,
        amountScale,
        lengthScale,
        blockedHexIds,
        localDensity,
        siblingIndex: nearbySelectedCount,
        nearestSelectedDistance,
        joinPressure,
        wildcardSource: isWildcardSource,
        routeVariantKey: `${isWildcardSource ? "wild:" : ""}${source.id}:${nearbySelectedCount}:${localDensity}`
      });
      const sequence = route?.sequence || [];
      if (!sequence || sequence.length < 4) continue;
      if (isGeneratedRiverSequenceTooOverlapped(sequence, blockedHexIds)) continue;
      routes.push(...(route.routes || []));
      trunkCount += 1;
      if (isWildcardSource) wildcardTrunkCount += 1;
      selectedSources.push(source);
      getGeneratedRiverOccupiedHexIds(route).forEach(hexId => usedHexes.add(hexId));
    }

    return routes;
  }

  function getGeneratedRiverWildcardRouteTarget(wildcardSources, wildcardScale, maxRivers) {
    const available = Array.isArray(wildcardSources) ? wildcardSources.length : 0;
    if (!available || wildcardScale < 1.35) return 0;
    const preferred = wildcardScale >= 1.85 ? 2 : 1;
    return Math.max(1, Math.min(available, preferred, Math.max(1, Math.round(maxRivers * 0.34))));
  }

  function getGeneratedRiverOccupiedHexIds(route) {
    const hexIds = new Set(Array.isArray(route?.sequence) ? route.sequence.filter(Boolean) : []);
    (route?.routes || []).forEach(visibleRoute => {
      const sequence = Array.isArray(visibleRoute?.sequence) ? visibleRoute.sequence : [];
      sequence.forEach(hexId => {
        if (hexId) hexIds.add(hexId);
      });
    });
    return hexIds;
  }

  function isGeneratedRiverHighlandHex(hex) {
    if (!hex || isWaterHex(hex)) return false;
    return (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "ridges", "cliffs"].includes(feature));
  }

  function getRiverSourceScore(hex) {
    if (!hex || isWaterHex(hex)) return 0;
    const elevation = Number(hex.elevation || 0);
    const highlandFeature = isGeneratedRiverHighlandHex(hex);
    const immediateNeighbors = EDGE_NAMES
      .map(edgeName => getNeighborHex(hex, edgeName))
      .filter(Boolean);
    const adjacentHighlandCount = immediateNeighbors.filter(isGeneratedRiverHighlandHex).length;
    const adjacentUplandCount = immediateNeighbors.filter(neighbor => Number(neighbor.elevation || 0) >= 3).length;
    if (elevation < 2 && !highlandFeature && !adjacentHighlandCount) return 0;
    const elevationScore = elevation >= 4
      ? 3.2 + (elevation - 4) * 1.1
      : elevation >= 3
        ? 2.2 + (elevation - 3) * 0.7
        : elevation >= 2
          ? 1
          : 0.4;
    return elevationScore
      + (highlandFeature ? 2.4 : 0)
      + Math.min(1.4, adjacentHighlandCount * 0.42)
      + Math.min(0.6, adjacentUplandCount * 0.14);
  }

  function getSeededRiverSourceScore(hex, seedBase) {
    return getRiverSourceScore(hex) + seededUnit(`${seedBase}:river-source:${hex.id}`) * 5;
  }

  function getExistingRiverOverlayHexIds() {
    const hexIds = new Set();
    (renderer.mapOverlays || []).forEach(overlay => {
      if (overlay?.Overlay_Type !== "river") return;
      if (overlay.From_Hex_ID_Ref) hexIds.add(overlay.From_Hex_ID_Ref);
      if (overlay.To_Hex_ID_Ref) hexIds.add(overlay.To_Hex_ID_Ref);
    });
    return hexIds;
  }

  function getOddQCubeCoord(hex) {
    if (!hex) return null;
    const cubeX = Number(hex.x || 0);
    const cubeZ = Number(hex.y || 0) - ((cubeX - (cubeX & 1)) / 2);
    const cubeY = -cubeX - cubeZ;
    return { x: cubeX, y: cubeY, z: cubeZ };
  }

  function getGeneratedRiverSourceDistance(fromHex, toHex) {
    if (!fromHex?.id || !toHex?.id) return Infinity;
    const fromCube = getOddQCubeCoord(fromHex);
    const toCube = getOddQCubeCoord(toHex);
    if (!fromCube || !toCube) return Infinity;
    return Math.max(
      Math.abs(fromCube.x - toCube.x),
      Math.abs(fromCube.y - toCube.y),
      Math.abs(fromCube.z - toCube.z)
    );
  }

  function getGeneratedRiverSourceLocalDensity(source, sources, radius = 3) {
    if (!source?.id) return 0;
    const sourceIds = new Set((sources || []).map(candidate => candidate?.id).filter(Boolean));
    return 1 + nearbyHexesWithin(source, radius).reduce((count, candidate) => (
      candidate?.id && sourceIds.has(candidate.id)
        ? count + 1
        : count
    ), 0);
  }

  function getGeneratedRiverNearbyCandidateCount(hex, candidateIds, radius = 4) {
    if (!hex?.id || !(candidateIds instanceof Set) || !candidateIds.size) return 0;
    return nearbyHexesWithin(hex, radius).reduce((count, candidate) => (
      candidate?.id && candidateIds.has(candidate.id)
        ? count + 1
        : count
    ), 0);
  }

  function getGeneratedRiverWildcardSourceEntries(sources, seedBase, amountScale, wildcardScale = 1) {
    const wildcardMultiplier = wildcardScale <= 0
      ? 0
      : wildcardScale * (0.7 + wildcardScale * 0.45);
    const wildcardChance = Math.min(0.58, (0.07 + Math.max(0, amountScale - 0.5) * 0.08) * wildcardMultiplier);
    if (wildcardScale < 1.35 && seededUnit(`${seedBase}:river-wildcard-enable`) >= wildcardChance) return [];

    const sourceIds = new Set((sources || []).map(source => source?.id).filter(Boolean));
    const candidates = renderer.hexes
      .map(hex => getGeneratedRiverWildcardSourceRecord(hex, sourceIds, seedBase))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));

    const selected = [];
    const maxWildcardSources = wildcardScale >= 1.7 ? 2 : 1;
    candidates.forEach(candidate => {
      if (selected.length >= maxWildcardSources) return;
      if (selected.some(existing => getGeneratedRiverSourceDistance(existing.source, candidate.source) < 10)) return;
      selected.push(candidate);
    });
    return selected;
  }

  function getGeneratedRiverWildcardSourceRecord(hex, sourceIds, seedBase) {
    if (!hex?.id || isWaterHex(hex) || getRiverSourceScore(hex) > 0) return null;
    const elevation = Number(hex.elevation || 0);
    if (getOuterMapEdge(hex)) return null;
    if (["beach", "deep_desert"].includes(hex.baseTerrain)) return null;

    const nearbyCoreCount = getGeneratedRiverNearbyCandidateCount(hex, sourceIds, 4);
    const nearby = nearbyHexesWithin(hex, 2);
    if (nearby.some(neighbor => isWaterHex(neighbor))) return null;
    if (nearbyCoreCount > 2) return null;

    const vegetationCount = nearby.filter(neighbor => (
      (neighbor.features || []).some(feature => ["woods", "forest", "jungle", "marsh", "shrub"].includes(feature))
    )).length;
    const marshyCount = nearby.filter(neighbor => (
      neighbor.baseTerrain === "wetland" || (neighbor.features || []).includes("marsh")
    )).length;
    const springTerrainBonus = hex.baseTerrain === "wetland"
      ? 1.65
      : hex.baseTerrain === "lush_grassland"
        ? 1.05
        : hex.baseTerrain === "grassland"
          ? 0.35
          : 0;
    const springLikeTerrain = springTerrainBonus > 0 || marshyCount > 0;
    if (elevation < (springLikeTerrain ? 0 : 1)) return null;
    const roughness = getGeneratedRiverSinkRoughness(hex);
    const interiorNeighbors = nearby.filter(neighbor => !getOuterMapEdge(neighbor)).length;
    const score = (nearbyCoreCount === 0 ? 4.1 : nearbyCoreCount === 1 ? 2.65 : 1.25)
      + elevation * 0.75
      + springTerrainBonus
      + Math.min(1.25, vegetationCount * 0.18)
      + Math.min(1.05, marshyCount * 0.22)
      + roughness * 0.35
      + Math.min(0.9, interiorNeighbors * 0.08)
      + seededUnit(`${seedBase}:river-wildcard-source:${hex.id}`) * 1.1;
    return {
      source: hex,
      wildcard: true,
      nearbyCoreCount,
      score
    };
  }

  function injectGeneratedRiverWildcardSourceEntries(sources, wildcardSources, seedBase, maxRivers, wildcardScale = 1) {
    const entries = (sources || []).map(source => ({ source, wildcard: false }));
    if (!Array.isArray(wildcardSources) || !wildcardSources.length) return entries;
    const insertProgress = Math.max(0.16, Math.min(0.64,
      0.42
      - Math.max(0, wildcardScale - 1) * 0.14
      + seededUnit(`${seedBase}:river-wildcard-insert`) * 0.18
    ));
    const insertIndex = Math.min(
      entries.length,
      Math.max(2, Math.round(Math.min(maxRivers, entries.length) * insertProgress))
    );
    wildcardSources.forEach((entry, index) => {
      entries.splice(Math.min(entries.length, insertIndex + index), 0, entry);
    });
    return entries;
  }

  function getGeneratedRiverSourceClusterAllowance(source, localDensity, amountScale, seedBase) {
    let allowance = 1;
    const extraCapacity = Math.min(2, Math.max(0, Math.round(localDensity || 1) - 3));
    for (let index = 0; index < extraCapacity; index += 1) {
      const chance = Math.max(0, Math.min(0.82,
        0.03
        + Math.max(0, amountScale - 1.05) * 0.3
        + Math.max(0, (localDensity || 1) - 3) * 0.08
        + Math.max(0, getRiverSourceScore(source) - 5.2) * 0.03
        - index * 0.22
      ));
      if (seededUnit(`${seedBase}:river-cluster-allowance:${source.id}:${index}`) < chance) {
        allowance += 1;
      }
    }
    return allowance;
  }

  function getGeneratedRiverPreferredSourceSpacing(amountScale, trunkCount, maxRivers) {
    const progress = trunkCount / Math.max(1, maxRivers - 1 || 1);
    const wideSpacingBase = 10.5 - Math.min(3.5, Math.max(0, amountScale - 0.25) * 1.8);
    return Math.max(5, Math.round(wideSpacingBase - progress * 3));
  }

  function getGeneratedRiverJoinPressure(options = {}) {
    const localDensity = Math.max(1, Number(options.localDensity || 1));
    const siblingIndex = Math.max(0, Number(options.siblingIndex || 0));
    const nearestSelectedDistance = Number.isFinite(Number(options.nearestSelectedDistance))
      ? Number(options.nearestSelectedDistance)
      : Infinity;
    const distancePressure = Number.isFinite(nearestSelectedDistance)
      ? Math.max(0, 1 - Math.max(0, nearestSelectedDistance - 2) / 6)
      : 0;
    return Math.max(0, Math.min(1,
      siblingIndex * 0.38
      + Math.max(0, localDensity - 2) * 0.12
      + distancePressure * 0.46
      + (options.wildcardSource ? 0.08 : 0)
    ));
  }

  function isGeneratedRiverSequenceTooOverlapped(sequence, blockedHexIds) {
    if (!(blockedHexIds instanceof Set) || !blockedHexIds.size || !Array.isArray(sequence) || !sequence.length) return false;
    const headWindow = sequence.slice(0, Math.min(6, sequence.length));
    const headOverlap = headWindow.filter(hexId => blockedHexIds.has(hexId)).length;
    if (headOverlap >= Math.max(3, headWindow.length - 1)) return true;
    const totalOverlap = sequence.filter(hexId => blockedHexIds.has(hexId)).length;
    return totalOverlap >= Math.max(sequence.length - 2, Math.round(sequence.length * 0.72));
  }

  function getGeneratedRiverRoute(source, campaignId, options = {}) {
    const seedBase = options.seedBase || getGenerationSeedBase(campaignId);
    const lengthScale = options.lengthScale || Math.max(0.6, Math.min(3, Number(renderer.drawing.generationRiverLength || 100) / 100));
    const entryEdge = getOuterMapEdge(source);
    const startsOffMap = Boolean(entryEdge && seededUnit(`${seedBase}:river-entry:${source.id}`) < 0.45);
    const lengthBand = getGeneratedRiverLengthBand(source, seedBase, lengthScale, options);
    const landGuides = getGeneratedRiverLandGuideCandidates(source, seedBase, lengthBand);
    const goals = getGeneratedRiverGoalCandidates(source, seedBase, lengthScale, lengthBand);
    const borderGoals = getGeneratedRiverBorderGuideCandidates(source, seedBase, lengthBand);
    const naturalGuides = landGuides.length ? landGuides : goals;

    const previousSalt = renderer.drawing.manualRiverPathSalt;
    const salt = createManualRiverPathSalt(source.id, options.routeVariantKey || (naturalGuides.length ? naturalGuides.slice(0, 4).map(goal => goal.id).join(":") : "legacy-fallback"));
    renderer.drawing.manualRiverPathSalt = salt;
    let sequence = getGeneratedRiverNaturalPathSequence(source.id, naturalGuides, {
      ...options,
      source,
      seedBase,
      lengthScale,
      lengthBand,
      landGuides,
      waterGoals: goals,
      borderGoals
    });
    if ((!sequence?.length || sequence.length < 4) && !landGuides.length && goals.length) {
      sequence = getGeneratedRiverAdaptivePathSequence(source.id, goals, { source, seedBase, lengthScale });
    }
    if ((!sequence?.length || sequence.length < 4) && !landGuides.length && goals.length) {
      sequence = getGeneratedRiverFallbackPathSequence(source.id, goals);
    }
    if (!sequence?.length || sequence.length < 4) {
      sequence = getLegacyGeneratedRiverRouteSequence(source, seedBase, lengthScale);
    }
    renderer.drawing.manualRiverPathSalt = previousSalt;
    if (!sequence?.length || sequence.length < 4) return null;

    const finalHex = hexForPathPoint(sequence[sequence.length - 1]);
    const finalExitEdge = finalHex && !isRiverTradeContinuationWaterHex(finalHex)
      ? getOuterMapEdge(finalHex)
      : "";
    const baseVisibleRoutes = getManualRiverVisibleRoutes(sequence, salt, { isMajorRoute: false, routeName: "" });
    const visibleRoutes = baseVisibleRoutes
      .map((route, index) => ({
        ...route,
        startEdge: startsOffMap && index === 0 ? entryEdge : route.startEdge || "",
        exitEdge: finalExitEdge && index === baseVisibleRoutes.length - 1 ? finalExitEdge : route.exitEdge || ""
      }));
    visibleRoutes.push(...getManualRiverTributaryRoutes(
      sequence,
      salt,
      {
        ...getGeneratedRiverTributaryOptions(options),
        avoidHexIds: new Set([
          ...((options.blockedHexIds instanceof Set) ? [...options.blockedHexIds] : []),
          ...sequence
        ])
      }
    ));
    return { routes: visibleRoutes, sequence };
  }

  function getGeneratedRiverTributaryOptions(options = {}) {
    const amountScale = Math.max(0.25, Math.min(2, Number(options.amountScale || 1)));
    const localDensity = Math.max(1, Number(options.localDensity || 1));
    const siblingIndex = Math.max(0, Number(options.siblingIndex || 0));
    const joinPressure = Math.max(0, Math.min(1, Number(options.joinPressure || 0)));
    const suppression = Math.max(0, Math.min(0.94,
      Math.max(0, amountScale - 0.95) * 0.58
      + Math.max(0, localDensity - 1.8) * 0.17
      + siblingIndex * 0.22
      + joinPressure * 0.4
      + (options.wildcardSource ? 0.08 : 0)
    ));
    return {
      disable: suppression >= 0.8,
      branchChanceMultiplier: Math.max(0.12, 1 - suppression * 0.9),
      maxBranchChanceMultiplier: Math.max(0.16, 1 - suppression * 0.78),
      chanceGrowthMultiplier: Math.max(0.22, 1 - suppression * 0.66),
      branchGapBonus: Math.round(suppression * 10),
      maxAvoidAdjacency: suppression >= 0.66 ? 0 : suppression >= 0.38 ? 1 : 2
    };
  }

  function getGeneratedRiverLengthBand(source, seedBase, lengthScale, options = {}) {
    const elevation = Math.max(0, Number(source?.elevation || 0));
    const sourceScore = Math.max(0, getRiverSourceScore(source));
    const localDensity = Math.max(1, Number(options.localDensity || 1));
    const siblingIndex = Math.max(0, Number(options.siblingIndex || 0));
    const joinPressure = Math.max(0, Math.min(1, Number(options.joinPressure || 0)));
    const wildcardLengthPenalty = options.wildcardSource ? 1 : 0;
    const scale = Math.max(0.6, Math.min(3, Number(lengthScale) || 1));
    const roll = seededUnit(`${seedBase}:river-length-band:${source?.id || ""}:${options.routeVariantKey || siblingIndex}`);
    const mapLengthCap = Math.max(48, Math.min(260, Math.round(Math.sqrt(Math.max(1, renderer.hexes.length)) * 6.8)));
    const baseMin = 12 + Math.max(0, elevation - 2) * 2.4 + Math.max(0, sourceScore - 4) * 1.1 - joinPressure * 1.8 - wildcardLengthPenalty * 1.5;
    const baseTarget = 24 + elevation * 3 + sourceScore * 1.8 + Math.max(0, localDensity - 1) * 1 - siblingIndex * 3.2 - joinPressure * 7 - wildcardLengthPenalty * 6;
    const baseMax = baseTarget + 22 + elevation * 2.2 + sourceScore * 1.1 - siblingIndex * 2.4 - joinPressure * 9 - wildcardLengthPenalty * 8;
    const jitter = (roll - 0.5) * 8;
    const minSteps = Math.max(8, Math.min(mapLengthCap - 24, Math.round((baseMin + jitter * 0.35) * (0.88 + scale * 0.32))));
    const targetSteps = Math.max(minSteps + 10, Math.min(mapLengthCap - 10, Math.round((baseTarget + jitter) * (0.78 + scale * 0.42))));
    const maxSteps = Math.max(targetSteps + 18, Math.min(mapLengthCap, Math.round((baseMax + jitter * 1.1) * (0.8 + scale * 0.46))));
    return { minSteps, targetSteps, maxSteps };
  }

  function getGeneratedRiverLandGuideCandidates(source, seedBase, lengthBand) {
    if (!source?.id) return [];
    const minDistance = Math.max(4, Math.round((lengthBand?.minSteps || 6) * 0.45));
    const maxDistance = Math.max(minDistance + 4, Math.round((lengthBand?.maxSteps || 16) * 1.1));
    return renderer.hexes
      .filter(hex => {
        if (!hex?.id || hex.id === source.id || isWaterHex(hex)) return false;
        const distance = getGeneratedRiverSourceDistance(source, hex);
        return distance >= minDistance && distance <= maxDistance;
      })
      .map(hex => ({
        hex,
        score: getGeneratedRiverLandGuideScore(source, hex, seedBase)
      }))
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score || a.hex.id.localeCompare(b.hex.id))
      .slice(0, 8)
      .map(candidate => candidate.hex);
  }

  function getGeneratedRiverLandGuideScore(source, hex, seedBase) {
    const distance = roadPathHeuristic(source, hex);
    const elevation = Number(hex?.elevation || 0);
    const sinkRoughness = getGeneratedRiverSinkRoughness(hex);
    const edgeBias = getOuterMapEdge(hex) ? -0.35 : 0;
    const roll = seededUnit(`${seedBase}:river-land-guide:${source.id}:${hex.id}`) * 1.1;
    return distance + elevation * 0.85 - sinkRoughness * 0.9 + edgeBias + roll;
  }

  function getGeneratedRiverBorderGuideCandidates(source, seedBase, lengthBand) {
    if (!source?.id) return [];
    const minDistance = Math.max(6, Math.round((lengthBand?.minSteps || 8) * 0.6));
    const maxDistance = Math.max(minDistance + 4, Math.round((lengthBand?.maxSteps || 18) * 1.18));
    return renderer.hexes
      .filter(hex => {
        if (!hex?.id || hex.id === source.id || !getOuterMapEdge(hex)) return false;
        const distance = getGeneratedRiverSourceDistance(source, hex);
        return distance >= minDistance && distance <= maxDistance;
      })
      .map(hex => ({
        hex,
        score: getGeneratedRiverBorderGuideScore(source, hex, seedBase)
      }))
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score || a.hex.id.localeCompare(b.hex.id))
      .slice(0, 10)
      .map(candidate => candidate.hex);
  }

  function getGeneratedRiverBorderGuideScore(source, hex, seedBase) {
    const distance = roadPathHeuristic(source, hex);
    const elevation = Number(hex?.elevation || 0);
    const waterDistance = getNearestWaterDistance(hex, 5);
    const roll = seededUnit(`${seedBase}:river-border-guide:${source.id}:${hex.id}`) * 0.8;
    return distance + elevation * 0.7 + waterDistance * 0.15 + roll;
  }

  function getGeneratedRiverNaturalPathSequence(fromHexId, guideCandidates, options = {}) {
    const start = hexForPathPoint(fromHexId);
    const guides = Array.isArray(guideCandidates) ? guideCandidates.filter(goal => goal?.id) : [];
    const lengthBand = options.lengthBand || getGeneratedRiverLengthBand(start, options.seedBase || "", options.lengthScale || 1, options);
    if (!start) return null;

    const beamWidth = Math.max(14, Math.min(36, Math.round(18 + Math.max(0.5, Number(options.lengthScale) || 1) * 10)));
    let frontier = [{
      state: createManualRiverPathState(start, 0, 0, 0, ""),
      sequence: [start.id],
      cost: 0
    }];
    let bestFinished = null;

    for (let stepCount = 1; stepCount <= lengthBand.maxSteps && frontier.length; stepCount += 1) {
      const nextByKey = new Map();
      frontier.forEach(node => {
        const currentHex = node.state?.hex;
        if (!currentHex) return;
        const guideGoal = getGeneratedRiverNaturalGuideHex(start, currentHex, guides, stepCount, { ...options, lengthBand });
        const naturalStepOptions = getGeneratedRiverNaturalStepOptions(node.state, stepCount, { ...options, lengthBand, guideGoal });
        const constrainedNeighborIds = getGeneratedRiverNaturalConstrainedNeighborIds(currentHex, node.state, naturalStepOptions);
        EDGE_NAMES.forEach(edgeName => {
          const neighbor = getNeighborHex(currentHex, edgeName);
          if (!neighbor) return;
          if (node.sequence.length >= 2 && neighbor.id === node.sequence[node.sequence.length - 2]) return;
          if (constrainedNeighborIds && !constrainedNeighborIds.has(neighbor.id)) return;
          const transition = getManualRiverPathTransition(node.state, neighbor, guideGoal || currentHex, naturalStepOptions);
          if (!transition || !Number.isFinite(transition.cost)) return;
          const nextSequence = node.sequence.concat(neighbor.id);
          const nextCost = node.cost + transition.cost + getGeneratedRiverNaturalTransitionBias(node, neighbor, stepCount, {
            ...options,
            lengthBand,
            guideGoal
          });
          const nextKey = manualRiverStateKey(transition.state);
          const existing = nextByKey.get(nextKey);
          if (existing && existing.cost <= nextCost) return;

          const candidate = {
            state: transition.state,
            sequence: nextSequence,
            cost: nextCost
          };
          const commitBlockedJoin = shouldGeneratedRiverCommitToBlockedJoin(candidate.state?.hex, stepCount, {
            ...options,
            lengthBand
          });
          const terminationScore = getGeneratedRiverTerminationScore(candidate, stepCount, {
            ...options,
            lengthBand
          });
          if (Number.isFinite(terminationScore)) {
            const finishedScore = nextCost + terminationScore;
            if (!bestFinished || finishedScore < bestFinished.finishedScore) {
              bestFinished = { ...candidate, finishedScore };
            }
          }
          if (commitBlockedJoin) return;
          nextByKey.set(nextKey, candidate);
        });
      });

      frontier = [...nextByKey.values()]
        .sort((a, b) => (
          (a.cost + getGeneratedRiverContinuationBias(a, stepCount, { ...options, lengthBand }))
            - (b.cost + getGeneratedRiverContinuationBias(b, stepCount, { ...options, lengthBand })) ||
          a.sequence[a.sequence.length - 1].localeCompare(b.sequence[b.sequence.length - 1])
        ))
        .slice(0, beamWidth);

      if (bestFinished && stepCount >= lengthBand.targetSteps && frontier.length) {
        const frontierFloor = frontier[0].cost + getGeneratedRiverContinuationBias(frontier[0], stepCount, { ...options, lengthBand });
        if (frontierFloor > bestFinished.finishedScore + 6) break;
      }
    }

    if (bestFinished?.sequence?.length >= 4) return bestFinished.sequence;
    const bestRemaining = frontier.slice().sort((a, b) => a.cost - b.cost)[0];
    const remainingHex = bestRemaining?.state?.hex || null;
    const remainingSteps = Math.max(0, (bestRemaining?.sequence?.length || 1) - 1);
    return bestRemaining?.sequence?.length >= Math.max(4, Math.round(lengthBand.targetSteps * 0.85))
      && (
        isRiverTradeContinuationWaterHex(remainingHex) ||
        Boolean(getOuterMapEdge(remainingHex)) ||
        canGeneratedRiverTerminateUnderground(remainingHex, remainingSteps, { ...options, lengthBand })
      )
      ? bestRemaining.sequence
      : null;
  }

  function getGeneratedRiverNaturalGuideHex(startHex, fromHex, guideCandidates, stepCount, options = {}) {
    if (!fromHex || !Array.isArray(guideCandidates) || !guideCandidates.length) return null;
    const source = options.source || startHex || fromHex;
    const lengthBand = options.lengthBand || {};
    const seedBase = options.seedBase || "";
    const lengthScale = options.lengthScale || 1;
    const minimumRemaining = Math.max(0, (lengthBand.minSteps || 0) - stepCount);
    const endingGuide = getGeneratedRiverEndingGuideHex(fromHex, stepCount, {
      ...options,
      source,
      lengthBand
    });
    if (endingGuide) return endingGuide;
    const activeGuides = Array.isArray(options.landGuides) && options.landGuides.length
      ? options.landGuides.filter(goal => goal?.id)
      : guideCandidates;
    return activeGuides
      .map(goal => {
        const distance = Math.max(1, getGeneratedRiverSourceDistance(fromHex, goal));
        const prematurePenalty = minimumRemaining > 0 && distance < Math.max(3, Math.round(minimumRemaining * 0.6))
          ? (Math.max(0, Math.round(minimumRemaining * 0.6) - distance)) * 0.45
          : 0;
        return {
          goal,
          score: getGeneratedRiverGuideGoalScore(source, fromHex, goal, seedBase, lengthScale) + prematurePenalty
        };
      })
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score || a.goal.id.localeCompare(b.goal.id))[0]?.goal || null;
  }

  function getGeneratedRiverEndingGuideHex(fromHex, stepCount, options = {}) {
    const waterGoals = Array.isArray(options.waterGoals)
      ? options.waterGoals.filter(goal => goal?.id && isWaterHex(goal))
      : [];
    const borderGoals = Array.isArray(options.borderGoals)
      ? options.borderGoals.filter(goal => goal?.id && getOuterMapEdge(goal))
      : [];
    if (!fromHex || (!waterGoals.length && !borderGoals.length)) return null;
    const lengthBand = options.lengthBand || {};
    const targetSteps = Math.max(4, lengthBand.targetSteps || stepCount || 4);
    if (stepCount < Math.round(targetSteps * 0.72)) return null;
    const remainingBudget = Math.max(2, Math.round((lengthBand.maxSteps || targetSteps + 2) - stepCount));
    const nearestWater = waterGoals
      .map(goal => ({
        goal,
        score: roadPathHeuristic(fromHex, goal)
          + (goal.baseTerrain === "coastal_water" ? -0.45 : goal.baseTerrain === "inland_water" ? -0.25 : -0.08)
      }))
      .sort((a, b) => a.score - b.score || a.goal.id.localeCompare(b.goal.id))[0] || null;
    if (nearestWater && nearestWater.score <= Math.max(4.5, remainingBudget * 1.3)) {
      return nearestWater.goal;
    }
    const nearestBorder = borderGoals
      .map(goal => ({
        goal,
        score: roadPathHeuristic(fromHex, goal) + Number(goal.elevation || 0) * 0.22
      }))
      .sort((a, b) => a.score - b.score || a.goal.id.localeCompare(b.goal.id))[0] || null;
    return nearestBorder?.goal || nearestWater?.goal || null;
  }

  function getGeneratedRiverNaturalStepOptions(state, stepCount, options = {}) {
    const lengthBand = options.lengthBand || {};
    const targetSteps = Math.max(5, lengthBand.targetSteps || 5);
    const earlyWaterLimit = Math.max(4, Math.round(targetSteps * 0.55));
    const fromWater = isRiverTradeContinuationWaterHex(state?.hex);
    const bounceRecovery = fromWater || Number(state?.avoidWater || 0) > 0 || Number(state?.climbAway || 0) > 0;
    const progressRatio = Math.max(0, Math.min(1.35, stepCount / Math.max(1, targetSteps)));
    const routeVariationMultiplier = bounceRecovery
      ? 0.85
      : progressRatio < 0.28
        ? 0.32
        : progressRatio < 0.55
          ? 0.58
          : 0.9;
    const guideCommitment = bounceRecovery
      ? 0.15
      : progressRatio < 0.42
        ? 1
        : progressRatio < 0.75
          ? 0.56
          : 0.22;
    return {
      generatedNaturalMode: true,
      flattenDescent: !bounceRecovery,
      suppressWaterPull: true,
      constrainToEqualOrLowerLand: stepCount < earlyWaterLimit && !bounceRecovery,
      routeVariationMultiplier,
      generatedGuideCommitment: guideCommitment,
      generatedWaterPullStrength: bounceRecovery ? 0 : getGeneratedRiverWaterPullStrength(stepCount, options)
    };
  }

  function getGeneratedRiverWaterPullStrength(stepCount, options = {}) {
    const sourceId = options.source?.id || "";
    if (!sourceId) return 0;
    const targetSteps = Math.max(5, options.lengthBand?.targetSteps || stepCount || 5);
    const progressRatio = Math.max(0, Math.min(1.3, stepCount / Math.max(1, targetSteps)));
    const onsetRoll = seededUnit(`${options.seedBase || ""}:river-water-pull-onset:${sourceId}:${options.routeVariantKey || ""}`);
    const onsetProgress = 0.36 + onsetRoll * 0.24;
    const traitChance = Math.min(0.94,
      0.58
      + Math.max(0, Number(options.joinPressure || 0)) * 0.18
      + Math.max(0, progressRatio - 0.52) * 0.2
    );
    const hasTrait = seededUnit(`${options.seedBase || ""}:river-water-pull-trait:${sourceId}:${options.routeVariantKey || ""}`) < traitChance;
    if (!hasTrait || progressRatio < onsetProgress) return 0;
    const development = Math.min(1, (progressRatio - onsetProgress) / Math.max(0.12, 1 - onsetProgress));
    const strengthBase = 0.42 + seededUnit(`${options.seedBase || ""}:river-water-pull-strength:${sourceId}:${options.routeVariantKey || ""}`) * 0.42;
    return Math.max(0, Math.min(1, strengthBase * development));
  }

  function getGeneratedRiverNaturalConstrainedNeighborIds(currentHex, state, options = {}) {
    if (!currentHex?.id || !options.constrainToEqualOrLowerLand) return null;
    const currentElevation = Number(currentHex.elevation || 0);
    const validLandNeighbors = EDGE_NAMES
      .map(edgeName => getNeighborHex(currentHex, edgeName))
      .filter(Boolean)
      .filter(neighbor => !isWaterHex(neighbor) && Number(neighbor.elevation || 0) <= currentElevation)
      .map(neighbor => neighbor.id);
    return validLandNeighbors.length ? new Set(validLandNeighbors) : null;
  }

  function getGeneratedRiverBlockedAdjacencyCount(hex, blockedHexIds, radius = 1) {
    if (!hex?.id || !(blockedHexIds instanceof Set) || !blockedHexIds.size) return 0;
    const nearby = radius <= 1
      ? EDGE_NAMES.map(edgeName => getNeighborHex(hex, edgeName)).filter(Boolean)
      : nearbyHexesWithin(hex, radius);
    return nearby.reduce((count, neighbor) => (
      neighbor?.id && blockedHexIds.has(neighbor.id)
        ? count + 1
        : count
    ), 0);
  }

  function shouldGeneratedRiverCommitToBlockedJoin(hex, stepCount, options = {}) {
    if (!hex?.id || !(options.blockedHexIds instanceof Set) || !options.blockedHexIds.has(hex.id)) return false;
    const minSteps = Math.max(4, Number(options.lengthBand?.minSteps || 0));
    return stepCount >= Math.max(4, Math.round(minSteps * 0.78));
  }

  function getGeneratedRiverNaturalTransitionBias(node, toHex, stepCount, options = {}) {
    const sequence = Array.isArray(node?.sequence) ? node.sequence : [];
    const currentHex = node?.state?.hex || null;
    const lengthBand = options.lengthBand || {};
    const minSteps = Math.max(4, lengthBand.minSteps || 0);
    const targetSteps = Math.max(minSteps + 1, lengthBand.targetSteps || minSteps + 1);
    const joinPressure = Math.max(0, Math.min(1, Number(options.joinPressure || 0)));
    const amountScale = Math.max(0.25, Math.min(2, Number(options.amountScale || 1)));
    let cost = 0;

    if (sequence.includes(toHex.id)) {
      cost += isRiverTradeContinuationWaterHex(toHex) ? 4.5 : 18;
    }
    if (sequence.length >= 4 && toHex.id === sequence[sequence.length - 4]) {
      cost += 9;
    }

    if (options.blockedHexIds instanceof Set && options.blockedHexIds.has(toHex.id)) {
      const earlyJoinThreshold = Math.max(4, Math.round(minSteps * (0.8 - joinPressure * 0.24)));
      if (stepCount < earlyJoinThreshold) {
        cost += (9 + Math.max(0, minSteps - stepCount) * 0.45) * Math.max(0.34, 1 - joinPressure * 0.68);
      } else {
        const currentAdjacentBlocked = currentHex
          ? getGeneratedRiverBlockedAdjacencyCount(currentHex, options.blockedHexIds, 1)
          : 0;
        cost -= (currentAdjacentBlocked > 0 ? 2.8 : 1.9) + joinPressure * 1.4;
      }
    }
    if (
      options.blockedHexIds instanceof Set
      && !options.blockedHexIds.has(toHex.id)
      && stepCount < Math.round(targetSteps * 0.94)
    ) {
      const adjacentBlocked = getGeneratedRiverBlockedAdjacencyCount(toHex, options.blockedHexIds, 1);
      if (adjacentBlocked > 0) {
        const currentAdjacentBlocked = currentHex
          ? getGeneratedRiverBlockedAdjacencyCount(currentHex, options.blockedHexIds, 1)
          : 0;
        const crowdingPressure = Math.max(0, amountScale - 1) * 0.9 + joinPressure * 0.45;
        const earlyPhaseMultiplier = stepCount < Math.round(targetSteps * 0.72) ? 1.12 : 0.74;
        cost += adjacentBlocked * (0.5 + crowdingPressure) * earlyPhaseMultiplier;
        if (stepCount >= Math.max(4, Math.round(minSteps * 0.72)) && currentAdjacentBlocked > 0) {
          cost += adjacentBlocked * (1.3 + joinPressure * 0.9);
        }
      }
    }

    if (getOuterMapEdge(toHex) && stepCount < minSteps) {
      cost += 7 + Math.max(0, minSteps - stepCount) * 0.4;
    }
    if (isWaterHex(toHex) && stepCount < minSteps) {
      cost += 4.5 + Math.max(0, minSteps - stepCount) * 0.32;
    }
    if (toHex.baseTerrain === "wetland" && stepCount < Math.round(minSteps * 0.75)) {
      cost += 1.5;
    }
    if (stepCount > targetSteps) {
      cost += (stepCount - targetSteps) * 0.14;
    }

    if (options.source?.center && options.guideGoal?.center && toHex?.center && stepCount < Math.round(targetSteps * 0.78)) {
      const guideCommitment = Math.max(0, Math.min(1, Number(options.generatedGuideCommitment || 0)));
      if (guideCommitment > 0) {
        const drift = pointDistanceToSegment(toHex.center, options.source.center, options.guideGoal.center) / Math.max(1, getGeneratedMapDimensions().radius);
        cost += drift * 5.2 * guideCommitment;
      }
    }

    cost += seededUnit(`${options.seedBase || ""}:river-natural-step:${sequence[sequence.length - 1] || ""}:${toHex.id}:${stepCount}`) * 0.35 * getRiverWildnessScale();
    return cost;
  }

  function getGeneratedRiverContinuationBias(node, stepCount, options = {}) {
    const hex = node?.state?.hex;
    const lengthBand = options.lengthBand || {};
    const minSteps = Math.max(4, lengthBand.minSteps || 0);
    const targetSteps = Math.max(minSteps + 1, lengthBand.targetSteps || minSteps + 1);
    if (!hex) return 0;

    let bias = 0;
    if (stepCount < minSteps) {
      bias += Math.max(0, minSteps - stepCount) * 0.18;
    }
    if (stepCount > targetSteps) {
      bias += (stepCount - targetSteps) * 0.2;
    }
    return bias;
  }

  function getGeneratedRiverTerminationScore(node, stepCount, options = {}) {
    const hex = node?.state?.hex;
    const state = node?.state || {};
    const lengthBand = options.lengthBand || {};
    const minSteps = Math.max(4, lengthBand.minSteps || 0);
    const targetSteps = Math.max(minSteps + 1, lengthBand.targetSteps || minSteps + 1);
    const maxSteps = Math.max(targetSteps + 2, lengthBand.maxSteps || targetSteps + 2);
    if (!hex || stepCount < minSteps) return null;

    const closenessPenalty = Math.abs(stepCount - targetSteps) * 0.18;
    const lateRelief = stepCount > targetSteps ? Math.min(0.9, (stepCount - targetSteps) * 0.05) : 0;

    if (options.blockedHexIds instanceof Set && options.blockedHexIds.has(hex.id) && stepCount >= Math.max(4, Math.round(minSteps * 0.78))) {
      return -2.2 - Math.max(0, Math.min(1, Number(options.joinPressure || 0))) * 1.35 + closenessPenalty * 0.85 - lateRelief;
    }
    if (isRiverTradeContinuationWaterHex(hex)) {
      const waterRun = Math.max(0, Number(state.waterRun || 0));
      const entryStopNow = waterRun <= 1 && shouldGeneratedRiverStopAtWaterContact(hex, stepCount, options);
      if (entryStopNow) {
        return getGeneratedRiverWaterTerminationScore(hex, closenessPenalty, lateRelief, true);
      }
      if (stepCount >= Math.round(targetSteps * 0.92) || stepCount >= maxSteps - 1) {
        return getGeneratedRiverWaterTerminationScore(hex, closenessPenalty, lateRelief, false);
      }
      return null;
    }
    if (hex.baseTerrain === "coastal_water") {
      return -2.6 + closenessPenalty * 0.75 - lateRelief;
    }
    if (hex.baseTerrain === "sea") {
      return -2.1 + closenessPenalty * 0.82 - lateRelief;
    }
    if (hex.baseTerrain === "inland_water") {
      return -2.0 + closenessPenalty * 0.78 - lateRelief;
    }
    if (hex.baseTerrain === "wetland" && stepCount >= Math.round(targetSteps * 0.72)) {
      return -1.05 + closenessPenalty * 0.92 - lateRelief;
    }
    if (getOuterMapEdge(hex) && stepCount >= Math.round(targetSteps * 0.75)) {
      return -1.2 + closenessPenalty * 0.88 - lateRelief;
    }
    if (canGeneratedRiverTerminateUnderground(hex, stepCount, options)) {
      return -0.68 + closenessPenalty - lateRelief + getNearestWaterDistance(hex, 4) * 0.06;
    }
    if (stepCount >= maxSteps) {
      return Math.max(0.2,
        getNearestWaterDistance(hex, 5) * 0.55
        - getGeneratedRiverSinkRoughness(hex) * 0.18
        + (isRiverTradeContinuationWaterHex(hex) ? -0.4 : 0)
      );
    }
    return null;
  }

  function shouldGeneratedRiverStopAtWaterContact(hex, stepCount, options = {}) {
    if (!hex || !isRiverTradeContinuationWaterHex(hex)) return false;
    const targetSteps = Math.max(4, options.lengthBand?.targetSteps || stepCount);
    const progressRatio = Math.max(0, Math.min(1.25, stepCount / Math.max(1, targetSteps)));
    const baseChance = hex.baseTerrain === "coastal_water"
      ? 0.6
      : hex.baseTerrain === "inland_water"
        ? 0.52
        : 0.38;
    const chance = Math.min(0.9, baseChance + Math.max(0, progressRatio - 0.45) * 0.42);
    const source = options.source || hex;
    return seededUnit(`${options.seedBase || ""}:river-water-stop:${source.id}:${hex.id}:${stepCount}`) < chance;
  }

  function getGeneratedRiverWaterTerminationScore(hex, closenessPenalty, lateRelief, onEntry) {
    if (!hex) return null;
    if (hex.baseTerrain === "coastal_water") {
      return (onEntry ? -3.8 : -2.15) + closenessPenalty * 0.72 - lateRelief;
    }
    if (hex.baseTerrain === "inland_water") {
      return (onEntry ? -3.35 : -1.8) + closenessPenalty * 0.76 - lateRelief;
    }
    if (hex.baseTerrain === "wetland") {
      return (onEntry ? -1.85 : -1.1) + closenessPenalty * 0.9 - lateRelief;
    }
    return -1.2 + closenessPenalty * 0.88 - lateRelief;
  }

  function canGeneratedRiverTerminateUnderground(hex, stepCount, options = {}) {
    if (!hex || isRiverTradeContinuationWaterHex(hex) || isWaterHex(hex)) return false;
    const roughness = getGeneratedRiverSinkRoughness(hex);
    if (roughness <= 0.9) return false;
    if (getNearestWaterDistance(hex, 4) <= 1) return false;

    const currentElevation = Number(hex.elevation || 0);
    const lowerLandNeighbors = EDGE_NAMES
      .map(edgeName => getNeighborHex(hex, edgeName))
      .filter(Boolean)
      .filter(neighbor => !isWaterHex(neighbor) && Number(neighbor.elevation || 0) < currentElevation)
      .length;
    const enclosed = lowerLandNeighbors <= 1;
    const targetSteps = Math.max(4, options.lengthBand?.targetSteps || stepCount);
    const lateBonus = stepCount >= Math.round(targetSteps * 0.85) ? 0.16 : 0;
    const chance = Math.min(0.82,
      (enclosed ? 0.28 : 0.16)
      + roughness * 0.14
      + lateBonus
    );
    const source = options.source || hex;
    return seededUnit(`${options.seedBase || ""}:river-underground:${source.id}:${hex.id}`) < chance;
  }

  function getGeneratedRiverSinkRoughness(hex) {
    if (!hex) return 0;
    let roughness = 0;
    if (["rock", "snow", "barrens", "bleak_barrens", "wastes", "desert", "deep_desert"].includes(hex.baseTerrain)) {
      roughness += 1;
    }
    if ((hex.features || []).some(feature => ["ridges", "cliffs", "mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature))) {
      roughness += 1.35;
    }
    return roughness;
  }

  function getGeneratedRiverFallbackPathSequence(fromHexId, goals) {
    const fallbackGoals = Array.isArray(goals) ? goals.slice(0, 6) : [];
    let bestSequence = null;
    fallbackGoals.forEach(goal => {
      if (!goal?.id) return;
      const sequence = getManualRiverPathSequence(fromHexId, goal.id);
      if (!sequence?.length || sequence.length < 4) return;
      if (!bestSequence || sequence.length > bestSequence.length) {
        bestSequence = sequence;
      }
    });
    return bestSequence;
  }

  function getLegacyGeneratedRiverRouteSequence(source, seedBase, lengthScale) {
    const start = source?.id ? source : hexForPathPoint(source);
    if (!start?.id) return null;

    const maxSteps = Math.max(8, Math.round(54 * Math.max(0.5, Math.min(1.75, Number(lengthScale) || 1))));
    const sequence = [start.id];
    const visited = new Set(sequence);
    let current = start;

    for (let step = 0; step < maxSteps; step += 1) {
      const waterNeighbors = EDGE_NAMES
        .map(edgeName => getNeighborHex(current, edgeName))
        .filter(hex => Boolean(hex) && isWaterHex(hex))
        .sort((a, b) => {
          const terrainOrder = (a.baseTerrain === "deep_sea" ? 1 : 0) - (b.baseTerrain === "deep_sea" ? 1 : 0);
          if (terrainOrder !== 0) return terrainOrder;
          return a.id.localeCompare(b.id);
        });
      if (waterNeighbors.length) {
        sequence.push(waterNeighbors[0].id);
        return sequence;
      }

      const candidates = EDGE_NAMES
        .map(edgeName => getNeighborHex(current, edgeName))
        .filter(hex => Boolean(hex) && !visited.has(hex.id) && !isWaterHex(hex))
        .map(hex => ({
          hex,
          score: getRiverStepScore(current, hex, seedBase, step)
        }))
        .filter(candidate => Number.isFinite(candidate.score))
        .sort((a, b) => a.score - b.score || a.hex.id.localeCompare(b.hex.id));
      if (!candidates.length) break;

      const next = candidates[0].hex;
      sequence.push(next.id);
      visited.add(next.id);
      current = next;
    }

    return sequence.length >= 4 ? sequence : null;
  }

  function getGeneratedRiverGoalCandidates(source, seedBase, lengthScale, lengthBand = null) {
    if (!source) return [];
    const preferredMinDistance = lengthBand
      ? Math.max(4, Math.round(lengthBand.minSteps * 0.55))
      : Math.max(4, Math.round(5 * lengthScale));
    const preferredMaxDistance = lengthBand
      ? Math.max(preferredMinDistance + 4, lengthBand.maxSteps + 6)
      : Math.max(8, Math.round(18 + lengthScale * 18));
    const broadMinDistance = lengthBand
      ? Math.max(2, Math.round(lengthBand.minSteps * 0.35))
      : 2;
    const broadMaxDistance = lengthBand
      ? Math.max(preferredMaxDistance + 3, Math.round(lengthBand.maxSteps * 1.18))
      : Math.max(10, Math.round(24 + lengthScale * 18));
    const ranges = [
      {
        minDistance: preferredMinDistance,
        maxDistance: preferredMaxDistance
      },
      {
        minDistance: broadMinDistance,
        maxDistance: broadMaxDistance
      }
    ];
    for (const range of ranges) {
      const matches = renderer.hexes
        .filter(hex => {
          if (!hex?.id || hex.id === source.id || !isRiverTradeContinuationWaterHex(hex)) return false;
          const distance = roadPathHeuristic(source, hex);
          return distance >= range.minDistance && distance <= range.maxDistance;
        })
        .map(hex => ({
          hex,
          score: getGeneratedRiverGuideGoalScore(source, source, hex, seedBase, lengthScale)
        }))
        .filter(candidate => Number.isFinite(candidate.score))
        .sort((a, b) => a.score - b.score || a.hex.id.localeCompare(b.hex.id));
      if (!matches.length) continue;

      const spaced = [];
      matches.forEach(candidate => {
        if (spaced.length >= 14) return;
        if (spaced.some(existing => roadPathHeuristic(existing.hex, candidate.hex) < 5)) return;
        spaced.push(candidate);
      });
      if (spaced.length) return spaced.map(candidate => candidate.hex);
      return matches.slice(0, 10).map(candidate => candidate.hex);
    }
    return [];
  }

  function getGeneratedRiverAdaptivePathSequence(fromHexId, goalCandidates, options = {}) {
    const start = hexForPathPoint(fromHexId);
    const goals = Array.isArray(goalCandidates) ? goalCandidates.filter(goal => goal?.id) : [];
    if (!start || !goals.length) return null;

    const goalIds = new Set(goals.map(goal => goal.id));
    const maxIterations = getGeneratedRiverAdaptivePathSearchLimit(start, goals, options.lengthScale);
    let iterations = 0;
    const startState = createManualRiverPathState(start, 0, 0, 0, "");
    const startKey = manualRiverStateKey(startState);
    const open = new Set([startKey]);
    const states = new Map([[startKey, startState]]);
    const cameFrom = new Map();
    const bestCost = new Map([[startKey, 0]]);
    const estimatedTotal = new Map([[startKey, getGeneratedRiverAdaptiveHeuristic(startState, goals, options)]]);

    while (open.size && iterations < maxIterations) {
      iterations += 1;
      const currentKey = [...open].reduce((bestKey, candidateKey) => (
        (estimatedTotal.get(candidateKey) ?? Infinity) < (estimatedTotal.get(bestKey) ?? Infinity)
          ? candidateKey
          : bestKey
      ));
      const currentState = states.get(currentKey);
      const currentHex = currentState?.hex;
      if (!currentHex) {
        open.delete(currentKey);
        continue;
      }
      if (goalIds.has(currentHex.id)) return reconstructManualRiverPath(cameFrom, states, currentKey);

      open.delete(currentKey);
      const guideGoal = getGeneratedRiverGuideGoalHex(currentHex, goals, options);
      if (!guideGoal) continue;

      EDGE_NAMES.forEach(edgeName => {
        const neighbor = getNeighborHex(currentHex, edgeName);
        if (!neighbor) return;
        const transition = getManualRiverPathTransition(currentState, neighbor, guideGoal);
        if (!transition || !Number.isFinite(transition.cost)) return;

        const nextState = transition.state;
        const nextKey = manualRiverStateKey(nextState);
        const nextCost = (bestCost.get(currentKey) ?? Infinity) + transition.cost;
        if (nextCost >= (bestCost.get(nextKey) ?? Infinity)) return;

        states.set(nextKey, nextState);
        cameFrom.set(nextKey, currentKey);
        bestCost.set(nextKey, nextCost);
        estimatedTotal.set(nextKey, nextCost + getGeneratedRiverAdaptiveHeuristic(nextState, goals, options));
        open.add(nextKey);
      });
    }

    return null;
  }

  function getGeneratedRiverAdaptivePathSearchLimit(start, goalCandidates, lengthScale = 1) {
    const nearestGoalDistance = goalCandidates.reduce((best, goal) => (
      Math.min(best, Math.max(1, getHexLineSequence(start.id, goal.id).length))
    ), Infinity);
    const mapScale = Math.max(700, renderer.hexes.length);
    return Math.min(3200, Math.max(mapScale, Math.round(nearestGoalDistance * (42 + Math.max(0.5, lengthScale) * 14))));
  }

  function getGeneratedRiverAdaptiveHeuristic(state, goalCandidates, options = {}) {
    const goal = getGeneratedRiverGuideGoalHex(state?.hex, goalCandidates, options);
    return goal && state?.hex ? riverPathHeuristic(state.hex, goal) : 0;
  }

  function getGeneratedRiverGuideGoalHex(fromHex, goalCandidates, options = {}) {
    if (!fromHex || !Array.isArray(goalCandidates) || !goalCandidates.length) return null;
    const seedBase = options.seedBase || "";
    const source = options.source || fromHex;
    const lengthScale = options.lengthScale || 1;
    return goalCandidates
      .map(goal => ({
        goal,
        score: getGeneratedRiverGuideGoalScore(source, fromHex, goal, seedBase, lengthScale)
      }))
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score || a.goal.id.localeCompare(b.goal.id))[0]?.goal || null;
  }

  function getGeneratedRiverGuideGoalScore(source, fromHex, goal, seedBase, lengthScale) {
    const distance = roadPathHeuristic(fromHex, goal);
    const sourceElevation = Number(source?.elevation || 0);
    const waterBias = goal.baseTerrain === "coastal_water"
      ? -2.8
      : goal.baseTerrain === "inland_water"
        ? -2.2
        : goal.baseTerrain === "sea"
          ? -1.3
          : 0.2;
    const edgeBias = getOuterMapEdge(goal) ? -0.7 : 0;
    const elevationBias = sourceElevation >= 4 && ["coastal_water", "sea"].includes(goal.baseTerrain) ? -0.45 : 0;
    const roll = seededUnit(`${seedBase}:river-goal:${source.id}:${goal.id}`) * (2.4 - Math.min(1.15, lengthScale * 0.5));
    return distance + waterBias + edgeBias + elevationBias + roll;
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

  function syncPoiGenerationGlobalAmountFromSliders() {
    const values = POI_GENERATION_GLOBAL_CONTROL_KEYS
      .map(key => clampNumber(Number(renderer.drawing[key] ?? 100), 0, 200, 100));
    if (!values.length) {
      renderer.drawing.generationPoiGlobalAmount = 100;
      return 100;
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const snapped = clampNumber(Math.round(average / 5) * 5, 0, 200, 100);
    renderer.drawing.generationPoiGlobalAmount = snapped;
    return snapped;
  }

  function applyPoiGenerationGlobalAmountShift(nextValue) {
    const normalizedNext = clampNumber(Number(nextValue), 0, 200, 100);
    const previous = clampNumber(Number(renderer.drawing.generationPoiGlobalAmount ?? 100), 0, 200, 100);
    const delta = normalizedNext - previous;
    renderer.drawing.generationPoiGlobalAmount = normalizedNext;
    if (!delta) return;
    POI_GENERATION_GLOBAL_CONTROL_KEYS.forEach(key => {
      renderer.drawing[key] = clampNumber(Number(renderer.drawing[key] ?? 100) + delta, 0, 200, 100);
    });
    syncPoiGenerationGlobalAmountFromSliders();
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

  function getPoiGeneratorOptions(campaignId) {
    const seedBase = getGenerationSeedBase(campaignId);
    return {
      seed: seedBase.replace(":feature-pass", ":poi-pass"),
      settlementDensity: Math.max(0, Math.min(1, Number(renderer.drawing.generationSettlementDensity ?? 100) / 200)),
      populationConcentration: Math.max(0.5, Math.min(1.5, Number(renderer.drawing.generationPopulationConcentration ?? 100) / 100)),
      resourceAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationResourceAmount ?? 100) / 200)),
      waypointAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationWaypointAmount ?? 100) / 200)),
      strongholdAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationStrongholdAmount ?? 100) / 200)),
      dungeonAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationDungeonAmount ?? 100) / 200)),
      dungeonComplexAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationDungeonComplexAmount ?? 100) / 200)),
      siteAmount: Math.max(0, Math.min(1, Number(renderer.drawing.generationSiteAmount ?? 100) / 200))
    };
  }

  function previewGeneratedTerrain() {
    const campaign = getActiveCampaign?.();
    const generator = window.CampaignGeneratedMapGenerator;
    if (!campaign || !generator?.generateNaturalTerrain || renderer.drawing.saving) return;

    discardStagedMapEditSection("terrain", { silent: true });
    const drafts = generator.generateNaturalTerrain({
      ...getGeneratorOptions(campaign.id),
      hexes: renderer.hexes,
      terrainRules: TERRAIN_RULES
    });

    const actions = drafts
      .map(draft => {
        const before = getTerrainSnapshot(draft.hexId);
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

    const historyAction = {
      type: "batch",
      previewSection: "terrain",
      actions
    };
    actions.forEach(action => applyLocalTerrainSnapshot(action.hexId, action.after));
    pushStagedMapEditAction(historyAction);
    render();
    updateGenerationControls();
  }

  async function applyGeneratedTerrainPreview() {
    const campaign = getActiveCampaign?.();
    const actions = getStagedUndoStack();
    if (!campaign || renderer.drawing.saving || !actions.length) return;
    const confirmed = await showMapConfirm("Apply these staged map edits to the saved map? Terrain and feature preview changes will be saved together.", {
      title: "Apply Preview?",
      confirmLabel: "Apply"
    });
    if (!confirmed) return;

    const historyAction = actions.length === 1 ? cloneMapEditAction(actions[0]) : { type: "batch", actions: actions.map(cloneMapEditAction).filter(Boolean) };
    const showBulkLoading = getMapEditActionSize(historyAction) >= BULK_OVERLAY_LOADING_THRESHOLD;

    renderer.drawing.saving = true;
    if (showBulkLoading) setLoading(true);
    refreshEditorPreviewControls();

    try {
      await persistStagedMapEditAction(campaign.id, historyAction);
      pushMapEditAction(historyAction, { force: true, owner: "cartographer" });
      clearStagedMapEditState();
      markAllMapCachesDirty();
      render();
    } catch (error) {
      console.error("Unable to apply generated terrain preview:", error);
      window.alert?.(error.message || "Unable to apply terrain preview.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorPreviewControls();
    }
  }

  function discardGeneratedTerrainPreview(options = {}) {
    discardAllStagedMapEdits(options);
  }

  function discardGenerationPreviewSection(section) {
    discardStagedMapEditSection(section);
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
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
  }

  function discardOverlayPreviewType(type, options = {}) {
    removeStagedActionsByPredicate(
      action => action?.previewSection === "overlays" && action.previewOverlayType === type,
      options
    );
  }

  async function persistStagedMapEditAction(campaignId, action) {
    if (!action?.type) return;
    if (action.type === "batch") {
      await persistStagedMapEditActions(campaignId, action.actions || []);
      return;
    }
    if (action.type === "terrain") {
      await applyTerrainSnapshot(campaignId, action.hexId, action.after);
      return;
    }
    if (action.type === "overlay") {
      for (const overlay of action.overlays || []) {
        if (overlay.__undoDeleted) {
          if (!isTemporaryOverlayId(overlay.__uuid)) {
            await deleteOverlayById(campaignId, overlay.__uuid);
          }
          removeLocalOverlayById(overlay.__uuid);
          continue;
        }
        if (isTemporaryOverlayId(overlay.__uuid)) {
          const temporaryId = overlay.__uuid;
          const restored = await restoreDeletedOverlay(campaignId, overlay);
          if (restored?.__uuid) {
            removeLocalOverlayById(temporaryId);
            Object.assign(overlay, restored, { __preview: false, __staged: false });
            upsertLocalOverlay(overlay);
          }
        }
      }
    }
  }

  async function persistStagedMapEditActions(campaignId, actions = []) {
    const pendingTerrain = [];
    const flushTerrain = async () => {
      if (!pendingTerrain.length) return;
      const terrainActions = pendingTerrain.splice(0, pendingTerrain.length);
      if (terrainActions.length === 1) {
        await applyTerrainSnapshot(campaignId, terrainActions[0].hexId, terrainActions[0].after);
        return;
      }
      await applyTerrainBatchAction(campaignId, terrainActions, "redo");
    };

    for (const action of actions) {
      if (!action?.type) continue;
      if (action.type === "terrain") {
        pendingTerrain.push(action);
        continue;
      }
      if (action.type === "batch") {
        const childActions = action.actions || [];
        if (childActions.length && childActions.every(childAction => childAction?.type === "terrain")) {
          pendingTerrain.push(...childActions);
          continue;
        }
      }
      await flushTerrain();
      await persistStagedMapEditAction(campaignId, action);
    }

    await flushTerrain();
  }

  function isTemporaryOverlayId(overlayId) {
    const value = String(overlayId || "");
    return value.startsWith("preview-") || value.startsWith("staged-");
  }

  function getTerrainSnapshot(hexId) {
    const hex = hexForPathPoint(hexId);
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

    const renderedHex = hexForPathPoint(hexId);
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

    markTerrainHexDirty(hexId);
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

  function regionSnapshotsEqual(a, b) {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
  }

  async function assignHexRegion(hexId, regionId = "", regionType = "geographic", options = {}) {
    const campaign = getActiveCampaign?.();
    if (!campaign || !hexId) return;
    if (regionType !== "political" && !regionId) return;
    const before = getRegionSnapshot(hexId);
    if (
      before &&
      (regionType === "political"
        ? (before.politicalRegionId || "") === (regionId || "")
        : (before.geographicRegionId || UNCLAIMED_REGION_REF) === (regionId || UNCLAIMED_REGION_REF))
    ) {
      return;
    }

    updateLocalHexRegion(hexId, regionId, regionType);
    const after = getRegionSnapshot(hexId);
    if (!options.silentRender) renderSvgOnly();

    try {
      const { error } = await campaignSupabase.rpc("assign_generated_hex_region_layer", {
        target_campaign_id: campaign.id,
        target_hex_ref: hexId,
        target_region_ref: regionId,
        target_region_type: regionType
      });

      if (error) throw error;

      if (before && after && !regionSnapshotsEqual(before, after)) {
        pushMapEditAction({
          type: "region",
          hexId,
          regionType,
          before,
          after
        });
      }
    } catch (error) {
      if (regionSnapshotsEqual(getRegionSnapshot(hexId), after)) {
        applyLocalRegionSnapshot(hexId, before);
        renderSvgOnly();
      }
      console.error("Unable to assign generated hex region:", error);
      window.alert?.(error.message || "Unable to assign hex region.");
    }
  }

  function assignHexRegionBrush(centerHex, regionId = "", regionType = "geographic") {
    if (!centerHex) return;
    const startedBatch = !renderer.drawing.dragActionBatch;
    if (startedBatch) beginDragActionBatch();
    const brushSize = clampNumber(Number(renderer.drawing.regionBrushSize), 1, 5, 1);
    const assignments = getBrushHexes(centerHex, brushSize, 0, "region")
      .map(hex => assignHexRegion(hex.id, regionId, regionType, { silentRender: true }));
    if (renderer.drawing.dragActionBatch && assignments.length) {
      renderer.drawing.dragActionBatch.pending.push(...assignments);
    }
    renderSvgOnly();
    if (startedBatch) scheduleDragActionBatchCommit();
  }

  function getRegionSnapshot(hexId) {
    const hex = hexForPathPoint(hexId);
    if (!hex) return null;
    return {
      geographicRegionId: hex.regionId || "",
      politicalRegionId: hex.politicalRegionId || ""
    };
  }

  function updateLocalHexRegion(hexId, regionId, regionType = "geographic") {
    const renderedHex = hexForPathPoint(hexId);
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
    const campaign = getActiveCampaign?.();
    if (!campaign) return;
    if (tool === "river") {
      renderer.drawing.manualRiverPathSalt = createManualRiverPathSalt(fromHexId, toHexId);
    }
    let sequence = getPathOverlaySequence(tool, fromHexId, toHexId, exitEdge);
    let targetExitEdge = exitEdge;
    if (tool === "sea_route") {
      const normalized = normalizeSeaRouteSequence(sequence, targetExitEdge);
      sequence = normalized.sequence;
      targetExitEdge = normalized.exitEdge;
    }
    if (sequence.length < 2 && !targetExitEdge) return;

    const style = getCurrentDrawOverlayStyle(tool);
    const routeMetadata = getCurrentRouteMetadata(tool);
    const reveal = beginPathRevealAnimation(tool, sequence, style);

    try {
      const routes = tool === "river"
        ? getManualRiverVisibleRoutes(sequence, renderer.drawing.manualRiverPathSalt, routeMetadata)
        : [{ sequence, exitEdge: targetExitEdge }];
      if (tool === "river") {
        routes.push(...getManualRiverTributaryRoutes(sequence, renderer.drawing.manualRiverPathSalt));
      }
      const segments = getGeneratedOverlaySegments({
        routes,
        tool,
        style,
        routeMetadata,
        skipExisting: true
      });
      await reveal.finished;
      if (!segments.length) {
        renderer.drawing.lastHexId = null;
        renderer.drawing.dragLastHexId = null;
        renderSvgOnly();
        return;
      }
      const existingOverlayIds = new Set((renderer.mapOverlays || []).map(overlay => overlay.__uuid).filter(Boolean));
      await persistGeneratedOverlaySegments(campaign.id, segments, existingOverlayIds);
      renderer.drawing.lastHexId = null;
      renderer.drawing.dragLastHexId = null;
      markRouteCacheDirty();
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
    if (!edge) return;
    if (!campaign) return;
    const style = getCurrentDrawOverlayStyle("wall");
    renderer.drawing.saving = true;
    refreshEditorActionControls();
    try {
      const previous = findExistingWallOverlay(hexId, edge);
      if (previous && previous.Style === style) return;
      const overlay = await savePathOverlaySegment(campaign.id, "wall", hexId, null, style, edge, {});
      upsertLocalOverlay(overlay);
      pushOverlayUndoAction(previous ? [overlay, { ...cloneOverlayRecord(previous), __undoDeleted: true }] : [overlay]);
      renderSvgOnly();
    } catch (error) {
      handleWallSaveError(error);
    } finally {
      renderer.drawing.saving = false;
      refreshEditorActionControls();
    }
  }

  function getCenteredOverlaySegments(overlays) {
    return (overlays || [])
      .filter(overlay => overlay.To_Hex_ID_Ref)
      .map(overlay => {
        const fromHex = hexForPathPoint(overlay.From_Hex_ID_Ref);
        const toHex = hexForPathPoint(overlay.To_Hex_ID_Ref);
        return fromHex && toHex ? { a: fromHex.center, b: toHex.center, overlay } : null;
      })
      .filter(Boolean);
  }

  async function persistWallOverlays(edgeRefs) {
    const campaign = getActiveCampaign?.();
    if (!campaign || !edgeRefs?.length) return;
    renderer.drawing.saving = true;
    refreshEditorActionControls();
    try {
      const refsToSave = [];
      const previousByKey = new Map();
      const seen = new Set();
      const style = getCurrentDrawOverlayStyle("wall");
      for (const edgeRef of edgeRefs) {
        if (!edgeRef?.hexId || !edgeRef.edge) continue;
        const key = getWallSegmentKey(edgeRef) || `${edgeRef.hexId}:${edgeRef.edge}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const previous = findExistingWallOverlayBySegmentKey(key);
        if (previous && previous.Style === style) continue;
        if (previous) previousByKey.set(key, cloneOverlayRecord(previous));
        refsToSave.push(edgeRef);
      }
      const overlays = (await Promise.all(refsToSave.map(edgeRef => (
        savePathOverlaySegment(campaign.id, "wall", edgeRef.hexId, null, style, edgeRef.edge, {})
      )))).filter(Boolean);
      if (!overlays.length) return;
      overlays.forEach(overlay => upsertLocalOverlay(overlay));
      const previousOverlays = overlays
        .map(overlay => previousByKey.get(getWallSegmentKey({ hexId: overlay.Hex_ID_Ref, edge: overlay.Edge }) || `${overlay.Hex_ID_Ref}:${overlay.Edge}`))
        .filter(Boolean)
        .map(overlay => ({ ...overlay, __undoDeleted: true }));
      pushOverlayUndoAction([...overlays, ...previousOverlays]);
      renderSvgOnly();
    } catch (error) {
      handleWallSaveError(error);
    } finally {
      renderer.drawing.saving = false;
      refreshEditorActionControls();
    }
  }

  function handleWallSaveError(error) {
    console.error("Unable to save generated map wall:", error);
    const message = String(error?.message || "");
    if (/unsupported wall style|target_is_major_route|schema cache/i.test(message)) {
      window.alert?.("Wall variants need the latest generated map overlay SQL. Run sql/generated_map_overlay_management.sql in Supabase, then try placing the wall again.");
      return;
    }
    window.alert?.(message || "Unable to save wall overlay.");
  }

  function findExistingWallOverlay(hexId, edge) {
    return (renderer.mapOverlays || []).find(overlay => (
      overlay.Overlay_Type === "wall" &&
      overlay.Hex_ID_Ref === hexId &&
      overlay.Edge === edge
    )) || null;
  }

  function findExistingWallOverlayBySegmentKey(key) {
    return (renderer.mapOverlays || []).find(overlay => (
      overlay.Overlay_Type === "wall" &&
      (getWallSegmentKey({ hexId: overlay.Hex_ID_Ref, edge: overlay.Edge }) || `${overlay.Hex_ID_Ref}:${overlay.Edge}`) === key
    )) || null;
  }

  async function persistMistOverlay(hexId) {
    await persistHexStyleOverlays("mist", [hexId], "mist");
  }

  async function persistMistBrush(centerHex) {
    const hexIds = getMistBrushHexIds(centerHex, "mist");
    if (!hexIds.length) return;
    queueHexStyleOverlayBrush("mist", hexIds, "mist");
  }

  async function persistMistOverlays(hexIds) {
    return persistHexStyleOverlays("mist", hexIds, "mist");
  }

  async function persistFarmlandBrush(centerHex) {
    const hexIds = getMistBrushHexIds(centerHex, "farmland");
    if (!hexIds.length) return;
    queueHexStyleOverlayBrush("farmland", hexIds, "farmland");
  }

  function queueHexStyleOverlayBrush(overlayType, hexIds, style) {
    const startedBatch = !renderer.drawing.dragActionBatch;
    if (startedBatch) beginDragActionBatch();
    const queuedHexIds = queueHexStyleBrushPreview(overlayType, hexIds);
    if (!queuedHexIds.length) {
      if (startedBatch) scheduleDragActionBatchCommit();
      return;
    }
    renderSvgOnly();
    if (startedBatch) scheduleDragActionBatchCommit();
  }

  function queuePendingHexStyleOverlaySaves(batch) {
    const campaign = getActiveCampaign?.();
    if (!batch || !campaign) return;
    ["mist", "farmland"].forEach(overlayType => {
      const state = getHexStyleBrushPreviewState(overlayType);
      if (!state?.pending?.size) return;
      const hexIds = [...state.pending];
      state.pending.clear();
      hexIds.forEach(hexId => state.inflight.add(hexId));
      batch.pending.push(persistQueuedHexStyleOverlays(campaign.id, overlayType, hexIds, overlayType, batch));
    });
  }

  async function persistQueuedHexStyleOverlays(campaignId, overlayType, hexIds, style, batch = null) {
    const state = getHexStyleBrushPreviewState(overlayType);
    const targetHexIds = [...new Set(hexIds || [])].filter(Boolean);
    if (!targetHexIds.length) return [];

    let saved = [];
    let failure = null;

    try {
      const results = await Promise.allSettled(targetHexIds.map(hexId => (
        savePathOverlaySegment(campaignId, overlayType, hexId, null, style, null, {})
      )));
      failure = results.find(result => result.status === "rejected")?.reason || null;
      saved = results
        .filter(result => result.status === "fulfilled" && result.value)
        .map(result => result.value);

      if (saved.length) {
        upsertLocalOverlays(saved);
        const action = { type: "overlay", overlays: saved };
        if (batch?.actions) batch.actions.push(action);
        else pushMapEditAction(action, { force: true });
      }

      if (failure) throw failure;
      return saved;
    } catch (error) {
      console.error(`Unable to save generated map ${overlayType}:`, error);
      window.alert?.(error?.message || `Unable to save ${overlayType}.`);
      return saved;
    } finally {
      targetHexIds.forEach(hexId => state?.inflight?.delete(hexId));
      if (!state?.pending?.size && !state?.inflight?.size) clearHexStyleBrushPreview(overlayType);
      if (saved.length) render();
      else renderSvgOnly();
    }
  }

  async function persistHexStyleOverlays(overlayType, hexIds, style) {
    const campaign = getActiveCampaign?.();
    if (!campaign) return [];
    const existingHexIds = new Set((renderer.mapOverlays || [])
      .filter(overlay => overlay.Overlay_Type === overlayType)
      .map(overlay => overlay.Hex_ID_Ref));
    const targetHexIds = [...new Set(hexIds || [])]
      .filter(hexId => hexId && !existingHexIds.has(hexId));
    if (!targetHexIds.length) return [];

    renderer.drawing.saving = true;
    refreshEditorActionControls();
    const pendingOverlays = targetHexIds.map(hexId => createLocalOverlayRecord({
      tool: overlayType,
      fromHexId: hexId,
      toHexId: "",
      edge: null,
      style,
      routeMetadata: {}
    }, "saving"));
    pendingOverlays.forEach(overlay => {
      overlay.__saving = true;
    });
    if (pendingOverlays.length) {
      upsertLocalOverlays(pendingOverlays);
      render();
    }

    const overlays = [];
    try {
      const results = await Promise.allSettled(targetHexIds.map(hexId => (
        savePathOverlaySegment(campaign.id, overlayType, hexId, null, style, null, {})
      )));
      const failed = results.find(result => result.status === "rejected");
      const saved = results
        .filter(result => result.status === "fulfilled" && result.value)
        .map(result => result.value);

      removeLocalOverlaysById(pendingOverlays.map(overlay => overlay.__uuid));
      if (saved.length) {
        upsertLocalOverlays(saved);
        overlays.push(...saved);
      }

      if (failed) throw failed.reason;
      if (overlays.length) pushOverlayUndoAction(overlays);
      render();
      return overlays;
    } catch (error) {
      removeLocalOverlaysById(pendingOverlays.map(overlay => overlay.__uuid));
      if (overlays.length) {
        pushOverlayUndoAction(overlays);
        upsertLocalOverlays(overlays);
      }
      render();
      console.error(`Unable to save generated map ${overlayType}:`, error);
      window.alert?.(error?.message || `Unable to save ${overlayType}.`);
      return overlays;
    } finally {
      renderer.drawing.saving = false;
      refreshEditorActionControls();
    }
  }

  async function eraseOverlaysAtHex(hexId) {
    const campaign = getActiveCampaign?.();
    if (!campaign) return;
    const removed = renderer.mapOverlays.filter(overlay => (
      overlay.From_Hex_ID_Ref === hexId ||
      overlay.To_Hex_ID_Ref === hexId ||
      overlay.Hex_ID_Ref === hexId
    ));
    if (!removed.length) return;
    const temporaryIds = new Set(removed.filter(overlay => isTemporaryOverlayId(overlay.__uuid)).map(overlay => overlay.__uuid));
    if (temporaryIds.size) {
      dropTemporaryOverlaysFromStagedActions(temporaryIds);
    }
    const persistedRemoved = removed
      .filter(overlay => !temporaryIds.has(overlay.__uuid))
      .map(overlay => ({ ...cloneOverlayRecord(overlay), __undoDeleted: true }));
    for (const overlay of persistedRemoved) {
      await deleteOverlayById(campaign.id, overlay.__uuid);
    }
    removed.forEach(overlay => removeLocalOverlayById(overlay.__uuid));
    if (persistedRemoved.length) {
      pushOverlayUndoAction(persistedRemoved);
    } else {
      refreshEditorPreviewControls();
    }
    markRouteCacheDirty();
    markOverlayCacheDirty();
    queueMapRender(true);
  }

  function pushOverlayUndoAction(overlays) {
    const valid = (overlays || []).filter(overlay => overlay?.__uuid);
    if (!valid.length) return;
    pushMapEditAction({ type: "overlay", overlays: valid });
  }

  function pushMapEditAction(action, options = {}) {
    if (!action?.type) return;
    const historyOwner = normalizePersistedHistoryOwner(options.owner || "surveyor");
    if (renderer.drawing.dragActionBatch && !options.force) {
      renderer.drawing.dragActionBatch.historyOwner = historyOwner;
      renderer.drawing.dragActionBatch.actions.push(action);
      return;
    }
    pushPersistedUndoAction(action, historyOwner);
    clearPersistedRedoStack(historyOwner);
    refreshEditorActionControls();
  }

  async function undoLastDrawAction() {
    const historyTarget = getActiveHistoryTarget();
    if (historyTarget.kind === "staged" && !getStagedUndoStack().length) {
      updateDrawUndoButton();
      return;
    }
    if (historyTarget.kind === "staged" && getStagedUndoStack().length) {
      const action = renderer.drawing.stagedUndoStack.pop();
      if (!action?.type) {
        updateDrawUndoButton();
        return;
      }
      applyLocalMapEditAction(action, "undo");
      pushStagedRedoAction(action);
      markAllMapCachesDirty();
      render();
      refreshEditorActionControls();
      return;
    }

    const campaign = getActiveCampaign?.();
    const action = getPersistedUndoStack(historyTarget.owner).slice(-1)[0];
    if (!campaign || !action?.type) {
      updateDrawUndoButton();
      return;
    }

    renderer.drawing.saving = true;
    const showBulkLoading = getMapEditActionSize(action) >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    refreshEditorActionControls();

    try {
      await applyMapEditAction(campaign.id, action, "undo");
      removePersistedHistoryAction(action, historyTarget.owner, "undo");
      pushPersistedRedoAction(action, historyTarget.owner);
      markAllMapCachesDirty();
      render();
    } catch (error) {
      console.error("Unable to undo generated map edit:", error);
      window.alert?.(error.message || "Unable to undo map edit.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorActionControls();
    }
  }

  function hexHasEraseableOverlays(hexId) {
    return getOverlaysAtHex(hexId).length > 0;
  }

  async function redoLastDrawAction() {
    const historyTarget = getActiveHistoryTarget();
    if (historyTarget.kind === "staged" && !getStagedRedoStack().length) {
      updateDrawRedoButton();
      return;
    }
    if (historyTarget.kind === "staged" && getStagedRedoStack().length) {
      const action = renderer.drawing.stagedRedoStack.pop();
      if (!action?.type) {
        updateDrawRedoButton();
        return;
      }
      applyLocalMapEditAction(action, "redo");
      pushStagedUndoAction(action);
      markTerrainCacheDirty();
      render();
      refreshEditorActionControls();
      return;
    }

    const campaign = getActiveCampaign?.();
    const action = getPersistedRedoStack(historyTarget.owner).slice(-1)[0];
    if (!campaign || !action?.type) {
      updateDrawRedoButton();
      return;
    }

    renderer.drawing.saving = true;
    const showBulkLoading = getMapEditActionSize(action) >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    refreshEditorActionControls();

    try {
      await applyMapEditAction(campaign.id, action, "redo");
      removePersistedHistoryAction(action, historyTarget.owner, "redo");
      pushPersistedUndoAction(action, historyTarget.owner);
      markAllMapCachesDirty();
      render();
    } catch (error) {
      console.error("Unable to redo generated map edit:", error);
      window.alert?.(error.message || "Unable to redo map edit.");
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorActionControls();
    }
  }

  function getMapEditActionSize(action) {
    if (action?.type === "batch") {
      return (action.actions || []).reduce((total, child) => total + getMapEditActionSize(child), 0);
    }
    if (action?.type === "nuke-overlays") return action.overlays?.length || 0;
    if (action?.type === "nuke-regions" || action?.type === "nuke-features") return action.actions?.length || 0;
    if (action?.type === "overlay") return action.overlays?.length || 0;
    if (action?.type === "poi") return (action.pois?.length || 0) + (action.groups?.length || 0);
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
      if (actions.length && actions.every(childAction => childAction?.type === "region")) {
        await applyRegionBatchAction(campaignId, actions, direction, action);
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

    if (action.type === "poi") {
      await applyPoiHistoryAction(campaignId, action, direction);
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
    const deleteOverlays = [];
    const restoreOverlays = [];
    (overlays || []).forEach(overlay => {
      const shouldDelete = direction === "redo" ? overlay.__undoDeleted : !overlay.__undoDeleted;
      if (shouldDelete) deleteOverlays.push(overlay);
      else restoreOverlays.push(overlay);
    });

    if (deleteOverlays.length) {
      await Promise.all(deleteOverlays.map(overlay => deleteOverlayById(campaignId, overlay.__uuid, { allowMissing: true })));
      removeLocalOverlaysById(deleteOverlays.map(overlay => overlay.__uuid));
    }

    if (restoreOverlays.length) {
      const restoredOverlays = await Promise.all(restoreOverlays.map(overlay => restoreDeletedOverlay(campaignId, overlay)));
      restoredOverlays.forEach((restored, index) => {
        if (restored?.__uuid) restoreOverlays[index].__uuid = restored.__uuid;
      });
      upsertLocalOverlays(restoredOverlays.filter(Boolean));
    }
  }

  async function applyPoiHistoryAction(campaignId, action, direction) {
    const removeLocalPoi = window.CampaignCodexPoiMutations?.removePoiByUuidFromLocalDb || removePoiFromLocalDbFallback;
    const removeLocalPoiGroup = window.CampaignCodexPoiMutations?.removePoiGroupByUuidFromLocalDb || removePoiGroupFromLocalDbFallback;
    const refreshPoiViews = window.CampaignCodexPoiMutations?.refreshPoiViewsAfterPurge || refreshPoiViewsAfterPurgeFallback;
    const registerRestoredPois = registerGeneratedPoiRowsInLocalDb;
    const deletePois = [];
    const restorePois = [];
    const deleteGroups = [];
    const restoreGroups = [];

    (action?.pois || []).forEach((poi, index) => {
      const shouldDelete = direction === "redo" ? poi.__undoDeleted : !poi.__undoDeleted;
      if (shouldDelete) deletePois.push(poi);
      else restorePois.push({ poi, index });
    });
    (action?.groups || []).forEach((group, index) => {
      const shouldDelete = direction === "redo" ? group.__undoDeleted : !group.__undoDeleted;
      if (shouldDelete) deleteGroups.push(group);
      else restoreGroups.push({ group, index });
    });

    const purgeSnapshotAction = Boolean(action?.purgeAction);
    const hasGroupSnapshots = restoreGroups.length > 0 || deleteGroups.length > 0;
    const generatedSnapshotAction = (action?.pois || []).length > 0
      && (action.pois || []).every(poi => poi?.Generation_Source);

    if (purgeSnapshotAction || hasGroupSnapshots || generatedSnapshotAction) {
      if (restoreGroups.length || deleteGroups.length) {
        const { data: groupData, error: groupError } = await campaignSupabase.rpc("restore_poi_group_snapshots", {
          target_campaign_id: campaignId,
          delete_group_ids: deleteGroups.map(group => group?.__uuid).filter(Boolean),
          group_snapshot: serializePoiGroupSnapshot(restoreGroups.map(entry => entry.group))
        });
        if (groupError) throw groupError;

        deleteGroups.forEach(group => {
          if (group?.__uuid) removeLocalPoiGroup?.(group.__uuid);
        });

        const restoredGroupRows = (Array.isArray(groupData) ? groupData : [groupData])
          .filter(Boolean)
          .sort((left, right) => Number(left?.snapshot_order || 0) - Number(right?.snapshot_order || 0));
        const restoredGroups = registerPoiGroupRowsInLocalDb(restoredGroupRows);
        restoredGroups.forEach((restored, restoredIndex) => {
          const entry = restoreGroups[restoredIndex];
          if (!entry) return;
          action.groups[entry.index] = {
            ...buildPoiGroupHistoryRecord(restored, { undoDeleted: Boolean(entry.group.__undoDeleted) }),
            __undoDeleted: Boolean(entry.group.__undoDeleted)
          };
        });
      }

      const { data, error } = await campaignSupabase.rpc("restore_generated_poi_snapshots", {
        target_campaign_id: campaignId,
        delete_poi_ids: deletePois.map(resolvePoiHistoryUuid).filter(Boolean),
        poi_snapshot: serializePoiSnapshot(restorePois.map(entry => entry.poi))
      });
      if (error) throw error;

      deletePois.forEach(poi => {
        const poiUuid = resolvePoiHistoryUuid(poi);
        if (poiUuid) removeLocalPoi?.(poiUuid);
      });

      const restoredRows = (Array.isArray(data) ? data : [data])
        .filter(Boolean)
        .sort((left, right) => Number(left?.snapshot_order || 0) - Number(right?.snapshot_order || 0));
      const registeredRestoredPois = registerRestoredPois(restoredRows);
      const restoredPois = (Array.isArray(registeredRestoredPois)
        ? registeredRestoredPois
        : [registeredRestoredPois])
        .filter(Boolean);

      restoredPois.forEach((restored, restoredIndex) => {
        const entry = restorePois[restoredIndex];
        if (!entry) return;
        action.pois[entry.index] = {
          ...buildPoiHistoryRecord(restored, { undoDeleted: Boolean(entry.poi.__undoDeleted) }),
          __undoDeleted: Boolean(entry.poi.__undoDeleted)
        };
      });

      refreshPoiViews?.();
      return;
    }

    for (const poi of deletePois) {
      const poiUuid = resolvePoiHistoryUuid(poi);
      if (!poiUuid) continue;
      const { error } = await campaignSupabase.rpc("delete_campaign_record", {
        target_campaign_id: campaignId,
        target_record_type: "poi",
        target_record_id: poiUuid
      });
      if (error && !isMissingPersistedDeleteError(error)) throw error;
      removeLocalPoi?.(poiUuid);
    }

    for (const entry of restorePois) {
      const restored = await recreatePoiFromHistoryRecord(campaignId, entry.poi, registerRestoredPois);
      if (!restored) continue;
      action.pois[entry.index] = {
        ...buildPoiHistoryRecord(restored, { undoDeleted: Boolean(entry.poi.__undoDeleted) }),
        __undoDeleted: Boolean(entry.poi.__undoDeleted)
      };
    }

    refreshPoiViews?.();
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

  async function applyRegionBatchAction(campaignId, actions, direction, historyAction = {}) {
    const regionActions = (actions || []).filter(action => action?.type === "region");
    if (!regionActions.length) return;
    const generatedRegions = (historyAction.generatedRegions || []).filter(isGeneratedGeographicRegionRecord);

    if (direction === "redo" && generatedRegions.length) {
      await restoreGeneratedRegionRecords(campaignId, generatedRegions, regionActions);
    }

    const { error } = await campaignSupabase.rpc("restore_generated_hex_region_snapshots", {
      target_campaign_id: campaignId,
      region_snapshot: serializeRegionSnapshot(regionActions, direction)
    });
    if (error) throw error;

    regionActions.forEach(action => {
      applyLocalRegionSnapshot(action.hexId, direction === "undo" ? action.before : action.after);
    });

    if (direction === "undo" && generatedRegions.length) {
      await deleteGeneratedRegionRecords(campaignId, generatedRegions);
    }
  }

  async function restoreGeneratedRegionRecords(campaignId, generatedRegions, regionActions) {
    const refRemap = new Map();
    for (const regionRecord of generatedRegions) {
      if (!regionRecord?.Region_ID) continue;
      const existing = db?.regionsById?.[regionRecord.Region_ID];
      if (existing?.__uuid) {
        refRemap.set(regionRecord.Region_ID, existing.Region_ID);
        continue;
      }

      const restored = await createGeneratedGeographicRegion(campaignId, {
        name: regionRecord.Region_Name || "Generated Region",
        color: regionRecord.Border_Color || "#ffd84d",
        family: regionRecord.Generated_Family || "",
        lore: regionRecord.Lore || buildGeneratedGeographicRegionLore(regionRecord.Generated_Family || "")
      });
      if (!restored?.Region_ID) continue;
      const previousRef = regionRecord.Region_ID;
      Object.assign(regionRecord, buildGeneratedRegionHistoryRecord(restored, regionRecord.Generated_Family || ""));
      refRemap.set(previousRef, restored.Region_ID);
    }

    if (!refRemap.size) return;
    regionActions.forEach(action => {
      const nextRef = refRemap.get(action?.after?.geographicRegionId);
      if (nextRef) action.after.geographicRegionId = nextRef;
      const previousRef = refRemap.get(action?.before?.geographicRegionId);
      if (previousRef) action.before.geographicRegionId = previousRef;
    });
  }

  async function deleteGeneratedRegionRecords(campaignId, generatedRegions) {
    for (const regionRecord of generatedRegions) {
      const region = db?.regionsById?.[regionRecord.Region_ID] || regionRecord;
      if (!isGeneratedGeographicRegionRecord(region)) continue;
      const regionUuid = region.__uuid || regionRecord.__uuid;
      if (!regionUuid) {
        removeGeneratedRegionFromLocalDb(region);
        continue;
      }
      const { error } = await campaignSupabase.rpc("delete_campaign_record", {
        target_campaign_id: campaignId,
        target_record_type: "region",
        target_record_id: regionUuid
      });
      if (error && !isMissingPersistedDeleteError(error)) throw error;
      removeGeneratedRegionFromLocalDb(region);
    }
    refreshGeneratedRegionCodexViews();
  }

  function refreshGeneratedRegionCodexViews() {
    populateDrawRegionSelect();
    window.refreshGeneratedMapRegionLayer?.();
    const currentPage = getCurrentCodexPage?.();
    if (!currentPage) return;
    if (currentPage.type === "region" && !db?.regionsById?.[currentPage.id]) {
      renderCodexPage?.("regions", null);
      return;
    }
    if (["region", "regions", "hex"].includes(currentPage.type)) {
      renderCodexPage?.(currentPage.type, currentPage.id);
    }
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
    bumpOverlayRevision();
    updateDrawClearButton();
  }

  async function applyNukeRegionAction(campaignId, action, direction) {
    const generatedRegions = (action.generatedRegions || []).filter(isGeneratedGeographicRegionRecord);
    if (direction === "redo") {
      const { error } = await campaignSupabase.rpc("clear_generated_hex_region_layer", {
        target_campaign_id: campaignId,
        target_region_type: action.regionType === "political" ? "political" : "geographic"
      });
      if (error) throw error;
      if (generatedRegions.length) {
        await deleteGeneratedRegionRecords(campaignId, generatedRegions);
      }
    } else {
      if (generatedRegions.length) {
        await restoreGeneratedRegionRecords(campaignId, generatedRegions, action.actions || []);
      }
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

  function serializeRegionSnapshot(actions, direction = "undo") {
    return (actions || []).map(action => ({
      hex_ref: action.hexId,
      geographic_region_ref: (direction === "undo" ? action.before : action.after)?.geographicRegionId || UNCLAIMED_REGION_REF,
      political_region_ref: (direction === "undo" ? action.before : action.after)?.politicalRegionId || null
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

  async function purgeSavedOverlayType(type, options = {}) {
    const campaign = getActiveCampaign?.();
    const normalizedType = OVERLAY_TYPE_LABELS[type] ? type : "";
    const skipConfirm = Boolean(options.skipConfirm);
    const showSuccessAlert = options.showSuccessAlert !== false;
    if (!campaign || !normalizedType) return false;

    const label = OVERLAY_TYPE_LABELS[normalizedType];
    if (!skipConfirm && !await confirmNukeAction(`Purge all saved live-map ${label} immediately? This does not affect staged preview edits.`)) return false;

    renderer.drawing.saving = true;
    let showBulkLoading = false;
    refreshEditorActionControls();

    try {
      const persistedOverlays = await fetchCurrentPersistedOverlays(campaign.id);
      const removed = persistedOverlays
        .filter(overlay => overlay.Overlay_Type === normalizedType)
        .map(overlay => ({ ...cloneOverlayRecord(overlay), __undoDeleted: true }));
      if (!removed.length) return true;

      showBulkLoading = removed.length >= BULK_OVERLAY_LOADING_THRESHOLD;
      if (showBulkLoading) setLoading(true);

      await Promise.all(removed.map(overlay => deleteOverlayById(campaign.id, overlay.__uuid)));
      removeLocalOverlaysById(removed.map(overlay => overlay.__uuid));
      pushOverlayUndoAction(removed);
      renderer.routeLabelCache = { key: "", labels: [] };
      markRouteCacheDirty();
      markOverlayCacheDirty();
      render();
      if (showSuccessAlert) window.alert?.(`Purged ${removed.length} saved ${label} segment${removed.length === 1 ? "" : "s"}.`);
      return true;
    } catch (error) {
      console.error(`Unable to purge generated map ${label}:`, error);
      window.alert?.(error.message || `Unable to purge ${label}.`);
      return false;
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorActionControls();
    }
  }

  async function purgeAllSavedOverlays(options = {}) {
    const campaign = getActiveCampaign?.();
    const skipConfirm = Boolean(options.skipConfirm);
    const showSuccessAlert = options.showSuccessAlert !== false;
    if (!campaign) return false;

    if (!skipConfirm && !await confirmNukeAction("Purge all saved live-map overlays immediately? This does not affect staged preview edits.")) return false;

    renderer.drawing.saving = true;
    let showBulkLoading = false;
    refreshEditorActionControls();

    try {
      const persistedOverlays = await fetchCurrentPersistedOverlays(campaign.id);
      const removed = persistedOverlays.map(overlay => ({ ...cloneOverlayRecord(overlay), __undoDeleted: true }));
      if (!removed.length) return true;

      showBulkLoading = removed.length >= BULK_OVERLAY_LOADING_THRESHOLD;
      if (showBulkLoading) setLoading(true);

      await Promise.all(removed.map(overlay => deleteOverlayById(campaign.id, overlay.__uuid)));
      removeLocalOverlaysById(removed.map(overlay => overlay.__uuid));
      pushOverlayUndoAction(removed);
      renderer.routeLabelCache = { key: "", labels: [] };
      markRouteCacheDirty();
      markOverlayCacheDirty();
      render();
      if (showSuccessAlert) window.alert?.(`Purged ${removed.length} saved overlay segment${removed.length === 1 ? "" : "s"}.`);
      return true;
    } catch (error) {
      console.error("Unable to purge generated map overlays:", error);
      window.alert?.(error.message || "Unable to purge all overlays.");
      return false;
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorActionControls();
    }
  }

  async function clearDrawnOverlaysByType(type) {
    await purgeSavedOverlayType(type);
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
      markRouteCacheDirty();
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
    if (!await showMapConfirm(`Delete ${routeTypeLabel(route.type)} "${route.name}" from the map?`, {
      title: "Delete Named Route?",
      confirmLabel: "Delete",
      tone: "danger"
    })) return;

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
      markRouteCacheDirty();
      renderNamedRoutesList();
      render();
    } catch (error) {
      console.error("Unable to delete named route:", error);
      window.alert?.(error.message || "Unable to delete named route.");
    } finally {
      renderer.drawing.saving = false;
      refreshEditorActionControls();
    }
  }

  async function clearAllGeneratedRegions(regionType) {
    const campaign = getActiveCampaign?.();
    const normalizedType = regionType === "political" ? "political" : "geographic";
    const label = normalizedType === "political" ? "political" : "geographic";
    if (!campaign) return;
    if (!await confirmNukeAction(`Purge all ${label} region paint from the live generated map immediately? Generated Codex region entries will also be deleted; manual region entries stay intact.`)) return;

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
    const generatedRegions = getGeneratedRegionRecordsForPurge(normalizedType, actions);
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
      afterPersist: () => deleteGeneratedRegionRecords(campaign.id, generatedRegions),
      historyAction: { type: "nuke-regions", regionType: normalizedType, actions, generatedRegions },
      errorPrefix: `Unable to purge ${label} regions`
    });
  }

  function getGeneratedRegionRecordsForPurge(regionType, actions) {
    const affectedRegionIds = new Set((actions || []).map(action => (
      regionType === "political" ? action?.before?.politicalRegionId : action?.before?.geographicRegionId
    )).filter(Boolean));
    return (db?.raw?.regions || [])
      .filter(region => String(region.Region_Type || "geographic") === regionType)
      .filter(region => affectedRegionIds.has(region.Region_ID))
      .filter(isGeneratedGeographicRegionRecord)
      .map(region => buildGeneratedRegionHistoryRecord(region));
  }

  async function stageAllGeneratedFeaturePurge() {
    if (!isActive()) return;
    if (!await confirmNukeAction("Purge all terrain features in the Cartographer preview? Base terrain and elevation will be preserved. This stays local until Apply Preview.")) return;

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
    actions.forEach(action => {
      applyLocalTerrainSnapshot(action.hexId, action.after);
    });
    pushStagedMapEditAction({
      type: "batch",
      previewSection: "features",
      actions
    }, { force: true });
    markAllMapCachesDirty();
    render();
    updateGenerationControls();
    refreshEditorActionControls();
  }

  async function runBulkNukeAction({ actions, rpcName, rpcArgs, applyLocal, afterPersist, historyAction, errorPrefix }) {
    renderer.drawing.saving = true;
    const showBulkLoading = actions.length >= BULK_OVERLAY_LOADING_THRESHOLD;
    if (showBulkLoading) setLoading(true);
    refreshEditorActionControls();

    try {
      const { error } = await campaignSupabase.rpc(rpcName, rpcArgs);
      if (error) throw error;
      applyLocal?.();
      await afterPersist?.();
      pushMapEditAction(historyAction || { type: "batch", actions }, { force: true });
    } catch (error) {
      console.error(`${errorPrefix}:`, error);
      window.alert?.(error.message || `${errorPrefix}.`);
    } finally {
      renderer.drawing.saving = false;
      if (showBulkLoading) setLoading(false);
      refreshEditorActionControls();
    }
  }

  function confirmNukeAction(message) {
    return showMapConfirm(message, {
      title: "Are You Sure?",
      confirmLabel: "Purge",
      tone: "danger"
    });
  }

  function showMapConfirm(message, options = {}) {
    return window.codexConfirm
      ? window.codexConfirm(message, options)
      : Promise.resolve(window.confirm?.(message) === true);
  }

  async function fetchCurrentPersistedOverlays(campaignId) {
    const { data, error } = await campaignSupabase
      .from("generated_map_overlays")
      .select("id, overlay_type, from_hex_id, to_hex_id, hex_id, edge, style, is_major_route, route_name")
      .eq("campaign_id", campaignId);

    if (error) throw error;
    return (data || []).map(adaptOverlayRpcRow).filter(Boolean);
  }

  function isMissingPersistedDeleteError(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("no longer exists")
      || message.includes("does not exist")
      || message.includes("not found")
    );
  }

  async function deleteOverlayById(campaignId, overlayId, options = {}) {
    const { error } = await campaignSupabase.rpc("delete_generated_map_overlay", {
      target_campaign_id: campaignId,
      target_overlay_id: overlayId
    });
    if (error) {
      if (options.allowMissing && isMissingPersistedDeleteError(error)) return false;
      throw error;
    }
    return true;
  }

  async function restoreDeletedOverlay(campaignId, overlay) {
    const isHexOverlay = isHexStyleOverlayType(overlay.Overlay_Type);
    const { data, error } = await campaignSupabase.rpc("add_generated_map_overlay", {
      target_campaign_id: campaignId,
      target_overlay_type: overlay.Overlay_Type,
      from_hex_ref: isHexOverlay ? overlay.Hex_ID_Ref : overlay.From_Hex_ID_Ref,
      to_hex_ref: isHexOverlay ? null : overlay.To_Hex_ID_Ref,
      target_edge: overlay.Overlay_Type === "wall" ? overlay.Edge : null,
      target_style: overlay.Style,
      target_is_major_route: Boolean(overlay.Is_Major_Route),
      target_route_name: overlay.Route_Name || null
    });

    if (error) throw error;
    const restored = adaptOverlayRpcRow(data);
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
    return renderer.hexIdsByUuid.get(hexUuid) || "";
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
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
    updateDrawClearButton();
  }

  function upsertLocalOverlays(overlays) {
    const validOverlays = (overlays || []).filter(overlay => overlay?.__uuid);
    if (!validOverlays.length) return;

    validOverlays.forEach(overlay => {
      const existingIndex = renderer.mapOverlays.findIndex(candidate => candidate.__uuid === overlay.__uuid);
      if (existingIndex >= 0) {
        renderer.mapOverlays.splice(existingIndex, 1, overlay);
      } else {
        renderer.mapOverlays.push(overlay);
      }
    });

    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
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
    bumpOverlayRevision();
    return removed;
  }

  function removeLocalOverlayById(overlayId) {
    renderer.mapOverlays = renderer.mapOverlays.filter(overlay => overlay.__uuid !== overlayId);
    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
    updateDrawClearButton();
  }

  function removeLocalOverlaysById(overlayIds) {
    const targetIds = new Set((overlayIds || []).filter(Boolean));
    if (!targetIds.size) return;
    const removedOverlays = renderer.mapOverlays.filter(overlay => targetIds.has(overlay.__uuid));
    const originalLength = renderer.mapOverlays.length;
    renderer.mapOverlays = renderer.mapOverlays.filter(overlay => !targetIds.has(overlay.__uuid));
    if (renderer.mapOverlays.length === originalLength) return;

    if (db?.raw?.generatedMapOverlays) db.raw.generatedMapOverlays = renderer.mapOverlays;
    bumpOverlayRevision();
    markRouteCacheDirty();
    markOverlayCacheDirty();
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

  function getWallPlacementEdges(point, hex) {
    if (!hex) return [];
    return getWallPreviewEdges({ hexId: hex.id, edge: nearestEdgeFromWorldPoint(point, hex), point });
  }

  function getWallPreviewEdges(edgeRef) {
    if (!edgeRef?.hexId || !edgeRef.edge) return [];
    const mode = getValidWallMode(renderer.drawing.wallMode);
    if (mode === "shape") {
      return getWallShapeEdges(edgeRef.hexId);
    }
    if (mode === "plane") {
      return getWallPlaneSeedEdges(edgeRef);
    }
    return [edgeRef];
  }

  function getWallPlaneSeedEdges(startRef) {
    const startSegment = getWallEdgeSegment(startRef);
    if (!startSegment) return [startRef];
    const forwardEndpoint = getWallForwardEndpoint(startRef, startRef.point);
    const forwardVector = getWallDirectionVectorFromSegment(startSegment, forwardEndpoint?.key);
    const nextRef = getBestWallContinuation(
      getWallEdgesAtEndpoint(forwardEndpoint?.key)
        .filter(candidate => (getWallSegmentKey(candidate) || getWallRefKey(candidate)) !== (getWallSegmentKey(startRef) || getWallRefKey(startRef))),
      forwardEndpoint,
      forwardVector,
      startRef.point || {
        x: (startSegment.a.x + startSegment.b.x) / 2,
        y: (startSegment.a.y + startSegment.b.y) / 2
      }
    );
    return nextRef ? [startRef, nextRef] : [startRef];
  }

  function getWallPlaneDragEdges(branch, point, distanceLimit) {
    if (!branch?.lastPair?.length) return [];
    const nextStep = getNextWallPlanePair(branch);
    if (!nextStep?.pair?.length) return [];
    const nextCenter = getWallEdgeGroupCenter(nextStep.pair);
    if (!nextCenter || distanceLimit < 1 || Math.hypot(point.x - nextCenter.x, point.y - nextCenter.y) > getGeneratedMapDimensions().radius * 4) {
      return [];
    }
    applyWallPlaneStep(branch, nextStep);
    return nextStep.pair;
  }

  function getNextWallPlanePair(state) {
    const previousPair = state?.lastPair || [];
    const anchor = previousPair[previousPair.length - 1];
    const anchorEndpoint = state?.activeEndpointKey
      ? getWallEndpointByKey(anchor, state.activeEndpointKey)
      : getWallForwardEndpoint(anchor, null);
    if (!anchor || !anchorEndpoint) return [];
    const first = getBestWallContinuation(
      getWallEdgeCandidatesNear(anchor)
        .filter(candidate => !state.seen.has(getWallSegmentKey(candidate) || getWallRefKey(candidate)))
        .filter(candidate => wallEdgeTouchesEndpointKey(candidate, anchorEndpoint.key)),
      anchorEndpoint,
      state.directionVector,
      state.guidePoint || anchorEndpoint.point
    );
    if (!first) return [];
    const firstEnd = getWallOppositeEndpoint(first, anchorEndpoint.key);
    return {
      pair: [first],
      activeEndpointKey: firstEnd?.key || state.activeEndpointKey
    };
  }

  function applyWallPlaneStep(state, step) {
    if (!state || !step?.pair?.length) return;
    step.pair.forEach(edgeRef => state.seen.add(getWallSegmentKey(edgeRef) || getWallRefKey(edgeRef)));
    state.lastPair = step.pair;
    state.activeEndpointKey = step.activeEndpointKey || state.activeEndpointKey;
  }

  function beginWallPlaneDragPreview(event) {
    const point = clientToWorld(event);
    const hex = getHexAtWorldPoint(point);
    const seedEdges = getWallPlacementEdges(point, hex);
    initializeWallPlaneDrag(seedEdges, point);
  }

  function updateWallPlaneDragPreview(event) {
    const state = renderer.drawing.wallPlaneDrag;
    if (!state?.previewEdges?.length) return false;
    const point = clientToWorld(event);
    state.cursorPoint = point;
    if (state.previewEdges.length >= 80 || !state.axisUnit || !state.seedCenter) return true;
    const relative = {
      x: point.x - state.seedCenter.x,
      y: point.y - state.seedCenter.y
    };
    const projection = relative.x * state.axisUnit.x + relative.y * state.axisUnit.y;
    const radius = getGeneratedMapDimensions().radius;
    const targetPairCount = Math.min(48, Math.floor(Math.abs(projection) / Math.max(1, radius * 0.85)));
    const branch = projection >= 0 ? state.forwardBranch : state.backwardBranch;
    if (!branch) return true;
    while (branch.pairCount < targetPairCount && state.previewEdges.length < 80) {
      const nextEdges = getWallPlaneDragEdges(branch, point, targetPairCount - branch.pairCount);
      if (!nextEdges.length) break;
      branch.pairCount += 1;
      nextEdges.forEach(edgeRef => {
        const key = getWallSegmentKey(edgeRef) || getWallRefKey(edgeRef);
        if (state.previewKeys.has(key)) return;
        state.previewKeys.add(key);
        state.previewEdges.push(edgeRef);
      });
    }
    return true;
  }

  function initializeWallPlaneDrag(seedEdges, cursorPoint = null) {
    if (!seedEdges?.length) return;
    const first = seedEdges[0];
    const last = seedEdges[seedEdges.length - 1];
    const firstSegment = getWallEdgeSegment(first);
    const lastSegment = getWallEdgeSegment(last);
    if (!firstSegment || !lastSegment) return;
    const sharedEndpoint = getSharedWallEndpointKey(first, last);
    const forwardEndpoint = sharedEndpoint ? getWallOppositeEndpoint(last, sharedEndpoint) : getWallForwardEndpoint(last, null);
    const backwardEndpoint = sharedEndpoint ? getWallOppositeEndpoint(first, sharedEndpoint) : getWallOppositeEndpoint(first, forwardEndpoint?.key);
    const startCenter = {
      x: (firstSegment.a.x + firstSegment.b.x) / 2,
      y: (firstSegment.a.y + firstSegment.b.y) / 2
    };
    const endCenter = {
      x: (lastSegment.a.x + lastSegment.b.x) / 2,
      y: (lastSegment.a.y + lastSegment.b.y) / 2
    };
    const axisLength = Math.hypot(endCenter.x - startCenter.x, endCenter.y - startCenter.y) || 1;
    const axisUnit = {
      x: (endCenter.x - startCenter.x) / axisLength,
      y: (endCenter.y - startCenter.y) / axisLength
    };
    const seedCenter = {
      x: (startCenter.x + endCenter.x) / 2,
      y: (startCenter.y + endCenter.y) / 2
    };
    const sharedSeen = new Set(seedEdges.map(edgeRef => getWallSegmentKey(edgeRef) || getWallRefKey(edgeRef)));
    renderer.drawing.wallPlaneDrag = {
      lastPair: seedEdges,
      activeEndpointKey: sharedEndpoint || "",
      directionVector: {
        x: endCenter.x - startCenter.x,
        y: endCenter.y - startCenter.y
      },
      seen: sharedSeen,
      previewEdges: [...seedEdges],
      previewKeys: new Set(sharedSeen),
      seedCenter,
      axisUnit,
      forwardBranch: {
        lastPair: [last],
        activeEndpointKey: forwardEndpoint?.key || "",
        directionVector: { x: axisUnit.x, y: axisUnit.y },
        guidePoint: seedCenter,
        seen: sharedSeen,
        pairCount: 0
      },
      backwardBranch: {
        lastPair: [first],
        activeEndpointKey: backwardEndpoint?.key || "",
        directionVector: { x: -axisUnit.x, y: -axisUnit.y },
        guidePoint: seedCenter,
        seen: sharedSeen,
        pairCount: 0
      },
      cursorPoint
    };
  }

  function getSharedWallEndpointKey(first, second) {
    const firstSegment = getWallEdgeSegment(first);
    const secondSegment = getWallEdgeSegment(second);
    if (!firstSegment || !secondSegment) return "";
    const firstKeys = new Set([wallPointKey(firstSegment.a), wallPointKey(firstSegment.b)]);
    const secondKeys = [wallPointKey(secondSegment.a), wallPointKey(secondSegment.b)];
    return secondKeys.find(key => firstKeys.has(key)) || "";
  }

  function getWallEdgeGroupCenter(edgeRefs) {
    const points = [];
    edgeRefs.forEach(edgeRef => {
      const segment = getWallEdgeSegment(edgeRef);
      if (!segment) return;
      points.push(segment.a, segment.b);
    });
    if (!points.length) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
  }

  function getWallLinearEdges(startRef, size) {
    const targetSize = clampNumber(Number(size), 1, 8, 1);
    const startSegment = getWallEdgeSegment(startRef);
    if (!startSegment) return [startRef];
    const guidePoint = startRef.point || {
      x: (startSegment.a.x + startSegment.b.x) / 2,
      y: (startSegment.a.y + startSegment.b.y) / 2
    };
    const forwardCount = Math.floor(targetSize / 2);
    const backwardCount = targetSize - forwardCount - 1;
    const forwardEndpoint = getWallForwardEndpoint(startRef, startRef.point);
    const backwardEndpoint = getWallOppositeEndpoint(startRef, forwardEndpoint?.key);
    const forwardVector = getWallDirectionVectorFromSegment(startSegment, forwardEndpoint?.key);
    const backwardVector = getWallDirectionVectorFromSegment(startSegment, backwardEndpoint?.key);
    const forwardRefs = getConnectedWallRun(startRef, forwardEndpoint, forwardVector, guidePoint, forwardCount);
    const backwardRefs = getConnectedWallRun(startRef, backwardEndpoint, backwardVector, guidePoint, backwardCount);
    return [...backwardRefs.reverse(), startRef, ...forwardRefs];
  }

  function getConnectedWallRun(startRef, startEndpoint, directionVector, guidePoint, count) {
    const refs = [];
    const seen = new Set([getWallSegmentKey(startRef) || getWallRefKey(startRef)]);
    let activeEndpoint = startEndpoint;

    while (refs.length < count && activeEndpoint) {
      const candidates = getWallEdgesAtEndpoint(activeEndpoint.key)
        .filter(candidate => !seen.has(getWallSegmentKey(candidate) || getWallRefKey(candidate)))
        .filter(candidate => !isOppositeWallDuplicate(candidate, startRef));
      const nextRef = getBestWallContinuation(candidates, activeEndpoint, directionVector, guidePoint);
      if (!nextRef) break;
      refs.push(nextRef);
      seen.add(getWallSegmentKey(nextRef) || getWallRefKey(nextRef));
      const nextEndpoint = getWallOppositeEndpoint(nextRef, activeEndpoint.key);
      activeEndpoint = nextEndpoint;
    }

    return refs;
  }

  function getWallShapeEdges(centerHexId) {
    const center = renderer.hexesById.get(centerHexId);
    if (!center) return [];
    const size = clampNumber(Number(renderer.drawing.wallSize), 1, 8, 1);
    const effectiveSize = Math.max(0, size - 1);
    const shape = getValidWallShape(renderer.drawing.wallShape);
    const footprint = new Set();

    if (effectiveSize <= 0) {
      footprint.add(center.id);
    } else if (shape === "round_keep") {
      getHexesWithinRadius(center, effectiveSize).forEach(hex => footprint.add(hex.id));
    } else if (shape === "long_keep") {
      addWallRectFootprint(footprint, center, Math.max(1, effectiveSize), Math.max(2, effectiveSize * 2));
    } else {
      addWallRectFootprint(footprint, center, Math.max(2, effectiveSize * 2 - 1), Math.max(2, effectiveSize * 2 - 1));
    }

    if (!footprint.size) footprint.add(center.id);

    const edges = [];
    footprint.forEach(hexId => {
      const hex = renderer.hexesById.get(hexId);
      if (!hex) return;
      EDGE_NAMES.forEach(edge => {
        const neighbor = getNeighborHex(hex, edge);
        if (!neighbor || !footprint.has(neighbor.id)) {
          edges.push({ hexId, edge });
        }
      });
    });
    return edges;
  }

  function getHexesWithinRadius(centerHex, radius) {
    const visited = new Set([centerHex.id]);
    const queue = [{ hex: centerHex, distance: 0 }];
    const results = [centerHex];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.distance >= radius) continue;
      EDGE_NAMES.forEach(edgeName => {
        const neighbor = getNeighborHex(current.hex, edgeName);
        if (!neighbor || visited.has(neighbor.id)) return;
        visited.add(neighbor.id);
        results.push(neighbor);
        queue.push({ hex: neighbor, distance: current.distance + 1 });
      });
    }
    return results;
  }

  function addWallRectFootprint(footprint, center, width, height) {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    for (let dx = -halfWidth; dx <= width - halfWidth - 1; dx += 1) {
      for (let dy = -halfHeight; dy <= height - halfHeight - 1; dy += 1) {
        const hex = renderer.hexesByCoord.get(`${center.x + dx}:${center.y + dy}`);
        if (hex) footprint.add(hex.id);
      }
    }
  }

  function getWallEdgeSegment(edgeRef) {
    const hex = renderer.hexesById.get(edgeRef?.hexId);
    return getHexEdgeSegment(hex, edgeRef?.edge);
  }

  function getWallDirectionVectorFromSegment(segment, endpointKey) {
    if (!segment || !endpointKey) return { x: 0, y: 0 };
    const from = wallPointKey(segment.a) === endpointKey ? segment.b : segment.a;
    const to = wallPointKey(segment.a) === endpointKey ? segment.a : segment.b;
    return {
      x: to.x - from.x,
      y: to.y - from.y
    };
  }

  function getWallForwardEndpoint(edgeRef, point) {
    const segment = getWallEdgeSegment(edgeRef);
    if (!segment) return null;
    const endpoint = point ? getWallEndpointInCursorDirection(segment, point) : segment.b;
    return { key: wallPointKey(endpoint), point: endpoint };
  }

  function getWallOppositeEndpoint(edgeRef, endpointKey) {
    const segment = getWallEdgeSegment(edgeRef);
    if (!segment) return null;
    const opposite = wallPointKey(segment.a) === endpointKey ? segment.b : segment.a;
    return { key: wallPointKey(opposite), point: opposite };
  }

  function getWallEndpointByKey(edgeRef, endpointKey) {
    const segment = getWallEdgeSegment(edgeRef);
    if (!segment || !endpointKey) return null;
    if (wallPointKey(segment.a) === endpointKey) return { key: endpointKey, point: segment.a };
    if (wallPointKey(segment.b) === endpointKey) return { key: endpointKey, point: segment.b };
    return null;
  }

  function getBestWallContinuation(candidates, activeEndpoint, directionVector, guidePoint) {
    if (!candidates.length || !activeEndpoint?.point) return null;
    let best = null;
    let bestScore = Infinity;
    const directionLength = Math.hypot(directionVector?.x || 0, directionVector?.y || 0) || 1;
    const direction = {
      x: (directionVector?.x || 0) / directionLength,
      y: (directionVector?.y || 0) / directionLength
    };
    const normal = { x: -direction.y, y: direction.x };
    const radius = getGeneratedMapDimensions().radius;
    candidates.forEach(candidate => {
      const segment = getWallEdgeSegment(candidate);
      if (!segment) return;
      const otherPoint = wallPointKey(segment.a) === activeEndpoint.key ? segment.b : segment.a;
      const edgeVector = {
        x: otherPoint.x - activeEndpoint.point.x,
        y: otherPoint.y - activeEndpoint.point.y
      };
      const edgeLength = Math.hypot(edgeVector.x, edgeVector.y) || 1;
      const forwardAlignment = (direction.x * edgeVector.x + direction.y * edgeVector.y) / edgeLength;
      if (forwardAlignment <= 0.05) return;
      const midpoint = {
        x: (segment.a.x + segment.b.x) / 2,
        y: (segment.a.y + segment.b.y) / 2
      };
      const relative = {
        x: midpoint.x - guidePoint.x,
        y: midpoint.y - guidePoint.y
      };
      const lineDistance = Math.abs(relative.x * normal.x + relative.y * normal.y);
      if (lineDistance > radius * 1.05) return;
      const score = lineDistance - forwardAlignment * radius * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    return best;
  }

  function getWallEdgeCandidatesNear(edgeRef) {
    const candidates = [];
    const seen = new Set();
    const addHexEdges = hex => {
      if (!hex) return;
      EDGE_NAMES.forEach(edge => {
        const candidate = { hexId: hex.id, edge };
        const key = getWallRefKey(candidate);
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(candidate);
      });
    };
    const hex = renderer.hexesById.get(edgeRef?.hexId);
    addHexEdges(hex);
    if (hex) EDGE_NAMES.forEach(edge => addHexEdges(getNeighborHex(hex, edge)));
    return candidates;
  }

  function getWallEdgesAtEndpoint(endpointKey) {
    const candidates = [];
    const seen = new Set();
    renderer.hexes.forEach(hex => {
      EDGE_NAMES.forEach(edge => {
        const edgeRef = { hexId: hex.id, edge };
        const key = getWallSegmentKey(edgeRef) || getWallRefKey(edgeRef);
        if (seen.has(key)) return;
        const segment = getWallEdgeSegment(edgeRef);
        if (!segment) return;
        if (wallPointKey(segment.a) !== endpointKey && wallPointKey(segment.b) !== endpointKey) return;
        seen.add(key);
        candidates.push(edgeRef);
      });
    });
    return candidates;
  }

  function isOppositeWallDuplicate(candidate, reference) {
    return Boolean(candidate && reference && (getWallSegmentKey(candidate) || getWallRefKey(candidate)) === (getWallSegmentKey(reference) || getWallRefKey(reference)));
  }

  function getWallEdgePlane(edge) {
    const index = EDGE_NAMES.indexOf(edge);
    if (index < 0) return "";
    return EDGE_NAMES[Math.min(index, (index + 3) % EDGE_NAMES.length)];
  }

  function getWallEndpointInCursorDirection(segment, point) {
    const center = {
      x: (segment.a.x + segment.b.x) / 2,
      y: (segment.a.y + segment.b.y) / 2
    };
    const cursorVector = { x: point.x - center.x, y: point.y - center.y };
    const firstVector = { x: segment.a.x - center.x, y: segment.a.y - center.y };
    const secondVector = { x: segment.b.x - center.x, y: segment.b.y - center.y };
    const firstScore = cursorVector.x * firstVector.x + cursorVector.y * firstVector.y;
    const secondScore = cursorVector.x * secondVector.x + cursorVector.y * secondVector.y;
    return firstScore >= secondScore ? segment.a : segment.b;
  }

  function wallEdgeTouchesEndpointKey(edgeRef, endpointKey) {
    const segment = getWallEdgeSegment(edgeRef);
    return Boolean(segment && (wallPointKey(segment.a) === endpointKey || wallPointKey(segment.b) === endpointKey));
  }

  function wallPointKey(point) {
    return `${Math.round(point.x * 100)}:${Math.round(point.y * 100)}`;
  }

  function getWallRefKey(edgeRef) {
    return `${edgeRef?.hexId || ""}:${edgeRef?.edge || ""}`;
  }

  function getWallSegmentKey(edgeRef) {
    const segment = getWallEdgeSegment(edgeRef);
    return segment ? edgeKey(segment.a, segment.b) : "";
  }

  function getDrawingHoverEdge(tool, point, hex) {
    if (!hex) return null;
    if (tool === "wall") {
      return { hexId: hex.id, edge: nearestEdgeFromWorldPoint(point, hex), point };
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
    const fromHex = hexForPathPoint(fromHexId);
    const toHex = hexForPathPoint(toHexId);
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

  function getPathOverlaySequence(tool, fromHexId, toHexId, exitEdge = "", options = {}) {
    if (tool === "road" && !exitEdge && fromHexId !== toHexId && !renderer.drawing.roadWaterOverride) {
      return getRoadPathSequence(fromHexId, toHexId, options) || [];
    }
    if (tool === "river" && !exitEdge && fromHexId !== toHexId) {
      const riverSequence = getManualRiverPathSequence(fromHexId, toHexId);
      if (riverSequence?.length) return riverSequence;
      const directSequence = getHexLineSequence(fromHexId, toHexId);
      return getCurrentRouteMajor("river") && sequenceCrossesMajorRiverOpenWater(directSequence)
        ? []
        : directSequence;
    }
    if (tool === "sea_route" && !exitEdge && fromHexId !== toHexId) {
      return getSeaRoutePathSequence(fromHexId, toHexId, options) || getHexLineSequence(fromHexId, toHexId);
    }
    return getHexLineSequence(fromHexId, toHexId);
  }

  function getRoadPathSequence(fromHexId, toHexId, options = {}) {
    const fromHex = hexForPathPoint(fromHexId);
    const toHex = hexForPathPoint(toHexId);
    if (ROAD_IMPASSABLE_WATER_TERRAINS.has(fromHex?.baseTerrain) || ROAD_IMPASSABLE_WATER_TERRAINS.has(toHex?.baseTerrain)) return null;
    return getWeightedHexPathSequence(fromHexId, toHexId, getRoadPathStepCost, roadPathHeuristic, options);
  }

  function getGeneratedPathSequence(fromHexId, toHexId, options = {}) {
    const fromHex = hexForPathPoint(fromHexId);
    const toHex = hexForPathPoint(toHexId);
    if (ROAD_IMPASSABLE_WATER_TERRAINS.has(fromHex?.baseTerrain) || ROAD_IMPASSABLE_WATER_TERRAINS.has(toHex?.baseTerrain)) return null;
    return getWeightedHexPathSequence(fromHexId, toHexId, getGeneratedPathStepCost, roadPathHeuristic, options);
  }

  function getSeaRoutePathSequence(fromHexId, toHexId, options = {}) {
    const directRoute = getWeightedHexPathSequence(fromHexId, toHexId, getSeaRouteStepCost, roadPathHeuristic, options);
    if (!directRoute?.length) return directRoute;

    const anchor = chooseSeaRouteIslandAnchor(fromHexId, toHexId, directRoute);
    if (!anchor) return directRoute;

    const firstLeg = getWeightedHexPathSequence(fromHexId, anchor.id, getSeaRouteStepCost, roadPathHeuristic, options);
    const secondLeg = getWeightedHexPathSequence(anchor.id, toHexId, getSeaRouteStepCost, roadPathHeuristic, options);
    if (!firstLeg?.length || !secondLeg?.length) return directRoute;

    const anchoredRoute = firstLeg.concat(secondLeg.slice(1));
    const maxExtraSteps = Math.max(4, Math.round(directRoute.length * 0.22));
    return anchoredRoute.length <= directRoute.length + maxExtraSteps
      ? anchoredRoute
      : directRoute;
  }

  function chooseSeaRouteIslandAnchor(fromHexId, toHexId, directRoute) {
    const fromHex = hexForPathPoint(fromHexId);
    const toHex = hexForPathPoint(toHexId);
    if (!fromHex || !toHex || directRoute.length < 5) return null;

    const dimensions = getGeneratedMapDimensions();
    return renderer.hexes
      .filter(hex => hex.id !== fromHexId && hex.id !== toHexId && isSeaRouteIslandAnchor(hex))
      .map(hex => {
        const projection = projectPointToSegment(hex.center, fromHex.center, toHex.center);
        const distance = Math.hypot(hex.center.x - projection.point.x, hex.center.y - projection.point.y);
        const roll = seededPathFloat(`sea-route-island-anchor:${fromHexId}:${toHexId}:${hex.id}`);
        return { hex, distance, t: projection.t, roll };
      })
      .filter(candidate => (
        candidate.t > 0.18 &&
        candidate.t < 0.82 &&
        candidate.distance <= dimensions.radius * 2.1 &&
        candidate.roll < 0.42
      ))
      .sort((a, b) => (
        a.distance - b.distance ||
        Math.abs(a.t - 0.5) - Math.abs(b.t - 0.5) ||
        a.roll - b.roll
      ))[0]?.hex || null;
  }

  function isSeaRouteIslandAnchor(hex) {
    if (!hex || isWaterHex(hex) || !canSeaRouteUseHex(hex)) return false;
    const waterNeighbors = EDGE_NAMES
      .map(edgeName => getNeighborHex(hex, edgeName))
      .filter(isWaterHex)
      .length;
    return waterNeighbors >= 4;
  }

  function getManualRiverPathSequence(fromHexId, toHexId) {
    renderer.drawing.manualRiverPathStartHexId = fromHexId;
    renderer.drawing.manualRiverPathGoalHexId = toHexId;
    const directSequence = getHexLineSequence(fromHexId, toHexId);
    if (getCurrentRouteMajor("river")) {
      return sequenceCrossesMajorRiverOpenWater(directSequence)
        ? getMajorTradeRiverPathSequence(fromHexId, toHexId) || getStatefulManualRiverPathSequence(fromHexId, toHexId)
        : directSequence;
    }
    if (getRiverStraightnessScale() >= 0.98) return directSequence;
    return getStatefulManualRiverPathSequence(fromHexId, toHexId);
  }

  function sequenceCrossesMajorRiverOpenWater(sequence) {
    return (sequence || []).slice(1, -1).some(hexId => isMajorRiverOpenWaterHex(hexForPathPoint(hexId)));
  }

  function isMajorRiverOpenWaterHex(hex) {
    return ["sea", "deep_sea"].includes(hex?.baseTerrain);
  }

  function getMajorTradeRiverPathSequence(fromHexId, toHexId) {
    return getWeightedHexPathSequence(fromHexId, toHexId, getMajorTradeRiverStepCost, roadPathHeuristic);
  }

  function getMajorTradeRiverStepCost(fromHex, toHex, goalHex) {
    if (!fromHex || !toHex) return Infinity;
    if (isMajorRiverOpenWaterHex(toHex) && toHex.id !== goalHex.id) return Infinity;

    const coastBias = isCoastRouteHex(toHex) ? -0.65 : 0;
    const waterCost = isRiverTradeContinuationWaterHex(toHex) ? 0.85 : 0;
    const terrainCost = getManualRiverTerrainCost(toHex);
    const slopeCost = Math.max(0, Number(toHex.elevation || 0) - Number(fromHex.elevation || 0)) * 3.5;
    const straightnessCost = getManualRiverStraightnessCost(fromHex, toHex, goalHex) * 0.65;

    return Math.max(0.25, terrainCost + waterCost + slopeCost + coastBias + straightnessCost);
  }

  function isCoastRouteHex(hex) {
    if (!hex) return false;
    if (hex.baseTerrain === "coastal_water" || hex.baseTerrain === "beach") return true;
    if (isWaterHex(hex)) return false;
    return EDGE_NAMES.some(edgeName => {
      const neighbor = getNeighborHex(hex, edgeName);
      return neighbor && ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain);
    });
  }

  function createManualRiverPathSalt(fromHexId, toHexId) {
    return `${fromHexId}:${toHexId}:${Math.random().toString(36).slice(2, 10)}`;
  }

  function getStatefulManualRiverPathSequence(fromHexId, toHexId) {
    const start = hexForPathPoint(fromHexId);
    const goal = hexForPathPoint(toHexId);
    if (!start || !goal) return null;

    const maxIterations = getManualRiverPathSearchLimit(start, goal);
    let iterations = 0;
    const startState = createManualRiverPathState(start, 0, 0);
    const startKey = manualRiverStateKey(startState);
    const open = new Set([startKey]);
    const states = new Map([[startKey, startState]]);
    const cameFrom = new Map();
    const bestCost = new Map([[startKey, 0]]);
    const estimatedTotal = new Map([[startKey, riverPathHeuristic(start, goal)]]);

    while (open.size && iterations < maxIterations) {
      iterations += 1;
      const currentKey = [...open].reduce((bestKey, candidateKey) => (
        (estimatedTotal.get(candidateKey) ?? Infinity) < (estimatedTotal.get(bestKey) ?? Infinity)
          ? candidateKey
          : bestKey
      ));
      const currentState = states.get(currentKey);
      const currentHex = currentState?.hex;
      if (!currentHex) {
        open.delete(currentKey);
        continue;
      }
      if (currentHex.id === goal.id) return reconstructManualRiverPath(cameFrom, states, currentKey);

      open.delete(currentKey);
      EDGE_NAMES.forEach(edgeName => {
        const neighbor = getNeighborHex(currentHex, edgeName);
        if (!neighbor) return;
        const transition = getManualRiverPathTransition(currentState, neighbor, goal);
        if (!transition || !Number.isFinite(transition.cost)) return;

        const nextState = transition.state;
        const nextKey = manualRiverStateKey(nextState);
        const nextCost = (bestCost.get(currentKey) ?? Infinity) + transition.cost;
        if (nextCost >= (bestCost.get(nextKey) ?? Infinity)) return;

        states.set(nextKey, nextState);
        cameFrom.set(nextKey, currentKey);
        bestCost.set(nextKey, nextCost);
        estimatedTotal.set(nextKey, nextCost + riverPathHeuristic(neighbor, goal));
        open.add(nextKey);
      });
    }

    return null;
  }

  function getManualRiverPathSearchLimit(start, goal) {
    const hexDistance = Math.max(1, getHexLineSequence(start.id, goal.id).length);
    const mapScale = Math.max(600, renderer.hexes.length);
    return Math.min(2400, Math.max(mapScale, hexDistance * 45));
  }

  function createManualRiverPathState(hex, waterRun = 0, avoidWater = 0, climbAway = 0, waterEntryHexId = "") {
    return {
      hex,
      waterRun: Math.max(0, Math.min(5, Math.round(waterRun || 0))),
      avoidWater: Math.max(0, Math.min(8, Math.round(avoidWater || 0))),
      climbAway: Math.max(0, Math.min(6, Math.round(climbAway || 0))),
      waterEntryHexId: waterEntryHexId || ""
    };
  }

  function manualRiverStateKey(state) {
    return `${state.hex.id}:${state.waterRun}:${state.avoidWater}:${state.climbAway}:${state.waterEntryHexId}`;
  }

  function reconstructManualRiverPath(cameFrom, states, currentKey) {
    const sequence = [];
    while (currentKey) {
      const state = states.get(currentKey);
      if (state?.hex?.id && sequence[0] !== state.hex.id) sequence.unshift(state.hex.id);
      currentKey = cameFrom.get(currentKey);
    }
    return sequence;
  }

  function getManualRiverPathTransition(state, toHex, goalHex, options = {}) {
    const fromHex = state.hex;
    const fromWater = isRiverTradeContinuationWaterHex(fromHex);
    const toWater = isRiverTradeContinuationWaterHex(toHex);
    const goalIsWater = isWaterHex(goalHex);
    if (isWaterHex(toHex) && !toWater && toHex.id !== goalHex.id) return null;

    if (toWater) {
      const enteringWater = !fromWater;
      const waterRun = enteringWater ? 1 : state.waterRun + 1;
      const targetRun = getManualRiverWaterRunTarget(fromHex, toHex, goalHex);
      const avoidCost = enteringWater
        ? options.generatedNaturalMode
          ? state.avoidWater * 0.55
          : state.avoidWater * 1.25 / getRiverWaterPullScale()
        : 0;
      const continuingCost = !enteringWater && state.waterRun >= targetRun ? 2.6 + (state.waterRun - targetRun) * 1.4 : 0;
      const bounceCost = enteringWater ? getManualRiverShoreBounceCost(fromHex, toHex, goalHex, options) : 0;
      const goalBonus = options.generatedNaturalMode ? 0 : goalIsWater ? -1.2 : 0;
      const straightnessCost = getManualRiverStraightnessCost(fromHex, toHex, goalHex);
      return {
        state: createManualRiverPathState(toHex, waterRun, 0, 0, enteringWater ? fromHex.id : state.waterEntryHexId),
        cost: Math.max(0.25, 0.85 + avoidCost + bounceCost + continuingCost + goalBonus + straightnessCost)
      };
    }

    const exitingWater = fromWater;
    if (exitingWater && !canManualRiverExitWaterHere(state, toHex, goalHex)) return null;
    if (exitingWater && state.waterRun < getManualRiverWaterRunTarget(fromHex, toHex, goalHex)) {
      return {
        state: createManualRiverPathState(toHex, 0, getManualRiverBounceAvoidance(fromHex, toHex, goalHex), getManualRiverClimbAwaySteps(fromHex, toHex, goalHex)),
        cost: getManualRiverLandStepCost(fromHex, toHex, goalHex, { ...options, preferUphill: true }) + 4.5
      };
    }

    return {
      state: createManualRiverPathState(
        toHex,
        0,
        exitingWater ? getManualRiverBounceAvoidance(fromHex, toHex, goalHex) : Math.max(0, state.avoidWater - 1),
        exitingWater ? getManualRiverClimbAwaySteps(fromHex, toHex, goalHex) : Math.max(0, state.climbAway - 1)
      ),
      cost: getManualRiverLandStepCost(fromHex, toHex, goalHex, {
        ...options,
        preferUphill: state.climbAway > 0 || exitingWater,
        shoreBounce: !fromWater && isNearRiverTradeContinuationWater(fromHex) && !isWaterHex(toHex)
      })
    };
  }

  function getManualRiverShoreBounceCost(fromHex, waterHex, goalHex, options = {}) {
    if (isWaterHex(goalHex)) return 0;
    const roll = seededUnit(`manual-river-shore-bounce:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex?.id || ""}:${waterHex?.id || ""}:${goalHex?.id || ""}`);
    const bounceChance = options.generatedNaturalMode
      ? Math.min(0.86, 0.5 + getRiverWildnessScale() * 0.14)
      : Math.min(0.82, 0.58 * getRiverWildnessScale() / Math.max(0.6, getRiverWaterPullScale()));
    return roll < bounceChance ? 16 * getRiverWildnessScale() : 0;
  }

  function canManualRiverExitWaterHere(state, exitHex, goalHex) {
    if (isWaterHex(goalHex) && exitHex?.id === goalHex.id) return true;
    if (!state.waterEntryHexId) return true;
    const entryHex = hexForPathPoint(state.waterEntryHexId);
    const exitDistance = entryHex && exitHex ? getHexLineSequence(entryHex.id, exitHex.id).length - 1 : 0;
    return exitDistance >= 5 || state.waterRun >= 5;
  }

  function isNearRiverTradeContinuationWater(hex) {
    return EDGE_NAMES.some(edgeName => isRiverTradeContinuationWaterHex(getNeighborHex(hex, edgeName)));
  }

  function getManualRiverWaterRunTarget(fromHex, toHex, goalHex) {
    const roll = seededUnit(`manual-river-water-run:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex?.id || ""}:${toHex?.id || ""}:${goalHex?.id || ""}`);
    return 2 + Math.floor(roll * 3);
  }

  function getManualRiverBounceAvoidance(fromHex, toHex, goalHex) {
    const roll = seededUnit(`manual-river-bounce-away:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex?.id || ""}:${toHex?.id || ""}:${goalHex?.id || ""}`);
    return 5 + Math.floor(roll * 4);
  }

  function getManualRiverClimbAwaySteps(fromHex, toHex, goalHex) {
    const roll = seededUnit(`manual-river-climb-away:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex?.id || ""}:${toHex?.id || ""}:${goalHex?.id || ""}`);
    return 3 + Math.floor(roll * 3);
  }

  function getRiverControlScale(key, fallback = 100, min = 0.25, max = 2) {
    const value = clampNumber(Number(renderer.drawing[key] ?? fallback), 0, 200, fallback);
    if (value < 100) return min * (value / 100);
    return Math.max(min, Math.min(max, ((value - 100) / 100) * max));
  }

  function getRiverWaterPullScale() {
    return getRiverControlScale("riverWaterPull", 100, 0.1, 2);
  }

  function getRiverWildnessScale() {
    return getRiverControlScale("riverWildness", 100, 0.1, 2);
  }

  function getRiverTerrainRespectScale() {
    return getRiverControlScale("riverTerrainRespect", 100, 0.1, 2);
  }

  function getRiverStraightnessScale() {
    return clampNumber(Number(renderer.drawing.riverStraightness ?? 0), 0, 100, 0) / 100;
  }

  function getManualRiverStraightnessCost(fromHex, toHex, goalHex) {
    const straightness = getRiverStraightnessScale();
    if (!straightness || !fromHex || !toHex || !goalHex) return 0;
    const startHex = hexForPathPoint(renderer.drawing.manualRiverPathStartHexId || "");
    const fromDistance = roadPathHeuristic(fromHex, goalHex);
    const toDistance = roadPathHeuristic(toHex, goalHex);
    const progress = fromDistance - toDistance;
    const progressBias = -progress * 22 * straightness;
    const noProgressPenalty = toDistance >= fromDistance ? 24 * straightness : 0;
    const lineCost = startHex
      ? pointDistanceToSegment(toHex.center, startHex.center, goalHex.center) / Math.max(1, getGeneratedMapDimensions().radius) * 18 * straightness
      : 0;
    return progressBias + noProgressPenalty + lineCost;
  }

  function getWeightedHexPathSequence(fromHexId, toHexId, getStepCost, getHeuristic, options = {}) {
    const start = hexForPathPoint(fromHexId);
    const goal = hexForPathPoint(toHexId);
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
      const current = hexForPathPoint(currentId);
      if (!current) {
        open.delete(currentId);
        continue;
      }
      if (current.id === goal.id) return reconstructRoadPath(cameFrom, current.id);

      open.delete(current.id);
      EDGE_NAMES.forEach(edgeName => {
        const neighbor = getNeighborHex(current, edgeName);
        if (!neighbor) return;
        const stepCost = getStepCost(current, neighbor, goal, start, options);
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

  function riverPathHeuristic(hex, goal) {
    return roadPathHeuristic(hex, goal) * 0.72;
  }

  function getRoadPathStepCost(fromHex, toHex, goalHex, startHex, options = {}) {
    if (ROAD_IMPASSABLE_WATER_TERRAINS.has(toHex.baseTerrain) && toHex.id !== goalHex.id) return Infinity;
    if (canRoadCrossWaterHex(fromHex) && canRoadCrossWaterHex(toHex) && toHex.id !== goalHex.id) return Infinity;

    let cost = ROAD_BASE_TERRAIN_COSTS[toHex.baseTerrain] ?? 3;
    const isMajorRoute = options.majorRoute ?? renderer.drawing.roadRouteMajor;
    if (canRoadCrossWaterHex(toHex)) {
      if (!canRoadUseOneHexWaterCrossing(fromHex, toHex, goalHex)) return Infinity;
      cost += isMajorRoute ? MAJOR_ROAD_WATER_PATH_COST : ROAD_WATER_PATH_COST;
      cost -= getRoadCrossingPoiBias(fromHex) * 0.65;
      cost -= getAdjacentRoadSoftCrossingBias(toHex) * 0.5;
      cost -= getAdjacentRoadCrossingAnchorBias(toHex) * 0.85;
    }

    cost += getRoadFeaturePathCost(toHex);
    cost += getRoadElevationPathCost(fromHex, toHex, options);
    if (options.generatedRoadMode && options.pathSalt) {
      cost += seededUnit(`${options.pathSalt}:${fromHex.id}:${toHex.id}`) * 0.55;
    }
    if (!canRoadCrossWaterHex(toHex)) {
      cost -= getRoadCrossingPoiBias(toHex);
    }
    if (hasExistingRoadSegment(fromHex.id, toHex.id)) cost *= 0.42;
    return Math.max(0.2, cost);
  }

  function getGeneratedPathStepCost(fromHex, toHex, goalHex, startHex, options = {}) {
    if (ROAD_IMPASSABLE_WATER_TERRAINS.has(toHex.baseTerrain) && toHex.id !== goalHex.id) return Infinity;
    if (canRoadCrossWaterHex(fromHex) && canRoadCrossWaterHex(toHex) && toHex.id !== goalHex.id) return Infinity;

    let cost = (ROAD_BASE_TERRAIN_COSTS[toHex.baseTerrain] ?? 3) * 0.78;
    if (canRoadCrossWaterHex(toHex)) {
      if (!canRoadUseOneHexWaterCrossing(fromHex, toHex, goalHex)) return Infinity;
      cost += ROAD_WATER_PATH_COST * 0.7;
      cost -= Math.max(getRoadCrossingPoiBias(fromHex), getAdjacentRoadSoftCrossingBias(toHex)) * 0.35;
      cost -= getAdjacentRoadCrossingAnchorBias(toHex) * 0.45;
    }
    cost += getRoadFeaturePathCost(toHex) * 0.58;
    cost += getRoadElevationPathCost(fromHex, toHex, { generatedPathMode: true }) * 0.62;
    if (options.pathSalt) {
      cost += seededUnit(`${options.pathSalt}:${fromHex.id}:${toHex.id}`) * 0.78;
    }
    if (hasExistingRoadSegment(fromHex.id, toHex.id) || hasExistingPathSegment(fromHex.id, toHex.id)) cost *= 0.52;
    return Math.max(0.25, cost);
  }

  function getManualRiverLandStepCost(fromHex, toHex, goalHex, options = {}) {
    if (!fromHex || !toHex) return Infinity;
    const goalIsWater = isWaterHex(goalHex);

    const fromElevation = Number(fromHex.elevation || 0);
    const toElevation = Number(toHex.elevation || 0);
    const climb = Math.max(0, toElevation - fromElevation);
    const descent = Math.max(0, fromElevation - toElevation);
    const steepness = Math.abs(toElevation - fromElevation);
    const flattenDescent = Boolean(options.generatedNaturalMode && options.flattenDescent && !options.preferUphill);
    const slopeCost = options.preferUphill
      ? climb * -1.15 + descent * 5.4 + steepness * 0.45
      : flattenDescent
        ? climb * 7.5 + Math.max(0, climb - 1) * 13 + (climb > 0 ? steepness * 0.65 : 0)
      : climb * 7.5 + Math.max(0, climb - 1) * 13 + steepness * 0.65 - Math.min(1.8, descent * 0.9);
    const terrainCost = getManualRiverTerrainCost(toHex);
    const waterDistance = getNearestWaterDistance(toHex, 5);
    const generatedWaterPullStrength = Math.max(0, Math.min(1, Number(options.generatedWaterPullStrength || 0)));
    const waterPull = options.generatedNaturalMode
      ? options.suppressWaterPull && generatedWaterPullStrength <= 0
        ? 0
        : Math.max(0, waterDistance - 2) * 0.12 * generatedWaterPullStrength
      : options.suppressWaterPull
      ? 0
      : goalIsWater
      ? waterDistance * -0.28
      : Math.max(0, waterDistance - 2) * 0.18 * getRiverWaterPullScale();
    const routeVariationMultiplier = options.generatedNaturalMode
      ? Math.max(0.15, Math.min(1, Number(options.routeVariationMultiplier || 1)))
      : 1;
    const routeVariation = seededUnit(`manual-river-path:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex.id}:${toHex.id}`) * 1.15 * getRiverWildnessScale() * routeVariationMultiplier;
    const shoreBounceBonus = options.shoreBounce
      ? seededUnit(`manual-river-shore-land:${renderer.drawing.manualRiverPathSalt || ""}:${fromHex.id}:${toHex.id}:${goalHex?.id || ""}`) * -2.6 * getRiverWildnessScale()
      : 0;
    const straightnessCost = getManualRiverStraightnessCost(fromHex, toHex, goalHex);

    return Math.max(0.35,
      terrainCost
      + slopeCost * getRiverTerrainRespectScale()
      + waterPull
      + routeVariation
      + shoreBounceBonus
      + straightnessCost
    );
  }

  function getManualRiverTributaryRoutes(sequence, salt = "", options = {}) {
    if (renderer.drawing.riverTributaries === false) return [];
    if (options.disable) return [];
    const sequenceSet = new Set(sequence || []);
    const avoidHexIds = options.avoidHexIds instanceof Set ? options.avoidHexIds : null;
    const maxAvoidAdjacency = Number.isFinite(Number(options.maxAvoidAdjacency))
      ? Math.max(0, Number(options.maxAvoidAdjacency))
      : Infinity;
    const usedWaterHexIds = new Set();
    const tributaries = [];
    const branchChanceMultiplier = Math.max(0.1, Number(options.branchChanceMultiplier || 1));
    const maxBranchChanceMultiplier = Math.max(0.1, Number(options.maxBranchChanceMultiplier || 1));
    const chanceGrowthMultiplier = Math.max(0.1, Number(options.chanceGrowthMultiplier || 1));
    const minBranchGap = 7 + Math.max(0, Number(options.branchGapBonus || 0));
    const maxBranchChance = 0.11 * maxBranchChanceMultiplier;
    let branchChance = Math.min(maxBranchChance, 0.025 * branchChanceMultiplier);
    let lastBranchIndex = -99;

    (sequence || []).slice(1, -1).forEach((hexId, index) => {
      const hex = hexForPathPoint(hexId);
      if (!hex || isWaterHex(hex)) return;
      if (index - lastBranchIndex < minBranchGap) {
        branchChance = Math.min(maxBranchChance, branchChance + 0.006 * chanceGrowthMultiplier);
        return;
      }

      const candidates = nearbyHexesWithin(hex, 3)
        .filter(candidate => (
          !usedWaterHexIds.has(candidate.id) &&
          !nearbyHexesWithin(candidate, 2).some(nearby => usedWaterHexIds.has(nearby.id)) &&
          !sequenceSet.has(candidate.id) &&
          isRiverTradeContinuationWaterHex(candidate)
        ))
        .map(candidate => {
          const tributarySequence = getHexLineSequence(hex.id, candidate.id);
          return {
            waterHex: candidate,
            sequence: tributarySequence,
            roll: seededUnit(`manual-river-tributary:${salt}:${hex.id}:${candidate.id}:${index}`) + getTributaryUphillPenalty(tributarySequence)
          };
        })
        .filter(candidate => (
          candidate.sequence.length >= 3 &&
          candidate.sequence.length <= 4 &&
          candidate.sequence.slice(1).every(candidateHexId => !sequenceSet.has(candidateHexId)) &&
          isManualRiverTributaryCandidateOpen(candidate.sequence, avoidHexIds, maxAvoidAdjacency)
        ))
        .sort((a, b) => (
          a.sequence.length - b.sequence.length ||
          a.roll - b.roll
        ));

      const tributary = candidates.find(candidate => candidate.roll < branchChance);
      if (tributary) {
        tributaries.push({
          sequence: tributary.sequence,
          routeMetadata: { isMajorRoute: false, routeName: "" }
        });
        usedWaterHexIds.add(tributary.waterHex.id);
        branchChance = Math.min(maxBranchChance, 0.008 * branchChanceMultiplier);
        lastBranchIndex = index;
        return;
      }

      branchChance = Math.min(maxBranchChance, branchChance + 0.009 * chanceGrowthMultiplier);
    });

    return tributaries;
  }

  function isManualRiverTributaryCandidateOpen(sequence, avoidHexIds, maxAvoidAdjacency = Infinity) {
    if (!(avoidHexIds instanceof Set) || !avoidHexIds.size || !Array.isArray(sequence) || sequence.length < 3) return true;
    const attachmentHexId = sequence[0];
    return sequence.slice(1, -1).every(hexId => {
      const hex = hexForPathPoint(hexId);
      if (!hex) return false;
      const adjacentAvoidCount = nearbyHexesWithin(hex, 1).reduce((count, neighbor) => {
        if (!neighbor?.id || neighbor.id === attachmentHexId) return count;
        return avoidHexIds.has(neighbor.id) ? count + 1 : count;
      }, 0);
      return adjacentAvoidCount <= maxAvoidAdjacency;
    });
  }

  function getManualRiverVisibleRoutes(sequence, salt = "", routeMetadata = {}) {
    if (routeMetadata.isMajorRoute || renderer.drawing.riverWetlandVanish === false) {
      return [{ sequence, routeMetadata }];
    }
    const routes = [];
    let current = [];
    let hidingWetland = false;

    (sequence || []).forEach((hexId, index) => {
      const hex = hexForPathPoint(hexId);
      const isIntermediateWetland = hex?.baseTerrain === "wetland" && index > 0 && index < sequence.length - 1;

      if (isIntermediateWetland && !hidingWetland) {
        const roll = seededUnit(`manual-river-wetland-disappear:${salt}:${hex.id}:${index}`);
        const remainingVisibleHexes = sequence.slice(index + 1).filter(candidateHexId => hexForPathPoint(candidateHexId)?.baseTerrain !== "wetland").length;
        if (roll < 0.36 && current.length >= 3 && remainingVisibleHexes >= 3) {
          routes.push({ sequence: current, routeMetadata });
          current = [];
          hidingWetland = true;
          return;
        }
      }

      if (hidingWetland) {
        if (isIntermediateWetland) return;
        hidingWetland = false;
      }

      current.push(hexId);
    });

    if (current.length >= 2) routes.push({ sequence: current, routeMetadata });
    return routes.length ? routes : [{ sequence, routeMetadata }];
  }

  function getTributaryUphillPenalty(sequence) {
    let penalty = 0;
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const fromHex = hexForPathPoint(sequence[index]);
      const toHex = hexForPathPoint(sequence[index + 1]);
      const climb = Number(toHex?.elevation || 0) - Number(fromHex?.elevation || 0);
      if (climb > 0) penalty += climb * 0.18;
    }
    return penalty;
  }

  function getManualRiverTerrainCost(hex) {
    if (!hex) return 4;
    if (isWaterHex(hex)) return 0.75;
    let cost = 1.25;
    if (["wetland", "jungle_floor", "lush_grassland", "grassland"].includes(hex.baseTerrain)) cost -= 0.35;
    if (["plains", "beach"].includes(hex.baseTerrain)) cost -= 0.15;
    if (["rock", "snow", "barrens", "bleak_barrens", "wastes", "desert", "deep_desert"].includes(hex.baseTerrain)) cost += 0.75;
    (hex.features || []).forEach(feature => {
      if (["marsh", "woods", "forest", "jungle"].includes(feature)) cost -= 0.18;
      if (feature === "ridges") cost += 0.8;
      if (["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs"].includes(feature)) cost += 8;
    });
    return Math.max(0.45, cost);
  }

  function getSeaRouteStepCost(fromHex, toHex, goalHex, startHex, options = {}) {
    if (isWaterHex(toHex)) return getSeaRouteWaterStepCost(toHex) + getSeaTradeDangerPathCost(toHex, goalHex, options);
    if (toHex.id === goalHex.id && canSeaRouteUseHex(toHex)) return 1.25;
    if (fromHex.id === startHex.id && isWaterHex(toHex)) return getSeaRouteWaterStepCost(toHex) + getSeaTradeDangerPathCost(toHex, goalHex, options);
    return Infinity;
  }

  function getSeaTradeDangerPathCost(hex, goalHex, options = {}) {
    if (!hex?.id || hex.id === goalHex?.id || !(options.seaDangerHexIds instanceof Set)) return 0;
    return options.seaDangerHexIds.has(hex.id) ? 9 : 0;
  }

  function getSeaRouteWaterStepCost(hex) {
    if (hex?.baseTerrain === "coastal_water") return 0.82;
    if (hex?.baseTerrain === "sea") return 1;
    if (hex?.baseTerrain === "inland_water") return 1.12;
    if (hex?.baseTerrain === "deep_sea") return 1.75;
    return 1.25;
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

  function getRoadElevationPathCost(fromHex, toHex, options = {}) {
    const delta = Math.abs(Number(toHex.elevation || 0) - Number(fromHex.elevation || 0));
    if (delta <= 0) return 0;
    const passDiscount = isRoadPassHex(fromHex) || isRoadPassHex(toHex) ? 0.45 : 1;
    const fromElevation = Number(fromHex.elevation || 0);
    const toElevation = Number(toHex.elevation || 0);
    const highMountainStep = Math.max(fromElevation, toElevation) >= 4 && Math.min(fromElevation, toElevation) <= 2;
    const generatedRoadPenalty = options.generatedRoadMode && highMountainStep && passDiscount >= 1
      ? delta * 3.4 + Math.max(0, delta - 2) * 4.2
      : 0;
    const generatedPathRelief = options.generatedPathMode ? 0.76 : 1;
    return ((delta * 0.8 + Math.max(0, delta - 1) * 1.35) * generatedPathRelief + generatedRoadPenalty) * passDiscount;
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

  function hasExistingPathSegment(fromHexId, toHexId) {
    return (renderer.mapOverlays || []).some(overlay => (
      overlay.Overlay_Type === "path" &&
      overlay.To_Hex_ID_Ref &&
      (
        overlay.From_Hex_ID_Ref === fromHexId && overlay.To_Hex_ID_Ref === toHexId ||
        overlay.From_Hex_ID_Ref === toHexId && overlay.To_Hex_ID_Ref === fromHexId
      )
    ));
  }

  function getAdjacentRoadSoftCrossingBias(hex) {
    if (!hex?.id) return 0;
    return nearbyHexesWithin(hex, 1).reduce((best, nearbyHex) => {
      const value = getPoisAtRoadHex(nearbyHex).reduce((poiBest, poi) => {
        const iconMeta = getPoiIconMetaForRoads(poi);
        const family = iconMeta?.family || "";
        const traits = new Set(iconMeta?.traits || []);
        const icon = String(poi?.POI_Icon || "").toLowerCase();
        const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "")
          || String(poi?.POI_Type_Value || poi?.POI_Type || "").trim().toLowerCase();
        if (type !== "resource_site" && family !== "resource_site") return poiBest;
        if (traits.has("river_or_coastal") || traits.has("settlement_adjacent") || ["docks", "fishing_camp", "lumber_mill", "farmstead", "windmill"].includes(icon)) {
          return Math.max(poiBest, 1.35);
        }
        return poiBest;
      }, 0);
      return Math.max(best, value);
    }, 0);
  }

  function getAdjacentRoadCrossingAnchorBias(hex) {
    if (!hex?.id) return 0;
    return nearbyHexesWithin(hex, 1).reduce((best, nearbyHex) => {
      const value = getPoisAtRoadHex(nearbyHex).reduce((poiBest, poi) => {
        const icon = String(poi?.POI_Icon || "").toLowerCase();
        const iconMeta = getPoiIconMetaForRoads(poi);
        const traits = new Set(iconMeta?.traits || []);
        const tags = Array.isArray(poi?.POI_Tags) ? poi.POI_Tags.map(tag => String(tag || "").toLowerCase()) : [];
        if (traits.has("river_crossing_anchor") || tags.includes("river_crossing")) {
          if (icon === "bridge_gate") return Math.max(poiBest, 2.8);
          if (icon === "bridge") return Math.max(poiBest, 2.6);
          if (icon === "ford") return Math.max(poiBest, 2.2);
          if (icon === "ferry") return Math.max(poiBest, 1.9);
          return Math.max(poiBest, 1.6);
        }
        return poiBest;
      }, 0);
      return Math.max(best, value);
    }, 0);
  }

  function selectGeneratedHex(hexId, options = {}) {
    renderer.selectedHexId = hexId;
    renderer.popupOptions = { ...options };
    selectedHexId = hexId;
    selectedHex = { setStyle() {} };
    showPopup(hexId, options);
    render();
  }

  function showPopup(hexId, options = {}) {
    const resolvedOptions = Object.keys(options || {}).length ? { ...options } : { ...(renderer.popupOptions || {}) };
    renderer.popupOptions = { ...resolvedOptions };
    renderer.popup.innerHTML = `<div class="generated-map-popup-content">${buildMobilePopupHtml?.(hexId, resolvedOptions) || ""}</div>`;
    renderer.popup.hidden = false;
    positionPopup();
  }

  function positionPopup() {
    if (!renderer.popup || renderer.popup.hidden || !renderer.selectedHexId) return;

    const hex = hexForPathPoint(renderer.selectedHexId);
    if (!hex) return;

    const point = worldToClient(hex.center);
    renderer.popup.style.left = `${point.x}px`;
    renderer.popup.style.top = `${point.y - 34}px`;
  }

  function clearSelection() {
    renderer.selectedHexId = null;
    renderer.popupOptions = {};
    if (renderer.popup) {
      renderer.popup.hidden = true;
      renderer.popup.innerHTML = "";
    }
    render();
  }

  function centerHexInView(hexId, biasForInspector = false) {
    const hex = hexForPathPoint(hexId) || renderer.hexes.find(candidate => candidate.label === hexId);
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
