/**
 * 会员筛选模块的唯一事实源:哪些筛选、每个筛选的取值、怎么从 URL 读、怎么判定一行。
 * 首页统计条下面那块面板和 /projects 顶部共用这一份,两处不允许各写一套。
 *
 * 设计依据(三个月访客行为):用得最多的筛选是"已验证",其次层级、窗口期;
 * 点击集中在"我能不能做"—— 所以筛选按痛点命名(一人能做 / 首月就有收入 / 启动几乎不花钱),
 * 而不是按数据库字段命名。每个筛选都必须能落到 projects 表的某一列上,不能是装饰。
 */
import type { RowProject } from "@/components/ProjectRow";

export type FilterRow = RowProject & {
  revenueMonthlyUsd?: number | null;
  teamSize?: string | null;
  tools?: string[] | null;
  country?: string | null;
  scores?: { tech?: number; acquisition?: number; capital?: number; competition?: number; validation?: number } | null;
};

const sc = (p: FilterRow, k: "tech" | "acquisition" | "capital" | "competition" | "validation") => p.scores?.[k] ?? null;

export const FILTER_GROUPS = [
  {
    key: "evidence",
    label: "Evidence",
    hint: "How the revenue figure was backed",
    options: [
      { key: "verified", label: "Third-party verified", match: (p: FilterRow) => p.evidence.startsWith("✅") },
      { key: "founder", label: "Founder-reported", match: (p: FilterRow) => p.evidence.startsWith("🗣") },
      { key: "creator", label: "Creator-relayed", match: (p: FilterRow) => p.evidence.startsWith("📎") },
    ],
  },
  {
    key: "tier",
    label: "Tier",
    hint: "How copyable it is",
    options: [
      { key: "1", label: "T1 · copy now", match: (p: FilterRow) => p.tier.startsWith("Tier 1") },
      { key: "2", label: "T2 · replicable", match: (p: FilterRow) => p.tier.startsWith("Tier 2") },
      { key: "3", label: "T3 · watch", match: (p: FilterRow) => p.tier.startsWith("Tier 3") },
    ],
  },
  {
    key: "rev",
    label: "Monthly revenue",
    hint: "Only cases with a USD monthly figure qualify; undisclosed ones drop out",
    options: [
      { key: "1k", label: "$1K+/mo", match: (p: FilterRow) => (p.revenueMonthlyUsd ?? 0) >= 1_000 },
      { key: "10k", label: "$10K+/mo", match: (p: FilterRow) => (p.revenueMonthlyUsd ?? 0) >= 10_000 },
      { key: "50k", label: "$50K+/mo", match: (p: FilterRow) => (p.revenueMonthlyUsd ?? 0) >= 50_000 },
      { key: "under5k", label: "Under $5K/mo (early)", match: (p: FilterRow) => p.revenueMonthlyUsd != null && p.revenueMonthlyUsd < 5_000 },
    ],
  },
  {
    key: "team",
    label: "Team",
    hint: "Who runs it",
    options: [
      { key: "solo", label: "One person", match: (p: FilterRow) => p.teamSize === "solo" },
      { key: "duo", label: "Two founders", match: (p: FilterRow) => p.teamSize === "duo" },
      { key: "team", label: "Small team", match: (p: FilterRow) => p.teamSize === "team" },
    ],
  },
  {
    key: "timing",
    label: "Timing",
    hint: "Window of opportunity vs evergreen",
    options: [
      { key: "window", label: "Window open now", match: (p: FilterRow) => p.timing.startsWith("⏳") },
      { key: "evergreen", label: "Evergreen", match: (p: FilterRow) => p.timing.startsWith("🌲") },
    ],
  },
  {
    key: "build",
    label: "Build effort",
    hint: "How much engineering it takes with AI help",
    options: [
      { key: "weekend", label: "Weekend build", match: (p: FilterRow) => (sc(p, "tech") ?? 9) <= 2 },
      { key: "weeks", label: "A few weeks", match: (p: FilterRow) => sc(p, "tech") === 3 },
      { key: "serious", label: "Serious engineering", match: (p: FilterRow) => (sc(p, "tech") ?? 0) >= 4 },
    ],
  },
  {
    key: "profit",
    label: "Path to revenue",
    hint: "How fast and how cheaply it starts paying",
    options: [
      { key: "fast", label: "First revenue in weeks", match: (p: FilterRow) => (sc(p, "validation") ?? 9) <= 2 },
      { key: "slow", label: "Months to prove", match: (p: FilterRow) => (sc(p, "validation") ?? 0) >= 4 },
      { key: "cheap", label: "Almost no startup capital", match: (p: FilterRow) => (sc(p, "capital") ?? 9) <= 2 },
      { key: "funded", label: "Needs real money up front", match: (p: FilterRow) => (sc(p, "capital") ?? 0) >= 4 },
    ],
  },
  {
    key: "acq",
    label: "Customer acquisition",
    hint: "How hard the first paying customers are to find",
    options: [
      { key: "easy", label: "Easy to reach buyers", match: (p: FilterRow) => (sc(p, "acquisition") ?? 9) <= 2 },
      { key: "grind", label: "Hard-won customers", match: (p: FilterRow) => (sc(p, "acquisition") ?? 0) >= 4 },
      { key: "open", label: "Open field", match: (p: FilterRow) => (sc(p, "competition") ?? 9) <= 2 },
      { key: "crowded", label: "Crowded market", match: (p: FilterRow) => (sc(p, "competition") ?? 0) >= 4 },
    ],
  },
  {
    key: "tool",
    label: "Built with",
    hint: "Tools named in the breakdown",
    options: [
      { key: "claude-code", label: "Claude Code", match: (p: FilterRow) => !!p.tools?.includes("claude-code") },
      { key: "cursor", label: "Cursor", match: (p: FilterRow) => !!p.tools?.includes("cursor") },
      { key: "codex", label: "Codex", match: (p: FilterRow) => !!p.tools?.includes("codex") },
      { key: "lovable", label: "Lovable", match: (p: FilterRow) => !!p.tools?.includes("lovable") },
      { key: "bolt", label: "Bolt", match: (p: FilterRow) => !!p.tools?.includes("bolt") },
      { key: "replit", label: "Replit", match: (p: FilterRow) => !!p.tools?.includes("replit") },
      { key: "n8n", label: "n8n", match: (p: FilterRow) => !!p.tools?.includes("n8n") },
      { key: "supabase", label: "Supabase", match: (p: FilterRow) => !!p.tools?.includes("supabase") },
      { key: "shopify", label: "Shopify", match: (p: FilterRow) => !!p.tools?.includes("shopify") },
      { key: "expo", label: "Expo / React Native", match: (p: FilterRow) => !!p.tools?.includes("expo") },
      { key: "youtube", label: "YouTube channel", match: (p: FilterRow) => !!p.tools?.includes("youtube") },
      { key: "tiktok", label: "TikTok", match: (p: FilterRow) => !!p.tools?.includes("tiktok") },
    ],
  },
  {
    key: "model",
    label: "Business model",
    hint: "Category as indexed",
    options: [
      { key: "saas", label: "SaaS", match: (p: FilterRow) => p.category === "SaaS" },
      { key: "consumer", label: "Consumer app", match: (p: FilterRow) => p.category === "Consumer App" },
      { key: "service", label: "AI service / agency", match: (p: FilterRow) => p.category === "AI Service" },
      { key: "content", label: "Content & publishing", match: (p: FilterRow) => p.category === "AI Content" || p.category === "Digital Publishing" },
      { key: "ecom", label: "E-commerce", match: (p: FilterRow) => p.category === "AI E-commerce" },
      { key: "tool", label: "Simple tool / plugin", match: (p: FilterRow) => p.category === "Simple Tool" || p.category === "Platform Plugin" },
      { key: "directory", label: "Directory site", match: (p: FilterRow) => p.category === "Directory Site" },
      { key: "cautionary", label: "Cautionary tale", match: (p: FilterRow) => p.category.includes("Cautionary") },
    ],
  },
  {
    key: "country",
    label: "Country",
    hint: "Where the founder said they operate",
    options: [
      { key: "us", label: "United States", match: (p: FilterRow) => p.country === "US" },
      { key: "gb", label: "United Kingdom", match: (p: FilterRow) => p.country === "GB" },
      { key: "in", label: "India", match: (p: FilterRow) => p.country === "IN" },
      { key: "eu", label: "Europe", match: (p: FilterRow) => ["DE", "FR", "NL", "PL", "ES", "IT", "PT", "SE", "DK", "NO", "FI", "IE", "AT", "BE", "CH", "CZ", "TR"].includes(p.country ?? "") },
      { key: "asia", label: "Asia-Pacific", match: (p: FilterRow) => ["JP", "KR", "TH", "ID", "VN", "PH", "SG", "MY", "AU", "NZ", "TW", "CN", "HK"].includes(p.country ?? "") },
      { key: "latam", label: "Latin America", match: (p: FilterRow) => ["BR", "MX", "AR", "CO", "CL", "PE"].includes(p.country ?? "") },
      { key: "africa", label: "Africa", match: (p: FilterRow) => ["NG", "KE", "ZA", "EG", "GH", "MA", "DZ"].includes(p.country ?? "") },
    ],
  },
] as const;

