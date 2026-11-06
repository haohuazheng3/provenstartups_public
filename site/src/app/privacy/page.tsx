import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, and protects your data.`,
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "October 31, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Privacy Policy</span>
        <h1 className="h-display mt-3 text-[1.9rem] sm:text-[2.5rem]">Privacy Policy</h1>
      </div>
      <p className="mt-2 text-sm text-t4">Effective {EFFECTIVE}</p>

      <div className="panel mt-4 space-y-6 p-7 text-[0.92rem] leading-relaxed text-t2">
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
              which ideas people find useful. These stop if you opt out of analytics (see below).
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
            <li>
              <strong>Resend</strong> — delivers the emails we send (member emails and replies to
              contact messages).
            </li>
            <li>
              <strong>FlowGlance</strong> — product analytics. See &ldquo;Analytics and your
              choices&rdquo; below for when it runs and how to turn it off.
            </li>
          </ul>
          <p className="mt-3">
            We do not use Google Analytics, advertising pixels, or data brokers. Besides our own
            first-party usage events, FlowGlance is the only analytics tool on the site.
          </p>
        </section>

        <section id="analytics" className="scroll-mt-24">
          <h2 className="font-semibold">Analytics and your choices</h2>
          <p className="mt-2">
            FlowGlance shows us how people move through the site: pages viewed, clicks, scrolling,
            and where forms are abandoned. It stores a random visitor ID in your browser&apos;s local
            storage. If you are signed in, your visits are linked to your account email so we can
            see where sign-ups and members get stuck. We do not sell this data or use it for
            advertising.
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>In the EU, EEA, UK and Switzerland</strong>, FlowGlance does not load until you
              choose Accept in the banner. Choosing Decline keeps it off.
            </li>
            <li>
              <strong>Everywhere else</strong>, FlowGlance runs by default. To opt out, use the
              &ldquo;Do not track me&rdquo; link in the footer of any page. It saves your choice in a
              cookie for 180 days: FlowGlance no longer loads in that browser and our own usage
              events stop too. The same link turns analytics back on. Blocking scripts or clearing
              site data in your browser also works.
            </li>
          </ul>
          <p className="mt-2">
            To decide which rule applies, we look up your country from your IP address on your
            first visit. We keep only the result (whether the banner applies), not the address.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Cookies</h2>
          <p className="mt-2">
            We set a small number of first-party cookies: authentication session cookies from Clerk;{" "}
            <code className="mono text-[0.82rem]">ps_consent</code>, which remembers your analytics
            choice for 180 days; <code className="mono text-[0.82rem]">ps_region</code>, which
            remembers for 30 days whether the consent banner applies to you; and — if you visit our
            internal exclusion link — a cookie that keeps your visits out of our own analytics.
            FlowGlance and our own usage events keep their random IDs in your browser&apos;s
            storage rather than in cookies. We set no advertising or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Emails we send</h2>
          <p className="mt-2">
            Sign-in codes (sent by Clerk, required for access) and — for members who leave the
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
