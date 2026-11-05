# Probable: Polymath Arcade

A Probable app by **Bruno Silva**: 21 adaptive 3D brain games across 10 subjects (brain training, math, physics, the real world, coding, science, finance, economics, business and English). Every round adapts to the player and explains what they missed.

**Live:** https://bsilva87921.github.io/polymath-arcade/ · light/dark switch · installable as an app · works offline

## What's inside
- **21 games, each with its own 3D emblem.** Every tile on the periodic table of skills has a small animated CSS 3D scene. For example, flip cards, an atom, a wireframe globe, a cube robot, live candlesticks, a spinning coin, a DNA helix and a pop-up shop. Scenes animate only while on screen.
- **A living 3D background.** A hand-written WebGL renderer draws a field of glass crystals that tint toward the subject you're playing.
- **Guided tour.** First-time players get a welcome card with a rotating ring of the 10 subjects. A spotlight then glides across the app while a 3D card turns over for each step. It can be replayed from the Tour button or Profile, or opened with `#tour`.
- **Progress.** XP, 10 ranks, adaptive levels per game, a daily goal, streaks, 18 badges, a skill radar and the Daily Challenge (one question from every subject, the same set for everyone each day, worth double XP).
- **App features.**
  - Installs on Android, iPhone, iPad, Windows, macOS and ChromeOS.
  - Has an animated 3D splash screen.
  - Offers home-screen shortcuts to the Daily Challenge, Profile and the tour.
  - Supports notches and safe areas.
  - Has system bars that follow the theme.
  - Shows an Update button when a new version ships.
  - Vibrates on Android for right and wrong answers.
  - Lets you swipe between tabs.

## Install
- **Android (Chrome):** tap **Install** in the top bar, or use the menu and choose **Install app**.
- **iPhone or iPad (Safari):** tap **Install** in the top bar for the steps, or tap **Share** and then **Add to Home Screen**.
- **Desktop (Chrome or Edge):** click **Install** in the top bar, or click the install icon in the address bar.

To list the app in Google Play, the Microsoft Store or the App Store, enter the live URL at [pwabuilder.com](https://www.pwabuilder.com). It packages this same app for each store using the manifest and icons here.

## Files
| File | What it is |
| --- | --- |
| `index.html` | The whole app in one file: games, styles, fonts and code |
| `manifest.webmanifest` | Name, icons, colors, shortcuts and install screenshots |
| `sw.js` | Service worker for offline play and updates |
| `icons/` | App icons (any and maskable), Apple touch icon, favicon, shortcut icons |
| `screenshots/` | Images for the richer install dialog on Android and desktop |
| `source/` | The source code, build script, asset tools and tests |

## Build from source
```bash
cd source
PA_APP_DIR=.. python3 build.py   # writes index.html, manifest, sw.js and README.md into polymath-arcade/
node test/run_logic.js            # checks the question generators, puzzles and simulations
```
The web page is built with all styles and scripts inlined. Each build stamps a new service-worker version, so installed copies offer an update the next time they open online.
