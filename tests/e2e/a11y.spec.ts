// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The simple version is the document-like view; the 3D room is a canvas behind the same HTML interface.
for (const view of ["simple", "3d"]) {
  test(`axe: no WCAG A/AA violations in the ${view} view`, async ({ page }) => {
    await page.goto(`/?view=${view}&qa`);
    await page.locator("h1").first().waitFor({ state: "attached" });
    if (view === "3d") await page.waitForTimeout(1500);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.map(violation => `${violation.id}: ${violation.nodes.length} node(s)`)).toEqual([]);
  });
}

test("skip link is the first tab stop and moves focus into the content", async ({ page }) => {
  await page.goto("/?view=simple");
  await page.locator("h1").waitFor({ state: "attached" });
  await page.keyboard.press("Tab");
  const skip = page.locator(".skip-link");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#intro$/);
});

test("exactly one h1, and chapter headings do not skip levels", async ({ page }) => {
  await page.goto("/?view=simple");
  await expect(page.locator("h1")).toHaveCount(1);
  const levels = await page.locator("main h1, main h2, main h3").evaluateAll(nodes => nodes.map(node => Number(node.tagName[1])));
  for (let index = 1; index < levels.length; index++) expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
});

test("command palette opens with Ctrl+K and closes with Escape", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await page.goto("/?view=simple");
  await page.locator("h1").waitFor({ state: "attached" });
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
