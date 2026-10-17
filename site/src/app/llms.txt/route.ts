import { db, projects } from "@/db";
import { asc, eq, and } from "drizzle-orm";
import { SITE } from "@/lib/site";
import { BLOG_CATEGORIES, BLOG_POSTS, postsByCategory } from "@/lib/blog";
import { liveTitles } from "@/lib/tool-data";

export const revalidate = 3600;

export async function GET() {
  const rows = await db
    .select({
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      revenue: projects.revenue,
      tier: projects.tier,
      evidence: projects.evidence,
    })
    .from(projects)
    .where(and(eq(projects.published, true), eq(projects.memberOnly, false)))
    .orderBy(asc(projects.rank));
  const liveCat = new Map(
    await Promise.all(BLOG_CATEGORIES.map(async (c) => [c.slug, await liveTitles(postsByCategory(c.slug))] as const)),
  );

  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} publishes reverse-engineered breakdowns of AI and software businesses that already
generate revenue. Every entry carries an evidence label (verified data, founder-reported,
creator-reported, or unverified potential), difficulty scores across five dimensions, the
acquisition channels that worked, and links to the original source video.

## Access levels
- Anonymous: partial directory
- Free to read: the first ${SITE.guestVisibleCount} ideas in full; for every other idea, the opening story, the first lines of each founder playbook, the revenue figure, its evidence grade, and every source link; a free account can save filters (email alerts for free accounts are not active yet)
- Membership ($${SITE.priceMonthly}/mo, "Unicorn Club"): every breakdown and section, founder playbooks (first customers, first dollar, flywheel, the no-feedback stretch), pain-point filters, source transcripts, 10 tailored build specs a week, and a library export (every idea in one Markdown, JSON or CSV file) for members to analyze with their own AI tools, plus The Drop, an email every 3 days covering the 50–100 newest ideas

## Key pages
- ${SITE.url}/projects — full directory
- ${SITE.url}/blog — ${BLOG_POSTS.length} guides, each built on the graded cases above
- ${SITE.url}/pricing — plans
- ${SITE.url}/how-it-works — methodology
- ${SITE.url}/faq — questions
- ${SITE.url}/about — who we are

## Guides by topic
${BLOG_CATEGORIES.map((c) => {
  const posts = liveCat.get(c.slug) ?? [];
  if (!posts.length) return "";
  return [
    `### ${c.title} (${posts.length})`,
    c.blurb,
    ...posts.map((p) => `- ${SITE.url}/blog/${c.slug}/${p.slug} — ${p.title}`),
  ].join("\n");
}).filter(Boolean).join("\n\n")}

## Ideas (${rows.length})
${rows
  .map(
    (r) =>
      `- [${r.name}](${SITE.url}/projects/${r.slug}) — ${r.tagline}${
        r.revenue ? ` | ${r.revenue}` : ""
      } | ${r.tier} | ${r.evidence}`
  )
  .join("\n")}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
