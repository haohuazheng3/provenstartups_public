import { db, projects } from "@/db";
import { asc, eq } from "drizzle-orm";
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
    .where(eq(projects.published, true))
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
- Free to read, no account needed, on every one of the ${rows.length} ideas: the story (section 01), the revenue figure with its evidence grade, the difficulty scores, every source link, and the exact quote behind each figure with a timestamp link to the second it is said. On the top ${SITE.guestVisibleCount} ideas by rank, every section from 06 on is open as well. A free account can also save filters (email alerts for free accounts are not active yet).
- Members only ($${SITE.priceMonthly}/mo, "Unicorn Club"): every section of every idea — including, on all of them, the four founder playbooks: sections 02 "Getting the first customers from zero", 03 "How the first dollar came in", 04 "How the flywheel started turning", 05 "Surviving the no-feedback stretch" (non-members see each one's title and opening lines), and sections 06+ on ideas outside the top ${SITE.guestVisibleCount} (non-members see their titles) — plus the quick-reference card (acquisition channels, replication playbook, risks, verdict), pain-point filters on the index, 10 tailored build specs a week, a library export (every idea in one Markdown, JSON or CSV file) for members to analyze with their own AI tools, and The Drop, an email every 3 days covering the 50–100 newest ideas.
- Paywalled sections are marked in each project page's JSON-LD (Article.hasPart with isAccessibleForFree=false); everything else on the page is open to read and to cite.

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
