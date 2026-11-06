import { NextRequest, NextResponse } from "next/server";
import { db, events } from "@/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { getViewer } from "@/lib/viewer";
import { captureError } from "@/lib/errors";
import {
  EXPORT_CONTENT_TYPE,
  EXPORT_DAILY_CAP,
  EXPORT_FORMATS,
  type ExportFormat,
  exportFilename,
  exportStream,
  licenseIdFor,
} from "@/lib/library-export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 会员库导出。GET /api/export?format=md|json|csv —— 账户页的下载按钮直接链过来 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("format") ?? "md";
  const format = (EXPORT_FORMATS as readonly string[]).includes(raw) ? (raw as ExportFormat) : null;
  if (!format) return NextResponse.json({ error: "bad_format", formats: EXPORT_FORMATS }, { status: 400 });

  try {
    const viewer = await getViewer();
    // 下载按钮是普通链接:未登录去登录、免费账号去定价页,都比一个 JSON 错误更像人话
    if (viewer.level === "guest") {
      return NextResponse.redirect(new URL("/sign-in?redirect_url=%2Faccount%23export", req.url), 303);
    }
    if (viewer.level !== "member") {
      return NextResponse.redirect(new URL("/pricing", req.url), 303);
    }

    const userId = viewer.clerkUserId!;
    const [used] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          eq(events.name, "library_export"),
          eq(events.clerkUserId, userId),
          gt(events.ts, sql`now() - interval '24 hours'`)
        )
      );
    if ((used?.n ?? 0) >= EXPORT_DAILY_CAP) {
      return new NextResponse(
        `You have downloaded the library ${EXPORT_DAILY_CAP} times in the last 24 hours. The files only change when new ideas are added, so the copy you have is current. Downloads reopen within a day.\n`,
        { status: 429, headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "3600" } }
      );
    }

    await db.insert(events).values({
      clerkUserId: userId,
      name: "library_export",
      path: "/api/export",
      props: { format },
      isSelf: viewer.isAdmin || req.cookies.get("ps_exclude")?.value === "1",
    });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(exportStream(format, licenseIdFor(userId), date), {
      headers: {
        "content-type": EXPORT_CONTENT_TYPE[format],
        "content-disposition": `attachment; filename="${exportFilename(format, date)}"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      },
    });
  } catch (e) {
    await captureError(e, { route: "/api/export", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
