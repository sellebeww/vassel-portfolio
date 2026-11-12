import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stackGroups } from "../data/portfolio";
import { stackReveal } from "./journey";
import { useFontEpoch } from "./materials";

type Row = { name: string; note: string; weight: number };

/** The glass of both boards: a lit gradient, a hairline frame, the tracked title and a subtitle. */
function paintGlass(c: CanvasRenderingContext2D & { letterSpacing?: string }, title: string, subtitle: string) {
  const glass = c.createLinearGradient(0, 0, 0, 1024); glass.addColorStop(0, "#16262ff5"); glass.addColorStop(1, "#0b151af5");
  c.fillStyle = glass; c.beginPath(); c.roundRect(0, 0, 1024, 1024, 48); c.fill();
  const sheen = c.createLinearGradient(0, 0, 1024, 1024); sheen.addColorStop(0, "#ffffff14"); sheen.addColorStop(.4, "#ffffff00");
  c.fillStyle = sheen; c.beginPath(); c.roundRect(0, 0, 1024, 1024, 48); c.fill();
  c.strokeStyle = "#f0bf9470"; c.lineWidth = 4; c.beginPath(); c.roundRect(10, 10, 1004, 1004, 40); c.stroke();
  c.fillStyle = "#f0bf94"; c.beginPath(); c.roundRect(70, 78, 56, 6, 3); c.fill();
  c.letterSpacing = "6px"; c.fillStyle = "#f0bf94"; c.font = '500 40px "Geist", sans-serif'; c.fillText(title, 70, 142); c.letterSpacing = "0px";
  c.fillStyle = "#a29e96"; c.font = '400 34px "Geist", sans-serif'; c.fillText(subtitle, 70, 196);
  c.fillStyle = "#efe9df24"; c.fillRect(70, 226, 884, 2);
}
/** Shrinks the type until a line fits the frame instead of letting it run off the edge. */
function fit(c: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number, least = 16) {
  c.font = font(size); while (c.measureText(text).width > width && size > least) { size--; c.font = font(size); }
}
function paintFooter(c: CanvasRenderingContext2D, footer: string) {
  fit(c, footer, size => `400 ${size}px "Geist", sans-serif`, 30, 884); c.fillStyle = "#a29e96"; c.fillText(footer, 70, 970);
}
const toTexture = (canvas: HTMLCanvasElement) => { const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map; };

/** Languages: a rank, the name in the site's serif, and a fat bar whose length is the share of the leading language. */
function paintLanguages(title: string, subtitle: string, rows: Row[], footer: string) {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 1024;
  const c = canvas.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  paintGlass(c, title, subtitle);
  const top = 262, step = Math.min(110, 650 / Math.max(1, rows.length)), max = Math.max(...rows.map(row => row.weight), 1);
  rows.forEach((row, i) => {
    const y = top + i * step;
    c.fillStyle = "#f0bf94"; c.font = '500 26px "Geist", sans-serif'; c.fillText(String(i + 1).padStart(2, "0"), 70, y + 44);
    c.fillStyle = "#efe9df"; c.font = '400 62px "Newsreader", Georgia, serif'; c.fillText(row.name, 128, y + 50);
    c.fillStyle = "#a29e96"; c.font = '400 30px "Geist", sans-serif'; c.textAlign = "right"; c.fillText(row.note, 954, y + 46); c.textAlign = "left";
    c.fillStyle = "#efe9df1a"; c.beginPath(); c.roundRect(128, y + 66, 826, 14, 7); c.fill();
    const length = Math.max(24, 826 * row.weight / max), bar = c.createLinearGradient(128, 0, 128 + length, 0);
    bar.addColorStop(0, `rgba(240, 191, 148, ${Math.max(.3, .7 - i * .08)})`); bar.addColorStop(1, `rgba(247, 214, 178, ${Math.max(.55, 1 - i * .1)})`);
    c.fillStyle = bar; c.beginPath(); c.roundRect(128, y + 66, length, 14, 7); c.fill();
  });
  paintFooter(c, footer);
  return toTexture(canvas);
}

/** Toolkit: one row per kind of work, the kind in tracked capitals and the tools in serif beneath it. */
function paintToolkit(title: string, subtitle: string, groups: readonly { label: string; items: readonly string[] }[]) {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 1024;
  const c = canvas.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  paintGlass(c, title, subtitle);
  const top = 262, step = Math.min(152, 726 / Math.max(1, groups.length));
  groups.forEach((group, i) => {
    const y = top + i * step;
    c.letterSpacing = "5px"; c.fillStyle = "#f0bf94"; c.font = '500 26px "Geist", sans-serif'; c.fillText(group.label.toUpperCase(), 70, y + 38); c.letterSpacing = "0px";
    c.fillStyle = "#efe9df"; fit(c, group.items.join("  ·  "), size => `400 ${size}px "Newsreader", Georgia, serif`, 58, 884, 30);
    c.fillText(group.items.join("  ·  "), 70, y + 104);
    if (i < groups.length - 1) { c.fillStyle = "#efe9df18"; c.fillRect(70, y + step - 16, 884, 2); }
  });
  return toTexture(canvas);
}

/** Height of the board centres above the desk. Sits high enough that the sudoku pad and chess set in front of
 * them never overlap the footer lines. */
const LIFT = .21;
const SIDES = [{ x: -.425, yaw: .25 }, { x: .425, yaw: -.25 }] as const;

/** Two glass boards standing on the desk either side of the laptop: the languages across the public
 * GitHub projects on the left, the full-stack toolkit from my roles and projects on the right.
 * They rise with the same scroll clock as the camera. */
export default function StackBoards({ progress, still, languages }: { progress: MutableRefObject<number>; still: boolean; languages: readonly { language: string; count: number }[] }) {
  const root = useRef<THREE.Group>(null), boards = useRef<(THREE.Mesh | null)[]>([]), time = useRef(0);
  const fonts = useFontEpoch();
  const maps = useMemo(() => [
    paintLanguages("LANGUAGES", "from my public GitHub projects", languages.slice(0, 6).map(item => ({ name: item.language, note: `${item.count} ${item.count === 1 ? "project" : "projects"}`, weight: item.count })), "github.com/sellebeww"),
    paintToolkit("TOOLKIT", "what my projects and roles are built with", stackGroups),
  ], [languages, fonts]);
  useEffect(() => () => maps.forEach(map => map.dispose()), [maps]);
  useFrame((_, delta) => {
    const amount = stackReveal(progress.current);
    if (root.current) root.current.visible = amount > .001;
    if (!still && !document.hidden) time.current += Math.min(delta, .05);
    boards.current.forEach((board, i) => {
      if (!board) return;
      (board.material as THREE.MeshBasicMaterial).opacity = amount;
      board.position.y = LIFT + Math.sin(time.current * .6 + i * 1.7) * .003 - (1 - amount) * .05;
    });
  });
  return <group name="documented-tech-stack" ref={root} position={[2.45, .79, 0]} visible={false}>
    {SIDES.map((side, i) => <mesh key={i} name={i === 0 ? "stack-board-languages" : "stack-board-web"} ref={value => { boards.current[i] = value; }} position={[side.x, LIFT, 0]} rotation={[-.08, side.yaw, 0]}>
      <planeGeometry args={[.295, .295]} /><meshBasicMaterial map={maps[i]} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>)}
  </group>;
}
