import { NextRequest, NextResponse } from "next/server";
import { db, contactMessages, notifyQueue } from "@/db";
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

    // 通知我(走待发队列,由发信管线消费)
    await db.insert(notifyQueue).values({
      toEmail: SITE.adminEmail,
      subject: `[${SITE.name}] New contact message from ${email}`,
      bodyHtml: `<p><strong>From:</strong> ${email}</p><pre style="white-space:pre-wrap;font-family:inherit">${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await captureError(e, { route: "/api/contact", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
