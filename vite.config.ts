import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Social cards and canonical links need absolute URLs. Set VITE_SITE_URL (for example
 * https://vassel.example) when deploying; without it those tags are left out entirely. */
function siteUrl(siteUrlValue: string): Plugin {
  const base = siteUrlValue.replace(/\/+$/, "");
  return {
    name: "site-url",
    transformIndexHtml(html) {
      const resolved = html.replaceAll("%SITE_URL%", base);
      return base ? resolved : resolved.replace(/^\s*<meta[^>]*content="[^"]*"[^>]*data-needs-site-url[^>]*>\n?/gm, "").replace(/^\s*<link[^>]*data-needs-site-url[^>]*>\n?/gm, "");
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), siteUrl(loadEnv(mode, ".", "VITE_").VITE_SITE_URL ?? "")],
  build: {
    target: "es2022",
    // three.js alone is ~950 kB minified (about 285 kB gzip). It is split so the app code and the engine cache
    // independently, and both load only after the HTML interface has painted.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React must stay out of the 3D chunks, or Rollup hoists it there and the first paint
          // would download the whole engine.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id) || id.includes("vite/preload-helper")) return "react";
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("node_modules/@react-three/") || id.includes("node_modules/three-stdlib/") || id.includes("node_modules/troika")) return "r3f";
        },
      },
    },
  },
}));
