// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
import { expect, test } from "@playwright/test";

test("simple version lists the case studies with limits and repository links", async ({ page }) => {
  await page.goto("/?view=simple");
  const section = page.locator(".case-section");
  await expect(section.locator("article")).toHaveCount(5);
  await expect(section.getByRole("link", { name: /Repository and README/ }).first()).toHaveAttribute("href", /github\.com\/sellebeww\//);
  await expect(section.locator(".case-facts dt", { hasText: "Limits" })).toHaveCount(5);
});

test("the #case-studies address opens the case studies dialog", async ({ page }) => {
  await page.goto("/?view=simple");
  await page.evaluate(() => { window.location.hash = "#case-studies"; });
  await expect(page.getByRole("dialog", { name: "Case studies" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
