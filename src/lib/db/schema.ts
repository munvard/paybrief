import { pgTable, text, timestamp, integer, numeric, jsonb, boolean, primaryKey, index } from "drizzle-orm/pg-core";

export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pitch: text("pitch").notNull(),
  genome: text("genome").notNull(),
  parentId: text("parent_id"),
  handlerCodeHash: text("handler_code_hash"),
  handlerCode: text("handler_code"),
  bwlProjectId: text("bwl_project_id"),
  bwlServiceId: text("bwl_service_id"),
  bwlUrl: text("bwl_url"),
  mcpUrl: text("mcp_url"),
  walletAddress: text("wallet_address"),
  walletApiKeyEnc: text("wallet_api_key_enc"),
  pricePerCallUsdc: numeric("price_per_call_usdc", { precision: 10, scale: 4 }).notNull().default("0.05"),
  llmCostEstimateUsdc: numeric("llm_cost_estimate_usdc", { precision: 10, scale: 4 }).notNull().default("0.02"),
  status: text("status").notNull().default("conceived"),
  statusChangedAt: timestamp("status_changed_at").notNull().defaultNow(),
  birthCertJson: jsonb("birth_cert_json"),
  birthCertOnchainTx: text("birth_cert_onchain_tx"),
  reviveCount: integer("revive_count").notNull().default(0),
  lastReproducedAt: timestamp("last_reproduced_at"),
  deprovisionReason: text("deprovision_reason"),
  walletBalanceCached: numeric("wallet_balance_cached", { precision: 10, scale: 4 }).notNull().default("0"),
  callCountCached: integer("call_count_cached").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("biz_status_idx").on(t.status, t.statusChangedAt),
  parentIdx: index("biz_parent_idx").on(t.parentId),
  walletIdx: index("biz_wallet_idx").on(t.walletBalanceCached),
}));

export const commissions = pgTable("commissions", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  commissionerType: text("commissioner_type").notNull(),
  commissionerId: text("commissioner_id"),
  commissionerEmail: text("commissioner_email"),
  checkoutSessionId: text("checkout_session_id"),
  agentPayTxHash: text("agent_pay_tx_hash"),
  feePaidUsdc: numeric("fee_paid_usdc", { precision: 10, scale: 4 }).notNull().default("0.50"),
  businessId: text("business_id"),
  status: text("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull(),
  round: integer("round").notNull(),
  specialist: text("specialist").notNull(),
  action: text("action").notNull(),
  provider: text("provider"),
  reasoning: text("reasoning").notNull(),
  resultSummary: text("result_summary"),
  costUsdc: numeric("cost_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const heartbeats = pgTable("heartbeats", {
  businessId: text("business_id").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  walletBalanceUsdc: numeric("wallet_balance_usdc", { precision: 10, scale: 4 }).notNull(),
  callCount: integer("call_count").notNull().default(0),
  lastCallAt: timestamp("last_call_at"),
  observedBy: text("observed_by").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.businessId, t.recordedAt] }),
}));

export const calls = pgTable("calls", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  callerType: text("caller_type").notNull(),
  costToBusinessUsdc: numeric("cost_to_business_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  revenueUsdc: numeric("revenue_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  bizTimeIdx: index("calls_biz_time_idx").on(t.businessId, t.createdAt),
}));

export const adoptions = pgTable("adoptions", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  adopterEmail: text("adopter_email"),
  checkoutSessionId: text("checkout_session_id"),
  feePaidUsdc: numeric("fee_paid_usdc", { precision: 10, scale: 4 }).notNull().default("1.00"),
  resultedInRevival: boolean("resulted_in_revival").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lineageEdges = pgTable("lineage_edges", {
  ancestorId: text("ancestor_id").notNull(),
  descendantId: text("descendant_id").notNull(),
  depth: integer("depth").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.ancestorId, t.descendantId] }),
  ancestorIdx: index("lineage_ancestor_idx").on(t.ancestorId, t.depth),
}));

export const creditsIssuanceLog = pgTable("credits_issuance_log", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  jti: text("jti").notNull(),
  amountUsdc: numeric("amount_usdc", { precision: 10, scale: 4 }).notNull(),
  checkoutTxHash: text("checkout_tx_hash"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});
