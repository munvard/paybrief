import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  focusArea: text("focus_area").notNull().default("all"),
  email: text("email"),
  amountUsdc: real("amount_usdc").notNull().default(5),
  status: text("status").notNull().default("CREATED"),
  checkoutSessionId: text("checkout_session_id"),
  locusTransactionId: text("locus_transaction_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  contentJson: text("content_json").notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  sources: text("sources").notNull().default("[]"),
  researchCostUsdc: real("research_cost_usdc").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  signature: text("signature").notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const apiCosts = sqliteTable("api_costs", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  provider: text("provider").notNull(),
  endpoint: text("endpoint").notNull(),
  costUsdc: real("cost_usdc").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
