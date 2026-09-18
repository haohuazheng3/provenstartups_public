import { db, notifyQueue, users } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { SITE } from "./site";

/**
 * 发信管线。邮件先写入 notify_queue,由 sendQueued() 消费。
 *
 * 投递方式二选一(都没配就保持"降级态":邮件完整入队、不丢失、可随时补发):
 *   RESEND_API_KEY   —— 直连 Resend。发件域必须已在 Resend 验证,否则 403;
 *                       MAIL_FROM 可覆盖发件人,默认 noreply@<domain>。
 *   MAIL_WEBHOOK_URL —— 自建 webhook(POST {to,from,subject,html}),MAIL_WEBHOOK_TOKEN 做 Bearer。
 *
 * 上线后头三个月这两个都没配,14 封邮件(3 条联系表单 + 告警)全部躺在队列里,
 * 站长一封没收到 —— "不丢失"不等于"送达",配置之前队列只是个黑洞。
 */
export function mailerConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.MAIL_WEBHOOK_URL);
}

function mailFrom() {
  return process.env.MAIL_FROM || `${SITE.name} <noreply@${SITE.domain}>`;
}

async function deliver(to: string, subject: string, html: string) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: mailFrom(), to: [to], subject, html }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const res = await fetch(process.env.MAIL_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.MAIL_WEBHOOK_TOKEN
        ? { authorization: `Bearer ${process.env.MAIL_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ to, from: mailFrom(), subject, html }),
  });
  if (!res.ok) throw new Error(`mail webhook ${res.status}`);
}

export async function enqueue(toEmail: string, subject: string, bodyHtml: string) {
  await db.insert(notifyQueue).values({ toEmail, subject, bodyHtml });
}

/** 给所有开启通知的会员排队一封新项目提醒 */
export async function enqueueNewProjectAlert(items: { name: string; slug: string; tagline: string }[]) {
  if (items.length === 0) return 0;

  const members = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.plan, "member"), eq(users.notifyNewProjects, true)));

  if (members.length === 0) return 0;

  const list = items
    .map(
      (p) =>
        `<li style="margin:0 0 12px"><a href="${SITE.url}/projects/${p.slug}" style="color:#047857;font-weight:600;text-decoration:none">${p.name}</a><br><span style="color:#57534e;font-size:14px">${p.tagline}</span></li>`
    )
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 4px;font-size:20px">${items.length} new proven idea${items.length > 1 ? "s" : ""}</h2>
<p style="margin:0 0 20px;color:#78716c;font-size:14px">Fresh breakdowns just landed on ${SITE.name}.</p>
<ul style="padding-left:18px;margin:0 0 24px">${list}</ul>
<a href="${SITE.url}/projects" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">See all ideas</a>
<p style="margin:28px 0 0;color:#a8a29e;font-size:12px">You're getting this because new-idea alerts are on for your Pro account. <a href="${SITE.url}/account" style="color:#a8a29e">Turn them off</a>.</p>
</div>`;

  const subject =
    items.length === 1
      ? `New proven idea: ${items[0].name}`
      : `${items.length} new proven startup ideas`;

  for (const m of members) {
    await enqueue(m.email, subject, html);
  }
  return members.length;
}

/** 消费队列。未配置发信服务时不改变队列状态(保持 queued,可补发)。 */
export async function sendQueued(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db
    .select()
    .from(notifyQueue)
    .where(eq(notifyQueue.status, "queued"))
    .limit(limit);

  if (!mailerConfigured()) return { sent: 0, failed: 0, skipped: rows.length };

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await deliver(row.toEmail, row.subject, row.bodyHtml);
      await db
        .update(notifyQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifyQueue.id, row.id));
      sent++;
    } catch (e) {
      await db
        .update(notifyQueue)
        .set({
          status: "failed",
          lastError: e instanceof Error ? e.message.slice(0, 400) : "unknown",
        })
        .where(eq(notifyQueue.id, row.id));
      failed++;
    }
  }
  return { sent, failed, skipped: 0 };
}

export { sql };
