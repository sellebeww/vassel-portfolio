import { Component, Suspense, createContext, lazy, type ErrorInfo, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useShowcase } from "./useShowcase";
import { useRepos } from "./useRepos";
import ContactInterface from "./ContactInterface";
import CommandPalette from "./CommandPalette";
import { AchievementGallery, AllExperiences, ExperienceDetail, ProjectInfo, ReposArchive, Resume } from "./Overlays";
import { Ambience } from "./lib/ambience";
import CursorLabel from "./CursorLabel";
import { clamp, journeyAt, scrollAt, snapStops } from "./scene/journey";
import { overlayChapter, overlayHash, parseOverlay, type Overlay } from "./lib/deeplink";
import { languageStats, timeAgo } from "./lib/github";
import type { PaletteCommand } from "./lib/palette";
const RoomCanvas = lazy(() => import("./scene/RoomScene"));
import { achievementPreviews, achievements, cameraStops, chapterTitle, developmentPractices, experiencePhotos, experiences, githubUser, languageFallback, profile, projectShowcase, projectTools, resolveChapterId, showcaseWindow, techStack, type ChapterId } from "./data/portfolio";

/** The projector opens on the developer role (the one a visitor arriving from "Full-stack developer" is
 * looking for); the slideshow then runs through all ten roles in their usual order. */
const FIRST_TECH_PHOTO = Math.max(0, experiencePhotos.findIndex(photo => photo.experience.focus === "Technology"));

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("3D scene failed", error, info); this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const ChapterContext = createContext<{ active: ChapterId; fallback: boolean }>({ active: "intro", fallback: false });
function Chapter({ id, children }: { id: ChapterId; side?: "left" | "right"; children: ReactNode }) {
  const { active, fallback } = useContext(ChapterContext), visible = active === id || fallback;
  return <section id={id} data-chapter={id} aria-hidden={!visible} inert={!visible} className={`chapter ${visible ? "is-active" : ""}`}><div className="chapter-card">{children}</div></section>;
}

function ShowcaseControls({ name, showcase, count }: { name: string; showcase: ReturnType<typeof useShowcase>; count: number }) {
  return <div className="showcase-controls" aria-label={`${name} showcase controls`}>
    <button aria-label={`Previous ${name}`} onClick={() => showcase.select(showcase.index - 1)}>←</button>
    <span>{String(showcase.index + 1).padStart(2, "0")} <i>/ {String(count).padStart(2, "0")}</i></span>
    <button aria-label={`Next ${name}`} onClick={() => showcase.select(showcase.index + 1)}>→</button>
  </div>;
}

type ShownProject = (typeof projectShowcase)[number] & { live: boolean; homepage: string | null; url: string; language: string; pushedAt: string };

/** A case-study card: what kind of work, what it does, what it is built with, where to see it. The desk tour
 * shows one at a time; the reading view lists them all with their first screenshot. */
function ProjectCard({ project, now, image = false, detailsOpen, onDetails }: { project: ShownProject; now: number; image?: boolean; detailsOpen?: boolean; onDetails?: (open: boolean) => void }) {
  const meta = [project.language, project.pushedAt && `updated ${timeAgo(project.pushedAt, now)}`].filter(Boolean).join(" · ");
  return <article className="project-note" data-live={project.live ? "true" : "false"}>
    <span className="project-kind">{[project.kind, project.context].filter(Boolean).join(" · ")}</span>
    <h3>{project.title}</h3>
    {image && <img className="project-shot" src={project.shots[0]} alt={project.alt} loading="lazy" />}
    <p>{project.problem ?? project.summary}</p>
    <details className="project-details" open={detailsOpen} onToggle={event => onDetails?.(event.currentTarget.open)}><summary>Implementation & evidence <span aria-hidden="true">+</span></summary><p>{project.summary}</p>
    {(project.role || project.outcome) && <dl className="project-facts">
      {project.role && <div><dt>Role</dt><dd>{project.role}</dd></div>}
      {project.outcome && <div><dt>Result</dt><dd>{project.outcome}{project.evidence && <> <a href={project.evidence} target="_blank" rel="noreferrer" aria-label={`Read the documented implementation of ${project.title}`}>Read the build notes ↗</a></>}</dd></div>}
    </dl>}</details>
    <ul className="project-stack" aria-label="Built with">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
    <div className="project-links">
      {project.homepage && <a className="project-link is-primary" href={project.homepage} target="_blank" rel="noreferrer">Live demo <span aria-hidden="true">↗</span></a>}
      <a className="project-link project-github" href={project.url} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
    </div>
    {meta && <small className="project-meta">{meta}</small>}
  </article>;
}

/** The light follows the day cycle on its own. `?lighting=night|dawn|day|sunset` still holds one phase for screenshots and QA. */
const LIGHTING_PHASES = ["night", "dawn", "day", "sunset"] as const;
const lightingOverride = (() => { const requested = new URLSearchParams(window.location.search).get("lighting"); return LIGHTING_PHASES.find(item => item === requested) ?? null; })();

