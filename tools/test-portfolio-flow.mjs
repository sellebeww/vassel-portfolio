import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import ts from 'typescript';

const file = new URL('../src/data/portfolio.ts', import.meta.url);
const { outputText } = ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const data = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const checks = [];
function check(name, test) { test(); checks.push(name); console.log(`PASS ${name}`); }
check('six chapters in the requested order', () => assert.deepEqual(data.cameraStops.map(stop => stop.id), ['intro', 'experience', 'achievements', 'projects', 'stack', 'contact']));
check('ordered continuous scroll stops', () => {
  assert.equal(data.cameraStops[0].start, 0);
  data.cameraStops.slice(1).forEach((stop, index) => assert.ok(stop.start > data.cameraStops[index].start && stop.start < 1));
});
check('merged chapter bookmarks remain usable', () => {
  assert.equal(data.resolveChapterId('almet'), 'experience');
  assert.equal(data.resolveChapterId('coding'), 'projects');
  assert.equal(data.resolveChapterId('tech-stack'), 'stack');
  assert.equal(data.resolveChapterId('unknown'), undefined);
});
check('ten university roles, all 27 photos retained', () => {
  assert.equal(data.experiences.length, 10); assert.equal(data.experiencePhotos.length, 27);
  assert.equal(new Set(data.experiencePhotos.map(photo => photo.id)).size, 27);
  assert.ok(data.experiences.every(role => !/\bSMA\b|high.school/i.test(`${role.title} ${role.organization}`)));
});
check('all nine achievements retained', () => assert.equal(data.achievements.length, 9));
check('showcased projects match the pinned repositories, fill all three monitors, and each has real screenshots on disk', () => {
  assert.ok(data.projectShowcase.length >= 3);
  for (const monitor of [0, 1, 2]) assert.ok(data.projectShowcase.some((_, i) => data.monitorOf(i) === monitor));
  assert.deepEqual(data.projectShowcase.map(item => item.repo), [...data.pinnedRepos]);
  for (const item of data.projectShowcase) { assert.ok(item.shots.length >= 1); for (const shot of item.shots) fsSync.accessSync(new URL(`../public${shot}`, import.meta.url)); }
});
check('stack technologies match the documented developer role', () => {
  const role = data.experiences.find(role => role.id === 'medical-developer');
  assert.deepEqual(data.techStack.map(tool => tool.name), ['Laravel', 'REST APIs', 'MySQL']);
  data.techStack.forEach(tool => assert.ok(role.description.toLowerCase().includes(tool.name.toLowerCase())));
});
const appSource = await fs.readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
check('blazer-original interaction removed, not merely hidden', () => assert.ok(!/View original blazer|almet-reference|onInspectAlmet|showAlmetReference/.test(appSource)));
check('experience autoplay is 2.5 seconds and continues on hover', () => assert.match(appSource, /useShowcase\(experiencePhotos\.length[^;]+2500,\s*\{\s*pauseOnHover:\s*false\s*\}/));
check('projects rotate every 3.5 seconds with no play/pause button', () => { assert.match(appSource, /useShowcase\(projectShowcase\.length[^;]+3500\)/); assert.ok(!/project-playback|showcase-pause|\.toggle\b/.test(appSource)); });
check('UI order matches the camera journey', () => assert.ok(appSource.indexOf('<Chapter id="projects"') < appSource.indexOf('<Chapter id="stack"')));
check('GitHub uses the supplied account', () => assert.equal(data.profile.github, 'https://github.com/sellebeww'));
const roomSource = await fs.readFile(new URL('../src/scene/RoomScene.tsx', import.meta.url), 'utf8');
check('seated character is removed from the scene', () => assert.ok(!roomSource.includes('SeatedCoder')));
for (const photo of data.experiencePhotos) await fs.access(new URL(`../public${photo.src}`, import.meta.url));
for (const [filename] of data.achievements) await fs.access(new URL(`../public/images/achievements/${filename}`, import.meta.url));
checks.push('all original photographs and certificates exist');
console.log('PASS all original photographs and certificates exist');
await fs.mkdir(new URL('../artifacts/qa/studio-v6/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../artifacts/qa/studio-v6/report-flow-unit.json', import.meta.url), JSON.stringify({ errors: [], checks }, null, 2));
console.log(`${checks.length} portfolio-flow checks passed.`);
