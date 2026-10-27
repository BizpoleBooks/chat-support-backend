const { db } = require("../config/database");

async function tenantMiddleware(req, res, next) {
  const slug = req.headers["x-tenant-slug"];

  if (!slug) {
    return res.status(400).json({ message: "Tenant slug required" });
  }

  const [rows] = await db.query(
    "SELECT id FROM tenants WHERE slug = ? LIMIT 1",
    [slug]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Tenant not found" });
  }

  req.tenantId = rows[0].id;

  // ⭐ ADD THIS LINE
  req.tenantSlug = slug;

  next();
}

module.exports = tenantMiddleware;