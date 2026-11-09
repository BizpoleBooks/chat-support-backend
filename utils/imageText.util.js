const { createMessage } = require("../config/llm");

async function extractImageIssue(file) {
  const base64 = file.buffer.toString("base64");

  const response = await createMessage({
    max_tokens: 1000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: file.mimetype,
              data: base64
            }
          },
          {
            type: "text",
            text: "Identify the issue or problem shown in this image in a short sentence."
          }
        ]
      }
    ]
  });

  if (response.stopReason === "refusal") {
    return "";
  }

  return response.text;
}

module.exports = { extractImageIssue };
