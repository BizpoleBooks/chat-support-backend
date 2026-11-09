const express = require("express");
const multer = require("multer");
const { isProviderError } = require("../config/llm");

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const { askAI, FALLBACK_TEXT } = require("../services/ai.service");
const { resolveExternalContext } = require("../services/dataResolver.service");
const { saveChatMessage } = require("../services/chatHistory.service");
const { extractImageIssue } = require("../utils/imageText.util");
const { detectTicketIntent } = require("../services/ticketIntent.service");
const { findUserProduct } = require("../services/productVerification.service");
const { getTenantIdBySlug } = require("../services/tenant.service");
const { createEnquiry } = require("../services/enquiry.service");
const { detectProduct } = require("../utils/detectProduct")
const { getProduct, tenantSlugForVerifiedProduct } = require("../config/products");
const { findRelevantKnowledge } = require("../services/knowledge.service");
const { toEnglishSearchQuery } = require("../services/searchQuery.service");
const { detectLanguage, localizedFallback, localizedGreeting, needsSearchTranslation } = require("../utils/language.util");
const { isGreetingOnly, withoutGreeting } = require("../utils/greeting.util");

// Claude vision accepts only these image types
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const router = express.Router();
const yesRegex = /^(yes|yeah|yep|ok|okay|sure)\b/i;

