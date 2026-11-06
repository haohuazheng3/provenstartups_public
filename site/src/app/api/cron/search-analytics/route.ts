import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, searchDaily } from "@/db";
import { captureError } from "@/lib/errors";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 每日拉 GSC searchanalytics 入库。
 *
 * 凭据用 GOOGLE_SERVICE_ACCOUNT_B64(base64 的 service account JSON)。没配就空转返回
 * configured:false —— 与 mailer 的处理方式一致,不让缺凭据变成一条报警噪音。
 * GSC 数据有 2-3 天延迟,所以拉的是 D-3 那天。
 */
function credentials(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (!sa.client_email || !sa.private_key) return null;
    return { client_email: sa.client_email, private_key: sa.private_key };
  } catch {
    return null;
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function accessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("no access_token in response");
  return j.access_token;
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const adminToken = req.headers.get("x-admin-token");
    const ok =
      (!!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
      (!!process.env.ADMIN_TOKEN && adminToken === process.env.ADMIN_TOKEN);
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const sa = credentials();
    if (!sa) {
      return NextResponse.json({ ok: true, configured: false, rows: 0 });
    }

    // GSC 数据滞后 2-3 天,拉 D-3
    const d = new Date(Date.now() - 3 * 86400_000);
    const date = d.toISOString().slice(0, 10);

    const token = await accessToken(sa);
    const resource = encodeURIComponent(`sc-domain:${SITE.domain}`);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${resource}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: date,
          endDate: date,
          dimensions: ["query", "page"],
          rowLimit: 5000,
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`searchanalytics ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
    };
    const rows = data.rows ?? [];

    // 幂等:同一天重跑先清掉那天的,避免累加成重复行
    await db.delete(searchDaily).where(eq(searchDaily.date, date));

    if (rows.length) {
      const values = rows.map((r) => ({
        date,
        query: r.keys[0] ?? null,
        page: r.keys[1] ?? null,
        clicks: Math.round(r.clicks ?? 0),
        impressions: Math.round(r.impressions ?? 0),
        ctr: r.ctr != null ? r.ctr.toFixed(4) : null,
        position: r.position != null ? r.position.toFixed(2) : null,
      }));
      // 分批插,免得单条 SQL 过长
      for (let i = 0; i < values.length; i += 500) {
        await db.insert(searchDaily).values(values.slice(i, i + 500));
      }
    }

    return NextResponse.json({ ok: true, configured: true, date, rows: rows.length });
  } catch (e) {
    await captureError(e, { route: "/api/cron/search-analytics", side: "server" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
