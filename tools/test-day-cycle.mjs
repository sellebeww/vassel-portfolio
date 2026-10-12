import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// The scene sampler is pure TypeScript. Transpile in memory, without adding a
// test dependency or generating files in src/; no browser/WebGL required.
const source = await fs.readFile(new URL('../src/scene/dayCycle.ts', import.meta.url), 'utf8');
const { outputText, diagnostics = [] } = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error), [], 'sampler transpiles without syntax errors');
const { CYCLE_SECONDS, sampleDayCycle } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const checks = [], errors = [];
function check(name, test) {
  try { test(); checks.push(name); console.log(`PASS ${name}`); }
  catch (error) { errors.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
function near(actual, expected, message, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`); }

check('24-second repeating cycle', () => assert.equal(CYCLE_SECONDS, 24));
check('phase boundaries and loop counter', () => {
  for (const [elapsed, phase, cycle] of [[0, 'night', 0], [4, 'dawn', 0], [9, 'day', 0], [15, 'sunset', 0], [21, 'night', 0], [24, 'night', 1], [28, 'dawn', 1], [33, 'day', 1], [48, 'night', 2]]) {
    const sample = sampleDayCycle(elapsed);
    assert.equal(sample.phase, phase, `phase at ${elapsed}s`);
    assert.equal(sample.cycle, cycle, `loop at ${elapsed}s`);
  }
});
check('phases occupy their complete intended intervals', () => {
  const intervals = [[0, 4, 'night'], [4, 9, 'dawn'], [9, 15, 'day'], [15, 21, 'sunset'], [21, 24, 'night']];
  for (const [start, end, phase] of intervals) {
    for (let elapsed = start; elapsed < end; elapsed += .125) assert.equal(sampleDayCycle(elapsed).phase, phase, `${phase} holds at ${elapsed}s`);
    assert.equal(sampleDayCycle(end - .000001).phase, phase, `${phase} lasts until ${end}s`);
  }
});
check('bounded values across five complete loops', () => {
  for (let elapsed = 0; elapsed <= CYCLE_SECONDS * 5; elapsed += .125) {
    const sample = sampleDayCycle(elapsed);
    assert.ok(['night', 'dawn', 'day', 'sunset'].includes(sample.phase));
    for (const property of ['daylight', 'warmth', 'progress']) assert.ok(Number.isFinite(sample[property]) && sample[property] >= 0 && sample[property] <= 1, `${property} bounded at ${elapsed}s`);
    assert.equal(sample.cycle, Math.floor(elapsed / CYCLE_SECONDS));
  }
});
check('continuous light and warmth at every phase boundary', () => {
  for (const boundary of [4, 9, 15, 21, 24, 28, 33, 39, 45, 48]) {
    const before = sampleDayCycle(boundary - .0001), after = sampleDayCycle(boundary + .0001);
    for (const property of ['daylight', 'warmth']) assert.ok(Math.abs(before[property] - after[property]) < .001, `${property} continuity at ${boundary}s`);
  }
});
check('night and day holds, warm dawn and sunset', () => {
  assert.equal(sampleDayCycle(2).daylight, 0);
  assert.equal(sampleDayCycle(12).daylight, 1);
  assert.equal(sampleDayCycle(22.5).daylight, 0);
  assert.ok(sampleDayCycle(6.5).warmth > 0);
  assert.ok(sampleDayCycle(18).warmth > 0);
  assert.ok(sampleDayCycle(6.5).daylight > 0 && sampleDayCycle(6.5).daylight < 1);
  assert.ok(sampleDayCycle(18).daylight > 0 && sampleDayCycle(18).daylight < 1);
  for (const [start, end, daylight] of [[0, 4, 0], [9, 15, 1], [21, 24, 0]]) {
    for (let elapsed = start; elapsed < end; elapsed += .125) assert.equal(sampleDayCycle(elapsed).daylight, daylight, `constant daylight during hold at ${elapsed}s`);
  }
});
check('rising dawn and falling sunset', () => {
  let previous = -1;
  for (let elapsed = 4; elapsed <= 9; elapsed += .25) { const current = sampleDayCycle(elapsed).daylight; assert.ok(current >= previous); previous = current; }
  previous = 2;
  for (let elapsed = 15; elapsed <= 21; elapsed += .25) { const current = sampleDayCycle(elapsed).daylight; assert.ok(current <= previous); previous = current; }
});
check('all four review overrides are stable over time', () => {
  for (const phase of ['day', 'sunset', 'night', 'dawn']) {
    const first = sampleDayCycle(0, phase), later = sampleDayCycle(123.4, phase);
    assert.equal(first.phase, phase); assert.equal(later.phase, phase);
    assert.equal(first.daylight, later.daylight); assert.equal(first.warmth, later.warmth);
    if (phase === 'day') assert.equal(first.daylight, 1);
    if (phase === 'night') assert.equal(first.daylight, 0);
    if (phase === 'dawn' || phase === 'sunset') { near(first.daylight, .5, `${phase} override midpoint`); assert.ok(first.warmth > 0); }
    for (const elapsed of [0, 4, 9, 15, 21, 24, 4800]) {
      const sample = sampleDayCycle(elapsed, phase);
      assert.equal(sample.phase, phase, `${phase} override at ${elapsed}s`);
      near(sample.daylight, first.daylight, `${phase} stable daylight at ${elapsed}s`);
      near(sample.warmth, first.warmth, `${phase} stable warmth at ${elapsed}s`);
      for (const property of ['daylight', 'warmth', 'progress']) assert.ok(Number.isFinite(sample[property]) && sample[property] >= 0 && sample[property] <= 1, `${phase} override ${property} bounded`);
    }
  }
});
check('repeated cycles return identical atmospheric values', () => {
  for (let elapsed = 0; elapsed < CYCLE_SECONDS; elapsed += .125) {
    const first = sampleDayCycle(elapsed);
    for (const cycle of [1, 2, 7, 25, 1000]) {
      const repeated = sampleDayCycle(elapsed + cycle * CYCLE_SECONDS);
      assert.equal(repeated.phase, first.phase, `phase repeats after ${cycle} cycles at ${elapsed}s`);
      assert.equal(repeated.cycle, cycle);
      for (const property of ['daylight', 'warmth', 'progress']) near(repeated[property], first[property], `${property} repeats after ${cycle} cycles at ${elapsed}s`);
    }
  }
});
check('empty or unrecognised overrides use the normal cycle', () => {
  for (const elapsed of [0, 4, 6.5, 12, 18, 22.5, 30]) {
    const normal = sampleDayCycle(elapsed);
    for (const override of [undefined, null, '', 'unknown']) assert.deepEqual(sampleDayCycle(elapsed, override), normal, `fallback for override ${String(override)} at ${elapsed}s`);
  }
});

await fs.mkdir(new URL('../artifacts/qa/studio-v6/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../artifacts/qa/studio-v6/report-day-cycle-unit.json', import.meta.url), JSON.stringify({ errors, cycleSeconds: CYCLE_SECONDS, checks }, null, 2));
console.log(`${checks.length} day-cycle checks passed; ${errors.length} failed.`);
if (errors.length) process.exitCode = 1;
