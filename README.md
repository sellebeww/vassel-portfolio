# Vassel Goleyu — After Hours

A continuous, scroll-driven 3D portfolio inside a cozy workspace. React, TypeScript, Vite, React Three Fiber and Three.js. Written content and controls remain semantic HTML over the room.

## Run

```sh
npm install
npm run dev
npm run build
```

`npm run preview` serves the production build. No database, account, video service or API key is required. The only network call is the public GitHub repository list (see **Live projects**), which fails soft.

For deployment, set `VITE_SITE_URL=https://your-domain` at build time so the canonical link and social-card image get absolute URLs; without it those tags are omitted rather than emitted broken.

## Content and references

- `src/data/portfolio.ts`: profile, ten university experiences (each with a focus: Technology, Leadership, Events or Health), nine certificates, the three showcased projects (`projectShowcase`: repository, fallback text, screenshots), the GitHub account and pinned repositories, documented technologies and six camera stops.
- `public/images/experience/` and `public/images/achievements/`: supplied content, requested as needed. Full photo sequences and certificate zoom are available in dialogs.
- The supplied photos guide the navy almet/pins, rose-gold laptop, black keyboard/bezel, large trackpad, red **Supermie** sticker and shared oak table. The current desk omits exposed cables and the power strip; a Kopi Kenangan Caramel Macchiato cup is a code-native prop. The window uses ordinary clear glass: no perforated shade or patterned panes.
- `public/images/projects/<project>/N.webp`: real screenshots of the showcased projects (sources are listed under **Live projects**), cropped to the monitors' 16:10. The monitors and the laptop show only these projects; there are no code, design or terminal screens.

High-school **experience** is excluded. Earlier academic achievements remain in the separate certificate archive. The GitHub link is the supplied `https://github.com/sellebeww`. The room is a stylized interpretation of the supplied workspace.

## Live projects (GitHub)

The Projects chapter shows nine real projects from `github.com/sellebeww`, all public: `tomato-vision`, `Batch-Aman`, `Ucup-Menjelajahi-Nusantara`, `Ngantriin`, `JalanKita`, `GEPREK-Project-Mata-Kuliah-Game-Development`, `CAPIRA`, `Vassel-F-B-Experience` and `BUNDA-SIAGA` (`projectShowcase` in `src/data/portfolio.ts`). Project `i` lives on desk monitor `i % 3` and each monitor cycles through its own three. A spotlight walks through all nine every 3.5 seconds (a native selector and ← → buttons jump to any project, which then stays up for three beats; there is no play/pause button, and dialogs, an open details panel, mouse hover, keyboard focus and reduced motion hold the tour): the spotlighted project's monitor pins to its screenshots and the card beside the desk describes it, so the card always matches what is on screen. The card is a short case study: kind of work (and course or research context), an English summary, the stack named in the project's description, then demo/GitHub links. The problem is visible immediately; an accessible Implementation & evidence disclosure contains implementation, role, result and source links. The first three project stories were checked against their public READMEs; repository maintenance does not imply sole authorship or validated real-world impact.

Screenshots are fixed assets and always show. Where they came from: the repository's own docs (tomato-vision, Batch-Aman, Ucup, Ngantriin, JalanKita, GEPREK), the project run locally (CAPIRA, whose shots are its built-in *simulation*, banner included, not patient data), the live site (Vassel-F-B-Experience) and the Android emulator (BUNDA SIAGA, with a fictional demo patient; the app's "block screenshots" privacy toggle was switched off in a throwaway emulator only). Phone apps are composed three to a 16:10 slide. The public GitHub API, requested in the visitor's browser the first time Projects, the stack, the résumé or the palette needs it, supplies each project's current description, demo link, language and last push, plus the language counts on the stack boards. If GitHub is unreachable the cards keep their stored text and links and the stack boards use `languageFallback`. Forks, archived and private repositories and the profile README repository are skipped. `pinnedRepos` is derived from `projectShowcase`, so showcased repositories lead the archive in that order; the rest follow by latest push. Results are cached in `localStorage` for one hour (the last cached copy is used on failure). "All N repositories" opens a searchable archive with a language filter. The archive shows descriptions exactly as written on GitHub (some are Indonesian); the Projects card uses the English `summary` from `projectShowcase`, a faithful rendering of the same description. To change what is showcased, edit `projectShowcase` (a test checks every screenshot exists and all three monitors are used).

