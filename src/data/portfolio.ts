export type ChapterId = "intro" | "experience" | "achievements" | "stack" | "projects" | "contact";

export interface CameraStop {
  id: ChapterId;
  label: string;
  start: number;
  position: [number, number, number];
  mobilePosition: [number, number, number];
  target: [number, number, number];
  mobileTarget?: [number, number, number];
  fov: number;
  mobileFov: number;
}

/** The portrait Achievements camera stays in front of the desk monitors' backs (z ≈ 1.03): any further back
 * and the near plane cuts through the left monitor, drawing a grey band across the certificate. */
export const cameraStops: CameraStop[] = [
  { id: "intro", label: "Profile", start: 0, position: [-4.60, 1.6, .45], mobilePosition: [-4.70, 1.55, .65], target: [-4.97, 1.43, -2.48], fov: 39, mobileFov: 52 },
  { id: "experience", label: "Experiences", start: .14, position: [-2.8, 1.86, 1.65], mobilePosition: [-2.43, 1.9, 3.0], target: [-2.42, 1.40, -2.35], mobileTarget: [-2.08, 1.40, -2.35], fov: 46, mobileFov: 76 },
  { id: "achievements", label: "Achievements", start: .29, position: [1.20, 1.62, .78], mobilePosition: [1.35, 1.7, .82], target: [1.35, 1.45, -2.4], fov: 42, mobileFov: 58 },
  { id: "projects", label: "Projects", start: .43, position: [2.44, 1.65, 3.85], mobilePosition: [2.44, 2.6, 6.15], target: [2.44, .94, 1.10], mobileTarget: [2.44, 1.17, 1.10], fov: 44, mobileFov: 64 },
  { id: "stack", label: "Tech Stack", start: .70, position: [2.44, 1.65, 3.85], mobilePosition: [2.44, 2.6, 6.15], target: [2.44, .94, 1.10], mobileTarget: [2.44, 1.17, 1.10], fov: 44, mobileFov: 64 },
  { id: "contact", label: "Contact", start: .88, position: [2.45, 1.55, 2.85], mobilePosition: [2.45, 1.55, 2.85], target: [2.45, .99, 1.282], fov: 39, mobileFov: 48 },
];

/** Old bookmarks still lead to the chapter that now contains that material. */
export function resolveChapterId(value: string): ChapterId | undefined {
  const aliases: Record<string, ChapterId> = { profile: "intro", almet: "experience", experiences: "experience", coding: "projects", "tech-stack": "stack" };
  return aliases[value] ?? cameraStops.find(stop => stop.id === value)?.id;
}

export const profile = {
  name: "Vassel Goleyu",
  role: "Informatics student · Full-stack developer",
  /** The paragraph under the hero name, in Vassel's own words. */
  headline: "Attentive to even the smallest details, I have a genuine curiosity for the world around me. My thoughtful approach to challenges allows me to merge intelligence with creativity, resulting in innovative solutions that stand out. With a strong sense of preference and a one-of-a-kind perspective, I am passionate about making a meaningful impact in everything I do.",
  location: "Tangerang, Indonesia",
  bio: "An Informatics student at Universitas Multimedia Nusantara, building useful digital experiences and bringing people together through student leadership and community care.",
  email: "vassel.jgo@gmail.com",
  linkedin: "https://www.linkedin.com/in/vassel-goleyu",
  whatsapp: "https://wa.me/6287868918900",
  instagram: "https://www.instagram.com/vassel_goleyu/",
  github: "https://github.com/sellebeww",
};

export type ExperienceFocus = "Technology" | "Leadership" | "Events" | "Health";
export const experienceFocuses: readonly ExperienceFocus[] = ["Technology", "Leadership", "Events", "Health"];

export interface Experience {
  id: string;
  focus: ExperienceFocus;
  period: string;
  title: string;
  organization: string;
  description: string;
  tags: string[];
  photos: string[];
}

