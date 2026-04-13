import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { orders, reports, webhookEvents, apiCosts, agentDecisions } from "./schema";
import { generateId } from "../utils";

// ── Orders ──

export async function createOrder(data: {
  companyName: string;
  focusArea?: string;
  email?: string;
  taskDescription?: string;
  pipelineTier?: string;
}) {
  const id = generateId();
  const now = new Date().toISOString();
  const tierPrices: Record<string, number> = { quick: 0.5, standard: 2, deep: 10 };
  const tier = data.pipelineTier || "quick";
  const price = tierPrices[tier] || 3;
  await db.insert(orders).values({
    id,
    companyName: data.companyName,
    focusArea: data.focusArea || "all",
    email: data.email || null,
    taskDescription: data.taskDescription || null,
    pipelineTier: tier,
    amountUsdc: price,
    status: "CREATED",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function getOrder(id: string) {
  const result = await db.select().from(orders).where(eq(orders.id, id));
  return result[0] || null;
}

export async function updateOrderStatus(
  id: string,
  status: string,
  extra?: Partial<{
    checkoutSessionId: string;
    locusTransactionId: string;
    errorMessage: string;
    completedAt: string;
  }>
) {
  await db
    .update(orders)
    .set({
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    })
    .where(eq(orders.id, id));
}

export async function getAllOrders() {
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

// ── Reports ──

export async function createReport(data: {
  orderId: string;
  contentJson: string;
  contentMarkdown: string;
  sources: string;
  researchCostUsdc: number;
}) {
  const id = generateId();
  await db.insert(reports).values({
    id,
    ...data,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getReportByOrderId(orderId: string) {
  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.orderId, orderId));
  return result[0] || null;
}

export async function getReport(id: string) {
  const result = await db.select().from(reports).where(eq(reports.id, id));
  return result[0] || null;
}

// ── Webhook Events ──

export async function createWebhookEvent(data: {
  eventType: string;
  payload: string;
  signature: string;
  verified: boolean;
}) {
  const id = generateId();
  await db.insert(webhookEvents).values({
    id,
    ...data,
    processed: false,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function markWebhookProcessed(id: string) {
  await db
    .update(webhookEvents)
    .set({ processed: true })
    .where(eq(webhookEvents.id, id));
}

export async function findWebhookByPayload(sessionId: string) {
  const all = await db.select().from(webhookEvents);
  return all.find((e) => {
    try {
      const p = JSON.parse(e.payload);
      return p.data?.sessionId === sessionId && e.processed;
    } catch {
      return false;
    }
  });
}

// ── API Costs ──

export async function logApiCost(data: {
  orderId: string;
  provider: string;
  endpoint: string;
  costUsdc: number;
}) {
  const id = generateId();
  await db.insert(apiCosts).values({
    id,
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export async function getCostsByOrderId(orderId: string) {
  return db.select().from(apiCosts).where(eq(apiCosts.orderId, orderId));
}

export async function getTotalCosts() {
  const result = await db
    .select({
      total: sql<number>`sum(${apiCosts.costUsdc})`,
      count: sql<number>`count(*)`,
    })
    .from(apiCosts);
  return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
}

// ── Agent Decisions ──

export async function logDecision(data: {
  orderId: string;
  step: number;
  round?: number;
  action: string;
  provider?: string;
  specialist?: string;
  reasoning: string;
  resultSummary?: string;
  costUsdc?: number;
  durationMs?: number;
  status?: string;
}) {
  const id = generateId();
  await db.insert(agentDecisions).values({
    id,
    orderId: data.orderId,
    step: data.step,
    round: data.round || 0,
    action: data.action,
    specialist: data.specialist || null,
    provider: data.provider || null,
    reasoning: data.reasoning,
    resultSummary: data.resultSummary || null,
    costUsdc: data.costUsdc || 0,
    durationMs: data.durationMs || null,
    status: data.status || "success",
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateDecisionStatus(
  id: string,
  status: string,
  extra?: { resultSummary?: string; costUsdc?: number; durationMs?: number }
) {
  await db
    .update(agentDecisions)
    .set({ status, ...extra })
    .where(eq(agentDecisions.id, id));
}

export async function getDecisionsByOrderId(orderId: string, afterStep?: number) {
  if (afterStep !== undefined) {
    return db
      .select()
      .from(agentDecisions)
      .where(
        sql`${agentDecisions.orderId} = ${orderId} AND ${agentDecisions.step} > ${afterStep}`
      )
      .orderBy(agentDecisions.step);
  }
  return db
    .select()
    .from(agentDecisions)
    .where(eq(agentDecisions.orderId, orderId))
    .orderBy(agentDecisions.step);
}

export async function updatePipelineState(
  id: string,
  phase: number,
  state: string
) {
  await db
    .update(orders)
    .set({
      pipelinePhase: phase,
      pipelineState: state,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, id));
}

export async function updateOrderClassification(
  id: string,
  taskType: string,
  classificationJson: string
) {
  await db
    .update(orders)
    .set({ taskType, classificationJson, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id));
}
