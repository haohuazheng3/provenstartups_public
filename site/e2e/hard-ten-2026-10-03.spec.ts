import { expect, test } from "@playwright/test";

const pages = [
  "/blog/startup-ideas/business-model-examples",
  "/blog/saas-metrics/revenue-model-examples",
  "/blog/digital-products/template-business-model",
  "/blog/start-cheap/low-cost-business-ideas",
  "/blog/startup-ideas/niche-business-ideas",
  "/blog/startup-ideas/subscription-business-ideas",
  "/blog/startup-ideas/online-business-examples",
  "/blog/startup-ideas/licensing-business-model",
  "/blog/ai-agencies/retainer-business-model",
  "/blog/digital-products/media-business-model",
];

test.describe("2026-10-03 hard ten", () => {
  for (const path of pages) {
    test(`${path} renders the complete approved article`, async ({ page }) => {
      await page.goto(`${path}?test_run=true`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main img")).toHaveCount(2);
      await expect(page.locator("main h2", { hasText: "Frequently Asked Questions" })).toHaveCount(1);
      const schemas = page.locator('script[type="application/ld+json"]');
      await expect(schemas).toHaveCount(3);
      const schemaTypes = await schemas.evaluateAll((nodes) =>
        nodes.map((node) => JSON.parse(node.textContent || "{}")["@type"])
      );
      expect(schemaTypes).toEqual(expect.arrayContaining(["Article", "BreadcrumbList", "FAQPage"]));

      const body = await page.locator("main").innerText();
      expect(body).not.toMatch(/\b(?:TODO|TBD|FIXME|XXX|lorem)\b|\[待|待补|待确认|占位|内部|备注|writer instructions|insert here/i);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
