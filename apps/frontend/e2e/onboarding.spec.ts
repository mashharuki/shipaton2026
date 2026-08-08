import { expect, test } from "@playwright/test";
import { completeOnboarding } from "./helpers";

// design.md E2E scenario 1: オンボーディング完了 → ホーム表示、再訪時にオン
// ボーディングが出ない（1.1, 1.5）
test("hides onboarding on revisit once it has been completed", async ({
  page,
}) => {
  await page.goto("/");
  await completeOnboarding(page);

  // Revisit: a reload re-runs app/_layout.tsx's OnboardingGateBoundary check
  // from scratch against the now-persisted onboarding_completed flag.
  await page.reload();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("onboarding-screen")).not.toBeVisible();
});
