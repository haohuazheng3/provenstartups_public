import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { captureError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });

    const rows = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
    const user = rows[0];
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "no_customer" }, { status: 400 });
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.nextUrl.origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    await captureError(e, { route: "/api/stripe/portal", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
