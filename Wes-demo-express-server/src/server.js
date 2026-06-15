const cors = require("cors");
const express = require("express");
const OpenAI = require("openai");
const { z } = require("zod");
const { config } = require("./config");
const { collections, connectDb } = require("./db");
const { DEMO_DAY } = require("./data/generateSyntheticData");

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function pageLimit(value, fallback = 100) {
  const limit = Number(value || fallback);
  return Math.max(1, Math.min(limit, 500));
}

function scenarioFilter(scenarioId) {
  return scenarioId ? { scenario_ids: scenarioId } : {};
}

async function getMetadata(db) {
  const metadata = await db.collection("demo_metadata").findOne({});
  return metadata || { demo_day: DEMO_DAY };
}

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const db = await connectDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, database: config.mongoDbName, openaiConfigured: Boolean(config.openAiApiKey) });
  }),
);

app.get(
  "/api/metadata",
  asyncHandler(async (_req, res) => {
    const db = await connectDb();
    res.json(await getMetadata(db));
  }),
);

app.get(
  "/api/orders",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const { day = DEMO_DAY, storeId, waveId, scenarioId, status } = req.query;
    const query = {
      day,
      ...(storeId ? { store_id: storeId } : {}),
      ...(waveId ? { wave_id: waveId } : {}),
      ...(status ? { order_status: status } : {}),
      ...scenarioFilter(scenarioId),
    };
    const orders = await db
      .collection(collections.orders)
      .find(query)
      .sort({ created_at: 1 })
      .limit(pageLimit(req.query.limit, 200))
      .toArray();
    res.json(orders);
  }),
);

app.get(
  "/api/waves",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const waves = await db
      .collection(collections.waves)
      .find({ day: req.query.day || DEMO_DAY })
      .sort({ wave_number: 1 })
      .toArray();
    res.json(waves);
  }),
);

app.get(
  "/api/lanes",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const laneEvents = await db
      .collection(collections.laneEvents)
      .find({ day: req.query.day || DEMO_DAY })
      .sort({ timestamp: 1, lane_id: 1 })
      .toArray();
    res.json(laneEvents);
  }),
);

app.get(
  "/api/asrs",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const logs = await db
      .collection(collections.asrsLogs)
      .find({ day: req.query.day || DEMO_DAY })
      .sort({ timestamp: 1, aisle_id: 1 })
      .toArray();
    res.json(logs);
  }),
);

app.get(
  "/api/asrs/robots",
  asyncHandler(async (_req, res) => {
    const db = await connectDb();
    res.json(await db.collection(collections.robotStatus).find({}).sort({ aisle_id: 1, robot_id: 1 }).toArray());
  }),
);

app.get(
  "/api/stores",
  asyncHandler(async (_req, res) => {
    const db = await connectDb();
    res.json(await db.collection(collections.storeProfiles).find({}).sort({ store_id: 1 }).toArray());
  }),
);

app.get(
  "/api/recommendations",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const recommendations = await db
      .collection(collections.recommendations)
      .find({
        ...(req.query.act ? { act: req.query.act } : {}),
        ...(req.query.scenarioId ? { scenario_id: req.query.scenarioId } : {}),
      })
      .sort({ recommendation_id: 1 })
      .toArray();
    res.json(recommendations);
  }),
);

app.get(
  "/api/scenarios",
  asyncHandler(async (_req, res) => {
    const db = await connectDb();
    res.json(await db.collection(collections.scenarioEvents).find({}).toArray());
  }),
);

app.get(
  "/api/demo/acts/:actId",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const { actId } = req.params;
    const scenarios = await db.collection(collections.scenarioEvents).find({}).toArray();
    const recommendations = await db.collection(collections.recommendations).find({ act: actId }).toArray();
    res.json({ actId, demoDay: DEMO_DAY, scenarios, recommendations });
  }),
);

