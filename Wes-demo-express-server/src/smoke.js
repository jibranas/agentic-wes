const { app } = require("./server");
const { config } = require("./config");
const { closeDb } = require("./db");

const checks = [
  "/api/health",
  "/api/metadata",
  "/api/dashboard/summary",
  "/api/orders?scenarioId=store-demand-surge&limit=5",
  "/api/waves",
  "/api/lanes",
  "/api/asrs",
  "/api/stores",
  "/api/recommendations",
  "/api/scenarios",
];

async function smoke() {
  const server = app.listen(config.port);
  const baseUrl = `http://localhost:${config.port}`;

  try {
    for (const path of checks) {
      const response = await fetch(`${baseUrl}${path}`);
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      const body = await response.json();
      const count = Array.isArray(body) ? body.length : Object.keys(body).length;
      console.log(`${path} ok (${count})`);
    }
  } finally {
    server.close();
    await closeDb();
  }
}

if (require.main === module) {
  smoke().catch((error) => {
    console.error("Smoke failed", error);
    process.exitCode = 1;
  });
}

module.exports = { smoke };
