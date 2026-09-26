import { and, desc, eq, gte, sql } from "drizzle-orm";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db, builds, projects } from "@/db";
import { SITE } from "@/lib/site";

/**
 * 会员构建功能:给一个项目 + 会员的三项输入(技术栈 / 预算 / 每周可投入小时),
 * 生成一份贴身的端到端构建规格 + 7 天上线计划。
 *
 * 成本账(docs/plan-2026-09-22-club.md):Sonnet 5 ≈ $0.06/次,$5 会员费净 $4.56,
 * 每周 10 次 + 每月 40 次硬上限 → 满额用户仍有 43% 毛利。
 * 三道闸:① 配额按 clerk_user_id 数 builds 行;② 同项目同输入命中缓存不调模型不计次;
 * ③ max_tokens 封顶,再贵也贵不过一次的上限。
 *
 * ANTHROPIC_API_KEY 只在部署环境注入(纪律红线);本地脚本不得读它。
 */
export const BUILD_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 6000;
// 价目(美元/百万 token),用来记 cost_cents;调价时改这里
const PRICE_IN = 2.0, PRICE_OUT = 10.0, PRICE_CACHE_READ = 0.2;

export type BuildInputs = { stack: string; budget: string; hoursPerWeek: string; notes?: string };

const STACKS = ["nextjs-vercel", "python-fastapi", "no-code", "mobile-expo", "wordpress", "other"] as const;
const BUDGETS = ["under-100", "100-500", "500-2000", "2000-plus"] as const;
const HOURS = ["under-5", "5-10", "10-20", "20-plus"] as const;