export const experiences: Experience[] = [
  { id: "bem-supervisor", focus: "Leadership", period: "Jan 2026 — Present", title: "Supervisor, Mister & Miss UMN", organization: "BEM UMN", description: "Designed the annual theme and supervised executive committees so programs stayed aligned with the Grand Design, student values, and campus regulations.", tags: ["Program direction", "Supervision", "Event concept"], photos: ["01.jpg", "02.jpg"] },
  { id: "duta-anti-narkoba", focus: "Leadership", period: "Jan — Dec 2025", title: "President", organization: "Duta Anti Narkoba UMN", description: "Led health advocacy, school outreach, donation drives, blood donation activities, and Anti-Narkoba Week with campus and community partners.", tags: ["Leadership", "Advocacy", "Community outreach"], photos: ["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg"] },
  { id: "medical-developer", focus: "Technology", period: "Feb — Dec 2025", title: "Full Stack Web Developer", organization: "UMN Medical Center", description: "Developed responsive Laravel applications, connected REST APIs and MySQL data, and implemented secure authentication and authorization.", tags: ["Laravel", "REST API", "MySQL"], photos: ["01.jpg"] },
  { id: "medical-health-center", focus: "Health", period: "Feb — Dec 2025", title: "Health Center Staff", organization: "UMN Medical Center", description: "Supported daily patient care, organized records, coordinated with healthcare providers, and shared preventive health education across campus.", tags: ["Patient care", "Health education", "Records"], photos: ["01.jpg", "02.jpg", "03.jpg"] },
  { id: "unity-2025", focus: "Events", period: "Mar — Jul 2025", title: "Event Organizer & MC", organization: "UMN English Student Council", description: "Designed Scrabble, Speech, and Debate competitions for UNITY 2025 and served as an English-language semi-formal MC.", tags: ["Event coordination", "Public speaking", "MC"], photos: ["01.jpg", "02.jpg", "03.jpg"] },
  { id: "byte", focus: "Events", period: "May — Nov 2025", title: "Event Organizer", organization: "HMIF UMN · Byte 2025", description: "Managed Horizon, Fuse, and Infinite programs, coordinating flow and logistics for exhibitions, competitions, and the interactive finale.", tags: ["Program management", "Logistics", "Student events"], photos: ["01.jpg", "02.jpg", "03.jpg"] },
  { id: "garuda-hacks", focus: "Events", period: "Jul — Aug 2025", title: "Liaison Officer", organization: "Garuda Hacks", description: "Guided participants through the UMN venue, explained schedules and rules, and acted as an approachable information point throughout the event.", tags: ["Participant support", "Communication", "Coordination"], photos: ["01.jpg", "02.jpg"] },
  { id: "omb-2025", focus: "Health", period: "Mar — Sep 2025", title: "Medical Staff", organization: "OMB UMN 2025", description: "Supported campus orientation as part of the medical staff team, helping keep participants cared for during a large student program.", tags: ["Campus care", "Teamwork"], photos: ["01.jpg", "02.jpg", "03.jpg"] },
  { id: "isfest-2025", focus: "Events", period: "Feb — Oct 2025", title: "Academic Division", organization: "ISFEST UMN 2025 · HIMSI UMN", description: "Helped organize academic competitions, prepare guidelines and learning materials, and coordinate with judges.", tags: ["Academic competitions", "Learning materials", "Coordination"], photos: ["01.jpg", "02.jpg"] },
  { id: "infinite", focus: "Events", period: "Sep — Nov 2024", title: "Event Division", organization: "Infinite · HMIF UMN", description: "Facilitated activities for around 500 students, managed timelines, and developed six interactive games for participant engagement.", tags: ["Event planning", "Interactive activities", "Timeline"], photos: ["01.jpg", "02.jpg"] },
];

