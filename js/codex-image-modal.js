/* =========================================================
   CODEX IMAGE POPOUT MODAL
   ========================================================= */

let codexImageModalLastFocus = null;

const codexImageModalState = {
  sources: [],
  index: 0,
  scale: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOriginX: 0,
  panOriginY: 0,
  activePointers: new Map(),
  isPinching: false,
  pinchStartDistance: 0,
  pinchStartScale: 1,
  pinchStartPanX: 0,
  pinchStartPanY: 0,
  pinchCenterX: 0,
  pinchCenterY: 0,
  lastTapTime: 0
};

function ensureCodexImageModal() {
  let modal = document.getElementById("codex-image-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "codex-image-modal";
  modal.className = "codex-image-modal";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="codex-image-modal-backdrop" data-codex-image-modal-close="true"></div>
    <div class="codex-image-modal-panel" role="dialog" aria-modal="true" aria-label="Expanded image">
      <button
        class="codex-image-modal-close"
        type="button"
        aria-label="Close image"
        data-codex-image-modal-close="true"
      >✕</button>
      <button
        class="codex-image-modal-nav codex-image-modal-prev"
        type="button"
        aria-label="Previous image"
        data-codex-image-modal-direction="prev"
      >‹</button>
      <div class="codex-image-modal-frame">
        <img class="codex-image-modal-img" alt="">
      </div>
      <div class="codex-image-modal-counter" aria-live="polite"></div>
      <button
        class="codex-image-modal-nav codex-image-modal-next"
        type="button"
        aria-label="Next image"
        data-codex-image-modal-direction="next"
      >›</button>
    </div>
  `;

  modal.addEventListener("click", event => {
    if (event.target?.dataset?.codexImageModalClose === "true") {
      closeCodexImageModal();
      return;
    }

    const direction = event.target?.dataset?.codexImageModalDirection;
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      stepCodexImageModal(direction === "next" ? 1 : -1);
    }
  });

  modal.addEventListener("wheel", event => {
    if (!modal.classList.contains("open")) return;

    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    setCodexImageModalScale(codexImageModalState.scale + delta, event);
  }, { passive: false });

  bindCodexImageModalPanEvents(modal);

  document.body.appendChild(modal);
  return modal;
}

function isCodexImageModalOpen() {
  return document
    .getElementById("codex-image-modal")
    ?.classList.contains("open") || false;
}

function getCodexImageModalImage() {
  return document.querySelector("#codex-image-modal .codex-image-modal-img");
}

function clampCodexImageModalScale(value) {
  return Math.min(4, Math.max(1, Number(value) || 1));
}

function getCodexImageModalPanBounds() {
  const image = getCodexImageModalImage();
  const frame = image?.closest(".codex-image-modal-frame");
  if (!image || !frame || codexImageModalState.scale <= 1) {
    return { maxX: 0, maxY: 0 };
  }

  const imageRect = image.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const unscaledWidth = imageRect.width / codexImageModalState.scale;
  const unscaledHeight = imageRect.height / codexImageModalState.scale;
  const scaledWidth = unscaledWidth * codexImageModalState.scale;
  const scaledHeight = unscaledHeight * codexImageModalState.scale;

  return {
    maxX: Math.max(0, (scaledWidth - frameRect.width) / 2),
    maxY: Math.max(0, (scaledHeight - frameRect.height) / 2)
  };
}

function clampCodexImageModalPan() {
  const bounds = getCodexImageModalPanBounds();

  codexImageModalState.panX = Math.min(bounds.maxX, Math.max(-bounds.maxX, codexImageModalState.panX));
  codexImageModalState.panY = Math.min(bounds.maxY, Math.max(-bounds.maxY, codexImageModalState.panY));

  if (codexImageModalState.scale <= 1.01) {
    codexImageModalState.panX = 0;
    codexImageModalState.panY = 0;
  }
}

function applyCodexImageModalTransform() {
  const image = getCodexImageModalImage();
  if (!image) return;

  clampCodexImageModalPan();

  image.style.transform = `translate(${codexImageModalState.panX}px, ${codexImageModalState.panY}px) scale(${codexImageModalState.scale})`;
  image.classList.toggle("zoomed", codexImageModalState.scale > 1.01);
  image.classList.toggle("panning", codexImageModalState.isPanning || codexImageModalState.isPinching);
}

function getCodexImageModalFramePoint(clientX, clientY) {
  const image = getCodexImageModalImage();
  const frame = image?.closest(".codex-image-modal-frame");
  if (!frame) return { x: 0, y: 0 };

  const frameRect = frame.getBoundingClientRect();
  return {
    x: clientX - frameRect.left - frameRect.width / 2,
    y: clientY - frameRect.top - frameRect.height / 2
  };
}

function setCodexImageModalScale(value, anchorEvent = null) {
  const oldScale = codexImageModalState.scale;
  const newScale = clampCodexImageModalScale(value);

  if (anchorEvent && oldScale > 0 && newScale !== oldScale) {
    const point = getCodexImageModalFramePoint(anchorEvent.clientX, anchorEvent.clientY);
    const zoomRatio = newScale / oldScale;

    codexImageModalState.panX = point.x - (point.x - codexImageModalState.panX) * zoomRatio;
    codexImageModalState.panY = point.y - (point.y - codexImageModalState.panY) * zoomRatio;
  }

  codexImageModalState.scale = newScale;

  if (codexImageModalState.scale <= 1.01) {
    codexImageModalState.panX = 0;
    codexImageModalState.panY = 0;
  }

  applyCodexImageModalTransform();
}

function resetCodexImageModalScale() {
  codexImageModalState.scale = 1;
  codexImageModalState.panX = 0;
  codexImageModalState.panY = 0;
  codexImageModalState.isPanning = false;
  codexImageModalState.isPinching = false;
  codexImageModalState.activePointers.clear();
  applyCodexImageModalTransform();
}

function getCodexImageModalSrcFromSource(source) {
  return String(source?.src || source || "").trim();
}

function setCodexImageModalImage(index) {
  const modal = ensureCodexImageModal();
  const image = modal.querySelector(".codex-image-modal-img");
  const sources = codexImageModalState.sources;

  if (!image || !sources.length) return;

  codexImageModalState.index = ((index % sources.length) + sources.length) % sources.length;
  image.src = getCodexImageModalSrcFromSource(sources[codexImageModalState.index]);
  resetCodexImageModalScale();
  updateCodexImageModalNav();
}

function updateCodexImageModalNav() {
  const modal = ensureCodexImageModal();
  const hasMultiple = codexImageModalState.sources.length > 1;

  modal.querySelectorAll(".codex-image-modal-nav").forEach(button => {
    button.hidden = !hasMultiple;
    button.disabled = !hasMultiple;
  });

  const counter = modal.querySelector(".codex-image-modal-counter");
  if (counter) {
    counter.hidden = !hasMultiple;
    counter.textContent = hasMultiple
      ? `${codexImageModalState.index + 1} / ${codexImageModalState.sources.length}`
      : "";
  }
}

function stepCodexImageModal(delta) {
  if (codexImageModalState.sources.length <= 1) return;
  setCodexImageModalImage(codexImageModalState.index + delta);
}

function normalizeCodexImageModalSources(sources, fallbackSrc) {
  const seen = new Set();
  const normalized = [];

  [...(sources || []), fallbackSrc]
    .map(getCodexImageModalSrcFromSource)
    .filter(Boolean)
    .forEach(src => {
      if (seen.has(src)) return;
      seen.add(src);
      normalized.push({ src });
    });

  return normalized;
}

function getCodexImageSourceFromTrigger(trigger) {
  if (!trigger || trigger.classList.contains("codex-image-missing")) return "";
  return trigger.dataset.codexImageHref || trigger.dataset.codexImageSource || "";
}

function getCodexImageModalSourcesForTrigger(trigger) {
  const src = getCodexImageSourceFromTrigger(trigger);
  if (!src) return { sources: [], index: 0 };

  const mapGrid = trigger.closest?.(".codex-map-tile-grid");
  if (!mapGrid) {
    return { sources: [{ src }], index: 0 };
  }

  const triggers = Array.from(mapGrid.querySelectorAll("[data-codex-image-source]"))
    .filter(node => !node.classList.contains("codex-image-missing"));

  const sources = normalizeCodexImageModalSources(
    triggers.map(node => getCodexImageSourceFromTrigger(node)),
    src
  );

  const index = Math.max(0, sources.findIndex(source => source.src === src));

  return {
    sources: sources.length ? sources : [{ src }],
    index
  };
}

function openCodexImageModal(srcOrOptions) {
  const options = typeof srcOrOptions === "object" && srcOrOptions !== null
    ? srcOrOptions
    : { sources: [{ src: srcOrOptions }], index: 0 };

  const sources = normalizeCodexImageModalSources(options.sources, options.src);
  if (!sources.length) return;

  const modal = ensureCodexImageModal();
  const closeButton = modal.querySelector(".codex-image-modal-close");

  codexImageModalLastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  codexImageModalState.sources = sources;
  codexImageModalState.index = Number.isInteger(options.index) ? options.index : 0;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("codex-image-modal-open");

  setCodexImageModalImage(codexImageModalState.index);

  window.setTimeout(() => closeButton?.focus(), 0);
}

function closeCodexImageModal() {
  const modal = document.getElementById("codex-image-modal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("codex-image-modal-open");

  const image = modal.querySelector(".codex-image-modal-img");
  if (image) {
    image.removeAttribute("src");
    image.style.transform = "";
    image.classList.remove("zoomed", "panning");
  }

  codexImageModalState.sources = [];
  codexImageModalState.index = 0;
  codexImageModalState.scale = 1;
  codexImageModalState.panX = 0;
  codexImageModalState.panY = 0;
  codexImageModalState.isPanning = false;
  codexImageModalState.isPinching = false;
  codexImageModalState.activePointers.clear();
  updateCodexImageModalNav();

  if (codexImageModalLastFocus?.focus) {
    codexImageModalLastFocus.focus();
  }

  codexImageModalLastFocus = null;
}

function getCodexImageModalTriggerFromTarget(target) {
  const trigger = target?.closest?.("[data-codex-image-source]");
  if (!trigger || trigger.classList.contains("codex-image-missing")) return null;
  return trigger;
}

function getCodexPointerDistance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getCodexPointerCenter(a, b) {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2
  };
}

function getCodexImageModalPointerList() {
  return [...codexImageModalState.activePointers.values()];
}

function startCodexImageModalPinch() {
  const pointers = getCodexImageModalPointerList();
  if (pointers.length < 2) return;

  const [a, b] = pointers;
  const center = getCodexPointerCenter(a, b);
  const point = getCodexImageModalFramePoint(center.clientX, center.clientY);

  codexImageModalState.isPinching = true;
  codexImageModalState.isPanning = false;
  codexImageModalState.pinchStartDistance = Math.max(1, getCodexPointerDistance(a, b));
  codexImageModalState.pinchStartScale = codexImageModalState.scale;
  codexImageModalState.pinchStartPanX = codexImageModalState.panX;
  codexImageModalState.pinchStartPanY = codexImageModalState.panY;
  codexImageModalState.pinchCenterX = point.x;
  codexImageModalState.pinchCenterY = point.y;

  applyCodexImageModalTransform();
}

function updateCodexImageModalPinch() {
  const pointers = getCodexImageModalPointerList();
  if (!codexImageModalState.isPinching || pointers.length < 2) return;

  const [a, b] = pointers;
  const currentDistance = Math.max(1, getCodexPointerDistance(a, b));
  const nextScale = clampCodexImageModalScale(
    codexImageModalState.pinchStartScale * (currentDistance / codexImageModalState.pinchStartDistance)
  );

  const center = getCodexPointerCenter(a, b);
  const currentPoint = getCodexImageModalFramePoint(center.clientX, center.clientY);
  const zoomRatio = nextScale / codexImageModalState.pinchStartScale;

  codexImageModalState.scale = nextScale;
  codexImageModalState.panX = currentPoint.x - (codexImageModalState.pinchCenterX - codexImageModalState.pinchStartPanX) * zoomRatio;
  codexImageModalState.panY = currentPoint.y - (codexImageModalState.pinchCenterY - codexImageModalState.pinchStartPanY) * zoomRatio;

  if (codexImageModalState.scale <= 1.01) {
    codexImageModalState.panX = 0;
    codexImageModalState.panY = 0;
  }

  applyCodexImageModalTransform();
}

function handleCodexImageModalDoubleTap(event) {
  const now = Date.now();
  const elapsed = now - codexImageModalState.lastTapTime;
  codexImageModalState.lastTapTime = now;

  if (elapsed > 280) return false;

  event.preventDefault();
  event.stopPropagation();

  if (codexImageModalState.scale > 1.01) {
    resetCodexImageModalScale();
  } else {
    setCodexImageModalScale(2.2, event);
  }

  return true;
}

function bindCodexImageModalPanEvents(modal) {
  const image = modal.querySelector(".codex-image-modal-img");
  if (!image || image.dataset.codexPanBound === "true") return;

  image.dataset.codexPanBound = "true";

  image.addEventListener("pointerdown", event => {
    if (!isCodexImageModalOpen()) return;

    event.preventDefault();
    event.stopPropagation();
    image.setPointerCapture?.(event.pointerId);

    codexImageModalState.activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (codexImageModalState.activePointers.size >= 2) {
      startCodexImageModalPinch();
      return;
    }

    if (event.pointerType === "touch" && handleCodexImageModalDoubleTap(event)) {
      return;
    }

    if (codexImageModalState.scale <= 1.01) return;

    codexImageModalState.isPanning = true;
    codexImageModalState.panStartX = event.clientX;
    codexImageModalState.panStartY = event.clientY;
    codexImageModalState.panOriginX = codexImageModalState.panX;
    codexImageModalState.panOriginY = codexImageModalState.panY;

    applyCodexImageModalTransform();
  });

  image.addEventListener("pointermove", event => {
    if (!isCodexImageModalOpen()) return;
    if (!codexImageModalState.activePointers.has(event.pointerId)) return;

    event.preventDefault();
    event.stopPropagation();

    codexImageModalState.activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (codexImageModalState.isPinching) {
      updateCodexImageModalPinch();
      return;
    }

    if (!codexImageModalState.isPanning) return;

    codexImageModalState.panX = codexImageModalState.panOriginX + event.clientX - codexImageModalState.panStartX;
    codexImageModalState.panY = codexImageModalState.panOriginY + event.clientY - codexImageModalState.panStartY;
    applyCodexImageModalTransform();
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
    image.addEventListener(eventName, event => {
      codexImageModalState.activePointers.delete(event.pointerId);

      if (codexImageModalState.activePointers.size < 2) {
        codexImageModalState.isPinching = false;
      }

      if (codexImageModalState.activePointers.size === 0) {
        codexImageModalState.isPanning = false;
        applyCodexImageModalTransform();
        return;
      }

      if (codexImageModalState.scale > 1.01) {
        const pointer = getCodexImageModalPointerList()[0];
        codexImageModalState.isPanning = true;
        codexImageModalState.panStartX = pointer.clientX;
        codexImageModalState.panStartY = pointer.clientY;
        codexImageModalState.panOriginX = codexImageModalState.panX;
        codexImageModalState.panOriginY = codexImageModalState.panY;
      }

      applyCodexImageModalTransform();
    });
  });
}

function bindCodexImageModalEvents() {
  document.addEventListener("click", event => {
    const trigger = getCodexImageModalTriggerFromTarget(event.target);
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    openCodexImageModal(getCodexImageModalSourcesForTrigger(trigger));
  }, true);

  document.addEventListener("keydown", event => {
    const modal = document.getElementById("codex-image-modal");
    const isOpen = modal?.classList.contains("open");

    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        closeCodexImageModal();
      }
      return;
    }

    if (isOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      stepCodexImageModal(event.key === "ArrowRight" ? 1 : -1);
      return;
    }

    if (isOpen && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      setCodexImageModalScale(codexImageModalState.scale + 0.15);
      return;
    }

    if (isOpen && event.key === "-") {
      event.preventDefault();
      setCodexImageModalScale(codexImageModalState.scale - 0.15);
      return;
    }

    if (isOpen && event.key === "0") {
      event.preventDefault();
      resetCodexImageModalScale();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") return;

    const trigger = getCodexImageModalTriggerFromTarget(event.target);
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    openCodexImageModal(getCodexImageModalSourcesForTrigger(trigger));
  }, true);
}

document.addEventListener("DOMContentLoaded", () => {
  ensureCodexImageModal();
  bindCodexImageModalEvents();
});

window.addEventListener("resize", () => {
  applyCodexImageModalTransform();
});

window.openCodexImageModal = openCodexImageModal;
window.closeCodexImageModal = closeCodexImageModal;
window.isCodexImageModalOpen = isCodexImageModalOpen;
window.stepCodexImageModal = stepCodexImageModal;
window.setCodexImageModalScale = setCodexImageModalScale;
