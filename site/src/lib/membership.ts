import { db, users, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

/** 依据 Stripe 订阅状态写权益(webhook 与 success 主动核验共用;实时读写不缓存) */
export async function applySubscription(
  clerkUserId: string,
  sub: Stripe.Subscription,
  stripeCustomerId?: string | null
) {
  const active = sub.status === "active" || sub.status === "trialing";
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  await db
    .insert(subscriptions)
    .values({
      clerkUserId,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: { status: sub.status, currentPeriodEnd: periodEnd, updatedAt: new Date() },
    });

  await db
    .update(users)
    .set({
      plan: active ? "member" : "free",
      // 取消/过期后权益保留到周期末
      memberUntil: active ? periodEnd : periodEnd && periodEnd > new Date() ? periodEnd : null,
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
    })
    .where(eq(users.clerkUserId, clerkUserId));
}