export const achievements = [
  ["achievement-01-duta-anti-narkoba.jpg", "2nd Place", "Duta Anti Narkoba UMN", "2024"],
  ["achievement-02-geography-runner-up.jpg", "1st Runner-Up", "National Geography Competition", "2024"],
  ["achievement-03-geography-gold.jpg", "Gold Medal", "National Geography Competition", "2024"],
  ["achievement-04-biology-runner-up.jpg", "2nd Runner-Up", "National Biology Competition", "2023"],
  ["achievement-05-biology-gold.jpg", "Gold Medal", "National Biology Competition", "2023"],
  ["achievement-06-english-rank10.jpg", "Top 10", "National English Competition", "2023"],
  ["achievement-07-mathematics-silver.jpg", "Silver Medal", "National Mathematics Competition", "2023"],
  ["achievement-08-english-runner-up.jpg", "4th Runner-Up", "National English Competition", "2022"],
  ["achievement-09-biology-gold-2022.jpg", "Gold Medal", "National Biology Competition", "2022"],
] as const;

export type AchievementField = "Biology" | "English" | "Geography" | "Mathematics" | "Leadership";
export const achievementFields: readonly AchievementField[] = ["Biology", "English", "Geography", "Mathematics", "Leadership"];
/** The competition name decides the field; the Duta Anti Narkoba title is advocacy leadership. */
export function achievementField(competition: string): AchievementField {
  return achievementFields.find(field => field !== "Leadership" && competition.includes(field)) ?? "Leadership";
}

/** Every photograph belonging to the university-only roles above. Original
 * images stay untouched for the detail viewer; the 3D projector uses WebP. */
export const experiencePhotos = experiences.flatMap((experience, experienceIndex) =>
  experience.photos.map((filename, photoIndex) => ({
    id: `${experience.id}-${photoIndex}`,
    experienceIndex,
    photoIndex,
    experience,
    src: `/images/experience/${experience.id}/${filename}`,
    preview: `/images/showcase/experience/${experience.id}/${filename.replace(/\.jpg$/, ".webp")}`,
  })),
);

export const achievementPreviews = achievements.map(([filename]) =>
  `/images/showcase/achievements/${filename.replace(/\.jpg$/, ".webp")}`,
);

/** Circular filmstrip indexes; only these visible neighbours are mounted. */
export function showcaseWindow(index: number, count: number, visible = 5) {
  const length = Math.min(visible, count);
  return Array.from({ length }, (_, offset) => (index + offset - Math.floor(length / 2) + count) % count);
}

/** The GitHub account is the single source for live project cards. Repositories
 * listed here are shown first, in this order; the rest follow by recent activity.
 * Leave the array empty to rank everything by most recent push. */
export const githubUser = new URL(profile.github).pathname.slice(1);

/** Chapter title used for the browser tab and the screen-reader announcement. */
export function chapterTitle(id: ChapterId) {
  return `${cameraStops.find(stop => stop.id === id)?.label ?? "Portfolio"} — ${profile.name}`;
}

/** The projects shown on the desk monitors. Screenshots are real: captured from each repository's own
 * docs, or by running the project (`CAPIRA`) or opening its live site (`Vassel-F-B-Experience`), cropped to
 * the monitor's 16:10; phone apps sit three to a slide. BUNDA SIAGA was built and run in the Android emulator with a fictional demo patient. Project `i` lives on monitor `i % 3`, and each
 * monitor rotates through its own projects. Only public repositories are used.
 * `summary` is an English rendering of the repository's own GitHub description (several are written in
 * Indonesian there), so the case-study card reads in one language; GitHub still supplies the demo link,
 * language and last push (see `App.tsx`). `kind`, `context` and `stack` only restate what each description
 * says. `role` and `outcome` are deliberately absent: add them per project when you have the facts
 * (team size, what you owned, users, grades, results); the card shows them when present. */
