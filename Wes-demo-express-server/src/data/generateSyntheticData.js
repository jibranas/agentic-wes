const DEMO_DAY = "2026-04-21";
const STORE_X = "STORE-108";
const PRIORITY_STORE = "STORE-214";

const stores = [
  { storeId: "STORE-101", name: "North Bergen", region: "Northeast", slaHours: 8, baseOrders: 34 },
  { storeId: STORE_X, name: "Yonkers Flagship", region: "Northeast", slaHours: 6, baseOrders: 42 },
  { storeId: "STORE-117", name: "Allentown", region: "Northeast", slaHours: 8, baseOrders: 28 },
  { storeId: "STORE-126", name: "Cherry Hill", region: "Northeast", slaHours: 8, baseOrders: 31 },
  { storeId: "STORE-139", name: "Stamford", region: "Northeast", slaHours: 7, baseOrders: 25 },
  { storeId: "STORE-152", name: "King of Prussia", region: "Northeast", slaHours: 8, baseOrders: 29 },
  { storeId: "STORE-188", name: "Bridgewater", region: "Northeast", slaHours: 8, baseOrders: 24 },
  { storeId: "STORE-203", name: "Queens", region: "Metro", slaHours: 6, baseOrders: 37 },
  { storeId: PRIORITY_STORE, name: "Brooklyn High Demand", region: "Metro", slaHours: 5, baseOrders: 39 },
  { storeId: "STORE-226", name: "White Plains", region: "Metro", slaHours: 7, baseOrders: 26 },
  { storeId: "STORE-244", name: "Jersey City", region: "Metro", slaHours: 6, baseOrders: 33 },
  { storeId: "STORE-260", name: "Hoboken", region: "Metro", slaHours: 7, baseOrders: 22 },
];

const highDemandSkus = ["SKU-1001", "SKU-1014", "SKU-1033", "SKU-1048", "SKU-1062", "SKU-1081"];
const allSkus = Array.from({ length: 90 }, (_, index) => `SKU-${String(1001 + index).padStart(4, "0")}`);
const laneIds = ["LANE-01", "LANE-02", "LANE-03", "LANE-04", "LANE-05", "LANE-06"];
const asrsAisles = ["ASRS-A1", "ASRS-A2", "ASRS-A3", "ASRS-A4"];

function createRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function iso(date) {
  return date.toISOString();
}

function dateAt(day, hour, minute = 0) {
  return new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
}

function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

function dayOffset(day, offset) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDay(date);
}

function isTuesday(day) {
  return new Date(`${day}T12:00:00.000Z`).getUTCDay() === 2;
}

function weightedStatus(random, isDemoDay, hasIntervention) {
  const roll = random();
  if (isDemoDay && !hasIntervention && roll > 0.96) return "aged-out";
  if (roll > 0.985) return "cancelled";
  if (roll > 0.95) return "packed";
  if (roll > 0.89) return "in-pick";
  return "shipped";
}

function demandMultiplier(day, storeId, waveIndex) {
  let multiplier = 1;
  const dow = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  if (dow === 1 || dow === 5) multiplier += 0.12;
  if (dow === 6 || dow === 0) multiplier -= 0.18;

  if (storeId === STORE_X && isTuesday(day)) multiplier += day === DEMO_DAY ? 0.72 : 0.42;
  if (storeId === STORE_X && day === DEMO_DAY && waveIndex === 1) multiplier += 0.62;
  if (storeId === PRIORITY_STORE && day === DEMO_DAY && waveIndex === 2) multiplier += 0.48;

  return multiplier;
}

function waveTimes(day, index) {
  const starts = [
    [6, 0],
    [9, 30],
    [12, 45],
    [15, 30],
  ];
  const [hour, minute] = starts[index];
  const release = dateAt(day, hour, minute);
  return {
    release,
    plannedCompletion: addMinutes(release, 165),
  };
}

