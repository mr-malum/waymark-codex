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
  return getGoogleDriveImageSrc(fileId);
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
    const src = getGoogleDriveImageSrc(driveId);

    return {
      raw,
      src,
      href: src,
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

  const resolvedHref = resolveCodexAssetHref(imageUrl) || resolvedUrl;
  const cssVar = assetKind === "map" ? "--codex-map-image" : "--codex-record-image";

  return [
    `style="${cssVar}: url('${escapeJsString(resolvedUrl)}')"`,
    `data-codex-image-source="${escapeHtml(resolvedUrl)}"`,
    `data-codex-image-href="${escapeHtml(resolvedHref)}"`,
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

function getCodexRenderedImageFit(node) {
  if (!node) return "cover";

  if (node.dataset.codexImageKind === "map") return "contain";
  if (node.classList.contains("codex-placeholder-npc")) return "contain";

  return "cover";
}

function layoutCodexRenderedImage(node, image) {
  if (!node || !image) return;

  const fit = getCodexRenderedImageFit(node);
  image.dataset.codexImageFit = fit;

  if (fit !== "contain") {
    image.style.left = "0";
    image.style.top = "0";
    image.style.width = "100%";
    image.style.height = "100%";
    return;
  }

  const nodeWidth = node.clientWidth;
  const nodeHeight = node.clientHeight;
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;

  if (!nodeWidth || !nodeHeight || !naturalWidth || !naturalHeight) {
    image.style.left = "0";
    image.style.top = "0";
    image.style.width = "100%";
    image.style.height = "100%";
    return;
  }

  const scale = Math.min(nodeWidth / naturalWidth, nodeHeight / naturalHeight);
  const renderedWidth = Math.max(1, naturalWidth * scale);
  const renderedHeight = Math.max(1, naturalHeight * scale);

  image.style.width = `${renderedWidth}px`;
  image.style.height = `${renderedHeight}px`;
  image.style.left = `${(nodeWidth - renderedWidth) / 2}px`;
  image.style.top = `${(nodeHeight - renderedHeight) / 2}px`;
}

function ensureCodexRenderedImageLayer(node) {
  if (!node || node.dataset.codexImageKind === "map" && node.classList.contains("codex-map-card-missing")) return null;

  const src = node.dataset.codexImageSource;
  if (!src) return null;

  let image = node.querySelector(":scope > .codex-rendered-image-layer");

  if (!image) {
    image = document.createElement("img");
    image.className = "codex-rendered-image-layer";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("load", () => {
      node.classList.remove("codex-image-loading", "codex-image-missing");
      node.classList.add("codex-image-loaded");
      layoutCodexRenderedImage(node, image);
    });

    image.addEventListener("error", () => {
      node.classList.remove("codex-image-loading", "codex-image-loaded");
      node.classList.add("codex-image-missing");
      ensureCodexImageMissingLabel(node);
    });

    node.prepend(image);
  }

  if (image.getAttribute("src") !== src) {
    node.classList.add("codex-image-loading");
    image.src = src;
  } else if (image.complete && image.naturalWidth) {
    node.classList.remove("codex-image-loading", "codex-image-missing");
    node.classList.add("codex-image-loaded");
    layoutCodexRenderedImage(node, image);
  }

  return image;
}

function bindCodexImageExpansion(node) {
  if (!node || node.dataset.codexImageClickBound === "true") return;

  const href = node.dataset.codexImageHref || node.dataset.codexImageSource;
  if (!href) return;

  node.dataset.codexImageClickBound = "true";
  node.classList.add("codex-image-expandable");
  node.setAttribute("title", "Open image");

  if (!node.closest("a")) {
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", "Open image");
  }

  node.addEventListener("click", event => {
    if (node.classList.contains("codex-image-missing")) return;

    if (!node.closest("a")) {
      event.preventDefault();
      event.stopPropagation();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  });

  node.addEventListener("keydown", event => {
    if (node.classList.contains("codex-image-missing")) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
  });
}

function hydrateCodexImageAssets(root = document) {
  const nodes = Array.from(root.querySelectorAll?.("[data-codex-image-source]") || []);

  nodes.forEach(node => {
    bindCodexImageExpansion(node);
    ensureCodexRenderedImageLayer(node);
  });
}

function relayoutCodexRenderedImages(root = document) {
  const images = Array.from(root.querySelectorAll?.(".codex-rendered-image-layer") || []);

  images.forEach(image => {
    const node = image.closest("[data-codex-image-source]");
    if (!node || !image.complete || !image.naturalWidth) return;
    layoutCodexRenderedImage(node, image);
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

    [data-codex-image-source].codex-image-loaded {
      --codex-record-image: none !important;
      --codex-map-image: none !important;
    }

    .codex-placeholder-npc.codex-image-loaded::before,
    .codex-placeholder-settlement.codex-image-loaded::before,
    .codex-placeholder-poi.codex-image-loaded::before,
    .codex-placeholder-region.codex-image-loaded::before {
      opacity: 0 !important;
    }

    .codex-placeholder-npc.codex-image-missing::before,
    .codex-placeholder-settlement.codex-image-missing::before,
    .codex-placeholder-poi.codex-image-missing::before,
    .codex-placeholder-region.codex-image-missing::before {
      opacity: 0.90;
    }

    .codex-rendered-image-layer {
      position: absolute;
      z-index: 1;

      display: block;
      max-width: none;
      max-height: none;

      object-fit: cover;
      object-position: center;

      opacity: 0;
      transition: opacity 0.16s ease;

      pointer-events: none;

      -webkit-mask-image:
        linear-gradient(
          to right,
          transparent 0%,
          rgba(0, 0, 0, 0.22) 4%,
          rgba(0, 0, 0, 0.82) 11%,
          black 20%,
          black 80%,
          rgba(0, 0, 0, 0.82) 89%,
          rgba(0, 0, 0, 0.22) 96%,
          transparent 100%
        ),
        linear-gradient(
          to bottom,
          transparent 0%,
          rgba(0, 0, 0, 0.22) 4%,
          rgba(0, 0, 0, 0.82) 11%,
          black 20%,
          black 80%,
          rgba(0, 0, 0, 0.82) 89%,
          rgba(0, 0, 0, 0.22) 96%,
          transparent 100%
        );
      -webkit-mask-composite: source-in;

      mask-image:
        linear-gradient(
          to right,
          transparent 0%,
          rgba(0, 0, 0, 0.22) 4%,
          rgba(0, 0, 0, 0.82) 11%,
          black 20%,
          black 80%,
          rgba(0, 0, 0, 0.82) 89%,
          rgba(0, 0, 0, 0.22) 96%,
          transparent 100%
        ),
        linear-gradient(
          to bottom,
          transparent 0%,
          rgba(0, 0, 0, 0.22) 4%,
          rgba(0, 0, 0, 0.82) 11%,
          black 20%,
          black 80%,
          rgba(0, 0, 0, 0.82) 89%,
          rgba(0, 0, 0, 0.22) 96%,
          transparent 100%
        );
      mask-composite: intersect;
    }

    .codex-image-loaded > .codex-rendered-image-layer {
      opacity: 1;
    }

    .codex-image-missing > .codex-rendered-image-layer {
      display: none;
    }

    .codex-placeholder-npc,
    .codex-map-card::before {
      background-size: contain !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }

    .codex-placeholder-settlement,
    .codex-placeholder-poi,
    .codex-placeholder-region,
    .codex-region-tile-image {
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }

    .codex-image-expandable {
      cursor: zoom-in;
    }

    .codex-image-expandable:focus-visible {
      outline: none;
    }

    .codex-map-card {
      border-radius: 16px;
    }

    .codex-map-card::before {
      background:
        radial-gradient(circle at center, rgba(255, 232, 174, 0.18), transparent 62%),
        rgba(94, 55, 22, 0.08) !important;
      background-size: cover, auto !important;
      background-position: center, center !important;
      background-repeat: no-repeat, no-repeat !important;
    }

    .codex-map-card-info {
      min-height: 33.333%;
      padding: 12px 14px 14px;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .codex-map-card-title {
      font-size: clamp(0.94rem, 1.38vw, 1.22rem);
      line-height: 1.05;
      letter-spacing: 0.04em;
      font-weight: 700;
      text-align: center;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
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
      outline: none !important;
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

window.addEventListener("resize", () => {
  relayoutCodexRenderedImages(document);
});

window.hydrateCodexImageAssets = hydrateCodexImageAssets;
window.relayoutCodexRenderedImages = relayoutCodexRenderedImages;
window.resolveCodexAssetUrl = resolveCodexAssetUrl;
window.resolveCodexAssetHref = resolveCodexAssetHref;
