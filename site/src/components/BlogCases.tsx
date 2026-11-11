import { unstable_cache } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import Link from "@/components/HoverLink";
import { db, projects } from "@/db";
import { amountOf, evidenceOf } from "@/components/ProjectRow";

/**
 * 文章里的"真实案例"卡:按 slug 实时取库(收入、证据等级随库更新,不会像正文数字那样过期)。
 * 一天一查,项目导入后 revalidateTag("projects") 即刻刷新。读者从这里一步进到项目拆解页 ——
 * 这是文章到核心产品最短的一条路,也是给项目页的站内链接。
 */
const loadCases = unstable_cache(
  async (slugs: string[]) =>
    db
      .select({
        slug: projects.slug,
        name: projects.name,
        tagline: projects.tagline,
        revenue: projects.revenue,
        evidence: projects.evidence,
        category: projects.category,
      })
      .from(projects)
      .where(and(eq(projects.published, true), inArray(projects.slug, slugs))),
  ["blog-cases-v1"],
  { revalidate: 86400, tags: ["projects"] }
);

export default async function BlogCases({ slugs, title }: { slugs: string[]; title?: string }) {
  if (!slugs.length) return null;
  const rows = await loadCases(slugs);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const list = slugs.map((s) => bySlug.get(s)).filter((r): r is NonNullable<typeof r> => !!r);
  if (!list.length) return null;
  return (
    <section className="panel my-8 p-5 sm:p-6" aria-label={title ?? "Cases in the index"}>
      <div className="label">{title ?? "The cases behind this article"}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const ev = evidenceOf(p.evidence);
          const amt = amountOf(p.revenue);
          return (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}`}
              data-track="blog_case_click"
              className="flex min-w-0 flex-col rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-brand/40 hover:bg-paper-2"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[0.92rem] font-medium text-t1">{p.name}</span>
                {amt && !amt.endsWith("…") && (
                  <span className="mono money shrink-0 text-[0.86rem] font-semibold">{amt}</span>
                )}
              </span>
              <span className="mt-1 line-clamp-2 text-[0.8rem] leading-relaxed text-t3">{p.tagline}</span>
              <span className="mt-2.5 flex items-center gap-2 text-[0.72rem] text-t3">
                <span className={`ev ${ev.cls}`} />
                {ev.label}
                <span className="text-t4">·</span>
                {p.category}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
