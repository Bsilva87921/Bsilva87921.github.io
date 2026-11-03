# Probable apps

Two apps built from the live sites, in two forms.

| App | Covers | Install from the web | Native project |
|---|---|---|---|
| **Probable Sports Lab** | 13 leagues plus tennis, golf and UFC: live win probabilities, the 3D live arena, what-if lab, standings projections, track record, Ask AI | [bsilva87921.github.io/live-sports-lab](https://bsilva87921.github.io/live-sports-lab/) → **Install app** | [`sports-lab/`](sports-lab/) · `io.github.bsilva87921.sportslab` |
| **Probable Atlas** | Home screen + Economics + Finance & markets (and future modules): 3D globe and yield-curve terrain, forecasts with track records, what-if labs, Ask AI | [bsilva87921.github.io/probable-atlas/app](https://bsilva87921.github.io/probable-atlas/app/) → **Install app** | [`atlas/`](atlas/) · `io.github.bsilva87921.atlas` |

## 1. Installable web apps (live now)
Both sites are installable apps (web app manifest + service worker): own icon and window, app shortcuts, instant starts, and the last data kept for offline use. They keep working in any browser.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app*, or the *Install app* button on the page.
- **Windows / Mac (Chrome, Edge):** the install icon in the address bar. **Mac Safari:** File → *Add to Dock*.

## 2. App Store and Google Play (ready to build)
Each folder is a [Capacitor](https://capacitorjs.com) project that packages the site's own files (the page, the 3D bundle, icons); data comes from the same live sources as the website.

The **Native app builds** workflow (Actions tab) runs on every change here and produces, for each app, a test **Android APK** and an **Xcode project** that it checks with an iOS simulator build. Download them from the workflow run's *Artifacts*.

To build and publish yourself (Node 22+):
```bash
cd apps/sports-lab        # or apps/atlas
npm install
npm run build:web          # copy the site files into www/
npx cap add ios            # once: creates ios/ (needs a Mac with Xcode)
npx cap add android        # once: creates android/ (needs Android Studio)
npm run assets             # icons and splash screens from resources/
npx cap sync
npx cap open ios           # Xcode: set your Team, then Product → Archive → App Store Connect
npx cap open android       # Android Studio: Build → Generate Signed Bundle (AAB) → Play Console
```
What publishing needs: an Apple Developer Program membership ($99/year) and a Google Play developer account ($25 once); a privacy policy URL — use <https://bsilva87921.github.io/apps/privacy.html>; and the listing text in each app's `STORE.md`.

Review note: Apple's guideline 4.2 asks that apps offer more than a website. These apps are interactive tools (3D views, simulations, what-if labs, offline use); the store listing should lead with that.
