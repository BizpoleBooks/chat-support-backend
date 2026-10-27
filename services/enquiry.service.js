const { db } = require("../config/database");

// ➕ CREATE ENQUIRY
async function createEnquiry({ tenantId, product, contact }) {
  const [result] = await db.query(
    `
    INSERT INTO enquiries (tenant_id, product, contact)
    VALUES (?, ?, ?)
    `,
    [tenantId, product, contact]
  );

  return result.insertId;
}

// 📄 GET ALL (admin use)
async function getAllEnquiries() {
  const [rows] = await db.query(
    `
    SELECT * FROM enquiries
    ORDER BY id DESC
    `
  );

  return rows;
}

module.exports = {
  createEnquiry,
  getAllEnquiries,
};