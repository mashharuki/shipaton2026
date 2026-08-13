import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  freezeToWeekday,
  performSearch,
  waitForSearchResults,
} from "./helpers";

// 「最近の検索」の駅名は ja ロケールを前提にしているため、このファイルにも
// test.use({ locale: "ja-JP" }) を付ける。
test.use({ locale: "ja-JP" });

// 3.1: any station pair the synced timetable covers is searchable -- not
// just the one the old fixed demo query used.
test("searches an arbitrary station pair", async ({ page }) => {
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  // Only Shinjuku's own departures line up with the "0730" round numbers --
  // each downstream station's board shows the same train a few minutes
  // later (apps/backend/fixtures/datasets/timetable.json: the
  // TRAIN_WEEKDAY_0730 working departs Yotsuya at 07:36, not 07:30).
  // Verified against the fixture rather than guessed.
  await performSearch(page, {
    from: "STA_YOTSUYA",
    to: "STA_KANDA",
    time: "0736",
  });

  await expect(page.getByTestId("results-screen")).toBeVisible();
  await waitForSearchResults(page);
  await expect(page.getByTestId("route-card-fastest")).toBeVisible();
});

// 3.4: a recent search refills the form so it can be re-run.
test("refills the form from a recent search", async ({ page }) => {
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  await performSearch(page);
  await waitForSearchResults(page);
  await page.getByTestId("results-back").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("home-screen")).toBeVisible();

  await page.getByTestId("recent-search-STA_SHINJUKU-STA_TOKYO").click();

  await expect(page.getByTestId("search-from-trigger")).toContainText("新宿");
  await expect(page.getByTestId("search-to-trigger")).toContainText("東京");
});

// The destination picker must not offer the station already chosen as origin.
test("excludes the origin station from the destination picker", async ({
  page,
}) => {
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  await page.getByTestId("search-from-trigger").click();
  await expect(page.getByTestId("search-from-STA_SHINJUKU")).toBeVisible();
  await page.getByTestId("search-from-STA_SHINJUKU").click();
  await page.getByTestId("search-to-trigger").click();

  await expect(page.getByTestId("search-to-STA_SHINJUKU")).toHaveCount(0);
  await expect(page.getByTestId("search-to-STA_TOKYO")).toBeVisible();
});
