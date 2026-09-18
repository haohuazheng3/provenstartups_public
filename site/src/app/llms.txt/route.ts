import { db, projects } from "@/db";
import { asc, eq, and } from "drizzle-orm";
import { SITE } from "@/lib/site";
import { BLOG_CATEGORIES, BLOG_POSTS, postsByCategory } from "@/lib/blog";

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

  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} publishes reverse-engineered breakdowns of AI and software businesses that already
generate revenue. Every entry carries an evidence label (verified data, founder-reported,
creator-reported, or unverified potential), difficulty scores across five dimensions, the
acquisition channels that worked, and links to the original source video.

## Access levels
- Anonymous: partial directory
- Free account (email code, no password): all breakdowns, playbooks, source links
- Pro ($${SITE.priceMonthly}/mo): build prompts, SEO prompts, full source transcripts, Pro-exclusive ideas

## Key pages
- ${SITE.url}/projects — full directory
- ${SITE.url}/blog — ${BLOG_POSTS.length} guides, each built on the graded cases above
- ${SITE.url}/pricing — plans
- ${SITE.url}/how-it-works — methodology
- ${SITE.url}/faq — questions
- ${SITE.url}/about — who we are

## Guides by topic
${BLOG_CATEGORIES.map((c) => {
  const posts = postsByCategory(c.slug);
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
