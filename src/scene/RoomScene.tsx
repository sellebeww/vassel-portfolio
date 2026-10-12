import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF, useProgress, useTexture } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cameraStops, type ChapterId } from "../data/portfolio";
import { Block, Label, useOakSurface, useSurface, type Transform } from "./materials";
import { clamp, contactEntry, journeyFrames, range, sampleJourney, screenMatrix, stackReveal } from "./journey";
import { useLaptopScreen, useStickerTexture } from "./LaptopScreen";
import WorkspaceDetails, { PlainGlassWindow } from "./WorkspaceDetails";
import WorkspaceDisplays from "./WorkspaceDisplays";
import StackBoards from "./StackBoards";
import Almet from "./Almet";
import { AchievementCabinet, ExperienceProjector } from "./Showcases";
import CartoonWindow from "./CartoonWindow";
import { sampleDayCycle } from "./dayCycle";

// WebGL area lights need their LTC lookup tables before materials compile.
// This module is lazy-loaded with the scene, not the initial HTML interface.
RectAreaLightUniformsLib.init();

type SceneProps = {
  contactSurface: RefObject<HTMLElement | null>; onContactEntered: (entered: boolean) => void;
  progress: MutableRefObject<number>; active: ChapterId; reducedMotion: boolean; paused: boolean;
  projectIndex: number; projectPaused: boolean; experienceIndex: number; achievementIndex: number; projectionPaused: boolean;
  atmosphere: string | null; languages: readonly { language: string; count: number }[]; onProgress: (percent: number) => void;
  onSelectExperience: (index: number) => void; onSelectAchievement: (index: number) => void;
  onOpenExperience: (index: number) => void; onOpenAchievements: (index: number) => void; onReady: () => void;
};

function Model({ src, ...transform }: { src: string } & Transform) {
  const { scene } = useGLTF(src);
  const object = useMemo(() => { const clone = scene.clone(true); clone.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true; }); return clone; }, [scene]);
  return <primitive object={object} {...transform} />;
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => { const generator = new THREE.PMREMGenerator(gl), room = new RoomEnvironment(), environment = generator.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .19; return () => { scene.environment = null; environment.dispose(); generator.dispose(); room.dispose(); }; }, [gl, scene]);
  return null;
}

function Portrait() {
  const map = useTexture("/images/profile/vassel.webp"); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 16;
  return <group position={[-4.97, 1.45, -2.47]} rotation={[0, .055, 0]}>
    <Block size={[1.16, 1.55, .04]} color="#b78c68" metalness={.72} roughness={.25} radius={.012} />
    <mesh position={[0, 0, .022]}><planeGeometry args={[1.12, 1.483]} /><meshBasicMaterial map={map} toneMapped={false} /></mesh>
    <Block position={[0, -.88, -.01]} size={[.94, .025, .18]} color="#18303e" metalness={.55} roughness={.3} />
    <Label text="VASSEL GOLEYU" sub="Full-stack developer · UMN" width={.55} position={[0, -1.025, .01]} dark />
  </group>;
}


/** The laptop screen shows the spotlighted project; the Contact page is projected over it at the end of the journey. */
function Laptop({ focus, low }: { focus: number; low: boolean }) {
  const { scene } = useGLTF("/models/laptop.glb"), screen = useLaptopScreen(focus, low), sticker = useStickerTexture();
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = child.receiveShadow = true;
      const original = child.material as THREE.MeshStandardMaterial, material = original.clone(); child.material = material;
      if (child.name === "Laptop_Screen_REPLACE") { child.material = new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }); material.dispose(); }
      else if (original.name === "Laptop_Rose_Gold") { material.color.set("#e0aa9b"); material.metalness = .72; material.roughness = .32; }
      else if (child.name === "Screen_Bezel") { material.color.set("#11151b"); material.metalness = .12; material.roughness = .47; }
      else if (child.name === "Keyboard_Keys" || child.name === "Keyboard_Recess") { material.color.set("#11171c"); material.metalness = .05; material.roughness = .65; }
      if (child.name.startsWith("Sticker_") || child.name.startsWith("Hinge_Barrel")) child.visible = false;
      if (material.map) material.map.anisotropy = 16;
    }); return clone;
  }, [scene, screen]);
  useEffect(() => () => object.traverse(child => { if (child instanceof THREE.Mesh) (child.material as THREE.Material).dispose(); }), [object]);
  return <group name="pink-laptop" position={[2.45, .79, -.025]}><primitive object={object} scale={1.65} />
    <mesh position={[.18, .033, .146]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.095, .031]} /><meshBasicMaterial map={sticker} toneMapped={false} /></mesh>
  </group>;
}

