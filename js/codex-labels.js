function joinCodexLabel(title, meta = []) {
  return [
    title,
    ...meta.filter(Boolean)
  ].filter(Boolean).join(" — ");
}

function buildPoiListLabel(row) {
  const meta = [];

  const typeLine = [
    row.POI_Type || "",
    row["Notoriety Tier"] ? `Notoriety: ${row["Notoriety Tier"]}` : ""
  ].filter(Boolean).join(" • ");

  if (typeLine) {
    meta.push(typeLine);
  }

  const npcCount = getNpcsForPoi(row.POI_ID).length;

  const populationNpcLine = [
    row.Population ? `Population: ${row.Population}` : "",
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

  const homeLabel = home?.Name || row.Home_ID_Ref;

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

  return joinCodexLabel(
    row.Region_Name || row.Region_ID || "Unnamed Region",
    [
      `${summary.hexCount} hexes • ${summary.poiCount} POIs • ${summary.npcCount} NPCs`
    ]
  );
}

function buildHexListLabel(row) {
  const counts = getHexCounts(row.Hex_ID);
  const countLine = buildCountLine(counts.poiCount, counts.npcCount);

  return joinCodexLabel(
    `Hex ${row.Hex_ID}`,
    [
      row.Terrain || "Unknown Terrain",
      countLine
    ]
  );
}

function buildSearchResultLabel(result) {
  return joinCodexLabel(
    result.title,
    result.meta || []
  );
}