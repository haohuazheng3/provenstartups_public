import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, events, users } from "@/db";
import { eq } from "drizzle-orm";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== "string" || body.name.length > 60) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const { userId } = await auth();
    let isSelf = req.cookies.get("ps_exclude")?.value === "1";
    if (!isSelf && userId) {
      const u = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
      if (u[0]?.email?.toLowerCase() === SITE.adminEmail) isSelf = true;
    }

    await db.insert(events).values({
      sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
      clerkUserId: userId,
      name: body.name,
      path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 300) : null,
      utm: body.utm && typeof body.utm === "object" ? body.utm : null,
      props: body.props && typeof body.props === "object" ? body.props : null,
      isSelf,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/track", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
