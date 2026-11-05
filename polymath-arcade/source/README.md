# Polymath Arcade: source

The app is written as plain HTML, CSS and JavaScript, with no frameworks. `build.py` inlines everything into one `index.html` and writes the installable app files next to it.

```bash
PA_APP_DIR=.. python3 build.py   # builds into polymath-arcade/ (index.html, manifest, sw.js, README.md)
node test/run_logic.js            # question generators, Target puzzles, Robot levels, launch shots, simulations
python3 test/smoke.py             # plays every game to its results screen in Chrome (needs Playwright)
PA_APP_DIR=.. python3 test/app_test.py   # manifest, icons, service worker, offline reload, deep links, swipe
```

| Path | What it is |
| --- | --- |
| `src/index.html` | Page shell; the build inlines the CSS and JS into it |
| `src/style.css`, `brand.css`, `emblems.css`, `tour.css`, `app.css` | Design system, Probable branding, the 21 tile emblems, the tour, app polish |
| `src/fonts.css` | Inter (SIL OFL) subset to the characters the app uses, inlined as data URIs |
| `src/core.js` | State, progress, sound, particles, views, the quiz engine and results |
| `src/fx3d.js` | WebGL crystal field, 3D tilt, view transitions, game sigils |
| `src/brand.js`, `emblems.js`, `tour.js`, `app.js` | Suite footer and About, tile emblems, guided tour, install, offline, deep links and swipe |
| `src/games_*.js` | The 21 games, by subject group |
| `src/sw.js`, `src/APP_README.md` | Service worker template and the app README |
| `tools/` | Font subsetting, icon rendering (from the CSS 3D cube) and install screenshots (`PA_APP_DIR=..`) |
