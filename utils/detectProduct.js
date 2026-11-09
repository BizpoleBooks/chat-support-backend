const { PRODUCTS } = require("../config/products");

// Product mentioned in the message whose entry is in the matched knowledge,
// so a tenant without that product's knowledge never starts its enquiry flow
function detectProduct(message, knowledgeResults = []) {
  if (!message) return null;

  const titles = knowledgeResults.map(r => (r.title || "").trim().toLowerCase());

  return (
    PRODUCTS.find(
      p =>
        p.patterns.some(re => re.test(message)) &&
        titles.includes(p.title.toLowerCase())
    ) || null
  );
}

module.exports = { detectProduct };
