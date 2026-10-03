import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/viewer";
import { db, errorEvents } from "@/db";
import { eq } from "drizzle-orm";
import { captureError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    // 两种鉴权:管理员 Clerk 会话,或 ADMIN_TOKEN(运维/CI)
    const token = req.headers.get("x-admin-token");
    const tokenOk = !!token && token === process.env.ADMIN_TOKEN;
    if (!tokenOk) {
      const viewer = await getViewer();
      if (!viewer.isAdmin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    // {id} 清单条;{all:true} 清全部(仅 token 路径,用于运维清测试数据)
    if (body?.all === true && tokenOk) {
      await db.update(errorEvents).set({ resolved: true });
      return NextResponse.json({ ok: true, resolved: "all" });
    }
    if (typeof body?.id !== "number") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    await db.update(errorEvents).set({ resolved: true }).where(eq(errorEvents.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/admin/resolve-error", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
