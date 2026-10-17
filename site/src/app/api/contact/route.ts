import { NextRequest, NextResponse } from "next/server";
import { db, contactMessages } from "@/db";
import { sendNow } from "@/lib/mailer";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length > 4000) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    await db.insert(contactMessages).values({ email: email.slice(0, 200), message });

    // 通知我:当场发出(发不出去就留在队列里,每日 cron 重试)。Reply-To 是访客邮箱,收件箱里直接点回复就能回他
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    await sendNow({
      to: SITE.adminEmail,
      subject: `[${SITE.name}] New contact message from ${email}`,
      html: `<p><strong>From:</strong> ${esc(email)}</p><pre style="white-space:pre-wrap;font-family:inherit">${esc(message)}</pre>`,
      text: `From: ${email}\n\n${message}`,
      replyTo: email,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/contact", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
