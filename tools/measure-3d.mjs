// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
// Bytes transferred and time until the preloader lifts for the 3D room (software GL here, so times are pessimistic).
//   node tools/measure-3d.mjs http://localhost:4173/?view=3d
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:4173/?view=3d";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
let bytes = 0; const sizes = [];
page.on("response", async response => { try { const body = await response.body(); bytes += body.length; sizes.push([response.url().split("/").slice(3).join("/"), body.length]); } catch { /* redirects */ } });
const start = Date.now();
await page.goto(url);
await page.locator(".loading-room").waitFor({ state: "detached", timeout: 240_000 }).catch(() => console.log("preloader still up after 240 s"));
const ready = Date.now() - start;
console.log(JSON.stringify({ url, kibTransferred: Math.round(bytes / 1024), msUntilRoomOpen: ready, largest: sizes.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, size]) => `${Math.round(size / 1024)} KiB ${name}`) }, null, 1));
await browser.close();
