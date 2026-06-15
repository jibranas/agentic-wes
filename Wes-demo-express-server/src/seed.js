const { closeDb, collections, connectDb } = require("./db");
const { generateSyntheticData } = require("./data/generateSyntheticData");

const collectionPayloads = [
  ["orders", collections.orders],
  ["waves", collections.waves],
  ["laneEvents", collections.laneEvents],
  ["asrsLogs", collections.asrsLogs],
  ["storeProfiles", collections.storeProfiles],
  ["recommendations", collections.recommendations],
  ["scenarioEvents", collections.scenarioEvents],
  ["robotStatus", collections.robotStatus],
];

async function seed() {
  const db = await connectDb();
  const data = generateSyntheticData();

  for (const [, collectionName] of collectionPayloads) {
    await db.collection(collectionName).deleteMany({});
  }

  for (const [payloadKey, collectionName] of collectionPayloads) {
    const payload = data[payloadKey];
    if (payload.length) {
      await db.collection(collectionName).insertMany(payload);
    }
  }

  await db.collection("demo_metadata").deleteMany({});
  await db.collection("demo_metadata").insertOne(data.metadata);

  await db.collection(collections.orders).createIndex({ day: 1, store_id: 1, wave_id: 1 });
  await db.collection(collections.orders).createIndex({ scenario_ids: 1 });
  await db.collection(collections.waves).createIndex({ day: 1, wave_number: 1 });
  await db.collection(collections.laneEvents).createIndex({ day: 1, lane_id: 1 });
  await db.collection(collections.asrsLogs).createIndex({ day: 1, aisle_id: 1 });
  await db.collection(collections.recommendations).createIndex({ scenario_id: 1, act: 1 });

  return {
    metadata: data.metadata,
    counts: Object.fromEntries(collectionPayloads.map(([payloadKey, collectionName]) => [collectionName, data[payloadKey].length])),
  };
}

if (require.main === module) {
  seed()
    .then((result) => {
      console.log("Seed complete");
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error("Seed failed", error);
      process.exitCode = 1;
    })
    .finally(closeDb);
}

module.exports = { seed };
