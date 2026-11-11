import { db, projects } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { amountOf } from "@/components/ProjectRow";
import { SITE } from "./site";

/**
 * The Drop —— 每 3 天一期的会员邮件(2026-10-14)。
 *
 * 编辑稿(DropContent)由桌面定时任务里的主模型按 docs/drop-playbook.md 写好,POST 到 /api/admin/drops;
 * 这里负责把编辑稿 + 库里的项目数据排成邮件。版式是表格 + 内联样式(邮件客户端不认外部 CSS 与 flex/grid),
 * 600px 宽,配色取站点 v4 设计语言:冷白底、电光蓝强调、绿色只给收入数字。
 *
 * 几条硬约束:
 * - 没有图片、没有追踪像素、链接不经跳转 —— 图多与追踪是被分进"推广"栏的主要信号
 * - HTML 必须小于 Gmail 的 102KB 截断线,超了就把"本期其余项目"清单收短,末尾链回站内
 * - 每封带纯文本部分,内容与 HTML 一致
 */

export type DropPick = {
  slug: string;
  /** 2–3 句:这个项目值得看的地方。可以用 **加粗** 标一个短语 */
  take: string;
  /** 可选,一句话:能直接偷走的做法 */
  steal?: string;
  /** 可选,卡片上那个绿色数字的写法(≤ 24 字符),例如 "$10K MRR"、"Sold for $500K+"、"−70% from peak"。
   *  不写就按目录页同一规则从 revenue 里取第一个金额 —— 那个金额有时是"第一年"的旧数字,值得手写 */
  figure?: string;
};

export type DropSection = {
  /** 小眉题,2–4 个词,例如 "Quiet money" */
  kicker: string;
  title: string;
  intro?: string;
  picks: DropPick[];
};

export type DropContent = {
  /** 收件箱里的标题,≤ 70 字符 */
  subject: string;
  /** 收件箱里标题后面那行灰字,≤ 110 字符 */
  preheader: string;
  headline: string;
  dek: string;
  /** 编辑的话,2–4 段短段落 */
  letter: string[];
  sections: DropSection[];
  pattern?: { title: string; body: string[] };
  /** 结尾一句话(可选) */
  signoff?: string;
};

export type DropProject = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  evidence: string;
  revenue: string | null;
  revenueMonthlyUsd: number | null;
  teamSize: string | null;
  country: string | null;
};

export async function loadDropProjects(slugs: string[]) {
  if (!slugs.length) return [];
  const rows = await db
    .select({
      slug: projects.slug,
      name: projects.name,
      tagline: projects.tagline,
      category: projects.category,
      evidence: projects.evidence,
      revenue: projects.revenue,
      revenueMonthlyUsd: projects.revenueMonthlyUsd,
      teamSize: projects.teamSize,
      country: projects.country,
    })
    .from(projects)
    .where(and(inArray(projects.slug, slugs), eq(projects.published, true)));
  return rows as DropProject[];
}

/** 编辑稿体检:引用的项目都在本期里、篇幅在范围内。返回问题清单,空数组 = 通过 */
export function checkDropContent(c: DropContent, slugs: string[], found: DropProject[]) {
  const problems: string[] = [];
  const have = new Set(found.map((p) => p.slug));
  const inDrop = new Set(slugs);
  for (const s of slugs) if (!have.has(s)) problems.push(`slug not found or unpublished: ${s}`);
  if (!c?.subject || c.subject.length > 80) problems.push("subject missing or over 80 chars");
  if (!c?.preheader || c.preheader.length > 140) problems.push("preheader missing or over 140 chars");
  if (!c?.headline || !c?.dek) problems.push("headline and dek are required");
  if (!Array.isArray(c?.letter) || !c.letter.length) problems.push("letter needs at least one paragraph");
  if (!Array.isArray(c?.sections) || !c.sections.length) problems.push("at least one section is required");
  const seen = new Set<string>();
  for (const s of c?.sections ?? []) {
    for (const p of s.picks ?? []) {
      if (!inDrop.has(p.slug)) problems.push(`pick ${p.slug} is not in this drop's slugs`);
      if (seen.has(p.slug)) problems.push(`pick ${p.slug} appears twice`);
      seen.add(p.slug);
      if (!p.take) problems.push(`pick ${p.slug} has no take`);
    }
  }
  return problems;
}