const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phoneRegex = /\b\d{10}\b/;
router.post("/ask", upload.single("file"), async (req, res) => {
  try {
    // ✅ Extract tenant safely
    let tenantId = req.tenantId;
    const { session_id } = req.body;
    const { user_id, name, email, phone } = req.body;

    console.log(tenantId,'tenantId>>>>>>>>');
    console.log(session_id,'session_id>>>>>>>>');
    console.log(user_id,'user_id>>>>>>>>');
    console.log(name,'name>>>>>>>>');
    console.log(email,'email>>>>>>>>');
    console.log(phone,'phone>>>>>>>>');
    

    if (!tenantId) {
      return res.status(401).json({ text: "Unauthorized tenant" });
    }

    const message = typeof req.body.message === "string" ? req.body.message : "";

    console.log(message,'message>>>>>>>');
    

    // Only a bare greeting; "hi, I can't log in" goes through the full flow.
    // Greetings this doesn't recognise reach askAI, which also replies to them politely.
    if (!req.file && isGreetingOnly(message)) {

      // In a greeting "hai" is "hi", not the Hinglish "hai" that detectLanguage counts
      const greetingReply = localizedGreeting(detectLanguage(message.replace(/\bh+a+i+\b/gi, "")));

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

    if (file && file.mimetype !== "application/pdf" && !IMAGE_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        text: "Please attach a PDF or an image (PNG, JPG, GIF or WebP).",
      });
    }

    let pdfText = "";

    if (file && file.mimetype === "application/pdf") {
      pdfText = await extractPdfText(file.buffer);

      pdfText = pdfText
        .replace(/\s+/g, " ")
        .replace(/\b([a-z])\s([a-z]{2,})\b/gi, "$1$2") // fix broken words like L ogin -> Login
        .trim();

      console.log("PDF TEXT LENGTH:", pdfText.length);

    }
    let imageText = "";

    if (file && IMAGE_TYPES.includes(file.mimetype)) {
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

        // Client-supplied: keep only {role, text} turns with string text
        parsedHistory = parsedHistory.filter(
          h => h && typeof h === "object" && typeof h.text === "string"
        );
      } catch (e) {
        console.error("History parse failed:", e);
        parsedHistory = [];
      }
    }

    if (!message?.trim() && !file) {
      return res.json({ text: "Ask something 🙂" });
    }

    // Reply language comes from this message (or recent ones if it's too short to tell)
    const language = detectLanguage(message, parsedHistory);

    console.log(language,'detect language>>>>>>>>');
    
    // ============================
    // 🛒 PRODUCT ENQUIRY FLOW
    // ============================
    // STEP 1 (user asks about a product) runs after the knowledge search below,
    // so the product is first explained from the tenant's knowledge base.

    const enquiryProduct = getProduct(req.body.product);
    console.log(enquiryProduct,'enquiryProduct>>>>>>>>');
    

    // 🔹 STEP 2: user says YES
    if (yesRegex.test(message || "") && enquiryProduct) {
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
        product: enquiryProduct.key
      });
    }

    // 🔹 STEP 3: capture email/phone → save enquiry
    const emailMatch = (message || "").match(emailRegex)?.[0];
    const phoneMatch = (message || "").match(phoneRegex)?.[0];

    if ((emailMatch || phoneMatch) && enquiryProduct) {

      await createEnquiry({
        tenantId,
        product: enquiryProduct.key,
        contact: emailMatch || phoneMatch
      });

      const msg = `✅  Redirecting you to ${enquiryProduct.title}...`;

      await saveChatMessage({
        session_id,
        tenant_slug: req.tenantSlug,
        sender: "bot",
        message: msg,
      });

      return res.json({
        text: msg,
        redirect: enquiryProduct.url,
        classification: "enquiry_done"
      });
    }
    // ✅ External resolver (if needed)
    const externalContext =
      !pdfText && message
        ? await resolveExternalContext(message, req.tenantSlug)
        : "";
    // ============================
    // ✅ MULTI-TENANT KNOWLEDGE SEARCH
    // ============================
    let knowledgeContext = "";
    let files = [];
    let cleanResults = [];

    if (message?.trim() || pdfText?.trim() || imageText?.trim()) {
      // "Hi, how do I create an invoice?" is searched as "how do I create an invoice?"
      const question = withoutGreeting(message);

      let queryText =
        pdfText?.slice(0, 200) ||
        imageText?.slice(0, 200) ||
        question;

      // Previous user turn, used to resolve follow-ups like "how much does it cost?"
      const previousUserMessage = [...parsedHistory]
        .reverse()
        .find(h => h && h.role === "user" && typeof h.text === "string" && h.text.trim() && h.text.trim() !== message.trim())
        ?.text;

      // The KB is indexed in English: rewrite other languages into an English query first
      if (!pdfText && !imageText && needsSearchTranslation(language)) {
        try {
          queryText = (await toEnglishSearchQuery(question, previousUserMessage, tenantId)) || question;
        } catch (e) {
          console.error("Search query translation failed:", e.message);
        }
      }

      // ✅ STEP 1: FULLTEXT search + keyword safety filter (PDFs are checked against their full text)
      cleanResults = await findRelevantKnowledge(queryText, tenantId, pdfText || queryText);

      // Short follow-up with no match of its own: search together with the previous question
      if (!cleanResults.length && !pdfText && !imageText && previousUserMessage &&
        !needsSearchTranslation(language) && question.split(/\s+/).length <= 8) {
        cleanResults = await findRelevantKnowledge(`${previousUserMessage} ${question}`, tenantId);
      }

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

        const mainWord = (pdfText || imageText || queryText || "")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, "")
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
      try {
        ticketIntent = await detectTicketIntent(message, tenantId);
      } catch (e) {
        // A failed classification shouldn't block the answer; treat it as a normal question
        console.error("Ticket intent failed:", e.message);
      }
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

      const resolvedTenantId = await getTenantIdBySlug(
        tenantSlugForVerifiedProduct(result.product)
      );

      if (!resolvedTenantId) {
        return res.status(400).json({ text: "Invalid tenant mapping" });
      }

      req.verifiedUser = result.user;
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
    // Always the requesting tenant: its prompt must match the knowledge searched above
    let reply = await askAI({
      tenantId,
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
      pdfText,
      language
    });

    let classification = "kb";

    const fallbackText = FALLBACK_TEXT;

    // detect if this conversation already had KB context
    const hadPreviousProductContext =
      parsedHistory && parsedHistory.some(h =>
        h.role === "assistant" &&
        h.text &&
        !h.text.includes("I can help with HelpDeskPro related questions")
      );

    // 1️⃣ Product-related but no answer → escalate
    const sameText = (a, b) => a.replace(/[’‘]/g, "'").trim() === b.replace(/[’‘]/g, "'").trim();

    if (sameText(reply, fallbackText) && hadPreviousProductContext) {
      classification = "kb_no_answer";
    }

    // 2️⃣ Fresh unrelated (only if no previous product flow)
    else if (!knowledgeContext && !externalContext && !hadPreviousProductContext) {
      classification = "unrelated";
    }

    // 🔹 PRODUCT STEP 1: product explained from KB → offer registration
    const askedProduct = !sameText(reply, fallbackText) && detectProduct(message, cleanResults);
    let product;

    if (askedProduct) {
      classification = "product_interest";
      product = askedProduct.key;
      reply = `${reply}\n\nWould you like to register for ${askedProduct.title}?`;
    }

    // The model answers "not found" with the English FALLBACK_TEXT; show it in the user's language
    if (sameText(reply, fallbackText)) {
      reply = localizedFallback(language, fallbackText);
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
      product,
    });

  } catch (err) {
    // Claude and Groq unreachable, rejected (billing, key, rate limit) or timed out
    if (isProviderError(err)) {
      console.error("AI PROVIDER ERROR:", err.status, err.message);
      return res.status(503).json({
        text: "Our assistant is temporarily unavailable. Please try again in a few minutes or contact the support team.",
      });
    }

    console.error("CHAT ROUTE ERROR:", err);
    res.status(500).json({ text: "System error ⚠️" });
  }
});

module.exports = router;