export interface ProjectShowcase { repo: string; title: string; language: string; summary: string; kind: string; context?: string; stack: readonly string[]; role?: string; problem?: string; outcome?: string; evidence?: string; homepage: string | null; shots: readonly string[]; alt: string }
const shots = (folder: string, count: number) => Array.from({ length: count }, (_, i) => `/images/projects/${folder}/${i + 1}.webp`);
export const projectShowcase: readonly ProjectShowcase[] = [
  { repo: "tomato-vision", title: "Tomato Vision", language: "Jupyter Notebook", homepage: "https://sellebeww.github.io/tomato-vision/",
    summary: "A CNN trained from scratch in TensorFlow that grades tomato freshness: fresh, not fresh or rotten. The demo runs in the browser, so photos are never uploaded.",
    kind: "Machine learning", context: "Research prototype",
    problem: "Explore visual freshness without sending photos to a server.",
    role: "Repository maintainer", outcome: "Browser inference checked against Keras across 13 parity cases. Evaluation is still limited to a small dataset.",
    evidence: "https://github.com/sellebeww/tomato-vision/blob/main/README.md#cara-kerja", stack: ["TensorFlow", "CNN", "In-browser demo"],
    shots: shots("tomato-vision", 3), alt: "Tomato Vision: freshness classifier home, prediction and dataset screens" },
  { repo: "Batch-Aman", title: "BatchAman", language: "TypeScript", homepage: "https://sellebeww.github.io/Batch-Aman/",
    summary: "An offline-first PWA for logging food batches. Its default thresholds are not yet expert-verified.",
    kind: "Web app", problem: "Keep a food batch’s journey recorded when connectivity is unreliable.",
    role: "Repository maintainer", outcome: "Local batch timelines, QR labels, and CSV/JSON exports. Field validation remains pending.",
    evidence: "https://github.com/sellebeww/Batch-Aman/blob/main/README.md#pemakaian", stack: ["TypeScript", "PWA", "Offline-first"],
    shots: shots("batch-aman", 2), alt: "BatchAman: today's dashboard and batch cards" },
  { repo: "Ucup-Menjelajahi-Nusantara", title: "Ucup Menjelajahi Nusantara", language: "JavaScript", homepage: null,
    summary: "A relaxed adventure across the Indonesian archipelago, with a travel journal, companions and minigames.",
    kind: "Web game", context: "Advanced Web Programming course",
    problem: "Turn an archipelago into a playful, explorable travel journal.",
    role: "Repository maintainer", outcome: "Seven regions, four minigames, and saved progress. Keyboard and touch controls share the same adventure.",
    evidence: "https://github.com/sellebeww/Ucup-Menjelajahi-Nusantara/blob/main/README.md", stack: ["JavaScript"],
    shots: shots("ucup", 3), alt: "Ucup Menjelajahi Nusantara: welcome, companions and challenges screens" },
  { repo: "Ngantriin", title: "Ngantriin", language: "Kotlin", homepage: null,
    summary: "A digital restaurant queue for Android, with a diner app and a staff dashboard.",
    kind: "Android app", problem: "Connect diners and staff around the same restaurant queue.", outcome: "A diner app and staff dashboard, built with a shared Android stack.", stack: ["Kotlin", "Jetpack Compose", "MVVM", "Supabase", "Room DB", "WorkManager", "FCM"],
    shots: shots("ngantriin", 2), alt: "Ngantriin: diner home, search and queue screens, and the restaurant staff dashboard" },
  { repo: "JalanKita", title: "JalanKita", language: "Kotlin", homepage: null,
    summary: "An offline-first Android app for reporting road damage together, as a community.",
    kind: "Android app", problem: "Make community road-damage reports possible offline.", outcome: "An Android reporting workflow with light, dark, and large-font interfaces.", stack: ["Kotlin", "Android", "Offline-first"],
    shots: shots("jalankita", 1), alt: "JalanKita: home screen in light, dark and large-font modes" },
  { repo: "GEPREK-Project-Mata-Kuliah-Game-Development", title: "GEPREK!", language: "C#", homepage: null,
    summary: "A top-down 2D business and time-management game about running an ayam geprek stall.",
    kind: "Game", context: "Game Development course", problem: "Turn running a food stall into a time-management challenge.", outcome: "A playable 2D stall, service loop, and upgrade shop.", stack: ["Unity", "C#"],
    shots: shots("geprek", 3), alt: "GEPREK!: title menu, the warung during service, and the upgrade shop" },
  { repo: "CAPIRA", title: "CAPIRA", language: "TypeScript", homepage: null,
    summary: "Measures capillary refill time with a smartphone camera, scores qSOFA and drafts referrals, all offline-first.",
    kind: "Health PWA", context: "Research prototype", problem: "Explore offline access to assessment and referral tools.", outcome: "A camera-based research prototype, with qSOFA and referral drafts; not a clinically validated product.", stack: ["TypeScript", "PWA", "Offline-first"],
    shots: shots("capira", 3), alt: "CAPIRA: home, a running synthetic CRT simulation, and its result (simulation, not patient data)" },
  { repo: "Vassel-F-B-Experience", title: "F&B Experience", language: "TypeScript", homepage: "https://vassel-f-b-experience.vercel.app/",
    summary: "One ordering experience for two venues: an artisanal dining room and a Japanese matcha and coffee bar.",
    kind: "Web app", problem: "Give two distinct venues a coherent ordering experience.", outcome: "Separate dining and matcha-bar interfaces within one React application.", stack: ["React", "Vite", "Tailwind"],
    shots: shots("fb-experience", 3), alt: "F&B Experience: choose dining or drinks, then the food and matcha-bar homes" },
  { repo: "BUNDA-SIAGA", title: "BUNDA SIAGA", language: "Kotlin", homepage: null,
    summary: "An offline aid for village health volunteers and midwives: danger signs in pregnancy and after birth, SMS referrals and an optional district-health server.",
    kind: "Android app", context: "Maternal health", problem: "Keep maternal-health reference and referral tools accessible offline.", outcome: "An Android prototype with danger-sign prompts and SMS referrals; not evidence of clinical effectiveness.", stack: ["Kotlin", "Android", "Offline", "SMS"],
    shots: shots("bunda-siaga", 1), alt: "BUNDA SIAGA: kader home, a danger-sign question, and the red priority result with its reasons" },
];
/** Frameworks and tools named in the showcased projects' own descriptions (`stack` above), most used first.
 * Languages are left out (the language chips count them), and so are techniques and practices. */
