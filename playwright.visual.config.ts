import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  fullyParallel: true,
  reporter: [["html", { open: "never" }], ["list"]],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:6107",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node visual/serve-storybook-static.mjs 6107",
    url: "http://127.0.0.1:6107",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
