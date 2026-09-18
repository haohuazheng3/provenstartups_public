import type { Metadata } from "next";
import Link from "next/link";
import { SITE, SOCIAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `What ${SITE.name} is, how we verify startup ideas, and why receipts matter.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon.svg`,
    email: SITE.contactEmail,
    description: SITE.description,
    // 官方账号。sameAs 让 Google 把这些账号与本域绑成同一实体 —— 这些外链是
    // nofollow 的,价值不在权重而在实体确认。
    sameAs: SOCIAL.map((s) => s.url),
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pt-1 pb-5">
        <span className="label">About</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">About</h1>
      </div>

      <div className="panel panel-lit mt-4 space-y-4 p-7 text-[0.95rem] leading-relaxed text-t2">
        <p>
          Most &quot;startup idea&quot; lists are guesses. Someone brainstorms fifty things that
          sound plausible, publishes them, and you have no way to know if a single one ever made a
          dollar.
        </p>
        <p>
          <strong>{SITE.name} only publishes ideas that come with receipts.</strong> We dig through
          founder interviews, creator breakdowns, and case studies — hundreds of hours of video —
          transcribe them, and reverse-engineer what actually worked: the revenue, the team size,
          the acquisition channels, the pricing, the mistakes.
        </p>
        <p>
          Every idea is labeled with its evidence level, from ✅ third-party-verified data down to
          🔮 unverified potential. We&apos;d rather tell you &quot;this one is founder-claimed, not
          audited&quot; than pretend everything is equally solid. The source video and captured
          transcript are attached to every breakdown, so you can check our work.
        </p>
        <p>
          The goal: when you pick your next project, you start from something a real person already
          proved — then niche down, ship faster, and skip the graveyard of ideas nobody wanted.
        </p>
      </div>

      <div className="panel panel-lit mt-5 flex flex-wrap items-center justify-between gap-3 p-6">
        <p className="text-sm text-t3">Questions? We answer within 2 business days.</p>
        <Link href="/contact" className="btn">
          Contact us
        </Link>
      </div>
    </div>
  );
}
