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

// copilot 用裸词会命中 "AI e-commerce copilot" 这种产品名和 "no Copilot" 这种否定句,故要求 "github copilot" 或 "copilot chat/agent/…"
const TOOLS: [tag: string, rx: RegExp][] = [
  ["claude-code", /claude code/i], ["cursor", /\bcursor\b/i], ["codex", /\bcodex\b/i], ["chatgpt", /chatgpt/i],
  ["gemini", /\bgemini\b/i], ["lovable", /\blovable\b/i], ["bolt", /\bbolt\.new\b|\bbolt\b/i], ["replit", /\breplit\b/i],
  ["v0", /\bv0\b/i], ["windsurf", /windsurf/i], ["copilot", /github copilot|copilot (chat|agent|coding|workspace)|built (with|using) copilot/i], ["base44", /base ?44/i], ["n8n", /\bn8n\b/i],
  ["zapier", /zapier/i], ["make", /make\.com/i], ["supabase", /supabase/i], ["firebase", /firebase/i], ["stripe", /\bstripe\b/i],
  ["shopify", /shopify/i], ["webflow", /webflow/i], ["framer", /\bframer\b/i], ["bubble", /\bbubble\b/i], ["notion", /\bnotion\b/i],
  ["airtable", /airtable/i], ["elevenlabs", /elevenlabs|eleven labs/i], ["midjourney", /midjourney/i], ["runway", /\brunway\b/i],
  ["expo", /\bexpo\b|react native/i], ["revenuecat", /revenuecat/i], ["nextjs", /next\.js|nextjs/i], ["wordpress", /wordpress/i],
  ["gumroad", /gumroad/i], ["etsy", /\betsy\b/i], ["kdp", /\bkdp\b|kindle direct/i], ["youtube", /youtube/i], ["tiktok", /tiktok/i],
  ["chrome-extension", /chrome extension/i], ["telegram", /telegram/i], ["discord", /discord/i], ["figma", /\bfigma\b/i],
];

const MAG: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };
export function monthlyUsd(revenue: string | null): number | null {
  if (!revenue) return null;
  let head = revenue.split("·")[0].replace(/\([^)]*\)/g, " ");
  if (/^\s*(no revenue|revenue not disclosed|undisclosed|not disclosed|pre-revenue|\$0\b)/i.test(head)) return null;
  const arrow = head.search(/→|->|⇒/);
  if (arrow >= 0) head = head.slice(arrow + 1);
  // 累计/一次性金额不是月收入
  if (/lifetime|total|cumulative|all[- ]time|in \d+ (days|weeks|months)|one[- ]time|raised|valuation|exit|sold for|acquired/i.test(head)) return null;
  const m = head.match(/\$\s?([\d.,]+)\s*([kmb])?\s*(?:\+|\s)?\s*(?:-|–|—)?\s*(?:\$?\s?[\d.,]+\s*[kmb]?)?\s*(\/\s?(mo|month|yr|year|wk|week|day)|mrr|arr|per month|a month|per year|a year|annual|monthly)?/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(n)) return null;
  if (m[2]) n *= MAG[m[2].toLowerCase()];
  const unit = (m[3] || "").toLowerCase();
  if (!unit) return null; // 没有周期的数字(如 "$1.5M")不知道是年、总还是估值 → 不猜
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
    const rev = monthlyUsd(r.revenue);
    const ts = teamSize(r.team);
    const text = [r.tagline, r.oneLiner, JSON.stringify(r.deepDive ?? ""), JSON.stringify(r.quickCard ?? "")].join(" ");
    const tools = TOOLS.filter(([, rx]) => rx.test(text)).map(([tag]) => tag);
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
