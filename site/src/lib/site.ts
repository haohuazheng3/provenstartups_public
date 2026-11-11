// 非会员能读的开放项目数(见下方 guestVisibleCount)。单独拎出来,权益栏的文案也从它读,免得改了数字文案没跟上
const GUEST_OPEN = 20;

export const SITE = {
  name: "ProvenStartups",
  domain: "provenstartups.com",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://provenstartups.com",
  tagline: "AI startup ideas with revenue receipts",
  description:
    "A directory of AI business ideas reverse-engineered from founder interviews and creator breakdowns, each graded by the evidence behind its numbers — with revenue figures, playbooks, and full source receipts.",
  priceMonthly: 5,
  // 会员制文案的唯一事实源(定价页 / 升级卡 / Header / 成功页都从这里读,不允许另写一份)
  club: {
    name: "Unicorn Club",
    // 2026-09-23 用户要求:措辞用 "Join the Unicorn Club",给归属感;所有按钮都从这里读,不允许手写
    cta: "Join the Unicorn Club",
    // 2026-09-22 改为俱乐部制:游客与免费账号同视野,只有会员看全部。
    // 之前"免费账号解锁全部"三个月里 8 个注册 0 付费 —— 免费给得太多,Pro 卖的东西没人见过。
    // 2026-11-06 墙改到段落上:每个项目都公开(01 故事、06 以后、收入、来源与原话),
    // 只有 02–05 四段固定的创始人手册归会员;不再有"前 50 篇全免费"、也不再有会员专供项目。
    // 依据是 8 位付费会员的阅读记录:02 是会员停留最久的一段(22%),03 其次(14%);速览卡、构建提示词各 3%。
    // 2026-11-11 两层墙(站长定):改版后 4 天 0 付费(之前约 1 笔/天),8 位会员里 5 位是在目录页
    // 看到"只开放前 N 个、其余锁着"才付的。所以恢复项目层的锁,只开放前 guestVisibleCount 个;
    // 段落层的锁保留 —— 开放的那 20 个里 02–05 照样锁。
    pitch: "Every breakdown, every filter, every build spec. One membership.",
    perks: [
      `All ideas, every section — not just the ${GUEST_OPEN} open ones`,
      "Founder playbooks on every idea: first customers from zero, the first dollar, what turned the flywheel, the silent stretch",
      "Quick-reference card on every idea: acquisition channels, replication playbook, risks & traps, our verdict",
      // 2026-10-14 站长要求写进权益栏:会员专属库导出,方便会员自己的 AI 分析,也当钩子
      "Library export for your AI: every idea in one Markdown, JSON or CSV file to analyze in ChatGPT, Claude or Codex",
      // 2026-10-14 站长要求:会员每 3 天收到一期 The Drop(新入库 50–100 个项目的看点),写进权益栏当钩子
      "The Drop: 50–100 new ideas every 3 days, with an email on what's worth stealing from them",
      "Pain-point filters: verified only, solo-buildable, first revenue in weeks, by country and tool",
      "Build specs: 10 tailored, paste-into-Claude-Code specs a week",
    ],
    // 会员专属的拆解段号。1,403 个项目全都有 01–05,02–05 的标题完全一致(2026-11-06 核过库),按段号锁不会漏。
    // 01(完整故事)与 06 以后对所有人开放;锁住的段非会员只见标题 + 开头两句 + 词形条(见 LockedSection)。
    lockedSections: ["02", "03", "04", "05"],
    // 定价页/FAQ/llms.txt 里描述这四段的统一说法
    lockedSectionsLabel: "first customers, first dollar, the flywheel, the silent stretch",
    // 2026-09-23 用户决定:全站不承诺退款,任何页面不出现退款字样;只保留"随时一键取消"
    guarantee: "Cancel anytime, in one click",
  },
  // 非会员(游客 = 免费账号 = 爬虫)能读的开放项目数:按 rank 前 20。这 20 个公开 01 + 06 以后,02–05 照样锁;
  // 其余项目非会员只读 01 + 收入/证据/来源/原话,02–05 给开头两句,06 以后只露标题。(2026-11-11)
  guestVisibleCount: GUEST_OPEN,
  adminEmail: "haohuazheng001@gmail.com",
  contactEmail: "contact@provenstartups.com",
  // 构建功能配额:成本账见 docs/plan-2026-09-22-club.md(Sonnet 5 ≈ $0.06/次,$5 会员费净 $4.56)
  buildsPerWeek: 10,
  buildsPerMonthCap: 40,
} as const;

/**
 * 官方账号。这是唯一事实源 —— footer 的「官方账号」区和 Organization schema 的
 * sameAs 都从这里读,不允许任何页面另写一份 URL。
 *
 * 这些外链是 nofollow 的,目的不是传权重,而是让 Google 与 AI 确认:这些账号与
 * 官网是同一个实体。所以品牌名写法与描述在每个平台必须逐字一致(见 seo.md 品牌资产包)。
 *
 * **只挂品牌官方号。** 站长个人名下的账号(X @zheng_haohua、Medium @haohuazheng001、
 * Quora Haohua-Zheng-1)即使发过本站内容也不放进来 —— sameAs 声明的是"这是同一个
 * 实体",把个人号混进去等于告诉 Google 品牌实体就是这个人,反而稀释品牌实体。
 * 那几个账号照常带 bio 链接与正文链接,只是不进 sameAs。
 */
export const SOCIAL = [
  { name: "LinkedIn", handle: "ProvenStartups", url: "https://www.linkedin.com/company/provenstartups/" },
  { name: "GitHub", handle: "ProvenStartups", url: "https://github.com/ProvenStartups" },
  { name: "Reddit", handle: "u/ProvenStartups", url: "https://www.reddit.com/user/ProvenStartups/" },
  { name: "Pinterest", handle: "ProvenStartups", url: "https://www.pinterest.com/ProvenStartups/" },
] as const;
