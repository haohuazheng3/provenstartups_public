import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe, BRAND } from "@/lib/stripe";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";

// 账号先于支付:未登录一律 401,前端引导先登录再自动回跳
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const rows = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
    const user = rows[0];
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 400 });

    if (user.plan === "member") {
      return NextResponse.json({ error: "already_member" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    // The fixed QA identity is used by e2e/member.spec.ts in production.
    // Keep any Checkout sessions it creates visibly excluded just like the
    // admin's marked runs; ordinary customers cannot opt themselves out.
    const email = user.email.toLowerCase();
    const testRun = email === SITE.adminEmail || email === "qa-club@provenstartups.com";
    const metadata = {
      clerkUserId: userId,
      site: SITE.domain,
      ...(testRun ? { test_run: "true", exclude_from_conversion: "true" } : {}),
    };
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      client_reference_id: userId,
      subscription_data: { metadata },
      metadata,
      allow_promotion_codes: true,
      // 收款方品牌一致(防"这是谁在扣我钱"):Checkout 顶部显示品牌名,
      // 账单描述符后缀也用品牌名。品牌由后端白名单硬编码,前端无法传入。
      branding_settings: { display_name: BRAND.displayName },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
    } as Stripe.Checkout.SessionCreateParams);

    return NextResponse.json({ url: session.url });
  } catch (e) {
    await captureError(e, { route: "/api/stripe/checkout", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
