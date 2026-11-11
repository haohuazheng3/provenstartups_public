import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import Link from "@/components/HoverLink";
import { notFound } from "next/navigation";
import { db, projects } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";
import { guidesForProject } from "@/lib/guides";
import { liveTitles } from "@/lib/tool-data";
import { atSecond, clock } from "@/lib/video-time";
import { Dots, Stars, ScoreBars } from "@/components/Score";
import { evidenceOf, tierShort, amountOf } from "@/components/ProjectRow";
import { countryCode } from "@/lib/country";
import { JoinCta } from "@/components/LockCta";
import LockedSection from "@/components/LockedSection";
import { Receipt, ReceiptLine, EvidenceStamp } from "@/components/Receipt";
import { loadOpenShelf } from "@/lib/filter-rows";
import BuildSpec from "@/components/BuildSpec";
import CopyButton from "@/components/CopyButton";
import CoreFeatureSignal from "@/components/CoreFeatureSignal";

// 这一页读 auth(付费墙按访客身份分支),所以它必然是动态渲染 ——
// revalidate 在这里不起作用,别指望用它省数据库。省的办法在下面的 getProject。
export const revalidate = 0;

/**
 * 只取页面真正用到的列。**这不是为了省字节** —— 实测未用的那几列
 * (id/published/origin/notifiedAt/createdAt/updatedAt) 都是小字段,
 * 裁掉它们对 15KB 的整行几乎没有影响。写出来是为了让"这一页依赖哪些数据"
 * 一眼可见,以后往表里加大字段时不会被无声地拖进每一次查询。
 */
const COLUMNS = {
  slug: projects.slug,
  rank: projects.rank, // 收据上的 № 号
  tier: projects.tier,
  category: projects.category,
  tools: projects.tools,
  timing: projects.timing,
  evidence: projects.evidence,
  credibility: projects.credibility,
  name: projects.name,
  tagline: projects.tagline,
  oneLiner: projects.oneLiner,
  revenue: projects.revenue,
  team: projects.team,
  region: projects.region,
  difficultyDots: projects.difficultyDots,
  potentialStars: projects.potentialStars,
  scores: projects.scores,
  deepDive: projects.deepDive,
  quickCard: projects.quickCard,
  buildPrompt: projects.buildPrompt,
  seoPrompt: projects.seoPrompt,
  sources: projects.sources,
};

/**
 * 两层缓存,各自解决一个不同的浪费:
 *
 * · `unstable_cache` —— 跨请求。项目数据是导入型的,不是实时的,所以同一个 slug
 *   在 TTL 内只查一次库。这一层是给爬虫准备的:sitemap 里 731 个 URL,IndexNow
 *   一推,Bing/Yandex/Seznam/Naver 连同 Google 一起反复抓,曾把 Neon 的月流量
 *   吃到 4.9GB(每天约 245MB,而真人访客一天才十几个)。
 *   TTL 取 24 小时而不是 1 小时:实测每个 URL 一天只被抓约 11 次,1 小时的窗口
 *   基本拦不住(57MB/天),24 小时才把每个 slug 压到一天一查(5MB/天)。
 *   项目数据只由导入脚本写,改完调 /api/admin/revalidate 即时生效,不必靠短 TTL。
 *   注意它不能读 cookies/headers —— 这里只吃一个 slug,访客身份仍在外面每次现算,
 *   付费墙不受影响。
 *
 * · `React.cache` —— 单次请求内。generateMetadata 和页面组件都要这一行,
 *   Next 只对 fetch 去重,不管任意 async 调用,所以不包这层就是每次访问查两遍。
 */
const loadProject = unstable_cache(
  async (slug: string) => {
    const rows = await db
      .select(COLUMNS)
      .from(projects)
      .where(and(eq(projects.slug, slug), eq(projects.published, true)))
      .limit(1);
    return rows[0] ?? null;
  },
  ["project-detail-v4"],
  { revalidate: 86400, tags: ["projects"] }
);

const getProject = cache(loadProject);

