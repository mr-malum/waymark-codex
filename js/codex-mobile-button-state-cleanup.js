/* =========================================================
   MOBILE BUTTON STATE CLEANUP
   =========================================================

   Mobile browsers can leave tapped buttons in a focused/active-looking state
   until another element is tapped. Blur Codex/map UI controls after touch/click
   activation so visual state resets immediately.
*/

function shouldClearCodexMobileButtonState(target) {
  return Boolean(target?.closest?.(`
    .codex-control-cluster button,
    .codex-panel-nav button,
    #codex-mobile-page-control,
    #codex-search-button,
    #codex-back,
    #codex-close,
    #codex-mobile-debug-toggle,
    #codex-button,
    #map-reset-button,
    .codex-image-modal-close,
    .codex-image-modal-nav
  `));
}

function clearCodexMobileButtonState(target) {
  const control = target?.closest?.("button, [role='button']");
  if (!control || typeof control.blur !== "function") return;

  window.setTimeout(() => {
    control.blur();

    if (document.activeElement === control) {
      document.activeElement?.blur?.();
    }
  }, 0);
}

function bindCodexMobileButtonStateCleanup() {
  document.addEventListener("pointerup", event => {
    if (event.pointerType && event.pointerType !== "touch") return;
    if (!shouldClearCodexMobileButtonState(event.target)) return;
    clearCodexMobileButtonState(event.target);
  }, true);

  document.addEventListener("touchend", event => {
    if (!shouldClearCodexMobileButtonState(event.target)) return;
    clearCodexMobileButtonState(event.target);
  }, true);

  document.addEventListener("click", event => {
    if (!shouldClearCodexMobileButtonState(event.target)) return;
    clearCodexMobileButtonState(event.target);
  }, true);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindCodexMobileButtonStateCleanup);
} else {
  bindCodexMobileButtonStateCleanup();
}
