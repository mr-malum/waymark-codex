(function () {
  const shared = window.CampaignGeneratedMapGeneratorShared;
  if (!shared) {
    console.error("CampaignGeneratedMapGeneratorShared must load before generated-map-generator.js.");
    return;
  }

  const {
    TERRAIN_PROFILES,
    hashNumber,
    clamp,
    getDimensions,
    neighbors,
    isWaterBase,
    nearbyWithin
  } = shared;

  const FOREST_FEATURES = new Set(["forest", "dead_trees", "jungle", "jungle_trees", "woods"]);
  const JUNGLE_FEATURES = new Set(["jungle", "jungle_trees"]);
  const MOUNTAIN_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano"]);
  const RUGGED_FEATURES = new Set(["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"]);
  const CANYON_FEATURES = new Set(["cliffs", "ridges"]);
  const WATERWAY_TERRAINS = new Set(["coastal_water", "sea", "deep_sea", "inland_water"]);
  const COASTAL_TERRAINS = new Set(["coastal_water", "sea", "deep_sea"]);
  const ARABLE_TERRAINS = new Set(["plains", "grassland", "lush_grassland"]);
  const MARSH_TERRAINS = new Set(["wetland"]);
  const DESERT_TERRAINS = new Set(["desert", "deep_desert"]);
  const ARID_VILLAGE_TERRAINS = new Set(["desert", "barrens", "bleak_barrens"]);
  const BASE_MAP_HEX_COUNT = 2500;
  const POI_BASELINE_SCALE = 1.1;
  const HARSH_TERRAINS = new Set(["deep_desert", "wastes"]);
  const BARREN_TERRAINS = new Set(["desert", "deep_desert", "barrens", "bleak_barrens", "wastes"]);
  const SITE_POI_TYPES = Object.freeze(["ruin", "holy_site", "arcane_site", "wilderness_site", "hazard", "landmark"]);
  const SITE_FAMILY_RATIO_BANDS = Object.freeze({
    holy_site: Object.freeze({ minimum: 0.16, soft: 0.24 }),
    landmark: Object.freeze({ minimum: 0.15, soft: 0.22 }),
    wilderness_site: Object.freeze({ minimum: 0.17, soft: 0.25 }),
    ruin: Object.freeze({ minimum: 0.16, soft: 0.24 }),
    arcane_site: Object.freeze({ minimum: 0.1, soft: 0.16 }),
    hazard: Object.freeze({ minimum: 0.08, soft: 0.14 })
  });
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
  const SETTLEMENT_ROLE_ORDER = Object.freeze([
    "coastal_harbor",
    "river_crossing",
    "river_settlement",
    "lake_landing",
    "pass_gate",
    "inland_node",
    "upland_node",
    "frontier_outpost"
  ]);

  const NAME_POOLS = Object.freeze({
    genericPrefixes: ["Grey", "Stone", "Oak", "Willow", "Raven", "Amber", "Lantern", "Bracken", "Gloam", "Kings", "Queens", "Crown", "Banner", "Deep", "High", "Red", "White", "Black"],
    coldPrefixes: ["Winter", "Frost", "White", "Snow", "Ice", "North", "Cold", "Hoar", "Pale", "Gale"],
    coldSuffixes: ["Burg", "Wick", "Stead", "Holm", "Gard", "Fell", "Watch"],
    coastPrefixes: ["Salt", "Wave", "Harbor", "Anchor", "Tide", "Drift", "Seabreak", "Windward", "Storm", "Brightwater"],
    riverPrefixes: ["River", "Silver", "Blue", "Clear", "Ford", "Brook", "Bridge", "Reed", "Marsh", "Willow"],
    forestPrefixes: ["Pine", "Oak", "Ash", "Yew", "Cedar", "Briar", "Green", "Wood", "Hollow", "Moss"],
    forestSuffixes: ["Wood", "Grove", "Hollow", "Holt", "Shaw", "Briar"],
    aridPrefixes: ["Sun", "Sand", "Dune", "Dust", "Dry", "Ochre", "Copper", "Amber", "Saffron", "Red"],
    wastePrefixes: ["Ash", "Bleak", "Bone", "Bitter", "Cinder", "Riven", "Scar", "Dry", "Black", "Hollow"],
    stonePrefixes: ["Stone", "Iron", "Granite", "Flint", "Crag", "High", "Gate", "Ridge", "Raven", "Blackrock"],
    stoneSuffixes: ["Crag", "Rock", "Peak", "Hold", "Gate", "Tor"],
    strongholdPrefixes: ["Stone", "Grey", "Iron", "High", "Old", "North", "South", "East", "West", "Crown", "Ward", "March", "Banner"],
    sacredPrefixes: ["Saint", "Pilgrim", "Blessed", "Sacred", "Sun", "Moon", "White", "Quiet", "Mercy", "Candle"],
    arcanePrefixes: ["Rune", "Star", "Glass", "Moon", "Aether", "Spell", "Whisper", "Veil", "Azure", "Shimmer"],
    wildPrefixes: ["Hidden", "Still", "Fell", "Mist", "Deep", "Lost", "Green", "Whispering", "Old", "Silent"]
  });

  let activeGeneratedNameUsage = null;

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
      const signalCache = new Map();
      const existingCounts = getExistingPoiCounts(existingPois);
      const landHexes = hexes.filter(isPoiLandHex);
      const landmasses = buildLandmasses(landHexes, byCoord);
      settings.countFactor = getPoiCountFactor(hexes.length);
      settings.landHexCount = landHexes.length;
      settings.significantLandmassCount = countSignificantLandmasses(landmasses, landHexes.length);
      const landmassIdByHexId = new Map();
      landmasses.forEach((landmass, index) => {
        landmass.id = `landmass-${index}`;
        landmass.hexes.forEach(hex => landmassIdByHexId.set(hex.id, landmass.id));
      });

      const existingSettlementAnchors = getExistingSettlementAnchors(existingPois, byId, byCoord, riverData, dimensions, signalCache, landmassIdByHexId);
      const existingStrongholdAnchors = getExistingStrongholdAnchors(existingPois, byId, byCoord, riverData, dimensions, signalCache, landmassIdByHexId);
      const candidateHexes = hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex));

      const settlementCandidates = candidateHexes
        .map(hex => buildSettlementCandidate(hex, byCoord, riverData, dimensions, signalCache, landmassIdByHexId))
        .filter(Boolean);
      const settlementTarget = getTargetSettlementCount(candidateHexes, settings, existingCounts.settlement);
      const settlementPlacements = chooseSettlementPlacements({
        candidates: settlementCandidates,
        targetCount: settlementTarget,
        existingAnchors: existingSettlementAnchors,
        byCoord,
        dimensions,
        settings
      });
      const provisionalSettlementAnchors = buildProvisionalSettlementAnchors(settlementPlacements, settings);
      const provisionalCorridors = buildSettlementCorridors(
        [...existingSettlementAnchors, ...provisionalSettlementAnchors],
        byId,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings
      );
      const settlementDrafts = finalizeSettlementDrafts({
        placements: settlementPlacements,
        existingAnchors: existingSettlementAnchors,
        corridors: provisionalCorridors,
        settings,
        usedNames
      });
      settlementDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));
      const placedPoiRefs = settlementDrafts.map(draft => makePlacedPoiRef(draft, byId));

      const generatedSettlementAnchors = settlementDrafts.map((draft, index) => makeGeneratedSettlementAnchor(draft, index));
      const settlementAnchors = [...existingSettlementAnchors, ...generatedSettlementAnchors];
      const corridors = buildSettlementCorridors(settlementAnchors, byId, byCoord, riverData, dimensions, signalCache, settings);
      const corridorStats = buildCorridorStats(corridors);

      const resourceDrafts = buildResourceSiteDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        occupiedHexIds,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        placedPoiRefs
      });
      resourceDrafts.forEach(draft => {
        occupiedHexIds.add(draft.hexId);
        placedPoiRefs.push(makePlacedPoiRef(draft, byId));
      });

      const waypointDrafts = buildWaypointDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        corridors,
        corridorStats,
        occupiedHexIds,
        byId,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        placedPoiRefs
      });
      waypointDrafts.forEach(draft => {
        occupiedHexIds.add(draft.hexId);
        placedPoiRefs.push(makePlacedPoiRef(draft, byId));
      });

      const strongholdDrafts = buildStrongholdDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        corridors,
        corridorStats,
        occupiedHexIds,
        byId,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        existingCount: existingCounts.stronghold,
        placedPoiRefs
      });
      strongholdDrafts.forEach(draft => {
        occupiedHexIds.add(draft.hexId);
        placedPoiRefs.push(makePlacedPoiRef(draft, byId));
      });

      const strongholdAnchors = [
        ...existingStrongholdAnchors,
        ...strongholdDrafts.map((draft, index) => makeGeneratedStrongholdAnchor(draft, index, byId))
      ];

      const dungeonComplexDrafts = buildDungeonDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        corridorStats,
        occupiedHexIds,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        targetCount: getTargetDungeonComplexCount(candidateHexes, settings, existingCounts.dungeon_complex),
        complex: true,
        placedPoiRefs
      });
      dungeonComplexDrafts.forEach(draft => {
        occupiedHexIds.add(draft.hexId);
        placedPoiRefs.push(makePlacedPoiRef(draft, byId));
      });

      const dungeonDrafts = buildDungeonDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        corridorStats,
        occupiedHexIds,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        targetCount: getTargetDungeonCount(candidateHexes, settings, existingCounts.dungeon),
        complex: false,
        placedPoiRefs
      });
      dungeonDrafts.forEach(draft => {
        occupiedHexIds.add(draft.hexId);
        placedPoiRefs.push(makePlacedPoiRef(draft, byId));
      });

      const siteDrafts = buildSiteDrafts({
        candidateHexes: hexes.filter(hex => !occupiedHexIds.has(hex.id) && isPoiLandHex(hex)),
        settlementAnchors,
        strongholdAnchors,
        corridorStats,
        occupiedHexIds,
        byCoord,
        riverData,
        dimensions,
        signalCache,
        settings,
        usedNames,
        targetCount: getTargetSiteCount(candidateHexes, settings, existingCounts.site),
        placedPoiRefs
      });

      return [
        ...settlementDrafts,
        ...resourceDrafts,
        ...waypointDrafts,
        ...strongholdDrafts,
        ...dungeonComplexDrafts,
        ...dungeonDrafts,
        ...siteDrafts
      ].map(({ meta, ...draft }) => draft);
    } finally {
      activeGeneratedNameUsage = null;
    }
  }

  function buildPoiRiverData(overlays) {
    const riverHexIds = new Set();
    const degreeByHexId = new Map();
    const neighborsByHexId = new Map();
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
          if (!neighborsByHexId.has(fromHexId)) neighborsByHexId.set(fromHexId, new Set());
          if (!neighborsByHexId.has(toHexId)) neighborsByHexId.set(toHexId, new Set());
          neighborsByHexId.get(fromHexId).add(toHexId);
          neighborsByHexId.get(toHexId).add(fromHexId);
        }
      });
    return { riverHexIds, degreeByHexId, neighborsByHexId };
  }

  function getExistingPoiCounts(existingPois) {
    const counts = {
      settlement: 0,
      resource_site: 0,
      waypoint: 0,
      stronghold: 0,
      dungeon: 0,
      dungeon_complex: 0,
      site: 0
    };
    (existingPois || []).forEach(poi => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type === "settlement") counts.settlement += 1;
      else if (type === "resource_site") counts.resource_site += 1;
      else if (type === "waypoint") counts.waypoint += 1;
      else if (type === "stronghold") counts.stronghold += 1;
      else if (type === "dungeon") counts.dungeon += 1;
      else if (type === "dungeon_complex") counts.dungeon_complex += 1;
      else if (SITE_POI_TYPES.includes(type)) counts.site += 1;
    });
    return counts;
  }

  function getExistingSettlementAnchors(existingPois, byId, byCoord, riverData, dimensions, signalCache, landmassIdByHexId) {
    const anchors = [];
    (existingPois || []).forEach((poi, index) => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type !== "settlement") return;
      const hex = byId.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
      const population = parsePopulationNumber(poi?.Population);
      const icon = window.CampaignPoiIcons?.getStoredIconValue?.(poi?.POI_Icon || "") || "";
      const majorTrait = window.CampaignPoiIcons?.iconHasTrait?.(icon, "major");
      const importance = clamp(
        (population ? Math.min(1.1, population / 18000) : 0.32)
        + (majorTrait ? 0.22 : 0)
        + (signals.coastal ? 0.06 : 0)
        + (signals.crossingPotential >= 0.55 ? 0.05 : 0),
        0.35,
        1.5,
        0.55
      );
      anchors.push({
        id: poi?.POI_ID || `existing-settlement-${index}`,
        hex,
        name: String(poi?.Name || "").trim() || "Settlement",
        importance,
        population: poi?.Population || "",
        notoriety: window.CampaignPoiTypes?.getStoredNotorietyValue?.(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"] || "") || "7",
        role: inferExistingSettlementRole(icon, signals),
        landmassId: landmassIdByHexId.get(hex.id) || ""
      });
    });
    return anchors;
  }

  function inferExistingSettlementRole(icon, signals) {
    if (icon === "port_town" || signals.coastal) return "coastal_harbor";
    if (signals.passStrength >= 0.62) return "pass_gate";
    if (signals.crossingPotential >= 0.58) return "river_crossing";
    if (signals.riverAccess) return "river_settlement";
    if (signals.lakeAccess) return "lake_landing";
    if (signals.mountainAffinity >= 0.78) return "upland_node";
    return "inland_node";
  }

  function getExistingStrongholdAnchors(existingPois, byId, byCoord, riverData, dimensions, signalCache, landmassIdByHexId) {
    const anchors = [];
    (existingPois || []).forEach((poi, index) => {
      const type = window.CampaignPoiTypes?.getStoredTypeValue?.(poi?.POI_Type_Value || poi?.POI_Type || "") || "";
      if (type !== "stronghold") return;
      const hex = byId.get(poi?.Hex_ID_Ref || "");
      if (!hex) return;
      const icon = window.CampaignPoiIcons?.getStoredIconValue?.(poi?.POI_Icon || "") || "";
      getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
      anchors.push({
        id: poi?.POI_ID || `existing-stronghold-${index}`,
        hex,
        name: String(poi?.Name || "").trim() || "Stronghold",
        icon,
        importance: getStrongholdAnchorImportance(icon),
        landmassId: landmassIdByHexId.get(hex.id) || ""
      });
    });
    return anchors;
  }

  function getPoiCountFactor(totalHexCount) {
    return clamp(Number(totalHexCount || 0) / BASE_MAP_HEX_COUNT, 0.2, 24, 1);
  }

  function getScaledPoiCap(baseCap, settings, minimum = 0) {
    const factor = Math.max(0.2, Number(settings?.countFactor || 1));
    return Math.max(minimum, Math.round(baseCap * factor * POI_BASELINE_SCALE));
  }

  function countSignificantLandmasses(landmasses, landHexCount) {
    if (!Array.isArray(landmasses) || !landmasses.length) return 0;
    const minimumHexes = Math.max(18, Math.round(Math.max(1, landHexCount) * 0.03));
    return landmasses.filter(landmass => Array.isArray(landmass?.hexes) && landmass.hexes.length >= minimumHexes).length;
  }

  function getTargetSettlementCount(candidateHexes, settings, existingCount = 0) {
    const viableCount = candidateHexes.filter(isViableSettlementHex).length;
    const scaledCap = getScaledPoiCap(40, settings, 0);
    const baseTarget = Math.round((viableCount / 72) * settings.settlementDensity * POI_BASELINE_SCALE);
    const landmassFloor = settings.settlementDensity > 0
      ? Math.round((settings.significantLandmassCount || 0) * settings.settlementDensity)
      : 0;
    const totalTarget = Math.max(0, Math.min(scaledCap, Math.max(baseTarget, landmassFloor)));
    return Math.max(0, totalTarget - Math.max(0, existingCount));
  }

  function getTargetResourceSiteCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const totalTarget = settlementAnchors.length
      ? Math.round(settlementAnchors.length * 1.05 * settings.resourceAmount * POI_BASELINE_SCALE)
      : Math.round(candidateHexes.length / 96 * settings.resourceAmount * POI_BASELINE_SCALE);
    return Math.max(0, Math.min(getScaledPoiCap(32, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function getTargetWaypointCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const totalTarget = settlementAnchors.length >= 2
      ? Math.round(settlementAnchors.length * 1.0 * settings.waypointAmount * POI_BASELINE_SCALE)
      : Math.round(candidateHexes.length / 120 * settings.waypointAmount * POI_BASELINE_SCALE);
    return Math.max(0, Math.min(getScaledPoiCap(24, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function getTargetStrongholdCount(candidateHexes, settlementAnchors, settings, existingCount = 0) {
    const terrainTarget = Math.round((candidateHexes.length / 220) * settings.strongholdAmount * POI_BASELINE_SCALE);
    const settlementTarget = settlementAnchors.length
      ? Math.round(settlementAnchors.length * 0.22 * settings.strongholdAmount * POI_BASELINE_SCALE)
      : 0;
    const totalTarget = Math.max(terrainTarget, settlementTarget);
    return Math.max(0, Math.min(getScaledPoiCap(12, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function getTargetDungeonComplexCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 720) * settings.dungeonComplexAmount * POI_BASELINE_SCALE);
    return Math.max(0, Math.min(getScaledPoiCap(4, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function getTargetDungeonCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 260) * settings.dungeonAmount * POI_BASELINE_SCALE);
    return Math.max(0, Math.min(getScaledPoiCap(10, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function getTargetSiteCount(candidateHexes, settings, existingCount = 0) {
    const totalTarget = Math.round((candidateHexes.length / 76) * settings.siteAmount * POI_BASELINE_SCALE);
    return Math.max(0, Math.min(getScaledPoiCap(24, settings, 0), totalTarget) - Math.max(0, existingCount));
  }

  function buildLandmasses(landHexes, byCoord) {
    const candidates = Array.isArray(landHexes) ? landHexes.filter(Boolean) : [];
    const allowedIds = new Set(candidates.map(hex => hex.id));
    const visited = new Set();
    const groups = [];
    candidates.forEach(hex => {
      if (!hex?.id || visited.has(hex.id)) return;
      const stack = [hex];
      const group = [];
      visited.add(hex.id);
      while (stack.length) {
        const current = stack.pop();
        group.push(current);
        neighbors(current, byCoord).forEach(neighbor => {
          if (!neighbor?.id || visited.has(neighbor.id) || !allowedIds.has(neighbor.id)) return;
          visited.add(neighbor.id);
          stack.push(neighbor);
        });
      }
      groups.push({ hexes: group });
    });
    return groups.sort((left, right) => right.hexes.length - left.hexes.length);
  }

  function chooseSettlementPlacements({ candidates, targetCount, existingAnchors, byCoord, dimensions, settings }) {
    if (!Array.isArray(candidates) || !candidates.length || targetCount <= 0) return [];
    const provinces = buildSettlementProvinces(candidates, targetCount, existingAnchors, byCoord, settings);
    const quotas = buildSettlementProvinceQuotas(provinces, targetCount);
    const selections = [];

    provinces
      .slice()
      .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
      .forEach(province => {
        const quota = quotas.get(province.id) || 0;
        if (quota <= 0) return;
        const provinceSelections = chooseProvinceSettlementCandidates(province, quota, selections, existingAnchors, settings);
        if (provinceSelections.length < quota) {
          const fallbackChosenIds = new Set([
            ...selections.map(candidate => candidate.hex.id),
            ...provinceSelections.map(candidate => candidate.hex.id)
          ]);
          const fallbackCandidates = province.candidates
            .filter(candidate => !fallbackChosenIds.has(candidate.hex.id))
            .map(candidate => {
              const seedDistance = hexDistance(candidate.hex, province.seedHex);
              const spacingPenalty = getSettlementSpacingPenalty(candidate.hex, [...selections, ...provinceSelections], existingAnchors);
              const preferencePenalty = getSettlementPreferencePenalty(candidate, [...selections, ...provinceSelections]);
              return {
                candidate,
                seedDistance,
                score: candidate.score
                  - spacingPenalty * 0.52
                  - preferencePenalty * 0.3
                  - Math.max(0, seedDistance - 3) * 0.08
              };
            })
            .sort((left, right) => left.seedDistance - right.seedDistance || right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id));
          while (provinceSelections.length < quota && fallbackCandidates.length) {
            const next = fallbackCandidates.shift();
            if (!next) break;
            provinceSelections.push(next.candidate);
          }
        }
        provinceSelections.forEach((candidate, index) => {
          candidate.provinceId = province.id;
          candidate.provinceWeight = province.weight;
          candidate.provinceSeat = index === 0;
          candidate.provinceRank = index;
          selections.push(candidate);
        });
      });

    if (selections.length < targetCount) {
      const chosenIds = new Set(selections.map(candidate => candidate.hex.id));
      const leftovers = candidates
        .filter(candidate => !chosenIds.has(candidate.hex.id))
        .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
      while (selections.length < targetCount) {
        const best = leftovers
          .map(candidate => ({
            candidate,
            score: candidate.score
              - getSettlementSpacingPenalty(candidate.hex, selections, existingAnchors)
              - getSettlementPreferencePenalty(candidate, selections)
          }))
          .filter(entry => entry.score >= 0.18)
          .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
        if (!best) break;
        leftovers.splice(leftovers.findIndex(entry => entry.hex.id === best.candidate.hex.id), 1);
        best.candidate.provinceId = best.candidate.provinceId || `spill-${best.candidate.landmassId || "local"}`;
        best.candidate.provinceWeight = best.candidate.provinceWeight || best.candidate.score;
        best.candidate.provinceSeat = false;
        best.candidate.provinceRank = 99;
        selections.push(best.candidate);
      }
    }

    const minSpacing = Math.max(4, Math.min(8, Math.round(Math.sqrt(Math.max(1, candidates.length) / Math.max(1, targetCount)))));
    return rebalanceSettlementPlacements(selections, candidates, existingAnchors, minSpacing);
  }

  function rebalanceSettlementPlacements(selections, candidates, existingAnchors, minSpacing = 4) {
    if (!Array.isArray(selections) || selections.length < 2) return selections || [];
    const selectedIds = new Set(selections.map(candidate => candidate.hex.id));
    const pool = (candidates || [])
      .filter(candidate => !selectedIds.has(candidate.hex.id))
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
    const orderedSelections = [...selections].sort((left, right) => {
      const leftWeight = (left.provinceSeat ? 0.2 : 0) + (left.provinceWeight || left.score || 0);
      const rightWeight = (right.provinceSeat ? 0.2 : 0) + (right.provinceWeight || right.score || 0);
      return rightWeight - leftWeight || right.score - left.score || left.hex.id.localeCompare(right.hex.id);
    });
    const kept = [];

    orderedSelections.forEach(candidate => {
      const tooClose = kept.some(existing => hexDistance(candidate.hex, existing.hex) < minSpacing);
      if (!tooClose) {
        kept.push(candidate);
        return;
      }
      const replacement = pool
        .map(option => ({
          option,
          score: option.score
            - getSettlementPreferencePenalty(option, kept) * 0.9
            - getSettlementSpacingPenalty(option.hex, kept, existingAnchors) * 0.4
            + (option.provinceId === candidate.provinceId ? 0.12 : 0)
        }))
        .filter(entry => !kept.some(existing => hexDistance(entry.option.hex, existing.hex) < minSpacing))
        .sort((left, right) => right.score - left.score || left.option.hex.id.localeCompare(right.option.hex.id))[0];
      if (replacement) {
        const replacementIndex = pool.findIndex(option => option.hex.id === replacement.option.hex.id);
        if (replacementIndex >= 0) pool.splice(replacementIndex, 1);
        const nextCandidate = replacement.option;
        nextCandidate.provinceId = candidate.provinceId;
        nextCandidate.provinceWeight = candidate.provinceWeight || nextCandidate.provinceWeight;
        nextCandidate.provinceSeat = candidate.provinceSeat;
        nextCandidate.provinceRank = candidate.provinceRank;
        kept.push(nextCandidate);
        return;
      }
      kept.push(candidate);
    });

    enforceSettlementMixCap(kept, pool, existingAnchors, minSpacing, candidate => candidate?.coastal, Math.max(1, Math.round(kept.length * 0.28)));
    enforceSettlementMixCap(kept, pool, existingAnchors, minSpacing, isWarmPreferredSettlementCandidate, Math.max(2, Math.round(kept.length * 0.45)));
    return kept;
  }

  function enforceSettlementMixCap(selections, pool, existingAnchors, minSpacing, predicate, maxCount) {
    if (!Array.isArray(selections) || !Array.isArray(pool) || typeof predicate !== "function") return;
    while (selections.filter(predicate).length > maxCount) {
      const replaceEntry = selections
        .map((candidate, index) => ({ candidate, index }))
        .filter(entry => predicate(entry.candidate))
        .sort((left, right) => {
          const leftSeat = left.candidate.provinceSeat ? 1 : 0;
          const rightSeat = right.candidate.provinceSeat ? 1 : 0;
          const leftWeight = left.candidate.provinceWeight || left.candidate.score || 0;
          const rightWeight = right.candidate.provinceWeight || right.candidate.score || 0;
          return leftSeat - rightSeat || leftWeight - rightWeight || left.candidate.score - right.candidate.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id);
        })[0];
      if (!replaceEntry) break;
      const replacementEntry = pool
        .map(candidate => ({
          candidate,
          score: candidate.score
            - getSettlementPreferencePenalty(candidate, selections) * 0.7
            - getSettlementSpacingPenalty(candidate.hex, selections.filter((_, index) => index !== replaceEntry.index), existingAnchors) * 0.28
        }))
        .filter(entry => !predicate(entry.candidate))
        .filter(entry => selections.every((candidate, index) => index === replaceEntry.index || hexDistance(entry.candidate.hex, candidate.hex) >= minSpacing))
        .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
      if (!replacementEntry) break;
      const replacementIndex = pool.findIndex(candidate => candidate.hex.id === replacementEntry.candidate.hex.id);
      if (replacementIndex < 0) break;
      const [replacement] = pool.splice(replacementIndex, 1);
      replacement.provinceSeat = replaceEntry.candidate.provinceSeat;
      replacement.provinceRank = replaceEntry.candidate.provinceRank;
      replacement.provinceWeight = Math.max(replacement.provinceWeight || 0, replaceEntry.candidate.provinceWeight || 0);
      pool.push(replaceEntry.candidate);
      selections[replaceEntry.index] = replacement;
    }
  }

  function buildSettlementProvinces(candidates, targetCount, existingAnchors, byCoord, settings) {
    const candidateByHexId = new Map(candidates.map(candidate => [candidate.hex.id, candidate]));
    const candidateLandmasses = buildLandmasses(
      [...byCoord.values()].filter(isPoiLandHex),
      byCoord
    );
    const desiredProvinceCount = Math.max(1, Math.min(targetCount, candidates.length));
    const provinceSlotsByLandmass = allocateProvinceSlots(candidateLandmasses, desiredProvinceCount, candidateByHexId, existingAnchors);
    const provinces = [];

    candidateLandmasses.forEach((landmass, landmassIndex) => {
      const landmassCandidates = landmass.hexes
        .map(hex => candidateByHexId.get(hex.id))
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
      const provinceSlotCount = provinceSlotsByLandmass.get(landmassIndex) || 0;
      if (!landmassCandidates.length || provinceSlotCount <= 0) return;
      const seeds = chooseSettlementProvinceSeeds(landmassCandidates, provinceSlotCount, settings);
      const seedMap = new Map(seeds.map(seed => [seed.hex.id, {
        id: `province-${seed.hex.id}`,
        landmassId: seed.landmassId || `landmass-${landmassIndex}`,
        seedHex: seed.hex,
        candidates: [],
        existingSettlementCount: 0,
        weight: seed.score
      }]));
      landmassCandidates.forEach(candidate => {
        const province = seeds
          .map(seed => ({
            province: seedMap.get(seed.hex.id),
            distance: hexDistance(candidate.hex, seed.hex)
          }))
          .sort((left, right) => left.distance - right.distance || right.province.weight - left.province.weight)[0]?.province;
        if (province) {
          candidate.provinceId = province.id;
          candidate.landmassId = province.landmassId;
          province.candidates.push(candidate);
        }
      });

      existingAnchors.forEach(anchor => {
        if (!anchor?.hex?.id) return;
        const nearest = seeds
          .map(seed => ({ seed, distance: hexDistance(anchor.hex, seed.hex) }))
          .sort((left, right) => left.distance - right.distance || left.seed.hex.id.localeCompare(right.seed.hex.id))[0];
        if (!nearest) return;
        const province = seedMap.get(nearest.seed.hex.id);
        if (province) province.existingSettlementCount += 1;
      });

      [...seedMap.values()].forEach(province => {
        province.candidates.sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
        const topScores = province.candidates.slice(0, 4).map(candidate => candidate.score);
        const averageTopScore = topScores.reduce((sum, value) => sum + value, 0) / Math.max(1, topScores.length);
        province.hexCount = province.candidates.length;
        province.weight = province.candidates[0].score * 0.56
          + averageTopScore * 0.28
          + Math.min(0.32, Math.sqrt(province.hexCount) * 0.032)
          + (province.existingSettlementCount ? 0.04 : 0);
        province.cap = 1
          + (province.hexCount >= 70 ? 1 : 0)
          + (province.hexCount >= 150 && province.weight >= 0.94 && targetCount >= 14 ? 1 : 0);
        provinces.push(province);
      });
    });

    return provinces;
  }

  function allocateProvinceSlots(landmasses, desiredProvinceCount, candidateByHexId, existingAnchors) {
    const slots = new Map();
    if (!Array.isArray(landmasses) || !landmasses.length || desiredProvinceCount <= 0) return slots;
    const weights = landmasses.map((landmass, index) => {
      const candidates = landmass.hexes.map(hex => candidateByHexId.get(hex.id)).filter(Boolean);
      const topScore = candidates[0]?.score || 0;
      const averageTop = candidates.slice(0, 4).reduce((sum, candidate) => sum + candidate.score, 0) / Math.max(1, Math.min(4, candidates.length));
      const existingCount = existingAnchors.filter(anchor => anchor?.landmassId === `landmass-${index}`).length;
      return {
        index,
        weight: Math.max(0.12, topScore * 0.56 + averageTop * 0.22 + Math.sqrt(Math.max(1, candidates.length)) * 0.03 + existingCount * 0.03)
      };
    });
    let assigned = 0;
    weights.forEach(entry => {
      if (assigned >= desiredProvinceCount) return;
      slots.set(entry.index, 1);
      assigned += 1;
    });
    while (assigned < desiredProvinceCount) {
      const best = weights
        .map(entry => ({
          entry,
          score: entry.weight / (1 + (slots.get(entry.index) || 0))
        }))
        .sort((left, right) => right.score - left.score || left.entry.index - right.entry.index)[0];
      if (!best) break;
      slots.set(best.entry.index, (slots.get(best.entry.index) || 0) + 1);
      assigned += 1;
    }
    return slots;
  }

  function chooseSettlementProvinceSeeds(candidates, count, settings) {
    if (!Array.isArray(candidates) || !candidates.length || count <= 0) return [];
    const sorted = [...candidates].sort((left, right) => (
      right.score - left.score ||
      seededUnit(`${settings.seed}:province-seed:${left.hex.id}`) - seededUnit(`${settings.seed}:province-seed:${right.hex.id}`)
    ));
    const seeds = [sorted[0]];
    const maxCoastalSeeds = count >= 6 ? 2 : 1;
    const maxWarmSeeds = Math.max(1, Math.round(count * 0.4));
    const minSeedDistance = Math.max(4, Math.min(8, Math.round(Math.sqrt(Math.max(1, candidates.length) / Math.max(1, count)))));
    while (seeds.length < count) {
      const unchosen = sorted.filter(candidate => !seeds.some(seed => seed.hex.id === candidate.hex.id));
      const coastalSeedCount = seeds.filter(seed => seed?.coastal || seed?.primaryRole === "coastal_harbor").length;
      const warmSeedCount = seeds.filter(isWarmPreferredSettlementCandidate).length;
      const preferredPool = unchosen.filter(candidate => {
        if (candidate.coastal && coastalSeedCount >= maxCoastalSeeds) return false;
        if (isWarmPreferredSettlementCandidate(candidate) && warmSeedCount >= maxWarmSeeds) return false;
        return true;
      });
      const seedPool = preferredPool.length ? preferredPool : unchosen;
      const spreadPool = seedPool.filter(candidate => seeds.every(seed => hexDistance(candidate.hex, seed.hex) >= minSeedDistance));
      const finalPool = spreadPool.length ? spreadPool : seedPool;
      const best = finalPool
        .map(candidate => {
          const minDistance = seeds.reduce((bestDistance, seed) => Math.min(bestDistance, hexDistance(candidate.hex, seed.hex)), Infinity);
          const preferencePenalty = getSettlementPreferencePenalty(candidate, seeds);
          const duplicateRoleCount = seeds.filter(seed => seed?.primaryRole === candidate.primaryRole).length;
          const coastalSeedPenalty = candidate.coastal && coastalSeedCount > 0 ? coastalSeedCount * 4.2 : 0;
          const duplicateRolePenalty = duplicateRoleCount > 0
            ? duplicateRoleCount * (candidate.primaryRole === "coastal_harbor" ? 3.4 : 1.2)
            : 0;
          return {
            candidate,
            score: minDistance * 0.7
              + candidate.score * 5.6
              + candidate.routeability * 0.68
              + candidate.waterAccess * 0.42
              - preferencePenalty * 3.2
              - coastalSeedPenalty
              - duplicateRolePenalty
          };
        })
        .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
      if (!best) break;
      seeds.push(best.candidate);
    }
    return seeds;
  }

  function buildSettlementProvinceQuotas(provinces, targetCount) {
    const quotas = new Map();
    if (!Array.isArray(provinces) || !provinces.length || targetCount <= 0) return quotas;
    let assigned = 0;
    provinces
      .slice()
      .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
      .forEach(province => {
        if (assigned >= targetCount) return;
        if (province.existingSettlementCount > 0) return;
        quotas.set(province.id, 1);
        assigned += 1;
      });

    if (!assigned) {
      provinces
        .slice()
        .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
        .forEach(province => {
          if (assigned >= targetCount) return;
          quotas.set(province.id, 1);
          assigned += 1;
        });
    }

    while (assigned < targetCount) {
      const best = provinces
        .map(province => {
          const current = quotas.get(province.id) || 0;
          if (current >= province.cap) return null;
          return {
            province,
            score: province.weight / Math.pow(1 + current + province.existingSettlementCount * 0.7, 1.35)
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || left.province.id.localeCompare(right.province.id))[0];
      if (!best) break;
      quotas.set(best.province.id, (quotas.get(best.province.id) || 0) + 1);
      assigned += 1;
    }

    return quotas;
  }

  function chooseProvinceSettlementCandidates(province, quota, globalSelections, existingAnchors, settings) {
    const selections = [];
    const usedRoles = new Set();
    const pool = [...(province?.candidates || [])];
    while (selections.length < quota) {
      const best = pool
        .map(candidate => {
          const roleScore = candidate.roleScores[candidate.primaryRole] || candidate.score;
          const seedDistance = hexDistance(candidate.hex, province.seedHex);
          const seatBias = selections.length === 0 ? candidate.provinceSeatScore : 0;
          const seedDistancePenalty = selections.length === 0
            ? Math.max(0, seedDistance - 2) * 0.18
            : Math.max(0, seedDistance - 4) * 0.05;
          const roleDiversity = usedRoles.has(candidate.primaryRole) ? -0.05 : 0.07;
          const spacingPenalty = getSettlementSpacingPenalty(candidate.hex, [...globalSelections, ...selections], existingAnchors);
          const preferencePenalty = getSettlementPreferencePenalty(candidate, [...globalSelections, ...selections]);
          const seededBias = seededNoise(`${settings.seed}:settlement-pick:${province.id}:${candidate.hex.id}:${selections.length}`, -0.02, 0.03);
          return {
            candidate,
            score: candidate.score + roleScore * 0.22 + seatBias + roleDiversity + seededBias - seedDistancePenalty - spacingPenalty - preferencePenalty
          };
        })
        .filter(entry => entry.score >= 0.18)
        .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
      if (!best) break;
      selections.push(best.candidate);
      usedRoles.add(best.candidate.primaryRole);
      pool.splice(pool.findIndex(candidate => candidate.hex.id === best.candidate.hex.id), 1);
    }
    return selections;
  }

  function buildProvisionalSettlementAnchors(placements, settings) {
    return (placements || []).map((candidate, index) => ({
      id: `provisional-settlement-${index}:${candidate.hex.id}`,
      hex: candidate.hex,
      importance: clamp(0.48 + candidate.score * 0.8 + (candidate.provinceSeat ? 0.08 : 0), 0.42, 1.18, 0.6),
      name: "",
      role: candidate.primaryRole,
      provinceId: candidate.provinceId,
      landmassId: candidate.landmassId || ""
    }));
  }

  function finalizeSettlementDrafts({ placements, existingAnchors, corridors, settings, usedNames }) {
    const generatedAnchors = buildProvisionalSettlementAnchors(placements, settings);
    const networkScores = buildSettlementNetworkScores(generatedAnchors, corridors);
    const sortedPlacements = [...placements]
      .map((candidate, index) => ({
        candidate,
        index,
        hierarchyScore: (networkScores.get(generatedAnchors[index].id) || 0) * 0.5
          + candidate.routeability * 0.12
          + candidate.waterAccess * 0.08
          + candidate.shelter * 0.08
          + candidate.prominence * 0.06
          + candidate.resourceDiversity * 0.06
          + candidate.score * 0.06
          + (candidate.primaryRole === "coastal_harbor" || candidate.primaryRole === "river_crossing" ? 0.06 : 0)
          + (candidate.provinceSeat ? 0.08 : 0)
      }))
      .sort((left, right) => right.hierarchyScore - left.hierarchyScore || left.candidate.hex.id.localeCompare(right.candidate.hex.id));
    const totalCombined = Math.max(1, placements.length + existingAnchors.length);
    const grandHubSlots = totalCombined >= 10
      ? Math.min(getScaledPoiCap(1, settings, 1), Math.max(1, Math.round(totalCombined / 18)))
      : 0;
    const citySlots = Math.max(1, Math.min(getScaledPoiCap(4, settings, 1), Math.round(Math.max(1, placements.length) * 0.18)));
    const townSlots = Math.max(2, Math.min(placements.length, Math.round(Math.max(1, placements.length) * 0.52)));
    let cityUsed = 0;
    let townUsed = 0;
    let grandHubUsed = 0;

    return sortedPlacements.map((entry, sortedIndex) => {
      const candidate = entry.candidate;
      const sizeTier = grandHubUsed < grandHubSlots && sortedIndex === 0
        ? (grandHubUsed += 1, "grand_hub")
        : candidate.provinceSeat && cityUsed < citySlots
          ? (cityUsed += 1, "city")
          : candidate.provinceSeat || townUsed < townSlots
            ? (townUsed += 1, "town")
            : "village";
      const populationValue = generateSettlementPopulation(sizeTier, candidate, settings, entry.hierarchyScore);
      const icon = chooseSettlementIcon(candidate, sizeTier, populationValue);
      const tags = getGeneratedSettlementTags(candidate, sizeTier, icon);
      const notoriety = getGeneratedSettlementNotoriety(sizeTier, candidate, populationValue);
      const name = reserveGeneratedName(
        generateSettlementName(candidate, sizeTier, settings),
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
        population: formatGeneratedPopulation(populationValue),
        lore: "",
        meta: {
          hex: { ...candidate.hex },
          importance: getSettlementImportanceFromTier(sizeTier, populationValue),
          role: candidate.primaryRole,
          provinceId: candidate.provinceId
        }
      };
    });
  }

  function buildSettlementNetworkScores(generatedAnchors, corridors) {
    const scores = new Map(generatedAnchors.map(anchor => [anchor.id, 0]));
    (corridors || []).forEach(corridor => {
      const strength = corridor.importance * (corridor.length >= 10 ? 1.05 : 0.9);
      if (scores.has(corridor.from.id)) scores.set(corridor.from.id, (scores.get(corridor.from.id) || 0) + strength);
      if (scores.has(corridor.to.id)) scores.set(corridor.to.id, (scores.get(corridor.to.id) || 0) + strength);
    });
    const maxScore = Math.max(0.1, ...scores.values());
    scores.forEach((value, key) => scores.set(key, value / maxScore));
    return scores;
  }

  function makeGeneratedSettlementAnchor(draft, index) {
    return {
      id: `generated-settlement-${index}:${draft.hexId}`,
      hex: draft.meta?.hex ? { ...draft.meta.hex } : { id: draft.hexId },
      importance: draft.meta?.importance || 0.55,
      name: draft.name,
      population: draft.population,
      role: draft.meta?.role || "inland_node",
      provinceId: draft.meta?.provinceId || ""
    };
  }

  function makePlacedPoiRef(draft, byId) {
    const hex = draft?.meta?.hex ? { ...draft.meta.hex } : byId.get(draft?.hexId || "");
    if (!hex?.id) return null;
    return {
      hex,
      type: draft?.type || "",
      icon: draft?.icon || ""
    };
  }

  function buildSettlementCorridors(anchors, byId, byCoord, riverData, dimensions, signalCache, settings) {
    if (!Array.isArray(anchors) || anchors.length < 2) return [];
    const pairCandidates = [];
    const seenKeys = new Set();
    anchors.forEach((anchor, index) => {
      const nearest = anchors
        .filter((_, otherIndex) => otherIndex !== index)
        .map(other => ({
          anchor,
          other,
          distance: hexDistance(anchor.hex, other.hex)
        }))
        .filter(candidate => candidate.distance >= 4 && candidate.distance <= 22)
        .sort((left, right) => left.distance - right.distance || (right.other.importance || 0) - (left.other.importance || 0))
        .slice(0, 4);
      nearest.forEach(candidate => {
        const key = [candidate.anchor.id, candidate.other.id].sort().join(":");
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const pathInfo = findPoiLandPathDetailed(candidate.anchor.hex.id, candidate.other.hex.id, byId, byCoord, riverData, dimensions, signalCache);
        if (!pathInfo || !Array.isArray(pathInfo.sequence) || pathInfo.sequence.length < 4) return;
        const interProvince = String(candidate.anchor.provinceId || "") && String(candidate.other.provinceId || "") && candidate.anchor.provinceId !== candidate.other.provinceId ? 0.16 : 0;
        const pairImportance = clamp(
          Math.min(1.4, (candidate.anchor.importance || 0.5) * 0.58 + (candidate.other.importance || 0.5) * 0.58)
          + interProvince
          + (pathInfo.pathSignals.riverCrossings ? 0.04 : 0)
          + (pathInfo.pathSignals.passHexIds.size ? 0.05 : 0),
          0.35,
          1.6,
          0.62
        );
        const score = pathInfo.cost / Math.max(0.5, pairImportance);
        pairCandidates.push({
          key,
          from: candidate.anchor,
          to: candidate.other,
          path: pathInfo.sequence,
          cost: pathInfo.cost,
          length: pathInfo.sequence.length,
          importance: pairImportance,
          score,
          pathSignals: pathInfo.pathSignals
        });
      });
    });

    const selected = [];
    const degree = new Map();
    const union = createUnionFind(anchors.map(anchor => anchor.id));
    pairCandidates
      .sort((left, right) => left.score - right.score || right.importance - left.importance || left.key.localeCompare(right.key))
      .forEach(pair => {
        if (union.find(pair.from.id) === union.find(pair.to.id)) return;
        selected.push(pair);
        degree.set(pair.from.id, (degree.get(pair.from.id) || 0) + 1);
        degree.set(pair.to.id, (degree.get(pair.to.id) || 0) + 1);
        union.union(pair.from.id, pair.to.id);
      });

    const maxEdges = Math.max(selected.length, Math.min(pairCandidates.length, Math.round(anchors.length * 1.4)));
    pairCandidates
      .sort((left, right) => left.score - right.score || right.importance - left.importance || left.key.localeCompare(right.key))
      .forEach(pair => {
        if (selected.length >= maxEdges) return;
        if (selected.some(existing => existing.key === pair.key)) return;
        if ((degree.get(pair.from.id) || 0) >= 3 || (degree.get(pair.to.id) || 0) >= 3) return;
        if (pair.importance < 0.6) return;
        selected.push(pair);
        degree.set(pair.from.id, (degree.get(pair.from.id) || 0) + 1);
        degree.set(pair.to.id, (degree.get(pair.to.id) || 0) + 1);
      });

    return selected;
  }

  function buildCorridorStats(corridors) {
    const byHexId = new Map();
    (corridors || []).forEach(corridor => {
      (corridor.path || []).forEach(hexId => {
        const current = byHexId.get(hexId) || {
          count: 0,
          importance: 0,
          riverCrossing: false,
          passAnchor: false
        };
        current.count += 1;
        current.importance += corridor.importance;
        current.riverCrossing = current.riverCrossing || corridor.pathSignals.riverHexIds.has(hexId);
        current.passAnchor = current.passAnchor || corridor.pathSignals.passHexIds.has(hexId);
        byHexId.set(hexId, current);
      });
    });
    return byHexId;
  }

  function buildResourceSiteDrafts({ candidateHexes, settlementAnchors, occupiedHexIds, byCoord, riverData, dimensions, signalCache, settings, usedNames, placedPoiRefs }) {
    const targetCount = getTargetResourceSiteCount(candidateHexes, settlementAnchors, settings, 0);
    if (!targetCount || !Array.isArray(settlementAnchors) || !settlementAnchors.length) return [];
    const drafts = [];
    const supportUsage = new Map();
    const supportKinds = new Map();
    const iconUsage = new Map();
    const orderedAnchors = [...settlementAnchors].sort((left, right) => (right.importance || 0) - (left.importance || 0));
    let stalled = 0;

    while (drafts.length < targetCount && stalled < orderedAnchors.length) {
      stalled = 0;
      orderedAnchors.forEach(anchor => {
        if (drafts.length >= targetCount) return;
        const supportKey = anchor.id || anchor.hex?.id || "";
        const capacity = getSettlementResourceCapacity(anchor);
        if ((supportUsage.get(supportKey) || 0) >= capacity) {
          stalled += 1;
          return;
        }
        const candidate = chooseBestResourceCandidateForSettlement(anchor, candidateHexes, occupiedHexIds, supportKinds.get(supportKey) || new Set(), byCoord, riverData, dimensions, signalCache, settings, placedPoiRefs, iconUsage);
        if (!candidate) {
          stalled += 1;
          return;
        }
        const name = reserveGeneratedName(
          generateResourceSiteName(candidate, settings),
          usedNames,
          buildResourceSiteFallbackName(candidate),
          { seed: `${settings.seed}:resource-name:${candidate.hex.id}` }
        );
        drafts.push({
          name,
          type: "resource_site",
          icon: candidate.icon,
          hexId: candidate.hex.id,
          tags: candidate.tags,
          notoriety: candidate.notoriety,
          population: "",
          lore: "",
          meta: candidate.meta
        });
        occupiedHexIds.add(candidate.hex.id);
        supportUsage.set(supportKey, (supportUsage.get(supportKey) || 0) + 1);
        if (!supportKinds.has(supportKey)) supportKinds.set(supportKey, new Set());
        supportKinds.get(supportKey).add(candidate.meta.kind);
        registerVariantUsage(candidate, iconUsage);
      });
    }

    return drafts.slice(0, targetCount);
  }

  function getSettlementResourceCapacity(anchor) {
    const importance = Number(anchor?.importance || 0.5);
    if (importance >= 1.3) return 3;
    if (importance >= 0.82) return 2;
    return 1;
  }

  function chooseBestResourceCandidateForSettlement(anchor, candidateHexes, occupiedHexIds, usedKinds, byCoord, riverData, dimensions, signalCache, settings, placedPoiRefs, iconUsage) {
    const pool = (candidateHexes || [])
      .filter(hex => !occupiedHexIds.has(hex.id))
      .map(hex => buildResourceCandidateForSettlement(anchor, hex, byCoord, riverData, dimensions, signalCache))
      .filter(Boolean)
      .map(candidate => ({
        candidate,
        score: candidate.score
          + (usedKinds.has(candidate.meta.kind) ? -0.12 : 0.06)
          - getPlacedPoiClusterPenalty(candidate.hex, placedPoiRefs, 4, { ignoreTypes: ["settlement"] })
          - getVariantUsagePenalty(candidate, iconUsage, {
            variantSoftCap: variantCandidate => ["farmstead", "fishing_camp", "mine", "quarry"].includes(variantCandidate.icon) ? 2 : 1,
            variantPenaltyBase: 0.06,
            variantPenaltyStep: 0.12
          })
      }))
      .filter(entry => entry.score >= 0.34)
      .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
    return pool?.candidate || null;
  }

  function buildResourceCandidateForSettlement(anchor, hex, byCoord, riverData, dimensions, signalCache) {
    const distance = hexDistance(anchor.hex, hex);
    if (distance < 1 || distance > 5) return null;
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    const specialization = chooseResourceSpecialization(signals, anchor, distance);
    if (!specialization) return null;
    const distanceFactor = distance <= 2 ? 1 : distance === 3 ? 0.82 : distance === 4 ? 0.62 : 0.44;
    const settlementFit = clamp(Number(anchor.importance || 0.5) * 0.22 + (specialization.kind === "harbor" || specialization.kind === "docks" ? 0.08 : 0), 0, 0.32, 0.14);
    const score = specialization.score * 0.62 + distanceFactor * 0.22 + signals.routeability * 0.08 + settlementFit;
    if (score < 0.34) return null;
    const tags = getResourceTags(specialization.kind, specialization.icon, signals);
    return {
      hex,
      score,
      icon: specialization.icon,
      tags,
      notoriety: getResourceNotoriety(specialization.kind, anchor.importance, distance),
      meta: {
        kind: specialization.kind,
        nearestSettlement: anchor.name || "",
        nearestSettlementId: anchor.id || "",
        supportDistance: distance
      }
    };
  }

  function chooseResourceSpecialization(signals, anchor, distance) {
    const options = [];
    const majorSettlement = Number(anchor?.importance || 0) >= 1;
    if (signals.coastal && distance <= 2) {
      options.push({ kind: "harbor", icon: "harbor", score: majorSettlement ? 0.96 : 0.82 });
    } else if ((signals.riverAccess || signals.lakeAccess || signals.coastal) && distance <= 2 && signals.routeability >= 0.46) {
      options.push({ kind: "docks", icon: "docks", score: 0.82 + (majorSettlement ? 0.06 : 0) });
    }
    if (signals.fishPotential >= 0.55) {
      options.push({ kind: "fishing", icon: "fishing_camp", score: 0.78 + signals.fishPotential * 0.18 });
    }
    if (signals.stonePotential >= 0.68 || signals.mountainAffinity >= 0.74) {
      options.push({ kind: "mine", icon: "mine", score: 0.88 + signals.mountainAffinity * 0.08 });
    }
    if (signals.stonePotential >= 0.5) {
      options.push({ kind: "quarry", icon: "quarry", score: 0.78 + signals.stonePotential * 0.08 });
    }
    if (signals.forestPotential >= 0.68) {
      options.push({
        kind: "lumber",
        icon: distance <= 2 && signals.routeability >= 0.5 ? "lumber_mill" : "lumber_camp",
        score: 0.84 + signals.forestPotential * 0.08
      });
    }
    if (signals.arablePotential >= 0.72 && signals.mountainAffinity < 0.68) {
      options.push({
        kind: "farm",
        icon: signals.routeability >= 0.58 && signals.forestPotential < 0.46 ? "windmill" : "farmstead",
        score: 0.84 + signals.arablePotential * 0.06
      });
    }
    if (signals.huntingPotential >= 0.56 && signals.arablePotential < 0.74) {
      options.push({ kind: "hunt", icon: "hunting_blind", score: 0.7 + signals.huntingPotential * 0.08 });
    }
    if (majorSettlement && signals.routeability >= 0.62 && distance <= 2 && !signals.coastal && !signals.lakeAccess && !signals.riverAccess) {
      options.push({ kind: "trade", icon: "warehouse", score: 0.72 });
    }
    return options.sort((left, right) => right.score - left.score || left.icon.localeCompare(right.icon))[0] || null;
  }

  function getResourceTags(kind, icon, signals) {
    const tags = [];
    if (kind === "farm") tags.push("farming");
    if (kind === "fishing" || kind === "harbor" || kind === "docks") tags.push("fishing");
    if (kind === "mine" || kind === "quarry") tags.push("mining");
    if (kind === "trade" || kind === "harbor" || kind === "docks") tags.push("trade");
    if (signals.coastal || signals.riverAccess) tags.push("river_crossing");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getResourceNotoriety(kind, importance, distance) {
    let value = kind === "harbor" || kind === "mine" ? 6 : 7;
    if (importance >= 1.2) value -= 1;
    if (distance >= 4) value += 1;
    return String(Math.max(4, Math.min(9, value)));
  }

  function buildWaypointDrafts({ candidateHexes, settlementAnchors, corridors, corridorStats, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings, usedNames, placedPoiRefs }) {
    const targetCount = getTargetWaypointCount(candidateHexes, settlementAnchors, settings, 0);
    if (!targetCount || !Array.isArray(corridors) || !corridors.length) return [];
    const roadstopCandidates = buildRoadstopWaypointCandidates(corridors, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings);
    const passCandidates = buildPassWaypointCandidates(corridors, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache);
    const crossingCandidates = buildCrossingWaypointCandidates(corridors, corridorStats, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings);
    const desiredPassBudget = passCandidates.length
      ? Math.min(passCandidates.length, Math.max(1, Math.round(targetCount * 0.18)))
      : 0;
    const roadstopBudget = Math.max(1, Math.min(Math.max(1, targetCount - desiredPassBudget), Math.round(targetCount * 0.55)));
    const passBudget = Math.min(desiredPassBudget, Math.max(0, targetCount - roadstopBudget));
    const crossingBudget = Math.max(0, targetCount - roadstopBudget - passBudget);
    const drafts = [];
    const variantUsage = new Map();

    selectRankedCandidates(roadstopCandidates, roadstopBudget, 4, placedPoiRefs, {
      variantUsage,
      variantSoftCap: candidate => candidate.icon === "tavern" ? 2 : 1,
      variantPenaltyBase: 0.06,
      variantPenaltyStep: 0.12
    }).forEach(candidate => {
      drafts.push(finalizeWaypointDraft(candidate, settings, usedNames));
      occupiedHexIds.add(candidate.hex.id);
    });
    selectRankedCandidates(passCandidates.filter(candidate => !occupiedHexIds.has(candidate.hex.id)), passBudget, 4, [...placedPoiRefs, ...drafts.map(draft => ({ hex: byId.get(draft.hexId), type: draft.type, icon: draft.icon })).filter(ref => ref.hex)], {
      variantUsage,
      variantSoftCap: 1,
      variantPenaltyBase: 0.08,
      variantPenaltyStep: 0.14
    }).forEach(candidate => {
      drafts.push(finalizeWaypointDraft(candidate, settings, usedNames));
      occupiedHexIds.add(candidate.hex.id);
    });
    selectRankedCandidates(crossingCandidates.filter(candidate => !occupiedHexIds.has(candidate.hex.id)), crossingBudget, 3, [...placedPoiRefs, ...drafts.map(draft => ({ hex: byId.get(draft.hexId), type: draft.type, icon: draft.icon })).filter(ref => ref.hex)], {
      variantUsage,
      variantSoftCap: candidate => candidate.icon === "bridge" ? 2 : 1,
      variantPenaltyBase: 0.08,
      variantPenaltyStep: 0.14
    }).forEach(candidate => {
      drafts.push(finalizeWaypointDraft(candidate, settings, usedNames));
      occupiedHexIds.add(candidate.hex.id);
    });

    if (drafts.length < targetCount) {
      const fallbackRefs = [...placedPoiRefs, ...drafts.map(draft => ({ hex: byId.get(draft.hexId), type: draft.type, icon: draft.icon })).filter(ref => ref.hex)];
      const fallbackPool = [...roadstopCandidates, ...passCandidates, ...crossingCandidates]
        .filter(candidate => !occupiedHexIds.has(candidate.hex.id));
      selectRankedCandidates(fallbackPool, targetCount - drafts.length, 3, fallbackRefs, {
        variantUsage,
        variantSoftCap: candidate => candidate.icon === "bridge" || candidate.icon === "tavern" ? 2 : 1,
        variantPenaltyBase: 0.06,
        variantPenaltyStep: 0.12
      }).forEach(candidate => {
        drafts.push(finalizeWaypointDraft(candidate, settings, usedNames));
        occupiedHexIds.add(candidate.hex.id);
      });
    }

    return drafts.slice(0, targetCount);
  }

  function buildRoadstopWaypointCandidates(corridors, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings) {
    return (corridors || [])
      .map(corridor => {
        if (!Array.isArray(corridor.path) || corridor.path.length < 7) return null;
        const startIndex = Math.max(2, Math.floor(corridor.path.length * 0.32));
        const endIndex = Math.min(corridor.path.length - 3, Math.ceil(corridor.path.length * 0.68));
        const midpointCandidates = corridor.path
          .slice(startIndex, endIndex + 1)
          .map((hexId, localIndex) => {
            const hex = byId.get(hexId);
            if (!hex || occupiedHexIds.has(hex.id)) return null;
            const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
            const settlementDistance = Math.min(hexDistance(corridor.from.hex, hex), hexDistance(corridor.to.hex, hex));
            if (settlementDistance < 2) return null;
            const midpointBias = 1 - Math.abs((localIndex / Math.max(1, endIndex - startIndex)) - 0.5);
            const score = corridor.importance * 0.46 + midpointBias * 0.22 + signals.routeability * 0.16 + signals.shelter * 0.1 + (signals.coastal || signals.lakeAccess || signals.riverAccess ? 0.04 : 0);
            if (score < 0.38) return null;
            const icon = chooseRoadstopWaypointIcon(signals, corridor.importance);
            const tags = getRoadstopWaypointTags(signals, icon);
            return {
              hex,
              score,
              icon,
              tags,
              notoriety: getRoadstopWaypointNotoriety(corridor.importance),
              meta: {
                routeNames: [corridor.from.name || "", corridor.to.name || ""].filter(Boolean),
                routeType: "roadstop"
              }
            };
          })
          .filter(Boolean)
          .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
        return midpointCandidates[0] || null;
      })
      .filter(Boolean);
  }

  function buildPassWaypointCandidates(corridors, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache) {
    const byHexId = new Map();
    (corridors || []).forEach(corridor => {
      const candidate = buildCorridorPassWaypointCandidate(corridor, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache);
      if (!candidate) return;
      const existing = byHexId.get(candidate.hex.id);
      if (!existing || candidate.score > existing.score) byHexId.set(candidate.hex.id, candidate);
    });
    return [...byHexId.values()]
      .filter(candidate => candidate.score >= 0.38)
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
  }

  function buildCorridorPassWaypointCandidate(corridor, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache) {
    const path = [...(corridor?.path || [])];
    if (path.length < 5) return null;
    const startIndex = Math.max(1, Math.floor(path.length * 0.12));
    const endIndex = Math.min(path.length - 2, Math.ceil(path.length * 0.88));
    const midpoint = (path.length - 1) / 2;
    let best = null;
    for (let index = startIndex; index <= endIndex; index += 1) {
      const hex = byId.get(path[index]);
      if (!hex || occupiedHexIds.has(hex.id)) continue;
      const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
      const icon = choosePassWaypointIcon(signals);
      if (!icon) continue;
      if (riverData.riverHexIds.has(hex.id) && icon !== "canyon_pass") continue;
      const supportDistance = Math.min(hexDistance(corridor.from.hex, hex), hexDistance(corridor.to.hex, hex));
      if (supportDistance < 2) continue;
      if (!isValidCorridorPassCandidate({ icon, signals })) continue;
      const midpointBias = 1 - Math.min(0.75, Math.abs(index - midpoint) / Math.max(1, path.length * 0.5));
      const approachOpenings = countAdjacentPassApproachHexes(signals);
      const score = corridor.importance * 0.42
        + signals.passStrength * 0.3
        + midpointBias * 0.16
        + signals.routeability * 0.08
        + Math.min(0.08, approachOpenings * 0.04)
        + (icon === "mountain_pass" ? 0.06 : 0);
      const candidate = {
        hex,
        score,
        icon,
        tags: getPassWaypointTags(signals, icon, supportDistance),
        notoriety: getPassWaypointNotoriety(corridor.importance, icon, supportDistance),
        meta: {
          routeNames: [corridor.from.name || "", corridor.to.name || ""].filter(Boolean),
          routeType: "pass",
          nearestSettlement: "",
          nearestSettlementId: "",
          supportDistance,
          roadAnchor: icon === "canyon_pass" ? "canyon" : "pass",
          roadPriority: corridor.importance >= 0.95 ? "road" : "path"
        }
      };
      if (!best || candidate.score > best.score) best = candidate;
    }
    return best;
  }

  function buildCrossingWaypointCandidates(corridors, corridorStats, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings) {
    const byHexId = new Map();
    (corridors || []).forEach(corridor => {
      (corridor.path || []).forEach(hexId => {
        const hex = byId.get(hexId);
        if (!hex || occupiedHexIds.has(hex.id) || !riverData.riverHexIds.has(hex.id)) return;
        const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
        const current = byHexId.get(hex.id) || {
          hex,
          score: 0,
          routeImportance: 0
        };
        current.routeImportance += corridor.importance;
        current.score = Math.max(current.score, corridor.importance * 0.5 + signals.crossingPotential * 0.34 + signals.routeability * 0.1 + signals.passStrength * 0.06);
        byHexId.set(hex.id, current);
      });
    });
    return [...byHexId.values()]
      .map(record => {
        const signals = getHexSignals(record.hex, byCoord, riverData, dimensions, signalCache);
        const icon = chooseCrossingWaypointIcon(signals, record.routeImportance, corridorStats.get(record.hex.id));
        const tags = getCrossingWaypointTags(signals, icon);
        return {
          hex: record.hex,
          score: record.score,
          icon,
          tags,
          notoriety: getCrossingWaypointNotoriety(record.routeImportance, icon),
          meta: {
            routeType: "crossing"
          }
        };
      })
      .filter(candidate => candidate.score >= 0.36)
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
  }

  function finalizeWaypointDraft(candidate, settings, usedNames) {
    const name = reserveGeneratedName(
      generateWaypointName(candidate, settings),
      usedNames,
      buildWaypointFallbackName(candidate),
      { seed: `${settings.seed}:waypoint-name:${candidate.hex.id}` }
    );
    return {
      name,
      type: "waypoint",
      icon: candidate.icon,
      hexId: candidate.hex.id,
      tags: candidate.tags,
      notoriety: candidate.notoriety,
      population: "",
      lore: "",
      meta: candidate.meta
    };
  }

  function buildStrongholdDrafts({ candidateHexes, settlementAnchors, corridors, corridorStats, occupiedHexIds, byId, byCoord, riverData, dimensions, signalCache, settings, usedNames, existingCount, placedPoiRefs }) {
    const targetCount = getTargetStrongholdCount(candidateHexes, settlementAnchors, settings, existingCount);
    if (!targetCount || !Array.isArray(settlementAnchors) || !settlementAnchors.length) return [];
    const variantUsage = new Map();
    const candidates = (candidateHexes || [])
      .map(hex => buildStrongholdCandidate(hex, settlementAnchors, corridors, corridorStats, byCoord, riverData, dimensions, signalCache))
      .filter(Boolean)
      .filter(candidate => !occupiedHexIds.has(candidate.hex.id))
      .reduce((lookup, candidate) => {
        const existing = lookup.get(candidate.hex.id);
        if (!existing || candidate.score > existing.score) lookup.set(candidate.hex.id, candidate);
        return lookup;
      }, new Map());
    return selectRankedCandidates([...candidates.values()], targetCount, 4, placedPoiRefs, {
      variantUsage,
      variantSoftCap: candidate => ["fort", "watchtower", "stone_tower"].includes(candidate.icon) ? 2 : 1,
      variantPenaltyBase: 0.08,
      variantPenaltyStep: 0.14
    }).map(candidate => {
      const name = reserveGeneratedName(
        generateStrongholdName(candidate, settings),
        usedNames,
        buildStrongholdFallbackName(candidate),
        { seed: `${settings.seed}:stronghold-name:${candidate.hex.id}` }
      );
      return {
        name,
        type: "stronghold",
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

  function buildStrongholdCandidate(hex, settlementAnchors, corridors, corridorStats, byCoord, riverData, dimensions, signalCache) {
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    const nearestSettlement = findNearestSettlementAnchor(hex, settlementAnchors);
    const independentMountainGate = signals.mountainCore
      && signals.passStrength >= 0.58
      && getMountainBarrierScore(signals) >= 0.82;
    if ((!nearestSettlement || nearestSettlement.distance < 1 || nearestSettlement.distance > 7) && !independentMountainGate) return null;
    const settlementDistance = nearestSettlement?.distance ?? 99;
    const settlementImportance = Number(nearestSettlement?.anchor?.importance || 0.5);
    const corridorPressure = getCorridorPressure(hex, corridorStats, byCoord);
    const protectScore = settlementDistance >= 2 && settlementDistance <= 4
      ? clamp(settlementImportance, 0.3, 1.5, 0.5) * 0.28
      : settlementDistance <= 5
        ? 0.1
        : 0;
    const frontier = signals.edgeDistance <= 2 || settlementDistance >= 5;
    const score = signals.passStrength * 0.22
      + signals.crossingPotential * 0.18
      + corridorPressure * 0.24
      + protectScore
      + signals.prominence * 0.1
      + signals.routeability * 0.08
      + (signals.mountainCore && signals.passStrength >= 0.56 ? 0.12 : 0)
      + (signals.coastal ? 0.08 : 0)
      + (frontier ? 0.06 : 0);
    if (score < 0.34) return null;
    const icon = chooseStrongholdIcon(signals, nearestSettlement, corridorPressure, frontier);
    const tags = getStrongholdTags(signals, icon, frontier);
    return {
      hex,
      score,
      icon,
      tags,
      notoriety: getStrongholdNotoriety(icon, nearestSettlement, frontier),
      meta: {
        hex: { ...hex },
        nearestSettlement: nearestSettlement?.anchor?.name || "",
        nearestSettlementId: nearestSettlement?.anchor?.id || "",
        nearestSettlementRole: nearestSettlement?.anchor?.role || "",
        supportDistance: settlementDistance,
        roadAnchor: icon === "mountain_gate" ? "gate" : "stronghold",
        roadPriority: settlementDistance <= 3 ? "road" : "path"
      }
    };
  }

  function chooseStrongholdIcon(signals, nearestSettlement, corridorPressure, frontier) {
    const settlementDistance = nearestSettlement?.distance ?? 99;
    const settlementImportance = Number(nearestSettlement?.anchor?.importance || 0);
    const nearestSettlementMountain = hasAnyFeature(nearestSettlement?.anchor?.hex, MOUNTAIN_FEATURES);
    const actualMountainHex = hasAnyFeature(signals?.hex, MOUNTAIN_FEATURES);
    if (signals.coastal && corridorPressure >= 0.45) return "sea_fort";
    if (
      actualMountainHex
      && signals.passStrength >= 0.58
      && getMountainBarrierScore(signals) >= 0.82
      && (settlementDistance >= 4 || (settlementDistance >= 2 && nearestSettlementMountain))
    ) return "mountain_gate";
    if (settlementDistance <= 3 && settlementImportance >= 0.95 && signals.prominence >= 0.42) return "castle";
    if (frontier && signals.prominence >= 0.68) return "watchtower";
    if (frontier && corridorPressure >= 0.4) return "walled_encampment";
    if (signals.prominence >= 0.74 && settlementDistance >= 4) return "stone_tower";
    return "fort";
  }

  function getStrongholdTags(signals, icon, frontier) {
    const tags = ["occupied"];
    if (frontier || ["watchtower", "walled_encampment", "mountain_gate"].includes(icon)) tags.push("frontier");
    if (signals.passStrength >= 0.6 || signals.crossingPotential >= 0.62 || icon === "sea_fort") tags.push("contested");
    if (icon === "mountain_gate" || signals.passStrength >= 0.64) tags.push("crossroads");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getStrongholdNotoriety(icon, nearestSettlement, frontier) {
    let value = icon === "castle" ? 5 : icon === "sea_fort" || icon === "mountain_gate" ? 6 : 7;
    if (Number(nearestSettlement?.anchor?.importance || 0) >= 1.1) value -= 1;
    if (frontier) value += 1;
    return String(Math.max(3, Math.min(9, value)));
  }

  function makeGeneratedStrongholdAnchor(draft, index, byId) {
    return {
      id: `generated-stronghold-${index}:${draft.hexId}`,
      hex: draft.meta?.hex ? { ...draft.meta.hex } : byId.get(draft.hexId) || { id: draft.hexId },
      name: draft.name,
      icon: draft.icon,
      importance: getStrongholdAnchorImportance(draft.icon)
    };
  }

  function buildDungeonDrafts({ candidateHexes, settlementAnchors, strongholdAnchors, corridorStats, occupiedHexIds, byCoord, riverData, dimensions, signalCache, settings, usedNames, targetCount, complex, placedPoiRefs }) {
    if (!targetCount) return [];
    const variantUsage = new Map();
    const candidates = (candidateHexes || [])
      .map(hex => buildDungeonCandidate(hex, settlementAnchors, strongholdAnchors, corridorStats, byCoord, riverData, dimensions, signalCache, complex))
      .filter(Boolean)
      .filter(candidate => !occupiedHexIds.has(candidate.hex.id))
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));
    return selectRankedCandidates(candidates, targetCount, 5, placedPoiRefs, {
      variantUsage,
      variantSoftCap: candidate => candidate.icon === "cave" ? 2 : 1,
      variantPenaltyBase: 0.06,
      variantPenaltyStep: 0.1
    }).map(candidate => {
      const name = reserveGeneratedName(
        generateDungeonName(candidate, settings),
        usedNames,
        buildDungeonFallbackName(candidate),
        { seed: `${settings.seed}:dungeon-name:${candidate.hex.id}` }
      );
      return {
        name,
        type: complex ? "dungeon_complex" : "dungeon",
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

  function buildDungeonCandidate(hex, settlementAnchors, strongholdAnchors, corridorStats, byCoord, riverData, dimensions, signalCache, complex) {
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    const nearestSettlement = findNearestSettlementAnchor(hex, settlementAnchors);
    const nearestStronghold = findNearestPoiAnchor(hex, strongholdAnchors);
    const settlementDistance = nearestSettlement?.distance ?? 99;
    const strongholdDistance = nearestStronghold?.distance ?? 99;
    const corridorPressure = getCorridorPressure(hex, corridorStats, byCoord);
    const remoteness = clamp(
      (settlementDistance >= 8 ? 0.9 : settlementDistance >= 6 ? 0.72 : settlementDistance >= 4 ? 0.5 : 0.24)
      + signals.roughness * 0.12
      + (signals.edgeDistance <= 2 ? 0.05 : 0),
      0,
      1,
      0.4
    );
    const oldCivilization = clamp(corridorPressure * 0.42 + (settlementDistance >= 4 && settlementDistance <= 8 ? 0.18 : 0) + (strongholdDistance <= 4 ? 0.08 : 0), 0, 1, 0.18);
    const concealment = clamp(signals.forestPotential * 0.32 + signals.roughness * 0.18 + signals.wasteAffinity * 0.12 + signals.snowAffinity * 0.08, 0, 1, 0.28);
    const strongholdLink = strongholdDistance >= 2 && strongholdDistance <= 4 ? 0.24 : 0;
    const score = complex
      ? remoteness * 0.34 + oldCivilization * 0.2 + concealment * 0.14 + strongholdLink + signals.mountainAffinity * 0.08 + signals.wasteAffinity * 0.08
      : remoteness * 0.38 + oldCivilization * 0.16 + concealment * 0.16 + strongholdLink * 0.7 + signals.mountainAffinity * 0.08 + signals.wasteAffinity * 0.08;
    if (score < (complex ? 0.46 : 0.34)) return null;
    const icon = chooseDungeonIcon(signals, oldCivilization, strongholdLink, complex);
    const tags = getDungeonTags(icon, remoteness, oldCivilization, strongholdLink, complex);
    return {
      hex,
      score,
      icon,
      tags,
      notoriety: getDungeonNotoriety(icon, remoteness, strongholdLink, complex),
      type: complex ? "dungeon_complex" : "dungeon",
      meta: {
        nearestSettlement: nearestSettlement?.anchor?.name || "",
        supportDistance: settlementDistance,
        strongholdName: nearestStronghold?.anchor?.name || "",
        strongholdDistance
      }
    };
  }

  function chooseDungeonIcon(signals, oldCivilization, strongholdLink, complex) {
    if (oldCivilization >= 0.62) return complex ? "catacombs" : "crypt";
    if (signals.mountainAffinity >= 0.72 || signals.passStrength >= 0.62) return "cave";
    if (signals.wasteAffinity >= 0.6 && complex) return "dragon_lair";
    if (signals.wasteAffinity >= 0.52 || signals.forestPotential >= 0.64) return "lair";
    return complex ? "dungeon" : (strongholdLink ? "dungeon" : "cave");
  }

  function getDungeonTags(icon, remoteness, oldCivilization, strongholdLink, complex) {
    const tags = complex ? ["sealed", "underground"] : ["hidden", "underground"];
    if (remoteness >= 0.7) tags.push("remote");
    if (oldCivilization >= 0.58 || ["catacombs", "crypt"].includes(icon)) tags.push("ancient");
    if (strongholdLink) tags.push("contested");
    if (["lair", "dragon_lair"].includes(icon)) tags.push("monster_lair");
    if (complex && !tags.includes("forbidden")) tags.push("forbidden");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getDungeonNotoriety(icon, remoteness, strongholdLink, complex) {
    let value = complex ? 3 : 5;
    if (remoteness >= 0.76) value += 1;
    if (strongholdLink) value -= 1;
    if (icon === "dragon_lair") value -= 1;
    return String(Math.max(2, Math.min(9, value)));
  }

  function buildSiteDrafts({ candidateHexes, settlementAnchors, strongholdAnchors, corridorStats, occupiedHexIds, byCoord, riverData, dimensions, signalCache, settings, usedNames, targetCount, placedPoiRefs }) {
    if (!targetCount) return [];
    const familyUsage = new Map();
    const iconUsage = new Map();
    const candidates = (candidateHexes || [])
      .flatMap(hex => buildSiteCandidatesForHex(hex, settlementAnchors, strongholdAnchors, corridorStats, byCoord, riverData, dimensions, signalCache))
      .filter(candidate => !occupiedHexIds.has(candidate.hex.id))
      .sort((left, right) => right.score - left.score || left.hex.id.localeCompare(right.hex.id));

    const chosen = [];
    while (chosen.length < targetCount) {
      const best = candidates
        .filter(candidate => !chosen.some(entry => entry.hex.id === candidate.hex.id))
        .map(candidate => ({
          candidate,
          score: candidate.score * getSiteFamilyCapFactor(candidate.type, familyUsage.get(candidate.type) || 0, targetCount)
            - getSelectedSpacingPenalty(candidate.hex, chosen, 4)
            - getPlacedPoiClusterPenalty(candidate.hex, placedPoiRefs, 4, { ignoreTypes: ["settlement"] })
            - getVariantUsagePenalty(candidate, iconUsage, {
              variantSoftCap: variantCandidate => ["standing_stones", "tree", "shrine", "ruins"].includes(variantCandidate.icon) ? 2 : 1,
              variantPenaltyBase: 0.06,
              variantPenaltyStep: 0.12
            })
        }))
        .filter(entry => entry.score >= 0.26)
        .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
      if (!best) break;
      chosen.push(best.candidate);
      familyUsage.set(best.candidate.type, (familyUsage.get(best.candidate.type) || 0) + 1);
      registerVariantUsage(best.candidate, iconUsage);
    }

    return chosen.map(candidate => {
      const name = reserveGeneratedName(
        generateSiteName(candidate, settings),
        usedNames,
        buildSiteFallbackName(candidate),
        { seed: `${settings.seed}:site-name:${candidate.hex.id}` }
      );
      return {
        name,
        type: candidate.type,
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

  function buildSiteCandidatesForHex(hex, settlementAnchors, strongholdAnchors, corridorStats, byCoord, riverData, dimensions, signalCache) {
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    const nearestSettlement = findNearestSettlementAnchor(hex, settlementAnchors);
    const settlementDistance = nearestSettlement?.distance ?? 99;
    const corridorPressure = getCorridorPressure(hex, corridorStats, byCoord);
    const remoteness = clamp((settlementDistance >= 7 ? 0.82 : settlementDistance >= 5 ? 0.62 : settlementDistance >= 3 ? 0.36 : 0.14) + signals.roughness * 0.08, 0, 1, 0.3);
    const oldCivilization = clamp(corridorPressure * 0.36 + (settlementDistance >= 3 && settlementDistance <= 7 ? 0.18 : 0), 0, 1, 0.18);
    const candidates = [];

    const ruinScore = oldCivilization * 0.42 + remoteness * 0.16 + (signals.coastal ? 0.06 : 0) + signals.prominence * 0.08;
    if (ruinScore >= 0.32) {
      const icon = signals.coastal && oldCivilization >= 0.54 ? "shipwreck" : signals.aridAffinity >= 0.56 ? "pyramid" : signals.remarkableIsolation ? "abandoned_shack" : "ruins";
      candidates.push(makeSiteCandidate(hex, "ruin", icon, ruinScore, ["ruined"], settlementDistance, oldCivilization, remoteness));
    }

    const holyHinterlandBand = settlementDistance <= 1
      ? 0.04
      : settlementDistance <= 5
        ? 0.14
        : settlementDistance <= 8
          ? 0.11
          : 0.06;
    const holyCorridorAffinity = corridorPressure * 0.14
      + (corridorPressure >= 0.32 ? 0.06 : 0)
      + (corridorPressure >= 0.56 && settlementDistance >= 3 ? 0.03 : 0);
    const holyRemoteAllowance = remoteness >= 0.72 ? 0.05 : remoteness >= 0.56 ? 0.03 : 0;
    const holyDirectAdjacencyPenalty = settlementDistance <= 1 && corridorPressure < 0.34 ? 0.08 : 0;
    const holyScore = holyHinterlandBand + holyCorridorAffinity + holyRemoteAllowance
      + signals.freshwaterAffinity * 0.2
      + signals.forestPotential * 0.12
      + signals.prominence * 0.08
      + (signals.snowAffinity >= 0.5 ? 0.05 : 0)
      - holyDirectAdjacencyPenalty;
    if (holyScore >= 0.3) {
      let icon = "shrine";
      if (settlementDistance <= 3 && signals.fertility >= 0.44 && corridorPressure < 0.56) icon = "abbey";
      else if (corridorPressure >= 0.5 && settlementDistance <= 7) icon = "roadside_shrine";
      else if (signals.forestPotential >= 0.68 && settlementDistance >= 3) icon = "sacred_grove";
      else if (oldCivilization >= 0.58 || (corridorPressure >= 0.54 && settlementDistance >= 3 && settlementDistance <= 7)) icon = "temple";
      candidates.push(makeSiteCandidate(hex, "holy_site", icon, holyScore, ["worship"], settlementDistance, oldCivilization, remoteness));
    }

    const arcaneScore = signals.anomalyPotential * 0.34 + remoteness * 0.16 + signals.prominence * 0.1 + signals.mountainAffinity * 0.08 + signals.snowAffinity * 0.08;
    if (arcaneScore >= 0.3) {
      const icon = signals.anomalyPotential >= 0.74 ? "arcane_portal" : signals.prominence >= 0.62 ? "observatory" : "wizard_tower";
      candidates.push(makeSiteCandidate(hex, "arcane_site", icon, arcaneScore, ["research"], settlementDistance, oldCivilization, remoteness));
    }

    const wildernessScore = signals.wonderPotential * 0.34 + signals.freshwaterAffinity * 0.14 + signals.forestPotential * 0.12 + remoteness * 0.12 + (signals.coastal ? 0.08 : 0);
    if (wildernessScore >= 0.3) {
      let icon = "tree";
      if (signals.freshwaterAffinity >= 0.78 && signals.prominence >= 0.52) icon = "waterfall";
      else if (signals.freshwaterAffinity >= 0.7) icon = "spring";
      else if (signals.coastal && remoteness >= 0.58) icon = "island";
      else if (signals.forestPotential >= 0.72 && signals.snowAffinity < 0.42) icon = "tree";
      else if (signals.snowAffinity >= 0.56 || signals.wasteAffinity >= 0.54) icon = "dead_tree";
      candidates.push(makeSiteCandidate(hex, "wilderness_site", icon, wildernessScore, [], settlementDistance, oldCivilization, remoteness));
    }

    const hazardScore = signals.wasteAffinity * 0.2 + remoteness * 0.14 + signals.roughness * 0.12 + (signals.edgeDistance <= 2 ? 0.12 : 0) + signals.anomalyPotential * 0.08;
    if (hazardScore >= 0.28) {
      const icon = signals.wasteAffinity >= 0.7 ? "crater" : signals.prominence >= 0.7 ? "battlefield" : "bandit_camp";
      candidates.push(makeSiteCandidate(hex, "hazard", icon, hazardScore, ["lawless"], settlementDistance, oldCivilization, remoteness));
    }

    const landmarkHinterlandBand = settlementDistance <= 1
      ? 0.03
      : settlementDistance <= 5
        ? 0.1
        : settlementDistance <= 8
          ? 0.12
          : 0.07;
    const landmarkCorridorAffinity = corridorPressure * 0.12
      + (corridorPressure >= 0.28 ? 0.05 : 0)
      + (corridorPressure >= 0.52 && settlementDistance >= 2 ? 0.02 : 0);
    const landmarkRemoteAllowance = remoteness >= 0.76 ? 0.05 : remoteness >= 0.62 ? 0.02 : 0;
    const landmarkDirectAdjacencyPenalty = settlementDistance <= 1 && corridorPressure < 0.28 ? 0.08 : 0;
    const landmarkScore = signals.prominence * 0.2 + oldCivilization * 0.1 + signals.coastal * 0.1 + signals.wonderPotential * 0.16 + signals.freshwaterAffinity * 0.08
      + landmarkHinterlandBand + landmarkCorridorAffinity + landmarkRemoteAllowance - landmarkDirectAdjacencyPenalty;
    if (landmarkScore >= 0.28) {
      const icon = signals.coastal && signals.prominence >= 0.56 ? "lighthouse" : oldCivilization >= 0.56 ? "obelisk" : "standing_stones";
      candidates.push(makeSiteCandidate(hex, "landmark", icon, landmarkScore, [], settlementDistance, oldCivilization, remoteness));
    }

    return candidates;
  }

  function makeSiteCandidate(hex, type, icon, score, baseTags, settlementDistance, oldCivilization, remoteness) {
    const tags = getSiteTags(type, icon, baseTags, oldCivilization, remoteness, settlementDistance);
    return {
      hex,
      type,
      icon,
      score,
      tags,
      notoriety: getSiteNotoriety(type, icon, remoteness, oldCivilization),
      meta: {
        supportDistance: settlementDistance
      }
    };
  }

  function getSiteTags(type, icon, baseTags, oldCivilization, remoteness, settlementDistance) {
    const tags = Array.isArray(baseTags) ? [...baseTags] : [];
    if (remoteness >= 0.68) tags.push("remote");
    if (oldCivilization >= 0.56) tags.push("ancient");
    if (type === "holy_site" && icon === "roadside_shrine") tags.push("pilgrimage");
    if (type === "ruin") tags.push("abandoned");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getSiteNotoriety(type, icon, remoteness, oldCivilization) {
    let value = type === "landmark" ? 5 : type === "holy_site" || type === "arcane_site" ? 6 : 7;
    if (remoteness >= 0.72) value += 1;
    if (oldCivilization >= 0.6 || icon === "lighthouse") value -= 1;
    return String(Math.max(3, Math.min(9, value)));
  }

  function getSiteFamilyCapFactor(type, count, targetCount) {
    const band = SITE_FAMILY_RATIO_BANDS[type] || { minimum: 0.12, soft: 0.2 };
    const floor = Math.max(1, Math.round(Math.max(1, targetCount) * band.minimum));
    const softCap = Math.max(floor, Math.round(Math.max(1, targetCount) * band.soft));
    if (count < floor) {
      const progress = count / Math.max(floor, 1);
      return 1.24 - progress * 0.14;
    }
    if (count >= softCap + 1) return 0.42;
    if (count >= softCap) return 0.68;
    return 1;
  }

  function buildSettlementCandidate(hex, byCoord, riverData, dimensions, signalCache, landmassIdByHexId) {
    if (!isViableSettlementHex(hex)) return null;
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    if (signals.edgeDistance <= 0) return null;
    if (signals.edgeDistance <= 1 && !signals.coastal && !signals.riverAccess) return null;
    const coastalHinterlandStrength = signals.coastal
      ? clamp(
          Math.min(0.34, signals.adjacentLandCount * 0.11)
          + Math.min(0.32, Math.max(0, signals.localLandCount - 1) * 0.05)
          + signals.routeability * 0.12
          + signals.shelter * 0.08
          - (signals.edgeDistance <= 1 ? 0.14 : 0),
          0,
          1,
          0.12
        )
      : 0;
    if (signals.coastal && (signals.adjacentLandCount < 2 || signals.localLandCount < 6) && coastalHinterlandStrength < 0.58) return null;
    const foodPotential = Math.max(signals.arablePotential * 0.68, signals.fishPotential * 0.66, signals.huntingPotential * 0.62);
    const supportScore = clamp(
      foodPotential * 0.38
      + signals.resourceDiversity * 0.24
      + signals.stonePotential * 0.1
      + signals.forestPotential * 0.1
      + (signals.snowAffinity >= 0.5 ? signals.huntingPotential * 0.08 + signals.waterAccess * 0.04 : 0),
      0,
      1,
      0.4
    );
    const strategic = clamp(signals.crossingPotential * 0.34 + signals.passStrength * 0.28 + signals.prominence * 0.16 + signals.routeability * 0.12, 0, 1, 0.2);
    const edgePenalty = signals.edgeDistance <= 1 ? 0.08 : signals.edgeDistance === 2 ? 0.03 : 0;
    const coastalExposurePenalty = signals.coastal && coastalHinterlandStrength < 0.64
      ? (0.64 - coastalHinterlandStrength) * 0.16
      : 0;
    const frontierSnowBonus = signals.snowAffinity >= 0.5 && (signals.waterAccess >= 0.7 || signals.routeability >= 0.54)
      ? 0.08 + signals.huntingPotential * 0.04
      : 0;
    const lowlandSnowSettlementBonus = !signals.mountainCore
      && hex.baseTerrain === "snow"
      && Number(hex.elevation || 0) <= 2
      && (signals.routeability >= 0.34 || signals.waterAccess >= 0.56 || signals.shelter >= 0.44)
      ? 0.11
        + (signals.riverAccess || signals.lakeAccess ? 0.05 : 0)
        + (signals.routeability >= 0.42 ? 0.04 : 0)
        + (signals.shelter >= 0.5 ? 0.03 : 0)
      : 0;
    const aridVillageSettlementBonus = !signals.mountainCore
      && ARID_VILLAGE_TERRAINS.has(hex.baseTerrain)
      && Number(hex.elevation || 0) <= 2
      && (signals.waterAccess >= 0.58 || signals.routeability >= 0.46 || signals.shelter >= 0.52)
      ? 0.035
        + (signals.riverAccess || signals.lakeAccess ? 0.03 : 0)
        + (signals.routeability >= 0.5 ? 0.02 : 0)
        + (signals.shelter >= 0.56 ? 0.015 : 0)
      : 0;
    const mountainSettlementBonus = signals.mountainCore
      && (signals.passStrength >= 0.4 || signals.routeability >= 0.34 || signals.riverAccess || signals.waterAccess >= 0.52)
      ? 0.07 + Math.min(0.05, signals.adjacentMountainCoreCount * 0.02)
      : 0;
    const score = clamp(
      signals.waterAccess * 0.26
      + signals.routeability * 0.2
      + supportScore * 0.24
      + signals.shelter * 0.12
      + strategic * 0.12
      + signals.resourceDiversity * 0.08
      + frontierSnowBonus
      + lowlandSnowSettlementBonus
      + aridVillageSettlementBonus
      + mountainSettlementBonus
      - signals.harshness * 0.08
      - edgePenalty
      - coastalExposurePenalty,
      0,
      1.2,
      0.3
    );
    if (score < 0.2) return null;
    const roleScores = {
      coastal_harbor: signals.coastal && coastalHinterlandStrength >= 0.44
        ? 0.48 + signals.fishPotential * 0.18 + signals.routeability * 0.12 + supportScore * 0.1 + coastalHinterlandStrength * 0.16
        : 0,
      river_crossing: signals.riverAccess ? 0.32 + signals.crossingPotential * 0.28 + signals.routeability * 0.16 + supportScore * 0.12 : 0,
      river_settlement: signals.riverAccess ? 0.34 + signals.routeability * 0.18 + supportScore * 0.18 + signals.fishPotential * 0.08 + (lowlandSnowSettlementBonus ? 0.08 : 0) + (aridVillageSettlementBonus ? 0.035 : 0) : 0,
      lake_landing: signals.lakeAccess ? 0.36 + signals.routeability * 0.14 + supportScore * 0.18 + signals.fishPotential * 0.08 + (lowlandSnowSettlementBonus ? 0.07 : 0) + (aridVillageSettlementBonus ? 0.03 : 0) : 0,
      pass_gate: signals.passStrength * 0.42
        + strategic * 0.2
        + signals.routeability * 0.12
        + signals.shelter * 0.12
        + (signals.mountainCore ? 0.22 : 0)
        + (signals.adjacentMountainCoreCount >= 1 ? 0.08 : 0)
        + (signals.localMountainCoreCount >= 3 ? 0.04 : 0)
        - (!signals.mountainCore && signals.passStrength >= 0.56 ? 0.28 : 0),
      inland_node: signals.routeability * 0.24 + supportScore * 0.24 + signals.shelter * 0.12 + strategic * 0.12 + (lowlandSnowSettlementBonus ? 0.08 : 0) + (aridVillageSettlementBonus ? 0.03 : 0),
      upland_node: signals.mountainAffinity * 0.3
        + signals.stonePotential * 0.16
        + signals.routeability * 0.14
        + signals.waterAccess * 0.12
        + (signals.mountainCore ? 0.22 : 0)
        + (signals.adjacentMountainCoreCount >= 2 ? 0.08 : 0)
        + (signals.localMountainCoreCount >= 3 ? 0.04 : 0)
        - (!signals.mountainCore && signals.mountainAffinity >= 0.76 ? 0.22 : 0),
      frontier_outpost: supportScore * 0.16 + signals.waterAccess * 0.14 + signals.shelter * 0.14 + signals.routeability * 0.14 + (signals.edgeDistance <= 2 ? 0.08 : 0) + (lowlandSnowSettlementBonus ? 0.16 : 0) + (aridVillageSettlementBonus ? 0.06 : 0)
    };
    const primaryRole = SETTLEMENT_ROLE_ORDER
      .slice()
      .sort((left, right) => (roleScores[right] || 0) - (roleScores[left] || 0) || left.localeCompare(right))[0];
    const mountainSeatBias = primaryRole === "pass_gate" || primaryRole === "upland_node"
      ? (signals.mountainCore ? 0.12 + Math.min(0.05, signals.adjacentMountainCoreCount * 0.02) : -0.12)
      : 0;
    const mountainCoreSeatScore = signals.mountainCore
      ? 0.03 + Math.min(0.05, signals.localMountainCoreCount * 0.015)
      : 0;
    return {
      hex,
      score,
      roleScores,
      primaryRole,
      provinceSeatScore: score + strategic * 0.14 + (signals.riverAccess ? 0.08 : 0) + (signals.coastal ? coastalHinterlandStrength * 0.08 : 0) + mountainSeatBias + mountainCoreSeatScore - edgePenalty,
      landmassId: landmassIdByHexId.get(hex.id) || "",
      waterAccess: signals.waterAccess,
      routeability: signals.routeability,
      mountainAffinity: signals.mountainAffinity,
      mountainCore: signals.mountainCore,
      adjacentMountainCoreCount: signals.adjacentMountainCoreCount,
      localMountainCoreCount: signals.localMountainCoreCount,
      riverAccess: signals.riverAccess,
      coastal: signals.coastal,
      passStrength: signals.passStrength,
      prominence: signals.prominence,
      shelter: signals.shelter,
      fishPotential: signals.fishPotential,
      arablePotential: signals.arablePotential,
      forestPotential: signals.forestPotential,
      stonePotential: signals.stonePotential,
      snowAffinity: signals.snowAffinity,
      wasteAffinity: signals.wasteAffinity,
      edgeDistance: signals.edgeDistance,
      adjacentLandCount: signals.adjacentLandCount,
      localLandCount: signals.localLandCount,
      coastalHinterlandStrength,
      resourceDiversity: signals.resourceDiversity
    };
  }

  function getHexSignals(hex, byCoord, riverData, dimensions, signalCache) {
    if (!hex?.id) return null;
    if (signalCache?.has(hex.id)) return signalCache.get(hex.id);
    const adjacent = neighbors(hex, byCoord);
    const nearby = nearbyWithin(hex, byCoord, 2);
    const local = [hex, ...nearby];
    const localCount = Math.max(1, local.length);
    const forestCount = local.filter(candidate => hasAnyFeature(candidate, FOREST_FEATURES)).length;
    const ruggedCount = local.filter(candidate => candidate.baseTerrain === "rock" || hasAnyFeature(candidate, RUGGED_FEATURES)).length;
    const mountainCore = isMountainCoreHex(hex);
    const adjacentMountainCoreCount = adjacent.filter(isMountainCoreHex).length;
    const mountainCount = local.filter(isMountainCoreHex).length;
    const snowCount = local.filter(candidate => candidate.baseTerrain === "snow" || (candidate.features || []).includes("snowcapped_mountains")).length;
    const wasteCount = local.filter(candidate => BARREN_TERRAINS.has(candidate.baseTerrain)).length;
    const adjacentWater = adjacent.filter(candidate => WATERWAY_TERRAINS.has(candidate.baseTerrain));
    const adjacentLandCount = adjacent.filter(isPoiLandHex).length;
    const coastal = adjacentWater.some(candidate => COASTAL_TERRAINS.has(candidate.baseTerrain));
    const lakeAccess = adjacentWater.some(candidate => candidate.baseTerrain === "inland_water");
    const riverHex = riverData.riverHexIds.has(hex.id);
    const riverAccess = riverHex || nearby.some(candidate => riverData.riverHexIds.has(candidate.id));
    const fertility = scoreTerrainFertility(hex, local);
    const roughness = scoreTerrainRoughness(hex, local);
    const waterAccess = coastal
      ? 1
      : lakeAccess
        ? 0.86
        : riverAccess
          ? 0.78
          : adjacentWater.length
            ? 0.62
            : 0.12;
    const easyExitCount = adjacent.filter(candidate => isPoiLandHex(candidate) && scoreTerrainRoughness(candidate, [candidate]) <= 0.44).length;
    const mountainAffinity = clamp(mountainCount / localCount + (mountainCore ? 0.18 : 0), 0, 1, 0.1);
    const fishPotential = coastal ? 1 : lakeAccess ? 0.82 : riverAccess ? 0.72 : 0;
    const forestPotential = clamp(forestCount / localCount + (hasAnyFeature(hex, FOREST_FEATURES) ? 0.1 : 0), 0, 1, 0.1);
    const stonePotential = clamp(ruggedCount / localCount + (hex.baseTerrain === "rock" ? 0.18 : 0), 0, 1, 0.1);
    const arablePotential = clamp(fertility * (1 - mountainAffinity * 0.35), 0, 1, 0.1);
    const huntingPotential = clamp(
      forestPotential * 0.54
      + (snowCount / localCount) * 0.14
      + (wasteCount / localCount) * 0.1
      + (fishPotential > 0.4 ? 0.06 : 0),
      0,
      1,
      0.2
    );
    const routeability = clamp(
      easyExitCount / 6 * 0.56
      + (riverAccess ? 0.12 : 0)
      + (coastal ? 0.14 : lakeAccess ? 0.08 : 0)
      + (mountainAffinity >= 0.72 && easyExitCount <= 2 ? -0.12 : 0)
      - Math.max(0, roughness - 0.45) * 0.28,
      0,
      1,
      0.3
    );
    const passStrength = scorePassStrength(hex, adjacent, nearby, roughness);
    const crossingPotential = scoreCrossingPotential(hex, adjacent, riverData, routeability);
    const shelter = clamp(
      0.32
      + (Number(hex.elevation || 0) >= 2 && Number(hex.elevation || 0) <= 3 ? 0.16 : 0)
      + Math.max(0, 0.46 - Math.abs(roughness - 0.46)) * 0.26
      + (coastal || riverAccess ? 0.06 : 0),
      0,
      1,
      0.4
    );
    const prominence = clamp(
      Math.max(0, Number(hex.elevation || 0) - 1) * 0.18
      + adjacent.filter(candidate => Number(candidate.elevation || 0) < Number(hex.elevation || 0)).length / 6 * 0.26,
      0,
      1,
      0.12
    );
    const harshness = clamp(
      (HARSH_TERRAINS.has(hex.baseTerrain) ? 0.78 : hex.baseTerrain === "wetland" ? 0.24 : 0)
      + (hex.baseTerrain === "snow" ? 0.12 : 0)
      + (hex.baseTerrain === "rock" ? 0.16 : 0)
      + Math.max(0, roughness - 0.68) * 0.22
      - waterAccess * 0.12,
      0,
      1,
      0.18
    );
    const resourceDiversity = [
      fishPotential >= 0.58,
      forestPotential >= 0.52,
      stonePotential >= 0.52,
      arablePotential >= 0.62,
      huntingPotential >= 0.52
    ].filter(Boolean).length / 5;
    const freshwaterAffinity = clamp((riverAccess ? 0.56 : 0) + (lakeAccess ? 0.46 : 0), 0, 1, 0);
    const wasteAffinity = clamp(wasteCount / localCount + (BARREN_TERRAINS.has(hex.baseTerrain) ? 0.16 : 0), 0, 1, 0);
    const snowAffinity = clamp(snowCount / localCount + (hex.baseTerrain === "snow" ? 0.18 : 0), 0, 1, 0);
    const aridAffinity = clamp((["desert", "deep_desert"].includes(hex.baseTerrain) ? 0.32 : 0) + wasteAffinity * 0.54, 0, 1, 0);
    const anomalyPotential = clamp(
      (hex.features || []).includes("volcano") ? 0.88 : 0
      + (mountainAffinity >= 0.78 ? 0.14 : 0)
      + (snowAffinity >= 0.62 ? 0.08 : 0)
      + seededNoise(`anomaly:${hex.id}`, 0, 0.12),
      0,
      1,
      0.08
    );
    const wonderPotential = clamp(
      freshwaterAffinity * 0.28
      + forestPotential * 0.14
      + prominence * 0.18
      + (coastal ? 0.12 : 0)
      + seededNoise(`wonder:${hex.id}`, 0, 0.14),
      0,
      1,
      0.16
    );
    const result = {
      hex,
      adjacent,
      nearby,
      adjacentLandCount,
      localLandCount: local.filter(isPoiLandHex).length,
      edgeDistance: distanceToMapEdge(hex, dimensions),
      coastal,
      lakeAccess,
      riverAccess,
      riverHex,
      waterAccess,
      fertility,
      roughness,
      routeability,
      passStrength,
      crossingPotential,
      shelter,
      prominence,
      fishPotential,
      forestPotential,
      stonePotential,
      arablePotential,
      huntingPotential,
      resourceDiversity,
      mountainAffinity,
      mountainCore,
      adjacentMountainCoreCount,
      localMountainCoreCount: mountainCount,
      harshness,
      freshwaterAffinity,
      wasteAffinity,
      snowAffinity,
      aridAffinity,
      anomalyPotential,
      wonderPotential,
      remarkableIsolation: distanceToMapEdge(hex, dimensions) <= 2 && routeability < 0.4
    };
    if (signalCache) signalCache.set(hex.id, result);
    return result;
  }

  function scorePassStrength(hex, adjacent, nearby, roughness) {
    const highlandNearby = [hex, ...(nearby || [])].filter(candidate => candidate.baseTerrain === "rock" || hasAnyFeature(candidate, RUGGED_FEATURES)).length;
    const easyLandAdjacent = (adjacent || []).filter(candidate => isPoiLandHex(candidate) && scoreTerrainRoughness(candidate, [candidate]) <= 0.46).length;
    if (highlandNearby < 3) return 0;
    return clamp(
      highlandNearby * 0.08
      + easyLandAdjacent * 0.08
      + (roughness <= 0.54 ? 0.12 : 0)
      + (Number(hex?.elevation || 0) >= 2 ? 0.06 : 0),
      0,
      1,
      0.18
    );
  }

  function scoreCrossingPotential(hex, adjacent, riverData, routeability) {
    const riverHex = riverData.riverHexIds.has(hex.id);
    const riverAdjacentCount = (adjacent || []).filter(candidate => riverData.riverHexIds.has(candidate.id)).length;
    if (!riverHex && riverAdjacentCount < 2) return 0;
    const degree = riverData.degreeByHexId.get(hex.id) || riverAdjacentCount;
    const landAdjacency = (adjacent || []).filter(isPoiLandHex).length;
    return clamp(
      (riverHex ? 0.36 : 0.18)
      + degree * 0.08
      + Math.min(0.18, landAdjacency * 0.03)
      + routeability * 0.22,
      0,
      1,
      0.24
    );
  }

  function countNearbyFeatureMatches(signals, featureSet) {
    return [signals?.hex, ...(signals?.adjacent || []), ...(signals?.nearby || [])]
      .filter(Boolean)
      .filter(candidate => hasAnyFeature(candidate, featureSet))
      .length;
  }

  function isEasyPassApproachHex(hex) {
    return Boolean(hex)
      && isPoiLandHex(hex)
      && !isMountainCoreHex(hex)
      && !hasAnyFeature(hex, CANYON_FEATURES)
      && scoreTerrainRoughness(hex, [hex]) <= 0.48;
  }

  function isMountainCoreHex(hex) {
    return Boolean(hex) && (hex.baseTerrain === "rock" || hasAnyFeature(hex, MOUNTAIN_FEATURES));
  }

  function countAdjacentPassApproachHexes(signals) {
    return (signals?.adjacent || [])
      .filter(isEasyPassApproachHex)
      .length;
  }

  function countNearbyPassBypassHexes(signals) {
    return (signals?.nearby || []).filter(isEasyPassApproachHex).length;
  }

  function countAdjacentCanyonWallHexes(signals) {
    return (signals?.adjacent || []).filter(isCanyonWallHex).length;
  }

  function countNearbyCanyonWallHexes(signals) {
    return [signals?.hex, ...(signals?.nearby || [])]
      .filter(Boolean)
      .filter(isCanyonWallHex)
      .length;
  }

  function isCanyonWallHex(hex) {
    return Boolean(hex) && (
      isMountainCoreHex(hex)
      || hasAnyFeature(hex, CANYON_FEATURES)
      || (Number(hex.elevation || 0) >= 3 && scoreTerrainRoughness(hex, [hex]) >= 0.58)
    );
  }

  function getMountainBarrierScore(signals) {
    if (!signals) return 0;
    return clamp(
      (signals.mountainCore ? 0.34 : 0)
      + signals.adjacentMountainCoreCount * 0.15
      + signals.localMountainCoreCount * 0.08
      + signals.passStrength * 0.22
      + Math.max(0, signals.roughness - 0.5) * 0.18
      + (signals.prominence >= 0.44 ? 0.06 : 0),
      0,
      1.6,
      0
    );
  }

  function isDryCanyonHex(signals) {
    return Boolean(signals)
      && BARREN_TERRAINS.has(signals.hex?.baseTerrain)
      && signals.wasteAffinity >= 0.42;
  }

  function hasCanyonHostTerrain(signals) {
    return Boolean(signals)
      && (
        isCanyonWallHex(signals.hex)
        || countAdjacentCanyonWallHexes(signals) >= 3
      );
  }

  function hasOpenPassBypassRisk(signals) {
    if (!signals) return false;
    const adjacentOpenings = countAdjacentPassApproachHexes(signals);
    const nearbyBypassHexes = countNearbyPassBypassHexes(signals);
    if (adjacentOpenings >= 3) return true;
    if (adjacentOpenings >= 2 && nearbyBypassHexes >= 5) return true;
    if (signals.coastal && adjacentOpenings >= 2) return true;
    if (signals.coastal && nearbyBypassHexes >= 4) return true;
    return false;
  }

  function isValidCorridorPassCandidate({ icon, signals }) {
    if (!signals || !icon) return false;
    if (icon === "canyon_pass") {
      return (signals.riverHex || isDryCanyonHex(signals))
        && hasCanyonHostTerrain(signals)
        && countAdjacentCanyonWallHexes(signals) >= 2
        && countNearbyCanyonWallHexes(signals) >= 4
        && !hasOpenPassBypassRisk(signals);
    }
    if (!signals.mountainCore) return false;
    return !hasOpenPassBypassRisk(signals);
  }

  function hasMountainPassProfile(signals) {
    return Boolean(signals)
      && signals.passStrength >= 0.42
      && signals.mountainCore
      && (signals.localMountainCoreCount >= 1 || signals.adjacentMountainCoreCount >= 1)
      && countAdjacentPassApproachHexes(signals) >= 1
      && countAdjacentPassApproachHexes(signals) <= 4
      && !hasOpenPassBypassRisk(signals);
  }

  function hasCanyonPassProfile(signals) {
    return Boolean(signals)
      && !hasMountainPassProfile(signals)
      && signals.passStrength >= 0.56
      && (signals.riverHex || isDryCanyonHex(signals))
      && hasCanyonHostTerrain(signals)
      && countAdjacentCanyonWallHexes(signals) >= 2
      && countNearbyCanyonWallHexes(signals) >= 4
      && !hasOpenPassBypassRisk(signals);
  }

  function scoreTerrainFertility(hex, local) {
    const base = {
      lush_grassland: 1,
      grassland: 0.88,
      plains: 0.82,
      wetland: 0.54,
      jungle_floor: 0.64,
      beach: 0.24,
      barrens: 0.18,
      bleak_barrens: 0.12,
      desert: 0.08,
      deep_desert: 0.03,
      snow: 0.18,
      rock: 0.1,
      wastes: 0.02
    }[hex.baseTerrain] ?? (TERRAIN_PROFILES[hex.baseTerrain]?.group === "fertile" ? 0.8 : 0.25);
    return clamp(base, 0, 1.05, 0.3);
  }

  function scoreTerrainRoughness(hex, local) {
    let score = {
      beach: 0.24,
      plains: 0.14,
      grassland: 0.12,
      lush_grassland: 0.18,
      wetland: 0.58,
      jungle_floor: 0.66,
      desert: 0.42,
      deep_desert: 0.56,
      barrens: 0.42,
      bleak_barrens: 0.5,
      snow: 0.54,
      rock: 0.84,
      wastes: 0.74
    }[hex.baseTerrain] ?? 0.46;
    if ((hex.features || []).some(feature => RUGGED_FEATURES.has(feature))) score += 0.14;
    if ((hex.features || []).some(feature => FOREST_FEATURES.has(feature))) score += 0.06;
    return clamp(score, 0.05, 1, 0.4);
  }

  function distanceToMapEdge(hex, dimensions) {
    return Math.min(
      Math.abs(hex.x - dimensions.minX),
      Math.abs(dimensions.maxX - hex.x),
      Math.abs(hex.y - dimensions.minY),
      Math.abs(dimensions.maxY - hex.y)
    );
  }

  function findNearestSettlementAnchor(hex, settlementAnchors) {
    return findNearestPoiAnchor(hex, settlementAnchors);
  }

  function findNearestPoiAnchor(hex, anchors) {
    if (!hex || !Array.isArray(anchors) || !anchors.length) return null;
    return anchors
      .filter(anchor => anchor?.hex?.id)
      .map(anchor => ({
        anchor,
        distance: hexDistance(hex, anchor.hex)
      }))
      .sort((left, right) => left.distance - right.distance || (right.anchor.importance || 0) - (left.anchor.importance || 0))[0] || null;
  }

  function getCorridorPressure(hex, corridorStats, byCoord) {
    const local = [hex, ...nearbyWithin(hex, byCoord, 1)];
    const total = local.reduce((sum, candidate) => sum + Number(corridorStats.get(candidate.id)?.importance || 0), 0);
    return clamp(total / 3.2, 0, 1.6, 0);
  }

  function selectRankedCandidates(candidates, targetCount, spacingRadius = 2, placedPoiRefs = [], options = {}) {
    const chosen = [];
    const pool = Array.isArray(candidates) ? [...candidates] : [];
    const variantUsage = options?.variantUsage instanceof Map ? options.variantUsage : null;
    while (chosen.length < targetCount) {
      const best = pool
        .map(candidate => ({
          candidate,
          score: candidate.score
            - getSelectedSpacingPenalty(candidate.hex, chosen, spacingRadius)
            - getPlacedPoiClusterPenalty(candidate.hex, placedPoiRefs, spacingRadius + 1, { ignoreTypes: ["settlement"] })
            - getVariantUsagePenalty(candidate, variantUsage, options)
        }))
        .filter(entry => entry.score >= 0.28)
        .sort((left, right) => right.score - left.score || left.candidate.hex.id.localeCompare(right.candidate.hex.id))[0];
      if (!best) break;
      chosen.push(best.candidate);
      registerVariantUsage(best.candidate, variantUsage);
      pool.splice(pool.findIndex(candidate => candidate.hex.id === best.candidate.hex.id), 1);
    }
    return chosen;
  }

  function getVariantUsagePenalty(candidate, usageMap, options = {}) {
    if (!(usageMap instanceof Map)) return 0;
    const key = String(candidate?.icon || "").trim().toLowerCase();
    if (!key) return 0;
    const count = usageMap.get(key) || 0;
    if (!count) return 0;
    const softCap = typeof options.variantSoftCap === "function"
      ? Math.max(0, Number(options.variantSoftCap(candidate)) || 0)
      : Math.max(0, Number(options.variantSoftCap ?? 1) || 1);
    const base = Number(options.variantPenaltyBase ?? 0.08) || 0.08;
    const step = Number(options.variantPenaltyStep ?? 0.12) || 0.12;
    const gentlePenalty = Math.min(count, softCap) * base * 0.35;
    if (count < softCap) return gentlePenalty;
    return gentlePenalty + (count - softCap + 1) * step;
  }

  function registerVariantUsage(candidate, usageMap) {
    if (!(usageMap instanceof Map)) return;
    const key = String(candidate?.icon || "").trim().toLowerCase();
    if (!key) return;
    usageMap.set(key, (usageMap.get(key) || 0) + 1);
  }

  function getSelectedSpacingPenalty(hex, selected, radius) {
    return (selected || []).reduce((penalty, candidate) => {
      const distance = hexDistance(hex, candidate.hex);
      if (distance <= Math.max(1, radius - 1)) return penalty + 0.42;
      if (distance <= radius) return penalty + 0.14;
      return penalty;
    }, 0);
  }

  function getPlacedPoiClusterPenalty(hex, placedPoiRefs, radius = 3, options = {}) {
    const ignoreTypes = new Set(Array.isArray(options.ignoreTypes) ? options.ignoreTypes : []);
    return (placedPoiRefs || []).reduce((penalty, ref) => {
      if (!ref?.hex?.id || ignoreTypes.has(ref.type)) return penalty;
      const distance = hexDistance(hex, ref.hex);
      if (distance > radius) return penalty;
      const typeWeight = ref.type === "resource_site"
        ? 0.24
        : ref.type === "waypoint"
          ? 0.18
          : ref.type === "stronghold"
            ? 0.22
            : ref.type === "dungeon" || ref.type === "dungeon_complex"
              ? 0.16
              : 0.14;
      if (distance <= Math.max(1, radius - 2)) return penalty + typeWeight;
      if (distance <= radius) return penalty + typeWeight * 0.45;
      return penalty;
    }, 0);
  }

  function getSettlementSpacingPenalty(hex, chosen, existingAnchors) {
    const anchors = [
      ...(chosen || []).map(candidate => candidate.hex).filter(Boolean),
      ...(existingAnchors || []).map(anchor => anchor.hex).filter(Boolean)
    ];
    return anchors.reduce((penalty, anchorHex) => {
      const distance = hexDistance(hex, anchorHex);
      if (distance <= 2) return penalty + 2.4;
      if (distance === 3) return penalty + 1.1;
      if (distance === 4) return penalty + 0.46;
      if (distance === 5) return penalty + 0.18;
      return penalty;
    }, 0);
  }

  function getSettlementPreferencePenalty(candidate, chosen) {
    if (!candidate || !Array.isArray(chosen) || !chosen.length) return 0;
    const coastalCount = chosen.filter(entry => entry?.coastal).length;
    const warmCount = chosen.filter(isWarmPreferredSettlementCandidate).length;
    let penalty = 0;
    if (candidate.coastal && coastalCount > 0) penalty += 0.52 + coastalCount * 0.28;
    if (isWarmPreferredSettlementCandidate(candidate) && warmCount > 0) {
      penalty += warmCount * (candidate.coastal ? 0.14 : 0.26);
    }
    if (candidate.primaryRole === "coastal_harbor" && coastalCount > 0) {
      penalty += 0.18 * coastalCount;
    }
    if (candidate.coastal && coastalCount > 0 && chosen.length < 3) {
      penalty += 1.1;
    }
    if (isWarmPreferredSettlementCandidate(candidate) && warmCount > 0 && chosen.length < 4) {
      penalty += 0.7;
    }
    return penalty;
  }

  function isWarmPreferredSettlementCandidate(candidate) {
    if (!candidate) return false;
    return candidate.arablePotential >= 0.62
      && candidate.snowAffinity < 0.42
      && candidate.wasteAffinity < 0.42;
  }

  function chooseSettlementIcon(candidate, sizeTier, populationValue) {
    const actualMountainHex = hasAnyFeature(candidate?.hex, MOUNTAIN_FEATURES);
    const mountainHex = actualMountainHex;
    const strongMountain = mountainHex
      && (candidate.localMountainCoreCount >= 1 || candidate.adjacentMountainCoreCount >= 1 || candidate.mountainAffinity >= 0.82);
    if (strongMountain) {
      if (sizeTier === "village") return "mountain_hold";
      return hashNumber(`${candidate.hex.id}:${sizeTier}:mountain-settlement`) % 2 === 0
        ? "mountain_city"
        : "mountain_hold";
    }
    if (candidate.primaryRole === "coastal_harbor") {
      if (sizeTier === "grand_hub" || sizeTier === "city" || populationValue >= 9000) return "port_town";
      return "port_town";
    }
    if (sizeTier === "grand_hub" || sizeTier === "city") {
      return candidate.passStrength >= 0.58 || candidate.prominence >= 0.54 ? "walled_city" : "city";
    }
    if (sizeTier === "town") {
      if (candidate.passStrength >= 0.5 || candidate.prominence >= 0.58 || candidate.mountainAffinity >= 0.74) return "hilltop_town";
      return "village";
    }
    return strongMountain ? "mountain_hold" : "village";
  }

  function getSettlementImportanceFromTier(sizeTier, populationValue) {
    if (sizeTier === "grand_hub") return 1.42;
    if (sizeTier === "city") return populationValue >= 12000 ? 1.08 : 1.0;
    if (sizeTier === "town") return 0.78;
    return 0.52;
  }

  function generateSettlementPopulation(sizeTier, candidate, settings, hierarchyScore) {
    const concentration = clamp(settings.populationConcentration, 0.5, 1.5, 1);
    const scoreScale = 0.86 + clamp(hierarchyScore, 0, 1.4, 0.6) * 0.24;
    if (sizeTier === "grand_hub") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 22000, 52000) * (0.72 + concentration * 0.82) * scoreScale;
    if (sizeTier === "city") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 7000, 22000) * (0.72 + concentration * 0.82) * scoreScale;
    if (sizeTier === "town") return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 1800, 8000) * (1.24 - (concentration - 0.5) * 0.34) * scoreScale;
    return randomIntegerFromSeed(`${settings.seed}:population:${candidate.hex.id}`, 250, 2600) * (1.18 - (concentration - 0.5) * 0.28) * Math.max(0.74, scoreScale * 0.92);
  }

  function getGeneratedSettlementTags(candidate, sizeTier, icon) {
    const tags = [];
    if (candidate.primaryRole === "coastal_harbor" || candidate.routeability >= 0.72) tags.push("trade");
    if (candidate.primaryRole === "river_crossing" || candidate.passStrength >= 0.56) tags.push("crossroads");
    if (candidate.fishPotential >= 0.7) tags.push("fishing");
    if (
      candidate.arablePotential >= 0.72
      && candidate.mountainAffinity < 0.62
      && candidate.snowAffinity < 0.46
      && candidate.wasteAffinity < 0.34
      && candidate.fishPotential < 0.82
    ) tags.push("farming");
    if (candidate.stonePotential >= 0.62 || candidate.forestPotential >= 0.62) tags.push("craftwork");
    if (candidate.snowAffinity >= 0.52 || candidate.wasteAffinity >= 0.5) tags.push("frontier");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getGeneratedSettlementNotoriety(sizeTier, candidate, populationValue) {
    let value = sizeTier === "grand_hub" ? 2 : sizeTier === "city" ? 4 : sizeTier === "town" ? 6 : 7;
    if (candidate.primaryRole === "coastal_harbor" || candidate.primaryRole === "river_crossing") value -= 1;
    if (candidate.snowAffinity >= 0.56 || candidate.wasteAffinity >= 0.54) value += 1;
    if (populationValue >= 16000) value -= 1;
    return String(Math.max(2, Math.min(9, value)));
  }

  function chooseRoadstopWaypointIcon(signals, corridorImportance) {
    if (signals.snowAffinity >= 0.5 || signals.mountainAffinity >= 0.66 || signals.forestPotential >= 0.72) return "lodge";
    if (corridorImportance >= 0.95) return "inn";
    if (signals.edgeDistance <= 2 && signals.routeability < 0.54) return "campsite";
    return "tavern";
  }

  function getRoadstopWaypointTags(signals, icon) {
    const tags = ["rest", "roadside"];
    if (icon === "inn") tags.push("trade");
    if (signals.snowAffinity >= 0.5 || signals.edgeDistance <= 2) tags.push("frontier");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getRoadstopWaypointNotoriety(corridorImportance) {
    const value = corridorImportance >= 1 ? 6 : corridorImportance >= 0.72 ? 7 : 8;
    return String(Math.max(5, Math.min(9, value)));
  }

  function chooseCrossingWaypointIcon(signals, routeImportance, corridorRecord) {
    const corridorCount = Number(corridorRecord?.count || 0);
    if (routeImportance >= 1.15 && corridorCount >= 2 && signals.prominence >= 0.42 && signals.routeability >= 0.5) return "bridge_gate";
    if ((signals.coastal || signals.lakeAccess) && routeImportance < 1.18) return "ferry";
    if (routeImportance >= 0.98 || (corridorCount >= 2 && signals.routeability >= 0.5)) return "bridge";
    if ((signals.coastal || signals.lakeAccess) && signals.routeability < 0.5) return "ferry";
    return "ford";
  }

  function getCrossingWaypointTags(signals, icon) {
    const tags = ["river_crossing"];
    if (signals.passStrength >= 0.56) tags.push("crossroads");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getCrossingWaypointNotoriety(routeImportance, icon) {
    let value = icon === "bridge_gate" ? 5 : icon === "bridge" ? 6 : 7;
    if (routeImportance >= 1.1) value -= 1;
    return String(Math.max(4, Math.min(8, value)));
  }

  function choosePassWaypointIcon(signals) {
    if (hasMountainPassProfile(signals)) return "mountain_pass";
    if (hasCanyonPassProfile(signals)) return "canyon_pass";
    return "";
  }

  function getPassWaypointTags(signals, icon, supportDistance) {
    const tags = ["crossroads"];
    if (supportDistance >= 4 || signals.edgeDistance <= 2) tags.push("frontier");
    return mergeGeneratedTagsForIcon(tags, icon);
  }

  function getPassWaypointNotoriety(routeImportance, icon, supportDistance) {
    let value = icon === "mountain_pass" ? 6 : 7;
    if (routeImportance >= 1.05) value -= 1;
    if (supportDistance >= 5) value += 1;
    return String(Math.max(4, Math.min(8, value)));
  }

  function isPoiLandHex(hex) {
    return Boolean(hex && !isWaterBase(hex.baseTerrain));
  }

  function isViableSettlementHex(hex) {
    return Boolean(hex && isPoiLandHex(hex) && !HARSH_TERRAINS.has(hex.baseTerrain));
  }

  function hasAnyFeature(hex, featureSet) {
    return (hex?.features || []).some(feature => featureSet.has(feature));
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

  function findPoiLandPathDetailed(startHexId, goalHexId, byId, byCoord, riverData, dimensions, signalCache) {
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
      if (current.id === goal.id) {
        const sequence = reconstructPoiPath(cameFrom, current.id);
        return {
          sequence,
          cost: gScore.get(current.id) || 0,
          pathSignals: summarizePathSignals(sequence, byId, byCoord, riverData, dimensions, signalCache)
        };
      }
      neighbors(current, byCoord).forEach(neighbor => {
        if (!isPoiLandHex(neighbor)) return;
        const tentative = (gScore.get(current.id) || 0) + getPoiTravelStepCost(neighbor, byCoord, riverData, dimensions, signalCache);
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

  function summarizePathSignals(sequence, byId, byCoord, riverData, dimensions, signalCache) {
    const riverHexIds = new Set();
    const passHexIds = new Set();
    (sequence || []).forEach(hexId => {
      const hex = byId.get(hexId);
      if (!hex) return;
      const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
      if (riverData.riverHexIds.has(hexId)) riverHexIds.add(hexId);
      if (hasMountainPassProfile(signals)) passHexIds.add(hexId);
    });
    return {
      riverHexIds,
      passHexIds,
      riverCrossings: riverHexIds.size
    };
  }

  function getPoiTravelStepCost(hex, byCoord, riverData, dimensions, signalCache) {
    const signals = getHexSignals(hex, byCoord, riverData, dimensions, signalCache);
    let cost = 1 + signals.roughness * 1.34;
    if (hasMountainPassProfile(signals)) cost -= 0.2;
    if (signals.riverAccess && !signals.riverHex) cost -= 0.08;
    if (signals.coastal) cost -= 0.05;
    if (signals.crossingPotential >= 0.52) cost -= 0.06;
    return Math.max(0.45, cost);
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

  function createUnionFind(ids) {
    const parent = new Map((ids || []).map(id => [id, id]));
    return {
      find(value) {
        const base = parent.get(value);
        if (base === value) return value;
        const root = this.find(base);
        parent.set(value, root);
        return root;
      },
      union(left, right) {
        const leftRoot = this.find(left);
        const rightRoot = this.find(right);
        if (leftRoot !== rightRoot) parent.set(leftRoot, rightRoot);
      }
    };
  }

  function getStrongholdAnchorImportance(icon) {
    if (icon === "mountain_gate") return 1.1;
    if (icon === "castle") return 1.02;
    if (icon === "sea_fort") return 0.96;
    if (icon === "fort") return 0.84;
    if (icon === "stone_tower" || icon === "watchtower") return 0.72;
    if (icon === "walled_encampment") return 0.68;
    return 0.62;
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
    const filteredSuffixes = (Array.isArray(suffixes) ? suffixes : []).filter(suffix => normalizeGeneratedNamePartKey(suffix) !== normalizeGeneratedNamePartKey(prefix));
    const suffix = pickGeneratedNamePart(filteredSuffixes.length ? filteredSuffixes : suffixes, `${seed}:suffix`, "suffix", "wick") || "wick";
    let separator = options.forceSpace === true
      ? " "
      : options.forceSpace === false
        ? ""
        : /^(Camp|Cut|Mine|Mill|Port|Quay|Rest|Vale|Keep|Peak|Gate|Bridge|Crossing|Fields|Farms|Docks|Fishery|Stoneworks|Market|Exchange|Post|Inn|Lodge|Roadhouse|Hall|Harbor|Pass|Watch|Fort|Tower|Shore|Ford|Ferry|Vault|Crypt|Caves|Shrine|Temple)$/.test(suffix)
          ? " "
          : "";
    if (!separator && /['’]s?$/.test(prefix)) separator = " ";
    const suffixText = separator ? suffix : lowerCaseGeneratedNamePart(suffix);
    registerGeneratedNameUsage("prefix", prefix);
    registerGeneratedNameUsage("suffix", suffix);
    return `${prefix}${separator}${suffixText}`;
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

    usedNames.add(normalizeGeneratedNameKey(fallbackLabel));
    return fallbackLabel;
  }

  function normalizeGeneratedNameKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  }

  function generateSettlementName(candidate, sizeTier, settings) {
    const seed = `${settings.seed}:settlement:${candidate.hex.id}:${sizeTier}`;
    const cold = candidate.snowAffinity >= 0.52;
    const forested = candidate.forestPotential >= 0.64;
    const stony = candidate.stonePotential >= 0.62 || candidate.mountainAffinity >= 0.74;
    const prefixes = [
      ...NAME_POOLS.genericPrefixes,
      ...(candidate.primaryRole === "coastal_harbor" ? NAME_POOLS.coastPrefixes : []),
      ...(candidate.primaryRole === "river_crossing" || candidate.primaryRole === "river_settlement" ? NAME_POOLS.riverPrefixes : []),
      ...(forested ? NAME_POOLS.forestPrefixes : []),
      ...(stony ? NAME_POOLS.stonePrefixes : []),
      ...(cold ? NAME_POOLS.coldPrefixes : [])
    ];
    const roleSuffixes = candidate.primaryRole === "coastal_harbor"
      ? ["Harbor", "Haven", "Port", "Reach", "Bay", "Quay"]
      : candidate.primaryRole === "river_crossing"
        ? ["Ford", "Bridge", "Cross", "Reach", "Wick", "Stead"]
        : candidate.primaryRole === "river_settlement"
          ? ["Wick", "Stead", "Mere", "Reach", "Brook", "Cross"]
          : candidate.primaryRole === "pass_gate"
            ? ["Gate", "Watch", "Hold", "Pass", "Crest", "March"]
            : candidate.primaryRole === "upland_node"
            ? ["Hold", "Crag", "Crest", "Vale", "Ward", "Peak"]
            : sizeTier === "city" || sizeTier === "grand_hub"
              ? ["Ward", "Hall", "Burg", "Market", "Reach", "Gate"]
              : sizeTier === "town"
                ? ["Wick", "Stead", "Cross", "Ward", "Rest", "Dale"]
                : ["Wick", "Stead", "Cross", "Mere", "Dale", "Vale"];
    const suffixes = [
      ...roleSuffixes,
      ...(cold ? NAME_POOLS.coldSuffixes : []),
      ...(forested ? NAME_POOLS.forestSuffixes : []),
      ...(stony ? NAME_POOLS.stoneSuffixes : [])
    ];
    return buildGeneratedPatternName(seed, [{ prefixes, suffixes, forceSpace: false }]);
  }

  function buildSettlementFallbackName(candidate, sizeTier, icon) {
    if (icon === "port_town") return "Saltreach";
    if (icon === "mountain_city") return "Stone Peak";
    if (icon === "mountain_hold") return "High Hold";
    if (sizeTier === "city" || sizeTier === "grand_hub") return "Grey Ward";
    if (sizeTier === "town") return "Oakwick";
    return "Ravenstead";
  }

  function generateResourceSiteName(candidate, settings) {
    const seed = `${settings.seed}:resource:${candidate.hex.id}:${candidate.icon}`;
    const settlementName = String(candidate.meta?.nearestSettlement || "").trim();
    const suffixes = {
      harbor: ["Harbor", "Quay"],
      docks: ["Docks", "Landing"],
      fishing_camp: ["Fishery", "Fishing Camp"],
      mine: ["Mine", "Delve"],
      quarry: ["Quarry", "Stoneworks"],
      lumber_camp: ["Lumber Camp", "Cut"],
      lumber_mill: ["Lumber Mill", "Mill"],
      farmstead: ["Farms", "Fields"],
      windmill: ["Mill", "Windmill"],
      hunting_blind: ["Hunt", "Blind"],
      warehouse: ["Storehouse", "Warehouse"]
    }[candidate.icon] || ["Works"];
    if (settlementName && Number(candidate.meta?.supportDistance || 0) <= 3) {
      return buildRelatedGeneratedSiteName(seed, settlementName, suffixes, ["Old", "Upper", "Lower", "North", "South"], { qualifierChance: 0.32 });
    }
    return buildGeneratedPatternName(seed, [{
      prefixes: [...NAME_POOLS.genericPrefixes, ...NAME_POOLS.forestPrefixes, ...NAME_POOLS.stonePrefixes],
      suffixes,
      forceSpace: true
    }]);
  }

  function buildResourceSiteFallbackName(candidate) {
    return {
      harbor: "Old Harbor",
      docks: "River Docks",
      fishing_camp: "Fishing Camp",
      mine: "Stone Mine",
      quarry: "Grey Quarry",
      lumber_camp: "Timber Cut",
      lumber_mill: "Timber Mill",
      farmstead: "Green Farms",
      windmill: "West Mill",
      hunting_blind: "Hunter's Blind",
      warehouse: "Storehouse"
    }[candidate.icon] || "Works";
  }

  function generateWaypointName(candidate, settings) {
    const seed = `${settings.seed}:waypoint:${candidate.hex.id}:${candidate.icon}`;
    const routeNames = Array.isArray(candidate.meta?.routeNames) ? candidate.meta.routeNames.filter(Boolean) : [];
    const routeBase = routeNames[0] || "";
    if (routeBase && ["inn", "tavern", "lodge", "campsite"].includes(candidate.icon)) {
      return buildRelatedGeneratedSiteName(seed, routeBase, {
        inn: ["Inn"],
        tavern: ["Tavern"],
        lodge: ["Lodge"],
        campsite: ["Camp"]
      }[candidate.icon], ["Old", "Wayfarer's", "Pilgrim's", "Lantern"], { qualifierChance: 0.42 });
    }
    const suffixes = candidate.icon === "bridge_gate"
      ? ["Bridge", "Gate"]
      : candidate.icon === "bridge"
        ? ["Bridge"]
        : candidate.icon === "ford"
          ? ["Ford"]
          : candidate.icon === "ferry"
            ? ["Ferry", "Landing"]
            : candidate.icon === "mountain_pass"
              ? ["Pass", "Gap", "Notch"]
              : candidate.icon === "canyon_pass"
                ? ["Canyon", "Pass", "Cut"]
              : candidate.icon === "lodge"
                ? ["Lodge", "Rest"]
                : candidate.icon === "inn"
                  ? ["Inn", "Rest"]
                  : candidate.icon === "campsite"
                    ? ["Camp"]
                    : ["Tavern", "Rest"];
    const prefixes = candidate.icon === "ford" || candidate.icon === "bridge" || candidate.icon === "bridge_gate" || candidate.icon === "ferry"
      ? [...NAME_POOLS.riverPrefixes, ...NAME_POOLS.genericPrefixes]
      : candidate.icon === "mountain_pass"
        ? [...NAME_POOLS.stonePrefixes, ...NAME_POOLS.coldPrefixes, ...NAME_POOLS.genericPrefixes]
        : candidate.icon === "canyon_pass"
          ? [...NAME_POOLS.stonePrefixes, ...NAME_POOLS.genericPrefixes]
      : candidate.icon === "lodge"
        ? [...NAME_POOLS.forestPrefixes, ...NAME_POOLS.coldPrefixes, ...NAME_POOLS.genericPrefixes]
        : NAME_POOLS.genericPrefixes;
    return buildGeneratedPatternName(seed, [{ prefixes, suffixes, forceSpace: true }]);
  }

  function buildWaypointFallbackName(candidate) {
    return {
      inn: "Lantern Inn",
      tavern: "Crossroads Tavern",
      lodge: "Pine Lodge",
      campsite: "Wayfarer Camp",
      bridge_gate: "Stone Bridge",
      bridge: "Grey Bridge",
      ford: "Raven Ford",
      ferry: "River Ferry",
      mountain_pass: "High Pass",
      canyon_pass: "Stone Canyon"
    }[candidate.icon] || "Roadstop";
  }

  function generateStrongholdName(candidate, settings) {
    const seed = `${settings.seed}:stronghold:${candidate.hex.id}:${candidate.icon}`;
    const settlementName = String(candidate.meta?.nearestSettlement || "").trim();
    const relatedMountainSettlement = ["pass_gate", "upland_node"].includes(String(candidate.meta?.nearestSettlementRole || ""))
      && Number(candidate.meta?.supportDistance || 0) <= 3;
    const suffixes = candidate.icon === "sea_fort"
      ? ["Sea Fort", "Watch", "Fort"]
      : candidate.icon === "mountain_gate"
        ? (relatedMountainSettlement ? ["Gate", "Pass Keep", "Gatehouse"] : ["Keep", "Hold", "Redoubt"])
        : candidate.icon === "watchtower" || candidate.icon === "stone_tower"
          ? ["Tower", "Watch", "Spire"]
          : candidate.icon === "walled_encampment"
            ? ["Camp", "Redoubt", "Hold"]
            : candidate.icon === "castle"
              ? ["Keep", "Castle", "Hold"]
              : ["Fort", "Keep", "Redoubt"];
    if (settlementName && Number(candidate.meta?.supportDistance || 0) <= 3) {
      return buildRelatedGeneratedSiteName(seed, settlementName, suffixes, ["North", "South", "East", "West", "Old", "High"], { qualifierChance: 0.34 });
    }
    return buildGeneratedPatternName(seed, [{
      prefixes: [...NAME_POOLS.strongholdPrefixes, ...NAME_POOLS.stonePrefixes],
      suffixes,
      forceSpace: true
    }]);
  }

  function buildStrongholdFallbackName(candidate) {
    if (candidate.icon === "sea_fort") return "Grey Sea Fort";
    if (candidate.icon === "mountain_gate") {
      return ["pass_gate", "upland_node"].includes(String(candidate.meta?.nearestSettlementRole || ""))
        && Number(candidate.meta?.supportDistance || 0) <= 3
        ? "Stone Gate"
        : "Stone Keep";
    }
    if (candidate.icon === "watchtower" || candidate.icon === "stone_tower") return "High Watch";
    if (candidate.icon === "walled_encampment") return "Frontier Redoubt";
    if (candidate.icon === "castle") return "Old Keep";
    return "Stone Fort";
  }

  function generateDungeonName(candidate, settings) {
    const seed = `${settings.seed}:dungeon:${candidate.hex.id}:${candidate.icon}`;
    const strongholdName = String(candidate.meta?.strongholdName || "").trim();
    const settlementName = String(candidate.meta?.nearestSettlement || "").trim();
    const relatedBaseName = strongholdName || settlementName;
    const suffixes = candidate.icon === "cave"
      ? ["Caves", "Cavern", "Hollow", "Grotto"]
      : candidate.icon === "catacombs"
        ? ["Catacombs", "Vaults", "Tombs"]
        : candidate.icon === "crypt"
          ? ["Crypt", "Tomb", "Vault"]
          : candidate.icon === "lair" || candidate.icon === "dragon_lair"
            ? ["Lair", "Maw", "Den"]
            : ["Dungeon", "Deeps", "Vault"];
    if (relatedBaseName) {
      return buildRelatedGeneratedSiteName(seed, relatedBaseName, suffixes, ["Old", "Black", "Hidden", "Deep"], { qualifierChance: 0.36, qualifierAfter: true });
    }
    return buildGeneratedPatternName(seed, [{
      prefixes: [...NAME_POOLS.stonePrefixes, ...NAME_POOLS.coldPrefixes, "Black", "Iron", "Ash", "Wolf"],
      suffixes,
      forceSpace: true
    }]);
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

  function uniqueGeneratedNameParts(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
  }

  function getSiteTerrainNamePrefixes(candidate) {
    const hex = candidate?.hex || {};
    const baseTerrain = String(hex.baseTerrain || "").trim();
    const prefixes = [...NAME_POOLS.genericPrefixes];
    if (baseTerrain === "snow" || (hex.features || []).includes("snowcapped_mountains")) {
      prefixes.push(...NAME_POOLS.coldPrefixes);
    }
    if (hasAnyFeature(hex, FOREST_FEATURES)) {
      prefixes.push(...NAME_POOLS.forestPrefixes);
    }
    if (baseTerrain === "rock" || hasAnyFeature(hex, RUGGED_FEATURES)) {
      prefixes.push(...NAME_POOLS.stonePrefixes);
    }
    if (baseTerrain === "desert" || baseTerrain === "deep_desert") {
      prefixes.push(...NAME_POOLS.aridPrefixes);
    }
    if (baseTerrain === "barrens" || baseTerrain === "bleak_barrens" || baseTerrain === "wastes") {
      prefixes.push(...NAME_POOLS.wastePrefixes);
    }
    return prefixes;
  }

  function getSiteNameProfile(candidate) {
    const icon = String(candidate?.icon || "").trim();
    const terrainPrefixes = getSiteTerrainNamePrefixes(candidate);
    switch (icon) {
      case "ruins":
        return {
          prefixes: [...terrainPrefixes, ...NAME_POOLS.stonePrefixes],
          suffixes: ["Ruins", "Old Hall", "Fallen Keep", "Broken Tower"],
          fallback: "Old Ruins"
        };
      case "abandoned_shack":
        return {
          prefixes: [...terrainPrefixes, ...NAME_POOLS.wildPrefixes],
          suffixes: ["Shack", "Croft", "Cabin", "Hut"],
          fallback: "Lost Shack"
        };
      case "shipwreck":
        return {
          prefixes: [...NAME_POOLS.coastPrefixes, ...terrainPrefixes],
          suffixes: ["Wreck", "Shoals", "Hull", "Bones"],
          fallback: "Salt Wreck"
        };
      case "pyramid":
        return {
          prefixes: [...NAME_POOLS.aridPrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Pyramid", "Tomb", "Vault"],
          fallback: "Sun Pyramid"
        };
      case "abbey":
        return {
          prefixes: [...NAME_POOLS.sacredPrefixes, ...terrainPrefixes],
          suffixes: ["Abbey", "Priory", "House"],
          fallback: "Quiet Abbey"
        };
      case "temple":
        return {
          prefixes: [...NAME_POOLS.sacredPrefixes, ...terrainPrefixes],
          suffixes: ["Temple", "Sanctum", "House"],
          fallback: "Sacred Temple"
        };
      case "shrine":
        return {
          prefixes: [...NAME_POOLS.sacredPrefixes, ...terrainPrefixes],
          suffixes: ["Shrine", "Chapel", "Sanctum"],
          fallback: "Quiet Shrine"
        };
      case "roadside_shrine":
        return {
          prefixes: [...NAME_POOLS.sacredPrefixes, ...NAME_POOLS.riverPrefixes, ...terrainPrefixes],
          suffixes: ["Wayshrine", "Road Shrine", "Chapel"],
          fallback: "Pilgrim Shrine"
        };
      case "sacred_grove":
        return {
          prefixes: [...NAME_POOLS.sacredPrefixes, ...NAME_POOLS.wildPrefixes, ...NAME_POOLS.forestPrefixes, ...terrainPrefixes],
          suffixes: ["Grove", "Glade", "Hollow"],
          fallback: "Sacred Grove"
        };
      case "arcane_portal":
        return {
          prefixes: [...NAME_POOLS.arcanePrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Gate", "Portal", "Veil", "Rift"],
          fallback: "Glass Gate"
        };
      case "observatory":
        return {
          prefixes: [...NAME_POOLS.arcanePrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Observatory", "Watch", "Spire"],
          fallback: "Star Observatory"
        };
      case "wizard_tower":
        return {
          prefixes: [...NAME_POOLS.arcanePrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Tower", "Spire", "Needle"],
          fallback: "Glass Tower"
        };
      case "waterfall":
        return {
          prefixes: [...NAME_POOLS.wildPrefixes, ...NAME_POOLS.riverPrefixes, ...terrainPrefixes],
          suffixes: ["Falls", "Cascade"],
          fallback: "Still Falls"
        };
      case "spring":
        return {
          prefixes: [...NAME_POOLS.wildPrefixes, ...NAME_POOLS.riverPrefixes, ...terrainPrefixes],
          suffixes: ["Spring", "Well", "Source"],
          fallback: "Still Spring"
        };
      case "tree":
        return {
          prefixes: [...NAME_POOLS.wildPrefixes, ...NAME_POOLS.forestPrefixes, ...terrainPrefixes],
          suffixes: ["Tree", "Grove", "Glade", "Hollow"],
          fallback: "Old Grove"
        };
      case "dead_tree":
        return {
          prefixes: [...NAME_POOLS.wildPrefixes, ...NAME_POOLS.wastePrefixes, ...NAME_POOLS.coldPrefixes, ...terrainPrefixes],
          suffixes: ["Tree", "Snag", "Deadwood", "Hollow"],
          fallback: "Bleak Deadwood"
        };
      case "island":
      case "island_2":
        return {
          prefixes: [...NAME_POOLS.coastPrefixes, ...NAME_POOLS.wildPrefixes, ...terrainPrefixes],
          suffixes: ["Isle", "Cay", "Holm"],
          fallback: "Lost Isle"
        };
      case "bandit_camp":
        return {
          prefixes: [...NAME_POOLS.wastePrefixes, ...terrainPrefixes],
          suffixes: ["Camp", "Hideout", "Den"],
          fallback: "Broken Camp"
        };
      case "battlefield":
        return {
          prefixes: [...NAME_POOLS.wastePrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Field", "Ground", "March"],
          fallback: "Ash Field"
        };
      case "crater":
        return {
          prefixes: [...NAME_POOLS.wastePrefixes, ...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Crater", "Scar", "Pit"],
          fallback: "Black Crater"
        };
      case "standing_stones":
        return {
          prefixes: [...NAME_POOLS.wildPrefixes, ...terrainPrefixes],
          suffixes: ["Stones", "Circle"],
          fallback: "Stone Circle"
        };
      case "obelisk":
        return {
          prefixes: [...NAME_POOLS.stonePrefixes, ...terrainPrefixes],
          suffixes: ["Obelisk", "Needle", "Monument"],
          fallback: "Stone Obelisk"
        };
      case "lighthouse":
        return {
          prefixes: [...NAME_POOLS.coastPrefixes, ...NAME_POOLS.genericPrefixes, ...terrainPrefixes],
          suffixes: ["Light", "Beacon", "Watch"],
          fallback: "Stone Beacon"
        };
      default:
        return {
          prefixes: terrainPrefixes,
          suffixes: ["Site"],
          fallback: "Old Site"
        };
    }
  }

  function generateSiteName(candidate, settings) {
    const seed = `${settings.seed}:site:${candidate.hex.id}:${candidate.icon}`;
    const profile = getSiteNameProfile(candidate);
    return buildGeneratedPatternName(seed, [{
      prefixes: uniqueGeneratedNameParts(profile.prefixes),
      suffixes: uniqueGeneratedNameParts(profile.suffixes),
      forceSpace: true
    }]);
  }

  function buildSiteFallbackName(candidate) {
    return getSiteNameProfile(candidate).fallback || {
      ruin: "Old Ruins",
      holy_site: "Quiet Shrine",
      arcane_site: "Glass Tower",
      wilderness_site: "Still Spring",
      hazard: "Broken Camp",
      landmark: "Stone Beacon"
    }[candidate.type] || "Old Site";
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

  window.CampaignGeneratedPoiGenerator = {
    generatePoiDrafts,
    hashNumber
  };

  window.CampaignGeneratedMapGenerator = {
    ...(window.CampaignGeneratedMapGenerator || {}),
    generatePoiDrafts,
    hashNumber
  };
})();
