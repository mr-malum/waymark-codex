let db = null;

loadDatabase().then(loadedDb => {
  db = loadedDb;
  console.log("Database loaded:", db);
});

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 0,
  maxBoundsViscosity: 0.5
});

const imageWidth = 6417;
const imageHeight = 7575;
const bounds = [[0, 0], [imageHeight, imageWidth]];

L.imageOverlay("assets/Kadesh.png", bounds).addTo(map);
map.fitBounds(bounds);

function updatePanBounds() {
  const zoom = map.getZoom();
  const isMobile = window.innerWidth <= 768;

  let padding;

  if (isMobile) {
    padding = zoom < -2 ? 2600 : zoom < -1 ? 1100 : zoom < 0 ? 700 : 350;
  } else {
    padding = zoom < -2 ? 5200 : zoom < -1 ? 1700 : zoom < 0 ? 1100 : 600;
  }

  map.setMaxBounds([
    [-padding, -padding],
    [imageHeight + padding, imageWidth + padding]
  ]);
}

map.on("zoomend", updatePanBounds);
map.on("load", updatePanBounds);
map.whenReady(updatePanBounds);
updatePanBounds();

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

const centerX = (1.33 / 100) * imageWidth;
const centerY = imageHeight - ((1 / 100) * imageHeight);

const hexWidth = 82.25;
const hexHeight = 143.32;

const startX = centerX;
const startY = centerY;

const rowStepY = 150;
const colStepX = 255;
const oddColY = rowStepY / -2;
const oddColX = colStepX / 2;

let selectedHex = null;
let codexHistory = [];

const defaultStyle = {
  color: "#ffffff",
  weight: 4,
  opacity: 0.10,
  fillColor: "#ffffff",
  fillOpacity: 0.015,
  className: "hex-glow"
};

const hoverStyle = {
  opacity: 0.30,
  fillOpacity: 0.05,
  weight: 6
};

const selectedStyle = {
  opacity: 0.60,
  fillOpacity: 0.10,
  weight: 8
};

function makeHex(centerX, centerY, width, height) {
  return [
    [centerY, centerX + width],
    [centerY + height * 0.5, centerX + width * 0.5],
    [centerY + height * 0.5, centerX - width * 0.5],
    [centerY, centerX - width],
    [centerY - height * 0.5, centerX - width * 0.5],
    [centerY - height * 0.5, centerX + width * 0.5]
  ];
}

function getHexCenter(xxx, yyy) {
  const row = xxx - 300;
  const col = yyy - 300;
  const pair = Math.floor(col / 2);
  const odd = col % 2;

  const x = startX + (pair * colStepX) + (odd * oddColX);
  const y = startY - (row * rowStepY) + (odd * oddColY);

  return { x, y };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJsString(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

function getRowsByField(rows, fieldName, value) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row?.[fieldName] === value);
}

function getPoisForHex(hexId) {
  return db?.poisByHexId?.[hexId] || getRowsByField(db?.raw?.pois, "Hex_ID_Ref", hexId);
}

function getNpcsForPoi(poiId) {
  return db?.npcsByHomeId?.[poiId] || [];
}

function getNpcsForHex(hexId) {
  const pois = getPoisForHex(hexId);

  return pois.flatMap(poi => {
    return getNpcsForPoi(poi.POI_ID);
  });
}

function getHexCounts(hexId) {
  const pois = getPoisForHex(hexId);
  const npcCount = pois.reduce((total, poi) => {
    return total + getNpcsForPoi(poi.POI_ID).length;
  }, 0);

  return {
    poiCount: pois.length,
    npcCount
  };
}

function selectHex(hex) {
  if (selectedHex && selectedHex !== hex) {
    selectedHex.setStyle(defaultStyle);
  }

  selectedHex = hex;
  hex.setStyle(selectedStyle);
}

function clearSelectedHex() {
  if (selectedHex) {
    selectedHex.setStyle(defaultStyle);
    selectedHex = null;
  }
}

function setPanelSideFromClick(event) {
  const panel = document.getElementById("app-panel");
  const clickX = event.originalEvent.clientX;
  const screenWidth = window.innerWidth;

  panel.classList.remove("left", "right");

  if (clickX > screenWidth / 2) {
    panel.classList.add("left");
  } else {
    panel.classList.add("right");
  }
}

