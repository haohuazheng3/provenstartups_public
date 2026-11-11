import { db, errorEvents, notifyQueue } from "@/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { SITE } from "@/lib/site";

/** 验签失败这类"外部噪音"路由:照常入收件箱,但不触发报警、不计入 health 置红。 */
export const NOISY_ROUTES = ["/api/stripe/webhook:verify"];

/**
 * 报警联动。只在**新指纹首次出现**时发一封,同一指纹后续只累加 count 不再打扰。
 *
 * 注意:这里直接写 notify_queue,不经 mailer.enqueue —— 避免 lib 之间循环依赖。
 * 队列要真正发出去还需配置 MAIL_WEBHOOK_URL(见 lib/mailer.ts 的 mailerConfigured)。
 */
async function alertNewFingerprint(row: {
  name: string;
  message: string;
  route?: string | null;
  side: string;
}) {
  if (row.route && NOISY_ROUTES.some((r) => row.route!.startsWith(r))) return;
  const subject = `[${SITE.name}] New error: ${row.name} @ ${row.route || "unknown"}`;
  const html =
    `<p><strong>${escapeHtml(row.name)}</strong> — ${escapeHtml(row.side)}</p>` +
    `<p>route: <code>${escapeHtml(row.route || "unknown")}</code></p>` +
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(
      row.message.slice(0, 600)
    )}</pre>` +
    `<p><a href="${SITE.url}/admin">Open the error inbox</a></p>`;
  await db.insert(notifyQueue).values({
    toEmail: SITE.adminEmail,
    subject: subject.slice(0, 200),
    bodyHtml: html,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 全栈错误捕获:按 错误名+首帧堆栈+路由 指纹分组入库。严禁静默吞错的替代品。 */
export async function captureError(
  err: unknown,
  ctx: { route?: string; side: "server" | "client" | "edge"; extra?: Record<string, unknown> }
) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const stackHead = (e.stack || "").split("\n").slice(0, 3).join("\n").slice(0, 500);
    const fingerprint = crypto
      .createHash("sha1")
      .update(`${e.name}|${stackHead}|${ctx.route || ""}`)
      .digest("hex");

    const name = e.name.slice(0, 200);
    const message = (e.message || "").slice(0, 1000);

    // returning() 只在真正插入新行时返回 —— 用它区分"新指纹"与"复发"
    const inserted = await db
      .insert(errorEvents)
      .values({
        fingerprint,
        name,
        message,
        stackHead,
        route: ctx.route?.slice(0, 300),
        side: ctx.side,
        sample: ctx.extra ?? null,
      })
      .onConflictDoUpdate({
        target: errorEvents.fingerprint,
        set: {
          count: sql`${errorEvents.count} + 1`,
          lastSeen: new Date(),
          resolved: false,
        },
      })
      .returning({ id: errorEvents.id, count: errorEvents.count });

    // count===1 表示这是这个指纹的第一次,发一封报警;复发不再打扰。
    // 只报服务端/边缘错误:客户端错误(ChunkLoadError、扩展注入、断网)描述的是
    // 某个访客的环境而不是服务本身,照常入收件箱但不值得一封邮件 —— 邮件一通,
    // 三个月里 13 种客户端错误会把真正的告警淹掉。
    if (inserted[0]?.count === 1 && ctx.side !== "client") {
      await alertNewFingerprint({ name, message, route: ctx.route, side: ctx.side });
    }
  } catch (loggingErr) {
    // 错误上报本身失败:输出到 stderr(Vercel 日志),绝不抛出影响业务
    console.error("[error-inbox-failed]", loggingErr, "original:", err);
  }
}
