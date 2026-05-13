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

function closePanel(options = {}) {
  document.getElementById("app-panel").classList.remove("open");

  if (options.centerSelected && selectedHexId) {
    centerHexInView(selectedHexId);
  }

  if (options.clearSelection) {
    clearSelectedHex();
    map.closePopup();
  }
}

function openPanel() {
  const panel = document.getElementById("app-panel");

  requestAnimationFrame(() => {
    panel.classList.add("open");
  });
}

function renderHexPreview(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const counts = getHexCounts(hexId);

  openPanel();

  document.getElementById("panel-title").textContent = `HEX ${hexId}`;
  document.getElementById("panel-subtitle").textContent = "Field Notes";

  const countLine = buildCountLine(counts.poiCount, counts.npcCount);
  const journalPreview = getLimitedLines(hex?.DM_Journal, 4);

  document.getElementById("panel-content").innerHTML = `
    <p><strong>Terrain:</strong> ${escapeHtml(hex?.Terrain || "Unknown")}</p>
    <p><strong>Region:</strong> ${escapeHtml(region?.Region_Name || hex?.Region_ID_Ref || "Unknown")}</p>

    ${countLine ? `<p><strong>Known Records:</strong> ${escapeHtml(countLine)}</p>` : ""}

    <h3>Field Notes</h3>
    <p class="panel-journal-preview">
      ${renderMultilineText(journalPreview)}
    </p>

    <button class="codex-section-button" type="button" onclick="openCodexPage('hex', '${escapeJsString(hexId)}')">
      Open Details
    </button>
  `;
}

function openPanelForHex(hexId) {
  renderHexPreview(hexId);
}

function panHexIntoInspectorView(hexId) {
  const [xxx, yyy] = hexId.split(":").map(Number);
  const center = getHexCenter(xxx, yyy);
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
  map.closePopup();
  clearSelectedHex();
  selectedHexId = null;
  map.fitBounds(bounds, { animate: true, duration: 0.5 });
}

function centerHexInView(hexId) {
  const [xxx, yyy] = hexId.split(":").map(Number);
  const center = getHexCenter(xxx, yyy);

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