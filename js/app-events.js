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
      selectedHexId = hexId;

      if (isTouchDevice) {
        this.bindPopup(buildMobilePopupHtml(hexId)).openPopup();
      } else {
        renderHexPreview(hexId);
      
        const panelWidth =
          document.getElementById("app-panel").offsetWidth;
      
        if (panelWidth / window.innerWidth > 0.32) {
          panHexIntoInspectorView(hexId);
        }
      }
    });
  }
}

map.on("click", function () {
  closePanel();

  document.getElementById("codex-button").classList.remove("codex-label-visible");

  clearSelectedHex();
});

document.getElementById("mobile-panel-close").addEventListener("click", function () {
  closePanel({
    clearSelection: true,
    centerSelected: true
  });
});

map.on("popupclose", function () {
  clearSelectedHex();
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
  resetMapToAtlasView();
  resetCodexToIndex();
});

document.getElementById("map-reset-button").addEventListener("click", function (event) {
  event.stopPropagation();

  closePanel({ clearSelection: true });
  closeCodex();
  resetMapToAtlasView();
});

document.getElementById("codex-close").addEventListener("click", function () {
  closeCodex();
});

document.getElementById("codex-back").addEventListener("click", function () {
  if (codexHistory.length <= 1) {
    closeCodex();
    return;
  }

  goBackCodex();
});

document.getElementById("codex-overlay").addEventListener("click", function (event) {
  if (event.target === this) {
    closeCodex();
  }
});

let retroCodexSequence = "";

window.addEventListener("keydown", event => {
  retroCodexSequence += event.key.toLowerCase();

  if (retroCodexSequence.length > 2) {
    retroCodexSequence = retroCodexSequence.slice(-2);
  }

  if (retroCodexSequence === "95") {
    toggleRetroCodexMode();
    retroCodexSequence = "";
  }
});

let codexLongPressTimer = null;
let suppressNextCodexClick = false;

function isMobileCodexLongPressEnabled() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

const codexLongPressButton = document.getElementById("codex-button");

codexLongPressButton.addEventListener("pointerdown", event => {
  if (!isMobileCodexLongPressEnabled()) return;

  codexLongPressTimer = window.setTimeout(() => {
    suppressNextCodexClick = true;
    toggleRetroCodexMode();
  }, 650);
});

codexLongPressButton.addEventListener("pointerup", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("pointercancel", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("pointerleave", () => {
  window.clearTimeout(codexLongPressTimer);
  codexLongPressTimer = null;
});

codexLongPressButton.addEventListener("contextmenu", event => {
  if (!isMobileCodexLongPressEnabled()) return;

  event.preventDefault();
});