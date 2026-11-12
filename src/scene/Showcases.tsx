import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { achievements, experiencePhotos, showcaseWindow } from "../data/portfolio";
import { Block, Label } from "./materials";
import CinematicProjection from "./CinematicProjection";
import { setCursorLabel } from "../lib/cursor";

const label = (text: string) => ({
  onPointerOver: (event: { stopPropagation: () => void }) => { event.stopPropagation(); setCursorLabel(text); },
  onPointerOut: () => setCursorLabel(""),
});

/** All indices refer to the flattened experiencePhotos array or achievements.
 * Selection is shared with the accessible DOM controls, not duplicated locally.
 * Clicking the focal image opens its original file in the detail viewer. */
export interface ShowcaseSceneProps {
  index: number;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  still?: boolean;
}

function Photograph({ src, width, height }: { src: string; width: number; height: number }) {
  const map = useTexture(src);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  const aspect = map.image.width / map.image.height;
  const fittedWidth = Math.min(width, height * aspect);
  return <mesh><planeGeometry args={[fittedWidth, fittedWidth / aspect]} /><meshBasicMaterial map={map} toneMapped={false} /></mesh>;
}

function FilmPerforations() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Matrix4(); let index = 0;
    for (let frame = 0; frame < 5; frame++) for (const row of [-1, 1]) for (const x of [-.11, -.055, 0, .055, .11]) {
      transform.makeTranslation((frame - 2) * .334 + x, row * .116, .023);
      mesh.current.setMatrixAt(index++, transform);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[undefined, undefined, 50]} raycast={() => null}><planeGeometry args={[.025, .009]} /><meshBasicMaterial color="#c2bca7" /></instancedMesh>;
}

/** Retractable projection screen + five physical film frames. Only the current
 * slide and its visible neighbours request textures; no full archive preload. */
export function ExperienceProjector({ index, onSelect, onOpen, still = false }: ShowcaseSceneProps) {
  const slide = experiencePhotos[index], visible = showcaseWindow(index, experiencePhotos.length);
  return <group name="experience-projector" position={[-1.36, 1.72, -2.48]} scale={1.4}>
    <Block position={[0, .035, -.045]} size={[1.71, 1.28, .035]} color="#15242e" radius={.006} />
    <Block position={[0, .67, 0]} size={[1.8, .09, .115]} color="#d2d0c1" metalness={.7} roughness={.31} radius={.04} />
    {[-.85, .85].map(x => <Block key={x} position={[x, .67, .002]} size={[.027, .094, .12]} color="#35444a" metalness={.6} />)}
    <mesh position={[0, .026, -.024]}><planeGeometry args={[1.62, 1.18]} /><meshStandardMaterial color="#bcbfb2" roughness={.96} /></mesh>
    <mesh position={[0, .066, .001]} onClick={event => { event.stopPropagation(); onOpen(index); }}>
      <planeGeometry args={[1.53, .91]} /><meshBasicMaterial color="#111b23" />
    </mesh>
    <group onClick={event => { event.stopPropagation(); onOpen(index); }} {...label("Open photo ↗")}>
      <CinematicProjection src={slide.preview} variant={index} still={still} onNext={() => onSelect((index + 1) % experiencePhotos.length)} />
    </group>
    <Label text={`${String(index + 1).padStart(2, "0")} / ${experiencePhotos.length}  ·  ${slide.experience.organization}`} width={1.31} position={[0, -.474, .005]} dark compact />
    <Block position={[0, -.585, 0]} size={[1.69, .035, .045]} color="#b8c1bd" metalness={.7} roughness={.3} radius={.015} />
    <mesh position={[0, -.621, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.023, .004, 6, 20]} /><meshStandardMaterial color="#c1c7bf" metalness={.8} roughness={.25} /></mesh>
    {/* A contact strip of real, adjacent moments rather than one cover per role. */}
    <group position={[0, -.768, .018]}>
      <Block size={[1.74, .253, .025]} color="#151d22" radius={.005} />
      {visible.map((photoIndex, offset) => {
        const frame = experiencePhotos[photoIndex], selected = photoIndex === index;
        return <group key={frame.id} position={[(offset - 2) * .334, 0, .018]} onClick={event => { event.stopPropagation(); onSelect(photoIndex); }} {...label(selected ? "Showing" : "Show this photo")}>
          <Block size={[.314, .22, .008]} color={selected ? "#e6ba8f" : "#596260"} radius={.001} />
          <mesh position={[0, 0, .005]}><planeGeometry args={[.3, .204]} /><meshBasicMaterial color="#172028" /></mesh>
          <group position={[0, 0, .006]}><Suspense fallback={null}><Photograph src={frame.preview} width={.297} height={.197} /></Suspense></group>
        </group>;
      })}
      <FilmPerforations />
    </group>
  </group>;
}

