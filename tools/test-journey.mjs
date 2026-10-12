import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64');
const dataUrl = compile(await fs.readFile(new URL('../src/data/portfolio.ts', import.meta.url),'utf8'));
const source = (await fs.readFile(new URL('../src/scene/journey.ts',import.meta.url),'utf8')).replace('"../data/portfolio"', JSON.stringify(dataUrl));
const { journeyFrames, sampleJourney, projectReveal, stackReveal, screenMatrix, journeyAt, scrollAt, JUMP_FROM, JUMP_TO } = await import(compile(source));
const checks=[];
function check(name, fn) {fn();checks.push(name);console.log(`PASS ${name}`);}
check('camera path stays finite and continuous across every keyframe on both viewports',()=>{
  for(const mobile of [false,true]) {const frames=journeyFrames(mobile);let previous=sampleJourney(0,frames);
    for(let i=1;i<=10000;i++){ const current=sampleJourney(i/10000,frames);
      assert.ok([...current.position,...current.target,current.fov].every(Number.isFinite));
      assert.ok(Math.hypot(...current.position.map((n,j)=>n-previous.position[j]))<.04);
      assert.ok(Math.hypot(...current.target.map((n,j)=>n-previous.target[j]))<.04);previous=current;
    }
  }
});
check('the desk view is held while the photos show',()=>{for(const mobile of [false,true]) {const frames=journeyFrames(mobile), desk=sampleJourney(.43,frames); for(const p of [.47,.50,.52,.70]) assert.deepEqual(sampleJourney(p,frames),desk);}});
check('the zoom toward the laptop starts the moment the photos let go, then holds close while the boards stand, then enters the screen',()=>{for(const mobile of [false,true]) {const frames=journeyFrames(mobile), distance=view=>Math.hypot(...view.position.map((n,j)=>n-view.target[j])), desk=sampleJourney(.70,frames);
  assert.ok(distance(sampleJourney(.712,frames))<distance(desk)); assert.ok(distance(sampleJourney(.735,frames))<distance(sampleJourney(.725,frames)));
  assert.deepEqual(sampleJourney(.76,frames),sampleJourney(.82,frames)); assert.ok(distance(sampleJourney(.76,frames))<distance(sampleJourney(.725,frames))); assert.ok(distance(sampleJourney(.97,frames))<distance(sampleJourney(.82,frames)));}});
check('project screenshots arrive with the desk and stay on the monitors through the zoom',()=>{assert.equal(projectReveal(.30),0);for(const p of [.43,.473,.52,.70,.724,.80,.9]) assert.equal(projectReveal(p),1);});
check('language boards stand only during the close hold, never at the desk view or once the Contact page takes over',()=>{for(const p of [.43,.52,.70,.726]) assert.equal(stackReveal(p),0);for(const p of [.75,.79,.82]) assert.equal(stackReveal(p),1);for(const p of [.86,.90,.97,1]) assert.equal(stackReveal(p),0);});
check('scroll maps to the timeline without a still stretch, and back',()=>{
  assert.equal(journeyAt(0),0); assert.ok(Math.abs(journeyAt(1)-1)<1e-9);
  for(let i=0;i<=1000;i++){const x=i/1000; assert.ok(journeyAt(x)>=journeyAt(Math.max(0,x-.001))-1e-12);}
  for(const v of [0,.14,.29,.43,.50,.52,.70,.74,.80,.87,.95,.99]) assert.ok(Math.abs(journeyAt(scrollAt(v))-v)<.002,v);
  const step=1/1000, jumpAt=(JUMP_FROM/(1-(JUMP_TO-JUMP_FROM))); assert.ok(Math.abs(journeyAt(jumpAt+step)-journeyAt(jumpAt-step)-(JUMP_TO-JUMP_FROM))<.005);
});
check('page height matches the shortened timeline',()=>{const css=fsSync.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8'), vh=Number(/\.site \{ height: (\d+)vh;/.exec(css)[1]); assert.ok(Math.abs(vh-(100+795*(1-(JUMP_TO-JUMP_FROM))))<1.5,vh);});
check('projective HTML mapping lands all four corners on the screen',()=>{
  for(const points of [[{x:0,y:0},{x:1440,y:0},{x:1440,y:1000},{x:0,y:1000}],[{x:210,y:300},{x:800,y:220},{x:830,y:670},{x:180,y:620}]]) {
    const values=screenMatrix(points,960,600).slice(9,-1).split(',').map(Number);
    [[0,0],[960,0],[960,600],[0,600]].forEach(([x,y],i)=>{
      const w=values[3]*x+values[7]*y+values[15];
      assert.ok(Math.abs((values[0]*x+values[4]*y+values[12])/w-points[i].x)<.0001);
      assert.ok(Math.abs((values[1]*x+values[5]*y+values[13])/w-points[i].y)<.0001);
    });
  }
});
await fs.mkdir(new URL('../artifacts/qa/journey/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../artifacts/qa/journey/unit-report.json',import.meta.url),JSON.stringify({errors:[],checks},null,2));
