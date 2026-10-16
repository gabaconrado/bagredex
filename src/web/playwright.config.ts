import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.BAGREDEX_E2E_BASE_URL ?? "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-light",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "tablet-dark-reduced",
      use: {
        ...devices["iPad (gen 7)"],
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
    {
      name: "phone-light",
      use: {
        ...devices["Pixel 7"],
        colorScheme: "light",
        reducedMotion: "reduce",
      },
    },
    {
      name: "firefox-desktop-light",
      use: {
        ...devices["Desktop Firefox"],
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "firefox-tablet-dark-reduced",
      use: {
        browserName: "firefox",
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
  ],
});
