import type { ChapterId } from "../data/portfolio";

/** Everything the app can show over the room that also deserves a shareable address. */
export type Overlay =
  | { kind: "role"; id: string; photo: number }
  | { kind: "roles" }
  | { kind: "certificates"; initial: number | null }
  | { kind: "project" }
  | { kind: "repos" }
  | { kind: "resume" };

const int = (value: string | undefined) => { const n = Number(value); return Number.isInteger(n) ? n : NaN; };

/** `#role/<id>[/<photo>]`, `#certificate/<n>`, `#roles`, `#certificates`, `#project`, `#repos`, `#resume`.
 * Photos and certificates are 1-based in the address; indexes are 0-based in the app. */
export function parseOverlay(hash: string, roleIds: readonly string[], certificateCount: number, photoCounts: Record<string, number> = {}): Overlay | null {
  const [head, a, b] = hash.replace(/^#/, "").split("/");
  switch (head) {
    case "role": {
      if (!a || !roleIds.includes(a)) return null;
      const count = photoCounts[a] ?? 1, photo = int(b) - 1;
      return { kind: "role", id: a, photo: photo >= 0 && photo < count ? photo : 0 };
    }
    case "certificate": {
      const index = int(a) - 1;
      return index >= 0 && index < certificateCount ? { kind: "certificates", initial: index } : null;
    }
    case "roles": return { kind: "roles" };
    case "certificates": return { kind: "certificates", initial: null };
    case "project": return { kind: "project" };
    case "repos": return { kind: "repos" };
    case "resume": return { kind: "resume" };
    default: return null;
  }
}

export function overlayHash(overlay: Overlay): string {
  switch (overlay.kind) {
    case "role": return `#role/${overlay.id}${overlay.photo > 0 ? `/${overlay.photo + 1}` : ""}`;
    case "certificates": return overlay.initial === null ? "#certificates" : `#certificate/${overlay.initial + 1}`;
    case "roles": return "#roles";
    case "project": return "#project";
    case "repos": return "#repos";
    case "resume": return "#resume";
  }
}

/** The chapter whose camera view is the natural backdrop for an overlay opened from a link. */
export function overlayChapter(overlay: Overlay): ChapterId | null {
  switch (overlay.kind) {
    case "role": case "roles": return "experience";
    case "certificates": return "achievements";
    case "project": case "repos": return "projects";
    case "resume": return null;
  }
}
