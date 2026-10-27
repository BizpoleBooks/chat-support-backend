function detectIntent(message) {
  const q = message.toLowerCase();

  if (
    q.includes("login") ||
    q.includes("ticket") ||
    q.includes("admin") ||
    q.includes("password")
  ) return "KB";

  if (
    q.includes("order") ||
    q.includes("product") ||
    q.includes("cart") ||
    q.includes("user")
  ) return "EXTERNAL";


}

module.exports = { detectIntent };
