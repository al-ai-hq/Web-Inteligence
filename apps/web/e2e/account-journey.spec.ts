import { expect, test } from "@playwright/test";

test("signed-in user runs audit and sees score on dashboard", async ({ page }) => {
  const email = `wpi-e2e-${Date.now()}@example.com`;

  await page.goto("/en/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-123");
  await page.getByLabel("Confirm password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Run your first audit" }).click();
  await page.waitForSelector("#url", { timeout: 15_000 });

  await page.fill("#url", "https://example.com");
  await page.fill("#organization", "E2E Org");
  await page.fill("#business_type", "SaaS");
  await page.fill("#offering", "Email tooling");
  await page.fill("#market", "Global");
  await page.fill("#customer_language", "en");
  await page.fill("#audience", "Marketers");
  await page.click("button[type=submit]");

  await page.waitForURL(/\/en\/dashboard/, { timeout: 15_000 });

  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText("Score: 72").count();
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBeGreaterThan(0);

  await page.getByRole("link", { name: "View report" }).first().click();
  await page.waitForURL(/\/en\/audit\//, { timeout: 15_000 });

  expect(page.url()).not.toContain("?s=");
  await expect(page.getByText("72%").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/en/dashboard");
  await page.waitForURL(/\/en\/login/, { timeout: 10_000 });
});

test("anonymous user sees signup CTA on report", async ({ page }) => {
  await page.goto("/en");
  await page.fill("#url", "https://example.com");
  await page.fill("#organization", "Anon Org");
  await page.fill("#business_type", "SaaS");
  await page.fill("#offering", "Tooling");
  await page.fill("#market", "Global");
  await page.fill("#customer_language", "en");
  await page.fill("#audience", "Developers");
  await page.click("button[type=submit]");

  await page.waitForURL(/\?s=/, { timeout: 15_000 });

  await expect(page.getByText("Sign up to keep reports forever")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
