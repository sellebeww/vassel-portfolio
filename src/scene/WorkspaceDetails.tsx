import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Block, type V3 } from "./materials";
import DeskAccessories from "./DeskAccessories";

function Cable({ points, color = "#c6c4b8", radius = .006 }: { points: V3[]; color?: string; radius?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), [points]);
  return <mesh><tubeGeometry args={[curve, 40, radius, 6, false]} /><meshStandardMaterial color={color} roughness={.78} /></mesh>;
}

export function PlainGlassWindow() {
  return <group name="plain-clear-glass-window">
    {/* Ordinary clear glazing. The architecture owns the large window frames;
        no sunshade, perforation texture, extra grid or transmission pass. */}
    <group position={[5.015, 1.62, .01]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh><planeGeometry args={[5.34, 2.09]} /><meshBasicMaterial color="#bdd4dd" transparent opacity={.024} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <mesh position={[-1.82, .03, .002]} rotation={[0, 0, -.12]}><planeGeometry args={[.13, 1.77]} /><meshBasicMaterial color="#dae5e5" transparent opacity={.023} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <mesh position={[.87, -.02, .002]} rotation={[0, 0, -.12]}><planeGeometry args={[.065, 1.83]} /><meshBasicMaterial color="#dae5e5" transparent opacity={.017} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
    </group>
    <Block position={[4.89, 1.075, -.51]} size={[.018, .08, .045]} color="#ab9b80" metalness={.65} radius={.004} />
  </group>;
}

function Leaf({ position, rotation, scale = 1, color }: { position: V3; rotation: V3; scale?: number; color: string }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 10; row++) {
      const t = row / 10, width = Math.pow(Math.sin(t * Math.PI), .85) * .047;
      for (let column = 0; column <= 4; column++) {
        const u = column / 2 - 1;
        positions.push(width * u, t * .19, Math.sin(t * Math.PI) * .025 - Math.abs(u) * .014);
        if (row < 10 && column < 4) { const a = row * 5 + column; indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
      }
    }
    const result = new THREE.BufferGeometry(); result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); result.setIndex(indices); result.computeVertexNormals(); return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} rotation={rotation} scale={scale} geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={.87} side={THREE.DoubleSide} /></mesh>;
}

function DeskPlant() {
  return <group position={[3.62, .8, .27]}>
    <mesh position={[0, .073, 0]} castShadow><cylinderGeometry args={[.092, .068, .145, 28]} /><meshStandardMaterial color="#a8775d" roughness={.93} /></mesh>
    <mesh position={[0, .145, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.078, .094, 28]} /><meshStandardMaterial color="#b7886b" roughness={.93} /></mesh>
    <mesh position={[0, .14, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.079, 24]} /><meshStandardMaterial color="#2c3029" /></mesh>
    {[0, 1, 2].map(stem => <group key={stem} rotation={[0, stem * 2.2, 0]}>
      <Cable points={[[0, .14, 0], [.012, .24, 0], [.034, .38 + stem * .045, .014], [.014, .49 + stem * .045, .017]]} color="#6a7650" radius={.003} />
      {[0, 1, 2].map(i => <Leaf key={i} position={[.025, .20 + i * .112 + stem * .02, .005]} rotation={[.14, i * 2.8, (i % 2 ? 1 : -1) * .9]} scale={i === 2 ? .8 : 1} color={i % 2 ? "#59745a" : "#7b8c60"} />)}
    </group>)}
  </group>;
}

/** A small, text-labelled drink interpretation, not a fetched brand logo or
 * product photograph. Clear plastic uses alpha only: no transmission pass. */
