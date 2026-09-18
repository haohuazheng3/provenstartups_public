import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that govern your use of ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

const EFFECTIVE = "July 24, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Terms of Service</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">Terms of Service</h1>
      </div>
      <p className="mt-2 text-sm text-t4">Effective {EFFECTIVE}</p>

      <div className="panel panel-lit mt-4 space-y-6 p-7 text-[0.92rem] leading-relaxed text-t2">
        <section>
          <h2 className="font-semibold">1. What this service is</h2>
          <p className="mt-2">
            {SITE.name} is an editorial research directory. We analyse publicly available videos,
            interviews, and case studies and publish our summaries, scores, and commentary. Access
            is provided as-is for informational purposes.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">2. No business or investment advice</h2>
          <p className="mt-2">
            Nothing here is business, financial, legal, or investment advice. Revenue figures are
            reported by founders or third-party creators and are labeled with their evidence level;
            we do not audit them and cannot guarantee their accuracy. Starting a business involves
            risk of loss. Your decisions are your own.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">3. Accounts</h2>
          <p className="mt-2">
            You need a valid email address to create an account. You are responsible for keeping
            access to that inbox secure, since sign-in codes are sent there. One account per person.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">4. Pro subscriptions</h2>
          <p className="mt-2">
            Pro costs ${SITE.priceMonthly} per month, billed automatically until cancelled. You can
            cancel at any time from your account page; access continues until the end of the paid
            period. Prices may change with at least 30 days&apos; notice to existing subscribers.
            See our Refund Policy for refund terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">5. Acceptable use</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Scrape, bulk-download, or republish our breakdowns, scores, or prompts.</li>
            <li>Share your account or resell access.</li>
            <li>Attempt to bypass paywalls, rate limits, or authentication.</li>
            <li>Use the service to build a competing directory of our content.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">6. Intellectual property</h2>
          <p className="mt-2">
            Our written breakdowns, scoring system, prompts, and site design belong to {SITE.name}.
            Source videos and transcripts remain the property of their original creators; we link to
            originals and quote them for commentary and analysis. Product and company names
            mentioned belong to their respective owners.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">7. Availability</h2>
          <p className="mt-2">
            We aim for continuous availability but do not guarantee uninterrupted service. We may
            change, suspend, or discontinue features. If we discontinue the service entirely, we
            will refund the unused portion of any active subscription.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">8. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, {SITE.name} is not liable for indirect,
            incidental, or consequential damages, or for lost profits or business opportunities.
            Our total liability is limited to the amount you paid us in the 12 months before the
            claim.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">9. Termination</h2>
          <p className="mt-2">
            We may suspend or terminate accounts that violate these terms. You may delete your
            account at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">10. Contact</h2>
          <p className="mt-2">
            Questions about these terms:{" "}
            <a className="text-t1 underline" href={`mailto:${SITE.contactEmail}`}>
              {SITE.contactEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
