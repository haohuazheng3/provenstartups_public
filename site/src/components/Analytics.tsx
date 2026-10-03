"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    psTrack?: (name: string, props?: Record<string, unknown>) => void;
  }
}

function sid() {
  try {
    let s = localStorage.getItem("ps_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ps_sid", s);
    }
    return s;
  } catch {
    return "no-storage";
  }
}

function send(name: string, props?: Record<string, unknown>) {
  try {
    const u = new URL(location.href);
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
      const v = u.searchParams.get(k);
      if (v) utm[k] = v;
    });
    const payload = JSON.stringify({
      name,
      path: location.pathname,
      sessionId: sid(),
      referrer: document.referrer || null,
      utm: Object.keys(utm).length ? utm : null,
      props: props || null,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", body: payload, keepalive: true });
    }
  } catch {
    /* 埋点失败不影响用户 */
  }
}

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    window.psTrack = send;
    // 客户端错误上报
    const onError = (ev: ErrorEvent) => {
      fetch("/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: ev.error?.name || "WindowError",
          message: ev.message,
          stack: ev.error?.stack,
          route: location.pathname,
        }),
      }).catch(() => {});
    };
    const onReject = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      fetch("/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: (r && r.name) || "UnhandledRejection",
          message: (r && (r.message || String(r))) || "unknown",
          stack: r && r.stack,
          route: location.pathname,
        }),
      }).catch(() => {});
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  useEffect(() => {
    send("pageview");
  }, [pathname]);

  return null;
}
