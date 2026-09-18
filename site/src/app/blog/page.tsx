import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_CATEGORIES, BLOG_POSTS, postsByCategory } from "@/lib/blog";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Playbooks, teardowns, and growth tactics from startups with revenue receipts — organized by topic.",
  alternates: { canonical: "/blog" },
};

/** 开发者向的九个板块 —— 与电商向分开陈列,两批受众混在一列里谁都找不到自己那组 */
const BUILDER_SLUGS = new Set([
  "vibe-coding", "ai-coding-tools", "ai-agencies", "saas-metrics", "solo-founders",
  "build-and-ship", "side-income", "launch-and-growth", "built-with-ai",
]);

/**
 * 第三组:先问钱的人。这四个板块横跨前两组的受众 —— 问"这东西到底赚多少"的人
 * 还没决定自己是建软件的还是卖货的,塞进任何一组都是猜错。
 */
const MONEY_SLUGS = new Set([
  "what-it-really-pays", "app-revenue", "blogs-and-affiliate", "store-economics",
]);

export default function BlogIndex() {
  // slice 前必须排序 —— BLOG_POSTS 是按目录读盘顺序来的,不排序取到的不是最新
  const featured = [...BLOG_POSTS]
    .sort((a, b) => b.published.localeCompare(a.published))
    .slice(0, 3);
  const money = BLOG_CATEGORIES.filter((c) => MONEY_SLUGS.has(c.slug));
  const builders = BLOG_CATEGORIES.filter((c) => BUILDER_SLUGS.has(c.slug));
  const sellers = BLOG_CATEGORIES.filter(
    (c) => !BUILDER_SLUGS.has(c.slug) && !MONEY_SLUGS.has(c.slug),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-6">
        <span className="label">Blog</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">Teardowns &amp; playbooks</h1>
        <p className="prose-body mt-3 max-w-lg">
          Written off the same transcripts the index is built from.
        </p>
      </div>

      {[
        { label: "If you want the numbers first", cats: money },
        { label: "If you build software", cats: builders },
        { label: "If you sell products", cats: sellers },
      ].map((group) => (
        <section key={group.label} className="pb-9">
          <span className="label">{group.label}</span>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.cats.map((c) => {
              const count = postsByCategory(c.slug).length;
              return (
                <Link
                  key={c.slug}
                  href={`/blog/${c.slug}`}
                  className="panel panel-lit flex flex-col gap-2 p-5 transition-colors hover:bg-s2"
                >
                  <h2 className="h-sec">{c.title}</h2>
                  <p className="text-sm leading-relaxed text-t3">{c.blurb}</p>
                  <span className="mt-auto pt-2 text-xs text-t4">
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
          <h2 className="px-2 text-[1.15rem] font-semibold tracking-[-0.025em]">Latest</h2>
          <div className="mt-4 space-y-3">
            {featured.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.category}/${p.slug}`}
                className="panel panel-lit block p-5"
              >
                <div className="text-xs text-t4">{p.published}</div>
                <div className="mt-1 font-semibold">{p.title}</div>
                <p className="mt-1 text-sm text-t3">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {BLOG_POSTS.length === 0 && (
        <div className="panel panel-lit mt-10 flex flex-col items-center gap-3 p-8 text-center">
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
