import type { Metadata } from "next";
import { SITE } from "@/lib/site";

/**
 * 取消政策页。URL 沿用 /refunds(外链与 sitemap 已收录,不改路径),但 2026-09-23 起
 * 站长决定全站不承诺退款,所以这里只写"怎么取消、取消后怎样、有问题找谁"。
 */
export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: `How cancelling ${SITE.club.name} membership works.`,
  alternates: { canonical: "/refunds" },
};

const EFFECTIVE = "September 23, 2026";

export default function CancellationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Cancellation Policy</span>
        <h1 className="h-display mt-2 text-[1.5rem] sm:text-[2rem]">Cancellation Policy</h1>
      </div>
      <p className="mt-2 text-sm text-t4">Effective {EFFECTIVE}</p>

      <div className="panel panel-lit mt-4 space-y-6 p-7 text-[0.92rem] leading-relaxed text-t2">
        <section>
          <h2 className="font-semibold">Cancel anytime, in one click</h2>
          <p className="mt-2">
            Go to your account page and open <strong>Manage subscription</strong>. Cancelling stops
            all future charges immediately. You keep member access until the end of the period you have
            already paid for — we do not cut you off mid-month.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">How billing works</h2>
          <p className="mt-2">
            Membership is ${SITE.priceMonthly} per month, billed automatically on the same day each
            month until you cancel. There is no minimum term and no cancellation fee. Payments are
            processed by Stripe; we never see or store your card details.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Something looks wrong on your bill?</h2>
          <p className="mt-2">
            If you see a charge you do not recognise, or member features did not unlock after payment,
            contact us before contacting your bank. We investigate the same day we see your message.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">If we shut down</h2>
          <p className="mt-2">
            If we discontinue the service, we will notify members in advance and stop all billing.
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
