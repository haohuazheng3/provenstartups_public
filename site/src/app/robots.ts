import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === "1";

export default function robots(): MetadataRoute.Robots {
  if (!LAUNCHED) {
    // 开发期:全站禁止抓取
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const blocked = ["/api/", "/account", "/admin", "/checkout/", "/sign-in", "/self-exclude"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: blocked },
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
        allow: "/",
        disallow: blocked,
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
