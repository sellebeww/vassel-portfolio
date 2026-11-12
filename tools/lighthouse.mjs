// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
// Mobile Lighthouse against a running server, using the Playwright Chromium that is already installed.
// Lighthouse is fetched with npx on demand; it is not a dependency of the site.
//   npm run build && npx vite preview --port 4173 &
//   node tools/lighthouse.mjs http://localhost:4173/?view=3d label
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url = "http://localhost:4173/", label = "run"] = process.argv.slice(2);
const out = `docs/perf/${label}.json`;
mkdirSync("docs/perf", { recursive: true });
const run = spawnSync("npx", ["--yes", "lighthouse@12", url,
  "--chrome-flags=--headless=new --no-sandbox", "--only-categories=performance,accessibility,best-practices,seo",
  "--output=json", `--output-path=${out}`, "--quiet"], { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromium.executablePath() } });
if (run.status !== 0) process.exit(run.status ?? 1);
const report = JSON.parse(readFileSync(out, "utf8")), audit = id => report.audits[id];
const summary = {
  url, label, fetchTime: report.fetchTime,
  scores: Object.fromEntries(Object.entries(report.categories).map(([key, value]) => [key, Math.round(value.score * 100)])),
  fcp: audit("first-contentful-paint").displayValue, lcp: audit("largest-contentful-paint").displayValue,
  tbt: audit("total-blocking-time").displayValue, cls: audit("cumulative-layout-shift").displayValue,
  speedIndex: audit("speed-index").displayValue, transferred: audit("total-byte-weight").displayValue,
};
console.log(JSON.stringify(summary, null, 2));
// Keep only the summary in the repository; the full report is several hundred kB.
writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