function closePanel() {
  document.getElementById("app-panel").classList.remove("open");
}

function openPanel() {
  document.getElementById("app-panel").classList.add("open");
}

function renderHexPreview(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const counts = getHexCounts(hexId);

  openPanel();

  document.getElementById("panel-title").textContent = `HEX ${hexId}`;
  document.getElementById("panel-subtitle").textContent = "Field Notes";

  const countLine = [
    counts.poiCount > 0 ? `${counts.poiCount} POI${counts.poiCount !== 1 ? "s" : ""}` : "",
    counts.npcCount > 0 ? `${counts.npcCount} NPC${counts.npcCount !== 1 ? "s" : ""}` : ""
  ].filter(Boolean).join(" • ");

  document.getElementById("panel-content").innerHTML = `
    <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>
    <p><strong>Region:</strong> ${escapeHtml(region?.Region_Name || hex?.Region_ID_Ref || "Unknown")}</p>

    ${countLine ? `<p><strong>Known Records:</strong> ${escapeHtml(countLine)}</p>` : ""}

    <p>
      ${escapeHtml(hex?.DM_Journal || "No journal entries.")}
    </p>

    <button class="codex-section-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">
      Open Details
    </button>
  `;
}

function openPanelForHex(hexId) {
  renderHexPreview(hexId);
}

function openCodex() {
  document.getElementById("codex-overlay").classList.add("open");
}

function closeCodex() {
  document.getElementById("codex-overlay").classList.remove("open");
}

function setCodexTitle(title) {
  document.getElementById("codex-title").textContent = title;
}

function setCodexContent(html, breadcrumbs = []) {
  const content = document.getElementById("codex-content");
  
  content.className = "";

  const breadcrumbHtml = breadcrumbs.length
    ? `
      <div id="codex-breadcrumbs">
        ${breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return `
            ${
              crumb.clickable && !isLast
                ? `
                  <button
                    class="codex-breadcrumb-button"
                    type="button"
                    onclick="${crumb.onclick}"
                  >
                    ${escapeHtml(crumb.label)}
                  </button>
                `
                : `
                  <span>${escapeHtml(crumb.label)}</span>
                `
            }

            ${
              !isLast
                ? `<span class="codex-breadcrumb-separator">/</span>`
                : ""
            }
          `;
        }).join("")}
      </div>
    `
    : "";

  content.innerHTML = breadcrumbHtml + html;
}

function updateCodexBackButton() {
  document.getElementById("codex-back").disabled = codexHistory.length <= 1;
}

function openCodexPage(type = "index", id = null, options = {}) {
  const shouldPush = options.push !== false;

  map.closePopup();
  closePanel();

  openCodex();

  if (shouldPush) {
    codexHistory.push({ type, id });
  }

  renderCodexPage(type, id);
  updateCodexBackButton();
}

function goBackCodex() {
  if (codexHistory.length <= 1) return;

  codexHistory.pop();

  const previous = codexHistory[codexHistory.length - 1];
  renderCodexPage(previous.type, previous.id);
  updateCodexBackButton();
}

function resetCodexToIndex() {
  codexHistory = [];
  openCodexPage("index", null);
}

function renderCodexPage(type, id) {
  if (!db) {
    setCodexTitle("The Codex of Kadesh");
    setCodexContent(`<p>The records are still being gathered...</p>`);
    return;
  }

  if (type === "hex") return renderCodexHexPage(id);
  if (type === "region") return renderCodexRegionPage(id);
  if (type === "poi") return renderCodexPoiPage(id);
  if (type === "npc") return renderCodexNpcPage(id);
  if (type === "search") return renderCodexSearchPage();
  if (type === "regions") return renderCodexRegionsIndex();
  if (type === "pois") return renderCodexPoisIndex();
  if (type === "npcs") return renderCodexNpcsIndex();

  return renderCodexIndex();
}

function renderCodexIndex() {
  setCodexTitle("The Codex of Kadesh");

  const content = document.getElementById("codex-content");

  content.className = "codex-home";

  content.innerHTML = `
    <button class="codex-section-button" type="button" onclick="openCodexPage('search')">Search</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('regions')">Regions</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('pois')">Points of Interest</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('npcs')">NPCs</button>
  `;
}

