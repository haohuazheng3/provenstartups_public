"use client";

import { useEffect, useState } from "react";
import Link from "@/components/HoverLink";

/*
 * FlowGlance 加载器 + 按地区的同意横幅(2026-10-31 起;做法照 onwardscout.com):
 *   - 欧盟/EEA/英国/瑞士(或 /api/geo 判断不了的访客):先弹横幅,点 Accept 才加载,Decline 就不加载
 *   - 其他地区:不弹横幅,直接加载
 *   - 页脚 "Do not track me"(任何地区):写入拒绝 cookie,此后 FlowGlance 不再加载,自建埋点也停
 * 选择存在第一方 cookie ps_consent 里 180 天;地区判断结果存在 ps_region 里 30 天,
 * 回头客不用每次都调一次 /api/geo。
 */

const SITE_ID = process.env.NEXT_PUBLIC_FLOWGLANCE_SITE;
const CONSENT = "ps_consent";
const REGION = "ps_region";
const CHANGE = "ps:consent-change";

type Consent = "all" | "denied";
type Region = "notice" | "optin";

declare global {
  interface Window {
    __psFwLoaded?: boolean;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function writeCookie(name: string, value: string, days: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${60 * 60 * 24 * days}; SameSite=Lax${secure}`;
}

export function readConsent(): Consent | null {
  const v = readCookie(CONSENT);
  return v === "all" || v === "denied" ? v : null;
}

/** 访客点过 Decline / Do not track me:FlowGlance 不加载,自建埋点也不发。 */
export function analyticsDeclined(): boolean {
  return readConsent() === "denied";
}

/**
 * 自动化浏览器不记:Playwright / Puppeteer / Selenium 会把 navigator.webdriver 设成 true,
 * 无头 Chrome 的 UA 里带 HeadlessChrome。2026-10-22 起一批机房 IP(新加坡、华盛顿)的无头浏览器
 * 专刷 robots.txt 禁抓的带参数网址、还屏蔽图片,在 FlowGlance 里留下几百个"人"和上千条
 * "IMG failed to load"、Clerk "Timed out after 7000ms"。这里只能拦住自报身份的那部分。
 */
export function automatedBrowser(): boolean {
  try {
    return (
      navigator.webdriver === true ||
      /HeadlessChrome|PhantomJS|Lighthouse|\bbot\b|crawler|spider/i.test(navigator.userAgent)
    );
  } catch {
    return false;
  }
}

function readRegion(): Region | null {
  const v = readCookie(REGION);
  return v === "notice" || v === "optin" ? v : null;
}

function loadFlowGlance() {
  if (!SITE_ID || window.__psFwLoaded || automatedBrowser()) return;
  window.__psFwLoaded = true;
  const s = document.createElement("script");
  s.src = "https://flowglance.com/fw.js";
  s.defer = true;
  s.setAttribute("data-site", SITE_ID);
  document.head.appendChild(s);
}

/** 记下选择并通知横幅与页脚链接。拒绝时顺手清掉 FlowGlance 与自建埋点存在浏览器里的随机 ID。 */
export function setConsent(v: Consent) {
  writeCookie(CONSENT, v, 180);
  if (v === "denied") {
    try {
      localStorage.removeItem("_fw_vid");
      localStorage.removeItem("ps_sid");
      sessionStorage.removeItem("_fw_sid");
      sessionStorage.removeItem("_fw_la");
    } catch {
      /* 存储被禁用时没有可清的 */
    }
  }
  window.dispatchEvent(new CustomEvent<Consent>(CHANGE, { detail: v }));
}

export default function ConsentManager() {
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (existing === "all") return loadFlowGlance();
    if (existing === "denied") return;
    let cancelled = false;
    const known = readRegion();
    // 已知地区也走 Promise,横幅永远在水合之后才出现,不会和服务端 HTML 对不上
    const lookup: Promise<Region> = known
      ? Promise.resolve(known)
      : fetch("/api/geo")
          .then((r) => (r.ok ? r.json() : { consentRequired: true }))
          .then((g: { consentRequired?: boolean }) => {
            const region: Region = g.consentRequired === false ? "notice" : "optin";
            writeCookie(REGION, region, 30);
            return region;
          })
          // 查不到就按需要同意处理,但不记 cookie,下次再查
          .catch((): Region => "optin");
    void lookup.then((region) => {
      if (cancelled) return;
      if (region === "notice") loadFlowGlance();
      else setBanner(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = (e: Event) => {
      setBanner(false);
      if ((e as CustomEvent<Consent>).detail === "all") loadFlowGlance();
      // 已经跑起来的 fw.js 卸不掉:刷新一次,新页面就不再加载它
      else if (window.__psFwLoaded) window.location.reload();
    };
    window.addEventListener(CHANGE, onChange);
    return () => window.removeEventListener(CHANGE, onChange);
  }, []);

  if (!banner) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
    >
      <div className="panel p-5 shadow-xl">
        <p className="text-[1rem] font-semibold text-t1">Can we measure your visit?</p>
        <p className="mt-2 text-[0.86rem] leading-relaxed text-t2">
          We use FlowGlance, a third-party analytics tool, to see which pages and ideas people use.
          It stores a random ID in your browser. Nothing loads unless you accept.{" "}
          <Link href="/privacy#analytics" className="link">
            Privacy policy
          </Link>
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm flex-1 justify-center"
            onClick={() => setConsent("all")}
          >
            Accept
          </button>
          <button
            type="button"
            className="btn btn-sm flex-1 justify-center"
            onClick={() => setConsent("denied")}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

/** 页脚链接:没拒绝时是 "Do not track me";拒绝之后可以从这里再打开。 */
export function DoNotTrackLink({ className = "" }: { className?: string }) {
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const sync = () => setDeclined(analyticsDeclined());
    sync();
    window.addEventListener(CHANGE, sync);
    return () => window.removeEventListener(CHANGE, sync);
  }, []);

  return (
    <button
      type="button"
      className={className}
      onClick={() => setConsent(declined ? "all" : "denied")}
    >
      {declined ? "Analytics off · turn back on" : "Do not track me"}
    </button>
  );
}
