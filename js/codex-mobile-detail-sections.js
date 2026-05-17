/* =========================================================
   MOBILE DETAIL SECTION UTILITY
   =========================================================

   Adds a mobile Sections utility button for detail pages without changing
   the desktop section rail behavior.
*/

let codexMobileDetailSectionItems = [];

function getCodexActiveDetailSectionId() {
  return document.querySelector(".codex-detail-rail-section.active")?.id ||
    codexMobileDetailSectionItems[0]?.id ||
    "";
}

function renderCodexMobileDetailSectionsPanel() {
  const activeId = getCodexActiveDetailSectionId();

  return `
    <nav class="codex-row-list codex-mobile-detail-section-picker" aria-label="Detail sections">
      ${codexMobileDetailSectionItems.map(item => `
        <button
          class="codex-row codex-mobile-detail-section-row ${item.id === activeId ? "active codex-row-active" : ""}"
          type="button"
          data-codex-mobile-detail-section="${escapeHtml(item.id)}"
        >
          ${item.icon ? `<span class="codex-row-icon${getCodexRailIconClass(item.icon)}" aria-hidden="true">${escapeHtml(item.icon)}</span>` : ""}
          <span class="codex-row-main">
            <span class="codex-row-title">${escapeHtml(item.label)}</span>
          </span>
          ${
            item.count !== undefined && item.count !== null
              ? `<span class="codex-row-count">${escapeHtml(String(item.count))}</span>`
              : `<span class="codex-row-arrow" aria-hidden="true">›</span>`
          }
        </button>
      `).join("")}
    </nav>
  `;
}

function bindCodexMobileDetailSectionsPanel(panel) {
  panel.querySelectorAll("[data-codex-mobile-detail-section]").forEach(button => {
    button.addEventListener("click", function () {
      setCodexDetailSection(button.dataset.codexMobileDetailSection);
      closeCodexMobileUtilityPanel?.();
    });
  });
}

function registerCodexMobileDetailSectionsUtility() {
  if (typeof setCodexMobileUtility !== "function") return;
  if (!codexMobileDetailSectionItems.length) return;

  setCodexMobileUtility({
    type: "detail-sections",
    label: "Sections",
    panelTitle: "Sections",
    renderPanel: renderCodexMobileDetailSectionsPanel,
    bindPanel: bindCodexMobileDetailSectionsPanel
  });
}

function patchCodexMobileDetailRailCapture() {
  if (typeof renderCodexDetailRailPage !== "function") return;
  if (renderCodexDetailRailPage.__mobileDetailCapturePatched) return;

  const originalRenderCodexDetailRailPage = renderCodexDetailRailPage;

  renderCodexDetailRailPage = function (overviewHtml, items, sectionsHtml) {
    codexMobileDetailSectionItems = Array.isArray(items) ? items : [];
    return originalRenderCodexDetailRailPage(overviewHtml, items, sectionsHtml);
  };

  renderCodexDetailRailPage.__mobileDetailCapturePatched = true;
  window.renderCodexDetailRailPage = renderCodexDetailRailPage;
}

function patchCodexMobileDetailRenderers() {
  [
    "renderCodexHexPage",
    "renderCodexRegionPage",
    "renderCodexPoiPage",
    "renderCodexPoiGroupPage",
    "renderCodexNpcPage"
  ].forEach(function (fnName) {
    const originalFn = window[fnName];
    if (typeof originalFn !== "function") return;
    if (originalFn.__mobileDetailSectionsPatched) return;

    window[fnName] = function (...args) {
      codexMobileDetailSectionItems = [];
      const result = originalFn.apply(this, args);
      registerCodexMobileDetailSectionsUtility();
      return result;
    };

    window[fnName].__mobileDetailSectionsPatched = true;
  });
}

function initializeCodexMobileDetailSections() {
  patchCodexMobileDetailRailCapture();
  patchCodexMobileDetailRenderers();
}

initializeCodexMobileDetailSections();

window.registerCodexMobileDetailSectionsUtility = registerCodexMobileDetailSectionsUtility;
