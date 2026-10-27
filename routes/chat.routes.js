const express = require("express");
const multer = require("multer");

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const { askAI } = require("../services/ai.service");
const { searchKnowledge } = require("../services/knowledge.service");
const { resolveExternalContext } = require("../services/dataResolver.service");
const { saveChatMessage } = require("../services/chatHistory.service");
const { extractImageIssue } = require("../utils/imageText.util");
const { detectTicketIntent } = require("../services/ticketIntent.service");
const { findUserProduct } = require("../services/productVerification.service");
const { getTenantIdBySlug } = require("../services/tenant.service");
const { createEnquiry } = require("../services/enquiry.service");
const { detectProduct }  = require("../utils/detectProduct")
const router = express.Router();
const yesRegex = /^(yes|yeah|yep|ok|sure)/i;

const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phoneRegex = /\b\d{10}\b/;
router.post("/ask", upload.single("file"), async (req, res) => {
  try {
    // ✅ Extract tenant safely
 let tenantId = req.tenantId;
const { session_id } = req.body;
const { user_id, name, email, phone } = req.body;

    if (!tenantId) {
      return res.status(401).json({ text: "Unauthorized tenant" });
    }

    const { message } = req.body;

    const greetingRegex =
/^(hi|hello|hey|hii|good morning|good afternoon|good evening)\b/i;

if (greetingRegex.test(message)) {

  const greetingReply =
    "Hello! 👋 How can I help you today?";

  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
    product_slug: req.productSlug || null,
    sender: "bot",
    message: greetingReply,
  });

  return res.json({
    text: greetingReply,
    files: [],
    classification: "greeting",
  });
}
    const file = req.file;
    const { extractPdfText } = require("../utils/pdfText.util");

let pdfText = "";

if (file && file.mimetype === "application/pdf") {
 pdfText = await extractPdfText(file.buffer);

pdfText = pdfText
  .replace(/\s+/g, " ")
  .replace(/\b([a-z])\s([a-z]{2,})\b/gi, "$1$2") // fix broken words like L ogin -> Login
  .trim();

console.log("PDF TEXT LENGTH:", pdfText.length);
console.log("PDF SAMPLE:", pdfText.slice(0,200));
 
}
let imageText = "";

if (file && file.mimetype.startsWith("image/")) {
  imageText = await extractImageIssue(file);
}
if (message?.trim() || pdfText?.trim() || imageText?.trim()) {
  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
    product_slug: req.productSlug || null,
    sender: "user",
    message: message,
      user_id,
  name,
  email,
  phone
  });
}
    // 🔥 SAFE HISTORY PARSING
    let parsedHistory = [];

    if (req.body.history) {
      try {
        parsedHistory =
          typeof req.body.history === "string"
            ? JSON.parse(req.body.history)
            : req.body.history;

        if (!Array.isArray(parsedHistory)) {
          parsedHistory = [];
        }
      } catch (e) {
        console.error("History parse failed:", e);
        parsedHistory = [];
      }
    }

    if (!message?.trim() && !file) {
      return res.json({ text: "Ask something 🙂" });
    }
// ============================
// 🛒 PRODUCT ENQUIRY FLOW
// ============================

let product = detectProduct(message);

// 🔹 STEP 1: user mentions product
if (product) {
  const msg = `Great choice 👍 Do you want to register for ${product}?`;

  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
    sender: "bot",
    message: msg,
  });

  return res.json({
    text: msg,
    classification: "product_interest",
    product
  });
}

// 🔹 STEP 2: user says YES
if (yesRegex.test(message) && req.body.product) {
  const msg = "Please provide your email or phone number to continue.";

  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
    sender: "bot",
    message: msg,
  });

  return res.json({
    text: msg,
    classification: "collect_contact",
    product: req.body.product
  });
}

// 🔹 STEP 3: capture email/phone → save enquiry
const emailMatch = message.match(emailRegex)?.[0];
const phoneMatch = message.match(phoneRegex)?.[0];

if ((emailMatch || phoneMatch) && req.body.product) {

  await createEnquiry({
    tenantId,
    product: req.body.product,
    contact: emailMatch || phoneMatch
  });

  const productUrls = {
    books: "https://xxs3snf2-5174.inc1.devtunnels.ms/",
    consultant: "https://yourdomain.com/consultant",
    one: "https://yourdomain.com/one"
  };

  const msg = `✅  Redirecting you to ${req.body.product}...`;

  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
    sender: "bot",
    message: msg,
  });

  return res.json({
    text: msg,
    redirect: productUrls[req.body.product],
    classification: "enquiry_done"
  });
}
    // ✅ External resolver (if needed)
const externalContext =
  !pdfText && message
    ? await resolveExternalContext(message,req.tenantSlug)
    : "";
   // ============================
// ✅ MULTI-TENANT KNOWLEDGE SEARCH
// ============================
let knowledgeContext = "";
let files = [];

