import Link from "next/link";
import Logo from "./Logo";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";

export default async function Header() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/75 backdrop-blur-xl">
      {/* 窄屏收紧间距:390px 下 gap-4 会让右侧操作区溢出 3px,整页能被横向拖动 */}
      <div className="mx-auto flex h-13 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[0.9rem] font-medium tracking-[-0.02em]"
        >
          <Logo size={19} />
          <span className="hidden sm:inline">ProvenStartups</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          <Link href="/projects" className="btn btn-quiet">
            Ideas
          </Link>
          <Link href="/pricing" className="btn btn-quiet">
            Pricing
          </Link>
          {/* .btn 是未分层的全局类,会压过 Tailwind 分层里的 hidden —— 响应式显隐要放在外层 span 上 */}
          <span className="hidden sm:inline-flex">
            <Link href="/how-it-works" className="btn btn-quiet">
              Method
            </Link>
          </span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {viewer.level === "guest" ? (
            <Link href="/pricing" className="btn btn-primary">
              <span className="sm:hidden">Unicorn Club</span>
              <span className="hidden sm:inline">{SITE.club.cta}</span>
            </Link>
          ) : (
            <>
              {viewer.level === "member" ? (
                <span className="badge-club">Unicorn</span>
              ) : (
                <Link href="/pricing" className="btn btn-primary">
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