// ───────────────────────────── 小工具 ─────────────────────────────

const C = {
  bg: "#eef2fa",
  card: "#ffffff",
  line: "#e1e7f3",
  soft: "#f4f7fd",
  t1: "#0c1633",
  body: "#1f2a44",
  t2: "#44506e",
  t3: "#616c88",
  t4: "#a2adc6",
  brand: "#1f5eff",
  money: "#078555",
};
const FONT = "Poppins,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 只支持 **加粗**,别的标记一律当普通文字 */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.t1};font-weight:600">$1</strong>`);
const plainText = (s: string) => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1");

const EVIDENCE: [string, string, string][] = [
  ["✅", "Third-party verified", "#10a86b"],
  ["🗣", "Founder-reported", "#1f5eff"],
  ["📎", "Creator-relayed", "#8b5cf6"],
  ["🔮", "Unproven", "#a2adc6"],
];
function evidenceOf(raw: string) {
  const hit = EVIDENCE.find(([p]) => (raw ?? "").trim().startsWith(p));
  return { label: hit?.[1] ?? "Unproven", color: hit?.[2] ?? "#a2adc6" };
}

/** 卡片与清单上的金额:只认真金额(货币符号或数字+K/M);"Founder reported…"这类文字截断就不显示 */
function money(p: DropProject): string | null {
  const a = amountOf(p.revenue);
  if (a && a.length <= 22 && /[$€£¥₹₦₩₱฿]|\d/.test(a) && !a.endsWith("…")) return a;
  if (p.revenueMonthlyUsd) return fmtUsd(p.revenueMonthlyUsd) + "/mo";
  return null;
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return `$${n}`;
}

function teamLabel(t: string | null) {
  return t === "solo" ? "Solo" : t === "duo" ? "Two founders" : t === "team" ? "Small team" : t === "company" ? "Company" : null;
}

export function dropStats(list: DropProject[]) {
  const verified = list.filter((p) => p.evidence.trim().startsWith("✅")).length;
  const founder = list.filter((p) => p.evidence.trim().startsWith("🗣")).length;
  // 中位数只算可复制的生意:Scale Reference(Slack、PandaDoc 这类规模参照)会把"典型项目"抬到不真实的高度
  const vals = list
    .filter((p) => p.category !== "Scale Reference")
    .map((p) => p.revenueMonthlyUsd)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  const median = vals.length ? vals[Math.floor((vals.length - 1) / 2)] : null;
  const solo = list.filter((p) => p.teamSize === "solo").length;
  const countries = new Set(list.map((p) => p.country).filter(Boolean)).size;
  return { count: list.length, verified, founder, median, solo, countries };
}

function url(path: string, issue: number) {
  return `${SITE.url}${path}${path.includes("?") ? "&" : "?"}utm_source=drop&utm_medium=email&utm_campaign=drop-${issue}`;
}

// ───────────────────────────── HTML ─────────────────────────────

const label = (t: string, color: string = C.brand) =>
  `<div style="font:600 11px/1.4 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${color}">${esc(t)}</div>`;

function button(href: string, text: string, primary: boolean) {
  const style = primary
    ? `background:${C.brand};color:#ffffff;border:1px solid ${C.brand}`
    : `background:#ffffff;color:${C.t1};border:1px solid #ccd6ea`;
  return `<a href="${href}" style="${style};display:inline-block;padding:12px 22px;border-radius:999px;font:600 14px/1 ${FONT};text-decoration:none;margin:0 8px 10px 0">${esc(text)}</a>`;
}

