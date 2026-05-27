function getAssetValue(asset) {
  return asset?.signedUrl || "";
}

function getPreviewAssetValue(asset) {
  return String(asset?.mime_type || "").startsWith("image/")
    ? getAssetValue(asset)
    : "";
}

function getLoadedPoiTypeValue(value) {
  return window.CampaignPoiTypes?.getStoredTypeValue?.(value) || String(value || "").trim();
}

function getLoadedPoiTypeLabel(value) {
  return window.CampaignPoiTypes?.getTypeLabel?.(value) || String(value || "").trim();
}

function getLoadedPoiNotorietyValue(value) {
  return window.CampaignPoiTypes?.getStoredNotorietyValue?.(value) || String(value || "").trim();
}

function getLoadedPoiNotorietyLabel(value) {
  return window.CampaignPoiTypes?.getNotorietyLabel?.(value) || String(value || "").trim();
}

function getLoadedPoiTagValues(values) {
  return window.CampaignPoiTags?.coerceTagValues?.(values) || [];
}

function getLoadedPoiIconValue(value) {
  return window.CampaignPoiIcons?.getStoredIconValue?.(value) || String(value || "").trim();
}

async function fetchAllCampaignRows(tableName, columns, campaignId) {
  const pageSize = 1000;
  const allRows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await campaignSupabase
      .from(tableName)
      .select(columns)
      .eq("campaign_id", campaignId)
      .range(from, to);

    if (error) throw error;

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows;
}

async function fetchOptionalCampaignRows(tableName, columns, campaignId) {
  try {
    return await fetchAllCampaignRows(tableName, columns, campaignId);
  } catch (error) {
    console.warn(`Optional campaign table "${tableName}" could not be loaded:`, error);
    return [];
  }
}

async function fetchPoiGroupRows(campaignId) {
  try {
    return await fetchAllCampaignRows(
      "poi_groups",
      "id, slug, name, group_type, group_icon, group_tags, generation_source, population, lore, image_asset_id",
      campaignId
    );
  } catch (error) {
    console.warn("Grouped POI icons/tags are unavailable until the latest Supabase query is run. Falling back to legacy rows.", error);
    const legacyRows = await fetchAllCampaignRows(
      "poi_groups",
      "id, slug, name, group_type, population, lore, image_asset_id",
      campaignId
    );
    return legacyRows.map(row => ({ ...row, group_icon: "", group_tags: [], generation_source: null }));
  }
}

async function fetchPoiRows(campaignId) {
  try {
    return await fetchAllCampaignRows(
      "pois",
      "id, ref_code, poi_group_id, name, hex_id, poi_type, poi_icon, poi_tags, generation_source, notoriety_tier, population, lore, image_asset_id",
      campaignId
    );
  } catch (error) {
    console.warn("POI icons/tags are unavailable until the latest Supabase query is run. Falling back to legacy rows.", error);
    const legacyRows = await fetchAllCampaignRows(
      "pois",
      "id, ref_code, poi_group_id, name, hex_id, poi_type, notoriety_tier, population, lore, image_asset_id",
      campaignId
    );
    return legacyRows.map(row => ({ ...row, poi_icon: "", poi_tags: [], generation_source: null }));
  }
}

