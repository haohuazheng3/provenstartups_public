import { NextRequest, NextResponse } from "next/server";
import { sendQueued, mailerConfigured } from "@/lib/mailer";
import { captureError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * 每日 cron:只消费待发队列(报错告警等)。
 *
 * 2026-10-14 发信接通时停掉了这里原来的两件事:
 *   ① 每天把 20 个"未通知"项目排队发给所有开启提醒的账号(含免费账号)—— 会员改收每 3 天一期的
 *      The Drop(/api/admin/drops,桌面定时任务触发);免费账号发不发邮件、发什么,等站长定
 *   ② 保存筛选的每周匹配邮件(lib/saved-filter-digest.ts 保留,演练脚本 scripts/digest-dryrun.ts 仍可用)
 * 页面上对免费账号写的仍是 "email alerts are not active yet",与此一致。
 *
 * 路径名沿用 notify-new,vercel.json 的 cron 不用改。
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

    const sendResult = await sendQueued(100);
    return NextResponse.json({ ok: true, mailerConfigured: mailerConfigured(), ...sendResult });
  } catch (e) {
    await captureError(e, { route: "/api/cron/notify-new", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
