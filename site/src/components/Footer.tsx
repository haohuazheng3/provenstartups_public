import Link from "next/link";
import Logo from "./Logo";
import FeaturedOn from "./FeaturedOn";
import { SITE, SOCIAL } from "@/lib/site";

/**
 * 官方账号图标。刻意用极简单色路径 —— 品牌色只留给金额与主按钮。
 * 这张表是 SOCIAL 的超集(X / Medium / Quora 目前不在 SOCIAL 里,见 lib/site.ts),
 * 查不到就 return null,多留几条不渲染也不报错。
 */
const ICONS: Record<string, string> = {
  X: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  LinkedIn:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z",
  GitHub:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  Medium:
    "M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12",
  Reddit:
    "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0zm4.388 3.199a1.999 1.999 0 1 1-1.947 2.46v.002a2.37 2.37 0 0 0-2.104 2.354v.02c1.201.026 2.4.323 3.485.877.398-.4.937-.625 1.5-.625 1.209 0 2.188.98 2.188 2.188 0 .885-.53 1.679-1.34 2.019a3.68 3.68 0 0 1 .045.51c0 2.649-3.033 4.797-6.771 4.797s-6.77-2.148-6.77-4.797a3.6 3.6 0 0 1 .043-.508c-.81-.34-1.34-1.134-1.34-2.02 0-1.208.98-2.187 2.188-2.187.564 0 1.104.225 1.5.625a9.48 9.48 0 0 1 3.51-.877v-.02a3.62 3.62 0 0 1 3.322-3.6 2 2 0 0 1 1.49-1.218zM9.25 12a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm5.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z",
  Pinterest:
    "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.53.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
  Quora:
    "M7.3 21.7c-2.2 0-4-.8-5.4-2.3C.6 17.8 0 15.9 0 13.6c0-2.3.6-4.2 1.9-5.7C3.3 6.4 5.1 5.6 7.3 5.6c2.2 0 4 .8 5.3 2.3 1.3 1.5 2 3.4 2 5.7 0 1.5-.3 2.8-.8 4l1.7 1.9c.3.4.5.8.5 1.2 0 .3-.1.6-.3.8-.2.2-.5.3-.8.3-.4 0-.8-.2-1.2-.6l-1.5-1.7c-1.3 1.5-2.9 2.2-4.9 2.2zm0-2.9c1 0 1.8-.3 2.5-1L8 15.9c-.3-.3-.4-.6-.4-.9 0-.3.1-.6.3-.8.2-.2.5-.3.8-.3.4 0 .8.2 1.2.6l1.6 1.8c.2-.6.3-1.4.3-2.3 0-1.6-.3-2.9-1-3.9-.7-1-1.6-1.5-2.8-1.5-1.2 0-2.1.5-2.8 1.5-.7 1-1 2.3-1 3.9 0 1.6.3 2.9 1 3.9.7.9 1.6 1.4 2.8 1.4zM24 18.4c0 1.2-.4 2.1-1.1 2.7-.7.6-1.7.9-2.9.9-2.4 0-3.9-1.3-4.5-3.9l2.5-.6c.4 1.3 1 2 1.9 2 .4 0 .7-.1.9-.4.2-.2.3-.6.3-1V3.4h2.9v15z",
};

function SocialIcon({ name }: { name: string }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/projects", label: "All ideas" },
      { href: "/pricing", label: "Pricing" },
      { href: "/how-it-works", label: "Method" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refunds", label: "Refunds" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-6">
        <div>
          <Link href="/" className="flex items-center gap-2 text-[0.88rem] font-medium">
            <Logo size={18} />
            <span>ProvenStartups</span>
          </Link>
          <p className="mt-3 max-w-[15rem] text-[0.78rem] leading-relaxed text-t3">
            Startup ideas with revenue receipts, reverse-engineered from founder interviews.
          </p>
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="mono mt-4 inline-block text-[0.72rem] text-t3 transition-colors hover:text-t1"
          >
            {SITE.contactEmail}
          </a>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <div className="label">{c.title}</div>
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[0.8rem] text-t2 transition-colors hover:text-t1"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 官方账号 —— 与 Organization schema 的 sameAs 同源(lib/site.ts 的 SOCIAL) */}
      <div className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="label">Official accounts</div>
          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            {SOCIAL.map((s) => (
              <li key={s.name}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener me"
                  className="flex items-center gap-1.5 text-[0.78rem] text-t3 transition-colors hover:text-t1"
                >
                  <SocialIcon name={s.name} />
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <FeaturedOn />

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <span className="mono text-[0.7rem] text-t4">
            © {new Date().getFullYear()} {SITE.name}
          </span>
          <span className="mono text-[0.7rem] text-t4">No fabricated numbers. Ever.</span>
        </div>
      </div>
    </footer>
  );
}
