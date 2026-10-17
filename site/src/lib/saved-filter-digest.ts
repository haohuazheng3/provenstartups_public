import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, projects, savedFilters, users } from "@/db";
import { amountOf } from "@/components/ProjectRow";
import { enqueue } from "./mailer";
import { applyListFilters } from "./list-filters";
import { SITE } from "./site";

/**
 * "保存这个筛选"的每周匹配邮件。
 *
 * 每个保存的筛选自己算周期:上次发送(没发过就是保存时间)满 7 天才轮到它,
 * 窗口 = 那之后新导入的项目,按目录页同一套规则(applyListFilters,痛点筛选照常生效)筛。
 * 同一个人同一天到期的几个筛选合成一封;窗口里一个匹配都没有就不发信,但照样把 lastSentAt 往前推,
 * 下一个窗口从现在开始 —— 不会漏,也不会把同一个项目发两次。
 *
 * 跟"新项目提醒"共用 users.notifyNewProjects 这一个开关,账户页关掉就两种都停。
 */

const WEEK_MS = 7 * 24 * 3600 * 1000;
const MAX_PER_FILTER = 6;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const UTM = "utm_source=digest&utm_medium=email&utm_campaign=saved_filter";

export async function enqueueSavedFilterDigests(
  opts: {
    now?: Date;
    /** 只算不发:不入队、不推 lastSentAt,返回每封信的收件人/标题/条数 */
    dryRun?: boolean;
    /** 只处理这一个账号,且不排除站内邮箱 —— 给 QA 账号演练用 */
    onlyClerkUserId?: string;
  } = {}
) {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - WEEK_MS);
  const due = await db
    .select({
      id: savedFilters.id,
      clerkUserId: savedFilters.clerkUserId,
      query: savedFilters.query,
      label: savedFilters.label,
      createdAt: savedFilters.createdAt,
      lastSentAt: savedFilters.lastSentAt,
      email: users.email,
      plan: users.plan,
      memberUntil: users.memberUntil,
      isAdmin: users.isAdmin,
    })
    .from(savedFilters)
    .innerJoin(users, eq(users.clerkUserId, savedFilters.clerkUserId))
    .where(
      and(
        eq(users.notifyNewProjects, true),
        opts.onlyClerkUserId
          ? eq(savedFilters.clerkUserId, opts.onlyClerkUserId)
          : sql`${users.email} not like '%@provenstartups.com'`,
        or(
          and(isNull(savedFilters.lastSentAt), lte(savedFilters.createdAt, cutoff)),
          lte(savedFilters.lastSentAt, cutoff)
        )
      )
    );
  const previews: { to: string; subject: string; matches: number; member: boolean; html: string }[] = [];
  if (due.length === 0) return { dueFilters: 0, digestsQueued: 0, previews };

  const sinceOf = (f: (typeof due)[number]) => f.lastSentAt ?? f.createdAt;
  const oldest = due.reduce((m, f) => (sinceOf(f) < m ? sinceOf(f) : m), now);

  const fresh = await db
    .select({
      slug: projects.slug,
      rank: projects.rank,
      tier: projects.tier,
      category: projects.category,
      timing: projects.timing,
      evidence: projects.evidence,
      name: projects.name,
      tagline: projects.tagline,
      revenue: projects.revenue,
      team: projects.team,
      region: projects.region,
      difficultyDots: projects.difficultyDots,
      oneLiner: projects.oneLiner,
      potentialStars: projects.potentialStars,
      memberOnly: projects.memberOnly,
      revenueMonthlyUsd: projects.revenueMonthlyUsd,
      teamSize: projects.teamSize,
      tools: projects.tools,
      country: projects.country,
      scores: projects.scores,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(and(eq(projects.published, true), gt(projects.createdAt, oldest)))
    .orderBy(asc(projects.rank));

  const byUser = new Map<string, typeof due>();
  for (const f of due) byUser.set(f.clerkUserId, [...(byUser.get(f.clerkUserId) ?? []), f]);

  let digestsQueued = 0;
  for (const filters of byUser.values()) {
    const u = filters[0];
    const isMember = u.isAdmin || (u.plan === "member" && (!u.memberUntil || u.memberUntil > now));
    const sections = filters
      .map((f) => {
        const since = sinceOf(f);
        const sp = Object.fromEntries(new URLSearchParams(f.query));
        const matches = applyListFilters(
          fresh.filter((p) => p.createdAt > since),
          sp,
          true
        );
        return { f, matches };
      })
      .filter((s) => s.matches.length > 0);
    if (sections.length === 0) continue;

    const total = sections.reduce((n, s) => n + s.matches.length, 0);
    const subject =
      sections.length === 1
        ? `${total} new ${total === 1 ? "idea matches" : "ideas match"} “${sections[0].f.label}”`
        : `${total} new ideas match your saved filters`;

    const blocks = sections
      .map(({ f, matches }) => {
        const items = matches
          .slice(0, MAX_PER_FILTER)
          .map((p) => {
            const amount = amountOf(p.revenue);
            return `<li style="margin:0 0 14px"><a href="${SITE.url}/projects/${p.slug}?${UTM}" style="color:#4c3bec;font-weight:600;text-decoration:none">${esc(p.name)}</a>${
              amount ? ` <span style="color:#059669;font-family:ui-monospace,monospace;font-size:13px">${esc(amount)}</span>` : ""
            }<br><span style="color:#53617a;font-size:14px">${esc(p.tagline)}</span></li>`;
          })
          .join("");
        const more = matches.length > MAX_PER_FILTER ? matches.length - MAX_PER_FILTER : 0;
        return `<h3 style="margin:24px 0 10px;font-size:15px">${esc(f.label)} <span style="color:#8492ac;font-weight:400">· ${matches.length} new</span></h3>
<ul style="padding-left:18px;margin:0">${items}</ul>
<a href="${SITE.url}/projects${f.query ? `?${f.query}&` : "?"}${UTM}" style="color:#53617a;font-size:13px">${more ? `See ${more} more matches` : "Open this filter"} →</a>`;
      })
      .join("");

    const clubLine = isMember
      ? ""
      : `<div style="margin:28px 0 0;padding:16px 18px;border-radius:14px;background:#eeecff">
<p style="margin:0 0 10px;color:#0f172a;font-size:14px">You can read the opening of each of these. Members read every section — first customers, first dollar, the flywheel, the silent stretch — plus the source transcripts.</p>
<a href="${SITE.url}/pricing?from=digest&${UTM}" style="display:inline-block;background:#5b4bf5;color:#fff;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px">${SITE.club.cta} — $${SITE.priceMonthly}/mo</a>
</div>`;

    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
<h2 style="margin:0 0 4px;font-size:20px">${esc(subject)}</h2>
<p style="margin:0;color:#8492ac;font-size:14px">New on ${SITE.name} since your last digest, filtered the way you asked.</p>
${blocks}
${clubLine}
<p style="margin:28px 0 0;color:#a9b4c8;font-size:12px">You saved these filters on ${SITE.name}. <a href="${SITE.url}/account" style="color:#a9b4c8">Remove a filter or turn these emails off</a>.</p>
</div>`;

    previews.push({ to: u.email, subject, matches: total, member: isMember, html });
    if (opts.dryRun) continue;
    await enqueue(u.email, subject, html);
    digestsQueued++;
  }

  if (!opts.dryRun) {
    await db
      .update(savedFilters)
      .set({ lastSentAt: now })
      .where(inArray(savedFilters.id, due.map((f) => f.id)));
  }

  return { dueFilters: due.length, digestsQueued, previews: opts.dryRun ? previews : [] };
}
