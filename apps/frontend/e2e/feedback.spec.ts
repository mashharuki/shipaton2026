import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  freezeToWeekday,
  performSearch,
  setProOverride,
  waitForSearchResults,
} from "./helpers";

// design.md E2E scenario 5: フィードバックフローの 2 タップ送信 UI（8.1,
// 8.4）. Reaching feedback.tsx requires starting a ride, which is Pro-gated
// (route-detail.tsx's handleStartRide -- usePaywallGate({type:"pro_feature",
// feature:"coach"})), so this scenario needs the Pro mock regardless of
// which outcome it exercises.
test("submits feedback in a single tap for the seated-from-start outcome", async ({
  page,
}) => {
  await setProOverride(page, true);
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  await performSearch(page);
  await waitForSearchResults(page);
  await page.getByTestId("route-card-comfort").click();
  await expect(page.getByTestId("route-detail-screen")).toBeVisible();

  await page.getByTestId("route-detail-start-ride").click();
  await expect(page.getByTestId("coach-screen")).toBeVisible();
  await expect(page.getByTestId("coach-content")).toBeVisible({
    timeout: 10000,
  });

  await page.getByTestId("coach-end-ride").click();
  await expect(page.getByTestId("feedback-screen")).toBeVisible();

  // 8.1/8.4: a single tap on an outcome that needs no station disambiguation
  // submits directly.
  await page.getByTestId("feedback-seated-from-start").click();
  await expect(page.getByTestId("feedback-confirmation")).toBeVisible();
});

test("submits feedback in two taps for the seated-from-middle outcome", async ({
  page,
}) => {
  await setProOverride(page, true);
  await freezeToWeekday(page);
  await page.goto("/");
  await completeOnboarding(page);

  await performSearch(page);
  await waitForSearchResults(page);
  await page.getByTestId("route-card-comfort").click();
  await expect(page.getByTestId("route-detail-screen")).toBeVisible();

  await page.getByTestId("route-detail-start-ride").click();
  await expect(page.getByTestId("coach-content")).toBeVisible({
    timeout: 10000,
  });

  await page.getByTestId("coach-end-ride").click();
  await expect(page.getByTestId("feedback-screen")).toBeVisible();

  // 8.1/8.4: tap 1/2 -- needs to disambiguate which station the seat opened
  // up at, so this outcome (unlike seated-from-start) doesn't submit yet.
  await page.getByTestId("feedback-seated-from-middle").click();
  const stationOption = page
    .locator('[data-testid^="feedback-station-"]')
    .first();
  await expect(stationOption).toBeVisible();

  // tap 2/2: picking the station is what actually submits.
  await stationOption.click();
  await expect(page.getByTestId("feedback-confirmation")).toBeVisible();
});
