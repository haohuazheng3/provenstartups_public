import { BLOG_POSTS, type BlogPost } from "@/lib/blog";

/**
 * 项目页 → 博客的"这个点子该读哪篇":按项目用的工具、所属类别各挑一篇最对口的文章,
 * 再加一篇"照抄之前先验证"。1,012 个项目页都带上这几条链接,既给读者一个顺手的下一步,
 * 也把站内权重导给真正承接搜索流量的文章(2026-10-11 前 20 篇曝光页整改的一部分)。
 * 只链接现存文章;映射里的文章被退役了也不会出死链。
 */
// 顺序就是优先级:一个项目带多个工具时,先指向最能代表"它是怎么做出来的"那篇(AI 编程/建站工具 > 形态 > 基础设施)
const TOOL_GUIDE: Record<string, string> = {
  "claude-code": "built-with-ai/apps-built-with-claude-code",
  cursor: "built-with-ai/apps-built-with-cursor",
  lovable: "built-with-ai/apps-built-with-lovable",
  codex: "built-with-ai/apps-built-with-codex",
  bolt: "built-with-ai/apps-built-with-bolt-new",
  replit: "built-with-ai/apps-built-with-replit",
  bubble: "built-with-ai/apps-built-with-bubble",
  windsurf: "ai-coding-tools/what-is-windsurf-ai-revenue-evidence",
  n8n: "built-with-ai/apps-built-with-n8n",
  "chrome-extension": "build-and-ship/chrome-extension-examples",
  expo: "built-with-ai/mobile-apps-built-with-expo-react-native",
  revenuecat: "built-with-ai/mobile-apps-built-with-expo-react-native",
  elevenlabs: "built-with-ai/voice-apps-built-with-elevenlabs",
  gemini: "built-with-ai/apps-built-with-gemini",
  chatgpt: "built-with-ai/apps-built-with-chatgpt",
  supabase: "built-with-ai/apps-built-with-supabase",
  firebase: "built-with-ai/apps-built-with-firebase",
  webflow: "built-with-ai/businesses-built-with-webflow",
  framer: "build-and-ship/webflow-vs-framer",
  zapier: "ai-agencies/n8n-vs-zapier",
  make: "ai-agencies/n8n-vs-zapier",
  nextjs: "built-with-ai/apps-built-with-nextjs",
  shopify: "built-with-ai/shopify-stores-and-apps-built-with-ai",
  wordpress: "blogs-and-affiliate/niche-website-examples",
};

const CATEGORY_GUIDE: Record<string, string> = {
  "Directory Site": "startup-ideas/directory-website-revenue",
  "Digital Publishing": "blogs-and-affiliate/niche-website-examples",
  "AI Content": "built-with-ai/ai-content-business-revenue-examples",
  "AI Service": "ai-agencies/consulting-business-ideas",
  "AI Website": "built-with-ai/chatgpt-wrapper-revenue",
  "AI E-commerce": "built-with-ai/shopify-stores-and-apps-built-with-ai",
  "Consumer App": "app-revenue/app-that-make-money",
  SaaS: "saas-metrics/micro-saas-examples-with-revenue",
  "Scale Reference": "startup-ideas/business-model-examples",
  "⚠️ Cautionary Tale": "risks-and-rules/startups-that-failed-after-making-money",
};

const VALIDATE = "launch-and-growth/how-to-validate-business-idea";

const byPath = new Map(BLOG_POSTS.map((p) => [`${p.category}/${p.slug}`, p]));

export function guidesForProject(tools: string[] | null | undefined, category: string): BlogPost[] {
  const paths: string[] = [];
  const tool = Object.keys(TOOL_GUIDE).find((t) => (tools ?? []).includes(t));
  if (tool) paths.push(TOOL_GUIDE[tool]);
  if (CATEGORY_GUIDE[category]) paths.push(CATEGORY_GUIDE[category]);
  paths.push(VALIDATE);
  return [...new Set(paths)].map((p) => byPath.get(p)).filter((p): p is BlogPost => !!p).slice(0, 3);
}