function pickCard(pick: DropPick, p: DropProject, issue: number) {
  const ev = evidenceOf(p.evidence);
  const fig = pick.figure?.trim() || money(p);
  const meta = [p.category, teamLabel(p.teamSize), p.country].filter(Boolean).join("  ·  ");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;margin:0 0 12px;border-collapse:separate">
<tr><td style="padding:18px 20px 16px">
<div style="font:500 12px/1.5 ${FONT};color:${C.t3}">${esc(meta)}</div>
<a href="${url(`/projects/${p.slug}`, issue)}" style="display:block;margin:4px 0 6px;font:600 17px/1.35 ${FONT};color:${C.t1};text-decoration:none;word-break:break-word">${esc(p.name)}</a>
<div style="font:500 13px/1.5 ${FONT};color:${C.t3};margin:0 0 10px">${fig ? `<span style="font-weight:600;color:${C.money}">${esc(fig)}</span>&nbsp;&nbsp;` : ""}<span style="color:${ev.color}">&#9679;</span>&nbsp;${esc(ev.label)}</div>
<div style="font:400 15px/1.62 ${FONT};color:${C.body}">${rich(pick.take)}</div>
${
  pick.steal
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0"><tr><td style="border-left:3px solid ${C.brand};background:${C.soft};padding:10px 14px;font:400 14px/1.55 ${FONT};color:${C.body};border-radius:0 8px 8px 0"><strong style="color:${C.brand};font-weight:600">Steal this:</strong> ${rich(pick.steal)}</td></tr></table>`
    : ""
}
<div style="margin:12px 0 0"><a href="${url(`/projects/${p.slug}`, issue)}" style="font:600 14px/1.4 ${FONT};color:${C.brand};text-decoration:none">Read the breakdown &rarr;</a></div>
</td></tr></table>`;
}

function restRows(list: DropProject[], issue: number, limit: number) {
  // 按类别分组,组内按收入从高到低;类别按项目数从多到少
  const byCat = new Map<string, DropProject[]>();
  for (const p of list) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  let shown = 0;
  let html = "";
  for (const [cat, items] of cats) {
    if (shown >= limit) break;
    items.sort((a, b) => (b.revenueMonthlyUsd ?? -1) - (a.revenueMonthlyUsd ?? -1));
    const take = items.slice(0, Math.max(0, limit - shown));
    shown += take.length;
    html += `<tr><td colspan="2" style="padding:18px 0 6px;font:600 11px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.t3}">${esc(cat)}</td></tr>`;
    for (const p of take) {
      const ev = evidenceOf(p.evidence);
      // 清单行不带 UTM(一期上百行,省下的字节能多放几十行;点击来源看精选卡片的 UTM 就够了)
      html += `<tr><td style="padding:7px 12px 7px 0;border-top:1px solid ${C.line};font:500 14px/1.45 ${FONT};word-break:break-word;overflow-wrap:anywhere"><a href="${SITE.url}/projects/${p.slug}" style="color:${C.t1};text-decoration:none">${esc(p.name)}</a></td><td align="right" style="padding:7px 0;border-top:1px solid ${C.line};font:600 13px/1.45 ${FONT};color:${money(p) ? C.money : C.t4};white-space:nowrap">${esc(money(p) ?? "—")} <span style="color:${ev.color};font-weight:400" title="${esc(ev.label)}">&#9679;</span></td></tr>`;
    }
  }
  return { html, shown };
}

export type RenderOpts = {
  issue: number;
  date: Date;
  /** 每位收件人自己的退订链接;渲染时先放占位符,发送前逐封替换 */
  unsubPlaceholder?: string;
  restLimit?: number;
};

export const UNSUB_PLACEHOLDER = "%%UNSUBSCRIBE_URL%%";

