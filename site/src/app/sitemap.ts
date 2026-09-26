import type { MetadataRoute } from "next";
import { db, projects } from "@/db";
import { eq, and } from "drizzle-orm";
import { SITE } from "@/lib/site";
import { BLOG_CATEGORIES, BLOG_POSTS } from "@/lib/blog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await db
    .select({ slug: projects.slug, updatedAt: projects.updatedAt })
    .from(projects)
    // 会员专供项目不进 sitemap(无公开可见内容)
    .where(and(eq(projects.published, true), eq(projects.memberOnly, false)));

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/projects`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const blogCats: MetadataRoute.Sitemap = BLOG_CATEGORIES.map((c) => ({
    url: `${SITE.url}/blog/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // 文章页。之前漏了这一段 —— 200 篇文章一篇都没进 sitemap,等于白写
  const blogPosts: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${SITE.url}/blog/${p.category}/${p.slug}`,
    lastModified: new Date(p.updated ?? p.published),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const projectPages: MetadataRoute.Sitemap = rows.map((p) => ({
    url: `${SITE.url}/projects/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogCats, ...blogPosts, ...projectPages];
}
