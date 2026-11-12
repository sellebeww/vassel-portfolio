# Improvement plan

Branch `improve/portfolio-polish`. Written before the work, updated as decisions changed (see "Decisions").
Site copy is English, so new site content is English; docs for the owner are Indonesian where noted in the PR.

## 1. Audit (what is already good, what is missing)

Already in place, kept as is: split chunks (react / three / r3f load only after the HTML interface paints), self-hosted
fonts with preload, the 3D room behind `React.lazy`, a "simple version" (reading view) with a remembered choice
(`?view=simple|3d`), automatic simple version on Data Saver and on devices with <= 2 GB memory, `prefers-reduced-motion`
handling, error boundary that falls back to the simple version, a paced loading screen with an escape hatch, Open Graph,
Twitter card, JSON-LD `Person`, `robots.txt`, a `noscript` block, a command palette, deep links, skip link, focus
trapping in dialogs. Lighthouse accessibility, best practices and SEO are already 100 on mobile.

Gaps found:

| Area | Gap |
| --- | --- |
| Measurement | No recorded numbers. No Lighthouse tooling. |
| Performance | 3D models are uncompressed: `laptop.glb` 1.03 MB, `mannequin.glb` 738 KB (1.8 MB of a 4.4 MB first 3D load). The simple-version decision ignores a software or missing WebGL renderer, so a device with no real GPU gets the slow 3D path. |
| Structure | The best repositories (assay-evm, paper-trail, falsify-guardrail, HakData, APEX-GYM) are not shown, or shown only as a one-line card. No case-study depth for a recruiter. |
| SEO | No `sitemap.xml`. `og-image.jpg` exists; its source script is `tools/render-social-card.mjs`. |
| Quality gates | No lint, no unit-test runner, no axe test, no `ci.yml`, no deploy config. The existing `tools/test-*.mjs` scripts need a manual dev server and are not run anywhere. |
| Docs | README is 30 lines: no screenshots, no architecture. |

## 2. Stack decision: stay on Vite + React + R3F

Astro islands would help only if the first paint were blocked by React. The measurements say otherwise: the simple
version (React only) already scores 86-88 and transfers 777 KB; the 3D version is slow because of the 3D work itself
(models, shader compilation, a software GL renderer in the lab), which Astro does not change. The router, overlays and
deep links are one client app, so a migration touches nearly every file for a risk with no measured gain.
Decision: no migration. Revisit only if static, per-project pages (own URL, own HTML) become a hard requirement.

## 3. Order of work (one commit per logical change)

1. Plan, measurement tooling, baseline numbers.
2. Tooling: ESLint, Vitest unit tests, `npm run check`, CI workflow.
3. Try compressing the 3D models with meshopt (attempted; reverted, see Decisions).
4. Capability check: start on the simple version when WebGL is missing or the renderer is software (SwiftShader, llvmpipe).
5. Case studies from the repositories' own READMEs, with a quick-read mode (the simple version, plus a case-study index).
6. SEO: sitemap, per-page metadata check, OG image regenerated from a real screenshot.
7. Accessibility tests with Playwright + axe, keyboard walk-through.
8. Deploy config (Vercel, GitHub Pages workflow) and README.
9. After measurements, PR.

## 4. Content rules

New content comes only from this repository or from the public READMEs of github.com/sellebeww. Anything else is a
`TODO(vassel)` and is listed in the PR. Role, team size and personal outcomes of each project are not in the READMEs,
so they are left as `TODO(vassel)`.

## 5. Decisions

- Stay on Vite, no Astro (section 2).
- Model compression reverted after a before/after render showed the mannequin broken (see docs/perf/README.md).
- Five case studies, not six: MALUMALU has no public repository under github.com/sellebeww, so there is no README to source it from.
- Case studies are rendered client-side (inline in the simple version, dialog in the room). Per-project static pages were not built: the hash-routed SPA has no router, and Astro was rejected.
- `og-image.jpg` kept: the CPU-only machine used for this work cannot take a clean screenshot of the room at desktop size.
- No Lighthouse number is claimed for the 3D room after the changes (see docs/perf/README.md).