function buildWaves(days) {
  return days.flatMap((day) =>
    [0, 1, 2, 3].map((waveIndex) => {
      const { release, plannedCompletion } = waveTimes(day, waveIndex);
      const isEarlyRelease = day === DEMO_DAY && waveIndex === 1;
      const actualRelease = isEarlyRelease ? addMinutes(release, -42) : addMinutes(release, waveIndex === 2 ? 8 : 0);
      const actualCompletion = addMinutes(plannedCompletion, day === DEMO_DAY && waveIndex === 1 ? 4 : waveIndex * 3);

      return {
        wave_id: `${day}-W${waveIndex + 1}`,
        day,
        wave_number: waveIndex + 1,
        wave_release_time: iso(release),
        wave_actual_release_time: iso(actualRelease),
        wave_planned_completion: iso(plannedCompletion),
        wave_actual_completion: iso(actualCompletion),
        planned_order_count: 0,
        actual_order_count: 0,
        completion_pct: day === DEMO_DAY && waveIndex === 1 ? 98.4 : 96 + waveIndex,
        ai_intervention_id: isEarlyRelease ? "REC-ASRS-001" : null,
        notes: isEarlyRelease ? "Released early to offset ASRS throughput degradation." : "Released on standard wave cadence.",
      };
    }),
  );
}

function createOrder({ day, wave, store, orderIndex, random }) {
  const waveIndex = wave.wave_number - 1;
  const multiplier = demandMultiplier(day, store.storeId, waveIndex);
  const minuteIntoWave = Math.floor(random() * 90);
  const createdAt = addMinutes(new Date(wave.wave_release_time), -40 + minuteIntoWave);
  const pickStart = addMinutes(new Date(wave.wave_actual_release_time), 12 + Math.floor(random() * 35));
  const specialStoreSurge = day === DEMO_DAY && store.storeId === STORE_X && waveIndex === 1;
  const specialPriorityLag = day === DEMO_DAY && store.storeId === PRIORITY_STORE && waveIndex === 2;
  const asrsSlow = day === DEMO_DAY && waveIndex === 1;
  const interventionEffect = specialStoreSurge || specialPriorityLag || asrsSlow;
  const pickDuration = 18 + Math.floor(random() * 36) + (asrsSlow ? 16 : 0) + (specialPriorityLag ? 18 : 0);
  const packDuration = 14 + Math.floor(random() * 24) + (specialStoreSurge ? 8 : 0);
  const pickComplete = addMinutes(pickStart, pickDuration);
  const packComplete = addMinutes(pickComplete, packDuration);
  const ship = addMinutes(packComplete, specialStoreSurge ? 32 : 22 + Math.floor(random() * 45));
  const priority = specialPriorityLag || store.storeId === PRIORITY_STORE ? "high" : random() > 0.86 ? "expedite" : "standard";
  const status = weightedStatus(random, day === DEMO_DAY, interventionEffect);
  const isCancelled = status === "cancelled";
  const isAged = status === "aged-out" || (specialPriorityLag && orderIndex % 9 === 0);
  const agingReason = isAged
    ? specialPriorityLag
      ? "routing_delay"
      : specialStoreSurge
        ? "sorter_jam"
        : asrsSlow
          ? "equipment_fault"
          : "labor_shortage"
    : null;
  const sku = highDemandSkus.includes(allSkus[orderIndex % allSkus.length])
    ? allSkus[orderIndex % allSkus.length]
    : random() > 0.72
      ? highDemandSkus[Math.floor(random() * highDemandSkus.length)]
      : allSkus[Math.floor(random() * allSkus.length)];
  const isHighDemandSku = highDemandSkus.includes(sku);
  const qtyOrdered = 1 + Math.floor(random() * (isHighDemandSku ? 8 : 4));
  const shortPick = random() > 0.975;
  const exceptions = [];
  if (specialStoreSurge && orderIndex % 7 === 0) exceptions.push("store_demand_surge_watch");
  if (asrsSlow && orderIndex % 8 === 0) exceptions.push("asrs_cycle_time_degradation");
  if (specialPriorityLag && orderIndex % 6 === 0) exceptions.push("sla_reprioritized");
  if (shortPick) exceptions.push("short_pick");

  return {
    order_id: `${day.replaceAll("-", "")}-${wave.wave_number}-${store.storeId}-${String(orderIndex).padStart(4, "0")}`,
    order_type: "store_replenishment",
    priority,
    customer_id: null,
    store_id: store.storeId,
    store_name: store.name,
    created_at: iso(createdAt),
    wave_id: wave.wave_id,
    wave_release_time: wave.wave_release_time,
    wave_planned_completion: wave.wave_planned_completion,
    wave_actual_completion: wave.wave_actual_completion,
    line_id: `LINE-${String((orderIndex % 18) + 1).padStart(2, "0")}`,
    sku_id: sku,
    qty_ordered: qtyOrdered,
    qty_fulfilled: shortPick ? Math.max(0, qtyOrdered - 1) : qtyOrdered,
    uom: random() > 0.82 ? "case" : "each",
    order_status: isCancelled ? "cancelled" : isAged ? "aged-out" : status,
    pick_start_time: iso(pickStart),
    pick_complete_time: iso(pickComplete),
    pack_complete_time: iso(packComplete),
    ship_time: status === "shipped" ? iso(ship) : null,
    current_location: status === "shipped" ? "dock-door-12" : status === "packed" ? "shipping-buffer" : "active-wave",
    is_aged: isAged,
    aging_reason: agingReason,
    is_cancelled: isCancelled,
    cancellation_reason: isCancelled ? "store_cutoff_missed" : null,
    exceptions,
    sku_demand_rank: isHighDemandSku ? "A" : random() > 0.65 ? "B" : "C",
    is_high_demand_sku: isHighDemandSku,
    days_to_ship_deadline: priority === "expedite" ? 0 : 1,
    demand_multiplier: Number(multiplier.toFixed(2)),
    scenario_ids: [
      specialStoreSurge ? "store-demand-surge" : null,
      asrsSlow ? "asrs-degradation" : null,
      specialPriorityLag ? "store-reprioritization" : null,
    ].filter(Boolean),
    ai_recommendation_ids: [
      specialStoreSurge ? "REC-LANE-001" : null,
      asrsSlow ? "REC-ASRS-001" : null,
      specialPriorityLag ? "REC-PRIORITY-001" : null,
    ].filter(Boolean),
  };
}

