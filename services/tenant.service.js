const { db } = require("../config/database");

// 📄 GET ALL
async function getAllTenants() {
  const [rows] = await db.query(
    "SELECT id, name, slug, created_at FROM tenants ORDER BY id DESC"
  );
  return rows;
}

// 📄 GET SINGLE
async function getTenantById(id) {
  const [rows] = await db.query(
    "SELECT id, name, slug, created_at FROM tenants WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

// ➕ CREATE
async function createTenant(name, slug) {
  const [result] = await db.query(
    "INSERT INTO tenants (name, slug) VALUES (?, ?)",
    [name, slug]
  );
  return result.insertId;
}
async function getTenantIdBySlug(slug) {
  const [rows] = await db.query(
    "SELECT id FROM tenants WHERE slug = ?",
    [slug]
  );

  if (!rows.length) return null;

  return rows[0].id;
}
// ✏️ UPDATE
async function updateTenant(id, name, slug) {
  await db.query(
    "UPDATE tenants SET name = ?, slug = ? WHERE id = ?",
    [name, slug, id]
  );
  return getTenantById(id);
}

// ❌ DELETE
async function deleteTenant(id) {
  await db.query(
    "DELETE FROM tenants WHERE id = ?",
    [id]
  );
  return true;
}

module.exports = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantIdBySlug
};
