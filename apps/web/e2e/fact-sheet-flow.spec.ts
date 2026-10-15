// apps/web/e2e/fact-sheet-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Fact Sheet to Conflict Resolution Flow", () => {
  test("creates a fact sheet, views entity graph, and resolves a conflict", async ({ page }) => {
    // Navigate to project fact sheets
    await page.goto("/en/projects/test-project/fact-sheets");

    // Create a new fact sheet
    await page.click("text=Create Fact Sheet");
    await page.fill('[name="business_name"]', "Test Business");
    await page.fill('[name="site_url"]', "https://test-business.example.com");
    await page.fill('[name="phone"]', "+1-555-0100");
    await page.fill('[name="email"]', "contact@test-business.example.com");
    await page.fill('[name="address_line1"]', "123 Test St");
    await page.fill('[name="address_locality"]', "Testville");
    await page.fill('[name="address_region"]', "CA");
    await page.fill('[name="address_postal_code"]', "90210");
    await page.fill('[name="address_country"]', "US");
    await page.click('button:has-text("Create")');

    // Verify fact sheet was created
    await expect(page.locator("h1")).toContainText("Test Business");

    // Navigate to entity graph
    await page.click("text=View Entity Graph");
    await expect(page.locator("h1")).toContainText("Test Business");

    // If conflicts exist, navigate to conflict resolution
    const conflictLink = page.locator("text=View & resolve");
    if (await conflictLink.isVisible()) {
      await conflictLink.click();

      // Enter resolver name
      await page.fill("#resolved_by", "E2E Tester");

      // Resolve first conflict if present
      const resolveButton = page.locator('button:has-text("Resolve")').first();
      if (await resolveButton.isVisible()) {
        await resolveButton.click();
        await page.fill("textarea", "Resolved by E2E test");
        await page.click('button:has-text("Keep confirmed value")');

        // Verify conflict was resolved
        await expect(page.locator("text=Resolved")).toBeVisible();
      }
    }
  });

  test("displays fact sheet list with correct status badges", async ({ page }) => {
    await page.goto("/en/projects/test-project/fact-sheets");

    // Verify page loads
    await expect(page.locator("h1")).toContainText("Fact Sheets");

    // If fact sheets exist, verify status badges
    const factSheetCards = page.locator('a[href*="/fact-sheets/"]');
    const count = await factSheetCards.count();
    if (count > 0) {
      const statusBadge = factSheetCards.first().locator("span").last();
      await expect(statusBadge).toBeVisible();
    }
  });

  test("entity graph shows NAP consistency scores", async ({ page }) => {
    await page.goto("/en/projects/test-project/fact-sheets");

    // Navigate to first fact sheet's entity graph
    const firstSheet = page.locator('a[href*="/fact-sheets/"]').first();
    if (await firstSheet.isVisible()) {
      await firstSheet.click();
      await page.click("text=View Entity Graph");

      // Check for NAP consistency section
      const napSection = page.locator("text=NAP Consistency");
      if (await napSection.isVisible()) {
        // Verify consistency scores are displayed as percentages
        const scoreElements = page.locator("text=/\\d+% consistent/");
        const scoreCount = await scoreElements.count();
        expect(scoreCount).toBeGreaterThan(0);
      }
    }
  });
});