async function fetchCampaignRows(campaignId) {
  const [
    regions,
    hexes,
    poiGroups,
    pois,
    maps,
    npcs,
    dmJournal,
    generatedMapOverlays
  ] = await Promise.all([
    fetchAllCampaignRows("regions", "id, ref_code, name, lore, image_asset_id, region_type, border_color", campaignId),
    fetchAllCampaignRows("hexes", "id, ref_code, terrain, map_xy, region_id, geographic_region_id, political_region_id, base_terrain, terrain_features, elevation", campaignId),
    fetchPoiGroupRows(campaignId),
    fetchPoiRows(campaignId),
    fetchAllCampaignRows("maps", "id, ref_code, name, map_type, sort_order, lore, image_asset_id, region_owner_id, poi_group_owner_id, poi_owner_id, hex_owner_id", campaignId),
    fetchAllCampaignRows("npcs", "id, ref_code, home_poi_id, title, name, organization, race, occupation, lore, image_asset_id", campaignId),
    fetchAllCampaignRows("dm_journal", "id, ref_code, entry_title, entry_body, entry_type, source_type, source_id, occurred_at, created_by_user_id, session_id, visibility", campaignId),
    fetchOptionalCampaignRows("generated_map_overlays", "id, overlay_type, from_hex_id, to_hex_id, hex_id, edge, style, is_major_route, route_name", campaignId)
  ]);

  const journalAuthorIds = [...new Set(
    (dmJournal || [])
      .map(entry => entry.created_by_user_id)
      .filter(Boolean)
  )];

  let journalProfiles = [];
  if (journalAuthorIds.length) {
    const { data: profileRows, error: profileError } = await campaignSupabase
      .from("profiles")
      .select("id, username")
      .in("id", journalAuthorIds);

    if (profileError) throw profileError;
    journalProfiles = profileRows || [];
  }

  return {
    regions,
    hexes,
    poiGroups,
    pois,
    maps,
    npcs,
    dmJournal,
    generatedMapOverlays,
    journalProfiles
  };
}

async function fetchCampaignAuditRows(campaignId) {
  if (getActiveCampaign?.()?.currentUserRole !== "owner") return [];

  const { data, error } = await campaignSupabase.rpc("get_campaign_audit_log", {
    target_campaign_id: campaignId,
    result_limit: 30
  });

  if (error) {
    console.warn("Campaign audit log could not be loaded:", error);
    return [];
  }

  return data || [];
}

async function fetchCampaignAssets(campaignId) {
  const { data, error } = await campaignSupabase
    .from("assets")
    .select("id, storage_bucket, storage_path, mime_type")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const assets = data || [];
  if (!assets.length) return {};

  const byBucket = assets.reduce((groups, asset) => {
    if (!groups[asset.storage_bucket]) groups[asset.storage_bucket] = [];
    groups[asset.storage_bucket].push(asset);
    return groups;
  }, {});

  const signedAssetEntries = await Promise.all(
    Object.entries(byBucket).map(async ([bucket, bucketAssets]) => {
      const paths = bucketAssets.map(asset => asset.storage_path);
      const { data: signedRows, error: signedError } = await campaignSupabase
        .storage
        .from(bucket)
        .createSignedUrls(paths, 60 * 60 * 24);

      if (signedError) throw signedError;

      return bucketAssets.map((asset, index) => [
        asset.id,
        {
          ...asset,
          signedUrl: signedRows?.[index]?.signedUrl || ""
        }
      ]);
    })
  );

  return Object.fromEntries(signedAssetEntries.flat());
}

function buildLegacyRecordMaps(rows) {
  return {
    regionsByUuid: Object.fromEntries(rows.regions.map(region => [region.id, region.ref_code])),
    hexesByUuid: Object.fromEntries(rows.hexes.map(hex => [hex.id, hex.ref_code])),
    poiGroupsByUuid: Object.fromEntries(rows.poiGroups.map(group => [group.id, group.slug])),
    poisByUuid: Object.fromEntries(rows.pois.map(poi => [poi.id, poi.ref_code])),
    mapsByUuid: Object.fromEntries(rows.maps.map(map => [map.id, map.ref_code])),
    npcsByUuid: Object.fromEntries(rows.npcs.map(npc => [npc.id, npc.ref_code]))
  };
}

function isGeneratedMapMode() {
  return getActiveCampaign?.()?.map_mode === "generated";
}

function isGeneratedHexRow(hex) {
  return Boolean(hex?.base_terrain);
}

function getActiveHexRows(rows) {
  if (!isGeneratedMapMode()) return rows.hexes;
  return rows.hexes.filter(isGeneratedHexRow);
}

function getActiveRegionRows(rows, activeHexRows) {
  if (!isGeneratedMapMode()) return rows.regions;

  const activeRegionIds = new Set();

  activeHexRows.forEach(hex => {
    [
      hex.geographic_region_id || hex.region_id,
      hex.political_region_id
    ].filter(Boolean).forEach(regionId => activeRegionIds.add(regionId));
  });

  return rows.regions.filter(region => (
    ["geographic", "political"].includes(region.region_type) ||
    activeRegionIds.has(region.id)
  ));
}

