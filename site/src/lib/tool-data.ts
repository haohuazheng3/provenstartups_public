import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db, projects } from "@/db";
import { TOOL_EXCLUDE, TOOL_LABELS } from "./tool-tags";
import type { BlogPost } from "./blog";

/**
 * "用 X 做的 App"系列页面的实时数据(2026-10-17)。
 *
 * 文章正文里写 [[count:cursor]] 这类行内记号、{{tool-list:cursor}} 这类组件占位,渲染时从库里现取 ——
 * 定时任务每 3 天上新、导入后 revalidateTag("projects"),页面上的数字、清单、"最近更新"日期跟着变,
 * 正文永远不会写着一个过期的数。
 *
 * 标签规则在 tool-tags.ts;这里只按标签取数,另加一份人工核过的排除名单(工具公司自己的条目、名字里恰好带工具名的别家产品)。
 */

export type ToolRow = {
  slug: string;
  name: string;
  tagline: string;
  revenue: string | null;
  revenueMonthlyUsd: number | null;
  evidence: string;
  category: string;
  teamSize: string | null;
  tools: string[];
  createdAt: string;
  memberOnly: boolean;
};

export const loadToolRows = unstable_cache(
  async (): Promise<ToolRow[]> => {
    const rows = await db
      .select({
        slug: projects.slug,
        name: projects.name,
        tagline: projects.tagline,
        revenue: projects.revenue,
        revenueMonthlyUsd: projects.revenueMonthlyUsd,
        evidence: projects.evidence,
        category: projects.category,
        teamSize: projects.teamSize,
        tools: projects.tools,
        createdAt: projects.createdAt,
        memberOnly: projects.memberOnly,
      })
      .from(projects)
      .where(eq(projects.published, true));
    return rows.map((r) => ({ ...r, tools: r.tools ?? [], createdAt: new Date(r.createdAt).toISOString() }));
  },
  ["tool-rows-v1"],
  { revalidate: 86400, tags: ["projects"] }
);

export { TOOL_EXCLUDE };

/** 规模参照(Slack、Notion、Cursor 公司本身这类)不算"用 X 做的生意":不进计数、清单和中位数 */
export function rowsFor(rows: ToolRow[], tag: string) {
  const ex = new Set(TOOL_EXCLUDE[tag] ?? []);
  return rows.filter((r) => r.tools.includes(tag) && !ex.has(r.slug) && r.category !== "Scale Reference");
}

/** 排序:月收入从高到低,没有可换算月收入的按证据等级、再按名字 */
const EV_RANK = (e: string) => (e.startsWith("✅") ? 0 : e.startsWith("🗣") ? 1 : e.startsWith("📎") ? 2 : 3);
export function sortByRevenue(list: ToolRow[]) {
  return [...list].sort(
    (a, b) =>
      (b.revenueMonthlyUsd ?? -1) - (a.revenueMonthlyUsd ?? -1) ||
      EV_RANK(a.evidence) - EV_RANK(b.evidence) ||
      a.name.localeCompare(b.name)
  );
}

export type ToolStats = {
  tag: string;
  label: string;
  count: number;
  verified: number;
  founder: number;
  withMonthly: number;
  median: number | null;
  over10k: number;
  solo: number;
  soloPct: number;
  topCategories: { name: string; n: number }[];
  newest: string | null;
};

export function toolStats(rows: ToolRow[], tag: string): ToolStats {
  const list = rowsFor(rows, tag);
  const businesses = list.filter((r) => r.category !== "Scale Reference");
  const vals = businesses
    .map((r) => r.revenueMonthlyUsd)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  // 少于 5 个可换算月收入时中位数没有意义(Lovable 一度只有 3 个,"中位数 $80K/月"会误导人),不给
  const median = vals.length >= 5 ? vals[Math.floor((vals.length - 1) / 2)] : null;
  const cats = new Map<string, number>();
  for (const r of list) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
  const solo = list.filter((r) => r.teamSize === "solo").length;
  return {
    tag,
    label: TOOL_LABELS[tag] ?? tag,
    count: list.length,
    verified: list.filter((r) => r.evidence.startsWith("✅")).length,
    founder: list.filter((r) => r.evidence.startsWith("🗣")).length,
    withMonthly: vals.length,
    median,
    over10k: vals.filter((v) => v >= 10_000).length,
    solo,
    soloPct: list.length ? Math.round((100 * solo) / list.length) : 0,
    topCategories: [...cats.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, n]) => ({ name, n })),
    newest: list.reduce<string | null>((m, r) => (!m || r.createdAt > m ? r.createdAt : m), null),
  };
}

