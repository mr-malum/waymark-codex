function joinCodexLabel(title, meta = []) {
  return [
    title,
    ...meta.filter(Boolean)
  ].filter(Boolean).join(" — ");
}

function buildPoiListLabel(row) {
  if (row.__codexRecordType === "poi-group") {
    return buildPoiGroupListLabel(row);
  }

  const meta = [];
  const group = getPoiGroupForPoi(row);

  const typeLine = [
    row.POI_Type || "",
    row["Notoriety Tier"] ? `Notoriety: ${row["Notoriety Tier"]}` : ""
  ].filter(Boolean).join(" • ");

  if (typeLine) {
    meta.push(typeLine);
  }

  if (group) {
    const groupPopulation = formatCodexPopulation(getPoiGroupPopulation(group));
    const groupLabel = [
      `Part of: ${group.POI_Group_Name || group.POI_Group_ID}`,
      groupPopulation ? `Pop. ${groupPopulation}` : ""
    ].filter(Boolean).join(" • ");

    meta.push(groupLabel);
  }

  const npcCount = getNpcsForPoi(row.POI_ID).length;
  const population = group ? "" : formatCodexPopulation(getPoiEffectivePopulation(row));

  const populationNpcLine = [
    population ? `Population: ${population}` : "",
    npcCount > 0 ? `${npcCount} NPC${npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  if (populationNpcLine) {
    meta.push(populationNpcLine);
  }

  return joinCodexLabel(
    row.Name || row.POI_ID || "Unnamed POI",
    meta
  );
}

function buildPoiGroupListLabel(group) {
  const groupPois = group.__codexGroupPois || getPoisForGroup(group.POI_Group_ID);
  const npcs = getNpcsForPoiGroup(group.POI_Group_ID);
  const population = formatCodexPopulation(group.Population);

  const meta = [];

  const typeLine = [
    group.Group_Type || "Grouped POI",
    `${groupPois.length} Area${groupPois.length !== 1 ? "s" : ""}`
  ].filter(Boolean).join(" • ");

  if (typeLine) {
    meta.push(typeLine);
  }

  const populationNpcLine = [
    population ? `Population: ${population}` : "",
    npcs.length > 0 ? `${npcs.length} NPC${npcs.length !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  if (populationNpcLine) {
    meta.push(populationNpcLine);
  }

  return joinCodexLabel(
    group.POI_Group_Name || group.POI_Group_ID || "Unnamed POI Group",
    meta
  );
}

function buildNpcListLabel(row) {
  const meta = [];

  const raceOccupation = [
    row.Race,
    row.Occupation
  ].filter(Boolean).join(" • ");

  if (raceOccupation) {
    meta.push(raceOccupation);
  }

  const home = row.Home_ID_Ref
    ? db?.poisById?.[row.Home_ID_Ref]
    : null;

  const group = home ? getPoiGroupForPoi(home) : null;
  const homeLabel = group?.POI_Group_Name || home?.Name || row.Home_ID_Ref;

  if (homeLabel) {
    meta.push(homeLabel);
  }

  return joinCodexLabel(
    row.Name || row.NPC_ID || "Unnamed NPC",
    meta
  );
}

function buildRegionListLabel(row) {
  const summary = getRegionSummary(row.Region_ID);

  const countLine = [
    `${summary.hexCount} hexes`,
    `${summary.poiCount} POIs`,
    summary.mappedAreaCount > summary.poiCount
      ? `${summary.mappedAreaCount} Areas`
      : "",
    `${summary.npcCount} NPCs`
  ].filter(Boolean).join(" • ");

  return joinCodexLabel(
    row.Region_Name || row.Region_ID || "Unnamed Region",
    [countLine]
  );
}

function buildHexListLabel(row) {
  const counts = getHexCounts(row.Hex_ID);
  const region = row.Region_ID_Ref ? db?.regionsById?.[row.Region_ID_Ref] : null;
  const regionName = region?.Region_Name || row.Region_ID_Ref || "Unknown";

  const countLine = [
    `Region: ${regionName}`,
    `${counts.poiCount} POI${counts.poiCount !== 1 ? "s" : ""}`,
    `${counts.npcCount} NPC${counts.npcCount !== 1 ? "s" : ""}`,
    row.Terrain || "Unknown Terrain"
  ].filter(Boolean).join(" • ");

  return joinCodexLabel(
    `Hex ${row.Hex_ID}`,
    [countLine]
  );
}

function buildSearchResultLabel(result) {
  return joinCodexLabel(
    result.title,
    result.meta || []
  );
}