import { unstable_cache } from "next/cache";
import { db, projects } from "@/db";
import { asc, eq, sql } from "drizzle-orm";

/**
 * 全库总数(项目页入会文案里的"all N ideas")。一行,跨请求缓存 24h,tag "projects"。
 * 2026-11-06 起不再有"前 50 个免费"的清单 —— 每个项目都公开,锁在 02–05 四段上。
 */
export const loadProjectCount = unstable_cache(
  async () => {
    const [counted] = await db.select({ n: sql<number>`count(*)::int` }).from(projects).where(eq(projects.published, true));
    return counted?.n ?? 0;
  },
  ["project-count-v1"],
  { revalidate: 86400, tags: ["projects"] }
);

/**
 * 筛选面板与目录页共用的全量行(轻字段,不含拆解正文)。
 * 跨请求缓存 24h,tag "projects" —— 导入脚本跑完调 /api/admin/revalidate 即刻失效。
 */
export const loadFilterRows = unstable_cache(
  async () =>
    db
      .select({
        slug: projects.slug,
        rank: projects.rank,
        tier: projects.tier,
        category: projects.category,
        timing: projects.timing,
        evidence: projects.evidence,
        name: projects.name,
        tagline: projects.tagline,
        revenue: projects.revenue,
        team: projects.team,
        region: projects.region,
        difficultyDots: projects.difficultyDots,
        oneLiner: projects.oneLiner,
        potentialStars: projects.potentialStars,
        memberOnly: projects.memberOnly,
        revenueMonthlyUsd: projects.revenueMonthlyUsd,
        teamSize: projects.teamSize,
        tools: projects.tools,
        country: projects.country,
        scores: projects.scores,
      })
      .from(projects)
      .where(eq(projects.published, true))
      .orderBy(asc(projects.rank)),
  ["projects-list-v2"],
  { revalidate: 86400, tags: ["projects"] }
);
