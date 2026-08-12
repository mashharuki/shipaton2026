import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  performSearch,
  waitForDatasetsSynced,
  waitForSearchResults,
} from "./helpers";

// detectDeviceLocale() (src/lib/i18n.ts) reads navigator.language via
// expo-localization, which Playwright's default context leaves at en-US --
// see language-and-offline.spec.ts's own comment on this. This spec asserts
// a Japanese string literally, so it needs the ja-JP locale pinned.
test.use({ locale: "ja-JP" });

// 15.3: the bundled dataset is weekday-only. On a weekend the form must say
// so and offer the weekday timetable instead of silently finding nothing.
test("offers the weekday timetable when today has no schedule data", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-08T07:00:00"));
  await page.goto("/");
  await completeOnboarding(page);
  await waitForDatasetsSynced(page);

  await expect(page.getByTestId("search-no-timetable-today")).toBeVisible();

  // The form stays usable: searchDayType falls back to weekday, so the time
  // picker still offers the weekday departures.
  await performSearch(page);
  await expect(
    page.getByText(/平日ダイヤ（2026-08-10）で表示中/),
  ).toBeVisible();
  await waitForSearchResults(page);
});

// 9.1/9.5: a saved route stores the form's real selection and reopens it.
test("saves the selected route and reopens it", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-04T07:00:00"));
  await page.goto("/");
  await completeOnboarding(page);

  await performSearch(page);
  await waitForSearchResults(page);
  await page.getByTestId("results-back").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();

  await page.getByTestId("save-route-button").click();
  const savedRoute = page.getByText("新宿 → 東京 (07:30)");
  await expect(savedRoute).toBeVisible();

  await savedRoute.click();
  await waitForSearchResults(page);
});
