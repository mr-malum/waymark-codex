function getAssetValue(asset) {
  return asset?.signedUrl || "";
}

function getPreviewAssetValue(asset) {
  return String(asset?.mime_type || "").startsWith("image/")
    ? getAssetValue(asset)
    : "";
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

async function fetchCampaignRows(campaignId) {
  const [
    regions,
    hexes,
    poiGroups,
    pois,
    maps,
    npcs,
    dmJournal
  ] = await Promise.all([
    fetchAllCampaignRows("regions", "id, ref_code, name, lore, image_asset_id", campaignId),
    fetchAllCampaignRows("hexes", "id, ref_code, terrain, map_xy, region_id", campaignId),
    fetchAllCampaignRows("poi_groups", "id, slug, name, group_type, population, lore, image_asset_id", campaignId),
    fetchAllCampaignRows("pois", "id, ref_code, poi_group_id, name, hex_id, poi_type, notoriety_tier, population, lore, image_asset_id", campaignId),
    fetchAllCampaignRows("maps", "id, ref_code, name, map_type, sort_order, lore, image_asset_id, region_owner_id, poi_group_owner_id, poi_owner_id, hex_owner_id", campaignId),
    fetchAllCampaignRows("npcs", "id, ref_code, home_poi_id, title, name, organization, race, occupation, lore, image_asset_id", campaignId),
    fetchAllCampaignRows("dm_journal", "id, ref_code, entry_title, entry_body, entry_type, source_type, source_id, occurred_at, created_by_user_id, session_id, visibility", campaignId)
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

function adaptCampaignRows(rows, assetsById) {
  const recordMaps = buildLegacyRecordMaps(rows);

  const regions = rows.regions.map(region => ({
    __uuid: region.id,
    Region_ID: region.ref_code,
    Region_Name: region.name || "",
    Lore: region.lore || "",
    Image: getAssetValue(assetsById[region.image_asset_id])
  }));

  const hexes = rows.hexes.map(hex => ({
    __uuid: hex.id,
    Hex_ID: hex.ref_code,
    Region_ID_Ref: recordMaps.regionsByUuid[hex.region_id] || "",
    Terrain: hex.terrain || "",
    Map_XY: hex.map_xy || ""
  }));

  const poiGroups = rows.poiGroups.map(group => ({
    __uuid: group.id,
    POI_Group_ID: group.slug,
    POI_Group_Name: group.name || "",
    Group_Type: group.group_type || "",
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
    POI_Type: poi.poi_type || "",
    "Notoriety Tier": poi.notoriety_tier || "",
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
    dmJournal
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
