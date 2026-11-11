import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, savedFilters } from "@/db";
import { captureError } from "@/lib/errors";
import { describeFilterQuery, normalizeFilterQuery } from "@/lib/list-filters";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** 每人最多保存几个筛选 —— 足够表达兴趣,又不会让周报变成垃圾邮件 */
const MAX_PER_USER = 5;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  const rows = await db
    .select({ id: savedFilters.id, query: savedFilters.query, label: savedFilters.label, createdAt: savedFilters.createdAt })
    .from(savedFilters)
    .where(eq(savedFilters.clerkUserId, userId))
    .orderBy(desc(savedFilters.createdAt));
  return NextResponse.json({ filters: rows });
}

export async function POST(req: NextRequest) {
  try {
    // getViewer 同时负责首次登录落库(users 表),周报要靠那一行拿邮箱
    const viewer = await getViewer();
    if (!viewer.clerkUserId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const query = normalizeFilterQuery(typeof body?.query === "string" ? body.query : "");
    if (!query) return NextResponse.json({ error: "empty_filter" }, { status: 400 });

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(savedFilters)
      .where(eq(savedFilters.clerkUserId, viewer.clerkUserId));
    const [existing] = await db
      .select({ id: savedFilters.id })
      .from(savedFilters)
      .where(and(eq(savedFilters.clerkUserId, viewer.clerkUserId), eq(savedFilters.query, query)))
      .limit(1);
    if (!existing && n >= MAX_PER_USER) {
      return NextResponse.json({ error: "limit", limit: MAX_PER_USER }, { status: 409 });
    }
    const label = describeFilterQuery(query);
    if (!existing) {
      await db.insert(savedFilters).values({ clerkUserId: viewer.clerkUserId, query, label }).onConflictDoNothing();
    }
    return NextResponse.json({ ok: true, query, label, alreadySaved: !!existing });
  } catch (e) {
    await captureError(e, { route: "/api/saved-filters", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await db.delete(savedFilters).where(and(eq(savedFilters.id, id), eq(savedFilters.clerkUserId, userId)));
  return NextResponse.json({ ok: true });
}
