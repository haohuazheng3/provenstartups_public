import Link from "next/link";
import { countryCode } from "@/lib/country";

export type RowProject = {
  slug: string;
  rank: number;
  tier: string;
  category: string;
  timing: string;
  evidence: string;
  name: string;
  tagline: string;
  revenue: string | null;
  team: string | null;
  region: string | null;
  difficultyDots: number | null;
  oneLiner: string | null;
  potentialStars: number | null;
  memberOnly: boolean;
};

/** 证据等级 → 色标 + 可读名。emoji 在 SSR/浏览器间的字素切分不一致,一律查表。 */
const EV: [prefix: string, cls: string, label: string][] = [
  ["✅", "ev-hard", "Third-party verified"],
  ["🗣", "ev-founder", "Founder-reported"],
  ["📎", "ev-creator", "Creator-relayed"],
  ["🔮", "ev-unproven", "Unproven"],
];

export function evidenceOf(evidence: string) {
  const s = evidence.trim();
  const hit = EV.find(([p]) => s.startsWith(p));
  return { cls: hit?.[1] ?? "ev-unproven", label: hit?.[2] ?? "Unknown" };
}

export function tierShort(tier: string) {
  const m = tier.match(/Tier\s*(\d)/i);
  return m ? `T${m[1]}` : tier.split(" · ")[0];
}

/** 目录已经不只有美元 —— 韩元、泰铢、肯尼亚先令、兹罗提都要认得出来。 */
const CURRENCY =
  "\\$|€|£|¥|₩|₹|₺|฿|₦|₪|₫|R\\$|KSh|PLN|NGN|AED|SGD|AUD|CAD|CHF|SEK|NOK|DKK|ZAR|BRL|MXN|INR|JPY|KRW|TRY|THB|VND|IDR|PHP|MYR|TWD|HKD|RMB|CNY";

// 数量级既可能是 "32M" 也可能是 "32 million" —— 两种都收,输出统一成单字母
const MAG = "(?:[KMB]\\b|\\s*(?:thousand|million|billion|bn)\\b)";

const AMOUNT = new RegExp(
  `(?:≈|~)?\\s*(?:${CURRENCY})\\s?[\\d.,]+\\s*${MAG}?\\+?` +
    `(?:\\s*[-–—]\\s*(?:${CURRENCY})?\\s?[\\d.,]+\\s*${MAG}?)?` +
    `(?:\\s*\\/\\s*(?:mo|month|yr|year|day|wk|week))?`,
  "gi"
);

/** 收入字段开头就声明没有数字的,别把这句话塞进金额列。 */
const NOT_DISCLOSED = /^no\s+revenue|^revenue\s+not\s+disclosed|^amount\s+undisclosed|^undisclosed/i;

/**
 * 行里只放一个干净的金额。
 * 原始串长短悬殊("≈$115K/mo net profit (single month)"),整串铺开就无法上下对齐比较。
 * 叙述成长轨迹时("KSh 200 → KSh 1.5M in 18 months")取终值,读者关心的是它做到了多少。
 */
export function amountOf(revenue: string | null) {
  if (!revenue) return null;
  // 括号里装的是换算值或旁注("(~$180-300)"、"(deal size $1,650 → $12,000)"),
  // 连里面的箭头一起剥掉,否则旁注能顶掉正主。
  const head = revenue.split("·")[0].replace(/\([^)]*\)/g, " ").trim();
  if (NOT_DISCLOSED.test(head)) return null;

  const all = head.match(AMOUNT);
  if (all?.length) {
    // "$0 → ~$300K" 这类成长叙述里,读者要的是箭头右边那个。
    // 取箭头后的第一个而不是整段最后一个 —— 后面往往还跟着成本、净利
    // 或行业区间,那些不是这门生意的收入。
    // 也只认显式箭头:"revenue from one account" 里的 from/to 同样会命中。
    const arrow = head.search(/→|->|⇒/);
    const after = arrow >= 0 ? head.slice(arrow).match(AMOUNT) : null;
    const pick = after?.[0] ?? all[0];
    return pick
      .trim()
      .replace(/\s*thousand\b/gi, "K")
      .replace(/\s*(?:million)\b/gi, "M")
      .replace(/\s*(?:billion|bn)\b/gi, "B")
      .replace(/\s+/g, "")
      .replace(/[,.;:]+$/, "");
  }
  return head.length > 14 ? head.slice(0, 14).trimEnd() + "…" : head;
}

