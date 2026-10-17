import Link from "@/components/HoverLink";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { db, projects } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import ProjectRow from "@/components/ProjectRow";
import { ReceiptStack } from "@/components/Receipt";
import { SITE, SOCIAL } from "@/lib/site";
import { countCountries } from "@/lib/country";
import FilterPanel from "@/components/FilterPanel";
import { getViewer } from "@/lib/viewer";
import { loadFilterRows } from "@/lib/filter-rows";
import { filterCounts } from "@/lib/filters";

// 同 /projects:根 layout 的 Header 读 auth,整站动态,revalidate 不生效。
// 首页每次要跑两条查询(12 行 + 一条全表聚合),交给下面的跨请求缓存兜住。
export const revalidate = 300;

/** 首屏数据与访客身份无关。 */
const loadHome = unstable_cache(
  async () =>
    Promise.all([
      db
        .select({
          slug: projects.slug,
          rank: projects.rank,
          tier: projects.tier,
          category: projects.category,
          timing: projects.timing,
          evidence: projects.evidence,
          name: projects.name,
          tagline: projects.tagline,
          revenue: projects.revenue,
          team: projects.team,
          region: projects.region,
          difficultyDots: projects.difficultyDots,
          oneLiner: projects.oneLiner,
          potentialStars: projects.potentialStars,
          memberOnly: projects.memberOnly,
        })
        .from(projects)
        .where(eq(projects.published, true))
        .orderBy(asc(projects.rank))
        .limit(12),
      db
        .select({
          total: sql<number>`count(*)::int`,
          memberOnly: sql<number>`count(*) filter (where ${projects.memberOnly} = true)::int`,
          hard: sql<number>`count(*) filter (where ${projects.evidence} like '✅%')::int`,
          founder: sql<number>`count(*) filter (where ${projects.evidence} like '🗣%')::int`,
          regions: sql<string[]>`coalesce(array_agg(distinct ${projects.region}) filter (where ${projects.region} is not null), '{}')`,
          week: sql<number>`count(*) filter (where ${projects.createdAt} > now() - interval '7 days')::int`,
          month: sql<number>`count(*) filter (where ${projects.createdAt} > now() - interval '30 days')::int`,
        })
        .from(projects)
        .where(eq(projects.published, true)),
      db
        .select({ slug: projects.slug, name: projects.name, revenue: projects.revenue, evidence: projects.evidence, createdAt: projects.createdAt })
        .from(projects)
        .where(eq(projects.published, true))
        .orderBy(sql`${projects.createdAt} desc, ${projects.rank} desc`)
        .limit(6),
    ]),
  ["home-data"],
  { revalidate: 86400, tags: ["projects"] }
);

// 首页此前没有自己的 metadata,继承 layout 时不带 canonical —— 带参数的 URL
// (utm、?ref=)会被当成独立页面。
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** 首页的 Organization + WebSite。其他页有各自的 schema,唯独首页此前是空的。 */
const HOME_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
      description: SITE.description,
      email: SITE.contactEmail,
      // 与 /about 的 Organization 保持同一份 sameAs(来自 lib/site.ts 的 SOCIAL)
      sameAs: SOCIAL.map((s) => s.url),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

const METHOD = [
  {
    n: "01",
    t: "Transcribe everything",
    d: "Founder interviews, creator breakdowns, case studies — captured in full, not skimmed.",
  },
  {
    n: "02",
    t: "Grade the evidence",
    d: "Every figure gets a source class. Cases whose numbers contradict themselves get cut.",
  },
  {
    n: "03",
    t: "Reduce to a playbook",
    d: "Difficulty scores, acquisition channels, and build prompts you paste into Claude Code.",
  },
];

const LEGEND = [
  { cls: "ev-hard", label: "Third-party data" },
  { cls: "ev-founder", label: "Founder-reported" },
  { cls: "ev-creator", label: "Creator-relayed" },
  { cls: "ev-unproven", label: "Unproven" },
];

