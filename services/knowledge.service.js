const { db } = require("../config/database");


// 🔎 SEARCH
async function searchKnowledge(query, tenantId) {
  if (!query || !tenantId) return [];

  const [rows] = await db.query(
    `
    SELECT 
      k.id,
      k.title,
      k.content,
      f.id AS file_id,
      f.file_url,
      f.file_type,
      f.file_name,
      MATCH(k.title, k.content) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
    FROM knowledge_base k
    LEFT JOIN knowledge_files f 
      ON k.id = f.knowledge_id
    WHERE k.tenant_id = ?
      AND MATCH(k.title, k.content) AGAINST(? IN NATURAL LANGUAGE MODE)
    ORDER BY score DESC
    LIMIT 5
    `,
    [query, tenantId, query]
  );

let filteredRows = rows;

// ✅ only filter if strong signals exist
if (rows.length > 0 && rows[0].score > 0.2) {
  filteredRows = rows.filter(r => r.score > 0.15);
}

  const map = {};

for (const row of filteredRows) {
    if (!map[row.id]) {
      map[row.id] = {
        id: row.id,
        title: row.title,
        content: row.content,
        files: [],
        _fileSet: new Set(),
      };
    }

    const item = map[row.id];

    if (row.file_id && row.file_url && !item._fileSet.has(row.file_url)) {
      item._fileSet.add(row.file_url);

      item.files.push({
        file_url: row.file_url,
        file_type: row.file_type,
        file_name: row.file_name,
      });
    }
  }

  return Object.values(map).map(item => {
    delete item._fileSet;
    return item;
  });
}


// ➕ CREATE
async function addKnowledge({ title, content, pdf_url, tenantId }) {
  const [result] = await db.query(
    `
    INSERT INTO knowledge_base 
    (title, content, pdf_url, tenant_id)
    VALUES (?, ?, ?, ?)
    `,
    [title, content, pdf_url, tenantId]
  );

  return result.insertId;
}



// 📄 GET ALL
async function getAllKnowledge(tenantId) {
  const [rows] = await db.query(
    `SELECT * FROM knowledge_base WHERE tenant_id = ?`,
    [tenantId]
  );

  for (let row of rows) {
const [files] = await db.query(
  `SELECT id, file_url, file_type, file_name 
   FROM knowledge_files 
   WHERE knowledge_id = ?`,
  [row.id]
);

    row.files = files;
  }

  return rows;
}

// 📄 GET SINGLE
async function getKnowledgeById(id, tenantId) {
  const [rows] = await db.query(
    `SELECT * FROM knowledge_base WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  if (!rows.length) return null;

  const knowledge = rows[0];

 const [files] = await db.query(
  `SELECT id, file_url, file_type, file_name 
   FROM knowledge_files 
   WHERE knowledge_id = ?`,
  [id]
);

  knowledge.files = files;

  return knowledge;
}


// ✏️ UPDATE
async function updateKnowledge(id, tenantId, data) {
  const existing = await getKnowledgeById(id, tenantId);
  if (!existing) return null;

  const updatedTitle = data.title ?? existing.title;
  const updatedContent = data.content ?? existing.content;
    const updatedQuick = data.is_quick_action ?? existing.is_quick_action;
  const updatedLabel = data.quick_action_label ?? existing.quick_action_label;
  let updatedPdf;

if (data.pdf_url === undefined) {
  updatedPdf = existing.pdf_url; // no change
} else {
  updatedPdf = data.pdf_url; // can be null ✅
}

  await db.query(
    `
    UPDATE knowledge_base
    SET 
      title = ?, 
      content = ?, 
      is_quick_action = ?, 
      quick_action_label = ?
    WHERE id = ? AND tenant_id = ?
    `,
    [updatedTitle, updatedContent, updatedQuick, updatedLabel, id, tenantId]
  );

  return getKnowledgeById(id, tenantId);
}


// ❌ DELETE
async function deleteKnowledge(id, tenantId) {
  await db.query(
    `
    DELETE FROM knowledge_base
    WHERE id = ? AND tenant_id = ?
    `,
    [id, tenantId]
  );

  return true;
}


module.exports = {
  searchKnowledge,
  addKnowledge,
  getAllKnowledge,
  getKnowledgeById,
  updateKnowledge,
  deleteKnowledge,
};