const notTools = new Set(["TypeScript", "JavaScript", "Kotlin", "C#", "CNN", "In-browser demo", "Offline-first", "Offline", "SMS"]);
export const projectTools: readonly string[] = (() => {
  const counts = new Map<string, number>();
  for (const tool of projectShowcase.flatMap(project => project.stack)) if (!notTools.has(tool)) counts.set(tool, (counts.get(tool) ?? 0) + 1);
  return Array.from(counts).sort((a, b) => b[1] - a[1]).map(([tool]) => tool);
})();
/** Showcased repositories lead the archive, in this order; the rest follow by latest push. */
export const pinnedRepos: readonly string[] = projectShowcase.map(item => item.repo);
/** Which of the three desk monitors carries a project. */
export const monitorOf = (projectIndex: number) => projectIndex % 3;

/** Shown on the stack boards until the live GitHub language count arrives (public repos, primary language). */
export const languageFallback = [
  { language: "Kotlin", count: 4 }, { language: "TypeScript", count: 4 }, { language: "C#", count: 1 },
  { language: "JavaScript", count: 1 }, { language: "Jupyter Notebook", count: 1 }, { language: "Python", count: 1 },
] as const;

/** Technologies explicitly documented in the UMN Medical Center role above.
 * The illustrative screens are not evidence of additional tool proficiency. */
export const techStack = [
  { id: "laravel", name: "Laravel", category: "Web applications", detail: "Building responsive web applications." },
  { id: "rest", name: "REST APIs", category: "Integrations", detail: "Connecting application features and data." },
  { id: "mysql", name: "MySQL", category: "Database", detail: "Working with application data and database integration." },
] as const;

export const developmentPractices = ["Responsive interfaces", "Authentication", "Authorization"] as const;
