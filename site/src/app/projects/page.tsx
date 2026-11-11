import type { Metadata } from "next";
import Link from "@/components/HoverLink";
import { Suspense } from "react";
import { loadFilterRows } from "@/lib/filter-rows";

import ProjectRow, { type RowProject } from "@/components/ProjectRow";
import { getViewer } from "@/lib/viewer";
import FilterPanel from "@/components/FilterPanel";
import SaveFilterButton from "@/components/SaveFilterButton";
import SavedFilterAutoSave from "@/components/SavedFilterAutoSave";
import { readFilters, applyFilters, countActive, filterCounts } from "@/lib/filters";
import {
  STRIP_EVIDENCE,
  STRIP_TIERS,
  STRIP_TIMING,
  applyStripFilters,
  describeFilterQuery,
  normalizeFilterQuery,
} from "@/lib/list-filters";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Startup Ideas With Revenue Evidence",
  description:
    "Compare proven startup ideas by revenue, evidence quality, difficulty, timing, and category — with source receipts behind every claim.",
  alternates: { canonical: "/projects" },
};

// 根 layout 的 Header 读 auth,所以每个路由都是动态渲染 —— revalidate 在这里
// 不生效(实测 x-vercel-cache 恒为 MISS)。真正省数据库的是下面 loadRows 的
// 跨请求缓存:这一页每次要拉全部 406 行(约 67KB),而爬虫会反复来。
export const revalidate = 300;

/** 列表数据与访客身份无关,按 slug 之外的东西不变,可以放心跨请求缓存。 */
const loadRows = loadFilterRows;

// 免费筛选条的取值与判定在 lib/list-filters.ts —— "保存筛选"和每周匹配邮件用的是同一套
const TIERS = STRIP_TIERS;
const EVIDENCE = STRIP_EVIDENCE;
const TIMING = STRIP_TIMING;

const COLLECTIONS = {
  "claude-code-guide": {
    title: "Claude Code revenue cases",
    description:
      "The nine cases compared in our Claude Code guide, kept in the same order so you can inspect each revenue claim, evidence grade, and full breakdown.",
    slugs: [
      "aeo-service",
      "loic-creator",
      "cursor",
      "app-factory",
      "ai-directory-site",
      "payout-class-action-app",
      "claude-code-seo-local-service",
      "ai-venture-studio",
      "subscribr-yt-scriptwriter",
    ],
  },
} as const;

type SP = {
  [extra: string]: string | undefined;
  tier?: string;
  evidence?: string;
  timing?: string;
  category?: string;
  collection?: string;
  ref?: string;
};

function projectsHref(sp: SP) {
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, val]) => val) as [string, string][]
  ).toString();
  return qs ? `/projects?${qs}` : "/projects";
}