const codexBaseTerrainLabels = {
  deep_sea: "Deep Sea",
  sea: "Sea",
  coastal_water: "Coastal Water",
  inland_water: "Inland Water",
  beach: "Beach",
  plains: "Plains",
  grassland: "Grassland",
  lush_grassland: "Lush Grassland",
  wetland: "Wetland",
  jungle_floor: "Jungle Floor",
  desert: "Desert",
  deep_desert: "Deep Desert",
  barrens: "Barrens",
  bleak_barrens: "Bleak Barrens",
  snow: "Snow",
  rock: "Rock",
  wastes: "Wastes"
};

const codexFeatureLabels = {
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
  ice: "Ice",
  mist: "Mist"
};

const codexValidFeaturesByBase = {
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
  snow: ["ridges", "mountains", "snowcapped_mountains", "woods", "forest", "ice", "mist"],
  rock: ["ridges", "mountains", "woods", "forest", "cliffs", "lone_mountain", "volcano", "mist"],
  wastes: ["ridges", "cliffs", "lone_mountain", "volcano", "mist"]
};

const codexExclusiveFeatureGroups = [
  ["mountains", "snowcapped_mountains", "lone_mountain", "volcano"],
  ["woods", "forest"]
];

function getCodexValidTerrainFeatures(baseTerrain, features = []) {
  const valid = new Set(codexValidFeaturesByBase[baseTerrain] || []);
  let normalized = [...new Set(features)].filter(feature => valid.has(feature));

  codexExclusiveFeatureGroups.forEach(group => {
    const selectedGroupFeatures = normalized.filter(feature => group.includes(feature));
    if (selectedGroupFeatures.length <= 1) return;
    const keepFeature = selectedGroupFeatures[0];
    normalized = normalized.filter(feature => !group.includes(feature) || feature === keepFeature);
  });

  return normalized;
}