/** Oak desktop at y=.79. Accessories use the same workspace coordinates as the
 * laptop and monitors; the mouse sits behind the puzzle notebook on the felt mat. */
function Desk() {
  const wood = useOakSurface();
  const steel = { color: "#2b383f", metalness: .7, roughness: .34 };
  return <group name="workspace-desk" position={[2.42, 0, -.14]}>
    <Block position={[0, .755, 0]} size={[2.64, .07, 1.03]} radius={.032}><meshStandardMaterial map={wood} roughness={.43} /></Block>
    {/* A dark apron under the top, inset from the edge so the oak reads as a slab with a shadow line below it. */}
    <Block position={[0, .707, 0]} size={[2.46, .045, .82]} color="#1f2b31" metalness={.5} roughness={.4} />
    {[-1, 1].map(side => <group key={side} position={[side * 1.08, 0, 0]}>
      <Block position={[0, .35, -.33]} size={[.052, .7, .052]} {...steel} /><Block position={[0, .35, .33]} size={[.052, .7, .052]} {...steel} />
      <Block position={[0, .055, 0]} size={[.052, .035, .68]} {...steel} />
    </group>)}
    {/* A rear stretcher between the leg frames keeps the desk rigid and gives the underside a clean line. */}
    <Block position={[0, .62, -.33]} size={[2.1, .04, .036]} {...steel} />
    {/* Felt mat under the laptop and mouse. */}
    <Block position={[.15, .795, .09]} size={[1.2, .006, .59]} color="#33424a" radius={.035} roughness={.96} />
    <group name="desk-mouse"><Model src="/models/mouse.glb" position={[.92, .791, .28]} /></group>
  </group>;
}

function Architecture() {
  const plaster = useSurface("plaster"), floor = useSurface("plaster");
  const seams = useMemo(() => {
    const parts = Array.from({ length: 14 }, (_, i) => new THREE.PlaneGeometry(.004, 8).rotateX(-Math.PI / 2).translate(-6.7 + i * .9, .001, 0));
    const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return geometry;
  }, []);
  useEffect(() => () => seams.dispose(), [seams]);
  // Same procedural noise, larger and finer on the floor, read as roughness only (green channel ≈ .82 ± .07):
  // polished concrete that catches the environmental light unevenly instead of a uniformly matte slab.
  useMemo(() => { floor.repeat.set(9, 7); }, [floor]);
  return <group>
    <mesh position={[-.8, -.055, 1]} receiveShadow><boxGeometry args={[12.6, .1, 10]} /><meshStandardMaterial color="#36444a" roughness={.62} roughnessMap={floor} metalness={.04} /></mesh>
    <mesh geometry={seams}><meshStandardMaterial color="#526067" roughness={.8} /></mesh>
    <mesh position={[-.8, 1.6, -2.88]} receiveShadow><boxGeometry args={[11.8, 3.2, .12]} /><meshStandardMaterial color="#71848b" map={plaster} bumpMap={plaster} bumpScale={.003} roughness={.92} /></mesh>
    <Block position={[-.8, .15, -2.79]} size={[11.8, .27, .1]} color="#35464d" radius={.007} /><Block position={[-.8, 2.82, -2.7]} size={[11.8, .075, .13]} color="#82684f" />
    <mesh position={[-.8, 2.78, -2.66]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[11.7, .025]} /><meshBasicMaterial color="#ffe3ae" /></mesh>
    {[-5.83, -4.12, -2.24, -.1, 2.59, 4.35].map(x => <Block key={x} position={[x, 1.48, -2.788]} size={[.018, 2.55, .045]} color="#bfa987" metalness={.35} radius={.004} />)}
    <Block position={[-3.36, 1.52, -2.75]} size={[1.34, 2.82, .065]} color="#354b57" radius={.02} /><Block position={[-3.36, 2.61, -2.68]} size={[.55, .055, .09]} color="#263b47" />
    <group position={[0, 0, 1.2]}><Block position={[4.98, .26, .1]} size={[.19, .52, 5.65]} color="#c9bca5" /><Block position={[4.94, 2.76, .1]} size={[.17, .2, 5.65]} color="#c9bca5" />
    {[-2.65, -1.32, .01, 1.34, 2.67].map(z => <Block key={z} position={[4.91, 1.62, z]} size={[.11, 2.32, .052]} color="#2a3a43" metalness={.68} roughness={.28} />)}
    {[.56, 1.18, 2.65].map(y => <Block key={y} position={[4.91, y, .01]} size={[.11, .044, 5.35]} color="#2a3a43" metalness={.65} roughness={.3} />)}<Block position={[4.78, .54, 0]} size={[.38, .064, 5.48]} color="#b89e7d" />
    <PlainGlassWindow /><Block position={[4.85, 1.55, 2.88]} size={[.2, 3.1, .16]} color="#6d7b7b" /></group>
  </group>;
}


