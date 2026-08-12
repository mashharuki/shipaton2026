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

// 3.1: a genuinely fresh context's Home screen races the same sync
// useDatasetSync kicks off against its OWN one-shot read of the local store
// (index.tsx's `datasetsQuery`, queryKey ["home-datasets"]): react-query
// gives that read a default staleTime of 0, but nothing ever asks it to
// actually refetch once the sync (a separate query, a separate mount)
// finishes -- and Expo Router's tab navigator keeps Home mounted (not
// remounted) across tab switches, so no natural remount comes along to
// trigger react-query's own refetch-on-mount either. Confirmed live: on a
// fresh context, waiting 25+ real seconds with the from-picker open never
// populates it (station list, and therefore also the "no timetable today"
// banner -- both derive from the same `datasetsQuery.data` -- stay
// permanently empty/absent), but a single page.reload() once the sync has
// (by then) already succeeded in the background immediately fixes both,
// because a reload is a genuine remount that re-reads the by-then-populated
// local store. Needed at most once per test -- once the query has data it
// keeps it, so every later call sees it immediately without reloading
// again. STA_SHINJUKU is used as the readiness probe regardless of which
// station a scenario actually wants: it's in the fixture on every dayType,
// so its presence signals "the query resolved" independent of whatever the
// weekday/weekend outcome is.
export async function waitForDatasetsSynced(page: Page): Promise<void> {
  await page.getByTestId("search-from-trigger").click();
  const probe = page.getByTestId("search-from-STA_SHINJUKU");
  const readyOnFirstTry = await probe
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!readyOnFirstTry) {
    await page.reload();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    await page.getByTestId("search-from-trigger").click();
    await expect(probe).toBeVisible({ timeout: 15000 });
  }
  // Leave the form in its resting (closed-picker) state for the caller.
  await page.getByTestId("search-from-trigger").click();
}

// 3.1: the home screen's search form needs three selections before it can
// submit. Every scenario that just needs "a search happened" goes through
// this; search-form.spec.ts is the one that asserts the form itself.
export async function performSearch(
  page: Page,
  options: { from?: string; to?: string; time?: string } = {},
): Promise<void> {
  const from = options.from ?? "STA_SHINJUKU";
  const to = options.to ?? "STA_TOKYO";
  const time = options.time ?? "0730";

  await waitForDatasetsSynced(page);
  await page.getByTestId("search-from-trigger").click();
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
