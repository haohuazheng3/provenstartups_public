import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, projects } from "@/db";
import { eq, sql } from "drizzle-orm";
import GoProButton from "@/components/GoProButton";
import { SITE } from "@/lib/site";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Membership",
  description: `${SITE.club.name}: every breakdown, founder playbooks, pain-point filters, and 10 build specs a week — $${SITE.priceMonthly}/mo. First ${SITE.guestVisibleCount} ideas free to read.`,
  alternates: { canonical: "/pricing" },
};

export const revalidate = 300;

/**
 * 俱乐部制定价页(2026-09-22;2026-09-23 改名 Unicorn Club;2026-09-30 换成"纸与墨"的视觉)。
 *
 * 三个月的行为数据定了这一版的写法:到过定价页的 15 个人停留中位 8 秒、0 人点付费按钮,
 * 他们上一步在项目页读到一半 —— 页面却在卖"prompt、字幕、专供"。所以这里只说一件事:
 * 你刚才想读完的那一篇、以及后面几百篇,全部打开;并且把会员能做的事(筛选、构建)
 * 当成"俱乐部权益"摆出来,而不是功能清单。免费账号不再承诺解锁 —— 它只值一封周报。
 *
 * 不写任何用户评价、人数、"加入 xx 位创始人":0 付费的时候写这些就是伪造社会证明。
 */
const FAQ = [
  {
    q: "What do I get the moment I join?",
    a: `All ${"{total}"} breakdowns open at once — every section, the quick-reference card, source receipts and transcripts. The filters and build specs switch on in the same second; access is verified server-side, not by waiting on a webhook.`,
  },
  {
    q: "What are the founder playbooks?",
    a: "Four fixed sections inside every breakdown: how the first customers came from zero, how the first dollar landed, what turned the flywheel, and how the founder got through the stretch with no feedback. Members read all four on every idea.",
  },
  {
    q: "What is a build spec?",
    a: "You pick an idea, tell us your stack, budget and hours per week, and get a tailored end-to-end spec you paste into Claude Code or Codex. Ten a week per member; results are saved to your account.",
  },
  {
    q: "How do I cancel?",
    a: "One click in your account. No email, no retention flow. Access runs to the end of the period you paid for.",
  },
  {
    q: "What stays free?",
    a: `The first ${SITE.guestVisibleCount} ideas in full. For every other idea: the opening story, the first lines of each founder playbook, the revenue figure, its evidence grade, and every source link. Plus the blog. A free account adds email — new ideas each week, or only the ones that match a filter you save.`,
  },
];

/** 里面有什么 —— 四个会员模块,每个一句话说清它替你省掉的事 */
const INSIDE = [
  {
    n: "01",
    t: "Founder playbooks",
    d: "Four fixed sections on every idea: first customers from zero, the first dollar, what turned the flywheel, and the silent stretch.",
  },
  {
    n: "02",
    t: "Pain-point filters",
    d: "Cut the index by evidence, monthly revenue, build effort, path to revenue, customer acquisition, team size, tool and country.",
  },
  {
    n: "03",
    t: "Build desk",
    d: "Pick an idea, give your stack, budget and hours — get a paste-ready spec for Claude Code or Codex. Ten a week.",
  },
  {
    n: "04",
    t: "Receipts and transcripts",
    d: "Every number links to its source — open to everyone. Members also read the captured transcripts behind the claims, not just our summary.",
  },
];

