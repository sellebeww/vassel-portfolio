import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

// A static editorial card built from the actual room and the site's own fonts.
// Pass a screenshot of the running room as the first argument (a PNG taken from `npm run preview` at #intro on a
// machine with a GPU); without one it uses artifacts/polish/after/desk-shadows.png from tools/qa-polish.mjs.
const asset = async (path, mime) => `data:${mime};base64,${(await fs.readFile(new URL(path, import.meta.url))).toString('base64')}`;
const [room, display, body] = await Promise.all([
  asset(process.argv[2] ?? '../artifacts/polish/after/desk-shadows.png', 'image/png'),
  asset('../public/fonts/newsreader.woff2', 'font/woff2'),
  asset('../public/fonts/geist.woff2', 'font/woff2'),
]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<style>
    @font-face{font-family:Display;src:url('${display}')}@font-face{font-family:Body;src:url('${body}')}
    *{box-sizing:border-box}body{margin:0;background:#0f1920;color:#efe9df;font-family:Body}
    .room{position:absolute;left:0;top:0;width:1200px;height:630px;object-fit:cover;opacity:.42}
    .veil{position:absolute;inset:0;background:linear-gradient(90deg,#0f1920 12%,#0f1920e6 42%,#0f192024)}
    main{position:relative;padding:54px 64px;width:820px}header{color:#f0bf94;font-size:17px;letter-spacing:3px;text-transform:uppercase}
    h1{font:400 112px/.98 Display;margin:65px 0 22px;letter-spacing:-4px}h1 span{color:#f0bf94}
    p{font-size:25px;line-height:1.55;width:570px;margin:0}footer{margin-top:48px;color:#b9b6ad;font-size:15px;letter-spacing:1px}
  </style><img class="room" src="${room}" alt=""><div class="veil"></div><main><header>Full-stack developer · Tangerang, ID</header><h1>Vassel <span>Goleyu</span></h1><p>Digital tools. Real-world care.<br>Web & Android, built to work offline.</p><footer>SELECTED WORK &nbsp; / &nbsp; AN AFTER-HOURS STUDIO</footer></main>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('../public/og-image.jpg', import.meta.url).pathname, type: 'jpeg', quality: 88 });
} finally { await browser.close(); }
