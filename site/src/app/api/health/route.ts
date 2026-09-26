import { NextResponse } from "next/server";
import { db, errorEvents, projects } from "@/db";
import { sql, eq, and, or, isNull, not, like, gte } from "drizzle-orm";
import { NOISY_ROUTES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // 1) 数据库连通 + 项目数
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects);
    checks.db = "ok";
    checks.projects = count;
  } catch (e) {
    checks.db = `fail: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`;
    healthy = false;
  }

  // 2) 必需环境变量(只报名字,不回显值)
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  checks.env_missing = missing;
  if (missing.length) healthy = false;

  // 3) Stripe key 模式
  const sk = process.env.STRIPE_SECRET_KEY || "";
  checks.stripe_mode = sk.startsWith("sk_live") || sk.startsWith("rk_live") ? "live" : sk ? "test" : "absent";

  // 4) 错误收件箱:只有**服务端的、还在发生的**未解决错误才置红
  //
  //    三条过滤,各自堵一个坑:
  //    · 噪音路由 —— webhook 验签失败也入收件箱,而那个端点公网可见,
  //      任意扫描器 POST 一次就能把 healthy 打成 false。
  //    · 时间窗 —— 没有它的话,一次瞬时的客户端报错(用户网络抖动、拦截器
  //      挡掉脚本)会让 health 永远红着,定时探针每半小时报一次警,直到有人
  //      手动去收件箱点已解决。告警一旦变成日常噪音就没人看了,那才是真危险。
  //      窗口外的错误仍留在收件箱里等待处理,只是不再冒充"线上正在出事"。
  //    · 只认 server 端 —— 客户端报错绝大多数是访客自己的环境:钱包扩展注入失败
  //      (Failed to connect to MetaMask)、广告拦截器挡脚本、网络抖动导致 ChunkLoadError。
  //      一个访客的扩展崩了不等于网站挂了。这类照常入库、照常在 /admin 可见,
  //      也在下面单列成 client_errors_24h,但不参与置红 —— 否则健康信号会被
  //      我们控制不了的东西反复打红,而那正是上一版每周都在发生的事。
  const ACTIVE_WINDOW_HOURS = 24;
  try {
    const noiseFilter = NOISY_ROUTES.map((r) =>
      not(like(errorEvents.route, `${r}%`))
    );
    const since = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 3600_000);
    const where = and(
      eq(errorEvents.resolved, false),
      or(isNull(errorEvents.route), and(...noiseFilter))
    );
    const serverSide = not(eq(errorEvents.side, "client"));
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(and(where, serverSide, gte(errorEvents.lastSeen, since)));
    // 陈旧但未处理的也报出来 —— 只是不置红,免得收件箱被无声地忘掉
    const [{ count: stale }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(and(where, serverSide, not(gte(errorEvents.lastSeen, since))));
    // 客户端错误单列:看得见,但不置红
    const [{ count: client }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(and(where, eq(errorEvents.side, "client"), gte(errorEvents.lastSeen, since)));
    checks.unresolved_errors = count;
    checks.stale_unresolved = stale;
    checks.client_errors_24h = client;
    checks.error_window_hours = ACTIVE_WINDOW_HOURS;
    if (count > 0) healthy = false;
  } catch {
    checks.unresolved_errors = "unknown";
  }

  // 5) 部署信息
  checks.commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  checks.launched = process.env.NEXT_PUBLIC_LAUNCHED === "1";

  return NextResponse.json(
    { healthy, ...checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
