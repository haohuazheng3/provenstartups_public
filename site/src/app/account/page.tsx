import Link from "@/components/HoverLink";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import PortalButton from "@/components/PortalButton";
import NotifyToggle from "@/components/NotifyToggle";
import SavedFiltersList from "@/components/SavedFiltersList";

export const metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

// 大小是 2026-10-14 实测(1,012 个项目),随库增长,写成约数
const EXPORTS = [
  { format: "md", title: "Full library · Markdown", size: "~16 MB", use: "For Claude Code, Codex, Cursor, or a ChatGPT / Claude project" },
  { format: "csv", title: "Index · CSV", size: "~1 MB", use: "One row per idea. Upload to ChatGPT or Claude for quick questions" },
  { format: "json", title: "Full library · JSON", size: "~16 MB", use: "Same as Markdown, structured for scripts and agents" },
] as const;

export default async function AccountPage() {
  const viewer = await getViewer();
  if (viewer.level === "guest") redirect("/sign-in?redirect_url=%2Faccount");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, viewer.clerkUserId!))
    .limit(1);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="panel p-6 sm:p-7"><span className="label">Account</span><h1 className="h-sec mt-2 text-[1.6rem]">{viewer.email}</h1></div>

      <div className="panel mt-4 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Email</span>
          <span className="text-sm font-medium">{viewer.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Plan</span>
          {viewer.level === "member" ? (
            <span className="badge-club">Member</span>
          ) : (
            <span className="chip">Free</span>
          )}
        </div>
        {viewer.level === "member" && user?.memberUntil && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-t3">Renews / valid until</span>
            <span className="text-sm font-medium">
              {user.memberUntil.toISOString().slice(0, 10)}
            </span>
          </div>
        )}
      </div>

      <div className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-6">
        {viewer.level === "member" ? (
          <>
            <div>
              <div className="font-semibold">Subscription</div>
              <p className="mt-1 text-xs text-t4">
                Update payment method, cancel, or view invoices.
              </p>
            </div>
            <PortalButton />
          </>
        ) : (
          <>
            <div>
              <div className="font-semibold">{SITE.club.cta}</div>
              <p className="mt-1 text-xs text-t4">
                Every breakdown, the founder playbooks, filters, and build specs.
              </p>
            </div>
            <Link href="/pricing" className="btn btn-club">
              {SITE.club.cta} — ${SITE.priceMonthly}/mo
            </Link>
          </>
        )}
      </div>

      {/* 会员库导出:让会员的 AI 读一个文件,而不是一页页翻网站(下载链接用普通 <a>,HoverLink 悬停预取会触发生成并计次) */}
      <div id="export" className={`${viewer.level === "member" ? "panel" : "panel-club"} mt-4 scroll-mt-24 p-6`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="font-semibold">Library export for your AI</div>
          {viewer.level !== "member" && <span className="badge-club">Members</span>}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-t4">
          Every idea and every section in one file, so your AI can answer questions across the whole library
          instead of reading it page by page. Updated as new ideas land.
        </p>
        {viewer.level === "member" ? (
          <>
            <div className="mt-4 grid gap-2.5">
              {EXPORTS.map((x) => (
                <a
                  key={x.format}
                  href={`/api/export?format=${x.format}`}
                  download
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-brand"
                  data-track="export_click"
                  data-track-format={x.format}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-t1">{x.title}</span>
                    <span className="block text-xs text-t3">{x.use}</span>
                  </span>
                  <span className="mono shrink-0 text-[0.72rem] text-brand">{x.size} ↓</span>
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-t3">
              Try asking: “List the 15 ideas a solo developer could launch in under a month with verified or
              founder-reported revenue above $5K/mo.” For your own research; please don&apos;t share the files.
            </p>
          </>
        ) : (
          // 上面订阅卡已经有入会大按钮,这里只给一条文字链,不在同一页摆两个一样的按钮
          <Link href="/pricing" className="link mt-3 inline-block text-sm" data-track="join_click" data-track-placement="account_export">
            Included in the {SITE.club.name} — ${SITE.priceMonthly}/mo →
          </Link>
        )}
      </div>

      {/* The Drop:会员每 3 天一封;开关同时管退订链接(users.notifyNewProjects) */}
      <div id="email" className="panel mt-4 flex scroll-mt-24 items-center justify-between gap-3 p-6">
        <div>
          <div className="font-semibold">The Drop email</div>
          <p className="mt-1 text-xs leading-relaxed text-t4">
            {viewer.level === "member"
              ? "Every 3 days, when 50–100 new ideas land: what's worth stealing from them, and the full list."
              : `Every 3 days, members get an email on the 50–100 newest ideas. Email alerts for free accounts are not active yet.`}
          </p>
        </div>
        {viewer.level === "member" ? (
          <NotifyToggle initial={user?.notifyNewProjects ?? true} />
        ) : (
          <span className="badge-club shrink-0">Members</span>
        )}
      </div>

      <div className="panel mt-4 p-6">
        <div className="font-semibold">Saved filters</div>
        <p className="mt-1 text-xs text-t4">
          Keep up to 5 filters for quick access. Matching email alerts are not active yet.
        </p>
        <div className="mt-3">
          <SavedFiltersList />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <SignOutButton redirectUrl="/">
          <button className="text-sm text-t4 hover:text-t2">Sign out</button>
        </SignOutButton>
        {viewer.isAdmin && (
          <Link href="/admin" className="text-sm text-t1 hover:underline">
            Admin →
          </Link>
        )}
      </div>
    </div>
  );
}
