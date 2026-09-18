import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "How cancellations and refunds work for Pro subscriptions.",
  alternates: { canonical: "/refunds" },
};

const EFFECTIVE = "July 24, 2026";

export default function RefundsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Refund &amp; Cancellation Policy</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">Refund &amp; Cancellation Policy</h1>
      </div>
      <p className="mt-2 text-sm text-t4">Effective {EFFECTIVE}</p>

      <div className="panel panel-lit mt-4 space-y-6 p-7 text-[0.92rem] leading-relaxed text-t2">
        <section>
          <h2 className="font-semibold">Cancel anytime, in one click</h2>
          <p className="mt-2">
            Go to your account page and open <strong>Manage subscription</strong>. Cancelling stops
            all future charges immediately. You keep Pro access until the end of the period you have
            already paid for — we do not cut you off mid-month.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">7-day refund on your first payment</h2>
          <p className="mt-2">
            If Pro isn&apos;t what you expected, email us within <strong>7 days</strong> of your
            first payment and we will refund it in full. No form to fill out, no reason required.
            Refunds go back to your original payment method and typically appear within 5–10
            business days depending on your bank.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Renewal charges</h2>
          <p className="mt-2">
            Monthly renewals are generally non-refundable, because you can cancel at any time before
            a renewal date. That said, if you were charged for a month you clearly did not use — for
            example you forgot to cancel and never signed in — email us and we will make it right.
            We would rather refund you than have you dispute a charge.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Billing errors and service failures</h2>
          <p className="mt-2">
            Duplicate charges, an unexpected amount, or Pro features failing to unlock after payment
            are always refunded in full once verified. Contact us and we will investigate the same
            day we see your message.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">If we shut down</h2>
          <p className="mt-2">
            If we discontinue the service, we refund the unused portion of every active subscription.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">How to reach us</h2>
          <p className="mt-2">
            Email{" "}
            <a className="text-t1 underline" href={`mailto:${SITE.contactEmail}`}>
              {SITE.contactEmail}
            </a>{" "}
            from the address on your account. We reply within 2 business days.
          </p>
        </section>
      </div>
    </div>
  );
}
