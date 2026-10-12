import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { monitorOf, profile, projectShowcase } from "../data/portfolio";
import { projectReveal } from "./journey";
import { setCursorLabel } from "../lib/cursor";
import { useFontEpoch } from "./materials";

/** Real project screenshots sit on the existing monitor glass, on the same scroll clock as the
 * camera: visible when the desk arrives, dissolving into the coding screens underneath. Each monitor
 * rotates through its own projects (project `i` lives on monitor `i % 3`); the spotlighted project
 * pins its monitor so the card beside the desk always matches what is on screen. Clicking a screen
 * opens the repository of the project showing on it. */
const SHOT_SECONDS = 8;
/** A screenshot dips out and the next one rises in, instead of a hard flip. Seconds. */
const FADE_OUT = .3, FADE_IN = .5;
/** Two screens never start changing within this many milliseconds of each other, whatever triggers the change
 * (their own rotation or the spotlight moving). One monitor swaps, a second passes, the next swaps. */
const SWAP_GAP_MS = 1000;
let lastSwapStart = -Infinity;
const claimSwapTurn = () => {
  const now = performance.now();
  if (now - lastSwapStart < SWAP_GAP_MS) return false;
  lastSwapStart = now; return true;
};

// The GitHub mark (Octicons "mark-github", 16×16 viewBox), drawn straight from its SVG path.
const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";
const CAPTION = { width: 640, height: 112 }, CAPTION_WORLD_WIDTH = .3;

/** A pill centred on the monitor: the GitHub mark and the project's name. */
function captionTexture(project: number) {
  const canvas = document.createElement("canvas"); canvas.width = CAPTION.width; canvas.height = CAPTION.height;
  const ctx = canvas.getContext("2d")!, title = projectShowcase[project].title;
  ctx.font = '500 44px "Geist", sans-serif';
  const room = CAPTION.width - 150;
  let text = title; while (ctx.measureText(text).width > room && text.length > 4) text = text.slice(0, -2);
  if (text !== title) text += "…";
  // Size the pill to its content (mark + gap + name), centred, so short names do not float in a wide bar.
  const mark = 52, gap = 20, content = mark + gap + ctx.measureText(text).width, pill = Math.min(CAPTION.width, content + 72);
  const left = (CAPTION.width - pill) / 2;
  ctx.fillStyle = "#0a1117ee"; ctx.beginPath(); ctx.roundRect(left, 0, pill, CAPTION.height, CAPTION.height / 2); ctx.fill();
  ctx.strokeStyle = "#f0bf9466"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(left + 1.5, 1.5, pill - 3, CAPTION.height - 3, CAPTION.height / 2); ctx.stroke();
  const start = (CAPTION.width - content) / 2;
  ctx.save(); ctx.translate(start, (CAPTION.height - mark) / 2); ctx.scale(mark / 16, mark / 16);
  ctx.fillStyle = "#efe9df"; ctx.fill(new Path2D(GITHUB_MARK)); ctx.restore();
  ctx.fillStyle = "#efe9df"; ctx.textBaseline = "middle"; ctx.fillText(text, start + mark + gap, CAPTION.height / 2 + 2);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 16;
  return map;
}