export function renderDrop(c: DropContent, list: DropProject[], opts: RenderOpts) {
  const { issue, date } = opts;
  const unsub = opts.unsubPlaceholder ?? UNSUB_PLACEHOLDER;
  const bySlug = new Map(list.map((p) => [p.slug, p]));
  const picked = new Set(c.sections.flatMap((s) => s.picks.map((p) => p.slug)));
  const rest = list.filter((p) => !picked.has(p.slug));
  const stats = dropStats(list);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const restLimit = opts.restLimit ?? rest.length;
  const restOut = restRows(rest, issue, restLimit);

  const statCell = (value: string, text: string, color: string) =>
    `<td width="33%" valign="top" style="padding:16px 10px 16px 0"><div style="font:600 24px/1.1 ${FONT};color:${color};letter-spacing:-.01em">${esc(value)}</div><div style="font:600 10px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.t3};margin-top:6px">${esc(text)}</div></td>`;

  const sections = c.sections
    .map(
      (s) => `<tr><td class="px" style="padding:30px 36px 6px">
${label(s.kicker)}
<div style="font:600 21px/1.3 ${FONT};color:${C.t1};letter-spacing:-.01em;margin:6px 0 ${s.intro ? 8 : 16}px">${esc(s.title)}</div>
${s.intro ? `<div style="font:400 15px/1.6 ${FONT};color:${C.t2};margin:0 0 16px">${rich(s.intro)}</div>` : ""}
${s.picks
  .map((pk) => {
    const p = bySlug.get(pk.slug);
    return p ? pickCard(pk, p, issue) : "";
  })
  .join("\n")}
</td></tr>`
    )
    .join("\n");

  const pattern = c.pattern
    ? `<tr><td class="px" style="padding:22px 36px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:16px;border-collapse:separate"><tr><td style="padding:24px 24px 10px">
${label("Pattern of the drop")}
<div style="font:600 19px/1.35 ${FONT};color:${C.t1};margin:6px 0 10px">${esc(c.pattern.title)}</div>
${c.pattern.body.map((b) => `<p style="margin:0 0 14px;font:400 15px/1.62 ${FONT};color:${C.body}">${rich(b)}</p>`).join("")}
</td></tr></table></td></tr>`
    : "";

  const restBlock = rest.length
    ? `<tr><td class="px" style="padding:30px 36px 6px">
${label(`Everything else in this drop · ${rest.length}`, C.t3)}
<div style="font:400 14px/1.55 ${FONT};color:${C.t2};margin:6px 0 0">Every one has a full breakdown: the story, first customers, first dollar, flywheel and the quiet stretch.</div>
<div style="font:500 12px/1.6 ${FONT};color:${C.t3};margin:8px 0 0">${EVIDENCE.map(([, l, col]) => `<span style="white-space:nowrap"><span style="color:${col}">&#9679;</span>&nbsp;${esc(l)}</span>`).join(" &nbsp; ")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${restOut.html}</table>
${
  restOut.shown < rest.length
    ? `<div style="font:500 14px/1.5 ${FONT};margin:14px 0 0"><a href="${url("/projects?sort=new", issue)}" style="color:${C.brand};text-decoration:none">+ ${rest.length - restOut.shown} more from this drop, newest first &rarr;</a></div>`
    : ""
}
</td></tr>`
    : "";

  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light only}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
a{text-decoration:none}
@media (max-width:620px){
 .px{padding-left:22px!important;padding-right:22px!important}
 .h1{font-size:25px!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(c.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
<tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

<tr><td style="padding:0 6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font:600 15px/1 ${FONT};color:${C.t1}"><span style="color:${C.brand}">&#9679;</span>&nbsp;ProvenStartups</td>
<td align="right" style="font:600 10px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.t3}">No.&nbsp;${issue} &middot; ${esc(dateStr)}</td>
</tr></table>
</td></tr>

<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">

<tr><td class="px" style="padding:36px 36px 8px">
<div style="width:44px;height:4px;border-radius:4px;background:${C.brand};margin:0 0 18px;font-size:0;line-height:0">&nbsp;</div>
${label(`The Drop · ${stats.count} new ideas`)}
<h1 class="h1" style="margin:10px 0 12px;font:600 29px/1.22 ${FONT};color:${C.t1};letter-spacing:-.015em">${esc(c.headline)}</h1>
<div style="font:400 16px/1.6 ${FONT};color:${C.t2}">${rich(c.dek)}</div>
</td></tr>

<tr><td class="px" style="padding:18px 36px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}"><tr>
${statCell(String(stats.count), "new ideas", C.brand)}
${stats.verified > 0 ? statCell(String(stats.verified), "third-party verified", C.brand) : statCell(String(stats.founder), "founder-reported", C.brand)}
${statCell(String(stats.solo), "run by one person", C.brand)}
</tr></table>
</td></tr>

<tr><td class="px" style="padding:22px 36px 0">
${c.letter.map((p) => `<p style="margin:0 0 14px;font:400 16px/1.65 ${FONT};color:${C.body}">${rich(p)}</p>`).join("\n")}
</td></tr>

${sections}
${pattern}
${restBlock}

<tr><td class="px" style="padding:30px 36px 8px">
${button(url("/projects?sort=new", issue), "See every new idea", true)}
${button(url("/account#export", issue), "Ask your AI about this drop", false)}
</td></tr>

<tr><td class="px" style="padding:10px 36px 34px">
<p style="margin:0;font:400 15px/1.6 ${FONT};color:${C.t2}">${rich(c.signoff || "If one of these sparks a question, reply to this email. A person reads every reply.")}</p>
<p style="margin:12px 0 0;font:600 15px/1.6 ${FONT};color:${C.t1}">ProvenStartups</p>
</td></tr>

</table>
</td></tr>

<tr><td style="padding:22px 18px 0;font:400 12px/1.6 ${FONT};color:${C.t3};text-align:center">
You're getting The Drop because you're a member of the ${esc(SITE.club.name)} at <a href="${SITE.url}" style="color:${C.t3};text-decoration:underline">provenstartups.com</a>. A new batch of ideas lands every 3 days, and this email walks you through it.<br>
<a href="${SITE.url}/account" style="color:${C.t3};text-decoration:underline">Email settings</a> &nbsp;&middot;&nbsp; <a href="${unsub}" style="color:${C.t3};text-decoration:underline">Unsubscribe</a>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // ── 纯文本 ──
  const lines: string[] = [];
  lines.push(`THE DROP · No. ${issue} · ${dateStr}`, "", c.headline, plainText(c.dek), "");
  lines.push(`${stats.count} new ideas · ${stats.verified > 0 ? `${stats.verified} third-party verified` : `${stats.founder} founder-reported`} · ${stats.solo} run by one person`, "");
  for (const p of c.letter) lines.push(plainText(p), "");
  for (const s of c.sections) {
    lines.push(`— ${s.kicker.toUpperCase()} —`, s.title, "");
    if (s.intro) lines.push(plainText(s.intro), "");
    for (const pk of s.picks) {
      const p = bySlug.get(pk.slug);
      if (!p) continue;
      const fig = pk.figure?.trim() || money(p);
      lines.push(`${p.name}${fig ? ` — ${fig}` : ""} (${evidenceOf(p.evidence).label})`, plainText(pk.take));
      if (pk.steal) lines.push(`Steal this: ${plainText(pk.steal)}`);
      lines.push(url(`/projects/${p.slug}`, issue), "");
    }
  }
  if (c.pattern) lines.push("— PATTERN OF THE DROP —", c.pattern.title, "", ...c.pattern.body.map(plainText).flatMap((b) => [b, ""]));
  if (rest.length) {
    lines.push(`— EVERYTHING ELSE IN THIS DROP (${rest.length}) —`);
    for (const p of rest) lines.push(`${p.name}${money(p) ? ` — ${money(p)}` : ""}: ${SITE.url}/projects/${p.slug}`);
    lines.push("");
  }
  lines.push(plainText(c.signoff || "If one of these sparks a question, reply to this email. A person reads every reply."), "ProvenStartups", "");
  lines.push(`You're getting The Drop because you're a member of the ${SITE.club.name}.`, `Email settings: ${SITE.url}/account`, `Unsubscribe: ${unsub}`);
  const text = lines.join("\n");

  return { html, text, bytes: Buffer.byteLength(html), restShown: restOut.shown, restTotal: rest.length };
}

/** 渲染并保证不超 Gmail 截断线(102KB,留余量取 96KB):超了就把"其余项目"清单按 10 个一档收短 */
export function renderDropWithinLimit(c: DropContent, list: DropProject[], opts: RenderOpts) {
  const total = list.length;
  let limit = total;
  let out = renderDrop(c, list, { ...opts, restLimit: limit });
  // 占位符替换成真实退订链接会多出约 100 字节,一并算进余量
  while (out.bytes > 96_000 && limit > 0) {
    limit = Math.max(0, Math.min(limit, out.restShown) - 10);
    out = renderDrop(c, list, { ...opts, restLimit: limit });
  }
  return out;
}
