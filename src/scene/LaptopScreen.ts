import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { projectShowcase } from "../data/portfolio";
import { useFontEpoch } from "./materials";

/** The laptop tells the story of the person at the desk: an editor window mid-session, VS Code in its dark theme.
 * The open folder and file are named after the project in the spotlight (the card beside the desk), and the status
 * bar shows its first listed technology. The code is a short generic snippet, not a claim about the project's source.
 * It repaints only when the spotlight changes, so it costs nothing in between. */
const W = 1536, H = 960;
const MONO = 'Menlo, "SF Mono", Consolas, monospace';
const COLOR = { text: "#d4d4d4", keyword: "#c586c0", fn: "#dcdcaa", string: "#ce9178", type: "#4ec9b0", prop: "#9cdcfe", note: "#6a9955", number: "#b5cea8", punct: "#808080" };
type Token = [string, keyof typeof COLOR];
const SNIPPET: Token[][] = [
  [["// pick up where the last commit left off", "note"]],
  [["import", "keyword"], [" { ", "text"], ["useState", "fn"], [" } ", "text"], ["from", "keyword"], [' "react"', "string"], [";", "punct"]],
  [],
  [["export function", "keyword"], [" Board", "type"], ["({ ", "text"], ["items", "prop"], [" }) {", "text"]],
  [["  const", "keyword"], [" [", "text"], ["open", "prop"], [", ", "text"], ["setOpen", "fn"], ["] = ", "text"], ["useState", "fn"], ["(", "text"], ["0", "number"], [");", "text"]],
  [],
  [["  return", "keyword"], [" (", "text"]],
  [["    <", "punct"], ["ul", "type"], [" className", "prop"], ["=", "text"], ['"board"', "string"], [">", "punct"]],
  [["      {items.", "text"], ["map", "fn"], ["(item => (", "text"]],
  [["        <", "punct"], ["li", "type"], [" key", "prop"], ["={item.id}", "text"], [" onClick", "prop"], ["={() => ", "text"], ["setOpen", "fn"], ["(item.id)}>", "text"]],
  [["          {item.title}", "text"]],
  [["        </", "punct"], ["li", "type"], [">", "punct"]],
  [["      ))}", "text"]],
  [["    </", "punct"], ["ul", "type"], [">", "punct"]],
  [["  );", "text"]],
  [["}", "text"]],
];
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function paint(canvas: HTMLCanvasElement, project: number) {
  const c = canvas.getContext("2d")!, item = projectShowcase[project], name = slug(item.title);
  c.save(); c.scale(canvas.width / W, canvas.height / H);
  const text = (value: string, x: number, y: number, color: string, size = 24) => { c.font = `${size}px ${MONO}`; c.fillStyle = color; c.fillText(value, x, y); };
  c.textBaseline = "alphabetic"; c.fillStyle = "#1e1e1e"; c.fillRect(0, 0, W, H);
  // Title bar with the window controls.
  c.fillStyle = "#323233"; c.fillRect(0, 0, W, 54);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((color, i) => { c.fillStyle = color; c.beginPath(); c.arc(40 + i * 36, 27, 10, 0, Math.PI * 2); c.fill(); });
  c.textAlign = "center"; text(`${name} — Visual Studio Code`, W / 2, 34, "#9d9d9d", 22); c.textAlign = "left";
  // Activity bar: five plain glyph slots, the first (Explorer) active.
  c.fillStyle = "#333333"; c.fillRect(0, 54, 72, H - 54 - 36);
  c.fillStyle = "#d7d7d7"; c.fillRect(0, 70, 4, 56);
  [86, 166, 246, 326, 406].forEach((y, i) => { c.strokeStyle = i ? "#858585" : "#d7d7d7"; c.lineWidth = 3; c.beginPath(); c.roundRect(24, y, 26, 30, 5); c.stroke(); });
  // Explorer.
  c.fillStyle = "#252526"; c.fillRect(72, 54, 330, H - 54 - 36);
  text("EXPLORER", 100, 100, "#bbbbbb", 20);
  text(`v ${name.toUpperCase()}`, 92, 146, "#cccccc", 20);
  const files: [string, number, boolean][] = [["src", 0, false], ["App.tsx", 1, true], ["Board.tsx", 1, false], ["styles.css", 1, false], ["package.json", 0, false], ["README.md", 0, false]];
  files.forEach(([file, depth, active], i) => {
    const y = 190 + i * 42; if (active) { c.fillStyle = "#37373d"; c.fillRect(72, y - 28, 330, 40); }
    text(`${i === 0 ? "v " : ""}${file}`, 112 + depth * 28, y, active ? "#ffffff" : "#c5c5c5", 22);
  });
  // Tabs.
  c.fillStyle = "#252526"; c.fillRect(402, 54, W - 402, 64);
  c.fillStyle = "#1e1e1e"; c.fillRect(402, 54, 250, 64); c.fillStyle = "#4ec9b0"; c.fillRect(402, 54, 250, 3);
  text("App.tsx", 430, 94, "#ffffff", 22); text("x", 618, 94, "#a0a0a0", 22);
  text("Board.tsx", 690, 94, "#8b8b8b", 22);
  // Editor with line numbers and a current-line highlight.
  c.fillStyle = "#2a2d2e"; c.fillRect(402, 118 + 7 * 44 - 4, W - 402, 44);
  SNIPPET.forEach((line, i) => {
    const y = 160 + i * 44; text(String(i + 1), 440, y, i === 7 ? "#c6c6c6" : "#6e7681", 22);
    let x = 520; for (const [part, kind] of line) { text(part, x, y, COLOR[kind], 25); c.font = `25px ${MONO}`; x += c.measureText(part).width; }
  });
  c.fillStyle = "#aeafad"; c.fillRect(520 + 14 * 15, 160 + 7 * 44 - 26, 3, 34);
  // Minimap.
  c.fillStyle = "#1e1e1e"; c.fillRect(W - 110, 118, 110, H - 118 - 36);
  SNIPPET.forEach((line, i) => { let x = W - 96; for (const [part, kind] of line) { const w = part.length * 3.2; c.fillStyle = COLOR[kind]; c.globalAlpha = .55; c.fillRect(x, 136 + i * 11, w, 4); c.globalAlpha = 1; x += w; } });
  // Status bar.
  c.fillStyle = "#007acc"; c.fillRect(0, H - 36, W, 36);
  text("main", 24, H - 11, "#ffffff", 20); text("0 errors", 130, H - 11, "#ffffff", 20);
  c.textAlign = "right"; text(`Ln 8, Col 15     ${item.stack[0] ?? "TypeScript"}     UTF-8`, W - 24, H - 11, "#ffffff", 20); c.textAlign = "left";
  c.restore();
}

export function useLaptopScreen(focus: number, low: boolean) {
  const fonts = useFontEpoch(), invalidate = useThree(state => state.invalidate);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = low ? 1024 : W; canvas.height = low ? 640 : H;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.flipY = false; return map;
  }, [low]);
  useEffect(() => { paint(texture.image as HTMLCanvasElement, focus); texture.needsUpdate = true; invalidate(); }, [texture, focus, fonts, invalidate]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** The small "Supermie" sticker on the laptop's palm rest. */
export function useStickerTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 160;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#101417"; c.fillRect(0, 0, 512, 160);
    c.fillStyle = "#d73239"; c.beginPath(); c.roundRect(0, 0, 512, 160, 9); c.fill();
    c.font = "italic bold 102px Arial"; c.fillStyle = "#fff9ef"; c.fillText("Supermie", 23, 117);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
