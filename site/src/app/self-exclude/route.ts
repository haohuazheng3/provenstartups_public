import { NextResponse } from "next/server";

// 我访问一次即种两套排除 cookie（站内埋点 + FlowGlance）
export async function GET() {
  const res = new NextResponse(
    "<html><body style='font-family:sans-serif;padding:40px'>✅ Analytics self-exclusion cookie set for this browser.</body></html>",
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
  res.cookies.set("ps_exclude", "1", {
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
    sameSite: "lax",
  });
  res.cookies.set("fw_exclude", "1", {
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