/** Where a certificate stands in the flow: the focal one forward and large, its neighbours angled in towards it,
 * and a hidden slot (scale ~0) beyond them so a card grows in and shrinks out instead of popping. */
const FLOW = [{ x: 0, z: .2, tilt: 0, s: 1 }, { x: .8, z: .08, tilt: .4, s: .58 }, { x: 1.06, z: -.02, tilt: .64, s: .4 }, { x: 1.06, z: -.02, tilt: .64, s: .001 }];
const slot = (offset: number) => {
  const step = FLOW[Math.min(3, Math.abs(offset))], side = Math.sign(offset);
  return { x: side * step.x, y: offset === 0 ? .1 : .04, z: step.z, ry: -side * step.tilt, s: step.s, light: offset === 0 ? 1 : Math.abs(offset) === 1 ? .62 : .42 };
};

let gleamMap: THREE.CanvasTexture | null = null;
/** One shared diagonal highlight, brightest across the upper left, so every certificate reads as glossy glass. */
let bandMap: THREE.CanvasTexture | null = null;
/** A narrow soft diagonal band; sliding its texture across a card-sized plane keeps the glint inside the glass. */
const band = () => {
  if (bandMap) return bandMap;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!, gradient = c.createLinearGradient(40, 0, 88, 28);
  gradient.addColorStop(0, "rgba(255,238,205,0)"); gradient.addColorStop(.5, "rgba(255,238,205,.9)"); gradient.addColorStop(1, "rgba(255,238,205,0)");
  c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
  bandMap = new THREE.CanvasTexture(canvas); bandMap.colorSpace = THREE.SRGBColorSpace; return bandMap;
};
const gleam = () => {
  if (gleamMap) return gleamMap;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!, gradient = c.createLinearGradient(0, 0, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,.34)"); gradient.addColorStop(.34, "rgba(255,255,255,.12)"); gradient.addColorStop(.42, "rgba(255,255,255,0)"); gradient.addColorStop(.7, "rgba(255,255,255,0)"); gradient.addColorStop(.82, "rgba(255,240,215,.14)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
  gleamMap = new THREE.CanvasTexture(canvas); gleamMap.colorSpace = THREE.SRGBColorSpace; return gleamMap;
};