app.get(
  "/api/dashboard/summary",
  asyncHandler(async (req, res) => {
    const db = await connectDb();
    const day = req.query.day || DEMO_DAY;
    const [orderStats] = await db
      .collection(collections.orders)
      .aggregate([
        { $match: { day } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            agedOrders: { $sum: { $cond: ["$is_aged", 1, 0] } },
            cancelledOrders: { $sum: { $cond: ["$is_cancelled", 1, 0] } },
            highDemandOrders: { $sum: { $cond: ["$is_high_demand_sku", 1, 0] } },
          },
        },
      ])
      .toArray();
    const waveStats = await db.collection(collections.waves).find({ day }).sort({ wave_number: 1 }).toArray();
    const activeRecommendations = await db.collection(collections.recommendations).find({ act: "act-1" }).toArray();
    res.json({
      day,
      orders: orderStats || { totalOrders: 0, agedOrders: 0, cancelledOrders: 0, highDemandOrders: 0 },
      waves: waveStats,
      activeRecommendations,
    });
  }),
);

const chatSchema = z.object({
  act: z.enum(["act-1", "act-2", "act-3"]),
  scenarioId: z.string().optional(),
  visibleScreen: z.string().optional(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

function shapeRecommendationsForAct(recommendations, act) {
  return recommendations.map((recommendation) => {
    if (act !== "act-1") return recommendation;

    return {
      recommendation_id: recommendation.recommendation_id,
      scenario_id: recommendation.scenario_id,
      act: recommendation.act,
      title: recommendation.title,
      trigger_condition: recommendation.trigger_condition,
      recommendation: recommendation.recommendation,
      confidence: recommendation.confidence,
      expected_impact: recommendation.expected_impact,
      evidence_collection_refs: recommendation.evidence_collection_refs,
      decision_status: "pending_operator_decision",
      accepted_action: null,
      observed_outcome: null,
    };
  });
}

function shapeScenariosForAct(scenarios, act) {
  if (act !== "act-1") return scenarios;

  const completedActionPattern = /opened|released early|pulled forward|accepted/i;

  return scenarios.map((scenario) => ({
    scenario_id: scenario.scenario_id,
    title: scenario.title,
    act_1_summary: scenario.act_1_summary,
    current_state: "risk_detected_action_pending",
    timeline: scenario.timeline.filter(
      (event) => !completedActionPattern.test(`${event.label} ${event.evidence}`),
    ),
  }));
}

function shapeWavesForAct(waves, act) {
  if (act !== "act-1") return waves;

  return waves.map((wave) => ({
    wave_id: wave.wave_id,
    day: wave.day,
    wave_number: wave.wave_number,
    wave_release_time: wave.wave_release_time,
    wave_planned_completion: wave.wave_planned_completion,
    planned_order_count: wave.planned_order_count,
    actual_order_count: wave.actual_order_count,
    completion_pct: wave.completion_pct,
    ai_intervention_id: null,
    decision_status: wave.ai_intervention_id ? "recommended_action_pending_operator_approval" : "standard_execution",
  }));
}

function shapeLaneEventsForAct(laneEvents, act) {
  if (act !== "act-1") return laneEvents;

  return laneEvents
    .filter((event) => event.event_type !== "open_dedicated_lane")
    .map((event) => ({
      ...event,
      ai_recommendation_id: null,
      scenario_id: event.scenario_id,
    }));
}

async function collectChatContext(db, payload) {
  const metadata = await getMetadata(db);
  const scenarioQuery = payload.scenarioId ? { scenario_id: payload.scenarioId } : {};
  const actOneLaneQuery = payload.act === "act-1" ? {} : scenarioQuery;
  const [scenarios, recommendations, waves, laneEvents, asrsLogs, storeProfiles, orders] = await Promise.all([
    db.collection(collections.scenarioEvents).find(scenarioQuery).toArray(),
    db
      .collection(collections.recommendations)
      .find({ ...scenarioQuery, $or: [{ act: payload.act }, { act: "act-1" }] })
      .toArray(),
    db.collection(collections.waves).find({ day: metadata.demo_day }).sort({ wave_number: 1 }).toArray(),
    db.collection(collections.laneEvents).find({ day: metadata.demo_day, ...actOneLaneQuery }).sort({ timestamp: 1 }).limit(40).toArray(),
    db.collection(collections.asrsLogs).find({ day: metadata.demo_day, ...scenarioQuery }).sort({ timestamp: 1 }).limit(40).toArray(),
    db.collection(collections.storeProfiles).find({}).toArray(),
    db
      .collection(collections.orders)
      .find({ day: metadata.demo_day, ...scenarioFilter(payload.scenarioId) })
      .sort({ created_at: 1 })
      .limit(80)
      .toArray(),
  ]);

  return {
    metadata,
    request: {
      act: payload.act,
      scenarioId: payload.scenarioId || "all-scenarios",
      visibleScreen: payload.visibleScreen || "unknown",
      operatorDecisionRequired: payload.act === "act-1",
      responseMode: payload.act === "act-1" ? "recommend_options" : "explain_or_prescribe",
    },
    scenarios: shapeScenariosForAct(scenarios, payload.act),
    recommendations: shapeRecommendationsForAct(recommendations, payload.act),
    waves: shapeWavesForAct(waves, payload.act),
    laneEvents: shapeLaneEventsForAct(laneEvents, payload.act),
    asrsLogs,
    storeProfiles: storeProfiles.map((store) => ({
      store_id: store.store_id,
      store_name: store.store_name,
      sla_window_hours: store.sla_window_hours,
      average_daily_orders: store.average_daily_orders,
      recurring_patterns: store.recurring_patterns,
      sla_risk_profile: store.sla_risk_profile,
    })),
    orderSample: orders.map((order) => ({
      order_id: order.order_id,
      store_id: order.store_id,
      priority: order.priority,
      wave_id: order.wave_id,
      order_status: order.order_status,
      is_aged: order.is_aged,
      aging_reason: order.aging_reason,
      exceptions: order.exceptions,
      sku_id: order.sku_id,
      scenario_ids: order.scenario_ids,
    })),
  };
}

function systemPrompt() {
  return [
    "You are a live WES operations monitoring agent embedded in a production warehouse execution system.",
    "You are monitoring active fulfillment, wave execution, ASRS performance, sorter lanes, store demand, and SLA risk.",
    "Never mention that this is a demo, interview, synthetic dataset, seeded data, scenario, narrative, or three-act experience.",
    "Answer with domain-specific operational reasoning grounded only in the supplied JSON context and speak as if the data is live production telemetry.",
    "If the context does not contain enough evidence, say what is missing instead of inventing facts.",
    "When request.operatorDecisionRequired is true, operate in live decision-support mode: state the risk, present 2-3 operator-selectable options, identify the preferred option, and ask the operator to approve or choose an option.",
    "In live decision-support mode, do not say a mitigation has already been executed unless the current user message explicitly states they approved or executed it.",
    "In live decision-support mode, avoid outcome language such as recovered, completed, cleared, stabilized, or shipped on time unless it is framed as expected impact.",
    "When the user asks about past performance, explain observed operational causes and outcomes from the provided evidence.",
    "When the user asks about future planning, recommend next-shift operating changes using the provided historical and current evidence.",
    "Keep responses concise, decisive, and action-oriented for an operations supervisor.",
  ].join("\n");
}

app.post(
  "/api/agent/chat",
  asyncHandler(async (req, res) => {
    if (!config.openAiApiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured. Agent chat requires OpenAI." });
    }

    const payload = chatSchema.parse(req.body);
    const db = await connectDb();
    const context = await collectChatContext(db, payload);
    const openai = new OpenAI({ apiKey: config.openAiApiKey });
    const history = (payload.history || []).slice(-8);

    const stream = await openai.responses.create({
      model: config.openAiModel,
      instructions: systemPrompt(),
      input: [
        { role: "user", content: `Operational context JSON:\n${JSON.stringify(context, null, 2)}` },
        ...history.map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: payload.message },
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && event.delta) {
        res.write(event.delta);
      }
      if (event.type === "response.refusal.delta" && event.delta) {
        res.write(event.delta);
      }
    }

    res.end();
  }),
);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid request payload", details: error.issues });
  }
  res.status(500).json({ error: error.message || "Unexpected server error" });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`WES demo API listening on http://localhost:${config.port}`);
  });
}

module.exports = { app };