function Bars({ n, max = 5 }: { n?: number | null; max?: number }) {
  if (n == null) return null;
  return (
    <span className="inline-flex items-center gap-[2px]" title={`Difficulty ${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-[9px] w-[2.5px] rounded-full ${i < n ? "bg-t3" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

export default function ProjectRow({
  p,
  locked,
  lockedHref = "/sign-in",
  lockedLabel = "Locked idea — create a free account",
  index,
}: {
  p: RowProject;
  locked: boolean;
  lockedHref?: string;
  lockedLabel?: string;
  index?: number;
}) {
  const amount = amountOf(p.revenue);
  const ev = evidenceOf(p.evidence);
  const cc = countryCode(p.region);

  const body = (
    <div className="grid gap-x-5 gap-y-2 sm:grid-cols-[8.5rem_1fr_auto] sm:items-center">
      {/* 金额 —— 等宽,好上下对齐比较。手机端与梯队同行 */}
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <span
          className={`mono money text-[1.05rem] font-semibold leading-none sm:text-[1.12rem] ${
            locked ? "locked" : ""
          }`}
        >
          {amount ?? "—"}
        </span>
        <span className="flex items-center gap-1.5 sm:hidden">
          {p.memberOnly && <span className="chip chip-solid">PRO</span>}
          <span className="chip">{tierShort(p.tier)}</span>
        </span>
      </div>

      {/* 名称 + 一句话 */}
      <div className={`min-w-0 ${locked ? "locked" : ""}`}>
        <div className="truncate text-[0.9rem] font-medium leading-snug">{p.name}</div>
        <div className="mt-0.5 truncate text-[0.78rem] leading-snug text-t3">{p.tagline}</div>
      </div>

      {/* 桌面端右侧元数据 */}
      <div className="hidden items-center gap-5 sm:flex">
        <span className="flex w-[9.6rem] items-center gap-2">
          {cc && (
            <span className="mono shrink-0 text-[0.66rem] tracking-[0.04em] text-t4" title={p.region ?? ""}>
              {cc}
            </span>
          )}
          <span className="truncate text-[0.76rem] text-t3">{p.category}</span>
        </span>
        <span className={`ev ${ev.cls}`} title={ev.label} />
        <Bars n={p.difficultyDots} />
        {p.memberOnly && <span className="chip chip-solid">PRO</span>}
        <span className="chip w-[2.1rem] justify-center">{tierShort(p.tier)}</span>
      </div>

      {/* 手机端底部元数据 */}
      <div className="flex items-center gap-2.5 text-[0.72rem] text-t3 sm:hidden">
        <span className={`ev ${ev.cls}`} title={ev.label} />
        {cc && <span className="mono shrink-0 text-[0.66rem] text-t4">{cc}</span>}
        <span className="truncate">{p.category}</span>
        <span className="ml-auto">
          <Bars n={p.difficultyDots} />
        </span>
      </div>
    </div>
  );

  const cls = "row px-4 py-3.5 sm:px-5";
  const num = index != null ? <span className="sr-only">#{index}</span> : null;

  return locked ? (
    <Link href={lockedHref} className={cls} aria-label={lockedLabel}>
      {num}
      {body}
    </Link>
  ) : (
    <Link href={`/projects/${p.slug}`} className={cls} aria-label={p.name}>
      {num}
      {body}
    </Link>
  );
}
