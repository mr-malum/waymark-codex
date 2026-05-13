function openCodex() {
  document.getElementById("codex-overlay").classList.add("open");
}

function closeCodex() {
  codexSearchQuery = "";

  document.getElementById("codex-overlay").classList.remove("open");
  map.closePopup();
  clearSelectedHex();
}

function setCodexTitle(title) {
  document.getElementById("codex-title").textContent = title;
}

function getCodexBreadcrumbLabel(label) {
  if (label === "Points of Interest") return "POIs";
  return label;
}

function renderCodexBreadcrumbs(breadcrumbs = []) {
  const breadcrumbsEl = document.getElementById("codex-breadcrumbs");
  if (!breadcrumbsEl) return;

  if (!breadcrumbs.length) {
    breadcrumbsEl.innerHTML = "";
    return;
  }

  const displayCrumbs = breadcrumbs.map(crumb => ({
    ...crumb,
    label: getCodexBreadcrumbLabel(crumb.label)
  }));

  const desktopHtml = displayCrumbs.map((crumb, index) => {
    const isLast = index === displayCrumbs.length - 1;

    return `
      ${crumb.clickable && !isLast
        ? `<button class="codex-breadcrumb-button" type="button" onclick="${crumb.onclick}">
            ${escapeHtml(crumb.label)}
          </button>`
        : `<span>${escapeHtml(crumb.label)}</span>`
      }
      ${!isLast ? `<span class="codex-breadcrumb-separator">/</span>` : ""}
    `;
  }).join("");

  const mobileCrumbs = displayCrumbs.slice(-2);

  const mobileHtml = `
    ${displayCrumbs.length > 2
      ? `<span class="codex-breadcrumb-ellipsis">...</span><span class="codex-breadcrumb-separator">/</span>`
      : ""
    }

    ${mobileCrumbs.map((crumb, index) => {
      const isLast = index === mobileCrumbs.length - 1;

      return `
        ${crumb.clickable && !isLast
          ? `<button class="codex-breadcrumb-button" type="button" onclick="${crumb.onclick}">
              ${escapeHtml(crumb.label)}
            </button>`
          : `<span>${escapeHtml(crumb.label)}</span>`
        }

        ${!isLast
          ? `<span class="codex-breadcrumb-separator">/</span>`
          : ""
        }
      `;
    }).join("")}
  `;

  breadcrumbsEl.innerHTML = `
    <div id="codex-breadcrumbs-inner" class="codex-breadcrumbs-desktop">
      ${desktopHtml}
    </div>

    <div class="codex-breadcrumbs-mobile">
      ${mobileHtml}
    </div>
  `;
}

function setCodexContent(html, breadcrumbs = []) {
  const content = document.getElementById("codex-content");
  content.className = "";
  content.scrollTop = 0;

  renderCodexBreadcrumbs(breadcrumbs);

  content.innerHTML = html;
}

function updateCodexBackButton() {
  const backButton = document.getElementById("codex-back");

  if (codexHistory.length <= 1) {
    backButton.disabled = false;
    backButton.textContent = "← Map";
  } else {
    backButton.disabled = false;
    backButton.textContent = "← Back";
  }
}

function openCodexPage(type = "index", id = null, options = {}) {
  const shouldPush = options.push !== false;

  closePanel({ clearSelection: true });
  resetMapToAtlasView();
  openCodex();

  if (shouldPush) {
    codexHistory.push({ type, id });
  }

  renderCodexPage(type, id);
  updateCodexBackButton();
}

function goBackCodex() {
  if (codexHistory.length <= 1) return;

  codexHistory.pop();

  const previous = codexHistory[codexHistory.length - 1];
  renderCodexPage(previous.type, previous.id);
  updateCodexBackButton();
}

function resetCodexToIndex() {
  codexHistory = [];
  openCodexPage("index", null);
}

function renderCodexPage(type, id) {
  if (!db) {
    setCodexTitle("The Codex of Kadesh");
    setCodexContent(`<p>The records are still being gathered...</p>`);
    return;
  }

  if (type === "hex") return renderCodexHexPage(id);
  if (type === "region") return renderCodexRegionPage(id);
  if (type === "poi") return renderCodexPoiPage(id);
  if (type === "npc") return renderCodexNpcPage(id);
  if (type === "search") return renderCodexSearchPage();
  if (type === "regions") return renderCodexRegionsIndex();
  if (type === "pois") return renderCodexPoisIndex();
  if (type === "npcs") return renderCodexNpcsIndex();

  return renderCodexIndex();
}

function renderCodexIndex() {
  setCodexTitle("The Codex of Kadesh");
  renderCodexBreadcrumbs([]);

  codexSearchQuery = "";

  const content = document.getElementById("codex-content");
  content.className = "codex-home";

  content.innerHTML = `
    <button class="codex-section-button" type="button" onclick="openCodexPage('search')">Search</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('regions')">Regions</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('pois')">Points of Interest</button>
    <button class="codex-section-button" type="button" onclick="openCodexPage('npcs')">NPCs</button>
  `;
}

function openCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.add("open");
}

function closeCodexMobileControls() {
  document
    .getElementById("codex-list-controls-shell")
    ?.classList.remove("open");
}

window.openCodex = openCodex;
window.closeCodex = closeCodex;
window.openCodexPage = openCodexPage;
window.goBackCodex = goBackCodex;
window.resetCodexToIndex = resetCodexToIndex;
window.openCodexMobileControls = openCodexMobileControls;
window.closeCodexMobileControls = closeCodexMobileControls;