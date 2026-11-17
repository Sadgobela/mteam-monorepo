import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, E2E_DATABASE_URL, PORT } from "./support/env.ts";

// Throwaway secrets for the test server, new on every run, so nothing secret is ever written down.
const secret = () => randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  // Every test signs in its own new users, so tests run side by side without sharing state.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  // None locally, so a flaky test shows up; one on CI, where a slow machine can miss a timing once. Retried tests are listed
  // as flaky. Known: now and then the page after saving an edit, or after saving the profile, never arrives in the browser
  // although the server answered in full (docs/E2E.md); a retry is reported, never hidden.
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // A navigation that has not finished in 20 seconds is stuck; failing then keeps a hang from using up the whole test.
    navigationTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "Asia/Tbilisi",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    // An iPhone-sized screen in Chromium; the shared page check also narrows it to 360px.
    {
      name: "phone",
      use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // The built app: `pnpm e2e` builds first. Never reuses a server already on the port, which could be on another database.
    command: `pnpm --filter @mteam/web start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      SITE_URL: BASE_URL,
      SMS_PROVIDER: "console",
      EMAIL_PROVIDER: "log",
      LOGIN_CODE_SECRET: secret(),
      CRON_SECRET: secret(),
      // The local SeaweedFS from docker-compose.yml, with the bucket storage-init creates.
      STORAGE_ENDPOINT: "http://localhost:8333",
      STORAGE_BUCKET: "mteam-photos",
      STORAGE_ACCESS_KEY_ID: "mteam-local",
      STORAGE_SECRET_ACCESS_KEY: "mteam-local-secret",
      STORAGE_PUBLIC_URL: "http://localhost:8333/mteam-photos",
      // Empty on purpose, even if a local .env sets them: features that need these keys must hide themselves.
      ANTHROPIC_API_KEY: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      VAPID_SUBJECT: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      FACEBOOK_APP_ID: "",
      FACEBOOK_APP_SECRET: "",
      APPLE_CLIENT_ID: "",
      APPLE_TEAM_ID: "",
      APPLE_KEY_ID: "",
      APPLE_PRIVATE_KEY: "",
    },
  },
});
