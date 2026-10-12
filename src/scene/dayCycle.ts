export const CYCLE_SECONDS = 24;
export type DayPhase = "night" | "dawn" | "day" | "sunset";
export type DayCycleState = { phase: DayPhase; daylight: number; warmth: number; cycle: number; progress: number };

const smooth = (value: number) => value * value * (3 - 2 * value);

/** Pure, continuous lo-fi color script. Night rests across the wrap point;
 * dawn and sunset ease in/out instead of stepping between theme colors. */
export function sampleDayCycle(elapsed: number, override?: string | null): DayCycleState {
  const safeTime = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const time = safeTime % CYCLE_SECONDS;
  const base = { cycle: Math.floor(safeTime / CYCLE_SECONDS), progress: time / CYCLE_SECONDS };
  if (override === "day") return { ...base, phase: "day", daylight: 1, warmth: 0 };
  if (override === "night") return { ...base, phase: "night", daylight: 0, warmth: 0 };
  if (override === "dawn") return { ...base, phase: "dawn", daylight: .5, warmth: .65 };
  if (override === "sunset") return { ...base, phase: "sunset", daylight: .5, warmth: .9 };
  if (time < 4 || time >= 21) return { ...base, phase: "night", daylight: 0, warmth: 0 };
  if (time < 9) {
    const t = (time - 4) / 5;
    return { ...base, phase: "dawn", daylight: smooth(t), warmth: Math.sin(t * Math.PI) ** 2 * .65 };
  }
  if (time < 15) return { ...base, phase: "day", daylight: 1, warmth: 0 };
  const t = (time - 15) / 6;
  return { ...base, phase: "sunset", daylight: 1 - smooth(t), warmth: Math.sin(t * Math.PI) ** 2 * .9 };
}
