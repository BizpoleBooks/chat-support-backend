const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const anthropic = require("./anthropic");
const groq = require("./groq");

// An API error from either provider (billing, key, rate limit, outage, timeout), not a bug in our code
function isProviderError(err) {
  return err instanceof Anthropic.APIError || err instanceof OpenAI.APIError;
}

// Anthropic (ANTHROPIC_API_KEY) is the primary provider. Groq (GROQ_API_KEY) answers when the
// Anthropic key is missing or its call fails (no credit, invalid key, rate limit, outage, timeout).
// A refusal is a normal response, so it is returned as-is and never retried on Groq.
async function createMessage(params) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.client.messages.create({ model: anthropic.MODEL, ...params });

      return {
        text: anthropic.getText(response),
        stopReason: response.stop_reason,
        provider: "anthropic",
      };
    } catch (err) {
      if (!groq.client) throw err;
      console.warn(`Anthropic call failed (${err.status || err.name}), falling back to Groq: ${err.message}`);
    }
  }

  if (!groq.client) {
    throw new Error("No LLM provider configured: set ANTHROPIC_API_KEY or GROQ_API_KEY");
  }

  return groq.createMessage(params);
}

module.exports = { createMessage, isProviderError };
