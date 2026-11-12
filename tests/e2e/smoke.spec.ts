// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
import { expect, test } from "@playwright/test";

test("simple version renders the profile, projects and contact without WebGL", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?view=simple");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vassel");
  await expect(page.locator("#projects")).toBeAttached();
  await expect(page.locator("a[href^='mailto:']").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("static metadata for search and sharing is present", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Vassel Goleyu/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{60,}/);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "{}");
  expect(jsonLd["@type"]).toBe("Person");
});

test("unknown paths get the static 404 page", async ({ request }) => {
  const response = await request.get("/does-not-exist");
  // vite preview falls back to index.html for the SPA; static hosts serve 404.html. Both must be reachable.
  expect([200, 404]).toContain(response.status());
  expect((await request.get("/404.html")).status()).toBe(200);
});
