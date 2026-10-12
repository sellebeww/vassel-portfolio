import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const output = new URL('../artifacts/qa/desk-accessories/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--use-angle=metal', '--hide-scrollbars'], protocolTimeout: 60000 });
const errors = [], checks = [], shots = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, JSON.stringify(detail)); };
try {
  const page = await browser.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => { errors.push(e.message); console.log(e.message); });
  page.on('console', msg => { if (msg.type() === 'error') { errors.push(msg.text()); console.log(msg.text()); } });
  await page.setRequestInterception(true);
  page.on('request', req => req.url().startsWith('https://api.github.com/') ? req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }) : req.continue());
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/?qa&lighting=night', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const { _roots } = await import(resources.find(e => /\/@react-three_fiber\.js/.test(e.name)).name);
    const THREE = await import(resources.find(e => /\/three\.js/.test(e.name)).name);
    window.deskQA = { store: _roots.get(document.querySelector('canvas')).store, THREE };
  });
  async function scroll(p) {
    await page.evaluate(p => scrollTo({ top: window.__scrollAt(p) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), p);
    await page.waitForFunction(p => Math.abs(Number(document.querySelector('canvas').dataset.renderedProgress) - p) < .0003, {}, p);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  await scroll(.43);
  const snapshot = await page.evaluate(() => {
    const { scene, gl, camera } = window.deskQA.store.getState(), { Box3, Vector3 } = window.deskQA.THREE;
    const names = ['compact-chessboard', 'reading-book-stack', 'maneki-neko', 'sudoku-notebook', 'kopi-kenangan-caramel-macchiato', 'pink-laptop', 'desk-mouse'];
    scene.updateMatrixWorld(true);
    const bounds = Object.fromEntries(names.map(name => { const obj = scene.getObjectByName(name), box = new Box3().setFromObject(obj); return [name, { min: box.min.toArray(), max: box.max.toArray(), meshes: obj.children.length }]; }));
    const overlap = [];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = bounds[names[i]], b = bounds[names[j]];
      if (a.min.every((v, k) => v < b.max[k] - .0001 && a.max[k] > b.min[k] + .0001)) overlap.push([names[i], names[j]]);
    }
    const project = name => { const p = new Vector3(); scene.getObjectByName(name).getWorldPosition(p); p.project(camera); return [(p.x + 1) * innerWidth / 2, (1 - p.y) * innerHeight / 2]; };
    return { bounds, overlap, draws: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures, accessoryDraws: names.slice(0, 4).reduce((n, name) => n + bounds[name].meshes, 0), positions: Object.fromEntries(names.map(name => [name, project(name)])), lamp: !!scene.getObjectByName('lamp-pool'), curry: !!scene.getObjectByName('stephen-curry-figurine'), monitors: [1, 2, 3].every(i => !!scene.getObjectByName(`desk-monitor-${i}`)) };
  });
  check('all accessories have separate physical footprints', snapshot.overlap.length === 0, snapshot);
  check('accessories stay within the oak desktop', Object.entries(snapshot.bounds).slice(0, 5).every(([, b]) => b.min[0] >= 1.1 && b.max[0] <= 3.74 && b.min[2] >= .845 && b.max[2] <= 1.875), snapshot.bounds);
  check('accessories sit on wood or felt', Object.entries(snapshot.bounds).slice(0, 5).every(([name, b]) => Math.abs(b.min[1] - (['maneki-neko', 'sudoku-notebook'].includes(name) ? .798 : .79)) < .0001), snapshot.bounds);
  check('accessories fit the desktop camera', Object.entries(snapshot.positions).slice(0, 5).every(([, p]) => p[0] > 60 && p[0] < 1140 && p[1] < 760), snapshot.positions);
  check('three monitors retained and lamp pool removed', snapshot.monitors && !snapshot.lamp && !snapshot.curry);
  check('merged accessories use at most 32 material draws', snapshot.accessoryDraws <= 32, snapshot.accessoryDraws);
  await page.screenshot({ path: new URL('desktop-night.png', output).pathname }); shots.push('desktop-night.png');
  // Detail image uses the production camera and a higher pixel density, with HTML hidden for inspection only.
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  const style = await page.addStyleTag({ content: '.topbar,.bottom-dock,.chapter,.scroll-hint,.chapter-counter,.scene-shade { visibility: hidden !important; }' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: new URL('desk-detail.png', output).pathname }); shots.push('desk-detail.png');
  // Export the actual printed texture to verify text isn't substituted by an external asset.
  const sleeve = await page.evaluate(() => { let result; window.deskQA.store.getState().scene.getObjectByName('kopi-kenangan-caramel-macchiato').traverse(o => { if (o.material?.map?.image?.width === 512) result = o.material.map.image.toDataURL(); }); return result; });
  await fs.writeFile(new URL('coffee-print.png', output), Buffer.from(sleeve.split(',')[1], 'base64'));
  await style.dispose(); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await scroll(.43); await page.keyboard.press('l');
  check('L still toggles warm environmental light', await page.$eval('.site', e => e.dataset.warmLight === 'off'));
  await page.keyboard.press('l');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/?qa&lighting=night', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await scroll(.43);
  await page.screenshot({ path: new URL('mobile-night.png', output).pathname }); shots.push('mobile-night.png');
  check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/?qa&lighting=day', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await scroll(.43); await page.screenshot({ path: new URL('desktop-day.png', output).pathname }); shots.push('desktop-day.png');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto('http://127.0.0.1:5173/?qa&lighting=night', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await scroll(.43);
  await page.screenshot({ path: new URL('desktop-shadows.png', output).pathname }); shots.push('desktop-shadows.png');
  check('normal motion renders with the full shadow profile', await page.$eval('canvas', e => e.dataset.quality === 'full'));
  check('no runtime or shader errors', errors.length === 0, errors);
} catch (e) { errors.push(e.stack); console.error(e); process.exitCode = 1; }
finally { await fs.writeFile(new URL('report.json', output), JSON.stringify({ errors, checks, shots }, null, 2)); await browser.close(); }
