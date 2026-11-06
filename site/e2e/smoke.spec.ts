import { test, expect, type Page } from "@playwright/test";

/**
 * 生产冒烟。全部只读 —— 不提交表单、不发起支付、不写任何数据。
 * 覆盖上线审计定下的关键路径,外加几条当时实测踩到的坑作回归。
 */

/**
 * 等 React 水合完成再交互。Analytics 在 useEffect 里挂 window.psTrack,它出现就说明整棵树已经提交。
 * 不等的话:原生 <details> 在水合前被点开,水合重渲染又把它关上 —— 并发跑满时偶发失败(2026-09-29 手机端出现过一次)。
 */
async function hydrated(page: Page) {
  await page.waitForFunction(() => typeof (window as { psTrack?: unknown }).psTrack === "function");
}

const LEGAL = ["/privacy", "/terms", "/refunds"];
const PUBLIC = ["/", "/projects", "/pricing", "/blog", "/about", "/faq", "/how-it-works", "/contact"];
const REVENUE_ARTICLES = [
  "/blog/app-revenue/picturethis-app-revenue",
  "/blog/revenue-reality/algolia-revenue",
  "/blog/revenue-reality/calendly-revenue",
  "/blog/revenue-reality/deel-revenue",
  "/blog/revenue-reality/elevenlabs-revenue",
  "/blog/revenue-reality/genspark-revenue",
  "/blog/revenue-reality/heygen-revenue",
  "/blog/revenue-reality/hyros-revenue",
  "/blog/revenue-reality/jenni-ai-revenue",
  "/blog/revenue-reality/photoroom-revenue",
];

