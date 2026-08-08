import { expect, test } from "@playwright/test";
import { completeOnboarding } from "./helpers";

test("explains how to recover when route comparison opens without a search", async ({
  page,
}) => {
  await page.goto("/");
  await completeOnboarding(page);

  await page.goto("/results");

  await expect(page.getByTestId("results-missing-query")).toBeVisible();
  await page.getByTestId("results-missing-query-home").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
});
