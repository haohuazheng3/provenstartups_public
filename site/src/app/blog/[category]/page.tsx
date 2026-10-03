import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_CATEGORIES, postsByCategory } from "@/lib/blog";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = BLOG_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: cat.title,
    description: cat.blurb,
    alternates: { canonical: `/blog/${cat.slug}` },
  };
}

const PER_PAGE = 20;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category } = await params;
  const { page } = await searchParams;
  const cat = BLOG_CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const all = postsByCategory(cat.slug);
  const pageNum = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const posts = all.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE.url}/blog` },
      { "@type": "ListItem", position: 3, name: cat.title, item: `${SITE.url}/blog/${cat.slug}` },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <nav className="mono flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em] text-t4">
        <Link href="/" className="hover:text-t1">
          Home
        </Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-t1">
          Blog
        </Link>
        <span>/</span>
        <span className="text-t2">{cat.title}</span>
      </nav>

      <h1 className="h-display mt-4 text-[1.9rem] sm:text-[2.5rem]">{cat.title}</h1>
      <p className="prose-body mt-4 max-w-xl">{cat.blurb}</p>

      {posts.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-t3">No articles in this category yet.</p>
          <Link href="/projects" className="btn">
            Browse ideas instead
          </Link>
        </div>
      ) : (
        <div className="panel mt-8 overflow-hidden">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${cat.slug}/${p.slug}`}
              className="block border-b border-line px-6 py-5 transition-colors last:border-b-0 hover:bg-sheet-2"
            >
              <div className="mono text-[0.68rem] uppercase tracking-[0.1em] text-t4">
                {p.published}
                {p.updated && p.updated !== p.published ? ` · updated ${p.updated}` : ""}
              </div>
              <div className="h-sec mt-1.5 text-[1.3rem]">{p.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-t3">{p.description}</p>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={n === 1 ? `/blog/${cat.slug}` : `/blog/${cat.slug}?page=${n}`}
              className={`chip ${n === pageNum ? "chip-brand" : ""}`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
