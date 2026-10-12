import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';

// Loads the real TypeScript sources through Vite, so relative imports resolve exactly as in the app.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent', configFile: false, root: new URL('..', import.meta.url).pathname });
const load = path => vite.ssrLoadModule(path);
const checks = [];
const check = (name, test) => { test(); checks.push(name); console.log(`PASS ${name}`); };
try {
  const gh = await load('/src/lib/github.ts'), palette = await load('/src/lib/palette.ts'), link = await load('/src/lib/deeplink.ts');
  const resume = await load('/src/lib/resume.ts'), data = await load('/src/data/portfolio.ts');

  // ── GitHub ────────────────────────────────────────────────────────────────
  const api = [
    { name: 'sellebeww', html_url: 'https://github.com/sellebeww/sellebeww', pushed_at: '2026-10-07T00:00:00Z' },
    { name: 'old-app', html_url: 'https://github.com/sellebeww/old-app', description: ' Old ', language: 'PHP', pushed_at: '2025-01-01T00:00:00Z', stargazers_count: 2, topics: ['laravel', 5] },
    { name: 'fork', html_url: 'https://github.com/sellebeww/fork', fork: true },
    { name: 'dead', html_url: 'https://github.com/sellebeww/dead', archived: true },
    { name: 'secret', html_url: 'https://github.com/sellebeww/secret', private: true },
    { name: 'new-app', html_url: 'https://github.com/sellebeww/new-app', homepage: 'javascript:alert(1)', language: 'TypeScript', pushed_at: '2026-10-09T00:00:00Z' },
    { name: 'demo', html_url: 'https://github.com/sellebeww/demo', homepage: 'https://demo.example', language: 'TypeScript', pushed_at: '2026-06-01T00:00:00Z' },
    { html_url: 'https://github.com/x/y' },
    { name: 'http-only', html_url: 'http://github.com/x/y' },
  ];
  const repos = gh.parseRepos(api, 'sellebeww');
  check('parseRepos drops forks, archived, private, the profile repo and malformed rows', () => assert.deepEqual(repos.map(r => r.name), ['old-app', 'new-app', 'demo']));
  check('parseRepos trims text, keeps only string topics and refuses non-https links', () => {
    assert.equal(repos[0].description, 'Old'); assert.deepEqual(repos[0].topics, ['laravel']);
    assert.equal(repos[1].homepage, null); assert.equal(repos[2].homepage, 'https://demo.example');
  });
  check('parseRepos rejects a non-array payload (rate-limit error object)', () => assert.throws(() => gh.parseRepos({ message: 'rate limited' }, 'u')));
  check('rankRepos puts pinned names first in the given order, then newest push', () => {
    assert.deepEqual(gh.rankRepos(repos, ['DEMO']).map(r => r.name), ['demo', 'new-app', 'old-app']);
    assert.deepEqual(gh.rankRepos(repos, []).map(r => r.name), ['new-app', 'demo', 'old-app']);
    assert.deepEqual(repos.map(r => r.name), ['old-app', 'new-app', 'demo'], 'input is not mutated');
  });
  check('languageStats counts primary languages, most common first', () => assert.deepEqual(gh.languageStats(repos), [{ language: 'TypeScript', count: 2 }, { language: 'PHP', count: 1 }]));
  check('filterRepos matches name, description, topic and language case-insensitively', () => {
    assert.equal(gh.filterRepos(repos, 'LARAVEL', null).length, 1);
    assert.equal(gh.filterRepos(repos, '', 'TypeScript').length, 2);
    assert.equal(gh.filterRepos(repos, 'demo', 'PHP').length, 0);
  });
  check('timeAgo is stable across day, month and year boundaries', () => {
    const now = Date.parse('2026-10-11T12:00:00Z'), ago = d => new Date(now - d * 86_400_000).toISOString();
    assert.equal(gh.timeAgo(ago(0), now), 'today'); assert.equal(gh.timeAgo(ago(1), now), 'yesterday'); assert.equal(gh.timeAgo(ago(9), now), '9 days ago');
    assert.equal(gh.timeAgo(ago(65), now), '2 months ago'); assert.equal(gh.timeAgo(ago(400), now), '1 year ago'); assert.equal(gh.timeAgo('nonsense', now), '');
  });
  check('pinned repositories exist on the configured account name', () => { assert.equal(data.githubUser, 'sellebeww'); assert.ok(data.pinnedRepos.length >= 3); });

  // ── Palette ───────────────────────────────────────────────────────────────
  const cmd = (label, extra = {}) => ({ id: label, group: 'Go to', label, run() {}, ...extra });
  const commands = [cmd('Profile'), cmd('Experiences'), cmd('Achievements'), cmd('Toggle lamp', { group: 'Room' }), cmd('Résumé', { keywords: 'cv print' }), cmd('Supervisor — BEM UMN', { group: 'Roles' })];
  check('empty query keeps registration order', () => assert.deepEqual(palette.rankCommands('', commands).map(c => c.label), commands.map(c => c.label)));
  check('prefix beats substring and unmatched commands are dropped', () => {
    assert.equal(palette.rankCommands('exp', commands)[0].label, 'Experiences');
    assert.deepEqual(palette.rankCommands('zzz', commands), []);
  });
  check('keywords and word starts are searchable', () => { assert.equal(palette.rankCommands('cv', commands)[0].label, 'Résumé'); assert.equal(palette.rankCommands('bem', commands)[0].label, 'Supervisor — BEM UMN'); });
  check('ordered subsequence matches abbreviations, multi-word queries need every word', () => {
    assert.equal(palette.rankCommands('tgl', commands)[0].label, 'Toggle lamp');
    assert.equal(palette.rankCommands('room lamp', commands)[0].label, 'Toggle lamp');
    assert.equal(palette.rankCommands('room zzz', commands).length, 0);
  });

  // ── Deep links ────────────────────────────────────────────────────────────
  const ids = data.experiences.map(r => r.id), counts = Object.fromEntries(data.experiences.map(r => [r.id, r.photos.length]));
  const parse = hash => link.parseOverlay(hash, ids, data.achievements.length, counts);
  check('every overlay round-trips through its address', () => {
    const samples = [{ kind: 'role', id: 'duta-anti-narkoba', photo: 0 }, { kind: 'role', id: 'duta-anti-narkoba', photo: 3 }, { kind: 'roles' }, { kind: 'certificates', initial: null }, { kind: 'certificates', initial: 8 }, { kind: 'project' }, { kind: 'repos' }, { kind: 'resume' }];
    for (const overlay of samples) assert.deepEqual(parse(link.overlayHash(overlay)), overlay, link.overlayHash(overlay));
  });
  check('photo and certificate addresses are 1-based and range-checked', () => {
    assert.equal(link.overlayHash({ kind: 'role', id: 'byte', photo: 1 }), '#role/byte/2');
    assert.equal(parse('#role/byte/99').photo, 0); assert.equal(parse('#role/byte/x').photo, 0);
    assert.equal(parse('#certificate/0'), null); assert.equal(parse('#certificate/10'), null); assert.equal(parse('#certificate/abc'), null);
  });
  check('unknown roles and plain chapter hashes are not overlays', () => { for (const hash of ['', '#', '#intro', '#role/nope', '#role', '#whatever']) assert.equal(parse(hash), null, hash); });
  check('overlays map to the chapter that frames them', () => {
    assert.equal(link.overlayChapter({ kind: 'role', id: 'byte', photo: 0 }), 'experience'); assert.equal(link.overlayChapter({ kind: 'certificates', initial: 1 }), 'achievements');
    assert.equal(link.overlayChapter({ kind: 'repos' }), 'projects'); assert.equal(link.overlayChapter({ kind: 'resume' }), null);
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  check('every role has a focus and every focus is used', () => {
    assert.ok(data.experiences.every(r => data.experienceFocuses.includes(r.focus)));
    assert.ok(data.experienceFocuses.every(f => data.experiences.some(r => r.focus === f)));
  });
  check('certificates are classified into the five fields', () => {
    const fields = data.achievements.map(a => data.achievementField(a[2]));
    assert.deepEqual([...new Set(fields)].sort(), [...data.achievementFields].sort());
    assert.equal(data.achievementField('Duta Anti Narkoba UMN'), 'Leadership'); assert.equal(data.achievementField('National Biology Competition'), 'Biology');
  });
  check('chapter titles name the chapter and the person', () => assert.equal(data.chapterTitle('experience'), 'Experiences — Vassel Goleyu'));

  // ── Résumé ────────────────────────────────────────────────────────────────
  check('résumé text contains every role and certificate and nothing from high school', () => {
    const text = resume.resumeText();
    for (const role of data.experiences) assert.ok(text.includes(role.title) && text.includes(role.organization));
    for (const [, placement, competition, year] of data.achievements) assert.ok(text.includes(`${year} · ${placement} — ${competition}`));
    assert.ok(!/\bSMA\b|high.school/i.test(text)); assert.ok(!text.includes('SELECTED PROJECTS'));
  });
  check('résumé text adds GitHub projects only when supplied', () => {
    const text = resume.resumeText(repos);
    assert.ok(text.includes('SELECTED PROJECTS') && text.includes('demo [TypeScript] — https://demo.example') && text.includes('new-app [TypeScript] — https://github.com/sellebeww/new-app'));
  });

  // ── Contact draft ─────────────────────────────────────────────────────────
  const { composeMailto } = await load('/src/ContactInterface.tsx');
  check('short messages become one complete mailto draft', () => {
    const mail = composeMailto({ name: 'Ana', email: 'ana@example.com', message: 'Halo, saya tertarik.' });
    assert.equal(mail.truncated, false); assert.ok(mail.url.startsWith('mailto:vassel.jgo@gmail.com?subject=')); assert.ok(decodeURIComponent(mail.url).includes('Reply to: ana@example.com'));
  });
  check('long or non-Latin messages are shortened under the 1,800-character URL limit, signature kept, full text preserved', () => {
    for (const message of ['x'.repeat(4000), 'Selamat siang — ini pesan panjang ✓ '.repeat(150), 'ä'.repeat(900), '👩‍💻🎓 '.repeat(700), '😀'.repeat(1001)]) {
      const mail = composeMailto({ name: 'Ana', email: 'ana@example.com', message });
      assert.equal(mail.truncated, true); assert.ok(mail.url.length <= 1800, String(mail.url.length));
      assert.ok(decodeURIComponent(mail.url).includes('Reply to: ana@example.com')); assert.ok(mail.full.includes(message));
    }
  });
  check('special characters in names cannot break out of the mailto query', () => {
    const mail = composeMailto({ name: 'A&B=C?D#E', email: 'a@b.co', message: 'hi' });
    assert.equal(new URL(mail.url).searchParams.get('subject'), 'Portfolio enquiry from A&B=C?D#E');
  });

  // ── Source-level guards ───────────────────────────────────────────────────
  const app = await fs.readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'), overlays = await fs.readFile(new URL('../src/Overlays.tsx', import.meta.url), 'utf8');
  check('dialogs keep onClose in a ref so re-renders cannot steal focus', () => assert.match(overlays, /const close = useRef\(onClose\)/));
  check('dialogs make the page behind them inert', () => assert.match(overlays, /element\.inert = true/));
  check('three.js is not statically imported by the app shell', () => assert.ok(!/from "three"|@react-three/.test(app + overlays)));
  const html = await fs.readFile(new URL('../dist/index.html', import.meta.url), 'utf8').catch(() => '');
  if (html) check('built HTML preloads React only, never the 3D engine', () => { assert.ok(/modulepreload[^>]+react-/.test(html)); assert.ok(!/modulepreload[^>]+(three|r3f)-/.test(html)); });
} finally { await vite.close(); }
await fs.mkdir(new URL('../artifacts/qa/features/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../artifacts/qa/features/report-unit.json', import.meta.url), JSON.stringify({ errors: [], checks }, null, 2));
console.log(`${checks.length} feature checks passed.`);