function renderCodexHexPage(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const pois = getPoisForHex(hexId);
  const npcs = getNpcsForHex(hexId);

  setCodexTitle(`Hex ${hexId}`);

  setCodexContent(`
    <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>

    <p>
      <strong>Region:</strong>
      ${
        region
          ? `<button class="codex-link-button" type="button" onclick="openCodexPage('region', '${escapeJsString(region.Region_ID)}')">${escapeHtml(region.Region_Name)}</button>`
          : escapeHtml(hex?.Region_ID_Ref || "Unknown")
      }
    </p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(hex?.DM_Journal || "No journal entries.")}</p>

    <h3>Points of Interest</h3>
    ${renderCodexLinkedList(pois, "No known points of interest in this hex.", "poi", "POI_ID", row => {
      return [row.Name, row.POI_Type, row["Notoriety Tier"]].filter(Boolean).join(" — ");
    })}

    <h3>NPCs</h3>
    ${renderCodexLinkedList(npcs, "No known NPCs associated with this hex.", "npc", "NPC_ID", row => {
      return [row.Name, row.Race, row.Occupation].filter(Boolean).join(" — ");
    })}
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: `Hex ${hexId}`
    }
  ]);
}

function renderCodexRegionPage(regionId) {
  const region = db?.regionsById?.[regionId];
  const hexes = getRowsByField(db?.raw?.hexes, "Region_ID_Ref", regionId);
  const regionName = region?.Region_Name || regionId || "Unknown Region";

  setCodexTitle(regionName);

  setCodexContent(`
    <h3>Region Notes</h3>
    <p>${escapeHtml(region?.Lore || region?.DM_Journal || "No region notes recorded.")}</p>

    <h3>Hexes</h3>
    ${renderCodexLinkedList(hexes, "No hexes currently assigned to this region.", "hex", "Hex_ID", row => {
      return `Hex ${row.Hex_ID} — ${row.Terrain || "Unknown Terrain"}`;
    })}
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "Regions",
      clickable: true,
      onclick: "openCodexPage('regions')"
    },
    {
      label: regionName
    }
  ]);
}