function DayCycle({ progress, still, workspace, low, atmosphere: chosen }: { progress: MutableRefObject<number>; still: boolean; workspace: boolean; low: boolean } & Pick<SceneProps, "atmosphere">) {
  const gl = useThree(state => state.gl), invalidate = useThree(state => state.invalidate);
  const qa = useMemo(() => new URLSearchParams(window.location.search).has("qa"), []);
  // The visitor's choice (palette, controls, ?lighting=) fixes the light; null follows the day cycle.
  const override = chosen;
  useEffect(() => { invalidate(); }, [override, invalidate]);
  const key = useRef<THREE.DirectionalLight>(null), ambient = useRef<THREE.HemisphereLight>(null), warmFill = useRef<THREE.RectAreaLight>(null);
  const daylightValue = useRef(0), elapsed = useRef(0), lastTick = useRef<number | null>(null);
  const atmosphere = useRef(sampleDayCycle(0, override));
  const colors = useMemo(() => ({
    day: new THREE.Color("#fff3d5"), night: new THREE.Color("#88a9d7"), sunset: new THREE.Color("#ffa779"),
    skyDay: new THREE.Color("#bad9e7"), skyNight: new THREE.Color("#87a5c0"), skyWarm: new THREE.Color("#f5b39b"),
  }), []);
  // Real visible/unpaused time: a low frame rate must not stretch the day.
  // Reset the baseline after a hidden tab or pause so neither causes a jump.
  useEffect(() => {
    const reset = () => { lastTick.current = null; };
    reset(); document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, [still]);
  useFrame(() => {
    const now = performance.now();
    if (progress.current < .43 - .0002) { elapsed.current = 0; lastTick.current = null; }
    else if (still || document.hidden) lastTick.current = null;
    else {
      if (lastTick.current !== null) elapsed.current += Math.max(0, (now - lastTick.current) / 1000);
      lastTick.current = now;
    }
    const state = sampleDayCycle(elapsed.current, override);
    atmosphere.current = state; daylightValue.current = state.daylight;
    if (qa) {
      gl.domElement.dataset.daylight = state.daylight.toFixed(3);
      gl.domElement.dataset.phase = state.phase;
      gl.domElement.dataset.cycle = String(state.cycle);
    }
    if (key.current) {
      key.current.intensity = .16 + state.daylight * 2.5 + state.warmth * .3;
      key.current.color.copy(colors.night).lerp(colors.day, state.daylight).lerp(colors.sunset, state.warmth);
    }
    if (ambient.current) {
      ambient.current.intensity = .07 + state.daylight * .62;
      ambient.current.color.copy(colors.skyNight).lerp(colors.skyDay, state.daylight).lerp(colors.skyWarm, state.warmth * .65);
    }
    if (warmFill.current) warmFill.current.intensity = .8 + (1 - state.daylight) * 2;
  }, -1);
  return <group>
    {workspace && <Suspense fallback={null}><CartoonWindow atmosphere={atmosphere} elapsed={elapsed} /></Suspense>}
    <directionalLight ref={key} position={[4.4, 4.5, 2.5]} intensity={.48} color="#88a9d7" castShadow={!low} shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-4} shadow-normalBias={.0035} shadow-bias={-.0001} shadow-radius={3} />
    <hemisphereLight ref={ambient} args={["#87a5c0", "#45423f", .22]} /><rectAreaLight name="warm-environment-fill" ref={warmFill} position={[2.4, 2.7, 2.5]} rotation={[-1.05, 0, 0]} width={3.2} height={1.8} color="#ffd1a0" intensity={3.3} />
    <rectAreaLight position={[-1.2, 2.4, -.3]} rotation={[-.2, 0, 0]} width={6} height={1.2} intensity={1.1} color="#f0cda5" />
    <pointLight position={[-3.36, 2.60, -2.02]} intensity={1.2} distance={2.2} color="#ffe7bb" />
    {workspace && <rectAreaLight position={[2.35, 1.18, 1.25]} rotation={[0, Math.PI, 0]} width={.7} height={.4} intensity={2.3} color="#8caec4" />}
    {workspace && <rectAreaLight position={[1.0, 2.10, 2.95]} rotation={[-.35, -.45, 0]} width={2.4} height={1.5} intensity={1.7} color="#ffd2a1" />}
  </group>;
}

