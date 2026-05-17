/* =========================================================
   MOBILE DETAIL CONTENT ADAPTATION
   =========================================================

   Mobile-only content restructuring layered on top of the existing desktop
   detail page renderers. Desktop overview panels remain in the DOM and keep
   their current desktop behavior.
*/

let codexPoiGroupAreasContext = null;

function renderCodexHeaderLink(type, id, label) {
  return `
    <button
      class="codex-header-link"
      type="button"
      onclick="openCodexPage('${escapeJsString(type)}', '${escapeJsString(id)}')"
    >${escapeHtml(label)}</button>
  `;
}

function setCodexHexStackedHeader(hexId) {
  const hex = db?.hexesById?.[hexId];
  const region = hex?.Region_ID_Ref ? db?.regionsById?.[hex.Region_ID_Ref] : null;
  const titleEl = document.getElementById("codex-title");
  if (!titleEl) return;

  const regionLabel = region?.Region_Name || hex?.Region_ID_Ref || "Unknown Region";
  const regionLine = region?.Region_ID
    ? renderCodexHeaderLink("region", region.Region_ID, regionLabel)
    : escapeHtml(regionLabel);

  titleEl.innerHTML = `
    <div class="codex-superheader">${regionLine}</div>
    <div class="codex-mainheader">Hex ${escapeHtml(hexId)}</div>
    <div class="codex-subheader">${escapeHtml(hex?.Terrain || "Unknown Terrain")}</div>
  `;

  requestAnimationFrame(() => fitCodexHeaderText?.());
}

function installCodexPoiGroupAreasSectionPatch() {
  if (typeof renderCodexDetailRailPage !== "function") return;
  if (renderCodexDetailRailPage.__mobileAreasSectionPatched) return;

  const originalRenderCodexDetailRailPage = renderCodexDetailRailPage;

  renderCodexDetailRailPage = function (overviewHtml, items, sectionsHtml) {
    if (codexPoiGroupAreasContext) {
      const pois = codexPoiGroupAreasContext.pois || [];
      const hasAreasItem = items.some(item => item.id === "codex-detail-areas");
      const hasAreasSection = sectionsHtml.includes('id="codex-detail-areas"');

      if (!hasAreasItem) {
        const areaItem = {
          id: "codex-detail-areas",
          label: "Areas",
          icon: getCodexIcon("poi"),
          count: pois.length
        };

        const journalIndex = items.findIndex(item => item.id === "codex-detail-journal");
        const insertIndex = journalIndex >= 0 ? journalIndex + 1 : items.length;
        items = [
          ...items.slice(0, insertIndex),
          areaItem,
          ...items.slice(insertIndex)
        ];
      }

      if (!hasAreasSection) {
        sectionsHtml += renderCodexDetailRailSection(
          "codex-detail-areas",
          "Areas",
          renderCodexLinkedList(
            pois,
            "No Areas currently recorded for this place.",
            "poi",
            "POI_ID",
            buildCodexMappedAreaListLabel
          )
        );
      }
    }

    return originalRenderCodexDetailRailPage(overviewHtml, items, sectionsHtml);
  };

  renderCodexDetailRailPage.__mobileAreasSectionPatched = true;
  window.renderCodexDetailRailPage = renderCodexDetailRailPage;
}

function assignCodexRendererGlobal(fnName, fn) {
  window[fnName] = fn;

  if (fnName === "renderCodexHexPage") renderCodexHexPage = fn;
  if (fnName === "renderCodexRegionPage") renderCodexRegionPage = fn;
  if (fnName === "renderCodexPoiPage") renderCodexPoiPage = fn;
  if (fnName === "renderCodexPoiGroupPage") renderCodexPoiGroupPage = fn;
  if (fnName === "renderCodexNpcPage") renderCodexNpcPage = fn;
}

function patchCodexMobileDetailContentRenderer(fnName, afterRender, beforeRender = null) {
  const originalFn = window[fnName];
  if (typeof originalFn !== "function") return;
  if (originalFn.__mobileDetailContentPatched) return;

  const patchedFn = function (...args) {
    const cleanup = typeof beforeRender === "function" ? beforeRender(...args) : null;

    try {
      const result = originalFn.apply(this, args);
      if (typeof afterRender === "function") afterRender(...args);
      return result;
    } finally {
      if (typeof cleanup === "function") cleanup();
    }
  };

  patchedFn.__mobileDetailContentPatched = true;
  assignCodexRendererGlobal(fnName, patchedFn);
}

function initializeCodexMobileDetailContent() {
  installCodexPoiGroupAreasSectionPatch();

  patchCodexMobileDetailContentRenderer("renderCodexHexPage", setCodexHexStackedHeader);
  patchCodexMobileDetailContentRenderer(
    "renderCodexPoiGroupPage",
    null,
    function (groupId) {
      codexPoiGroupAreasContext = {
        pois: getPoisForGroup(groupId)
      };

      return function () {
        codexPoiGroupAreasContext = null;
      };
    }
  );
}

initializeCodexMobileDetailContent();
