/* =========================================================
   CODEX HEADER FIT SCOPE
   =========================================================

   The header text fitter was introduced for mobile/narrow titles, but because
   it lives in shared routing code it also ran on desktop book views. That could
   leave inline font sizes on desktop headers, making simple titles like
   "Regions" render at odd sizes.

   This late-loaded override keeps the fitter mobile-only and clears any inline
   fit styles when the current environment should use normal desktop CSS.
*/

function shouldFitCodexHeaderTextForMobile() {
  return window.matchMedia?.(
    "(hover: none) and (pointer: coarse), (max-width: 700px)"
  )?.matches === true;
}

function resetCodexHeaderFitStyles() {
  const titleEl = getCodexTitle?.();
  if (!titleEl) return;

  const lines = [
    titleEl,
    ...titleEl.querySelectorAll?.(
      ".codex-superheader, .codex-mainheader, .codex-subheader"
    ) || []
  ];

  lines.forEach(line => {
    line.style.fontSize = "";
    line.style.whiteSpace = "";
    delete line.dataset.codexBaseFontSize;
  });
}

function fitCodexHeaderText() {
  const titleEl = getCodexTitle?.();
  const headerEl = document.getElementById("codex-header");
  if (!titleEl || !headerEl) return;

  if (!shouldFitCodexHeaderTextForMobile()) {
    resetCodexHeaderFitStyles();
    return;
  }

  const availableWidth = titleEl.clientWidth || headerEl.clientWidth;
  if (!availableWidth) return;

  getCodexHeaderFitLines().forEach(line => {
    if (!line.dataset.codexBaseFontSize) {
      line.dataset.codexBaseFontSize = String(
        parseFloat(getComputedStyle(line).fontSize) || 16
      );
    }

    const baseFontSize = Number(line.dataset.codexBaseFontSize) || 16;
    line.style.fontSize = `${baseFontSize}px`;
    line.style.whiteSpace = "nowrap";

    const lineWidth = line.scrollWidth;
    if (lineWidth <= availableWidth) return;

    const nextFontSize = Math.max(10, baseFontSize * (availableWidth / lineWidth));
    line.style.fontSize = `${nextFontSize}px`;
  });
}

window.fitCodexHeaderText = fitCodexHeaderText;
window.resetCodexHeaderFitStyles = resetCodexHeaderFitStyles;
