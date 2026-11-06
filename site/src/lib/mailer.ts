import { db, notifyQueue } from "@/db";
import { eq } from "drizzle-orm";
import { SITE } from "./site";

/**
 * 发信管线。
 *
 * 2026-10-14 起真正通了:Resend 账号里验证了 provenstartups.com(DKIM resend._domainkey + 回信路径 send./rsend.,
 * Cloudflare 灰云),Vercel 共享变量 PROVENSTARTUPS_RESEND_API 已关联到本项目。这把 key 只有发送权限。
 * 之前三个月 notify_queue 是黑洞:219 封积压(含给 9 个免费账号每天一封的"20 new ideas")在上线发信前
 * 已全部标成 skipped —— 一通就把积压一次性发出去,等于第一天就把新域名的信誉打穿。
 *
 * 两条路:
 *   deliver / deliverBatch —— 直接发(会员 The Drop、联系表单通知)
 *   enqueue + sendQueued   —— 先入队,由每日 cron 消费(报错告警,errors.ts 直接写队列)
 *
 * 投递靠谱的几条:发件人用真实可回信的 contact@(Cloudflare 转到站长邮箱);每封带纯文本部分;
 * Resend 的打开/点击追踪保持关闭(改写链接与追踪像素会把信推向"推广"栏);批量信带 List-Unsubscribe 一键退订头。
 */

function resendKey() {
  return process.env.PROVENSTARTUPS_RESEND_API || process.env.RESEND_API_KEY || "";
}

export function mailerConfigured(): boolean {
  return !!(resendKey() || process.env.MAIL_WEBHOOK_URL);
}

export function mailFrom() {
  return process.env.MAIL_FROM || `${SITE.name} <${SITE.contactEmail}>`;
}

export type Outgoing = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
};

function resendBody(m: Outgoing) {
  return {
    from: mailFrom(),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    ...(m.text ? { text: m.text } : {}),
    ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    ...(m.headers ? { headers: m.headers } : {}),
    ...(m.tags ? { tags: m.tags } : {}),
  };
}

async function resendPost(path: string, body: unknown, idempotencyKey?: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resendKey()}`,
      // Resend 拒收不带 User-Agent 的请求
      "user-agent": "provenstartups-mailer/1.0",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`resend ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

export async function deliver(m: Outgoing) {
  if (resendKey()) {
    await resendPost("/emails", resendBody(m));
    return;
  }
  if (!process.env.MAIL_WEBHOOK_URL) throw new Error("mailer not configured");
  const res = await fetch(process.env.MAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.MAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.MAIL_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to: m.to, from: mailFrom(), subject: m.subject, html: m.html }),
  });
  if (!res.ok) throw new Error(`mail webhook ${res.status}`);
}

/**
 * 批量发(Resend /emails/batch,每次最多 100 封,每封各自的收件人与退订链接)。
 * idempotencyKey 让同一期重复调用不会重发(Resend 侧 24 小时内去重),按批追加序号。
 */
export async function deliverBatch(msgs: Outgoing[], idempotencyKey?: string) {
  if (!resendKey()) throw new Error("batch sending needs PROVENSTARTUPS_RESEND_API");
  let sent = 0;
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100);
    await resendPost("/emails/batch", chunk.map(resendBody), idempotencyKey ? `${idempotencyKey}:${i / 100}` : undefined);
    sent += chunk.length;
    // 默认限速每秒 10 次请求,批与批之间留一点间隔
    if (i + 100 < msgs.length) await new Promise((r) => setTimeout(r, 300));
  }
  return sent;
}

export async function enqueue(toEmail: string, subject: string, bodyHtml: string) {
  await db.insert(notifyQueue).values({ toEmail, subject, bodyHtml });
}

/** 入队并立刻尝试发出(联系表单通知这类不该等到第二天 cron 的信)。发失败就留在队列里,cron 会重试。 */
export async function sendNow(m: Outgoing) {
  const [row] = await db
    .insert(notifyQueue)
    .values({ toEmail: m.to, subject: m.subject, bodyHtml: m.html })
    .returning({ id: notifyQueue.id });
  if (!mailerConfigured()) return false;
  try {
    await deliver(m);
    await db.update(notifyQueue).set({ status: "sent", sentAt: new Date() }).where(eq(notifyQueue.id, row.id));
    return true;
  } catch (e) {
    await db
      .update(notifyQueue)
      .set({ lastError: e instanceof Error ? e.message.slice(0, 400) : "unknown" })
      .where(eq(notifyQueue.id, row.id));
    return false;
  }
}

/** 消费队列。未配置发信服务时不改变队列状态(保持 queued,可补发)。 */
export async function sendQueued(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db.select().from(notifyQueue).where(eq(notifyQueue.status, "queued")).limit(limit);

  if (!mailerConfigured()) return { sent: 0, failed: 0, skipped: rows.length };

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await deliver({ to: row.toEmail, subject: row.subject, html: row.bodyHtml });
      await db.update(notifyQueue).set({ status: "sent", sentAt: new Date() }).where(eq(notifyQueue.id, row.id));
      sent++;
    } catch (e) {
      await db
        .update(notifyQueue)
        .set({ status: "failed", lastError: e instanceof Error ? e.message.slice(0, 400) : "unknown" })
        .where(eq(notifyQueue.id, row.id));
      failed++;
    }
  }
  return { sent, failed, skipped: 0 };
}
