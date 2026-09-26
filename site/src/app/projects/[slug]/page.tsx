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
import BuildSpec from "@/components/BuildSpec";
import CopyButton from "@/components/CopyButton";
import CoreFeatureSignal from "@/components/CoreFeatureSignal";

// 这一页读 auth(付费墙按访客身份分支),所以它必然是动态渲染 ——
// revalidate 在这里不起作用,别指望用它省数据库。省的办法在下面的 getProject。
export const revalidate = 0;

/**
 * 只取页面真正用到的列。**这不是为了省字节** —— 实测未用的那 7 列
 * (id/rank/published/origin/notifiedAt/createdAt/updatedAt) 都是小字段,
 * 裁掉它们对 15KB 的整行几乎没有影响。写出来是为了让"这一页依赖哪些数据"
 * 一眼可见,以后往表里加大字段时不会被无声地拖进每一次查询。
 */
const COLUMNS = {
  slug: projects.slug,
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
  ["project-detail"],
  { revalidate: 86400, tags: ["projects"] }
);

const getProject = cache(loadProject);

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
  ["public-projects-by-category"],
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
  const [p, viewer] = await Promise.all([getProject(slug), getViewer()]);
  if (!p) notFound();

  const categoryProjects = await loadCategoryProjects(p.category);
  const currentIndex = categoryProjects.findIndex((candidate) => candidate.slug === p.slug);
  const relatedProjects = [
    ...categoryProjects.slice(currentIndex + 1),
    ...categoryProjects.slice(0, currentIndex),
  ].slice(0, 4);
  const isMember = viewer.level === "member";
  const isGuest = viewer.level === "guest";

  // 会员专供项目:非会员只见头部 + 升级卡
  const memberWall = p.memberOnly && !isMember;
  const revenueLedger = REVENUE_LEDGERS[p.slug];

  const deepDive = p.deepDive ?? [];
  // 俱乐部制:非会员(游客与免费账号)只读 01 全文故事;02–05 固定模块与其后全部只对会员开放。
  const visibleSections = memberWall
    ? []
    : isMember
      ? deepDive
      : deepDive.slice(0, SITE.guestDeepDiveSections);
  const hiddenSections = deepDive.slice(visibleSections.length);

  const trs =
    isMember && !memberWall
      ? await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.projectSlug, p.slug))
          .orderBy(asc(transcripts.sourceIndex))
      : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${p.name} — proven AI startup idea breakdown`,
    description: p.tagline,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/projects/${p.slug}`,
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

      <header className="mt-5">
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

        <h1 className="h-display mt-4">{p.name}</h1>
        <p className="prose-body mt-3 max-w-2xl">{p.tagline}</p>
      </header>

      {/* 关键数字做成数据条 */}
      <div className="panel panel-lit mt-6 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        <div className="border-b border-line px-4 py-3.5 sm:border-b-0">
          <div className="label">Revenue</div>
          <div className="mono money mt-1.5 text-[1.15rem] font-semibold">{amountOf(p.revenue) ?? "—"}</div>
        </div>
        <div className="border-b border-line border-l border-l-line px-4 py-3.5 sm:border-b-0 sm:border-l-0">
          <div className="label">Team</div>
          <div
            className="mt-1.5 line-clamp-2 text-[0.86rem] leading-snug"
            title={p.team ?? undefined}
          >
            {p.team ?? "—"}
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="label">Difficulty</div>
          <div className="mt-2">
            <Dots n={p.difficultyDots} />
          </div>
        </div>
        <div className="border-l border-line px-4 py-3.5 sm:border-l-0">
          <div className="label">Upside</div>
          <div className="mt-2">
            <Stars n={p.potentialStars} />
          </div>
        </div>
      </div>

      {p.revenue && p.revenue.split("·").length > 1 && (
        <p className="mt-3 px-1 text-[0.78rem] leading-relaxed text-t3">
          {p.revenue.split("·").slice(1).join(" · ").trim()}
        </p>
      )}

      {revenueLedger && (
        <section className="panel panel-lit mt-6 overflow-hidden" aria-labelledby="revenue-ledger">
          <div className="border-b border-line px-5 py-4 sm:flex sm:items-end sm:justify-between sm:gap-4">
            <div>
              <span className="eyebrow">Revenue evidence ledger</span>
              <h2 id="revenue-ledger" className="mt-1 text-lg font-semibold tracking-tight">
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
                      className="mt-1.5 inline-flex text-xs font-medium text-t1 underline underline-offset-2"
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
          <p className="border-t border-line bg-s2/60 px-5 py-4 text-xs leading-relaxed text-t3">
            {revenueLedger.note}
          </p>
        </section>
      )}

      {p.oneLiner && (
        <div className="mt-6 border-l-2 border-line-2 pl-4 text-[0.89rem] leading-relaxed text-t2">
          {p.oneLiner}
        </div>
      )}

      {memberWall ? (
        <div className="mt-6">
          <JoinCta note="This idea is members-only — full breakdown, revenue receipts, playbook, and build prompts." />
        </div>
      ) : (
        <>
          {!isGuest && (
            <CoreFeatureSignal
              feature={p.memberOnly ? "pro_only_project" : "deep_dive"}
              projectSlug={p.slug}
            />
          )}
          {/* 五维评分 */}
          <section className="panel panel-lit mt-5 p-7">
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
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Deep dive</h2>
            <div className="mt-4 space-y-4">
              {visibleSections.map((s) => (
                <div key={s.num} className="panel panel-lit p-6">
                  <h3 className="font-bold">
                    <span className="mr-2 text-t1">{s.num}</span>
                    {s.title}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-[0.89rem] leading-[1.78] text-t2">
                    {s.content}
                  </p>
                </div>
              ))}

              {hiddenSections.length > 0 && (
                <>
                  <div className="space-y-2">
                    {hiddenSections.map((s) => (
                      <div key={s.num} className="panel panel-lit flex items-center gap-3 p-4 text-sm text-t4">
                        
                        <span className="font-semibold text-t3">{s.num}</span>
                        <span className="font-medium">{s.title}</span>
                      </div>
                    ))}
                  </div>
                  <JoinCta
                    note={`${hiddenSections.length} more ${hiddenSections.length === 1 ? "section" : "sections"} — how the first customers came, how the first dollar landed, what turned the flywheel, and how they got through the silent stretch. Members read all of it.`}
                    redirectTo={`/projects/${p.slug}`}
                  />
                </>
              )}
            </div>
          </section>

          {/* 速览卡 */}
          {p.quickCard && isMember && (
            <section className="panel panel-lit mt-6 space-y-5 p-6">
              <h2 className="text-[1.05rem] font-semibold tracking-[-0.025em]">Quick reference</h2>
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
                <div className="panel panel-lit !rounded-xl bg-s3/60 p-4">
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
          {!isMember && !memberWall && (
            <section className="mt-6">
              <JoinCta
                compact
                note="The quick-reference card — acquisition channels, replication playbook, and risk map — is members-only."
                redirectTo={`/projects/${p.slug}`}
              />
            </section>
          )}

          {/* Build prompts:会员专属 */}
          <section className="mt-6">
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Build prompts</h2>
            <p className="mt-1 px-2 text-sm text-t3">
              Paste into Claude Code / Codex and get a working version of this product end-to-end.
            </p>
            {isMember && (
              <div className="mt-4">
                <BuildSpec slug={p.slug} name={p.name} />
              </div>
            )}
            {isMember && p.buildPrompt ? (
              <div className="mt-4 space-y-4">
                <div className="panel panel-lit p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="h-sec">End-to-end build prompt</h3>
                    <CopyButton text={p.buildPrompt} />
                  </div>
                  <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.8rem] leading-relaxed text-t2">
                    {p.buildPrompt}
                  </pre>
                </div>
                {p.seoPrompt && (
                  <div className="panel panel-lit p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="h-sec">SEO growth prompt</h3>
                      <CopyButton text={p.seoPrompt} />
                    </div>
                    <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.8rem] leading-relaxed text-t2">
                      {p.seoPrompt}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <JoinCta compact note="Two production-grade prompts per idea — a full build spec and an SEO growth plan — plus 10 tailored build specs a week. Members only." />
              </div>
            )}
          </section>

          {/* 溯源 */}
          <section className="mt-6">
            <h2 className="px-1 text-[1.25rem] font-semibold tracking-[-0.03em]">Source receipts</h2>
            <p className="mt-1 px-2 text-sm text-t3">
              Every claim traces back to a listed source
              {isMember ? " — captured video transcripts appear when available" : ""}.
            </p>
            <div className="mt-4 space-y-4">
              {(p.sources ?? []).map((s, i) => (
                <div key={i} className="panel panel-lit p-5">
                  <div className="text-[0.7rem] text-t4">
                    {s.platform} {s.views ? `· ~${s.views} views` : ""}{" "}
                    {s.fetched ? `· captured ${s.fetched}` : ""}
                  </div>
                  <div className={`mt-1 font-semibold ${!isMember ? "locked" : ""}`}>
                    {s.video_title}
                  </div>
                  {s.video_subtitle && (
                    <div className={`mt-0.5 text-xs text-t3 ${!isMember ? "locked" : ""}`}>
                      {s.video_subtitle}
                    </div>
                  )}
                  {isMember && s.video_url && (
                    <a
                      href={s.video_url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="btn mt-3 !px-4 !py-1.5 !text-[0.8rem]"
                    >
                      Open source
                    </a>
                  )}
                  {isMember && trs[i] && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-t3 hover:text-t1">
                        Full transcript ({trs[i].content.length.toLocaleString()} chars, original
                        language)
                      </summary>
                      <div className="mt-2 max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.78rem] leading-relaxed text-t2">
                        {trs[i].content}
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {(p.sources ?? []).length === 0 && p.credibility && (
                <div className="panel panel-lit p-5 text-sm text-t3">{p.credibility}</div>
              )}
              {!isMember && (
                <JoinCta
                  compact
                  note="Source links and the full captured transcripts — the raw material behind every number — are members-only."
                  redirectTo={`/projects/${p.slug}`}
                />
              )}
            </div>
            {p.credibility && (p.sources ?? []).length > 0 && (
              <p className="mt-4 px-2 text-[0.7rem] leading-relaxed text-t4">
                Data credibility: {p.credibility}
              </p>
            )}
          </section>
        </>
      )}

      {relatedProjects.length > 0 && (
        <aside className="panel panel-lit mt-8 p-6" aria-labelledby="related-ideas">
          <h2 id="related-ideas" className="text-lg font-semibold tracking-tight">
            More proven ideas in {p.category}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedProjects.map((related) => (
              <Link
                key={related.slug}
                href={`/projects/${related.slug}`}
                className="rounded-xl border border-line bg-s2 p-4 hover:border-line-2"
              >
                <span className="block font-semibold">{related.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-t3">
                  {related.tagline}
                </span>
                {related.revenue && (
                  <span className="mono mt-2 block text-xs font-semibold text-money">
                    {amountOf(related.revenue) ?? related.revenue}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link href="/projects" className="text-sm text-t1 hover:underline">
          ← All ideas
        </Link>
        <Link href="/" className="text-sm text-t4 hover:text-t2">
          Home
        </Link>
      </div>
    </div>
  );
}