export type FilterKey = (typeof FILTER_GROUPS)[number]["key"];
export type FilterState = Partial<Record<FilterKey, string>>;

/** 从 URL 查询参数里只取认识的键与值,不认识的丢掉(URL 是不可信输入)。 */
export function readFilters(sp: Record<string, string | string[] | undefined>): FilterState {
  const out: FilterState = {};
  for (const g of FILTER_GROUPS) {
    const raw = sp[g.key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v && g.options.some((o) => o.key === v)) out[g.key] = v;
  }
  return out;
}

export function applyFilters<T extends FilterRow>(rows: T[], f: FilterState): T[] {
  let list = rows;
  for (const g of FILTER_GROUPS) {
    const v = f[g.key];
    if (!v) continue;
    const opt = g.options.find((o) => o.key === v);
    if (opt) list = list.filter((p) => opt.match(p));
  }
  return list;
}

export function countActive(f: FilterState) {
  return Object.values(f).filter(Boolean).length;
}

/** 给面板用:切换某个筛选后的 href(同键再点一次 = 取消)。 */
export function filterHrefFor(base: string, f: FilterState, key: FilterKey, value: string) {
  const next: FilterState = { ...f };
  if (next[key] === value) delete next[key];
  else next[key] = value;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export type FilterCounts = Record<string, Record<string, number>>;

/** 每个选项在整个索引里命中多少条(不与其他筛选相交,语义是"库里有多少"),面板上给会员和游客都看。 */
export function filterCounts<T extends FilterRow>(rows: T[]): FilterCounts {
  const out: FilterCounts = {};
  for (const g of FILTER_GROUPS) {
    out[g.key] = {};
    for (const o of g.options) out[g.key][o.key] = rows.reduce((n, p) => n + (o.match(p) ? 1 : 0), 0);
  }
  return out;
}
