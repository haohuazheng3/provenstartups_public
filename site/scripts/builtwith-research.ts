/**
 * "用 X 做的 App"系列页面的写作素材:每个工具一份 JSON(全部案例 + 提到该工具的原句 + 故事开头 + 结论 + 获客)。
 * 用法: node --env-file=.env.local ./node_modules/.bin/tsx scripts/builtwith-research.ts <输出目录>
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db, projects } from "../src/db";
import { rowsFor, type ToolRow } from "../src/lib/tool-data";

const TAGS = ["claude-code", "cursor", "chatgpt", "lovable", "gemini", "codex", "bubble", "replit", "bolt", "supabase", "firebase", "nextjs", "expo", "revenuecat", "n8n", "zapier", "make", "elevenlabs", "webflow", "framer", "chrome-extension", "shopify-app", "v0", "base44", "windsurf"];
const MENTION: Record<string, RegExp> = {
  "claude-code": /claude code/i, cursor: /\bcursor\b/i, chatgpt: /chatgpt|gpt-?[345]/i, lovable: /lovable/i, gemini: /gemini|google ai studio|nano banana/i, codex: /codex/i,
  bubble: /\bbubble/i, replit: /replit/i, bolt: /\bbolt/i, supabase: /supabase/i, firebase: /firebase/i, nextjs: /next\.?js/i, expo: /\bexpo\b|react native/i,
  revenuecat: /revenuecat/i, n8n: /\bn8n\b/i, zapier: /zapier/i, make: /make\.com|(?:zapier|n8n),? (?:and|or) make|make,? (?:and|or) (?:zapier|n8n)|make scenario/i, elevenlabs: /eleven ?labs/i, webflow: /webflow/i, framer: /\bframer\b/i,
  "chrome-extension": /chrome (web store )?extension|browser extension/i, "shopify-app": /shopify app/i, v0: /\bv0\b/i, base44: /base ?44/i, windsurf: /windsurf/i,
};

async function main() {
  const out = process.argv[2];
  const full = await db.select().from(projects).where(eq(projects.published, true));
  const rows: ToolRow[] = full.map((r) => ({ slug: r.slug, name: r.name, tagline: r.tagline, revenue: r.revenue, revenueMonthlyUsd: r.revenueMonthlyUsd, evidence: r.evidence, category: r.category, teamSize: r.teamSize, tools: r.tools ?? [], createdAt: new Date(r.createdAt).toISOString(), memberOnly: r.memberOnly }));
  const bySlug = new Map(full.map((r) => [r.slug, r]));
  for (const tag of TAGS) {
    const list = rowsFor(rows, tag).map((t) => {
      const r = bySlug.get(t.slug)!;
      const text = [r.tagline, r.oneLiner, ...(r.deepDive ?? []).map((s) => s.content ?? ""), JSON.stringify(r.quickCard ?? "")].join("\n");
      const sentences = text.split(/(?<=[.!?])\s+|\n/).filter((s) => MENTION[tag]?.test(s)).slice(0, 4).map((s) => s.slice(0, 320));
      return {
        slug: r.slug, name: r.name, tagline: r.tagline, revenue: r.revenue, monthly: r.revenueMonthlyUsd, evidence: r.evidence, category: r.category,
        team: r.team, team_size: r.teamSize, created: t.createdAt.slice(0, 10), member_only: r.memberOnly, tools: r.tools,
        mentions: sentences, story: (r.deepDive?.[0]?.content ?? "").slice(0, 700), verdict: r.quickCard?.verdict ?? null,
        acquisition: (r.quickCard?.acquisition ?? []).slice(0, 3), channels: r.quickCard?.channels ?? [], credibility: (r.credibility ?? "").slice(0, 300),
      };
    });
    fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify(list, null, 1));
    console.log(tag, list.length);
  }
}
main().then(() => process.exit(0));
