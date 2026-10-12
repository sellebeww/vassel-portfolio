import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const phase = process.argv.includes('--before') ? 'before' : 'after';
const dir = new URL(`../artifacts/polish/${phase}/`, import.meta.url); await fs.mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--use-angle=metal', '--hide-scrollbars'], protocolTimeout: 90000 });
const report = { phase, errors: [], checks: [], performance: null };
const check = (name, ok) => { report.checks.push({ name, ok }); assert.ok(ok, name); console.log('PASS', name); };
try {
 const page = await browser.newPage(); page.setDefaultTimeout(60000);
 page.on('pageerror', e => report.errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request', req => req.url().startsWith('https://api.github.com/') ? req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }) : req.continue());
 async function load(width, height, reduced = true) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.goto('http://127.0.0.1:5173/?qa&lighting=night', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
 }
 async function scroll(p) {
  await page.evaluate(p => scrollTo({ top: window.__scrollAt(p) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), p);
  await page.waitForFunction(p => Math.abs(Number(document.querySelector('canvas').dataset.renderedProgress) - p) < .0005, {}, p);
 }
 await load(1440,1000);
 await page.screenshot({ path: new URL('hero.png', dir).pathname });
 await scroll(.43); await page.screenshot({ path: new URL('desk.png', dir).pathname });
 await load(1440,1000,false); await scroll(.43);
 report.performance = await page.evaluate(async () => {
  // Let first-use shaders and asset uploads settle before sampling frames.
  await new Promise(r => setTimeout(r, 5000));
  const r = performance.getEntriesByType('resource');
  const { _roots } = await import(r.find(e => /\/@react-three_fiber\.js/.test(e.name)).name);
  const store = _roots.get(document.querySelector('canvas')).store, { gl, scene } = store.getState();
  const original = gl.render, times = [], submit = [];
  gl.render = function(s, c) { const a = performance.now(); const out = original.call(this,s,c); if(s===scene) { times.push(a); submit.push(performance.now()-a); } return out; };
  await new Promise(r => setTimeout(r,4000)); gl.render = original;
  const intervals = times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b), sorted = submit.sort((a,b)=>a-b);
  const objects = {}; for(const name of ['personal-desk-accessories','workspace-desk']) { let calls=0, triangles=0; scene.getObjectByName(name).traverse(o=>{if(o.isMesh){calls++; triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}}); objects[name]={calls,triangles}; }
  return { viewport:[innerWidth,innerHeight],dpr:gl.getPixelRatio(),profile:gl.domElement.dataset.quality, frames:times.length,fps:Math.round((times.length-1)*1000/(times.at(-1)-times[0])*10)/10,medianFrameMs:intervals[Math.floor(intervals.length*.5)],p95FrameMs:intervals[Math.floor(intervals.length*.95)],medianSubmitMs:sorted[Math.floor(sorted.length*.5)],draws:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures,objects };
 }); console.log(JSON.stringify(report.performance));
 await page.screenshot({ path: new URL('desk-shadows.png', dir).pathname });
 if(phase==='after') {
  check('project selector and arrows are accessible, with no pause button',await page.$eval('.project-picker select',e=>e.options.length===9) && (await page.$$('.project-picker button[aria-label$="project"]')).length===2 && !await page.$('.project-playback'));
  await page.select('.project-picker select','1'); await page.waitForFunction(()=>document.querySelector('.project-note h3')?.textContent==='BatchAman'); check('project selection changes the story',await page.$eval('.project-note h3',e=>e.textContent==='BatchAman'));
  await page.keyboard.press('Tab'); check('keyboard focus is visible',await page.evaluate(()=>document.activeElement.matches(':focus-visible')));
 }
 await load(390,844); await page.screenshot({ path:new URL('mobile-hero.png',dir).pathname });
 await scroll(.43); await page.screenshot({ path:new URL('mobile-project.png',dir).pathname });
 check('mobile no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(phase==='after') {
  check('project explanation is visible on mobile',await page.$eval('.project-note p',e=>getComputedStyle(e).display!=='none'));
  check('mobile navigation has readable names',await page.$eval('.topbar nav span',e=>getComputedStyle(e).display!=='none'));
  await page.click('[data-view="reading"]'); await page.waitForSelector('.is-fallback');
  check('reading view exposes all sections',await page.$$eval('main > section',els=>els.every(e=>!e.inert)));
  await page.screenshot({ path:new URL('reading-view.png',dir).pathname });
  await page.click('[data-view="reading"]');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  check('reading view can return to the 3D room', !await page.$('.is-fallback'));
  const loading = await browser.newPage();
  await loading.setViewport({ width: 320, height: 740 });
  await loading.setRequestInterception(true);
  loading.on('request', req => /RoomScene\.tsx/.test(req.url()) ? undefined : req.continue());
  await loading.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await loading.waitForSelector('.loading-slow button', { timeout: 30000 }); await loading.click('.loading-slow button');
  await loading.waitForSelector('.is-fallback');
  check('content is reachable while 3D is still loading', await loading.$$eval('main > section', els => els.length === 6 && els.every(e => !e.inert)));
  check('320px reading view has no horizontal overflow', await loading.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await loading.close();
 }
 check('no browser errors',report.errors.length===0);
} catch(e) { report.errors.push(e.stack); console.error(e); process.exitCode=1; }
finally { await fs.writeFile(new URL('report.json',dir),JSON.stringify(report,null,2)); await browser.close(); }
