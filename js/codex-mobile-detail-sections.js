/* =========================================================
   MOBILE DETAIL SECTION UTILITY
   =========================================================

   Adds a mobile Sections utility button for detail pages without changing
   the desktop section rail behavior.
*/

let codexMobileDetailSectionItems = [];
const codexMobileDetailSwipeState = {
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startedAt: 0,
  cancelled: false
};

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

function getCodexMobileDetailSectionIndex(sectionId = getCodexActiveDetailSectionId()) {
  return codexMobileDetailSectionItems.findIndex(item => item.id === sectionId);
}

function stepCodexMobileDetailSection(delta) {
  if (!codexMobileDetailSectionItems.length) return;

  const root = document.querySelector(".codex-detail-main");
  const activeSection = document.querySelector(".codex-detail-rail-section.active");
  const currentIndex = Math.max(0, getCodexMobileDetailSectionIndex());
  const nextIndex = (
    currentIndex +
    delta +
    codexMobileDetailSectionItems.length
  ) % codexMobileDetailSectionItems.length;

  const nextSectionId = codexMobileDetailSectionItems[nextIndex].id;
  const directionClass = delta > 0
    ? "codex-mobile-detail-swipe-next"
    : "codex-mobile-detail-swipe-prev";

  if (!root || !activeSection) {
    setCodexDetailSection(nextSectionId);
    return;
  }

  root.classList.remove(
    "codex-mobile-detail-swipe-next",
    "codex-mobile-detail-swipe-prev"
  );
  root.classList.add(directionClass, "codex-mobile-detail-swipe-animating");

  setCodexDetailSection(nextSectionId);

  window.setTimeout(() => {
    root.classList.remove(
      "codex-mobile-detail-swipe-animating",
      "codex-mobile-detail-swipe-next",
      "codex-mobile-detail-swipe-prev"
    );
  }, 240);
}

function resetCodexMobileDetailSwipeState() {
  codexMobileDetailSwipeState.startX = 0;
  codexMobileDetailSwipeState.startY = 0;
  codexMobileDetailSwipeState.lastX = 0;
  codexMobileDetailSwipeState.lastY = 0;
  codexMobileDetailSwipeState.startedAt = 0;
  codexMobileDetailSwipeState.cancelled = false;
}

function canStartCodexMobileDetailSwipe(target) {
  return Boolean(
    window.matchMedia("(max-width: 1099px), (max-height: 699px)").matches &&
    codexMobileDetailSectionItems.length > 1 &&
    target?.closest?.(".codex-detail-rail-section-content") &&
    !target?.closest?.("input, select, textarea, [data-codex-image-source], .codex-map-card")
  );
}

function maybeStepCodexMobileDetailSectionFromSwipe() {
  if (codexMobileDetailSwipeState.cancelled) return;

  const dx = codexMobileDetailSwipeState.lastX - codexMobileDetailSwipeState.startX;
  const dy = codexMobileDetailSwipeState.lastY - codexMobileDetailSwipeState.startY;
  const elapsed = Date.now() - codexMobileDetailSwipeState.startedAt;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < 44) return;
  if (absX < absY * 1.2) return;
  if (elapsed > 1000 && absX < 88) return;

  stepCodexMobileDetailSection(dx < 0 ? 1 : -1);
}

function bindCodexMobileDetailSectionSwipeNavigation() {
  if (bindCodexMobileDetailSectionSwipeNavigation.__bound) return;
  bindCodexMobileDetailSectionSwipeNavigation.__bound = true;

  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) {
      resetCodexMobileDetailSwipeState();
      return;
    }

    if (!canStartCodexMobileDetailSwipe(event.target)) return;

    const touch = event.touches[0];
    codexMobileDetailSwipeState.startX = touch.clientX;
    codexMobileDetailSwipeState.startY = touch.clientY;
    codexMobileDetailSwipeState.lastX = touch.clientX;
    codexMobileDetailSwipeState.lastY = touch.clientY;
    codexMobileDetailSwipeState.startedAt = Date.now();
    codexMobileDetailSwipeState.cancelled = false;
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", event => {
    if (!codexMobileDetailSwipeState.startedAt) return;
    if (event.touches.length !== 1) {
      codexMobileDetailSwipeState.cancelled = true;
      return;
    }

    const touch = event.touches[0];
    codexMobileDetailSwipeState.lastX = touch.clientX;
    codexMobileDetailSwipeState.lastY = touch.clientY;
  }, { passive: true, capture: true });

  document.addEventListener("touchend", event => {
    if (!codexMobileDetailSwipeState.startedAt) return;

    const touch = event.changedTouches?.[0];
    if (!touch) {
      resetCodexMobileDetailSwipeState();
      return;
    }

    codexMobileDetailSwipeState.lastX = touch.clientX;
    codexMobileDetailSwipeState.lastY = touch.clientY;

    window.setTimeout(() => {
      maybeStepCodexMobileDetailSectionFromSwipe();
      resetCodexMobileDetailSwipeState();
    }, 0);
  }, { passive: true, capture: true });

  document.addEventListener("touchcancel", resetCodexMobileDetailSwipeState, {
    passive: true,
    capture: true
  });
}

function ensureCodexMobileDetailSwipeIndicators() {
  if (!window.matchMedia("(max-width: 1099px), (max-height: 699px)").matches) {
    return;
  }

  const lowerPane = document.querySelector(".codex-detail-lower-pane");
  if (!lowerPane || codexMobileDetailSectionItems.length <= 1) return;

  let layer = lowerPane.querySelector(".codex-mobile-detail-swipe-indicators");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "codex-mobile-detail-swipe-indicators";
    layer.setAttribute("aria-hidden", "true");
    lowerPane.appendChild(layer);
  }

  let previous = layer.querySelector(".codex-mobile-detail-swipe-indicator-prev");
  let next = layer.querySelector(".codex-mobile-detail-swipe-indicator-next");

  if (!previous) {
    previous = document.createElement("span");
    previous.className = "codex-mobile-detail-swipe-indicator codex-mobile-detail-swipe-indicator-prev";
    previous.textContent = "❮";
    layer.appendChild(previous);
  }

  if (!next) {
    next = document.createElement("span");
    next.className = "codex-mobile-detail-swipe-indicator codex-mobile-detail-swipe-indicator-next";
    next.textContent = "❯";
    layer.appendChild(next);
  }
}

function updateCodexMobileDetailSwipeIndicators() {
  if (!window.matchMedia("(max-width: 1099px), (max-height: 699px)").matches) {
    document.querySelectorAll(".codex-mobile-detail-swipe-indicators").forEach(node => node.remove());
    return;
  }

  ensureCodexMobileDetailSwipeIndicators();
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

  renderCodexDetailRailPage = function (overviewHtml, items, sectionsHtml, auditOptions = {}) {
    codexMobileDetailSectionItems = Array.isArray(items) ? items : [];
    return originalRenderCodexDetailRailPage(overviewHtml, items, sectionsHtml, auditOptions);
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
      window.requestAnimationFrame(updateCodexMobileDetailSwipeIndicators);
      return result;
    };

    window[fnName].__mobileDetailSectionsPatched = true;
  });
}

function initializeCodexMobileDetailSections() {
  patchCodexMobileDetailRailCapture();
  patchCodexMobileDetailRenderers();
  bindCodexMobileDetailSectionSwipeNavigation();
}

initializeCodexMobileDetailSections();

window.registerCodexMobileDetailSectionsUtility = registerCodexMobileDetailSectionsUtility;
window.updateCodexMobileDetailSwipeIndicators = updateCodexMobileDetailSwipeIndicators;
