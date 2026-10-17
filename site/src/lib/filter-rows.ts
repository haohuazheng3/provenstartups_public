import { unstable_cache } from "next/cache";
import { db, projects } from "@/db";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { SITE } from "./site";

/**
 * 项目页用的小清单:对所有人完整开放的前 50 个(锁定页下方的"免费读全文"推荐栏)
 * + 全库总数(文案里的"俱乐部里另外 N 个")。只有几十行,不去拉整张目录。
 */
export const loadOpenShelf = unstable_cache(
  async () => {
    const [open, counted] = await Promise.all([
      db
        .select({
          slug: projects.slug,
          name: projects.name,
          tagline: projects.tagline,
          revenue: projects.revenue,
          category: projects.category,
          rank: projects.rank,
        })
        .from(projects)
        .where(
          and(
            eq(projects.published, true),
            eq(projects.memberOnly, false),
            lte(projects.rank, SITE.guestVisibleCount)
          )
        )
        .orderBy(asc(projects.rank)),
      db.select({ n: sql<number>`count(*)::int` }).from(projects).where(eq(projects.published, true)),
    ]);
    return { open, total: counted[0]?.n ?? 0 };
  },
  ["open-shelf-v1"],
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
