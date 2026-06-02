(function () {
  const shared = window.CampaignGeneratedMapGeneratorShared;
  if (!shared) {
    console.error("CampaignGeneratedMapGeneratorShared must load before generated-map-generator.js.");
    return;
  }

  const {
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

  function normalizePoiOptions(options = {}) {
    return {
      seed: String(options.seed || "waymark-codex-pois"),
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

      const settlementCandidates = candidateHexes
        .map(hex => buildSettlementCandidate(hex, byId, byCoord, dimensions, riverData, settings))
        .filter(Boolean);

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
      waypointDrafts.forEach(draft => occupiedHexIds.add(draft.hexId));

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

      return [...settlementDrafts, ...resourceDrafts, ...waypointDrafts, ...strongholdDrafts, ...dungeonComplexDrafts, ...dungeonDrafts, ...siteDrafts].map(({ meta, ...draft }) => draft);
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

  function buildPoiHabitatPools(candidates, getHabitatKey) {
    const pools = new Map();
    if (typeof getHabitatKey !== "function") return pools;
    (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
      if (!candidate) return;
      const key = String(getHabitatKey(candidate) || "").trim() || "inland";
      if (!pools.has(key)) pools.set(key, []);
      pools.get(key).push(candidate);
    });
    return pools;
  }

  function buildPoiHabitatTargets(candidatesOrPools, targetCount, getHabitatKey, options = {}) {
    const pools = candidatesOrPools instanceof Map
      ? new Map(
          [...candidatesOrPools.entries()]
            .map(([key, list]) => [String(key || "").trim(), Array.isArray(list) ? list.filter(Boolean) : []])
            .filter(([key, list]) => key && list.length)
        )
      : buildPoiHabitatPools(candidatesOrPools, getHabitatKey);
    if (!pools.size || !targetCount) return new Map();

    const minimumShare = Number.isFinite(Number(options.minimumShare)) ? Math.max(0, Number(options.minimumShare)) : 0.16;
    const minimumCount = Number.isFinite(Number(options.minimumCount)) ? Math.max(1, Number(options.minimumCount)) : 3;
    const weightFn = typeof options.weightFn === "function" ? options.weightFn : null;
    const entries = [...pools.entries()]
      .map(([key, list]) => ({ key, count: list.length }))
      .filter(entry => entry.count > 0);
    if (!entries.length) return new Map();

    const totalAvailable = Math.max(1, entries.reduce((sum, entry) => sum + entry.count, 0));
    const targets = new Map();
    let assigned = 0;

    const guaranteed = entries
      .filter(entry => entry.count >= minimumCount && entry.count / totalAvailable >= minimumShare)
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
    guaranteed.slice(0, Math.min(targetCount, guaranteed.length)).forEach(entry => {
      targets.set(entry.key, 1);
      assigned += 1;
    });

    while (assigned < targetCount) {
      const best = entries
        .map(entry => {
          const current = targets.get(entry.key) || 0;
          if (current >= entry.count) return null;
          const share = entry.count / totalAvailable;
          const dominantBoost = share >= 0.5
            ? 1.22
            : share >= 0.35
              ? 1.12
              : share >= minimumShare
                ? 1.04
                : 0.92;
          const baseWeight = Math.pow(entry.count, 1.04) * dominantBoost;
          const customWeight = weightFn ? Number(weightFn(entry.key, entry.count, current)) : 1;
          const weight = baseWeight * (Number.isFinite(customWeight) && customWeight > 0 ? customWeight : 1);
          return {
            key: entry.key,
            count: entry.count,
            score: weight / (current + 1)
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || right.count - left.count || left.key.localeCompare(right.key))[0];
      if (!best) break;
      targets.set(best.key, (targets.get(best.key) || 0) + 1);
      assigned += 1;
    }

    return targets;
  }

  function bumpPoiHabitatUsage(candidate, habitatUsage, getHabitatKey) {
    if (!(habitatUsage instanceof Map) || typeof getHabitatKey !== "function") return;
    const key = String(getHabitatKey(candidate) || "").trim();
    if (!key) return;
    habitatUsage.set(key, (habitatUsage.get(key) || 0) + 1);
  }

  function findBestPoiCandidatePick(candidates, occupiedHexIds, filterFn, scoreFn, minimumScore) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    candidates.forEach((candidate, index) => {
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
    return {
      index: bestIndex,
      candidate: candidates[bestIndex],
      effectiveScore: bestScore
    };
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
    const pools = buildPoiHabitatPools(candidates, habitatKeyFn);
    const habitatTargets = buildPoiHabitatTargets(pools, targetCount, habitatKeyFn, habitatTargetOptions);
    const habitatSectorUsage = new Map();
    const habitatUsage = new Map();

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

    while (chosen.length < targetCount) {
      const desiredPools = [...habitatTargets.entries()]
        .filter(([habitatKey]) => {
          const pool = pools.get(habitatKey);
          return Array.isArray(pool) && pool.length > 0;
        })
        .sort((left, right) => {
          const leftRemaining = left[1] - (habitatUsage.get(left[0]) || 0);
          const rightRemaining = right[1] - (habitatUsage.get(right[0]) || 0);
          return rightRemaining - leftRemaining
            || (pools.get(right[0])?.length || 0) - (pools.get(left[0])?.length || 0)
            || left[0].localeCompare(right[0]);
        });
      let selected = null;

      for (const [habitatKey] of desiredPools) {
        if ((habitatUsage.get(habitatKey) || 0) >= (habitatTargets.get(habitatKey) || 0)) continue;
        const localMinimum = typeof habitatMinimumScoreFn === "function"
          ? habitatMinimumScoreFn(habitatKey, minimumScore)
          : minimumScore;
        const pool = pools.get(habitatKey) || [];
        const picked = findBestPoiCandidatePick(
          pool,
          occupiedHexIds,
          null,
          candidate => scoreFn(candidate) * getHabitatSectorFactor(candidate, habitatKey),
          localMinimum
        );
        if (!picked) continue;
        selected = { habitatKey, picked };
        break;
      }

      if (!selected) {
        selected = [...pools.entries()]
          .map(([habitatKey, pool]) => {
            if (!Array.isArray(pool) || !pool.length) return null;
            const picked = findBestPoiCandidatePick(
              pool,
              occupiedHexIds,
              null,
              candidate => scoreFn(candidate) * getHabitatSectorFactor(candidate, habitatKey),
              minimumScore
            );
            return picked ? { habitatKey, picked } : null;
          })
          .filter(Boolean)
          .sort((left, right) => right.picked.effectiveScore - left.picked.effectiveScore || left.habitatKey.localeCompare(right.habitatKey))[0] || null;
      }

      if (!selected) break;

      const pool = pools.get(selected.habitatKey) || [];
      const [candidate] = pool.splice(selected.picked.index, 1);
      chosen.push(candidate);
      habitatUsage.set(selected.habitatKey, (habitatUsage.get(selected.habitatKey) || 0) + 1);
      registerHabitatSectorUsage(candidate, selected.habitatKey);
      if (typeof onChoose === "function") onChoose(candidate, selected.picked.effectiveScore, selected.habitatKey);
    }

    return chosen;
  }

  function getSettlementHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    if (baseTerrain === "snow" || candidate.snowSettlementBias >= 0.14) return "snow";
    if (candidate.mountainHex && candidate.mountainInteriorStrength >= 0.32) return "mountain_interior";
    if (baseTerrain === "wetland") return "wetland";
    if (candidate.coastal) return "coastal";
    if (candidate.inlandWater || candidate.onRiverHex || candidate.riverAccess) return "river_corridor";
    if (candidate.timberPotential >= 0.72 && candidate.fertility < 0.84) return "forest";
    if (candidate.fertility >= 0.74 && candidate.routeability >= 0.52 && !candidate.highland) return "greenland";
    if (["barrens", "bleak_barrens", "desert", "deep_desert", "wastes"].includes(baseTerrain)) return "waste";
    return "inland";
  }

  function getStrongholdHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    if (baseTerrain === "snow" || candidate.snowStrongholdBias >= 0.14) return "snow";
    if (candidate.mountainHex && candidate.mountainInteriorStrength >= 0.28) return "mountain_interior";
    if (["wastes", "bleak_barrens", "deep_desert", "desert"].includes(baseTerrain)) return "waste";
    if (candidate.coastal) return "coastal";
    if (candidate.onRiverHex || candidate.riverNearby) return "river_corridor";
    return "inland";
  }

  function getDungeonHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    const snowAffinity = Number(candidate.snowAffinity ?? candidate.meta?.snowAffinity ?? 0);
    const mountainInterior = Number(candidate.mountainInterior ?? candidate.meta?.mountainInterior ?? 0);
    const mountainAffinity = Number(candidate.mountainAffinity ?? candidate.meta?.mountainAffinity ?? 0);
    if (baseTerrain === "snow" || snowAffinity >= 0.46) return "snow";
    if (mountainInterior >= 0.34 || mountainAffinity >= 0.56) return "mountain_interior";
    if (["wastes", "bleak_barrens", "deep_desert"].includes(baseTerrain)) return "waste";
    if (baseTerrain === "wetland") return "wetland";
    if (Number(candidate.forestCover ?? candidate.meta?.forestCover ?? 0) >= 0.62 || Number(candidate.deadForestCover ?? candidate.meta?.deadForestCover ?? 0) >= 0.28) return "forest";
    if (Number(candidate.coastalWaterAdjacent ?? candidate.meta?.coastalWaterAdjacent ?? 0) > 0 && Number(candidate.mountainInterior ?? candidate.meta?.mountainInterior ?? 0) < 0.46) return "coastal";
    if (Number(candidate.greenAffinity ?? candidate.meta?.greenAffinity ?? 0) >= 0.46) return "greenland";
    return "inland";
  }

  function getSiteHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
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
    if (Number(candidate.forestCover ?? candidate.meta?.forestCover ?? 0) >= 0.58) return "forest";
    if (Number(candidate.freshwaterAffinity ?? candidate.meta?.freshwaterAffinity ?? 0) >= 0.46 && greenAffinity < 0.7) return "river_corridor";
    if (greenAffinity >= 0.48) return "greenland";
    if (mountainInterior >= 0.3 || mountainAffinity >= 0.56) return "mountain_interior";
    return "inland";
  }

  function getResourceHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
    const baseTerrain = String(candidate.hex?.baseTerrain || "").trim();
    const kind = String(candidate.meta?.kind || "").trim();
    const icon = String(candidate.icon || "").trim();
    if (baseTerrain === "snow" || candidate.meta?.snowHabitat) return "snow";
    if (candidate.meta?.wasteHabitat) return "waste";
    if (kind === "mine" || kind === "quarry") return candidate.meta?.wasteHabitat ? "waste" : "mountain_interior";
    if (kind === "lumber") return "forest";
    if (kind === "fishery" || ["docks", "harbor", "fishing_camp"].includes(icon)) {
      return candidate.meta?.coastal ? "coastal" : "river_corridor";
    }
    if (candidate.meta?.wetlandHabitat) return "wetland";
    if (kind === "farm" || candidate.meta?.greenlandHabitat) return candidate.meta?.riverHabitat ? "river_corridor" : "greenland";
    if (candidate.meta?.forestHabitat) return "forest";
    if (candidate.meta?.coastal) return "coastal";
    if (candidate.meta?.riverHabitat) return "river_corridor";
    return "inland";
  }

  function getWaypointHabitatKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
    if (candidate.meta?.snowHabitat) return "snow";
    if (candidate.meta?.pass) return "mountain_interior";
    if (candidate.meta?.crossing) return "river_corridor";
    if (candidate.meta?.wasteHabitat) return "waste";
    if (candidate.meta?.wetlandHabitat) return "wetland";
    if (candidate.meta?.coastal) return "coastal";
    if (candidate.meta?.forestHabitat && ["lodge", "campsite"].includes(String(candidate.icon || "").trim())) return "forest";
    if (candidate.meta?.greenlandHabitat) return "greenland";
    if (candidate.meta?.forestHabitat) return "forest";
    return "inland";
  }

  function getSettlementCandidateContextKey(candidate) {
    if (!candidate) return "";
    if (candidate.habitat) return String(candidate.habitat).trim();
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

  function isWaypointRoadstopIcon(icon) {
    return ["inn", "tavern", "lodge"].includes(String(icon || "").trim());
  }

  function isWaypointCrossingIcon(icon) {
    return ["ford", "bridge", "bridge_gate", "ferry"].includes(String(icon || "").trim());
  }

  function getPoiVariantHardCap(icon) {
    if (String(icon || "").trim() === "dragon_lair") return 1;
    return Infinity;
  }

  function getSettlementRegionLayout(dimensions, targetCount, candidateCount = 0) {
    const width = Math.max(1, Number(dimensions?.maxX) - Number(dimensions?.minX) + 1);
    const height = Math.max(1, Number(dimensions?.maxY) - Number(dimensions?.minY) + 1);
    const desiredRegions = clamp(
      Math.round(Math.max(4, Math.min(12, targetCount * 0.85 + Math.min(2, candidateCount / 120)))),
      4,
      12,
      8
    );
    const aspect = width / Math.max(1, height);
    const cols = Math.round(clamp(Math.sqrt(desiredRegions * aspect), 2, 5, width >= 34 ? 4 : 3));
    const rows = Math.round(clamp(desiredRegions / Math.max(1, cols), 2, 4, height >= 28 ? 3 : 2));
    return { cols, rows };
  }

  function getSettlementRegionKey(hex, dimensions, layout) {
    return getPoiSectorKey(hex, dimensions, layout) || "0:0";
  }

  function getSettlementRoleProfiles(candidate = {}) {
    const waterAccess = Number(candidate.waterAccess || 0);
    const routeability = Number(candidate.routeability || 0);
    const strategic = Number(candidate.strategic || 0);
    const passPressure = clamp(Number(candidate.passStrength || 0) / 1.4, 0, 1, 0);
    const profiles = [
      {
        role: "coastal_harbor",
        score: candidate.coastal
          ? 0.22 + waterAccess * 0.28 + routeability * 0.18 + strategic * 0.1 + (candidate.frontier ? 0.03 : 0)
          : 0
      },
      {
        role: "river_port",
        score: candidate.onRiverHex || candidate.riverAccess
          ? 0.18 + waterAccess * 0.24 + routeability * 0.2 + strategic * 0.08 + (candidate.onRiverHex ? 0.1 : 0.04) + (candidate.inlandWater ? 0.06 : 0)
          : 0
      },
      {
        role: "lake_settlement",
        score: candidate.inlandWater
          ? 0.18 + waterAccess * 0.24 + routeability * 0.16 + strategic * 0.08 + (candidate.riverAccess ? 0.05 : 0)
          : 0
      },
      {
        role: "pass_gate",
        score: passPressure >= 0.16 || (candidate.mountainHex && strategic >= 0.1)
          ? passPressure * 0.32 + strategic * 0.16 + routeability * 0.16 + (candidate.hillHex ? 0.08 : 0) + (waterAccess >= 0.18 ? 0.04 : 0)
          : 0
      },
      {
        role: "frontier_outpost",
        score: candidate.frontier
          ? 0.16 + waterAccess * 0.18 + routeability * 0.16 + strategic * 0.18 + (candidate.riverAccess ? 0.04 : 0)
          : 0
      },
      {
        role: "inland_node",
        score: 0.18 + waterAccess * 0.2 + routeability * 0.26 + strategic * 0.12 + (candidate.hillHex ? 0.03 : 0) + (candidate.riverAccess ? 0.04 : 0)
      }
    ];
    return profiles
      .filter(profile => profile.score > 0)
      .sort((left, right) => right.score - left.score || left.role.localeCompare(right.role));
  }

  function getSettlementRegionalPlacementScore(candidate = {}) {
    const bestRoleScore = Number(candidate.bestRoleScore || candidate.score || 0);
    const secondaryRoleScore = Number(candidate.secondaryRoleScore || bestRoleScore * 0.82);
    const regionFit = Number(candidate.regionFit || 0.5);
    const waterAccess = Number(candidate.waterAccess || 0);
    const routeability = Number(candidate.routeability || 0);
    const strategic = Number(candidate.strategic || 0);
    return bestRoleScore * 0.44
      + regionFit * 0.18
      + waterAccess * 0.14
      + routeability * 0.14
      + strategic * 0.08
      + Math.min(0.08, Math.max(0, secondaryRoleScore - bestRoleScore * 0.68));
  }

  function prepareSettlementRegions(candidates, dimensions, targetCount, existingAnchors) {
    const layout = getSettlementRegionLayout(dimensions, targetCount, Array.isArray(candidates) ? candidates.length : 0);
    const byKey = new Map();

    (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
      if (!candidate?.hex) return;
      const key = getSettlementRegionKey(candidate.hex, dimensions, layout);
      if (!byKey.has(key)) byKey.set(key, { key, candidates: [], existingCount: 0 });
      byKey.get(key).candidates.push(candidate);
    });

    (existingAnchors || []).forEach(anchor => {
      if (!anchor?.hex) return;
      const key = getSettlementRegionKey(anchor.hex, dimensions, layout);
      if (!byKey.has(key)) byKey.set(key, { key, candidates: [], existingCount: 0 });
      byKey.get(key).existingCount += 1;
    });

    const regions = [...byKey.values()]
      .map(region => {
        const scores = region.candidates.map(candidate => Number(candidate.score || 0));
        const minScore = scores.length ? Math.min(...scores) : 0;
        const maxScore = scores.length ? Math.max(...scores) : minScore;
        const scoreSpan = Math.max(0.001, maxScore - minScore);

        region.candidates.forEach(candidate => {
          const roleProfiles = getSettlementRoleProfiles(candidate);
          candidate.roleProfiles = roleProfiles;
          candidate.primaryRole = roleProfiles[0]?.role || "inland_node";
          candidate.secondaryRole = roleProfiles[1]?.role || candidate.primaryRole;
          candidate.bestRoleScore = Number(roleProfiles[0]?.score || candidate.score || 0);
          candidate.secondaryRoleScore = Number(roleProfiles[1]?.score || candidate.bestRoleScore * 0.82);
          candidate.settlementRegionKey = region.key;
          candidate.regionFit = clamp((Number(candidate.score || 0) - minScore) / scoreSpan, 0, 1, 0.5);
          candidate.regionPlacementScore = getSettlementRegionalPlacementScore(candidate);
        });

        region.candidates.sort((left, right) => right.regionPlacementScore - left.regionPlacementScore || right.score - left.score || left.hex.id.localeCompare(right.hex.id));
        region.candidates.forEach((candidate, index) => {
          candidate.regionPlacementRank = index;
        });

        return region;
      })
      .filter(region => region.candidates.length);

    return { layout, regions };
  }

  function buildSettlementRegionTargets(regions, targetCount) {
    const targets = new Map();
    const entries = (Array.isArray(regions) ? regions : []).filter(region => region?.candidates?.length);
    if (!entries.length || targetCount <= 0) return targets;

    const totalCandidates = Math.max(1, entries.reduce((sum, region) => sum + region.candidates.length, 0));
    const weighted = entries.map(region => {
      const share = region.candidates.length / totalCandidates;
      const existingPenalty = 1 + Math.min(1.8, Number(region.existingCount || 0) * 0.85);
      const weight = region.candidates.length / existingPenalty;
      const cap = Math.max(1, Math.min(4, Math.ceil(targetCount * share * 1.6)));
      return { region, share, weight, cap };
    });

    let assigned = 0;
    weighted
      .filter(entry => entry.region.candidates.length >= 3)
      .sort((left, right) => Number(left.region.existingCount || 0) - Number(right.region.existingCount || 0) || right.weight - left.weight || left.region.key.localeCompare(right.region.key))
      .forEach(entry => {
        if (assigned >= targetCount) return;
        targets.set(entry.region.key, 1);
        assigned += 1;
      });

    while (assigned < targetCount) {
      const best = weighted
        .filter(entry => (targets.get(entry.region.key) || 0) < Math.min(entry.cap, entry.region.candidates.length))
        .sort((left, right) => {
          const leftCurrent = targets.get(left.region.key) || 0;
          const rightCurrent = targets.get(right.region.key) || 0;
          const leftScore = left.weight / (leftCurrent + 1);
          const rightScore = right.weight / (rightCurrent + 1);
          return rightScore - leftScore || right.share - left.share || left.region.key.localeCompare(right.region.key);
        })[0];
      if (!best) break;
      targets.set(best.region.key, (targets.get(best.region.key) || 0) + 1);
      assigned += 1;
    }

    while (assigned < targetCount) {
      const best = weighted
        .filter(entry => (targets.get(entry.region.key) || 0) < entry.region.candidates.length)
        .sort((left, right) => {
          const leftCurrent = targets.get(left.region.key) || 0;
          const rightCurrent = targets.get(right.region.key) || 0;
          const leftScore = left.weight / (leftCurrent + 1);
          const rightScore = right.weight / (rightCurrent + 1);
          return rightScore - leftScore || right.share - left.share || left.region.key.localeCompare(right.region.key);
        })[0];
      if (!best) break;
      targets.set(best.region.key, (targets.get(best.region.key) || 0) + 1);
      assigned += 1;
    }

    return targets;
  }

  function previewSettlementRegionCandidate(region, chosen, existingAnchors, occupiedHexIds, selectedIds, settings, dimensions, roleUsage, regionUsageCount) {
    if (!region?.candidates?.length) return null;
    const usedRoles = roleUsage.get(region.key) || new Set();
    const chosenHexes = chosen.map(entry => entry.hex).filter(Boolean);
    const existingHexes = (existingAnchors || []).map(anchor => anchor?.hex).filter(Boolean);
    let best = null;

    region.candidates.forEach(candidate => {
      if (!candidate?.hex || occupiedHexIds.has(candidate.hex.id) || selectedIds.has(candidate.hex.id)) return;
      if (isTooCloseToExistingPoi(candidate.hex, chosenHexes, 2)) return;
      if (isTooCloseToExistingPoi(candidate.hex, existingHexes, 2)) return;

      const spacingPenalty = getSettlementSpacingPenalty(candidate.hex, chosen, existingAnchors, settings);
      const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
      const roleBonus = usedRoles.has(candidate.primaryRole) ? 0 : 0.08;
      const secondaryRoleBonus = !usedRoles.has(candidate.secondaryRole) && candidate.secondaryRole !== candidate.primaryRole ? 0.03 : 0;
      const firstInRegionBonus = (regionUsageCount.get(region.key) || 0) <= 0 ? 0.06 : 0;
      const adjustedScore = candidate.regionPlacementScore * coverageFactor
        + roleBonus
        + secondaryRoleBonus
        + firstInRegionBonus
        - spacingPenalty * 0.22
        + seededNoise(`${settings.seed}:settlement-region-pick:${candidate.hex.id}`, -0.03, 0.03);

      if (!best || adjustedScore > best.score || (adjustedScore === best.score && candidate.regionPlacementScore > best.candidate.regionPlacementScore)) {
        best = { candidate, score: adjustedScore };
      }
    });

    return best;
  }

  function chooseSettlementCandidatesByRegion({ regions, regionTargets, targetCount, existingAnchors, occupiedHexIds, settings, dimensions }) {
    const chosen = [];
    const selectedIds = new Set();
    const roleUsage = new Map();
    const regionUsageCount = new Map();

    const commitPick = (regionKey, pick) => {
      chosen.push(pick.candidate);
      selectedIds.add(pick.candidate.hex.id);
      pick.candidate.adjustedScore = pick.score;
      regionUsageCount.set(regionKey, (regionUsageCount.get(regionKey) || 0) + 1);
      if (!roleUsage.has(regionKey)) roleUsage.set(regionKey, new Set());
      roleUsage.get(regionKey).add(pick.candidate.primaryRole);
      occupiedHexIds.add(pick.candidate.hex.id);
    };

    [...(regions || [])]
      .filter(region => (regionTargets.get(region.key) || 0) > 0)
      .sort((left, right) => (regionTargets.get(right.key) || 0) - (regionTargets.get(left.key) || 0) || Number(left.existingCount || 0) - Number(right.existingCount || 0) || right.candidates.length - left.candidates.length || left.key.localeCompare(right.key))
      .forEach(region => {
        if (chosen.length >= targetCount) return;
        const pick = previewSettlementRegionCandidate(region, chosen, existingAnchors, occupiedHexIds, selectedIds, settings, dimensions, roleUsage, regionUsageCount);
        if (pick) commitPick(region.key, pick);
      });

    while (chosen.length < targetCount) {
      const next = (regions || [])
        .map(region => {
          const target = regionTargets.get(region.key) || 0;
          const used = regionUsageCount.get(region.key) || 0;
          if (used >= target) return null;
          const pick = previewSettlementRegionCandidate(region, chosen, existingAnchors, occupiedHexIds, selectedIds, settings, dimensions, roleUsage, regionUsageCount);
          if (!pick) return null;
          const deficitBonus = Math.max(0, target - used - 1) * 0.05;
          return {
            regionKey: region.key,
            pick,
            priority: pick.score + deficitBonus
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.priority - left.priority || left.regionKey.localeCompare(right.regionKey))[0];
      if (!next) break;
      commitPick(next.regionKey, next.pick);
    }

    while (chosen.length < targetCount) {
      const next = (regions || [])
        .map(region => {
          const pick = previewSettlementRegionCandidate(region, chosen, existingAnchors, occupiedHexIds, selectedIds, settings, dimensions, roleUsage, regionUsageCount);
          return pick ? { regionKey: region.key, pick } : null;
        })
        .filter(Boolean)
        .sort((left, right) => right.pick.score - left.pick.score || left.regionKey.localeCompare(right.regionKey))[0];
      if (!next) break;
      commitPick(next.regionKey, next.pick);
    }

    return chosen;
  }

  function scoreSettlementHierarchyCandidate(candidate, chosen, existingAnchors, dimensions, layout) {
    const localHub = Number(candidate.regionPlacementScore || candidate.score || 0) * 0.38
      + Number(candidate.waterAccess || 0) * 0.16
      + Number(candidate.routeability || 0) * 0.16
      + Number(candidate.strategic || 0) * 0.1;
    const roleHubBonus = candidate.primaryRole === "coastal_harbor" || candidate.primaryRole === "river_port"
      ? 0.06
      : candidate.primaryRole === "pass_gate"
        ? 0.05
        : candidate.primaryRole === "inland_node"
          ? 0.03
          : 0.02;
    const regionLeadBonus = candidate.regionPlacementRank === 0
      ? 0.12
      : candidate.regionPlacementRank === 1
        ? 0.05
        : 0.02;
    let linkStrength = 0;
    let connectionCount = 0;
    const linkedRegions = new Set();
    const peers = [
      ...chosen.filter(other => other?.hex && other.hex.id !== candidate.hex.id),
      ...(existingAnchors || []).map(anchor => ({
        hex: anchor?.hex,
        importanceHint: Number(anchor?.importance || 0.5),
        settlementRegionKey: anchor?.hex ? getSettlementRegionKey(anchor.hex, dimensions, layout) : ""
      }))
    ];

    peers.forEach(peer => {
      if (!peer?.hex) return;
      const distance = hexDistance(candidate.hex, peer.hex);
      if (!Number.isFinite(distance) || distance < 4 || distance > 18) return;
      const distanceFactor = distance <= 8
        ? 1
        : distance <= 12
          ? 0.72
          : distance <= 15
            ? 0.48
            : 0.28;
      const importanceHint = clamp(
        Number(peer.importanceHint || peer.importance || (0.45 + Number(peer.regionPlacementScore || peer.bestRoleScore || peer.score || 0.4) * 0.78)),
        0.25,
        1.6,
        0.6
      );
      linkStrength += distanceFactor * importanceHint;
      connectionCount += 1;
      const peerRegionKey = String(peer.settlementRegionKey || "").trim();
      if (peerRegionKey && peerRegionKey !== candidate.settlementRegionKey) linkedRegions.add(peerRegionKey);
    });

    const networkScore = clamp(linkStrength / 3.2, 0, 1.4, 0.24);
    const interRegionalBonus = Math.min(0.12, linkedRegions.size * 0.03);
    const connectionBonus = Math.min(0.08, connectionCount * 0.02);
    return networkScore * 0.46 + localHub + roleHubBonus + regionLeadBonus + interRegionalBonus + connectionBonus;
  }

  function orderSettlementHierarchyCandidates(chosen, existingAnchors, dimensions, layout) {
    if (!Array.isArray(chosen) || !chosen.length) return [];

    chosen.forEach(candidate => {
      candidate.importanceHint = clamp(0.45 + Number(candidate.regionPlacementScore || candidate.score || 0.4) * 0.78, 0.35, 1.25, 0.5);
    });
    chosen.forEach(candidate => {
      candidate.hierarchyScore = scoreSettlementHierarchyCandidate(candidate, chosen, existingAnchors, dimensions, layout);
    });

    const sorted = [...chosen].sort((left, right) => right.hierarchyScore - left.hierarchyScore || right.regionPlacementScore - left.regionPlacementScore || left.hex.id.localeCompare(right.hex.id));
    const majorSlotCount = Math.min(sorted.length, Math.max(1, Math.floor(sorted.length * 0.18) + 1));
    const majorEntries = [];
    const usedIds = new Set();
    const usedRegions = new Set();

    sorted.forEach(candidate => {
      if (majorEntries.length >= majorSlotCount || usedRegions.has(candidate.settlementRegionKey)) return;
      majorEntries.push(candidate);
      usedIds.add(candidate.hex.id);
      usedRegions.add(candidate.settlementRegionKey);
    });

    sorted.forEach(candidate => {
      if (majorEntries.length >= majorSlotCount || usedIds.has(candidate.hex.id)) return;
      majorEntries.push(candidate);
      usedIds.add(candidate.hex.id);
    });

    return [
      ...majorEntries,
      ...sorted.filter(candidate => !usedIds.has(candidate.hex.id))
    ];
  }

  function buildSettlementDrafts({ candidates, targetCount, existingAnchors, occupiedHexIds, settings, usedNames, random, dimensions }) {
    if (!Array.isArray(candidates) || !candidates.length || targetCount <= 0) return [];
    const { layout, regions } = prepareSettlementRegions(candidates, dimensions, targetCount, existingAnchors);
    const regionTargets = buildSettlementRegionTargets(regions, targetCount);
    const chosen = chooseSettlementCandidatesByRegion({
      regions,
      regionTargets,
      targetCount,
      existingAnchors,
      occupiedHexIds,
      settings,
      dimensions
    });

    const ranked = orderSettlementHierarchyCandidates(chosen, existingAnchors, dimensions, layout)
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
    const mountainFeatures = ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"];
    const ruggedFeatures = [...mountainFeatures, "cliffs", "ridges"];
    const localByCoord = byCoord || new Map([...byId.values()].map(entry => [`${entry.x}:${entry.y}`, entry]));
    const localDimensions = dimensions || getDimensions([...byId.values()]);
    const adjacent = neighbors(hex, localByCoord);
    const nearby = nearbyWithin(hex, localByCoord, 2);
    const localArea = [hex, ...nearby];
    const localAreaCount = Math.max(1, localArea.length);
    const elevation = Number(hex.elevation || 0);
    const edgeDistance = distanceToMapEdge(hex, localDimensions);
    const waterAccess = scoreSettlementWaterAccess(hex, adjacent, riverData);
    const fertility = scoreSettlementFertility(hex, nearby);
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const strategic = scoreSettlementStrategicValue(hex, nearby, localDimensions, riverData);
    const rockyLocal = localArea.filter(neighbor => (
      neighbor?.baseTerrain === "rock"
      || (neighbor?.features || []).some(feature => mountainFeatures.includes(feature))
    )).length;
    const coldRoughLocal = getNearbyTerrainCount(localArea, ["rock", "snow"]);
    const forestLocal = localArea.reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const forestHexCount = localArea.filter(neighbor => (
      (neighbor.features || []).some(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature))
    )).length;
    const wetlandHexCount = localArea.filter(neighbor => neighbor?.baseTerrain === "wetland").length;
    const wasteHexCount = localArea.filter(neighbor => ["wastes", "bleak_barrens", "deep_desert", "desert", "barrens"].includes(neighbor?.baseTerrain)).length;
    const greenHexCount = localArea.filter(neighbor => (
      ["plains", "grassland", "lush_grassland"].includes(neighbor?.baseTerrain)
      || (neighbor?.features || []).includes("farmland")
    )).length;
    const adjacentLandHexes = adjacent.filter(neighbor => isPoiLandHex(neighbor));
    const snowHex = hex.baseTerrain === "snow" || (hex.features || []).includes("snowcapped_mountains");
    const snowNearby = [hex, ...nearby].filter(neighbor => (
      neighbor?.baseTerrain === "snow"
      || (neighbor?.features || []).includes("snowcapped_mountains")
    )).length;
    const mountainHex = hex.baseTerrain === "rock"
      || (hex.features || []).some(feature => mountainFeatures.includes(feature));
    const hillHex = elevation >= 2
      || (hex.features || []).some(feature => ["ridges", "cliffs"].includes(feature));
    const adjacentHighlandCount = adjacentLandHexes.filter(neighbor => (
      neighbor.baseTerrain === "rock"
      || (neighbor.features || []).some(feature => ruggedFeatures.includes(feature))
    )).length;
    const adjacentLowlandCount = Math.max(0, adjacentLandHexes.length - adjacentHighlandCount);
    const passStrength = getWaypointPassStrength(hex, adjacent);
    const mountainSettlementBias = mountainHex && (passStrength > 0 || strategic >= 0.14 || rockyLocal >= 2)
      ? 0.08
        + Math.min(0.05, passStrength * 0.04)
        + Math.min(0.04, strategic * 0.14)
        + (routeability >= 0.5 ? 0.03 : 0)
        + (rockyLocal >= 2 ? 0.03 : 0)
      : 0;
    const snowSettlementBias = hex.baseTerrain === "snow" && (
      passStrength > 0
      || strategic >= 0.08
      || coldRoughLocal >= 3
      || routeability >= 0.42
      || forestLocal >= 2
      || riverData.riverHexIds.has(hex.id)
      || hasRiverAccess(hex, adjacent, riverData)
    )
      ? 0.14
        + Math.min(0.06, passStrength * 0.05)
        + Math.min(0.05, strategic * 0.18)
        + (routeability >= 0.42 ? 0.06 : routeability >= 0.36 ? 0.03 : 0)
        + (coldRoughLocal >= 3 ? 0.05 : 0)
        + (forestLocal >= 2 ? 0.04 : 0)
        + (riverData.riverHexIds.has(hex.id) ? 0.05 : 0)
        + (hasRiverAccess(hex, adjacent, riverData) ? 0.03 : 0)
      : 0;
    const mountainInteriorStrength = mountainHex
      ? clamp(
          adjacentHighlandCount * 0.14
          - adjacentLowlandCount * 0.08
          + (rockyLocal >= 4 ? 0.16 : rockyLocal >= 3 ? 0.1 : 0)
          + (elevation >= 4 ? 0.12 : elevation >= 3 ? 0.08 : 0)
          + (routeability <= 0.5 ? 0.14 : routeability <= 0.6 ? 0.06 : 0)
          + (passStrength <= 0.24 ? 0.08 : passStrength <= 0.6 ? 0.03 : 0),
          0,
          1,
          0
        )
      : 0;
    const coastal = adjacent.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const inlandWater = adjacent.some(neighbor => neighbor.baseTerrain === "inland_water");
    const onRiverHex = riverData.riverHexIds.has(hex.id);
    const riverAccess = hasRiverAccess(hex, adjacent, riverData);
    const highland = mountainHex || hillHex || adjacentHighlandCount >= 2;
    const miningPotential = mountainHex
      ? 1
      : rockyLocal >= 4
        ? 0.88
        : rockyLocal >= 3
          ? 0.74
          : Number(hex.elevation || 0) >= 3
            ? 0.58
            : 0;
    const timberPotential = forestLocal >= 7
      ? 0.92
      : forestLocal >= 5
        ? 0.78
        : forestLocal >= 3
          ? 0.62
          : 0;
    const snowFieldAffinity = clamp(snowNearby / localAreaCount, 0, 1, 0);
    const wetlandFieldAffinity = clamp(wetlandHexCount / localAreaCount, 0, 1, 0);
    const wasteFieldAffinity = clamp(wasteHexCount / localAreaCount, 0, 1, 0);
    const forestFieldAffinity = clamp(forestHexCount / localAreaCount, 0, 1, 0);
    const greenFieldAffinity = clamp(greenHexCount / localAreaCount, 0, 1, 0);
    const frontier = edgeDistance <= 1;
    const habitat = determineSettlementHabitat({
      hex,
      snowHex,
      snowSettlementBias,
      mountainHex,
      mountainInteriorStrength,
      coastal,
      inlandWater,
      onRiverHex,
      riverAccess,
      timberPotential,
      fertility,
      routeability,
      highland,
      wetlandFieldAffinity,
      wasteFieldAffinity,
      forestFieldAffinity,
      greenFieldAffinity,
      snowFieldAffinity
    });
    const candidate = {
      hex,
      waterAccess,
      fertility,
      routeability,
      strategic,
      coastal,
      inlandWater,
      onRiverHex,
      riverAccess,
      snowHex,
      mountainHex,
      hillHex,
      passStrength,
      mountainSettlementBias,
      snowSettlementBias,
      mountainInteriorStrength,
      highland,
      rockyLocal,
      adjacentHighlandCount,
      miningPotential,
      timberPotential,
      frontier,
      habitat,
      localAreaCount,
      snowNearby,
      forestLocal,
      forestHexCount,
      wetlandHexCount,
      wasteHexCount,
      greenHexCount,
      snowFieldAffinity,
      wetlandFieldAffinity,
      wasteFieldAffinity,
      forestFieldAffinity,
      greenFieldAffinity
    };
    const score = getSettlementHabitatLocalScore(candidate) - getSettlementEdgePenalty({
      edgeDistance,
      coastal,
      inlandWater,
      riverAccess,
      settings
    });
    return {
      ...candidate,
      score,
    };
  }

  function determineSettlementHabitat(candidate = {}) {
    if (candidate.coastal) return "coastal";
    if (candidate.onRiverHex || candidate.inlandWater || (candidate.riverAccess && candidate.waterAccess >= 0.18)) return "river_corridor";
    if (Number(candidate.passStrength || 0) >= 0.65) return "pass";
    if (candidate.snowHex || Number(candidate.snowFieldAffinity || 0) >= 0.42 || Number(candidate.snowSettlementBias || 0) >= 0.14) return "snow";
    return "inland";
  }

  function getSettlementHabitatLocalScore(candidate = {}) {
    const passPressure = clamp(Number(candidate.passStrength || 0) / 1.4, 0, 1, 0);
    const waterAccess = Number(candidate.waterAccess || 0);
    const routeability = Number(candidate.routeability || 0);
    const strategic = Number(candidate.strategic || 0);
    const mountainInterior = Number(candidate.mountainInteriorStrength || 0);
    const hillShelter = candidate.hillHex ? 0.05 : 0;
    const commonScore = waterAccess * 0.32
      + routeability * 0.34
      + strategic * 0.16
      + hillShelter
      + (candidate.frontier ? 0.01 : 0);

    switch (String(candidate.habitat || "")) {
      case "coastal":
        return commonScore
          + (candidate.coastal ? 0.12 : 0)
          + (candidate.inlandWater ? 0.04 : 0)
          + routeability * 0.04;
      case "river_corridor":
        return commonScore
          + (candidate.onRiverHex ? 0.12 : candidate.riverAccess ? 0.08 : 0)
          + (candidate.inlandWater ? 0.05 : 0);
      case "pass":
        return commonScore
          + passPressure * 0.14
          + mountainInterior * 0.08;
      case "snow":
        return commonScore
          + (waterAccess >= 0.18 ? 0.04 : 0)
          + (routeability >= 0.38 ? 0.03 : 0);
      default:
        return commonScore;
    }
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
    const ruggedNearby = nearby.filter(neighbor => (
      neighbor?.baseTerrain === "rock"
      || (neighbor?.features || []).some(feature => ["cliffs", "ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature))
    )).length;
    if (ruggedNearby >= 2) score += 0.14;
    if (ruggedNearby >= 3) score += 0.08;
    if ((hex.features || []).some(feature => ["cliffs", "ridges", "mountains", "snowcapped_mountains", "lone_mountain", "volcano"].includes(feature))) score += 0.08;
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
    const hierarchyBasis = clamp(
      Number((candidate?.hierarchyScore ?? candidate?.regionPlacementScore ?? candidate?.adjustedScore ?? candidate?.score) ?? 0.35),
      0.2,
      1.4,
      0.35
    );
    const scoreScale = 0.85 + Math.max(0, hierarchyBasis - 0.35);
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

  function hasMountainSettlementProfile(candidate = {}) {
    if (!candidate?.mountainHex) return false;
    const passStrength = Number(candidate.passStrength || 0);
    const mountainInterior = Number(candidate.mountainInteriorStrength || 0);
    const rockyLocal = Number(candidate.rockyLocal || 0);
    const adjacentHighlandCount = Number(candidate.adjacentHighlandCount || 0);
    const routeability = Number(candidate.routeability || 0);
    const miningPotential = Number(candidate.miningPotential || 0);
    return passStrength >= 1
      || (mountainInterior >= 0.46 && adjacentHighlandCount >= 2)
      || (miningPotential >= 0.88 && rockyLocal >= 3 && routeability <= 0.62);
  }

  function chooseSettlementIcon(candidate, sizeTier, visualTier) {
    const seed = `settlement-icon:${candidate.hex.id}:${sizeTier}:${visualTier}`;
    const mountainProfile = hasMountainSettlementProfile(candidate);
    if (
      mountainProfile
      && (visualTier === "grand_hub" || visualTier === "city")
      && (candidate.mountainInteriorStrength >= 0.42 || candidate.passStrength >= 1.1 || candidate.miningPotential >= 1)
    ) {
      return "mountain_city";
    }
    if (mountainProfile) {
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
      greenAffinity: signals.greenAffinity,
      mountainAffinity: signals.mountainAffinity,
      mountainInterior: signals.mountainInterior,
      wasteAffinity: signals.wasteAffinity,
      coastalWaterAdjacent: signals.coastalWaterAdjacent ? 1 : 0,
      forestCover: signals.forestCover,
      deadForestCover: signals.deadForestCover,
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
        mountainInterior: signals.mountainInterior,
        greenAffinity: signals.greenAffinity,
        snowAffinity: signals.snowAffinity,
        forestCover: signals.forestCover,
        deadForestCover: signals.deadForestCover,
        coastalWaterAdjacent: signals.coastalWaterAdjacent ? 1 : 0
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
      freshwaterAffinity: signals.freshwaterAffinity,
      forestCover: signals.forestCover,
      mountainAffinity: signals.mountainAffinity,
      mountainInterior: signals.mountainInterior,
      tags,
      notoriety: getSiteNotoriety(type, signals, icon),
      meta: {
        nearestSettlement: signals.nearestSettlement?.anchor?.name || "",
        supportDistance: signals.settlementDistance,
        oldCivilization: signals.oldCivilization,
        remoteness: signals.remoteness,
        greenAffinity: signals.greenAffinity,
        snowAffinity: signals.snowAffinity,
        freshwaterAffinity: signals.freshwaterAffinity,
        forestCover: signals.forestCover,
        coastalWaterAdjacent: signals.coastalWaterAdjacent ? 1 : 0,
        mountainAffinity: signals.mountainAffinity,
        mountainInterior: signals.mountainInterior
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
      .filter(Boolean);

    const chosen = [];
    const supportUsage = new Map();
    const iconUsage = new Map();
    const contextUsage = new Map();
    selectPoiCandidatesByHabitat({
      candidates,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getResourceHabitatKey,
      habitatTargetOptions: { minimumShare: 0.12, minimumCount: 2 },
      minimumScore: 0.16,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? 0.1
        : habitatKey === "wetland" || habitatKey === "waste"
          ? 0.12
          : floor,
      scoreFn: candidate => {
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return -Infinity;
        if (!canChooseResourceCandidate(candidate, supportUsage)) return -Infinity;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const contextFactor = getPoiContextCoverageFactor(
          getResourceCandidateContextKey(candidate),
          contextUsage,
          { emptyFactor: 1.16, lightFactor: 1.04, mediumFactor: 0.88, heavyFactor: 0.78, crowdedFactor: 0.7 }
        );
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, { radius: 6, stepPenalty: 0.04, maxPenalty: 0.16 });
        return candidate.score * variantFactor * coverageFactor * contextFactor - crowdPenalty;
      },
      onChoose: candidate => {
        registerResourceCandidateSupport(candidate, supportUsage);
        iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
        bumpPoiUsageCount(contextUsage, getResourceCandidateContextKey(candidate));
        occupiedHexIds.add(candidate.hex.id);
      }
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
    const nearestSettlement = settlementAnchors.length ? findNearestSettlementAnchor(hex, settlementAnchors) : null;
    if (settlementAnchors.length && (!nearestSettlement || nearestSettlement.distance < 1 || nearestSettlement.distance > 6)) return null;
    const specialization = chooseResourceSpecialization(hex, nearby, riverData, { nearestSettlement, byCoord });
    if (!specialization) return null;
    const routeability = scoreSettlementRouteability(hex, nearby, riverData);
    const supportDistance = nearestSettlement?.distance ?? 5;
    const settlementImportance = Number(nearestSettlement?.anchor?.importance || 0.42);
    const supportProximity = nearestSettlement
      ? nearestSettlement.distance <= 2
        ? 1
        : nearestSettlement.distance === 3
          ? 0.82
          : nearestSettlement.distance === 4
            ? 0.62
            : nearestSettlement.distance === 5
              ? 0.44
              : 0.28
      : 0.18 + Math.max(0, routeability - 0.44) * 0.2;
    const settlementSupport = nearestSettlement
      ? supportProximity * (0.86 + Math.min(0.22, settlementImportance * 0.16))
      : supportProximity;
    const remotePenalty = nearestSettlement ? Math.max(0, (supportDistance - 3) * 0.08) : 0;
    const score = settlementSupport * 0.58
      + specialization.score * 0.24
      + routeability * 0.1
      + (nearestSettlement ? Math.min(0.12, settlementImportance * 0.08) : 0.08)
      - remotePenalty;
    if (score < 0.3) return null;
    const forestFeatureCount = (hex.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length
      + nearby.reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const coastal = nearby.some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const riverHabitat = hasRiverAccess(hex, nearby, riverData);
    const wetlandHabitat = hex.baseTerrain === "wetland" || nearby.some(neighbor => neighbor.baseTerrain === "wetland");
    const snowHabitat = hex.baseTerrain === "snow" || nearby.some(neighbor => neighbor.baseTerrain === "snow" || (neighbor.features || []).includes("snowcapped_mountains"));
    const wasteHabitat = ["wastes", "bleak_barrens", "deep_desert", "desert", "barrens"].includes(hex.baseTerrain)
      || nearby.some(neighbor => ["wastes", "bleak_barrens", "deep_desert", "desert", "barrens"].includes(neighbor.baseTerrain));
    const mountainHabitat = specialization.kind === "mine"
      || specialization.kind === "quarry"
      || Number(hex.elevation || 0) >= 3
      || (hex.features || []).some(feature => ["mountains", "snowcapped_mountains", "lone_mountain", "volcano", "cliffs", "ridges"].includes(feature));
    const greenlandHabitat = !wetlandHabitat && !wasteHabitat && !mountainHabitat && scoreSettlementFertility(hex, nearby) >= 0.76;
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
        supportDistance,
        coastal,
        riverHabitat,
        forestHabitat: forestFeatureCount >= 3 || specialization.kind === "lumber",
        wetlandHabitat,
        snowHabitat,
        wasteHabitat,
        mountainHabitat,
        greenlandHabitat
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
    const roadstopTarget = settlementAnchors.length >= 2
      ? Math.min(targetCount, Math.max(1, Math.round(targetCount * 0.32)))
      : 0;
    selectPoiCandidatesByHabitat({
      candidates,
      targetCount,
      chosen,
      occupiedHexIds,
      habitatKeyFn: getWaypointHabitatKey,
      habitatTargetOptions: { minimumShare: 0.12, minimumCount: 2 },
      minimumScore: 0.16,
      dimensions,
      sectorOptions: { cols: 4, rows: 3 },
      habitatMinimumScoreFn: (habitatKey, floor) => habitatKey === "snow"
        ? 0.12
        : habitatKey === "wetland" || habitatKey === "waste"
          ? 0.13
          : floor,
      scoreFn: candidate => {
        if (isTooCloseToExistingPoi(candidate.hex, chosen.map(entry => entry.hex), 2)) return -Infinity;
        if (!canChooseWaypointCandidate(candidate, routeUsage)) return -Infinity;
        const iconCount = iconUsage.get(String(candidate.icon || "").trim()) || 0;
        const variantFactor = getPoiVariantDiminishingFactor(candidate.icon, iconCount);
        const coverageFactor = getPoiCoverageFactor(candidate.hex, chosen, dimensions, { cols: 4, rows: 3 });
        const contextFactor = getPoiContextCoverageFactor(
          getWaypointCandidateContextKey(candidate),
          contextUsage,
          { emptyFactor: 1.16, lightFactor: 1.05, mediumFactor: 0.9, heavyFactor: 0.8, crowdedFactor: 0.72 }
        );
        const crowdPenalty = getPoiRegionalCrowdingPenalty(candidate.hex, chosen, { radius: 5, stepPenalty: 0.035, maxPenalty: 0.14 });
        const roadstopCount = chosen.filter(entry => isWaypointRoadstopIcon(entry.icon)).length;
        const roadstopNeed = isWaypointRoadstopIcon(candidate.icon) && roadstopCount < roadstopTarget ? 1.18 : 1;
        const crossingNeed = isWaypointCrossingIcon(candidate.icon) && chosen.every(entry => !isWaypointCrossingIcon(entry.icon)) ? 1.08 : 1;
        return candidate.score * variantFactor * coverageFactor * contextFactor * roadstopNeed * crossingNeed - crowdPenalty;
      },
      onChoose: candidate => {
        registerWaypointRouteUsage(candidate, routeUsage);
        iconUsage.set(candidate.icon, (iconUsage.get(candidate.icon) || 0) + 1);
        bumpPoiUsageCount(contextUsage, getWaypointCandidateContextKey(candidate));
        occupiedHexIds.add(candidate.hex.id);
      }
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

  function buildRoutedWaypointCandidates({ settlementAnchors, byId, byCoord, dimensions, riverData, settings }) {
    const routes = buildWaypointRouteCandidates(settlementAnchors, byId, byCoord, dimensions, riverData, settings);
    const byHex = new Map();
    routes.forEach(route => {
      const routeImportance = getWaypointRouteImportance(route.from, route.to);
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
        record.routeImportance = Math.max(Number(record.routeImportance || 0), routeImportance);
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
          routeImportance: 0,
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
    const routeImportance = clamp(Number(record.routeImportance || 0), 0, 1.5, 0);
    const passWeight = record.pass ? Math.max(1, Number(record.passStrength || 1)) : 0;
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
    const icon = chooseWaypointIcon(record, settings);
    const roadstopIcon = isWaypointRoadstopIcon(icon);
    const crossingIcon = isWaypointCrossingIcon(icon);
    if (roadstopIcon && routeImportance < 0.68 && !record.pass && !record.coldRestStop) return null;
    const routeMidwayScore = record.midpoint * 0.24 + routeImportance * 0.22 + settlementGapBias + endpointGapBias;
    const crossingAnchorScore = Math.min(1, record.corridorCount / 3) * 0.22 + record.crossing * 0.28 + passWeight * 0.18 + routeImportance * 0.12;
    const roadstopScore = routeMidwayScore + routeability + coldRestBias + (record.frontier ? 0.04 : 0);
    const passScore = crossingAnchorScore + routeMidwayScore * 0.32 + frontierBias + routeability * 0.6;
    const score = roadstopIcon
      ? roadstopScore
      : crossingIcon
        ? crossingAnchorScore + routeability * 0.5 + frontierBias * 0.4
        : record.pass
          ? passScore
          : routeMidwayScore + Math.min(1, record.corridorCount / 3) * 0.16 + routeability;
    if (score < 0.32) return null;
    const forestFeatureCount = (record.hex.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length
      + (record.nearby || []).reduce((sum, neighbor) => sum + (neighbor.features || []).filter(feature => ["forest", "dead_trees", "jungle", "jungle_trees"].includes(feature)).length, 0);
    const coastal = (record.nearby || []).some(neighbor => ["coastal_water", "sea", "deep_sea"].includes(neighbor.baseTerrain));
    const wetlandHabitat = record.hex.baseTerrain === "wetland" || (record.nearby || []).some(neighbor => neighbor.baseTerrain === "wetland");
    const snowHabitat = record.hex.baseTerrain === "snow"
      || [record.hex, ...(record.nearby || [])].some(neighbor => (neighbor.features || []).includes("snowcapped_mountains"));
    const wasteHabitat = ["wastes", "bleak_barrens", "deep_desert", "desert", "barrens"].includes(record.hex.baseTerrain)
      || (record.nearby || []).some(neighbor => ["wastes", "bleak_barrens", "deep_desert", "desert", "barrens"].includes(neighbor.baseTerrain));
    const greenlandHabitat = !wetlandHabitat && !wasteHabitat && !record.pass && scoreSettlementFertility(record.hex, record.nearby || []) >= 0.74;
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
        routeImportance,
        roadstop: roadstopIcon,
        coastal,
        forestHabitat: forestFeatureCount >= 3,
        greenlandHabitat,
        wetlandHabitat,
        snowHabitat,
        wasteHabitat,
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
    const majorAnchors = settlementAnchors
      .filter(anchor => Number(anchor?.importance || 0) >= 0.78);
    const routeAnchors = majorAnchors.length >= 2
      ? majorAnchors
      : settlementAnchors.length > 4
        ? [...settlementAnchors]
          .sort((left, right) => Number(right?.importance || 0) - Number(left?.importance || 0))
          .slice(0, Math.max(2, Math.ceil(settlementAnchors.length * 0.45)))
        : settlementAnchors;
    const pairs = [];
    routeAnchors.forEach((anchor, index) => {
      const nearest = routeAnchors
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

  function getWaypointRouteImportance(fromAnchor, toAnchor) {
    const fromImportance = clamp(Number(fromAnchor?.importance || 0.5), 0.2, 1.5, 0.5);
    const toImportance = clamp(Number(toAnchor?.importance || 0.5), 0.2, 1.5, 0.5);
    return Math.min(1.4, Math.min(fromImportance, toImportance) * 0.72 + Math.max(fromImportance, toImportance) * 0.28);
  }

  function chooseWaypointIcon(record, settings = {}) {
    const concentration = clamp(settings?.populationConcentration, 0.5, 1.5, 1);
    const highConcentration = concentration >= 1.08;
    const lowConcentration = concentration <= 0.84;
    const passStrength = Number(record.passStrength || 0);
    const routeImportance = Number(record.routeImportance || 0);
    const strongRoute = routeImportance >= 0.72;
    const middlingRoute = routeImportance >= 0.56;
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
      if (!middlingRoute) {
        return seededPick(record.frontier ? ["campsite", "lodge"] : ["campsite", "lodge"], `${seed}:cold-remote`) || "campsite";
      }
      const eligible = highConcentration
        ? ["inn", "tavern", "lodge"]
        : lowConcentration
          ? ["lodge", "inn", "campsite"]
          : ["inn", "lodge", "tavern"];
      return seededPick(eligible, `${seed}:cold`) || "lodge";
    }
    if (record.corridorCount >= 3) {
      if (!middlingRoute) return record.frontier ? "campsite" : "market";
      const eligible = highConcentration
        ? ["market", "inn", "tavern"]
        : lowConcentration
          ? ["inn", "tavern", "lodge"]
          : ["market", "inn", "tavern"];
      return seededPick(eligible, seed) || "inn";
    }
    if (record.frontier) {
      const eligible = !strongRoute
        ? ["campsite"]
        : lowConcentration
          ? ["campsite", "lodge"]
          : ["lodge", "inn", "campsite"];
      return seededPick(eligible, seed) || "lodge";
    }
    if (record.corridorCount >= 2) {
      const eligible = !middlingRoute
        ? ["campsite"]
        : lowConcentration
          ? ["inn", "tavern", "lodge"]
          : ["inn", "tavern"];
      return seededPick(eligible, seed) || "inn";
    }
    if (record.midpoint >= 0.66 && strongRoute) return seededPick(["inn", "tavern"], seed) || "inn";
    if (record.midpoint >= 0.48 && middlingRoute) return seededPick(lowConcentration ? ["tavern", "inn", "campsite"] : ["inn", "tavern"], seed) || "inn";
    return "campsite";
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
