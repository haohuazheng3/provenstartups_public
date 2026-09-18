"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

export default function GoProButton({
  autostart,
  onInk = false,
}: {
  autostart?: boolean;
  /** 放在墨色模块上时换成半透明玻璃样式 */
  onInk?: boolean;
}) {
  // 必须等 isLoaded —— Clerk 加载完之前 isSignedIn 恒为 false,
  // 已登录用户此时点按钮会被推去 /sign-in 再弹回来,表现就是"点了没反应"。
  // 上线审计实测:头两次点击 9 秒内毫无动静,第三次才拉起 Checkout。
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (loading || !isLoaded) return; // 防连点双开;未就绪不误判登录态
    setErr(null);
    if (!isSignedIn) {
      // 账号先于支付:登录后自动回跳并直接拉起支付
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/pricing?checkout=1")}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.psTrack?.("checkout_start");
        window.location.href = data.url;
        return;
      }
      if (data.error === "already_member") {
        router.push("/account");
        return;
      }
      setErr("Something went wrong — please try again.");
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, loading, router]);

  useEffect(() => {
    if (!(autostart && sp.get("checkout") === "1" && isLoaded && isSignedIn)) return;
    // 推迟一拍再触发:start() 里同步 setState,直接在 effect 体内调用会被
    // react-hooks/set-state-in-effect 判 error(CI 的 lint 关卡因此一直红着)
    const t = setTimeout(start, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, isLoaded, isSignedIn]);

  const busy = loading || !isLoaded;

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        className={`btn ${onInk ? "btn" : "btn-primary"} disabled:opacity-60`}
      >
        {loading ? "Opening checkout…" : !isLoaded ? "Loading…" : "Go Pro — $10/mo"}
      </button>
      {err && (
        <p className={`text-xs ${onInk ? "text-red-300" : "text-red-600"}`}>{err}</p>
      )}
    </div>
  );
}
