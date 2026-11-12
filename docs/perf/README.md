# Performance measurements

`node tools/lighthouse.mjs <url> <label>` runs mobile Lighthouse 12 (simulated Moto G Power, slow 4G, 4x CPU) in the
installed Chromium and writes a summary here. Run against `vite preview` of a production build.

Caveat: the lab machine has no GPU, so the 3D room renders through SwiftShader. Total Blocking Time and LCP of the 3D
version are therefore far worse than on a real phone and vary widely between runs (performance 31 to 45 for the same
build). Transfer size and the simple version are stable and are the figures to trust.

## Results (production build, `vite preview`, no compression on the preview server)

| Measure | Before (e89e27d) | After | Notes |
| --- | --- | --- | --- |
| 3D room, everything loaded until the preloader lifts (`tools/measure-3d.mjs`) | 5,607 KiB | 4,475 KiB | -1,132 KiB (-20%): the three `.glb` files went from 1,818 KiB to 653 KiB |
| 3D models alone | 1,818 KiB | 653 KiB | meshopt, structure and names unchanged |
| 3D room, time until preloader lifts (software GL, one run each) | 15.6 s | 20.0 s | within the run-to-run noise of a CPU-rendered scene; not a regression claim either way |
| 3D room, Lighthouse mobile performance | 31 and 45 (two runs) | not measurable | the after-runs stalled ("page stopped responding") under software GL three times, so no number is claimed |
| Simple version, Lighthouse mobile | perf 86-88, 777 KiB, LCP 3.9-4.2 s | perf 85-87, 695 KiB, LCP 4.0 s | no meaningful change; the first run of each build differs by about 2 points |
| Default entry (no `?view=`) in this lab | perf 40-45 (loads 3D) | perf 87 (starts on the simple version) | the lab has a software renderer, which the new capability check detects. A real GPU still gets the room. |
| Accessibility / best practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 | unchanged |

Frame rate was not measured: a CPU-rendered scene says nothing about a phone GPU. That needs a real device.