function buildOrders(days, waves) {
  const random = createRandom(39191);
  const orders = [];
  const waveMap = new Map(waves.map((wave) => [wave.wave_id, wave]));

  for (const day of days) {
    for (let waveIndex = 0; waveIndex < 4; waveIndex += 1) {
      const wave = waveMap.get(`${day}-W${waveIndex + 1}`);
      for (const store of stores) {
        const variance = 0.84 + random() * 0.35;
        const count = Math.round((store.baseOrders / 4) * demandMultiplier(day, store.storeId, waveIndex) * variance);
        for (let orderIndex = 0; orderIndex < count; orderIndex += 1) {
          orders.push(createOrder({ day, wave, store, orderIndex, random }));
        }
      }
    }
  }

  return orders;
}

function buildLaneEvents(days) {
  const events = [];
  for (const day of days) {
    for (let hour = 6; hour <= 17; hour += 1) {
      for (const laneId of laneIds) {
        const isLaneSixBeforeIntervention = laneId === "LANE-06" && day === DEMO_DAY && hour < 11;
        const isStoreXLane = day === DEMO_DAY && laneId === "LANE-06" && hour >= 11;
        const storeId = isStoreXLane ? STORE_X : stores[(hour + Number(laneId.slice(-2))) % stores.length].storeId;
        const baseThroughput = isLaneSixBeforeIntervention ? 0 : 52 + ((hour + Number(laneId.slice(-2))) % 12);
        const surgeBoost = isStoreXLane ? 39 : 0;
        events.push({
          event_id: `${day}-${laneId}-${hour}`,
          day,
          timestamp: iso(dateAt(day, hour, 0)),
          lane_id: laneId,
          status: isLaneSixBeforeIntervention ? "closed" : "open",
          assigned_store_id: isLaneSixBeforeIntervention ? null : storeId,
          capacity_per_hour: laneId === "LANE-06" ? 88 : 72,
          actual_throughput_per_hour: baseThroughput + surgeBoost,
          utilization_pct: isLaneSixBeforeIntervention ? 0 : Math.min(98, Math.round(((baseThroughput + surgeBoost) / (laneId === "LANE-06" ? 88 : 72)) * 100)),
          store_x_volume_per_hour: storeId === STORE_X ? baseThroughput + surgeBoost : day === DEMO_DAY && hour >= 9 && hour <= 12 ? 22 : 6,
          event_type: isStoreXLane && hour === 11 ? "open_dedicated_lane" : isLaneSixBeforeIntervention ? "closed" : "throughput_snapshot",
          ai_recommendation_id: isStoreXLane ? "REC-LANE-001" : null,
          scenario_id: isStoreXLane ? "store-demand-surge" : null,
        });
      }
    }
  }
  return events;
}

