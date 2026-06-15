const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export type ScenarioId = "store-demand-surge" | "asrs-degradation" | "store-reprioritization";
export type ActId = "act-1" | "act-2" | "act-3";

export type Summary = {
  day: string;
  orders: {
    totalOrders: number;
    agedOrders: number;
    cancelledOrders: number;
    highDemandOrders: number;
  };
  waves: Wave[];
  activeRecommendations: Recommendation[];
};

export type Wave = {
  wave_id: string;
  wave_number: number;
  wave_release_time: string;
  wave_actual_release_time: string;
  wave_planned_completion: string;
  wave_actual_completion: string;
  completion_pct: number;
  planned_order_count: number;
  actual_order_count: number;
  ai_intervention_id: string | null;
  notes: string;
};

export type Recommendation = {
  recommendation_id: string;
  scenario_id: ScenarioId;
  act: ActId;
  title: string;
  trigger_condition: string;
  recommendation: string;
  confidence: number;
  expected_impact: string;
  accepted_action: string | null;
  observed_outcome: string | null;
};

export type Scenario = {
  scenario_id: ScenarioId;
  title: string;
  act_1_summary: string;
  act_2_summary: string;
  act_3_summary: string;
  timeline: { time: string; label: string; evidence: string }[];
};

export type Order = {
  order_id: string;
  priority: string;
  store_id: string;
  store_name: string;
  wave_id: string;
  sku_id: string;
  qty_ordered: number;
  order_status: string;
  is_aged: boolean;
  aging_reason: string | null;
  exceptions: string[];
};

export type LaneEvent = {
  event_id: string;
  timestamp: string;
  lane_id: string;
  status: string;
  assigned_store_id: string | null;
  capacity_per_hour: number;
  actual_throughput_per_hour: number;
  utilization_pct: number;
  store_x_volume_per_hour: number;
  event_type: string;
  scenario_id: ScenarioId | null;
};

export type AsrsLog = {
  log_id: string;
  timestamp: string;
  aisle_id: string;
  robots_running: number;
  robots_faulted: number;
  lift_utilization_pct: number;
  cycle_time_seconds: number;
  throughput_per_hour: number;
  status: string;
  degradation_event: boolean;
};

export type RobotStatus = {
  robot_id: string;
  aisle_id: string;
  status: string;
  battery_pct: number;
  current_task: string;
};

export type StoreProfile = {
  store_id: string;
  store_name: string;
  sla_window_hours: number;
  average_daily_orders: number;
  recurring_patterns: { description: string; average_lift_pct: number; recommended_action: string }[];
  sla_risk_profile: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return response.json();
}

export async function fetchDemoData() {
  const [summary, scenarios, recommendations, orders, lanes, asrs, robots, stores] = await Promise.all([
    getJson<Summary>("/api/dashboard/summary"),
    getJson<Scenario[]>("/api/scenarios"),
    getJson<Recommendation[]>("/api/recommendations"),
    getJson<Order[]>("/api/orders?limit=160"),
    getJson<LaneEvent[]>("/api/lanes"),
    getJson<AsrsLog[]>("/api/asrs"),
    getJson<RobotStatus[]>("/api/asrs/robots"),
    getJson<StoreProfile[]>("/api/stores"),
  ]);

  return { summary, scenarios, recommendations, orders, lanes, asrs, robots, stores };
}

export async function streamAgentMessage(
  input: {
  act: ActId;
  scenarioId: ScenarioId;
  visibleScreen: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  },
  onDelta: (delta: string) => void,
) {
  const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      throw new Error(body.error || "Agent chat failed");
    }
    throw new Error((await response.text()) || "Agent chat failed");
  }

  if (!response.body) {
    throw new Error("Agent chat response did not include a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }

  const finalText = decoder.decode();
  if (finalText) onDelta(finalText);
}
