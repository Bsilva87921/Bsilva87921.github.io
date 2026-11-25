# Probable 3D

One shared 3D bundle for the Probable sites, built on [three.js](https://threejs.org) r186 (MIT): `WebGPURenderer`, which uses WebGPU where the browser offers it and falls back to WebGL 2, with TSL node materials and a bloom pass.

| Scene | Site | What it shows |
|---|---|---|
| `arena` | [Sports Lab](../../live-sports-lab/) | Every game in a 40-hour window on one timeline: lanes by sport, a NOW line, one orb per game split between the teams' colors by win probability |
| `globe` | [Atlas Economics](../../probable-atlas/) | A dotted globe (Natural Earth, public domain) with a spike per economy for the selected indicator |
| `surface` | [Atlas Finance](../../probable-atlas/finance/) | The US Treasury yield curve every month since 1990 as one terrain, with inverted months marked |
| `constellation` | [AI Strategy Lab](../../ai-strategy-lab/) | The 18 AI use cases as spheres placed by value and feasibility and raised to their score, with glass planes at the Plan next (60) and Pilot now (70) bars; it moves when the scoring weights change |
| `cloud` | [Loan Rules Lab](../../loan-rules-lab/) | All 9,578 LendingClub loans by FICO, debt-to-income and predicted risk, colored by the decision the reader's rules give each one, with the rule limits as glass planes that follow the sliders |
| `bars` | [Bank Complaints](../../case-studies/bank-complaints/), [Fundraising](../../fundraising-dashboard/), [Home Care](../../elite-home-health/) | A 3D bar field (columns by time, rows by issue, month or shift) colored by a one-hue ramp or by row; heights glide when the page's filters change |
| `flow` | [Alteryx Workflow Lab](../../alteryx/) | The selected lesson's finished workflow: tools as blocks in their palette colors, records traveling the connections, record counts from the lesson's own run |

The project scenes (the last four) also take a light or dark theme from the page (`setTheme`), so they match each page's light/dark switch; the shared panel, loader and Motion switch for them live in [`assets/kit`](../kit/). The page loads the bundle after it is interactive and only when the browser can draw it; otherwise it keeps its 2D design. If WebGPU reports an error in the first seconds the scene is rebuilt on WebGL 2 and that choice is remembered. Motion stops for `prefers-reduced-motion` or with the Still button; the scene sleeps when it is off screen or the tab is hidden.

Build: `node source/build.mjs source/src/index.js probable-3d.js` (esbuild, with three.js r186's `build/` files). The three.js license is kept at the end of the bundle.
