import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- content ----------
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    rank: integer("rank").notNull(),
    tier: text("tier").notNull(), // Tier 1 · Copy This Now / Tier 2 · Replicable / Tier 3 · Watch the Space
    category: text("category").notNull(),
    timing: text("timing").notNull(), // 🌲 Evergreen / ⏳ Window of Opportunity
    evidence: text("evidence").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    revenue: text("revenue"),
    team: text("team"),
    // 项目实际所在地(从字幕内容判断,不是搜索关键词的语言)。老项目为空。
    region: text("region"),
    difficultyDots: integer("difficulty_dots"),
    oneLiner: text("one_liner"),
    scores: jsonb("scores").$type<{
      tech?: number;
      acquisition?: number;
      capital?: number;
      competition?: number;
      validation?: number;
    }>(),
    potentialStars: integer("potential_stars"),
    deepDive: jsonb("deep_dive").$type<
      { num: string | null; title: string | null; content: string | null }[]
    >(),
    quickCard: jsonb("quick_card").$type<{
      acquisition?: string[] | null;
      playbook?: string[] | null;
      risks?: string[] | null;
      verdict?: string | null;
      channels?: string[] | null;
    }>(),
    credibility: text("credibility"),
    buildPrompt: text("build_prompt"),
    seoPrompt: text("seo_prompt"),
    sources: jsonb("sources").$type<
      {
        platform?: string;
        views?: string;
        fetched?: string;
        video_title?: string;
        video_subtitle?: string;
        video_url?: string;
        transcript_chars?: number;
        shared_from?: string;
        has_transcript?: boolean;
      }[]
    >(),
    // transcripts stored separately (big)
    memberOnly: boolean("member_only").notNull().default(false), // members-only exclusive projects
    published: boolean("published").notNull().default(true),
    origin: text("origin").notNull().default("imported"), // imported | youtube
    notifiedAt: timestamp("notified_at"), // 会员新项目邮件已推送时间(空=未推送)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_slug_idx").on(t.slug), index("projects_rank_idx").on(t.rank)]
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: serial("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    sourceIndex: integer("source_index").notNull(),
    lang: text("lang").notNull().default("zh"),
    content: text("content").notNull(),
  },
  (t) => [uniqueIndex("transcripts_slug_src_idx").on(t.projectSlug, t.sourceIndex)]
);

// ---------- users & billing ----------
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    plan: text("plan").notNull().default("free"), // free | member
    memberUntil: timestamp("member_until"),
    notifyNewProjects: boolean("notify_new_projects").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_idx").on(t.clerkUserId),
    index("users_email_idx").on(t.email),
  ]
);

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: serial("id").primaryKey(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stripe_events_event_idx").on(t.eventId)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subs_stripe_idx").on(t.stripeSubscriptionId)]
);

// ---------- observability ----------
export const errorEvents = pgTable(
  "error_events",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    name: text("name").notNull(),
    message: text("message"),
    stackHead: text("stack_head"),
    route: text("route"),
    side: text("side").notNull(), // server | client | edge
    count: integer("count").notNull().default(1),
    firstSeen: timestamp("first_seen").notNull().defaultNow(),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
    resolved: boolean("resolved").notNull().default(false),
    sample: jsonb("sample"),
  },
  (t) => [uniqueIndex("errors_fp_idx").on(t.fingerprint)]
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    ts: timestamp("ts").notNull().defaultNow(),
    sessionId: text("session_id"),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(), // pageview | click | signup | login | checkout_start | ...
    path: text("path"),
    referrer: text("referrer"),
    utm: jsonb("utm"),
    props: jsonb("props"),
    isSelf: boolean("is_self").notNull().default(false),
  },
  (t) => [index("events_ts_idx").on(t.ts), index("events_name_idx").on(t.name)]
);

export const inboundEmails = pgTable("inbound_emails", {
  id: serial("id").primaryKey(),
  toAddr: text("to_addr").notNull(),
  fromAddr: text("from_addr"),
  subject: text("subject"),
  bodyText: text("body_text"),
  headers: jsonb("headers"),
  authResults: text("auth_results"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  handled: boolean("handled").notNull().default(false),
});

export const notifyQueue = pgTable("notify_queue", {
  id: serial("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  status: text("status").notNull().default("queued"), // queued | sent | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  lastError: text("last_error"),
});

export const searchDaily = pgTable(
  "search_daily",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    query: text("query"),
    page: text("page"),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: text("ctr"),
    position: text("position"),
  },
  (t) => [index("search_daily_date_idx").on(t.date)]
);