test.beforeEach(async ({ context, baseURL }) => {
  const url = new URL(baseURL!);
  await context.addCookies([
    {
      name: "ps_exclude",
      value: "1",
      domain: url.hostname,
      path: "/",
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
    {
      name: "fw_exclude",
      value: "1",
      domain: url.hostname,
      path: "/",
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
});

test.describe("关键路径", () => {
  test("首页筛选面板对游客完整展示,点选项才弹入会提示", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    const panel = page.locator("div").filter({ hasText: "Find your idea" }).first();
    await expect(panel.getByText("Filter by what actually matters to you")).toBeVisible();
    // 折叠式面板:先点组标题展开,再点选项
    await panel.getByRole("button", { name: /^Evidence/ }).click();
    const chip = panel.getByRole("button", { name: /^Third-party verified/ });
    await expect(chip).toBeVisible();
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // 弹窗标题是命中数("N ideas match Third-party verified"),并给不付费的人一个免费的下一步
    await expect(dialog.getByRole("heading")).toContainText(/\d+ ideas? match/);
    await expect(dialog.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Sign in/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Save this filter — free/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("首页可达且承载核心承诺", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ProvenStartups/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // 首页必须有 canonical 与 JSON-LD(审计时两者都缺)
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)["@graph"].some((n: { "@type": string }) => n["@type"] === "Organization")).toBe(true);
  });

  test("目录页列出项目并可进详情", async ({ page }) => {
    await page.goto("/projects");
    const first = page.locator('a[href^="/projects/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("目录筛选菜单不被裁切且游客页保持可浏览", async ({ page }) => {
    await page.goto("/projects");
    await hydrated(page);
    await page.getByText("Category ↓", { exact: true }).click();
    await expect(page.getByRole("link", { name: "AI Service", exact: true })).toBeVisible();
    // 2026-11-06 起游客也看到全部行(之前是 50 + 6 个预览);锁在详情页的 02–05 段上
    expect(await page.locator(".row").count()).toBeGreaterThan(1000);
  });

  test("Claude Code 文章保留比较上下文", async ({ page }) => {
    await page.goto("/blog/ai-coding-tools/claude-code-examples");
    const compare = page.getByRole("link", { name: "Compare the 9 cited cases" });
    await expect(compare).toBeVisible();
    await compare.click();
    await expect(page).toHaveURL(/collection=claude-code-guide/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Claude Code revenue cases");
    await expect(page.locator(".row")).toHaveCount(9);
  });

  test("定价页显示价格与支付入口", async ({ page }) => {
    await page.goto("/pricing");
    // 俱乐部制:价格从 SITE 读,页面顶部是一句话 pitch 与三格真实数字
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every breakdown");
    await expect(page.getByText(/ideas, every one graded/)).toBeVisible();
    // 2026-11-06 起没有"前 50 个免费":免费卡说的是每个项目的故事与来源都公开
    await expect(page.getByText(/Every idea's full story/)).toBeVisible();
    const cta = page.getByRole("button", { name: /Join the Unicorn Club|Loading/ }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("$5/mo");
    // 回归:按钮在 Clerk 就绪前必须是禁用态,不能让用户点了没反应
    await expect(cta).toBeEnabled({ timeout: 15_000 });
    // 不允许出现伪造社会证明
    await expect(page.getByText(/join \d+ founders|trusted by/i)).toHaveCount(0);
  });

  test("目录页对游客:每一行都直接进详情页,没有锁定行", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Join the Unicorn Club/ }).first()).toBeVisible();
    // 2026-11-06 起列表里没有锁(付费墙在详情页的 02–05 段上),也没有"前 50 + 6 个预览"的截断
    await expect(page.locator('a[data-track="lock_click"]')).toHaveCount(0);
    await expect(page.locator(".row").first()).toHaveAttribute("href", /^\/projects\/[a-z0-9-]+$/);
    expect(await page.locator(".row").count()).toBeGreaterThan(100);
    // 页面上不再有"免费账号解锁"的旧承诺
    await expect(page.getByText(/create a free account/i)).toHaveCount(0);
  });

  test("目录页带筛选:结果底部按筛选说话,并能免费保存筛选", async ({ page }) => {
    await page.goto("/projects?evidence=verified");
    await expect(page.getByRole("main").getByText(/ideas? match(es)? Third-party verified/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save this filter — free/ }).first()).toBeVisible();
  });

  test("详情页对游客(原前 50):01 全文 + 02–05 预览 + 06 以后全文,原话公开", async ({ page }) => {
    await page.goto("/projects/bank-statement-converter");
    // 01 全文
    await expect(page.locator("#section-01")).toBeVisible();
    // 02–05 四段只给标题 + 开头两句 + 就地解锁;落地页也不例外
    await expect(page.getByRole("heading", { name: /Getting the first customers from zero/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Keep reading in the Unicorn Club/ })).toHaveCount(4);
    await expect(page.locator(".ghost-text").first()).toHaveText("");
    // 06 以后对所有人全文开放(不再只露标题)
    const s06 = page.locator("#section-06");
    await expect(s06).toBeVisible();
    expect((await s06.innerText()).length).toBeGreaterThan(300);
    // 速览卡与构建提示词仍是会员专属
    await expect(page.getByRole("heading", { name: "Quick reference" })).toHaveCount(0);
    await expect(page.getByText(/A build spec for .+, sized to you/)).toHaveCount(0);
    // 付费墙的结构化标记:整页 isAccessibleForFree=false,hasPart 指向四段
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('"isAccessibleForFree":false');
    expect(ld).toContain('"cssSelector":"#section-02"');
    await expect(page.getByRole("link", { name: /Open source/ }).first()).toHaveAttribute("href", /^https?:\/\//);
  });

  test("详情页长路径收据不得撑出手机视口", async ({ page }) => {
    await page.goto("/projects/storyshort");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("StoryShort.ai");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test("详情页长标签不得撑出视口", async ({ page }) => {
    await page.goto("/projects/single-page-read-later-app-replit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test("详情页对游客(原第 51 名后):同样是 01 全文 + 02–05 预览,来源公开", async ({ page }) => {
    await page.goto("/projects/ai-ugc-tiktok-shop-affiliate");
    await expect(page.locator("#section-01")).toBeVisible();
    const teasers = page.getByRole("link", { name: /Keep reading in the Unicorn Club/ });
    await expect(teasers).toHaveCount(4);
    await expect(page.getByText(/more words · \$\d+\/mo/).first()).toBeVisible();
    // 模糊正文只是词形条:锁定段里除了预览句不能有会员正文
    await expect(page.locator(".ghost-text").first()).toHaveText("");
    await expect(page.getByRole("link", { name: /Open source/ }).first()).toBeVisible();
    // 旧的"前 50 免费推荐栏"已拆
    await expect(page.getByRole("heading", { name: "Free to read in full" })).toHaveCount(0);
  });

  test("详情页对游客(原会员专供):与其他项目完全一样,没有整页墙", async ({ page }) => {
    await page.goto("/projects/audiopen-voice-to-text-note-app");
    await expect(page.getByText(/This is a members-only idea/)).toHaveCount(0);
    await expect(page.locator("#section-01")).toBeVisible();
    await expect(page.getByRole("link", { name: /Keep reading in the Unicorn Club/ })).toHaveCount(4);
    await expect(page.getByRole("link", { name: /Open source/ }).first()).toBeVisible();
  });

  test("联系页有邮箱、表单与时效承诺", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByText("contact@provenstartups.com").first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByText(/business days/i)).toBeVisible();
  });

  test("博客分类与文章可达", async ({ page }) => {
    await page.goto("/blog");
    const cat = page.locator('a[href^="/blog/"]').first();
    await cat.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("信任矩阵", () => {
  for (const path of LEGAL) {
    test(`${path} 在线且有实质内容`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const text = await page.locator("main, body").first().innerText();
      expect(text.length).toBeGreaterThan(500);
    });
  }

  test("footer 五要素齐全", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    for (const href of ["/privacy", "/terms", "/refunds"]) {
      await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(footer.getByText("contact@provenstartups.com")).toBeVisible();
    await expect(footer.getByText(`© ${new Date().getFullYear()}`)).toBeVisible();
  });

  test("零伪造社会证明", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/trusted by|loved by|[0-9,]{3,}\+\s*(users|customers|developers)/i);
  });
});

test.describe("SEO 基建", () => {
  test("noindex 已摘除(两级)", async ({ page }) => {
    for (const path of PUBLIC.slice(0, 4)) {
      const res = await page.goto(path);
      expect(res?.headers()["x-robots-tag"]).toBeUndefined();
      const meta = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(meta).not.toMatch(/noindex/i);
    }
  });

  test("og:image 存在且可取", async ({ page, request }) => {
    await page.goto("/");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    const res = await request.get(og!);
    expect(res.status()).toBe(200);
  });

  test("sitemap / robots / llms.txt 在线", async ({ request }) => {
    for (const p of ["/sitemap.xml", "/robots.txt", "/llms.txt"]) {
      expect((await request.get(p)).status()).toBe(200);
    }
  });

  test("未命中路由不得绕过 Clerk proxy", async ({ request }) => {
    for (const path of ["/.well-known/traffic-advice", "/missing.probe"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      expect(res.headers()["x-content-type-options"], path).toBe("nosniff");
      expect(await res.text(), path).not.toContain("auth-middleware");
    }
  });

  test("自测排除路由同时排除站内与 FlowGlance 统计", async ({ request }) => {
    const res = await request.get("/self-exclude");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("charset=utf-8");
    expect(await res.text()).toContain("✅ Analytics self-exclusion");
    const cookies = res.headers()["set-cookie"] ?? "";
    expect(cookies).toContain("ps_exclude=1");
    expect(cookies).toContain("fw_exclude=1");
  });

  test("test_run 标记在分析脚本启动前排除整段旅程", async ({ browser, baseURL }) => {
    // beforeEach seeds the normal smoke context, so use a clean context to prove
    // the URL marker itself creates both exclusion cookies.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(new URL("/?test_run=true", baseURL!).toString());
    const cookies = await context.cookies(baseURL!);
    expect(cookies.find((cookie) => cookie.name === "ps_exclude")?.value).toBe("1");
    expect(cookies.find((cookie) => cookie.name === "fw_exclude")?.value).toBe("1");
    await context.close();
  });

  test("博客页内锚点和同域链接不得误标为外链", async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of REVENUE_ARTICLES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator('main a[href^="#"]').first()).toBeAttached();
      const links = page.locator("main a");
      const facts = await links.evaluateAll((nodes) =>
        nodes.map((node) => ({
          href: node.getAttribute("href") || "",
          target: node.getAttribute("target"),
          rel: node.getAttribute("rel") || "",
        }))
      );

      const anchors = facts.filter((link) => link.href.startsWith("#"));
      expect(anchors.length, `${path} 应有页内目录`).toBeGreaterThan(0);
      for (const link of anchors) {
        expect(link.target, `${path} ${link.href}`).toBeNull();
        expect(link.rel, `${path} ${link.href}`).not.toContain("nofollow");
      }

      const internal = facts.filter((link) => link.href.startsWith("/"));
      expect(internal.length, `${path} 应有站内链接`).toBeGreaterThan(0);
      for (const link of internal) {
        expect(link.target, `${path} ${link.href}`).toBeNull();
        expect(link.rel, `${path} ${link.href}`).not.toContain("nofollow");
      }

      const external = facts.filter((link) => {
        try {
          const url = new URL(link.href);
          return /^https?:$/.test(url.protocol) && url.hostname !== "provenstartups.com";
        } catch {
          return false;
        }
      });
      expect(external.length, `${path} 应有外部证据链接`).toBeGreaterThan(0);
      for (const link of external) {
        expect(link.target, `${path} ${link.href}`).toBe("_blank");
        expect(link.rel, `${path} ${link.href}`).toContain("noopener");
        expect(link.rel, `${path} ${link.href}`).toContain("nofollow");
      }
    }
  });

  test("公开页零死链零重定向链", async ({ request }) => {
    for (const p of PUBLIC) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status(), `${p} 应直接 200`).toBe(200);
    }
  });
});

test.describe("边界与鉴权", () => {
  test("常见 /login 入口不再落到 404", async ({ request, baseURL }) => {
    const res = await request.get("/login?redirect_url=%2Fprojects", { maxRedirects: 0 });
    expect(res.status()).toBe(307);

    const location = new URL(res.headers().location, baseURL);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe("/projects");
  });

  test("未登录不能发起支付", async ({ request }) => {
    const res = await request.post("/api/stripe/checkout");
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe("auth_required");
  });

  test("未登录访问受保护页被拦(不是 200 空壳)", async ({ request }) => {
    for (const p of ["/account", "/admin"]) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect([302, 303, 307, 404], `${p} 不应返回 200`).toContain(res.status());
    }
  });

  test("webhook 拒绝无签名与伪造签名", async ({ request }) => {
    const body = { id: "evt_smoke", type: "checkout.session.completed" };
    expect((await request.post("/api/stripe/webhook", { data: body })).status()).toBe(400);
    const forged = await request.post("/api/stripe/webhook", {
      data: body,
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
    });
    expect(forged.status()).toBe(400);
  });

  test("health 全绿且字段真实", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const h = await res.json();
    expect(h.healthy).toBe(true);
    expect(h.db).toBe("ok");
    expect(h.stripe_mode).toBe("live");
    expect(h.env_missing).toEqual([]);
    expect(h.projects).toBeGreaterThan(0);
  });
});
