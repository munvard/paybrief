CREATE TABLE `api_costs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`cost_usdc` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`focus_area` text DEFAULT 'all' NOT NULL,
	`email` text,
	`amount_usdc` real DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'CREATED' NOT NULL,
	`checkout_session_id` text,
	`locus_transaction_id` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`content_json` text NOT NULL,
	`content_markdown` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`research_cost_usdc` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`signature` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`processed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
