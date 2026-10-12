import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Block } from "./materials";

// Keep the insignia photographic: these UV crops are from the user's real
// blazer, not generated university marks. Their original atlas is never edited.
// Regular rows follow the user's straightened-blazer reference; the few rotations
// compensate for the angle of a real badge inside its original photograph crop.
const PIN_POSITIONS: [number, number, number][] = [
  [-.128, 1.431, .74], [-.088, 1.448, 0],
  [-.115, 1.389, .04], [-.078, 1.395, -.15],
  [-.106, 1.348, 0], [-.069, 1.348, .03],
  [-.075, 1.307, 0], [-.071, 1.269, .07],
  [.084, 1.449, .68], [.126, 1.444, 0],
  [.081, 1.406, 0], [.121, 1.406, 0],
  [.069, 1.365, 0], [.108, 1.365, 0], [.082, 1.322, 0],
];

/** A millimetre-scale twill, not the oversized knit of the previous coat. */
function fineWool() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!, pixels = context.createImageData(256, 256);
  let seed = 157;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (seed * 16807) % 2147483647;
    const thread = ((x + y) % 4 < 2 ? 1 : -1) * 3;
    const grain = (seed / 2147483647 - .5) * 5;
    const offset = (y * 256 + x) * 4;
    for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = 238 + thread + grain;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Remove only edge-connected dark blue cloth around a source insignia.
 * Flood filling keeps enclosed blue/black logo details (particularly UMN) intact.
 * All processing happens on a small runtime canvas; original pixels stay on disk.
 */
