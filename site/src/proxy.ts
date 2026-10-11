import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isRetiredGone } from "@/lib/retired-blog";

// 已删除的博客文章与已撤分类:410 Gone。比 404 更明确地告诉搜索引擎"这页是有意移除的",
// 移出索引更快。页面本身给真人一个出口,不让人从旧链接进来撞墙。
const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>This article was retired · ProvenStartups</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fd;color:#0c1633;font:16px/1.6 Poppins,system-ui,sans-serif}main{max-width:30rem;padding:2rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#44506e;margin:0 0 1.5rem}a{display:inline-block;margin:.25rem;padding:.6rem 1.2rem;border-radius:999px;text-decoration:none}a.p{background:#1f5eff;color:#fff}a.s{border:1px solid #ccd6ea;color:#0c1633}</style></head><body><main><h1>This article was retired</h1><p>We narrowed the blog to what ProvenStartups is about: startup ideas with revenue evidence.</p><a class="p" href="/projects">Browse the ideas</a><a class="s" href="/blog">Read the blog</a></main></body></html>`;

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

    if (path.startsWith("/blog/") && isRetiredGone(path)) {
      return new NextResponse(GONE_HTML, {
        status: 410,
        headers: { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "cache-control": "public, max-age=3600" },
      });
    }

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
  // Only Next's generated static/image assets bypass the proxy. Unknown URLs
  // containing a dot (for example scanner probes ending in .php) still render
  // through the shared layout, which calls auth(); excluding every dotted path
  // leaves that render without Clerk context and turns an ordinary 404 into an
  // auth-middleware runtime error.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