const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const SLOW_LOAD_MS = 20_000;

export default function App() {
  const progress = useRef(0);
  const contactSurface = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [contactEntered, setContactEntered] = useState(false);
  const [active, setActive] = useState<ChapterId>("intro");
  const activeRef = useRef(active);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const overlayPushed = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [soundOn, setSoundOn] = useState(false);
  const [toast, setToast] = useState("");
  const [sceneError, setSceneFailed] = useState(false);
  const [readingView, setReadingView] = useState(false);
  const sceneFailed = sceneError || readingView;
  const navigation = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const repos = useRepos();
  const ambience = useRef<Ambience | null>(null);
  if (!ambience.current) ambience.current = new Ambience();
  const onReady = useCallback(() => setReady(true), []);
  // The meter is paced: it eases toward the real loading figure at a steady, readable speed, and the curtain only lifts
  // once it has reached 100 after everything is mounted. A cached or fast load therefore still gets a calm, complete opening
  // (about three seconds) while the room compiles its shaders behind the curtain. Reduced motion skips the pacing.
  const [shownPercent, setShownPercent] = useState(0);
  const opened = ready && shownPercent >= 100;
  useEffect(() => {
    if (sceneFailed || shownPercent >= 100) return;
    if (reducedMotion) { if (ready) setShownPercent(100); return; }
    let frame = 0, last = performance.now();
    const target = () => ready ? 100 : Math.min(92, loadPercent);
    const tick = (now: number) => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      setShownPercent(value => { const goal = target(); return value >= goal ? value : Math.min(goal, value + (ready ? 38 : 26) * dt); });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ready, loadPercent, sceneFailed, reducedMotion, shownPercent >= 100]);
  const modalOpen = overlay !== null || paletteOpen;
  // The reading view is read at the visitor's pace: nothing in it advances on its own.
  const experienceShowcase = useShowcase(experiencePhotos.length, active === "experience" && !modalOpen && !sceneFailed, reducedMotion, 2500, { pauseOnHover: false }, FIRST_TECH_PHOTO);
  // The desk tour moves to the next project every 3.5 s. It holds while the details are open (they are being read),
  // while a mouse rests on the card or the picker, and for three beats after the visitor picks a project.
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const projectShowcaseTour = useShowcase(projectShowcase.length, active === "projects" && !modalOpen && !sceneFailed && !projectDetailsOpen, reducedMotion, 3500);
  const focus = projectShowcaseTour.index;
  useEffect(() => setProjectDetailsOpen(false), [focus]);
  const awardShowcase = useShowcase(achievements.length, active === "achievements" && !modalOpen && !sceneFailed, reducedMotion, 3500);
  activeRef.current = active;

  const featuredPhoto = experiencePhotos[experienceShowcase.index];
  const featured = featuredPhoto.experience;
  const filmstrip = showcaseWindow(experienceShowcase.index, experiencePhotos.length);
  const award = achievements[awardShowcase.index];
  const awardNeighbours = showcaseWindow(awardShowcase.index, achievements.length, 3);

  const notify = useCallback((message: string) => { setToast(message); }, []);
  const toggleReadingView = useCallback(() => {
    if (sceneError) return;
    if (readingView) { setReady(false); setShownPercent(0); setLoaderGone(false); }
    setReadingView(value => !value);
    document.documentElement.style.setProperty("--stack-boards", "0");
    document.documentElement.dataset.stackBoards = "off";
    window.history.replaceState(null, "", "#intro");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [readingView, sceneError]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);

  const onToggleSound = useCallback(async () => {
    const engine = ambience.current!;
    if (engine.active) { engine.disable(); setSoundOn(false); notify("Music off"); return; }
    if (await engine.enable()) { setSoundOn(true); notify("Music on"); } else notify("This browser can’t play audio");
  }, [notify]);
  useEffect(() => { const engine = ambience.current; return () => engine?.dispose(); }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);

  // Real loading progress, plus an escape hatch if the room stalls on a weak connection.
  useEffect(() => {
    if (ready || sceneFailed) return;
    const timer = window.setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [ready, sceneFailed]);

  // The preloader stays for its exit (the meter completes, then the curtain lifts) before it unmounts.
  useEffect(() => {
    if (!opened && !sceneFailed) return;
    const timer = window.setTimeout(() => setLoaderGone(true), sceneFailed || reducedMotion ? 0 : 900);
    return () => window.clearTimeout(timer);
  }, [opened, sceneFailed, reducedMotion]);

  const baseTitle = useRef(document.title);
  useEffect(() => { document.title = active === "intro" ? baseTitle.current : chapterTitle(active); }, [active]);
  useEffect(() => {
    const nav = navigation.current, item = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && item && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2, behavior: reducedMotion ? "instant" : "smooth" });
  }, [active, reducedMotion]);

  // Projects data is requested the first time anything needs it.
  useEffect(() => {
    if (["projects", "stack", "contact"].includes(active) || overlay?.kind === "repos" || overlay?.kind === "resume" || overlay?.kind === "project" || paletteOpen) repos.request();
  }, [active, overlay, paletteOpen, repos.request]);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrolled = window.scrollY / maximum, value = journeyAt(scrolled);
      progress.current = value;
      rail.current?.style.setProperty("--journey", scrolled.toFixed(4));
      const current = [...cameraStops].reverse().find((stop) => sceneFailed
        ? ((stop.id === "contact" ? contactSurface.current : document.getElementById(stop.id))?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight * .35
        : value >= stop.start - 0.002) ?? cameraStops[0];
      setActive((old) => old === current.id ? old : current.id);
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [sceneFailed]);

  // Test hook: scripts describe positions on the journey timeline and need the matching scroll fraction.
  useEffect(() => { if (new URLSearchParams(window.location.search).has("qa")) (window as unknown as { __scrollAt: typeof scrollAt }).__scrollAt = scrollAt; }, []);

  const glideTo = useRef<((y: number) => void) | null>(null);
  const scrollToChapter = useCallback((id: ChapterId, behavior: ScrollBehavior) => {
    if (sceneFailed) (id === "contact" ? contactSurface.current : document.getElementById(id))?.scrollIntoView({ behavior, block: "start" });
    else {
      const top = scrollAt(snapStops[cameraStops.findIndex(stop => stop.id === id)]) * (document.documentElement.scrollHeight - window.innerHeight);
      // The chapter glide, when it is running, so a nav click moves exactly like scrolling does.
      if (behavior === "smooth" && glideTo.current) glideTo.current(top);
      else window.scrollTo({ top, behavior });
    }
  }, [sceneFailed]);

  // Chapter paging. A wheel or trackpad gesture, or a scroll key, moves exactly one chapter: the page never
  // drifts freely and then gets pulled back, which is what made scrolling feel like it fought the visitor.
  // A trackpad's momentum tail belongs to the gesture that started it, so one flick is one chapter; a fresh
  // gesture during a glide extends it to the next chapter without stopping. Touch and the scrollbar still
  // scroll natively and then settle on a chapter in the direction they were moving.
  const contactEnteredRef = useRef(contactEntered);
  contactEnteredRef.current = contactEntered;
  useEffect(() => {
    if (!ready || sceneFailed || modalOpen || new URLSearchParams(window.location.search).has("qa")) return;
    const stops = () => { const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); return snapStops.map(p => scrollAt(p) * maximum); };

    // A critically damped spring drives the scroll position. Velocity carries over when the target changes,
    // so extending a glide never stalls or jerks. Longer trips get a softer spring so the camera does not
    // whip through the room (about 1.2 s to a neighbouring chapter, up to about 2 s across the whole room).
    let frame = 0, position = 0, velocity = 0, target: number | null = null, omega = 6, last = 0;
    let timer = 0, touching = false, direction = 0, lastY = window.scrollY;
    const stopGlide = () => { window.cancelAnimationFrame(frame); frame = 0; target = null; velocity = 0; };
    const step = (now: number) => {
      let dt = Math.min(.05, (now - last) / 1000); last = now;
      while (dt > 0 && target !== null) {
        const h = Math.min(dt, 1 / 240); dt -= h;
        velocity += (omega * omega * (target - position) - 2 * omega * velocity) * h;
        position += velocity * h;
      }
      if (target === null) return;
      const done = Math.abs(target - position) < .5 && Math.abs(velocity) < 8;
      window.scrollTo({ top: done ? target : position, behavior: "instant" });
      if (done) { frame = 0; target = null; velocity = 0; } else frame = window.requestAnimationFrame(step);
    };
    const glide = (to: number) => {
      window.clearTimeout(timer);
      if (reducedMotion) { stopGlide(); window.scrollTo({ top: to, behavior: "instant" }); return; }
      if (!frame) { position = window.scrollY; velocity = 0; last = performance.now(); frame = window.requestAnimationFrame(step); }
      target = to;
      const screens = Math.abs(to - position) / window.innerHeight;
      omega = clamp(6.4 - .45 * Math.max(0, screens - 1.2), 3.6, 6.4);
    };
    glideTo.current = glide;

    // The chapter to move from: where a running glide is heading, otherwise the stop the page rests nearest.
    const move = (steps: number) => {
      const list = stops(), from = target ?? window.scrollY;
      const resting = list.findIndex(stop => Math.abs(stop - from) <= 2), ahead = list.findIndex(stop => stop > from + 2);
      const next = ahead < 0 ? list.length : ahead, base = resting >= 0 ? resting : steps > 0 ? next - 1 : next;
      const index = clamp(base + steps, 0, list.length - 1);
      if (Math.abs(list[index] - window.scrollY) > 1 || target !== null) glide(list[index]);
    };

    // Content that scrolls on its own (a long chapter card, the contact page) keeps the wheel until its end.
    const scrollsInside = (node: EventTarget | null, dy: number) => {
      for (let element = node instanceof Element ? node : null; element && element !== document.body; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (!/(auto|scroll)/.test(style.overflowY) || element.scrollHeight <= element.clientHeight + 1) continue;
        if (dy > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0) return true;
      }
      return false;
    };

    // A trackpad's momentum tail is a stream of shrinking deltas, so it never opens a new gesture, even when a
    // heavy frame delays it: a short silence only starts a new gesture if the delta also grows again. A long
    // silence, or a sharp rise in delta during a gesture (a second flick on top of momentum), always does.
    let gestureAt = -1e9, lastWheel = -1e9, lastSize = 0, used = false, travelled = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || contactEnteredRef.current) return;
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (Math.abs(dy) < Math.abs(event.deltaX) || !dy || scrollsInside(event.target, dy)) return;
      event.preventDefault();
      const now = event.timeStamp, size = Math.abs(dy);
      const gap = now - lastWheel;
      const fresh = gap > 350 || (gap > 180 && size > lastSize * 1.3) || (used && now - gestureAt > 280 && size > 30 && size > lastSize * 2.2);
      if (fresh) { gestureAt = now; used = false; travelled = 0; }
      lastWheel = now; lastSize = size; travelled += dy;
      if (!used && Math.abs(travelled) >= 12) { used = true; move(Math.sign(travelled)); }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || contactEnteredRef.current) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, button, a, summary, [contenteditable='true']")) return;
      const key = event.key;
      const steps = key === "ArrowDown" || key === "PageDown" || (key === " " && !event.shiftKey) ? 1
        : key === "ArrowUp" || key === "PageUp" || (key === " " && event.shiftKey) ? -1
        : key === "Home" ? -snapStops.length : key === "End" ? snapStops.length : 0;
      if (!steps || scrollsInside(event.target, steps)) return;
      event.preventDefault(); move(steps);
    };

    // Touch and scrollbar drags move the page natively; once they rest, the page settles on a chapter in the
    // direction it was travelling (a push of more than 6% of the viewport moves on, less returns).
    const settle = () => {
      if (touching || target !== null || contactEnteredRef.current) return;
      const list = stops(), here = window.scrollY, push = window.innerHeight * .06;
      if (list.some(stop => Math.abs(stop - here) <= 2)) return;
      const above = list.findIndex(stop => stop > here), after = above < 0 ? list.length - 1 : above, before = clamp(after - 1, 0, list.length - 1);
      const index = direction > 0 ? (here - list[before] < push ? before : after)
        : direction < 0 ? (list[after] - here < push ? after : before)
        : (here - list[before] < list[after] - here ? before : after);
      glide(list[index]);
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (frame) { lastY = y; return; }
      if (y !== lastY) direction = Math.sign(y - lastY);
      lastY = y;
      window.clearTimeout(timer); timer = window.setTimeout(settle, 220);
    };
    const down = () => { touching = true; stopGlide(); window.clearTimeout(timer); };
    const up = () => { touching = false; window.clearTimeout(timer); timer = window.setTimeout(settle, 220); };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    window.addEventListener("touchcancel", up, { passive: true });
    return () => {
      window.clearTimeout(timer); stopGlide(); glideTo.current = null;
      window.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll); window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up); window.removeEventListener("touchcancel", up);
    };
  }, [ready, sceneFailed, modalOpen, reducedMotion]);

  // Overlays own a history entry so Back closes them and every one has a shareable address.
  const openOverlay = useCallback((next: Overlay) => {
    const url = overlayHash(next);
    if (overlayPushed.current) window.history.replaceState({ overlay: true }, "", url);
    else { window.history.pushState({ overlay: true }, "", url); overlayPushed.current = true; }
    setOverlay(next);
  }, []);
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    if (overlayPushed.current) { overlayPushed.current = false; window.history.back(); }
    else window.history.replaceState(null, "", `#${activeRef.current}`);
  }, []);
  const syncAddress = useCallback((next: Overlay) => { window.history.replaceState(window.history.state, "", overlayHash(next)); }, []);

  useEffect(() => {
    const roleIds = experiences.map(item => item.id), photoCounts = Object.fromEntries(experiences.map(item => [item.id, item.photos.length]));
    const jump = (initial: boolean) => {
      const requested = window.location.hash.slice(1);
      const link = parseOverlay(requested, roleIds, achievements.length, photoCounts);
      if (link) {
        overlayPushed.current = !initial; setOverlay(link);
        const chapter = initial ? overlayChapter(link) : null;
        if (chapter) scrollToChapter(chapter, "instant");
        return;
      }
      overlayPushed.current = false; setOverlay(null);
      const id = resolveChapterId(requested), stop = cameraStops.find(item => item.id === id);
      if (!stop) return;
      // Closing an overlay with Back returns to the chapter hash already in view: don't re-scroll.
      if (initial || stop.id !== activeRef.current) scrollToChapter(stop.id, "instant");
      if (requested !== stop.id) window.history.replaceState(null, "", `#${stop.id}`);
    };
    const timer = window.setTimeout(() => jump(true), 150);
    const onHash = () => jump(false);
    window.addEventListener("hashchange", onHash);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", onHash); };
  }, [scrollToChapter]);

  const liveRepos = repos.status === "ready" ? repos.repos : [];
  // Screenshots are fixed; GitHub (when it answers) supplies the current description, demo link and language.
  const shown = useMemo(() => projectShowcase.map(item => {
    const live = liveRepos.find(repo => repo.name.toLowerCase() === item.repo.toLowerCase());
    return { ...item, live: !!live, homepage: live?.homepage ?? item.homepage,
      url: live?.url ?? `${profile.github}/${item.repo}`, language: live?.language ?? item.language, pushedAt: live?.pushedAt ?? "" };
  }), [liveRepos]);
  const featuredProject = shown[focus];
  const languages = useMemo(() => liveRepos.length ? languageStats(liveRepos) : languageFallback, [liveRepos]);
  const goTo = useCallback((id: ChapterId) => {
    // Without the 3D camera there is nothing to glide through, so the document jumps as it always did.
    scrollToChapter(id, reducedMotion || sceneFailed ? "instant" : "smooth");
    window.history.replaceState(null, "", `#${id}`);
  }, [scrollToChapter, reducedMotion, sceneFailed]);
  const openExperiencePhoto = (index: number) => {
    const photo = experiencePhotos[index];
    openOverlay({ kind: "role", id: photo.experience.id, photo: photo.photoIndex });
  };
  const copyEmail = useCallback(async () => {
    try { await navigator.clipboard.writeText(profile.email); notify("Email address copied"); } catch { notify(profile.email); }
  }, [notify]);

  const commands: PaletteCommand[] = useMemo(() => !paletteOpen ? [] : [
    ...cameraStops.map((stop, index) => ({ id: `go-${stop.id}`, group: "Go to", label: stop.label, hint: `Chapter ${index + 1}`, shortcut: String(index + 1), run: () => goTo(stop.id) })),
    { id: "open-roles", group: "Open", label: "All university roles", hint: `${experiences.length} roles, with photos`, keywords: "experience", run: () => openOverlay({ kind: "roles" }) },
    { id: "open-certificates", group: "Open", label: "All certificates", hint: "9 achievements", keywords: "achievements awards gallery", run: () => openOverlay({ kind: "certificates", initial: null }) },
    { id: "open-repos", group: "Open", label: "Projects on GitHub", hint: "Live repository archive", keywords: "projects repositories code source", run: () => openOverlay({ kind: "repos" }) },
    { id: "open-resume", group: "Open", label: "Résumé", hint: "Print or save as PDF", keywords: "cv resume curriculum download print pdf", run: () => openOverlay({ kind: "resume" }) },
    ...(ambience.current?.supported ? [{ id: "room-sound", group: "Room", label: `Music ${soundOn ? "off" : "on"}`, hint: "Chill jazz, synthesised live in your browser", shortcut: "S", keywords: "audio music mute volume", run: onToggleSound }] : []),
    { id: "contact-copy", group: "Contact", label: "Copy email address", hint: profile.email, keywords: "mail clipboard", run: copyEmail },
    { id: "contact-mail", group: "Contact", label: "Write an email", hint: "Opens your mail app", keywords: "mailto message", run: () => { window.location.href = `mailto:${profile.email}`; } },
    { id: "contact-github", group: "Contact", label: "GitHub profile", hint: profile.github.replace("https://", ""), run: () => { window.open(profile.github, "_blank", "noopener"); } },
    { id: "contact-linkedin", group: "Contact", label: "LinkedIn profile", hint: profile.linkedin.replace("https://www.", ""), run: () => { window.open(profile.linkedin, "_blank", "noopener"); } },
    ...experiences.map(item => ({ id: `role-${item.id}`, group: "Roles", label: `${item.title} — ${item.organization}`, hint: item.period, keywords: `${item.focus} ${item.tags.join(" ")} ${item.description}`, run: () => openOverlay({ kind: "role", id: item.id, photo: 0 }) })),
    ...achievements.map(([, placement, competition, year], index) => ({ id: `certificate-${index}`, group: "Certificates", label: `${placement} — ${competition}`, hint: year, run: () => openOverlay({ kind: "certificates", initial: index }) })),
    ...liveRepos.map(repo => ({ id: `repo-${repo.name}`, group: "Projects", label: repo.name, hint: repo.language ?? "GitHub", keywords: `${repo.description} ${repo.topics.join(" ")}`, run: () => { window.open(repo.homepage ?? repo.url, "_blank", "noopener"); } })),
  ], [paletteOpen, goTo, openOverlay, soundOn, onToggleSound, copyEmail, liveRepos]);

  // One stable listener; the handler is replaced every render so it never sees stale state.
  const onKey = useRef<(event: KeyboardEvent) => void>(() => {});
  onKey.current = event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (overlay === null) setPaletteOpen(value => !value); return; }
    if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented || modalOpen) return;
    if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key.toLowerCase(), chapter = cameraStops[Number(key) - 1];
    if (key === "/" || key === "?") { event.preventDefault(); setPaletteOpen(true); }
    else if (chapter) goTo(chapter.id);
    else if (key === "s" && ambience.current?.supported) void onToggleSound();
  };
  useEffect(() => { const handler = (event: KeyboardEvent) => onKey.current(event); window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);

  const chapterNumber = cameraStops.findIndex(stop => stop.id === active) + 1;
  const now = useMemo(() => Date.now(), []);

  return (
    <div className={`site ${sceneFailed ? "is-fallback" : ""} ${opened ? "scene-ready" : ""}`} data-active={active} data-contact={contactEntered ? "inside" : "room"} data-project={focus} data-motion={reducedMotion ? "reduced" : modalOpen ? "modal" : "full"} data-sound={soundOn ? "on" : "off"}>
      <a className="skip-link" href="#intro">Skip to portfolio content</a>
      {!sceneFailed && <div className="scene-layer">
        <SceneBoundary onFailure={() => setSceneFailed(true)} fallback={<button className="scene-error" onClick={() => setSceneFailed(true)}>Open accessible view</button>}>
          <Suspense fallback={null}><RoomCanvas contactSurface={contactSurface} onContactEntered={setContactEntered} progress={progress} active={active} reducedMotion={reducedMotion} paused={modalOpen || contactEntered} projectionPaused={experienceShowcase.paused} projectIndex={focus} projectPaused={projectShowcaseTour.paused && active === "projects"} experienceIndex={experienceShowcase.index} achievementIndex={awardShowcase.index} onSelectExperience={experienceShowcase.select} onSelectAchievement={awardShowcase.select} onOpenExperience={openExperiencePhoto} onOpenAchievements={index => openOverlay({ kind: "certificates", initial: index })} atmosphere={lightingOverride} languages={languages} onProgress={setLoadPercent} onReady={onReady} /></Suspense>
        </SceneBoundary>
      </div>}
      {!sceneFailed && !loaderGone && <div className={`loading-room ${opened ? "is-done" : ""}`} role="status">
        <div className="loading-inner">
          <p className="loading-name" aria-hidden="true">Vassel <em>Goleyu</em></p>
          {/* Real asset progress from the 3D loader; the bar eases between reports so it never jumps. */}
          <div className="loading-meter" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(.03, shownPercent / 100)})` }} /></div>
          {/* Counts 1 → 100: it starts at 1 the moment the loader shows and only reads 100 once the room is open. */}
          <span className="loading-sub">{opened ? "The room is ready" : ready ? "Lighting the room" : "Opening the room"} <b>{opened ? 100 : clamp(Math.floor(shownPercent), 1, 99)}%</b></span>
          {/* The only way out of a stalled load: it appears after SLOW_LOAD_MS, never on a normal start. */}
          {slowLoad && !ready && <span className="loading-slow">The room is taking longer than usual. <button type="button" onClick={toggleReadingView}>Read without 3D</button></span>}
        </div>
      </div>}
      {!sceneFailed && <div className="scene-shade" aria-hidden="true" />}
      {!sceneFailed && <div className="grain" aria-hidden="true" />}
      {!sceneFailed && <CursorLabel />}

      <header className="topbar">
        <button className="wordmark" onClick={() => goTo("intro")} aria-label="Back to the room">VG<span>.</span></button>
        <nav ref={navigation} aria-label="Portfolio chapters">
          {cameraStops.map((stop, index) => <button key={stop.id} aria-label={stop.label} aria-current={active === stop.id ? "step" : undefined} className={active === stop.id ? "active" : ""} onClick={() => goTo(stop.id)}><small>{String(index + 1).padStart(2, "0")}</small><span>{stop.label}</span></button>)}
        </nav>
        <a className="topbar-contact" href={`mailto:${profile.email}`}>Let’s talk <span aria-hidden="true">↗</span></a>
      </header>

      <div className="progress-rail" ref={rail} aria-hidden="true"><span /></div>

      {/* Wayfinding: where you are in the six chapters. The scroll cue only matters before the first scroll. */}
      <div className="room-caption" aria-hidden="true"><span><b className="live-dot" />{String(chapterNumber).padStart(2, "0")} / {String(cameraStops.length).padStart(2, "0")} — {cameraStops[Math.max(0, chapterNumber - 1)].label}</span><span className="scroll-cue">Scroll <i>↓</i></span></div>
      <div className="dock" role="group" aria-label="Site tools">
        <button onClick={() => setPaletteOpen(true)} aria-label="Open the command palette" aria-keyshortcuts="Control+K Meta+K"><kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd><span>Menu</span></button>
        {!sceneError && <button data-view="reading" aria-pressed={readingView} onClick={toggleReadingView}>{readingView ? "Enter 3D room" : "Reading view"}</button>}
        {ambience.current.supported && <button onClick={() => void onToggleSound()} aria-pressed={soundOn} aria-label="Chill jazz music" className="dock-sound"><span aria-hidden="true">♪</span><span>Music {soundOn ? "on" : "off"}</span></button>}
      </div>
      <div className="sr-only" role="status" aria-live="polite">{`Chapter ${chapterNumber} of ${cameraStops.length}: ${cameraStops[Math.max(0, chapterNumber - 1)].label}`}</div>
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>

      <ChapterContext.Provider value={{ active, fallback: sceneFailed }}><main>
        <Chapter id="intro" side="right">
          {sceneFailed && <><p className="fallback-notice" role="status">{readingView ? "Reading view. The same work, at your own pace." : "3D is unavailable on this device. All portfolio content is available below."}</p><img className="fallback-portrait" src="/images/profile/vassel.webp" alt="Vassel Goleyu in his navy university blazer" /></>}
          <span className="chapter-number">Full-stack developer / Tangerang, ID</span>
          <h1>Vassel <em>Goleyu</em></h1>
          <p className="lead">{profile.headline}</p>
          <div className="fact-row"><span>Laravel · Kotlin · TypeScript</span><span>Informatics at UMN</span></div>
          <div className="cta-row">
            <button className="button-primary" onClick={() => goTo("projects")}>See selected work <span aria-hidden="true">→</span></button>
            <button className="text-button text-button-quiet" onClick={() => openOverlay({ kind: "resume" })}>Résumé <span>↗</span></button>
          </div>
        </Chapter>

        <Chapter id="experience" side="right">
          <span className="chapter-number">02 — Experience</span>
          <h2>Building with people.</h2>
          <div className="showcase" {...experienceShowcase.interaction}>
            {sceneFailed && <button className="experience-photo" onClick={() => openExperiencePhoto(experienceShowcase.index)} aria-label={`Enlarge ${featured.title}, photo ${featuredPhoto.photoIndex + 1}`}>
              <img key={featuredPhoto.id} src={featuredPhoto.preview} alt={`${featured.title} — ${featured.organization}`} />
            </button>}
            <article className="experience-story" key={featuredPhoto.id} data-photo={featuredPhoto.id}>
              <small className="experience-period">{featured.period}</small>
              <button className="experience-role" onClick={() => openExperiencePhoto(experienceShowcase.index)} aria-label={`Open ${featured.title}, photo ${featuredPhoto.photoIndex + 1}`}>
                <strong>{featured.title}</strong><span>{featured.organization} <i aria-hidden="true">↗</i></span>
              </button>
              <p>{featured.description}</p>
              <div className="experience-playback"><span className={experienceShowcase.playing ? "is-playing" : ""} aria-hidden="true" /><small>{experienceShowcase.playing ? "Auto slideshow" : reducedMotion || sceneFailed ? "Browse at your pace" : "Slideshow paused"} · Photo {featuredPhoto.photoIndex + 1} of {featured.photos.length}</small></div>
            </article>
            {sceneFailed && <div className="projector-filmstrip" aria-label="University photo filmstrip">
              {filmstrip.map(photoIndex => {
                const frame = experiencePhotos[photoIndex];
                return <button key={frame.id} onClick={() => experienceShowcase.select(photoIndex)} aria-current={photoIndex === experienceShowcase.index ? "true" : undefined} aria-label={`${frame.experience.organization}, photo ${frame.photoIndex + 1}`}>
                  <img src={frame.preview} alt="" loading="lazy" /><span>{String(photoIndex + 1).padStart(2, "0")}</span>
                </button>;
              })}
            </div>}
            <ShowcaseControls name="experience photo" showcase={experienceShowcase} count={experiencePhotos.length} />
            <label className="role-selector"><span>Jump to a role</span><select value={featured.id} onChange={event => experienceShowcase.select(experiencePhotos.findIndex(photo => photo.experience.id === event.target.value))}>
              {experiences.map(item => <option key={item.id} value={item.id}>{item.organization} · {item.title}</option>)}
            </select></label>
          </div>
          <button className="text-button" onClick={() => openOverlay({ kind: "roles" })}>All {experiences.length} university roles <span>↗</span></button>
        </Chapter>

        <Chapter id="achievements">
          <span className="chapter-number">03 — Achievements</span>
          <h2>A record of curiosity.</h2>
          <p className="chapter-deck">Three golds. Nine certificates.</p>
          {/* In the room the cabinet beside the card shows the certificates in 3D; the reading view lays all of them out. */}
          {sceneFailed ? <ul className="certificate-grid" aria-label="Certificates">{achievements.map(([file, placement, competition, year], index) => <li key={file}>
            <button onClick={() => openOverlay({ kind: "certificates", initial: index })} aria-label={`Enlarge ${placement}, ${competition}, ${year}`}>
              <img src={achievementPreviews[index]} alt="" loading="lazy" /><small>{year} · {competition}</small><b>{placement}</b>
            </button>
          </li>)}</ul> : <div className="showcase certificate-showcase" {...awardShowcase.interaction}>
            <div className="award-summary" key={award[0]}><small>{award[3]} · {award[2]}</small><b>{award[1]}</b></div>
            <ShowcaseControls name="certificate" showcase={awardShowcase} count={achievements.length} />
          </div>}
          {!sceneFailed && <button className="text-button" aria-label={`Enlarge ${award[1]}, ${award[2]}, ${award[3]}`} onClick={() => openOverlay({ kind: "certificates", initial: awardShowcase.index })}>View this certificate <span>↗</span></button>}
          <button className="text-button text-button-quiet" data-modal="achievements" onClick={() => openOverlay({ kind: "certificates", initial: null })}>All {achievements.length} certificates <span>↗</span></button>
        </Chapter>

        <Chapter id="projects" side="right">
          <span className="chapter-number">04 — Projects</span>
          <h2>Selected work.</h2>
          <p className="chapter-deck">Web, Android, and small worlds to explore.</p>
          {sceneFailed ? <ul className="project-grid" aria-label="Selected projects">{shown.map(project => <li key={project.repo}><ProjectCard project={project} now={now} image /></li>)}</ul>
          : <div className="project-tour" {...projectShowcaseTour.interaction}>
            <div className="project-picker">
              <label><span className="sr-only">Choose a project</span><select value={focus} onChange={event => projectShowcaseTour.select(Number(event.target.value))}>{shown.map((project, i) => <option key={project.repo} value={i}>{String(i + 1).padStart(2, "0")} / {project.title}</option>)}</select></label>
              <button aria-label="Previous project" onClick={() => projectShowcaseTour.select(focus - 1)}>←</button>
              <button aria-label="Next project" onClick={() => projectShowcaseTour.select(focus + 1)}>→</button>
              {/* Time until the next project. It restarts with every change and empties while the tour holds. */}
              <span className="project-timer" aria-hidden="true"><i key={`${focus}-${projectShowcaseTour.playing}`} className={projectShowcaseTour.playing ? "is-running" : ""} style={{ animationDuration: `${projectShowcaseTour.delay}ms` }} /></span>
            </div>
            <ProjectCard key={featuredProject.repo} project={featuredProject} now={now} detailsOpen={projectDetailsOpen} onDetails={setProjectDetailsOpen} />
          </div>}
          <button className="text-button text-button-quiet" onClick={() => openOverlay({ kind: "repos" })}>{liveRepos.length ? `All ${liveRepos.length} repositories` : "Projects on GitHub"} <span>↗</span></button>
          {!sceneFailed && <button className="text-link" onClick={() => openOverlay({ kind: "project" })}>About these screens</button>}
        </Chapter>

        <Chapter id="stack" side="right">
          <span className="chapter-number">05 — Tech stack</span>
          <h2>What I build with.</h2>
          <p>The languages across my public projects, the frameworks those projects name, and the web stack from my developer role at UMN Medical Center.</p>
          <ul className="language-chips" aria-label="Primary languages on GitHub">{languages.slice(0, 6).map(item => <li key={item.language}>{item.language}<small>{item.count}</small></li>)}</ul>
          <ul className="tool-list" aria-label="Frameworks and tools named in the projects">{projectTools.map(tool => <li key={tool}>{tool}</li>)}</ul>
          <dl className="stack-notes">{techStack.map(tool => <div key={tool.id}>
            <dt>{tool.name}<span>{tool.category}</span></dt><dd>{tool.detail}</dd>
          </div>)}</dl>
          <ul className="practice-list" aria-label="Development practices">{developmentPractices.map(practice => <li key={practice}>{practice}</li>)}</ul>
          <span className="quiet-note">Next — the laptop opens into a contact page</span>
        </Chapter>

        <Chapter id="contact" side="right"><h2 className="sr-only">Contact</h2></Chapter>
      </main></ChapterContext.Provider>

      <ContactInterface surface={contactSurface} entered={contactEntered || sceneFailed} onBack={() => goTo("projects")} />

      {overlay?.kind === "role" && (() => {
        const item = experiences.find(role => role.id === overlay.id)!;
        return <ExperienceDetail key={item.id} item={item} initialPhoto={overlay.photo} onClose={closeOverlay} onPhoto={photo => syncAddress({ kind: "role", id: item.id, photo })} />;
      })()}
      {overlay?.kind === "roles" && <AllExperiences onClose={closeOverlay} onSelect={item => openOverlay({ kind: "role", id: item.id, photo: 0 })} />}
      {overlay?.kind === "certificates" && <AchievementGallery initial={overlay.initial} onClose={closeOverlay} onSelect={index => syncAddress({ kind: "certificates", initial: index })} />}
      {overlay?.kind === "repos" && <ReposArchive state={repos} onClose={closeOverlay} />}
      {overlay?.kind === "resume" && <Resume repos={liveRepos} onClose={closeOverlay} />}
      {overlay?.kind === "project" && <ProjectInfo title={featuredProject.title} detail={featuredProject.summary} url={featuredProject.url} onClose={closeOverlay} />}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
