export const SITE = {
  name: "ProvenStartups",
  domain: "provenstartups.com",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://provenstartups.com",
  tagline: "AI startup ideas with revenue receipts",
  description:
    "A directory of AI business ideas reverse-engineered from founder interviews and creator breakdowns, each graded by the evidence behind its numbers — with revenue figures, playbooks, and full source receipts.",
  priceMonthly: 10,
  adminEmail: "haohuazheng001@gmail.com",
  contactEmail: "contact@provenstartups.com",
  // 游客可完整浏览的项目数(其余锁定)
  guestVisibleCount: 50,
  // 游客在详情页可读的拆解小节数
  guestDeepDiveSections: 1,
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
