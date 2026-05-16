const sheetUrls = {
  hexes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1899494677&single=true&output=csv",
  pois: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1900621664&single=true&output=csv",
  npcs: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=603218189&single=true&output=csv",
  regions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=30419630&single=true&output=csv",
  poiGroups: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1000348883&single=true&output=csv",
  maps: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1435181261&single=true&output=csv",
  dmJournal: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=2138300710&single=true&output=csv"
};

function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (currentValue || currentRow.length) {
        currentRow.push(currentValue.trim());
        rows.push(currentRow);
        currentRow = [];
        currentValue = "";
      }

      if (char === "\r" && nextChar === "\n") {
        i++;
      }
    } else {
      currentValue += char;
    }
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue.trim());
    rows.push(currentRow);
  }

  const headers = rows.shift();

  return rows
    .filter(row => row.some(cell => cell !== ""))
    .map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });

      return obj;
    });
}

async function fetchSheet(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${url}`);
  }

  const csvText = await response.text();
  return parseCSV(csvText);
}

async function fetchOptionalSheet(url) {
  if (!url) {
    return [];
  }

  return fetchSheet(url);
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

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatJournalEntriesText(entries) {
  return sortJournalEntries(entries)
    .map(entry => {
      const meta = [
        formatJournalTimestamp(entry.Timestamp),
        entry.Created_By ? `by ${entry.Created_By}` : "",
        entry.Session_ID || "",
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
  const [hexes, pois, npcs, regions, poiGroups, maps, dmJournal] = await Promise.all([
    fetchSheet(sheetUrls.hexes),
    fetchSheet(sheetUrls.pois),
    fetchSheet(sheetUrls.npcs),
    fetchSheet(sheetUrls.regions),
    fetchSheet(sheetUrls.poiGroups),
    fetchOptionalSheet(sheetUrls.maps),
    fetchOptionalSheet(sheetUrls.dmJournal)
  ]);

  const appData = {
    hexes,
    pois,
    npcs,
    regions,
    poiGroups,
    maps,
    dmJournal
  };

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

    poisByHexId: groupBy(appData.pois, "Hex_ID_Ref"),
    npcsByHomeId: groupBy(appData.npcs, "Home_ID_Ref"),
    poisByGroupId: groupBy(appData.pois, "POI_Group_ID"),
    mapsByOwnerKey: groupMapsByOwner(appData.maps),
    dmJournalBySourceKey
  };

  window.db = db;
  return db;
}
