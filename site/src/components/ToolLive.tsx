import Link from "@/components/HoverLink";
import { amountOf, evidenceOf } from "@/components/ProjectRow";
import { TOOL_LABELS } from "@/lib/tool-tags";
import {
  HUB_TAGS,
  TOOL_PAGES,
  fmtDate,
  fmtUsd,
  loadToolRows,
  revenueBands,
  rowsFor,
  sortByRevenue,
  toolStats,
  type ToolRow,
} from "@/lib/tool-data";

/**
 * "用 X 做的 App"系列页面里的实时组件(正文 {{tool-stats:x}} 等占位处渲染)。
 * 数据走 loadToolRows(一天一取,导入后 revalidateTag("projects") 立即刷新)。
 */

function Money({ r }: { r: ToolRow }) {
  const amt = amountOf(r.revenue);
  if (!amt || amt.endsWith("…")) return <span className="text-t4">—</span>;
  return <span className="mono money font-semibold">{amt}</span>;
}

function EvDot({ e }: { e: string }) {
  const ev = evidenceOf(e);
  return <span className={`ev ${ev.cls}`} title={ev.label} />;
}

/** 一条统计带:案例数、收入中位数、第三方核实数、单人团队占比、最常见类别 */
export async function ToolStatsStrip({ tag }: { tag: string }) {
  const rows = await loadToolRows();
  const s = toolStats(rows, tag);
  const cells = [
    { v: String(s.count), l: "businesses in the index" },
    { v: s.median == null ? "n/a" : `${fmtUsd(s.median)}/mo`, l: "median reported revenue" },
    { v: String(s.verified), l: "third-party verified" },
    { v: `${s.soloPct}%`, l: "run by one person" },
  ];
  return (
    <section className="panel my-8 overflow-hidden" aria-label={`${s.label} in numbers`}>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {cells.map((c, i) => (
          <div key={c.l} className={`px-5 py-4 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <div className="serif grad text-[1.6rem] leading-none">{c.v}</div>
            <div className="label mt-2">{c.l}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-3 text-[0.78rem] leading-relaxed text-t3">
        Most common: {s.topCategories.map((c) => `${c.name} (${c.n})`).join(", ") || "—"}. Median counts only businesses with a
        monthly figure we can normalize ({s.withMonthly} of {s.count}). Updated {fmtDate(s.newest)}.
      </div>
    </section>
  );
}

/** 月收入分布:五档横条,和正文"N 家在 $10K–$50K"的说法同一口径 */
export async function ToolBands({ tag }: { tag: string }) {
  const rows = await loadToolRows();
  const bands = revenueBands(rows, tag);
  const total = bands.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...bands.map((b) => b.n));
  const label = TOOL_LABELS[tag] ?? tag;
  if (!total) return null;
  return (
    <section className="panel my-8 p-5 sm:p-6" aria-label={`Reported monthly revenue of ${label} businesses`}>
      <div className="label">Reported monthly revenue · {total} {label} businesses with a monthly figure</div>
      <ul className="mt-4 space-y-2.5">
        {bands.map((b) => (
          <li key={b.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[0.82rem]">
            <span className="text-t2">{b.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-sheet-2">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(b.n / max) * 100}%` }} />
            </span>
            <span className="mono text-right text-t1">{b.n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[0.72rem] leading-relaxed text-t4">
        Only businesses that publish a monthly figure we can normalize; scale references are left out. Updates as businesses are added.
      </p>
    </section>
  );
}

/** 全部案例清单(按月收入排序),超过 limit 条的链到目录页 */
export async function ToolList({ tag, limit = 50 }: { tag: string; limit?: number }) {
  const rows = await loadToolRows();
  const list = sortByRevenue(rowsFor(rows, tag));
  const shown = list.slice(0, limit);
  const label = TOOL_LABELS[tag] ?? tag;
  if (!list.length) return null;
  return (
    <section className="panel my-8 p-5 sm:p-6" aria-label={`Every ${label} business in the index`}>
      <div className="label">Every {label} business in the index · {list.length}</div>
      <ol className="mt-3 divide-y divide-line">
        {shown.map((r, i) => (
          <li key={r.slug} className="flex min-w-0 items-baseline gap-3 py-2.5">
            <span className="mono w-6 shrink-0 text-right text-[0.72rem] text-t4">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <Link href={`/projects/${r.slug}`} data-track="tool_list_click" className="text-[0.9rem] font-medium text-t1 hover:text-brand">
                {r.name}
              </Link>
              <span className="block truncate text-[0.76rem] text-t3">{r.category} · {r.tagline}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[0.84rem]">
              <Money r={r} />
              <EvDot e={r.evidence} />
            </span>
          </li>
        ))}
      </ol>
      {list.length > shown.length && (
        <p className="mt-3 text-[0.82rem] text-t3">
          Showing the top {shown.length} by reported revenue.{" "}
          <Link href="/projects" className="link">See the rest in the index →</Link>
        </p>
      )}
      <p className="mt-3 text-[0.72rem] leading-relaxed text-t4">
        Green = third-party verified, blue = founder-reported, purple = relayed by a creator, grey = unproven. The list updates as new businesses are added.
      </p>
    </section>
  );
}

/** 最近加入的几个 —— 给回访的人看"这次多了什么" */
export async function ToolNewest({ tag, n = 5 }: { tag: string; n?: number }) {
  const rows = await loadToolRows();
  const list = rowsFor(rows, tag).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, n);
  const label = TOOL_LABELS[tag] ?? tag;
  if (!list.length) return null;
  return (
    <section className="panel my-8 p-5 sm:p-6" aria-label={`Newest ${label} additions`}>
      <div className="label">Newest {label} additions</div>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {list.map((r) => (
          <li key={r.slug}>
            <Link href={`/projects/${r.slug}`} data-track="tool_newest_click" className="flex h-full min-w-0 flex-col rounded-xl border border-line bg-sheet-2 p-3.5 transition-colors hover:border-brand/40">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[0.88rem] font-medium text-t1">{r.name}</span>
                <span className="shrink-0 text-[0.8rem]"><Money r={r} /></span>
              </span>
              <span className="mt-1 line-clamp-2 text-[0.76rem] leading-relaxed text-t3">{r.tagline}</span>
              <span className="mono mt-2 text-[0.68rem] uppercase tracking-[0.08em] text-t4">Added {fmtDate(r.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 两个工具并排:同一套口径的数,外加两边都用的有几个 */
export async function ToolCompare({ a, b }: { a: string; b: string }) {
  const rows = await loadToolRows();
  const sa = toolStats(rows, a);
  const sb = toolStats(rows, b);
  const both = rowsFor(rows, a).filter((r) => rowsFor(rows, b).some((x) => x.slug === r.slug)).length;
  const topA = sortByRevenue(rowsFor(rows, a))[0];
  const topB = sortByRevenue(rowsFor(rows, b))[0];
  const line = (l: string, va: string, vb: string) => ({ l, va, vb });
  const lines = [
    line("Businesses in the index", String(sa.count), String(sb.count)),
    line("Median reported revenue", sa.median == null ? "n/a" : `${fmtUsd(sa.median)}/mo`, sb.median == null ? "n/a" : `${fmtUsd(sb.median)}/mo`),
    line("At $10K+/month", String(sa.over10k), String(sb.over10k)),
    line("Third-party verified", String(sa.verified), String(sb.verified)),
    line("Run by one person", `${sa.soloPct}%`, `${sb.soloPct}%`),
    line("Most common category", sa.topCategories[0]?.name ?? "—", sb.topCategories[0]?.name ?? "—"),
    line("Highest reported", topA ? `${topA.name}` : "—", topB ? `${topB.name}` : "—"),
  ];
  return (
    <section className="panel my-8 overflow-hidden" aria-label={`${sa.label} vs ${sb.label} in numbers`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.86rem]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-4 py-3 font-normal">Same yardstick</th>
              <th className="px-4 py-3 font-semibold text-t1">
                {TOOL_PAGES[a] ? <Link href={TOOL_PAGES[a]} className="hover:text-brand">{sa.label}</Link> : sa.label}
              </th>
              <th className="px-4 py-3 font-semibold text-t1">
                {TOOL_PAGES[b] ? <Link href={TOOL_PAGES[b]} className="hover:text-brand">{sb.label}</Link> : sb.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((x) => (
              <tr key={x.l} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-t3">{x.l}</td>
                <td className="px-4 py-2.5 text-t1">{x.va}</td>
                <td className="px-4 py-2.5 text-t1">{x.vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-3 text-[0.76rem] leading-relaxed text-t3">
        {both} business{both === 1 ? "" : "es"} used both. Counts only include businesses that name the tool as part of how they built or run the product. Updated {fmtDate([sa.newest, sb.newest].filter(Boolean).sort().pop() ?? null)}.
      </div>
    </section>
  );
}

/** 总览:每个工具一行,链到各自的专页 */
export async function ToolLeaderboard({ tags = HUB_TAGS }: { tags?: string[] }) {
  const rows = await loadToolRows();
  const list = tags.map((t) => toolStats(rows, t)).sort((x, y) => y.count - x.count);
  return (
    <section className="panel my-8 overflow-hidden" aria-label="Every tool, same yardstick">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[0.84rem]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-4 py-3 font-normal">Tool</th>
              <th className="label px-3 py-3 text-right font-normal">Businesses</th>
              <th className="label px-3 py-3 text-right font-normal">Median /mo</th>
              <th className="label px-3 py-3 text-right font-normal">$10K+/mo</th>
              <th className="label px-3 py-3 text-right font-normal">Verified</th>
              <th className="label px-4 py-3 text-right font-normal">Solo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.tag} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium text-t1">
                  {TOOL_PAGES[s.tag] ? <Link href={TOOL_PAGES[s.tag]} className="hover:text-brand">{s.label}</Link> : s.label}
                </td>
                <td className="mono px-3 py-2.5 text-right">{s.count}</td>
                <td className="mono px-3 py-2.5 text-right">{s.median == null ? "—" : fmtUsd(s.median)}</td>
                <td className="mono px-3 py-2.5 text-right">{s.over10k}</td>
                <td className="mono px-3 py-2.5 text-right">{s.verified}</td>
                <td className="mono px-4 py-2.5 text-right">{s.soloPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-3 text-[0.76rem] leading-relaxed text-t3">
        Medians use only businesses with a monthly figure we can normalize and leave out scale references (companies like Slack or Notion). Updated as new businesses are added.
      </div>
    </section>
  );
}

/** 按占位名渲染:tool-stats:x / tool-bands:x / tool-list:x / tool-newest:x / compare:a,b / leaderboard[:a,b,…] */
export function liveEmbed(slot: string) {
  const [kind, arg = ""] = slot.split(":");
  const args = arg.split(",").filter(Boolean);
  switch (kind) {
    case "tool-stats":
      return <ToolStatsStrip tag={args[0]} />;
    case "tool-bands":
      return <ToolBands tag={args[0]} />;
    case "tool-list":
      return <ToolList tag={args[0]} />;
    case "tool-newest":
      return <ToolNewest tag={args[0]} />;
    case "compare":
      return <ToolCompare a={args[0]} b={args[1]} />;
    case "leaderboard":
      return <ToolLeaderboard tags={args.length ? args : undefined} />;
    default:
      return null;
  }
}
