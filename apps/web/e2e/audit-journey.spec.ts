import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CONTEXT_FIELDS: Array<[string, string]> = [
  ["organization", "Example Corp"],
  ["business_type", "e-commerce"],
  ["offering", "Office furniture"],
  ["market", "Saudi Arabia"],
  ["customer_language", "Arabic"],
  ["audience", "Procurement managers"],
];

async function fillAuditForm(page: Page): Promise<void> {
  await page.fill("#url", "https://example.com");
  for (const [id, value] of CONTEXT_FIELDS) {
    await page.fill(`#${id}`, value);
  }
  await page.click("button[type=submit]");
}

async function expectReportVisible(page: Page, sectionsHeading: string): Promise<void> {
  await page.waitForURL(/\/audit\//, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: sectionsHeading })).toBeVisible({
    timeout: 15000,
  });
}

test("completes an audit in English and allows deletion", async ({ page }) => {
  await page.goto("/en");
  await fillAuditForm(page);
  await page.waitForURL(/\/en\/audit\//, { timeout: 15000 });
  await expectReportVisible(page, "Findings by area");

  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toBe("noindex, nofollow");

  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible();

  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete this audit" }).click();
  await page.waitForURL(/\/en$/, { timeout: 10000 });
});

test("renders Arabic landing and completes an audit in Arabic", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("اكتشف كيف تقرأ");

  await fillAuditForm(page);
  await page.waitForURL(/\/ar\/audit\//, { timeout: 15000 });
  await expectReportVisible(page, "النتائج حسب المجال");
});

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

test("landing page meets WCAG AA in English and Arabic", async ({ page }) => {
  await page.goto("/en");
  await expectNoSeriousViolations(page);
  await page.goto("/ar");
  await expectNoSeriousViolations(page);
});

test("report page meets WCAG AA", async ({ page }) => {
  await page.goto("/en");
  await fillAuditForm(page);
  await expectReportVisible(page, "Findings by area");
  await expectNoSeriousViolations(page);
});
