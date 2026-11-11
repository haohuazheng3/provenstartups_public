import { db, subscriptions, users } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { stripe } from "./stripe";

export type DropRecipient = { clerkUserId: string; email: string; isAdmin: boolean };

/**
 * The Drop 的收件人 = 正在订阅、且没有点过取消的会员(站长要求:取消了就不再收,即使会员期还没到期)。
 *
 * 不只信本地 users.plan:取消订阅在 Stripe 里是 cancel_at_period_end=true、status 仍是 active,
 * 本地为了"权益保留到期末"仍记成 member。所以发信前逐个向 Stripe 现查订阅状态 —— 会员规模在几百以内,
 * 每期几百次只读请求,远低于 Stripe 的限速;漏掉的 webhook 也不会让已取消的人继续收信。
 *
 * 站长账号(is_admin)总是收,好看到会员实际收到的样子。账户页关掉了邮件开关的人不收。
 */
export async function dropRecipients(): Promise<{ recipients: DropRecipient[]; excluded: { email: string; reason: string }[] }> {
  const rows = await db
    .select({ clerkUserId: users.clerkUserId, email: users.email, isAdmin: users.isAdmin, plan: users.plan, notify: users.notifyNewProjects })
    .from(users)
    .where(eq(users.notifyNewProjects, true));

  const candidates = rows.filter((r) => r.email && (r.plan === "member" || r.isAdmin));
  const ids = candidates.map((c) => c.clerkUserId);
  const subs = ids.length
    ? await db
        .select({ clerkUserId: subscriptions.clerkUserId, sid: subscriptions.stripeSubscriptionId })
        .from(subscriptions)
        .where(and(inArray(subscriptions.clerkUserId, ids)))
    : [];

  const recipients: DropRecipient[] = [];
  const excluded: { email: string; reason: string }[] = [];
  for (const c of candidates) {
    if (c.isAdmin) {
      recipients.push({ clerkUserId: c.clerkUserId, email: c.email, isAdmin: true });
      continue;
    }
    // QA 账号与站内测试邮箱不收真信
    if (c.email.toLowerCase().endsWith("@provenstartups.com")) {
      excluded.push({ email: c.email, reason: "internal address" });
      continue;
    }
    let ok = false;
    let reason = "no subscription on record";
    for (const s of subs.filter((x) => x.clerkUserId === c.clerkUserId)) {
      try {
        const sub = await stripe().subscriptions.retrieve(s.sid);
        const live = sub.status === "active" || sub.status === "trialing";
        const cancelling = sub.cancel_at_period_end || !!sub.cancel_at;
        if (live && !cancelling) {
          ok = true;
          break;
        }
        reason = cancelling ? "cancelled (access runs to period end)" : `subscription ${sub.status}`;
      } catch (e) {
        reason = `stripe lookup failed: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`;
      }
    }
    if (ok) recipients.push({ clerkUserId: c.clerkUserId, email: c.email, isAdmin: false });
    else excluded.push({ email: c.email, reason });
  }
  return { recipients, excluded };
}
