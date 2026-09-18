import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@/db";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { enqueueNewProjectAlert, sendQueued, mailerConfigured } from "@/lib/mailer";
import { captureError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * 定时任务:把最近发布、尚未通知过的项目排队发给开启提醒的会员,并消费待发队列。
 * 鉴权:Vercel Cron 的 Authorization: Bearer $CRON_SECRET,或 x-admin-token。
 */
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const adminToken = req.headers.get("x-admin-token");
    const ok =
      (!!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
      (!!process.env.ADMIN_TOKEN && adminToken === process.env.ADMIN_TOKEN);
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 已发布、尚未通知过的项目(notifiedAt 为空)
    const fresh = await db
      .select({ name: projects.name, slug: projects.slug, tagline: projects.tagline })
      .from(projects)
      .where(and(eq(projects.published, true), isNull(projects.notifiedAt)))
      .limit(20);

    const queued = fresh.length ? await enqueueNewProjectAlert(fresh) : 0;

    // 标记已通知,避免重复推送
    if (fresh.length) {
      await db
        .update(projects)
        .set({ notifiedAt: new Date() })
        .where(
          inArray(
            projects.slug,
            fresh.map((p) => p.slug)
          )
        );
    }

    const sendResult = await sendQueued(100);

    return NextResponse.json({
      ok: true,
      newProjects: fresh.length,
      recipientsQueued: queued,
      mailerConfigured: mailerConfigured(),
      ...sendResult,
    });
  } catch (e) {
    await captureError(e, { route: "/api/cron/notify-new", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
