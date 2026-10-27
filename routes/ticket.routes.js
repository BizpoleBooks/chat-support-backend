const express = require("express");
const router = express.Router();

const {
  createTicket,
  getAllTickets,
  getTicketById,
  getMessages,
  addMessage,
  updateStatus,
  getTicketByIdSecure
} = require("../services/ticket.service");

const { db } = require("../config/database");


// ==============================
// ✅ CREATE TICKET (USER)
// ==============================
router.post("/", async (req, res) => {
  try {
    const { subject, description, priority, tenantSlug, user } = req.body;

    const id = await createTicket({
      tenant_slug: tenantSlug,
      subject,
      description,
      priority,
      user_id: user?.id,
      name: user?.name,
      email: user?.email,
      phone: user?.phone
    });

    res.json({ id });
  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});


// ==============================
// ✅ USER ROUTES (IMPORTANT: FIRST)
// ==============================

// 👉 Get all tickets for a user
router.get("/user/list", async (req, res) => {
  try {
    const tenantSlug = req.headers["x-tenant-slug"];
    const user_id = req.query.user_id;

    if (!tenantSlug || !user_id) {
      return res.status(400).json({ error: "tenantSlug & user_id required" });
    }

    const [rows] = await db.query(
      `SELECT *
       FROM tickets
       WHERE tenant_slug = ?
       AND user_id = ?
       ORDER BY id DESC`,
      [tenantSlug, user_id]
    );

    res.json(rows);

  } catch (err) {
    console.error("User tickets error:", err);
    res.status(500).json({ error: "Failed to fetch user tickets" });
  }
});


// 👉 Get single ticket (secure)
router.get("/user/:id", async (req, res) => {
  try {
    const tenantSlug = req.headers["x-tenant-slug"];
    const user_id = req.query.user_id;

    const ticket = await getTicketByIdSecure(
      req.params.id,
      tenantSlug,
      user_id
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const messages = await getMessages(req.params.id);

    res.json({ ticket, messages });

  } catch (err) {
    console.error("User ticket detail error:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});


// ==============================
// 🧑‍💼 ADMIN ROUTES
// ==============================

// 👉 Get all tickets (admin)
router.get("/", async (req, res) => {
  try {
    const tickets = await getAllTickets();
    res.json(tickets);
  } catch (err) {
    console.error("Admin tickets error:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});


// 👉 Get ticket by id (admin)
router.get("/:id", async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    const messages = await getMessages(req.params.id);

    res.json({ ticket, messages });

  } catch (err) {
    console.error("Admin ticket detail error:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});


// ==============================
// 💬 REPLIES
// ==============================
router.post("/:id/reply", async (req, res) => {
  try {
    const { message, sender } = req.body;

    await addMessage({
      ticket_id: req.params.id,
      sender,
      message,
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ error: "Failed to send reply" });
  }
});


// ==============================
// 🔄 UPDATE STATUS
// ==============================
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    await updateStatus(req.params.id, status);

    res.json({ success: true });

  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});


module.exports = router;