function isolateInsignia(source: THREE.Texture, geometry: THREE.BufferGeometry, pin: boolean) {
  const uv = geometry.getAttribute("uv");
  let minU = 1, minV = 1, maxU = 0, maxV = 0;
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i));
    minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
  }
  const image = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 192;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, minU * image.width, minV * image.height, (maxU - minU) * image.width, (maxV - minV) * image.height, 0, 0, 192, 192);
  const pixels = context.getImageData(0, 0, 192, 192), queue: number[] = [], seen = new Uint8Array(192 * 192);
  const visit = (x: number, y: number) => {
    if (x < 0 || x >= 192 || y < 0 || y >= 192) return;
    const index = y * 192 + x;
    if (seen[index]) return;
    seen[index] = 1;
    const offset = index * 4, r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2];
    if ((r < 153 && g < 166 && b < 180 && b > r * .99 && b > g * .87) || (r < 70 && g < 78 && b < 90)) {
      pixels.data[offset + 3] = 0; queue.push(index);
    }
  };
  for (let i = 0; i < 192; i++) { visit(i, 0); visit(i, 191); visit(0, i); visit(191, i); }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], x = index % 192, y = Math.floor(index / 192);
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
  }
  if (pin) {
    // A few source crops include a corner of the neighbouring badge. Keep the
    // main silhouette and closely attached small pieces, not those stray corners.
    // This is deliberately not applied to the university patch or its lettering.
    const visited = new Uint8Array(192 * 192), islands: number[][] = [];
    for (let start = 0; start < visited.length; start++) {
      if (visited[start] || !pixels.data[start * 4 + 3]) continue;
      const island = [start]; visited[start] = 1;
      for (let head = 0; head < island.length; head++) {
        const index = island[head], x = index % 192, y = Math.floor(index / 192);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= 192 || ny < 0 || ny >= 192) continue;
          const next = ny * 192 + nx;
          if (!visited[next] && pixels.data[next * 4 + 3]) { visited[next] = 1; island.push(next); }
        }
      }
      islands.push(island);
    }
    islands.sort((a, b) => b.length - a.length);
    if (islands.length > 1) {
      const main = islands[0], distance = new Uint8Array(192 * 192).fill(255), frontier = [...main];
      main.forEach(index => { distance[index] = 0; });
      for (let head = 0; head < frontier.length; head++) {
        const index = frontier[head]; if (distance[index] >= 5) continue;
        const x = index % 192, y = Math.floor(index / 192);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= 192 || ny < 0 || ny >= 192) continue;
          const next = ny * 192 + nx;
          if (distance[next] > distance[index] + 1) { distance[next] = distance[index] + 1; frontier.push(next); }
        }
      }
      islands.slice(1).forEach(island => {
        const attached = island.some(index => distance[index] <= 2);
        const closeDetail = island.length >= main.length * .025 && island.some(index => distance[index] <= 5);
        if (!attached && !closeDetail) island.forEach(index => { pixels.data[index * 4 + 3] = 0; });
      });
    }
  }
  context.putImageData(pixels, 0, 0);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - minU) / (maxU - minU), (uv.getY(i) - minV) / (maxV - minV));
  uv.needsUpdate = true;
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function tailorGarment(mesh: THREE.Mesh) {
  const geometry = mesh.geometry.clone(), position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  const sleeve = mesh.name.startsWith("Almet_Sleeve") || mesh.name.startsWith("Sleeve_Seam");
  const body = mesh.name.startsWith("Almet_Body");
  const lapel = mesh.name.startsWith("Notched_Lapel");
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    if (sleeve) {
      // A softly hanging arm, with restrained elbow creases rather than tubes.
      const hang = 1 - THREE.MathUtils.smoothstep(y, .83, 1.48);
      x -= Math.sign(x) * .010 * hang;
      z *= 1 - .12 * THREE.MathUtils.smoothstep(y, 1.33, 1.5);
      z += .0021 * Math.sin(y * 56 + Math.abs(x) * 9) * Math.exp(-Math.pow((y - 1.05) / .2, 2));
      y -= .019 * THREE.MathUtils.smoothstep(y, 1.37, 1.55);
    } else if (body) {
      y -= .012 * THREE.MathUtils.smoothstep(Math.abs(x), .12, .25) * THREE.MathUtils.smoothstep(y, 1.4, 1.55);
      if (z > 0) z += .0026 * Math.sin(x * 51 + y * 4) * (1 - THREE.MathUtils.smoothstep(y, 1.25, 1.48));
    } else if (lapel) {
      // Gentle roll exposes the thickness of the notched lapel in grazing light.
      z += .003 * Math.sin(THREE.MathUtils.clamp((y - 1.08) / .46, 0, 1) * Math.PI);
    }
    position.setXYZ(i, x, y, z);
    uv[i * 2] = (sleeve ? Math.atan2(x - Math.sign(x) * .27, z) / Math.PI * .1 : x) * 16;
    uv[i * 2 + 1] = y * 16;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Twelve tiny thread holes share one draw call. */
function ButtonThreads() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Matrix4(); let index = 0;
    for (const y of [1.083, .971, .86]) for (const dx of [-.0025, .0025]) for (const dy of [-.0025, .0025]) {
      transform.makeTranslation(-.018 + dx, y + dy, .124);
      mesh.current.setMatrixAt(index++, transform);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[undefined, undefined, 12]} raycast={() => null}><circleGeometry args={[.00125, 8]} /><meshBasicMaterial color="#0a121a" /></instancedMesh>;
}

