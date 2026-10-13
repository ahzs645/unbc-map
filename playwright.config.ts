import { defineConfig, devices } from "@playwright/test";

const base = process.env.ATLAS_BASE_PATH || "/";

export default defineConfig({
  testDir: "./tests",
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
