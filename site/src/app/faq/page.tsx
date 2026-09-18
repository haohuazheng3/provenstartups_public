import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Common questions about ${SITE.name}: how ideas are verified, what Pro includes, billing, and data sources.`,
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    q: "Are these startup ideas actually verified?",
    a: "Each idea carries an evidence label. ✅ Verified means third-party data (app-store estimates, public filings, tracked revenue). 🗣 Founder-reported means the founder said it on camera. 📎 Creator-reported means an analyst or creator estimated it. 🔮 High potential means unproven — our judgment that the pattern could work, clearly marked as such. We never present a claim as harder than it is.",
  },
  {
    q: "Where does the data come from?",
    a: "Public videos: founder interviews, indie-hacker breakdowns, and case-study content. Every breakdown links to its source video and, for Pro members, includes the full captured transcript so you can verify any claim yourself.",
  },
  {
    q: "What exactly do I get for free?",
    a: "A free account unlocks every idea in the directory: full deep dives, replication playbooks, acquisition channels, difficulty and upside scores, and links to the source videos. No trial timer.",
  },
  {
    q: "What does Pro add?",
    a: "Two production-grade prompts per idea (a complete build spec and an SEO growth plan you can paste into Claude Code or Codex), the full captured source transcripts, Pro-exclusive ideas that never appear publicly, and email alerts when new proven ideas drop.",
  },
  {
    q: "Why are some ideas Pro-exclusive?",
    a: "The freshest window-of-opportunity ideas lose value the moment thousands of people see them. Those go to Pro members only.",
  },
  {
    q: "How often do you add new ideas?",
    a: "Continuously, as we work through new interviews and breakdowns. Pro members with alerts enabled get an email the day an idea is published.",
  },
  {
    q: "Can I cancel? Do you refund?",
    a: "Cancel in one click from your account page — future charges stop immediately and you keep access through the period you paid for. First payment is fully refundable within 7 days, no questions asked.",
  },
  {
    q: "Do I need a password?",
    a: "No. You enter your email, we send a one-time code, you're in. Same flow whether it's your first visit or your hundredth — no separate sign-up and sign-in to think about.",
  },
  {
    q: "Are the revenue numbers audited?",
    a: "No, and we say so on every page. These are founder statements, creator estimates, or third-party approximations. Treat them as directional evidence that a market exists, not as guaranteed outcomes.",
  },
  {
    q: "Is this business advice?",
    a: "No. It's editorial research. Starting a business carries real risk of losing money. Use these breakdowns as inputs to your own judgment.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pt-1 pb-5">
        <span className="label">FAQ</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">FAQ</h1>
      </div>
      <div className="mt-6 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="panel panel-lit group p-5">
            <summary className="cursor-pointer list-none pr-6 font-semibold">
              {f.q}
              <span className="float-right text-t4 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-t2">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/contact" className="btn">
          Still have a question?
        </Link>
      </div>
    </div>
  );
}
