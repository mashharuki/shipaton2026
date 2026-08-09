import { expect, test } from "@playwright/test";
import { completeOnboarding, waitForSearchResults } from "./helpers";

// detectDeviceLocale() (src/lib/i18n.ts) reads navigator.language via
// expo-localization, which Playwright's default context leaves at en-US --
// see language-and-offline.spec.ts's own comment on this. This spec asserts
// the Japanese demoSchedule string literally, so it needs the ja-JP locale
// pinned explicitly rather than inheriting whatever the runner's default is.
test.use({ locale: "ja-JP" });

test("uses the fixed weekday timetable for the home demo on weekends", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-08T07:00:00"));
  await page.goto("/");
  await completeOnboarding(page);

  await page.getByTestId("home-demo-search").click();

  await expect(
    page.getByText("デモ用ダイヤ：2026-08-04（平日）"),
  ).toBeVisible();
  await waitForSearchResults(page);
});

test("uses the fixed weekday timetable when reopening a saved demo route", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-08T07:00:00"));
  await page.goto("/");
  await completeOnboarding(page);

  await page.getByTestId("save-route-button").click();
  const savedRoute = page.getByText("STA_SHINJUKU → STA_TOKYO (07:30)");
  await expect(savedRoute).toBeVisible();
  await savedRoute.click();

  await expect(
    page.getByText("デモ用ダイヤ：2026-08-04（平日）"),
  ).toBeVisible();
  await waitForSearchResults(page);
});
