import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { db, projects } from "@/db";
import { asc, eq, sql } from "drizzle-orm";
import ProjectRow from "@/components/ProjectRow";
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
      {/* ═══════ Hero ═══════ */}
      <section className="pt-14 pb-10 sm:pt-20 sm:pb-14">
        <span className="label">Graded, not hyped</span>
        {/* "全部 N 个都在赚钱" 是句谎 —— 有一批条目的字幕里就写着从没上线。
            承诺改成分级本身,那才是这个站真正做到的事。 */}
        <h1 className="h-display mt-4 max-w-2xl">
          <span className="mono grad">{total}</span> startup ideas, ranked by{" "}
          <span className="grad">the receipts behind them</span>.
        </h1>
        <p className="prose-body mt-5 max-w-xl">
          Reverse-engineered from founder interviews and creator breakdowns. Most carry a hard
          revenue figure; the ones that don&apos;t are labelled as such rather than dressed up.
          Every number shows the source it came from — and how much that source is worth.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Link href="/projects" className="btn btn-primary btn-lg">
            Browse all {total}
          </Link>
          <Link href="/how-it-works" className="btn btn-lg">
            How we verify
          </Link>
        </div>

        {/* 统计条。"mapped" 不能省 —— 只有一部分条目的字幕点明了产地,
            光写 "countries" 会读成"总共只覆盖这么多国家" */}
        {/* 分隔线用 gap 露底做,不用 divide-x —— divide-x 按 DOM 顺序发边框,
            2×2 换行时第二行头一格会挂一道悬空的线 */}
        <div
          className={`panel panel-lit mt-10 grid gap-px overflow-hidden bg-line! ${
            countries > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          }`}
        >
          {[
            { v: total, l: "indexed", c: "text-brand" },
            ...(countries >= 5
              ? [{ v: countries, l: "countries mapped", c: "text-ev-creator" }]
              : []),
            { v: stats?.hard ?? 0, l: "third-party data", c: "money" },
            { v: stats?.founder ?? 0, l: "founder-reported", c: "text-ev-founder" },
          ].map((s) => (
            <div key={s.l} className="bg-s1 px-4 py-4 sm:px-6 sm:py-5">
              <div className={`mono text-[1.5rem] font-semibold leading-none sm:text-[1.8rem] ${s.c}`}>
                {s.v}
              </div>
              <div className="mt-1.5 text-[0.72rem] text-t3">{s.l}</div>
            </div>
          ))}
        </div>
        {/* 统计条下面就是筛选:访客用得最多的是"已验证",其次层级、窗口期 —— 陈列给所有人,会员才能用 */}
        <div className="mt-4">
          <FilterPanel base="/projects" filters={{}} isMember={viewer.level === "member"} counts={counts} compact />
        </div>
      </section>

      {/* ═══════ 数据表 ═══════ */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
          <div>
            <span className="label">Highest signal</span>
            <h2 className="h-sec mt-1.5">Tier 1 — lowest barrier, cleanest evidence</h2>
          </div>
          <div className="scroll-x flex items-center gap-4 pb-0.5">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex shrink-0 items-center gap-1.5 text-[0.68rem] text-t3">
                <span className={`ev ${l.cls}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="panel panel-lit overflow-hidden">
          {/* 表头。手机端隐藏 —— 行内已有自己的标注 */}
          <div className="hidden border-b border-line bg-s2 px-5 py-2.5 sm:grid sm:grid-cols-[8.5rem_1fr_auto] sm:gap-x-5">
            <span className="label">Revenue</span>
            <span className="label">Idea</span>
            <span className="label text-right">Category · Evidence · Difficulty</span>
          </div>

          {rows.map((p, i) => (
            <ProjectRow key={p.slug} p={p} locked={false} index={i + 1} />
          ))}

          <Link
            href="/projects"
            className="flex items-center justify-between border-t border-line bg-s2 px-5 py-3.5 text-[0.82rem] text-t2 transition-colors hover:bg-s3 hover:text-t1"
          >
            <span>View all {total} ideas</span>
            <span className="mono text-t4">→</span>
          </Link>
        </div>
      </section>

      {/* ═══════ 方法 ═══════ */}
      <section className="pt-16 sm:pt-20">
        <span className="label">Method</span>
        <h2 className="h-display mt-3 max-w-lg text-[1.45rem] sm:text-[1.9rem]">
          No guesses. Only receipts.
        </h2>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {METHOD.map((m) => (
            <div key={m.n} className="panel panel-lit p-5">
              <span className="mono text-[0.7rem] text-t4">{m.n}</span>
              <h3 className="h-sec mt-3">{m.t}</h3>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-t3">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 仍在发掘 ═══════ */}
      {/* 只显示真实的 created_at 计数。没有新增的周就说"下一批在路上",绝不编一个数。 */}
      <section className="pt-16 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="label">Still digging</span>
            <h2 className="h-display mt-3 max-w-lg text-[1.45rem] sm:text-[1.9rem]">
              The index grows every week.
            </h2>
          </div>
          <div className="flex gap-6 text-[0.8rem] text-t3">
            <span><span className="mono text-t1">{stats?.week ?? 0}</span> added this week</span>
            <span><span className="mono text-t1">{stats?.month ?? 0}</span> in 30 days</span>
          </div>
        </div>
        <p className="prose-body mt-4 max-w-xl">
          We work through founder interviews and creator breakdowns continuously, in weekly batches, aiming at 100–200 new graded ideas a week. Members get an email the moment a batch lands; free accounts get the weekly digest.
        </p>
        <div className="panel panel-lit mt-6 overflow-hidden">
          {latest.map((p) => (
            <Link key={p.slug} href={`/projects/${p.slug}`} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-[0.85rem] last:border-b-0 hover:bg-s2">
              <span className="min-w-0 truncate">
                <span className="mono mr-2 text-t4">{new Date(p.createdAt).toISOString().slice(0, 10)}</span>
                <span className="font-medium text-t1">{p.name}</span>
              </span>
              <span className="shrink-0 text-t3">{p.revenue ? p.revenue.split("·")[0].trim().slice(0, 22) : ""}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ 会员 ═══════ */}
      <section className="pt-16 sm:pt-20">
        <span className="badge-club">{SITE.club.name}</span>
        <h2 className="h-display mt-4 max-w-2xl text-[1.45rem] sm:text-[1.9rem]">
          The first {SITE.guestVisibleCount} are free to read. The {SITE.club.name} opens the other{" "}
          <span className="mono grad">{total - SITE.guestVisibleCount}</span>.
        </h2>
        <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_1.35fr]">
          <div className="panel panel-lit flex flex-col p-6">
            <div className="flex items-baseline gap-2.5">
              <span className="mono text-[2rem] font-semibold leading-none">$0</span>
              <span className="text-[0.8rem] text-t3">reading</span>
            </div>
            <div className="hairline my-5" />
            <ul className="flex flex-col gap-2.5 text-[0.83rem] text-t2">
              {[
                `The first ${SITE.guestVisibleCount} ideas, every section`,
                "The opening story of every other idea",
                "One email a week when new ideas land",
              ].map((f) => (
                <li key={f} className="flex items-baseline gap-2.5">
                  <span className="mt-[1px] h-1 w-1 shrink-0 rounded-full bg-t4" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-in?redirect_url=%2Fprojects" className="btn mt-6 self-start">
              Get the weekly drop
            </Link>
          </div>
          <div className="panel panel-lit panel-club flex flex-col p-6">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="mono text-[2rem] font-semibold leading-none">
                  ${SITE.priceMonthly}
                </span>
                <span className="text-[0.8rem] text-t3">/mo · everything, for founders who ship</span>
              </div>
              <span className="badge-club">Everything</span>
            </div>
            <div className="hairline my-5" />
            <ul className="grid gap-2.5 text-[0.83rem] text-t2 sm:grid-cols-2">
              {SITE.club.perks.map((f) => (
                <li key={f} className="flex items-baseline gap-2.5">
                  <span className="flex h-4 w-4 shrink-0 translate-y-[2px] items-center justify-center rounded-full bg-brand-soft text-[0.6rem] font-bold text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/pricing" className="btn btn-primary btn-lg">
                {SITE.club.cta} — ${SITE.priceMonthly}/mo
              </Link>
              <span className="text-[0.75rem] text-t3">{SITE.club.guarantee}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
