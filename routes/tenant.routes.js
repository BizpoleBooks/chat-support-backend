
const express = require("express");
const router = express.Router();

const {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
} = require("../services/tenant.service");

// ============================
// 📄 GET ALL
// ============================
router.get("/", async (req, res) => {
  const data = await getAllTenants();
  res.json(data);
});

// ============================
// 📄 GET SINGLE
// ============================
router.get("/:id", async (req, res) => {
  const tenant = await getTenantById(req.params.id);
  if (!tenant) return res.status(404).json({ message: "Not found" });
  res.json(tenant);
});

// ============================
// ➕ CREATE
// ============================
router.post("/", async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: "Name and slug required" });
    }

    const insertId = await createTenant(name, slug);

    res.json({
      message: "Tenant created successfully",
      id: insertId,
    });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Slug already exists" });
    }

    console.error(err);
    res.status(500).json({ message: "Create failed" });
  }
});

// ============================
// ✏️ UPDATE
// ============================
router.put("/:id", async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: "Name and slug required" });
    }

    const existing = await getTenantById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const updated = await updateTenant(req.params.id, name, slug);

    res.json({
      message: "Tenant updated successfully",
      data: updated,
    });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Slug already exists" });
    }

    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
});

// ============================
// ❌ DELETE
// ============================
router.delete("/:id", async (req, res) => {
  await deleteTenant(req.params.id);

  res.json({
    message: "Tenant deleted successfully",
  });
});

module.exports = router;
