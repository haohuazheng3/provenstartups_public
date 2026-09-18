import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, projects } from "@/db";
import { eq, sql } from "drizzle-orm";
import GoProButton from "@/components/GoProButton";
import { SITE } from "@/lib/site";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free account unlocks every non-exclusive idea breakdown. Pro ($${SITE.priceMonthly}/mo) adds build prompts, full transcripts, exclusive ideas, and email alerts.`,
  alternates: { canonical: "/pricing" },
};

export const revalidate = 300;

const FREE = [
  "Full deep dives, every section",
  "Quick-reference playbooks",
  "Difficulty & upside scores",
  "Source video links",
];

const PRO = [
  "Everything in Free",
  "Build prompts — paste into Claude Code and ship",
  "SEO growth prompts for every idea",
  "Full captured source transcripts",
  "Email alerts when new ideas drop",
];

const FAQ = [
  {
    q: "What happens after I pay?",
    a: "Access unlocks the moment you land back on the site — the payment is verified server-side rather than waiting on a webhook.",
  },
  {
    q: "How do I cancel?",
    a: "One click in your account. No email, no retention flow. Access runs to the end of the period you paid for.",
  },
  {
    q: "Refunds?",
    a: "Your first payment is fully refundable within 7 days. Email us and it's done — no reason required.",
  },
];

export default async function PricingPage() {
  const [[stats], viewer] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        memberOnly: sql<number>`count(*) filter (where ${projects.memberOnly} = true)::int`,
      })
      .from(projects)
      .where(eq(projects.published, true)),
    getViewer(),
  ]);

  const total = stats?.total ?? 260;
  const memberOnly = stats?.memberOnly ?? 0;
  const freeTotal = total - memberOnly;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE.name} Pro`,
    description:
      "Full access to build prompts, source transcripts, and Pro-exclusive startup ideas.",
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

      {/* 标题装进模块 —— 裸放在背景上跟全站语言不一致 */}
      <div className="panel panel-lit p-6 sm:p-8">
        <span className="label">Pricing</span>
        <h1 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.04em] sm:text-[2.3rem]">
          Free to browse. Pro to build.
        </h1>
        <p className="mt-3 max-w-md text-[0.92rem] leading-relaxed text-t2">
          Free members can read {freeTotal} breakdowns; the remaining {memberOnly} are Pro-only.
          Pro also adds the material for actually shipping one.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="panel panel-lit flex flex-col p-6 sm:p-8">
          <span className="label">Free account</span>
          <div className="num mt-3.5 text-[2.6rem] font-semibold leading-none">$0</div>
          <p className="mt-3 text-[0.84rem] text-t3">Email code only. No password.</p>

          <div className="hairline my-6" />

          <ul className="flex flex-col gap-3 text-[0.86rem] text-t2">
            {[`All ${freeTotal} free idea breakdowns`, ...FREE].map((f) => (
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
            {viewer.level === "guest" ? "Create account" : "Browse all ideas"}
          </Link>
        </div>

        {/* Pro 走墨色 —— 与首页一致 */}
        <div className="panel-2 panel-lit flex flex-col p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <span className="label !text-t2">Pro</span>
            <span className="chip chip-solid">Most useful</span>
          </div>
          <div className="num mt-3.5 text-[2.6rem] font-semibold leading-none">
            ${SITE.priceMonthly}
            <span className="ml-1.5 align-middle text-[1rem] font-normal text-t2">/mo</span>
          </div>
          <p className="mt-3 text-[0.84rem] text-t2">Cancel anytime · 7-day refund</p>

          <div className="my-6 h-px bg-line" />

          <ul className="grid gap-3 text-[0.86rem] text-t2 sm:grid-cols-2">
            {[...PRO.slice(0, 4), `${memberOnly} Pro-only ideas`, ...PRO.slice(4)].map((f) => (
              <li key={f} className="flex items-baseline gap-2.5">
                <span className="mt-[1px] h-1 w-1 shrink-0 rounded-full bg-t4" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-7 self-start">
            <Suspense
              fallback={
                <span className="btn btn opacity-60">Go Pro — ${SITE.priceMonthly}/mo</span>
              }
            >
              <GoProButton autostart onInk />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {FAQ.map((f) => (
          <div key={f.q} className="panel panel-lit flex flex-col gap-3 p-6">
            <h2 className="text-[0.94rem] font-semibold tracking-[-0.02em]">{f.q}</h2>
            <p className="text-[0.84rem] leading-relaxed text-t2">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 px-1 text-[0.78rem] text-t4">
        Payments run on Stripe — we never see your card.{" "}
        <Link href="/refunds" className="text-t1 hover:text-t1">
          Refund policy
        </Link>
      </p>
    </div>
  );
}
