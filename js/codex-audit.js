/* =========================================================
   CODEX OWNER AUDIT RAIL
   ========================================================= */

let codexAuditVisible = false;

function isActiveCampaignOwner() {
  return ["owner", "superuser"].includes(getActiveCampaign?.()?.currentUserRole || "");
}

function isCodexAuditVisible() {
  return codexAuditVisible && isActiveCampaignOwner();
}

function setCodexAuditVisible(isVisible) {
  codexAuditVisible = Boolean(isVisible);
  document.getElementById("campaign-settings-audit-button")?.classList.toggle("active", codexAuditVisible);
  document.getElementById("campaign-settings-audit-button")?.setAttribute(
    "aria-pressed",
    codexAuditVisible ? "true" : "false"
  );

  if (window.db) {
    refreshOpenCodexAfterDatabaseLoad?.();
  }
}

function toggleCodexAuditLog() {
  setCodexAuditVisible(!codexAuditVisible);
}

function formatAuditTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCodexAuditRows({ targetType = "", targetTypes = [], targetId = "" } = {}) {
  const rows = db?.auditLog || [];
  const typeList = targetTypes.length ? targetTypes : targetType ? [targetType] : [];

  return rows.filter(row => {
    const typeMatch = !typeList.length || typeList.includes(row.target_type);
    const idMatch = !targetId || row.target_id === targetId;
    return typeMatch && idMatch;
  });
}

function renderCodexAuditRows(limit = 8, options = {}) {
  const rows = getCodexAuditRows(options).slice(0, limit);

  if (!rows.length) {
    return `<p class="codex-audit-empty">No audit entries yet.</p>`;
  }

  return `
    <div class="codex-audit-list">
      ${rows.map(row => `
        <button class="codex-audit-entry" type="button" onclick="openCodexAuditEntryModal('${escapeJsString(row.id)}')">
          <strong>${escapeHtml(row.summary || "Campaign changed")}</strong>
          <span>${escapeHtml(row.actor_username || "Unknown user")} - ${escapeHtml(formatAuditTimestamp(row.created_at))}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getCodexAuditEntryById(entryId) {
  return (db?.auditLog || []).find(row => row.id === entryId) || null;
}

function renderAuditMetadata(metadata) {
  const entries = Object.entries(metadata || {});
  if (!entries.length) {
    return `<p>No additional details recorded.</p>`;
  }

  const changedFields = metadata?.changed_fields || {};
  const changedFieldEntries = Object.entries(changedFields);
  const filteredEntries = entries.filter(([key]) => key !== "changed_fields");

  return `
    ${changedFieldEntries.length
      ? `<h3 class="codex-audit-modal-subhead">Changed Fields</h3>`
      : `<p>No field details recorded for this entry.</p>`}
    <dl class="codex-audit-metadata-list">
      ${changedFieldEntries.map(([key, value]) => `
        <dt>${escapeHtml(key.replaceAll("_", " "))}</dt>
        <dd>${escapeHtml(JSON.stringify(value?.old))} -> ${escapeHtml(JSON.stringify(value?.new))}</dd>
      `).join("")}
      ${filteredEntries.map(([key, value]) => `
        <dt>${escapeHtml(key.replaceAll("_", " "))}</dt>
        <dd>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value))}</dd>
      `).join("")}
    </dl>
  `;
}

