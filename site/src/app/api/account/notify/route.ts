import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { captureError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    await db
      .update(users)
      .set({ notifyNewProjects: body.enabled })
      .where(eq(users.clerkUserId, userId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/account/notify", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
