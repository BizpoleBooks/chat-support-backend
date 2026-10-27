const { db } = require("../config/database");

// Save message
async function saveChatMessage({
  session_id,
  tenant_slug,
  product_slug, // ✅ ADD THIS
  sender,
  message,
  user_id,
  name,
  email,
  phone
}) {

  await db.query(
    `INSERT INTO chat_messages
    (session_id, tenant_slug, product_slug, sender, message, user_id, name, email, phone, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 DAY))`,
    [
      session_id,
      tenant_slug,
      product_slug || null, // ✅ ADD THIS
      sender,
      message,
      user_id || null,
      name || null,
      email || null,
      phone || null
    ]
  );
}

// Get messages of one session
async function getChatHistory(session_id, tenant_slug) {
  const [rows] = await db.query(
    `SELECT sender, message, created_at
     FROM chat_messages
     WHERE session_id = TRIM(?)
     AND TRIM(tenant_slug) = TRIM(?)
     AND expires_at > NOW()
     ORDER BY id ASC`,
    [session_id, tenant_slug]
  );

  return rows;
}

// ⭐ NEW — Get session list
async function getChatSessions(tenant_slug, user_id) {

  const [rows] = await db.query(
    `SELECT 
        session_id,
        SUBSTRING_INDEX(
          GROUP_CONCAT(message ORDER BY created_at ASC),
          ',', 
          1
        ) AS title,
        MAX(expires_at) AS expires_at,
        MIN(created_at) AS created_at
     FROM chat_messages
     WHERE tenant_slug = ?
     AND user_id = ?
     GROUP BY session_id
     HAVING MAX(expires_at) > NOW()
     ORDER BY created_at DESC`,
    [tenant_slug, user_id]
  );

  return rows;
}
// ⭐ Admin — Get all sessions from all tenants
async function getAllChatSessions() {
 const [rows] = await db.query(`
  SELECT 
    session_id,
    tenant_slug,

    -- ✅ PRODUCT (NEW)
    MAX(product_slug) as product_slug,

    MAX(name) as name,
    MAX(email) as email,
    MAX(phone) as phone,

    SUBSTRING_INDEX(
      GROUP_CONCAT(message ORDER BY created_at ASC SEPARATOR '|||'),
      '|||', 
      1
    ) AS title,

    SUBSTRING_INDEX(
      GROUP_CONCAT(message ORDER BY created_at DESC SEPARATOR '|||'),
      '|||', 
      1
    ) AS last_message,

    MAX(created_at) AS last_message_time,
    MIN(created_at) AS created_at,
    COUNT(*) AS message_count

  FROM chat_messages
  GROUP BY session_id, tenant_slug
  ORDER BY last_message_time DESC
`);

  return rows;
}
module.exports = {
  saveChatMessage,
  getChatHistory,
  getChatSessions,
    getAllChatSessions
};