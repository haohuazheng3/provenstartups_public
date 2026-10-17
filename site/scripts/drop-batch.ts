/**
 * The Drop:把"本轮新导入的项目"导出给编辑写稿(只读)。
 * 用法: node --env-file=.env.local ./node_modules/.bin/tsx scripts/drop-batch.ts <起点,UTC ISO 时间> <输出 JSON>
 *   起点 = 本轮导入开始前记下的时间(`date -u +%Y-%m-%dT%H:%M:%S`),只取 created_at 晚于它的已发布项目。
 * 输出每个项目的编辑素材:名称、标语、类别、证据、收入原文、团队、国家、工具、评分、一句话、结论、打法、可信度与故事开头。
 */
import fs from "fs";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, projects } from "../src/db";

async function main() {
  const [since, out] = process.argv.slice(2);
  if (!since || !out) throw new Error("usage: drop-batch.ts <since ISO UTC> <out.json>");
  const rows = await db
    .select({
      slug: projects.slug,
      rank: projects.rank,
      name: projects.name,
      tagline: projects.tagline,
      category: projects.category,
      evidence: projects.evidence,
      revenue: projects.revenue,
      revenueMonthlyUsd: projects.revenueMonthlyUsd,
      team: projects.team,
      teamSize: projects.teamSize,
      country: projects.country,
      tools: projects.tools,
      scores: projects.scores,
      oneLiner: projects.oneLiner,
      quickCard: projects.quickCard,
      credibility: projects.credibility,
      deepDive: projects.deepDive,
      sources: projects.sources,
      memberOnly: projects.memberOnly,
    })
    .from(projects)
    .where(and(eq(projects.published, true), gt(projects.createdAt, new Date(since.endsWith("Z") ? since : `${since}Z`))))
    .orderBy(asc(projects.rank));
  const slim = rows.map((r) => ({
    slug: r.slug,
    rank: r.rank,
    name: r.name,
    tagline: r.tagline,
    category: r.category,
    evidence: r.evidence,
    revenue: r.revenue,
    revenue_monthly_usd: r.revenueMonthlyUsd,
    team: r.team,
    team_size: r.teamSize,
    country: r.country,
    tools: r.tools,
    scores: r.scores,
    one_liner: r.oneLiner,
    verdict: r.quickCard?.verdict ?? null,
    playbook: r.quickCard?.playbook ?? null,
    credibility: (r.credibility ?? "").slice(0, 600),
    story: (r.deepDive?.[0]?.content ?? "").slice(0, 900),
    platform: r.sources?.[0]?.platform ?? null,
    member_only: r.memberOnly,
  }));
  fs.writeFileSync(out, JSON.stringify(slim, null, 1));
  console.log(JSON.stringify({ count: slim.length, out }));
}
main().then(() => process.exit(0));
