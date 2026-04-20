CREATE TABLE "adoptions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"adopter_email" text,
	"checkout_session_id" text,
	"fee_paid_usdc" numeric(10, 4) DEFAULT '1.00' NOT NULL,
	"resulted_in_revival" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pitch" text NOT NULL,
	"genome" text NOT NULL,
	"parent_id" text,
	"handler_code_hash" text,
	"handler_code" text,
	"bwl_project_id" text,
	"bwl_service_id" text,
	"bwl_url" text,
	"mcp_url" text,
	"wallet_address" text,
	"wallet_api_key_enc" text,
	"price_per_call_usdc" numeric(10, 4) DEFAULT '0.05' NOT NULL,
	"llm_cost_estimate_usdc" numeric(10, 4) DEFAULT '0.02' NOT NULL,
	"status" text DEFAULT 'conceived' NOT NULL,
	"status_changed_at" timestamp DEFAULT now() NOT NULL,
	"birth_cert_json" jsonb,
	"birth_cert_onchain_tx" text,
	"revive_count" integer DEFAULT 0 NOT NULL,
	"last_reproduced_at" timestamp,
	"deprovision_reason" text,
	"wallet_balance_cached" numeric(10, 4) DEFAULT '0' NOT NULL,
	"call_count_cached" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"caller_type" text NOT NULL,
	"cost_to_business_usdc" numeric(10, 4) DEFAULT '0' NOT NULL,
	"revenue_usdc" numeric(10, 4) DEFAULT '0' NOT NULL,
	"duration_ms" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"commissioner_type" text NOT NULL,
	"commissioner_id" text,
	"commissioner_email" text,
	"checkout_session_id" text,
	"agent_pay_tx_hash" text,
	"fee_paid_usdc" numeric(10, 4) DEFAULT '3.00' NOT NULL,
	"business_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits_issuance_log" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"jti" text NOT NULL,
	"amount_usdc" numeric(10, 4) NOT NULL,
	"checkout_tx_hash" text,
	"issued_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"commission_id" text NOT NULL,
	"round" integer NOT NULL,
	"specialist" text NOT NULL,
	"action" text NOT NULL,
	"provider" text,
	"reasoning" text NOT NULL,
	"result_summary" text,
	"cost_usdc" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"business_id" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"wallet_balance_usdc" numeric(10, 4) NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"last_call_at" timestamp,
	"observed_by" text NOT NULL,
	CONSTRAINT "heartbeats_business_id_recorded_at_pk" PRIMARY KEY("business_id","recorded_at")
);
--> statement-breakpoint
CREATE TABLE "lineage_edges" (
	"ancestor_id" text NOT NULL,
	"descendant_id" text NOT NULL,
	"depth" integer NOT NULL,
	CONSTRAINT "lineage_edges_ancestor_id_descendant_id_pk" PRIMARY KEY("ancestor_id","descendant_id")
);
--> statement-breakpoint
CREATE INDEX "biz_status_idx" ON "businesses" USING btree ("status","status_changed_at");--> statement-breakpoint
CREATE INDEX "biz_parent_idx" ON "businesses" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "biz_wallet_idx" ON "businesses" USING btree ("wallet_balance_cached");--> statement-breakpoint
CREATE INDEX "calls_biz_time_idx" ON "calls" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "lineage_ancestor_idx" ON "lineage_edges" USING btree ("ancestor_id","depth");