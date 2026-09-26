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
    pitch: "Every breakdown, every filter, every build spec. One membership.",
    perks: [
      "All ideas — every breakdown, every section",
      "Founder playbooks: first customers, first dollar, flywheel, the silent stretch",
      "Pain-point filters: verified only, solo-buildable, first revenue in weeks, by country and tool",
      "Build specs: 10 tailored, paste-into-Claude-Code specs a week",
      "Full source transcripts and receipts",
      "New ideas every week, with an email when they land",
    ],
    // 2026-09-23 用户决定:全站不承诺退款,任何页面不出现退款字样;只保留"随时一键取消"
    guarantee: "Cancel anytime, in one click",
  },
  adminEmail: "haohuazheng001@gmail.com",
  contactEmail: "contact@provenstartups.com",
  // 非会员(游客与免费账号)可完整浏览的项目数(其余锁定,只对会员开放)
  guestVisibleCount: 50,
  // 非会员在详情页可读的拆解小节数(01 全文故事;02–05 固定模块与其后全部只对会员开放)
  guestDeepDiveSections: 1,
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
