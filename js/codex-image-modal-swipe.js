/* =========================================================
   CODEX IMAGE MODAL SWIPE NAVIGATION
   =========================================================

   Adds mobile horizontal swipe navigation for grouped image popouts.
   Native touch events are used as the primary mobile path because the image
   itself uses pointer capture for pinch/pan.
*/

const codexImageModalSwipeState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startedAt: 0,
  cancelled: false,
  source: ""
};

function resetCodexImageModalSwipeState() {
  codexImageModalSwipeState.pointerId = null;
  codexImageModalSwipeState.startX = 0;
  codexImageModalSwipeState.startY = 0;
  codexImageModalSwipeState.lastX = 0;
  codexImageModalSwipeState.lastY = 0;
  codexImageModalSwipeState.startedAt = 0;
  codexImageModalSwipeState.cancelled = false;
  codexImageModalSwipeState.source = "";
}

function canCodexImageModalSwipe() {
  return (
    typeof codexImageModalState !== "undefined" &&
    isCodexImageModalOpen?.() &&
    codexImageModalState.sources?.length > 1 &&
    codexImageModalState.scale <= 1.01 &&
    !codexImageModalState.isPinching &&
    !codexImageModalState.isPanning
  );
}

function maybeStepCodexImageModalFromSwipe() {
  if (!canCodexImageModalSwipe()) return;
  if (codexImageModalSwipeState.cancelled) return;

  const dx = codexImageModalSwipeState.lastX - codexImageModalSwipeState.startX;
  const dy = codexImageModalSwipeState.lastY - codexImageModalSwipeState.startY;
  const elapsed = Date.now() - codexImageModalSwipeState.startedAt;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < 44) return;
  if (absX < absY * 1.2) return;
  if (elapsed > 1000 && absX < 88) return;

  stepCodexImageModal(dx < 0 ? 1 : -1);
}

function startCodexImageModalSwipe(clientX, clientY, source = "") {
  if (!canCodexImageModalSwipe()) return false;

  resetCodexImageModalSwipeState();

  codexImageModalSwipeState.startX = clientX;
  codexImageModalSwipeState.startY = clientY;
  codexImageModalSwipeState.lastX = clientX;
  codexImageModalSwipeState.lastY = clientY;
  codexImageModalSwipeState.startedAt = Date.now();
  codexImageModalSwipeState.source = source;

  return true;
}

function updateCodexImageModalSwipe(clientX, clientY) {
  if (!codexImageModalSwipeState.startedAt) return;

  codexImageModalSwipeState.lastX = clientX;
  codexImageModalSwipeState.lastY = clientY;

  if (
    codexImageModalState.activePointers?.size > 1 ||
    codexImageModalState.scale > 1.01 ||
    codexImageModalState.isPinching ||
    codexImageModalState.isPanning
  ) {
    codexImageModalSwipeState.cancelled = true;
  }
}

function finishCodexImageModalSwipe(clientX, clientY) {
  if (!codexImageModalSwipeState.startedAt) return;

  codexImageModalSwipeState.lastX = clientX;
  codexImageModalSwipeState.lastY = clientY;

  window.setTimeout(() => {
    maybeStepCodexImageModalFromSwipe();
    resetCodexImageModalSwipeState();
  }, 0);
}

function bindCodexImageModalSwipeNavigation() {
  const modal = ensureCodexImageModal?.();
  const frame = modal?.querySelector?.(".codex-image-modal-frame");
  if (!frame || frame.dataset.codexSwipeBound === "true") return;

  frame.dataset.codexSwipeBound = "true";

  frame.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) {
      resetCodexImageModalSwipeState();
      return;
    }

    const touch = event.touches[0];
    startCodexImageModalSwipe(touch.clientX, touch.clientY, "touch");
  }, { passive: true, capture: true });

  frame.addEventListener("touchmove", event => {
    if (!codexImageModalSwipeState.startedAt) return;

    if (event.touches.length !== 1) {
      codexImageModalSwipeState.cancelled = true;
      return;
    }

    const touch = event.touches[0];
    updateCodexImageModalSwipe(touch.clientX, touch.clientY);
  }, { passive: true, capture: true });

  frame.addEventListener("touchend", event => {
    if (!codexImageModalSwipeState.startedAt) return;
    if (codexImageModalSwipeState.source !== "touch") return;

    const touch = event.changedTouches?.[0];
    if (!touch) {
      resetCodexImageModalSwipeState();
      return;
    }

    finishCodexImageModalSwipe(touch.clientX, touch.clientY);
  }, { passive: true, capture: true });

  frame.addEventListener("touchcancel", resetCodexImageModalSwipeState, { passive: true, capture: true });

  frame.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") return;
    if (!startCodexImageModalSwipe(event.clientX, event.clientY, "pointer")) return;
    codexImageModalSwipeState.pointerId = event.pointerId;
  }, true);

  frame.addEventListener("pointermove", event => {
    if (codexImageModalSwipeState.source !== "pointer") return;
    if (codexImageModalSwipeState.pointerId !== event.pointerId) return;
    updateCodexImageModalSwipe(event.clientX, event.clientY);
  }, true);

  frame.addEventListener("pointerup", event => {
    if (codexImageModalSwipeState.source !== "pointer") return;
    if (codexImageModalSwipeState.pointerId !== event.pointerId) return;
    finishCodexImageModalSwipe(event.clientX, event.clientY);
  }, true);

  ["pointercancel", "lostpointercapture"].forEach(eventName => {
    frame.addEventListener(eventName, event => {
      if (codexImageModalSwipeState.source !== "pointer") return;
      if (codexImageModalSwipeState.pointerId !== event.pointerId) return;
      resetCodexImageModalSwipeState();
    }, true);
  });
}

function initializeCodexImageModalSwipeNavigation() {
  bindCodexImageModalSwipeNavigation();
  window.setTimeout(bindCodexImageModalSwipeNavigation, 0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCodexImageModalSwipeNavigation);
} else {
  initializeCodexImageModalSwipeNavigation();
}

window.bindCodexImageModalSwipeNavigation = bindCodexImageModalSwipeNavigation;
