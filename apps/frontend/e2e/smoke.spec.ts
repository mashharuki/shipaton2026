import { expect, test } from "@playwright/test";
import { completeOnboarding } from "./helpers";

// 4.6/10.1: the minimal smoke scenario this task owns -- app loads to the tab
// layout and all 3 tabs are reachable. Deeper flows (search, purchase,
// feedback, ...) are task 10.2's job, once more screens exist to test.
//
// A fresh context has no onboarding_completed flag, so app/_layout.tsx's
// OnboardingGateBoundary always redirects "/" to "/onboarding" first --
// completeOnboarding() clears that gate before this test's own assertions.
test("shows all three tabs and navigates between them", async ({ page }) => {
  await page.goto("/");
  await completeOnboarding(page);

  await expect(page.getByTestId("tab-home")).toBeVisible();
  await expect(page.getByTestId("tab-report")).toBeVisible();
  await expect(page.getByTestId("tab-settings")).toBeVisible();

  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-screen")).toBeVisible();

  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
});
