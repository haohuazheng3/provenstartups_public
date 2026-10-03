import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, projects, transcripts } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";
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
  rank: projects.rank, // 前 50 个对所有人完整开放,要靠它判定
  tier: projects.tier,
  category: projects.category,
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
  memberOnly: projects.memberOnly,
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
  ["project-detail-v2"],
  { revalidate: 86400, tags: ["projects"] }
);

const getProject = cache(loadProject);

/** 01–05 是故事 + 固定四段(起步获客 / 第一笔钱 / 飞轮 / 无反馈期):锁住时给开头两句;06 以后只露标题 */
const TEASER_THROUGH = 5;

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
      .where(
        and(
          eq(projects.published, true),
          eq(projects.memberOnly, false),
          eq(projects.category, category)
        )
      )
      .orderBy(asc(projects.rank)),
  ["public-projects-by-category-v2"],
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

  const categoryProjects = await loadCategoryProjects(p.category);
  const currentIndex = categoryProjects.findIndex((candidate) => candidate.slug === p.slug);
  const relatedProjects = [
    ...categoryProjects.slice(currentIndex + 1),
    ...categoryProjects.slice(0, currentIndex),
  ].slice(0, 4);
  const isMember = viewer.level === "member";
  const isGuest = viewer.level === "guest";

  // 会员专供项目:非会员只见证据层(收入/证据等级/来源链接)+ 各段开头两句
  const memberWall = p.memberOnly && !isMember;
  // 前 50 个(非会员专供)对所有人完整开放 —— 定价页写的是 "The first 50 ideas in full"
  const openToAll = !p.memberOnly && p.rank <= SITE.guestVisibleCount;
  const fullAccess = isMember || openToAll;
  const revenueLedger = REVENUE_LEDGERS[p.slug];

  const deepDive = p.deepDive ?? [];
  // 其余项目:非会员读 01 全文故事;02–05 固定模块给开头两句 + 模糊正文 + 就地解锁;06 以后只露标题。
  const visibleCount = fullAccess ? deepDive.length : memberWall ? 0 : SITE.guestDeepDiveSections;
  const visibleSections = deepDive.slice(0, visibleCount);
  const lockedSections = deepDive.slice(visibleCount);
  const teaserSections = lockedSections.slice(0, Math.max(0, TEASER_THROUGH - visibleCount));
  const titleOnlySections = lockedSections.slice(teaserSections.length);
  const clubOnlyCount = Math.max(0, shelf.total - shelf.open.length);

  // 锁定页下方的"免费读全文"推荐栏:同类优先,再按排名补满 4 个
  const openPicks = fullAccess
    ? []
    : [
        ...shelf.open.filter((o) => o.category === p.category && o.slug !== p.slug),
        ...shelf.open.filter((o) => o.category !== p.category),
      ].slice(0, 4);

  const trs =
    isMember && !memberWall
      ? await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.projectSlug, p.slug))
          .orderBy(asc(transcripts.sourceIndex))
      : [];

  const sourceLinks = (p.sources ?? []).filter((s) => s.video_url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${p.name} — proven AI startup idea breakdown`,
    description: p.tagline,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/projects/${p.slug}`,
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
          {p.memberOnly && <span className="badge-club">Unicorn</span>}
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
              <span className="mono money shrink-0 text-[1.45rem] font-semibold leading-none">{amountOf(p.revenue) ?? "—"}</span>
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

      {!isGuest && !memberWall && (
        <CoreFeatureSignal
          feature={p.memberOnly ? "pro_only_project" : "deep_dive"}
          projectSlug={p.slug}
        />
      )}

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

      {/* 深度拆解 */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="h-sec text-[1.7rem]">Deep dive</h2>
          {!isMember && openToAll && <span className="chip chip-money">Open breakdown · free to read in full</span>}
        </div>
        <div className="mt-5 space-y-4">
          {visibleSections.map((s) => (
            <div key={s.num} id={`section-${s.num}`} className="panel scroll-mt-24 p-6 sm:p-7">
              <h3 className="flex items-baseline gap-3">
                <span className="serif text-[1.6rem] leading-none text-brand/30">{s.num}</span>
                <span className="h-sec text-[1.3rem]">{s.title}</span>
              </h3>
              <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-[1.75] text-t2">
                {s.content}
              </p>
            </div>
          ))}

          {teaserSections.map((s) => (
            <LockedSection key={s.num} num={s.num} title={s.title} content={s.content} slug={p.slug} />
          ))}

          {titleOnlySections.length > 0 && (
            <div className="space-y-2">
              {titleOnlySections.map((s) => (
                <div key={s.num} className="panel flex items-center gap-3 px-5 py-3.5 text-sm text-t3">
                  <LockIcon />
                  <span className="serif text-[1.1rem] leading-none text-t4">{s.num}</span>
                  <span className="min-w-0 truncate font-medium">{s.title}</span>
                </div>
              ))}
            </div>
          )}

          {lockedSections.length > 0 && (
            <JoinCta
              placement={memberWall ? "member_only_idea" : "deep_dive"}
              note={
                memberWall
                  ? `This is a members-only idea. All ${lockedSections.length} sections, the quick-reference card, and both build prompts are in the ${SITE.club.name} — with every section of all ${shelf.total.toLocaleString("en-US")} ideas.`
                  : `The rest of this breakdown — ${lockedSections.length} more ${lockedSections.length === 1 ? "section" : "sections"} — is in the ${SITE.club.name}, with every section of all ${shelf.total.toLocaleString("en-US")} ideas: first customers, first dollar, the flywheel, and the silent stretch.`
              }
              redirectTo={`/projects/${p.slug}`}
            />
          )}

          {!isMember && openToAll && clubOnlyCount > 0 && (
            <JoinCta
              compact
              placement="open_breakdown_end"
              note={`That was one of the ${shelf.open.length} breakdowns open to everyone. The ${SITE.club.name} opens the other ${clubOnlyCount.toLocaleString("en-US")} at the same depth — plus pain-point filters and 10 build specs a week.`}
              redirectTo={`/projects/${p.slug}`}
            />
          )}
        </div>
      </section>

      {/* 锁定页:给还不打算付费的访客一条继续读下去的路 */}
      {openPicks.length > 0 && (
        <aside className="panel mt-6 p-6 sm:p-7" aria-labelledby="open-picks">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="open-picks" className="h-sec">
              Free to read in full
            </h2>
            <span className="text-xs text-t3">Every section open · no account needed</span>
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

      {/* 速览卡 */}
      {p.quickCard && fullAccess && (
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
                <span key={i} className="chip">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}
      {p.quickCard && !fullAccess && (
        <section className="mt-6">
          <JoinCta
            compact
            placement="quick_card"
            note="The quick-reference card — acquisition channels, replication playbook, and risk map — is members-only."
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

      {/* 溯源:证据层(来源链接、证据等级、可信度)对所有人公开;抓取的字幕全文只给会员 */}
      <section className="mt-6">
        <h2 className="h-sec px-1 text-[1.7rem]">Source receipts</h2>
        <p className="mt-2 px-1 text-sm text-t3">
          Every claim traces back to a listed source — open any of them and check the number yourself
          {isMember ? ". Captured video transcripts appear when available" : ""}.
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
              {isMember && trs[i] && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-t3 hover:text-t1">
                    Full transcript ({trs[i].content.length.toLocaleString()} chars, original
                    language)
                  </summary>
                  <div className="mt-2 max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-[0.78rem] leading-relaxed text-t2">
                    {trs[i].content}
                  </div>
                </details>
              )}
            </div>
          ))}
          {(p.sources ?? []).length === 0 && p.credibility && (
            <div className="panel p-5 text-sm text-t3">{p.credibility}</div>
          )}
          {!isMember && (p.sources ?? []).length > 0 && (
            <p className="px-2 text-[0.8rem] leading-relaxed text-t3">
              <LockIcon /> The full captured transcripts behind these sources are in the{" "}
              {SITE.club.name} — search them, quote them, check every figure.{" "}
              <Link
                href={`/pricing?from=${encodeURIComponent(`/projects/${p.slug}`)}`}
                className="link font-medium"
                data-track="join_click"
                data-track-placement="transcripts"
              >
                {SITE.club.cta}
              </Link>
            </p>
          )}
        </div>
        {p.credibility && (p.sources ?? []).length > 0 && (
          <p className="mt-4 px-1 text-[0.74rem] leading-relaxed text-t3">
            Data credibility: {p.credibility}
          </p>
        )}
      </section>

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
                  {!isMember && related.rank <= SITE.guestVisibleCount && (
                    <span className="text-[0.68rem] font-medium text-money">Free · full read</span>
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
