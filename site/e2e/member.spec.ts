import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * 会员态验收(不在默认冒烟里跑:没有 QA_SIGNIN_URL 时整组跳过)。
 * 步骤:
 *   1. bash scripts/qa-signin-token.sh member   → 得到一次性登录链接(15 分钟内有效)
 *   2. QA_SIGNIN_URL='<链接>' QA_LEVEL=member npx playwright test e2e/member.spec.ts --project=desktop
 *   3. 再用 free 跑一遍:bash scripts/qa-signin-token.sh free → QA_LEVEL=free …
 * 只读:登录后看页面,不发起支付、不生成构建(构建会计入配额并产生模型费用)。
 */

const SIGNIN = process.env.QA_SIGNIN_URL || "";
const LEVEL = (process.env.QA_LEVEL || "member") as "member" | "free";
const JOIN = /Join the Unicorn Club/;

test.describe("会员态", () => {
  test.skip(!SIGNIN, "需要 QA_SIGNIN_URL(scripts/qa-signin-token.sh 签发)");
  test.describe.configure({ mode: "serial" });

  // Clerk 的 sign-in token 只能用一次:beforeAll 登录一次,把会话存成 storageState 给后面的用例复用
  const STATE = path.join(os.tmpdir(), `ps-qa-${LEVEL}-state.json`);
  // test.use 的 storageState 会同时套到 beforeAll 里的 browser.newContext 上,文件必须先存在 —— 先写个空态
  if (SIGNIN) fs.writeFileSync(STATE, JSON.stringify({ cookies: [], origins: [] }));
  test.beforeAll(async ({ browser, baseURL }) => {
    const m = SIGNIN.match(/(?:__clerk_ticket|ticket)=([^&#]+)/);
    if (!m) throw new Error("QA_SIGNIN_URL 里没有 ticket 参数");
    const ctx = await browser.newContext({ baseURL });
    const url = new URL(baseURL!);
    // Authentication/member checks are synthetic traffic too. Seed both
    // exclusion cookies before the one-time sign-in URL loads so neither the
    // sign-in page nor the protected page can enter product analytics.
    await ctx.addCookies([
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
    const page = await ctx.newPage();
    // 自建 /sign-in 页的 <SignIn> 组件会消费 __clerk_ticket 完成登录
    await page.goto(`/sign-in?__clerk_ticket=${m[1]}&redirect_url=${encodeURIComponent("/account")}`);
    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await ctx.storageState({ path: STATE });
    await ctx.close();
  });
  test.use({ storageState: STATE });

  test("账户页显示对应等级", async ({ page }) => {
    await page.goto("/account");
    if (LEVEL === "member") {
      await expect(page.getByText(JOIN)).toHaveCount(0);
      await expect(page.getByText(/member/i).first()).toBeVisible();
    } else {
      // The mobile header keeps a hidden desktop-only "Join the Unicorn Club"
      // span in the DOM. Assert the actual account upgrade action instead of
      // whichever matching text node happens to come first.
      await expect(
        page.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ })
      ).toBeVisible();
    }
  });

  test("目录页:会员无锁定卡片且筛选可用;免费账号仍见锁定", async ({ page }) => {
    await page.goto("/projects");
    // 锁定卡片的说明是链接的 aria-label(可访问名),不是文本节点
    const locked = page.getByRole("link", { name: "Members-only idea — join the Unicorn Club to open it" });
    if (LEVEL === "member") {
      await expect(locked).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ })).toHaveCount(0);
      // 筛选:点第一个选项,URL 带上参数,列表仍有项目
      const panel = page.locator("section, div").filter({ hasText: "Find your idea" }).first();
      // 折叠式面板:先展开第一组,再点第一个选项链接
      await panel.getByRole("button", { name: /^Evidence/ }).click();
      const chip = panel.locator('a[href*="?"]').first();
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(page).toHaveURL(/\/projects\?/);
      await expect(page.locator('a[href^="/projects/"]').first()).toBeVisible();
    } else {
      await expect(locked.first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ }).first()).toBeVisible();
    }
  });

  test("结账入口:免费账号能拿到 Stripe Checkout 链接,会员被拒", async ({ page }) => {
    // 只创建 Checkout Session,不进入支付页、不扣款。session id 打到 stdout,外面用 Stripe API 核价格。
    await page.goto("/pricing");
    const res = await page.request.post("/api/stripe/checkout", { data: {} });
    const body = await res.json();
    if (LEVEL === "member") {
      expect(res.status()).toBe(400);
      expect(body.error).toBe("already_member");
    } else {
      expect(res.status()).toBe(200);
      expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      const m = String(body.url).match(/(cs_(?:live|test)_[A-Za-z0-9]+)/);
      console.log(`CHECKOUT_SESSION ${m ? m[1] : "unknown"}`);
    }
  });

  test("第 50 名之后的详情页:会员看全部段落与构建台", async ({ page }) => {
    await page.goto("/projects?sort=rank");
    // 取列表里最后一个项目链接(排名靠后 → 游客/免费不可见)
    const links = page.locator('a[href^="/projects/"]');
    const n = await links.count();
    const href = await links.nth(n - 1).getAttribute("href");
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (LEVEL === "member") {
      await expect(page.getByText(JOIN)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Build prompts" })).toBeVisible();
      await expect(page.getByText(/A build spec for .+, sized to you/)).toBeVisible();
      await expect(page.getByText(/builds left this week/)).toBeVisible();
      // 固定四段(2026-09-22 起每个项目都有)
      await expect(page.getByText("Getting the first customers from zero").first()).toBeVisible();
      await expect(page.getByText("Surviving the no-feedback stretch").first()).toBeVisible();
    } else {
      await expect(
        page.getByRole("link", { name: /Join the Unicorn Club — \$\d+\/mo/ }).first()
      ).toBeVisible();
      await expect(page.getByText(/A build spec for .+, sized to you/)).toHaveCount(0);
    }
  });
});
