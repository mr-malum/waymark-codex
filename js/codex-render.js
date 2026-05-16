function renderCodexSelectOptions(options, selectedValue = null) {
  return options.map(option => {
    const value = typeof option === "string" ? option : option.value;
    const label = typeof option === "string" ? option : option.label;

    return `
      <option
        value="${escapeHtml(value)}"
        ${selectedValue === value ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `;
  }).join("");
}

function renderCodexListControls(config) {
  const filters = config.filters || [];

  return `
    <div class="codex-filter-row">
      ${filters.map(filter => `
        <div class="codex-dynamic-filter">
          <select
            id="${escapeHtml(filter.fieldId || `${filter.id}-field`)}"
            class="codex-filter-field-select"
            aria-label="${escapeHtml(filter.label)} filter field"
          >
              ${renderCodexSelectOptions(
                filter.fieldOptions || [
                  {
                    value: filter.fieldValue || filter.id,
                    label: filter.label
                  }
                ],
                filter.fieldValue || filter.id
              )}
          </select>

          <select
            id="${escapeHtml(filter.id)}"
            aria-label="${escapeHtml(filter.label)} filter value"
          >
            ${renderCodexSelectOptions(filter.options, filter.selectedValue)}
          </select>
        </div>
      `).join("")}

      <div class="codex-sort-label">
        <div class="codex-sort-topline">
          <span>Sort</span>

          <button
            id="${escapeHtml(config.directionId)}"
            class="codex-sort-direction"
            type="button"
            data-direction="${escapeHtml(config.direction || "asc")}"
          >
            ${config.direction === "desc" ? "↓ DESC" : "↑ ASC"}
          </button>
        </div>

        <select
          id="${escapeHtml(config.sortId)}"
          aria-label="Sort records by"
        >
          ${renderCodexSelectOptions(config.sortOptions, config.selectedSort)}
        </select>
      </div>
    </div>
  `;
}

function parseCodexRowLabel(label) {
  const parts = String(label || "")
    .split(" — ")
    .map(part => part.trim())
    .filter(Boolean);

  return {
    title: parts.shift() || "Unnamed Record",
    meta: parts.join(" • ")
  };
}

function getCodexRecordTypeIcon(type) {
  switch (type) {
    case "poi":
    case "poi-group":
      return getCodexIcon("poi");

    case "npc":
      return getCodexIcon("npc");

    case "region":
      return getCodexIcon("region");

    case "hex":
      return getCodexIcon("hex");

    default:
      return getCodexIcon("fallback");
  }
}

function getCodexRecordTypeLabel(type) {
  switch (type) {
    case "poi":
    case "poi-group":
      return "POI";

    case "npc":
      return "NPC";

    case "region":
      return "Reg";

    case "hex":
      return "Hex";

    default:
      return "";
  }
}

function getCodexRowIconClass(icon) {
  return icon === getCodexIcon("hex") ? " codex-row-icon-hex" : "";
}

function renderCodexRow(options) {
  const title = options?.title || "Unnamed Record";
  const meta = options?.meta || "";
  const icon = options?.icon || "";
  const typeLabel = options?.typeLabel || "";
  const count = options?.count;
  const onclick = options?.onclick || "";
  const extraClasses = options?.classes || "";
  const isActive = Boolean(options?.active);
  const isDisabled = Boolean(options?.disabled);
  const disabledAttr = isDisabled ? "disabled" : "";
  const activeClass = isActive ? "codex-row-active active" : "";
  const disabledClass = isDisabled ? "codex-row-disabled" : "";
  const hasKicker = Boolean(typeLabel);
  const noIconClass = !icon && !hasKicker ? "codex-linked-row" : "";
  const kickerClass = hasKicker ? "codex-row-has-kicker" : "";
  const iconClass = getCodexRowIconClass(icon);

  return `
    <button
      class="codex-row ${noIconClass} ${kickerClass} ${extraClasses} ${activeClass} ${disabledClass}"
      type="button"
      ${onclick ? `onclick="${onclick}"` : ""}
      ${disabledAttr}
    >
      ${
        hasKicker
          ? `
            <span class="codex-row-kicker" aria-hidden="true">
              ${icon ? `<span class="codex-row-kicker-icon${iconClass}">${escapeHtml(icon)}</span>` : ""}
              <span class="codex-row-type-label">${escapeHtml(typeLabel)}</span>
            </span>
          `
          : icon
            ? `<span class="codex-row-icon${iconClass}" aria-hidden="true">${escapeHtml(icon)}</span>`
            : ""
      }

      <span class="codex-row-main">
        <span class="codex-row-title">${escapeHtml(title)}</span>
        ${meta ? `<span class="codex-row-meta">${escapeHtml(meta)}</span>` : ""}
      </span>

      ${
        count !== undefined && count !== null
          ? `<span class="codex-row-count">${escapeHtml(String(count))}</span>`
          : `<span class="codex-row-arrow" aria-hidden="true">›</span>`
      }
    </button>
  `;
}

function getCodexLinkedRowOnclick(resolvedType, id, options = {}) {
  const handler = options.onclickHandler || "openCodexPage";
  return `${handler}('${escapeJsString(resolvedType)}', '${escapeJsString(id)}')`;
}

function renderCodexLinkedList(
  rows,
  emptyText,
  type,
  idField,
  getLabel,
  getType = null,
  getIcon = null,
  options = {}
) {
  if (!rows.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="codex-row-list codex-linked-row-list">
      ${rows.map(row => {
        const id = row?.__codexRecordId || row?.[idField];

        const resolvedType = row?.__codexRecordType || (
          getType
            ? getType(row)
            : type
        );

        const label = getLabel(row) || id || "Unnamed Record";
        const { title, meta } = parseCodexRowLabel(label);
        const icon = getIcon
          ? getIcon(row, resolvedType)
          : getCodexRecordTypeIcon(resolvedType);
        const typeLabel = getCodexRecordTypeLabel(resolvedType);

        return renderCodexRow({
          title,
          meta,
          icon,
          typeLabel,
          classes: "codex-linked-record-row",
          onclick: getCodexLinkedRowOnclick(resolvedType, id, options)
        });
      }).join("")}
    </div>
  `;
}