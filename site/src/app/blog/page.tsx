import type { Metadata } from "next";
import Link from "@/components/HoverLink";
import { BLOG_CATEGORIES, BLOG_POSTS, postsByCategory } from "@/lib/blog";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Playbooks, teardowns, and growth tactics from startups with revenue receipts — organized by topic.",
  alternates: { canonical: "/blog" },
};

/**
 * 四组,对应读者从"选什么"到"做出来"的顺序。2026-10-03 博客收缩后,开店操作与人群副业
 * 一类分类已撤掉(见 lib/retired-blog.ts),这里每个分类都直接服务"有收入证据的创业项目"这件事。
 * 新增分类要放进其中一组;没放进来的会落到最后一组,不会凭空消失。
 */
const GROUPS: { label: string; slugs: string[] }[] = [
  { label: "Ideas & business models", slugs: ["startup-ideas", "side-income", "digital-products", "solo-founders"] },
  { label: "What it actually earns", slugs: ["revenue-reality", "app-revenue", "blogs-and-affiliate"] },
  { label: "Building with AI", slugs: ["built-with-ai", "ai-coding-tools", "vibe-coding", "ai-agencies", "build-and-ship"] },
  { label: "Running, growing, failing", slugs: ["saas-metrics", "launch-and-growth", "risks-and-rules"] },
];

export default function BlogIndex() {
  // slice 前必须排序 —— BLOG_POSTS 是按目录读盘顺序来的,不排序取到的不是最新
  const featured = [...BLOG_POSTS]
    .sort((a, b) => b.published.localeCompare(a.published))
    .slice(0, 3);
  const grouped = new Set(GROUPS.flatMap((g) => g.slugs));
  const groups = GROUPS.map((g, i) => ({
    label: g.label,
    cats: BLOG_CATEGORIES.filter(
      (c) => g.slugs.includes(c.slug) || (i === GROUPS.length - 1 && !grouped.has(c.slug)),
    ).sort((a, b) => g.slugs.indexOf(a.slug) - g.slugs.indexOf(b.slug)),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-8">
        <span className="label">Blog</span>
        <h1 className="h-display mt-3 text-[1.9rem] sm:text-[2.5rem]">Teardowns &amp; <em>playbooks</em></h1>
        <p className="prose-body mt-4 max-w-lg">
          Startup ideas, what they actually earn, and how people build them with AI — written off the
          same founder interviews and revenue evidence the index is built from.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.label} className="pb-10">
          <span className="label">{group.label}</span>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.cats.map((c) => {
              const count = postsByCategory(c.slug).length;
              return (
                <Link
                  key={c.slug}
                  href={`/blog/${c.slug}`}
                  className="panel flex flex-col gap-2 p-6"
                >
                  <h2 className="h-sec text-[1.35rem]">{c.title}</h2>
                  <p className="text-sm leading-relaxed text-t3">{c.blurb}</p>
                  <span className="mono mt-auto pt-3 text-[0.68rem] uppercase tracking-[0.1em] text-t4">
                    {count === 0 ? "Coming soon" : `${count} article${count === 1 ? "" : "s"}`}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {featured.length > 0 && (
        <section className="mt-3">
          <span className="label">Latest</span>
          <div className="panel mt-4 overflow-hidden">
            {featured.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.category}/${p.slug}`}
                className="block border-b border-line px-6 py-5 transition-colors last:border-b-0 hover:bg-sheet-2"
              >
                <div className="mono text-[0.68rem] uppercase tracking-[0.1em] text-t4">{p.published}</div>
                <div className="h-sec mt-1.5 text-[1.3rem]">{p.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-t3">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {BLOG_POSTS.length === 0 && (
        <div className="panel mt-10 flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-t3">
            First articles are in the works. In the meantime, the full idea directory is live.
          </p>
          <Link href="/projects" className="btn btn-primary">
            Browse {SITE.name} ideas
          </Link>
        </div>
      )}
    </div>
  );
}