function buildAsrsLogs(days) {
  const logs = [];
  for (const day of days) {
    for (let hour = 6; hour <= 17; hour += 1) {
      for (const aisle of asrsAisles) {
        const degraded = day === DEMO_DAY && aisle === "ASRS-A2" && hour >= 9 && hour <= 11;
        logs.push({
          log_id: `${day}-${aisle}-${hour}`,
          day,
          timestamp: iso(dateAt(day, hour, 0)),
          aisle_id: aisle,
          robots_running: degraded ? 5 : 7,
          robots_faulted: degraded ? 2 : hour === 14 && aisle === "ASRS-A4" ? 1 : 0,
          lift_utilization_pct: degraded ? 94 : 72 + ((hour + aisle.charCodeAt(5)) % 11),
          cycle_time_seconds: degraded ? 78 + (hour - 9) * 7 : 42 + ((hour + aisle.charCodeAt(5)) % 9),
          throughput_per_hour: degraded ? 128 - (hour - 9) * 12 : 214 + ((hour + aisle.charCodeAt(5)) % 24),
          status: degraded ? "degraded" : "running",
          degradation_event: degraded,
          ai_recommendation_id: degraded ? "REC-ASRS-001" : null,
          scenario_id: degraded ? "asrs-degradation" : null,
        });
      }
    }
  }
  return logs;
}