export default function MonitorPortfolio({ index, progress, still, focus }: { index: number; progress: MutableRefObject<number>; still: boolean; focus: number }) {
  const mine = useMemo(() => projectShowcase.flatMap((_, project) => monitorOf(project) === index ? [project] : []), [index]);
  const urls = useMemo(() => mine.flatMap(project => [...projectShowcase[project].shots]), [mine]);
  const loaded = useTexture(urls);
  const slides = useMemo(() => {
    let cursor = 0;
    return mine.flatMap(project => projectShowcase[project].shots.map(() => ({ project, map: loaded[cursor++] })));
  }, [mine, loaded]);
  useMemo(() => loaded.forEach(map => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 16; map.needsUpdate = true; }), [loaded]);
  const fonts = useFontEpoch();
  const captions = useMemo(() => mine.map(captionTexture), [mine, fonts]);
  useEffect(() => () => captions.forEach(map => map.dispose()), [captions]);

  const screen = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const caption = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const clock = useRef(0), shown = useRef(-1), showing = useRef(mine[0]);
  // Slides grouped by project, in `mine` order. A monitor steps through its projects one shot at a time and only
  // returns to a project after showing every other one, so the same project never repeats back to back; each
  // return advances that project to its next screenshot. The three monitors own disjoint projects, so no two
  // screens ever show the same one. The spotlighted project holds a single shot on its monitor (the card beside
  // the desk names it), and each new spotlight of that project moves on to its next screenshot.
  const deck = useMemo(() => mine.map(project => slides.filter(slide => slide.project === project)), [mine, slides]);
  const spotlight = focus >= 0 && monitorOf(focus) === index ? deck[mine.indexOf(focus)] : null;
  const pin = spotlight ? focus : -1; // an unrelated focus change must not restart this monitor's rotation
  const visits = useRef(new Map<number, number>()), pinned = useRef<(typeof slides)[number] | null>(null);
  useEffect(() => {
    // The clock keeps running through a pin, so the loop resumes where it would have been instead of restarting.
    if (!spotlight) { pinned.current = null; return; }
    const visit = visits.current.get(pin) ?? 0; visits.current.set(pin, visit + 1);
    pinned.current = spotlight[visit % spotlight.length];
  }, [deck, spotlight, pin]);
  const slideAt = (step: number) => {
    if (spotlight) return pinned.current ?? spotlight[0];
    const shots = deck[step % deck.length];
    return shots[Math.floor(step / deck.length) % shots.length];
  };

  const fade = useRef(1), swapping = useRef(false);
  useFrame((_, delta) => {
    const mesh = screen.current; if (!mesh) return;
    const reveal = projectReveal(progress.current);
    mesh.visible = reveal > .001;
    if (!mesh.visible || !deck.length) { mesh.material.opacity = 0; if (caption.current) caption.current.visible = false; fade.current = 1; swapping.current = false; return; }
    // Screens advance on beats one second apart, left to right, and a swap that would land inside another screen's
    // second waits for its turn. Dialogs and reduced motion hold the current shot and swap without fading.
    const dt = Math.min(delta, .1);
    if (!still && !document.hidden) clock.current += dt;
    const next = Math.floor((clock.current + index * SWAP_GAP_MS / 1000) / SHOT_SECONDS), slide = slideAt(next);
    if (mesh.material.map !== slide.map && (still || swapping.current || claimSwapTurn())) {
      swapping.current = !still;
      if (still || fade.current <= 0 || mesh.material.opacity < .001) {
        shown.current = next; showing.current = slide.project; mesh.material.map = slide.map; mesh.material.needsUpdate = true;
        if (caption.current) { caption.current.material.map = captions[mine.indexOf(slide.project)]; caption.current.material.needsUpdate = true; }
        fade.current = still ? 1 : 0; swapping.current = false;
      } else fade.current = Math.max(0, fade.current - dt / FADE_OUT);
    } else fade.current = Math.min(1, fade.current + dt / (still ? .0001 : FADE_IN));
    const opacity = reveal * fade.current * fade.current * (3 - 2 * fade.current);
    mesh.material.opacity = opacity;
    if (caption.current) { caption.current.visible = true; caption.current.material.opacity = opacity; }
  });
  return <>
    <mesh ref={screen} name={`scroll-project-${index + 1}`} position={[0, .004, .023]} visible={false}
      onClick={event => { event.stopPropagation(); window.open(`${profile.github}/${projectShowcase[showing.current].repo}`, "_blank", "noopener"); }}
      onPointerOver={event => { if (!screen.current?.visible) return; event.stopPropagation(); setCursorLabel(`${projectShowcase[showing.current].title} on GitHub ↗`); }} onPointerOut={() => setCursorLabel("")}>
      <planeGeometry args={[.845, .528125]} /><meshBasicMaterial map={slides[0].map} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
    {/* Centred horizontally on the glass, in the lower part of the screen so the project's own interface stays visible. */}
    <mesh ref={caption} name={`scroll-project-caption-${index + 1}`} position={[0, -.17, .026]} renderOrder={2} visible={false}>
      <planeGeometry args={[CAPTION_WORLD_WIDTH, CAPTION_WORLD_WIDTH * CAPTION.height / CAPTION.width]} /><meshBasicMaterial map={captions[0]} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  </>;
}
