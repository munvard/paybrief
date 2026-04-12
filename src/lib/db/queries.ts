import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { orders, reports, webhookEvents, apiCosts } from "./schema";
import { generateId } from "../utils";

// ── Orders ──

export async function createOrder(data: {
  companyName: string;
  focusArea: string;
  email?: string;
}) {
  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(orders).values({
    id,
    companyName: data.companyName,
    focusArea: data.focusArea,
    email: data.email || null,
    amountUsdc: Number(process.env.BRIEF_PRICE_USDC) || 5,
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