## Site tools

- **Command palette**: `⌘K` / `Ctrl K` (or `/`, or the Menu button). Search chapters, all ten roles, all nine certificates, repositories and room controls. Fully keyboard-driven (`↑ ↓ ↵ Esc`), exposed as an ARIA combobox/listbox.
- **Shortcuts** (outside text fields): `1`–`6` chapters · `S` music.
- **Time of day**: always the 24-second day cycle; there is no control for it. `?lighting=night|dawn|day|sunset` still holds one phase for screenshots and QA.
- **Music**: off by default, started only by the visitor. A chill-jazz quartet (electric piano, walking bass, brushed drums, a quiet melody, vinyl crackle) is synthesised live with Web Audio over an 8-bar loop in C, so there are no audio files or licences, and each pass varies slightly (`src/lib/ambience.ts`). It is independent of the Rain toggle, pauses in hidden tabs and fades in and out.
- **Résumé**: built from the portfolio data (never typed twice). Print / Save as PDF uses a dedicated print stylesheet that hides the room and shows black-on-white text; "Copy as text" gives a plain-text version. Live GitHub projects are appended when loaded.
- **Filters**: the roles dialog has search plus Technology / Leadership / Events / Health chips; the certificate gallery filters by Biology / English / Geography / Mathematics / Leadership.
- **Shareable addresses**: every dialog has its own hash and its own history entry, so Back closes it. `#role/<id>[/<photo>]`, `#roles`, `#certificate/<n>`, `#certificates`, `#repos`, `#resume`, `#project`. Role ids are in `src/data/portfolio.ts`.
- **Contact form**: still a `mailto:` draft (no backend). Long messages are shortened to stay under mail clients' URL limit and the full text is copied to the clipboard first; "Copy message" is always available; the draft survives a reload for the session.

## Interaction

Six chapters share one room: **Profile → Experiences → Achievements → Projects → Tech Stack → Contact**. `src/scene/journey.ts` defines one continuous camera timeline with eased moves and deliberate viewing holds. Old `#almet`, `#coding` and `#tech-stack` bookmarks still resolve. Desktop and mobile have separate framing.

Experience pairs an enlarged navy almet (1.22×) with the enlarged projector exhibit (1.4×). The label beneath the almet has been removed. The projector cycles through 27 supplied university photos every 4.5 seconds, matching the accompanying role and dates. Photos dissolve over 0.9 seconds with restrained film flicker, an aimed warm beam, floating dust and tiny lens movement. Original aspect ratios are retained. The filmstrip, role selector, Pause and full photo dialogs remain available. Dialogs, keyboard focus, hidden tabs and reduced motion pause autoplay. Achievements retains its separate physical certificate cabinet and original-image archive, with space from the projector and window.

Projects begins with a close, front-facing view that fits all three desk monitors, and the project photos are already on the screens when the desk arrives: each monitor cycling through its projects' screenshots on staggered 9-second beats (paused by dialogs and reduced motion). Clicking a screen opens the GitHub repository of the project showing on it (pointer cursor, "GitHub ↗" on the caption pill); the card also has a GitHub button. The seated character and chair are removed; the desk frame contains a typographic print. Scrolling on from the photos goes straight into the zoom toward the laptop: the screenshots stay on the monitors as the camera starts moving, with no still stretch in between. To make that possible the scroll bar is shorter than the timeline: `journeyAt` / `scrollAt` in `src/scene/journey.ts` map scroll to timeline position and skip the empty span between `JUMP_FROM` and `JUMP_TO`, and `.site` in `styles.css` is sized to match (a test checks the height). Everything else, including the earlier chapters, keeps its scroll speed. In `?qa` mode `window.__scrollAt` lets scripts address timeline positions.

