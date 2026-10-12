import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const output = new URL('../artifacts/qa/journey/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const errors = [], checks = [], captures = [];
let browser;
function check(name, passed, detail) { checks.push({ name, passed, detail }); assert.ok(passed, name); console.log(`PASS ${name}`); }
try {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--use-angle=metal', '--hide-scrollbars'], protocolTimeout: 60000 });
  const page = await browser.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /Shader Error|VALIDATE_STATUS|Error compiling|WebGLProgram/i.test(m.text())) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  async function load(width, height) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:5173/?qa&lighting=night', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.scene-ready:not(.is-fallback)');
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
    await page.evaluate(async () => {
      const entry = performance.getEntriesByType('resource').find(e => /\/@react-three_fiber\.js/.test(e.name));
      const threeEntry = performance.getEntriesByType('resource').find(e => /\/three\.js/.test(e.name));
      const { _roots } = await import(entry.name), { Box3, Vector3 } = await import(threeEntry.name);
      const store = _roots.get(document.querySelector('canvas')).store;
      window.sceneSnapshot = () => {
        const { scene, camera } = store.getState();
        const bounds = name => {
          const object = scene.getObjectByName(name); if (!object) return null;
          const box = new Box3().setFromObject(object), points = [];
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const p = new Vector3(x,y,z).project(camera); points.push([(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2]);
          }
          return { left: Math.min(...points.map(p=>p[0])), right: Math.max(...points.map(p=>p[0])), top: Math.min(...points.map(p=>p[1])), bottom: Math.max(...points.map(p=>p[1])) };
        };
        return { progress: Number(document.querySelector('canvas').dataset.renderedProgress),
          character: Boolean(scene.getObjectByName('vassel-seated-coder')), desk: bounds('workspace-desk'),
          projects: [1,2,3].map(i => { const group = scene.getObjectByName(`scroll-project-${i}`); return { visible: group?.visible, opacity: group?.material?.opacity }; }),
          stack: Boolean(scene.getObjectByName('documented-tech-stack')?.visible && scene.getObjectByName('stack-board-languages') && scene.getObjectByName('stack-board-web')),
          monitors: [1,2,3].map(i=>bounds(`desk-monitor-${i}`)),
          detachedDisplays: Boolean(scene.getObjectByName('scroll-project-gallery')),
          screen: bounds('Laptop_Screen_REPLACE'), camera: camera.position.toArray(),
          projectorScale: scene.getObjectByName('experience-projector')?.scale.x, almetScale: scene.getObjectByName('almet-exhibit')?.scale.x };
      };
    });
  }
  async function scroll(p) {
    await page.evaluate(p => window.scrollTo({ top: (window.__scrollAt ? window.__scrollAt(p) : p) * (document.documentElement.scrollHeight-innerHeight), behavior:'instant' }),p);
    await page.waitForFunction(p => Math.abs(Number(document.querySelector('canvas')?.dataset.renderedProgress)-p)<.0003, {},p);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  async function capture(name) {
    await page.screenshot({ path:new URL(`${name}.png`,output).pathname });
    const info = await page.evaluate(() => ({ ...window.sceneSnapshot(), overflow: document.documentElement.scrollWidth>innerWidth+1, contact: document.querySelector('.contact-portal')?.getBoundingClientRect().toJSON() }));
    captures.push({name,...info});
    if(name.endsWith('-desk')) check(`${name}: all monitors fit the viewport`,info.monitors.every(b=>b.left>0 && b.right<(name.startsWith('mobile')?390:1440) && b.top>60),info.monitors);
    check(`${name}: no horizontal overflow`,!info.overflow); console.log(`CAPTURE ${name}`); return info;
  }
  await load(1440,1000);
  check('navigation places Projects before Tech Stack', await page.$$eval('nav button', bs => bs.map(b=>b.getAttribute('aria-label')).join(',')) === 'Profile,Experiences,Achievements,Projects,Tech Stack,Contact');
  await scroll(.14); const experience = await capture('desktop-experience');
  check('larger projector and almet',experience.projectorScale>=1.4 && experience.almetScale>1.2);
  await scroll(.43); const desk = await capture('desktop-desk');
  check('no seated character in workspace', !desk.character);
  check('project photos are already on all three monitors at the desk',desk.projects.every(p=>p.visible && p.opacity>.95));
  check('no detached project boards',!desk.detachedDisplays);
  await scroll(.50); const photos = await capture('desktop-photos'); check('photos hold on every monitor',photos.projects.every(p=>p.visible && p.opacity>.95) && !photos.stack);
  await scroll(.726); const coding=await capture('desktop-coding'); check('screenshots stay on the monitors as the zoom begins, boards not yet up',!coding.stack && coding.projects.some(p=>p.visible)); check('the zoom starts at once, with no still stretch after the photos',coding.camera[2]<desk.camera[2]);
  await scroll(.78); const stack=await capture('desktop-stack'); check('language and web-stack boards stand beside the laptop up close',stack.stack); check('camera has come in close for the boards',stack.camera[2]<coding.camera[2]);
  for (const [p,name] of [[.86,'laptop'],[.92,'screen'],[.955,'entering'],[.99,'contact']]) { await scroll(p); await capture(`desktop-${name}`); }
  check('contact becomes a live accessible interface',await page.$eval('.contact-portal',e=>!e.inert && e.getAttribute('aria-hidden')==='false'));
  check('verified GitHub link',await page.$eval('.contact-socials a',e=>e.href)==='https://github.com/sellebeww');
  await page.type('input[name="name"]','Scroll test'); await page.type('input[name="email"]','hello@example.com'); await page.type('textarea[name="message"]','A project idea.');
  check('real contact form validates input',await page.$eval('.contact-form',f=>f.checkValidity()));
  await scroll(.80); check('contact controls leave tab order while camera is outside',await page.$eval('.contact-portal',e=>e.inert));
  await scroll(.99); check('form state survives reverse scroll',await page.$eval('input[name="name"]',e=>e.value)==='Scroll test');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await scroll(.80); await scroll(.99); check('normal-motion scroll reaches Contact', await page.$eval('.contact-portal',e=>!e.inert));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await load(390,844);
  for (const [p,name] of [[.14,'experience'],[.43,'desk'],[.50,'project'],[.80,'stack'],[.92,'screen'],[.99,'contact']]) { await scroll(p); await capture(`mobile-${name}`); }
  check('mobile Contact can scroll to its form',await page.$eval('.contact-portal',e=>e.scrollHeight>e.clientHeight));
  await page.$eval('.contact-portal',e=>e.scrollTop=650); await page.screenshot({path:new URL('mobile-contact-form.png',output).pathname});
  await page.click('.contact-web-footer button');
  await page.waitForFunction(()=>document.querySelector('.site')?.dataset.active==='projects');
  check('return CTA reverses to Projects',true);
  check('no browser, shader or HTTP errors',errors.length===0,errors);
  const fallback = await browser.newPage();
  await fallback.setViewport({width:390,height:844});
  await fallback.evaluateOnNewDocument(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};
  });
  await fallback.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle0'});
  await fallback.waitForSelector('.is-fallback');
  await fallback.click('nav button[aria-label="Contact"]');
  check('Contact remains reachable without WebGL',await fallback.$eval('.contact-portal',e=>!e.inert && e.getBoundingClientRect().top<100));
  await fallback.close();
} catch(error) {errors.push(error.stack); console.error(error.stack);process.exitCode=1;}
finally {await fs.writeFile(new URL('report.json',output),JSON.stringify({errors,checks,captures},null,2));await browser?.close();console.log(JSON.stringify({errors,checks:checks.length,captures:captures.map(c=>c.name)},null,2));}
