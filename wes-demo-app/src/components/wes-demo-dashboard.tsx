"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Factory,
  GitBranch,
  Layers3,
  MessageSquare,
  PackageCheck,
  Send,
  Sparkles,
} from "lucide-react";
import {
  ActId,
  AsrsLog,
  LaneEvent,
  Order,
  Recommendation,
  RobotStatus,
  Scenario,
  ScenarioId,
  StoreProfile,
  Summary,
  Wave,
  streamAgentMessage,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type DemoData = {
  summary: Summary;
  scenarios: Scenario[];
  recommendations: Recommendation[];
  orders: Order[];
  lanes: LaneEvent[];
  asrs: AsrsLog[];
  robots: RobotStatus[];
  stores: StoreProfile[];
};

const acts: { id: ActId; label: string; title: string; description: string }[] = [
  {
    id: "act-1",
    label: "Act 1",
    title: "During Shift",
    description: "AI intervenes mid-execution to prevent bad outcomes.",
  },
  {
    id: "act-2",
    label: "Act 2",
    title: "Post Shift",
    description: "AI explains what happened and why.",
  },
  {
    id: "act-3",
    label: "Act 3",
    title: "Pre Next Shift",
    description: "AI recommends improvements for the next shift.",
  },
];

const scenarioLabels: Record<ScenarioId, string> = {
  "store-demand-surge": "Store Demand Surge",
  "asrs-degradation": "ASRS Degradation",
  "store-reprioritization": "Store Reprioritization",
};

const scenarioAccent: Record<ScenarioId, string> = {
  "store-demand-surge": "bg-blue-50 text-blue-700 border-blue-200",
  "asrs-degradation": "bg-amber-50 text-amber-700 border-amber-200",
  "store-reprioritization": "bg-violet-50 text-violet-700 border-violet-200",
};

export function WesDemoDashboard({ data }: { data: DemoData }) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [activeAct, setActiveAct] = useState<ActId>("act-1");
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("store-demand-surge");
  const [visibleScreen, setVisibleScreen] = useState("operations-dashboard");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content:
        "I am monitoring the active shift. I will surface live risks, explain operational drivers, and recommend actions based on current WES telemetry.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const activeScenarioRecord = data.scenarios.find((scenario) => scenario.scenario_id === activeScenario) || data.scenarios[0];
  const actRecommendations = data.recommendations.filter(
    (recommendation) => recommendation.act === activeAct || (activeAct === "act-2" && recommendation.act === "act-1"),
  );
  const selectedRecommendation =
    actRecommendations.find((recommendation) => recommendation.scenario_id === activeScenario) ||
    data.recommendations.find((recommendation) => recommendation.scenario_id === activeScenario);
  const actSummary =
    activeAct === "act-1"
      ? activeScenarioRecord?.act_1_summary
      : activeAct === "act-2"
        ? activeScenarioRecord?.act_2_summary
        : activeScenarioRecord?.act_3_summary;
  const scenarioOrders = data.orders.filter((order) => order.exceptions.length || order.store_id === "STORE-108" || order.store_id === "STORE-214");
  const latestLaneById = useMemo(() => latestBy(data.lanes, "lane_id"), [data.lanes]);
  const latestAsrsByAisle = useMemo(() => latestBy(data.asrs, "aisle_id"), [data.asrs]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, activeAct]);

  async function sendChatMessage(messageText: string) {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isSending) return;
    const nextMessages = [
      ...messages,
      { role: "user" as const, content: trimmedMessage },
      { role: "assistant" as const, content: "" },
    ];
    const assistantMessageIndex = nextMessages.length - 1;
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      await streamAgentMessage(
        {
          act: activeAct,
          scenarioId: activeScenario,
          visibleScreen,
          message: trimmedMessage,
          history: messages,
        },
        (delta) => {
          setMessages((currentMessages) =>
            currentMessages.map((message, index) =>
              index === assistantMessageIndex ? { ...message, content: `${message.content}${delta}` } : message,
            ),
          );
        },
      );
    } catch (error) {
      setMessages((currentMessages) =>
        currentMessages.map((message, index) =>
          index === assistantMessageIndex
            ? { ...message, content: error instanceof Error ? error.message : "OpenAI agent call failed." }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    await sendChatMessage(draft);
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="h-dvh overflow-hidden bg-slate-950 text-slate-950">
      <div className="grid h-dvh grid-cols-[260px_1fr_380px] overflow-hidden">
        <aside className="h-dvh overflow-hidden border-r border-white/10 bg-slate-950 p-5 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-400">WES AI Demo</p>
              <h1 className="font-semibold">Shift Storyline</h1>
            </div>
          </div>

          <Tabs value={activeAct} onValueChange={(value) => setActiveAct(value as ActId)} orientation="vertical">
            <TabsList className="h-auto w-full flex-col items-stretch rounded-none bg-transparent p-0">
            {acts.map((act) => (
              <TabsTrigger
                key={act.id}
                value={act.id}
                className={cn(
                  "h-auto w-full justify-start rounded-xl border p-3 text-left text-white data-active:text-white",
                  activeAct === act.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 hover:bg-white/5",
                )}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{act.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-1 font-medium">{act.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{act.description}</p>
                </div>
              </TabsTrigger>
            ))}
            </TabsList>
          </Tabs>

          <div className="mt-8">
            <Separator className="mb-6 bg-white/10" />
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Scenario Spine</p>
            <div className="space-y-2">
              {data.scenarios.map((scenario) => (
                <Button
                  key={scenario.scenario_id}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveScenario(scenario.scenario_id)}
                  className={cn(
                    "h-auto w-full justify-start rounded-lg border px-3 py-2 text-left text-sm",
                    activeScenario === scenario.scenario_id ? "border-white bg-white text-slate-950" : "border-white/10 text-slate-300 hover:bg-white/5",
                  )}
                >
                  {scenarioLabels[scenario.scenario_id]}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <ScrollArea className="h-dvh bg-slate-100">
        <main>
          <section className="border-b border-slate-200 bg-white px-8 py-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Demo day: {data.summary.day}
                </Badge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{acts.find((act) => act.id === activeAct)?.title}</h2>
                <p className="mt-2 max-w-3xl text-slate-600">
                  {actSummary}
                </p>
              </div>
              <Card className="w-72">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-cyan-600" />
                    AI Role
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {activeAct === "act-1" && "Real-time intervention"}
                  {activeAct === "act-2" && "Retrospective explanation"}
                  {activeAct === "act-3" && "Prescriptive planning"}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-6 p-8">
            <KpiGrid summary={data.summary} />

            {selectedRecommendation ? (
              <Card className={cn("border", scenarioAccent[selectedRecommendation.scenario_id])}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>{selectedRecommendation.title}</CardTitle>
                      <CardDescription>{selectedRecommendation.trigger_condition}</CardDescription>
                    </div>
                    <Badge variant="default">{Math.round(selectedRecommendation.confidence * 100)}% confidence</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <EvidenceBlock title="Recommendation" value={selectedRecommendation.recommendation} />
                  <EvidenceBlock title="Expected Impact" value={selectedRecommendation.expected_impact} />
                  <EvidenceBlock
                    title={activeAct === "act-1" ? "Operator Decision" : activeAct === "act-3" ? "Next Shift Action" : "Observed Outcome"}
                    value={
                      activeAct === "act-1"
                        ? "Pending operator approval. Select an action in the WES Operations Agent panel."
                        : selectedRecommendation.observed_outcome || selectedRecommendation.accepted_action || "Pending next-shift execution."
                    }
                  />
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <ScenarioTimeline scenario={activeScenarioRecord} />
              <WaveExecution waves={data.summary.waves} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <LaneMapping lanes={latestLaneById} onFocus={() => setVisibleScreen("lane-dashboard")} />
              <AsrsStatus asrs={latestAsrsByAisle} robots={data.robots} onFocus={() => setVisibleScreen("asrs-dashboard")} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <OrdersTable orders={scenarioOrders.slice(0, 12)} onFocus={() => setVisibleScreen("orders")} />
              <StoreProfiles stores={data.stores} />
            </div>
          </section>
        </main>
        </ScrollArea>

        <aside className="fixed bottom-0 right-0 top-0 z-20 flex h-dvh w-[380px] min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">WES Operations Agent</h2>
                  <p className="text-xs text-slate-500">Live telemetry assistant</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                LLM mode
              </Badge>
            </div>
          </div>

          {activeAct === "act-1" ? (
            <div className="shrink-0 p-4">
              <Alert className="border-cyan-100 bg-cyan-50">
                <Sparkles className="h-4 w-4 text-cyan-700" />
                <AlertTitle className="text-cyan-900">Operator decision required</AlertTitle>
                <AlertDescription className="text-cyan-800">{selectedRecommendation?.recommendation}</AlertDescription>
              </Alert>
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSending || !selectedRecommendation}
                  onClick={() =>
                    sendChatMessage(
                      `Approve recommended action ${selectedRecommendation?.recommendation_id}: ${selectedRecommendation?.recommendation}. Confirm what will happen next and what I should monitor.`,
                    )
                  }
                >
                  Approve recommended action
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isSending || !selectedRecommendation}
                  onClick={() =>
                    sendChatMessage(
                      `Show alternative options for ${selectedRecommendation?.recommendation_id}. Compare operational tradeoffs and ask me which option to select.`,
                    )
                  }
                >
                  Show alternatives
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSending || !selectedRecommendation}
                  onClick={() =>
                    sendChatMessage(
                      `Hold action on ${selectedRecommendation?.recommendation_id} for now. Explain the risk of waiting and what thresholds should trigger escalation.`,
                    )
                  }
                >
                  Hold action
                </Button>
              </div>
            </div>
          ) : null}

          <ScrollArea className="min-h-0 flex-1 border-y border-slate-200">
          <div className="flex min-h-full flex-col justify-end gap-3 p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={cn("rounded-xl p-3 text-sm", message.role === "assistant" ? "bg-slate-100" : "bg-slate-950 text-white")}>
                {message.role === "assistant" ? <ChatMarkdown content={message.content} /> : <p className="whitespace-pre-wrap">{message.content}</p>}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          </ScrollArea>

          <form onSubmit={submitMessage} className="shrink-0 bg-white p-4">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Ask about the current act, intervention, root cause, or next-shift recommendation..."
              className="min-h-24 resize-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Context: {scenarioLabels[activeScenario]} / {visibleScreen}</p>
              <Button type="submit" disabled={isSending}>
                <Send className="h-4 w-4" />
                {isSending ? "Sending" : "Send"}
              </Button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function latestBy<T extends object, K extends keyof T>(items: T[], key: K) {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(String(item[key]), item);
  }
  return Array.from(map.values());
}

function ChatMarkdown({ content }: { content: string }) {
  if (!content) return <span className="text-slate-400">Thinking...</span>;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        h1: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
        h2: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
        h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
        code: ({ children }) => <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function KpiGrid({ summary }: { summary: Summary }) {
  const items = [
    { label: "Demo Orders", value: summary.orders.totalOrders.toLocaleString(), icon: PackageCheck, tone: "text-blue-600" },
    { label: "High-Demand SKU Orders", value: summary.orders.highDemandOrders.toLocaleString(), icon: Boxes, tone: "text-violet-600" },
    { label: "Aged / At Risk", value: summary.orders.agedOrders.toLocaleString(), icon: AlertTriangle, tone: "text-amber-600" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{item.label}</p>
              <item.icon className={cn("h-5 w-5", item.tone)} />
            </div>
            <p className="mt-3 text-2xl font-semibold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EvidenceBlock({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border-white/60 bg-white/70 shadow-none">
      <CardContent className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
      </CardContent>
    </Card>
  );
}

function ScenarioTimeline({ scenario }: { scenario?: Scenario }) {
  if (!scenario) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Traceable Scenario Timeline
        </CardTitle>
        <CardDescription>{scenario.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenario.timeline.map((item) => (
          <div key={item.time} className="flex gap-3">
            <div className="mt-1 h-3 w-3 rounded-full bg-slate-950" />
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-slate-500">{new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="mt-1 text-sm text-slate-600">{item.evidence}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WaveExecution({ waves }: { waves: Wave[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers3 className="h-4 w-4" />
          Wave Execution
        </CardTitle>
        <CardDescription>Planned vs actual release, completion, and AI intervention linkage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {waves.map((wave) => (
          <Card key={wave.wave_id} className="border-slate-100 shadow-none">
            <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Wave {wave.wave_number}</p>
              {wave.ai_intervention_id ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {wave.ai_intervention_id}
                </Badge>
              ) : (
                <Badge variant="secondary">standard</Badge>
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{wave.actual_order_count} orders</span>
              <span>{wave.completion_pct}% complete</span>
            </div>
            <Progress value={wave.completion_pct} className="mt-2" />
            <p className="mt-2 text-xs text-slate-500">{wave.notes}</p>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function LaneMapping({ lanes, onFocus }: { lanes: LaneEvent[]; onFocus: () => void }) {
  return (
    <Card onMouseEnter={onFocus}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-4 w-4" />
          Store to Lane Mapping
        </CardTitle>
        <CardDescription>Lane status, capacity, utilization, and Store X surge volume.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {lanes.map((lane) => (
          <Card key={lane.event_id} className="border-slate-100 shadow-none">
            <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{lane.lane_id}</p>
              <Badge variant="secondary" className={lane.status === "open" ? "bg-emerald-100 text-emerald-800" : ""}>
                {lane.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">Store: {lane.assigned_store_id || "unassigned"}</p>
            <Progress value={lane.utilization_pct} className="mt-3" />
            <p className="mt-2 text-xs text-slate-500">{lane.actual_throughput_per_hour}/{lane.capacity_per_hour} orders/hr</p>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function AsrsStatus({ asrs, robots, onFocus }: { asrs: AsrsLog[]; robots: RobotStatus[]; onFocus: () => void }) {
  return (
    <Card onMouseEnter={onFocus}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          ASRS Robots & Aisles
        </CardTitle>
        <CardDescription>Faulted robots, cycle times, lift utilization, and throughput degradation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {asrs.map((log) => (
            <Card key={log.log_id} className="border-slate-100 shadow-none">
              <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{log.aisle_id}</p>
                <Badge variant="secondary" className={log.status === "degraded" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                  {log.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">{log.cycle_time_seconds}s cycle / {log.throughput_per_hour} lines/hr</p>
              <Progress value={log.lift_utilization_pct} className="mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-slate-50 shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Robot snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2 p-3 text-xs">
            {robots.slice(0, 8).map((robot) => (
              <Card key={robot.robot_id} className="rounded border-slate-200 shadow-none">
                <CardContent className="p-2">
                <p className="font-medium">{robot.robot_id.split("-").slice(-2).join("-")}</p>
                <p className={cn(robot.status === "faulted" ? "text-rose-600" : "text-slate-500")}>{robot.status}</p>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function OrdersTable({ orders, onFocus }: { orders: Order[]; onFocus: () => void }) {
  return (
    <Card onMouseEnter={onFocus}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Orders
        </CardTitle>
        <CardDescription>Scenario-linked order status, priority, SKU demand, and exception signal.</CardDescription>
      </CardHeader>
      <CardContent>
        <Card className="overflow-hidden border-slate-200 shadow-none">
          <Table>
            <TableHeader className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exception</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.order_id}>
                  <TableCell className="font-mono text-xs">{order.order_id.slice(-16)}</TableCell>
                  <TableCell>{order.store_id}</TableCell>
                  <TableCell>{order.priority}</TableCell>
                  <TableCell>{order.order_status}</TableCell>
                  <TableCell className="text-xs text-slate-500">{order.exceptions[0] || order.aging_reason || "none"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </CardContent>
    </Card>
  );
}

function StoreProfiles({ stores }: { stores: StoreProfile[] }) {
  const featured = stores.filter((store) => store.store_id === "STORE-108" || store.store_id === "STORE-214");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Store Demand Profiles
        </CardTitle>
        <CardDescription>Historical patterns used by the LLM context layer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {featured.map((store) => (
          <Card key={store.store_id} className="border-slate-100 shadow-none">
            <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{store.store_name}</p>
              <Badge variant="secondary">{store.sla_window_hours}h SLA</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{store.average_daily_orders} avg daily orders / {store.sla_risk_profile}</p>
            {store.recurring_patterns.map((pattern) => (
              <Alert key={pattern.description} className="mt-2 border-blue-100 bg-blue-50 p-2 text-blue-800">
                <AlertDescription className="text-xs text-blue-800">
                  {pattern.description} Recommended: {pattern.recommended_action}
                </AlertDescription>
              </Alert>
            ))}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
