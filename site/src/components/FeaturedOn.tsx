/**
 * 目录站徽章区。多数目录的免费收录以「站点回链」为条件 —— 这一区就是履约的地方。
 *
 * 加一家的规矩:
 * 1. 只在**该目录确实收录了我们**之后加,不预挂 —— 挂了却没收录是假社会证明。
 * 2. `href` 指向该目录给的产品页(不是它的首页),`img` 用它自己托管的徽章图。
 * 3. 徽章链接对外一律 dofollow(不加 rel="nofollow") —— 这是双向交换的对价。
 *    但要 `loading="lazy"`,不让第三方图拖慢 LCP。
 * 4. 加完必须部署并线上确认可见,再回目录站点提交 —— 它们会自动核链。
 *
 * 台账在 dofollow.md(gitignored)。
 */

type Badge = {
  /** 目录站名字,做 alt 与 title */
  name: string;
  /** 我们在该目录的产品页 */
  href: string;
  /** 目录站托管的徽章图 */
  img: string;
  width: number;
  height: number;
};

/**
 * Tiny Startups 不托管徽章图,它给的 embed 是一段自带内联 SVG 的 HTML。
 * 图形与 href 逐字来自它后台的 "Copy embed code",只把外框尺寸缩到这一行的 38px。
 */
const TINY_STARTUPS = {
  name: "Tiny Startups",
  href: "https://www.tinystartups.com/startup/provenstartups",
  mark: "M50 6C52 32 68 48 94 50C68 52 52 68 50 94C48 68 32 52 6 50C32 48 48 32 50 6Z",
};

const BADGES: Badge[] = [
  {
    // href 与 img 逐字来自 Startup Fame 后台的 "Get embed code",不要手改 —— 它们按这个串核链
    name: "Startup Fame",
    href: "https://startupfa.me/s/provenstartups.com-18?utm_source=provenstartups.com",
    img: "https://startupfa.me/badges/featured/default.webp",
    width: 171,
    height: 54,
  },
  {
    name: "Turbo0",
    href: "https://turbo0.com/item/provenstartups",
    img: "https://img.turbo0.com/badge-listed-light.svg",
    width: 171,
    height: 54,
  },
  {
    // Smol Launch 的 embed code 指向它的首页(不是产品页),逐字照抄 —— 它按这个串核链
    name: "Smol Launch",
    href: "https://smollaunch.com",
    img: "https://smollaunch.com/badges/featured.svg",
    width: 250,
    height: 60,
  },
  {
    // Unite List 的核链要求:徽章必须指向这个收录页 URL(它在提交流程里当场生成)
    name: "Unite List",
    href: "https://unitelist.com/product/provenstartups",
    img: "https://unitelist.com/assets/images/badge.png",
    width: 166,
    height: 54,
  },
  {
    // Twelve Tools 的 embed code 指向它的首页(它按这个串核链);四款徽章里只有 "Featured on"
    // 属实,另外三款("#1 Product"/"Best Product"/"Top Startup")是我们没有的名次,不用
    name: "Twelve Tools",
    href: "https://twelve.tools",
    img: "https://twelve.tools/badge0-white.svg",
    width: 148,
    height: 40,
  },
  {
    // Wired Business 的 embed code 指向它的首页(它按这个串核链)。六款徽章是两套文案
    // ×三种配色:badge0 是 "Featured on"(属实),badge1 是 "#1 Product"(我们没有这个
    // 名次,不用)。白底版配我们的浅色页脚
    name: "Wired Business",
    href: "https://wired.business",
    img: "https://wired.business/badge0-white.svg",
    width: 200,
    height: 54,
  },
  {
    // startuups.com 免费档的回链默认只给当周前三;挂这条徽章才换永久 dofollow。
    // href/img 里的双斜杠是它 embed code 的原样(它按这个串核链),两个 URL 都 308
    // 到单斜杠版本,能正常访问 —— 不手改
    name: "startuups.com",
    href: "https://startuups.com/projects/provenstartups",
    img: "https://startuups.com/images/badges/startuupscom.badge.svg",
    width: 150,
    height: 54,
  },
  {
    // Startups.fm 免费档的留存条件就是这条徽章;href/img 逐字来自成功页的 embed code
    name: "Startups.fm",
    href: "https://startups.fm/startups/provenstartups",
    img: "https://startups.fm/badge/provenstartups",
    width: 240,
    height: 63,
  },
  {
    // We Like Tools 的核链发生在填表之前:徽章必须指向它当场生成的这个收录页 URL,
    // 核过才解锁 Details 表单。两款徽章只是明暗配色,浅色版配我们的页脚
    name: "We Like Tools",
    href: "https://weliketools.com/tool/provenstartups",
    img: "https://weliketools.com/assets/images/badge.png",
    width: 205,
    height: 54,
  },
];

export default function FeaturedOn() {
  if (BADGES.length === 0) return null;

  return (
    <div className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="label">Featured on</div>
        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {BADGES.map((b) => (
            <li key={b.name}>
              <a href={b.href} target="_blank" rel="noopener" title={b.name}>
                {/* next/image 会代理第三方图并改写尺寸,目录站核链时抓不到自己的图。
                    徽章必须是原始 <img> 指向它们自己的 CDN。 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.img}
                  alt={`${b.name} — featured badge`}
                  width={b.width}
                  height={b.height}
                  loading="lazy"
                  className="h-[38px] w-auto opacity-90 transition-opacity hover:opacity-100"
                />
              </a>
            </li>
          ))}
          <li>
            <a
              href={TINY_STARTUPS.href}
              target="_blank"
              rel="noopener"
              title={TINY_STARTUPS.name}
              className="inline-flex h-[38px] items-center gap-2 opacity-90 transition-opacity hover:opacity-100"
            >
              <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <linearGradient id="tsg" x1=".1" y1="0" x2=".9" y2="1">
                    <stop offset="0%" stopColor="#3525E6" />
                    <stop offset="55%" stopColor="#D81FE0" />
                    <stop offset="100%" stopColor="#22B8F0" />
                  </linearGradient>
                </defs>
                <path d={TINY_STARTUPS.mark} fill="url(#tsg)" />
              </svg>
              <span className="flex flex-col leading-tight">
                <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Launched on
                </span>
                <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
                  Tiny Startups
                </span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
