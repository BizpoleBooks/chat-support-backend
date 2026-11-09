// Local greeting detection (no API call). It recognises greeting words by shape,
// so spelling variants ("hii", "hai", "helloooo"), addressees ("hi team"),
// punctuation and emoji are covered. It only answers "is this a bare greeting?"
// and "what comes after the greeting?". Anything it can't recognise reaches the
// model, which handles greetings in any language (see GREETING_RULE in ai.service.js).

// Single greeting words, matched after lowercasing and dropping apostrophes/hyphens.
// Only languages with a localised greeting in language.util.js, so the canned reply fits.
const GREETING_WORDS = [
  /^h+i+$/,                 // hi, hii, hiiii
  /^h+a+i+$/,               // hai, haii
  /^h+e+y+a*$/,             // hey, heyy, heya
  /^h+[ae]*l+o+w*$/,        // hello, helo, hlo, hallo, hellooo, hellow
  /^hiya$/,
  /^howdy$/,
  /^greetings$/,
  /^namaska+ra*m?$/,        // namaskar, namaskara, namaskaram
  /^namas(t|th)e+y?$/,      // namaste, namasthe, namastey
  /^vanakk?a+m$/,           // vanakkam
  /^(നമസ്കാരം|നമസ്കാരമ്|നമസ്തേ|ഹായ്|ഹായ|ഹലോ|സുപ്രഭാതം)$/u,
  /^(नमस्ते|नमस्कार|प्रणाम|हाय|हैलो|हेलो|सुप्रभात)$/u,
  /^(வணக்கம்|ஹாய்|ஹலோ)$/u,
];

// Two-word greetings
const GREETING_PHRASES = [
  /^g(oo|u)d (morning|mrng|afternoon|evening|day)$/,
  /^காலை வணக்கம்$/u,
];

// Words that may follow a greeting: "hi there", "hello team", "namaste ji"
const ADDRESSEES = new Set([
  "there", "all", "everyone", "everybody", "team", "sir", "madam", "maam", "mam",
  "friend", "friends", "guys", "folks", "bot", "buddy", "bro", "dear", "support",
  "ji", "bhai", "chetta", "chettan", "chechi", "जी", "सर",
]);

// Spaces, punctuation, symbols and emoji (with skin tones, ZWJ sequences and variation selectors)
const FILLER = /^[\s\p{P}\p{S}\p{Extended_Pictographic}\p{Emoji_Modifier}‌‍️]+/u;
const WORD = /^[\p{L}\p{M}\p{N}‌‍]+(?:['’-][\p{L}\p{M}\p{N}‌‍]+)*/u;

const normalize = word =>
  word.normalize("NFC").toLowerCase().replace(/['’\-‌‍]/g, "");

const isGreetingWord = word => GREETING_WORDS.some(re => re.test(word));

// Splits a leading greeting off the message.
// "Hi team 👋, how do I create an invoice?" → { greeted: true, rest: "how do I create an invoice?" }
function splitGreeting(message) {
  let rest = String(message || "").replace(FILLER, "");
  let greeted = false;

  for (;;) {
    const first = rest.match(WORD);
    if (!first) break;

    const afterFirst = rest.slice(first[0].length);
    const gap = afterFirst.match(/^\s+/);
    const second = gap && afterFirst.slice(gap[0].length).match(WORD);
    const pair = second && `${normalize(first[0])} ${normalize(second[0])}`;

    let consumed;
    if (pair && GREETING_PHRASES.some(re => re.test(pair))) {
      consumed = first[0].length + gap[0].length + second[0].length;
    } else if (isGreetingWord(normalize(first[0])) || (greeted && ADDRESSEES.has(normalize(first[0])))) {
      consumed = first[0].length;
    } else {
      break;
    }

    greeted = true;
    rest = rest.slice(consumed).replace(FILLER, "");
  }

  return { greeted, rest: greeted ? rest.trim() : String(message || "").trim() };
}

// "Hiiii 😊", "Hello there!", "Good morning team", "നമസ്കാരം 🙏". Not "Hi, how are you?"
function isGreetingOnly(message) {
  const { greeted, rest } = splitGreeting(message);
  return greeted && !rest;
}

// The question without its greeting, for keyword search; the full message still goes to the model
function withoutGreeting(message) {
  return splitGreeting(message).rest || String(message || "").trim();
}

module.exports = { isGreetingOnly, splitGreeting, withoutGreeting };
