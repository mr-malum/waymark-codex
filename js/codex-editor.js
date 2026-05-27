function setCodexEditorStatus(message = "") {
  const status = document.getElementById("codex-editor-status");
  if (status) {
    status.textContent = message;
  }
}

let codexEditorState = {
  mode: "",
  recordType: "",
  recordId: "",
  originalChildIds: [],
  workingChildIds: [],
  quickRegion: false,
  onCreated: null
};

let codexEditorPickerState = {
  kind: "",
  inputId: "",
  originalValue: "",
  title: "",
  help: ""
};

function populateNpcHomeOptions(options = {}) {
  const select = document.getElementById("codex-add-npc-home");
  if (!select) return;

  const { hexId = "", selectedHomeId = "", lockHome = false } = options;
  const pois = (db?.raw?.pois || [])
    .filter(poi => !hexId || poi.Hex_ID_Ref === hexId);

  const optionHtml = [
    `<option value="">Select a home...</option>`,
    ...pois
      .slice()
      .sort((a, b) => String(a.Name || a.POI_ID).localeCompare(String(b.Name || b.POI_ID)))
      .map(poi => `
        <option value="${escapeHtml(poi.POI_ID)}">
          ${escapeHtml(poi.Name || poi.POI_ID)}
        </option>
      `)
  ];

  select.innerHTML = optionHtml.join("");
  select.value = selectedHomeId || "";
  select.disabled = Boolean(lockHome && selectedHomeId);
}

function populatePoiRegionOptions() {
  const select = document.getElementById("codex-add-poi-region");
  if (!select) return;

  const options = [
    `<option value="">Select a region...</option>`,
    ...(db?.raw?.regions || [])
      .slice()
      .sort((a, b) => String(a.Region_Name || a.Region_ID).localeCompare(String(b.Region_Name || b.Region_ID)))
      .map(region => `
        <option value="${escapeHtml(region.Region_ID)}">
          ${escapeHtml(region.Region_Name || region.Region_ID)}
        </option>
      `)
  ];

  select.innerHTML = options.join("");
}

function populatePoiGroupOptions(selectedGroupId = "") {
  const select = document.getElementById("codex-add-poi-parent-group");
  if (!select) return;

  const groups = [...(db?.raw?.poiGroups || [])]
    .sort((a, b) => String(a.POI_Group_Name || a.POI_Group_ID).localeCompare(String(b.POI_Group_Name || b.POI_Group_ID)));

  const options = [
    `<option value="">None</option>`,
    ...groups.map(group => `
      <option value="${escapeHtml(group.POI_Group_ID)}">
        ${escapeHtml(group.POI_Group_Name || group.POI_Group_ID)}
      </option>
    `)
  ];

  select.innerHTML = options.join("");
  select.value = selectedGroupId || "";
}

const EVEN_Q_POI_GROUP_NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ODD_Q_POI_GROUP_NEIGHBORS = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];

function getPoiGroupHexCoordinates(hexId = "") {
  const hex = db?.hexesById?.[hexId];
  const coordinateValue = String(hex?.Map_XY || hex?.Hex_ID || hexId || "").trim();
  if (!coordinateValue || typeof parseMapHexId !== "function") return null;
  return parseMapHexId(coordinateValue);
}

function arePoiGroupHexesAdjacent(leftHexId = "", rightHexId = "") {
  if (!leftHexId || !rightHexId || leftHexId === rightHexId) return false;
  const left = getPoiGroupHexCoordinates(leftHexId);
  const right = getPoiGroupHexCoordinates(rightHexId);
  if (!left || !right) return false;
  const offsets = left.x % 2 ? ODD_Q_POI_GROUP_NEIGHBORS : EVEN_Q_POI_GROUP_NEIGHBORS;
  return offsets.some(([dx, dy]) => left.x + dx === right.x && left.y + dy === right.y);
}

function getPoiGroupAdjacencyChildren(groupId = "", options = {}) {
  if (!groupId) return [];

  const excludePoiId = options.excludePoiId || "";
  const scopedChildIds = Array.isArray(options.childIds)
    ? options.childIds
    : null;
  const children = scopedChildIds
    ? scopedChildIds.map(poiId => db?.poisById?.[poiId]).filter(Boolean)
    : (getPoisForGroup?.(groupId) || db?.poisByGroupId?.[groupId] || []);

  return children.filter(poi => poi?.POI_ID && poi.POI_ID !== excludePoiId);
}

function canPoiHexJoinGroup(hexId = "", groupId = "", options = {}) {
  if (!groupId || !hexId) return true;
  const siblings = getPoiGroupAdjacencyChildren(groupId, options);
  if (!siblings.length) return true;
  return siblings.some(poi => poi?.Hex_ID_Ref && arePoiGroupHexesAdjacent(hexId, poi.Hex_ID_Ref));
}

function setPoiGroupHelpState(helpEl, message, isWarning = false) {
  if (!helpEl) return;
  helpEl.textContent = message || helpEl.dataset.defaultText || "";
  helpEl.classList.toggle("codex-editor-inline-warning", isWarning);
}

function populatePoiTypeOptions(selectId, selectedValue = "", blankLabel = "Select a type...") {
  const select = document.getElementById(selectId);
  if (!select) return;

  const typeOptions = window.CampaignPoiTypes?.getTypeOptions?.() || [];
  const normalizedValue = window.CampaignPoiTypes?.normalizeTypeValue?.(selectedValue) || "";
  const rawValue = String(selectedValue || "").trim();
  const options = [];

  if (blankLabel) {
    options.push(`<option value="">${escapeHtml(blankLabel)}</option>`);
  }
  if (rawValue && !normalizedValue) {
    options.push(`<option value="${escapeHtml(rawValue)}">Legacy type: ${escapeHtml(rawValue)} (choose a new type)</option>`);
  }
  typeOptions.forEach(option => {
    options.push(`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`);
  });

  select.innerHTML = options.join("");
  select.value = normalizedValue || rawValue || "";
}

function populatePoiNotorietyOptions(selectId, selectedValue = "", blankLabel = "Select notoriety...") {
  const select = document.getElementById(selectId);
  if (!select) return;

  const notorietyOptions = window.CampaignPoiTypes?.getNotorietyOptions?.() || [];
  const normalizedValue = window.CampaignPoiTypes?.normalizeNotorietyValue?.(selectedValue) || "";
  const rawValue = String(selectedValue || "").trim();
  const options = [];

  if (blankLabel) {
    options.push(`<option value="">${escapeHtml(blankLabel)}</option>`);
  }
  if (rawValue && !normalizedValue) {
    options.push(`<option value="${escapeHtml(rawValue)}">Legacy notoriety: ${escapeHtml(rawValue)} (choose 1-10)</option>`);
  }
  notorietyOptions.forEach(option => {
    options.push(`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`);
  });

  select.innerHTML = options.join("");
  select.value = normalizedValue || rawValue || "";
}

function getNormalizedPoiIconValue(value, options = {}) {
  const iconHelpers = window.CampaignPoiIcons;
  if (!iconHelpers) return "";
  return options.fallback === false
    ? (iconHelpers.getStoredIconValue?.(value) || "")
    : (iconHelpers.getDisplayIconValue?.(value) || "");
}

function readPoiIconInputValue(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return "";
  return getNormalizedPoiIconValue(input.value || "", { fallback: false });
}

function writePoiIconInputValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return "";
  const normalizedValue = getNormalizedPoiIconValue(value, { fallback: false });
  input.value = normalizedValue;
  return normalizedValue;
}

function getPoiIconPickerOptions(pickerId) {
  const picker = document.getElementById(pickerId);
  return {
    collapsible: picker?.dataset.iconPickerCollapsible === "true"
  };
}

function buildPoiIconPickerMarkup(inputId, pickerId, value, options = {}) {
  const selectedValue = getNormalizedPoiIconValue(value, { fallback: false });
  const selectedLabel = selectedValue
    ? (window.CampaignPoiIcons?.getIconLabel?.(selectedValue) || selectedValue)
    : "";
  const categories = window.CampaignPoiIcons?.getCategoryOptions?.() || [];
  const collapsible = options.collapsible === true;

  return `
    <div class="codex-editor-icon-picker-summary">
      <strong>${selectedLabel ? `Selected: ${escapeHtml(selectedLabel)}` : "No icon selected."}</strong>
      <span>${selectedLabel ? "Click any icon to change it." : "Choose one icon to continue."}</span>
    </div>
    ${categories.map(category => {
      const categoryHeader = `
        <div class="codex-editor-icon-category-header">
          <h4>${escapeHtml(category.label)}</h4>
          <small>${category.options.length} icons</small>
        </div>
      `;
      const categoryGrid = `
        <div class="codex-editor-icon-grid">
          ${category.options.map(option => {
            const normalizedValue = option.value;
            const selected = selectedValue === normalizedValue;

            return `
              <button
                class="codex-editor-icon-option ${selected ? "is-selected" : ""}"
                type="button"
                data-icon-input="${escapeHtml(inputId)}"
                data-icon-picker="${escapeHtml(pickerId)}"
                data-icon-value="${escapeHtml(normalizedValue)}"
                aria-pressed="${selected ? "true" : "false"}"
                title="${escapeHtml(option.label)}"
              >
                <span class="codex-editor-icon-preview">
                  <img src="${escapeHtml(option.assetUrl)}" alt="">
                </span>
                <span class="codex-editor-icon-label">${escapeHtml(option.label)}</span>
              </button>
            `;
          }).join("")}
        </div>
      `;

      if (!collapsible) {
        return `
          <section class="codex-editor-icon-category">
            ${categoryHeader}
            ${categoryGrid}
          </section>
        `;
      }

      return `
        <details class="codex-editor-icon-category codex-editor-icon-category-collapsible" open>
          <summary class="codex-editor-icon-category-summary">
            <span>${escapeHtml(category.label)}</span>
            <small>${category.options.length} icons</small>
          </summary>
          ${categoryGrid}
        </details>
      `;
    }).join("")}
  `;
}

function buildPoiIconSelectionSummaryMarkup(value = "") {
  const normalizedValue = getNormalizedPoiIconValue(value, { fallback: false });
  if (!normalizedValue) {
    return `
      <div class="codex-editor-selection-empty">
        <strong>No icon selected yet.</strong>
        <small>Pick a map icon before saving.</small>
      </div>
    `;
  }

  const assetUrl = window.CampaignPoiIcons?.getIconAssetUrl?.(normalizedValue, { fallback: false }) || "";
  const label = window.CampaignPoiIcons?.getIconLabel?.(normalizedValue) || normalizedValue;

  return `
    <div class="codex-editor-selection-card codex-editor-selection-card-icon">
      <span class="codex-editor-selection-preview" aria-hidden="true">
        ${assetUrl ? `<img src="${escapeHtml(assetUrl)}" alt="">` : ""}
      </span>
      <span class="codex-editor-selection-copy">
        <strong>${escapeHtml(label)}</strong>
        <small>Shown on the map and used as the default portrait when no custom image is uploaded.</small>
      </span>
    </div>
  `;
}

function renderPoiIconSelectionSummary(inputId) {
  const input = document.getElementById(inputId);
  const summaryId = input?.dataset.summaryId || "";
  const summary = summaryId ? document.getElementById(summaryId) : null;
  if (!summary) return;
  summary.innerHTML = buildPoiIconSelectionSummaryMarkup(readPoiIconInputValue(inputId));
}

function renderPoiIconPicker(inputId, pickerId, value = "", options = {}) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  const normalizedValue = writePoiIconInputValue(inputId, value);
  picker.dataset.iconPickerCollapsible = options.collapsible === true ? "true" : "false";
  picker.innerHTML = buildPoiIconPickerMarkup(inputId, pickerId, normalizedValue, options);
  renderPoiIconSelectionSummary(inputId);
}

function selectPoiIconValue(inputId, pickerId, iconValue) {
  const normalizedValue = getNormalizedPoiIconValue(iconValue, { fallback: false });
  if (!normalizedValue) return;
  renderPoiIconPicker(inputId, pickerId, normalizedValue, getPoiIconPickerOptions(pickerId));
}

function getNormalizedPoiTagValues(values) {
  return window.CampaignPoiTags?.coerceTagValues?.(values) || [];
}

function readPoiTagInputValues(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return [];
  return getNormalizedPoiTagValues(input.value || "");
}

function writePoiTagInputValues(inputId, values) {
  const input = document.getElementById(inputId);
  if (!input) return [];
  const normalizedValues = getNormalizedPoiTagValues(values);
  input.value = normalizedValues.join(",");
  return normalizedValues;
}

function buildPoiTagPickerMarkup(inputId, pickerId, values) {
  const selectedValues = getNormalizedPoiTagValues(values);
  const categories = window.CampaignPoiTags?.getCategoryOptions?.() || [];
  const maxTags = window.CampaignPoiTags?.MAX_TAGS || 4;

  return `
    <div class="codex-editor-tag-picker-summary">
      <strong>${selectedValues.length}/${maxTags}</strong>
      <span>${selectedValues.length >= maxTags ? "Tag limit reached." : "Choose up to 4 tags."}</span>
    </div>
    ${categories.map(category => {
      const capLabel = category.max ? `Max ${category.max}` : "";
      const tagButtons = category.options.map(option => {
        const normalizedValue = window.CampaignPoiTags?.normalizeTagValue?.(option.value) || option.value;
        const selected = selectedValues.includes(normalizedValue);
        const disabled = !selected && !(window.CampaignPoiTags?.canSelectTag?.(normalizedValue, selectedValues));
        const categoryClass = window.CampaignPoiTags?.getTagCategoryClassName?.(normalizedValue) || "";

        return `
          <button
            class="codex-tag-chip codex-editor-tag-toggle ${categoryClass} ${selected ? "is-selected" : ""}"
            type="button"
            data-tag-input="${escapeHtml(inputId)}"
            data-tag-picker="${escapeHtml(pickerId)}"
            data-tag-value="${escapeHtml(normalizedValue)}"
            aria-pressed="${selected ? "true" : "false"}"
            ${disabled ? "disabled" : ""}
          >${escapeHtml(option.label)}</button>
        `;
      }).join("");

      return `
        <section class="codex-editor-tag-category">
          <div class="codex-editor-tag-category-header">
            <h4>${escapeHtml(category.label)}</h4>
            ${capLabel ? `<small>${escapeHtml(capLabel)}</small>` : ""}
          </div>
          <div class="codex-editor-tag-category-options">
            ${tagButtons}
          </div>
        </section>
      `;
    }).join("")}
  `;
}

function buildPoiTagSelectionSummaryMarkup(values = []) {
  const normalizedValues = getNormalizedPoiTagValues(values);
  if (!normalizedValues.length) {
    return `
      <div class="codex-editor-selection-empty">
        <strong>No tags yet.</strong>
        <small>Optional, but helpful for vibe and function.</small>
      </div>
    `;
  }

  return `
    <div class="codex-editor-selection-card codex-editor-selection-card-tags">
      <div class="codex-editor-selection-tag-list">
        ${normalizedValues.map(value => {
          const label = window.CampaignPoiTags?.getTagLabel?.(value) || value;
          const categoryClass = window.CampaignPoiTags?.getTagCategoryClassName?.(value) || "";
          return `<span class="codex-tag-chip ${categoryClass}">${escapeHtml(label)}</span>`;
        }).join("")}
      </div>
      <small>${normalizedValues.length} tag${normalizedValues.length === 1 ? "" : "s"} selected.</small>
    </div>
  `;
}

function renderPoiTagSelectionSummary(inputId) {
  const input = document.getElementById(inputId);
  const summaryId = input?.dataset.summaryId || "";
  const summary = summaryId ? document.getElementById(summaryId) : null;
  if (!summary) return;
  summary.innerHTML = buildPoiTagSelectionSummaryMarkup(readPoiTagInputValues(inputId));
}

function renderPoiTagPicker(inputId, pickerId, values = []) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  const normalizedValues = writePoiTagInputValues(inputId, values);
  picker.innerHTML = buildPoiTagPickerMarkup(inputId, pickerId, normalizedValues);
  renderPoiTagSelectionSummary(inputId);
}

