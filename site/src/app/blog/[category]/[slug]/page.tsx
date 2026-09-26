import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_CATEGORIES, BLOG_POSTS, getPost, postsByCategory } from "@/lib/blog";
import Markdown from "@/components/Markdown";
import ArrCalculator from "@/components/ArrCalculator";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ category: p.category, slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const post = getPost(category, slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${category}/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const post = getPost(category, slug);
  if (!post) notFound();
  const cat = BLOG_CATEGORIES.find((c) => c.slug === category)!;
  const categoryPosts = postsByCategory(category);
  const currentIndex = categoryPosts.findIndex((candidate) => candidate.slug === slug);
  const relatedPosts = [
    ...categoryPosts.slice(currentIndex + 1),
    ...categoryPosts.slice(0, currentIndex),
  ].slice(0, 4);
  const isClaudeCodeGuide = category === "ai-coding-tools" && slug === "claude-code-examples";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icon.svg` },
    },
    mainEntityOfPage: `${SITE.url}/blog/${category}/${slug}`,
    ...(post.images?.length ? { image: post.images.map((i) => i.url) } : {}),
    ...(post.keywords?.length ? { keywords: post.keywords.join(", ") } : {}),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE.url}/blog` },
      { "@type": "ListItem", position: 3, name: cat.title, item: `${SITE.url}/blog/${cat.slug}` },
      {
        "@type": "ListItem",
        position: 4,
        name: post.title,
        item: `${SITE.url}/blog/${category}/${slug}`,
      },
    ],
  };

  const faqLd =
    post.faqs && post.faqs.length >= 3
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.slice(0, 5).map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const calculatorLd =
    category === "saas-metrics" && slug === "arr-calculator"
      ? {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "ProvenStartups ARR Calculator",
          url: `${SITE.url}/blog/saas-metrics/arr-calculator`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "A free browser-based calculator that normalizes monthly and annual SaaS contracts into MRR and ARR while excluding one-time fees.",
        }
      : null;

  return (
    <article className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      )}
      {calculatorLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorLd) }}
        />
      )}

      <nav className="flex items-center gap-1.5 text-xs text-t4">
        <Link href="/" className="hover:text-t1">Home</Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-t1">Blog</Link>
        <span>/</span>
        <Link href={`/blog/${cat.slug}`} className="hover:text-t1">{cat.title}</Link>
      </nav>

      <header className="panel panel-lit mt-4 p-7">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-3 text-t2">{post.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-t4">
          <span>{SITE.name}</span>
          <span>·</span>
          <time dateTime={post.published}>Published {post.published}</time>
          {post.updated && post.updated !== post.published && (
            <>
              <span>·</span>
              <time dateTime={post.updated}>Updated {post.updated}</time>
            </>
          )}
        </div>
      </header>

      {category === "saas-metrics" && slug === "arr-calculator" && <ArrCalculator />}

      <div className="mt-5">
        <Markdown body={post.body} images={post.images} />
      </div>

      {relatedPosts.length > 0 && (
        <aside className="panel panel-lit mt-8 p-6" aria-labelledby="related-reading">
          <h2 id="related-reading" className="text-lg font-semibold tracking-tight">
            More in {cat.title}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedPosts.map((related) => (
              <Link
                key={related.slug}
                href={`/blog/${related.category}/${related.slug}`}
                className="rounded-xl border border-line bg-s2 p-4 hover:border-line-2"
              >
                <span className="text-sm font-semibold leading-snug">{related.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-t3">
                  {related.description}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/blog/${cat.slug}`} className="text-sm text-t1 hover:underline">
          ← More in {cat.title}
        </Link>
        <Link
          href={
            isClaudeCodeGuide
              ? "/projects?collection=claude-code-guide&ref=article-footer"
              : "/projects"
          }
          className="btn !py-2 !text-[0.85rem]"
        >
          {isClaudeCodeGuide ? "Compare the 9 cited cases" : "Browse proven ideas"}
        </Link>
      </div>
    </article>
  );
}
