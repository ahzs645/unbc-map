import { defineConfig, devices } from "@playwright/test";

const base = process.env.ATLAS_BASE_PATH || "/";
// The main suite drives every feature, so it needs a `npm run build:all` site.
// `npm run test:production` checks a plain `npm run build` against manifest/.
const production = process.env.ATLAS_TEST_PROFILE === "production";

export default defineConfig({
  testDir: production ? "./tests/production" : "./tests",
  testIgnore: production ? undefined : "production/**",
  timeout: 30000,
  use: {
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    baseURL: `http://127.0.0.1:5180${base}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1360, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run preview -- --port 5180 --strictPort --base ${base}`,
    url: `http://127.0.0.1:5180${base}`,
    reuseExistingServer: false,
  },
});
