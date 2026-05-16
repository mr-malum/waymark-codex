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
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
}

function getGoogleDrivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

function getCodexAssetInfo(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      raw: "",
      src: "",
      href: "",
      driveId: "",
      isDrive: false
    };
  }

  const driveId = extractGoogleDriveFileId(raw) || (isLikelyGoogleDriveFileId(raw) ? raw : "");

  if (driveId) {
    return {
      raw,
      src: getGoogleDriveImageSrc(driveId),
      href: getGoogleDrivePreviewUrl(driveId),
      driveId,
      isDrive: true
    };
  }

  return {
    raw,
    src: raw,
    href: raw,
    driveId: "",
    isDrive: false
  };
}

function resolveCodexAssetUrl(value) {
  return getCodexAssetInfo(value).src;
}

function resolveCodexAssetHref(value) {
  return getCodexAssetInfo(value).href;
}

function getCodexRawAssetValue(record, fieldNames) {
  return fieldNames
    .map(fieldName => record?.[fieldName])
    .find(value => String(value || "").trim()) || "";
}

function getCodexImageUrl(record, fieldNames) {
  return resolveCodexAssetUrl(getCodexRawAssetValue(record, fieldNames));
}

function getCodexImageHref(record, fieldNames) {
  return resolveCodexAssetHref(getCodexRawAssetValue(record, fieldNames));
}

function getRegionImageUrl(region) {
  return getCodexImageUrl(region, [
    "Image_File_ID",
    "Image",
    "Image_URL",
    "Region_Image_File_ID",
    "Region_Image",
    "Region_Image_URL"
  ]);
}

function getPoiImageUrl(poi) {
  return getCodexImageUrl(poi, [
    "Image_File_ID",
    "Image",
    "Image_URL",
    "POI_Image_File_ID",
    "POI_Image",
    "POI_Image_URL"
  ]);
}

function getPoiGroupImageUrl(group) {
  return getCodexImageUrl(group, [
    "Image_File_ID",
    "Image",
    "Image_URL",
    "POI_Group_Image_File_ID",
    "POI_Group_Image",
    "POI_Group_Image_URL",
    "Group_Image_File_ID",
    "Group_Image",
    "Group_Image_URL"
  ]);
}

function getNpcImageUrl(npc) {
  return getCodexImageUrl(npc, [
    "Image_File_ID",
    "Image",
    "Image_URL",
    "NPC_Image_File_ID",
    "NPC_Image",
    "NPC_Image_URL",
    "Portrait_File_ID",
    "Portrait",
    "Portrait_URL"
  ]);
}

function getCodexMapImageValue(map) {
  return getCodexRawAssetValue(map, [
    "Map_Image_File_ID",
    "Image_File_ID",
    "Map_Image",
    "Map_Image_URL",
    "Image",
    "Image_URL"
  ]);
}

function getCodexMapImageUrl(map) {
  return resolveCodexAssetUrl(getCodexMapImageValue(map));
}

function getCodexMapImageHref(map) {
  return resolveCodexAssetHref(getCodexMapImageValue(map));
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
  const mapHref = getCodexMapImageHref(map);
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
      href="${escapeHtml(mapHref || imageUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      ${renderMapTileStyle(imageUrl)}
    >
      ${renderCodexImageStateLabel("Map unavailable")}
      <span class="codex-map-card-info">${content}</span>
    </a>
  `;
}

function ensureCodexImageMissingLabel(node) {
  if (!node || node.querySelector?.(".codex-image-state-label")) return;

  const label = document.createElement("span");
  label.className = "codex-image-state-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = node.dataset.codexImageKind === "map"
    ? "Map unavailable"
    : "Image unavailable";

  node.appendChild(label);
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
      ensureCodexImageMissingLabel(node);
    };

    image.src = src;
  });
}

function injectCodexAssetStyles() {
  if (document.getElementById("codex-asset-state-styles")) return;

  const style = document.createElement("style");
  style.id = "codex-asset-state-styles";
  style.textContent = `
    [data-codex-image-source].codex-image-missing {
      --codex-record-image: none !important;
      --codex-map-image: none !important;
    }

    .codex-image-state-label {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 4;

      display: none;
      transform: translate(-50%, -50%);

      max-width: 82%;
      padding: 6px 9px;

      border: 1px solid rgba(72, 43, 18, 0.28);
      border-radius: 999px;

      background: rgba(239, 211, 158, 0.76);
      color: rgba(47, 29, 16, 0.86);

      font-family: 'Marcellus SC', Georgia, serif;
      font-size: 0.72rem;
      line-height: 1.05;
      letter-spacing: 0.045em;
      text-align: center;
      text-transform: uppercase;

      box-shadow:
        0 1px 4px rgba(45, 25, 8, 0.12),
        inset 0 1px 0 rgba(255, 242, 210, 0.30);

      pointer-events: none;
    }

    .codex-image-missing > .codex-image-state-label,
    .codex-map-card-missing > .codex-image-state-label {
      display: block;
    }

    .codex-map-card-missing::before {
      opacity: 0.42;
    }

    .codex-image-missing {
      outline: 1px solid rgba(120, 56, 31, 0.28);
      outline-offset: -1px;
    }
  `;

  document.head.appendChild(style);
}

if (typeof setCodexContent === "function") {
  const originalSetCodexContent = setCodexContent;

  setCodexContent = function setCodexContentWithAssetHydration(html, breadcrumbs = []) {
    originalSetCodexContent(html, breadcrumbs);
    hydrateCodexImageAssets(getCodexContent());
  };
}

document.addEventListener("DOMContentLoaded", () => {
  injectCodexAssetStyles();
  hydrateCodexImageAssets(document);
});

window.hydrateCodexImageAssets = hydrateCodexImageAssets;
window.resolveCodexAssetUrl = resolveCodexAssetUrl;
window.resolveCodexAssetHref = resolveCodexAssetHref;
