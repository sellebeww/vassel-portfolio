# Performance measurements

`node tools/lighthouse.mjs <url> <label>` runs mobile Lighthouse 12 (simulated Moto G Power, slow 4G, 4x CPU) in the
installed Chromium and writes a summary here. Run against `vite preview` of a production build.

Caveat: the lab machine has no GPU, so the 3D room renders through SwiftShader. Total Blocking Time and LCP of the 3D
version are therefore far worse than on a real phone and vary widely between runs (performance 31 to 45 for the same
build). Transfer size and the simple version are stable and are the figures to trust.

## Results (production build, `vite preview`, no compression on the preview server)

| Measure | Before (e89e27d) | After | Notes |
| --- | --- | --- | --- |
| 3D room, bytes until the preloader lifts (`tools/measure-3d.mjs`) | 5,607 KiB | unchanged | meshopt compression of the models (-1.1 MB) was tried and reverted, see below |
| Simple version, Lighthouse mobile | perf 86-88, 777 KiB, LCP 3.9-4.2 s | perf 85-87, 695 KiB, LCP 4.0 s | difference is within run-to-run noise; the byte drop comes from lazy images being measured differently, not from a change |
| Default entry (no `?view=`) in this lab | perf 31-45 (loads the 3D room) | perf 87 (starts on the simple version) | the lab renders in software (SwiftShader); the new capability check detects that. A device with a real GPU still gets the room. |
| Accessibility / best practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 | unchanged; axe WCAG A/AA also passes in both views |

Not measured: frame rate (a CPU-rendered scene says nothing about a phone GPU) and Lighthouse for the 3D room after
the changes (three attempts stalled with "page stopped responding" under software GL).

## Why the models were not compressed

`gltf-transform meshopt` cut `laptop.glb` + `mannequin.glb` + `mouse.glb` from 1,818 KiB to 653 KiB, but it quantises
positions to normalised integers and moves the scale onto the nodes. The scene code assumes the original node transforms and
float geometry (`Almet.tsx` rebuilds the jacket and offsets individual meshes; `RoomScene.tsx` reads the screen's
bounding box). The compressed mannequin rendered as a large dark shape over the portrait. Doing this safely means
reworking those two files (or re-exporting the models from the source `.blend` with lossless compression).
