function selectHex(hex) {
  if (selectedHex && selectedHex !== hex) {
    selectedHex.setStyle(selectedHex.__codexBaseStyle || defaultStyle);
  }

  selectedHex = hex;
  hex.setStyle(hex.__codexSelectedStyle || selectedStyle);
}

function clearSelectedHex() {
  if (selectedHex) {
    selectedHex.setStyle(selectedHex.__codexBaseStyle || defaultStyle);
    selectedHex = null;
  }

  window.generatedMapRenderer?.clearSelection();
}

function closePanel(options = {}) {
  const panel = document.getElementById("app-panel");
  const wasOpen = panel.classList.contains("open");

  panel.classList.remove("open");

  if (options.centerSelected && selectedHexId) {
    centerHexInView(selectedHexId);
  }

  if (options.clearSelection) {
    clearSelectedHex();
    map.closePopup();
  }

  if (
    wasOpen &&
    options.syncHistory !== false &&
    typeof releaseAppBrowserBackTrap === "function"
  ) {
    releaseAppBrowserBackTrap();
  }
}

function openPanel() {
  const panel = document.getElementById("app-panel");

  if (typeof ensureAppBrowserBackTrap === "function") {
    ensureAppBrowserBackTrap();
  }

  requestAnimationFrame(() => {
    panel.classList.add("open");
  });
}

function renderHexPreview(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const politicalRegion = hex?.Political_Region_ID_Ref ? db?.regionsById?.[hex.Political_Region_ID_Ref] : null;
  const counts = getHexCounts(hexId);

  openPanel();

  document.getElementById("panel-title").textContent = `HEX ${hexId}`;
  document.getElementById("panel-subtitle").textContent = "Field Notes";

  const countLine = buildCountLine(counts.poiCount, counts.npcCount);
  const journalPreview = getLimitedLines(hex?.DM_Journal, 4);

  document.getElementById("panel-content").innerHTML = `
    <div class="hex-preview-ledger">
      <div class="hex-preview-row">
        <span class="hex-preview-label">Terrain</span>
        <span class="hex-preview-value">${escapeHtml(hex?.Terrain || "Unknown")}</span>
      </div>

      <div class="hex-preview-row">
        <span class="hex-preview-label">Region</span>
        <span class="hex-preview-value">${escapeHtml(region?.Region_Name || hex?.Region_ID_Ref || "Unknown")}</span>
      </div>

      ${politicalRegion || hex?.Political_Region_ID_Ref ? `
        <div class="hex-preview-row">
          <span class="hex-preview-label">Political</span>
          <span class="hex-preview-value">${escapeHtml(politicalRegion?.Region_Name || hex?.Political_Region_ID_Ref)}</span>
        </div>
      ` : ""}

      ${countLine ? `
        <div class="hex-preview-row">
          <span class="hex-preview-label">Records</span>
          <span class="hex-preview-value">${escapeHtml(countLine)}</span>
        </div>
      ` : ""}
    </div>

    <section class="hex-preview-notes">
      <h3>Field Notes</h3>
      <p class="panel-journal-preview">
        ${renderMultilineText(journalPreview)}
      </p>
    </section>

    <button class="hex-preview-details-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">
      Open Details
    </button>
  `;
}

function openPanelForHex(hexId) {
  renderHexPreview(hexId);
}

function panHexIntoInspectorView(hexId) {
  if (window.generatedMapRenderer?.isActive?.()) {
    window.generatedMapRenderer.centerHexInView(hexId, true);
    return;
  }

  const center = getMapHexCenter(hexId);
  const targetLatLng = L.latLng(center.y, center.x);

  const targetPoint = map.latLngToContainerPoint(targetLatLng);
  const desiredPoint = L.point(
    map.getSize().x * 0.33,
    map.getSize().y * 0.5
  );

  const offset = targetPoint.subtract(desiredPoint);

  map.panBy(offset, {
    animate: true,
    duration: 0.35
  });
}

function resetMapToAtlasView() {
  if (window.generatedMapRenderer?.isActive?.()) {
    clearSelectedHex();
    selectedHexId = null;
    window.generatedMapRenderer.fitViewToMap();
    return;
  }

  map.closePopup();
  clearSelectedHex();
  selectedHexId = null;
  map.fitBounds(currentMapBounds, { animate: true, duration: 0.5 });
}

function centerHexInView(hexId) {
  if (window.generatedMapRenderer?.isActive?.()) {
    window.generatedMapRenderer.centerHexInView(hexId);
    return;
  }

  const center = getMapHexCenter(hexId);

  map.panTo(
    L.latLng(center.y, center.x),
    {
      animate: true,
      duration: 0.35
    }
  );
}

function toggleRetroCodexMode() {
  retroCodexMode = !retroCodexMode;

  const codexButton = document.getElementById("codex-button");

  codexButton.classList.toggle("codex-retro-mode", retroCodexMode);

  if (retroCodexMode) {
    codexButton.style.backgroundImage =
      "url('assets/Win95SwordShield_Upscaled.png')";
  
    codexButton.style.backgroundSize = "75%";
  }
  else {
    codexButton.style.backgroundImage =
      "url('assets/Codex_Book_Button.png')";
  
    codexButton.style.backgroundSize = "";
  }
}

function closeMobileHexPopup() {
  if (window.generatedMapRenderer?.isActive?.()) {
    clearSelectedHex();
    selectedHexId = null;
    return;
  }

  map.closePopup();
  clearSelectedHex();
}

