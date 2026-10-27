const axios = require("axios");
const BASE_URL = "https://dummyjson.com";

async function fetchProducts() {
  const { data } = await axios.get(`${BASE_URL}/products?limit=5`);
  return data.products;
}

async function fetchUsers() {
  const { data } = await axios.get(`${BASE_URL}/users?limit=3`);
  return data.users;
}

async function fetchCart() {
  const { data } = await axios.get(`${BASE_URL}/carts/1`);
  return data;
}

module.exports = { fetchProducts, fetchUsers, fetchCart };
