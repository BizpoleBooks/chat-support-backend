const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // A chat reply waits on these calls, so fail in seconds instead of the SDK's 10-minute default
  // (up to 3 calls per chat request × 2 attempts × 20s stays under the widget's 130s timeout)
  timeout: 20 * 1000,
  maxRetries: 1,
});

const MODEL = "claude-haiku-5-5";

// Collect the text blocks of a Claude response into one string
function getText(response) {
  return (response.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("")
    .trim();
}

module.exports = { client, MODEL, getText };
