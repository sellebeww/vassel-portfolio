import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type V3 } from "./materials";

/** Static miniatures: merge every part sharing a finish, rather than paying a draw call
 * per chess piece, finger or whisker. All dimensions are metres; bases start at y=0. */
class Miniature {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  material(color: string, roughness = .5, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
  add(geometry: THREE.BufferGeometry, material: THREE.Material, position: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]) {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    const list = this.parts.get(material) ?? []; list.push(flat); this.parts.set(material, list);
  }
  ball(material: THREE.Material, position: V3, scale: V3) { this.add(new THREE.SphereGeometry(1, 16, 10), material, position, scale); }
  box(material: THREE.Material, position: V3, size: V3, rotation: V3 = [0, 0, 0]) { this.add(new THREE.BoxGeometry(...size), material, position, [1, 1, 1], rotation); }
  cylinder(material: THREE.Material, position: V3, top: number, bottom: number, height: number, segments = 24) { this.add(new THREE.CylinderGeometry(top, bottom, height, segments), material, position); }
  limb(material: THREE.Material, a: V3, b: V3, radius: number) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), vector = end.clone().sub(start);
    const geometry = new THREE.CapsuleGeometry(radius, Math.max(0, vector.length() - radius * 2), 4, 12);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()));
    this.add(geometry, material, start.add(end).multiplyScalar(.5).toArray() as V3);
  }
  curve(material: THREE.Material, points: V3[], radius: number) {
    this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 5, false), material);
  }
  finish(name: string) {
    const group = new THREE.Group(); group.name = name;
    this.parts.forEach((parts, material) => {
      const merged = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!merged) throw new Error(`Could not assemble ${name}`);
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    });
    return group;
  }
}

function print(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  paint(canvas.getContext("2d")!);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughness: .83, transparent: true });
}

function chessboard() {
  const m = new Miniature(), walnut = m.material("#563b2b", .43), maple = m.material("#d9b980", .5);
  const ivory = m.material("#eee1c5", .3), ebony = m.material("#272b2b", .32);
  const boardPrint = print(768, 768, c => {
    c.fillStyle = "#765035"; c.fillRect(0, 0, 768, 768);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      c.fillStyle = (row + col) % 2 === 0 ? "#e0c698" : "#694a36";
      c.fillRect(32 + col * 88, 32 + row * 88, 88, 88);
    }
    // Fine deterministic grain on the inlaid squares, no extra texture request.
    for (let i = 0; i < 430; i++) {
      c.strokeStyle = `rgba(57,30,12,${.02 + (i % 5) * .007})`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(32, 32 + i * 1.63); c.bezierCurveTo(230, 28 + i * 1.63, 530, 37 + i * 1.63, 736, 32 + i * 1.63); c.stroke();
    }
    c.fillStyle = "#ead5ae"; c.font = "18px Georgia"; c.textAlign = "center";
    for (let i = 0; i < 8; i++) { c.fillText("abcdefgh"[i], 76 + i * 88, 758); c.fillText(String(8 - i), 16, 82 + i * 88); }
  });
  m.box(walnut, [0, .009, 0], [.43, .018, .43]);
  m.box(maple, [0, .0185, 0], [.414, .003, .414]);
  m.add(new THREE.PlaneGeometry(.41, .41), boardPrint, [0, .0201, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const cell = .41 * 88 / 768;
  const piece = (kind: string, col: number, row: number, material: THREE.Material, side: number) => {
    const x = (col - 3.5) * cell, z = (row - 3.5) * cell, y = .0202;
    const profile: [number, number][] = [[0, 0], [.015, 0], [.0155, .003], [.013, .006], [.012, .008], [.009, .009], [.007, .016], [.006, .027], [.010, .03], [.010, .034], [.006, .036]];
    const height = kind === "pawn" ? .77 : kind === "king" ? 1.28 : kind === "queen" ? 1.16 : 1;
    m.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h * height)), 12), material, [x, y, z]);
    const top = y + .036 * height;
    if (kind === "pawn") m.ball(material, [x, top + .006, z], [.009, .009, .009]);
    if (kind === "rook") {
      m.cylinder(material, [x, top + .003, z], .012, .010, .01, 16);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; m.box(material, [x + Math.cos(a) * .008, top + .010, z + Math.sin(a) * .008], [.007, .006, .007]); }
    }
    if (kind === "bishop") {
      m.ball(material, [x, top + .007, z], [.008, .013, .008]);
      m.ball(material, [x, top + .020, z], [.003, .003, .003]);
      m.box(walnut, [x, top + .013, z + .0068], [.002, .012, .001], [0, 0, -.4]);
    }
    if (kind === "knight") {
      m.ball(material, [x, top + .004, z], [.007, .016, .009]);
      m.ball(material, [x, top + .017, z + side * .006], [.0065, .010, .012]);
      m.ball(material, [x, top + .014, z + side * .014], [.006, .005, .008]);
      for (const dx of [-.004, .004]) m.add(new THREE.ConeGeometry(.003, .010, 5), material, [x + dx, top + .028, z]);
    }
    if (kind === "king" || kind === "queen") {
      m.cylinder(material, [x, top + .004, z], .011, .006, .011, 16);
      if (kind === "king") { m.box(material, [x, top + .020, z], [.004, .019, .004]); m.box(material, [x, top + .023, z], [.014, .004, .004]); }
      else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m.ball(material, [x + Math.sin(a) * .009, top + .012, z + Math.cos(a) * .009], [.003, .004, .003]); } m.ball(material, [x, top + .017, z], [.004, .004, .004]); }
    }
  };
  // White's right-hand square (h1) is light; queens stand on their own colour (d1/d8).
  const rank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  rank.forEach((kind, col) => { piece(kind, col, 0, ebony, 1); piece("pawn", col, 1, ebony, 1); piece("pawn", col, 6, ivory, -1); piece(kind, col, 7, ivory, -1); });
  return m.finish("compact-chessboard");
}

