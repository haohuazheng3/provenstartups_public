CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"handled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"message" text,
	"stack_head" text,
	"route" text,
	"side" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"sample" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"session_id" text,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"path" text,
	"referrer" text,
	"utm" jsonb,
	"props" jsonb,
	"is_self" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_addr" text NOT NULL,
	"from_addr" text,
	"subject" text,
	"body_text" text,
	"headers" jsonb,
	"auth_results" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notify_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"rank" integer NOT NULL,
	"tier" text NOT NULL,
	"category" text NOT NULL,
	"timing" text NOT NULL,
	"evidence" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"revenue" text,
	"team" text,
	"difficulty_dots" integer,
	"one_liner" text,
	"scores" jsonb,
	"potential_stars" integer,
	"deep_dive" jsonb,
	"quick_card" jsonb,
	"credibility" text,
	"build_prompt" text,
	"seo_prompt" text,
	"sources" jsonb,
	"member_only" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"origin" text DEFAULT 'imported' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"query" text,
	"page" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" text,
	"position" text
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_slug" text NOT NULL,
	"source_index" integer NOT NULL,
	"lang" text DEFAULT 'zh' NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"member_until" timestamp,
	"notify_new_projects" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "errors_fp_idx" ON "error_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "events_ts_idx" ON "events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "events_name_idx" ON "events" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_rank_idx" ON "projects" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "search_daily_date_idx" ON "search_daily" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_events_event_idx" ON "stripe_events" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subs_stripe_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_slug_src_idx" ON "transcripts" USING btree ("project_slug","source_index");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");