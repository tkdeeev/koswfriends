import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "webkit",
      testMatch: "**/mobile.spec.ts",
      use: {
        browserName: "webkit",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      },
    },
  ],
  use: {
    baseURL: "http://localhost:3100",
    locale: "en-GB",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: { NODE_ENV: "development" },
  },
});