Three monitors surround the pink laptop, and all four screens show the projects: the monitors carry screenshots, the laptop shows the spotlighted project with its name, kind of work and stack (`src/scene/LaptopScreen.ts`). The warm environmental light is always on and there is no rain. The camera holds close to the laptop (timeline p≈.745–.83; a further-back hold on portrait phones). While it holds, two glass boards stand either side of the laptop: **Languages** (primary language of each public repository, counted live from GitHub) and **Web stack** (Laravel, REST APIs, MySQL and the development practices, taken from the supplied UMN Medical Center developer-role description; no extra proficiency claims are added). The laptop screen keeps showing the project during the hold; the Contact page lights up on it only after the boards leave (p≈.85–.88), and the text card steps aside on desktop while the boards stand (`StackBoards.tsx`). The two dark hinge barrels of the laptop model are hidden. The HTML Tech Stack chapter lists the same data.

After Tech Stack, the camera aligns with the pink laptop and moves toward its screen. One persistent, live HTML Contact interface is projected onto the screen's actual four corners using a CSS projective transform, then smoothly fills the viewport. It is not a screenshot and does not reload on entry. Name, email, GitHub, LinkedIn, copy-email and validated contact fields are usable once inside. **The form opens the visitor's email application with a prepared draft; there is no email-delivery backend.** Values survive reverse scroll. A return button moves back to the desk. In the WebGL fallback, Contact is available in normal document flow.

Night is the initial atmosphere. Starting in Projects, a 24-second night → dawn → day → sunset → night cycle continues through the workspace. Dialogs, hidden tabs, fullscreen Contact and reduced motion stop ambient animation. Scrolling still drives camera travel and can reverse out of Contact. `?lighting=night`, `day`, `dawn` or `sunset` fixes the atmosphere for review.

## Rendering and loading

- 3D code is lazy-loaded separately from HTML. The first paint ships only React and the app shell (about 90 kB gzip); `three` (≈285 kB gzip) and `@react-three` load afterwards in their own chunks. `vite.config.ts` pins React and Vite's preload helper to the eager chunk — otherwise Rollup hoists them into the 3D chunks and the whole engine is preloaded up front. `test:features` guards this. Once the room mounts, its principal exhibits and workspace begin loading immediately rather than waiting for chapter-scroll gates. They remain in the same room during camera travel; asynchronous loading still applies.
- The workspace is physically offset +1.5 world units in Z from its previous location, separating it from the gallery instead of hiding geometry by chapter. Thirty-six WebP photo/certificate previews total about 1.6 MB; only visible showcase selections/neighbours and opened originals are decoded, not the full original archive. The initial featured certificate can load on first view.
- Full-quality animation uses R3F’s native display-synced loop; efficient animation is capped at 30 fps. Paused and reduced-motion scenes render on demand. Hidden tabs stop scheduled work; camera travel and interactions invalidate as needed. Adaptive quality ignores initial asset/shader warm-up and requires two sustained slow windows. This is a rendering policy, **not a measured hardware FPS guarantee**.
- One 1024² static directional shadow map; a 512² one-frame floor contact capture and a 256² one-frame desktop contact capture. Efficient mode omits these shadows. No post-processing pass: film grain and the vignette are a static CSS layer over the canvas, and a broad warm area light provides the desk fill without an extra shadow pass, so photos and screens keep exact colours. No video embeds or physics.
- Plain clear-glass window with restrained reflections and existing structural frames. The old perforated valance, 17 small bars and alpha-cutout texture are removed. No expensive glass transmission pass.
- DPR caps: 1.75 standard/gallery/still views, 1.5 for an efficient animated workspace. Small screens, low reported memory/core count, reduced motion, or sustained slow render samples select efficient mode. Gallery/still views retain extra clarity without continuous redraws; source photos are not upscaled.
- Editor: reusable canvas at 2048×1280, or 1024×640 in efficient mode, refreshed at most twice per second. Secondary native canvas screens update at 1 Hz, or .5 Hz in efficient mode.
- The exterior now has genuine low-poly depth: 54 instanced buildings, one instanced window batch, a small landmark and a procedural sky. It requests no panorama maps.
- Almet geometry is cloned and subtly tailored, with fine procedural twill, rolled lapels, welt seams and dark satin lining. Real pin/patch artwork remains sourced from the original embedded atlas; edge-connected cloth backgrounds are isolated only on small runtime canvases. The original model and photograph remain untouched.
- The latest straight-pin reference guides cleaner badge rows, shoulders, sleeves, buttonholes and button thread details. The honey-oak desktop is painted in code (`useOakSurface` in `src/scene/materials.tsx`): no texture download.
- The desk preserves three monitors and their screens, the laptop, oak desktop, felt mat and plant. Accessories are a complete 32-piece maple/walnut chessboard, glazed Maneki-neko, spiral Sudoku notebook and three cloth-bound books on the right: “THE CLEAN INTERFACE”, “OFFLINE-FIRST WEB”, and “CODE, TEST, REPEAT”. These are custom decorative titles, not attributed publications. The Curry miniature and water bottle are removed. The Kopi Kenangan cup is brought forward into a clearer gap and enlarged slightly; its curved sleeve retains “Good Things Take Time”. The lamp and its hardware stay removed; `L` controls environmental fill. Static accessory geometry is merged by finish (26 material draws, 31,128 triangles); the book covers and spines share one texture atlas. Resources are disposed on unmount. `node tools/qa-desk-accessories.mjs` checks desk/camera bounds, non-overlap, surface contact, draw budget and the light shortcut, with desktop/mobile day/night captures.

