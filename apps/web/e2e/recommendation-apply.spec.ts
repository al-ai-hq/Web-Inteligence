import { expect, test, type Page } from "@playwright/test";

async function fillAuditForm(page: Page): Promise<void> {
  await page.fill("#url", "https://example.com");
  await page.fill("#organization", "E2E Org");
  await page.fill("#business_type", "SaaS");
  await page.fill("#offering", "Email tooling");
  await page.fill("#market", "Global");
  await page.fill("#customer_language", "en");
  await page.fill("#audience", "Marketers");
  await page.click("button[type=submit]");
}

test("signed-in owner marks a recommendation applied and it survives a reload", async ({
  page,
}) => {
  const email = `wpi-m10-${String(Date.now())}@example.com`;

  await page.goto("/en/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-123");
  await page.getByLabel("Confirm password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Run your first audit" }).click();
  await page.waitForSelector("#url", { timeout: 15_000 });
  await fillAuditForm(page);

  // Signed-in submissions return to the dashboard; the audit page then polls
  // until the report is ready, so the board can take a while to appear.
  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });
  await page.getByRole("link", { name: "View report" }).first().click();
  await page.waitForURL(/\/en\/audit\//, { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible({
    timeout: 60_000,
  });

  const markButton = page.getByRole("button", { name: "Mark as applied" }).first();
  await expect(markButton).toBeVisible();
  await markButton.click();
  await expect(page.getByText("Applied — pending measurement").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Applied — pending measurement").first()).toBeVisible();

  await page.goto("/en/dashboard");
  await expect(
    page.getByRole("heading", { name: "Applied — waiting for a new audit" }),
  ).toBeVisible();
});

test("anonymous visitor gets no action controls on the report", async ({ page }) => {
  await page.goto("/en");
  await fillAuditForm(page);
  await page.waitForURL(/\?s=/, { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Action board" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Mark as applied" })).toHaveCount(0);
});
