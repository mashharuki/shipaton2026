import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// 4.6/18.6: E2E scope is the Expo web target only (Playwright drives a real
// browser; ネイティブ専用機能 -- NativeTabs, purchases, etc. -- are covered
// by the real-device manual/argent verification design.md's E2E章 splits
// this into). testID is the sole selector convention (see components/
// app-tabs.web.tsx, app/{index,report,settings}.tsx): react-native-web
// forwards `testID` straight to the DOM as `data-testid`, so
// `page.getByTestId(...)` works the same way it will once Playwright covers
// real screens in task 10.2.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8081",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Bundles both servers the E2E suite needs: the Expo web target itself,
  // and the local Workers API (design.md: "ローカル Workers（またはモック
  // API）を束ねる"). This task's own smoke test only needs the former --
  // the backend is started here so later tasks' API-calling scenarios
  // (10.2) can land without touching this config's shape.
  webServer: [
    {
      command: "npx expo start --web --port 8081",
      url: "http://localhost:8081",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      // /doc (OpenAPI JSON) is the readiness probe -- it's the one route
      // that needs no x-api-key (design.md: "/doc stays" outside the auth
      // middleware), unlike "/", which has no handler and 404s.
      command: "pnpm --filter backend dev",
      url: "http://localhost:8787/doc",
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