function getCodexGeneratedTerrainName(baseTerrain, featuresInput = []) {
  if (window.CampaignTerrainRules?.getTerrainDisplayName) {
    return window.CampaignTerrainRules.getTerrainDisplayName(baseTerrain, featuresInput);
  }

  const base = codexBaseTerrainLabels[baseTerrain] || baseTerrain || "Unknown";
  const features = getCodexValidTerrainFeatures(baseTerrain, featuresInput);
  const has = featureId => features.includes(featureId);
  const misty = has("mist");
  const prefix = value => misty && !String(value).startsWith("Misty ") ? `Misty ${value}` : value;

  if (!features.length) return base;

  if (["deep_sea", "sea", "coastal_water", "inland_water"].includes(baseTerrain)) {
    if (has("whirlpool")) return prefix("Whirlpool");
    if (has("falls")) return prefix("Falls");
    if (has("rapids")) return prefix("Rapids");
    if (has("reef")) return prefix("Reef");
    if (has("shoals")) return prefix("Shoals");
    if (has("water_rocks")) return prefix("Rocky Waters");
    if (has("kelp")) return prefix("Kelp Beds");
    if (has("ice")) return prefix(baseTerrain === "deep_sea" ? "Frozen Deep Sea" : baseTerrain === "sea" ? "Frozen Sea" : baseTerrain === "coastal_water" ? "Frozen Coastal Water" : "Frozen Inland Water");
    if (has("waves")) return prefix(baseTerrain === "deep_sea" ? "Rough Deep Sea" : baseTerrain === "sea" ? "Rough Sea" : baseTerrain === "coastal_water" ? "Rough Coastal Water" : "Rough Inland Water");
    return misty ? prefix(base) : base;
  }

  if (baseTerrain === "beach") {
    if (misty) return "Misty Coast";
    if (has("sand")) return "Sandy Beach";
    if (has("cliffs")) return "Coastal Cliffs";
    if (has("ridges")) return "Beach Dunes";
    if (has("water_rocks")) return "Rocky Coast";
    return base;
  }

  if (has("volcano")) return prefix("Volcano");
  if (has("lone_mountain")) return prefix("Lone Mountain");

  if (baseTerrain === "rock") {
    if (has("mountains") && has("forest")) return prefix("Forested Mountains");
    if (has("mountains") && has("woods")) return prefix("Wooded Mountains");
    if (has("mountains")) return prefix("Mountains");
    if (has("cliffs")) return prefix("Cliffs");
    if (has("ridges")) return prefix("Rocky Hills");
  }

  if (baseTerrain === "snow") {
    if (has("snowcapped_mountains") || has("mountains")) return prefix("Snowcapped Mountains");
    if (has("ridges")) return prefix("Snowy Hills");
    if (has("forest")) return prefix("Snowy Forest");
    if (has("woods")) return prefix("Snowy Woods");
    if (has("ice")) return prefix("Ice Fields");
  }

  if (baseTerrain === "wetland") {
    if (has("forest")) return prefix("Evergreen Wetlands");
    if (has("woods")) return prefix("Wet Woods");
    if (has("marsh")) return prefix("Marsh");
  }

  if (baseTerrain === "jungle_floor") {
    if (has("ridges")) return prefix("Jungle Hills");
    if (has("jungle")) return prefix("Jungle");
  }

  if (has("farmland")) return prefix("Cultivated Farmland");

  if (baseTerrain === "desert") {
    if (has("sand")) return prefix("Sandy Desert");
    if (has("ridges")) return prefix("Dunes");
    if (has("cactus_scrub")) return prefix("Cactus Scrub");
    if (has("cliffs")) return prefix("Desert Cliffs");
  }

  if (baseTerrain === "deep_desert") {
    if (has("sand")) return prefix("Sandy Deep Desert");
    if (has("ridges")) return prefix("Rocky Desert");
    if (has("cactus_scrub")) return prefix("Cactus Scrub");
    if (has("cliffs")) return prefix("Desert Cliffs");
  }

  if (baseTerrain === "barrens" || baseTerrain === "bleak_barrens") {
    if (has("cliffs")) return prefix(baseTerrain === "bleak_barrens" ? "Bleak Cliffs" : "Barren Cliffs");
    if (has("ridges") && has("shrub")) return prefix(baseTerrain === "bleak_barrens" ? "Bleak Shrubland Hills" : "Shrubland Hills");
    if (has("ridges")) return prefix(baseTerrain === "bleak_barrens" ? "Bleak Hills" : "Barren Hills");
    if (has("shrub")) return prefix(baseTerrain === "bleak_barrens" ? "Bleak Shrubland" : "Shrubland");
  }

  if (baseTerrain === "wastes") {
    if (has("cliffs")) return prefix("Wasted Cliffs");
    if (has("ridges")) return prefix("Wasted Hills");
  }

  if (baseTerrain === "plains") {
    if (has("ridges") && has("shrub")) return prefix("Shrubland Hills");
    if (has("ridges")) return prefix("Hills");
    if (has("shrub")) return prefix("Shrubland");
    if (has("woods")) return prefix("Woods");
  }

  if (baseTerrain === "grassland") {
    if (has("ridges") && has("forest")) return prefix("Forested Hills");
    if (has("ridges") && has("woods")) return prefix("Wooded Hills");
    if (has("ridges") && has("shrub")) return prefix("Shrubland Hills");
    if (has("ridges")) return prefix("Grassy Hills");
    if (has("forest")) return prefix("Forest");
    if (has("woods")) return prefix("Woods");
    if (has("shrub")) return prefix("Brushland");
  }

  if (baseTerrain === "lush_grassland") {
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
    .map(featureId => codexFeatureLabels[featureId])
    .filter(Boolean);

  return prefix(featureNames.length ? `${base} + ${featureNames.join(" + ")}` : base);
}

function getCodexTerrainLabel(hex) {
  if (!hex?.base_terrain) return hex?.terrain || "";
  return getCodexGeneratedTerrainName(hex.base_terrain, Array.isArray(hex.terrain_features) ? hex.terrain_features : []);
}

function adaptCampaignRows(rows, assetsById) {
  const recordMaps = buildLegacyRecordMaps(rows);
  const activeHexRows = getActiveHexRows(rows);
  const activeRegionRows = getActiveRegionRows(rows, activeHexRows);

  const regions = activeRegionRows.map(region => ({
    __uuid: region.id,
    Region_ID: region.ref_code,
    Region_Name: region.name || "",
    Region_Type: region.region_type || "geographic",
    Border_Color: region.ref_code === "REG-0000" ? "none" : region.border_color || "#ffd84d",
    Lore: region.lore || "",
    Image: getAssetValue(assetsById[region.image_asset_id])
  }));

  const hexes = activeHexRows.map(hex => ({
    __uuid: hex.id,
    Hex_ID: hex.ref_code,
    Region_ID_Ref: recordMaps.regionsByUuid[hex.geographic_region_id || hex.region_id] || "",
    Political_Region_ID_Ref: recordMaps.regionsByUuid[hex.political_region_id] || "",
    Terrain: getCodexTerrainLabel(hex),
    Map_XY: hex.map_xy || "",
    Base_Terrain: hex.base_terrain || "",
    Terrain_Features: Array.isArray(hex.terrain_features) ? hex.terrain_features : [],
    Elevation: hex.elevation == null ? "" : String(hex.elevation)
  }));

  const poiGroups = rows.poiGroups.map(group => ({
    __uuid: group.id,
    POI_Group_ID: group.slug,
    POI_Group_Name: group.name || "",
    Group_Type: getLoadedPoiTypeLabel(group.group_type),
    Group_Type_Value: getLoadedPoiTypeValue(group.group_type),
    Group_Icon: getLoadedPoiIconValue(group.group_icon),
    Group_Tags: getLoadedPoiTagValues(group.group_tags),
    Generation_Source: group.generation_source || "",
    Population: group.population || "",
    Lore: group.lore || "",
    Image: getAssetValue(assetsById[group.image_asset_id])
  }));

  const pois = rows.pois.map(poi => ({
    __uuid: poi.id,
    POI_ID: poi.ref_code,
    POI_Group_ID: recordMaps.poiGroupsByUuid[poi.poi_group_id] || "",
    Name: poi.name || "",
    Hex_ID_Ref: recordMaps.hexesByUuid[poi.hex_id] || "",
    POI_Type: getLoadedPoiTypeLabel(poi.poi_type),
    POI_Type_Value: getLoadedPoiTypeValue(poi.poi_type),
    POI_Icon: getLoadedPoiIconValue(poi.poi_icon),
    POI_Tags: getLoadedPoiTagValues(poi.poi_tags),
    Generation_Source: poi.generation_source || "",
    "Notoriety Tier": getLoadedPoiNotorietyLabel(poi.notoriety_tier),
    "Notoriety Tier_Value": getLoadedPoiNotorietyValue(poi.notoriety_tier),
    Population: poi.population || "",
    Lore: poi.lore || "",
    Image: getAssetValue(assetsById[poi.image_asset_id])
  }));

  const maps = rows.maps.map(map => {
    let ownerType = "";
    let ownerId = "";

    if (map.region_owner_id) {
      ownerType = "region";
      ownerId = recordMaps.regionsByUuid[map.region_owner_id] || "";
    } else if (map.poi_group_owner_id) {
      ownerType = "poi-group";
      ownerId = recordMaps.poiGroupsByUuid[map.poi_group_owner_id] || "";
    } else if (map.poi_owner_id) {
      ownerType = "poi";
      ownerId = recordMaps.poisByUuid[map.poi_owner_id] || "";
    } else if (map.hex_owner_id) {
      ownerType = "hex";
      ownerId = recordMaps.hexesByUuid[map.hex_owner_id] || "";
    }

    return {
      __uuid: map.id,
      Map_ID: map.ref_code,
      Owner_Type: ownerType,
      Owner_ID_Ref: ownerId,
      Map_Name: map.name || "",
      Map_Type: map.map_type || "",
      Image: getPreviewAssetValue(assetsById[map.image_asset_id]),
      Map_File_URL: getAssetValue(assetsById[map.image_asset_id]),
      Map_Mime_Type: assetsById[map.image_asset_id]?.mime_type || "",
      Sort_Order: map.sort_order == null ? "" : String(map.sort_order),
      Lore: map.lore || ""
    };
  });

  const npcs = rows.npcs.map(npc => ({
    __uuid: npc.id,
    NPC_ID: npc.ref_code,
    Home_ID_Ref: recordMaps.poisByUuid[npc.home_poi_id] || "",
    Title: npc.title || "",
    Name: npc.name || "",
    Organization: npc.organization || "",
    Race: npc.race || "",
    Occupation: npc.occupation || "",
    Lore: npc.lore || "",
    Image: getAssetValue(assetsById[npc.image_asset_id])
  }));

  const generatedMapOverlays = (rows.generatedMapOverlays || []).map(overlay => ({
    __uuid: overlay.id,
    Overlay_Type: overlay.overlay_type || "",
    From_Hex_ID_Ref: recordMaps.hexesByUuid[overlay.from_hex_id] || "",
    To_Hex_ID_Ref: recordMaps.hexesByUuid[overlay.to_hex_id] || "",
    Hex_ID_Ref: recordMaps.hexesByUuid[overlay.hex_id] || "",
    Edge: overlay.edge || "",
    Style: overlay.style || "",
    Is_Major_Route: Boolean(overlay.is_major_route),
    Route_Name: overlay.route_name || ""
  }));

  const sourceMaps = {
    region: recordMaps.regionsByUuid,
    hex: recordMaps.hexesByUuid,
    poi_group: recordMaps.poiGroupsByUuid,
    poi: recordMaps.poisByUuid,
    npc: recordMaps.npcsByUuid,
    map: recordMaps.mapsByUuid
  };

  const journalProfilesById = Object.fromEntries(
    (rows.journalProfiles || []).map(profile => [profile.id, profile])
  );

  const dmJournal = rows.dmJournal.map(entry => ({
    __uuid: entry.id,
    Entry_ID: entry.ref_code,
    Entry_Title: entry.entry_title || "",
    Entry_Body: entry.entry_body || "",
    Entry_Type: entry.entry_type || "",
    Source_Type: entry.source_type || "",
    Source_ID: entry.source_type === "campaign"
      ? getActiveCampaign()?.id || ""
      : sourceMaps[entry.source_type]?.[entry.source_id] || "",
    Timestamp: entry.occurred_at || "",
    Created_By: entry.created_by_user_id || "",
    Created_By_Username: journalProfilesById[entry.created_by_user_id]?.username || "",
    Session_ID: entry.session_id || "",
    Visibility: entry.visibility || ""
  }));

  return {
    hexes,
    pois,
    npcs,
    regions,
    poiGroups,
    maps,
    dmJournal,
    generatedMapOverlays
  };
}

function indexById(rows, idField) {
  const index = {};

  rows.forEach(row => {
    const id = row[idField];

    if (id) {
      index[id] = row;
    }
  });

  return index;
}

function groupBy(rows, fieldName) {
  const groups = {};

  rows.forEach(row => {
    const key = row[fieldName];

    if (!key) return;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(row);
  });

  return groups;
}

function normalizeJournalSourceType(sourceType) {
  const normalized = String(sourceType || "").trim().toLowerCase();

  const aliases = {
    hex: "hex",
    hexes: "hex",
    region: "region",
    regions: "region",
    poi: "poi",
    pois: "poi",
    point_of_interest: "poi",
    points_of_interest: "poi",
    poi_group: "poi_group",
    poi_groups: "poi_group",
    poigroup: "poi_group",
    poigroups: "poi_group",
    npc: "npc",
    npcs: "npc"
  };

  return aliases[normalized] || normalized;
}

function getJournalSourceKey(sourceType, sourceId) {
  if (!sourceType || !sourceId) return "";
  return `${normalizeJournalSourceType(sourceType)}:${sourceId}`;
}

function sortJournalEntries(entries) {
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a.Timestamp || "") || 0;
    const bTime = Date.parse(b.Timestamp || "") || 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return String(b.Entry_ID || "").localeCompare(String(a.Entry_ID || ""));
  });
}

