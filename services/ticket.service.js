const { db } = require("../config/database");

// Create ticket
async function createTicket({
  tenant_slug,
  subject,
  description,
  priority,
  user_id,
  name,
  email,
  phone
}) {
  const [result] = await db.query(
    `INSERT INTO tickets
    (tenant_slug, subject, description, priority, user_id, name, email, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenant_slug,
      subject,
      description,
      priority || "medium",
      user_id || null,
      name || null,
      email || null,
      phone || null
    ]
  );

  return result.insertId;
}

// Get all tickets
async function getAllTickets() {
  const [rows] = await db.query(
    `SELECT * FROM tickets ORDER BY id DESC`
  );
  return rows;
}

// Get single ticket
async function getTicketById(id) {
  const [rows] = await db.query(
    `SELECT * FROM tickets WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}
async function getTicketByIdSecure(id, tenant_slug, user_id) {
  const [rows] = await db.query(
    `SELECT * FROM tickets
     WHERE id = ?
     AND tenant_slug = ?
     AND user_id = ?`,
    [id, tenant_slug, user_id]
  );

  return rows[0] || null;
}
// Get messages
async function getMessages(ticket_id) {
  const [rows] = await db.query(
    `SELECT * FROM ticket_messages
     WHERE ticket_id = ?
     ORDER BY id ASC`,
    [ticket_id]
  );
  return rows;
}

// Add reply
async function addMessage({ ticket_id, sender, message }) {
  await db.query(
    `INSERT INTO ticket_messages (ticket_id, sender, message)
     VALUES (?, ?, ?)`,
    [ticket_id, sender, message]
  );
}

// Update status
async function updateStatus(id, status) {
  await db.query(
    `UPDATE tickets SET status = ? WHERE id = ?`,
    [status, id]
  );
}

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  getMessages,
  addMessage,
  updateStatus,
  getTicketByIdSecure
};
