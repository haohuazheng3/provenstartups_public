import { createHash } from "node:crypto";
import { db, projects } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import { SITE } from "./site";
import { atSecond, clock } from "@/lib/video-time";

/**
 * 会员库导出(2026-10-14):把整库给会员的 AI 读,而不是让它一页页翻网站。
 * 起因:第一个真实会员付费后 2.5 小时自动化翻完 1,004 个项目页(中位 5.2 秒一页)。
 *
 * 三种格式:
 * - md   全库,每个项目全部拆解段 + 速览卡 + 可信度 + 来源。给 ChatGPT / Claude / 编码代理读
 * - json 同样内容的结构化版本,给脚本和代理
 * - csv  一行一个项目的索引(数字、标签、一句话、结论),给表格和 ChatGPT 数据分析
 *
 * 不导出:字幕全文(第三方原文,批量再分发风险大)、构建提示词与 SEO 提示词(站内功能,不是研究内容)。
 * 分批读库流式输出,不在内存里攒整份 15 MB。
 */

export const EXPORT_FORMATS = ["md", "json", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// 每人 24 小时内的导出次数上限。正常会员一天下一两次;这条只防脚本循环下载烧函数时长。
export const EXPORT_DAILY_CAP = 20;

const BATCH = 100;

const COLS = {
  slug: projects.slug,
  rank: projects.rank,
  tier: projects.tier,
  category: projects.category,
  timing: projects.timing,
  evidence: projects.evidence,
  name: projects.name,
  tagline: projects.tagline,
  revenue: projects.revenue,
  revenueMonthlyUsd: projects.revenueMonthlyUsd,
  team: projects.team,
  teamSize: projects.teamSize,
  region: projects.region,
  country: projects.country,
  tools: projects.tools,
  difficultyDots: projects.difficultyDots,
  potentialStars: projects.potentialStars,
  scores: projects.scores,
  oneLiner: projects.oneLiner,
  credibility: projects.credibility,
  deepDive: projects.deepDive,
  quickCard: projects.quickCard,
  sources: projects.sources,
  memberOnly: projects.memberOnly,
  createdAt: projects.createdAt,
};

function selectBatch(offset: number) {
  return db
    .select(COLS)
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(asc(projects.rank), asc(projects.id))
    .limit(BATCH)
    .offset(offset);
}

type Row = Awaited<ReturnType<typeof selectBatch>>[number];

const EVIDENCE: [string, string][] = [
  ["✅", "Third-party verified"],
  ["🗣", "Founder-reported"],
  ["📎", "Creator-relayed"],
  ["🔮", "Unproven"],
];

function evidenceLabel(raw: string | null) {
  const s = (raw ?? "").trim();
  return EVIDENCE.find(([p]) => s.startsWith(p))?.[1] ?? "Unproven";
}

/** 去掉 "🌲 Evergreen" 这类字段前面的表情,留文字 */
function plain(raw: string | null) {
  return (raw ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

const SCORE_KEYS = ["tech", "acquisition", "capital", "competition", "validation"] as const;
const SCORE_NAMES: Record<(typeof SCORE_KEYS)[number], string> = {
  tech: "build",
  acquisition: "acquire",
  capital: "capital",
  competition: "compete",
  validation: "validate",
};

function projectUrl(slug: string) {
  return `${SITE.url}/projects/${slug}`;
}

/** 水印:账号的不可逆短 ID,不放邮箱(文件被转手时不连带泄露会员邮箱) */
export function licenseIdFor(clerkUserId: string) {
  return createHash("sha256").update(`ps-export:${clerkUserId}`).digest("hex").slice(0, 12);
}

export function exportFilename(format: ExportFormat, date: string) {
  return format === "csv"
    ? `provenstartups-index-${date}.csv`
    : `provenstartups-library-${date}.${format}`;
}

export const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = {
  md: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

const FIELD_GUIDE = [
  "Evidence: how the revenue figure is backed. Third-party verified (dashboards, filings, data providers) > Founder-reported (the founder said it on record) > Creator-relayed (a third-party creator repeated it) > Unproven (no revenue shown yet).",
  "Revenue: the figure exactly as reported, with its period. revenue_monthly_usd is our normalized monthly USD estimate for filtering; empty when it cannot be computed.",
  "Scores (1–5, higher = harder): build (how hard to build with AI help), acquire (how hard the first paying customers are), capital (money needed up front), compete (how crowded the space is), validate (how long until you know it works).",
  "Difficulty (1–5) and upside (1–5) are our overall judgments.",
  "Tier: 1 = copy this now, 2 = replicable, 3 = watch the space. Timing: evergreen or a window of opportunity.",
];

const SAMPLE_PROMPTS = [
  "List the 15 ideas a solo developer could launch in under a month with third-party verified or founder-reported revenue above $5K/mo. Rank them by build score.",
  "Group every idea by how its first 10 customers were found. Which acquisition channel shows up most among ideas with low capital scores?",
  "I know accounting and Shopify. Pick 5 ideas I am unusually well placed to build, and explain why with quotes from their breakdowns.",
  "Which categories have the most Creator-relayed claims and the fewest verified ones? Where is the evidence weakest?",
];

async function countPublished() {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(eq(projects.published, true));
  return r?.n ?? 0;
}

async function* batches(): AsyncGenerator<Row[]> {
  for (let offset = 0; ; offset += BATCH) {
    const rows = await selectBatch(offset);
    if (rows.length) yield rows;
    if (rows.length < BATCH) return;
  }
}

// ───────────────────────────── Markdown ─────────────────────────────

function mdHeader(total: number, licenseId: string, date: string) {
  return [
    `# ${SITE.name} — the full library (${total.toLocaleString("en-US")} ideas)`,
    "",
    `Exported ${date} for member ${licenseId}. For your own research, including with your own AI tools. Do not share, publish or resell this file (${SITE.url}/terms).`,
    "",
    "Every entry is a real business with a reported revenue figure, graded by the evidence behind it, followed by our full breakdown: the story, how the first customers came, how the first dollar landed, what turned the flywheel, and the stretch with no feedback.",
    "",
    "## How to read the fields",
    "",
    ...FIELD_GUIDE.map((l) => `- ${l}`),
    "",
    "## Things to ask your AI",
    "",
    ...SAMPLE_PROMPTS.map((l) => `- "${l}"`),
    "",
    "---",
    "",
  ].join("\n");
}

function mdList(title: string, items?: string[] | null) {
  if (!items?.length) return "";
  return `**${title}**\n${items.map((i) => `- ${i}`).join("\n")}\n\n`;
}

function mdProject(p: Row) {
  const scores = p.scores
    ? SCORE_KEYS.filter((k) => p.scores?.[k] != null)
        .map((k) => `${SCORE_NAMES[k]} ${p.scores?.[k]}`)
        .join(" · ")
    : "";
  const meta = [
    `- URL: ${projectUrl(p.slug)}`,
    `- Category: ${p.category} · ${p.tier} · ${plain(p.timing)}`,
    `- Evidence: ${evidenceLabel(p.evidence)}`,
    `- Revenue: ${p.revenue ?? "not disclosed"}${p.revenueMonthlyUsd != null ? ` (≈ $${p.revenueMonthlyUsd.toLocaleString("en-US")}/mo normalized)` : ""}`,
    p.team ? `- Team: ${p.team}` : "",
    p.country || p.region ? `- Where: ${[p.region, p.country].filter(Boolean).join(" · ")}` : "",
    p.tools?.length ? `- Tools: ${p.tools.join(", ")}` : "",
    scores ? `- Scores (1–5, higher = harder): ${scores}` : "",
    p.difficultyDots != null || p.potentialStars != null
      ? `- Difficulty ${p.difficultyDots ?? "—"}/5 · Upside ${p.potentialStars ?? "—"}/5`
      : "",
  ].filter(Boolean);

  let out = `## ${p.rank}. ${p.name}\n\n${p.tagline}\n\n${meta.join("\n")}\n\n`;
  if (p.oneLiner) out += `> ${p.oneLiner.replace(/\n+/g, " ")}\n\n`;
  if (p.credibility) out += `### How much to trust the numbers\n\n${p.credibility}\n\n`;
  for (const s of p.deepDive ?? []) {
    if (!s?.content) continue;
    out += `### ${[s.num, s.title].filter(Boolean).join(" ")}\n\n${s.content.trim()}\n\n`;
  }
  const q = p.quickCard;
  if (q && (q.verdict || q.playbook?.length || q.acquisition?.length || q.risks?.length || q.channels?.length)) {
    out += "### Quick card\n\n";
    if (q.verdict) out += `**Verdict.** ${q.verdict}\n\n`;
    out += mdList("Playbook", q.playbook);
    out += mdList("How customers were acquired", q.acquisition);
    out += mdList("Channels", q.channels);
    out += mdList("Risks", q.risks);
  }
  const src = (p.sources ?? []).filter((s) => s?.video_url);
  if (src.length) {
    out += `### Sources\n\n${src
      .map(
        (s) =>
          `- ${s.video_title ?? "Source"}${s.video_subtitle ? ` — ${s.video_subtitle}` : ""}: ${s.video_url}` +
          (s.quotes ?? []).map((q) => `\n  - ${clock(q.t)} “${q.text}” ${atSecond(s.video_url!, q.t)}`).join("")
      )
      .join("\n")}\n\n`;
  }
  return `${out}---\n\n`;
}

// ───────────────────────────── JSON ─────────────────────────────

function jsonProject(p: Row) {
  return {
    rank: p.rank,
    slug: p.slug,
    url: projectUrl(p.slug),
    name: p.name,
    tagline: p.tagline,
    category: p.category,
    tier: p.tier,
    timing: plain(p.timing),
    evidence: evidenceLabel(p.evidence),
    evidence_detail: plain(p.evidence),
    revenue: p.revenue,
    revenue_monthly_usd: p.revenueMonthlyUsd,
    team: p.team,
    team_size: p.teamSize,
    region: p.region,
    country: p.country,
    tools: p.tools ?? [],
    scores: p.scores ?? null,
    difficulty: p.difficultyDots,
    upside: p.potentialStars,
    one_liner: p.oneLiner,
    credibility: p.credibility,
    breakdown: (p.deepDive ?? [])
      .filter((s) => s?.content)
      .map((s) => ({ num: s.num, title: s.title, content: s.content })),
    quick_card: p.quickCard ?? null,
    sources: (p.sources ?? [])
      .filter((s) => s?.video_url)
      .map((s) => ({
        title: s.video_title ?? null,
        channel: s.video_subtitle ?? null,
        url: s.video_url,
        platform: s.platform ?? null,
        quotes: (s.quotes ?? []).map((q) => ({ at: clock(q.t), seconds: q.t, text: q.text, url: atSecond(s.video_url!, q.t) })),
      })),
    added: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
  };
}

// ───────────────────────────── CSV ─────────────────────────────

const CSV_HEADER = [
  "rank", "name", "url", "category", "tier", "timing", "evidence", "revenue", "revenue_monthly_usd",
  "team_size", "country", "tools", "build", "acquire", "capital", "compete", "validate",
  "difficulty", "upside", "tagline", "verdict",
];

function csvCell(v: unknown) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvProject(p: Row) {
  return [
    p.rank, p.name, projectUrl(p.slug), p.category, p.tier, plain(p.timing), evidenceLabel(p.evidence),
    p.revenue, p.revenueMonthlyUsd, p.teamSize, p.country, (p.tools ?? []).join("; "),
    p.scores?.tech, p.scores?.acquisition, p.scores?.capital, p.scores?.competition, p.scores?.validation,
    p.difficultyDots, p.potentialStars, p.tagline, p.quickCard?.verdict,
  ].map(csvCell).join(",");
}

// ───────────────────────────── 流 ─────────────────────────────

export function exportStream(format: ExportFormat, licenseId: string, date: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let it: AsyncGenerator<Row[]> | null = null;
  let first = true;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const total = await countPublished();
      if (format === "md") controller.enqueue(enc.encode(mdHeader(total, licenseId, date)));
      if (format === "csv") controller.enqueue(enc.encode(`﻿${CSV_HEADER.join(",")}\r\n`));
      if (format === "json") {
        const head = {
          source: SITE.name,
          url: SITE.url,
          exported: date,
          license: `Member ${licenseId}. For your own research, including with your own AI tools. Do not share, publish or resell (${SITE.url}/terms).`,
          count: total,
          field_guide: FIELD_GUIDE,
        };
        controller.enqueue(enc.encode(`${JSON.stringify(head).slice(0, -1)},"ideas":[`));
      }
      it = batches();
    },
    async pull(controller) {
      const next = await it!.next();
      if (next.done) {
        if (format === "json") controller.enqueue(enc.encode("]}\n"));
        controller.close();
        return;
      }
      let chunk = "";
      for (const p of next.value) {
        if (format === "md") chunk += mdProject(p);
        else if (format === "csv") chunk += `${csvProject(p)}\r\n`;
        else {
          chunk += `${first ? "" : ","}\n${JSON.stringify(jsonProject(p))}`;
          first = false;
        }
      }
      controller.enqueue(enc.encode(chunk));
    },
    async cancel() {
      await it?.return(undefined);
    },
  });
}
