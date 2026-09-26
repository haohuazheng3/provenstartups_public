import { test, expect } from "@playwright/test";

/**
 * 生产冒烟。全部只读 —— 不提交表单、不发起支付、不写任何数据。
 * 覆盖上线审计定下的关键路径,外加几条当时实测踩到的坑作回归。
 */

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
    const panel = page.locator("div").filter({ hasText: "Find your idea" }).first();
    await expect(panel.getByText("Filter by what actually matters to you")).toBeVisible();
    // 折叠式面板:先点组标题展开,再点选项
    await panel.getByRole("button", { name: /^Evidence/ }).click();
    const chip = panel.getByRole("button", { name: /^Third-party verified/ });
    await expect(chip).toBeVisible();
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Sign in/ })).toBeVisible();
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
    await page.getByText("Category ↓", { exact: true }).click();
    await expect(page.getByRole("link", { name: "AI Service", exact: true })).toBeVisible();
    expect(await page.locator(".row").count()).toBeLessThanOrEqual(56);
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
    await expect(page.getByText(/The first \d+ ideas, every section/)).toBeVisible();
    const cta = page.getByRole("button", { name: /Join the Unicorn Club|Loading/ }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("$5/mo");
    // 回归:按钮在 Clerk 就绪前必须是禁用态,不能让用户点了没反应
    await expect(cta).toBeEnabled({ timeout: 15_000 });
    // 不允许出现伪造社会证明
    await expect(page.getByText(/join \d+ founders|trusted by/i)).toHaveCount(0);
  });

  test("目录页对游客:前 50 个完整,其余锁定并指向会员页", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /Join the Unicorn Club/ }).first()).toBeVisible();
    const locked = page.locator('a[aria-label^="Members-only idea"]');
    await expect(locked.first()).toBeVisible();
    await expect(locked.first()).toHaveAttribute("href", /\/pricing\?from=/);
    // 页面上不再有"免费账号解锁"的旧承诺
    await expect(page.getByText(/create a free account/i)).toHaveCount(0);
  });

  test("详情页对游客:只开 01,其余段落列出标题并给会员入口", async ({ page }) => {
    await page.goto("/projects/letterly");
    await expect(page.getByRole("link", { name: /Join the Unicorn Club/ }).first()).toBeVisible();
    await expect(page.getByText(/more sections — how the first customers came/)).toBeVisible();
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

  test(".well-known 未命中路由不得绕过 Clerk proxy", async ({ request }) => {
    const res = await request.get("/.well-known/traffic-advice");
    expect(res.status()).toBe(404);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await res.text()).not.toContain("auth-middleware");
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
