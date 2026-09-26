"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * 把 Clerk 的登录身份告诉 FlowGlance:fw("identify", { userRef, email })。
 *
 * 没有这一步,FlowGlance 里的旅程全是匿名设备,注册用户只能靠它猜登录表单
 * 里填过的邮箱 —— 头三个月它就这样漏掉了一个注册者、又把两个验证码环节
 * 失败的人算成了"已注册"。接上之后 registered/paying 分段才对得上 Clerk。
 *
 * fw.js 用 afterInteractive 延迟加载,先塞一个带 .q 队列的桩,脚本就绪后会
 * 回放(fw.js 第 483 行:`var pre = w.fw && w.fw.q`),所以这里不用等它加载。
 */
declare global {
  interface Window {
    fw?: ((cmd: string, a?: unknown, b?: unknown) => void) & { q?: unknown[] };
  }
}

export default function FlowGlanceIdentify() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (!process.env.NEXT_PUBLIC_FLOWGLANCE_SITE) return;
    try {
      if (!window.fw) {
        const stub = ((...args: unknown[]) => {
          (stub.q = stub.q || []).push(args);
        }) as NonNullable<Window["fw"]>;
        window.fw = stub;
      }
      window.fw("identify", {
        userRef: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      });
    } catch {
      /* 分析埋点失败不影响用户 */
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
