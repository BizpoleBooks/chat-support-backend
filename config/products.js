// Single source of truth for the products offered in the chat enquiry flow.
//  key        – value sent to / from the widget as `product`
//  title      – title of the product's entry in the tenant knowledge base
//  tenantSlug – tenants.slug of the product's own tenant (null if not created yet)
//  verifyName – name returned by productVerification.service for this product
//  patterns   – whole-word patterns that mean the user is asking about the product
const PRODUCTS = [
  {
    key: "books",
    title: "Books",
    tenantSlug: "books",
    verifyName: "books",
    url: "https://xxs3snf2-5174.inc1.devtunnels.ms/",
    patterns: [/\bbooks\b/i, /\bbook[\s-]?keeping\b/i],
  },
  {
    key: "consultant",
    title: "Consultant",
    tenantSlug: "consult",
    verifyName: "consulting",
    url: "https://yourdomain.com/consultant",
    patterns: [/\bconsult(ant|ants|ing|ancy)\b/i],
  },
  {
    key: "one",
    title: "One",
    tenantSlug: null,
    verifyName: "one",
    url: "https://yourdomain.com/one",
    // "one" is a common word, so only match it when it is clearly the product name
    patterns: [
      /^\s*one\s*[?.!]*\s*$/i,
      /(?<!^\s*)\bOne\b/,
      /\b(bizpole|biznova)\s+one\b/i,
      /\b(about|explain|register for|what is|what's)\s+one\b/i,
    ],
  },
];

const getProduct = key => PRODUCTS.find(p => p.key === key) || null;

// Tenant slug for a product name returned by productVerification.service
function tenantSlugForVerifiedProduct(verifyName) {
  const product = PRODUCTS.find(p => p.verifyName === verifyName);
  return product ? product.tenantSlug : verifyName;
}

module.exports = { PRODUCTS, getProduct, tenantSlugForVerifiedProduct };
