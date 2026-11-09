const OpenAI = require("openai");

// Secondary LLM provider, used by config/llm.js when Anthropic is unavailable
const client = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      // Same budget as config/anthropic.js, so a fallback still fits the widget's timeout
      timeout: 20 * 1000,
      maxRetries: 1,
    })
  : null;

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

// Anthropic content blocks -> OpenAI-style chat content
function toChatContent(content) {
  if (typeof content === "string") return content;

  return content.map(block =>
    block.type === "image"
      ? { type: "image_url", image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } }
      : { type: "text", text: block.text }
  );
}

// Takes the same params as anthropic.messages.create (output_config is Anthropic-only and ignored)
async function createMessage({ system, messages, max_tokens }) {
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(b => b.type === "image"));

  const response = await client.chat.completions.create({
    model: hasImage ? VISION_MODEL : MODEL,
    max_tokens,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages.map(m => ({ role: m.role, content: toChatContent(m.content) })),
    ],
  });

  const choice = response.choices[0] || {};

  return {
    text: (choice.message?.content || "").trim(),
    stopReason: choice.finish_reason,
    provider: "groq",
  };
}

module.exports = { client, MODEL, VISION_MODEL, createMessage };
