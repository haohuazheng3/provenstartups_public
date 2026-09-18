/**
 * 博客分类架构。
 *
 * 每个分类页本身就是一个枢纽页(Pillar):有自己的目标关键词、一段真正有用的导读、
 * 链向全部子文章。分类页去吃头部词,文章去吃长尾 —— 不把头部词浪费在裸列表上。
 * 每个分类控制在 ≤20 篇,超出再分页(分页可抓取)。
 */
export const BLOG_CATEGORIES = [
  {
    slug: "startup-ideas",
    title: "Startup Ideas",
    play: "P01",
    /** 枢纽页目标词(与文章长尾不重叠) */
    targetKeyword: "small business ideas",
    blurb:
      "Business models that already print revenue, sorted by how hard they are to copy — not by how good they sound.",
  },
  {
    slug: "start-cheap",
    title: "Starting With Almost Nothing",
    play: "P02",
    targetKeyword: "side hustle from home",
    blurb:
      "What you can actually launch with no capital, no inventory, no audience, and a job you still have to keep.",
  },
  {
    slug: "digital-products",
    title: "Digital Products",
    play: "P03",
    targetKeyword: "best selling items on etsy",
    blurb:
      "Zero marginal cost, zero shipping, infinite copies. Also infinite competition — which is the part nobody writes about.",
  },
  {
    slug: "physical-products",
    title: "Physical Products",
    play: "P04",
    targetKeyword: "dropshipping clothing",
    blurb:
      "Handmade and sourced goods: real margins, real inventory risk, and the numbers sellers rarely publish.",
  },
  {
    slug: "print-on-demand",
    title: "Print on Demand",
    play: "P10",
    targetKeyword: "print on demand shirts",
    blurb:
      "Your design, someone else's printer, nobody's inventory. The margins are thin enough that the details decide it.",
  },
  {
    slug: "platform-guides",
    title: "Platform Guides",
    play: "P05",
    targetKeyword: "how to sell on etsy",
    blurb:
      "Etsy, Shopify, KDP, Printify — what each platform actually takes, and the setup steps that matter.",
  },
  {
    slug: "shop-operations",
    title: "Running the Shop",
    play: "P06",
    targetKeyword: "etsy seo",
    blurb:
      "Naming, photos, listings, pricing, ads. The unglamorous work that separates a shop from a hobby.",
  },
  {
    slug: "revenue-reality",
    title: "Revenue Reality",
    play: "P07",
    targetKeyword: "etsy fee calculator",
    blurb:
      "What these businesses really make after fees, and where the published numbers stop being trustworthy.",
  },
  {
    slug: "who-its-for",
    title: "Who It's For",
    play: "P08",
    targetKeyword: "side hustle for stay at home moms",
    blurb:
      "Matched to the time, capital, and skills you actually have — including the honest answer when nothing fits.",
  },
  {
    slug: "risks-and-rules",
    title: "Risks & Rules",
    play: "P09",
    targetKeyword: "is dropshipping worth it",
    blurb:
      "Saturation, bans, taxes, copyright. The reasons these businesses fail, stated before you spend money.",
  },
  // ── 开发者 / vibe coder / 一人创业者向的九个板块 ──
  // 枢纽词只绑经精确查量验证过的;没有合适词的板块(saas-metrics)老实做索引页,
  // 硬塞一个词会和板块内的文章互抢 SERP。
  {
    slug: "vibe-coding",
    title: "Vibe Coding",
    play: "D01",
    targetKeyword: "vibe coders",
    blurb:
      "Prompting an AI until it works is now a real way to ship a product. Here is what the people doing it actually earn — and where it stops working.",
  },
  {
    slug: "ai-coding-tools",
    title: "AI Coding Tools",
    play: "D02",
    targetKeyword: "claude code",
    blurb:
      "Claude Code, Cursor, Lovable, Bolt, Replit. Ranked not by feature list but by how many shipped products with real revenue came out of each one.",
  },
  {
    slug: "ai-agencies",
    title: "AI Agencies & Agents",
    play: "D03",
    targetKeyword: "ai automation business",
    blurb:
      "What AI service businesses actually charge, deliver, and keep. The retainer numbers nobody puts in their pitch deck.",
  },
  {
    slug: "saas-metrics",
    title: "SaaS Metrics",
    play: "D04",
    targetKeyword: "",
    blurb:
      "MRR, churn, CAC, LTV, burn — defined against real figures from one-person products, not enterprise benchmarks that do not apply to you.",
  },
  {
    slug: "solo-founders",
    title: "Solo & Bootstrapped",
    play: "D05",
    targetKeyword: "solo entrepreneur",
    blurb:
      "246 of the products indexed here are run by one person. This is the income distribution, including the part where most of them make very little.",
  },
  {
    slug: "build-and-ship",
    title: "Build & Ship",
    play: "D06",
    targetKeyword: "company boilerplate examples",
    blurb:
      "Boilerplate, extensions, no-code builders. The scaffolding that got real products out the door, and the time it actually saved.",
  },
  {
    slug: "side-income",
    title: "Side Income",
    play: "D07",
    targetKeyword: "how to earn side income",
    blurb:
      "Digital products and side projects for people who can already build. Sorted by return on the hours, not by how good the pitch sounds.",
  },
  {
    slug: "launch-and-growth",
    title: "Launch & Growth",
    play: "D08",
    targetKeyword: "content marketing saas",
    blurb:
      "Pricing, SEO, Product Hunt, selling the thing. What worked for products with no marketing budget and no audience.",
  },
  {
    slug: "built-with-ai",
    title: "Built With AI",
    play: "D09",
    targetKeyword: "ai coding assistant",
    blurb:
      "Every indexed product grouped by the tool that built it, with its revenue figure and evidence grade attached.",
  },
  // ── 第四轮:按商业模型问"到底赚多少"。这四个板块的枢纽词一律留空 ──
  // 聚类做彻底之后,同簇里已经没有未被文章占用的达标词了。硬塞一个,分类页就会
  // 和自己板块内的文章抢同一批 SERP 位置 —— saas-metrics 上一轮就是这么处理的。
  // 分类页照样按枢纽页建设(导读 + 全量子文章链接 + 面包屑),只是不认领目标词。
  {
    slug: "what-it-really-pays",
    title: "What It Really Pays",
    play: "E01",
    targetKeyword: "",
    blurb:
      "The median, not the highlight reel. Every model in the index with its real monthly figure, the full spread, and how much each number is worth as evidence.",
  },
  {
    slug: "app-revenue",
    title: "App Revenue",
    play: "E02",
    targetKeyword: "",
    blurb:
      "What apps earn after the store takes its cut — build costs, revenue models, and the disclosed figures behind them.",
  },
  {
    slug: "blogs-and-affiliate",
    title: "Blogs & Affiliate",
    play: "E03",
    targetKeyword: "",
    blurb:
      "Traffic only becomes income through a handful of mechanisms. Here is which one carries the money, and what the sites running it actually report.",
  },
  {
    slug: "store-economics",
    title: "Store Economics",
    play: "E04",
    targetKeyword: "",
    blurb:
      "Shopify, Etsy, dropshipping — every fee counted, then compared against what the stores that disclose their numbers actually keep.",
  },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export type BlogImage = {
  url: string;
  alt: string;
  photographer?: string;
  creditUrl?: string;
};

export type BlogPost = {
  slug: string;
  category: BlogCategory["slug"];
  title: string;
  description: string;
  published: string; // ISO date
  updated?: string;
  /** 绑定的关键词(主词在前),用于内部核对,不渲染 */
  keywords?: string[];
  /** Pexels 配图 2-3 张,带摄影师署名 */
  images?: BlogImage[];
  /** 从正文抽出的 FAQ,喂 FAQPage schema */
  faqs?: { q: string; a: string }[];
  body: string; // markdown
};

/**
 * 文章从 src/content/blog/<category>/<slug>.json 读。
 * 不塞进这个数组 —— 200 篇会让单个 TS 文件涨到 1.6MB,构建和编辑都难受。
 */
function loadPosts(): BlogPost[] {
  // 只在 server 端跑;client bundle 里 fs 不存在
  if (typeof window !== "undefined") return [];
  // 这里必须同步读盘(模块顶层就要拿到 BLOG_POSTS),而 import() 是异步的;
  // 又不能用顶层静态 import —— 那会把 fs 打进 client bundle 直接构建失败。
  // 所以 require 是唯一可行解,定向豁免而不是关掉整条规则。
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const root = path.join(process.cwd(), "src", "content", "blog");
  if (!fs.existsSync(root)) return [];
  const out: BlogPost[] = [];
  for (const cat of fs.readdirSync(root)) {
    const dir = path.join(root, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const post = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as BlogPost & {
          bodyFile?: string;
        };
        // Large research assets keep their prose in a sibling Markdown file so the
        // downloadable data, metadata, and article body can each be reviewed cleanly.
        if (post.bodyFile) {
          post.body = fs.readFileSync(path.join(dir, post.bodyFile), "utf8");
        }
        out.push(post);
      } catch {
        // 单篇坏掉不该拖垮整个博客
      }
    }
  }
  return out;
}

export const BLOG_POSTS: BlogPost[] = loadPosts();

export function postsByCategory(cat: string) {
  return BLOG_POSTS.filter((p) => p.category === cat).sort((a, b) =>
    b.published.localeCompare(a.published)
  );
}

export function getPost(cat: string, slug: string) {
  return BLOG_POSTS.find((p) => p.category === cat && p.slug === slug) ?? null;
}

export function categoryBySlug(slug: string) {
  return BLOG_CATEGORIES.find((c) => c.slug === slug) ?? null;
}