function togglePoiTagValue(inputId, pickerId, tagValue) {
  const normalizedValue = window.CampaignPoiTags?.normalizeTagValue?.(tagValue) || "";
  if (!normalizedValue) return;

  const selectedValues = readPoiTagInputValues(inputId);
  const nextValues = selectedValues.includes(normalizedValue)
    ? selectedValues.filter(value => value !== normalizedValue)
    : window.CampaignPoiTags?.canSelectTag?.(normalizedValue, selectedValues)
      ? [...selectedValues, normalizedValue]
      : selectedValues;

  renderPoiTagPicker(inputId, pickerId, nextValues);
}

function resetCodexEditorPickerState() {
  codexEditorPickerState = {
    kind: "",
    inputId: "",
    originalValue: "",
    title: "",
    help: ""
  };
}

function closeCodexEditorPicker(options = {}) {
  const { commit = true } = options;
  const overlay = document.getElementById("codex-editor-picker-overlay");
  const content = document.getElementById("codex-editor-picker-content");

  if (!commit && codexEditorPickerState.inputId) {
    if (codexEditorPickerState.kind === "icon") {
      writePoiIconInputValue(codexEditorPickerState.inputId, codexEditorPickerState.originalValue || "");
      renderPoiIconSelectionSummary(codexEditorPickerState.inputId);
    } else if (codexEditorPickerState.kind === "tags") {
      writePoiTagInputValues(codexEditorPickerState.inputId, codexEditorPickerState.originalValue || "");
      renderPoiTagSelectionSummary(codexEditorPickerState.inputId);
    }
  }

  if (overlay) {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }
  if (content) {
    content.innerHTML = "";
    delete content.dataset.iconPickerCollapsible;
  }
  resetCodexEditorPickerState();
}

