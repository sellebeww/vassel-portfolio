import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const output = new URL('../artifacts/qa/features/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const ORIGIN = 'http://127.0.0.1:5173', errors = [], checks = [];
const check = (name, passed, detail) => { checks.push({ name, passed, detail }); assert.ok(passed, `${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); console.log(`PASS ${name}`); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const repo = (name, extra = {}) => ({ name, html_url: `https://github.com/sellebeww/${name}`, description: `${name} description`, language: 'TypeScript', homepage: null, pushed_at: '2026-10-01T00:00:00Z', stargazers_count: 0, topics: [], fork: false, archived: false, ...extra });
const fixture = [repo('sellebeww', { language: 'Python' }), repo('Unity-game', { language: 'C#', pushed_at: '2026-10-10T00:00:00Z' }), repo('tomato-vision', { language: 'Jupyter Notebook', homepage: 'https://sellebeww.github.io/tomato-vision/', topics: ['cnn', 'keras'], pushed_at: '2026-10-09T00:00:00Z' }),
  repo('Batch-Aman', { homepage: 'https://sellebeww.github.io/Batch-Aman/' }), repo('Ucup-Menjelajahi-Nusantara', { language: 'JavaScript' }), repo('a-fork', { fork: true }), repo('laravel-clinic', { language: 'PHP', description: 'Clinic records with Laravel' })];

let browser;
async function open(width = 1440, height = 1000, { github = 'ok', url = '/?qa', reduced = true, noWebGL = false } = {}) {
  // A fresh context per page: no shared localStorage, so the one-hour GitHub cache never leaks between scenarios.
  const context = await browser.createBrowserContext(), page = await context.newPage(); page.setDefaultTimeout(60000);
  page.close = () => context.close();
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  const expected = noWebGL ? /api\.github\.com|Failed to load resource|WebGL|3D scene failed|SceneBoundary/ : /api\.github\.com|Failed to load resource/;
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const u = request.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return request.abort();
    if (u.startsWith('https://api.github.com/')) {
      page.githubCalls = (page.githubCalls ?? 0) + 1;
      const cors = { 'access-control-allow-origin': '*' };
      return github === 'ok' ? request.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(fixture) })
        : request.respond({ status: 403, contentType: 'application/json', headers: cors, body: '{"message":"rate limit"}' });
    }
    request.continue();
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  if (noWebGL) await page.evaluateOnNewDocument(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return String(type).includes('webgl') ? null : original.call(this, type, ...args); }; });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(ORIGIN + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(noWebGL ? '.is-fallback' : '.scene-ready:not(.is-fallback)');
  if (!noWebGL) await page.waitForFunction(() => document.querySelector('canvas')?.dataset.workspaceReady === 'true');
  await sleep(450); // the initial hash jump runs 150 ms after mount
  return page;
}
const scroll = async (page, p) => {
  await page.evaluate(p => window.scrollTo({ top: (window.__scrollAt ? window.__scrollAt(p) : p) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), p);
  await page.waitForFunction(p => Math.abs(Number(document.querySelector('canvas')?.dataset.renderedProgress) - p) < .0005, {}, p);
};
const active = page => page.$eval('.site', e => e.dataset.active);
const hash = page => page.evaluate(() => location.hash);
const dialogTitle = page => page.$eval('[role="dialog"] h2', e => e.textContent).catch(() => null);
const press = async (page, key, modifier) => { if (modifier) await page.keyboard.down(modifier); await page.keyboard.press(key); if (modifier) await page.keyboard.up(modifier); };

try {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--use-angle=metal', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'], protocolTimeout: 90000 });

  // ── Palette, hotkeys, title, announcements ──────────────────────────────
  let page = await open();
  check('no GitHub request before Projects is reached', (page.githubCalls ?? 0) === 0);
  await press(page, 'k', 'Meta');
  await page.waitForSelector('[role="dialog"][aria-label="Command palette"]');
  check('Cmd+K opens a palette whose input is a focused combobox', await page.evaluate(() => { const i = document.activeElement; return i.getAttribute('role') === 'combobox' && i.getAttribute('aria-controls') === document.querySelector('[role="listbox"]').id; }));
  check('page behind the palette is inert', await page.$eval('.topbar', e => e.inert) && await page.$eval('main', e => e.inert));
  await page.screenshot({ path: new URL('palette.png', output).pathname });
  const groups = await page.$$eval('.palette-group', els => els.map(e => e.textContent));
  check('palette is grouped when the query is empty', ['Go to', 'Open', 'Room', 'Contact', 'Roles', 'Certificates'].every(g => groups.includes(g)), groups);
  await page.keyboard.type('supervisor'); await sleep(100);
  check('typing filters roles', (await page.$$eval('[role="option"]', els => els.map(e => e.textContent))).some(t => t.includes('Supervisor, Mister & Miss UMN')));
  await press(page, 'Enter');
  await page.waitForSelector('.modal');
  check('Enter runs the command and opens that role as a dialog', await dialogTitle(page) === 'Supervisor, Mister & Miss UMN');
  check('role overlay gets its own address', await hash(page) === '#role/bem-supervisor', await hash(page));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal'));
  await sleep(150);
  check('closing returns the address to the chapter and unlocks the page', await hash(page) === '#intro' || await hash(page) === '', await hash(page));
  check('page is interactive again after closing', await page.$eval('.topbar', e => !e.inert) && await page.evaluate(() => !document.body.classList.contains('modal-open')));

  await press(page, '2'); await page.waitForFunction(() => document.querySelector('.site').dataset.active === 'experience');
  check('number keys jump chapters', await active(page) === 'experience');
  check('tab title follows the chapter', await page.title() === 'Experiences — Vassel Goleyu', await page.title());
  check('chapter change is announced to screen readers', (await page.$eval('.sr-only[role="status"]', e => e.textContent)) === 'Chapter 2 of 6: Experiences');
  // The L (warm light) and T (time of day) keys were removed: the light now follows the day cycle on its own.

  // ── Deep links ──────────────────────────────────────────────────────────
  await page.goto(`${ORIGIN}/?qa#role/duta-anti-narkoba/3`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.modal');
  check('deep link opens the role on the requested photo', await dialogTitle(page) === 'President' && (await page.$eval('.photo-controls span', e => e.textContent)) === '3 / 6');
  await page.keyboard.press('ArrowRight'); await sleep(150);
  check('browsing photos keeps the address in sync', await hash(page) === '#role/duta-anti-narkoba/4', await hash(page));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal')); await sleep(200);
  check('closing a directly-opened deep link falls back to the chapter hash', await hash(page) === '#experience', await hash(page));
  await page.goto(`${ORIGIN}/?qa#certificate/4`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.certificate-image img');
  check('certificate deep link opens the viewer on that certificate', (await page.$eval('.certificate-viewer .photo-controls span', e => e.textContent)) === '4 / 9');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal'));
  await page.goto(`${ORIGIN}/?qa#role/not-a-role`, { waitUntil: 'domcontentloaded' }); await sleep(500);
  check('an unknown deep link opens nothing and breaks nothing', !(await page.$('.modal')));

  // ── History: Back closes an overlay opened in-app ───────────────────────
  await page.goto(`${ORIGIN}/?qa#experience`, { waitUntil: 'domcontentloaded' }); await sleep(500);
  const before = await page.evaluate(() => history.length);
  await page.click('#experience .text-button'); await page.waitForSelector('.all-experiences');
  check('opening an overlay pushes exactly one history entry', await page.evaluate(() => history.length) === before + 1 && await hash(page) === '#roles');
  await page.click('.all-experiences button'); await page.waitForSelector('.photo-viewer');
  check('moving list → detail replaces rather than stacks history', await page.evaluate(() => history.length) === before + 1 && (await hash(page)).startsWith('#role/'));
  await page.goBack(); await page.waitForFunction(() => !document.querySelector('.modal'));
  check('browser Back closes the overlay and stays in the chapter', await active(page) === 'experience' && await hash(page) === '#experience', await hash(page));

  // ── Filters ─────────────────────────────────────────────────────────────
  await page.click('#experience .text-button'); await page.waitForSelector('.all-experiences');
  // The roles dialog dropped its search and focus chips on 2026-10-12; these checks run only if they return.
  if (await page.$('.filter-bar')) {
  await page.evaluate(() => [...document.querySelectorAll('.chip-row button')].find(b => b.textContent.startsWith('Technology')).click());
  check('focus chip narrows ten roles to the one technology role', (await page.$$('.all-experiences button')).length === 1 && (await page.$eval('.result-count', e => e.textContent)) === '1 of 10 roles');
  await page.evaluate(() => [...document.querySelectorAll('.chip-row button')].find(b => b.textContent.startsWith('All')).click());
  await page.type('.search-field input', 'blood donation'); await sleep(100);
  check('search matches inside descriptions', (await page.$$('.all-experiences button')).length === 1);
  await page.$eval('.search-field input', e => { e.select(); }); await page.keyboard.type('zzzz'); await sleep(100);
  check('no matches shows an empty state with a reset', !!(await page.$('.empty-state .text-button')) && (await page.$$('.all-experiences button')).length === 0);
  await page.click('.empty-state .text-button'); await sleep(100);
  check('reset restores all ten roles', (await page.$$('.all-experiences button')).length === 10);
  } else check('roles dialog lists all ten roles', (await page.$$('.all-experiences button')).length === 10);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal'));
  await page.goto(`${ORIGIN}/?qa#certificates`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.achievement-grid');
  await page.evaluate(() => [...document.querySelectorAll('.chip-row button')].find(b => b.textContent.startsWith('Biology')).click());
  check('certificate field filter shows only biology (3)', (await page.$$('.achievement-grid article')).length === 3);
  await page.keyboard.press('Escape');

  // ── Focus regression: a parent re-render must not steal focus from the dialog ──
  await page.goto(`${ORIGIN}/?qa#experience`, { waitUntil: 'domcontentloaded' }); await sleep(500);
  await press(page, 'l'); // raises a toast whose timeout later re-renders the whole app
  // The projector opens on the developer role (one photo, no filmstrip), so pick a role that has several.
  await page.select('.role-selector select', 'duta-anti-narkoba'); await page.waitForFunction(() => document.querySelector('.experience-role strong')?.textContent === 'President');
  await page.click('.experience-role'); await page.waitForSelector('.detail-filmstrip button');
  await page.focus('.detail-filmstrip button:nth-child(2)');
  await sleep(3000);
  check('focus survives an App re-render while the dialog is open', await page.evaluate(() => document.activeElement?.closest('.detail-filmstrip') !== null && document.activeElement?.tagName === 'BUTTON'));
  await page.keyboard.press('Tab'); for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  check('Tab never leaves the dialog', await page.evaluate(() => !!document.activeElement.closest('.modal')));
  await page.keyboard.down('Shift'); for (let i = 0; i < 14; i++) await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  check('Shift+Tab never leaves the dialog', await page.evaluate(() => !!document.activeElement.closest('.modal')));
  check('background is inert while a dialog is open', await page.$eval('.topbar', e => e.inert) && await page.$eval('.scene-layer', e => e.inert));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal'));
  check('focus returns to the control that opened the dialog', await page.evaluate(() => document.activeElement?.classList.contains('experience-role')));
  await page.close();

  // ── GitHub projects ─────────────────────────────────────────────────────
  page = await open(1440, 1000);
  await scroll(page, .46); await page.waitForSelector('.project-note');
  await page.waitForSelector('.project-note[data-live="true"]');
  check('first project is the first pinned repository', (await page.$eval('.project-note h3', e => e.textContent)) === 'Tomato Vision');
  check('project card links to demo and source over https', await page.$$eval('.project-links a', as => as.map(a => a.href).join('|')) === 'https://sellebeww.github.io/tomato-vision/|https://github.com/sellebeww/tomato-vision');
  check('all nine projects are directly selectable', await page.$eval('.project-picker select', e => e.options.length === 9));
  await scroll(page, .72); await page.waitForSelector('.language-chips li');
  check('stack chapter lists languages counted from the live repositories', (await page.$$eval('.language-chips li', els => els.map(e => e.textContent))).some(text => text.startsWith('PHP')));
  await scroll(page, .46); await page.waitForSelector('#projects.is-active');
  check('GitHub was requested exactly once', page.githubCalls === 1, page.githubCalls);
  await page.screenshot({ path: new URL('desktop-github-project.png', output).pathname });
  await page.click('#projects .text-button-quiet'); await page.waitForSelector('.repo-grid');
  const names = await page.$$eval('.repo-card h3', els => els.map(e => e.textContent));
  check('archive lists real repos without forks or the profile repo', names.length === 5 && !names.includes('a-fork') && !names.includes('sellebeww'), names);
  check('archive address is shareable', await hash(page) === '#repos');
  await page.type('.search-field input', 'clinic'); await sleep(100);
  check('archive search narrows repositories', (await page.$$('.repo-card')).length === 1);
  await page.screenshot({ path: new URL('desktop-repos.png', output).pathname });
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.modal'));
  await page.close();

  page = await open(1440, 1000, { github: 'fail' });
  await scroll(page, .46); await page.waitForSelector('.project-note'); await sleep(600);
  check('GitHub failure keeps the project card from its stored text and link', (await page.$eval('.project-note', e => e.dataset.live)) === 'false' && (await page.$eval('.project-note h3', e => e.textContent)) === 'Tomato Vision' && (await page.$$eval('.project-links a', as => as.map(a => a.href))).includes('https://github.com/sellebeww/tomato-vision'));
  await page.click('#projects .text-button-quiet'); await page.waitForSelector('[role="alert"]');
  check('archive explains the failure and links to the profile', (await page.$eval('[role="alert"] a', a => a.href)) === 'https://github.com/sellebeww');
  await page.close();

  // ── Résumé: dialog, text copy, print ────────────────────────────────────
  page = await open(1280, 900);
  await page.goto(`${ORIGIN}/?qa#resume`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.resume'); await page.waitForSelector('.resume-entry strong');
  await page.waitForFunction(() => [...document.querySelectorAll('.resume h3')].some(h => h.textContent === 'Selected projects'));
  check('résumé opens from its address and loads GitHub projects', (await page.$$('.resume-entry')).length === 10 + 4);
  await page.screenshot({ path: new URL('desktop-resume.png', output).pathname });
  await page.emulateMediaType('print');
  const printed = await page.evaluate(() => ({ topbar: getComputedStyle(document.querySelector('.topbar')).display, scene: getComputedStyle(document.querySelector('.scene-layer')).display, modal: getComputedStyle(document.querySelector('.modal')).backgroundColor, actions: getComputedStyle(document.querySelector('.resume-actions')).display, close: getComputedStyle(document.querySelector('.icon-button')).display }));
  check('print layout hides the room and every control, leaving black-on-white text', printed.topbar === 'none' && printed.scene === 'none' && printed.actions === 'none' && printed.close === 'none' && printed.modal === 'rgb(255, 255, 255)', printed);
  await page.pdf({ path: new URL('resume.pdf', output).pathname, format: 'A4', printBackground: true });
  const pdf = await fs.stat(new URL('resume.pdf', output));
  check('résumé exports to a multi-kilobyte PDF', pdf.size > 15000, pdf.size);
  await page.emulateMediaType('screen'); await page.keyboard.press('Escape');
  await page.close();

  // ── Contact form ────────────────────────────────────────────────────────
  page = await open(1440, 1000);
  await scroll(page, .99);
  await page.$eval('input[name="name"]', e => { e.value = 'Draft Person'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('textarea[name="message"]', e => { e.value = 'Remember me'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.contact-form input[name="name"]', { hidden: true }).catch(() => {});
  check('the contact draft survives a reload (session only)', await page.$eval('input[name="name"]', e => e.value) === 'Draft Person' && await page.$eval('textarea[name="message"]', e => e.value) === 'Remember me');
  check('a copy-message fallback exists', !!(await page.$('.copy-message')));
  await page.close();

  // ── Sound ───────────────────────────────────────────────────────────────
  page = await open(1440, 1000);
  await page.click('.dock-sound'); await page.waitForFunction(() => document.querySelector('.site').dataset.sound === 'on');
  check('music button starts audio and reports it', (await page.$eval('.dock-sound', e => e.getAttribute('aria-pressed'))) === 'true' && (await page.$eval('.toast', e => e.textContent)) === 'Music on');
  await press(page, 'r'); await sleep(200);
  check('rain toggle while music is on does not error', errors.length === 0, errors);
  await press(page, 's'); await page.waitForFunction(() => document.querySelector('.site').dataset.sound === 'off');
  check('S turns music off again', true);
  await page.close();

  // ── Mobile and fallback ─────────────────────────────────────────────────
  page = await open(390, 844);
  const dock = await page.$eval('.dock', e => { const r = e.getBoundingClientRect(); return { right: r.right, bottom: r.bottom }; });
  check('mobile dock sits inside the viewport', dock.right <= 390 && dock.bottom <= 844, dock);
  check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click('.dock button'); await page.waitForSelector('.palette');
  const box = await page.$eval('.palette', e => e.getBoundingClientRect().toJSON());
  check('mobile palette fits the screen', box.left >= 0 && box.right <= 390 && box.bottom <= 844, box);
  await page.screenshot({ path: new URL('mobile-palette.png', output).pathname });
  await page.keyboard.press('Escape');
  await page.close();

  page = await open(1280, 900, { noWebGL: true });
  await page.keyboard.press('/'); await page.waitForSelector('.palette');
  check('palette works in the no-WebGL view', true);
  await page.keyboard.type('github'); await sleep(100);
  check('repositories appear in the no-WebGL palette once loaded', (await page.$$eval('[role="option"]', els => els.map(e => e.textContent.trim()))).length > 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#projects .project-note') !== null || true);
  await page.evaluate(() => document.getElementById('projects').scrollIntoView()); await sleep(500);
  check('fallback view loads live repositories for Projects', page.githubCalls === 1, page.githubCalls);
  await page.close();

  check('no page errors, shader errors or unexpected console errors', errors.length === 0, errors);
} catch (error) { errors.push(error.stack); console.error(error.stack); process.exitCode = 1; }
finally {
  await fs.writeFile(new URL('report-ui.json', output), JSON.stringify({ errors, checks }, null, 2));
  await browser?.close();
  console.log(`${checks.length} UI feature checks passed${errors.length ? `, ${errors.length} errors` : ''}.`);
}