function CaramelMacchiato() {
  const textures = useMemo(() => {
    const label = document.createElement("canvas"); label.width = 512; label.height = 512;
    const context = label.getContext("2d")!;
    context.fillStyle = "#eee8dc"; context.fillRect(0, 0, 512, 512);
    context.textAlign = "center";
    // The brand and exact motto stay high contrast on a warm paper sleeve.
    context.fillStyle = "#943e32"; context.font = "600 48px Georgia, serif";
    context.fillText("Kopi Kenangan", 256, 91);
    context.fillStyle = "#ad8160"; context.fillRect(106, 126, 300, 2);
    context.fillStyle = "#322a24"; context.font = "600 52px Arial, sans-serif";
    context.fillText("Good Things", 256, 221); context.fillText("Take Time", 256, 284);
    context.fillStyle = "#7c6048"; context.font = "26px Arial, sans-serif";
    context.fillText("CARAMEL MACCHIATO", 256, 384);
    context.font = "20px Arial, sans-serif"; context.fillText("ICED • MADE WITH HEART", 256, 432);
    const print = new THREE.CanvasTexture(label); print.colorSpace = THREE.SRGBColorSpace; print.anisotropy = 8;
    const coffee = document.createElement("canvas"); coffee.width = 128; coffee.height = 256;
    const coffeeContext = coffee.getContext("2d")!, gradient = coffeeContext.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#d5ae7b"); gradient.addColorStop(.1, "#97653f");
    gradient.addColorStop(.26, "#af7e54"); gradient.addColorStop(.57, "#d5b38b"); gradient.addColorStop(1, "#e3caaa");
    coffeeContext.fillStyle = gradient; coffeeContext.fillRect(0, 0, 128, 256);
    coffeeContext.strokeStyle = "rgba(126, 74, 35, .12)"; coffeeContext.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      coffeeContext.beginPath(); coffeeContext.moveTo(i * 27 + 7, 26);
      coffeeContext.bezierCurveTo(i * 27 - 6, 82, i * 27 + 19, 128, i * 27 + 6, 215); coffeeContext.stroke();
    }
    const drink = new THREE.CanvasTexture(coffee); drink.colorSpace = THREE.SRGBColorSpace; drink.anisotropy = 4;
    return { print, drink };
  }, []);
  useEffect(() => () => { textures.print.dispose(); textures.drink.dispose(); }, [textures]);
  const caramel = useMemo(() => new THREE.CatmullRomCurve3(Array.from({ length: 28 }, (_, index) => {
    const t = index / 27, angle = t * Math.PI * 4.4, radius = .013 + t * .042;
    return new THREE.Vector3(Math.cos(angle) * radius, .207, Math.sin(angle) * radius);
  })), []);
  return <group name="kopi-kenangan-caramel-macchiato" position={[1.32, .79, -.30]} rotation={[0, .12, 0]} scale={1.08}>
    <mesh position={[0, .006, 0]} receiveShadow><cylinderGeometry args={[.096, .096, .012, 36]} /><meshStandardMaterial color="#6b6558" roughness={.93} /></mesh>
    <mesh position={[0, .112, 0]} castShadow><cylinderGeometry args={[.071, .053, .186, 40]} /><meshStandardMaterial map={textures.drink} roughness={.63} /></mesh>
    <mesh position={[0, .118, 0]}><cylinderGeometry args={[.077, .056, .21, 40, 1, true]} /><meshStandardMaterial color="#f4eee0" transparent opacity={.16} roughness={.22} metalness={.06} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .110, 0]}><cylinderGeometry args={[.0745, .0614, .132, 32, 1, true, -1.13, 2.26]} /><meshStandardMaterial map={textures.print} roughness={.88} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .205, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.071, 36]} /><meshStandardMaterial color="#d9b98a" roughness={.84} /></mesh>
    <mesh><tubeGeometry args={[caramel, 36, .0015, 5, false]} /><meshStandardMaterial color="#9e683b" roughness={.51} /></mesh>
    {[[-.025, .207, -.013], [.015, .208, .021], [.032, .207, -.021]].map((point, index) => <group key={index} position={point as V3} rotation={[.16, index * .8, -.12]}>
      <Block size={[.028, .017, .027]} radius={.006}><meshStandardMaterial color="#e2d5bf" transparent opacity={.3} roughness={.19} metalness={.02} depthWrite={false} /></Block>
    </group>)}
    <mesh position={[0, .225, 0]}><cylinderGeometry args={[.080, .078, .012, 40, 1, true]} /><meshStandardMaterial color="#efe9dd" transparent opacity={.52} roughness={.28} metalness={.03} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .231, 0]} scale={[1, .16, 1]}><sphereGeometry args={[.078, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f0ebe1" transparent opacity={.25} roughness={.22} metalness={.04} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .231, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.078, .0023, 6, 40]} /><meshStandardMaterial color="#e9dfce" roughness={.3} /></mesh>
    <mesh position={[-.036, .242, .025]} rotation={[-Math.PI / 2, 0, -.4]} scale={[1, .45, 1]}><circleGeometry args={[.011, 20]} /><meshStandardMaterial color="#544335" roughness={.74} /></mesh>
  </group>;
}

export default function WorkspaceDetails() {
  return <group name="tidy-workspace-details">
    <DeskPlant /><CaramelMacchiato /><DeskAccessories />
    {/* Shallow shelf stays behind the workspace and away from the chapter subjects. */}
    <Block position={[3.73, 1.88, -2.56]} size={[1.11, .035, .3]} color="#8c705b" />
    {["#304f5e", "#927865", "#6d7870", "#354348", "#a78864"].map((color, i) => <Block key={color} position={[3.35 + i * .083, 2.055 - i % 2 * .018, -2.59]} rotation={[0, 0, i === 4 ? -.14 : 0]} size={[.067, .3 - i % 2 * .036, .17]} color={color} radius={.003} />)}
    <Block position={[4.02, 2.0, -2.57]} size={[.27, .2, .18]} color="#293b45" radius={.008} />
    <mesh position={[4.02, 2.0, -2.474]}><circleGeometry args={[.061, 24]} /><meshStandardMaterial color="#101a22" metalness={.3} roughness={.6} /></mesh>
  </group>;
}
