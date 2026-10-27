const { db } = require("../config/database");

// ✅ Get active system prompt (tenant isolated)
async function getSystemPrompt(tenantId) {
  const [rows] = await db.query(
    `
    SELECT system_prompt
    FROM ai_settings
    WHERE tenant_id = ? AND is_active = 1
    LIMIT 1
    `,
    [tenantId]
  );

  return rows.length ? rows[0].system_prompt : "";
}

// ✅ Get all prompts for tenant
async function getAllPrompts(tenantId) {
  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_settings
    WHERE tenant_id = ?
    ORDER BY id DESC
    `,
    [tenantId]
  );
  return rows;
}

// ✅ Create
async function createPrompt(tenantId, name, system_prompt) {
  await db.query(
    `
    INSERT INTO ai_settings (name, system_prompt, is_active, tenant_id)
    VALUES (?, ?, 0, ?)
    `,
    [name, system_prompt, tenantId]
  );
}

// ✅ Update (TENANT SAFE)
async function updatePrompt(tenantId, id, name, system_prompt) {
  await db.query(
    `
    UPDATE ai_settings
    SET name = ?, system_prompt = ?
    WHERE id = ? AND tenant_id = ?
    `,
    [name, system_prompt, id, tenantId]
  );
}

// ✅ Delete (TENANT SAFE)
async function deletePrompt(tenantId, id) {
  await db.query(
    `
    DELETE FROM ai_settings
    WHERE id = ? AND tenant_id = ?
    `,
    [id, tenantId]
  );
}

// ✅ Activate one prompt per tenant
async function activatePrompt(tenantId, id) {
  await db.query(
    `
    UPDATE ai_settings
    SET is_active = CASE
      WHEN id = ? THEN 1
      ELSE 0
    END
    WHERE tenant_id = ?
    `,
    [id, tenantId]
  );
}

// ✅ Deactivate (tenant safe)
async function deactivatePrompt(tenantId, id) {
  await db.query(
    `
    UPDATE ai_settings
    SET is_active = 0
    WHERE id = ? AND tenant_id = ?
    `,
    [id, tenantId]
  );
}

module.exports = {
  getSystemPrompt,
  getAllPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  activatePrompt,
  deactivatePrompt,
};