export function fmtUsd(n: number | null) {
  if (n == null) return "n/a";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return `$${n}`;
}

/** 月收入分档(只算有可换算月收入的、非规模参照的):页面上的分布图和文字口径一致 */
export const REVENUE_BANDS = [
  { label: "$100K+", lo: 100_000, hi: Infinity },
  { label: "$50K–$100K", lo: 50_000, hi: 100_000 },
  { label: "$10K–$50K", lo: 10_000, hi: 50_000 },
  { label: "$1K–$10K", lo: 1_000, hi: 10_000 },
  { label: "Under $1K", lo: 0, hi: 1_000 },
];
export function revenueBands(rows: ToolRow[], tag: string) {
  const vals = rowsFor(rows, tag)
    .map((r) => r.revenueMonthlyUsd)
    .filter((v): v is number => typeof v === "number" && v > 0);
  return REVENUE_BANDS.map((b) => ({ ...b, n: vals.filter((v) => v >= b.lo && v < b.hi).length }));
}

export function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ───────────── 行内记号 ─────────────
// [[count:tag]] [[verified:tag]] [[founder:tag]] [[median:tag]] [[over10k:tag]] [[withmonthly:tag]] [[solo:tag]] [[topcat:tag]]
// [[newest:tag]] [[both:a,b]] [[total]] [[asof]]
const TOKEN_RX = /\[\[(\w+)(?::([\w,.+-]+))?\]\]/g;
const SLOT_RX = /^\{\{((?:tool-stats|tool-bands|tool-list|tool-newest|compare|leaderboard)(?::[\w,.+-]+)?)\}\}$/gm;

export function liveTagsOf(post: Pick<BlogPost, "body" | "title" | "seoTitle" | "description">) {
  const text = [post.body, post.title, post.seoTitle ?? "", post.description].join("\n");
  const tags = new Set<string>();
  for (const m of text.matchAll(TOKEN_RX)) if (m[2]) m[2].split(",").forEach((t) => tags.add(t));
  for (const m of text.matchAll(SLOT_RX)) {
    const arg = m[1].split(":")[1];
    if (arg) arg.split(",").forEach((t) => tags.add(t));
    if (m[1].startsWith("leaderboard")) HUB_TAGS.forEach((t) => tags.add(t));
  }
  return [...tags];
}

export function isLivePost(post: Pick<BlogPost, "body" | "title" | "seoTitle" | "description">) {
  const text = [post.body, post.title, post.seoTitle ?? "", post.description].join("\n");
  TOKEN_RX.lastIndex = 0;
  SLOT_RX.lastIndex = 0;
  return TOKEN_RX.test(text) || SLOT_RX.test(text);
}

export function liveSlots(body: string) {
  SLOT_RX.lastIndex = 0;
  return [...body.matchAll(SLOT_RX)].map((m) => m[1]);
}

export function liveText(s: string, rows: ToolRow[]) {
  const asof = rows.reduce<string | null>((m, r) => (!m || r.createdAt > m ? r.createdAt : m), null);
  const cache = new Map<string, ToolStats>();
  const st = (t: string) => {
    if (!cache.has(t)) cache.set(t, toolStats(rows, t));
    return cache.get(t)!;
  };
  return s.replace(TOKEN_RX, (all, key: string, arg?: string) => {
    const tag = arg ?? "";
    switch (key) {
      case "count":
        return String(st(tag).count);
      case "verified":
        return String(st(tag).verified);
      case "founder":
        return String(st(tag).founder);
      case "median":
        return st(tag).median == null ? "n/a" : `${fmtUsd(st(tag).median)}/mo`;
      case "over10k":
        return String(st(tag).over10k);
      case "withmonthly":
        return String(st(tag).withMonthly);
      case "solo":
        return `${st(tag).soloPct}%`;
      case "topcat":
        return st(tag).topCategories[0]?.name ?? "";
      case "newest":
        return fmtDate(st(tag).newest);
      case "both": {
        const [a, b] = tag.split(",");
        const inB = new Set(rowsFor(rows, b).map((r) => r.slug));
        return String(rowsFor(rows, a).filter((r) => inB.has(r.slug)).length);
      }
      case "total":
        return String(rows.length);
      case "asof":
        return fmtDate(asof);
      default:
        return all;
    }
  });
}

