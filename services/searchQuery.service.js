const { askAI } = require("./ai.service");

// The knowledge base is indexed in English, so a Malayalam, Hindi, Manglish or
// Hinglish message is rewritten into an English keyword query before searching.
async function toEnglishSearchQuery(message, previousMessage, tenantId) {
  const prompt = `
Rewrite the user's latest message as a short English search query (keywords only) for a customer-support knowledge base.
The message may be in Malayalam, Hindi, Tamil, Manglish, Hinglish or another language.
${previousMessage ? "Use the previous message only to resolve words like \"it\" or \"that\"." : ""}
Keep product names as they are. Reply with the query only, on one line, without quotes.

${previousMessage ? `Previous message: ${previousMessage}\n` : ""}Latest message: ${message}
`;

  const result = await askAI({
    tenantId,
    question: prompt,
    context: "",
    history: [],
    restrictToKnowledge: false,
    useTenantPrompt: false
  });

  return result.split("\n")[0].replace(/["“”]/g, "").trim().slice(0, 200);
}

module.exports = { toEnglishSearchQuery };
