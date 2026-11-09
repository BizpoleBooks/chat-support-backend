const express = require("express");
const cors = require("cors");

const chatRoutes = require("./routes/chat.routes");
const tenantMiddleware = require("./middleware/testTenant");
const chatHistoryRoutes = require("./routes/chatHistory.routes");
const adminChatRoutes = require("./routes/adminChat.routes");
const enquiryRoutes = require("./routes/enquiry.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const app = express();

app.use(cors());
app.use(express.json());

// 🔥 MULTI-TENANT TEST MODE


// Public routes (NO tenant required)
app.use("/api/tenants", require("./routes/tenant.routes"));

// Tenant protected routes
app.use("/api/knowledge", tenantMiddleware, require("./routes/knowledge.routes"));
app.use("/api/chat", tenantMiddleware, chatRoutes);
app.use("/api/chat-history", tenantMiddleware, chatHistoryRoutes);
app.use("/api/admin/ai", tenantMiddleware, require("./routes/admin.ai.routes"));
app.use("/api/admin/chat-history", adminChatRoutes);
app.use("/api/admin/enquiries", enquiryRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
// Other routes
app.use("/api/tickets", require("./routes/ticket.routes"));

// Errors that reach Express (e.g. upload too large, DB down while resolving the tenant)
// get a JSON body instead of the default HTML page with a stack trace
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ text: "The file is too large. Please attach a file under 10 MB." });
  }
  if (err.name === "MulterError") {
    return res.status(400).json({ text: "Please attach a single PDF or image file." });
  }

  console.error("UNHANDLED ERROR:", err.message);
  res.status(err.status || 500).json({ text: "System error ⚠️" });
});


module.exports = app;
