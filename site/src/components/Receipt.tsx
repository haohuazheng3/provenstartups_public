import Link from "next/link";
import type { ReactNode } from "react";
import { Dots } from "./Score";
import { amountOf, evidenceOf, type RowProject } from "./ProjectRow";

/**
 * 收据 —— 这个站的签名构件。锯齿底边、等宽小字、点线引导的"标签 …… 值"。
 * 首页 hero 上是三张真实项目的收据;项目页顶部的数据块也是一张收据。
 */
export function Receipt({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`receipt ${className}`}>
      <div className="receipt-sheet">{children}</div>
    </div>
  );
}

/** 一行:标签 …… 值 */
export function ReceiptLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline text-[0.8rem]">
      <span className="shrink-0 text-t3">{label}</span>
      <span className="leader" aria-hidden />
      <span className="shrink-0 text-right text-t1">{children}</span>
    </div>
  );
}

const STAMP: Record<string, { text: string; cls: string }> = {
  "ev-hard": { text: "Third-party verified", cls: "text-money" },
  "ev-founder": { text: "Founder-reported", cls: "text-ev-founder" },
  "ev-creator": { text: "Creator-relayed", cls: "text-ev-creator" },
  "ev-unproven": { text: "Unproven", cls: "text-t3" },
};

/** 证据印章:按等级取色,盖在收据角上 */
export function EvidenceStamp({ evidence, className = "" }: { evidence: string; className?: string }) {
  const ev = evidenceOf(evidence);
  const s = STAMP[ev.cls] ?? STAMP["ev-unproven"];
  return <span className={`stamp ${s.cls} ${className}`}>{s.text}</span>;
}

/** 首页 hero 用:一个项目一张收据,整张可点 */
export function IdeaReceipt({
  p,
  className = "",
  sheetClassName = "",
}: {
  p: RowProject;
  className?: string;
  /** 加在内层纸张上的类(浮动动画放这里,不和外层的旋转/悬停位移打架) */
  sheetClassName?: string;
}) {
  const amount = amountOf(p.revenue);
  const team = (p.team ?? "").split(/[·(,]/)[0].trim();
  return (
    <Link
      href={`/projects/${p.slug}`}
      className={`receipt block ${className}`}
      data-track="hero_receipt_click"
      data-track-slug={p.slug}
    >
      <div className={`receipt-sheet px-5 pt-4 pb-8 ${sheetClassName}`}>
        <div className="mono flex items-center justify-between text-[0.6rem] uppercase tracking-[0.14em] text-t3">
          <span>Revenue receipt</span>
          <span>№ {p.rank}</span>
        </div>
        <h3 className="serif mt-3 text-[1.4rem] leading-[1.1] text-t1">{p.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-[0.78rem] leading-snug text-t3">{p.tagline}</p>
        <div className="mt-4 space-y-[0.45rem]">
          <ReceiptLine label="Revenue">
            <span className="mono money text-[1.05rem] font-semibold">{amount ?? "—"}</span>
          </ReceiptLine>
          {team && (
            <ReceiptLine label="Team">
              <span className="inline-block max-w-[9rem] truncate align-bottom">{team}</span>
            </ReceiptLine>
          )}
          <ReceiptLine label="Difficulty">
            <Dots n={p.difficultyDots} />
          </ReceiptLine>
          <ReceiptLine label="Category">{p.category}</ReceiptLine>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <span className="mono text-[0.62rem] text-t4">provenstartups.com</span>
          <EvidenceStamp evidence={p.evidence} />
        </div>
      </div>
    </Link>
  );
}

/**
 * 三张收据摊在桌上:大屏是错落叠放(hover 抬起到最上层),小屏是横向滑动。
 * 一份 DOM 两种布局 —— 不为响应式渲染两遍链接。
 */
// 三张卡各占列宽 56%,起点 0 / 20% / 40% —— 右缘落在 96%,给旋转留出余量,不撑出横向滚动
const LG_POS = [
  "lg:left-0 lg:top-12 lg:-rotate-[5deg] lg:z-10",
  "lg:left-[20%] lg:top-0 lg:rotate-[1.5deg] lg:z-20",
  "lg:left-[40%] lg:top-16 lg:rotate-[5deg] lg:z-10",
];

// 大屏上三张纸各自错开节拍地轻轻浮动(负延迟 = 一加载就处在不同相位)
const LG_FLOAT = [
  "lg:[animation:float_7s_ease-in-out_infinite]",
  "lg:[animation:float_7s_ease-in-out_-2.3s_infinite]",
  "lg:[animation:float_7s_ease-in-out_-4.6s_infinite]",
];

export function ReceiptStack({ rows }: { rows: RowProject[] }) {
  return (
    <div className="scroll-x -mx-4 flex snap-x snap-mandatory gap-4 px-4 pb-4 sm:-mx-6 sm:px-6 lg:relative lg:mx-0 lg:block lg:h-[470px] lg:overflow-visible lg:px-0 lg:pb-0">
      {/* 收据背后的一团蓝光:只在大屏出现,纯装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] top-[8%] -z-10 hidden h-[78%] rounded-full bg-[radial-gradient(closest-side,rgba(31,94,255,0.28),rgba(87,200,255,0.16)_55%,transparent)] blur-2xl lg:block"
      />
      {rows.slice(0, 3).map((p, i) => (
        <IdeaReceipt
          key={p.slug}
          p={p}
          sheetClassName={LG_FLOAT[i] ?? ""}
          className={`w-[272px] shrink-0 snap-center transition-transform duration-300 ease-out lg:absolute lg:w-[56%] lg:hover:z-30 lg:hover:-translate-y-2 lg:hover:rotate-0 ${LG_POS[i] ?? ""}`}
        />
      ))}
    </div>
  );
}
