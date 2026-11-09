const test = require("node:test");
const assert = require("node:assert");
const {
  detectLanguage,
  localizedFallback,
  localizedGreeting,
  needsSearchTranslation,
} = require("../utils/language.util");

const code = (message, history) => detectLanguage(message, history)?.code ?? null;

test("detects native scripts", () => {
  assert.equal(code("നിങ്ങളുടെ ഓഫീസ് എവിടെയാണ്?"), "ml");
  assert.equal(code("आपकी कंपनी क्या सेवाएँ प्रदान करती है?"), "hi");
  assert.equal(code("உங்கள் அலுவலகம் எங்கே?"), "ta");
});

test("detects Manglish and Hinglish in Latin script", () => {
  assert.equal(code("Ningalude office evide aanu?"), "manglish");
  assert.equal(code("Your office evide aanu?"), "manglish");
  assert.equal(code("Login cheyyan pattunilla"), "manglish");
  assert.equal(code("Mujhe ticket chahiye"), "hinglish");
});

test("plain English sentences are English", () => {
  assert.equal(code("What are your business hours?"), "en");
  assert.equal(code("How do I reset my password?"), "en");
});

test("short messages fall back to the user's recent language", () => {
  const history = [
    { role: "user", text: "ട്രേഡ്മാർക്ക് എന്താണ്?" },
    { role: "assistant", text: "Trademark is ..." },
  ];
  assert.equal(code("ok", history), "ml");
  assert.equal(code("ok"), null);
});

test("malformed history is ignored", () => {
  assert.equal(code("ok", [null, "x", { role: "user", text: 5 }]), null);
  assert.equal(code("ok", "not-an-array"), null);
});

test("canned replies are localised, unknown languages keep English", () => {
  const fallback = "Sorry, I don’t have that information. Please contact the support team.";
  assert.match(localizedFallback(detectLanguage("എന്താണ് ഇത്?"), fallback), /[ഀ-ൿ]/);
  assert.equal(localizedFallback(null, fallback), fallback);
  assert.equal(localizedFallback(detectLanguage("What is this product about?"), fallback), fallback);
  assert.match(localizedGreeting(detectLanguage("नमस्ते")), /[ऀ-ॿ]/);
  assert.match(localizedGreeting(null), /^Hello/);
});

test("only non-English messages need a translated search query", () => {
  assert.equal(needsSearchTranslation(detectLanguage("What is GST registration?")), false);
  assert.equal(needsSearchTranslation(null), false);
  assert.equal(needsSearchTranslation(detectLanguage("GST registration enthanu?")), true);
});