function getPopupPoiSortRank(poi) {
  const rawValue = String(poi?.["Notoriety Tier_Value"] || poi?.["Notoriety Tier"] || "");
  const matched = rawValue.match(/\d+/)?.[0] || "";
  const parsed = Number.parseInt(matched, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99;
}

function getPopupPoisForHex(hexId) {
  return [...(getPoisForHex(hexId) || [])].sort((left, right) => {
    const notorietyDelta = getPopupPoiSortRank(left) - getPopupPoiSortRank(right);
    if (notorietyDelta !== 0) return notorietyDelta;
    return String(left?.Name || left?.POI_ID || "")
      .localeCompare(String(right?.Name || right?.POI_ID || ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
  });
}

function renderPopupPoiList(hexId, options = {}) {
  const pois = getPopupPoisForHex(hexId);
  if (!pois.length) {
    return `<div class="mobile-hex-popup-pois-empty">No POIs recorded in this hex yet.</div>`;
  }

  const disableLinks = options.disablePoiLinks === true;
  const visiblePois = pois.slice(0, 2);
  const remainingCount = Math.max(0, pois.length - visiblePois.length);

  return `
    <div class="mobile-hex-popup-pois">
      <div class="mobile-hex-popup-pois-label">POIs</div>
      <div class="mobile-hex-popup-poi-list">
        ${visiblePois.map(poi => {
          const label = escapeHtml(poi?.Name || poi?.POI_ID || "Unnamed POI");
          if (disableLinks) {
            return `<span class="mobile-hex-popup-poi-name">${label}</span>`;
          }

          return `
            <button
              class="mobile-hex-popup-poi-link"
              type="button"
              onclick="closeMobileHexPopup(); openCodexPage('poi', '${escapeJsString(poi?.POI_ID || "")}')"
            >
              ${label}
            </button>
          `;
        }).join("")}
      </div>
      ${remainingCount ? `<div class="mobile-hex-popup-poi-more">+${remainingCount} more in this hex.</div>` : ""}
    </div>
  `;
}

function buildAddPoiButtonAction(hexId, regionId = "") {
  const argumentsList = [];
  if (regionId) {
    argumentsList.push(`regionId: '${escapeJsString(regionId)}'`);
    argumentsList.push("lockRegion: true");
  }
  if (hexId && regionId) {
    argumentsList.push(`hexId: '${escapeJsString(hexId)}'`);
    argumentsList.push("lockHex: true");
  }
  argumentsList.push("lockCreateGroup: true");

  return `closeMobileHexPopup(); openAddPoiEditor({ ${argumentsList.join(", ")} });`;
}

function buildMobilePopupHtml(hexId, options = {}) {
  const data = db?.hexesById?.[hexId];
  const counts = getHexCounts(hexId);
  const region = data?.Region_ID_Ref ? db?.regionsById?.[data.Region_ID_Ref] : null;
  const politicalRegion = data?.Political_Region_ID_Ref ? db?.regionsById?.[data.Political_Region_ID_Ref] : null;
  const regionName = region?.Region_Name || data?.Region_ID_Ref || "Unknown Region";
  const politicalRegionName = politicalRegion?.Region_Name || data?.Political_Region_ID_Ref || "No Sovereign Control";
  const elevation = Number.isFinite(Number(data?.Elevation)) ? Number(data.Elevation) : null;
  const terrainName = getPopupTerrainName(data);

  const info = [];
  const disablePoiLinks = options.detailsDisabled === true || options.disablePoiLinks === true;

  if (counts.npcCount > 0) {
    info.push(`${counts.npcCount} NPC${counts.npcCount !== 1 ? "s" : ""}`);
  }

  return `
    <div class="mobile-hex-popup-card">
      <div class="mobile-hex-popup-title">Hex ${escapeHtml(hexId)}</div>
      <div class="mobile-hex-popup-region">${escapeHtml(politicalRegionName)}</div>
      <div class="mobile-hex-popup-political-region">${escapeHtml(regionName)}</div>
      <div class="mobile-hex-popup-terrain">${escapeHtml(terrainName)}</div>
      ${
        elevation !== null
          ? `<div class="mobile-hex-popup-elevation">Elevation ${escapeHtml(String(elevation))}</div>`
          : ""
      }
      ${
        info.length
          ? `<div class="mobile-hex-popup-meta">${escapeHtml(info.join(" • "))}</div>`
          : ""
      }
      ${renderPopupPoiList(hexId, { disablePoiLinks })}

      <div class="popup-action-row${options.detailsDisabled ? " popup-action-row-editor-preview" : ""}">
        ${
          options.detailsDisabled
            ? ""
            : `<button
                class="popup-open-details"
                type="button"
                onclick="openCodexPage('hex', '${escapeJsString(hexId)}')"
              >
                Details
              </button>`
        }
        <button
          class="popup-add-poi"
          type="button"
          onclick="${buildAddPoiButtonAction(hexId, data?.Region_ID_Ref || "")}"
        >
          Add POI
        </button>

        <button
          class="popup-close-details"
          type="button"
          aria-label="Close hex preview"
          onclick="closeMobileHexPopup()"
        >
          ×
        </button>
      </div>
    </div>
  `;
}

function getPopupTerrainName(data) {
  const baseTerrain = data?.Base_Terrain || data?.base_terrain;
  const features = Array.isArray(data?.Terrain_Features)
    ? data.Terrain_Features
    : Array.isArray(data?.terrain_features)
    ? data.terrain_features
    : [];

  if (baseTerrain && window.CampaignTerrainRules?.getTerrainDisplayName) {
    return window.CampaignTerrainRules.getTerrainDisplayName(baseTerrain, features);
  }

  if (baseTerrain && typeof getCodexGeneratedTerrainName === "function") {
    return getCodexGeneratedTerrainName(baseTerrain, features);
  }

  return data?.Terrain || "Unknown";
}

window.openPanelForHex = openPanelForHex;
window.closeMobileHexPopup = closeMobileHexPopup;
