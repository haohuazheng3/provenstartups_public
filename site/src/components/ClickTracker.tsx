"use client";

import { useEffect } from "react";

/**
 * 全站点击埋点:任何带 data-track="事件名" 的元素被点击时,同时发给自建 /api/track 与 FlowGlance。
 * 事件属性来自 data-track-* 属性(data-track-placement="header" → { placement: "header" })。
 * 用委托而不是逐个包客户端组件 —— 服务端组件里的 <Link> 只要加属性就能被统计。
 *
 * 事件名约定:join_click(任何入会按钮)、lock_click(锁定项目行)、source_click(打开来源)、
 * save_filter_click(保存筛选)、weekly_drop_click(免费周报)、gate_open(筛选弹窗,在 FilterPanel 里直接发)。
 */
export default function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]");
      if (!el) return;
      const name = el.getAttribute("data-track");
      if (!name) return;
      const props: Record<string, unknown> = { path: location.pathname };
      for (const a of Array.from(el.attributes)) {
        if (a.name.startsWith("data-track-")) props[a.name.slice("data-track-".length)] = a.value;
      }
      trackEvent(name, props);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}

/** 客户端组件直接调用的同一个出口(测试旅程带 test_run=true 时只进站内库并标记排除) */
export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  try {
    const testRun = new URLSearchParams(location.search).get("test_run") === "true";
    const p = testRun ? { ...props, test_run: true, exclude_from_conversion: true } : props;
    window.psTrack?.(name, p);
    if (!testRun) window.fw?.("event", name, props);
  } catch {
    /* 埋点失败不影响用户 */
  }
}