if (message?.trim() || pdfText?.trim() || imageText?.trim()) {
const shortPdfQuery = pdfText
  .toLowerCase()
  .replace(/[^\w\s]/g, "")
  .split(/\s+/)
  .filter(w => w.length > 3)
  .slice(0, 15)
  .join(" ");
const queryText =
  pdfText?.slice(0,200) ||
  imageText?.slice(0,200) ||
  message;
const results = await searchKnowledge(queryText, tenantId);

  // ✅ STEP 1: extra filtering (keyword safety)
const normalize = str =>
  str.toLowerCase().replace(/[^\w\s]/g, "");

const searchText = pdfText || imageText || message || "";
const queryWords = normalize(searchText).split(" ").filter(Boolean);

// ✅ smart relevance check
const isRelevant = (text) => {
  const t = normalize(text);

  let matchCount = 0;

  for (const word of queryWords) {
    if (word.length < 3) continue; // ignore small words like "a", "to"

    if (t.includes(word)) {
      matchCount++;
    }
  }

  return matchCount >= 1; // 🔥 tune: 1 = loose, 2 = strict
};

// ✅ apply filtering
let cleanResults = results.filter(r =>
  isRelevant(r.title) || isRelevant(r.content)
);

// ✅ FALLBACK (VERY IMPORTANT)
if (cleanResults.length === 0) {
  // ❌ DO NOT attach files
  knowledgeContext = "";
  files = [];
}

  if (cleanResults.length > 0) {
    // ✅ STEP 2: build context (top 3)
    knowledgeContext = cleanResults
      .slice(0, 3)
      .map((r, i) => `
[DOC ${i + 1}]
Title: ${r.title}
${r.content}
`)
      .join("\n\n");

    // ✅ STEP 3: attach ONLY best match files
const best = cleanResults[0];

const mainWord = (pdfText || imageText || message || "")
  .toLowerCase()
  .replace(/[^\w\s]/g, "")
  .trim()
  .split(/\s+/)[0] || "";

const strongMatch =
  best &&
  best.title.toLowerCase().includes(mainWord);

files = strongMatch
  ? (best.files || []).map(f => ({
      name: f.file_name,
      type: f.file_type === "image" ? "image/png" : "application/pdf",
      url: f.file_url,
    }))
  : [];
  }
}
let ticketIntent = "normal";

if (message && message.length < 120) {
  ticketIntent = await detectTicketIntent(message, tenantId);
}

const isAnonymous = !user_id;

// ✅ VERIFY FIRST
if ((emailMatch || phoneMatch) && !req.verifiedUser && !req.body.product) {

  const result = await findUserProduct(
    emailMatch || email,
    phoneMatch || phone
  );

  if (!result) {
    return res.json({
      text: "This email or phone number is not registered with any of our products.",
      classification: "not_registered"
    });
  }

  const resolvedTenantId = await getTenantIdBySlug(result.product);

  if (!resolvedTenantId) {
    return res.status(400).json({ text: "Invalid tenant mapping" });
  }

  req.verifiedUser = result.user;
  req.productTenantId = resolvedTenantId;
  req.productSlug = result.product;
}

// ✅ NOW CHECK
if (!tenantId) {
  return res.status(401).json({ text: "Unauthorized tenant" });
}
// ✅ FORCE TICKET FLOW AFTER EMAIL VERIFICATION
if (ticketIntent === "raise_ticket" || (isAnonymous && req.verifiedUser)) {

  // 🟡 Ask email first
  if (isAnonymous && !email && !phone) {
 const msg = "Before raising a ticket, please provide your registered email or phone number.";

await saveChatMessage({
  session_id,
  tenant_slug: req.tenantSlug,
  product_slug: req.productSlug || null,
  sender: "bot",
  message: msg,
});

return res.json({
  text: msg,
  classification: "collect_user_for_ticket"
});
  }

  // 🔴 BLOCK if NOT verified
  if (isAnonymous && !req.verifiedUser) {
  const msg = "This email or phone number is not registered with any of our products.";

await saveChatMessage({
  session_id,
  tenant_slug: req.tenantSlug,
  product_slug: req.productSlug || null,
  sender: "bot",
  message: msg,
});

return res.json({
  text: msg,
  classification: "not_registered"
});
  }

  // ✅ ALWAYS RETURN THIS AFTER EMAIL VERIFIED
const botMessage = "Please describe your issue so our support team can assist you.";

await saveChatMessage({
  session_id,
  tenant_slug: req.tenantSlug,
  product_slug: req.productSlug || null,
  sender: "bot",
  message: botMessage,
});

return res.json({
  text: botMessage,
  classification: "raise_ticket"
});
}
    // ✅ MULTI-TENANT AI CALL
let reply = await askAI({
  tenantId: req.productTenantId || tenantId,
  question: message ||
    imageText || "A user uploaded a document describing a problem.",
  context: `
INTERNAL KNOWLEDGE:
${knowledgeContext}

EXTERNAL CONTEXT:
${externalContext}
  `,
  history: parsedHistory,
  file,
  pdfText
});

let classification = "kb";

const fallbackText =
  "Sorry, I don’t have that information. Please contact the support team.";

// detect if this conversation already had KB context
const hadPreviousProductContext =
  parsedHistory && parsedHistory.some(h =>
    h.role === "assistant" &&
    h.text &&
    !h.text.includes("I can help with HelpDeskPro related questions")
  );

// 1️⃣ Product-related but no answer → escalate
if (reply.trim() === fallbackText && hadPreviousProductContext) {
  classification = "kb_no_answer";
}

// 2️⃣ Fresh unrelated (only if no previous product flow)
else if (!knowledgeContext && !externalContext && !hadPreviousProductContext) {
  classification = "unrelated";
}
if (reply) {
  await saveChatMessage({
    session_id,
    tenant_slug: req.tenantSlug,
      product_slug: req.productSlug || null,
    sender: "bot",
    message: reply,
  });
}
 return res.json({
  text: reply,
  files,
  classification, // 🔥 IMPORTANT
});

  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    res.status(500).json({ text: "System error ⚠️" });
  }
});

module.exports = router;
