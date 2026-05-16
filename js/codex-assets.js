/* =========================================================
   CODEX ASSET RESOLUTION / IMAGE STATE
   ========================================================= */

const CODEX_GOOGLE_DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

function extractGoogleDriveFileId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const filePathMatch = raw.match(/\/file\/d\/([^/?#]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];

  const openIdMatch = raw.match(/[?&]id=([^&#]+)/i);
  if (openIdMatch?.[1]) return openIdMatch[1];

  const ucIdMatch = raw.match(/[?&]export=(?:view|download)&id=([^&#]+)/i);
  if (ucIdMatch?.[1]) return ucIdMatch[1];

  return "";
}

function isLikelyGoogleDriveFileId(value) {
  const raw = String(value || "").trim();
  return CODEX_GOOGLE_DRIVE_ID_PATTERN.test(raw) && !raw.includes("/") && !raw.includes(".");
}

function getGoogleDriveImageSrc(fileId) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

function resolveCodexAssetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) return getGoogleDriveImageSrc(driveId);

  if (isLikelyGoogleDriveFileId(raw)) {
    return getGoogleDriveImageSrc(raw);
  }

  return raw;
}

function getCodexRawAssetValue(record, fieldNames) {
  return fieldNames
    .map(fieldName => record?.[fieldName])
    .find(value => String(value || "").trim()) || "";
}

function getCodexImageUrl(record, fieldNames) {
  return resolveCodexAssetUrl(getCodexRawAssetValue(record, fieldNames));
}

function getCodexAssetAttrs(imageUrl, assetKind = "record") {
  const resolvedUrl = resolveCodexAssetUrl(imageUrl);
  if (!resolvedUrl) return "";

  const cssVar = assetKind === "map" ? "--codex-map-image" : "--codex-record-image";

  return [
    `style="${cssVar}: url('${escapeJsString(resolvedUrl)}')"`,
    `data-codex-image-source="${escapeHtml(resolvedUrl)}"`,
    `data-codex-image-kind="${escapeHtml(assetKind)}"`
  ].join(" ");
}

function renderImageStyle(imageUrl) {
  return getCodexAssetAttrs(imageUrl, "record");
}

function renderMapTileStyle(imageUrl) {
  return getCodexAssetAttrs(imageUrl, "map");
}

function renderCodexImageStateLabel(label = "Image unavailable") {
  return `<span class="codex-image-state-label" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function renderCodexMapCard(map) {
  const imageUrl = getCodexMapImageUrl(map);
  const mapName = map.Map_Name || map.Map_ID || "Unnamed Map";
  const content = `<span class="codex-map-card-title">${escapeHtml(mapName)}</span>`;

  if (!imageUrl) {
    return `
      <div class="codex-map-card codex-map-card-disabled codex-map-card-missing">
        ${renderCodexImageStateLabel("Map not recorded")}
        <span class="codex-map-card-info">${content}</span>
      </div>
    `;
  }

  return `
    <a
      class="codex-map-card"
      href="${escapeHtml(imageUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      ${renderMapTileStyle(imageUrl)}
    >
      ${renderCodexImageStateLabel("Map unavailable")}
      <span class="codex-map-card-info">${content}</span>
    </a>
  `;
}

function hydrateCodexImageAssets(root = document) {
  const nodes = Array.from(root.querySelectorAll?.("[data-codex-image-source]") || []);

  nodes.forEach(node => {
    const src = node.dataset.codexImageSource;
    if (!src || node.dataset.codexImageChecked === "true") return;

    node.dataset.codexImageChecked = "true";
    node.classList.add("codex-image-loading");

    const image = new Image();

    image.onload = () => {
      node.classList.remove("codex-image-loading", "codex-image-missing");
      node.classList.add("codex-image-loaded");
    };

    image.onerror = () => {
      node.classList.remove("codex-image-loading", "codex-image-loaded");
      node.classList.add("codex-image-missing");
    };

    image.src = src;
  });
}

if (typeof setCodexContent === "function") {
  const originalSetCodexContent = setCodexContent;

  setCodexContent = function setCodexContentWithAssetHydration(html, breadcrumbs = []) {
    originalSetCodexContent(html, breadcrumbs);
    hydrateCodexImageAssets(getCodexContent());
  };
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateCodexImageAssets(document);
});

window.hydrateCodexImageAssets = hydrateCodexImageAssets;
window.resolveCodexAssetUrl = resolveCodexAssetUrl;
