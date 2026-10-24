import { NextRequest } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { verifyUnsub } from "@/lib/email-links";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The Drop 的退订。
 * - POST:真正退订。Gmail/Apple Mail 的"退订"按钮按 RFC 8058 直接 POST 到 List-Unsubscribe 里的这个地址
 *   (body 为 List-Unsubscribe=One-Click),页面上的按钮也是 POST
 * - GET:只显示确认页,不改任何东西 —— 公司邮箱的安全扫描器会预先 GET 信里每个链接,GET 就退订会误伤
 */
const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · ${SITE.name}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fd;color:#0c1633;font:16px/1.6 Poppins,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}main{max-width:30rem;margin:1rem;padding:2.2rem;background:#fff;border:1px solid #e1e7f3;border-radius:20px;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#44506e;margin:0 0 1.4rem}button,a.b{display:inline-block;margin:.25rem;padding:.65rem 1.3rem;border-radius:999px;font:600 .95rem inherit;text-decoration:none;cursor:pointer}button{background:#1f5eff;color:#fff;border:0}a.b{border:1px solid #ccd6ea;color:#0c1633}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } }
  );

const invalid = () =>
  page(
    "Link expired",
    `<h1>This link no longer works</h1><p>You can switch The Drop emails off from your account page.</p><a class="b" href="${SITE.url}/account">Open my account</a>`,
    400
  );

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyUnsub(u, t)) return invalid();
  return page(
    "Unsubscribe",
    `<h1>Stop The Drop emails?</h1><p>You'll keep your membership and everything on the site. Only the email every 3 days stops.</p><form method="post"><button type="submit">Unsubscribe</button></form><p style="margin:1.2rem 0 0;font-size:.85rem"><a href="${SITE.url}/account" style="color:#616c88">Keep getting them</a></p>`
  );
}

export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyUnsub(u, t)) return invalid();
  try {
    await db.update(users).set({ notifyNewProjects: false }).where(eq(users.clerkUserId, u));
  } catch (e) {
    await captureError(e, { route: "/api/email/unsubscribe", side: "server" });
    return page("Something went wrong", `<h1>That didn't work</h1><p>Please try again, or switch it off from your account page.</p><a class="b" href="${SITE.url}/account">Open my account</a>`, 500);
  }
  return page(
    "Unsubscribed",
    `<h1>You're unsubscribed</h1><p>No more Drop emails. Your membership is unchanged, and you can turn the emails back on from your account any time.</p><a class="b" href="${SITE.url}/account">Open my account</a>`
  );
}
