const test = require("node:test");
const assert = require("node:assert");
const { isGreetingOnly, splitGreeting, withoutGreeting } = require("../utils/greeting.util");
const { detectLanguage, localizedGreeting } = require("../utils/language.util");

test("bare greetings in any spelling, with addressees, punctuation and emoji", () => {
  for (const message of [
    "Hi", "hi", "Hello there!", "Good morning", "Hey there", "Hiiii 😊", "hai", "Haii!!",
    "heyy", "helloooo", "helo", "hlo", "Hello 😀", "hi 🙏", "Hi 👋🏽", "Hi hello",
    "Hey, good morning!", "Good morning sir", "gud mrng", "Good evening, team.", "Hi all",
    "Namaskaram", "namaskar", "Namaste ji", "Namasthe", "vanakkam",
    "നമസ്കാരം", "നമസ്കാരം 🙏", "ഹായ്", "ഹലോ", "नमस्ते", "नमस्कार 🙏", "हैलो", "வணக்கம்",
    "காலை வணக்கம்", "  hi  ",
  ]) {
    assert.equal(isGreetingOnly(message), true, message);
  }
});

test("a greeting with a question, small talk or other text is not greeting-only", () => {
  for (const message of [
    "Hi, how are you?",
    "Hi, what is my invoice status?",
    "Hello, how can I create a sales invoice?",
    "നമസ്കാരം, എന്റെ payment status എന്താണ്?",
    "What is the difference between sales and purchase invoices?",
    "എന്റെ ledger balance എത്രയാണ്?",
    "Hi-Tech plan pricing",
    "high balance",
    "history of my invoices",
    "hello?? anyone there",
    "",
    "👋",
    "there",
  ]) {
    assert.equal(isGreetingOnly(message), false, message);
  }
});

test("the greeting is split off the question for search", () => {
  assert.deepEqual(splitGreeting("Hi team 👋, how do I create an invoice?"), {
    greeted: true,
    rest: "how do I create an invoice?",
  });
  assert.equal(withoutGreeting("Hello, how can I create a sales invoice?"), "how can I create a sales invoice?");
  assert.equal(withoutGreeting("Good morning, I have a question about my payment."), "I have a question about my payment.");
  assert.equal(withoutGreeting("നമസ്കാരം, എന്റെ payment status എന്താണ്?"), "എന്റെ payment status എന്താണ്?");
  // Not a greeting: unchanged
  assert.equal(withoutGreeting("What is GST?"), "What is GST?");
  assert.equal(withoutGreeting("Hi-Tech plan pricing"), "Hi-Tech plan pricing");
  // Nothing after the greeting: keep the message rather than an empty query
  assert.equal(withoutGreeting("Hello!"), "Hello!");
});

test("greeting replies follow the greeting's language", () => {
  assert.match(localizedGreeting(detectLanguage("നമസ്കാരം")), /[ഀ-ൿ]/);
  assert.match(localizedGreeting(detectLanguage("नमस्ते")), /[ऀ-ॿ]/);
  assert.match(localizedGreeting(detectLanguage("வணக்கம்")), /[஀-௿]/);
  assert.match(localizedGreeting(detectLanguage("Namaskaram")), /^Namaskaram/);
  assert.match(localizedGreeting(detectLanguage("Hiiii 😊")), /^Hello/);
});
