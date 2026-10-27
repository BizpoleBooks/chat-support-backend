const express = require("express");
const router = express.Router();

const {
  getAllPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  activatePrompt,
  deactivatePrompt,
} = require("../services/aiSettings.service");

// ============================
// 📄 GET ALL (TENANT SAFE)
// ============================
router.get("/", async (req, res) => {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return res.status(400).json({ message: "Tenant required" });
  }

  const prompts = await getAllPrompts(tenantId);
  res.json(prompts);
});

// ============================
// ➕ CREATE
// ============================
router.post("/", async (req, res) => {
  const tenantId = req.tenantId;
  const { name, system_prompt } = req.body;

  if (!tenantId) {
    return res.status(400).json({ message: "Tenant required" });
  }

  if (!name || !system_prompt) {
    return res.status(400).json({ message: "Name & Prompt required" });
  }

  await createPrompt(tenantId, name, system_prompt);

  res.json({ message: "Prompt created" });
});

// ============================
// ✏️ UPDATE
// ============================
router.put("/:id", async (req, res) => {
  const tenantId = req.tenantId;
  const { name, system_prompt } = req.body;

  await updatePrompt(tenantId, req.params.id, name, system_prompt);

  res.json({ message: "Prompt updated" });
});

// ============================
// ❌ DELETE
// ============================
router.delete("/:id", async (req, res) => {
  const tenantId = req.tenantId;

  await deletePrompt(tenantId, req.params.id);

  res.json({ message: "Prompt deleted" });
});

// ============================
// 🔥 ACTIVATE (one per tenant)
// ============================
router.post("/activate/:id", async (req, res) => {
  const tenantId = req.tenantId;

  await activatePrompt(tenantId, req.params.id);

  res.json({ message: "Prompt activated" });
});

// ============================
// 🚫 DEACTIVATE
// ============================
router.post("/deactivate/:id", async (req, res) => {
  const tenantId = req.tenantId;

  await deactivatePrompt(tenantId, req.params.id);

  res.json({ message: "Prompt deactivated" });
});

module.exports = router;
