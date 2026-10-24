"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { trackEvent } from "./ClickTracker";

/**
 * "保存这个筛选,每周把新匹配发给我" —— 给还没准备付费的探索者一个免费的下一步。
 * 未登录:带着筛选和 save_filter=1 去登录,回来由 SavedFilterAutoSave 自动保存。
 * 已登录:直接保存。
 */
export default function SaveFilterButton({
  query,
  placement,
  text = "Save this filter — free",
  className = "btn",
}: {
  query: string;
  placement: string;
  text?: string;
  className?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "limit" | "error">("idle");

  const save = async () => {
    if (!isLoaded || state === "saving") return;
    trackEvent("save_filter_click", { placement, query, signed_in: !!isSignedIn });
    if (!isSignedIn) {
      const back = `/projects${query ? `?${query}&` : "?"}save_filter=1`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(back)}`);
      return;
    }
    setState("saving");
    try {
      const r = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setState("saved");
        trackEvent("filter_saved", { placement, query });
      } else setState(d.error === "limit" ? "limit" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "saved") {
    return <span className="text-[0.8rem] font-medium text-money">Saved. Email alerts are not active yet.</span>;
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={save} disabled={!isLoaded || state === "saving"} className={`${className} disabled:opacity-60`}>
        {state === "saving" ? "Saving…" : text}
      </button>
      {state === "limit" && <span className="text-[0.72rem] text-t3">You already track 5 filters — remove one in your account.</span>}
      {state === "error" && <span className="text-[0.72rem] text-red-600">Could not save — try again.</span>}
    </span>
  );
}
