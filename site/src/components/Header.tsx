import Link from "next/link";
import Logo from "./Logo";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";

export default async function Header() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      {/* 窄屏收紧间距:390px 下 gap-4 会让右侧操作区溢出,整页能被横向拖动 */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-5 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-[0.95rem] font-medium tracking-[-0.015em] text-t1"
        >
          <Logo size={20} />
          <span className="hidden sm:inline">ProvenStartups</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          <Link href="/projects" className="btn btn-quiet">
            Ideas
          </Link>
          <Link href="/pricing" className="btn btn-quiet" data-track="pricing_nav_click">
            Pricing
          </Link>
          {/* .btn 会压过 hidden —— 响应式显隐放在外层 span 上 */}
          <span className="hidden sm:inline-flex">
            <Link href="/how-it-works" className="btn btn-quiet">
              Method
            </Link>
          </span>
          <span className="hidden md:inline-flex">
            <Link href="/blog" className="btn btn-quiet">
              Blog
            </Link>
          </span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {viewer.level === "guest" ? (
            <Link href="/pricing" className="btn btn-club" data-track="join_click" data-track-placement="header">
              <span className="sm:hidden">Unicorn Club</span>
              <span className="hidden sm:inline">{SITE.club.cta}</span>
            </Link>
          ) : (
            <>
              {viewer.level === "member" ? (
                <span className="badge-club">Unicorn</span>
              ) : (
                <Link href="/pricing" className="btn btn-club" data-track="join_click" data-track-placement="header">
                  <span className="sm:hidden">Unicorn Club</span>
                  <span className="hidden sm:inline">{SITE.club.cta}</span>
                </Link>
              )}
              <Link href="/account" className="btn">
                Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
