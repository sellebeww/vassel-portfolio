import { Component, Suspense, createContext, lazy, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { achievementPreviews, achievements, cameraStops, chapterTitle, developmentPractices, experiencePhotos, experiences, githubUser, languageFallback, profile, projectShowcase, projectTools, resolveChapterId, showcaseWindow, stackGroups, type ChapterId } from "./data/portfolio";

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
 * shows one at a time; the simple version lists them all with their first screenshot. */
function ProjectCard({ project, now, image = false, detailsOpen, onDetails }: { project: ShownProject; now: number; image?: boolean; detailsOpen?: boolean; onDetails?: (open: boolean) => void }) {
  const meta = [project.language, project.pushedAt && `updated ${timeAgo(project.pushedAt, now)}`].filter(Boolean).join(" · ");
  const details = useRef<HTMLDetailsElement>(null), [expanded, setExpanded] = useState(false);
  return <article className="project-note" data-live={project.live ? "true" : "false"}>
    {/* Simple version: while a project is open, Close follows the scroll and stays until the card ends. */}
    {image && expanded && <button type="button" className="project-close" onClick={() => { if (details.current) details.current.open = false; }}>Close <span aria-hidden="true">✕</span></button>}
    <span className="project-kind">{[project.kind, project.context].filter(Boolean).join(" · ")}</span>
    <h3>{project.title}</h3>
    {image && <img className="project-shot" src={project.shots[0]} alt={project.alt} loading="lazy" />}
    <p>{project.problem ?? project.summary}</p>
    <details ref={details} className="project-details" open={detailsOpen} onToggle={event => { setExpanded(event.currentTarget.open); onDetails?.(event.currentTarget.open); }}><summary>Implementation & evidence <span aria-hidden="true">+</span></summary><p>{project.summary}</p>
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

/** The visitor's choice between the 3D room and the simple version is remembered, and `?view=simple|3d` sets it for a link.
 * Automated runs (`?qa`) never read or write it, so scripted browsers always start in the room. */
const VIEW_KEY = "vg-view";
const qaRun = new URLSearchParams(window.location.search).has("qa");
function preferredView(): "simple" | "3d" | null {
  if (qaRun) return null;
  try {
    const asked = new URLSearchParams(window.location.search).get("view") ?? window.localStorage.getItem(VIEW_KEY);
    if (asked === "simple" || asked === "3d") return asked;
  } catch { /* storage is optional */ }
  // No stated choice: Data Saver or a device with 2 GB of memory or less starts on the light version (the 3D room is ~4 MB).
  const hints = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return hints.connection?.saveData || (hints.deviceMemory !== undefined && hints.deviceMemory <= 2) ? "simple" : null;
}
function rememberView(view: "simple" | "3d") { if (!qaRun) try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* storage is optional */ } }

/** The simple version filters the project grid by what each project is, read from its own `kind`. */
const projectGroup = (project: { kind: string }) => /android/i.test(project.kind) ? "Android" : /game/i.test(project.kind) ? "Games" : /machine/i.test(project.kind) ? "AI & ML" : "Web";
const FIRST_PROJECTS = 6;

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
  const [readingView, setReadingView] = useState(() => preferredView() === "simple");
  const [projectFilter, setProjectFilter] = useState("All");
  const [allProjects, setAllProjects] = useState(false);
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
  // The simple version is read at the visitor's pace: nothing in it advances on its own.
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
    rememberView(readingView ? "3d" : "simple");
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

  // Scroll scrubbing. The camera follows the scroll position directly (eased in the scene), so the animation stops
  // exactly where the visitor stops and continues when they scroll again. Nothing snaps or pulls back. The only
  // scripted movement is the glide a chapter link or number key starts; any wheel, touch or key press takes over from it.
  useEffect(() => {
    if (!ready || sceneFailed) return;
    // A critically damped spring drives the scroll position. Longer trips get a softer spring so the camera
    // does not whip through the room (about 1.2 s to a neighbouring chapter, up to about 2 s across the room).
    let frame = 0, position = 0, velocity = 0, target: number | null = null, omega = 6, last = 0;
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
      if (reducedMotion) { stopGlide(); window.scrollTo({ top: to, behavior: "instant" }); return; }
      if (!frame) { position = window.scrollY; velocity = 0; last = performance.now(); frame = window.requestAnimationFrame(step); }
      target = to;
      omega = clamp(6.4 - .45 * Math.max(0, Math.abs(to - position) / window.innerHeight - 1.2), 3.6, 6.4);
    };
    glideTo.current = glide;
    const interrupt = () => { if (frame) stopGlide(); };
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => {
      stopGlide(); glideTo.current = null;
      window.removeEventListener("wheel", interrupt); window.removeEventListener("touchstart", interrupt); window.removeEventListener("keydown", interrupt);
    };
  }, [ready, sceneFailed, reducedMotion]);

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
  const topLanguage = Math.max(1, ...languages.map(item => item.count));
  const projectGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of shown) counts.set(projectGroup(project), (counts.get(projectGroup(project)) ?? 0) + 1);
    return [["All", shown.length] as const, ...Array.from(counts).sort((a, b) => b[1] - a[1])];
  }, [shown]);
  const filteredProjects = projectFilter === "All" ? shown : shown.filter(project => projectGroup(project) === projectFilter);
  const visibleProjects = allProjects || projectFilter !== "All" ? filteredProjects : filteredProjects.slice(0, FIRST_PROJECTS);
  const hiddenProjects = filteredProjects.length - visibleProjects.length;

  // Simple version: blocks rise in as they scroll into view. Content is visible by default; the hidden start state only
  // exists while this effect is running (`data-reveal`), so no script or reduced motion means no hidden content.
  useEffect(() => {
    if (!sceneFailed || reducedMotion || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-in"); observer.unobserve(entry.target); }
    }), { rootMargin: "0px 0px -6% 0px" });
    root.dataset.reveal = "on";
    document.querySelectorAll<HTMLElement>(".is-fallback .chapter-card > *:not(.fallback-notice), .is-fallback .project-grid > li, .is-fallback .certificate-grid > li, .is-fallback .stack-groups > li, .is-fallback .language-bars > li").forEach((element, order) => {
      if (element.classList.contains("is-in")) return;
      element.style.transitionDelay = `${(order % 3) * 70}ms`; observer.observe(element);
    });
    return () => { observer.disconnect(); delete root.dataset.reveal; };
  }, [sceneFailed, reducedMotion, projectFilter, allProjects, languages]);
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
    { id: "open-resume", group: "Open", label: "Résumé", hint: "Download CV, print or save as PDF", keywords: "cv resume curriculum download print pdf", run: () => openOverlay({ kind: "resume" }) },
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
      {!sceneFailed && <div className="scene-layer" aria-hidden="true">
        <SceneBoundary onFailure={() => setSceneFailed(true)} fallback={<button className="scene-error" onClick={() => setSceneFailed(true)}>Open accessible view</button>}>
          <Suspense fallback={null}><RoomCanvas contactSurface={contactSurface} onContactEntered={setContactEntered} progress={progress} active={active} reducedMotion={reducedMotion} paused={modalOpen || contactEntered} projectionPaused={experienceShowcase.paused} projectIndex={focus} projectPaused={projectShowcaseTour.paused && active === "projects"} experienceIndex={experienceShowcase.index} achievementIndex={awardShowcase.index} onSelectExperience={experienceShowcase.select} onSelectAchievement={awardShowcase.select} onOpenExperience={openExperiencePhoto} onOpenAchievements={index => openOverlay({ kind: "certificates", initial: index })} atmosphere={lightingOverride} languages={languages} onProgress={setLoadPercent} onReady={onReady} /></Suspense>
        </SceneBoundary>
      </div>}
      {!sceneFailed && !loaderGone && <div className={`loading-room ${opened ? "is-done" : ""}`} role="status">
        <div className="loading-inner">
          <p className="loading-kicker" aria-hidden="true">Portfolio · {new Date().getFullYear()}</p>
          <p className="loading-name" aria-hidden="true">Vassel <em>Goleyu</em></p>
          <p className="loading-role" aria-hidden="true">{profile.role}</p>
          {/* Real asset progress from the 3D loader; the bar eases between reports so it never jumps. */}
          <div className="loading-meter" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(.03, shownPercent / 100)})` }} /></div>
          {/* Counts 1 → 100: it starts at 1 the moment the loader shows and only reads 100 once the room is open. */}
          <span className="loading-sub">{opened ? "The room is ready" : ready ? "Lighting the room" : ["Opening the room", "Hanging the certificates", "Setting up the desk", "Switching on the monitors"][Math.min(3, Math.floor(shownPercent / 25))]} <b>{opened ? 100 : clamp(Math.floor(shownPercent), 1, 99)}%</b></span>
          {/* The way out is offered from the first second, not only after a stall: the room is a big download. */}
          <div className={`loading-choice ${slowLoad && !ready ? "is-slow" : ""}`}>
            <span>{slowLoad && !ready ? "The room is taking longer than usual." : "Slow connection, or just want the content?"}</span>
            <button type="button" onClick={toggleReadingView}>Open the simple version <i aria-hidden="true">→</i></button>
          </div>
        </div>
      </div>}
      {!sceneFailed && <div className="scene-shade" aria-hidden="true" />}
      {!sceneFailed && <div className="grain" aria-hidden="true" />}
      {!sceneFailed && <CursorLabel />}

      <header className="topbar">
        <button className="wordmark" onClick={() => goTo("intro")} aria-label="VG. Back to the room">VG<span>.</span></button>
        <nav ref={navigation} aria-label="Portfolio chapters">
          {cameraStops.map((stop, index) => <button key={stop.id} aria-label={stop.label} data-n={String(index + 1).padStart(2, "0")} aria-current={active === stop.id ? "step" : undefined} className={active === stop.id ? "active" : ""} onClick={() => goTo(stop.id)}><span>{stop.label}</span></button>)}
        </nav>
        <a className="topbar-contact" href={`mailto:${profile.email}`}>Let’s talk <span aria-hidden="true">↗</span></a>
      </header>

      <div className="progress-rail" ref={rail} aria-hidden="true"><span /></div>

      {/* Wayfinding: where you are in the six chapters. The scroll cue only matters before the first scroll. */}
      <div className="room-caption" aria-hidden="true"><span><b className="live-dot" />{String(chapterNumber).padStart(2, "0")} / {String(cameraStops.length).padStart(2, "0")} — {cameraStops[Math.max(0, chapterNumber - 1)].label}</span><span className="scroll-cue">Scroll <i>↓</i></span></div>
      <aside className="dock" aria-label="Site tools">
        <button className="dock-menu" data-key={isMac ? "⌘K" : "Ctrl K"} onClick={() => setPaletteOpen(true)} aria-label="Menu, command palette" aria-keyshortcuts="Control+K Meta+K"><span>Menu</span></button>
        {!sceneError && <button data-view="reading" aria-pressed={readingView} onClick={toggleReadingView}>{readingView ? "3D version" : "Simple version"}</button>}
        {ambience.current.supported && <button onClick={() => void onToggleSound()} aria-pressed={soundOn} className="dock-sound"><span aria-hidden="true">♪</span><span>Music {soundOn ? "on" : "off"}</span></button>}
      </aside>
      <div className="sr-only" role="status" aria-live="polite">{`Chapter ${chapterNumber} of ${cameraStops.length}: ${cameraStops[Math.max(0, chapterNumber - 1)].label}`}</div>
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>

      <ChapterContext.Provider value={{ active, fallback: sceneFailed }}><main>
        <Chapter id="intro" side="right">
          {sceneFailed && <><p className="fallback-notice" role="status">{readingView ? <>Simple version: the same work, lighter and faster. <button type="button" onClick={toggleReadingView}>Switch to the 3D room</button></> : "3D is unavailable on this device. All portfolio content is available below."}</p><img className="fallback-portrait" src="/images/profile/vassel.webp" alt="Vassel Goleyu in his navy university blazer" /></>}
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
          {/* In the room the cabinet beside the card shows the certificates in 3D; the simple version lays all of them out. */}
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
          {sceneFailed ? <>
            <div className="filter-row" role="group" aria-label="Filter projects">{projectGroups.map(([group, count]) => <button key={group} aria-pressed={projectFilter === group} onClick={() => { setProjectFilter(group); setAllProjects(false); }}>{group}<small>{count}</small></button>)}</div>
            <ul className="project-grid" aria-label="Selected projects">{visibleProjects.map(project => <li key={project.repo}><ProjectCard project={project} now={now} image /></li>)}</ul>
            {hiddenProjects > 0 && <button className="show-more" onClick={() => setAllProjects(true)}>Show all {filteredProjects.length} projects <span aria-hidden="true">↓</span></button>}
          </>
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
          <p>The languages across my public projects, the frameworks those projects name, and the full-stack toolkit from my roles and projects.</p>
          <ul className="language-bars" aria-label="Primary languages on GitHub">{languages.slice(0, 6).map(item => <li key={item.language} style={{ "--share": item.count / topLanguage } as CSSProperties}><span>{item.language}</span><i aria-hidden="true" /><small>{item.count}</small></li>)}</ul>
          <ul className="tool-list" aria-label="Frameworks and tools named in the projects">{projectTools.map(tool => <li key={tool}>{tool}</li>)}</ul>
          <ul className="stack-groups" aria-label="Toolkit by kind of work">{stackGroups.map(group => <li key={group.id}><b>{group.label}</b><span>{group.items.join(" · ")}</span></li>)}</ul>
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
