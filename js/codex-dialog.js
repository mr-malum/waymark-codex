(function () {
  const nativeAlert = window.alert?.bind(window);
  const nativeConfirm = window.confirm?.bind(window);
  let activeDialog = null;

  function ensureDialogRoot() {
    let root = document.getElementById("codex-dialog-root");
    if (root) return root;

    root = document.createElement("div");
    root.id = "codex-dialog-root";
    root.className = "codex-dialog-root hidden";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="codex-dialog-backdrop" data-codex-dialog-cancel></div>
      <section class="codex-dialog-card" role="dialog" aria-modal="true" aria-labelledby="codex-dialog-title" aria-describedby="codex-dialog-message">
        <div class="codex-dialog-kicker">Waymark Codex</div>
        <h2 id="codex-dialog-title"></h2>
        <p id="codex-dialog-message"></p>
        <div class="codex-dialog-actions">
          <button id="codex-dialog-confirm" class="codex-dialog-button codex-dialog-button-primary" type="button">Continue</button>
          <button id="codex-dialog-cancel" class="codex-dialog-button codex-dialog-button-secondary" type="button" data-codex-dialog-cancel>Cancel</button>
        </div>
      </section>
    `;
    document.body.appendChild(root);
    return root;
  }

  function closeDialog(result) {
    if (!activeDialog) return;
    const { root, previousFocus, resolve } = activeDialog;
    activeDialog = null;
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleDialogKeydown);
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
    resolve(result);
  }

  function handleDialogKeydown(event) {
    if (!activeDialog) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog(false);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [...activeDialog.root.querySelectorAll("button:not([hidden]):not(:disabled)")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showDialog(options = {}) {
    if (!document?.body) {
      return Promise.resolve(options.variant === "confirm" ? nativeConfirm?.(options.message || "") === true : (nativeAlert?.(options.message || ""), true));
    }
    if (activeDialog) closeDialog(false);

    const root = ensureDialogRoot();
    const title = root.querySelector("#codex-dialog-title");
    const message = root.querySelector("#codex-dialog-message");
    const cancelButton = root.querySelector("#codex-dialog-cancel");
    const confirmButton = root.querySelector("#codex-dialog-confirm");
    const isConfirm = options.variant === "confirm";
    const isDanger = options.tone === "danger";

    title.textContent = options.title || (isConfirm ? "Are You Sure?" : "Notice");
    message.textContent = options.message || "";
    cancelButton.hidden = !isConfirm;
    cancelButton.textContent = options.cancelLabel || "Cancel";
    confirmButton.textContent = options.confirmLabel || (isConfirm ? "Continue" : "OK");
    confirmButton.classList.toggle("codex-dialog-button-danger", isDanger);

    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");

    return new Promise(resolve => {
      activeDialog = {
        root,
        resolve,
        previousFocus: document.activeElement
      };

      root.querySelectorAll("[data-codex-dialog-cancel]").forEach(element => {
        element.onclick = () => closeDialog(false);
      });
      confirmButton.onclick = () => closeDialog(true);
      document.addEventListener("keydown", handleDialogKeydown);
      window.requestAnimationFrame(() => confirmButton.focus({ preventScroll: true }));
    });
  }

  window.codexAlert = function codexAlert(message, options = {}) {
    return showDialog({
      ...options,
      message: String(message || ""),
      variant: "alert",
      confirmLabel: options.confirmLabel || "OK"
    });
  };

  window.codexConfirm = function codexConfirm(message, options = {}) {
    return showDialog({
      ...options,
      message: String(message || ""),
      variant: "confirm"
    });
  };

  window.alert = function themedAlert(message) {
    window.codexAlert(message);
  };
})();
