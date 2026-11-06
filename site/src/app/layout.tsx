import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import ClickTracker from "@/components/ClickTracker";
import FlowGlanceIdentify from "@/components/FlowGlanceIdentify";
import ConsentManager from "@/components/Consent";
import { SITE } from "@/lib/site";

// 全站主字:Poppins(2026-09-30 站长指定)。四档字重:正文 400、界面 500、标题 600、大数字 700。
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === "1";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  // 开发期全站 noindex(两级之二);上线设 NEXT_PUBLIC_LAUNCHED=1 摘除
  robots: LAUNCHED ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    siteName: SITE.name,
    type: "website",
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      // Clerk 的两个浏览器包(clerk-js、@clerk/ui)不经同源代理 /__clerk/ 拉取 —— 代理跑在 serverless
      // 函数上,冷启动或超时就是 "SCRIPT failed to load"(上线头三个月 15 次、4 个人,登录组件没渲染)。
      // 2026-10 起改指 jsDelivr,但 jsDelivr 在中国大陆时通时断,FlowGlance 30 天又记到约 15 个真人
      // 登录框出不来;2026-11-01 起把这两个包放在自己域名的 public/clerk-bundle/<包>@<版本>/
      // (scripts/vendor-clerk.mjs,Vercel CDN 直出、proxy.ts 不拦),由 NEXT_PUBLIC_CLERK_JS_URL /
      // NEXT_PUBLIC_CLERK_UI_URL 指过去(Clerk 7 的 mergeNextClerkPropsWithEnv 读这两个键;对应的 prop
      // 是 __internal_ 前缀,不用)。两个包都按 document.currentScript 推导分包路径,所以分包也走同源。
      // 版本号要跟代理当前 307 到的版本一致(curl -I 看 location);升级 @clerk/nextjs 时重跑脚本、改这两个变量。
      appearance={{
        // 值必须与 globals.css 的 @theme 令牌逐一对应。Clerk 从 colorPrimary
        // 推导按钮底色、focus 环与链接色 —— 之前这里是 #fafafa,推出来的主按钮
        // 是近白底配白字(对比度 1.02:1),等于按钮隐身。
        //
        // 注意:Clerk 6 的 colorText/colorTextSecondary/colorInputText/colorAlphaShade
        // 在 7 里全部改名(→ colorForeground / colorMutedForeground /
        // colorInputForeground / colorNeutral),用旧名会挂类型检查。不是"只认三个键"。
        variables: {
          colorPrimary: "#1f5eff", // --color-brand:主按钮是蓝
          colorPrimaryForeground: "#ffffff",
          colorForeground: "#0c1633", // --color-t1
          colorMutedForeground: "#44506e", // --color-t2
          colorBackground: "#ffffff", // --color-sheet
          colorMuted: "#f5f8ff", // --color-sheet-2
          colorInput: "#ffffff",
          colorInputForeground: "#0c1633",
          // colorBorder 是"基色"不是成品色 —— Clerk 会给它叠 11% alpha 再画描边。
          // 传 --color-line 那种已经很浅的值,淡化后与纸只差一点点,输入框看起来就没有边。
          // 传墨色让它自己淡:11% 落在 --color-line 附近。
          colorBorder: "#0c1633",
          colorRing: "#1f5eff", // --color-brand
          colorDanger: "#d92d20",
          colorSuccess: "#078555", // --color-money
          colorWarning: "#b7791f",
          borderRadius: "0.6rem",
          fontFamily: "var(--font-poppins), Poppins, ui-sans-serif, system-ui, sans-serif",
        },
      }}
    >
      <html
        lang="en"
        className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      >
        {/* 浏览器自动翻译(Chrome/Edge 的 Google 翻译)会把 React 管理的文本节点包进 <font>,
            React 下次 reconcile 时 removeChild/insertBefore 找不到原节点就抛 NotFoundError,
            整棵子树进错误边界 —— 访客看到的就是 "Try again"。上线头三个月里有中文、韩语、
            俄语、土耳其语用户都在用自动翻译:列表页筛选一点就崩,Clerk 的验证码步骤直接
            死掉(有个中文用户在验证码页等了两分钟、狂点七次 "Get access" 后走了)。
            这段是 facebook/react#11538 里的标准兜底:父子关系对不上时不抛、原样返回,
            让 React 继续往下走。必须在 hydration 之前执行,所以用 beforeInteractive。
            禁翻译(<meta name="google" content="notranslate">)不可取 —— 那些用户就是靠翻译在读。 */}
        <Script id="dom-translate-guard" strategy="beforeInteractive">{`
(function(){if(typeof Node!=="function"||!Node.prototype)return;
var rc=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){return c}return rc.apply(this,arguments)};
var ib=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,r){if(r&&r.parentNode!==this){return n}return ib.apply(this,arguments)};})();
`}</Script>
        {/* A marked production test must be excluded before either analytics client starts.
            Event props alone are not a FlowGlance exclusion rule: a 2026-09-22
            test_run event still appeared in its activated segment. Keep these as session
            cookies so the marked journey stays excluded without permanently suppressing
            analytics for a browser that later returns as a normal visitor. */}
        <Script id="test-traffic-exclusion" strategy="beforeInteractive">{`
(function(){try{var p=new URLSearchParams(location.search);if(p.get("test_run")!=="true")return;
var secure=location.protocol==="https:"?"; Secure":"";
document.cookie="ps_exclude=1; Path=/; SameSite=Lax"+secure;
document.cookie="fw_exclude=1; Path=/; SameSite=Lax"+secure;
}catch(_){}})();
`}</Script>
        <body className="flex min-h-full flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Analytics />
          <ClickTracker />
          <FlowGlanceIdentify />
          {/* FlowGlance —— 第三方访客分析,与上面自建的 /api/track 并存:
              自建那套只记 pageview 与业务事件(入 Neon,健康检查读它),
              FlowGlance 补的是会话回放层面的东西(滚动、点击热区、表单放弃)。
              2026-10-31 起由 ConsentManager 按地区加载:欧盟/EEA/英国/瑞士先弹横幅、同意才加载,
              其他地区直接加载;页脚 "Do not track me" 可随时拒绝(见 components/Consent.tsx)。 */}
          <ConsentManager />
        </body>
      </html>
    </ClerkProvider>
  );
}
