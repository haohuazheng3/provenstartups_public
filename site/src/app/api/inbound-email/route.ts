import { NextRequest, NextResponse } from "next/server";
import { db, inboundEmails } from "@/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { captureError } from "@/lib/errors";

/** Cloudflare Email Worker 投递入口(共享密钥保护) */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-inbound-token");
    if (!token || token !== process.env.INBOUND_EMAIL_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!body?.to) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    await db.insert(inboundEmails).values({
      toAddr: String(body.to).slice(0, 200),
      fromAddr: body.from ? String(body.from).slice(0, 200) : null,
      subject: body.subject ? String(body.subject).slice(0, 500) : null,
      bodyText: body.text ? String(body.text).slice(0, 100_000) : null,
      headers: body.headers ?? null,
      authResults: body.authResults ? String(body.authResults).slice(0, 2000) : null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/inbound-email", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/** 受保护读取端点:自动化测试取验证码 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const to = req.nextUrl.searchParams.get("to");
    const sinceMs = Number(req.nextUrl.searchParams.get("since") || 0);

    const conds = [];
    if (to) conds.push(eq(inboundEmails.toAddr, to));
    if (sinceMs) conds.push(gte(inboundEmails.receivedAt, new Date(sinceMs)));

    const rows = await db
      .select()
      .from(inboundEmails)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(10);

    // 提取 6 位验证码
    const withCode = rows.map((r) => ({
      ...r,
      code: (r.subject + " " + (r.bodyText ?? "")).match(/\b(\d{6})\b/)?.[1] ?? null,
    }));
    return NextResponse.json({ count: rows.length, emails: withCode });
  } catch (e) {
    await captureError(e, { route: "/api/inbound-email:get", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
