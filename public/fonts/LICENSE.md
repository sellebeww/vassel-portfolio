# Fonts

Self-hosted latin subsets, downloaded from Google Fonts (woff2). All three families are licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org), which permits bundling them with this site.

| File | Family | Source / licence |
| --- | --- | --- |
| `geist.woff2` | Geist, variable weight 400–600 | Vercel, https://github.com/vercel/geist-font (OFL 1.1) |
| `geist-mono.woff2` | Geist Mono, variable weight 400–500 (kept on disk; the site no longer loads it) | Vercel, https://github.com/vercel/geist-font (OFL 1.1) |
| `newsreader.woff2` | Newsreader roman, weight 400, optical size 6–72 | Production Type, https://github.com/productiontype/Newsreader (OFL 1.1) |
| `newsreader-italic-subset.woff2` | Newsreader italic, weight 400, only the letters `.Gefl mopstuy` | as above |

The italic is subset to the letters of the only words set in it (the hero surname, the contact headline
"useful." and the 404 heading "empty."). To use the italic for other words, download a new subset that
includes their letters and update `unicode-range` in `src/styles.css` and `public/404.html`:

    https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz@1,6..72&text=<letters>&display=swap
