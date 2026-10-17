/**
 * Stripe ↔ DB 权益对账。只读,不改任何数据 —— 发现偏差后由人决定怎么补。
 *
 * 跑法:  npx tsx scripts/reconcile.ts
 * 需要:  STRIPE_SECRET_KEY, STRIPE_PRICE_ID, DATABASE_URL
 *
 * 查四类偏差:
 *   A. Stripe 有活跃订阅,DB 里却不是 member  → 用户付了钱没拿到权益(最严重)
 *   B. DB 是 member,Stripe 无活跃订阅        → 白送权益/漏掉了取消事件
 *   C. 周期末对不上                           → 续费或降级没同步
 *   D. 订阅挂着本站 clerkUserId,但本站 users 表没这个人 → 跨站事件串扰的痕迹
 */
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const SK = process.env.STRIPE_SECRET_KEY;
const PRICE = process.env.STRIPE_PRICE_ID;
const DB = process.env.DATABASE_URL;
if (!SK || !PRICE || !DB) {
  console.error("缺 STRIPE_SECRET_KEY / STRIPE_PRICE_ID / DATABASE_URL");
  process.exit(1);
}

const stripe = new Stripe(SK);
const sql = neon(DB);

type UserRow = {
  clerk_user_id: string;
  email: string;
  plan: string;
  member_until: Date | null;
};

async function main() {
  // ── 1. Stripe 侧:本站价格的全部订阅 ──
  const subs: Stripe.Subscription[] = [];
  for await (const s of stripe.subscriptions.list({ price: PRICE, status: "all", limit: 100 })) {
    subs.push(s);
  }
  const activeByUser = new Map<string, Stripe.Subscription>();
  const orphans: Stripe.Subscription[] = [];
  for (const s of subs) {
    const uid = s.metadata?.clerkUserId;
    if (!uid) {
      orphans.push(s);
      continue;
    }
    if (s.status === "active" || s.status === "trialing") activeByUser.set(uid, s);
  }

  // ── 2. DB 侧 ──
  const users = (await sql`
    select clerk_user_id, email, plan, member_until from users
  `) as UserRow[];
  const byId = new Map(users.map((u) => [u.clerk_user_id, u]));

  const A: string[] = [];
  const B: string[] = [];
  const C: string[] = [];
  const D: string[] = [];

  for (const [uid, sub] of activeByUser) {
    const u = byId.get(uid);
    if (!u) {
      D.push(`  订阅 ${sub.id} 的 clerkUserId=${uid} 在本站 users 表里不存在`);
      continue;
    }
    if (u.plan !== "member") {
      A.push(`  ${u.email} — Stripe ${sub.status}(${sub.id}) 但 DB plan=${u.plan}`);
      continue;
    }
    const end = sub.items?.data?.[0]?.current_period_end;
    if (end && u.member_until) {
      const drift = Math.abs(new Date(end * 1000).getTime() - new Date(u.member_until).getTime());
      if (drift > 86400_000) {
        C.push(
          `  ${u.email} — 周期末相差 ${Math.round(drift / 86400_000)} 天` +
            `(Stripe ${new Date(end * 1000).toISOString().slice(0, 10)} / DB ${new Date(u.member_until).toISOString().slice(0, 10)})`
        );
      }
    }
  }

  for (const u of users) {
    if (u.plan === "member" && !activeByUser.has(u.clerk_user_id)) {
      const until = u.member_until ? new Date(u.member_until) : null;
      // 取消后保留到周期末是设计内的,不算偏差
      if (!until || until < new Date()) {
        B.push(`  ${u.email} — DB plan=member 但 Stripe 无活跃订阅,且 member_until 已过`);
      }
    }
  }

  const report = [
    ["A 付了钱没拿到权益", A],
    ["B 白送权益/漏同步取消", B],
    ["C 周期末不一致", C],
    ["D 跨站串扰痕迹", D],
  ] as const;

  console.log(`Stripe 本站订阅 ${subs.length} 个(活跃 ${activeByUser.size})｜DB 用户 ${users.length} 人`);
  if (orphans.length) console.log(`⚠️ ${orphans.length} 个订阅没有 clerkUserId 元数据`);
  let bad = 0;
  for (const [label, list] of report) {
    console.log(`\n【${label}】${list.length} 条`);
    list.forEach((l) => console.log(l));
    bad += list.length;
  }
  console.log(bad === 0 ? "\n✅ 对账通过,无偏差" : `\n❌ 共 ${bad} 条偏差待处理`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("对账失败:", e);
  process.exit(1);
});
