"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { trackEvent } from "./ClickTracker";

/**
 * 登录回跳带 save_filter=1 时:把当前筛选存下来,去掉这个参数,弹一条确认。
 * 只在已登录时动作;未登录(比如用户中途关掉登录框又手动回来)什么都不做。
 */
export default function SavedFilterAutoSave() {
  const { isLoaded, isSignedIn } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || sp.get("save_filter") !== "1") return;
    const rest = new URLSearchParams(sp.toString());
    rest.delete("save_filter");
    const query = rest.toString();
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/saved-filters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) {
          trackEvent("filter_saved", { placement: "after_sign_in", query: d.query ?? query });
          setToast(d.label ? `Saved “${d.label}”. New matches arrive in your inbox every week.` : "Saved. New ideas arrive in your inbox every week.");
        } else if (d.error === "limit") setToast("You already track 5 filters — remove one in your account to add this.");
        else if (d.error === "empty_filter") setToast("You're in. New ideas arrive in your inbox every week.");
      } catch {
        /* 保存失败不打断浏览 */
      }
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, sp, router, pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="panel-club max-w-md px-5 py-3.5 text-[0.86rem] text-t1">{toast}</div>
    </div>
  );
}
