import { NextRequest, NextResponse } from "next/server";
import { captureError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.message !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const e = new Error(String(body.message).slice(0, 1000));
    e.name = typeof body.name === "string" ? body.name.slice(0, 100) : "ClientError";
    e.stack = typeof body.stack === "string" ? body.stack.slice(0, 2000) : undefined;
    await captureError(e, {
      route: typeof body.route === "string" ? body.route.slice(0, 300) : undefined,
      side: "client",
      extra: { ua: req.headers.get("user-agent")?.slice(0, 200) },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
