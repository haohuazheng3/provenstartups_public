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
 * 俱乐部制定价页(2026-09-22;2026-09-23 改名 Unicorn Club 并做高端化)。
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
    a: `The first ${SITE.guestVisibleCount} ideas in full, the opening story of every other idea, and the blog. A free account adds one thing: an email when new ideas land each week.`,
  },
];

/** 里面有什么 —— 四个会员模块,每个一句话说清它替你省掉的事 */
const INSIDE = [
  {
    t: "Founder playbooks",
    d: "Four fixed sections on every idea: first customers from zero, the first dollar, what turned the flywheel, and the silent stretch.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5h12a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3z" />
        <path d="M4 5v17M9 10h6M9 14h4" />
      </svg>
    ),
  },
  {
    t: "Pain-point filters",
    d: "Cut the index by evidence, monthly revenue, build effort, path to revenue, customer acquisition, team size, tool and country.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
    ),
  },
  {
    t: "Build desk",
    d: "Pick an idea, give your stack, budget and hours — get a paste-ready spec for Claude Code or Codex. Ten a week.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" />
      </svg>
    ),
  },
  {
    t: "Receipts and transcripts",
    d: "Every number links to its source. Members read the captured transcripts behind the claims, not just our summary.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v4h4M9 12h6M9 16h6" />
      </svg>
    ),
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

      {/* ═══════ 头部:一句话说清楚 ═══════ */}
      <div className="panel panel-lit panel-club p-7 sm:p-10">
        <span className="badge-club">{SITE.club.name}</span>
        <h1 className="h-display mt-5 max-w-2xl">
          {SITE.club.pitch}
        </h1>
        <p className="prose-body mt-5 max-w-xl">
          The first {SITE.guestVisibleCount} ideas are free to read in full. The {SITE.club.name} opens
          the other <span className="mono text-t1">{total - SITE.guestVisibleCount}</span> — and every
          section, filter, receipt, and build spec behind them.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Suspense
            fallback={
              <span className="btn btn-lg opacity-60">{SITE.club.cta} — ${SITE.priceMonthly}/mo</span>
            }
          >
            <GoProButton autostart onInk />
          </Suspense>
          <span className="text-[0.8rem] text-t3">{SITE.club.guarantee}</span>
        </div>
        {/* 数字条:全是真数,从库里读 */}
        <div className="panel panel-lit mt-8 grid grid-cols-3 gap-px overflow-hidden bg-line!">
          {[
            { v: total, l: "ideas, every one graded", c: "text-brand" },
            { v: verified, l: "with third-party data", c: "money" },
            { v: month > 0 ? `+${month}` : "weekly", l: month > 0 ? "added in the last 30 days" : "new ideas land", c: "text-ev-creator" },
          ].map((s) => (
            <div key={s.l} className="bg-s1 px-4 py-4 sm:px-6">
              <div className={`mono text-[1.4rem] font-semibold leading-none sm:text-[1.7rem] ${s.c}`}>{s.v}</div>
              <div className="mt-1.5 text-[0.7rem] text-t3">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ 里面有什么 ═══════ */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INSIDE.map((m) => (
          <div key={m.t} className="panel panel-lit flex flex-col gap-3 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {m.icon}
            </span>
            <h2 className="text-[0.94rem] font-semibold tracking-[-0.02em]">{m.t}</h2>
            <p className="text-[0.82rem] leading-relaxed text-t2">{m.d}</p>
          </div>
        ))}
      </div>

      {/* ═══════ 两张卡 ═══════ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <div className="panel panel-lit flex flex-col p-6 sm:p-8">
          <span className="label">Reading, free</span>
          <div className="mono mt-3.5 text-[2.6rem] font-semibold leading-none">$0</div>
          <p className="mt-3 text-[0.84rem] text-t3">No account needed to read.</p>
          <div className="hairline my-6" />
          <ul className="flex flex-col gap-3 text-[0.86rem] text-t2">
            {[
              `The first ${SITE.guestVisibleCount} ideas, every section`,
              "The opening story of every other idea",
              "Revenue figures and evidence grades on all of them",
              "One email a week when new ideas land (free account)",
            ].map((f) => (
              <li key={f} className="flex items-baseline gap-2.5">
                <span className="mt-[1px] h-1 w-1 shrink-0 rounded-full bg-t4" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={viewer.level === "guest" ? "/sign-in?redirect_url=%2Fprojects" : "/projects"}
            className="btn mt-7 self-start"
          >
            {viewer.level === "guest" ? "Get the weekly drop" : "Browse ideas"}
          </Link>
        </div>

        <div className="panel panel-lit panel-club flex flex-col p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <span className="badge-club">{SITE.club.name}</span>
            <span className="chip">Everything</span>
          </div>
          <div className="mono mt-3.5 text-[2.6rem] font-semibold leading-none">
            ${SITE.priceMonthly}
            <span className="ml-1.5 align-middle font-sans text-[1rem] font-normal tracking-normal text-t3">/mo</span>
          </div>
          <p className="mt-3 text-[0.84rem] text-t3">{SITE.club.guarantee}</p>
          <div className="hairline my-6" />
          <ul className="grid gap-3 text-[0.86rem] text-t2">
            {SITE.club.perks.map((f) => (
              <li key={f} className="flex items-baseline gap-2.5">
                <span className="flex h-4 w-4 shrink-0 translate-y-[2px] items-center justify-center rounded-full bg-brand-soft text-[0.6rem] font-bold text-brand">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-7 self-start">
            {isMember ? (
              <Link href="/account" className="btn btn-primary btn-lg">
                You&apos;re a member — account
              </Link>
            ) : (
              <Suspense
                fallback={
                  <span className="btn btn-lg opacity-60">{SITE.club.cta} — ${SITE.priceMonthly}/mo</span>
                }
              >
                <GoProButton />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ FAQ ═══════ */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FAQ.map((f) => (
          <div key={f.q} className="panel panel-lit flex flex-col gap-3 p-6">
            <h2 className="text-[0.94rem] font-semibold tracking-[-0.02em]">{f.q}</h2>
            <p className="text-[0.84rem] leading-relaxed text-t2">
              {f.a.replace("{total}", String(total))}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 px-1 text-[0.78rem] text-t4">Payments run on Stripe — we never see your card.</p>
    </div>
  );
}
