require("dotenv").config();

function parseFrontendOrigins() {
  const origins = new Set();

  for (const value of [process.env.FRONTEND_ORIGIN, process.env.FRONTEND_ORIGINS]) {
    if (!value) continue;
    for (const origin of value.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  if (origins.size === 0) origins.add("http://localhost:3001");
  return [...origins];
}

function isAllowedFrontendOrigin(origin) {
  if (!origin) return true;

  const allowedOrigins = parseFrontendOrigins();
  if (allowedOrigins.includes(origin)) return true;

  // Demo deployments on Vercel (production + preview URLs).
  if (/^https:\/\/agentic-wes[-a-z0-9]*\.vercel\.app$/.test(origin)) return true;

  return false;
}

const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  mongoDbName: process.env.MONGODB_DB || "wes_demo",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  frontendOrigins: parseFrontendOrigins(),
  isAllowedFrontendOrigin,
};

module.exports = { config };
