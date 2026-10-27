function buildPrompt(context, history, question) {
  return `
CONVERSATION HISTORY:
${history || "No previous conversation"}

KNOWLEDGE CONTEXT:
${context || "No knowledge available"}

USER QUESTION:
${question}

FINAL ANSWER:
`;
}

module.exports = { buildPrompt };