export default function Almet() {
  const { scene } = useGLTF("/models/mannequin.glb");
  const { object, materials, geometries, textures } = useMemo(() => {
    const object = scene.clone(true), materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
    const wool = fineWool(); textures.add(wool);
    const fabric = new THREE.MeshPhysicalMaterial({ name: "Fine navy wool", color: "#293e58", map: wool, bumpMap: wool, bumpScale: .00015, roughness: .88, metalness: 0, sheen: .16, sheenRoughness: .86, sheenColor: new THREE.Color("#536981"), side: THREE.DoubleSide });
    const seams = new THREE.MeshStandardMaterial({ color: "#273c50", roughness: .94, map: wool });
    const lining = new THREE.MeshPhysicalMaterial({ color: "#11171e", roughness: .82, sheen: .09, sheenColor: new THREE.Color("#53606b"), side: THREE.DoubleSide });
    materials.add(fabric); materials.add(seams); materials.add(lining);
    let pinIndex = 0;
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = child.receiveShadow = true;
      const original = child.material as THREE.MeshStandardMaterial;
      if (original.name === "Almet_Navy" || child.name.startsWith("Sleeve_Seam")) {
        child.geometry = tailorGarment(child); geometries.add(child.geometry);
        child.material = original.name === "Almet_Navy" ? fabric : seams;
      } else if (original.name === "Mannequin_Linen") {
        child.material = lining;
        if (child.name.startsWith("Neck")) { child.scale.set(.9, .86, .9); child.position.y -= .009; }
      } else if (child.name.startsWith("Pin_Backing")) {
        // The original box backings made real, irregular pins look like tiles.
        child.visible = false;
      } else if (original.name === "Almet_Reference_Decals" && original.map) {
        child.geometry = child.geometry.clone(); geometries.add(child.geometry);
        const pin = child.name.startsWith("Pin_Reference_Artwork");
        const map = isolateInsignia(original.map, child.geometry, pin); textures.add(map);
        child.material = new THREE.MeshStandardMaterial({ map, color: "#ffffff", alphaTest: .48, roughness: pin ? .42 : .91, metalness: pin ? .2 : 0, side: THREE.DoubleSide });
        materials.add(child.material);
        if (pin) {
          const [x, y, angle] = PIN_POSITIONS[pinIndex++]; child.position.set(x, y, .156); child.rotation.z = angle;
          child.scale.setScalar(1.06);
        } else { child.scale.setScalar(1.08); child.position.z = .131; }
      } else {
        const material = original.clone(); child.material = material; materials.add(material);
        if (original.name === "Almet_Seams") {
          material.color.set("#25394b"); material.roughness = .93;
          if (child.name.includes("Welt_Pocket")) { child.scale.y = .42; child.scale.z = .42; }
        }
        if (child.name.includes("Button")) {
          material.color.set("#243443"); material.metalness = .13; material.roughness = .44;
          if (child.name.startsWith("Cuff")) { child.position.x -= Math.sign(child.position.x) * .010; child.scale.setScalar(.83); }
        }
        if (child.name.startsWith("Display") || child.name.startsWith("Neck_Cap")) {
          material.color.set("#38424a"); material.metalness = .64; material.roughness = .38;
        }
        if (child.name.startsWith("Neck_Cap")) { child.position.y -= .022; child.scale.set(.9, 1, .9); }
      }
    });
    return { object, materials, geometries, textures };
  }, [scene]);
  useEffect(() => () => {
    materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose());
  }, [materials, geometries, textures]);
  return <group name="almet-exhibit" position={[-3.36, .035, -2.38]} scale={1.22} rotation={[0, -.025, 0]}>
    <group>
      <primitive object={object} scale={1.08} />
      {/* A sewn lining edge and welt folds add depth without simulated cloth. */}
      <group scale={1.08}>
        <Block position={[.005, 1.14, .109]} size={[.0018, .47, .003]} color="#222a31" radius={.0007} roughness={.88} />
        {[-1, 1].map(side => <group key={side}>
          <Block position={[side * .128, .961, .117]} rotation={[0, 0, -side * .035]} size={[.111, .003, .002]} color="#405366" radius={.001} roughness={.95} />
          <Block position={[side * .128, .952, .116]} rotation={[0, 0, -side * .035]} size={[.111, .002, .003]} color="#142331" radius={.001} roughness={1} />
        </group>)}
        {[1.083, .971, .86].map(y => <group key={y}>
          <mesh position={[-.018, y, .123]}><torusGeometry args={[.007, .001, 4, 20]} /><meshStandardMaterial color="#3e5060" roughness={.65} metalness={.1} /></mesh>
          <Block position={[.047, y, .119]} size={[.026, .005, .002]} color="#425266" radius={.0018} roughness={.93} />
          <Block position={[.047, y, .1205]} size={[.021, .0017, .001]} color="#101c29" radius={.0006} roughness={1} />
        </group>)}
        <ButtonThreads />
      </group>
    </group>
    <Block position={[0, .006, 0]} size={[.74, .065, .6]} color="#776959" roughness={.49} />
  </group>;
}
