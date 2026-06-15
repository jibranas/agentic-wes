require("dotenv").config();

const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  mongoDbName: process.env.MONGODB_DB || "wes_demo",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3001",
};

module.exports = { config };
