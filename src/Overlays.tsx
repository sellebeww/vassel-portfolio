import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { achievementField, achievementFields, achievements, developmentPractices, experiences, profile, techStack, type AchievementField, type Experience } from "./data/portfolio";
import { filterRepos, languageStats, timeAgo, type Repo } from "./lib/github";
import { resumeText } from "./lib/resume";
import type { RepoState } from "./useRepos";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

export function Modal({ title, eyebrow = "Field notes", wide = false, onClose, children }: { title: string; eyebrow?: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null), shell = useRef<HTMLDivElement>(null);
  // Held in a ref: the caller passes a fresh closure every render, and re-running the effect
  // would steal focus back to Close and record Close itself as the element to restore.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // Everything behind the dialog leaves the tab order and the accessibility tree.
    const background = Array.from(document.querySelectorAll<HTMLElement>(".site > :not(.modal-shell)")).filter(element => !element.inert);
    background.forEach(element => { element.inert = true; });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close.current(); }
      if (event.key === "Tab" && shell.current) {
        const controls = Array.from(shell.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.offsetParent !== null);
        const first = controls[0], last = controls.at(-1);
        if (!controls.length) event.preventDefault();
        else if (event.shiftKey && (document.activeElement === first || !shell.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !shell.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", onKey); document.body.classList.remove("modal-open");
      background.forEach(element => { element.inert = false; });
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div ref={shell} className="modal-shell" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "is-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><span className="eyebrow">{eyebrow}</span><button ref={closeRef} className="icon-button no-print" onClick={onClose} aria-label="Close detail">Close</button></header>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function ExperienceDetail({ item, initialPhoto = 0, onClose, onPhoto }: { item: Experience; initialPhoto?: number; onClose: () => void; onPhoto?: (index: number) => void }) {
  const [photo, setPhoto] = useState(initialPhoto);
  const move = (next: number) => setPhoto((next + item.photos.length) % item.photos.length);
  const report = useRef(onPhoto);
  useEffect(() => { report.current = onPhoto; });
  useEffect(() => { report.current?.(photo); }, [photo]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea")) return;
      if (event.key === "ArrowRight") setPhoto(value => (value + 1) % item.photos.length);
      if (event.key === "ArrowLeft") setPhoto(value => (value + item.photos.length - 1) % item.photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.photos.length]);
  return (
    <Modal title={item.title} onClose={onClose}>
      <p className="modal-org">{item.organization} · {item.period}</p>
      <div className="photo-viewer">
        <img src={`/images/experience/${item.id}/${item.photos[photo]}`} alt={`${item.title} documentation ${photo + 1}`} />
        {item.photos.length > 1 && <div className="photo-controls">
          <button onClick={() => move(photo - 1)}>Previous</button>
          <span>{photo + 1} / {item.photos.length}</span>
          <button onClick={() => move(photo + 1)}>Next</button>
        </div>}
      </div>
      {item.photos.length > 1 && <div className="detail-filmstrip" aria-label="Photos from this experience">
        {item.photos.map((filename, photoIndex) => <button key={filename} aria-label={`View photo ${photoIndex + 1} of ${item.photos.length}`} aria-current={photoIndex === photo ? "true" : undefined} onClick={() => setPhoto(photoIndex)}>
          <img src={`/images/showcase/experience/${item.id}/${filename.replace(/\.jpg$/, ".webp")}`} alt="" loading="lazy" />
          <span>{String(photoIndex + 1).padStart(2, "0")}</span>
        </button>)}
      </div>}
      <p>{item.description}</p>
      <ul className="tag-list"><li className="tag-focus">{item.focus}</li>{item.tags.filter(tag => tag !== item.focus).map(tag => <li key={tag}>{tag}</li>)}</ul>
    </Modal>
  );
}

function Chips<T extends string>({ label, options, value, onChange, counts }: { label: string; options: readonly T[]; value: T | null; onChange: (value: T | null) => void; counts: Record<string, number> }) {
  return <div className="chip-row" role="group" aria-label={label}>
    <button aria-pressed={value === null} onClick={() => onChange(null)}>All <small>{Object.values(counts).reduce((a, b) => a + b, 0)}</small></button>
    {options.map(option => <button key={option} aria-pressed={value === option} onClick={() => onChange(value === option ? null : option)} disabled={!counts[option]}>{option} <small>{counts[option] ?? 0}</small></button>)}
  </div>;
}

export function AllExperiences({ onClose, onSelect }: { onClose: () => void; onSelect: (item: Experience) => void }) {
  return (
    <Modal title="Experiences" onClose={onClose}>
      <div className="all-experiences">
        {experiences.map(item => (
          <button key={item.id} onClick={() => onSelect(item)}>
            <img src={`/images/experience/${item.id}/${item.photos[0]}`} alt="" loading="lazy" />
            <span><small>{item.period} · {item.photos.length} {item.photos.length === 1 ? "photo" : "photos"}</small><b>{item.title}</b><em>{item.organization}</em></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function AchievementGallery({ onClose, initial = null, onSelect }: { onClose: () => void; initial?: number | null; onSelect?: (index: number | null) => void }) {
  const [selected, setSelected] = useState<number | null>(initial);
  const [zoom, setZoom] = useState(false);
  const [field, setField] = useState<AchievementField | null>(null);
  const counts = useMemo(() => Object.fromEntries(achievementFields.map(name => [name, achievements.filter(item => achievementField(item[2]) === name).length])), []);
  const go = (index: number | null) => { setSelected(index); setZoom(false); };
  const report = useRef(onSelect);
  useEffect(() => { report.current = onSelect; });
  useEffect(() => { report.current?.(selected); }, [selected]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (selected === null) return;
      if (event.key === "ArrowRight") go((selected + 1) % achievements.length);
      if (event.key === "ArrowLeft") go((selected + achievements.length - 1) % achievements.length);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [selected]);
  return (
    <Modal title="Achievements" onClose={onClose}>
      {selected !== null ? <div className="certificate-viewer">
        <div className="photo-controls"><button onClick={() => go(null)}>← All certificates</button><button onClick={() => setZoom(!zoom)}>{zoom ? "Fit image" : "Zoom in +"}</button></div>
        <div className={`certificate-image ${zoom ? "is-zoomed" : ""}`}><img src={`/images/achievements/${achievements[selected][0]}`} alt={`${achievements[selected][1]} — ${achievements[selected][2]}`} /></div>
        <div className="photo-controls"><button onClick={() => go((selected + achievements.length - 1) % achievements.length)}>Previous</button><span>{selected + 1} / {achievements.length}</span><button onClick={() => go((selected + 1) % achievements.length)}>Next</button></div>
      </div> : <>
        <Chips label="Filter certificates by field" options={achievementFields} value={field} onChange={setField} counts={counts} />
        <div className="achievement-grid">
          {achievements.map(([image, placement, competition, year], index) => achievementField(competition) !== field && field ? null : (
            <article key={image}>
              <button className="certificate-button" onClick={() => go(index)} aria-label={`View ${competition}, ${year}`}>
                <img src={`/images/achievements/${image}`} alt={`${placement} — ${competition}, ${year}`} loading="lazy" />
              </button>
              <span>{year}</span><h3>{placement}</h3><p>{competition}</p>
            </article>
          ))}
        </div>
      </>}
    </Modal>
  );
}

export function RepoCard({ repo, now }: { repo: Repo; now: number }) {
  return <article className="repo-card">
    <header><h3>{repo.name}</h3>{repo.language && <span className="repo-language">{repo.language}</span>}</header>
    {repo.description ? <p>{repo.description}</p> : <p className="muted">No description on GitHub yet.</p>}
    {repo.topics.length > 0 && <ul className="tag-list">{repo.topics.slice(0, 4).map(topic => <li key={topic}>{topic}</li>)}</ul>}
    <footer>
      <small>{repo.pushedAt ? `Updated ${timeAgo(repo.pushedAt, now)}` : ""}</small>
      <span>{repo.homepage && <a href={repo.homepage} target="_blank" rel="noreferrer">Live demo ↗</a>}<a href={repo.url} target="_blank" rel="noreferrer">Source ↗</a></span>
    </footer>
  </article>;
}

export function ReposArchive({ state, onClose }: { state: RepoState; onClose: () => void }) {
  const [query, setQuery] = useState(""), [language, setLanguage] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), []);
  const languages = useMemo(() => languageStats(state.repos), [state.repos]);
  const shown = useMemo(() => filterRepos(state.repos, query, language), [state.repos, query, language]);
  return (
    <Modal title="Projects on GitHub" eyebrow="Live from GitHub" wide onClose={onClose}>
      <p className="modal-org">Public repositories from <a href={profile.github} target="_blank" rel="noreferrer">github.com/{new URL(profile.github).pathname.slice(1)}</a>. Fetched in your browser and cached for an hour; forks and archived work are left out.</p>
      {state.status === "loading" && <p role="status" className="empty-state">Fetching repositories…</p>}
      {state.status === "error" && <p role="alert" className="empty-state">Couldn’t reach GitHub ({state.error}). <a href={profile.github} target="_blank" rel="noreferrer">Open the profile directly ↗</a></p>}
      {state.repos.length > 0 && <>
        <div className="language-bar" role="img" aria-label={`Primary languages: ${languages.map(item => `${item.language} ${item.count}`).join(", ")}`}>
          {languages.map((item, index) => <i key={item.language} style={{ flexGrow: item.count, background: `rgb(240 191 148 / ${Math.max(.18, 1 - index * .16)})` }} />)}
        </div>
        <div className="filter-bar">
          <label className="search-field"><span className="sr-only">Search repositories</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search repositories, topics, languages…" autoComplete="off" /></label>
          <div className="chip-row" role="group" aria-label="Filter repositories by language">
            <button aria-pressed={language === null} onClick={() => setLanguage(null)}>All <small>{state.repos.length}</small></button>
            {languages.map(item => <button key={item.language} aria-pressed={language === item.language} onClick={() => setLanguage(language === item.language ? null : item.language)}>{item.language} <small>{item.count}</small></button>)}
          </div>
        </div>
        <p className="result-count" role="status">{shown.length === state.repos.length ? `${shown.length} repositories` : `${shown.length} of ${state.repos.length} repositories`}</p>
        <div className="repo-grid">{shown.map(repo => <RepoCard key={repo.name} repo={repo} now={now} />)}</div>
        {!shown.length && <p className="empty-state">Nothing matches that search. <button className="text-button" onClick={() => { setQuery(""); setLanguage(null); }}>Clear filters</button></p>}
      </>}
    </Modal>
  );
}

export function ProjectInfo({ title, detail, url, onClose }: { title: string; detail: string; url: string; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}>
    <p className="modal-org">Screenshots from the project’s own repository</p>
    <p>{detail}</p>
    <p>The images on the three monitors are real screens captured from each repository’s documentation. Scroll on and the monitors switch to the room’s development screens, which are illustrative. <a href={url} target="_blank" rel="noreferrer">Open the repository ↗</a></p>
  </Modal>;
}

export function Resume({ repos, onClose }: { repos: Repo[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const featured = repos.slice(0, 4);
  const copy = async () => {
    try { await navigator.clipboard.writeText(resumeText(featured)); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  };
  return (
    <Modal title={profile.name} eyebrow="Résumé" wide onClose={onClose}>
      <div className="resume">
        <p className="resume-role">{profile.role} · {profile.location}</p>
        <p className="resume-contact">{profile.email} · <a href={profile.github} target="_blank" rel="noreferrer">{profile.github.replace("https://", "")}</a> · <a href={profile.linkedin} target="_blank" rel="noreferrer">{profile.linkedin.replace("https://www.", "")}</a></p>
        <div className="resume-actions no-print">
          <button className="text-button" onClick={() => window.print()}>Print / Save as PDF <span>↗</span></button>
          <button className="text-button" onClick={copy}>{copied ? "Copied ✓" : "Copy as text"} <span>⧉</span></button>
        </div>
        <h3>Profile</h3><p>{profile.bio}</p>
        <h3>Experiences</h3>
        {experiences.map(role => <div className="resume-entry" key={role.id}>
          <div><strong>{role.title}</strong> — {role.organization}<small>{role.period}</small></div>
          <p>{role.description}</p>
        </div>)}
        <h3>Achievements</h3>
        <ul className="resume-list">{achievements.map(([image, placement, competition, year]) => <li key={image}><small>{year}</small> {placement} — {competition}</li>)}</ul>
        <h3>Technology</h3>
        <p>{techStack.map(tool => tool.name).join(" · ")} — {developmentPractices.join(", ").toLowerCase()}.</p>
        {featured.length > 0 && <><h3>Selected projects</h3>
          {featured.map(repo => <div className="resume-entry" key={repo.name}>
            <div><strong>{repo.name}</strong>{repo.language && ` — ${repo.language}`}<small><a href={repo.homepage ?? repo.url} target="_blank" rel="noreferrer">{(repo.homepage ?? repo.url).replace("https://", "")}</a></small></div>
            {repo.description && <p>{repo.description}</p>}
          </div>)}</>}
      </div>
    </Modal>
  );
}
