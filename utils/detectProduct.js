function detectProduct(message) {
  const q = message.toLowerCase();

  if (q.includes("book")) return "books";
  if (q.includes("consult")) return "consultant";
  if (q.includes("one")) return "one";

  return null;
}


module.exports = { detectProduct };