export function normalizeInputs(raw: Partial<BuildInputs>): BuildInputs | null {
  const stack = String(raw.stack ?? "");
  const budget = String(raw.budget ?? "");
  const hoursPerWeek = String(raw.hoursPerWeek ?? "");
  if (!STACKS.includes(stack as never) || !BUDGETS.includes(budget as never) || !HOURS.includes(hoursPerWeek as never)) return null;
  const notes = String(raw.notes ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  return { stack, budget, hoursPerWeek, ...(notes ? { notes } : {}) };
}

export function inputsHash(slug: string, inputs: BuildInputs) {
  return crypto.createHash("sha1").update(JSON.stringify([slug, inputs.stack, inputs.budget, inputs.hoursPerWeek, inputs.notes ?? ""])).digest("hex");
}

export async function quotaFor(clerkUserId: string) {
  const [w] = await db.select({ n: sql<number>`count(*)::int` }).from(builds)
    .where(and(eq(builds.clerkUserId, clerkUserId), eq(builds.status, "done"), gte(builds.createdAt, sql`now() - interval '7 days'`)));
  const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(builds)
    .where(and(eq(builds.clerkUserId, clerkUserId), eq(builds.status, "done"), gte(builds.createdAt, sql`now() - interval '30 days'`)));
  const usedWeek = w?.n ?? 0, usedMonth = m?.n ?? 0;
  return {
    usedWeek, usedMonth,
    weekLimit: SITE.buildsPerWeek, monthCap: SITE.buildsPerMonthCap,
    remaining: Math.max(0, Math.min(SITE.buildsPerWeek - usedWeek, SITE.buildsPerMonthCap - usedMonth)),
  };
}

const SYSTEM = `You are the build desk at ProvenStartups.com. A paying member picked one indexed business and told you their stack, budget, and hours per week. Produce a build spec they can paste into Claude Code or Codex and act on this week.

Rules:
- Write for one specific person with the constraints they gave. Every section must change when the constraints change; do not produce a generic spec.
- Ground the product in the case breakdown you are given: what it is, how it made money, how its first customers came, what killed or nearly killed it. Copy the model, not the brand: no trademarks, no founder names in the product.
- Be concrete: numbered MVP features, exact data model (tables + key columns), screens, the payment flow, the one acquisition channel to start with (from the case), and what to measure in week one.
- Respect the budget and hours honestly. If the case needs more than they have, say so in the first section and scope down.
- Markdown with these H2 sections, in this order: "What you are building", "Why this can work for you", "MVP scope (build order)", "Data model", "Screens and flows", "Money: pricing and the first dollar", "Launch: the first customers", "7-day plan", "Paste-ready prompt for Claude Code / Codex" (a single fenced block), "Risks specific to your setup".
- 900–1400 words. No filler, no hype words, no emojis.`;

function describe(inputs: BuildInputs) {
  const stack: Record<string, string> = { "nextjs-vercel": "Next.js (App Router) + TypeScript + Tailwind on Vercel, Postgres via Neon + Drizzle, Clerk auth, Stripe", "python-fastapi": "Python + FastAPI backend, simple server-rendered or lightweight React front end, Postgres, Stripe", "no-code": "no-code / low-code (Lovable, Bolt, Bubble, Softr or similar) with Stripe and a hosted database", "mobile-expo": "React Native with Expo, RevenueCat for subscriptions, Supabase backend", "wordpress": "WordPress + WooCommerce/MemberPress with managed hosting", other: "the member's own stack (assume a modern web stack; keep choices generic)" };
  const budget: Record<string, string> = { "under-100": "under $100 total to launch", "100-500": "$100–500 to launch", "500-2000": "$500–2,000 to launch", "2000-plus": "$2,000+ to launch" };
  const hours: Record<string, string> = { "under-5": "under 5 hours a week", "5-10": "5–10 hours a week", "10-20": "10–20 hours a week", "20-plus": "20+ hours a week (near full time)" };
  return `Stack: ${stack[inputs.stack]}.\nBudget: ${budget[inputs.budget]}.\nTime: ${hours[inputs.hoursPerWeek]}.${inputs.notes ? `\nMember's note: ${inputs.notes}` : ""}`;
}

export async function runBuild(clerkUserId: string, slug: string, inputs: BuildInputs) {
  const hash = inputsHash(slug, inputs);
  // ② 缓存:同项目同输入,直接返回,不计次
  const cached = await db.select().from(builds).where(and(eq(builds.projectSlug, slug), eq(builds.inputsHash, hash), eq(builds.status, "done"))).orderBy(desc(builds.createdAt)).limit(1);
  if (cached[0]?.output) return { output: cached[0].output, cached: true };

  // ① 配额
  const q = await quotaFor(clerkUserId);
  if (q.remaining <= 0) return { error: "quota" as const, quota: q };

  const [p] = await db.select({ name: projects.name, tagline: projects.tagline, revenue: projects.revenue, team: projects.team, category: projects.category, evidence: projects.evidence, oneLiner: projects.oneLiner, deepDive: projects.deepDive, quickCard: projects.quickCard, buildPrompt: projects.buildPrompt, credibility: projects.credibility })
    .from(projects).where(and(eq(projects.slug, slug), eq(projects.published, true))).limit(1);
  if (!p) return { error: "not_found" as const };

  const caseText = [
    `# ${p.name}`, p.tagline, `Revenue: ${p.revenue ?? "n/a"} · Team: ${p.team ?? "n/a"} · Category: ${p.category} · Evidence: ${p.evidence}`,
    p.oneLiner ? `Insight: ${p.oneLiner}` : "",
    ...(p.deepDive ?? []).map((s) => `## ${s.num} ${s.title}\n${s.content}`),
    p.quickCard ? `## Quick card\nAcquisition: ${(p.quickCard.acquisition ?? []).join(" | ")}\nPlaybook: ${(p.quickCard.playbook ?? []).join(" | ")}\nRisks: ${(p.quickCard.risks ?? []).join(" | ")}\nVerdict: ${p.quickCard.verdict ?? ""}` : "",
    p.buildPrompt ? `## Existing generic build prompt (reference only; personalise, do not repeat)\n${p.buildPrompt.slice(0, 6000)}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 60_000);

  const client = new Anthropic(); // 读 ANTHROPIC_API_KEY(仅部署环境)
  const t0 = Date.now();
  try {
    const res = await client.messages.create({
      model: BUILD_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Sonnet 5 默认自适应思考:上线首跑 4,500 个输出 token 全被 thinking 吃掉,正文为空(2026-09-23 日志)。
      // 写规格书不需要长思考,显式关掉,输出预算全给正文。
      thinking: { type: "disabled" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [
        { type: "text", text: `CASE BREAKDOWN (indexed by ProvenStartups):\n\n${caseText}`, cache_control: { type: "ephemeral" } },
        { type: "text", text: `MEMBER CONSTRAINTS:\n${describe(inputs)}\n\nWrite the build spec now.` },
      ] }],
    });
    const output = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const u = res.usage;
    // 2026-09-23 诊断:线上首跑 output_tokens=4500 但文本只有 237 字符,先把块类型与 stop_reason 打进日志
    console.log("[build] blocks", JSON.stringify(res.content.map((b) => b.type)), "stop", res.stop_reason, "chars", output.length, "usage", JSON.stringify(u));
    if (output.length < 400) {
      // 没拿到正文(思考吃满预算 / 被截断):记为失败,不计配额、不缓存,让前端提示重试
      await db.insert(builds).values({ clerkUserId, projectSlug: slug, inputsHash: hash, inputs, output: null, model: BUILD_MODEL, tokensIn: u.input_tokens ?? null, tokensOut: u.output_tokens ?? null, status: "failed" });
      return { error: "empty" as const };
    }
    const cents = Math.round((((u.input_tokens ?? 0) * PRICE_IN + (u.output_tokens ?? 0) * PRICE_OUT + ((u as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0) * PRICE_CACHE_READ) / 1e6) * 100);
    await db.insert(builds).values({ clerkUserId, projectSlug: slug, inputsHash: hash, inputs, output, model: BUILD_MODEL, tokensIn: u.input_tokens ?? null, tokensOut: u.output_tokens ?? null, costCents: cents, status: "done" });
    return { output, cached: false, ms: Date.now() - t0 };
  } catch (e) {
    await db.insert(builds).values({ clerkUserId, projectSlug: slug, inputsHash: hash, inputs, output: null, model: BUILD_MODEL, status: "failed" });
    throw e;
  }
}

export async function recentBuilds(clerkUserId: string, limit = 20) {
  return db.select({ id: builds.id, projectSlug: builds.projectSlug, inputs: builds.inputs, createdAt: builds.createdAt, status: builds.status })
    .from(builds).where(eq(builds.clerkUserId, clerkUserId)).orderBy(desc(builds.createdAt)).limit(limit);
}
