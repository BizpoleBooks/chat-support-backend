require("dotenv").config();

const app = require("./app");


const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 🔥 Load active AI prompt into memory


    app.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
