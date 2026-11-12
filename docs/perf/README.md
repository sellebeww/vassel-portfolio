# Performance measurements

`node tools/lighthouse.mjs <url> <label>` runs mobile Lighthouse 12 (simulated Moto G Power, slow 4G, 4x CPU) in the
installed Chromium and writes a summary here. Run against `vite preview` of a production build.

Caveat: the lab machine has no GPU, so the 3D room renders through SwiftShader. Total Blocking Time and LCP of the 3D
version are therefore far worse than on a real phone and vary widely between runs (performance 31 to 45 for the same
build). Transfer size and the simple version are stable and are the figures to trust.
