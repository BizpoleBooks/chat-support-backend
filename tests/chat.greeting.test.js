// Route-level checks for greeting handling. Services that touch MySQL or Claude
// are replaced in the require cache, so this needs no database or API key.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const express = require("express");

const calls = { askAI: [], search: [], saved: [] };

function stub(relativePath, exports) {
  const file = require.resolve(path.join(__dirname, "..", relativePath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

const FALLBACK_TEXT = "Sorry, I don’t have that information. Please contact the support team.";

stub("services/ai.service.js", {
  FALLBACK_TEXT,
  askAI: async args => {
    calls.askAI.push(args);
    return "Hello! To create a sales invoice, open Sales > Invoices > New.";
  },
});
stub("services/chatHistory.service.js", { saveChatMessage: async msg => calls.saved.push(msg) });
stub("services/knowledge.service.js", {
  findRelevantKnowledge: async (query, tenantId) => {
    calls.search.push({ query, tenantId });
    return [{ id: 1, title: "Sales Invoice", content: "Open Sales > Invoices > New.", files: [] }];
  },
});
stub("services/ticketIntent.service.js", { detectTicketIntent: async () => "normal" });
stub("services/dataResolver.service.js", { resolveExternalContext: async () => "" });
stub("services/searchQuery.service.js", { toEnglishSearchQuery: async message => `EN(${message})` });
stub("services/productVerification.service.js", { findUserProduct: async () => null });
stub("services/tenant.service.js", { getTenantIdBySlug: async () => null });
stub("services/enquiry.service.js", { createEnquiry: async () => {} });
stub("utils/imageText.util.js", { extractImageIssue: async () => "" });

const chatRoutes = require("../routes/chat.routes");

let baseUrl;
let server;

test.before(async () => {
  const app = express();
  // Stands in for tenantMiddleware
  app.use((req, res, next) => {
    req.tenantId = 7;
    req.tenantSlug = "books";
    next();
  });
  app.use("/api/chat", chatRoutes);
  await new Promise(resolve => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/chat/ask`;
});

test.after(() => server.close());

test.beforeEach(() => {
  calls.askAI = [];
  calls.search = [];
  calls.saved = [];
});

async function ask(message, extra = {}) {
  const form = new FormData();
  form.append("message", message);
  form.append("session_id", "test-session");
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  const res = await fetch(baseUrl, { method: "POST", body: form });
  return res.json();
}

test("bare greetings get the localised canned reply without any AI call", async () => {
  const cases = [
    ["Hi", /^Hello/],
    ["Hello there!", /^Hello/],
    ["Good morning", /^Hello/],
    ["Hiiii 😊", /^Hello/],
    ["hai", /^Hello/],
    ["നമസ്കാരം", /[ഀ-ൿ]/],
    ["Namaskaram", /^Namaskaram/],
    ["नमस्ते", /[ऀ-ॿ]/],
    ["வணக்கம்", /[஀-௿]/],
  ];

  for (const [message, expected] of cases) {
    const body = await ask(message);
    assert.equal(body.classification, "greeting", message);
    assert.match(body.text, expected, message);
    assert.deepEqual(body.files, [], message);
  }

  assert.equal(calls.askAI.length, 0);
  assert.equal(calls.search.length, 0);
  // Bot replies are saved under the requesting tenant
  assert.ok(calls.saved.every(m => m.tenant_slug === "books" && m.sender === "bot"));
});

test("a greeting followed by a question goes through the full knowledge flow", async () => {
  const body = await ask("Hello, how can I create a sales invoice?");

  assert.equal(body.classification, "kb");
  assert.equal(calls.search[0].query, "how can I create a sales invoice?");
  assert.equal(calls.search[0].tenantId, 7);
  assert.equal(calls.askAI.length, 1);
  // The model still sees the whole message, greeting included
  assert.equal(calls.askAI[0].question, "Hello, how can I create a sales invoice?");
  assert.equal(calls.askAI[0].tenantId, 7);
  assert.match(calls.askAI[0].context, /Sales Invoice/);
});

test("small talk after a greeting reaches the model instead of the canned reply", async () => {
  await ask("Hi, how are you?");
  assert.equal(calls.askAI.length, 1);
  assert.equal(calls.askAI[0].question, "Hi, how are you?");
});

test("a Malayalam greeting with a question is searched without the greeting", async () => {
  await ask("നമസ്കാരം, എന്റെ payment status എന്താണ്?");
  assert.equal(calls.search[0].query, "EN(എന്റെ payment status എന്താണ്?)");
  assert.equal(calls.askAI[0].language.code, "ml");
});

test("questions without a greeting are unchanged", async () => {
  await ask("What is the difference between sales and purchase invoices?");
  assert.equal(calls.search[0].query, "What is the difference between sales and purchase invoices?");
  assert.equal(calls.askAI.length, 1);
});

test("a greeting sent with an attachment is not swallowed by the greeting reply", async () => {
  const form = new FormData();
  form.append("message", "hi");
  form.append("session_id", "test-session");
  form.append("file", new Blob(["fake"], { type: "image/png" }), "screen.png");
  const body = await (await fetch(baseUrl, { method: "POST", body: form })).json();

  assert.notEqual(body.classification, "greeting");
  assert.equal(calls.askAI.length, 1);
});
