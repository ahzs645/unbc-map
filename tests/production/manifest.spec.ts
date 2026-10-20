import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { mockBasemaps } from "../basemap-fixtures";
import { resolveManifest } from "../../scripts/manifest.mjs";

// Run after a plain `npm run build`: these checks follow whatever manifest/
// currently publishes, so switching an option changes what they expect.
const manifest = resolveManifest({ all: false });
const flags = manifest.flags as {
  projects: Record<"atlas" | "workspace" | "campus", boolean>;
  locked: Record<"atlas" | "workspace" | "campus", boolean>;
  pages: Record<"home" | "explore" | "sources", boolean>;
  explore: Record<"filters" | "chart" | "map" | "pairedMaps" | "datasetDetails" | "mapIcons", boolean>;
  site: Record<"statusBadges" | "campusLinks" | "sourcesInMenu", boolean>;
};

test.beforeEach(async ({ page }) => { await mockBasemaps(page); });

test("the stories page lists exactly the stories the manifest switches on", async ({ page }) => {
  test.skip(!flags.projects.atlas || flags.locked.atlas, "the public Atlas is off or locked");
  await page.goto(flags.pages.home ? "./stories" : "./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research stories");
  await expect(page.locator(".atlas-story-card")).toHaveCount(manifest.enabledStories.size);
  await expect(page.locator(".atlas-storymap-card")).toHaveCount(manifest.enabledStoryMaps.size);
  if (!flags.site.statusBadges) await expect(page.locator(".atlas-badge")).toHaveCount(0);
  if (!flags.site.campusLinks) await expect(page.locator(".unbc-chrome a", { hasText: /^Campus map$/ })).toHaveCount(0);
});

test("switched-off stories are left out of the published files", async ({ page }) => {
  const scripts = (await readdir("dist/assets")).filter(name => name.endsWith(".js"));
  const bundle = (await Promise.all(scripts.map(name => readFile(`dist/assets/${name}`, "utf8")))).join("\n");
  const { scanned } = manifest as unknown as { scanned: { stories: Map<string, Set<string>>; storyMaps: Map<string, Set<string>> } };
  const off = [...scanned.storyMaps.keys()].filter(id => !manifest.enabledStoryMaps.has(id));
  for (const id of off) expect(bundle, `story map ${id}`).not.toContain(`id:\`${id}\`,title:`);
  for (const id of [...scanned.stories.keys()].filter(item => !manifest.enabledStories.has(item))) expect(bundle, `story ${id}`).not.toContain(`id:\`${id}\`,title:`);
  // The build carries only the password's hash, never the password itself.
  if (process.env.ATLAS_TEST_PASSWORD) expect(bundle).not.toContain(process.env.ATLAS_TEST_PASSWORD);
  if (!flags.pages.sources) for (const text of ["Start at the source.", "What's in this release.", "Read sources and methods"]) expect(bundle, "the switched-off Sources page").not.toContain(text);
  if (!flags.pages.explore) expect(bundle, "the switched-off explorer").not.toContain("Explore the data");
  test.skip(!off.length || !flags.projects.atlas || flags.locked.atlas, "every story map is on, or the Atlas is locked");
  await page.goto(`./${off[0]}`);
  await expect(page.getByText("This link does not match a story in the current collection.")).toBeVisible();
});

test("the explorer offers only the switched-on displays and controls", async ({ page }) => {
  test.skip(!flags.projects.atlas || flags.locked.atlas || !flags.pages.explore, "the explorer is not published");
  test.skip(!manifest.datasets.has("publications"), "the publications dataset is not in this build");
  await page.goto("./?view=explore&dataset=publications&year=2025&entity=missing&filter.openalex_id=missing&display=map");
  if (!flags.explore.filters) {
    await expect(page.locator(".atlas-filter-panel, .atlas-results-line")).toHaveCount(0);
    await expect(page).not.toHaveURL(/year=|entity=|filter\./);
  }
  for (const [name, on] of [["Chart", flags.explore.chart], ["Map", flags.explore.map]] as const) {
    await expect(page.getByRole("tab", { name, exact: true })).toHaveCount(on ? 1 : 0);
  }
  if (!flags.explore.chart && !flags.explore.map) {
    await expect(page.getByRole("tab", { name: "Table", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".atlas-pagination")).toContainText("1–25 of 40 records");
  }
  if (!flags.explore.datasetDetails) await expect(page.locator(".atlas-dataset-context, .atlas-dataset-detail")).toHaveCount(0);
  if (!flags.explore.mapIcons) await expect(page.locator('.atlas-dataset-list [aria-label="Geographic map available"]')).toHaveCount(0);
  await expect(page.locator(".atlas-sidebar-heading, .atlas-sidebar-note")).toHaveCount(0);
});

test("a table that fits on one page has no pagination bar", async ({ page }) => {
  test.skip(!flags.projects.atlas || flags.locked.atlas || !flags.pages.explore || !manifest.datasets.has("clinical-city"), "the clinical-city table is not published");
  await page.goto("./?view=explore&dataset=clinical-city&display=table");
  await expect(page.locator(".atlas-data-table tbody tr")).toHaveCount(7);
  await expect(page.locator(".atlas-pagination")).toHaveCount(0);
});

test("a locked project asks for the password, and asks again once the unlock expires", async ({ page }) => {
  const locked = (["workspace", "atlas", "campus"] as const).find(name => flags.projects[name] && flags.locked[name]);
  test.skip(!locked, "no project is behind the password");
  const url = locked === "workspace" ? "dev/projects" : locked === "campus" ? "campus" : "./";
  await page.goto(url);
  await expect(page.getByText("This page is password protected.")).toBeVisible();
  await expect(page.locator("#atlas-main, .campus-explorer")).toHaveCount(0);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toHaveText("That password is not correct.");
  // The repository keeps only the hash: type the password when it is supplied,
  // otherwise unlock as a correct entry would.
  if (process.env.ATLAS_TEST_PASSWORD) {
    await page.getByLabel("Password").fill(process.env.ATLAS_TEST_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
  } else {
    const { passwordSha256 } = JSON.parse(await readFile("manifest/access.json", "utf8"));
    await page.evaluate(([hash, hours]) => localStorage.setItem("nhhr-atlas-access", JSON.stringify({ hash, until: Date.now() + hours * 3600_000 })), [passwordSha256, manifest.flags.rememberHours as number] as const);
    await page.reload();
  }
  await expect(page.getByText("This page is password protected.")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("This page is password protected.")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nhhr-atlas-access")!));
  expect(saved.until - Date.now()).toBeGreaterThan(manifest.flags.rememberHours as number * 3600_000 - 60_000);
  expect(saved.until - Date.now()).toBeLessThanOrEqual(manifest.flags.rememberHours as number * 3600_000);
  await page.evaluate(() => localStorage.setItem("nhhr-atlas-access", JSON.stringify({ ...JSON.parse(localStorage.getItem("nhhr-atlas-access")!), until: Date.now() - 1 })));
  await page.reload();
  await expect(page.getByText("This page is password protected.")).toBeVisible();
});