export default async function Home() {
  const [[rows, [stats], latest], viewer, allRows] = await Promise.all([loadHome(), getViewer(), loadFilterRows()]);
  const counts = filterCounts(allRows);

  const total = stats?.total ?? 260;
  const countries = countCountries(stats?.regions ?? []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_SCHEMA) }}
      />

      {/* ═══════ Hero:一句话 + 三张真实收据 ═══════ */}
      <section className="grid gap-10 pt-12 pb-6 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12 lg:pt-20">
        <div className="rise min-w-0">
          {/* 眉题位置放一颗"正在更新"的药丸:数字是库里真实的 30 天新增;没有新增就退回品牌句 */}
          {(stats?.month ?? 0) > 0 ? (
            <span className="chip chip-live">
              <span className="pulse-dot" aria-hidden />
              <span>
                <span className="font-semibold text-brand">{(stats?.month ?? 0).toLocaleString("en-US")}</span> new
                ideas in the last 30 days
              </span>
            </span>
          ) : (
            <span className="label">Graded, not hyped</span>
          )}
          {/* "全部 N 个都在赚钱" 是句谎 —— 有一批条目的字幕里就写着从没上线。
              承诺改成分级本身,那才是这个站真正做到的事。 */}
          <h1 className="h-display mt-5 max-w-2xl">
            {total.toLocaleString("en-US")} startup ideas, ranked by <em>the receipts behind them.</em>
          </h1>
          <p className="prose-body mt-6 max-w-lg text-[1.05rem]">
            Reverse-engineered from founder interviews and creator breakdowns. Most carry a hard
            revenue figure; the ones that don&apos;t are labelled as such rather than dressed up.
            Every number shows the source it came from — and how much that source is worth.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/projects" className="btn btn-primary btn-lg">
              Browse all {total.toLocaleString("en-US")}
            </Link>
            <Link href="/how-it-works" className="btn btn-lg">
              How we verify
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex shrink-0 items-center gap-1.5 text-[0.72rem] text-t3">
                <span className={`ev ${l.cls}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* min-w-0:grid 子项默认 min-width:auto,横向滑动条会把整列撑到 880px,手机上整页被缩小 */}
        <div className="rise rise-2 min-w-0">
          <ReceiptStack rows={rows} />
        </div>
      </section>

      {/* ═══════ 账本条:全是库里的真数 ═══════ */}
      {/* "mapped" 不能省 —— 只有一部分条目的字幕点明了产地,光写 "countries" 会读成"总共只覆盖这么多国家" */}
      {/* 分隔线用 gap 露底做,不用 divide-x —— 2×2 换行时第二行头一格会挂一道悬空的线 */}
      <section className="pt-6 sm:pt-8">
        <div
          className={`panel grid gap-px overflow-hidden bg-line! ${
            countries > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          }`}
        >
          {[
            { v: total, l: "ideas indexed", c: "grad" },
            ...(countries >= 5 ? [{ v: countries, l: "countries mapped", c: "text-t1" }] : []),
            { v: stats?.hard ?? 0, l: "with third-party data", c: "money" },
            { v: stats?.founder ?? 0, l: "founder-reported", c: "text-t1" },
          ].map((s) => (
            <div key={s.l} className="bg-sheet px-5 py-5 sm:px-6 sm:py-6">
              <div className={`serif text-[2.1rem] leading-none sm:text-[2.5rem] ${s.c}`}>
                {s.v.toLocaleString("en-US")}
              </div>
              <div className="label mt-2.5">{s.l}</div>
            </div>
          ))}
        </div>
        {/* 统计条下面就是筛选:访客用得最多的是"已验证",其次层级、窗口期 —— 陈列给所有人,会员才能用 */}
        <div className="mt-4">
          <FilterPanel base="/projects" filters={{}} isMember={viewer.level === "member"} counts={counts} compact />
        </div>
      </section>

      {/* ═══════ 数据表 ═══════ */}
      <section className="pt-14 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <div>
            <span className="label">Highest signal</span>
            <h2 className="h-sec mt-2">Tier 1 — lowest barrier, cleanest evidence</h2>
          </div>
          <Link href="/projects" className="btn btn-sm">
            All {total.toLocaleString("en-US")} ideas →
          </Link>
        </div>

        <div className="panel overflow-hidden">
          {/* 表头。手机端隐藏 —— 行内已有自己的标注 */}
          <div className="hidden border-b border-line bg-sheet-2 px-5 py-2.5 sm:grid sm:grid-cols-[2.4rem_7.5rem_1fr_auto] sm:gap-x-5">
            <span className="label">№</span>
            <span className="label text-right">Revenue</span>
            <span className="label">Idea</span>
            <span className="label text-right">Category · Evidence · Difficulty · Tier</span>
          </div>

          {rows.map((p, i) => (
            <ProjectRow key={p.slug} p={p} locked={false} index={i + 1} />
          ))}

          <Link
            href="/projects"
            className="flex items-center justify-between border-t border-line bg-sheet-2 px-5 py-3.5 text-[0.84rem] text-t2 transition-colors hover:bg-paper-2 hover:text-t1"
          >
            <span>View all {total.toLocaleString("en-US")} ideas</span>
            <span className="mono text-t4">→</span>
          </Link>
        </div>
      </section>

      {/* ═══════ 方法 ═══════ */}
      <section className="pt-16 sm:pt-24">
        <span className="label">Method</span>
        <h2 className="h-display mt-3 max-w-lg text-[1.8rem] sm:text-[2.3rem]">
          No guesses. <em>Only receipts.</em>
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {METHOD.map((m) => (
            <div key={m.n} className="panel p-6">
              <span className="serif text-[1.9rem] leading-none text-brand/30">{m.n}</span>
              <h3 className="h-sec mt-4 text-[1.3rem]">{m.t}</h3>
              <p className="mt-2.5 text-[0.86rem] leading-relaxed text-t3">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 仍在发掘 ═══════ */}
      {/* 只显示真实的 created_at 计数。没有新增的周就说"下一批在路上",绝不编一个数。 */}
      <section className="pt-16 sm:pt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="label">Still digging</span>
            <h2 className="h-display mt-3 max-w-lg text-[1.8rem] sm:text-[2.3rem]">
              The index grows <em>every week.</em>
            </h2>
          </div>
          <div className="flex gap-6 text-[0.8rem] text-t3">
            <span><span className="mono text-t1">{stats?.week ?? 0}</span> added this week</span>
            <span><span className="mono text-t1">{stats?.month ?? 0}</span> in 30 days</span>
          </div>
        </div>
        <p className="prose-body mt-5 max-w-xl">
          We work through founder interviews and creator breakdowns continuously, in weekly batches, aiming at 100–200 new graded ideas a week. Browse the latest additions here; email alerts are not active yet.
        </p>
        <div className="panel mt-7 overflow-hidden">
          {latest.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 text-[0.88rem] last:border-b-0 hover:bg-sheet-2">
              <span className="min-w-0 truncate">
                <span className="mono mr-3 text-[0.72rem] text-t4">{new Date(p.createdAt).toISOString().slice(0, 10)}</span>
                <span className="font-medium text-t1">{p.name}</span>
              </span>
              <span className="mono money shrink-0 text-[0.82rem]">{p.revenue ? p.revenue.split("·")[0].trim().slice(0, 22) : ""}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ 会员 ═══════ */}
      <section className="pt-16 sm:pt-24">
        <span className="badge-club">{SITE.club.name}</span>
        <h2 className="h-display mt-5 max-w-2xl text-[1.8rem] sm:text-[2.3rem]">
          The first {SITE.guestVisibleCount} are free to read. The {SITE.club.name} opens{" "}
          <em>the other {(total - SITE.guestVisibleCount).toLocaleString("en-US")}.</em>
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <div className="panel flex flex-col p-7">
            <div className="flex items-baseline gap-2.5">
              <span className="serif text-[2.6rem] leading-none">$0</span>
              <span className="text-[0.82rem] text-t3">reading, no account needed</span>
            </div>
            <div className="hairline my-6" />
            <ul className="flex flex-col gap-3 text-[0.86rem] text-t2">
              {[
                `The first ${SITE.guestVisibleCount} ideas, every section`,
                "The opening story of every other idea, plus every source link",
                "Save up to 5 filters in a free account; email alerts are not active yet",
              ].map((f) => (
                <li key={f} className="flex items-baseline gap-2.5">
                  <span className="mt-[1px] h-1 w-1 shrink-0 rounded-full bg-t4" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-in?redirect_url=%2Fprojects" className="btn mt-7 self-start" data-track="weekly_drop_click" data-track-placement="home_free_card">
              Save filters — free
            </Link>
          </div>
          <div className="panel-club flex flex-col p-7">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="serif grad text-[2.6rem] leading-none">${SITE.priceMonthly}</span>
                <span className="text-[0.82rem] text-t2">/mo · everything, for founders who ship</span>
              </div>
              <span className="badge-club">Everything</span>
            </div>
            <div className="hairline my-6" />
            <ul className="grid gap-3 text-[0.86rem] text-t2 sm:grid-cols-2">
              {SITE.club.perks.map((f) => (
                <li key={f} className="flex items-baseline gap-2.5">
                  <span className="mono translate-y-[1px] text-[0.7rem] text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/pricing" className="btn btn-club btn-lg" data-track="join_click" data-track-placement="home_club_card">
                {SITE.club.cta} — ${SITE.priceMonthly}/mo
              </Link>
              <span className="text-[0.78rem] text-t3">{SITE.club.guarantee}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