function luckyCat() {
  const m = new Miniature(), ceramic = m.material("#f7ead4", .23), red = m.material("#a43528", .33);
  const ink = m.material("#302b27", .5), gold = m.material("#d4a443", .28, .65), pink = m.material("#da9282", .4);
  m.box(red, [0, .005, 0], [.13, .01, .108]);
  m.ball(ceramic, [0, .065, 0], [.046, .060, .037]);
  for (const x of [-.029, .029]) m.ball(ceramic, [x, .021, .025], [.021, .015, .024]);
  m.ball(ceramic, [0, .133, .003], [.052, .044, .038]);
  for (const x of [-.034, .034]) {
    m.add(new THREE.ConeGeometry(.022, .045, 3), ceramic, [x, .174, 0], [1, 1, .65], [0, 0, x > 0 ? -.18 : .18]);
    m.add(new THREE.ConeGeometry(.012, .027, 3), pink, [x, .179, .011], [1, 1, .4]);
  }
  m.add(new THREE.TorusGeometry(.033, .006, 8, 28), red, [0, .097, .005], [1.14, 1, 1], [Math.PI / 2, 0, 0]);
  m.ball(gold, [0, .093, .042], [.010, .011, .007]);
  m.box(ink, [0, .090, .0485], [.0015, .009, .001]);
  // Beckoning left paw and its three tiny painted toe marks.
  m.limb(ceramic, [.035, .077, .004], [.057, .138, .009], .017);
  m.ball(ceramic, [.057, .145, .011], [.018, .022, .016]);
  for (let i = -1; i <= 1; i++) m.limb(pink, [.057 + i * .006, .146, .026], [.057 + i * .006, .153, .026], .001);
  m.limb(ceramic, [-.038, .084, .021], [-.027, .053, .043], .017);
  m.ball(gold, [-.004, .047, .039], [.023, .031, .007]);
  for (let i = 0; i < 3; i++) m.box(ink, [-.004, .038 + i * .009, .046], [.019 - i * .003, .0013, .0008]);
  m.box(ink, [-.004, .049, .046], [.0013, .027, .0008]);
  for (const x of [-.020, .020]) {
    m.curve(ink, [[x - .009, .136, .037], [x, .142, .039], [x + .009, .136, .037]], .0016);
    m.ball(pink, [x * 1.5, .124, .036], [.007, .0035, .002]);
    for (let i = 0; i < 2; i++) m.limb(ink, [x * 1.4, .129 - i * .005, .037], [x * 2, .131 - i * .008, .028], .0008);
  }
  m.ball(pink, [0, .131, .042], [.004, .0027, .002]);
  m.curve(ink, [[-.010, .125, .039], [-.005, .122, .041], [0, .127, .042], [.005, .122, .041], [.010, .125, .039]], .001);
  m.curve(ceramic, [[-.038, .030, -.016], [-.062, .040, -.025], [-.055, .062, -.024]], .008);
  return m.finish("maneki-neko");
}

