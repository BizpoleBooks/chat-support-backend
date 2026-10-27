const { client } = require("../config/openai");

async function extractImageIssue(file) {
  const base64 = file.buffer.toString("base64");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 50,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify the issue or problem shown in this image in a short sentence."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${file.mimetype};base64,${base64}`
            }
          }
        ]
      }
    ]
  });

  return response.choices?.[0]?.message?.content || "";
}

module.exports = { extractImageIssue };