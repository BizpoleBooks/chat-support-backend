const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { db } = require("../config/database");
const {
  addKnowledge,
  searchKnowledge,
  getAllKnowledge,
  getKnowledgeById,
  updateKnowledge,
  deleteKnowledge,
} = require("../services/knowledge.service");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});


// ============================
// 🔎 SEARCH (IMPORTANT: ABOVE :id)
// ============================
router.get("/search", async (req, res) => {
  const { q } = req.query;
  const tenantId = req.tenantId;

  if (!q || !tenantId) return res.json([]);

  const results = await searchKnowledge(q, tenantId);
  res.json(results);
});

router.get("/quick-actions", async (req, res) => {
  const tenantId = req.tenantId;

  const [rows] = await db.query(
    `SELECT id, title, content, quick_action_label 
     FROM knowledge_base
     WHERE tenant_id = ? AND is_quick_action = 1`,
    [tenantId]
  );

  res.json(rows);
});

// ============================
// 📄 GET ALL
// ============================
router.get("/", async (req, res) => {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return res.status(400).json({ message: "Tenant required" });
  }

  const data = await getAllKnowledge(tenantId);
  res.json(data);
});



// ============================
// 📄 GET SINGLE
// ============================
router.get("/:id", async (req, res) => {
  const tenantId = req.tenantId;

  const data = await getKnowledgeById(req.params.id, tenantId);

  if (!data) return res.status(404).json({ message: "Not found" });

  res.json(data);
});


// ============================
// 📤 CREATE (UPLOAD)
// ============================
router.post("/upload", upload.array("files", 5), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { title, content } = req.body;
    const files = req.files;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant required" });
    }

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content required" });
    }

    // ✅ 1. Insert knowledge
    const knowledgeId = await addKnowledge({
      title,
      content,
      tenantId,
    });

    // ✅ 2. Upload files
    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = file.originalname.split(".")[0];

        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: "auto", // ✅ handles image + pdf
              folder: "knowledge_files",
              public_id: `${fileName}-${Date.now()}`, // ✅ readable name
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          ).end(file.buffer);
        });

await db.query(
  `INSERT INTO knowledge_files 
   (knowledge_id, file_url, file_type, public_id, file_name)
   VALUES (?, ?, ?, ?, ?)`,
  [
    knowledgeId, // or req.params.id in PUT
    uploadResult.secure_url,
    file.mimetype.startsWith("image") ? "image" : "pdf",
    uploadResult.public_id,
    file.originalname, // ✅ IMPORTANT
  ]
)
      }
    }

    res.json({ message: "Uploaded successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});
// ============================
// ✏️ UPDATE
// ============================
router.put("/:id", upload.array("files", 5), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { title, content } = req.body;
    const files = req.files;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant required" });
    }

    // ============================
    // ✅ PARSE REMOVE IDS (SAFE)
    // ============================
    let removeFileIds = [];

    if (req.body.removeFileIds) {
      try {
        const parsed = JSON.parse(req.body.removeFileIds);

        removeFileIds = parsed
          .map(id => Number(id))
          .filter(id => !isNaN(id));
      } catch (e) {
        console.error("removeFileIds parse error:", e);
      }
    }

    console.log("REMOVE IDS:", removeFileIds);

    // ============================
    // ✅ CHECK EXISTING
    // ============================
    const existing = await getKnowledgeById(req.params.id, tenantId);
    if (!existing) {
      return res.status(404).json({ message: "Not found" });
    }

    // ============================
    // ✅ UPDATE BASIC DATA
    // ============================
    await updateKnowledge(req.params.id, tenantId, {
      title,
      content,
    });

    // ============================
    // ❌ REMOVE FILES (FINAL FIX)
    // ============================
   if (removeFileIds.length > 0) {
  const [filesToDelete] = await db.query(
    `SELECT * FROM knowledge_files 
     WHERE id IN (?) AND knowledge_id = ?`,
    [removeFileIds, req.params.id]
  );

  console.log("FILES TO DELETE:", filesToDelete);

  // ✅ delete from cloudinary (FIXED)
  for (const file of filesToDelete) {
    if (file.public_id) {
      await cloudinary.uploader.destroy(file.public_id, {
        resource_type: file.file_type === "image" ? "image" : "raw",
      });
    }
  }

  // ✅ delete from DB
  await db.query(
    `DELETE FROM knowledge_files 
     WHERE id IN (?) AND knowledge_id = ?`,
    [removeFileIds, req.params.id]
  );
}

    // ============================
    // 📤 ADD NEW FILES
    // ============================
    if (files && files.length > 0) {
      for (const file of files) {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: "auto",
              folder: "knowledge_files",
              public_id: `${Date.now()}-${file.originalname}`,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          ).end(file.buffer);
        });

        await db.query(
          `INSERT INTO knowledge_files 
           (knowledge_id, file_url, file_type, public_id, file_name)
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.params.id,
            uploadResult.secure_url,
            file.mimetype.startsWith("image") ? "image" : "pdf",
            uploadResult.public_id,
            file.originalname,
          ]
        );
      }
    }

    // ============================
    // ✅ RETURN UPDATED DATA
    // ============================
    const updatedData = await getKnowledgeById(req.params.id, tenantId);

    res.json({
      message: "Updated successfully",
      data: updatedData,
    });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
});
// ============================
// ❌ DELETE
// ============================
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const existing = await getKnowledgeById(req.params.id, tenantId);

    if (!existing) {
      return res.status(404).json({ message: "Not found" });
    }

    await deleteKnowledge(req.params.id, tenantId);

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

router.put("/:id/quick-action", async (req, res) => {
  const tenantId = req.tenantId;
  const { is_quick_action, quick_action_label } = req.body;

  await db.query(
    `UPDATE knowledge_base 
     SET 
       is_quick_action = COALESCE(?, is_quick_action),
       quick_action_label = COALESCE(?, quick_action_label)
     WHERE id = ? AND tenant_id = ?`,
    [is_quick_action, quick_action_label, req.params.id, tenantId]
  );

  res.json({ message: "Quick action updated" });
});


module.exports = router;
