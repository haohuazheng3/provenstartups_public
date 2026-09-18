import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { applySubscription } from "@/lib/membership";
import { captureError } from "@/lib/errors";

export const metadata = { title: "Welcome to Pro", robots: { index: false } };
export const dynamic = "force-dynamic";

// 主路径:回跳后立即拿 session_id 向 Stripe 核验并当场解锁,绝不干等 webhook
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const { userId } = await auth();
  if (!session_id) redirect("/pricing");
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/checkout/success?session_id=${session_id}`)}`);

  let ok = false;
  try {
    const session = await stripe().checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });
    const sessionUser = session.client_reference_id || session.metadata?.clerkUserId;
    if (
      sessionUser === userId &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required") &&
      session.subscription
    ) {
      const sub =
        typeof session.subscription === "string"
          ? await stripe().subscriptions.retrieve(session.subscription)
          : session.subscription;
      await applySubscription(userId, sub, session.customer as string);
      ok = true;
    }
  } catch (e) {
    await captureError(e, { route: "/checkout/success", side: "server" });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pt-10 sm:pt-16 text-center">
      {ok ? (
        <div className="panel panel-lit flex w-full flex-col items-center gap-4 p-10">
          <span className="text-4xl">🎉</span>
          <h1 className="text-2xl font-semibold">You&apos;re Pro now</h1>
          <p className="text-sm text-t3">
            Build prompts, full transcripts, and Pro-exclusive ideas are unlocked.
          </p>
          <Link href="/projects" className="btn btn-primary mt-2">
            Browse ideas
          </Link>
        </div>
      ) : (
        <div className="panel panel-lit flex w-full flex-col items-center gap-4 p-10">
          <span className="text-4xl">⏳</span>
          <h1 className="text-2xl font-semibold">Payment received — finalizing…</h1>
          <p className="text-sm text-t3">
            Your membership is being activated. This usually takes a few seconds — refresh this
            page. If it doesn&apos;t activate within a minute, contact us and we&apos;ll fix it
            immediately.
          </p>
          <Link href="/account" className="btn mt-2">
            Check account status
          </Link>
        </div>
      )}
    </div>
  );
}
