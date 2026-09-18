import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, and protects your data.`,
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "July 24, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Privacy Policy</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">Privacy Policy</h1>
      </div>
      <p className="mt-2 text-sm text-t4">Effective {EFFECTIVE}</p>

      <div className="panel panel-lit mt-4 space-y-6 p-7 text-[0.92rem] leading-relaxed text-t2">
        <section>
          <h2 className="font-semibold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Your email address</strong> — the only personal detail we ask for. We do not
              collect names, passwords, or phone numbers.
            </li>
            <li>
              <strong>Usage events</strong> — pages viewed, buttons clicked, and referral source,
              stored with a random session identifier in our own database. We use this to understand
              which ideas people find useful.
            </li>
            <li>
              <strong>Payment records</strong> — if you subscribe, we store your Stripe customer ID
              and subscription status. We never see or store your card number.
            </li>
            <li>
              <strong>Contact form submissions</strong> — your email and message, so we can reply.
            </li>
            <li>
              <strong>Error reports</strong> — when something breaks, we log the error type, a stack
              excerpt, and the page it happened on.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Third-party services we actually use</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Clerk</strong> — authentication. Stores your email and sends your one-time
              sign-in codes.
            </li>
            <li>
              <strong>Stripe</strong> — payment processing for Pro subscriptions. Card data goes
              directly to Stripe and never touches our servers.
            </li>
            <li>
              <strong>Neon</strong> — our PostgreSQL database (hosted in the United States).
            </li>
            <li>
              <strong>Vercel</strong> — application hosting and server logs.
            </li>
            <li>
              <strong>Cloudflare</strong> — DNS, email routing for our contact address, and object
              storage.
            </li>
          </ul>
          <p className="mt-3">
            We do not use Google Analytics, advertising pixels, or any third-party tracking or
            data-broker service. Analytics are first-party and stay in our own database.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Cookies</h2>
          <p className="mt-2">
            We use only essential cookies: authentication session cookies set by Clerk, and — if you
            visit our internal exclusion link — a cookie that keeps your visits out of our own
            analytics. We set no advertising or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Emails we send</h2>
          <p className="mt-2">
            Sign-in codes (sent by Clerk, required for access) and — for Pro members who leave the
            setting on — notifications when new ideas are published. You can turn new-idea alerts
            off any time on your account page.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">How long we keep it</h2>
          <p className="mt-2">
            Account and billing records are kept while your account exists and for as long as
            required for tax and accounting purposes. Analytics events are retained for 24 months.
            Error logs are retained for 12 months.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Your rights</h2>
          <p className="mt-2">
            Email <a className="text-t1 underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>{" "}
            to access, export, correct, or delete your data. We respond within 30 days. Deleting
            your account removes your email, event history, and subscription records, except where
            we are legally required to retain financial records.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Children</h2>
          <p className="mt-2">
            This service is not directed at children under 16, and we do not knowingly collect their
            data.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Changes</h2>
          <p className="mt-2">
            If we make a material change, we will update the effective date above and notify
            registered users by email.
          </p>
        </section>
      </div>
    </div>
  );
}