function filterHref(sp: SP, k: keyof SP, v: string) {
  const next: SP = { ...sp };
  if (next[k] === v) delete next[k];
  else next[k] = v;
  return projectsHref(next);
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const viewer = await getViewer();

  const all = await loadRows();

  const categories = Array.from(new Set(all.map((p) => p.category))).sort();
  const collection =
    sp.collection && sp.collection in COLLECTIONS
      ? COLLECTIONS[sp.collection as keyof typeof COLLECTIONS]
      : null;

  const projectsBySlug = collection ? new Map(all.map((p) => [p.slug, p])) : null;
  let list = collection
    ? collection.slugs.flatMap((slug) => {
        const project = projectsBySlug?.get(slug);
        return project ? [project] : [];
      })
    : all;
  list = applyStripFilters(list, sp);
  // ?sort=new:按入库先后倒排(新项目 rank 最大)。The Drop 邮件里"本期其余 N 个"链到这里
  const newestFirst = sp.sort === "new";
  if (newestFirst) list = [...list].sort((a, b) => b.rank - a.rank);
  const isMember = viewer.level === "member";
  // 非会员能读的开放项目:按 rank 前 SITE.guestVisibleCount 个(all 已按 rank 升序),和当前排序/筛选无关
  const openSlugs = new Set(all.slice(0, SITE.guestVisibleCount).map((p) => p.slug));
  // 会员筛选(URL 参数),非会员忽略参数 —— 面板对他们只是陈列
  const memberFilters = isMember ? readFilters(sp as Record<string, string | undefined>) : {};
  if (countActive(memberFilters)) list = applyFilters(list, memberFilters);
  const hasFilter = !!(sp.tier || sp.evidence || sp.timing || sp.category) || countActive(memberFilters) > 0;

  // 非会员带着俱乐部筛选进来(保存筛选后登录回跳、别人分享的链接):不筛列表,但告诉他这个筛选命中多少
  const clubOnly = isMember ? {} : readFilters(sp as Record<string, string | undefined>);
  for (const k of ["evidence", "tier", "timing"] as const) delete clubOnly[k]; // 这三个免费筛选条已经生效
  const clubOnlyActive = countActive(clubOnly) > 0;
  const clubOnlyMatches = clubOnlyActive ? applyFilters(list, clubOnly).length : 0;

  // "保存这个筛选":规范化后的查询串(免费筛选条 + 痛点筛选),没有筛选时不出现。
  // 结果区的文案只描述真正作用在列表上的那部分(非会员 = 免费筛选条)。
  const saveQuery = normalizeFilterQuery(sp as Record<string, string | undefined>);
  const appliedLabel = describeFilterQuery(
    normalizeFilterQuery(
      isMember ? (sp as Record<string, string | undefined>) : { tier: sp.tier, evidence: sp.evidence, timing: sp.timing, category: sp.category }
    )
  );

  // 两层墙(2026-11-11):非会员只开放前 20 个,其余是锁定行;详情页里 02–05 对所有非会员都锁。
  // 改版前 8 位会员里 5 位是在目录页看到"只开放一部分、其余锁着"后付的 —— 这一层就是那块货架。
  // 锁定行只露 6 行预览(模糊),剩下的折成结尾的一句话,不把 1,000 多行模糊行全渲染出来。
  // 合集页(博客"Compare the N cited cases"链过来的)不截断:文章里点名的案例一个不少,锁定的照样是锁定行。
  const lockedForViewer = (p: RowProject) => !isMember && !openSlugs.has(p.slug);
  let lockedPreviewCount = 0;
  const displayedList = isMember || collection
    ? list
    : list.filter((p) => {
        if (!lockedForViewer(p)) return true;
        if (lockedPreviewCount >= 6) return false;
        lockedPreviewCount += 1;
        return true;
      });
  const hiddenCount = list.length - displayedList.length;
  const openCount = isMember ? list.length : list.filter((p) => !lockedForViewer(p)).length;
  const clubCount = list.length - openCount;
  const clubTotal = Math.max(0, all.length - SITE.guestVisibleCount);
  const currentProjectsHref = projectsHref(sp);
  const joinHref = `/pricing?from=${encodeURIComponent(currentProjectsHref)}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* ═══════ 页头 ═══════ */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-9 pb-5 sm:pt-12">
        <div className="max-w-3xl">
          <span className="label">Index</span>
          <h1 className="h-display mt-3 text-[1.9rem] sm:text-[2.5rem]">
            {collection ? (
              <>
                {list.length} {collection.title}
              </>
            ) : hasFilter ? (
              <>
                {list.length} <em>of {all.length.toLocaleString("en-US")}</em> ideas
              </>
            ) : (
              <>
                {all.length.toLocaleString("en-US")} startup ideas <em>with revenue receipts</em>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-[0.9rem] leading-relaxed text-t3">
            {collection
              ? collection.description
              : "Compare revenue, evidence quality, difficulty, timing, and category before opening the full breakdown and source receipts."}
          </p>
          {!isMember && (
            <p className="mt-2 max-w-2xl text-[0.84rem] leading-relaxed text-t3">
              <span className="font-medium text-t1">The top {SITE.guestVisibleCount} are open to read.</span> The other{" "}
              <span className="mono text-t1">{clubTotal.toLocaleString("en-US")}</span> open with the {SITE.club.name}.
            </p>
          )}
        </div>
        {/* 带着俱乐部筛选进来时,下面的提示条自带这两个按钮,页头不再重复一遍 */}
        {!clubOnlyActive && (
          <div className="flex flex-wrap items-start gap-2.5">
            {hasFilter && saveQuery && (
              <SaveFilterButton query={saveQuery} placement="index_header" {...(isMember ? { text: "Save this filter" } : {})} />
            )}
            {!isMember && (
              <Link href={joinHref} className="btn btn-club" data-track="join_click" data-track-placement="index_header">
                {SITE.club.cta} — ${SITE.priceMonthly}/mo
              </Link>
            )}
            {/* 2026-10-11 首个会员用自动化逐页读完 1,004 个项目 —— 给会员的 AI 一条更省事的路 */}
            {isMember && (
              <Link
                href={newestFirst ? projectsHref({ ...sp, sort: undefined }) : projectsHref({ ...sp, sort: "new" })}
                className={`btn ${newestFirst ? "chip-on" : ""}`}
                data-track="sort_new_click"
              >
                {newestFirst ? "✓ Newest first" : "Newest first"}
              </Link>
            )}
            {isMember && (
              <Link href="/account#export" className="btn" data-track="export_nav_click" data-track-placement="index_header">
                Export for your AI
              </Link>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <SavedFilterAutoSave />
      </Suspense>

      {clubOnlyActive && (
        <div className="panel-club mb-3 flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className="max-w-2xl text-[0.88rem] leading-relaxed text-t2">
            <span className="serif text-[1.1rem] text-brand">{describeFilterQuery(normalizeFilterQuery(clubOnly as Record<string, string>))}</span>{" "}
            matches <span className="mono text-t1">{clubOnlyMatches}</span>{" "}
            {hasFilter ? `of these ${list.length} ideas` : "ideas in the index"}. Pain-point filters are a{" "}
            {SITE.club.name} feature — members see the filtered list; everyone can save this filter for later. Email alerts are not active yet.
          </p>
          <div className="flex flex-wrap items-start gap-2.5">
            <SaveFilterButton query={saveQuery} placement="club_filter_notice" />
            <Link href={joinHref} className="btn btn-club" data-track="join_click" data-track-placement="club_filter_notice">
              {SITE.club.cta} — ${SITE.priceMonthly}/mo
            </Link>
          </div>
        </div>
      )}

      {/* ═══════ 会员筛选面板 ═══════ */}
      <div className="mb-3">
        <FilterPanel base="/projects" filters={memberFilters} isMember={isMember} resultCount={list.length} counts={filterCounts(all)} />
      </div>
      {/* ═══════ 筛选条 ═══════ */}
      <div className="panel mb-3 flex items-center gap-2 overflow-visible px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="label shrink-0 pr-1">Tier</span>
          {TIERS.map((t) => (
            <Link
              key={t.key}
              href={filterHref(sp, "tier", t.key)}
              className={`chip mono shrink-0 ${sp.tier === t.key ? "chip-on" : ""}`}
            >
              {t.label}
            </Link>
          ))}

          <span className="mx-1 h-4 w-px shrink-0 bg-line" />
          <span className="label shrink-0 pr-1">Evidence</span>
          {EVIDENCE.map((e) => (
            <Link
              key={e.key}
              href={filterHref(sp, "evidence", e.key)}
              className={`chip shrink-0 ${sp.evidence === e.key ? "chip-on" : ""}`}
            >
              <span className={`ev ${e.cls}`} />
              {e.label}
            </Link>
          ))}

          <span className="mx-1 hidden h-4 w-px shrink-0 bg-line sm:block" />
          {TIMING.map((t) => (
            <Link
              key={t.key}
              href={filterHref(sp, "timing", t.key)}
              className={`chip hidden shrink-0 sm:inline-flex ${
                sp.timing === t.key ? "chip-on" : ""
              }`}
            >
              {t.label}
            </Link>
          ))}

          {hasFilter && (
            <Link
              href={
                collection
                  ? projectsHref({ collection: sp.collection, ref: sp.ref })
                  : "/projects"
              }
              className="chip shrink-0 text-t3"
            >
              Clear
            </Link>
          )}
        </div>

        <details className="relative shrink-0">
          <summary className={`chip cursor-pointer list-none ${sp.category ? "chip-on" : ""}`}>
            {sp.category ?? "Category"} ↓
          </summary>
          <div className="panel absolute right-0 top-8 z-30 flex max-h-80 w-56 flex-col gap-1 overflow-y-auto p-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={filterHref(sp, "category", c)}
                className={`chip ${sp.category === c ? "chip-on" : ""}`}
              >
                {c}
              </Link>
            ))}
          </div>
        </details>
      </div>

      {/* ═══════ 数据表 ═══════ */}
      <div className="panel overflow-hidden">
        <div className="hidden border-b border-line bg-sheet-2 px-5 py-2.5 sm:grid sm:grid-cols-[2.4rem_7.5rem_1fr_auto] sm:gap-x-5">
          <span className="label">№</span>
          <span className="label text-right">Revenue</span>
          <span className="label">Idea</span>
          <span className="label text-right">Category · Evidence · Difficulty · Tier</span>
        </div>

        {displayedList.map((p, i) => (
          <ProjectRow
            key={p.slug}
            p={p}
            index={i + 1}
            locked={lockedForViewer(p)}
            lockedLabel={`${p.name} — preview. The full breakdown is in the ${SITE.club.name}`}
          />
        ))}

        {list.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-[0.86rem] text-t3">Nothing matches those filters.</p>
            <Link href="/projects" className="btn">
              Clear filters
            </Link>
          </div>
        )}
      </div>

      {/* ═══════ 结果底部:按当前筛选说话 ═══════ */}
      {!isMember && list.length > 0 && (
        <div className="panel-club mt-3 px-5 py-6 sm:px-7">
          {hasFilter ? (
            <>
              <p className="serif text-[1.5rem] leading-[1.15] text-t1">
                {clubCount > 0 ? (
                  <>
                    {clubCount} more {clubCount === 1 ? "idea matches" : "ideas match"} <em>{appliedLabel}</em> in the {SITE.club.name}
                  </>
                ) : (
                  <>
                    {list.length} {list.length === 1 ? "idea matches" : "ideas match"} <em>{appliedLabel}</em>
                  </>
                )}
              </p>
              <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-t2">
                {clubCount > 0
                  ? `${openCount} of the ${list.length} matches are open to read. Members open the rest, and the four founder playbooks on every one — ${SITE.club.lockedSectionsLabel}.`
                  : `All ${list.length} are among the open ideas. Members also read the four founder playbooks on each — ${SITE.club.lockedSectionsLabel} — plus the pain-point filters and the quick-reference cards.`}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Link href={joinHref} className="btn btn-club" data-track="join_click" data-track-placement="index_results_end">
                  {SITE.club.cta} — ${SITE.priceMonthly}/mo
                </Link>
                {saveQuery && <SaveFilterButton query={saveQuery} placement="index_results_end" />}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-[0.88rem] leading-relaxed text-t2">
                {hiddenCount > 0
                  ? `Showing the ${openCount} open ideas plus ${lockedPreviewCount} previews. ${hiddenCount.toLocaleString("en-US")} more ideas — every section of every breakdown, the founder playbooks, the filters and the build specs — open with membership. ${SITE.club.guarantee}.`
                  : `The ${SITE.club.name} opens every idea in full, including the four founder playbooks — ${SITE.club.lockedSectionsLabel} — plus pain-point filters, quick-reference cards and 10 build specs a week. ${SITE.club.guarantee}.`}
              </p>
              <Link href={joinHref} className="btn btn-club" data-track="join_click" data-track-placement="index_results_end">
                {SITE.club.cta} — ${SITE.priceMonthly}/mo
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
