// Provider fallback in config/llm.js, with both SDK clients stubbed (no API calls)
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const calls = { anthropic: [], groq: [] };
const behaviour = { anthropic: null, groqConfigured: true };

function stub(file, exports) {
  const id = path.join(__dirname, "..", "config", file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

stub("anthropic.js", {
  MODEL: "claude-haiku-5-5",
  getText: r => r.content.map(b => b.text).join("").trim(),
  client: {
    messages: {
      create: async params => {
        calls.anthropic.push(params);
        return behaviour.anthropic(params);
      },
    },
  },
});

const groq = {
  client: {},
  createMessage: async params => {
    calls.groq.push(params);
    return { text: "groq answer", stopReason: "stop", provider: "groq" };
  },
};
stub("groq.js", groq);

const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { createMessage, isProviderError } = require("../config/llm");

const params = { max_tokens: 100, system: "sys", messages: [{ role: "user", content: "hi" }] };
const savedKey = process.env.ANTHROPIC_API_KEY;

test.beforeEach(() => {
  calls.anthropic = [];
  calls.groq = [];
  process.env.ANTHROPIC_API_KEY = "test-key";
  groq.client = {};
});

test.after(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
});

test("uses Anthropic when it answers", async () => {
  behaviour.anthropic = async () => ({ content: [{ type: "text", text: "claude answer" }], stop_reason: "end_turn" });

  const result = await createMessage(params);

  assert.deepEqual(result, { text: "claude answer", stopReason: "end_turn", provider: "anthropic" });
  assert.equal(calls.anthropic[0].model, "claude-haiku-5-5");
  assert.equal(calls.groq.length, 0);
});

test("falls back to Groq when the Anthropic call fails", async t => {
  t.mock.method(console, "warn", () => {});
  behaviour.anthropic = async () => {
    throw Object.assign(new Error("Your credit balance is too low"), { status: 400 });
  };

  const result = await createMessage(params);

  assert.equal(result.provider, "groq");
  assert.equal(calls.anthropic.length, 1);
  assert.deepEqual(calls.groq[0], params);
});

test("goes straight to Groq when ANTHROPIC_API_KEY is missing", async () => {
  delete process.env.ANTHROPIC_API_KEY;

  const result = await createMessage(params);

  assert.equal(result.provider, "groq");
  assert.equal(calls.anthropic.length, 0);
});

test("does not retry a refusal on Groq", async () => {
  behaviour.anthropic = async () => ({ content: [], stop_reason: "refusal" });

  const result = await createMessage(params);

  assert.equal(result.stopReason, "refusal");
  assert.equal(calls.groq.length, 0);
});

test("rethrows the Anthropic error when Groq is not configured", async () => {
  groq.client = null;
  behaviour.anthropic = async () => {
    throw new Error("anthropic down");
  };

  await assert.rejects(createMessage(params), /anthropic down/);
});

test("treats API errors from either provider as provider errors", () => {
  assert.equal(isProviderError(Object.create(Anthropic.APIError.prototype)), true);
  assert.equal(isProviderError(Object.create(OpenAI.AuthenticationError.prototype)), true);
  assert.equal(isProviderError(new TypeError("bug")), false);
});

test("errors clearly when neither key is set", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  groq.client = null;

  await assert.rejects(createMessage(params), /set ANTHROPIC_API_KEY or GROQ_API_KEY/);
});
