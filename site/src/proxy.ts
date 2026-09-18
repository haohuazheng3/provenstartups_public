import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 受保护路由。页面组件里也有各自的门禁(admin 用 notFound 不暴露存在),
// 这里前置一层是为了让未登录访问得到正确的 HTTP 语义 —— 页面级 notFound() 在
// force-dynamic 流式渲染下状态码已经提交,只能返回 200 空壳。
const isProtectedRoute = createRouteMatcher(["/account(.*)", "/admin(.*)"]);

// 每实例内存限流(Vercel serverless 下为尽力而为的基础防护)
const buckets = new Map<string, { n: number; reset: number }>();
const LIMITS: { prefix: string; perMin: number }[] = [
  { prefix: "/api/rl-test", perMin: 5 },
  { prefix: "/api/track", perMin: 120 },
  { prefix: "/api/errors", perMin: 60 },
  { prefix: "/api/contact", perMin: 5 },
  { prefix: "/api/stripe/checkout", perMin: 10 },
  { prefix: "/api/", perMin: 240 },
];

function rateLimit(ip: string, path: string): boolean {
  const rule = LIMITS.find((r) => path.startsWith(r.prefix));
  if (!rule) return true;
  const key = `${ip}:${rule.prefix}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + 60_000 });
    return true;
  }
  b.n++;
  if (buckets.size > 10_000) buckets.clear();
  return b.n <= rule.perMin;
}

export const proxy = clerkMiddleware(
  async (auth, req) => {
    const path = req.nextUrl.pathname;

    if (isProtectedRoute(req)) {
      const { userId } = await auth();
      if (!userId) {
        // 坑:不能用 Clerk 的 redirectToSignIn() —— 它会跳到托管域
        // accounts.provenstartups.com,而那个域跟 clerk.<domain> 一样没验证通过,
        // 实测返回 403。整个站走的是同源代理,登录页也必须留在本站。
        const url = new URL("/sign-in", req.url);
        url.searchParams.set("redirect_url", req.url);
        return NextResponse.redirect(url);
      }
    }

    if (path.startsWith("/api/")) {
      const ip =
        req.headers.get("x-real-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      if (!rateLimit(ip, path)) {
        return new NextResponse(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "60" },
        });
      }
    }

    const res = NextResponse.next();
    // 开发期全站 noindex(两级之一);上线设 NEXT_PUBLIC_LAUNCHED=1 后摘除
    if (process.env.NEXT_PUBLIC_LAUNCHED !== "1") {
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    // 安全头
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return res;
  },
  {
    // 走同域代理 /__clerk,不依赖 clerk.<domain> 的 DNS/SSL
    frontendApiProxy: { enabled: true },
  }
);

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)", "/__clerk/(.*)"],
};
