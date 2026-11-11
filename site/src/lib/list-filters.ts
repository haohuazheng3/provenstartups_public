/**
 * 目录页的"免费筛选条"(层级 / 证据 / 窗口期 / 类别)与会员痛点筛选的统一入口。
 * 目录页、"保存这个筛选"、每周匹配邮件三处共用 —— 同一个查询串在三处必须筛出同一批项目。
 */
import { FILTER_GROUPS, applyFilters, readFilters, type FilterRow } from "./filters";

export type ListSP = Record<string, string | undefined>;

export const STRIP_TIERS = [
  { key: "1", label: "T1" },
  { key: "2", label: "T2" },
  { key: "3", label: "T3" },
] as const;

export const STRIP_EVIDENCE = [
  { key: "verified", match: "✅", label: "Verified", long: "Third-party verified", cls: "ev-hard" },
  { key: "founder", match: "🗣", label: "Founder", long: "Founder-reported", cls: "ev-founder" },
  { key: "creator", match: "📎", label: "Creator", long: "Creator-relayed", cls: "ev-creator" },
  { key: "potential", match: "🔮", label: "Unproven", long: "Unproven", cls: "ev-unproven" },
] as const;

export const STRIP_TIMING = [
  { key: "evergreen", match: "🌲", label: "Evergreen" },
  { key: "window", match: "⏳", label: "Window" },
] as const;

/** 免费筛选条:任何人都能用 */
export function applyStripFilters<T extends FilterRow>(rows: T[], sp: ListSP): T[] {
  let list = rows;
  if (sp.tier) list = list.filter((p) => p.tier.startsWith(`Tier ${sp.tier}`));
  const ev = STRIP_EVIDENCE.find((e) => e.key === sp.evidence);
  if (ev) list = list.filter((p) => p.evidence.startsWith(ev.match));
  const tm = STRIP_TIMING.find((t) => t.key === sp.timing);
  if (tm) list = list.filter((p) => p.timing.startsWith(tm.match));
  if (sp.category) list = list.filter((p) => p.category === sp.category);
  return list;
}

/** 免费筛选条 + (会员时)痛点筛选 */
export function applyListFilters<T extends FilterRow>(rows: T[], sp: ListSP, member: boolean): T[] {
  const list = applyStripFilters(rows, sp);
  return member ? applyFilters(list, readFilters(sp)) : list;
}

/**
 * 只保留认识的键和值、按键名排序 —— 同一个筛选无论从哪儿进来都得到同一个串,
 * 这样"保存筛选"才能按 (用户, 查询串) 去重。不认识的键(utm、ref、save_filter)一律丢掉。
 */
export function normalizeFilterQuery(input: string | URLSearchParams | ListSP): string {
  const src =
    typeof input === "string"
      ? new URLSearchParams(input.replace(/^\?/, ""))
      : input instanceof URLSearchParams
        ? input
        : new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
  const out: [string, string][] = [];
  const tier = src.get("tier");
  if (tier && STRIP_TIERS.some((t) => t.key === tier)) out.push(["tier", tier]);
  const evidence = src.get("evidence");
  if (evidence && STRIP_EVIDENCE.some((e) => e.key === evidence)) out.push(["evidence", evidence]);
  const timing = src.get("timing");
  if (timing && STRIP_TIMING.some((t) => t.key === timing)) out.push(["timing", timing]);
  const category = src.get("category");
  if (category && category.length <= 60 && /^[\p{L}\p{N}\p{Emoji_Presentation} ⚠️&·/'().,-]+$/u.test(category)) {
    out.push(["category", category]);
  }
  for (const g of FILTER_GROUPS) {
    if (g.key === "evidence" || g.key === "tier" || g.key === "timing") continue; // 与免费筛选条同名同义,上面已收
    const v = src.get(g.key);
    if (v && g.options.some((o) => o.key === v)) out.push([g.key, v]);
  }
  out.sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(out).toString();
}

/** 人话描述,用于按钮文案与邮件标题,例如 "Third-party verified · Tier 1 · Weekend build" */
export function describeFilterQuery(query: string): string {
  const sp = new URLSearchParams(query);
  const parts: string[] = [];
  const ev = STRIP_EVIDENCE.find((e) => e.key === sp.get("evidence"));
  if (ev) parts.push(ev.long);
  if (sp.get("tier")) parts.push(`Tier ${sp.get("tier")}`);
  const tm = STRIP_TIMING.find((t) => t.key === sp.get("timing"));
  if (tm) parts.push(tm.key === "window" ? "Window open now" : "Evergreen");
  if (sp.get("category")) parts.push(sp.get("category")!);
  for (const g of FILTER_GROUPS) {
    if (g.key === "evidence" || g.key === "tier" || g.key === "timing") continue;
    const o = g.options.find((x) => x.key === sp.get(g.key));
    if (o) parts.push(o.label);
  }
  return parts.join(" · ") || "All ideas";
}
