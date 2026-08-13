import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// 3.x/4.x: apps/backend/fixtures/datasets/timetable.json only has
// `dayType: "weekday"` entries -- use-route-search.ts's queryFn computes
// `toDayType(new Date())` from the *real* wall clock (Sunday=0/Saturday=6 ->
// "weekend"), so any scenario that searches routes silently gets zero
// results whenever the suite happens to run on a real-world weekend.
// Confirmed live: on 2026-08-08 (a Saturday), the demo search returned an
// empty route list with no error state at all. Freezing the clock to a
// fixed weekday (any Tue/Wed/Thu works -- the fixture's `dayType` is not
// tied to a specific calendar date) makes every search-dependent scenario
// deterministic regardless of which real day CI runs on.
const FIXED_WEEKDAY = new Date("2026-08-04T07:00:00");

export async function freezeToWeekday(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_WEEKDAY);
}

// 1.1-1.5: a fresh browser context (no onboarding_completed kv-store flag)
// always lands on /onboarding first -- app/_layout.tsx's OnboardingGateBoundary
// redirects there once its async kv-store check resolves. Every scenario that
// needs the home screen goes through this once; scenario 1 in
// onboarding.spec.ts is the one that asserts the gating itself.
export async function completeOnboarding(page: Page): Promise<void> {
  await expect(page.getByTestId("onboarding-screen")).toBeVisible();
  // step 1/3 (value), step 2/3 (disclaimer)
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  // step 3/3 (privacy) -- same testID, now the "start" action
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
}

// 15.1/15.3/15.5: a genuinely fresh context's first-ever search can race
// useDatasetSync's background sync (still in flight) -- results.tsx then
// shows the "data for this line isn't downloaded yet" ErrorState with a
// retry button, exactly the retryable-error behavior this app is designed
// to show (design.md's own testing note: "error-state.tsx is exercised by
// Playwright, not Vitest"). Confirmed live: this genuinely happens even
// serially (--workers=1), not just under parallel contention. Retrying
// mirrors what a real user hitting that same transient race would do, and
// keeps the assertion deterministic regardless of backend response time.
export async function waitForSearchResults(page: Page): Promise<void> {
  const resultsList = page.getByTestId("results-list");
  const retryButton = page.getByTestId("error-state-retry");
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await resultsList.isVisible().catch(() => false)) {
      return;
    }
    // Tolerant: the underlying query can resolve (and this button detach
    // mid-click) between the isVisible() check above and the click actually
    // landing -- that race is itself a sign the data just arrived, so just
    // loop back and check resultsList again rather than failing on it.
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click({ timeout: 3000 }).catch(() => undefined);
    }
    await page.waitForTimeout(1000);
  }
  await expect(resultsList).toBeVisible({ timeout: 10000 });
}

// 3.1: the home screen's search form needs three selections before it can
// submit. Every scenario that just needs "a search happened" goes through
// this; search-form.spec.ts is the one that asserts the form itself.
//
// Fix round 1 (Task 7): this used to need a page.reload() fallback here
// because index.tsx's `home-datasets` read could permanently lose its race
// against useDatasetSync's background sync (no code anywhere ever asked
// that read to look again once the sync landed). That race is now closed on
// the product side -- use-dataset-sync.ts invalidates the `home-datasets`
// query key once every sync attempt settles -- so a plain visibility wait
// for the option this call actually wants is enough; no reload, no retry
// loop, no separate always-present probe station needed.
export async function performSearch(
  page: Page,
  options: { from?: string; to?: string; time?: string } = {},
): Promise<void> {
  const from = options.from ?? "STA_SHINJUKU";
  const to = options.to ?? "STA_TOKYO";
  const time = options.time ?? "0730";

  await page.getByTestId("search-from-trigger").click();
  await expect(page.getByTestId(`search-from-${from}`)).toBeVisible();
  await page.getByTestId(`search-from-${from}`).click();
  await page.getByTestId("search-to-trigger").click();
  await page.getByTestId(`search-to-${to}`).click();
  await page.getByTestId("search-time-trigger").click();
  await page.getByTestId(`search-time-${time}`).click();
  await page.getByTestId("search-submit").click();
}

// 10.2/design.md: "課金は SubscriptionGate のモック（Preview API Mode 相当）
// で Free / Pro 両状態を切り替えて検証する" -- forces isPro() on the web
// target via subscription-gate.ts's e2eProOverride(). Must run via
// addInitScript (before the page's own scripts, i.e. before any isPro()
// call) rather than page.evaluate after load. No-op on Free: the app
// already defaults to Free on web (no RevenueCat SDK configured there),
// so only the Pro case needs an explicit override.
export async function setProOverride(
  page: Page,
  isPro: boolean,
): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("e2e_pro_override", String(value));
  }, isPro);
}
