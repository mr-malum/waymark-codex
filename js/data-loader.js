const sheetUrls = {
  hexes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1899494677&single=true&output=csv",
  pois: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1900621664&single=true&output=csv",
  npcs: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=603218189&single=true&output=csv",
  regions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=30419630&single=true&output=csv",
  poiGroups: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1000348883&single=true&output=csv",
  maps: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0ads-k6v3CiG58JEZkZa7sya_IqLMBiUTh0IfnKOGeWCmbbw9qLJL9KITnd_GadRzMVz_e0otMzaD/pub?gid=1435181261&single=true&output=csv"
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
  const [hexes, pois, npcs, regions, poiGroups, maps] = await Promise.all([
    fetchSheet(sheetUrls.hexes),
    fetchSheet(sheetUrls.pois),
    fetchSheet(sheetUrls.npcs),
    fetchSheet(sheetUrls.regions),
    fetchSheet(sheetUrls.poiGroups),
    fetchOptionalSheet(sheetUrls.maps)
  ]);

  const appData = {
    hexes,
    pois,
    npcs,
    regions,
    poiGroups,
    maps
  };

  const db = {
    raw: appData,

    hexesById: indexById(appData.hexes, "Hex_ID"),
    poisById: indexById(appData.pois, "POI_ID"),
    npcsById: indexById(appData.npcs, "NPC_ID"),
    regionsById: indexById(appData.regions, "Region_ID"),
    poiGroupsById: indexById(appData.poiGroups, "POI_Group_ID"),
    mapsById: indexById(appData.maps, "Map_ID"),

    poisByHexId: groupBy(appData.pois, "Hex_ID_Ref"),
    npcsByHomeId: groupBy(appData.npcs, "Home_ID_Ref"),
    poisByGroupId: groupBy(appData.pois, "POI_Group_ID"),
    mapsByOwnerKey: groupMapsByOwner(appData.maps)
  };

  window.db = db;
  return db;
}