function buildStoreProfiles(days, orders) {
  return stores.map((store) => {
    const demandByDay = days.map((day) => ({
      day,
      day_of_week: new Date(`${day}T12:00:00.000Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      order_count: orders.filter((order) => order.store_id === store.storeId && order.created_at.startsWith(day)).length,
    }));

    return {
      store_id: store.storeId,
      store_name: store.name,
      region: store.region,
      sla_window_hours: store.slaHours,
      average_daily_orders: Math.round(demandByDay.reduce((sum, item) => sum + item.order_count, 0) / demandByDay.length),
      demand_history: demandByDay,
      recurring_patterns:
        store.storeId === STORE_X
          ? [
              {
                pattern_id: "STORE-X-TUESDAY-SPIKE",
                description: "Store X has spiked above forecast on each of the last four Tuesdays.",
                day_of_week: "Tuesday",
                weeks_observed: 4,
                average_lift_pct: 47,
                recommended_action: "Pre-open a dedicated sorter lane for Store X at shift start.",
              },
            ]
          : [],
      sla_risk_profile: store.storeId === PRIORITY_STORE ? "high-demand-peak-risk" : store.storeId === STORE_X ? "recurring-demand-surge" : "standard",
    };
  });
}

function buildRecommendations() {
  return [
    {
      recommendation_id: "REC-LANE-001",
      scenario_id: "store-demand-surge",
      act: "act-1",
      title: "Open LANE-06 for Store 108",
      trigger_condition: "Store 108 order velocity exceeded forecast by 72% while active lanes were above 88% utilization.",
      recommendation: "Open LANE-06 and dedicate it to Store 108 until the backlog is below 40 orders.",
      confidence: 0.91,
      expected_impact: "Recover 184 at-risk orders and reduce aged-order risk by 67%.",
      accepted_action: "LANE-06 opened at 11:00 and assigned to Store 108.",
      observed_outcome: "Store 108 shipped on time with lane utilization stabilizing below 82% by 12:30.",
      evidence_collection_refs: ["orders", "lane_events", "store_profiles"],
    },
    {
      recommendation_id: "REC-ASRS-001",
      scenario_id: "asrs-degradation",
      act: "act-1",
      title: "Release Wave 2 Early",
      trigger_condition: "ASRS-A2 cycle time rose from 46s to 85s and throughput dropped below 140 lines/hour.",
      recommendation: "Release Wave 2 42 minutes early to keep downstream pick and pack labor fed.",
      confidence: 0.88,
      expected_impact: "Maintain outbound throughput despite ASRS degradation and protect wave completion SLA.",
      accepted_action: "Wave 2 released at 08:48 instead of 09:30.",
      observed_outcome: "Wave 2 completed four minutes late rather than an estimated 51 minutes late.",
      evidence_collection_refs: ["asrs_logs", "waves", "orders"],
    },
    {
      recommendation_id: "REC-PRIORITY-001",
      scenario_id: "store-reprioritization",
      act: "act-1",
      title: "Reprioritize Brooklyn High Demand Orders",
      trigger_condition: "Store 214 high-demand SKUs were tracking 31 minutes behind SLA inside active Wave 3.",
      recommendation: "Move Store 214 orders to high priority and pull them forward in the active wave.",
      confidence: 0.86,
      expected_impact: "Prevent 96 high-demand SKU orders from missing SLA.",
      accepted_action: "Priority changed to high for at-risk Store 214 orders.",
      observed_outcome: "The store cleared the active wave with 93% of at-risk orders shipped before cutoff.",
      evidence_collection_refs: ["orders", "waves", "store_profiles"],
    },
    {
      recommendation_id: "REC-LANE-003",
      scenario_id: "store-demand-surge",
      act: "act-3",
      title: "Pre-open Store 108 Lane Next Tuesday",
      trigger_condition: "Four-week Tuesday pattern shows recurring Store 108 demand spikes.",
      recommendation: "Pre-open LANE-06 for Store 108 at shift start on the next Tuesday shift.",
      confidence: 0.93,
      expected_impact: "Avoid mid-shift backlog formation and keep Store 108 inside SLA without emergency lane changes.",
      accepted_action: null,
      observed_outcome: null,
      evidence_collection_refs: ["store_profiles", "lane_events"],
    },
    {
      recommendation_id: "REC-ASRS-003",
      scenario_id: "asrs-degradation",
      act: "act-3",
      title: "Adjust Wave Release Baseline",
      trigger_condition: "ASRS-A2 degradation has occurred during the same mid-morning window in baseline logs.",
      recommendation: "Move Wave 2 release 30 minutes earlier when ASRS-A2 cycle time exceeds 65 seconds before 09:00.",
      confidence: 0.84,
      expected_impact: "Maintain wave completion even when ASRS recovery takes longer than maintenance estimates.",
      accepted_action: null,
      observed_outcome: null,
      evidence_collection_refs: ["asrs_logs", "waves"],
    },
    {
      recommendation_id: "REC-PRIORITY-003",
      scenario_id: "store-reprioritization",
      act: "act-3",
      title: "Add Peak Priority Buffer for Store 214",
      trigger_condition: "Store 214 high-demand SKU velocity rises during peak periods and compresses SLA slack.",
      recommendation: "Reserve a priority buffer in Wave 3 for Store 214 high-demand SKUs during peak days.",
      confidence: 0.87,
      expected_impact: "Reduce need for emergency reprioritization and protect premium-store service levels.",
      accepted_action: null,
      observed_outcome: null,
      evidence_collection_refs: ["orders", "store_profiles"],
    },
  ];
}

function buildScenarioEvents() {
  return [
    {
      scenario_id: "store-demand-surge",
      title: "Store Demand Surge -> Lane Expansion",
      demo_day: DEMO_DAY,
      primary_store_id: STORE_X,
      act_1_summary: "AI detects Store 108 order velocity above forecast and recommends opening LANE-06.",
      act_2_summary: "Retrospective shows backlog growth flattened after the lane opened.",
      act_3_summary: "AI recommends pre-opening the lane on future Tuesdays due to the recurring spike pattern.",
      timeline: [
        { time: `${DEMO_DAY}T09:45:00.000Z`, label: "Demand velocity exceeds forecast", evidence: "Store 108 order velocity +72%." },
        { time: `${DEMO_DAY}T10:20:00.000Z`, label: "Backlog aging risk detected", evidence: "184 orders projected to miss SLA." },
        { time: `${DEMO_DAY}T10:45:00.000Z`, label: "AI recommends lane expansion", evidence: "REC-LANE-001 generated." },
        { time: `${DEMO_DAY}T11:00:00.000Z`, label: "LANE-06 opened", evidence: "Dedicated Store 108 throughput added." },
      ],
    },
    {
      scenario_id: "asrs-degradation",
      title: "ASRS Throughput Degradation -> Early Wave Release",
      demo_day: DEMO_DAY,
      primary_store_id: null,
      act_1_summary: "AI sees ASRS-A2 cycle time degradation and recommends early Wave 2 release.",
      act_2_summary: "Retrospective ties the intervention to avoided downstream starvation.",
      act_3_summary: "AI recommends a conditional earlier release rule based on ASRS baselines.",
      timeline: [
        { time: `${DEMO_DAY}T08:35:00.000Z`, label: "ASRS-A2 cycle time rising", evidence: "Cycle time approaches 70 seconds." },
        { time: `${DEMO_DAY}T08:44:00.000Z`, label: "Throughput risk projected", evidence: "Projected wave delay over 50 minutes." },
        { time: `${DEMO_DAY}T08:48:00.000Z`, label: "Wave 2 released early", evidence: "REC-ASRS-001 accepted." },
      ],
    },
    {
      scenario_id: "store-reprioritization",
      title: "High-Demand Store Falling Behind -> Reprioritization",
      demo_day: DEMO_DAY,
      primary_store_id: PRIORITY_STORE,
      act_1_summary: "AI detects Store 214 high-demand SKU orders falling behind SLA and recommends reprioritization.",
      act_2_summary: "Retrospective shows the priority change recovered most at-risk orders.",
      act_3_summary: "AI recommends building a priority buffer for Store 214 in peak Wave 3 plans.",
      timeline: [
        { time: `${DEMO_DAY}T13:25:00.000Z`, label: "Store 214 lag detected", evidence: "Orders 31 minutes behind SLA trajectory." },
        { time: `${DEMO_DAY}T13:40:00.000Z`, label: "AI recommends reprioritization", evidence: "REC-PRIORITY-001 generated." },
        { time: `${DEMO_DAY}T13:50:00.000Z`, label: "Orders pulled forward", evidence: "High-demand SKUs moved to high priority." },
      ],
    },
  ];
}

function buildRobotStatus() {
  return asrsAisles.flatMap((aisle) =>
    Array.from({ length: 8 }, (_, index) => {
      const faulted = aisle === "ASRS-A2" && (index === 2 || index === 5);
      return {
        robot_id: `${aisle}-BOT-${index + 1}`,
        aisle_id: aisle,
        status: faulted ? "faulted" : index === 7 ? "charging" : "running",
        battery_pct: faulted ? 42 : 58 + ((index * 7) % 34),
        current_task: faulted ? "awaiting-maintenance" : index === 7 ? "charge-cycle" : "case-retrieval",
        last_seen_at: iso(dateAt(DEMO_DAY, 11, 15 + index)),
        scenario_id: faulted ? "asrs-degradation" : null,
      };
    }),
  );
}

function attachWaveCounts(waves, orders) {
  const counts = new Map();
  for (const order of orders) {
    counts.set(order.wave_id, (counts.get(order.wave_id) || 0) + 1);
  }
  return waves.map((wave) => ({
    ...wave,
    planned_order_count: Math.round((counts.get(wave.wave_id) || 0) * 0.96),
    actual_order_count: counts.get(wave.wave_id) || 0,
  }));
}

function generateSyntheticData() {
  const days = Array.from({ length: 30 }, (_, index) => dayOffset(DEMO_DAY, index - 24));
  const waves = buildWaves(days);
  const orders = buildOrders(days, waves);
  const enrichedOrders = orders.map((order) => ({ ...order, day: order.created_at.slice(0, 10) }));

  return {
    metadata: {
      demo_day: DEMO_DAY,
      store_x: STORE_X,
      priority_store: PRIORITY_STORE,
      generated_at: iso(new Date()),
    },
    orders: enrichedOrders,
    waves: attachWaveCounts(waves, enrichedOrders),
    laneEvents: buildLaneEvents(days),
    asrsLogs: buildAsrsLogs(days),
    storeProfiles: buildStoreProfiles(days, enrichedOrders),
    recommendations: buildRecommendations(),
    scenarioEvents: buildScenarioEvents(),
    robotStatus: buildRobotStatus(),
  };
}

module.exports = { DEMO_DAY, PRIORITY_STORE, STORE_X, generateSyntheticData };
