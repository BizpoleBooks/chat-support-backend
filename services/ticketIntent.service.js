const { askAI } = require("./ai.service");

async function detectTicketIntent(message, tenantId) {

  const prompt = `
You are an intent classifier.

Detect if the user wants to create a support ticket.

The user may speak in ANY language (English, Malayalam, Hindi, mixed).

Examples of ticket intent:
"I need to raise a ticket"
"ticket venam"
"support venam"
"create support ticket"
"mujhe support chahiye"

Return ONLY:
raise_ticket
or
normal
`;

  const result = await askAI({
    tenantId,
    question: prompt + "\n\nMessage: " + message,
    context: "",
    history: []
  });

  return result.trim().toLowerCase();
}

module.exports = { detectTicketIntent };