import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3040",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3040",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  },
});