function CameraDirector({ progress, rendered, reducedMotion }: Pick<SceneProps, "progress" | "reducedMotion"> & { rendered: MutableRefObject<number> }) {
  const { camera, size, gl, invalidate } = useThree();
  const written = useRef({ entry: "", boards: "", flag: "" });
  const previous = useRef({ progress: -1, width: 0, height: 0 });
  const mobile = size.width < 760 || (size.width <= 1000 && size.width < size.height);
  // Quantised (rounding down, so the framing only ever errs wide) so dragging a window edge does not rebuild the timeline on every pixel.
  const aspect = Math.floor(size.width / size.height * 20) / 20;
  const frames = useMemo(() => journeyFrames(mobile, aspect), [mobile, aspect]);
  const qa = useMemo(() => new URLSearchParams(window.location.search).has("qa"), []);
  useFrame((_, delta) => {
    const requested = clamp(progress.current);
    rendered.current = reducedMotion ? requested : THREE.MathUtils.damp(rendered.current, requested, 8, Math.min(delta, .1));
    if (Math.abs(rendered.current - requested) < .00001) rendered.current = requested;
    if (qa) gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    // A held camera does not need a new projection matrix or allocated timeline sample.
    const lastView = previous.current;
    if (lastView.progress === rendered.current && lastView.width === size.width && lastView.height === size.height) return;
    lastView.progress = rendered.current; lastView.width = size.width; lastView.height = size.height;
    const view = sampleJourney(rendered.current, frames);
    camera.position.set(...view.position); camera.lookAt(...view.target);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = view.fov;
    perspective.setViewOffset(size.width, size.height, size.width * view.offset, size.height * view.vertical, size.width, size.height);
    perspective.updateProjectionMatrix(); perspective.updateMatrixWorld();
    if (rendered.current !== requested) invalidate();
    const root = document.documentElement, last = written.current;
    const entry = range(rendered.current, .94, contactEntry).toFixed(4);
    if (entry !== last.entry) { root.style.setProperty("--screen-entry", entry); last.entry = entry; }
    // The language boards carry the Tech Stack content up close, so the text card steps aside while they stand.
    const amount = stackReveal(rendered.current), boards = amount.toFixed(3), flag = amount > .5 ? "on" : "off";
    if (boards !== last.boards) { root.style.setProperty("--stack-boards", boards); last.boards = boards; }
    if (flag !== last.flag) { root.dataset.stackBoards = flag; last.flag = flag; }
    if (qa) {
      const chapter = [...cameraStops].reverse().find(stop => requested >= stop.start - .002)?.id ?? "intro";
      gl.domElement.dataset.cameraSettled = rendered.current === requested ? chapter : "moving";
      gl.domElement.dataset.renderedProgress = rendered.current.toFixed(5);
      gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    }
  }, -1);
  return null;
}