/**
 * 两层付费墙(2026-11-11,站长定;11-06 曾改成"只锁段落、项目全公开",4 天 0 付费后改回项目层的锁):
 * - 段落层:02–05 四段创始人手册对所有非会员都锁,开放项目也不例外(LOCKED)。
 * - 项目层:只有 rank 前 SITE.guestVisibleCount 个是开放项目,01 + 06 以后全文;
 *   其余项目非会员只读 01 全文,06 以后只露标题。
 * 收入、证据等级、来源链接、原话 + 时间点对所有人公开(证据层)。
 * 锁住的段非会员只拿到标题 + 开头两句 + 词形条(LockedSection 在服务端切,全文不进 HTML 也不进 RSC 载荷);
 * 只露标题的段连预览都不给。游客 = 免费账号 = 爬虫。
 */
const LOCKED = new Set<string>(SITE.club.lockedSections);
type SectionView = "full" | "teaser" | "title";
function guestView(num: string | null | undefined, openProject: boolean): SectionView {
  if (LOCKED.has(num ?? "")) return "teaser";
  if (openProject || num === "01") return "full";
  return "title";
}

const LANG = new Intl.DisplayNames(["en"], { type: "language" });
function langName(code: string) {
  try {
    return LANG.of(code) ?? code;
  } catch {
    return code;
  }
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="inline h-3.5 w-3.5 shrink-0 align-[-2px] text-t4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

const SEO_OVERRIDES: Record<string, { title: string; description: string }> = {
  elevenlabs: {
    title: "ElevenLabs Revenue: $500M+ ARR, Sources & Timeline",
    description:
      "ElevenLabs says it surpassed $500M ARR in early 2026. Compare the dated $330M+, $350M, $500M+ and older $125M claims, with source grades and limitations.",
  },
  "ugc-tank-invite-only-creator-sourcing-platform": {
    // 搜 "ugc tank" 的人在问"这是什么、靠谱吗"。旧标题把 $598 MRR 放最前,读起来像失败案例:
    // GSC 1,854 次曝光、第 7.2 位,只有 2 次点击(CTR 0.1%)。产品名打头,先答"是什么"。
    title: "UGC Tank: what it is, how it makes money, and the real numbers",
    description:
      "UGC Tank is an invite-only marketplace where brands source vetted UGC creators. Here is the model, the reported revenue with its evidence grade, and the risks.",
  },
};

const REVENUE_LEDGERS: Record<
  string,
  {
    asOf: string;
    rows: {
      date: string;
      figure: string;
      metric: string;
      evidence: string;
      href?: string;
      source: string;
    }[];
    note: string;
  }
> = {
  elevenlabs: {
    asOf: "Last source check: September 22, 2026",
    rows: [
      {
        date: "May 5, 2026",
        figure: "$500M+",
        metric: "ARR surpassed in the first four months of 2026",
        evidence: "Company-reported; independently corroborated; unaudited",
        href: "https://elevenlabs.io/blog/500m-arr-and-new-investors",
        source: "ElevenLabs",
      },
      {
        date: "May 7, 2026",
        figure: "$500M+",
        metric: "Annual recurring revenue milestone",
        evidence: "Third-party corroboration; not an audit",
        href: "https://stripe.com/newsroom/news/elevenlabs-and-stripe",
        source: "Stripe",
      },
      {
        date: "End of 2025",
        figure: "$350M",
        metric: "ARR",
        evidence: "Company-reported; unaudited",
        href: "https://elevenlabs.io/blog/500m-arr-and-new-investors",
        source: "ElevenLabs",
      },
      {
        date: "February 4, 2026",
        figure: "$330M+",
        metric: "ARR at the end of 2025",
        evidence: "Company-reported; approximate; unaudited",
        href: "https://elevenlabs.io/blog/series-d",
        source: "ElevenLabs",
      },
      {
        date: "Date not established",
        figure: "$125M/yr",
        metric: "Older annualized figure",
        evidence: "Creator-relayed; accounting basis not established",
        source: "Archived video roundup",
      },
    ],
    note:
      "ARR is a point-in-time recurring run rate. None of these sources establishes audited recognized revenue, profit, cash collected, retention, or the $11B valuation as revenue.",
  },
};

// Keep every public project detail page in a small, crawlable category graph.
// The category result is cached as one shared value, so adding these links does
// not turn a crawler pass into one extra database query per project.
const loadCategoryProjects = unstable_cache(
  async (category: string) =>
    db
      .select({
        slug: projects.slug,
        name: projects.name,
        tagline: projects.tagline,
        revenue: projects.revenue,
        rank: projects.rank,
      })
      .from(projects)
      .where(and(eq(projects.published, true), eq(projects.category, category)))
      .orderBy(asc(projects.rank)),
  ["public-projects-by-category-v3"],
  { revalidate: 86400, tags: ["projects"] }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return {};
  const override = SEO_OVERRIDES[p.slug];
  return {
    // 产品名打头是铁律(项目页的搜索流量全来自产品名);收入只取干净的第一段,长旁注不进标题
    title:
      override?.title ??
      `${p.name}: ${(p.revenue ?? "").split("·")[0].trim().slice(0, 28) || "revenue, model, and evidence"} — how it makes money`,
    description: override?.description ?? p.tagline,
    alternates: { canonical: `/projects/${p.slug}` },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [p, viewer, shelf] = await Promise.all([getProject(slug), getViewer(), loadOpenShelf()]);
  if (!p) notFound();

  const [categoryProjects, guides] = await Promise.all([
    loadCategoryProjects(p.category),
    liveTitles(guidesForProject(p.tools, p.category)),
  ]);
  const currentIndex = categoryProjects.findIndex((candidate) => candidate.slug === p.slug);
  const relatedProjects = [
    ...categoryProjects.slice(currentIndex + 1),
    ...categoryProjects.slice(0, currentIndex),
  ].slice(0, 4);
  // 唯一的访问判定。游客与免费账号同视野;爬虫不带 cookie,看到的就是游客版。
  const isMember = viewer.level === "member";
  const revenueLedger = REVENUE_LEDGERS[p.slug];

  const deepDive = p.deepDive ?? [];
  const openSlugs = new Set(shelf.open.map((o) => o.slug));
  const openProject = openSlugs.has(p.slug);
  // 爬虫看到的就是游客版,所以 JSON-LD 的付费段按游客视角算,不随登录态变
  const paywalledForGuests = deepDive.filter((s) => guestView(s.num, openProject) !== "full");
  const viewOf = (num: string | null | undefined): SectionView => (isMember ? "full" : guestView(num, openProject));
  const hiddenForViewer = isMember ? [] : paywalledForGuests;
  const titleOnlyCount = hiddenForViewer.filter((s) => guestView(s.num, openProject) === "title").length;
  const totalLabel = shelf.total.toLocaleString("en-US");
  const clubOnlyCount = Math.max(0, shelf.total - shelf.open.length);

  // 锁定项目页下方的"开放项目"推荐栏:同类优先,再按排名补满 4 个
  const openPicks =
    isMember || openProject
      ? []
      : [
          ...shelf.open.filter((o) => o.category === p.category && o.slug !== p.slug),
          ...shelf.open.filter((o) => o.category !== p.category),
        ].slice(0, 4);

  // 2026-10-24 起不再展示字幕全文(那是对创作者讲话的整段复制);只给说出数字的那一两句原话 + 跳到那一秒的链接。
  // 2026-11-06 起原话文字也对所有人公开 —— 它是证据层的一部分,和来源链接、时间点一样
  const anyQuotes = (p.sources ?? []).some((s) => s.video_url && (s.quotes ?? []).length > 0);

  const sourceLinks = (p.sources ?? []).filter((s) => s.video_url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${p.name} — proven AI startup idea breakdown`,
    description: p.tagline,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/projects/${p.slug}`,
    // 付费墙的结构化标记(Google 的 paywalled-content 规范):整页不是全免费,hasPart 逐段指出哪些是付费段。
    // 这样爬虫知道预览句后面的空白是付费墙而不是伪装内容(cloaking),同时能完整读到 01、收入与来源(开放项目还有 06+)。
    isAccessibleForFree: false,
    hasPart: paywalledForGuests.map((s) => ({
      "@type": "WebPageElement",
      isAccessibleForFree: false,
      cssSelector: `#section-${s.num}`,
      name: `${s.num} ${s.title}`,
    })),
    // 证据层对所有人公开,也告诉引用我们的 AI 引擎每个数字出自哪里
    ...(sourceLinks.length
      ? {
          isBasedOn: sourceLinks.map((s) => ({
            "@type": "CreativeWork",
            name: s.video_title,
            url: s.video_url,
          })),
        }
      : {}),
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/projects" className="btn btn-quiet -ml-3">
        ← All ideas
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip mono">{tierShort(p.tier)}</span>
          <span className="chip">{p.category}</span>
          {p.region && (
            <span className="chip">
              {countryCode(p.region) && (
                <span className="mono text-[0.62rem] tracking-[0.05em] text-t4">
                  {countryCode(p.region)}
                </span>
              )}
              {p.region}
            </span>
          )}
          <span className="chip hidden sm:inline-flex">{p.timing}</span>
          <span className="chip">
            <span className={`ev ${evidenceOf(p.evidence).cls}`} />
            {evidenceOf(p.evidence).label}
          </span>
        </div>

        <h1 className="h-display mt-5">{p.name}</h1>
        <p className="prose-body mt-4 max-w-2xl text-[1.05rem]">{p.tagline}</p>
      </header>

      {/* 关键数字做成一张收据 —— 这个站卖的就是这张纸 */}
      <Receipt className="mt-8">
        <div className="px-6 pt-5 pb-9 sm:px-8">
          <div className="mono flex items-center justify-between text-[0.62rem] uppercase tracking-[0.14em] text-t3">
            <span>Revenue receipt</span>
            <span>№ {p.rank}</span>
          </div>
          <div className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
            <div className="flex items-baseline text-[0.86rem]">
              <span className="shrink-0 text-t3">Revenue</span>
              <span className="leader" aria-hidden />
              {/* 没有数字的收入写法("Priced per lead or per month")截成 14 字会像坏掉的页面 —— 详情页写全 */}
              {amountOf(p.revenue)?.endsWith("…") ? (
                <span className="money min-w-0 text-right text-[0.95rem] font-semibold leading-snug">
                  {(p.revenue ?? "").split("·")[0].replace(/\([^)]*\)/g, "").trim()}
                </span>
              ) : (
                <span className="mono money shrink-0 text-[1.45rem] font-semibold leading-none">{amountOf(p.revenue) ?? "—"}</span>
              )}
            </div>
            <ReceiptLine label="Team">
              <span className="inline-block max-w-[13rem] truncate align-bottom text-[0.86rem]" title={p.team ?? undefined}>
                {p.team ?? "—"}
              </span>
            </ReceiptLine>
            <ReceiptLine label="Difficulty">
              <Dots n={p.difficultyDots} />
            </ReceiptLine>
            <ReceiptLine label="Upside">
              <Stars n={p.potentialStars} />
            </ReceiptLine>
            <ReceiptLine label="Evidence">
              <span className="text-[0.86rem]">{evidenceOf(p.evidence).label}</span>
            </ReceiptLine>
            <ReceiptLine label="Sources">
              <span className="text-[0.86rem]">
                {(p.sources ?? []).length} {(p.sources ?? []).length === 1 ? "video" : "videos"}
                {(p.sources ?? [])[0]?.fetched ? ` · captured ${(p.sources ?? [])[0]!.fetched}` : ""}
              </span>
            </ReceiptLine>
          </div>
          {p.revenue && p.revenue.split("·").length > 1 && (
            <p className="mt-5 border-t border-dashed border-line-2 pt-4 text-[0.8rem] leading-relaxed text-t3">
              {p.revenue.split("·").slice(1).join(" · ").trim()}
            </p>
          )}
          <div className="mt-5 flex items-end justify-between gap-3">
            <span className="mono min-w-0 break-all text-[0.62rem] text-t4">provenstartups.com/projects/{p.slug}</span>
            <EvidenceStamp evidence={p.evidence} />
          </div>
        </div>
      </Receipt>

      {revenueLedger && (
        <section className="panel mt-8 overflow-hidden" aria-labelledby="revenue-ledger">
          <div className="border-b border-line px-5 py-4 sm:flex sm:items-end sm:justify-between sm:gap-4">
            <div>
              <span className="eyebrow">Revenue evidence ledger</span>
              <h2 id="revenue-ledger" className="h-sec mt-1.5">
                Which number, when, and how strong is the source?
              </h2>
            </div>
            <p className="mt-2 text-xs text-t4 sm:mt-0">{revenueLedger.asOf}</p>
          </div>
          <div className="divide-y divide-line">
            {revenueLedger.rows.map((row) => (
              <div
                key={`${row.date}-${row.figure}-${row.source}`}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[7.5rem_6rem_1fr] sm:gap-4"
              >
                <div className="text-xs text-t4">{row.date}</div>
                <div className="mono font-semibold text-money">{row.figure}</div>
                <div>
                  <p className="text-sm font-medium text-t1">{row.metric}</p>
                  <p className="mt-1 text-xs leading-relaxed text-t3">{row.evidence}</p>
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="link mt-1.5 inline-flex text-xs font-medium"
                    >
                      Open {row.source} source
                    </a>
                  ) : (
                    <p className="mt-1.5 text-xs text-t4">Source: {row.source}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="border-t border-line bg-sheet-2 px-5 py-4 text-xs leading-relaxed text-t3">
            {revenueLedger.note}
          </p>
        </section>
      )}

      {p.oneLiner && (
        <blockquote className="mt-8 border-l-[3px] border-brand pl-5 text-[1.05rem] font-medium leading-[1.6] text-t2">
          {p.oneLiner}
        </blockquote>
      )}

      {/* 激活信号 = 会员真的读到了付费段;免费账号现在看不到任何付费内容,不再算激活 */}
      {isMember && <CoreFeatureSignal feature="deep_dive" projectSlug={p.slug} />}

      {/* 五维评分 */}
      <section className="panel mt-8 p-7">
        <span className="eyebrow">Difficulty profile</span>
        <div className="mt-6">
          <ScoreBars scores={p.scores ?? undefined} />
        </div>
        <p className="mt-6 text-[0.7rem] leading-relaxed text-t4">
          Fewer bars = easier, cheaper, or faster for an AI-assisted solo builder. Editorial
          judgments based on the case details.
        </p>
      </section>

      {/* 深度拆解:按原顺序走一遍。非会员:02–05 换成预览卡;非开放项目的 06 以后只露标题 */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="h-sec text-[1.7rem]">Deep dive</h2>
          {!isMember && openProject && (
            <span className="chip chip-money">Open idea · one of {shelf.open.length} free to read</span>
          )}
          {!isMember && !openProject && hiddenForViewer.length > 0 && (
            <span className="text-xs text-t3">
              <LockIcon /> {hiddenForViewer.length} of {deepDive.length} sections are members-only
            </span>
          )}
        </div>
        <div className="mt-5 space-y-4">
          {deepDive.map((s) => {
            const view = viewOf(s.num);
            if (view === "teaser") {
              return <LockedSection key={s.num} num={s.num} title={s.title} content={s.content} slug={p.slug} />;
            }
            if (view === "title") {
              // 只露标题:不给预览句。id + ps-paywall 是给 JSON-LD hasPart 的 cssSelector 用的
              return (
                <div
                  key={s.num}
                  id={`section-${s.num}`}
                  className="ps-paywall panel flex scroll-mt-24 items-center gap-3 px-5 py-3.5 text-sm text-t3"
                  data-paywalled="true"
                >
                  <LockIcon />
                  <span className="serif text-[1.1rem] leading-none text-t4">{s.num}</span>
                  <span className="min-w-0 truncate font-medium">{s.title}</span>
                </div>
              );
            }
            const paywalled = isMember && guestView(s.num, openProject) !== "full";
            return (
              <div
                key={s.num}
                id={`section-${s.num}`}
                className={`${paywalled ? "ps-paywall " : ""}panel scroll-mt-24 p-6 sm:p-7`}
              >
                <h3 className="flex items-baseline gap-3">
                  <span className="serif text-[1.6rem] leading-none text-brand/30">{s.num}</span>
                  <span className="h-sec text-[1.3rem]">{s.title}</span>
                </h3>
                <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-[1.75] text-t2">
                  {s.content}
                </p>
              </div>
            );
          })}

          {!isMember && openProject && hiddenForViewer.length > 0 && (
            <JoinCta
              placement="open_breakdown_end"
              note={`This is one of the ${shelf.open.length} ideas open to everyone. The four founder playbooks — ${SITE.club.lockedSectionsLabel} — are in the ${SITE.club.name}, on this idea and on all ${totalLabel}, along with every section of the other ${clubOnlyCount.toLocaleString("en-US")} ideas.`}
              redirectTo={`/projects/${p.slug}`}
            />
          )}
          {!isMember && !openProject && hiddenForViewer.length > 0 && (
            <JoinCta
              placement="deep_dive"
              note={`The rest of this breakdown — the four founder playbooks${titleOnlyCount > 0 ? ` and ${titleOnlyCount} more ${titleOnlyCount === 1 ? "section" : "sections"}` : ""} — is in the ${SITE.club.name}, with every section of all ${totalLabel} ideas.`}
              redirectTo={`/projects/${p.slug}`}
            />
          )}
        </div>
      </section>

      {/* 锁定项目页:给还不打算付费的访客一条继续读下去的路 */}
      {openPicks.length > 0 && (
        <aside className="panel mt-6 p-6 sm:p-7" aria-labelledby="open-picks">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="open-picks" className="h-sec">
              Open to read
            </h2>
            <span className="text-xs text-t3">The story and every later section · no account needed</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {openPicks.map((o) => (
              <Link
                key={o.slug}
                href={`/projects/${o.slug}`}
                data-track="open_pick_click"
                data-track-from={p.slug}
                className="min-w-0 rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-line-2 hover:bg-paper-2"
              >
                <span className="block font-medium text-t1">{o.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-t3">
                  {o.tagline}
                </span>
                {o.revenue && (
                  <span className="mono mt-2 block text-xs font-semibold text-money">
                    {amountOf(o.revenue) ?? o.revenue}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </aside>
      )}

      {/* 速览卡:02–05 的摘要,跟着它们归会员(2026-11-06 站长定) */}
      {p.quickCard && isMember && (
        <section className="panel mt-6 space-y-5 p-6 sm:p-7">
          <h2 className="h-sec">Quick reference</h2>
          {p.quickCard.acquisition?.length ? (
            <div>
              <h3 className="label">How they got customers</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                {p.quickCard.acquisition.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.quickCard.playbook?.length ? (
            <div>
              <h3 className="label">Replication playbook</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                {p.quickCard.playbook.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.quickCard.risks?.length ? (
            <div>
              <h3 className="label">Risks & traps</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-t2">
                {p.quickCard.risks.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.quickCard.verdict && (
            <div className="rounded-xl border border-line bg-sheet-2 p-4">
              <h3 className="label">Our verdict</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-t2">{p.quickCard.verdict}</p>
            </div>
          )}
          {p.quickCard.channels?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {p.quickCard.channels.map((c, i) => (
                <span key={i} className="chip chip-wrap">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}
      {p.quickCard && !isMember && (
        <section className="mt-6">
          <JoinCta
            compact
            placement="quick_card"
            note="The quick-reference card — acquisition channels, replication playbook, risks & traps, and our verdict — is members-only."
            redirectTo={`/projects/${p.slug}`}
          />
        </section>
      )}

      {/* Build prompts:会员专属 */}
      <section className="mt-6">
        <h2 className="h-sec px-1 text-[1.7rem]">Build prompts</h2>
        <p className="mt-2 px-1 text-sm text-t3">
          Paste into Claude Code / Codex and get a working version of this product end-to-end.
        </p>
        {isMember && (
          <div className="mt-4">
            <BuildSpec slug={p.slug} name={p.name} />
          </div>
        )}
        {isMember && p.buildPrompt ? (
          <div className="mt-4 space-y-4">
            <div className="panel p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="h-sec text-[1.2rem]">End-to-end build prompt</h3>
                <CopyButton text={p.buildPrompt} />
              </div>
              <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-[0.8rem] leading-relaxed text-t2">
                {p.buildPrompt}
              </pre>
            </div>
            {p.seoPrompt && (
              <div className="panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="h-sec text-[1.2rem]">SEO growth prompt</h3>
                  <CopyButton text={p.seoPrompt} />
                </div>
                <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-[0.8rem] leading-relaxed text-t2">
                  {p.seoPrompt}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <JoinCta
              compact
              placement="build_prompts"
              note="Two production-grade prompts per idea — a full build spec and an SEO growth plan — plus 10 tailored build specs a week. Members only."
              redirectTo={`/projects/${p.slug}`}
            />
          </div>
        )}
      </section>

      {/* 溯源:证据层(来源链接、证据等级、可信度、原话与时间点)全部对所有人公开;字幕全文不展示 */}
      <section className="mt-6">
        <h2 className="h-sec px-1 text-[1.7rem]">Source receipts</h2>
        <p className="mt-2 px-1 text-sm text-t3">
          Every claim traces back to a listed source — open any of them and check the number yourself.
          {anyQuotes ? " The exact words are quoted below, with a timestamp that jumps to the second each figure is said." : ""}
        </p>
        <div className="mt-4 space-y-4">
          {(p.sources ?? []).map((s, i) => (
            <div key={i} className="panel p-5 sm:p-6">
              <div className="mono text-[0.66rem] uppercase tracking-[0.1em] text-t4">
                {s.platform} {s.views ? `· ~${s.views} views` : ""}{" "}
                {s.fetched ? `· captured ${s.fetched}` : ""}
              </div>
              <div className="serif mt-2 text-[1.2rem] leading-snug text-t1">{s.video_title}</div>
              {s.video_subtitle && <div className="mt-0.5 text-xs text-t3">{s.video_subtitle}</div>}
              {s.video_url && (
                <a
                  href={s.video_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="btn btn-sm mt-3"
                  data-track="source_click"
                  data-track-slug={p.slug}
                  data-track-platform={s.platform}
                >
                  Open source
                  <span aria-hidden className="text-t3">↗</span>
                </a>
              )}
              {s.video_url && (s.quotes ?? []).length > 0 && (
                <ul className="mt-4 space-y-2.5">
                  {(s.quotes ?? []).map((q, k) => (
                    <li key={k} className="rounded-xl bg-paper px-4 py-3">
                      <p className="text-[0.9rem] leading-relaxed text-t1">&ldquo;{q.text}&rdquo;</p>
                      <a
                        href={atSecond(s.video_url!, q.t)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mono mt-1.5 inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-brand hover:underline"
                        data-track="quote_click"
                        data-track-slug={p.slug}
                      >
                        <span aria-hidden>▶</span> {clock(q.t)} · hear it in the video
                        <span aria-hidden className="text-t3">↗</span>
                      </a>
                      {q.lang && q.lang !== "en" && (
                        <span className="ml-2 text-[0.7rem] text-t4">{langName(q.lang)}, as spoken</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {(p.sources ?? []).length === 0 && p.credibility && (
            <div className="panel p-5 text-sm text-t3">{p.credibility}</div>
          )}
        </div>
        {p.credibility && (p.sources ?? []).length > 0 && (
          <p className="mt-4 px-1 text-[0.74rem] leading-relaxed text-t3">
            Data credibility: {p.credibility}
          </p>
        )}
      </section>

      {guides.length > 0 && (
        <aside className="panel mt-8 p-6 sm:p-7" aria-labelledby="idea-guides">
          <h2 id="idea-guides" className="h-sec">
            Guides for this idea
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {guides.map((g) => (
              <Link
                key={g.slug}
                href={`/blog/${g.category}/${g.slug}`}
                data-track="project_guide_click"
                className="min-w-0 rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-line-2 hover:bg-paper-2"
              >
                <span className="block text-sm font-medium leading-snug text-t1">{g.seoTitle ?? g.title}</span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      {relatedProjects.length > 0 && (
        <aside className="panel mt-8 p-6 sm:p-7" aria-labelledby="related-ideas">
          <h2 id="related-ideas" className="h-sec">
            More proven ideas in {p.category}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedProjects.map((related) => (
              <Link
                key={related.slug}
                href={`/projects/${related.slug}`}
                className="min-w-0 rounded-xl border border-line bg-sheet-2 p-4 transition-colors hover:border-line-2 hover:bg-paper-2"
              >
                <span className="block font-medium text-t1">{related.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-t3">
                  {related.tagline}
                </span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  {related.revenue ? (
                    <span className="mono text-xs font-semibold text-money">
                      {amountOf(related.revenue) ?? related.revenue}
                    </span>
                  ) : (
                    <span />
                  )}
                  {!isMember && openSlugs.has(related.slug) && (
                    <span className="text-[0.68rem] font-medium text-money">Open to read</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link href="/projects" className="link text-sm">
          ← All ideas
        </Link>
        <Link href="/" className="text-sm text-t3 hover:text-t1">
          Home
        </Link>
      </div>
    </div>
  );
}
