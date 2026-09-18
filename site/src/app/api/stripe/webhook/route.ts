import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, stripeEvents } from "@/db";
import { stripe } from "@/lib/stripe";
import { applySubscription } from "@/lib/membership";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";
import type Stripe from "stripe";

/**
 * 兜底路径:验签 → 认领(是不是本站的事件) → 幂等 → 写权益;处理失败撤回幂等行让重试生效。
 *
 * 两个坑(上线审计实测命中,别改回去):
 * 1. Stripe 的 webhook endpoint 是**账户级**的。这个 Stripe 账户下挂了十几个站,
 *    每个端点都会收到全账户的事件 —— 本站幂等表里就躺着 site=pairfoundry.com 的
 *    事件、client_reference_id 是别站的 Clerk 用户 ID。不认领就可能拿别站的用户 ID
 *    往本站写权益。当时没出事只是因为兄弟站用的是 mode:payment,subscription 为空。
 * 2. 先落幂等再处理业务时,处理失败必须把幂等行撤回。否则返 500 让 Stripe 重试,
 *    重试却命中幂等直接 deduped —— 权益永久丢失,兜底路径形同虚设。
 */

/** 这条事件是不是本站的。优先认 metadata.site,回退认价格 ID。 */
function ownsEvent(obj: Stripe.Checkout.Session | Stripe.Subscription): boolean {
  const site = obj.metadata?.site;
  if (site) return site === SITE.domain;

  // 没打 site 标记的老事件 —— 用本站价格 ID 兜底认领
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return false;
  if ("items" in obj) {
    return (obj.items?.data ?? []).some((i) => i.price?.id === priceId);
  }
  return false;
}

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(req: NextRequest) {
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "no_signature" }, { status: 400 });
    const raw = await req.text();
    event = await stripe().webhooks.constructEventAsync(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    // 验签失败也入收件箱,但路由标 :verify —— health 不因扫描器探测而置红
    await captureError(e, { route: "/api/stripe/webhook:verify", side: "server" });
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  // ── 认领:不处理的类型、以及别站的事件,直接 200 放行且不占幂等表 ──
  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ ok: true, ignored: "type" });
  }
  const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
  if (!ownsEvent(obj)) {
    return NextResponse.json({ ok: true, ignored: "other_site" });
  }

  // ── 幂等:同一 event.id 只处理一次 ──
  const inserted = await db
    .insert(stripeEvents)
    .values({ eventId: event.id, type: event.type })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId =
          session.client_reference_id || session.metadata?.clerkUserId;
        if (clerkUserId && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(
            session.subscription as string
          );
          await applySubscription(clerkUserId, sub, session.customer as string);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (clerkUserId) {
          await applySubscription(clerkUserId, sub, sub.customer as string);
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // 撤回幂等行,否则 Stripe 重试会被 dedup 吞掉 → 权益永久丢失
    try {
      await db.delete(stripeEvents).where(eq(stripeEvents.eventId, event.id));
    } catch (rollbackErr) {
      await captureError(rollbackErr, {
        route: "/api/stripe/webhook:rollback",
        side: "server",
        extra: { eventId: event.id },
      });
    }
    await captureError(e, {
      route: "/api/stripe/webhook",
      side: "server",
      extra: { eventType: event.type, eventId: event.id },
    });
    // 500 让 Stripe 重试(幂等行已撤回,重试能真正重放)
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
