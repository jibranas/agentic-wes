const { MongoClient } = require("mongodb");
const { config } = require("./config");

let client;
let database;

async function connectDb() {
  if (database) return database;

  client = new MongoClient(config.mongoUri);
  await client.connect();
  database = client.db(config.mongoDbName);
  return database;
}

async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
  }
}

const collections = {
  orders: "orders",
  waves: "waves",
  laneEvents: "lane_events",
  asrsLogs: "asrs_logs",
  storeProfiles: "store_profiles",
  recommendations: "ai_recommendations",
  scenarioEvents: "scenario_events",
  robotStatus: "robot_status",
};

module.exports = { closeDb, collections, connectDb };
