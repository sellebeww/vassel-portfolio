import { defineConfig, devices } from "@playwright/test";

// Tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: { command: "VITE_SITE_URL=http://localhost:4173 npm run build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: !process.env.CI, timeout: 180_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
