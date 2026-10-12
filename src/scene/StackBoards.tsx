import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { developmentPractices, techStack } from "../data/portfolio";
import { stackReveal } from "./journey";
import { useFontEpoch } from "./materials";

type Row = { name: string; note: string; weight: number };

/** Draws one glass board in the site's own type system: a mono logbook title, serif names (the same voice
 * as the HTML headings), mono notes, and proportional bars in lamplight only (no rainbow). */
function paintBoard(title: string, subtitle: string, rows: Row[], footer: string) {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 1024;
  const c = canvas.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  c.fillStyle = "#0f1920f2"; c.beginPath(); c.roundRect(0, 0, 1024, 1024, 48); c.fill();
  c.strokeStyle = "#f0bf9470"; c.lineWidth = 4; c.beginPath(); c.roundRect(10, 10, 1004, 1004, 40); c.stroke();
  c.letterSpacing = "6px"; c.fillStyle = "#f0bf94"; c.font = '500 40px "Geist", sans-serif'; c.fillText(title, 70, 124); c.letterSpacing = "0px";
  c.fillStyle = "#a29e96"; c.font = '400 36px "Geist", sans-serif'; c.fillText(subtitle, 70, 184);
  c.fillStyle = "#efe9df24"; c.fillRect(70, 222, 884, 2);
  const top = 270, step = Math.min(130, 640 / Math.max(1, rows.length)), max = Math.max(...rows.map(row => row.weight), 1);
  rows.forEach((row, i) => {
    const y = top + i * step;
    c.fillStyle = "#efe9df"; c.font = '400 70px "Newsreader", Georgia, serif'; c.fillText(row.name, 70, y + 62);
    c.fillStyle = "#a29e96"; c.font = '400 32px "Geist", sans-serif'; c.textAlign = "right"; c.fillText(row.note, 954, y + 58); c.textAlign = "left";
    c.fillStyle = "#efe9df1c"; c.fillRect(70, y + 84, 884, 4);
    // The leading row is full lamplight; each following row steps down in strength, not in hue.
    c.fillStyle = `rgba(240, 191, 148, ${Math.max(.35, 1 - i * .13)})`; c.fillRect(70, y + 84, 884 * row.weight / max, 4);
  });
  // The footer must fit inside the frame: shrink the type until it does instead of letting it run off the edge.
  let size = 30; c.font = `400 ${size}px "Geist", sans-serif`;
  while (c.measureText(footer).width > 884 && size > 16) { size--; c.font = `400 ${size}px "Geist", sans-serif`; }
  c.fillStyle = "#a29e96"; c.fillText(footer, 70, 958);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

/** Height of the board centres above the desk. Sits high enough that the sudoku pad and chess set in front of
 * them never overlap the footer lines. */
const LIFT = .21;
const SIDES = [{ x: -.40, yaw: .25 }, { x: .40, yaw: -.25 }] as const;

/** Two glass boards standing on the desk either side of the laptop: the languages across the public
 * GitHub projects on the left, the documented web stack from the UMN Medical Center role on the right.
 * They rise with the same scroll clock as the camera. */
export default function StackBoards({ progress, still, languages }: { progress: MutableRefObject<number>; still: boolean; languages: readonly { language: string; count: number }[] }) {
  const root = useRef<THREE.Group>(null), boards = useRef<(THREE.Mesh | null)[]>([]), time = useRef(0);
  const fonts = useFontEpoch();
  const maps = useMemo(() => [
    paintBoard("LANGUAGES", "from my public GitHub projects", languages.slice(0, 6).map(item => ({ name: item.language, note: `${item.count} ${item.count === 1 ? "project" : "projects"}`, weight: item.count })), "github.com/sellebeww"),
    paintBoard("WEB STACK", "UMN Medical Center · full-stack role", techStack.map(tool => ({ name: tool.name, note: tool.category, weight: 1 })), developmentPractices.join(" · ")),
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
      <planeGeometry args={[.26, .26]} /><meshBasicMaterial map={maps[i]} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>)}
  </group>;
}