function openCodexEditorPicker(kind, inputId, options = {}) {
  const overlay = document.getElementById("codex-editor-picker-overlay");
  const title = document.getElementById("codex-editor-picker-title");
  const help = document.getElementById("codex-editor-picker-help");
  const content = document.getElementById("codex-editor-picker-content");
  const apply = document.getElementById("codex-editor-picker-apply");
  if (!overlay || !content || !inputId) return;

  codexEditorPickerState = {
    kind,
    inputId,
    originalValue: kind === "icon"
      ? readPoiIconInputValue(inputId)
      : readPoiTagInputValues(inputId).join(","),
    title: options.title || (kind === "icon" ? "Choose Map Icon" : "Edit Tags"),
    help: options.help || ""
  };

  if (title) title.textContent = codexEditorPickerState.title;
  if (help) help.textContent = codexEditorPickerState.help;
  if (apply) apply.textContent = kind === "icon" ? "Use Icon" : "Done";

  if (kind === "icon") {
    renderPoiIconPicker(inputId, "codex-editor-picker-content", readPoiIconInputValue(inputId), {
      collapsible: true
    });
  } else {
    renderPoiTagPicker(inputId, "codex-editor-picker-content", readPoiTagInputValues(inputId));
  }

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function getPoiTagValuesForRecord(record) {
  return getNormalizedPoiTagValues(record?.POI_Tags || record?.Group_Tags || []);
}

function getPoiIconValueForRecord(record) {
  return getNormalizedPoiIconValue(record?.POI_Icon || record?.Group_Icon || "", {
    fallback: false
  });
}

function populatePoiInitialChildOptions(selectedPoiId = "") {
  const select = document.getElementById("codex-add-poi-initial-child");
  if (!select) return;

  const pois = [...(db?.raw?.pois || [])]
    .filter(poi => !poi.POI_Group_ID)
    .sort((a, b) => String(a.Name || a.POI_ID).localeCompare(String(b.Name || b.POI_ID)));

  const options = [
    `<option value="">Select an initial child Area...</option>`,
    ...pois.map(poi => {
      const hex = poi.Hex_ID_Ref ? ` — Hex ${poi.Hex_ID_Ref}` : "";
      return `
        <option value="${escapeHtml(poi.POI_ID)}">
          ${escapeHtml(poi.Name || poi.POI_ID)}${escapeHtml(hex)}
        </option>
      `;
    })
  ];

  select.innerHTML = options.join("");
  select.value = selectedPoiId || "";
}

function populatePoiGroupChildAddOptions(groupId, selectedPoiId = "") {
  const select = document.getElementById("codex-edit-poi-group-add-child");
  if (!select) return;

  const workingIds = new Set(codexEditorState.workingChildIds || []);
  const pois = [...(db?.raw?.pois || [])]
    .filter(poi => !workingIds.has(poi.POI_ID))
    .filter(poi => !poi.POI_Group_ID || poi.POI_Group_ID === groupId)
    .sort((a, b) => String(a.Name || a.POI_ID).localeCompare(String(b.Name || b.POI_ID)));

  const options = [
    `<option value="">Select an Area...</option>`,
    ...pois.map(poi => {
      const hex = poi.Hex_ID_Ref ? ` — Hex ${poi.Hex_ID_Ref}` : "";
      return `
        <option value="${escapeHtml(poi.POI_ID)}">
          ${escapeHtml(poi.Name || poi.POI_ID)}${escapeHtml(hex)}
        </option>
      `;
    })
  ];

  select.innerHTML = options.join("");
  select.value = selectedPoiId || "";
  updatePoiGroupChildAddHelp();
}

function updatePoiParentGroupAdjacencyHelp() {
  const help = document.getElementById("codex-add-poi-parent-help");
  if (!help) return;

  const defaultText = help.dataset.defaultText || "Optional. Use this for Areas inside a grouped POI.";
  const parentGroupId = document.getElementById("codex-add-poi-parent-group")?.value || "";
  const hexId = document.getElementById("codex-add-poi-hex")?.value || "";
  const currentPoiId = codexEditorState.mode === "edit-poi"
    ? codexEditorState.recordId || ""
    : "";

  if (!parentGroupId) {
    setPoiGroupHelpState(help, defaultText, false);
    return;
  }

  if (!hexId) {
    setPoiGroupHelpState(help, "Choose a hex to confirm adjacency with the parent grouped POI.", false);
    return;
  }

  const siblingOptions = { excludePoiId: currentPoiId };
  const siblings = getPoiGroupAdjacencyChildren(parentGroupId, siblingOptions);
  if (!siblings.length) {
    setPoiGroupHelpState(help, "This Area will become the first child Area in the grouped POI.", false);
    return;
  }

  if (canPoiHexJoinGroup(hexId, parentGroupId, siblingOptions)) {
    setPoiGroupHelpState(help, "This Area is adjacent to an existing child Area in the grouped POI.", false);
    return;
  }

  setPoiGroupHelpState(
    help,
    "This Area must use a hex adjacent to an existing child Area in the grouped POI. Choose a neighboring hex or a different parent group.",
    true
  );
}

function updatePoiGroupChildAddHelp() {
  const help = document.getElementById("codex-edit-poi-group-add-child-help");
  if (!help) return;

  const defaultText = help.dataset.defaultText || "After the first child Area, added Areas must be adjacent to an existing child Area in the group.";
  const groupId = codexEditorState.recordId || "";
  const selectedPoiId = document.getElementById("codex-edit-poi-group-add-child")?.value || "";
  if (!selectedPoiId) {
    setPoiGroupHelpState(help, defaultText, false);
    return;
  }

  const candidatePoi = db?.poisById?.[selectedPoiId];
  const candidateHexId = candidatePoi?.Hex_ID_Ref || "";
  if (!candidateHexId) {
    setPoiGroupHelpState(help, "Selected Area needs a hex before it can join a grouped POI.", true);
    return;
  }

  const siblingOptions = {
    childIds: codexEditorState.workingChildIds || [],
    excludePoiId: selectedPoiId
  };
  const siblings = getPoiGroupAdjacencyChildren(groupId, siblingOptions);
  if (!siblings.length) {
    setPoiGroupHelpState(help, "This Area will become the first child Area in the grouped POI.", false);
    return;
  }

  if (canPoiHexJoinGroup(candidateHexId, groupId, siblingOptions)) {
    setPoiGroupHelpState(help, "This Area is adjacent to an existing child Area in the grouped POI.", false);
    return;
  }

  setPoiGroupHelpState(
    help,
    "This Area must be adjacent to an existing child Area already in the grouped POI before it can be added.",
    true
  );
}

function getPoiGroupUuidByLegacyId(groupId) {
  const group = (db?.raw?.poiGroups || []).find(row => row.POI_Group_ID === groupId);
  return group?.__uuid || null;
}

function updatePoiGroupMode() {
  const isGroup = document.getElementById("codex-add-poi-is-group")?.checked === true;
  const isPoiEdit = codexEditorState.mode === "edit-poi";
  const groupCreationLocked = document.getElementById("codex-add-poi-is-group")?.dataset.locked === "true";
  const groupCheckboxRow = document.getElementById("codex-add-poi-is-group-row");
  const parentRow = document.getElementById("codex-add-poi-parent-row");
  const parentSelect = document.getElementById("codex-add-poi-parent-group");
  const initialChildRow = document.getElementById("codex-add-poi-initial-child-row");
  const initialChildSelect = document.getElementById("codex-add-poi-initial-child");
  const regionSelect = document.getElementById("codex-add-poi-region");
  const hexSelect = document.getElementById("codex-add-poi-hex");
  const notorietyInput = document.getElementById("codex-add-poi-notoriety");
  const populationInput = document.getElementById("codex-add-poi-population");
  const typeLabel = document.getElementById("codex-add-poi-type-label");
  const regionRow = regionSelect?.closest("label");
  const hexRow = hexSelect?.closest("label");
  const notorietyRow = notorietyInput?.closest("label");
  const populationRow = populationInput?.closest("label");

  if (groupCheckboxRow) groupCheckboxRow.hidden = isPoiEdit || (groupCreationLocked && !isGroup);
  if (parentRow) parentRow.hidden = isGroup;
  if (parentSelect && isGroup) parentSelect.value = "";
  if (initialChildRow) initialChildRow.hidden = !isGroup;
  if (initialChildSelect) initialChildSelect.required = isGroup;
  if (regionSelect) regionSelect.required = !isGroup;
  if (hexSelect) hexSelect.required = !isGroup;
  if (notorietyInput) notorietyInput.required = !isGroup;
  if (regionSelect) regionSelect.disabled = isGroup || regionSelect.dataset.locked === "true";
  if (hexSelect) hexSelect.disabled = isGroup || hexSelect.dataset.locked === "true" || (!isGroup && !regionSelect?.value);
  if (notorietyInput) notorietyInput.disabled = isGroup;
  if (regionRow) regionRow.hidden = isGroup;
  if (hexRow) hexRow.hidden = isGroup;
  if (notorietyRow) notorietyRow.hidden = isGroup;
  if (populationRow) populationRow.hidden = false;
  if (typeLabel) typeLabel.textContent = isGroup ? "Group Type *" : "Type *";
  updatePoiParentGroupAdjacencyHelp();
}

function populatePoiHexOptions(regionId = "") {
  const select = document.getElementById("codex-add-poi-hex");
  if (!select) return;

  const hexes = (db?.raw?.hexes || [])
    .filter(hex => !regionId || hex.Region_ID_Ref === regionId)
    .slice()
    .sort((a, b) => String(a.Hex_ID).localeCompare(String(b.Hex_ID), undefined, { numeric: true }));

  const options = [
    `<option value="">${regionId ? "Select a hex..." : "Select a region first..."}</option>`,
    ...hexes.map(hex => {
      const terrain = hex.Terrain || "Unknown terrain";
      const poiCount = getPoisForHex?.(hex.Hex_ID)?.length || 0;
      return `
        <option value="${escapeHtml(hex.Hex_ID)}">
          ${escapeHtml(hex.Hex_ID)} — ${escapeHtml(terrain)}${poiCount ? ` — ${poiCount} POI${poiCount !== 1 ? "s" : ""}` : ""}
        </option>
      `;
    })
  ];

  select.innerHTML = options.join("");
  select.disabled = !regionId;
}

function updatePoiPopulationRequirement() {
  const typeInput = document.getElementById("codex-add-poi-type");
  const populationInput = document.getElementById("codex-add-poi-population");
  const populationLabel = document.getElementById("codex-add-poi-population-label");
  const populationHelp = document.getElementById("codex-add-poi-population-help");
  const populationTooltip = document.getElementById("codex-add-poi-population-tooltip");
  const isGroup = document.getElementById("codex-add-poi-is-group")?.checked === true;
  const parentGroupId = document.getElementById("codex-add-poi-parent-group")?.value || "";
  const currentPoi = codexEditorState.mode === "edit-poi"
    ? db?.poisById?.[codexEditorState.recordId]
    : null;
  if (!typeInput || !populationInput) return;

  const isSettlement = window.CampaignPoiTypes?.isSettlementType?.(typeInput.value) || false;
  const parentManaged = !isGroup && Boolean(parentGroupId);

  if (populationLabel) {
    populationLabel.textContent = isGroup ? "Group Population" : "Population";
  }
  if (populationTooltip) {
    populationTooltip.hidden = !isGroup;
  }

  if (isGroup) {
    populationInput.disabled = false;
    populationInput.required = false;
    if (populationHelp) {
      populationHelp.textContent = "Total population for the grouped place.";
    }
    return;
  }

  if (parentManaged) {
    populationInput.disabled = true;
    populationInput.required = false;
    populationInput.value = codexEditorState.mode === "edit-poi"
      ? String(currentPoi?.Population || "")
      : "";
    if (populationHelp) {
      populationHelp.textContent = "Population is managed from the parent grouped POI.";
    }
    return;
  }

  populationInput.disabled = false;
  populationInput.required = isSettlement;
  if (populationHelp) {
    populationHelp.textContent = isSettlement
      ? "Required for Settlements."
      : "Optional.";
  }
}

function setEditorMode(mode) {
  const title = document.getElementById("codex-editor-title");
  const npcForm = document.getElementById("codex-add-npc-form");
  const poiForm = document.getElementById("codex-add-poi-form");
  const poiGroupForm = document.getElementById("codex-edit-poi-group-form");
  const poiTagsForm = document.getElementById("codex-edit-tags-form");
  const regionForm = document.getElementById("codex-edit-region-form");
  const mapManagerForm = document.getElementById("codex-manage-maps-form");
  const journalForm = document.getElementById("codex-add-journal-form");
  const npcSubmit = npcForm?.querySelector('button[type="submit"]');
  const poiSubmit = document.getElementById("codex-poi-editor-submit");

  if (codexEditorPickerState.kind) {
    closeCodexEditorPicker({ commit: true });
  }

  if (title) {
    if (mode === "poi") title.textContent = "Add POI";
    else if (mode === "region") title.textContent = "Add Region";
    else if (mode === "quick-region") title.textContent = "Name Region";
    else if (mode === "edit-npc") title.textContent = "Edit NPC";
    else if (mode === "edit-poi") title.textContent = "Edit POI";
    else if (mode === "edit-poi-group") title.textContent = "Edit Grouped POI";
    else if (mode === "edit-tags") title.textContent = "Edit Tags";
    else if (mode === "edit-region") title.textContent = "Edit Region";
    else if (mode === "add-map") title.textContent = "Add Map";
    else if (mode === "manage-maps") title.textContent = "Manage Maps";
    else if (mode === "add-journal") title.textContent = "Add Journal Entry";
    else title.textContent = "Add NPC";
  }

  if (npcForm) npcForm.hidden = !["npc", "edit-npc"].includes(mode);
  if (poiForm) poiForm.hidden = !["poi", "edit-poi"].includes(mode);
  if (poiGroupForm) poiGroupForm.hidden = mode !== "edit-poi-group";
  if (poiTagsForm) poiTagsForm.hidden = mode !== "edit-tags";
  if (regionForm) regionForm.hidden = !["region", "quick-region", "edit-region"].includes(mode);
  if (mapManagerForm) mapManagerForm.hidden = !["add-map", "manage-maps"].includes(mode);
  if (journalForm) journalForm.hidden = mode !== "add-journal";
  if (npcSubmit) npcSubmit.textContent = mode === "edit-npc" ? "Save NPC" : "Create NPC";
  if (poiSubmit) poiSubmit.textContent = mode === "edit-poi" ? "Save POI" : "Create POI";
}

function openEditorModal() {
  setCodexEditorStatus("");
  document.getElementById("codex-editor-modal")?.classList.remove("hidden");
  document.getElementById("codex-editor-modal")?.setAttribute("aria-hidden", "false");
}

function openAddNpcEditor(options = {}) {
  codexEditorState = { mode: "npc", recordType: "", recordId: "" };
  setEditorMode("npc");
  document.getElementById("codex-add-npc-form")?.reset();
  populateNpcHomeOptions({
    hexId: options.hexId || "",
    selectedHomeId: options.homePoiId || "",
    lockHome: options.lockHome === true
  });
  openEditorModal();
}

function openEditNpcEditor(npcId) {
  const npc = db?.npcsById?.[npcId];
  if (!npc) return;

  codexEditorState = { mode: "edit-npc", recordType: "npc", recordId: npcId };
  setEditorMode("edit-npc");
  document.getElementById("codex-add-npc-form")?.reset();

  populateNpcHomeOptions({
    selectedHomeId: npc.Home_ID_Ref || "",
    lockHome: false
  });

  document.getElementById("codex-add-npc-name").value = npc.Name || "";
  document.getElementById("codex-add-npc-title").value = npc.Title || "";
  document.getElementById("codex-add-npc-organization").value = npc.Organization || "";
  document.getElementById("codex-add-npc-race").value = npc.Race || "";
  document.getElementById("codex-add-npc-occupation").value = npc.Occupation || "";
  document.getElementById("codex-add-npc-home").value = npc.Home_ID_Ref || "";
  document.getElementById("codex-add-npc-lore").value = npc.Lore || "";

  openEditorModal();
}

function openAddPoiEditor(options = {}) {
  codexEditorState = { mode: "poi", recordType: "", recordId: "" };
  setEditorMode("poi");
  document.getElementById("codex-add-poi-form")?.reset();
  populatePoiTypeOptions("codex-add-poi-type", options.poiTypeValue || "");
  populatePoiNotorietyOptions("codex-add-poi-notoriety", options.notorietyValue || "");
  populatePoiRegionOptions();
  populatePoiHexOptions(options.regionId || "");
  populatePoiGroupOptions(options.parentGroupId || "");
  populatePoiInitialChildOptions(options.initialChildPoiId || "");

  const regionSelect = document.getElementById("codex-add-poi-region");
  const hexSelect = document.getElementById("codex-add-poi-hex");
  const groupCheckbox = document.getElementById("codex-add-poi-is-group");
  const parentSelect = document.getElementById("codex-add-poi-parent-group");
  const initialChildSelect = document.getElementById("codex-add-poi-initial-child");

  if (groupCheckbox) {
    groupCheckbox.checked = options.createGroup === true;
    groupCheckbox.disabled = options.lockCreateGroup === true;
    groupCheckbox.dataset.locked = options.lockCreateGroup === true ? "true" : "false";
  }

  if (parentSelect) {
    parentSelect.value = options.parentGroupId || "";
    parentSelect.disabled = options.lockParentGroup === true;
  }

  if (initialChildSelect) {
    initialChildSelect.value = options.initialChildPoiId || "";
  }

  if (regionSelect) {
    regionSelect.value = options.regionId || "";
    regionSelect.dataset.locked = options.lockRegion === true ? "true" : "false";
    regionSelect.disabled = options.lockRegion === true;
  }

  if (hexSelect) {
    hexSelect.value = options.hexId || "";
    hexSelect.dataset.locked = options.lockHex === true ? "true" : "false";
    hexSelect.disabled = options.lockHex === true || !options.regionId;
  }

  writePoiIconInputValue("codex-add-poi-icon", options.iconValue || "");
  writePoiTagInputValues("codex-add-poi-tags", options.tagValues || []);
  renderPoiIconSelectionSummary("codex-add-poi-icon");
  renderPoiTagSelectionSummary("codex-add-poi-tags");
  updatePoiGroupMode();
  updatePoiPopulationRequirement();
  openEditorModal();
}

function openEditPoiEditor(poiId) {
  const poi = db?.poisById?.[poiId];
  if (!poi) return;

  codexEditorState = { mode: "edit-poi", recordType: "poi", recordId: poiId };
  setEditorMode("edit-poi");
  document.getElementById("codex-add-poi-form")?.reset();

  const hex = poi.Hex_ID_Ref ? db?.hexesById?.[poi.Hex_ID_Ref] : null;
  const regionId = hex?.Region_ID_Ref || "";

  populatePoiRegionOptions();
  populatePoiHexOptions(regionId);
  populatePoiGroupOptions(poi.POI_Group_ID || "");
  populatePoiInitialChildOptions();
  populatePoiTypeOptions("codex-add-poi-type", poi.POI_Type_Value || poi.POI_Type || "");
  populatePoiNotorietyOptions("codex-add-poi-notoriety", poi["Notoriety Tier_Value"] || poi["Notoriety Tier"] || "");

  const groupCheckbox = document.getElementById("codex-add-poi-is-group");
  if (groupCheckbox) {
    groupCheckbox.checked = false;
    groupCheckbox.disabled = true;
    groupCheckbox.dataset.locked = "true";
  }

  const parentSelect = document.getElementById("codex-add-poi-parent-group");
  if (parentSelect) {
    parentSelect.value = poi.POI_Group_ID || "";
    parentSelect.disabled = false;
  }

  const regionSelect = document.getElementById("codex-add-poi-region");
  if (regionSelect) {
    regionSelect.value = regionId;
    regionSelect.dataset.locked = "false";
    regionSelect.disabled = false;
  }

  const hexSelect = document.getElementById("codex-add-poi-hex");
  if (hexSelect) {
    hexSelect.value = poi.Hex_ID_Ref || "";
    hexSelect.dataset.locked = "false";
    hexSelect.disabled = !regionId;
  }

  document.getElementById("codex-add-poi-name").value = poi.Name || "";
  document.getElementById("codex-add-poi-population").value = poi.Population || "";
  writePoiIconInputValue("codex-add-poi-icon", getPoiIconValueForRecord(poi));
  writePoiTagInputValues("codex-add-poi-tags", getPoiTagValuesForRecord(poi));
  renderPoiIconSelectionSummary("codex-add-poi-icon");
  renderPoiTagSelectionSummary("codex-add-poi-tags");
  document.getElementById("codex-add-poi-lore").value = poi.Lore || "";

  updatePoiGroupMode();
  updatePoiPopulationRequirement();
  openEditorModal();
}

function renderPoiGroupChildManager(groupId) {
  const list = document.getElementById("codex-edit-poi-group-child-list");
  if (!list) return;

  const workingIds = codexEditorState.workingChildIds || [];
  const children = workingIds
    .map(poiId => db?.poisById?.[poiId])
    .filter(Boolean);

  if (!children.length) {
    list.innerHTML = `<p>No child Areas currently assigned.</p>`;
  } else {
    list.innerHTML = children.map(poi => `
      <div class="codex-editor-child-row">
        <span>${escapeHtml(poi.Name || poi.POI_ID)}</span>
        <button type="button" data-detach-poi-id="${escapeHtml(poi.POI_ID)}">Detach</button>
      </div>
    `).join("");
  }

  populatePoiGroupChildAddOptions(groupId);
}

function openEditPoiGroupEditor(groupId) {
  const group = db?.poiGroupsById?.[groupId];
  if (!group) return;

  const childIds = getPoisForGroup(groupId).map(poi => poi.POI_ID);
  codexEditorState = {
    mode: "edit-poi-group",
    recordType: "poi-group",
    recordId: groupId,
    originalChildIds: childIds,
    workingChildIds: [...childIds]
  };
  setEditorMode("edit-poi-group");
  document.getElementById("codex-edit-poi-group-form")?.reset();

  document.getElementById("codex-edit-poi-group-name").value = group.POI_Group_Name || "";
  populatePoiTypeOptions("codex-edit-poi-group-type", group.Group_Type_Value || group.Group_Type || "", "Select a group type...");
  document.getElementById("codex-edit-poi-group-population").value = group.Population || "";
  writePoiIconInputValue("codex-edit-poi-group-icon", getPoiIconValueForRecord(group));
  writePoiTagInputValues("codex-edit-poi-group-tags", getPoiTagValuesForRecord(group));
  renderPoiIconSelectionSummary("codex-edit-poi-group-icon");
  renderPoiTagSelectionSummary("codex-edit-poi-group-tags");
  document.getElementById("codex-edit-poi-group-lore").value = group.Lore || "";

  renderPoiGroupChildManager(groupId);
  openEditorModal();
}

function openPoiTagsEditor(recordType, recordId) {
  const isGroup = recordType === "poi-group";
  const record = isGroup
    ? db?.poiGroupsById?.[recordId]
    : db?.poisById?.[recordId];

  if (!record) return;

  codexEditorState = { mode: "edit-tags", recordType, recordId };
  setEditorMode("edit-tags");
  document.getElementById("codex-edit-tags-form")?.reset();

  const recordName = isGroup
    ? record.POI_Group_Name || record.POI_Group_ID || "Unnamed Grouped POI"
    : record.Name || record.POI_ID || "Unnamed POI";
  const recordTypeLabel = isGroup
    ? record.Group_Type || "Grouped POI"
    : record.POI_Type || "POI";
  const notorietyLabel = isGroup
    ? ""
    : (record["Notoriety Tier"] ? `Notoriety ${record["Notoriety Tier"]}` : "");
  const metaLabel = [recordTypeLabel, notorietyLabel].filter(Boolean).join(" • ");

  const nameEl = document.getElementById("codex-edit-tags-record-name");
  const metaEl = document.getElementById("codex-edit-tags-record-meta");
  if (nameEl) nameEl.textContent = recordName;
  if (metaEl) metaEl.textContent = metaLabel;

  renderPoiTagPicker("codex-edit-tags-values", "codex-edit-tags-picker", getPoiTagValuesForRecord(record));
  openEditorModal();
}

function openAddRegionEditor(options = {}) {
  const regionType = options.regionType === "political" ? "political" : "geographic";
  codexEditorState = {
    mode: options.quick === true ? "quick-region" : "region",
    recordType: "region",
    recordId: "",
    originalChildIds: [],
    workingChildIds: [],
    quickRegion: options.quick === true,
    onCreated: typeof options.onCreated === "function" ? options.onCreated : null
  };
  setEditorMode(codexEditorState.mode);
  if (options.quick === true) {
    const title = document.getElementById("codex-editor-title");
    if (title) title.textContent = regionType === "political" ? "Name Pol Region" : "Name Geo Region";
  }
  document.getElementById("codex-edit-region-form")?.reset();
  syncRegionEditorMode({
    regionType,
    lockType: options.lockType === true || options.quick === true,
    borderColor: options.borderColor || "#ffd84d"
  });
  openEditorModal();
  document.getElementById("codex-edit-region-name")?.focus();
}

function openEditRegionEditor(regionId) {
  const region = db?.regionsById?.[regionId];
  if (!region) return;

  codexEditorState = { mode: "edit-region", recordType: "region", recordId: regionId };
  setEditorMode("edit-region");
  document.getElementById("codex-edit-region-form")?.reset();
  syncRegionEditorMode({ regionType: region.Region_ID === "REG-0000" ? "geographic" : region.Region_Type || "geographic" });
  const typeSelect = document.getElementById("codex-edit-region-type");
  if (typeSelect) {
    typeSelect.value = region.Region_ID === "REG-0000" ? "geographic" : region.Region_Type || "geographic";
    typeSelect.disabled = region.Region_ID === "REG-0000";
  }
  const borderColorSelect = document.getElementById("codex-edit-region-border-color");
  if (borderColorSelect) {
    borderColorSelect.value = getEditableRegionColorValue(region);
    borderColorSelect.disabled = region.Region_ID === "REG-0000";
    window.syncColorPickerControl?.(borderColorSelect);
  }
  document.getElementById("codex-edit-region-lore").value = region.Lore || "";
  openEditorModal();
}

function getMapManagerRows(ownerType, ownerId) {
  if (!ownerType || !ownerId || typeof getMapsForOwner !== "function") return [];
  return getMapsForOwner(ownerType, ownerId) || [];
}

function getMapManagerMap(mapId) {
  return (db?.raw?.maps || []).find(map => map.Map_ID === mapId) || null;
}

function renderMapManagerList() {
  const list = document.getElementById("codex-map-manager-list");
  if (!list) return;

  const maps = getMapManagerRows(codexEditorState.ownerType, codexEditorState.ownerId);
  const isAddMode = codexEditorState.mode === "add-map";
  const addMapHtml = `
    <div class="codex-map-manager-row codex-map-manager-add-row">
      <div class="codex-map-manager-copy">
        <strong>Add Map</strong>
        <small>Add a new map to this page.</small>
      </div>
      <label>
        <span>Map Name *</span>
        <input type="text" id="codex-map-add-name">
      </label>
      <label class="codex-map-manager-file">
        <span>Map File *</span>
        <input id="codex-map-add-file" type="file" accept="image/png,image/jpeg,image/webp">
        <small>PNG, JPG, or WebP. Max 10 MB.</small>
      </label>
      <div class="codex-map-manager-actions">
        <button type="button" data-add-map="true">Add Map</button>
      </div>
    </div>
  `;

  if (isAddMode) {
    list.innerHTML = addMapHtml;
    return;
  }

  if (!maps.length) {
    list.innerHTML = `<p>No maps recorded for this page.</p>`;
    return;
  }

  list.innerHTML = maps.map(map => {
    const mapId = map.Map_ID || "";
    const inputId = `codex-map-file-${mapId.replace(/[^a-z0-9_-]/gi, "-")}`;
    const typeLabel = map.Map_Mime_Type || "";

    return `
      <div class="codex-map-manager-row">
        <div class="codex-map-manager-copy">
          <strong>${escapeHtml(map.Map_Name || mapId || "Untitled Map")}</strong>
          ${typeLabel ? `<small>${escapeHtml(typeLabel)}</small>` : ""}
        </div>
        <label>
          <span>Map Name</span>
          <input type="text" value="${escapeHtml(map.Map_Name || "")}" data-map-name-id="${escapeHtml(mapId)}">
        </label>
        <label class="codex-map-manager-file">
          <span>Replacement File</span>
          <input id="${escapeHtml(inputId)}" type="file" accept="image/png,image/jpeg,image/webp" data-map-file-id="${escapeHtml(mapId)}">
          <small>PNG, JPG, or WebP. Max 10 MB.</small>
        </label>
        <div class="codex-map-manager-actions">
          <button type="button" data-save-map-id="${escapeHtml(mapId)}">Save Name</button>
          <button type="button" data-replace-map-id="${escapeHtml(mapId)}">Replace File</button>
          <button type="button" class="codex-map-manager-remove" data-remove-map-id="${escapeHtml(mapId)}">Remove</button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddMapEditor(ownerType, ownerId) {
  codexEditorState = {
    mode: "add-map",
    recordType: "map",
    recordId: "",
    ownerType,
    ownerId
  };
  setEditorMode("add-map");
  renderMapManagerList();
  openEditorModal();
}

function openManageMapsEditor(ownerType, ownerId) {
  codexEditorState = {
    mode: "manage-maps",
    recordType: "map",
    recordId: "",
    ownerType,
    ownerId
  };
  setEditorMode("manage-maps");
  renderMapManagerList();
  openEditorModal();
}

function openEditCurrentCodexRecord() {
  const currentPage = getCurrentCodexPage?.();
  if (currentPage?.type === "region") {
    openEditRegionEditor(currentPage.id);
  } else if (currentPage?.type === "npc") {
    openEditNpcEditor(currentPage.id);
  } else if (currentPage?.type === "poi") {
    openEditPoiEditor(currentPage.id);
  } else if (currentPage?.type === "poi-group") {
    openEditPoiGroupEditor(currentPage.id);
  }
}

function closeCodexEditor() {
  const npcHome = document.getElementById("codex-add-npc-home");
  const poiRegion = document.getElementById("codex-add-poi-region");
  const poiHex = document.getElementById("codex-add-poi-hex");
  const poiGroupCheckbox = document.getElementById("codex-add-poi-is-group");
  const poiParentGroup = document.getElementById("codex-add-poi-parent-group");
  const poiInitialChild = document.getElementById("codex-add-poi-initial-child");

  if (npcHome) npcHome.disabled = false;
  if (poiRegion) poiRegion.disabled = false;
  if (poiHex) poiHex.disabled = false;
  if (poiGroupCheckbox) poiGroupCheckbox.disabled = false;
  if (poiParentGroup) poiParentGroup.disabled = false;
  if (poiInitialChild) poiInitialChild.disabled = false;
  closeCodexEditorPicker({ commit: true });
  codexEditorState = {
    mode: "",
    recordType: "",
    recordId: "",
    originalChildIds: [],
    workingChildIds: [],
    quickRegion: false,
    onCreated: null
  };

  document.getElementById("codex-editor-modal")?.classList.add("hidden");
  document.getElementById("codex-editor-modal")?.setAttribute("aria-hidden", "true");
}

function setCodexDeleteStatus(message = "") {
  const status = document.getElementById("codex-delete-status");
  if (status) {
    status.textContent = message;
  }
}

function closeCodexDeleteModal() {
  document.getElementById("codex-delete-modal")?.classList.add("hidden");
  document.getElementById("codex-delete-modal")?.setAttribute("aria-hidden", "true");
  setCodexDeleteStatus("");
}

const CODEX_DETAIL_RECORDS = {
  region: {
    rpcType: "region",
    indexType: "regions",
    collection: "regions",
    byId: "regionsById",
    idKey: "Region_ID",
    label: "Region",
    getName: record => record?.Region_Name || record?.Region_ID
  },
  poi: {
    rpcType: "poi",
    indexType: "pois",
    collection: "pois",
    byId: "poisById",
    idKey: "POI_ID",
    label: "POI",
    getName: record => record?.Name || record?.POI_ID
  },
  "poi-group": {
    rpcType: "poi_group",
    indexType: "pois",
    collection: "poiGroups",
    byId: "poiGroupsById",
    idKey: "POI_Group_ID",
    label: "POI Group",
    getName: record => record?.POI_Group_Name || record?.POI_Group_ID
  },
  npc: {
    rpcType: "npc",
    indexType: "npcs",
    collection: "npcs",
    byId: "npcsById",
    idKey: "NPC_ID",
    label: "NPC",
    getName: record => record?.Name || record?.NPC_ID
  }
};

function getCurrentDetailDeleteTarget() {
  const page = getCurrentCodexPage?.();
  const config = page ? CODEX_DETAIL_RECORDS[page.type] : null;
  if (!page || !config || !page.id) return null;
  if (!canDeleteCurrentDetailPage(page)) return null;

  const record = db?.[config.byId]?.[page.id];
  if (!record) return null;

  return {
    ...config,
    pageType: page.type,
    legacyId: page.id,
    uuid: record.__uuid,
    name: config.getName(record),
    record
  };
}

function openDeleteRecordModal() {
  const target = getCurrentDetailDeleteTarget();
  const modal = document.getElementById("codex-delete-modal");
  const message = document.getElementById("codex-delete-message");
  const confirmButton = document.getElementById("codex-delete-confirm");

  if (!modal || !message || !confirmButton) return;

  setCodexDeleteStatus("");
  confirmButton.disabled = false;

  if (!target?.uuid) {
    message.textContent = "This record cannot be deleted yet because it is missing its database ID. Refresh the app and try again.";
    confirmButton.hidden = true;
  } else {
    message.textContent = `Delete ${target.label}: ${target.name}? This cannot be undone.`;
    confirmButton.hidden = false;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function removeRecordFromLocalDb(target) {
  if (!target || !db?.raw?.[target.collection]) return;

  const idKey = target.idKey;
  const legacyId = target.legacyId;

  db.raw[target.collection] = db.raw[target.collection]
    .filter(record => record?.[idKey] !== legacyId);

  if (db[target.byId]) {
    delete db[target.byId][legacyId];
  }

  if (target.pageType === "poi") {
    Object.keys(db.poisByHexId || {}).forEach(key => {
      db.poisByHexId[key] = db.poisByHexId[key].filter(record => record.POI_ID !== legacyId);
    });
    Object.keys(db.poisByGroupId || {}).forEach(key => {
      db.poisByGroupId[key] = db.poisByGroupId[key].filter(record => record.POI_ID !== legacyId);
    });
  }

  if (target.pageType === "npc") {
    Object.keys(db.npcsByHomeId || {}).forEach(key => {
      db.npcsByHomeId[key] = db.npcsByHomeId[key].filter(record => record.NPC_ID !== legacyId);
    });
  }

  if (target.pageType === "region") {
    Object.values(db.hexesById || {}).forEach(hex => {
      if (hex.Region_ID_Ref === legacyId) hex.Region_ID_Ref = target.record?.Region_Type === "political" ? "" : "REG-0000";
      if (hex.Political_Region_ID_Ref === legacyId) hex.Political_Region_ID_Ref = "";
    });
  }

  if (target.pageType === "poi-group") {
    Object.values(db.poisById || {}).forEach(poi => {
      if (poi.POI_Group_ID === legacyId) poi.POI_Group_ID = "";
    });
  }

  db.mapsByOwnerKey = groupMapsByOwner?.(db.raw.maps || []) || db.mapsByOwnerKey;
}

async function confirmDeleteRecord() {
  const campaign = getActiveCampaign?.();
  const target = getCurrentDetailDeleteTarget();
  const confirmButton = document.getElementById("codex-delete-confirm");

  if (!campaign || !target?.uuid) return;

  setCodexDeleteStatus("Deleting...");
  if (confirmButton) confirmButton.disabled = true;

  try {
    const { error } = await campaignSupabase.rpc("delete_campaign_record", {
      target_campaign_id: campaign.id,
      target_record_type: target.rpcType,
      target_record_id: target.uuid
    });

    if (error) throw error;

    removeRecordFromLocalDb(target);
    if (target.pageType === "poi") {
      refreshGeneratedMapPoiLayer();
    } else if (target.pageType === "region") {
      refreshGeneratedMapRegionLayer();
    }
    closeCodexDeleteModal();

    popCodexHistory?.();
    const returnPage = getCurrentCodexPage?.();

    if (returnPage) {
      renderCodexPage(returnPage.type, returnPage.id);
    } else {
      pushCodexHistory?.(target.indexType, null);
      renderCodexPage(target.indexType, null);
    }

    fitCodexHeaderText?.();
    updateCodexBackButton?.();
  } catch (error) {
    console.error("Failed to delete record:", error);
    const message = String(error.message || "");
    const permissionDenied = /permission|not allowed|not authorized|forbidden/i.test(message);
    setCodexDeleteStatus(permissionDenied
      ? "You do not have permission to delete this record."
      : message || "Unable to delete this record.");
    if (confirmButton) confirmButton.disabled = false;
  }
}

function getPoiUuidByLegacyId(poiId) {
  const poi = (db?.raw?.pois || []).find(row => row.POI_ID === poiId);
  return poi?.__uuid || null;
}

function getHexUuidByLegacyId(hexId) {
  const hex = (db?.raw?.hexes || []).find(row => row.Hex_ID === hexId);
  return hex?.__uuid || null;
}

const CODEX_IMAGE_UPLOAD_BUCKET = "campaign-assets";
const CODEX_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const CODEX_IMAGE_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp"
]);
const CODEX_MAP_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const CODEX_MAP_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

function getEditorImageFile(inputId) {
  return document.getElementById(inputId)?.files?.[0] || null;
}

function validateCodexImageUpload(file) {
  if (!file) return;

  if (!CODEX_IMAGE_UPLOAD_TYPES.has(file.type)) {
    throw new Error("Image must be a PNG, JPG, or WebP file.");
  }

  if (file.size > CODEX_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }
}

function getSafeUploadFileName(file) {
  return "image";
}

function getImageUploadRecordFolder(recordType) {
  switch (recordType) {
    case "npc": return "npcs";
    case "poi": return "pois";
    case "poi_group": return "poi-groups";
    case "region": return "regions";
    default: return "records";
  }
}

async function uploadAndAttachRecordImage({ campaign, recordType, recordUuid, legacyId, file }) {
  if (!file) return "";

  validateCodexImageUpload(file);

  if (!campaign?.id || !recordType || !recordUuid || !legacyId) {
    throw new Error("Unable to identify the record for image upload.");
  }

  const folder = getImageUploadRecordFolder(recordType);
  const safeFileName = getSafeUploadFileName(file);
  const storagePath = [
    campaign.id,
    "records",
    folder,
    legacyId,
    safeFileName
  ].join("/");

  const { error: uploadError } = await campaignSupabase
    .storage
    .from(CODEX_IMAGE_UPLOAD_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { error: attachError } = await campaignSupabase.rpc("attach_record_image_asset", {
    target_campaign_id: campaign.id,
    target_record_type: recordType,
    target_record_id: recordUuid,
    asset_bucket: CODEX_IMAGE_UPLOAD_BUCKET,
    asset_path: storagePath,
    asset_mime_type: file.type
  });

  if (attachError) throw attachError;

  const { data: signedData, error: signedError } = await campaignSupabase
    .storage
    .from(CODEX_IMAGE_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (signedError) throw signedError;

  return signedData?.signedUrl || "";
}

function validateCodexMapUpload(file) {
  if (!file) {
    throw new Error("Choose a map file first.");
  }

  if (!CODEX_MAP_UPLOAD_TYPES.has(file.type)) {
    throw new Error("Map file must be PNG, JPG, or WebP.");
  }

  if (file.size > CODEX_MAP_UPLOAD_MAX_BYTES) {
    throw new Error("Map file must be 10 MB or smaller.");
  }
}

async function uploadAndAttachMapFile({ campaign, map, file }) {
  validateCodexMapUpload(file);

  if (!campaign?.id || !map?.__uuid || !map?.Map_ID) {
    throw new Error("Unable to identify this map. Refresh the app and try again.");
  }

  const storagePath = [campaign.id, "maps", map.Map_ID, "file"].join("/");

  const { error: uploadError } = await campaignSupabase
    .storage
    .from(CODEX_IMAGE_UPLOAD_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { error: attachError } = await campaignSupabase.rpc("attach_record_image_asset", {
    target_campaign_id: campaign.id,
    target_record_type: "map",
    target_record_id: map.__uuid,
    asset_bucket: CODEX_IMAGE_UPLOAD_BUCKET,
    asset_path: storagePath,
    asset_mime_type: file.type
  });

  if (attachError) throw attachError;

  const { data: signedData, error: signedError } = await campaignSupabase
    .storage
    .from(CODEX_IMAGE_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (signedError) throw signedError;

  const signedUrl = signedData?.signedUrl || "";
  map.Map_File_URL = signedUrl;
  map.Map_Mime_Type = file.type;
  map.Image = file.type.startsWith("image/") ? signedUrl : "";

  return signedUrl;
}

function getMapOwnerUuid(ownerType, ownerId) {
  switch (ownerType) {
    case "region": return db?.regionsById?.[ownerId]?.__uuid || null;
    case "hex": return db?.hexesById?.[ownerId]?.__uuid || null;
    case "poi": return db?.poisById?.[ownerId]?.__uuid || null;
    case "poi-group": return db?.poiGroupsById?.[ownerId]?.__uuid || null;
    default: return null;
  }
}

function getJournalSourceUuid(sourceType, sourceId) {
  switch (sourceType) {
    case "region": return db?.regionsById?.[sourceId]?.__uuid || null;
    case "hex": return db?.hexesById?.[sourceId]?.__uuid || null;
    case "poi": return db?.poisById?.[sourceId]?.__uuid || null;
    case "poi_group": return db?.poiGroupsById?.[sourceId]?.__uuid || null;
    case "npc": return db?.npcsById?.[sourceId]?.__uuid || null;
    case "map": return db?.mapsById?.[sourceId]?.__uuid || null;
    default: return null;
  }
}

function openAddJournalEditor(sourceType, sourceId) {
  const sourceUuid = getJournalSourceUuid(sourceType, sourceId);
  if (!sourceUuid) return;

  codexEditorState = {
    mode: "add-journal",
    recordType: "dm_journal",
    recordId: "",
    sourceType,
    sourceId,
    sourceUuid
  };
  setEditorMode("add-journal");
  document.getElementById("codex-add-journal-form")?.reset();
  openEditorModal();
}

function adaptCreatedJournalRow(row) {
  const createdRow = Array.isArray(row) ? row[0] : row;

  return {
    __uuid: createdRow.id,
    Entry_ID: createdRow.ref_code,
    Entry_Title: createdRow.entry_title || "",
    Entry_Body: createdRow.entry_body || "",
    Entry_Type: createdRow.entry_type || "",
    Source_Type: createdRow.source_type || codexEditorState.sourceType || "",
    Source_ID: codexEditorState.sourceId || "",
    Timestamp: createdRow.occurred_at || "",
    Created_By: createdRow.created_by_user_id || "",
    Created_By_Username: getActiveCampaignProfile?.()?.username || "",
    Session_ID: "",
    Visibility: createdRow.visibility || "dm"
  };
}

function getRecordForJournalSource(sourceType, sourceId) {
  switch (sourceType) {
    case "region": return db?.regionsById?.[sourceId] || null;
    case "hex": return db?.hexesById?.[sourceId] || null;
    case "poi": return db?.poisById?.[sourceId] || null;
    case "poi_group": return db?.poiGroupsById?.[sourceId] || null;
    case "npc": return db?.npcsById?.[sourceId] || null;
    case "map": return db?.mapsById?.[sourceId] || null;
    default: return null;
  }
}

function addJournalEntryToLocalDb(entry) {
  if (!db?.raw?.dmJournal || !entry) return;

  db.raw.dmJournal.push(entry);
  if (db.dmJournalById && entry.Entry_ID) db.dmJournalById[entry.Entry_ID] = entry;

  const key = getJournalSourceKey?.(entry.Source_Type, entry.Source_ID);
  if (key && db.dmJournalBySourceKey) {
    if (!db.dmJournalBySourceKey[key]) db.dmJournalBySourceKey[key] = [];
    db.dmJournalBySourceKey[key].unshift(entry);
  }

  const record = getRecordForJournalSource(entry.Source_Type, entry.Source_ID);
  if (record) {
    record.DM_Journal_Entries = sortJournalEntries?.([entry, ...(record.DM_Journal_Entries || [])]) || [entry, ...(record.DM_Journal_Entries || [])];
    record.DM_Journal = formatJournalEntriesText?.(record.DM_Journal_Entries) || "";
  }
}

function removeJournalEntryFromLocalDb(entry) {
  if (!entry) return;

  if (db?.raw?.dmJournal) {
    db.raw.dmJournal = db.raw.dmJournal.filter(row => row.Entry_ID !== entry.Entry_ID);
  }

  if (db?.dmJournalById && entry.Entry_ID) {
    delete db.dmJournalById[entry.Entry_ID];
  }

  const key = getJournalSourceKey?.(entry.Source_Type, entry.Source_ID);
  if (key && db?.dmJournalBySourceKey?.[key]) {
    db.dmJournalBySourceKey[key] = db.dmJournalBySourceKey[key]
      .filter(row => row.Entry_ID !== entry.Entry_ID);
  }

  const record = getRecordForJournalSource(entry.Source_Type, entry.Source_ID);
  if (record) {
    record.DM_Journal_Entries = (record.DM_Journal_Entries || [])
      .filter(row => row.Entry_ID !== entry.Entry_ID);
    record.DM_Journal = formatJournalEntriesText?.(record.DM_Journal_Entries) || "";
  }
}

function setJournalEntryStatus(message = "") {
  const status = document.getElementById("codex-journal-entry-status");
  if (status) status.textContent = message;
}

function closeJournalEntryModal() {
  document.getElementById("codex-journal-entry-modal")?.classList.add("hidden");
  document.getElementById("codex-journal-entry-modal")?.setAttribute("aria-hidden", "true");
  setJournalEntryStatus("");
}

function openJournalEntryModal(entryId) {
  const entry = db?.dmJournalById?.[entryId];
  const modal = document.getElementById("codex-journal-entry-modal");
  const title = document.getElementById("codex-journal-entry-title");
  const meta = document.getElementById("codex-journal-entry-meta");
  const body = document.getElementById("codex-journal-entry-body");
  const deleteButton = document.getElementById("codex-journal-entry-delete");

  if (!entry || !modal || !title || !meta || !body || !deleteButton) return;

  title.textContent = entry.Entry_Title || "Journal Entry";
  meta.textContent = [
    formatJournalTimestamp?.(entry.Timestamp) || entry.Timestamp || "",
    entry.Created_By_Username ? `by ${entry.Created_By_Username}` : ""
  ].filter(Boolean).join(" • ");
  body.textContent = entry.Entry_Body || "";
  deleteButton.dataset.entryId = entry.Entry_ID;
  const currentUserId = getActiveCampaignSession?.()?.user?.id || "";
  const currentRole = getActiveCampaign?.()?.currentUserRole || "";
  deleteButton.hidden = !(entry.Created_By === currentUserId || currentRole === "owner");
  deleteButton.disabled = false;
  setJournalEntryStatus("");

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

async function deleteOpenJournalEntry() {
  const campaign = getActiveCampaign?.();
  const button = document.getElementById("codex-journal-entry-delete");
  const entryId = button?.dataset.entryId || "";
  const entry = db?.dmJournalById?.[entryId];

  if (!campaign || !entry?.__uuid) return;
  if (!await showCodexEditorConfirm("Delete this journal entry? This cannot be undone.", {
    title: "Delete Journal Entry?",
    confirmLabel: "Delete",
    tone: "danger"
  })) return;

  setJournalEntryStatus("Deleting...");
  button.disabled = true;

  try {
    const { error } = await campaignSupabase.rpc("delete_dm_journal_entry", {
      target_campaign_id: campaign.id,
      target_entry_id: entry.__uuid
    });

    if (error) throw error;

    removeJournalEntryFromLocalDb(entry);
    closeJournalEntryModal();
    refreshCodexAfterCreatedRecord("journal");
  } catch (error) {
    console.error("Failed to delete journal entry:", error);
    const message = String(error.message || "");
    const permissionDenied = /permission|not allowed|not authorized|forbidden/i.test(message);
    setJournalEntryStatus(permissionDenied
      ? "You do not have permission to delete this journal entry."
      : message || "Unable to delete journal entry.");
    button.disabled = false;
  }
}

async function handleAddJournalSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  const entryTitle = document.getElementById("codex-add-journal-title")?.value.trim();
  const body = document.getElementById("codex-add-journal-body")?.value.trim();

  if (!campaign || codexEditorState.mode !== "add-journal") return;
  if (!entryTitle) {
    setCodexEditorStatus("Journal title is required.");
    return;
  }
  if (!body) {
    setCodexEditorStatus("Journal entry text is required.");
    return;
  }

  setCodexEditorStatus("Adding journal entry...");

  try {
    const { data, error } = await campaignSupabase.rpc("create_dm_journal_entry", {
      target_campaign_id: campaign.id,
      journal_source_type: codexEditorState.sourceType,
      journal_source_id: codexEditorState.sourceUuid,
      journal_title: entryTitle,
      journal_body: body,
      journal_entry_type: null,
      journal_session_id: null
    });

    if (error) throw error;

    addJournalEntryToLocalDb(adaptCreatedJournalRow(data));
    closeCodexEditor();
    refreshCodexAfterCreatedRecord("journal");
  } catch (error) {
    console.error("Failed to add journal entry:", error);
    setCodexEditorStatus(error.message || "Unable to add journal entry.");
  }
}

function adaptCreatedMapRow(row, ownerType, ownerId) {
  const createdRow = Array.isArray(row) ? row[0] : row;

  return {
    __uuid: createdRow.id,
    Map_ID: createdRow.ref_code,
    Owner_Type: ownerType,
    Owner_ID_Ref: ownerId,
    Map_Name: createdRow.name || "",
    Map_Type: createdRow.map_type || "",
    Image: "",
    Map_File_URL: "",
    Map_Mime_Type: "",
    Sort_Order: createdRow.sort_order == null ? "" : String(createdRow.sort_order),
    Lore: createdRow.lore || ""
  };
}

function rebuildMapsIndexes() {
  if (!db) return;
  db.mapsById = indexById?.(db.raw.maps || [], "Map_ID") || db.mapsById;
  db.mapsByOwnerKey = groupMapsByOwner?.(db.raw.maps || []) || db.mapsByOwnerKey;
}

function addMapToLocalDb(map) {
  if (!db?.raw?.maps || !map?.Map_ID) return;
  db.raw.maps.push(map);
  rebuildMapsIndexes();
}

function removeMapFromLocalDb(mapId) {
  if (!db?.raw?.maps || !mapId) return;
  db.raw.maps = db.raw.maps.filter(map => map.Map_ID !== mapId);
  rebuildMapsIndexes();
}

async function addManagedMap() {
  const campaign = getActiveCampaign?.();
  const ownerType = codexEditorState.ownerType;
  const ownerId = codexEditorState.ownerId;
  const ownerUuid = getMapOwnerUuid(ownerType, ownerId);
  const name = document.getElementById("codex-map-add-name")?.value.trim();
  const file = document.getElementById("codex-map-add-file")?.files?.[0] || null;

  if (!campaign || !ownerUuid) {
    throw new Error("Unable to identify where this map belongs. Refresh the app and try again.");
  }

  if (!name) {
    throw new Error("Map name is required.");
  }

  validateCodexMapUpload(file);

  const { data, error } = await campaignSupabase.rpc("create_campaign_map", {
    target_campaign_id: campaign.id,
    target_owner_type: ownerType,
    target_owner_id: ownerUuid,
    map_name: name,
    new_map_type: null
  });

  if (error) throw error;

  const createdMap = adaptCreatedMapRow(data, ownerType, ownerId);
  addMapToLocalDb(createdMap);
  await uploadAndAttachMapFile({ campaign, map: createdMap, file });
}

async function saveManagedMapName(map) {
  const campaign = getActiveCampaign?.();
  const nameInput = document.querySelector(`[data-map-name-id="${CSS.escape(map.Map_ID)}"]`);
  const name = nameInput?.value.trim();

  if (!campaign || !map?.__uuid) return;
  if (!name) throw new Error("Map name is required.");

  const { data, error } = await campaignSupabase.rpc("update_campaign_map", {
    target_campaign_id: campaign.id,
    target_map_id: map.__uuid,
    map_name: name
  });

  if (error) throw error;

  const updated = Array.isArray(data) ? data[0] : data;
  map.Map_Name = updated?.name || name;
}

async function removeManagedMap(map) {
  const campaign = getActiveCampaign?.();
  if (!campaign || !map?.__uuid) return;

  const confirmed = await showCodexEditorConfirm(`Remove map "${map.Map_Name || map.Map_ID}"? This cannot be undone.`, {
    title: "Remove Map?",
    confirmLabel: "Remove",
    tone: "danger"
  });
  if (!confirmed) return;

  const { error } = await campaignSupabase.rpc("delete_campaign_map", {
    target_campaign_id: campaign.id,
    target_map_id: map.__uuid
  });

  if (error) throw error;

  removeMapFromLocalDb(map.Map_ID);
}

async function handleMapManagerClick(event) {
  const button = event.target.closest("[data-add-map], [data-save-map-id], [data-replace-map-id], [data-remove-map-id]");
  if (!button || !["add-map", "manage-maps"].includes(codexEditorState.mode)) return;

  const mapId = button.dataset.replaceMapId || button.dataset.saveMapId || button.dataset.removeMapId || "";
  const map = getMapManagerMap(mapId);
  const campaign = getActiveCampaign?.();

  if (!campaign) return;

  try {
    button.disabled = true;

    if (button.dataset.addMap) {
      setCodexEditorStatus("Adding map...");
      await addManagedMap();
      setCodexEditorStatus("Map added.");
    } else if (button.dataset.saveMapId) {
      if (!map) return;
      setCodexEditorStatus("Saving map name...");
      await saveManagedMapName(map);
      setCodexEditorStatus("Map name saved.");
    } else if (button.dataset.removeMapId) {
      if (!map) return;
      setCodexEditorStatus("Removing map...");
      await removeManagedMap(map);
      setCodexEditorStatus("Map removed.");
    } else {
      if (!map) return;
      const input = document.querySelector(`[data-map-file-id="${CSS.escape(mapId)}"]`);
      const file = input?.files?.[0] || null;
      validateCodexMapUpload(file);
      setCodexEditorStatus("Uploading map file...");
      await uploadAndAttachMapFile({ campaign, map, file });
      setCodexEditorStatus("Map file replaced.");
    }

    renderMapManagerList();
    refreshCodexAfterCreatedRecord("map");
  } catch (error) {
    console.error("Failed to manage map:", error);
    setCodexEditorStatus(error.message || "Unable to update map.");
  } finally {
    button.disabled = false;
  }
}

function showCodexEditorConfirm(message, options = {}) {
  return window.codexConfirm
    ? window.codexConfirm(message, options)
    : Promise.resolve(window.confirm?.(message) === true);
}

function adaptCreatedNpcRow(row) {
  const createdRow = Array.isArray(row) ? row[0] : row;

  return {
    __uuid: createdRow.id,
    NPC_ID: createdRow.ref_code,
    Home_ID_Ref: db?.raw?.pois?.find(poi => poi.__uuid === createdRow.home_poi_id)?.POI_ID || "",
    Title: createdRow.title || "",
    Name: createdRow.name || "",
    Organization: createdRow.organization || "",
    Race: createdRow.race || "",
    Occupation: createdRow.occupation || "",
    Lore: createdRow.lore || "",
    Image: ""
  };
}

function addCreatedNpcToLocalDb(npc) {
  db.raw.npcs.push(npc);
  db.npcsById[npc.NPC_ID] = npc;

  if (npc.Home_ID_Ref) {
    if (!db.npcsByHomeId[npc.Home_ID_Ref]) {
      db.npcsByHomeId[npc.Home_ID_Ref] = [];
    }
    db.npcsByHomeId[npc.Home_ID_Ref].push(npc);
  }
}

function updateNpcInLocalDb(npc, updates) {
  if (!npc) return;

  const oldHomeId = npc.Home_ID_Ref;
  Object.assign(npc, updates);

  if (oldHomeId !== npc.Home_ID_Ref) {
    if (oldHomeId && db.npcsByHomeId?.[oldHomeId]) {
      db.npcsByHomeId[oldHomeId] = db.npcsByHomeId[oldHomeId]
        .filter(record => record.NPC_ID !== npc.NPC_ID);
    }

    if (npc.Home_ID_Ref) {
      if (!db.npcsByHomeId[npc.Home_ID_Ref]) db.npcsByHomeId[npc.Home_ID_Ref] = [];
      if (!db.npcsByHomeId[npc.Home_ID_Ref].some(record => record.NPC_ID === npc.NPC_ID)) {
        db.npcsByHomeId[npc.Home_ID_Ref].push(npc);
      }
    }
  }
}

function adaptCreatedPoiGroupRow(row) {
  const createdRow = Array.isArray(row) ? row[0] : row;

  return {
    __uuid: createdRow.id,
    POI_Group_ID: createdRow.slug,
    POI_Group_Name: createdRow.name || "",
    Group_Type: window.CampaignPoiTypes?.getTypeLabel?.(createdRow.group_type) || createdRow.group_type || "",
    Group_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(createdRow.group_type) || createdRow.group_type || "",
    Group_Icon: getNormalizedPoiIconValue(createdRow.group_icon, { fallback: false }),
    Group_Tags: getNormalizedPoiTagValues(createdRow.group_tags),
    Generation_Source: createdRow.generation_source || "",
    Population: createdRow.population || "",
    Lore: createdRow.lore || "",
    Image: ""
  };
}

function addCreatedPoiGroupToLocalDb(group) {
  db.raw.poiGroups.push(group);
  db.poiGroupsById[group.POI_Group_ID] = group;
  if (!db.poisByGroupId[group.POI_Group_ID]) {
    db.poisByGroupId[group.POI_Group_ID] = [];
  }
}

function attachPoiToGroupInLocalDb(poiId, groupId) {
  const poi = db?.poisById?.[poiId];
  if (!poi || !groupId) return;

  if (poi.POI_Group_ID && db.poisByGroupId?.[poi.POI_Group_ID]) {
    db.poisByGroupId[poi.POI_Group_ID] = db.poisByGroupId[poi.POI_Group_ID]
      .filter(row => row.POI_ID !== poiId);
  }

  poi.POI_Group_ID = groupId;

  if (!db.poisByGroupId[groupId]) {
    db.poisByGroupId[groupId] = [];
  }

  if (!db.poisByGroupId[groupId].some(row => row.POI_ID === poiId)) {
    db.poisByGroupId[groupId].push(poi);
  }
}

function detachPoiFromGroupInLocalDb(poiId) {
  const poi = db?.poisById?.[poiId];
  if (!poi) return;

  const oldGroupId = poi.POI_Group_ID;
  if (oldGroupId && db.poisByGroupId?.[oldGroupId]) {
    db.poisByGroupId[oldGroupId] = db.poisByGroupId[oldGroupId]
      .filter(row => row.POI_ID !== poiId);
  }

  poi.POI_Group_ID = "";
}

function updatePoiInLocalDb(poi, updates) {
  if (!poi) return;

  const oldHexId = poi.Hex_ID_Ref;
  const oldGroupId = poi.POI_Group_ID;

  Object.assign(poi, updates);

  if (oldHexId !== poi.Hex_ID_Ref) {
    if (oldHexId && db.poisByHexId?.[oldHexId]) {
      db.poisByHexId[oldHexId] = db.poisByHexId[oldHexId]
        .filter(row => row.POI_ID !== poi.POI_ID);
    }

    if (poi.Hex_ID_Ref) {
      if (!db.poisByHexId[poi.Hex_ID_Ref]) db.poisByHexId[poi.Hex_ID_Ref] = [];
      if (!db.poisByHexId[poi.Hex_ID_Ref].some(row => row.POI_ID === poi.POI_ID)) {
        db.poisByHexId[poi.Hex_ID_Ref].push(poi);
      }
    }
  }

  if (oldGroupId !== poi.POI_Group_ID) {
    if (oldGroupId && db.poisByGroupId?.[oldGroupId]) {
      db.poisByGroupId[oldGroupId] = db.poisByGroupId[oldGroupId]
        .filter(row => row.POI_ID !== poi.POI_ID);
    }

    if (poi.POI_Group_ID) {
      if (!db.poisByGroupId[poi.POI_Group_ID]) db.poisByGroupId[poi.POI_Group_ID] = [];
      if (!db.poisByGroupId[poi.POI_Group_ID].some(row => row.POI_ID === poi.POI_ID)) {
        db.poisByGroupId[poi.POI_Group_ID].push(poi);
      }
    }
  }
}

function updatePoiGroupInLocalDb(group, updates) {
  if (!group) return;
  Object.assign(group, updates);
}

function updateRegionInLocalDb(region, updates) {
  if (!region) return;
  Object.assign(region, updates);
}

function adaptCreatedRegionRow(row) {
  const createdRow = Array.isArray(row) ? row[0] : row;
  return {
    __uuid: createdRow.id,
    Region_ID: createdRow.ref_code,
    Region_Name: createdRow.name || "",
    Region_Type: createdRow.region_type || "geographic",
    Border_Color: createdRow.ref_code === "REG-0000" ? "none" : createdRow.border_color || "#ffd84d",
    Lore: createdRow.lore || "",
    Image: ""
  };
}

function addCreatedRegionToLocalDb(region) {
  if (!region?.Region_ID) return;
  if (!db.raw.regions.some(existing => existing.Region_ID === region.Region_ID)) {
    db.raw.regions.push(region);
  }
  db.regionsById[region.Region_ID] = region;
}

function getEditableRegionColorValue(region) {
  const namedColors = {
    red: "#ff2d2d",
    blue: "#1f7cff",
    yellow: "#ffe600",
    green: "#39ff14",
    orange: "#ff8a00",
    purple: "#bf4dff",
    black: "#070707",
    white: "#ffffff",
    brown: "#d9782d",
    gold: "#ffd84d"
  };
  const value = String(region?.Border_Color || "#ffd84d").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  return namedColors[value] || "#ffd84d";
}

function migrateRegionTypeInLocalDb(regionId, previousType, nextType) {
  if (!regionId || regionId === "REG-0000" || previousType === nextType) return;

  (db?.raw?.hexes || []).forEach(hex => {
    if (previousType === "geographic" && nextType === "political" && hex.Region_ID_Ref === regionId) {
      hex.Political_Region_ID_Ref = regionId;
      hex.Region_ID_Ref = "REG-0000";
    } else if (previousType === "political" && nextType === "geographic" && hex.Political_Region_ID_Ref === regionId) {
      hex.Region_ID_Ref = regionId;
      hex.Political_Region_ID_Ref = "";
    }

    if (hex.Hex_ID && db?.hexesById?.[hex.Hex_ID]) {
      db.hexesById[hex.Hex_ID].Region_ID_Ref = hex.Region_ID_Ref;
      db.hexesById[hex.Hex_ID].Political_Region_ID_Ref = hex.Political_Region_ID_Ref;
    }
  });
}

function adaptCreatedPoiRow(row) {
  const createdRow = Array.isArray(row) ? row[0] : row;

  return {
    __uuid: createdRow.id,
    POI_ID: createdRow.ref_code,
    POI_Group_ID: db?.raw?.poiGroups?.find(group => group.__uuid === createdRow.poi_group_id)?.POI_Group_ID || "",
    Name: createdRow.name || "",
    Hex_ID_Ref: db?.raw?.hexes?.find(hex => hex.__uuid === createdRow.hex_id)?.Hex_ID || "",
    POI_Type: window.CampaignPoiTypes?.getTypeLabel?.(createdRow.poi_type) || createdRow.poi_type || "",
    POI_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(createdRow.poi_type) || createdRow.poi_type || "",
    POI_Icon: getNormalizedPoiIconValue(createdRow.poi_icon, { fallback: false }),
    POI_Tags: getNormalizedPoiTagValues(createdRow.poi_tags),
    Generation_Source: createdRow.generation_source || "",
    "Notoriety Tier": window.CampaignPoiTypes?.getNotorietyLabel?.(createdRow.notoriety_tier) || createdRow.notoriety_tier || "",
    "Notoriety Tier_Value": window.CampaignPoiTypes?.getStoredNotorietyValue?.(createdRow.notoriety_tier) || createdRow.notoriety_tier || "",
    Population: createdRow.population || "",
    Lore: createdRow.lore || "",
    Image: ""
  };
}

function addCreatedPoiToLocalDb(poi) {
  db.raw.pois.push(poi);
  db.poisById[poi.POI_ID] = poi;

  if (poi.Hex_ID_Ref) {
    if (!db.poisByHexId[poi.Hex_ID_Ref]) {
      db.poisByHexId[poi.Hex_ID_Ref] = [];
    }
    db.poisByHexId[poi.Hex_ID_Ref].push(poi);
  }

  if (poi.POI_Group_ID) {
    if (!db.poisByGroupId[poi.POI_Group_ID]) {
      db.poisByGroupId[poi.POI_Group_ID] = [];
    }
    db.poisByGroupId[poi.POI_Group_ID].push(poi);
  }
}

function registerCreatedPoiRowsInLocalDb(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [rows];
  const createdPois = list
    .flatMap(row => Array.isArray(row) ? row : [row])
    .filter(Boolean)
    .map(adaptCreatedPoiRow);

  createdPois.forEach(addCreatedPoiToLocalDb);

  if (options.refresh !== false && createdPois.length) {
    refreshCodexAfterCreatedRecord("poi");
  }

  return createdPois;
}

function refreshGeneratedMapPoiLayer() {
  if (window.generatedMapRenderer?.isActive?.()) {
    window.generatedMapRenderer.refreshPoiLayerFromDatabase();
  }
}

function refreshGeneratedMapRegionLayer() {
  if (window.generatedMapRenderer?.isActive?.()) {
    window.generatedMapRenderer.refreshRegionLayerFromDatabase?.();
  }
}

function removePoiFromLocalDbByUuid(poiUuid) {
  const poi = (db?.raw?.pois || []).find(row => row?.__uuid === poiUuid);
  if (!poi) return;

  db.raw.pois = (db.raw.pois || []).filter(row => row?.__uuid !== poiUuid);
  if (db.poisById) {
    delete db.poisById[poi.POI_ID];
  }

  if (poi.Hex_ID_Ref && Array.isArray(db.poisByHexId?.[poi.Hex_ID_Ref])) {
    db.poisByHexId[poi.Hex_ID_Ref] = db.poisByHexId[poi.Hex_ID_Ref]
      .filter(row => row.POI_ID !== poi.POI_ID);
  }
  if (poi.POI_Group_ID && Array.isArray(db.poisByGroupId?.[poi.POI_Group_ID])) {
    db.poisByGroupId[poi.POI_Group_ID] = db.poisByGroupId[poi.POI_Group_ID]
      .filter(row => row.POI_ID !== poi.POI_ID);
  }

  if (poi.POI_ID) {
    (db.raw.npcs || []).forEach(npc => {
      if (npc.Home_ID_Ref === poi.POI_ID) npc.Home_ID_Ref = "";
    });
    Object.values(db.npcsById || {}).forEach(npc => {
      if (npc.Home_ID_Ref === poi.POI_ID) npc.Home_ID_Ref = "";
    });
    db.npcsByHomeId = {};
    (db.raw.npcs || []).forEach(npc => {
      if (!npc.Home_ID_Ref) return;
      if (!db.npcsByHomeId[npc.Home_ID_Ref]) db.npcsByHomeId[npc.Home_ID_Ref] = [];
      db.npcsByHomeId[npc.Home_ID_Ref].push(npc);
    });
  }

  db.mapsByOwnerKey = groupMapsByOwner?.(db.raw.maps || []) || db.mapsByOwnerKey;
}

function removePoiGroupFromLocalDbByUuid(groupUuid) {
  const group = (db?.raw?.poiGroups || []).find(row => row?.__uuid === groupUuid);
  if (!group) return;

  db.raw.poiGroups = (db.raw.poiGroups || []).filter(row => row?.__uuid !== groupUuid);
  if (db.poiGroupsById) {
    delete db.poiGroupsById[group.POI_Group_ID];
  }
  if (db.poisByGroupId?.[group.POI_Group_ID]) {
    delete db.poisByGroupId[group.POI_Group_ID];
  }

  Object.values(db.poisById || {}).forEach(poi => {
    if (poi.POI_Group_ID === group.POI_Group_ID) {
      poi.POI_Group_ID = "";
    }
  });

  db.mapsByOwnerKey = groupMapsByOwner?.(db.raw.maps || []) || db.mapsByOwnerKey;
}

function refreshCodexAfterPoiPurge() {
  refreshGeneratedMapPoiLayer();

  const currentPage = getCurrentCodexPage?.();
  if (currentPage?.type === "poi") {
    renderCodexPage?.(db?.poisById?.[currentPage.id] ? "poi" : "pois", db?.poisById?.[currentPage.id] ? currentPage.id : null);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  if (currentPage?.type === "poi-group") {
    renderCodexPage?.(db?.poiGroupsById?.[currentPage.id] ? "poi-group" : "pois", db?.poiGroupsById?.[currentPage.id] ? currentPage.id : null);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  if (currentPage?.type === "pois") {
    renderCodexPage?.("pois", null);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  if (["hex", "npc"].includes(currentPage?.type)) {
    renderCodexPage?.(currentPage.type, currentPage.id);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  renderPoiListIntoContainer?.();
}

function refreshCodexAfterCreatedRecord(kind) {
  if (kind === "poi") {
    refreshGeneratedMapPoiLayer();
  } else if (kind === "region") {
    refreshGeneratedMapRegionLayer();
  }

  const currentPage = getCurrentCodexPage?.();
  const isDetailPage = ["hex", "region", "poi", "poi-group", "npc"].includes(currentPage?.type);

  if (isDetailPage) {
    renderCodexPage?.(currentPage.type, currentPage.id);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  if (currentPage?.type === "regions") {
    renderCodexPage?.("regions", null);
    fitCodexHeaderText?.();
    updateCodexBackButton?.();
    return;
  }

  if (kind === "npc") {
    renderNpcListIntoContainer?.();
  } else if (kind === "poi") {
    renderPoiListIntoContainer?.();
  }
}

async function handleAddNpcSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  if (!campaign) return;

  const name = document.getElementById("codex-add-npc-name")?.value.trim();
  const title = document.getElementById("codex-add-npc-title")?.value.trim();
  const organization = document.getElementById("codex-add-npc-organization")?.value.trim();
  const race = document.getElementById("codex-add-npc-race")?.value.trim();
  const occupation = document.getElementById("codex-add-npc-occupation")?.value.trim();
  const homePoiId = document.getElementById("codex-add-npc-home")?.value || "";
  const lore = document.getElementById("codex-add-npc-lore")?.value.trim();
  const imageFile = getEditorImageFile("codex-add-npc-image");

  if (!name || !race || !occupation || !homePoiId) {
    setCodexEditorStatus("Name, Race, Occupation, and Home are required.");
    return;
  }

  try {
    validateCodexImageUpload(imageFile);

    if (codexEditorState.mode === "edit-npc") {
      await handleEditNpcSubmit({
        campaign,
        name,
        title,
        organization,
        race,
        occupation,
        homePoiId,
        lore,
        imageFile
      });
      return;
    }

    setCodexEditorStatus("Creating NPC...");

    const { data, error } = await campaignSupabase.rpc("create_npc_with_next_ref_code", {
      target_campaign_id: campaign.id,
      npc_name: name,
      npc_title: title || null,
      npc_organization: organization || null,
      npc_race: race || null,
      npc_occupation: occupation || null,
      npc_lore: lore || null,
      npc_home_poi_id: getPoiUuidByLegacyId(homePoiId),
      npc_visibility: "shared"
    });

    if (error) throw error;

    const createdNpc = adaptCreatedNpcRow(data);
    addCreatedNpcToLocalDb(createdNpc);

    if (imageFile) {
      setCodexEditorStatus("Uploading NPC image...");
      createdNpc.Image = await uploadAndAttachRecordImage({
        campaign,
        recordType: "npc",
        recordUuid: createdNpc.__uuid,
        legacyId: createdNpc.NPC_ID,
        file: imageFile
      });
    }

    closeCodexEditor();
    refreshCodexAfterCreatedRecord("npc");
  } catch (error) {
    const isEdit = codexEditorState.mode === "edit-npc";
    console.error(isEdit ? "Failed to edit NPC:" : "Failed to create NPC:", error);
    setCodexEditorStatus(error.message || (isEdit ? "Unable to save NPC." : "Unable to create NPC."));
  }
}

async function handleEditNpcSubmit({ campaign, name, title, organization, race, occupation, homePoiId, lore, imageFile }) {
  const npc = db?.npcsById?.[codexEditorState.recordId];
  if (!npc?.__uuid) {
    throw new Error("Unable to identify this NPC. Refresh the app and try again.");
  }

  setCodexEditorStatus("Saving NPC...");

  const { data, error } = await campaignSupabase.rpc("update_npc_record", {
    target_campaign_id: campaign.id,
    target_npc_id: npc.__uuid,
    npc_name: name,
    npc_title: title || null,
    npc_organization: organization || null,
    npc_race: race,
    npc_occupation: occupation,
    npc_home_poi_id: getPoiUuidByLegacyId(homePoiId),
    npc_lore: lore || null
  });

  if (error) throw error;

  const updated = Array.isArray(data) ? data[0] : data;
  updateNpcInLocalDb(npc, {
    Home_ID_Ref: db?.raw?.pois?.find(poi => poi.__uuid === updated?.home_poi_id)?.POI_ID || homePoiId,
    Title: updated?.title || "",
    Name: updated?.name || name,
    Organization: updated?.organization || "",
    Race: updated?.race || race,
    Occupation: updated?.occupation || occupation,
    Lore: updated?.lore || ""
  });

  if (imageFile) {
    setCodexEditorStatus("Uploading NPC image...");
    npc.Image = await uploadAndAttachRecordImage({
      campaign,
      recordType: "npc",
      recordUuid: npc.__uuid,
      legacyId: npc.NPC_ID,
      file: imageFile
    });
  }

  closeCodexEditor();
  refreshCodexAfterCreatedRecord("npc");
}

async function handleAddPoiGroupSubmit({ campaign, name, groupType, groupIcon, initialChildPoiId, tagValues, population, lore, imageFile }) {
  const { data, error } = await campaignSupabase.rpc("create_poi_group_with_slug", {
    target_campaign_id: campaign.id,
    group_name: name,
    group_type: groupType,
    group_icon: groupIcon,
    initial_child_poi_id: getPoiUuidByLegacyId(initialChildPoiId),
    group_tags: tagValues,
    group_population: population || null,
    group_lore: lore || null,
    group_generation_source: null,
    group_visibility: "shared"
  });

  if (error) throw error;

  const createdGroup = adaptCreatedPoiGroupRow(data);
  addCreatedPoiGroupToLocalDb(createdGroup);
  attachPoiToGroupInLocalDb(initialChildPoiId, createdGroup.POI_Group_ID);

  if (imageFile) {
    setCodexEditorStatus("Uploading grouped POI image...");
    createdGroup.Image = await uploadAndAttachRecordImage({
      campaign,
      recordType: "poi_group",
      recordUuid: createdGroup.__uuid,
      legacyId: createdGroup.POI_Group_ID,
      file: imageFile
    });
  }

  closeCodexEditor();
  refreshCodexAfterCreatedRecord("poi");
}

async function handleEditPoiSubmit({ campaign, name, poiType, poiIcon, parentGroupId, hexId, notoriety, tagValues, population, lore, imageFile }) {
  const poi = db?.poisById?.[codexEditorState.recordId];
  if (!poi?.__uuid) {
    throw new Error("Unable to identify this POI. Refresh the app and try again.");
  }

  const { data, error } = await campaignSupabase.rpc("update_poi_record", {
    target_campaign_id: campaign.id,
    target_poi_id: poi.__uuid,
    poi_name: name,
    new_poi_type: poiType,
    new_poi_icon: poiIcon,
    poi_hex_id: getHexUuidByLegacyId(hexId),
    new_poi_group_id: getPoiGroupUuidByLegacyId(parentGroupId),
    new_poi_notoriety_tier: notoriety || null,
    new_poi_tags: tagValues,
    new_poi_population: population || null,
    new_poi_lore: lore || null
  });

  if (error) throw error;

  const updated = Array.isArray(data) ? data[0] : data;
  updatePoiInLocalDb(poi, {
    Name: updated?.name || name,
    Hex_ID_Ref: db?.raw?.hexes?.find(hex => hex.__uuid === updated?.hex_id)?.Hex_ID || hexId,
    POI_Group_ID: db?.raw?.poiGroups?.find(group => group.__uuid === updated?.poi_group_id)?.POI_Group_ID || "",
    POI_Type: window.CampaignPoiTypes?.getTypeLabel?.(updated?.poi_type || poiType) || updated?.poi_type || poiType,
    POI_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(updated?.poi_type || poiType) || updated?.poi_type || poiType,
    POI_Icon: getNormalizedPoiIconValue(updated?.poi_icon || poiIcon, { fallback: false }),
    POI_Tags: getNormalizedPoiTagValues(updated?.poi_tags || tagValues),
    "Notoriety Tier": window.CampaignPoiTypes?.getNotorietyLabel?.(updated?.notoriety_tier || notoriety) || updated?.notoriety_tier || notoriety,
    "Notoriety Tier_Value": window.CampaignPoiTypes?.getStoredNotorietyValue?.(updated?.notoriety_tier || notoriety) || updated?.notoriety_tier || notoriety,
    Population: updated?.population || "",
    Lore: updated?.lore || ""
  });

  if (imageFile) {
    setCodexEditorStatus("Uploading POI image...");
    poi.Image = await uploadAndAttachRecordImage({
      campaign,
      recordType: "poi",
      recordUuid: poi.__uuid,
      legacyId: poi.POI_ID,
      file: imageFile
    });
  }

  closeCodexEditor();
  refreshCodexAfterCreatedRecord("poi");
}

async function handleAddPoiSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  if (!campaign) return;

  const name = document.getElementById("codex-add-poi-name")?.value.trim();
  const poiTypeRaw = document.getElementById("codex-add-poi-type")?.value || "";
  const poiType = window.CampaignPoiTypes?.normalizeTypeValue?.(poiTypeRaw) || "";
  const isGroup = document.getElementById("codex-add-poi-is-group")?.checked === true;
  const parentGroupId = document.getElementById("codex-add-poi-parent-group")?.value || "";
  const initialChildPoiId = document.getElementById("codex-add-poi-initial-child")?.value || "";
  const regionId = document.getElementById("codex-add-poi-region")?.value || "";
  const hexId = document.getElementById("codex-add-poi-hex")?.value || "";
  const notorietyRaw = document.getElementById("codex-add-poi-notoriety")?.value || "";
  const notoriety = window.CampaignPoiTypes?.normalizeNotorietyValue?.(notorietyRaw) || "";
  const iconRaw = document.getElementById("codex-add-poi-icon")?.value || "";
  const iconValue = getNormalizedPoiIconValue(iconRaw, { fallback: false });
  const tagValues = readPoiTagInputValues("codex-add-poi-tags");
  const rawPopulation = document.getElementById("codex-add-poi-population")?.value.trim();
  const currentPoi = codexEditorState.mode === "edit-poi"
    ? db?.poisById?.[codexEditorState.recordId]
    : null;
  const population = (!isGroup && parentGroupId)
    ? (codexEditorState.mode === "edit-poi" ? String(currentPoi?.Population || "") : "")
    : rawPopulation;
  const lore = document.getElementById("codex-add-poi-lore")?.value.trim();
  const imageFile = getEditorImageFile("codex-add-poi-image");

  if (String(poiTypeRaw || "").trim() && !poiType) {
    setCodexEditorStatus("Choose a valid type from the list.");
    return;
  }
  if (String(notorietyRaw || "").trim() && !notoriety) {
    setCodexEditorStatus("Choose a valid notoriety from the list.");
    return;
  }
  if (String(iconRaw || "").trim() && !iconValue) {
    setCodexEditorStatus("Choose a valid icon from the list.");
    return;
  }

  if (isGroup) {
    if (!name || !poiType || !iconValue || !initialChildPoiId) {
      setCodexEditorStatus("Name, Group Type, Icon, and Initial child Area are required.");
      return;
    }
  } else if (!name || !poiType || !iconValue || !regionId || !hexId || !notoriety) {
    setCodexEditorStatus("Name, Type, Icon, Region, Hex, and Notoriety are required.");
    return;
  }

  if (!isGroup && poiType.toLowerCase() === "settlement" && !population) {
    setCodexEditorStatus("Population is required for Settlements.");
    return;
  }

  if (!isGroup && parentGroupId && !canPoiHexJoinGroup(hexId, parentGroupId, {
    excludePoiId: currentPoi?.POI_ID || ""
  })) {
    setCodexEditorStatus("Child Areas added to a grouped POI must use a hex adjacent to an existing child Area in that group.");
    updatePoiParentGroupAdjacencyHelp();
    return;
  }

  setCodexEditorStatus(isGroup ? "Creating grouped POI..." : "Creating POI...");

  try {
    validateCodexImageUpload(imageFile);

    if (codexEditorState.mode === "edit-poi") {
      await handleEditPoiSubmit({
        campaign,
        name,
        poiType,
        poiIcon: iconValue,
        parentGroupId,
        hexId,
        notoriety,
        tagValues,
        population,
        lore,
        imageFile
      });
      return;
    }

    if (isGroup) {
      await handleAddPoiGroupSubmit({
        campaign,
        name,
        groupType: poiType,
        groupIcon: iconValue,
        initialChildPoiId,
        tagValues,
        population,
        lore,
        imageFile
      });
      return;
    }

    const { data, error } = await campaignSupabase.rpc("create_poi_with_next_ref_code", {
      target_campaign_id: campaign.id,
      poi_name: name,
      poi_type: poiType,
      poi_icon: iconValue,
      poi_hex_id: getHexUuidByLegacyId(hexId),
      poi_tags: tagValues,
      poi_notoriety_tier: notoriety || null,
      poi_population: population || null,
      poi_lore: lore || null,
      poi_generation_source: null,
      poi_visibility: "shared",
      poi_group_id: getPoiGroupUuidByLegacyId(parentGroupId)
    });

    if (error) throw error;

    const createdPoi = adaptCreatedPoiRow(data);
    addCreatedPoiToLocalDb(createdPoi);

    if (imageFile) {
      setCodexEditorStatus("Uploading POI image...");
      createdPoi.Image = await uploadAndAttachRecordImage({
        campaign,
        recordType: "poi",
        recordUuid: createdPoi.__uuid,
        legacyId: createdPoi.POI_ID,
        file: imageFile
      });
    }

    closeCodexEditor();
    refreshCodexAfterCreatedRecord("poi");
  } catch (error) {
    console.error("Failed to create POI:", error);
    setCodexEditorStatus(error.message || "Unable to create POI.");
  }
}

async function handleEditPoiGroupSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  const group = db?.poiGroupsById?.[codexEditorState.recordId];
  if (!campaign || !group?.__uuid) return;

  const name = document.getElementById("codex-edit-poi-group-name")?.value.trim();
  const groupTypeRaw = document.getElementById("codex-edit-poi-group-type")?.value || "";
  const groupType = window.CampaignPoiTypes?.normalizeTypeValue?.(groupTypeRaw) || "";
  const groupIconRaw = document.getElementById("codex-edit-poi-group-icon")?.value || "";
  const groupIcon = getNormalizedPoiIconValue(groupIconRaw, { fallback: false });
  const tagValues = readPoiTagInputValues("codex-edit-poi-group-tags");
  const population = document.getElementById("codex-edit-poi-group-population")?.value.trim();
  const lore = document.getElementById("codex-edit-poi-group-lore")?.value.trim();
  const imageFile = getEditorImageFile("codex-edit-poi-group-image");

  if (String(groupTypeRaw || "").trim() && !groupType) {
    setCodexEditorStatus("Choose a valid group type from the list.");
    return;
  }
  if (String(groupIconRaw || "").trim() && !groupIcon) {
    setCodexEditorStatus("Choose a valid icon from the list.");
    return;
  }

  if (!name || !groupType || !groupIcon) {
    setCodexEditorStatus("Name, Group Type, and Icon are required.");
    return;
  }

  if (!(codexEditorState.workingChildIds || []).length) {
    setCodexEditorStatus("Grouped POIs must have at least one child Area.");
    return;
  }

  setCodexEditorStatus("Saving grouped POI...");

  try {
    validateCodexImageUpload(imageFile);

    const { data, error } = await campaignSupabase.rpc("update_poi_group_record", {
    target_campaign_id: campaign.id,
    target_poi_group_id: group.__uuid,
    group_name: name,
    new_group_type: groupType,
    new_group_icon: groupIcon,
    new_group_tags: tagValues,
    new_group_population: population || null,
    new_group_lore: lore || null
  });

    if (error) throw error;

    const originalChildIds = new Set(codexEditorState.originalChildIds || []);
    const workingChildIds = new Set(codexEditorState.workingChildIds || []);
    const childIdsToDetach = [...originalChildIds].filter(poiId => !workingChildIds.has(poiId));
    const childIdsToAttach = [...workingChildIds].filter(poiId => !originalChildIds.has(poiId));

    for (const poiId of childIdsToDetach) {
      await setPoiGroupParent(poiId, null);
    }

    for (const poiId of childIdsToAttach) {
      await setPoiGroupParent(poiId, group.POI_Group_ID);
    }

    const updated = Array.isArray(data) ? data[0] : data;
    updatePoiGroupInLocalDb(group, {
      POI_Group_Name: updated?.name || name,
      Group_Type: window.CampaignPoiTypes?.getTypeLabel?.(updated?.group_type || groupType) || updated?.group_type || groupType,
      Group_Type_Value: window.CampaignPoiTypes?.getStoredTypeValue?.(updated?.group_type || groupType) || updated?.group_type || groupType,
      Group_Icon: getNormalizedPoiIconValue(updated?.group_icon || groupIcon, { fallback: false }),
      Group_Tags: getNormalizedPoiTagValues(updated?.group_tags || tagValues),
      Population: updated?.population || "",
      Lore: updated?.lore || ""
    });

    if (imageFile) {
      setCodexEditorStatus("Uploading grouped POI image...");
      group.Image = await uploadAndAttachRecordImage({
        campaign,
        recordType: "poi_group",
        recordUuid: group.__uuid,
        legacyId: group.POI_Group_ID,
        file: imageFile
      });
    }

    closeCodexEditor();
    refreshCodexAfterCreatedRecord("poi");
  } catch (error) {
    console.error("Failed to edit grouped POI:", error);
    setCodexEditorStatus(error.message || "Unable to save grouped POI.");
  }
}

async function handleEditTagsSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  if (!campaign) return;

  const tagValues = readPoiTagInputValues("codex-edit-tags-values");
  const isGroup = codexEditorState.recordType === "poi-group";

  try {
    if (isGroup) {
      const group = db?.poiGroupsById?.[codexEditorState.recordId];
      if (!group?.__uuid) {
        throw new Error("Unable to identify this grouped POI. Refresh the app and try again.");
      }

      setCodexEditorStatus("Saving grouped POI tags...");

      const { data, error } = await campaignSupabase.rpc("update_poi_group_record", {
        target_campaign_id: campaign.id,
        target_poi_group_id: group.__uuid,
        group_name: group.POI_Group_Name || "",
        new_group_type: group.Group_Type_Value || group.Group_Type || "",
        new_group_icon: group.Group_Icon || "",
        new_group_tags: tagValues,
        new_group_population: group.Population || null,
        new_group_lore: group.Lore || null
      });

      if (error) throw error;

      const updated = Array.isArray(data) ? data[0] : data;
      updatePoiGroupInLocalDb(group, {
        Group_Tags: getNormalizedPoiTagValues(updated?.group_tags || tagValues)
      });
    } else {
      const poi = db?.poisById?.[codexEditorState.recordId];
      if (!poi?.__uuid) {
        throw new Error("Unable to identify this POI. Refresh the app and try again.");
      }

      setCodexEditorStatus("Saving POI tags...");

      const { data, error } = await campaignSupabase.rpc("update_poi_record", {
        target_campaign_id: campaign.id,
        target_poi_id: poi.__uuid,
        poi_name: poi.Name || "",
        new_poi_type: poi.POI_Type_Value || poi.POI_Type || "",
        new_poi_icon: poi.POI_Icon || "",
        poi_hex_id: getHexUuidByLegacyId(poi.Hex_ID_Ref),
        new_poi_group_id: getPoiGroupUuidByLegacyId(poi.POI_Group_ID),
        new_poi_notoriety_tier: poi["Notoriety Tier_Value"] || poi["Notoriety Tier"] || "",
        new_poi_tags: tagValues,
        new_poi_population: poi.Population || null,
        new_poi_lore: poi.Lore || null
      });

      if (error) throw error;

      const updated = Array.isArray(data) ? data[0] : data;
      updatePoiInLocalDb(poi, {
        POI_Tags: getNormalizedPoiTagValues(updated?.poi_tags || tagValues)
      });
    }

    closeCodexEditor();
    refreshCodexAfterCreatedRecord("poi");
  } catch (error) {
    console.error("Failed to save tags:", error);
    setCodexEditorStatus(error.message || "Unable to save tags.");
  }
}

async function handleEditRegionSubmit(event) {
  event.preventDefault();

  const campaign = getActiveCampaign?.();
  const isCreate = ["region", "quick-region"].includes(codexEditorState.mode);
  const region = isCreate ? null : db?.regionsById?.[codexEditorState.recordId];
  if (!campaign || (!isCreate && !region?.__uuid)) return;

  const name = document.getElementById("codex-edit-region-name")?.value.trim();
  const lore = document.getElementById("codex-edit-region-lore")?.value.trim();
  const regionType = region?.Region_ID === "REG-0000"
    ? "geographic"
    : document.getElementById("codex-edit-region-type")?.value || "geographic";
  const borderColor = region?.Region_ID === "REG-0000"
    ? "none"
    : document.getElementById("codex-edit-region-border-color")?.value || "#ffd84d";
  const imageFile = getEditorImageFile("codex-edit-region-image");

  if (isCreate && !name) {
    setCodexEditorStatus("Region name is required.");
    return;
  }

  setCodexEditorStatus(isCreate ? "Creating region..." : "Saving region...");

  try {
    validateCodexImageUpload(imageFile);

    if (isCreate) {
      const { data, error } = await campaignSupabase.rpc("create_region_with_next_ref_code", {
        target_campaign_id: campaign.id,
        region_name: name,
        region_type_input: regionType,
        region_border_color: borderColor,
        region_lore: codexEditorState.quickRegion ? null : lore || null
      });

      if (error) throw error;

      const createdRegion = adaptCreatedRegionRow(data);
      addCreatedRegionToLocalDb(createdRegion);

      if (imageFile && !codexEditorState.quickRegion) {
        setCodexEditorStatus("Uploading region image...");
        createdRegion.Image = await uploadAndAttachRecordImage({
          campaign,
          recordType: "region",
          recordUuid: createdRegion.__uuid,
          legacyId: createdRegion.Region_ID,
          file: imageFile
        });
      }

      const onCreated = codexEditorState.onCreated;
      closeCodexEditor();
      refreshCodexAfterCreatedRecord("region");
      onCreated?.(createdRegion);
      return;
    }

    const { data, error } = await campaignSupabase.rpc("update_region_record", {
      target_campaign_id: campaign.id,
      target_region_id: region.__uuid,
      region_lore: lore || null,
      region_border_color: borderColor,
      new_region_type: regionType
    });

    if (error) throw error;

    const updated = Array.isArray(data) ? data[0] : data;
    const previousRegionType = region.Region_Type || "geographic";
    const updatedRegionType = updated?.region_type || regionType;
    updateRegionInLocalDb(region, {
      Lore: updated?.lore || "",
      Region_Type: updatedRegionType,
      Border_Color: region.Region_ID === "REG-0000" ? "none" : updated?.border_color || borderColor
    });
    migrateRegionTypeInLocalDb(region.Region_ID, previousRegionType, updatedRegionType);

    if (imageFile) {
      setCodexEditorStatus("Uploading region image...");
      region.Image = await uploadAndAttachRecordImage({
        campaign,
        recordType: "region",
        recordUuid: region.__uuid,
        legacyId: region.Region_ID,
        file: imageFile
      });
    }

    closeCodexEditor();
    refreshCodexAfterCreatedRecord("region");
  } catch (error) {
    console.error("Failed to edit region:", error);
    setCodexEditorStatus(error.message || "Unable to save region.");
  }
}

async function setPoiGroupParent(poiId, groupId) {
  const campaign = getActiveCampaign?.();
  const poi = db?.poisById?.[poiId];
  const group = groupId ? db?.poiGroupsById?.[groupId] : null;

  if (!campaign || !poi?.__uuid) return;

  const { error } = await campaignSupabase.rpc("set_poi_group_parent", {
    target_campaign_id: campaign.id,
    target_poi_id: poi.__uuid,
    target_poi_group_id: group?.__uuid || null
  });

  if (error) throw error;

  if (groupId) {
    attachPoiToGroupInLocalDb(poiId, groupId);
  } else {
    detachPoiFromGroupInLocalDb(poiId);
  }
}

async function handlePoiGroupChildManagerClick(event) {
  const detachButton = event.target.closest("[data-detach-poi-id]");
  if (!detachButton || codexEditorState.mode !== "edit-poi-group") return;

  const poiId = detachButton.dataset.detachPoiId;
  if (!poiId) return;

  codexEditorState.workingChildIds = (codexEditorState.workingChildIds || [])
    .filter(id => id !== poiId);
  renderPoiGroupChildManager(codexEditorState.recordId);
  setCodexEditorStatus("Child Area staged for detach. Save Group to apply.");
}

async function handlePoiGroupAddChild() {
  if (codexEditorState.mode !== "edit-poi-group") return;

  const select = document.getElementById("codex-edit-poi-group-add-child");
  const poiId = select?.value || "";
  if (!poiId) {
    setCodexEditorStatus("Select an Area to add.");
    return;
  }

  const candidatePoi = db?.poisById?.[poiId];
  if (!candidatePoi?.Hex_ID_Ref) {
    setCodexEditorStatus("Selected Area needs a hex before it can join a grouped POI.");
    updatePoiGroupChildAddHelp();
    return;
  }

  if (!canPoiHexJoinGroup(candidatePoi.Hex_ID_Ref, codexEditorState.recordId, {
    childIds: codexEditorState.workingChildIds || [],
    excludePoiId: poiId
  })) {
    setCodexEditorStatus("Child Areas added after the first must be adjacent to an existing child Area in the grouped POI.");
    updatePoiGroupChildAddHelp();
    return;
  }

  if (!codexEditorState.workingChildIds.includes(poiId)) {
    codexEditorState.workingChildIds.push(poiId);
  }

  renderPoiGroupChildManager(codexEditorState.recordId);
  setCodexEditorStatus("Child Area staged for add. Save Group to apply.");
}

function handlePoiTagPickerClick(event) {
  const tagButton = event.target.closest("[data-tag-input][data-tag-picker][data-tag-value]");
  if (!tagButton) return;

  togglePoiTagValue(
    tagButton.dataset.tagInput,
    tagButton.dataset.tagPicker,
    tagButton.dataset.tagValue
  );
}

function handlePoiIconPickerClick(event) {
  const iconButton = event.target.closest("[data-icon-input][data-icon-picker][data-icon-value]");
  if (!iconButton) return;

  selectPoiIconValue(
    iconButton.dataset.iconInput,
    iconButton.dataset.iconPicker,
    iconButton.dataset.iconValue
  );
}

function handleCodexEditorPickerTriggerClick(event) {
  const trigger = event.currentTarget;
  const pickerKind = trigger?.dataset.pickerKind || "";
  const inputId = trigger?.dataset.pickerInput || "";
  if (!pickerKind || !inputId) return;

  if (pickerKind === "icon") {
    openCodexEditorPicker("icon", inputId, {
      title: trigger.dataset.pickerTitle || "Choose Map Icon",
      help: "Pick any icon. Categories are suggestions only."
    });
    return;
  }

  if (pickerKind === "tags") {
    openCodexEditorPicker("tags", inputId, {
      title: trigger.dataset.pickerTitle || "Edit Tags",
      help: "Choose up to 4 tags to describe the place."
    });
  }
}

function updateCodexContextAction(type) {
  window.closeCodexNavPockets?.();

  const mobileButton = document.getElementById("codex-context-action");
  const mobileDeleteButton = document.getElementById("codex-context-delete");
  const mobileEditButton = document.getElementById("codex-mobile-edit-reveal");
  const desktopButton = document.getElementById("codex-desktop-context-action");
  const desktopDeleteButton = document.getElementById("codex-desktop-context-delete");
  const desktopShell = document.getElementById("codex-desktop-context-action-shell");
  const mobileActionPocket = document.getElementById("codex-mobile-action-pocket");
  const buttons = [mobileButton, desktopButton].filter(Boolean);
  const deleteButtons = [mobileDeleteButton, desktopDeleteButton].filter(Boolean);
  if (!buttons.length) return;

  const hideButton = (button) => {
    button.hidden = true;
    button.disabled = false;
    button.textContent = "";
    button.removeAttribute("aria-label");
    button.onclick = null;
  };

  const setMobileActionPocketVisible = (isVisible) => {
    if (mobileActionPocket) {
      mobileActionPocket.hidden = !isVisible;
    }
  };

  const isNpcIndex = type === "npcs";
  const isPoiIndex = type === "pois";
  const isRegionIndex = type === "regions";
  const isDetailPage = ["hex", "region", "poi", "poi-group", "npc"].includes(type);
  const currentPage = getCurrentCodexPage?.();
  const isDeletableDetailPage = canDeleteCurrentDetailPage(currentPage || { type });
  const isEditableDetailPage = ["region", "poi", "poi-group", "npc"].includes(type);
  mobileActionPocket?.classList.toggle("has-reveal", isDetailPage && isEditableDetailPage && isDeletableDetailPage);
  hideButton(mobileEditButton);

  if (isNpcIndex || isPoiIndex || isRegionIndex) {
    if (desktopShell) desktopShell.hidden = false;
    setMobileActionPocketVisible(true);
    deleteButtons.forEach(hideButton);
    const addAction = isRegionIndex ? openAddRegionEditor : (isPoiIndex ? openAddPoiEditor : openAddNpcEditor);
    if (mobileButton) {
      mobileButton.hidden = false;
      mobileButton.disabled = false;
      mobileButton.textContent = "＋";
      mobileButton.setAttribute("aria-label", "Add");
      mobileButton.onclick = addAction;
    }
    if (desktopButton) {
      desktopButton.hidden = false;
      desktopButton.disabled = false;
      desktopButton.textContent = "Add";
      desktopButton.onclick = addAction;
    }
    buttons.forEach((button) => {
      if (button === mobileButton || button === desktopButton) return;
      button.hidden = false;
      button.disabled = false;
      button.textContent = "Add";
      button.onclick = addAction;
    });
    return;
  }

  if (isDetailPage) {
    if (desktopShell) desktopShell.hidden = !(isEditableDetailPage || isDeletableDetailPage);
    setMobileActionPocketVisible(isEditableDetailPage);
    if (desktopDeleteButton) {
      if (isDeletableDetailPage) {
        desktopDeleteButton.hidden = false;
        desktopDeleteButton.disabled = false;
        desktopDeleteButton.textContent = "Delete";
        desktopDeleteButton.onclick = () => {
          window.closeCodexNavPockets?.();
          openDeleteRecordModal();
        };
      } else {
        hideButton(desktopDeleteButton);
      }
    }

    if (mobileDeleteButton) {
      if (isEditableDetailPage && isDeletableDetailPage) {
        mobileDeleteButton.hidden = false;
        mobileDeleteButton.disabled = false;
        mobileDeleteButton.textContent = "Delete";
        mobileDeleteButton.onclick = () => {
          window.closeCodexNavPockets?.();
          openDeleteRecordModal();
        };
      } else {
        hideButton(mobileDeleteButton);
      }
    }

    if (mobileEditButton) {
      if (isEditableDetailPage) {
        mobileEditButton.hidden = false;
        mobileEditButton.disabled = false;
        mobileEditButton.textContent = "Edit";
        mobileEditButton.onclick = () => {
          window.closeCodexNavPockets?.();
          openEditCurrentCodexRecord();
        };
      } else {
        hideButton(mobileEditButton);
      }
    }

    if (desktopButton) {
      desktopButton.textContent = "Edit";
      if (isEditableDetailPage) {
        desktopButton.hidden = false;
        desktopButton.onclick = () => {
          window.closeCodexNavPockets?.();
          openEditCurrentCodexRecord();
        };
        desktopButton.disabled = false;
      } else {
        hideButton(desktopButton);
      }
    }

    if (mobileButton) {
      mobileButton.textContent = "✎";
      mobileButton.setAttribute("aria-label", "Record actions");
      if (isEditableDetailPage) {
        mobileButton.hidden = false;
        mobileButton.onclick = () => {
          if (window.isMobileCodexNav?.() && isDeletableDetailPage) {
            if (window.isCodexNavPocketOpen?.("codex-mobile-action-pocket")) {
              window.closeCodexNavPockets?.();
            } else {
              window.openCodexNavPocket?.("codex-mobile-action-pocket");
            }
            return;
          }

          window.closeCodexNavPockets?.();
          openEditCurrentCodexRecord();
        };
        mobileButton.disabled = false;
      } else {
        hideButton(mobileButton);
      }
    }

    buttons.forEach((button) => {
      if (button === mobileButton || button === desktopButton) return;
      button.textContent = "Edit";
      if (isEditableDetailPage) {
        button.hidden = false;
        button.onclick = () => {
        window.closeCodexNavPockets?.();
          openEditCurrentCodexRecord();
        };
        button.disabled = false;
      } else {
        hideButton(button);
      }
    });
    return;
  }

  if (desktopShell) desktopShell.hidden = true;
  setMobileActionPocketVisible(false);
  hideButton(mobileEditButton);
  deleteButtons.forEach(hideButton);
  buttons.forEach(hideButton);
}

function syncRegionEditorMode(options = {}) {
  const isCreate = ["region", "quick-region"].includes(codexEditorState.mode);
  const isQuick = codexEditorState.mode === "quick-region";
  const nameRow = document.getElementById("codex-edit-region-name-row");
  const nameInput = document.getElementById("codex-edit-region-name");
  const typeSelect = document.getElementById("codex-edit-region-type");
  const colorSelect = document.getElementById("codex-edit-region-border-color");
  const loreRow = document.getElementById("codex-edit-region-lore-row");
  const imageRow = document.getElementById("codex-edit-region-image-row");
  const submitButton = document.getElementById("codex-region-editor-submit");

  if (nameRow) nameRow.hidden = !isCreate;
  if (nameInput) {
    nameInput.required = isCreate;
    nameInput.value = options.name || "";
  }
  if (typeSelect) {
    typeSelect.value = options.regionType || "geographic";
    typeSelect.disabled = isQuick || options.lockType === true;
  }
  if (colorSelect) {
    colorSelect.value = options.borderColor || "#ffd84d";
    colorSelect.disabled = false;
    window.syncColorPickerControl?.(colorSelect);
  }
  if (loreRow) loreRow.hidden = isQuick;
  if (imageRow) imageRow.hidden = isQuick;
  if (submitButton) submitButton.textContent = isCreate ? "Create Region" : "Save Region";
}

function canDeleteCurrentDetailPage(page = getCurrentCodexPage?.()) {
  if (!page?.type) return false;
  if (["poi", "poi-group", "npc"].includes(page.type)) return true;
  if (!page.id) return false;
  if (page.type !== "region" || page.id === "REG-0000") return false;
  return ["owner", "superuser"].includes(getActiveCampaign?.()?.currentUserRole || "");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("codex-add-npc-form")
    ?.addEventListener("submit", handleAddNpcSubmit);
  document.getElementById("codex-add-poi-form")
    ?.addEventListener("submit", handleAddPoiSubmit);
  document.getElementById("codex-edit-poi-group-form")
    ?.addEventListener("submit", handleEditPoiGroupSubmit);
  document.getElementById("codex-edit-tags-form")
    ?.addEventListener("submit", handleEditTagsSubmit);
  document.getElementById("codex-edit-region-form")
    ?.addEventListener("submit", handleEditRegionSubmit);
  document.getElementById("codex-add-journal-form")
    ?.addEventListener("submit", handleAddJournalSubmit);
  document.getElementById("codex-edit-poi-group-child-list")
    ?.addEventListener("click", handlePoiGroupChildManagerClick);
  document.getElementById("codex-edit-poi-group-add-child-button")
    ?.addEventListener("click", handlePoiGroupAddChild);
  document.getElementById("codex-edit-poi-group-add-child")
    ?.addEventListener("change", updatePoiGroupChildAddHelp);
  document.getElementById("codex-edit-tags-picker")
    ?.addEventListener("click", handlePoiTagPickerClick);
  document.getElementById("codex-editor-picker-content")
    ?.addEventListener("click", handlePoiIconPickerClick);
  document.getElementById("codex-editor-picker-content")
    ?.addEventListener("click", handlePoiTagPickerClick);
  document.querySelectorAll("[data-picker-kind][data-picker-input]")
    .forEach(button => button.addEventListener("click", handleCodexEditorPickerTriggerClick));
  document.getElementById("codex-editor-picker-apply")
    ?.addEventListener("click", () => closeCodexEditorPicker({ commit: true }));
  document.getElementById("codex-editor-picker-cancel")
    ?.addEventListener("click", () => closeCodexEditorPicker({ commit: false }));
  document.getElementById("codex-editor-picker-close")
    ?.addEventListener("click", () => closeCodexEditorPicker({ commit: false }));
  document.getElementById("codex-add-poi-region")
    ?.addEventListener("change", event => {
      populatePoiHexOptions(event.target.value || "");
      updatePoiParentGroupAdjacencyHelp();
    });
  document.getElementById("codex-add-poi-hex")
    ?.addEventListener("change", updatePoiParentGroupAdjacencyHelp);
  document.getElementById("codex-add-poi-is-group")
    ?.addEventListener("change", () => {
      updatePoiGroupMode();
      updatePoiPopulationRequirement();
    });
  document.getElementById("codex-add-poi-type")
    ?.addEventListener("change", updatePoiPopulationRequirement);
  document.getElementById("codex-add-poi-parent-group")
    ?.addEventListener("change", () => {
      updatePoiPopulationRequirement();
      updatePoiParentGroupAdjacencyHelp();
    });
  document.getElementById("codex-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-poi-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-poi-group-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-tags-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-region-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-map-manager-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-journal-editor-close")
    ?.addEventListener("click", closeCodexEditor);
  document.getElementById("codex-map-manager-list")
    ?.addEventListener("click", handleMapManagerClick);
  document.getElementById("codex-delete-cancel")
    ?.addEventListener("click", closeCodexDeleteModal);
  document.getElementById("codex-delete-confirm")
    ?.addEventListener("click", confirmDeleteRecord);
  document.getElementById("codex-journal-entry-close")
    ?.addEventListener("click", closeJournalEntryModal);
  document.getElementById("codex-journal-entry-delete")
    ?.addEventListener("click", deleteOpenJournalEntry);
});

window.openAddNpcEditor = openAddNpcEditor;
window.openAddRegionEditor = openAddRegionEditor;
window.openEditNpcEditor = openEditNpcEditor;
window.openEditRegionEditor = openEditRegionEditor;
window.openAddMapEditor = openAddMapEditor;
window.openManageMapsEditor = openManageMapsEditor;
window.openAddJournalEditor = openAddJournalEditor;
window.openJournalEntryModal = openJournalEntryModal;
window.openAddPoiEditor = openAddPoiEditor;
window.openEditPoiEditor = openEditPoiEditor;
window.openEditPoiGroupEditor = openEditPoiGroupEditor;
window.openPoiTagsEditor = openPoiTagsEditor;
window.updateCodexContextAction = updateCodexContextAction;
window.CampaignCodexPoiMutations = Object.freeze({
  removePoiByUuidFromLocalDb: removePoiFromLocalDbByUuid,
  removePoiGroupByUuidFromLocalDb: removePoiGroupFromLocalDbByUuid,
  refreshPoiViewsAfterPurge: refreshCodexAfterPoiPurge,
  refreshPoiViews: () => refreshCodexAfterCreatedRecord("poi"),
  registerCreatedPoiRowsInLocalDb
});