export default async function PricingPage() {
  const [[stats], viewer] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        verified: sql<number>`count(*) filter (where ${projects.evidence} like '✅%')::int`,
        week: sql<number>`count(*) filter (where ${projects.createdAt} > now() - interval '7 days')::int`,
        month: sql<number>`count(*) filter (where ${projects.createdAt} > now() - interval '30 days')::int`,
      })
      .from(projects)
      .where(eq(projects.published, true)),
    getViewer(),
  ]);
  const total = stats?.total ?? 400;
  const verified = stats?.verified ?? 0;
  const month = stats?.month ?? 0;
  const isMember = viewer.level === "member";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE.name} ${SITE.club.name}`,
    description: SITE.club.pitch,
    brand: { "@type": "Organization", name: SITE.name },
    offers: {
      "@type": "Offer",
      price: SITE.priceMonthly.toFixed(2),
      priceCurrency: "USD",
      url: `${SITE.url}/pricing`,
    },
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ═══════ 头部:墨面板,一句话说清楚 ═══════ */}
      <div className="panel-club p-7 sm:p-12">
        <span className="badge-club">{SITE.club.name}</span>
        <h1 className="h-display mt-6 max-w-2xl text-t1">
          Every breakdown, every filter, every build spec. <em>One membership.</em>
        </h1>
        <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-t2">
          The first {SITE.guestVisibleCount} ideas are free to read in full. The {SITE.club.name} opens
          the other <span className="mono text-t1">{(total - SITE.guestVisibleCount).toLocaleString("en-US")}</span> — and every
          section, filter, receipt, and build spec behind them.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Suspense
            fallback={
              <span className="btn btn-lg opacity-60">{SITE.club.cta} — ${SITE.priceMonthly}/mo</span>
            }
          >
            <GoProButton autostart onInk placement="pricing_hero" />
          </Suspense>
          <span className="text-[0.82rem] text-t3">{SITE.club.guarantee}</span>
        </div>
        {/* 数字条:全是真数,从库里读 */}
        <div className="mt-10 grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-3">
          {[
            { v: total.toLocaleString("en-US"), l: "ideas, every one graded" },
            { v: verified.toLocaleString("en-US"), l: "with third-party data" },
            { v: month > 0 ? `+${month}` : "weekly", l: month > 0 ? "added in the last 30 days" : "new ideas land" },
          ].map((s) => (
            <div
              key={s.l}
              className="border-line px-5 py-4 sm:px-6 sm:py-5 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-l"
            >
              <div className="serif grad text-[1.8rem] leading-none sm:text-[2.3rem]">{s.v}</div>
              <div className="label mt-2.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ 里面有什么 ═══════ */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INSIDE.map((m) => (
          <div key={m.t} className="panel flex flex-col p-6">
            <span className="serif text-[1.8rem] leading-none text-brand/30">{m.n}</span>
            <h2 className="h-sec mt-4 text-[1.25rem]">{m.t}</h2>
            <p className="mt-2.5 text-[0.86rem] leading-relaxed text-t2">{m.d}</p>
          </div>
        ))}
      </div>

      {/* ═══════ 两张卡 ═══════ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <div className="panel flex flex-col p-7 sm:p-9">
          <span className="label">Reading, free</span>
          <div className="serif mt-4 text-[3.2rem] leading-none">$0</div>
          <p className="mt-3 text-[0.86rem] text-t3">No account needed to read.</p>
          <div className="hairline my-7" />
          <ul className="flex flex-col gap-3 text-[0.88rem] text-t2">
            {[
              `The first ${SITE.guestVisibleCount} ideas, every section`,
              "The opening story of every other idea, and the first lines of each playbook",
              "Revenue figures, evidence grades, and source links on all of them",
              "New matches for a saved filter, by email every week (free account)",
            ].map((f) => (
              <li key={f} className="flex items-baseline gap-2.5">
                <span className="mt-[1px] h-1 w-1 shrink-0 rounded-full bg-t4" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={viewer.level === "guest" ? "/sign-in?redirect_url=%2Fprojects" : "/projects"}
            className="btn mt-8 self-start"
            data-track={viewer.level === "guest" ? "weekly_drop_click" : undefined}
            data-track-placement="pricing_free_card"
          >
            {viewer.level === "guest" ? "Get the weekly drop" : "Browse ideas"}
          </Link>
        </div>

        <div className="panel-club flex flex-col p-7 sm:p-9">
          <div className="flex items-center gap-2.5">
            <span className="badge-club">{SITE.club.name}</span>
            <span className="chip">Everything</span>
          </div>
          <div className="serif mt-4 text-[3.2rem] leading-none">
            <span className="grad">${SITE.priceMonthly}</span>
            <span className="ml-2 align-middle font-sans text-[1rem] not-italic tracking-normal text-t2">/mo</span>
          </div>
          <p className="mt-3 text-[0.86rem] text-t3">{SITE.club.guarantee}</p>
          <div className="hairline my-7" />
          <ul className="grid gap-3 text-[0.88rem] text-t2">
            {SITE.club.perks.map((f) => (
              <li key={f} className="flex items-baseline gap-2.5">
                <span className="mono translate-y-[1px] text-[0.72rem] text-brand">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 self-start">
            {isMember ? (
              <Link href="/account" className="btn btn-club btn-lg">
                You&apos;re a member — account
              </Link>
            ) : (
              <Suspense
                fallback={
                  <span className="btn btn-lg opacity-60">{SITE.club.cta} — ${SITE.priceMonthly}/mo</span>
                }
              >
                <GoProButton placement="pricing_card" />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ FAQ ═══════ */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FAQ.map((f) => (
          <div key={f.q} className="panel flex flex-col gap-3 p-6">
            <h2 className="h-sec text-[1.2rem]">{f.q}</h2>
            <p className="text-[0.86rem] leading-relaxed text-t2">
              {f.a.replace("{total}", String(total))}
            </p>
          </div>
        ))}
      </div>
      <p className="mono mt-6 px-1 text-[0.72rem] text-t3">Payments run on Stripe — we never see your card.</p>
    </div>
  );
}
