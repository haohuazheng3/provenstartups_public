/**
 * 把自由文本字段推导成筛选模块要的归一化列(幂等,可反复跑):
 *   revenue → revenue_monthly_usd(整数美元/月;算不出留 null)
 *   team    → team_size(solo | duo | team | company | unknown)
 *   正文    → tools[](受控词表)
 *   region  → country(ISO-3166 两位码)
 *
 * 换算规则(宁缺毋滥 —— 猜出来的数字会把"月收入 ≥$10K"这种筛选变成谎言):
 *   - 只认美元;非美元币种一律 null(不引入汇率)
 *   - "$23K/mo" "$250K/mo" "$14K MRR" → 直接;"$300K ARR" "$1.2M/yr" → ÷12;
 *     "$16.5K lifetime/total/in 4 months" 之类累计值 → null(不是月收入)
 *   - 区间 "$500-1,500/mo" 取下限(保守);箭头 "$0 → $30K/mo" 取箭头后
 *   - 括号里的换算值/旁注先剥掉
 */
// env 由 node --env-file=.env.local 注入
import { db, projects } from "../src/db";
import { eq } from "drizzle-orm";
import { countryCode } from "../src/lib/country";
import { toolTags } from "../src/lib/tool-tags";

// 工具标签的规则在 src/lib/tool-tags.ts(2026-10-17 重写:出现即算 → 看"在用"的语境,见文件头注释)
const MAG: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };
// 解析器读不对的个别条目(按客单价写的总量等),人工给出月收入;每条注明依据
const MONTHLY_OVERRIDE: Record<string, number> = {
  "designjoy-brett-williams-productized-design": 100_000, // "~20 clients on a ~$5,000/month plan",被读成 $5,000
};

export function monthlyUsd(revenue: string | null): number | null {
  if (!revenue) return null;
  let head = revenue.split("·")[0].replace(/\([^)]*\)/g, " ");
  if (/^\s*(no revenue|revenue not disclosed|undisclosed|not disclosed|pre-revenue|\$0\b)/i.test(head)) return null;
  const arrow = head.search(/→|->|⇒/);
  if (arrow >= 0) head = head.slice(arrow + 1);
  // 累计/一次性金额不是月收入
  if (/lifetime|total|cumulative|all[- ]time|one[- ]time|raised|valuation|exit|sold for|acquired/i.test(head)) return null;
  // 量级字母后面不能紧跟字母:"$11,200 MRR" 的 M 是 MRR 的 M,不是百万(2026-10-17 前所有 "$X MRR" 都因此算成 null)
  const m = head.match(/\$\s?([\d.,]+)\s*([kmb](?![a-z]))?\s*(?:\+|\s)?\s*(?:-|–|—)?\s*(?:\$?\s?[\d.,]+\s*([kmb](?![a-z]))?)?\s*(\/\s?(mo|month|yr|year|wk|week|day)|mrr|arr|per month|a month|per year|a year|annual|monthly)?/i);
  if (!m) return null;
  // 目标/提议/预测不是收入:"Target $2K-$10K/mo"、"Proposed $499/mo"、"$10K MRR target";"$17K MRR, targeting $20K" 的 $17K 照算
  const before = head.slice(0, m.index ?? 0);
  const after = head.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
  if (/\b(?:target(?:ing)?|goal|proposed|potential|projected|suggested|aim(?:s|ing)? for)\b/i.test(before) || /^\s*(?:target|goal)\b/i.test(after)) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(n)) return null;
  // 区间只在后一个数上写了量级("$10-11K MRR"),前一个数沿用它
  const mag = m[2] || m[3];
  if (mag) n *= MAG[mag.toLowerCase()];
  const unit = (m[4] || "").toLowerCase();
  if (!unit) return null; // 没有周期的数字(如 "$1.5M")不知道是年、总还是估值 → 不猜
  // "$12K in 3 weeks" 是一段时间的合计;"$10.4K/month in 10 months" 是用多久做到的月收入,算
  if (/in \d+ (days|weeks|months)/i.test(head) && !/mo|month|mrr/.test(unit)) return null;
  if (/yr|year|arr|annual/.test(unit)) n /= 12;
  else if (/wk|week/.test(unit)) n *= 4.33;
  else if (/day/.test(unit)) n *= 30;
  return Math.round(n);
}

export function teamSize(team: string | null): string {
  if (!team) return "unknown";
  const t = team.toLowerCase();
  if (/not disclosed|unknown|undisclosed/.test(t)) return "unknown";
  if (/^solo|one[- ]person|single founder|\bsolo\b/.test(t)) return "solo";
  if (/2 (co)?founders|two (co)?founders|duo|pair|couple|husband|wife|brothers|\b2 people\b/.test(t)) return "duo";
  if (/company|\d{2,}\+? (staff|people|employees)|enterprise|corporation|scale/.test(t)) return "company";
  if (/team|cofounders|founders|\d+ people|small/.test(t)) return "team";
  return "unknown";
}

async function main() {
  const rows = await db.select({ slug: projects.slug, revenue: projects.revenue, team: projects.team, region: projects.region, deepDive: projects.deepDive, quickCard: projects.quickCard, oneLiner: projects.oneLiner, tagline: projects.tagline }).from(projects);
  const dist = { rev: 0, team: {} as Record<string, number>, tools: {} as Record<string, number>, country: 0 };
  for (const r of rows) {
    const rev = MONTHLY_OVERRIDE[r.slug] ?? monthlyUsd(r.revenue);
    const ts = teamSize(r.team);
    const text = [r.tagline, r.oneLiner, JSON.stringify(r.deepDive ?? ""), JSON.stringify(r.quickCard ?? "")].join(" ");
    const tools = toolTags(text, r.slug);
    const country = countryCode(r.region) ?? null;
    // int4 上限约 21 亿;Accenture 这类规模参照月收入会超,封顶即可(筛选最高档只到 $50K+)
    const revCapped = rev == null ? rev : Math.min(rev, 2_000_000_000);
    await db.update(projects).set({ revenueMonthlyUsd: revCapped, teamSize: ts, tools, country }).where(eq(projects.slug, r.slug));
    if (rev != null) dist.rev++;
    dist.team[ts] = (dist.team[ts] ?? 0) + 1;
    for (const t of tools) dist.tools[t] = (dist.tools[t] ?? 0) + 1;
    if (country) dist.country++;
  }
  console.log(`rows ${rows.length} | revenue_monthly_usd 非空 ${dist.rev} | country 非空 ${dist.country}`);
  console.log("team_size:", dist.team);
  console.log("tools:", Object.entries(dist.tools).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
