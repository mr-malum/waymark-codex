/* =========================================================
   DETAIL SECTION STATE
   =========================================================

   Keeps the active section for each detail record stable across short linked
   navigation excursions, so returning from a linked record restores the section
   the user left. The cache is intentionally cleared when the user returns to
   the Codex home page or closes the Codex.
*/

const codexDetailSectionStateCache = {};

function getCodexDetailSectionStateKey() {
  const current = getCurrentCodexPage?.();
  if (!current || !current.type || !current.id) return "";

  if (!["hex", "region", "poi", "poi-group", "npc"].includes(current.type)) {
    return "";
  }

  return `${current.type}:${current.id}`;
}

function clearCodexDetailSectionStateCache() {
  Object.keys(codexDetailSectionStateCache).forEach(key => {
    delete codexDetailSectionStateCache[key];
  });
}

function getCachedCodexDetailSection(sectionIds = []) {
  const key = getCodexDetailSectionStateKey();
  if (!key) return "";

  const cached = codexDetailSectionStateCache[key] || "";
  return sectionIds.includes(cached) ? cached : "";
}

function cacheCodexDetailSection(sectionId) {
  const key = getCodexDetailSectionStateKey();
  if (!key || !sectionId) return;

  codexDetailSectionStateCache[key] = sectionId;
}

function patchCodexDetailSectionState() {
  if (typeof setCodexDetailSection !== "function") return;
  if (setCodexDetailSection.__sectionStatePatched) return;

  const originalSetCodexDetailSection = setCodexDetailSection;

  setCodexDetailSection = function (sectionId, options = {}) {
    originalSetCodexDetailSection(sectionId);

    if (options.cache !== false) {
      cacheCodexDetailSection(sectionId);
    }
  };

  setCodexDetailSection.__sectionStatePatched = true;
  window.setCodexDetailSection = setCodexDetailSection;
}

function patchCodexDetailRailPageState() {
  if (typeof renderCodexDetailRailPage !== "function") return;
  if (renderCodexDetailRailPage.__sectionStatePatched) return;

  const originalRenderCodexDetailRailPage = renderCodexDetailRailPage;

  renderCodexDetailRailPage = function (overviewHtml, items, sectionsHtml) {
    const sectionIds = Array.isArray(items) ? items.map(item => item.id).filter(Boolean) : [];
    const activeSectionId = getCachedCodexDetailSection(sectionIds);
    const html = originalRenderCodexDetailRailPage(overviewHtml, items, sectionsHtml);

    if (activeSectionId) {
      requestAnimationFrame(() => setCodexDetailSection(activeSectionId, { cache: false }));
    } else if (sectionIds[0]) {
      requestAnimationFrame(() => cacheCodexDetailSection(sectionIds[0]));
    }

    return html;
  };

  renderCodexDetailRailPage.__sectionStatePatched = true;
  window.renderCodexDetailRailPage = renderCodexDetailRailPage;
}

function patchCodexDetailSectionCacheLifespan() {
  if (typeof renderCodexIndex === "function" && !renderCodexIndex.__sectionCacheClearPatched) {
    const originalRenderCodexIndex = renderCodexIndex;

    renderCodexIndex = function (...args) {
      clearCodexDetailSectionStateCache();
      return originalRenderCodexIndex.apply(this, args);
    };

    renderCodexIndex.__sectionCacheClearPatched = true;
    window.renderCodexIndex = renderCodexIndex;
  }

  if (typeof closeCodex === "function" && !closeCodex.__sectionCacheClearPatched) {
    const originalCloseCodex = closeCodex;

    closeCodex = function (...args) {
      clearCodexDetailSectionStateCache();
      return originalCloseCodex.apply(this, args);
    };

    closeCodex.__sectionCacheClearPatched = true;
    window.closeCodex = closeCodex;
  }
}

function initializeCodexDetailSectionState() {
  patchCodexDetailSectionState();
  patchCodexDetailRailPageState();
  patchCodexDetailSectionCacheLifespan();
}

initializeCodexDetailSectionState();

window.cacheCodexDetailSection = cacheCodexDetailSection;
window.clearCodexDetailSectionStateCache = clearCodexDetailSectionStateCache;
