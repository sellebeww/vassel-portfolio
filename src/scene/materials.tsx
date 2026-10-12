import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type V3 = [number, number, number];
export type Transform = { position?: V3; rotation?: V3; scale?: number | V3 };

export function Block({ size, color = "#ede4d5", metalness = 0, roughness = .6, radius = .02, children, ...props }: Transform & { size: V3; color?: string; metalness?: number; roughness?: number; radius?: number; children?: ReactNode }) {
  return <RoundedBox args={size} radius={Math.min(radius, ...size.map(n => n / 2.2))} smoothness={2} castShadow receiveShadow {...props}>
    {children ?? <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />}
  </RoundedBox>;
}

export function Ellipsoid({ size, color, roughness = .65, ...props }: Transform & { size: V3; color: string; roughness?: number }) {
  return <mesh castShadow receiveShadow {...props} scale={size}><sphereGeometry args={[1, 28, 20]} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>;
}

export function Limb({ from, to, radius, color }: { from: V3; to: V3; radius: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    return { position: a.clone().add(b).multiplyScalar(.5), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), length: a.distanceTo(b) };
  }, [from, to]);
  return <mesh position={position} quaternion={quaternion} castShadow receiveShadow><capsuleGeometry args={[radius, Math.max(.001, length - radius * 2), 8, 20]} /><meshStandardMaterial color={color} roughness={.72} /></mesh>;
}

/** Canvas textures are painted once, in the site's web fonts. The room does not wait for those fonts, so if
 * one finishes loading after a texture was painted (in a fallback face), this counter changes and every
 * texture that depends on it repaints. One listener for the whole scene; usually it never fires. */
let fontEpoch = 0;
const fontListeners = new Set<() => void>();
document.fonts?.addEventListener("loadingdone", () => { fontEpoch++; fontListeners.forEach(listener => listener()); });
const subscribeFonts = (listener: () => void) => { fontListeners.add(listener); return () => { fontListeners.delete(listener); }; };
export const useFontEpoch = () => useSyncExternalStore(subscribeFonts, () => fontEpoch);

export function Label({ text, sub = "", width = .5, dark = false, compact = false, ...props }: Transform & { text: string; sub?: string; width?: number; dark?: boolean; compact?: boolean }) {
  const fonts = useFontEpoch();
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = compact ? 96 : 256;
    const ctx = canvas.getContext("2d")!;
    // Same typeface as the HTML labels (App waits for it before the scene mounts): compact and titled
    // placards are both set in Geist. Colours are the site's ink/paper/lamp tokens.
    ctx.fillStyle = dark ? "#0f1920" : "#efe9df"; ctx.fillRect(0, 0, 1024, canvas.height);
    const face = '"Geist", sans-serif';
    let fontSize = compact ? 36 : 48;
    ctx.font = `500 ${fontSize}px ${face}`;
    while (ctx.measureText(text).width > 944 && fontSize > 22) { fontSize--; ctx.font = `500 ${fontSize}px ${face}`; }
    ctx.fillStyle = dark ? "#f0bf94" : "#15222a"; ctx.fillText(text, 40, compact ? 61 : sub ? 105 : 148);
    if (sub) { ctx.fillStyle = dark ? "#a29e96" : "#5d625f"; ctx.font = '400 28px "Geist", sans-serif'; ctx.fillText(sub, 40, 175); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map;
  }, [text, sub, dark, compact, fonts]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh {...props}><planeGeometry args={[width, width * (compact ? 96 : 256) / 1024]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

export function useSurface(kind: "oak" | "plaster") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!, pixels = ctx.createImageData(512, 512);
    let seed = 923;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      seed = (seed * 16807) % 2147483647;
      const wave = kind === "oak" ? Math.sin(y * .18 + Math.sin(x * .007) * 1.8) * 3 + Math.sin(y * 1.82 + Math.sin(x * .034)) * 1.6 : 0;
      const grain = (seed / 2147483647 - .5) * (kind === "oak" ? 6 : 18);
      const i = (y * 512 + x) * 4, base = kind === "oak" ? [174, 133, 94] : [218, 210, 195];
      for (let c = 0; c < 3; c++) pixels.data[i + c] = base[c] + wave + grain;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(kind === "oak" ? 2 : 4, kind === "oak" ? 2 : 4); map.anisotropy = 16; return map;
  }, [kind]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Honey-oak desktop albedo, painted in code: no download. Fibres run along the desk (x); long, slow growth
 * bands bend through them, and per-pixel grain keeps it from reading as flat stripes. Even, low-contrast
 * colour with no baked light, so the scene's own lighting does the work. Tiles seamlessly in x and y. */
export function useOakSurface() {
  const texture = useMemo(() => {
    const W = 1024, H = 512, TAU = Math.PI * 2;
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!, pixels = ctx.createImageData(W, H);
    let seed = 4271;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // A fixed random tone per fibre row gives the fine streaks; whole periods keep the edges seamless.
    const fibre = Array.from({ length: H }, () => random() - .5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const bend = Math.sin(u * TAU * 2 + Math.sin(v * TAU) * 1.3) * .035 + Math.sin(u * TAU * 5) * .006;
      const band = Math.sin((v + bend) * TAU * 9), ring = Math.pow(Math.abs(band), 6);
      const row = fibre[(y + Math.round(bend * H * .4) + H) % H];
      const shade = row * 7 - ring * 13 + band * 3 + (random() - .5) * 5;
      const i = (y * W + x) * 4;
      pixels.data[i] = 186 + shade; pixels.data[i + 1] = 141 + shade * .85; pixels.data[i + 2] = 98 + shade * .6; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1.7, .8);
    map.anisotropy = 16;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
