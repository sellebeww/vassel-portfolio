import { cameraStops } from "../data/portfolio";

export const contactEntry = .98;

/** The scroll bar is shorter than the timeline. Once the project photos have held, the timeline jumps
 * straight from JUMP_FROM to JUMP_TO, so the visitor goes from the photos directly into the zoom toward
 * the laptop with no empty stretch in between. `.site` in
 * styles.css is sized for this: 100vh + 795vh * (1 - (JUMP_TO - JUMP_FROM)). */
export const JUMP_FROM = .53, JUMP_TO = .70;
const KEEP = 1 - (JUMP_TO - JUMP_FROM);
/** Raw scroll fraction (0..1 of the scroll bar) to journey progress (0..1 of the timeline). */
export const journeyAt = (scroll: number) => { const x = Math.max(0, Math.min(1, scroll)); return x < JUMP_FROM / KEEP ? x * KEEP : x * KEEP + (JUMP_TO - JUMP_FROM); };
/** Inverse of `journeyAt`: where on the scroll bar a journey position lives. */
export const scrollAt = (journey: number) => {
  if (journey <= JUMP_FROM) return Math.max(0, journey / KEEP);
  // Landing exactly on JUMP_TO is nudged a hair past the jump so the chapter that starts there is already active.
  return Math.min(1, (Math.max(journey, JUMP_TO) - (JUMP_TO - JUMP_FROM)) / KEEP + (journey - JUMP_TO < 1e-6 ? .0005 : 0));
};
/** Where scrolling comes to rest, as journey positions: one per chapter, at the pose where its camera has
 * arrived. Tech Stack rests in the middle of its close hold (.745-.83) so both boards are up; Contact rests
 * on the laptop screen, the same place the nav takes you. */
export const snapStops = [0, .14, .29, .43, .785, .99] as const;
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export const ease = (n: number) => { const t = clamp(n); return t * t * t * (t * (t * 6 - 15) + 10); };
export const range = (p: number, from: number, to: number) => ease((p - from) / (to - from));
/** Project screenshots are on the monitors as soon as the desk arrives and stay there for the rest of the journey. */
export const projectReveal = (p: number) => range(p, .38, .42);
/** The language boards stand beside the laptop once the camera has come in close, and leave as the Contact page takes the screen. */
export const stackReveal = (p: number) => range(p, .73, .745) * (1 - range(p, .83, .85));

type V3 = [number, number, number];
type Frame = { at: number; position: V3; target: V3; fov: number; offset: number; vertical: number };

/** Continuous scroll choreography. A held desk establishing shot opens the
 * projects; the final camera follows the actual tilted laptop normal. */
/** The desk view zooms in a little on wide screens, but never so far that the outer monitors leave the frame:
 * the horizontal half-width it must show (tan(fov/2) * aspect) stays at what the 44° view shows on a 1.44 window. */
const DESK_HALF_WIDTH = Math.tan(22 * Math.PI / 180) * 1.44;
export const deskFov = (aspect: number) => clamp(2 * Math.atan(DESK_HALF_WIDTH / aspect) * 180 / Math.PI, 40, 44);

export function journeyFrames(mobile: boolean, aspect = 1.44): Frame[] {
  const frames: Frame[] = [];
  for (const stop of cameraStops.slice(0, 4)) {
    const frame = { at: stop.start, position: mobile ? stop.mobilePosition : stop.position,
      target: mobile && stop.mobileTarget ? stop.mobileTarget : stop.target,
      fov: mobile ? stop.mobileFov : stop.id === "projects" ? deskFov(aspect) : stop.fov, offset: mobile ? 0 : stop.id === "projects" ? .065 : .18, vertical: mobile ? (stop.id === "intro" ? .15 : .19) : 0 };
    frames.push(frame);
    const hold = stop.id === "intro" ? .078 : stop.id === "experience" ? .228 : stop.id === "achievements" ? .365 : .473;
    frames.push({ ...frame, at: hold });
  }
  // The front-of-desk POV holds while the photos show; at JUMP_TO the zoom toward the laptop starts at once.
  const desk = frames[frames.length - 1];
  frames.push({ ...desk, at: JUMP_TO });
  const target: V3 = [2.45, .991, 1.282], fov = mobile ? 48 : 39;
  // The portrait viewport is narrow, so its close hold sits further back to keep the laptop and both boards in frame.
  const approach: V3 = mobile ? [2.45, 1.75, 4.6] : [2.45, 1.36, 2.90], close: V3 = mobile ? [2.45, 1.52, 3.85] : [2.45, 1.268, 2.514];
  frames.push({ at: .725, position: approach, target, fov, offset: 0, vertical: 0 });
  // A hold close to the laptop while the language boards stand either side of it.
  frames.push({ at: .745, position: close, target, fov, offset: 0, vertical: 0 });
  frames.push({ at: .83, position: close, target, fov, offset: 0, vertical: 0 });
  frames.push({ at: .90, position: [2.45, 1.13, 1.935], target, fov, offset: 0, vertical: 0 });
  frames.push({ at: .97, position: [2.45, 1.025, 1.44], target, fov, offset: 0, vertical: 0 });
  frames.push({ at: 1, position: [2.45, 1.025, 1.44], target, fov, offset: 0, vertical: 0 });
  return frames;
}

export function sampleJourney(p: number, frames: Frame[]) {
  let i = 0;
  while (i < frames.length - 2 && p >= frames[i + 1].at) i++;
  const a = frames[i], b = frames[i + 1], t = range(p, a.at, b.at);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return { position: a.position.map((x, j) => lerp(x, b.position[j])) as V3,
    target: a.target.map((x, j) => lerp(x, b.target[j])) as V3,
    fov: lerp(a.fov, b.fov), offset: lerp(a.offset, b.offset), vertical: lerp(a.vertical, b.vertical) };
}

/** CSS projective mapping: one live HTML surface remains attached to the four
 * real screen corners, then expands to the viewport without remounting. */
export function screenMatrix(points: { x: number; y: number }[], width: number, height: number) {
  const [a, b, c, d] = points;
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < .00001) return "none";
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  const matrix = [(b.x-a.x+g*b.x)/width, (b.y-a.y+g*b.y)/width, 0, g/width,
    (d.x-a.x+h*d.x)/height, (d.y-a.y+h*d.y)/height, 0, h/height, 0,0,1,0, a.x,a.y,0,1];
  return `matrix3d(${matrix.join(",")})`;
}