function sudoku() {
  const m = new Miniature(), cover = m.material("#365452", .88), paper = m.material("#eee4cd", .95), metal = m.material("#ac9879", .35, .65);
  m.box(cover, [0, .003, 0], [.257, .006, .326]);
  m.box(paper, [.003, .009, 0], [.241, .007, .312]);
  for (let i = 0; i < 3; i++) m.box(m.material(i % 2 ? "#c7baa3" : "#f6edda", .95), [.003, .007 + i * .002, .1562], [.239, .0006, .0004]);
  const page = print(640, 800, c => {
    c.fillStyle = "#f5eedb"; c.fillRect(0, 0, 640, 800);
    c.fillStyle = "#355653"; c.font = "600 43px Georgia"; c.fillText("SUDOKU", 64, 78);
    c.fillStyle = "#817664"; c.font = "17px Arial"; c.fillText("DAILY PRACTICE   /   No. 030", 65, 111);
    const grid = ["530070000", "600195000", "098000060", "800060003", "400803001", "700020006", "060000280", "000419005", "000080079"];
    const x = 65, y = 158, size = 56;
    c.fillStyle = "#fffcf2"; c.fillRect(x, y, 504, 504);
    for (let i = 0; i <= 9; i++) {
      c.strokeStyle = i % 3 ? "#b6b0a0" : "#3e514b"; c.lineWidth = i % 3 ? 1.2 : 3.5;
      c.beginPath(); c.moveTo(x + i * size, y); c.lineTo(x + i * size, y + 504); c.stroke();
      c.beginPath(); c.moveTo(x, y + i * size); c.lineTo(x + 504, y + i * size); c.stroke();
    }
    c.textAlign = "center"; c.font = "28px Arial"; c.fillStyle = "#33453f";
    grid.forEach((row, r) => [...row].forEach((n, col) => { if (n !== "0") c.fillText(n, x + col * size + 28, y + r * size + 38); }));
    c.fillStyle = "#7e8d94"; c.font = "italic 25px Georgia"; c.fillText("4", x + 2 * size + 28, y + 38);
    c.font = "12px Arial"; c.fillText("2  6", x + 3 * size + 28, y + 16);
    c.textAlign = "left"; c.font = "italic 21px Georgia"; c.fillStyle = "#8d806c"; c.fillText("A little focus, every day.", 65, 728);
  });
  m.add(new THREE.PlaneGeometry(.235, .306), page, [.003, .013, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 11; i++) m.add(new THREE.TorusGeometry(.008, .0013, 5, 12, Math.PI * 1.7), metal, [-.121, .014, -.136 + i * .027], [1, 1, 1], [0, Math.PI / 2, 0]);
  const pencil = m.material("#c89145", .55), graphite = m.material("#343832", .7);
  m.limb(pencil, [.140, .0035, -.112], [.140, .0035, .072], .0035);
  m.add(new THREE.ConeGeometry(.0035, .015, 6), paper, [.140, .0035, .077], [1, 1, 1], [Math.PI / 2, 0, 0]);
  m.limb(graphite, [.140, .0035, .083], [.140, .0035, .088], .001);
  return m.finish("sudoku-notebook");
}

/** Fictional, locally typeset reading titles: no downloaded covers or brand assets. */
function readingStack() {
  const m = new Miniature(), pages = m.material("#d8cfb8", .94), pageEdge = m.material("#a69d88", .96);
  const books = [
    { title: "THE CLEAN INTERFACE", color: "#253d45", ink: "#efdfbb", width: .33, depth: .27, height: .040, offset: 0 },
    { title: "OFFLINE-FIRST WEB", color: "#ad7755", ink: "#171f23", width: .31, depth: .25, height: .034, offset: -.012 },
    { title: "CODE, TEST, REPEAT", color: "#d7cbb4", ink: "#263c40", width: .30, depth: .24, height: .032, offset: .006 },
  ];
  const atlas = print(1024, 1024, c => {
    books.forEach((book, i) => {
      c.fillStyle = book.color; c.fillRect(0, i * 96, 1024, 96);
      // A faint weave stays in the printed cloth rather than becoming extra geometry.
      c.fillStyle = "#ffffff08"; for (let x = 0; x < 1024; x += 4) c.fillRect(x, i * 96, 1, 96);
      c.fillStyle = book.ink; c.font = '500 41px "Geist", sans-serif'; c.textBaseline = "middle";
      c.fillText(book.title, 86, i * 96 + 48);
      c.font = '24px "Geist", sans-serif'; c.fillText(`0${i + 1}`, 932, i * 96 + 48);
      c.fillRect(43, i * 96 + 18, 2, 60);
    });
    c.fillStyle = books[2].color; c.fillRect(0, 320, 1024, 704);
    c.fillStyle = books[2].ink; c.textBaseline = "alphabetic"; c.font = '24px "Geist", sans-serif';
    c.fillText("THE WORKING LIBRARY   /   03", 90, 413);
    c.fillRect(90, 449, 844, 2);
    c.font = '400 102px "Newsreader", Georgia, serif';
    c.fillText("Code, test,", 90, 616); c.fillText("repeat.", 90, 721);
    c.font = '28px "Geist", sans-serif'; c.fillText("Thoughtful tools. Better questions.", 90, 901);
  });
  const panel = (width: number, height: number, y0: number, y1: number, position: V3, rotation: V3 = [0, 0, 0]) => {
    const geometry = new THREE.PlaneGeometry(width, height), uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - y1 / 1024 + uv.getY(i) * (y1 - y0) / 1024);
    m.add(geometry, atlas, position, [1, 1, 1], rotation);
  };
  let bottom = 0;
  books.forEach((book, i) => {
    const cloth = m.material(book.color, .81), x = book.offset, h = book.height;
    m.box(cloth, [x, bottom + .002, 0], [book.width, .004, book.depth]);
    m.box(pages, [x + .002, bottom + h / 2, -.004], [book.width - .012, h - .008, book.depth - .012]);
    m.box(cloth, [x, bottom + h - .002, 0], [book.width, .004, book.depth]);
    m.box(cloth, [x, bottom + h / 2, book.depth / 2 - .003], [book.width, h, .006]);
    panel(book.width - .001, h - .003, i * 96, (i + 1) * 96, [x, bottom + h / 2, book.depth / 2 + .0002]);
    for (let line = 0; line < 4; line++) m.box(pageEdge, [x + book.width / 2 - .004, bottom + .009 + line * (h - .018) / 3, -.004], [.0006, .0006, book.depth - .016]);
    if (i === 2) panel(book.width - .005, book.depth - .005, 320, 1024, [x, bottom + h + .0002, 0], [-Math.PI / 2, 0, 0]);
    bottom += h;
  });
  m.box(m.material("#8b3f31", .85), [.08, bottom - .004, -.09], [.013, .001, .09]);
  return m.finish("reading-book-stack");
}

function useMiniature(build: () => THREE.Group) {
  const object = useMemo(build, [build]);
  useEffect(() => () => object.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material as THREE.MeshStandardMaterial;
      material.map?.dispose(); material.dispose();
    }
  }), [object]);
  return object;
}

export default function DeskAccessories() {
  const board = useMiniature(chessboard), cat = useMiniature(luckyCat), notebook = useMiniature(sudoku), books = useMiniature(readingStack);
  return <group name="personal-desk-accessories">
    <primitive object={board} position={[1.70, .79, .04]} rotation={[0, -.055, 0]} />
    <primitive object={books} position={[3.40, .79, -.22]} rotation={[0, -.08, 0]} scale={.9} />
    <primitive object={cat} position={[2.97, .798, -.265]} rotation={[0, -.18, 0]} />
    <primitive object={notebook} position={[2.98, .798, .05]} rotation={[0, -.09, 0]} scale={.9} />
  </group>;
}