function LaptopContactBridge({ progress, contactSurface, onContactEntered }: Pick<SceneProps, "progress" | "contactSurface" | "onContactEntered">) {
  const { scene, camera, size } = useThree();
  const lastEntered = useRef(false), hidden = useRef(false);
  const corner = useMemo(() => new THREE.Vector3(), []);
  const found = useRef<THREE.Mesh | null>(null);
  useFrame(() => {
    const element = contactSurface.current;
    if (!element) return;
    const value = progress.current, visible = value > .85;
    if (visible && !found.current?.parent) found.current = (scene.getObjectByName("Laptop_Screen_REPLACE") as THREE.Mesh | undefined) ?? null;
    const screen = found.current;
    if (!visible || !screen) { if (!hidden.current) { element.style.visibility = "hidden"; element.style.opacity = "0"; hidden.current = true; } }
    else {
      hidden.current = false;
      screen.updateWorldMatrix(true, false);
      if (!screen.geometry.boundingBox) screen.geometry.computeBoundingBox();
      const box = screen.geometry.boundingBox!;
      const coordinates = [[box.min.x, box.max.y], [box.max.x, box.max.y], [box.max.x, box.min.y], [box.min.x, box.min.y]];
      const fullscreen = [[0,0], [size.width,0], [size.width,size.height], [0,size.height]];
      const takeover = range(value, .943, contactEntry);
      const points = coordinates.map(([x,y], i) => {
        corner.set(x,y,.0004).applyMatrix4(screen.matrixWorld).project(camera);
        return { x: THREE.MathUtils.lerp((corner.x+1)*size.width/2, fullscreen[i][0], takeover), y: THREE.MathUtils.lerp((1-corner.y)*size.height/2, fullscreen[i][1], takeover) };
      });
      element.style.visibility = "visible"; element.style.opacity = String(range(value, .852, .882));
      element.style.transform = screenMatrix(points, size.width, size.height);
      element.style.borderRadius = `${(1-takeover)*10}px`;
    }
    const entered = value >= contactEntry - .0001;
    if (lastEntered.current !== entered) { lastEntered.current = entered; onContactEntered(entered); }
  });
  return null;
}

function Ready({ onReady, workspace = false }: { onReady?: () => void; workspace?: boolean }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.shadowMap.needsUpdate = true; invalidate(); onReady?.();
    if (workspace) gl.domElement.dataset.workspaceReady = "true";
    return () => { if (workspace) gl.domElement.dataset.workspaceReady = "false"; };
  }, [gl, invalidate, onReady, workspace]);
  return null;
}

function Room({ progress, reducedMotion, paused, projectionPaused, projectIndex, projectPaused, experienceIndex, achievementIndex, onOpenExperience, onOpenAchievements, onSelectExperience, onSelectAchievement, atmosphere, languages, onReady, low }: SceneProps & { low: boolean }) {
  const gl = useThree(state => state.gl);
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; return () => { gl.shadowMap.autoUpdate = true; }; }, [gl]);
  const still = reducedMotion || paused;
  // The loading screen lifts only once the portrait, the university gallery and the whole desk have all mounted.
  const marks = useMemo(() => {
    const got = new Set<string>(), make = (name: string) => () => { got.add(name); if (got.size === 3) onReady(); };
    return { portrait: make("portrait"), almet: make("almet"), workspace: make("workspace") };
  }, [onReady]);
  return <group>
    <Environment /><Architecture /><DayCycle progress={progress} still={still} workspace low={low} atmosphere={atmosphere} />
    <Suspense fallback={null}><Portrait /><Ready onReady={marks.portrait} /></Suspense>
    <group name="university-gallery">
    <Suspense fallback={null}><Almet /><Ready onReady={marks.almet} /></Suspense>
    <ExperienceProjector index={experienceIndex} onSelect={onSelectExperience} onOpen={onOpenExperience} still={still || projectionPaused} />
    <AchievementCabinet index={achievementIndex} onSelect={onSelectAchievement} onOpen={onOpenAchievements} still={still} />
    </group>
    <Suspense fallback={null}><group name="permanent-workspace" position={[0, 0, 1.5]}>
      <Desk /><Laptop focus={projectIndex} low={low} /><WorkspaceDisplays progress={progress} selected={projectIndex} still={still || projectPaused} /><StackBoards progress={progress} still={still} languages={languages} /><WorkspaceDetails />

      {!low && <>
        <ContactShadows position={[2.4, .004, 0]} opacity={.42} scale={4.5} blur={2.2} far={2} resolution={512} frames={1} />
        {/* Static desk occlusion anchors the small objects; one 256px capture, no per-frame pass. */}
        <ContactShadows position={[2.42, .7904, -.14]} opacity={.27} scale={[2.64, 1.03]} blur={1.8} far={.48} resolution={256} frames={1} color="#33261e" />
      </>}
      <Ready workspace onReady={marks.workspace} />
    </group></Suspense>
  </group>;
}

