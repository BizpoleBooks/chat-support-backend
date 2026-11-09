// Local language detection (no API call). It gives the model an explicit reply
// language and lets the route translate its own canned replies.

const LANGUAGES = {
  en: {
    label: "English",
    greeting: "Hello! 👋 How can I help you today?",
    fallback: null, // FALLBACK_TEXT itself
  },
  ml: {
    label: "Malayalam (Malayalam script)",
    greeting: "നമസ്കാരം! 👋 ഞാൻ എങ്ങനെയാണ് സഹായിക്കേണ്ടത്?",
    fallback: "ക്ഷമിക്കണം, ആ വിവരം എന്റെ പക്കൽ ഇല്ല. ദയവായി സപ്പോർട്ട് ടീമിനെ ബന്ധപ്പെടുക.",
  },
  manglish: {
    label: "Malayalam written in English letters (Manglish)",
    greeting: "Namaskaram! 👋 Njan engane aanu sahayikkendathu?",
    fallback: "Kshamikkanam, aa vivaram ente kayyil illa. Dayavayi support team-ine contact cheyyuka.",
  },
  hi: {
    label: "Hindi (Devanagari script)",
    greeting: "नमस्ते! 👋 बताइए, मैं आपकी क्या मदद करूँ?",
    fallback: "क्षमा करें, मेरे पास यह जानकारी नहीं है। कृपया सपोर्ट टीम से संपर्क करें।",
  },
  hinglish: {
    label: "Hindi written in English letters (Hinglish)",
    greeting: "Namaste! 👋 Bataiye, main aapki kya madad karun?",
    fallback: "Maaf kijiye, mere paas yeh jaankari nahi hai. Kripya support team se contact karein.",
  },
  ta: {
    label: "Tamil (Tamil script)",
    greeting: "வணக்கம்! 👋 நான் உங்களுக்கு எப்படி உதவ வேண்டும்?",
    fallback: "மன்னிக்கவும், அந்தத் தகவல் என்னிடம் இல்லை. தயவுசெய்து சப்போர்ட் குழுவைத் தொடர்பு கொள்ளவும்.",
  },
};

const SCRIPTS = [
  { code: "ml", re: /[ഀ-ൿ]/gu },
  { code: "hi", re: /[ऀ-ॿ]/gu },
  { code: "ta", re: /[஀-௿]/gu },
];

// Common words that only appear in transliterated Malayalam / Hindi
const MANGLISH_WORDS = new Set([
  "aanu", "ano", "aano", "alle", "athu", "ithu", "evide", "evideya", "enthanu", "entha", "enthu",
  "engane", "enganeya", "ethra", "eppol", "eppozha", "ningal", "ningalude", "ningalkku", "njan",
  "enikku", "enik", "ente", "illa", "undo", "undu", "venam", "vendi", "cheyyam", "cheyyan",
  "cheyyum", "cheyyanam", "parayamo", "paranju", "sheri", "kittum", "kittunilla", "kittiyilla",
  "pattunilla", "pattumo", "onnu", "namaskaram", "sahayikkamo", "aayi", "kodukkuka",
]);

const HINGLISH_WORDS = new Set([
  "kya", "hai", "hain", "kaise", "kaisa", "mujhe", "chahiye", "nahi", "nahin", "aap", "aapka",
  "aapki", "kab", "kahan", "kyun", "kyon", "karna", "karo", "karein", "mera", "meri", "mere",
  "batao", "bataiye", "kaun", "kitna", "kitne", "hoga", "raha", "rahi", "namaste", "madad",
]);

function detectOne(text) {
  const value = String(text || "");
  if (!value.trim()) return null;

  // Native script wins when it is any real share of the letters
  const letters = (value.match(/\p{L}/gu) || []).length || 1;
  for (const { code, re } of SCRIPTS) {
    const count = (value.match(re) || []).length;
    if (count / letters >= 0.3) return code;
  }

  const words = value.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return null;

  const manglish = words.filter(w => MANGLISH_WORDS.has(w)).length;
  const hinglish = words.filter(w => HINGLISH_WORDS.has(w)).length;
  const hits = Math.max(manglish, hinglish);

  // "Your office evide aanu?" → 2 of 4 words → Manglish
  if (hits && hits / words.length >= 0.15) {
    return manglish >= hinglish ? "manglish" : "hinglish";
  }

  // Plain Latin text: English, or another language the model can read for itself
  return words.length >= 4 ? "en" : null;
}

// Language of the current message; short or unclear messages ("ok", "yes")
// fall back to the user's latest earlier message that had a clear language.
function detectLanguage(message, history = []) {
  const own = detectOne(message);
  if (own) return { code: own, ...LANGUAGES[own] };

  const userTexts = (Array.isArray(history) ? history : [])
    .filter(h => h && h.role === "user" && typeof h.text === "string")
    .map(h => h.text)
    .reverse();

  for (const text of userTexts) {
    const code = detectOne(text);
    if (code) return { code, ...LANGUAGES[code] };
  }

  return null;
}

function localizedFallback(language, fallbackText) {
  return (language && language.fallback) || fallbackText;
}

function localizedGreeting(language) {
  return (language && language.greeting) || LANGUAGES.en.greeting;
}

// Languages whose words won't match the English FULLTEXT index as typed
const needsSearchTranslation = language =>
  !!language && language.code !== "en";

module.exports = { detectLanguage, localizedFallback, localizedGreeting, needsSearchTranslation };
