/**
 * Kadesh Codex Apps Script write-back prototype entrypoint.
 */

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "Kadesh Codex write-back prototype",
    version: getKadeshConfig().apiVersion,
    actions: [
      "createRecord",
      "updateRecord",
      "uploadFile",
      "uploadAndLinkFile",
      "createDmJournalEntry"
    ]
  });
}

function doPost(event) {
  try {
    const payload = parseRequest_(event);
    const action = requireAction_(payload);
    const actor = assertAuthorized_(payload);

    if (action === "createRecord") {
      return jsonResponse_(withWriteLock_(() => handleCreateRecord_(payload, actor)));
    }

    if (action === "updateRecord") {
      return jsonResponse_(withWriteLock_(() => handleUpdateRecord_(payload, actor)));
    }

    if (action === "uploadFile") {
      return jsonResponse_(withWriteLock_(() => handleUploadFile_(payload, actor)));
    }

    if (action === "uploadAndLinkFile") {
      return jsonResponse_(withWriteLock_(() => handleUploadAndLinkFile_(payload, actor)));
    }

    if (action === "createDmJournalEntry") {
      return jsonResponse_(withWriteLock_(() => handleCreateDmJournalEntry_(payload, actor)));
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: {
        message: error.message,
        name: error.name || "Error"
      }
    });
  }
}

function withWriteLock_(fn) {
  const lock = LockService.getDocumentLock();
  const acquired = lock.tryLock(30000);
  if (!acquired) {
    throw new Error("Could not acquire write lock. Try again.");
  }

  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function handleCreateRecord_(payload, actor) {
  const validated = validateCreatePayload_(payload);
  const entity = validated.entity;
  const id = entity.manualId
    ? sanitizeString_(validated.fields[entity.idField])
    : generateNextId_(entity);

  if (!id) {
    throw new Error(`${entity.idField} is required for ${entity.label}.`);
  }

  if (entityIdExists_(entity, id)) {
    throw new Error(`${entity.label} already exists with ${entity.idField}: ${id}`);
  }

  const fields = Object.assign({}, validated.fields, {
    [entity.idField]: id
  });

  const appended = appendEntityRow_(entity, addAuditFields_(fields, actor, true));

  return {
    ok: true,
    action: "createRecord",
    entityType: payload.entityType,
    id,
    rowNumber: appended.rowNumber,
    row: appended.row,
    actor
  };
}

function handleUpdateRecord_(payload, actor) {
  const validated = validateUpdatePayload_(payload);
  const updated = updateEntityRow_(
    validated.entity,
    validated.id,
    addAuditFields_(validated.fields, actor, false)
  );

  return {
    ok: true,
    action: "updateRecord",
    entityType: payload.entityType,
    id: validated.id,
    rowNumber: updated.rowNumber,
    row: updated.row,
    actor
  };
}

function handleUploadFile_(payload, actor) {
  const validated = validateUploadPayload_(payload);
  const upload = uploadFileToDrive_(validated.entity, validated.file, actor);

  return {
    ok: true,
    action: "uploadFile",
    entityType: payload.entityType,
    upload,
    actor
  };
}

function handleUploadAndLinkFile_(payload, actor) {
  const validated = validateUploadPayload_(payload);
  const upload = uploadFileToDrive_(validated.entity, validated.file, actor);

  if (!validated.linkTo) {
    return {
      ok: true,
      action: "uploadAndLinkFile",
      entityType: payload.entityType,
      upload,
      linked: false,
      warning: "No linkTo object supplied; uploaded file was not written to a sheet row.",
      actor
    };
  }

  assertObject_(validated.linkTo, "linkTo");
  const targetEntity = getEntityConfig_(validated.linkTo.entityType || payload.entityType);
  if (!targetEntity.assetField) {
    throw new Error(`${targetEntity.label} does not define an assetField.`);
  }

  const id = sanitizeString_(validated.linkTo.id);
  if (!id) throw new Error("linkTo.id is required.");

  const updated = updateEntityRow_(targetEntity, id, addAuditFields_({
    [targetEntity.assetField]: upload.fileId
  }, actor, false));

  return {
    ok: true,
    action: "uploadAndLinkFile",
    entityType: payload.entityType,
    linkedEntityType: validated.linkTo.entityType || payload.entityType,
    id,
    upload,
    rowNumber: updated.rowNumber,
    row: updated.row,
    actor
  };
}

function handleCreateDmJournalEntry_(payload, actor) {
  const validated = validateJournalPayload_(payload);
  const entity = validated.entity;
  const id = generateNextId_(entity);

  const baseFields = Object.assign({
    Timestamp: new Date(),
    Created_By: actor.actorEmail || "unknown"
  }, validated.fields, {
    [entity.idField]: id
  });

  const appended = appendEntityRow_(entity, addAuditFields_(baseFields, actor, true));

  return {
    ok: true,
    action: "createDmJournalEntry",
    entityType: "dmJournal",
    id,
    rowNumber: appended.rowNumber,
    row: appended.row,
    actor
  };
}

function addAuditFields_(fields, actor, isCreate) {
  const out = Object.assign({}, fields);
  const now = new Date();
  const actorEmail = actor && actor.actorEmail ? actor.actorEmail : "unknown";

  if (isCreate) {
    if (!Object.prototype.hasOwnProperty.call(out, "Created_At")) out.Created_At = now;
    if (!Object.prototype.hasOwnProperty.call(out, "Created_By")) out.Created_By = actorEmail;
  }

  if (!Object.prototype.hasOwnProperty.call(out, "Updated_At")) out.Updated_At = now;
  if (!Object.prototype.hasOwnProperty.call(out, "Updated_By")) out.Updated_By = actorEmail;

  return out;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
