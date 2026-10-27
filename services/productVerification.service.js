const axios = require("axios");



async function findUserProduct(email, phone) {
  const productAPIs = [
    { name: "books", url: "http://localhost:3000/api/auth/verify" },
    { name: "consulting", url: "http://localhost:4000/api/auth/userverify" },
  ];

  for (const p of productAPIs) {
    try {
      console.log("Calling:", p.url);

      const res = await axios.post(p.url, { email, phone });

      console.log("Response from", p.name, res.data);

      if (res.data?.exists === true) {
        return { product: p.name, user: res.data.user };
      }

    } catch (e) {
      console.error("Verification failed:", p.name, e.message);
    }
  }

  return null;
}

module.exports = { findUserProduct };