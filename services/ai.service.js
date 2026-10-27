const { buildPrompt } = require("../utils/promptBuilder");
const { getSystemPrompt } = require("./aiSettings.service");
const { client } = require("../config/openai");

async function askAI({ tenantId, question, context = "", history = [], pdfText = "" }) {
  if (!tenantId) {
    throw new Error("Tenant ID required");
  }

  // ==============================
  // LIMIT HISTORY
  // ==============================

  const historyText = Array.isArray(history)
    ? history
        .slice(-6)
        .map(h => `${(h.role || "user").toUpperCase()}: ${h.text || ""}`)
        .join("\n")
    : "";

  // ==============================
  // SYSTEM PROMPT (MULTI TENANT)
  // ==============================

  const systemPrompt = await getSystemPrompt(tenantId);

  const messages = [
    {
      role: "system",
      content: systemPrompt || "You are a helpful assistant."
    }
  ];

  // ==============================
  // DOCUMENT CONTEXT (PDF)
  // ==============================

  let documentContext = "";

  if (pdfText) {
    const safePdf = pdfText.slice(0, 4000); // prevent huge prompts

    documentContext = `
USER UPLOADED DOCUMENT:
----------------------
${safePdf}

Analyze the document and identify the user's issue.
If the issue matches HelpDeskPro knowledge, provide the correct solution.
`;
  }

  // ==============================
  // BUILD FINAL PROMPT
  // ==============================

  const prompt = buildPrompt(
    `${context}\n\n${documentContext}`,
    historyText,
    question
  );

  messages.push({
    role: "user",
    content: prompt
  });

  // ==============================
  // CALL LLM
  // ==============================

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 300,
    messages
  });

  return response.choices?.[0]?.message?.content || "No response";
}

module.exports = { askAI };