# Probable: Live Sports Lab

A live multi-sport analytics dashboard by Bruno Silva: real-time scores across 13 leagues (NFL, college football, MLB, NBA, WNBA,
NHL, the Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, MLS and the Champions League) plus tennis, UFC and golf, with in-game win probabilities, season projections, a what-if lab, a stats center and championship histories.

**Live:** https://bsilva87921.github.io/live-sports-lab/ · light/dark switch · installable as an app

## Sports Lab 2.0
- **3D scoreboard carousel.** A turning ring of game cards above the board: each card shows the league, the clock or
  start time, both teams with their colors, the score and a win-chance bar. Live games glow and come first (teams you
  follow before them), then the next games, then the latest finals. It turns one card every few seconds; drag, swipe or
  use the arrows to turn it, and tap a card to open the game. Built with three.js `WebGPURenderer` (WebGPU, falling back
  to WebGL2 automatically, and to a 2D summary when neither is available). It sleeps off screen, has a **Still** switch
  and respects reduced-motion settings.
- **Insights bar.** A pinned bar at the top that rotates through what is worth knowing right now: games in progress,
  the closest game, the biggest swing, upset watch, the top matchup, the biggest favorite, where the model and the
  betting line disagree most, a recent upset, and the track record. Each one opens its game or section, or asks about it.
- **Ask AI.** A built-in analyst answers for free from the live board and the models: explain a game's number, run a
  what-if ("what if the QB is out?"), weigh a coaching decision, compare teams, list upsets or the schedule. With the
  optional proxy (shared with Probable Atlas, see [`../probable-atlas/ai-proxy`](../probable-atlas/ai-proxy/)), Claude
  answers using 11 of the lab's functions as tools: the board, any game, scenarios, what-ifs, coaching decisions,
  teams, standings, the track record, the methods and navigation. Links can open it with a question: `?ask=...`.
- **News.** A News tab with the latest headlines from every league on the board, plus tennis, golf and UFC: lead story,
  filters by league, a search box, "What it means" (asks Ask AI) and share. Each game center lists recent headlines about
  its two teams. Headlines come from ESPN's public news feeds, refreshed by a scheduled job twice an hour
  (`.github/workflows/news.yml`, `probable-atlas/pipeline/fetch_news.py`) and topped up live in the browser.
- **Follow teams and get alerts.** Star a team in any game center: its games lead the board and the carousel, it gets a
  News filter, and you get alerts when its game starts, goes down to the wire, changes leader late and ends (confetti
  when it wins). Alerts show in the page and, once you turn them on, as notifications; the installed app's icon shows how
  many of your teams are playing.
- **Search everything.** `⌘K` / `Ctrl K` or `/` opens one search for teams, games, leagues, sections, news and actions,
  with recent picks and an Ask AI fallback.
- **Today's briefing.** The ring at the left of the Insights bar opens story-style slides (your teams, the closest game,
  the biggest swing, upsets, the top matchup, the top headline) with tap-to-advance, hold to pause and read-aloud.
- **Share cards.** Share any game, insight, slide or headline as a 1080×1080 image (the phone's share sheet where
  available, otherwise a preview with download and copy).
- **Small touches.** Pop out a live score into an always-on-top window (Chrome and Edge on desktop), pull to refresh on
  phones, keyboard shortcuts (`?` lists them), numbers that count up, haptic taps in the apps.
- **Track record.** At the top of *How it works*: how often the lab's numbers have been right this season (see below).
- **App.** A web app manifest and service worker make it installable (Install app button; Add to Home Screen on iPhone
  and iPad) with offline starts from the last board. The App Store and Google Play project is in
  [`apps/sports-lab`](../apps/sports-lab/).

## How the track record works
`pipeline/track.mjs` runs twice an hour in GitHub Actions (`.github/workflows/sports-track.yml`; GitHub drops some scheduled runs, so the slots overlap) and loads the lab's own
model code (`source/src/01–03`) exactly as the browser runs it.
1. **Season replay without look-ahead.** Every completed game of each league's current season (NFL, MLB, NBA, WNBA,
   NHL and the six soccer leagues) is predicted in start-time order using only games that were already over when it
   started (started at least four hours earlier).
2. **In-game checkpoints.** The same games are re-scored from their period scores (after the first quarter, at
   halftime and after the third; after the first and second periods; after three and six innings; at halftime and 75
   minutes in soccer, from goal times) and compared with simply backing the team that leads.
3. **Prospective log.** For every game starting within 18 hours, each run records the live board's pregame number and
   the betting line; the last reading before the start is the one graded once the game is final.

Scores are the Brier score, accuracy, calibration by probability bin, and skill against a "home edge only" baseline
(and against the leader for checkpoints). The record is honest about where the edge is small: pregame skill is modest
overall and close to zero in baseball and some soccer leagues, while the in-game numbers beat "the leader wins" in every
league. The pipeline keeps its archive and log on the single-commit `sports-data` branch and publishes
`data/track.json` with each deploy.

## How it's built
| Piece | Where |
|---|---|
| Page | `source/src/shell.html`, `style.css`, `fx.css`, and the numbered modules: models (01), snapshot (02), live core (03), charts (04–05), box scores (06), guide (07), titles (08), stats (09–10), scenarios (11), views (12), track record (13), Ask AI (15), scoreboard carousel (16), insights (17), app (18), news, follows, search, briefing and share (19) |
| Shared Probable kit | Ask AI chat, Insights bar, 3D loader, install support, follows and alerts, search, briefing stories, share cards, news and small touches from [`probable-atlas/source/src/kit-*`](../probable-atlas/source/src/) |
| 3D | [`assets/probable-3d`](../assets/probable-3d/): the scoreboard carousel, loaded on demand |
| Build | `python3 source/build.py` writes `source/dist/index.html` (copy it to `index.html`); `--artifact track.json` builds the self-contained Claude-hosted copy |
| Data | ESPN's public scoreboard, summary, standings and news JSON, fetched in the browser; the track record and the news file from the scheduled pipelines |
| App shell | `manifest.webmanifest`, `sw.js` (network first with short timeouts, cached copy offline), `icons/` |

No frameworks beyond three.js for the 3D view; every model runs in the browser. Analytics for fun and learning, not
betting advice.
