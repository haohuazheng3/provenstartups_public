/** 写稿校验用:每个工具的实时统计 + 全部已发布项目 slug。用法:tsx scripts/builtwith-stats.ts <输出 json> */
import fs from "fs";
import { eq } from "drizzle-orm";
import { db, projects } from "../src/db";
import { rowsFor, toolStats, type ToolRow } from "../src/lib/tool-data";
import { TOOL_LABELS } from "../src/lib/tool-tags";
async function main() {
  const full = await db.select().from(projects).where(eq(projects.published, true));
  const rows: ToolRow[] = full.map((r) => ({ slug: r.slug, name: r.name, tagline: r.tagline, revenue: r.revenue, revenueMonthlyUsd: r.revenueMonthlyUsd, evidence: r.evidence, category: r.category, teamSize: r.teamSize, tools: r.tools ?? [], createdAt: new Date(r.createdAt).toISOString(), memberOnly: r.memberOnly }));
  const stats = Object.fromEntries(Object.keys(TOOL_LABELS).map((t) => [t, toolStats(rows, t)]));
  const asof = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), "");
  fs.writeFileSync(process.argv[2], JSON.stringify({ stats, total: rows.length, asof, slugs: rows.map((r) => r.slug), rows: rows.map((r) => ({ slug: r.slug, tools: r.tools })), byTag: Object.fromEntries(Object.keys(TOOL_LABELS).map((t) => [t, rowsFor(rows, t).map((r) => r.slug)])) }));
  console.log("ok", rows.length);
}
main().then(() => process.exit(0));
