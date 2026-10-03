import { NextResponse } from "next/server";

// 专用限流测试路径(middleware 中限 5 次/分钟)
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
