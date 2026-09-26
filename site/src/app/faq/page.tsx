import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Common questions about ${SITE.name}: how ideas are verified, what membership includes, billing, and data sources.`,
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    q: "Are these startup ideas actually verified?",
    a: "Each idea carries an evidence label. ✅ Verified means third-party data (app-store estimates, public filings, tracked revenue). 🗣 Founder-reported means the founder said it on camera. 📎 Creator-reported means an analyst or creator estimated it. 🔮 High potential means unproven — our judgment that the pattern could work, clearly marked as such. We never present a claim as harder than it is.",
  },
  {
    q: "Where does the data come from?",
    a: "Public videos: founder interviews, indie-hacker breakdowns, and case-study content. Every breakdown links to its source video and, for Members, includes the full captured transcript so you can verify any claim yourself.",
  },
  {
    q: "What exactly do I get for free?",
    a: `The first ${SITE.guestVisibleCount} ideas are free to read in full, and the opening story of every other idea is open too. Membership ($${SITE.priceMonthly}/mo) opens everything else: every section, the founder playbooks, the quick-reference cards, source receipts and transcripts, the pain-point filters, and 10 tailored build specs a week. A free account adds one thing — an email when new ideas land.`,
  },
  {
    q: "What does membership add?",
    a: `Everything past the first ${SITE.guestVisibleCount} ideas: every section of every breakdown, the four founder playbooks, the quick-reference cards, source receipts and transcripts, the pain-point filters on the index, and 10 tailored build specs a week you paste into Claude Code or Codex.`,
  },
  {
    q: "Why are most ideas members-only?",
    a: "Because the breakdowns are the product. Reading how a founder got their first customers, first dollar, and through the silent stretch is worth more than a headline number — and the freshest window-of-opportunity ideas lose value the moment thousands of people see them. The first fifty stay open so you can judge the work before you pay.",
  },
  {
    q: "How often do you add new ideas?",
    a: "Continuously, as we work through new interviews and breakdowns. Anyone with a free account and alerts on gets an email the day an idea is published.",
  },
  {
    q: "Can I cancel?",
    a: "Cancel in one click from your account page — future charges stop immediately and you keep access through the period you paid for.",
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
