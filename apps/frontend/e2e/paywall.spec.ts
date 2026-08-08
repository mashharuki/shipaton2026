import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  freezeToWeekday,
  setProOverride,
  waitForSearchResults,
} from "./helpers";

// design.md E2E scenario 3: Free 状態で 4 回目検索 → Paywall 表示、Pro モッ
// ク状態では非表示（12.1, 12.2）
test("shows the paywall on a Free user's 4th search of the day", async ({
  page,
}) => {
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  // 12.1: 3 searches/day are allowed on Free.
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("home-demo-search").click();
    await expect(page.getByTestId("results-screen")).toBeVisible();
    await waitForSearchResults(page);
    await page.getByTestId("results-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  }

  // 12.2: the 4th attempt is blocked before it ever reaches results.tsx.
  await page.getByTestId("home-demo-search").click();
  await expect(page.getByTestId("paywall-screen")).toBeVisible();
});

test("never shows the paywall for a Pro-mocked user regardless of search count", async ({
  page,
}) => {
  await setProOverride(page, true);
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  for (let i = 0; i < 4; i++) {
    await page.getByTestId("home-demo-search").click();
    await expect(page.getByTestId("results-screen")).toBeVisible();
    await waitForSearchResults(page);
    await page.getByTestId("results-back").click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  }
});