## Design system

`src/styles.css` opens with the tokens: five base colours (night, ink, paper, muted text and a warm accent), with derived semantic shades, a fluid type scale, a 4/8 spacing scale with one shared gutter, radii, shadows and easing curves. Type has three voices: Newsreader (headings), Geist (reading) and Geist Mono (indices, dates, labels); the 3D canvas labels and stack boards use the same faces and repaint if a font arrives after them. Fonts are self-hosted latin subsets in `public/fonts/` (licences and how to regenerate the italic subset in `public/fonts/LICENSE.md`). The Experience projector opens on the developer role, then runs through every role in order. Room toggles (warm light, rain, screen, time of day) sit in the bottom dock while the camera is at the desk; the palette and keys reach them everywhere. Hovering a clickable 3D object shows a small label naming its action (fine pointers only). `public/404.html` is the static hosts' not-found page.

## Accessibility

A Reading view is available immediately from the loader and dock; it exposes every chapter in normal document flow and can return to the room. Mobile navigation uses chapter names and 44px targets. Reduced motion retains the dark 3D room with immediate camera positioning, stopped autoplay/idle motion and efficient rendering. A WebGL failure shows the content in a dark normal-flow fallback. Dialogs support Escape, focus trapping/return, photo controls and certificate zoom/arrow navigation. Essential interactions have DOM controls, not just 3D hit targets. Dialogs and the palette make everything behind them `inert`, keep focus on the control that opened them, and each chapter change is announced through a polite live region while the tab title follows the chapter. Sound never starts by itself.


## Verify

With `npm run dev` running:

```sh
npm run build
npm run test:features   # pure logic + source guards (GitHub parsing, palette ranking, deep links, mailto limits…)
npm run test:ui         # real Chrome: palette, hotkeys, deep links, history, filters, focus, GitHub cards, print/PDF, sound, mobile, no-WebGL
npm run test:flow
npm run test:journey
npm run test:cycle
npm run qa:visual
```

`test:ui` mocks `api.github.com` (success and 403) and isolates every scenario in its own browser context, so it needs no network and no shared cache; it writes screenshots and a sample résumé PDF to `artifacts/qa/features/`. `qa:visual` runs `tools/qa-journey.mjs` using local Chrome with native Metal graphics. It checks desktop/mobile framing, chapter order, enlarged exhibits, complete monitor framing and a fixed Projects/Tech Stack camera, scroll-driven project reveals, the live laptop interface, GitHub, form validation, retained input on reverse scroll, normal-motion entry and return navigation. Screenshots and browser/error reports are saved to `artifacts/qa/journey/`. Journey unit checks cover camera continuity, viewing holds, reveal order and all four corners of the HTML projection. `?qa` exposes camera/render markers.

The deferred `three` chunk (≈950 kB minified) is intrinsic to the library; the size-warning limit is set just above it. Browser screenshots are visual/functional evidence, not a real-device frame-rate benchmark.