/** Reports real asset loading (models, textures) to the HTML loading screen. */
function LoadProgress({ onProgress }: Pick<SceneProps, "onProgress">) {
  // The loading store changes while other components are still rendering (suspense), so it is
  // observed outside React's render and reported on a microtask rather than via the hook.
  useEffect(() => {
    let live = true;
    const report = (value: number) => queueMicrotask(() => { if (live) onProgress(Math.round(value)); });
    report(useProgress.getState().progress);
    const unsubscribe = useProgress.subscribe(state => report(state.progress));
    return () => { live = false; unsubscribe(); };
  }, [onProgress]);
  return null;
}

function FramePump({ animate, low, onSlow }: { animate: boolean; low: boolean; onSlow: () => void }) {
  const { invalidate, gl } = useThree();
  const samples = useRef({ count: 0, time: 0, warmup: 0, slowWindows: 0 });
  useFrame((_, delta) => {
    if (!animate || low || document.hidden) return;
    const data = samples.current;
    // Asset decoding and first-use shader compilation are not steady-state GPU
    // performance. Warm up after loading, then require two sustained slow windows.
    if (useProgress.getState().active) { data.warmup = data.count = data.time = data.slowWindows = 0; return; }
    if (data.warmup < 5) { data.warmup += Math.min(delta, .1); return; }
    if (delta > .2) { data.count = data.time = 0; return; }
    data.count++; data.time += delta;
    if (data.count >= 120) {
      data.slowWindows = data.time / data.count > .045 ? data.slowWindows + 1 : 0;
      if (data.slowWindows >= 2) onSlow();
      data.count = data.time = 0;
    }
  });
  useEffect(() => {
    gl.domElement.dataset.quality = low ? "efficient" : "full";
    const update = () => { if (!document.hidden) invalidate(); };
    // Full quality uses R3F's own display-synced loop, avoiding two competing rAF
    // schedulers. Efficient devices tick at 30fps; paused/reduced-motion rooms stay demand-only.
    const timer = animate && low ? window.setInterval(update, 1000 / 30) : undefined;
    window.addEventListener("scroll", update, { passive: true }); document.addEventListener("visibilitychange", update);
    update(); return () => { window.clearInterval(timer); window.removeEventListener("scroll", update); document.removeEventListener("visibilitychange", update); };
  }, [animate, low, gl, invalidate]);
  return null;
}

export default function RoomCanvas(props: SceneProps) {
  const rendered = useRef(props.progress.current);
  const [adaptiveLow, setAdaptiveLow] = useState(() => window.innerWidth < 760 || navigator.hardwareConcurrency <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
  const low = adaptiveLow || props.reducedMotion;
  const animate = !props.paused && !props.reducedMotion;
  // Pixel cost dominates this scene (area lights, soft shadows). 1.5 DPR is visually indistinguishable from
  // 1.75 on retina screens at about 27% fewer pixels shaded per frame; still frames on the efficient profile
  // (rendered on demand, so the extra pixels cost nothing between changes) keep the sharper cap.
  const dprCap = low && !animate ? 1.75 : 1.5;
  return <Canvas className="room-canvas" frameloop={animate && !low ? "always" : "demand"} dpr={[1, dprCap]} camera={{ position: cameraStops[0].position, fov: 39, near: .025, far: 40 }} gl={{ antialias: true, powerPreference: "high-performance", alpha: false }} shadows={{ type: THREE.PCFSoftShadowMap }} onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.05; }}>
    {/* Background and fog share the page ink; fog now starts inside the room so the back wall and far corners
        recede slightly behind the lit subjects (the city outside opts out with fog={false}). */}
    <color attach="background" args={["#0f1920"]} /><fog attach="fog" args={["#0f1920", 7.5, 21]} />
    <Suspense fallback={null}><Room {...props} progress={rendered} low={low} /></Suspense>
    <CameraDirector progress={props.progress} rendered={rendered} reducedMotion={props.reducedMotion} />
    <LaptopContactBridge progress={rendered} contactSurface={props.contactSurface} onContactEntered={props.onContactEntered} />
    <FramePump animate={animate} low={low} onSlow={() => setAdaptiveLow(true)} />
    <LoadProgress onProgress={props.onProgress} />
  </Canvas>;
}