function groupJournalBySource(rows) {
  const groups = {};

  rows.forEach(row => {
    const key = getJournalSourceKey(row.Source_Type, row.Source_ID);

    if (!key) return;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(row);
  });

  Object.keys(groups).forEach(key => {
    groups[key] = sortJournalEntries(groups[key]);
  });

  return groups;
}

function formatJournalTimestamp(timestamp) {
  if (!timestamp) return "Undated";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const pad = value => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " | " + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(":");
}

function formatJournalEntriesText(entries) {
  return sortJournalEntries(entries)
    .map(entry => {
      const meta = [
        formatJournalTimestamp(entry.Timestamp),
        entry.Created_By_Username ? `by ${entry.Created_By_Username}` : "",
        entry.Entry_Type || ""
      ].filter(Boolean).join(" • ");

      return `${meta}\n${entry.Entry_Body || ""}`.trim();
    })
    .join("\n\n");
}

function applyJournalTextToRows(rows, sourceType, idField, journalGroups) {
  rows.forEach(row => {
    const key = getJournalSourceKey(sourceType, row[idField]);
    const entries = journalGroups[key] || [];

    row.DM_Journal_Entries = entries;
    row.DM_Journal = entries.length ? formatJournalEntriesText(entries) : "";
  });
}

function hydrateCentralJournal(appData) {
  const journalGroups = groupJournalBySource(appData.dmJournal);

  applyJournalTextToRows(appData.hexes, "hex", "Hex_ID", journalGroups);
  applyJournalTextToRows(appData.regions, "region", "Region_ID", journalGroups);
  applyJournalTextToRows(appData.pois, "poi", "POI_ID", journalGroups);
  applyJournalTextToRows(appData.poiGroups, "poi_group", "POI_Group_ID", journalGroups);
  applyJournalTextToRows(appData.npcs, "npc", "NPC_ID", journalGroups);

  return journalGroups;
}

