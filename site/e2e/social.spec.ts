import { test, expect } from "@playwright/test";

// 只列品牌官方号。站长个人名下的账号(X / Medium / Quora)发过本站内容,但不进
// footer 也不进 sameAs —— 理由见 lib/site.ts 的 SOCIAL 注释。
const PLATFORMS = ["LinkedIn", "GitHub", "Reddit", "Pinterest"];

test("footer 官方账号区可见可点", async ({ page }) => {
  await page.goto("/");
  const strip = page.locator("footer").getByText("Official accounts");
  await expect(strip).toBeVisible();
  for (const name of PLATFORMS) {
    const link = page.locator('footer a[rel~="me"]').filter({ hasText: new RegExp(`^${name}$`) });
    await expect(link, `${name} 应可见`).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href, `${name} 应有外链`).toMatch(/^https:\/\//);
  }
  // 无横向溢出。必须等页面稳定再量 —— 字体/图片加载途中会有瞬时宽度,
  // 用默认的 load 时机测会拿到假阳性。
  await page.waitForLoadState("networkidle");
  const diag = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0) return false;
        // 自带横向滚动的容器是有意设计,不算页面溢出
        let n: HTMLElement | null = el as HTMLElement;
        while (n && n !== document.body) {
          if (getComputedStyle(n).overflowX !== "visible") return false;
          n = n.parentElement;
        }
        return b.right > winW + 2;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 40)}`);
    return { docW, winW, offenders };
  });
  expect(diag.docW, `横向溢出 ${diag.docW - diag.winW}px: ${diag.offenders.join(" | ")}`)
    .toBeLessThanOrEqual(diag.winW + 2);
});

test("Organization schema sameAs 只含四个品牌官方号", async ({ page }) => {
  await page.goto("/about");
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  const org = JSON.parse(ld!);
  expect(org["@type"]).toBe("Organization");
  expect(org.sameAs).toHaveLength(4);
  for (const host of ["linkedin.com", "github.com", "reddit.com", "pinterest.com"]) {
    expect(org.sameAs.some((u: string) => u.includes(host)), `sameAs 应含 ${host}`).toBe(true);
  }
  // 个人号混进 sameAs 会把品牌实体稀释成"某个人",这条断言就是防回填的闸
  for (const host of ["x.com", "medium.com", "quora.com"]) {
    expect(org.sameAs.some((u: string) => u.includes(host)), `sameAs 不该含个人号 ${host}`).toBe(
      false,
    );
  }
});
