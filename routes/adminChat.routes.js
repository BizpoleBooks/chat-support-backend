const express = require("express");
const router = express.Router();
const { getAllChatSessions } = require("../services/chatHistory.service");

// Admin → all conversations
router.get("/", async (req, res) => {
  try {
    const sessions = await getAllChatSessions();
    res.json(sessions);
  } catch (err) {
    console.error("Admin sessions error:", err);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

module.exports = router;