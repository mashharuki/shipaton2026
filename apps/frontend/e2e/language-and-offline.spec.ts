import { expect, test } from "@playwright/test";
import { completeOnboarding, freezeToWeekday } from "./helpers";

// design.md E2E scenario 4a: 言語切替の即時反映（14.3）
test("switches language immediately without a reload", async ({ page }) => {
  await page.goto("/");
  await completeOnboarding(page);

  await page.getByTestId("tab-settings").click();
  const screen = page.getByTestId("settings-screen");
  await expect(screen).toBeVisible();
  // Playwright's default browser locale (en-US) drives detectDeviceLocale(),
  // so English is the starting state. Scoped to the screen -- "Settings"
  // also appears as the tab label itself, ambiguous unscoped.
  await expect(screen.getByText("Settings", { exact: true })).toBeVisible();

  await page.getByTestId("settings-language-ja").click();
  await expect(screen.getByText("設定", { exact: true })).toBeVisible();

  await page.getByTestId("settings-language-en").click();
  await expect(screen.getByText("Settings", { exact: true })).toBeVisible();
});

// design.md E2E scenario 4b: オフライン（ネットワーク遮断）時のエラー表示・
// 再試行（15.1, 15.5）. Aborting the datasets API (rather than
// context.setOffline) deterministically reproduces "search reached before
// any dataset ever synced" -- the one path in this app that surfaces
// ErrorState with a retry affordance (see helpers.ts's
// waitForSearchResults for why: a real network outage on an *already
// synced* device wouldn't error at all, per 15.2's offline-viewing
// requirement -- this scenario is deliberately the never-synced case).
test("shows a retryable error when the dataset sync never succeeds", async ({
  page,
}) => {
  await freezeToWeekday(page);
  await page.route("**/v1/datasets/**", (route) => route.abort());

  await page.goto("/");
  await completeOnboarding(page);

  await page.getByTestId("home-demo-search").click();
  await expect(page.getByTestId("results-screen")).toBeVisible();
  await expect(page.getByTestId("error-state")).toBeVisible();
  const retryButton = page.getByTestId("error-state-retry");
  await expect(retryButton).toBeVisible();

  // 15.5: retrying re-attempts the query rather than crashing -- still
  // blocked (the route is aborted for the whole test), so the same
  // retryable error state is what should still be showing afterward.
  await retryButton.click();
  await expect(page.getByTestId("error-state")).toBeVisible();
});
