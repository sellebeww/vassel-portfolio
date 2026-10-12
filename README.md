# Vassel Goleyu

A scroll-driven 3D portfolio set in a cozy workspace. Built with React, TypeScript, Vite and React Three Fiber.

## Run

```sh
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

## Deploy

Works on Vercel as-is (Vite, `npm run build`, output `dist`). Optionally set `VITE_SITE_URL=https://your-domain` so social-card and canonical tags get absolute URLs.

## Structure

- `src/data/portfolio.ts`: all profile, experience, certificate and project content
- `src/scene/`: the 3D room and camera journey
- `public/`: images, models and fonts

## Features

Six chapters (Profile, Experiences, Achievements, Projects, Tech Stack, Contact), a reading view without WebGL, a command palette (`⌘K` / `Ctrl K`), shareable dialog links, and a résumé generated from the same data.
