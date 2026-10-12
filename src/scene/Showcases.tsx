import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { achievementPreviews, achievements, experiencePhotos, showcaseWindow } from "../data/portfolio";
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
      <CinematicProjection src={slide.preview} still={still} onNext={() => onSelect((index + 1) % experiencePhotos.length)} />
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

/** One full-resolution original is the focal exhibit, with two large neighbours.
 * Only these three certificates load; the DOM collection exposes all nine.
 * Ordinary low-opacity glass keeps their text visible without transmission. */
export function AchievementCabinet({ index, onSelect, onOpen }: ShowcaseSceneProps) {
  const selected = achievements[index];
  const neighbours = [(index + achievements.length - 1) % achievements.length, (index + 1) % achievements.length];
  return <group position={[1.35, 1.48, -2.47]} name="certificate-gallery-case">
    <Block position={[0, 0, -.055]} size={[1.72, 1.94, .1]} color="#695640" radius={.018} roughness={.56} />
    <Block position={[0, 0, .003]} size={[1.61, 1.82, .035]} color="#22383f" roughness={.92} radius={.003} />
    <Label text="THE CERTIFICATE COLLECTION" width={1.3} position={[0, .837, .025]} dark compact />
    {/* The original file, not its small gallery preview, fills the main frame. */}
    <group position={[0, .22, .084]} onClick={event => { event.stopPropagation(); onOpen(index); }} {...label("View certificate ↗")}>
      <Block size={[1.5, 1.0, .039]} color="#d4b384" roughness={.36} metalness={.61} radius={.008} />
      <Block position={[0, 0, .023]} size={[1.452, .952, .006]} color="#e9e3d4" radius={.001} />
      <group position={[0, 0, .028]}><Suspense fallback={null}><Photograph src={`/images/achievements/${selected[0]}`} width={1.407} height={.908} /></Suspense></group>
    </group>
    <Label text={`${String(index + 1).padStart(2, "0")} / ${String(achievements.length).padStart(2, "0")}  ·  ${selected[1]}  ·  ${selected[3]}`} width={1.08} position={[0, -.337, .134]} dark compact />
    {neighbours.map((awardIndex, offset) => {
      const award = achievements[awardIndex], x = offset ? .384 : -.384;
      return <group key={award[0]} position={[x, -.653, .064]} rotation={[0, offset ? -.025 : .025, 0]} onClick={event => { event.stopPropagation(); onSelect(awardIndex); }} {...label(offset ? "Next certificate" : "Previous certificate")}>
        <Block size={[.686, .463, .026]} color="#ad9471" roughness={.36} metalness={.56} radius={.005} />
        <Block position={[0, 0, .016]} size={[.654, .43, .004]} color="#e9e2d4" radius={.001} />
        <group position={[0, 0, .02]}><Suspense fallback={null}><Photograph src={achievementPreviews[awardIndex]} width={.629} height={.408} /></Suspense></group>
        <Label text={`${offset ? "NEXT" : "PREVIOUS"}  ·  ${String(awardIndex + 1).padStart(2, "0")}`} width={.45} position={[0, -.26, .025]} dark compact />
      </group>;
    })}
    <mesh position={[0, -.407, .098]} raycast={() => null}><boxGeometry args={[1.58, .009, .205]} /><meshStandardMaterial color="#b0d3d0" transparent opacity={.21} roughness={.2} metalness={.13} depthWrite={false} /></mesh>
    <Block position={[0, -.407, .203]} size={[1.57, .009, .012]} color="#c3b694" metalness={.75} roughness={.27} radius={.001} />
    {/* A nearly clear glass door and thin bronze bead establish physical depth. */}
    <mesh position={[0, 0, .231]} raycast={() => null}><planeGeometry args={[1.635, 1.855]} /><meshStandardMaterial color="#c2d6d7" transparent opacity={.019} roughness={.25} metalness={.08} depthWrite={false} /></mesh>
    {[-.823, .823].map(x => <Block key={x} position={[x, 0, .216]} size={[.019, 1.878, .044]} color="#b5986e" metalness={.72} roughness={.29} radius={.002} />)}
    {[-.938, .938].map(y => <Block key={y} position={[0, y, .216]} size={[1.66, .019, .044]} color="#b5986e" metalness={.72} roughness={.29} radius={.002} />)}
    <mesh position={[-.79, .005, .235]} raycast={() => null}><planeGeometry args={[.004, 1.76]} /><meshBasicMaterial color="#c2e2e1" transparent opacity={.26} depthWrite={false} /></mesh>
    <Block position={[.79, -.08, .245]} size={[.015, .14, .031]} color="#d8ba86" metalness={.76} roughness={.3} radius={.006} />
    <Block position={[0, -1.006, .079]} size={[1.83, .067, .39]} color="#987851" roughness={.48} radius={.01} />
  </group>;
}