function getMapOwnerKey(ownerType, ownerId) {
  if (!ownerType || !ownerId) return "";
  return `${String(ownerType).toLowerCase()}:${ownerId}`;
}

function groupMapsByOwner(rows) {
  const groups = {};

  rows.forEach(row => {
    const key = getMapOwnerKey(row.Owner_Type, row.Owner_ID_Ref);

    if (!key) return;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(row);
  });

  Object.values(groups).forEach(group => {
    group.sort((a, b) => {
      const aOrder = Number(a.Sort_Order) || 9999;
      const bOrder = Number(b.Sort_Order) || 9999;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return String(a.Map_Name || a.Map_ID || "")
        .localeCompare(String(b.Map_Name || b.Map_ID || ""));
    });
  });

  return groups;
}

async function loadDatabase() {
  const campaign = await bootstrapCampaignSession();
  if (!campaign || getActiveCampaign()?.id !== campaign.id) {
    return null;
  }

  const [rows, assetsById] = await Promise.all([
    fetchCampaignRows(campaign.id),
    fetchCampaignAssets(campaign.id)
  ]);

  const appData = adaptCampaignRows(rows, assetsById);
  appData.auditLog = await fetchCampaignAuditRows(campaign.id);

  const dmJournalBySourceKey = hydrateCentralJournal(appData);

  const db = {
    raw: appData,

    hexesById: indexById(appData.hexes, "Hex_ID"),
    poisById: indexById(appData.pois, "POI_ID"),
    npcsById: indexById(appData.npcs, "NPC_ID"),
    regionsById: indexById(appData.regions, "Region_ID"),
    poiGroupsById: indexById(appData.poiGroups, "POI_Group_ID"),
    mapsById: indexById(appData.maps, "Map_ID"),
    dmJournalById: indexById(appData.dmJournal, "Entry_ID"),
    generatedMapOverlaysById: indexById(appData.generatedMapOverlays, "__uuid"),
    auditLog: appData.auditLog,

    poisByHexId: groupBy(appData.pois, "Hex_ID_Ref"),
    npcsByHomeId: groupBy(appData.npcs, "Home_ID_Ref"),
    poisByGroupId: groupBy(appData.pois, "POI_Group_ID"),
    mapsByOwnerKey: groupMapsByOwner(appData.maps),
    dmJournalBySourceKey
  };

  window.db = db;
  return db;
}
