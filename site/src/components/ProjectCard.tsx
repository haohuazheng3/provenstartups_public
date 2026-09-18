import Link from "next/link";
import { Dots } from "./Score";

export type CardProject = {
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
  difficultyDots: number | null;
  oneLiner: string | null;
  potentialStars: number | null;
  memberOnly: boolean;
};

/** 梯队标签一律无彩 —— 靛蓝是金额的专属色,所以不按梯队分色 */
export function tierTagClass() {
  return "chip";
}

/**
 * 卡片上只放一个干净的金额。
 * 原始串长短悬殊("≈$115K/mo net profit (single month)"),整串铺上去会压过模块,
 * 所以抓第一个金额 token 连同紧随的周期;抓不到再退回首段并截断。
 */
export function headlineRevenue(revenue: string | null) {
  if (!revenue) return null;
  const head = revenue.split("·")[0].trim();
  const m = head.match(
    /[≈~]?\s*[$€£¥]\s?[\d.,]+\s*[KMB]?(?:\s*\/\s*(?:mo|month|yr|year|day|wk|week))?/i
  );
  if (m) return m[0].replace(/\s+/g, "");
  return head.length > 20 ? head.slice(0, 20).trimEnd() + "…" : head;
}

/** 金额串里除主数字外的补充(付费客户数、毛利等),作为副行 */
export function revenueDetail(revenue: string | null) {
  if (!revenue) return null;
  const parts = revenue.split("·").slice(1).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** 证据等级只留符号。查表而非切字符串:Intl.Segmenter 在 SSR/浏览器间不一致会引发水合不匹配。 */
const EVIDENCE_MARKS: [prefix: string, mark: string, label: string][] = [
  ["✅", "✅", "Verified"],
  ["🗣", "🗣️", "Founder-reported"],
  ["📎", "📎", "Creator-reported"],
  ["🔮", "🔮", "Unverified"],
];

export function evidenceMark(evidence: string) {
  const s = evidence.trim();
  const hit = EVIDENCE_MARKS.find(([p]) => s.startsWith(p));
  return hit ? { mark: hit[1], label: hit[2] } : { mark: "", label: "" };
}

export default function ProjectCard({
  p,
  locked,
  wide = false,
}: {
  p: CardProject;
  locked: boolean;
  /** 宽卡:金额与文字左右分栏,用来打破网格单调 */
  wide?: boolean;
}) {
  const revenue = headlineRevenue(p.revenue);
  const detail = revenueDetail(p.revenue);
  const ev = evidenceMark(p.evidence);

  const meta = (
    <div className="mt-auto pt-3.5">
      <div className="hairline" />
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.68rem] text-t4">
        <span className="truncate">{p.category}</span>
        <Dots n={p.difficultyDots} />
      </div>
    </div>
  );

  const inner = (
    <article
      className={`panel panel-lit relative flex h-full flex-col overflow-hidden ${
        wide ? "p-6 sm:p-7" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={tierTagClass()}>{p.tier.split(" · ")[0]}</span>
        <span className="flex items-center gap-1.5">
          {p.memberOnly && <span className="chip chip-solid">PRO</span>}
          <span className="text-[0.7rem] opacity-45" title={ev.label}>
            {ev.mark}
          </span>
        </span>
      </div>

      {wide ? (
        /* 宽卡:金额独占左栏,文字在右 —— 撑满宽度,形成横向张力 */
        <div
          className={`mt-6 flex flex-1 flex-col gap-6 sm:flex-row sm:items-end sm:gap-10 ${
            locked ? "locked" : ""
          }`}
        >
          <div className="shrink-0">
            {revenue && (
              <div className="num text-[2.4rem] font-semibold leading-[1] text-t1 sm:text-[3rem]">
                {revenue}
              </div>
            )}
            {detail && (
              <div className="mt-2.5 max-w-[15rem] text-[0.74rem] leading-relaxed text-t4">
                {detail}
              </div>
            )}
          </div>
          <div className="sm:pb-1">
            <h3 className="text-[1.15rem] font-semibold leading-snug tracking-[-0.02em]">
              {p.name}
            </h3>
            <p className="mt-2 line-clamp-2 text-[0.86rem] leading-relaxed text-t2">
              {p.tagline}
            </p>
            <div className="mt-3.5 flex items-center gap-3 text-[0.72rem] text-t4">
              <span>{p.category}</span>
              <span className="h-3 w-px bg-line" />
              <Dots n={p.difficultyDots} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={locked ? "locked" : ""}>
            {revenue && (
              <div className="num mt-3.5 text-[1.3rem] font-semibold leading-[1.05] text-t1 sm:text-[1.4rem]">
                {revenue}
              </div>
            )}
            <h3 className="mt-2 line-clamp-1 text-[0.89rem] font-semibold tracking-[-0.02em]">
              {p.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 min-h-[2.2rem] text-[0.76rem] leading-[1.45] text-t2">
              {p.tagline}
            </p>
          </div>
          {meta}
        </>
      )}

      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/70 backdrop-blur-[1px]">
          <span className="btn !px-4 !py-2 !text-[0.8rem]">Free account</span>
        </div>
      )}
    </article>
  );

  return locked ? (
    <Link href="/sign-in" aria-label={`Locked idea ${p.rank} — create a free account`}>
      {inner}
    </Link>
  ) : (
    <Link href={`/projects/${p.slug}`} aria-label={p.name}>
      {inner}
    </Link>
  );
}
