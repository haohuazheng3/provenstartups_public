import { unstable_cache } from "next/cache";
import { db, projects } from "@/db";
import { asc, eq } from "drizzle-orm";

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
