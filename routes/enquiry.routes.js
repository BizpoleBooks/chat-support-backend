const express = require("express");
const router = express.Router();

const { createEnquiry, getAllEnquiries } = require("../services/enquiry.service");
const { getTenantIdBySlug } = require("../services/tenant.service");

// ============================
// ➕ CREATE ENQUIRY
// ============================
router.post("/", async (req, res) => {
  try {
    const { tenantSlug, product, contact } = req.body;

    if (!tenantSlug || !product || !contact) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const tenantId = await getTenantIdBySlug(tenantSlug);

    if (!tenantId) {
      return res.status(400).json({ message: "Invalid tenant" });
    }

    const id = await createEnquiry({
      tenantId,
      product,
      contact
    });

    res.json({
      message: "Enquiry saved",
      id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save enquiry" });
  }
});

// ============================
// 📄 GET ALL (ADMIN)
// ============================
router.get("/", async (req, res) => {
  try {
    const data = await getAllEnquiries(); // ❌ no tenantId

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch enquiries" });
  }
});

module.exports = router;