function FlowCard({ award, offset, still, onPick }: { award: number; offset: number; still: boolean; onPick: () => void }) {
  const map = useTexture(`/images/achievements/${achievements[award][0]}`);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const invalidate = useThree(state => state.invalidate);
  const group = useRef<THREE.Group>(null), photo = useRef<THREE.MeshBasicMaterial>(null), glint = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const glintClock = useRef({ time: 0, started: -1, focal: offset === 0 });
  const aspect = map.image.width / map.image.height, width = Math.min(1.3, .92 * aspect), height = width / aspect;
  const initial = useMemo(() => slot(offset), []); // eslint-disable-line react-hooks/exhaustive-deps -- a card is born where it stands; later moves are damped below
  const now = useRef({ ...initial });
  useFrame((_, delta) => {
    const target = slot(offset), at = now.current, dt = Math.min(delta, .05);
    let moving = false;
    for (const key of ["x", "y", "z", "ry", "s", "light"] as const) {
      const next = still ? target[key] : THREE.MathUtils.damp(at[key], target[key], 6.5, dt);
      const settled = Math.abs(next - target[key]) <= .0005;
      if (!settled) moving = true;
      at[key] = settled ? target[key] : next;
    }
    const object = group.current; if (!object) return;
    object.position.set(at.x, at.y, at.z); object.rotation.y = at.ry; object.scale.setScalar(at.s);
    photo.current?.color.setScalar(at.light);
    // The glint runs once, on a card that has just become the focal one, and only inside its own glass.
    const g = glintClock.current; g.time += dt;
    if ((offset === 0) !== g.focal) { g.focal = offset === 0; if (g.focal && !still) g.started = g.time; }
    const progress = g.started < 0 ? 1 : (g.time - g.started) / 1.1, shine = glint.current;
    if (shine) {
      shine.visible = progress < 1;
      if (progress < 1) { band().offset.x = .75 - 1.5 * progress; shine.material.opacity = .42 * Math.sin(Math.PI * progress); invalidate(); }
    }
    if (moving) invalidate();
  });
  return <group ref={group} position={[initial.x, initial.y, initial.z]} rotation={[0, initial.ry, 0]} scale={initial.s}
    onClick={event => { event.stopPropagation(); onPick(); }} {...label(offset === 0 ? "View certificate ↗" : offset < 0 ? "Previous certificate" : "Next certificate")}>
    {/* A slim polished-brass frame with soft corners, a paper mat, and a fixed diagonal gleam over the glass. */}
    <Block size={[width + .07, height + .07, .014]} color="#e0c08f" roughness={.16} metalness={.92} radius={.03} />
    <Block position={[0, 0, .009]} size={[width + .028, height + .028, .004]} color="#efe8d8" radius={.014} />
    <mesh position={[0, 0, .013]}><planeGeometry args={[width, height]} /><meshBasicMaterial ref={photo} map={map} toneMapped={false} /></mesh>
    <mesh position={[0, 0, .0145]} raycast={() => null}><planeGeometry args={[width, height]} /><meshBasicMaterial map={gleam()} transparent opacity={.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={glint} position={[0, 0, .0152]} visible={false} raycast={() => null}><planeGeometry args={[width, height]} /><meshBasicMaterial map={band()} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

/** The certificates as a cover-flow: five stand in view, the chosen one forward under a warm halo, and a gold glint
 * crosses it whenever the choice changes. Selection is shared with the DOM controls; every card moves on springs. */
export function AchievementCabinet({ index, onSelect, onOpen, still = false }: ShowcaseSceneProps) {
  const selected = achievements[index], count = achievements.length;
  const flow = showcaseWindow(index, count, 7).map((award, place) => ({ award, offset: place - 3 }));
  const glow = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d")!, gradient = c.createRadialGradient(128, 128, 8, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,214,160,.85)"); gradient.addColorStop(.45, "rgba(240,191,148,.28)"); gradient.addColorStop(1, "rgba(240,191,148,0)");
    c.fillStyle = gradient; c.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);
  return <group position={[1.35, 1.48, -2.47]} name="certificate-gallery-case">
    <Block position={[0, 0, -.05]} size={[2.5, 1.92, .08]} color="#1b2b33" roughness={.5} metalness={.25} radius={.05} />
    {[-.96, .96].map(y => <Block key={y} position={[0, y, .0]} size={[2.54, .026, .07]} color="#d1b27e" metalness={.9} roughness={.2} radius={.013} />)}
    {[-1.26, 1.26].map(x => <Block key={x} position={[x, 0, .0]} size={[.026, 1.95, .07]} color="#d1b27e" metalness={.9} roughness={.2} radius={.013} />)}
    <Label text="THE CERTIFICATE COLLECTION" width={1.3} position={[0, .83, .03]} dark compact />
    <mesh position={[0, .1, .02]} raycast={() => null}><planeGeometry args={[2.3, 1.7]} /><meshBasicMaterial map={glow} transparent opacity={.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    <Suspense fallback={null}>{flow.map(({ award, offset }) => <FlowCard key={achievements[award][0]} award={award} offset={offset} still={still} onPick={() => offset === 0 ? onOpen(index) : onSelect(award)} />)}</Suspense>
    <Label text={`${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}  ·  ${selected[1]}  ·  ${selected[3]}`} width={1.2} position={[0, -.56, .24]} dark compact />
    <Block position={[0, -1.0, .06]} size={[2.7, .06, .3]} color="#b08a5a" roughness={.3} metalness={.6} radius={.028} />
  </group>;
}