function renderCodexPoiPage(poiId) {
  const poi = db?.poisById?.[poiId];
  const npcs = getNpcsForPoi(poiId);
  const hexId = poi?.Hex_ID_Ref;
  const poiName = poi?.Name || poiId || "Unknown POI";

  setCodexTitle(poiName);

  setCodexContent(`
    <p><strong>Type:</strong> ${escapeHtml(poi?.POI_Type || "Unknown")}</p>
    <p><strong>Notoriety Tier:</strong> ${escapeHtml(poi?.["Notoriety Tier"] || "Unknown")}</p>

    ${
      hexId
        ? `<p><strong>Hex:</strong> <button class="codex-link-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">${escapeHtml(hexId)}</button></p>`
        : ""
    }

    ${
      poi?.POI_Type === "Settlement"
        ? `<p><strong>Population:</strong> ${escapeHtml(poi?.Population || "Unknown")}</p>`
        : ""
    }

    <h3>Lore</h3>
    <p>${escapeHtml(poi?.Lore || "No lore recorded.")}</p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(poi?.DM_Journal || "No journal entries.")}</p>

    <h3>NPCs</h3>
    ${renderCodexLinkedList(npcs, "No known NPCs at this location.", "npc", "NPC_ID", row => {
      return [row.Name, row.Race, row.Occupation].filter(Boolean).join(" — ");
    })}
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "Points of Interest",
      clickable: true,
      onclick: "openCodexPage('pois')"
    },
    {
      label: poiName
    }
  ]);
}

function renderCodexNpcPage(npcId) {
  const npc = db?.npcsById?.[npcId];
  const home = npc?.Home_ID_Ref ? db?.poisById?.[npc.Home_ID_Ref] : null;
  const npcName = npc?.Name || npcId || "Unknown NPC";

  setCodexTitle(npcName);

  setCodexContent(`
    <p>
      <strong>Home:</strong>
      ${
        home
          ? `<button class="codex-link-button" type="button" onclick="openCodexPage('poi', '${escapeJsString(home.POI_ID)}')">${escapeHtml(home.Name)}</button>`
          : escapeHtml(npc?.Home_ID_Ref || "Unknown")
      }
    </p>

    <p><strong>Race:</strong> ${escapeHtml(npc?.Race || "Unknown")}</p>
    <p><strong>Occupation:</strong> ${escapeHtml(npc?.Occupation || "Unknown")}</p>

    <h3>Lore</h3>
    <p>${escapeHtml(npc?.Lore || "No lore recorded.")}</p>

    <h3>DM Journal</h3>
    <p>${escapeHtml(npc?.DM_Journal || "No journal entries.")}</p>
  `, [
    {
      label: "Codex",
      clickable: true,
      onclick: "resetCodexToIndex()"
    },
    {
      label: "NPCs",
      clickable: true,
      onclick: "openCodexPage('npcs')"
    },
    {
      label: npcName
    }
  ]);
}

function renderCodexRegionsIndex() {
  const regions = db?.raw?.regions || [];

  setCodexTitle("Regions");

  setCodexContent(renderCodexLinkedList(
    regions,
    "No regions recorded.",
    "region",
    "Region_ID",
    row => row.Region_Name || row.Region_ID || "Unnamed Region"
  ));
}

function renderCodexPoisIndex() {
  const pois = db?.raw?.pois || [];

  setCodexTitle("Points of Interest");

  setCodexContent(renderCodexLinkedList(
    pois,
    "No points of interest recorded.",
    "poi",
    "POI_ID",
    row => [row.Name, row.POI_Type, row.Hex_ID_Ref].filter(Boolean).join(" — ")
  ));
}

function renderCodexNpcsIndex() {
  const npcs = db?.raw?.npcs || [];

  setCodexTitle("NPCs");

  setCodexContent(renderCodexLinkedList(
    npcs,
    "No NPCs recorded.",
    "npc",
    "NPC_ID",
    row => {
      const home = row.Home_ID_Ref ? db?.poisById?.[row.Home_ID_Ref] : null;
      const homeLabel = home?.Name || row.Home_ID_Ref;

      return [
        row.Name,
        [row.Race, row.Occupation].filter(Boolean).join(" • "),
        homeLabel || ""
      ].filter(Boolean).join(" — ");
    }
  ));
}

function renderCodexSearchPage() {
  setCodexTitle("Search the Codex");

  const content = document.getElementById("codex-content");

  content.className = "codex-search-page";

  content.innerHTML = `
    <div class="codex-search-shell">
      <input
        id="codex-search-input"
        type="search"
        placeholder="Search regions, POIs, NPCs..."
        autocomplete="off"
      />
    </div>

    <div id="codex-search-results">
      <p>Begin typing to search the records of Kadesh.</p>
    </div>
  `;

  const input = document.getElementById("codex-search-input");

  input.addEventListener("input", function () {
    renderCodexSearchResults(input.value);
  });

  input.focus();
}

function renderCodexSearchResults(query) {
  const resultsEl = document.getElementById("codex-search-results");
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    resultsEl.innerHTML = `<p>Begin typing to search the records of Kadesh.</p>`;
    return;
  }

  const results = [];

  (db?.raw?.regions || []).forEach(region => {
    const haystack = [
      region.Region_ID,
      region.Region_Name,
      region.Lore,
      region.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "region",
        id: region.Region_ID,
        label: `Region — ${region.Region_Name || region.Region_ID}`
      });
    }
  });

  (db?.raw?.pois || []).forEach(poi => {
    const haystack = [
      poi.POI_ID,
      poi.Name,
      poi.POI_Type,
      poi.Hex_ID_Ref,
      poi.Lore,
      poi.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "poi",
        id: poi.POI_ID,
        label: `POI — ${poi.Name || poi.POI_ID}`
      });
    }
  });

  (db?.raw?.npcs || []).forEach(npc => {
    const haystack = [
      npc.NPC_ID,
      npc.Name,
      npc.Race,
      npc.Occupation,
      npc.Home_ID_Ref,
      npc.Lore,
      npc.DM_Journal
    ].join(" ").toLowerCase();

    if (haystack.includes(cleanQuery)) {
      results.push({
        type: "npc",
        id: npc.NPC_ID,
        label: `NPC — ${npc.Name || npc.NPC_ID}`
      });
    }
  });

  if (!results.length) {
    resultsEl.innerHTML = `<p>No matching records found.</p>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="codex-list">
      ${results.map(result => `
        <button
          class="codex-section-button"
          type="button"
          onclick="openCodexPage('${escapeJsString(result.type)}', '${escapeJsString(result.id)}')"
        >
          ${escapeHtml(result.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCodexLinkedList(rows, emptyText, type, idField, getLabel) {
  if (!rows.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="codex-list">
      ${rows.map(row => {
        const id = row?.[idField];
        const label = getLabel(row) || id || "Unnamed Record";
        const parts = String(label).split(" — ");
        const title = parts.shift() || "Unnamed Record";
        const metaLines = parts;

        return `
          <button
            class="codex-section-button codex-record-button"
            type="button"
            onclick="openCodexPage('${escapeJsString(type)}', '${escapeJsString(id)}')"
          >
            <span class="codex-record-main">
              <span class="codex-record-title">${escapeHtml(title)}</span>
              ${metaLines.map(line => `
                  <span class="codex-record-meta">${escapeHtml(line)}</span>
                  `).join("")}
            </span>
            <span class="codex-record-arrow">›</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function buildMobilePopupHtml(hexId) {
  const data = db?.hexesById?.[hexId];
  const counts = getHexCounts(hexId);

  const info = [];

  if (counts.poiCount > 0) {
    info.push(`${counts.poiCount} POI${counts.poiCount !== 1 ? "s" : ""}`);
  }

  if (counts.npcCount > 0) {
    info.push(`${counts.npcCount} NPC${counts.npcCount !== 1 ? "s" : ""}`);
  }

  return `
    <strong>${escapeHtml(hexId)}</strong><br>
    ${escapeHtml(data?.Terrain || "Unknown")}

    ${
      info.length
        ? `<br><span>${escapeHtml(info.join(" • "))}</span>`
        : ""
    }

    <br>
    <button
      class="popup-open-details"
      type="button"
      onclick="openCodexPage('hex', '${escapeJsString(hexId)}')"
    >
      Open Details
    </button>
  `;
}

window.openPanelForHex = openPanelForHex;
window.openCodex = openCodex;
window.closeCodex = closeCodex;
window.openCodexPage = openCodexPage;
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;

for (let xxx = 300; xxx < 350; xxx++) {
  for (let yyy = 300; yyy < 350; yyy++) {
    const { x, y } = getHexCenter(xxx, yyy);
    const hexId = `${xxx}:${yyy}`;

    const hex = L.polygon(
      makeHex(x, y, hexWidth, hexHeight),
      defaultStyle
    ).addTo(map);

    hex.on("mouseover", function () {
      if (!isTouchDevice && this !== selectedHex) {
        this.setStyle(hoverStyle);
      }
    });

    hex.on("mouseout", function () {
      if (!isTouchDevice && this !== selectedHex) {
        this.setStyle(defaultStyle);
      }
    });

    hex.on("click", function (e) {
      L.DomEvent.stopPropagation(e);

      document.getElementById("codex-button").classList.remove("codex-label-visible");

      selectHex(this);

      if (isTouchDevice) {
        this.bindPopup(buildMobilePopupHtml(hexId)).openPopup();
      } else {
        setPanelSideFromClick(e);
        renderHexPreview(hexId);
      }
    });
  }
}

map.on("click", function () {
  closePanel();

  document.getElementById("codex-button").classList.remove("codex-label-visible");

  clearSelectedHex();
});

document.getElementById("panel-close").addEventListener("click", function () {
  closePanel();
  clearSelectedHex();
});

document.getElementById("mobile-panel-close").addEventListener("click", function () {
  closePanel();
  clearSelectedHex();
});

document.getElementById("mobile-panel-back").addEventListener("click", function () {
  closePanel();
});

document.getElementById("codex-button").addEventListener("click", function (event) {
  event.stopPropagation();

  const codexButton = document.getElementById("codex-button");

  map.closePopup();

  if (isTouchDevice && !codexButton.classList.contains("codex-label-visible")) {
    codexButton.classList.add("codex-label-visible");
    return;
  }

  codexButton.classList.remove("codex-label-visible");

  resetCodexToIndex();
});

document.getElementById("codex-close").addEventListener("click", function () {
  closeCodex();
});

document.getElementById("codex-back").addEventListener("click", function () {
  goBackCodex();
});

document.getElementById("codex-overlay").addEventListener("click", function (event) {
  if (event.target === this) {
    closeCodex();
  }
});
