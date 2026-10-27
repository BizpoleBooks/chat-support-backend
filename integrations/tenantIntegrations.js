const axios = require("axios");

module.exports = {

  default: {
    orders: async () => {
      const { data } = await axios.get("https://dummyjson.com/carts/1");
      return data;
    },

    products: async () => {
      const { data } = await axios.get("https://dummyjson.com/products?limit=5");
      return data.products;
    },

    users: async () => {
      const { data } = await axios.get("https://dummyjson.com/users?limit=3");
      return data.users;
    }
  },

};