function openCodexAuditEntryModal(entryId) {
  const entry = getCodexAuditEntryById(entryId);
  if (!entry) return;

  closeCodexAuditListModal();

  const modal = document.getElementById("codex-audit-entry-modal");
  const title = document.getElementById("codex-audit-entry-title");
  const meta = document.getElementById("codex-audit-entry-meta");
  const body = document.getElementById("codex-audit-entry-body");

  if (!modal || !title || !meta || !body) return;

  title.textContent = entry.summary || "Audit Entry";
  meta.textContent = [
    entry.actor_username || "Unknown user",
    formatAuditTimestamp(entry.created_at)
  ].filter(Boolean).join(" - ");

  body.innerHTML = `
    <p><strong>Action:</strong> ${escapeHtml(entry.action || "changed")}</p>
    <p><strong>Target:</strong> ${escapeHtml(entry.target_type || "campaign")}</p>
    ${renderAuditMetadata(entry.metadata)}
  `;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeCodexAuditEntryModal() {
  const modal = document.getElementById("codex-audit-entry-modal");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
}

function renderCodexAuditRailBlock() {
  if (!isCodexAuditVisible()) return "";

  return `
    <section class="codex-audit-rail-block">
      <div class="codex-row codex-audit-rail-heading">
        <span class="codex-row-icon" aria-hidden="true">${getCodexIcon?.("journal") || ""}</span>
        <span class="codex-row-main">
          <span class="codex-row-title">Audit</span>
        </span>
        <span class="codex-row-count">${escapeHtml(String(db?.auditLog?.length || 0))}</span>
      </div>
      ${renderCodexAuditRows()}
    </section>
  `;
}

function renderCodexAuditIndexButton({ title = "Audit", targetTypes = [] } = {}) {
  if (!isCodexAuditVisible()) return "";

  const rows = getCodexAuditRows({ targetTypes });
  return `
    <button
      class="codex-audit-index-button"
      type="button"
      onclick="openCodexAuditListModal('${escapeJsString(title)}', '${escapeJsString(targetTypes.join(","))}')"
    >
      Audit
      <span>${escapeHtml(String(rows.length))}</span>
    </button>
  `;
}

function renderCodexAuditListModalRows(rows) {
  if (!rows.length) {
    return `<p class="codex-audit-empty">No audit entries yet.</p>`;
  }

  return `
    <div class="codex-audit-list">
      ${rows.map(row => `
        <button class="codex-audit-entry" type="button" onclick="openCodexAuditEntryModal('${escapeJsString(row.id)}')">
          <strong>${escapeHtml(row.summary || "Campaign changed")}</strong>
          <span>${escapeHtml(row.actor_username || "Unknown user")} - ${escapeHtml(formatAuditTimestamp(row.created_at))}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function openCodexAuditListModal(title, targetTypesCsv = "") {
  const targetTypes = targetTypesCsv.split(",").map(type => type.trim()).filter(Boolean);
  const rows = getCodexAuditRows({ targetTypes }).slice(0, 50);
  const modal = document.getElementById("codex-audit-list-modal");
  const titleEl = document.getElementById("codex-audit-list-title");
  const body = document.getElementById("codex-audit-list-body");

  if (!modal || !titleEl || !body) return;

  titleEl.textContent = title || "Audit";
  body.innerHTML = renderCodexAuditListModalRows(rows);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeCodexAuditListModal() {
  const modal = document.getElementById("codex-audit-list-modal");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
}

function appendCodexAuditDetailRail(items, sectionsHtml, options = {}) {
  if (!isCodexAuditVisible()) {
    return { items, sectionsHtml };
  }

  const rows = getCodexAuditRows(options);

  return {
    items: [
      ...items,
      {
        id: "codex-detail-audit",
        label: "Audit",
        icon: getCodexIcon?.("journal") || "",
        count: rows.length
      }
    ],
    sectionsHtml: [
      sectionsHtml,
      renderCodexDetailRailSection(
        "codex-detail-audit",
        "Audit",
        renderCodexAuditRows(12, options)
      )
    ].join("")
  };
}

window.isActiveCampaignOwner = isActiveCampaignOwner;
window.isCodexAuditVisible = isCodexAuditVisible;
window.setCodexAuditVisible = setCodexAuditVisible;
window.toggleCodexAuditLog = toggleCodexAuditLog;
window.renderCodexAuditRailBlock = renderCodexAuditRailBlock;
window.renderCodexAuditIndexButton = renderCodexAuditIndexButton;
window.appendCodexAuditDetailRail = appendCodexAuditDetailRail;
window.openCodexAuditEntryModal = openCodexAuditEntryModal;
window.closeCodexAuditEntryModal = closeCodexAuditEntryModal;
window.openCodexAuditListModal = openCodexAuditListModal;
window.closeCodexAuditListModal = closeCodexAuditListModal;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("codex-audit-entry-close")
    ?.addEventListener("click", closeCodexAuditEntryModal);
  document.getElementById("codex-audit-list-close")
    ?.addEventListener("click", closeCodexAuditListModal);
});
