import { NextRequest, NextResponse } from "next/server";
import { db, drops, projects, users } from "@/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { captureError } from "@/lib/errors";
import { deliverBatch, mailerConfigured, type Outgoing } from "@/lib/mailer";
import { unsubUrl } from "@/lib/email-links";
import { dropRecipients } from "@/lib/drop-recipients";
import {
  UNSUB_PLACEHOLDER,
  checkDropContent,
  dropStats,
  loadDropProjects,
  renderDropWithinLimit,
  type DropContent,
} from "@/lib/drop-email";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The Drop 的发送入口(桌面定时任务调用,见 docs/drop-playbook.md)。鉴权:x-admin-token = ADMIN_TOKEN。
 *
 * GET  → 上一期是哪期、什么时候发的、下一期期号、当前会收信的人数(不返回邮箱)
 * POST { mode, slugs, content, issue?, to?, force? }
 *   mode=preview  只渲染,返回 { html, text, bytes, stats, problems },不发信
 *   mode=test     只发给 to 里的地址(限站长邮箱与 @provenstartups.com),不记期号
 *   mode=send     发给全部在订会员,记一期;同一期号不能发第二次,距上一期不足 48 小时要 force
 */
const MIN_GAP_HOURS = 48;

function authorized(req: NextRequest) {
  const t = req.headers.get("x-admin-token");
  return !!t && !!process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN;
}

async function nextIssue() {
  const [r] = await db.select({ n: sql<number>`coalesce(max(${drops.issue}), 0)::int` }).from(drops);
  return (r?.n ?? 0) + 1;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const last = await db
    .select({ issue: drops.issue, subject: drops.subject, status: drops.status, sentAt: drops.sentAt, recipients: drops.recipients, ideas: sql<number>`cardinality(${drops.projectSlugs})::int` })
    .from(drops)
    .orderBy(desc(drops.issue))
    .limit(5);
  const { recipients, excluded } = await dropRecipients();
  return NextResponse.json({
    nextIssue: await nextIssue(),
    last,
    hoursSinceLast: last[0]?.sentAt ? Math.round((Date.now() - new Date(last[0].sentAt).getTime()) / 36e5) : null,
    recipients: recipients.length,
    excluded: excluded.map((e) => e.reason),
    mailerConfigured: mailerConfigured(),
  });
}

const TEST_OK = (email: string) => {
  const e = email.toLowerCase();
  return e === SITE.adminEmail || e.endsWith("@provenstartups.com") || e.endsWith("@resend.dev");
};

function message(to: string, unsub: string, subject: string, html: string, text: string, issue: number): Outgoing {
  return {
    to,
    subject,
    html: html.replaceAll(UNSUB_PLACEHOLDER, unsub),
    text: text.replaceAll(UNSUB_PLACEHOLDER, unsub),
    replyTo: SITE.contactEmail,
    headers: {
      // RFC 8058 一键退订:Gmail / Apple Mail 在标题旁显示"退订",点了直接 POST 到这个地址
      "List-Unsubscribe": `<${unsub}>, <mailto:${SITE.contactEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "kind", value: "drop" },
      { name: "issue", value: String(issue) },
    ],
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) as {
      mode?: "preview" | "test" | "send";
      slugs?: string[];
      content?: DropContent;
      issue?: number;
      to?: string[];
      force?: boolean;
    } | null;
    const mode = body?.mode;
    if (!body || !mode || !["preview", "test", "send"].includes(mode)) {
      return NextResponse.json({ error: "mode must be preview, test or send" }, { status: 400 });
    }
    const slugs = Array.from(new Set((body.slugs ?? []).filter((s) => typeof s === "string")));
    const content = body.content as DropContent;
    const list = await loadDropProjects(slugs);
    const problems = checkDropContent(content, slugs, list);
    if (problems.length && mode !== "preview") return NextResponse.json({ error: "content_problems", problems }, { status: 422 });

    const issue = body.issue ?? (await nextIssue());
    const out = renderDropWithinLimit(content, list, { issue, date: new Date() });
    const stats = dropStats(list);

    if (mode === "preview") {
      return NextResponse.json({ issue, problems, stats, bytes: out.bytes, restShown: out.restShown, restTotal: out.restTotal, html: out.html, text: out.text });
    }
    if (!mailerConfigured()) return NextResponse.json({ error: "mailer_not_configured" }, { status: 503 });

    if (mode === "test") {
      const to = (body.to ?? []).filter(TEST_OK);
      if (!to.length) return NextResponse.json({ error: "test sends go only to the admin email or @provenstartups.com" }, { status: 400 });
      const known = await db.select({ email: users.email, id: users.clerkUserId }).from(users).where(inArray(users.email, to));
      const msgs = to.map((addr) => {
        const u = known.find((k) => k.email.toLowerCase() === addr.toLowerCase());
        return message(addr, u ? unsubUrl(u.id) : `${SITE.url}/account`, content.subject, out.html, out.text, issue);
      });
      const sent = await deliverBatch(msgs);
      return NextResponse.json({ ok: true, mode, issue, sent, bytes: out.bytes, restShown: out.restShown, restTotal: out.restTotal, stats });
    }

    // ── mode=send ──
    const [dupe] = await db.select({ status: drops.status }).from(drops).where(eq(drops.issue, issue)).limit(1);
    // 发失败的那期可以原期号重发:Resend 的幂等键(drop-<期号>:<批>)24 小时内会挡掉已经发出去的那几批
    if (dupe && dupe.status !== "failed") return NextResponse.json({ error: `issue ${issue} already exists (${dupe.status})` }, { status: 409 });
    const [last] = await db.select({ sentAt: drops.sentAt }).from(drops).where(eq(drops.status, "sent")).orderBy(desc(drops.sentAt)).limit(1);
    if (last?.sentAt && !body.force) {
      const hours = (Date.now() - new Date(last.sentAt).getTime()) / 36e5;
      if (hours < MIN_GAP_HOURS) {
        return NextResponse.json({ error: `last drop went out ${hours.toFixed(1)}h ago; wait ${MIN_GAP_HOURS}h or pass force` }, { status: 409 });
      }
    }

    const { recipients, excluded } = await dropRecipients();
    if (dupe) await db.update(drops).set({ subject: content.subject, content, projectSlugs: slugs, status: "sending" }).where(eq(drops.issue, issue));
    else await db.insert(drops).values({ issue, subject: content.subject, content, projectSlugs: slugs, status: "sending" });
    try {
      const msgs = recipients.map((r) => message(r.email, unsubUrl(r.clerkUserId), content.subject, out.html, out.text, issue));
      const sent = msgs.length ? await deliverBatch(msgs, `drop-${issue}`) : 0;
      await db.update(drops).set({ status: "sent", sentAt: new Date(), recipients: sent }).where(eq(drops.issue, issue));
      await db.update(projects).set({ notifiedAt: new Date() }).where(inArray(projects.slug, slugs));
      return NextResponse.json({ ok: true, mode, issue, sent, excluded: excluded.map((e) => e.reason), bytes: out.bytes, restShown: out.restShown, restTotal: out.restTotal, stats });
    } catch (e) {
      await db.update(drops).set({ status: "failed" }).where(eq(drops.issue, issue));
      throw e;
    }
  } catch (e) {
    await captureError(e, { route: "/api/admin/drops", side: "server" });
    return NextResponse.json({ error: "internal", message: e instanceof Error ? e.message.slice(0, 300) : "unknown" }, { status: 500 });
  }
}
