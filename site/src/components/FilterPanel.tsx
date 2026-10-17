"use client";

import Link from "@/components/HoverLink";
import { useEffect, useState } from "react";
import { FILTER_GROUPS, countActive, filterHrefFor, type FilterCounts, type FilterState } from "@/lib/filters";
import { SITE } from "@/lib/site";
import { trackEvent } from "./ClickTracker";
import SaveFilterButton from "./SaveFilterButton";

type Gate = { group: string; groupLabel: string; option: string; optionLabel: string; count?: number };

/**
 * 痛点筛选面板(折叠式)。
 * - 默认只露出每组的标题与一句提示,点标题才展开选项 —— 手机上 11 组 40 多个选项一齐摊开就是噪音(2026-09-23 用户要求)。
 * - 有选中项的组保持展开,并把选中值显示在标题行。
 * - 每个选项后面带库里的命中数(按整个索引算),游客也看得到"货架上有多少"。
 * - 会员:选项是链接(服务端按 URL 过滤,可分享)。非会员:选项是按钮,点了弹入会对话框;面板本身完整可见。
 */
const COMPACT_KEYS = ["evidence", "rev", "build", "profit", "acq", "team", "tool"];

export default function FilterPanel({
  base,
  filters,
  isMember,
  resultCount,
  counts,
  compact = false,
}: {
  base: string;
  filters: FilterState;
  isMember: boolean;
  resultCount?: number;
  counts?: FilterCounts;
  compact?: boolean;
}) {
  const active = countActive(filters);
  const groups = compact ? FILTER_GROUPS.filter((g) => COMPACT_KEYS.includes(g.key)) : FILTER_GROUPS;
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, !!filters[g.key]]))
  );
  const [gate, setGate] = useState<Gate | null>(null);

  const openGate = (g: Gate) => {
    setGate(g);
    // 之前弹窗没有埋点:72 小时里有没有人点过、点的是哪个筛选,都无从知道
    trackEvent("gate_open", { group: g.group, option: g.option, count: g.count, placement: compact ? "home" : "index" });
  };

  useEffect(() => {
    if (!gate) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setGate(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [gate]);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="relative">
      <div className={`panel ${compact ? "p-5 sm:p-6" : "p-5 sm:p-7"}`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="label">Find your idea</span>
            <h3 className="h-sec mt-1.5 text-[1.35rem]">
              Filter by what actually matters to you
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[0.78rem] text-t3">
            {isMember && typeof resultCount === "number" && (
              <span>
                <span className="mono text-t1">{resultCount}</span> match
              </span>
            )}
            {isMember && active > 0 && (
              <Link href={base} className="text-t2 hover:text-t1">
                Clear {active}
              </Link>
            )}
            {!isMember && <span className="badge-club">{SITE.club.name}</span>}
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const isOpen = !!open[g.key];
            const current = filters[g.key] ? g.options.find((o) => o.key === filters[g.key]) : undefined;
            return (
              <div key={g.key} className="min-w-0 border-b border-line py-1 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={isOpen}
                  aria-controls={`filter-${g.key}`}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.86rem] font-medium tracking-[-0.01em] text-t1">
                      {g.label}
                      {current && (
                        <span className="chip chip-on ml-2 align-middle">{current.label}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.72rem] text-t3">{g.hint}</span>
                  </span>
                  <span className="mono shrink-0 text-[0.68rem] text-t4">{g.options.length}</span>
                  <span
                    aria-hidden
                    className={`shrink-0 text-t3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>
                <div id={`filter-${g.key}`} hidden={!isOpen} className="pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => {
                      const on = filters[g.key] === o.key;
                      const n = counts?.[g.key]?.[o.key];
                      const cls = `chip chip-lg shrink-0 ${on ? "chip-on" : ""}`;
                      const inner = (
                        <>
                          {o.label}
                          {typeof n === "number" && <span className="mono opacity-60">{n}</span>}
                        </>
                      );
                      return isMember ? (
                        <Link key={o.key} href={filterHrefFor(base, filters, g.key, o.key)} className={cls} aria-pressed={on}>
                          {inner}
                        </Link>
                      ) : (
                        <button
                          key={o.key}
                          type="button"
                          className={cls}
                          onClick={() => openGate({ group: g.key, groupLabel: g.label, option: o.key, optionLabel: o.label, count: n })}
                          aria-haspopup="dialog"
                        >
                          {inner}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {gate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/70 p-4 backdrop-blur-[3px]"
          onClick={() => setGate(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-gate-title"
            className="panel-club w-full max-w-md p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="badge-club">{SITE.club.name}</span>
              <button type="button" onClick={() => setGate(null)} className="text-t3 hover:text-t1" aria-label="Close">
                ✕
              </button>
            </div>
            <h3 id="filter-gate-title" className="serif mt-5 text-[1.7rem] leading-[1.1] text-t1">
              {typeof gate.count === "number" ? (
                <>
                  {gate.count} {gate.count === 1 ? "idea matches" : "ideas match"}{" "}
                  <em>{gate.optionLabel}</em>
                </>
              ) : (
                <>Filters open when you join the {SITE.club.name}</>
              )}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-t2">
              {typeof gate.count === "number" && <>Filters open when you join the {SITE.club.name}. </>}
              Members cut the whole index by evidence, revenue, build effort, path to revenue, customer
              acquisition, team, tool and country, and read every breakdown, playbook and build spec behind
              the results.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-t2">
              {SITE.club.perks.slice(0, 4).map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span className="mono text-[0.75rem] text-brand">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href={`/pricing?from=${encodeURIComponent(`${base}?${gate.group}=${gate.option}`)}`}
                className="btn btn-club btn-lg"
                data-track="join_click"
                data-track-placement="filter_gate"
                data-track-option={`${gate.group}=${gate.option}`}
              >
                {SITE.club.cta} — ${SITE.priceMonthly}/mo
              </Link>
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(base)}`} className="btn btn-lg">
                Already a member? Sign in
              </Link>
            </div>
            <p className="mt-3 text-[0.75rem] text-t3">{SITE.club.guarantee}</p>
            {/* 不打算现在付费的人:免费把这个筛选存下来,每周收新匹配 —— 留下邮箱就还有下一次 */}
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[0.8rem] leading-relaxed text-t3">
                Not ready? Save your <span className="font-medium text-t2">{gate.optionLabel}</span> filter
                for later — free, no card. Email alerts are not active yet.
              </p>
              <div className="mt-2.5">
                <SaveFilterButton
                  query={`${gate.group}=${gate.option}`}
                  placement="filter_gate"
                  text="Save this filter — free"
                  className="btn"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
