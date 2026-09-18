import { NextResponse } from "next/server";

// 我访问一次即种排除 cookie(埋点自测过滤)
export async function GET() {
  const res = new NextResponse(
    "<html><body style='font-family:sans-serif;padding:40px'>✅ Analytics self-exclusion cookie set for this browser.</body></html>",
    { headers: { "content-type": "text/html" } }
  );
  res.cookies.set("ps_exclude", "1", {
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
