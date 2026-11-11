import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { captureError } from "@/lib/errors";
import { normalizeInputs, quotaFor, runBuild } from "@/lib/builds";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 会员构建。GET 返回配额;POST 生成。真实权益按 users.plan 判,站长(admin)也放行以便验收。 */
async function member() {
  const { userId } = await auth();
  if (!userId) return { userId: null, ok: false };
  const [u] = await db.select({ plan: users.plan, memberUntil: users.memberUntil, isAdmin: users.isAdmin }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const active = !!u && (u.plan === "member" && (!u.memberUntil || u.memberUntil > new Date()) || u.isAdmin);
  return { userId, ok: active };
}

export async function GET() {
  console.log("[prerender-trace] src/app/api/build/route.ts");
  const m = await member();
  if (!m.userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  if (!m.ok) return NextResponse.json({ error: "members_only" }, { status: 403 });
  return NextResponse.json({ quota: await quotaFor(m.userId) });
}

export async function POST(req: NextRequest) {
  const m = await member();
  if (!m.userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  if (!m.ok) return NextResponse.json({ error: "members_only" }, { status: 403 });
  try {
    const body = await req.json().catch(() => null);
    const slug = typeof body?.slug === "string" && /^[a-z0-9-]{3,120}$/.test(body.slug) ? body.slug : null;
    const inputs = normalizeInputs(body ?? {});
    if (!slug || !inputs) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    const r = await runBuild(m.userId, slug, inputs);
    if ("error" in r) return NextResponse.json(r, { status: r.error === "quota" ? 429 : r.error === "empty" ? 502 : 404 });
    return NextResponse.json({ ...r, quota: await quotaFor(m.userId) });
  } catch (e) {
    await captureError(e, { route: "/api/build", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
