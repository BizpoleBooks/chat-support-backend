const tenantIntegrations = require("../integrations/tenantIntegrations");

async function resolveExternalContext(message, tenantSlug) {

  const q = message.toLowerCase();
  let context = "";

  const tenantApis = tenantIntegrations[tenantSlug];

  if (!tenantApis) return "";

  for (const key of Object.keys(tenantApis)) {

    if (q.includes(key)) {

      const data = await tenantApis[key]();

      context += `
${key.toUpperCase()} DATA:
${JSON.stringify(data, null, 2)}
`;
    }
  }

  return context;
}

module.exports = { resolveExternalContext };