/**
 * 列表里的标题也要换成实时数(博客首页、分类页、文末相关阅读、项目页"Guides for this idea"、llms.txt),
 * 否则会把 "[[count:cursor]] Apps…" 原样露出来。没有记号的列表不查库。
 */
export async function liveTitles<T extends Pick<BlogPost, "title" | "description" | "seoTitle">>(posts: T[]): Promise<T[]> {
  const has = (x?: string | null) => {
    TOKEN_RX.lastIndex = 0;
    return !!x && TOKEN_RX.test(x);
  };
  if (!posts.some((p) => has(p.title) || has(p.description) || has(p.seoTitle))) return posts;
  const rows = await loadToolRows();
  return posts.map((p) => ({
    ...p,
    title: liveText(p.title, rows),
    description: liveText(p.description, rows),
    seoTitle: p.seoTitle ? liveText(p.seoTitle, rows) : p.seoTitle,
  }));
}

/** 把一篇文章里所有出现行内记号的字段换成实时数 */
export function hydratePost<T extends BlogPost>(post: T, rows: ToolRow[]): T {
  const t = (s: string) => liveText(s, rows);
  return {
    ...post,
    title: t(post.title),
    seoTitle: post.seoTitle ? t(post.seoTitle) : post.seoTitle,
    description: t(post.description),
    body: t(post.body),
    intents: post.intents?.map((i) => ({ ...i, title: t(i.title), answer: t(i.answer) })),
    faqs: post.faqs?.map((f) => ({ q: t(f.q), a: t(f.a) })),
    cta: post.cta ? { ...post.cta, title: t(post.cta.title), text: t(post.cta.text) } : post.cta,
  };
}

/** 实时页面的"最后更新":文章本身的 updated 与它涉及的工具里最新入库的那个案例,取较晚的 */
export function liveModified(post: Pick<BlogPost, "body" | "title" | "seoTitle" | "description" | "updated" | "published">, rows: ToolRow[]) {
  const base = post.updated ?? post.published;
  let newest = base;
  for (const tag of liveTagsOf(post)) {
    const n = toolStats(rows, tag).newest?.slice(0, 10);
    if (n && n > newest) newest = n;
  }
  return newest;
}

/** 总览页与各页"工具对照"用的工具清单:每个都有自己的专页 */
export const HUB_TAGS = [
  "claude-code", "cursor", "chatgpt", "lovable", "gemini", "codex", "bubble", "replit", "bolt",
  "supabase", "firebase", "nextjs", "expo", "n8n", "zapier", "elevenlabs", "webflow", "framer",
  "chrome-extension", "shopify-app",
];

/** 工具 → 它的专页(总览页链接、对比页互链用) */
export const TOOL_PAGES: Record<string, string> = {
  "claude-code": "/blog/built-with-ai/apps-built-with-claude-code",
  cursor: "/blog/built-with-ai/apps-built-with-cursor",
  chatgpt: "/blog/built-with-ai/apps-built-with-chatgpt",
  lovable: "/blog/built-with-ai/apps-built-with-lovable",
  gemini: "/blog/built-with-ai/apps-built-with-gemini",
  codex: "/blog/built-with-ai/apps-built-with-codex",
  bubble: "/blog/built-with-ai/apps-built-with-bubble",
  replit: "/blog/built-with-ai/apps-built-with-replit",
  bolt: "/blog/built-with-ai/apps-built-with-bolt-new",
  supabase: "/blog/built-with-ai/apps-built-with-supabase",
  firebase: "/blog/built-with-ai/apps-built-with-firebase",
  nextjs: "/blog/built-with-ai/apps-built-with-nextjs",
  expo: "/blog/built-with-ai/mobile-apps-built-with-expo-react-native",
  n8n: "/blog/built-with-ai/apps-built-with-n8n",
  zapier: "/blog/ai-agencies/n8n-vs-zapier",
  make: "/blog/ai-agencies/n8n-vs-zapier",
  elevenlabs: "/blog/built-with-ai/voice-apps-built-with-elevenlabs",
  webflow: "/blog/built-with-ai/businesses-built-with-webflow",
  framer: "/blog/build-and-ship/webflow-vs-framer",
  "chrome-extension": "/blog/build-and-ship/chrome-extension-examples",
  "shopify-app": "/blog/built-with-ai/shopify-stores-and-apps-built-with-ai",
};
