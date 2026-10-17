import type { Metadata } from "next";
import Link from "@/components/HoverLink";
import { notFound } from "next/navigation";
import { BLOG_CATEGORIES, BLOG_POSTS, getPost, postsByCategory } from "@/lib/blog";
import Markdown, { slugId } from "@/components/Markdown";
import BlogCases from "@/components/BlogCases";
import ArrCalculator from "@/components/ArrCalculator";
import { SITE } from "@/lib/site";
import { liveEmbed } from "@/components/ToolLive";
import { hydratePost, isLivePost, liveModified, liveSlots, liveTitles, loadToolRows } from "@/lib/tool-data";

// "用 X 做的 App"这类实时页:数字和清单来自库,导入后 revalidateTag("projects") 即刷新;再加一天兜底
export const revalidate = 86400;

/** 实时页先把行内记号换成当前数,再交给页面;普通文章原样返回 */
async function resolvePost(category: string, slug: string) {
  const raw = getPost(category, slug);
  if (!raw || !isLivePost(raw)) return raw ? { post: raw, modified: raw.updated ?? raw.published, live: false } : null;
  const rows = await loadToolRows();
  return { post: hydratePost(raw, rows), modified: liveModified(raw, rows), live: true };
}

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ category: p.category, slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const resolved = await resolvePost(category, slug);
  if (!resolved) return {};
  const { post, modified } = resolved;
  return {
    // seoTitle 是写给搜索结果页的那一行:不带品牌后缀(Google 会在标题上方单独显示站名),
    // 把 60 个字符全留给"扫一眼就知道是不是我要的"那几个词
    title: post.seoTitle ? { absolute: post.seoTitle } : post.title,
    description: post.description,
    alternates: { canonical: `/blog/${category}/${slug}` },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: modified,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const resolved = await resolvePost(category, slug);
  if (!resolved) notFound();
  const { post, modified, live } = resolved;
  const cat = BLOG_CATEGORIES.find((c) => c.slug === category)!;
  const categoryPosts = postsByCategory(category);
  const currentIndex = categoryPosts.findIndex((candidate) => candidate.slug === slug);
  const relatedPosts = await liveTitles(
    [...categoryPosts.slice(currentIndex + 1), ...categoryPosts.slice(0, currentIndex)].slice(0, 4),
  );
  const isClaudeCodeGuide = category === "ai-coding-tools" && slug === "claude-code-examples";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    ...(post.seoTitle && post.seoTitle !== post.title ? { alternativeHeadline: post.seoTitle } : {}),
    description: post.description,
    datePublished: post.published,
    dateModified: modified,
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

      <nav className="mono flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.1em] text-t4">
        <Link href="/" className="hover:text-t1">Home</Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-t1">Blog</Link>
        <span>/</span>
        <Link href={`/blog/${cat.slug}`} className="hover:text-t1">{cat.title}</Link>
      </nav>

      <header className="mt-5 border-b border-line pb-7">
        <h1 className="h-display text-[1.9rem] sm:text-[2.5rem]">{post.title}</h1>
        <p className="prose-body mt-5 text-[1.08rem]">{post.description}</p>
        <div className="mono mt-6 flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.1em] text-t4">
          <span>{SITE.name}</span>
          <span>·</span>
          <time dateTime={post.published}>Published {post.published}</time>
          {modified !== post.published && (
            <>
              <span>·</span>
              <time dateTime={modified}>Updated {modified}</time>
            </>
          )}
          {live && (
            <>
              <span>·</span>
              <span>Live list</span>
            </>
          )}
        </div>
      </header>

      {/* 按搜索动机分流:同一篇文章回答几类不同的搜索,卡片标题就是那类搜索该看到的标题,
          一句话先给答案,点一下直接跳到对应章节 —— 不让人在长文里找自己的问题 */}
      {post.intents && post.intents.length > 0 && (
        <nav className="panel mt-7 p-5 sm:p-6" aria-label="Jump to your question">
          <div className="label">Jump to your question</div>
          <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
            {post.intents.map((it) => (
              <li key={it.anchor}>
                <a
                  href={`#${slugId(it.anchor)}`}
                  data-track="blog_intent_click"
                  className="flex h-full flex-col rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-brand/40 hover:bg-paper-2"
                >
                  <span className="text-[0.92rem] font-medium leading-snug text-t1">{it.title}</span>
                  <span className="mt-1.5 text-[0.8rem] leading-relaxed text-t3">{it.answer}</span>
                  <span className="mt-2 text-[0.75rem] font-medium text-brand">Read the answer ↓</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {category === "saas-metrics" && slug === "arr-calculator" && <ArrCalculator />}

      <div className="mt-2">
        <Markdown
          body={post.body}
          images={post.images}
          embeds={{
            cases: post.cases?.length ? <BlogCases slugs={post.cases} /> : null,
            cta: post.cta ? <ArticleCta cta={post.cta} /> : null,
            ...Object.fromEntries(liveSlots(post.body).map((slot) => [slot, liveEmbed(slot)])),
          }}
        />
      </div>

      {post.cta && !/^\{\{cta\}\}$/m.test(post.body) && <ArticleCta cta={post.cta} />}

      {relatedPosts.length > 0 && (
        <aside className="panel mt-10 p-6 sm:p-7" aria-labelledby="related-reading">
          <h2 id="related-reading" className="h-sec">
            More in {cat.title}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedPosts.map((related) => (
              <Link
                key={related.slug}
                href={`/blog/${related.category}/${related.slug}`}
                className="rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-line-2 hover:bg-paper-2"
              >
                <span className="text-sm font-medium leading-snug text-t1">{related.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-t3">
                  {related.description}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/blog/${cat.slug}`} className="link text-sm">
          ← More in {cat.title}
        </Link>
        <Link
          href={
            isClaudeCodeGuide
              ? "/projects?collection=claude-code-guide&ref=article-footer"
              : "/projects"
          }
          className="btn"
        >
          {isClaudeCodeGuide ? "Compare the 9 cited cases" : "Browse proven ideas"}
        </Link>
      </div>
    </article>
  );
}

/** 贴合本文意图的下一步:读完"有哪些例子"的人,下一步是看到全部例子,而不是一个泛泛的"浏览项目" */
function ArticleCta({ cta }: { cta: { title: string; text: string; href: string; label: string } }) {
  return (
    <aside className="panel-club my-9 p-6 sm:p-7">
      <div className="h-sec text-[1.25rem] text-t1">{cta.title}</div>
      <p className="mt-2.5 text-[0.92rem] leading-relaxed text-t2">{cta.text}</p>
      <Link href={cta.href} className="btn btn-club mt-5" data-track="blog_cta_click">
        {cta.label}
      </Link>
    </aside>
  );
}

