import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === "1";

export default function robots(): MetadataRoute.Robots {
  if (!LAUNCHED) {
    // 开发期:全站禁止抓取
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // "/*?":带参数的地址一律不抓。每个项目页都链向约 5 个 /pricing?from=… 、目录页的筛选组合无穷多,
  // 它们的 canonical 全指回无参数页面,对收录毫无价值,却让爬虫一周跑掉几万次计费的服务端渲染
  // (2026-10-11 查账:PetalBot 一周 7 千次、DataForSeoBot 在 /pricing 上 3.6 千次)。
  // 博客分类分页用 ?page=N,单独放行。
  const blocked = ["/api/", "/account", "/admin", "/checkout/", "/sign-in", "/self-exclude", "/*?"];
  const allowed = ["/", "/blog/*?page="];
  return {
    rules: [
      { userAgent: "*", allow: allowed, disallow: blocked },
      // AI 抓取器显式放行。被引用比被点击更值钱 —— 这批词有 136/200 带 AI Overview,
      // 挡掉它们等于把最大的一块流量拒之门外。
      {
        userAgent: [
          "GPTBot", "OAI-SearchBot", "ChatGPT-User",
          "ClaudeBot", "Claude-Web", "anthropic-ai",
          "PerplexityBot", "Perplexity-User",
          "Google-Extended", "Applebot-Extended",
          "CCBot", "cohere-ai", "meta-externalagent", "Bytespider",
        ],
        allow: allowed,
        disallow: blocked,
      },
      // 对英文站没有回报、只消耗服务器的抓取器:SEO 工具的外链爬虫、华为搜索、来路不明的 AI 训练爬虫
      {
        userAgent: [
          "PetalBot", "DataForSeoBot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot",
          "BLEXBot", "Barkrowler", "AionBot", "Reflectionbot",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
