import { test, expect } from "@playwright/test";
import { mockBasemaps } from "./basemap-fixtures";

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test("home opens at the site root and stories have their own page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("NHHR Atlas");
  await expect(page.getByRole("heading", { name: "Explore the Atlas", exact: true })).toBeVisible();
  await expect(page.locator(".atlas-story-grid")).toHaveCount(0);
  await expect(page.locator('.unbc-mobile-nav__link[aria-current="page"]')).toHaveText("Home");
  // The UNBC menu is the Atlas's only section navigation, at every width.
  await expect(page.getByRole("navigation", { name: "NHHR Atlas sections" })).toHaveCount(0);
  await page.getByRole("link", { name: "Discover the stories" }).click();
  await expect(page).toHaveURL(/\/stories$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await expect(page.locator(".atlas-story-card")).toHaveCount(42);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("NHHR Atlas");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await page.locator(".atlas-breadcrumbs").getByRole("link", { name: "NHHR Atlas", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("NHHR Atlas");
  expect(new URL(page.url()).pathname).not.toMatch(/\/stories/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("home destinations and existing shared stories still work", async ({ page }) => {
  await page.goto("./");
  await page.locator(".atlas-home-card").filter({ has: page.getByRole("heading", { name: "Data explorer", exact: true }) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data explorer");
  await page.goBack();
  await page.getByRole("link", { name: "How to read the evidence" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sources and methods");
  await page.goto("./northern-communities");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One North, many communities");
  await expect(page.locator(".atlas-story-toolbar .atlas-story-back")).toHaveAttribute("href", /\/stories$/);
  await page.locator(".atlas-story-toolbar .atlas-story-back").click();
  await expect(page).toHaveURL(/\/stories$/);
  await page.locator(".atlas-story-card").first().click();
  await expect(page).toHaveURL(/\/stories\?story=/);
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});
