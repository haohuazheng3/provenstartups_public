import { test, expect } from "@playwright/test";

/**
 * 生产冒烟。全部只读 —— 不提交表单、不发起支付、不写任何数据。
 * 覆盖上线审计定下的关键路径,外加几条当时实测踩到的坑作回归。
 */

const LEGAL = ["/privacy", "/terms", "/refunds"];
const PUBLIC = ["/", "/projects", "/pricing", "/blog", "/about", "/faq", "/how-it-works", "/contact"];

test.describe("关键路径", () => {
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
    await expect(page.getByText("$10/mo", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/Free members can read \d+ breakdowns; the remaining \d+ are Pro-only\./)
    ).toBeVisible();
    await expect(page.getByText(/All \d+ free idea breakdowns/)).toBeVisible();
    const cta = page.getByRole("button", { name: /Go Pro|Loading/ });
    await expect(cta).toBeVisible();
    // 回归:按钮在 Clerk 就绪前必须是禁用态,不能让用户点了没反应
    await expect(cta).toBeEnabled({ timeout: 15_000 });
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

  test("公开页零死链零重定向链", async ({ request }) => {
    for (const p of PUBLIC) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status(), `${p} 应直接 200`).toBe(200);
    }
  });
});

test.describe("边界与鉴权", () => {
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
