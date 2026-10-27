const express = require("express");
const router = express.Router();

const {
  saveChatMessage,
  getChatHistory,
  getChatSessions
} = require("../services/chatHistory.service");

// ⭐ Get chat sessions list
router.get("/sessions", async (req, res) => {

  const tenantSlug = req.tenantSlug;
  const userId = req.query.user_id;

  const sessions = await getChatSessions(tenantSlug, userId);

  res.json(sessions);

});

// Get messages
router.get("/:sessionId", async (req, res) => {

  const userId = req.query.user_id;

  const data = await getChatHistory(
    req.params.sessionId,
    req.tenantSlug,
    userId
  );

  res.json(data);

});

// Save message
router.post("/", async (req, res) => {

  const tenantSlug = req.tenantSlug;

  const {
    session_id,
    sender,
    message,
    user
  } = req.body;

  await saveChatMessage({
    session_id,
    tenant_slug: tenantSlug,
     product_slug: req.productSlug || null,
    sender,
    message,
    user_id: user?.id,
    name: user?.name,
    email: user?.email,
    phone: user?.phone
  });

  res.json({ success: true });

});

module.exports = router;