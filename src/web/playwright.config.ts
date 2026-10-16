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
      grepInvert: /@mid-width|@boundary|@wide/,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "tablet-dark-reduced",
      grepInvert: /@mid-width|@boundary|@wide/,
      use: {
        ...devices["iPad (gen 7)"],
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
    {
      name: "mid-width-light",
      grep: /@mid-width/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 900, height: 900 },
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "boundary-light",
      grep: /@boundary/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 641, height: 900 },
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "firefox-boundary-dark",
      grep: /@boundary/,
      use: {
        browserName: "firefox",
        viewport: { width: 641, height: 900 },
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
    {
      name: "wide-light",
      grep: /@wide/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1680, height: 1000 },
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "firefox-wide-dark",
      grep: /@wide/,
      use: {
        browserName: "firefox",
        viewport: { width: 1680, height: 1000 },
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
    {
      name: "phone-light",
      grepInvert: /@mid-width|@boundary|@wide/,
      use: {
        ...devices["Pixel 7"],
        colorScheme: "light",
        reducedMotion: "reduce",
      },
    },
    {
      name: "firefox-desktop-light",
      grepInvert: /@mid-width|@boundary|@wide/,
      use: {
        ...devices["Desktop Firefox"],
        colorScheme: "light",
        reducedMotion: "no-preference",
      },
    },
    {
      name: "firefox-tablet-dark-reduced",
      grepInvert: /@mid-width|@boundary|@wide/,
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
