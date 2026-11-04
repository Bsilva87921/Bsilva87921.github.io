# Probable Atlas

A series of world-domain analytics dashboards by Bruno Silva, built on the approach of the [Probable Sports Lab](../live-sports-lab/). Each module has the same eight tabs (Live now, News, data explorer, Models & forecasts, What-if lab, Recommendations, History, How it works), a light/dark switch, a pinned **Insights** bar, a 3D masthead and an **Ask AI** chat that answers questions from the module's own data and models.

| Module | Live | What it covers |
|---|---|---|
| Home screen (app) | https://bsilva87921.github.io/probable-atlas/app/ | Launcher for every module, what you follow, the latest readings saved on the device (offline too), the news, today's briefing and a turning 3D globe |
| 1 · Economics | https://bsilva87921.github.io/probable-atlas/ | 214 economies (World Bank, IMF WEO) and 52 FRED series for the US |
| 2 · Finance & markets | https://bsilva87921.github.io/probable-atlas/finance/ | 61 funds, indexes, futures and crypto plus 34 FRED rate, credit and FX series daily since 1990; the S&P 500 since 1928; Shiller data since 1871; French factors since 1926 |

## What's on every page (Atlas 2.0)
- **3D masthead.** Economics: a data globe of 11,000 land points with a spike per country for GDP growth, inflation, unemployment or debt (tap a country to open its profile). Finance: a market skyline, one tower per major market (S&P 500, Nasdaq, Russell 2000, Dow, Europe, Japan, the 10-year yield, the dollar, gold, oil, bitcoin and the VIX) that rises in green for a gain and sinks in red for a loss, sized by the day's move and labeled with it; tap a tower for that market's chart. Phones show the six that matter most. Built with three.js `WebGPURenderer` (WebGPU, falling back to WebGL2 automatically, and to the plain masthead when neither is available); it sleeps off screen and has a **Still** switch. Reduced-motion settings are respected.
- **Insights bar.** A pinned bar at the top that rotates through the readings that matter now (recession odds, nowcast, inflation path, Fed vs the Taylor rule, regime, correction risk, volatility, the curve, valuation, biggest mover). Click one to jump to it, or ask about it. It pauses on hover and can be stepped through by keyboard.
- **Photography, 3D renders and SVG icons.** A NASA night-lights photograph behind the Economics masthead and the home
  screen, Manhattan at dusk behind Finance, a pre-rendered 3D object for each of the twelve modules, and a line-icon set
  (SVG) on the module bar. Photos are served as AVIF with a WebP fallback in several widths, with a blurred placeholder
  painted first so nothing shifts while they load ([`assets/photos`](../assets/photos/), credits in How it works).
- **Home screen as a bento grid.** The two live modules as large tiles with their 3D render and latest readings, the
  briefing, Ask AI, readings and the top story, then the ten modules on the way; frosted-glass tiles over a soft
  aurora, in light and dark. The apps open in dark mode until you switch.
- **Ask AI.** See below.
- **News.** A News tab per module with the latest headlines from official sources (the Federal Reserve, the ECB and BEA) and major outlets (CNBC, MarketWatch, the Financial Times, Investing.com, the BBC, the Guardian, Seeking Alpha, CoinDesk), filtered by topic (markets, Fed and rates, earnings, commodities, crypto, currencies, the economy, official releases; in Economics also growth, inflation, jobs, trade and the country in view) or by source, with search, "What it means" (asks Ask AI) and share. Tapping a story opens it in a reader on the page with its picture, the publisher's summary, related stories and Ask AI; releases from the Federal Reserve Board, BEA and the ECB, which may be reproduced, show in full. The full article is one tap away (inside the app, in an in-app browser). Live now shows the latest five; each market or country profile lists recent headlines about it. Refreshed twice an hour by `.github/workflows/news.yml` (`pipeline/fetch_news.py`).
- **Follow markets and countries.** Star any market or country in its profile: it shows under *Your markets* or *Your countries* on Live now, leads the search, gets a News filter and triggers alerts (Finance: big daily moves and 52-week highs or lows; Economics: new IMF forecasts and fresh headlines). Alerts show in the page and, once turned on, as notifications.
- **Search everything.** `⌘K` / `Ctrl K` or `/`: markets and rates, countries, indicators, US series, sections, charts, headlines and actions, with recent picks and an Ask AI fallback.
- **Today's briefing.** The ring at the left of the Insights bar opens story-style slides with the day's key readings and charts, your markets or countries first, and the top headline; tap to advance, hold to pause, or have it read aloud.
- **Share cards.** Share a market, a country, an insight, a slide or a headline as a 1080×1080 image.
- **Small touches.** Pull to refresh on phones, keyboard shortcuts (`?` lists them), numbers that count up, haptic taps in the apps.
- **Installable app.** A web app manifest and service worker make the suite installable (Install app button, or Add to Home Screen on iPhone and iPad), with offline starts from the last data. The native App Store and Google Play projects are in [`apps/atlas`](../apps/atlas/).
- Smooth tab changes (View Transitions), scroll-in sections and card depth, all switched off under reduced motion.

## Module 2 · Finance & markets
- **Live now:** market pulse, a plain-language read of conditions, four model signals, rule-based alerts, a cross-asset scoreboard, sectors, world markets, the yield curve and the day's biggest movers.
- **Markets:** an explorer for any market or rate (price, growth of $10k, drawdown, volatility, relative to the S&P 500, log scale, up to five series), return distributions and seasonality, a sortable scorecard of every market, a yield-curve time machine, credit spreads, real yields, and a clustered correlation matrix with rolling stock–bond correlation.
- **Models & forecasts**, each with an out-of-sample record:
  - GJR-GARCH volatility and value-at-risk with filtered historical simulation (99% VaR breached on 1.19% of days since 2000; passes Kupiec and Christoffersen tests)
  - a three-state hidden Markov regime model (separates next-month volatility, not returns)
  - Shiller CAPE expected 10-year returns (out-of-sample R² 0.16 since 1940)
  - correction and bear-market risk from ridge logistic regressions (modest skill, reported as such)
  - a 10-month trend rule tested on Kenneth French data back to 1927, a risk-appetite gauge, and a sector rotation map
- **What-if lab:** 11 asset classes with forward-looking or historical return assumptions; efficient frontier, risk parity and risk contributions; a 1,500-path fat-tailed Monte Carlo plan with contributions or withdrawals; ten historical stress tests with rebuilt proxies; factor shock scenarios in which unspecified factors move by their conditional expectation; and a monthly-rebalanced backtest.
- **Recommendations:** evidence cards ranked for a simple investor profile, plus a condition-adjusted starting mix. Educational, not investment advice.

## Ask AI
- **Built-in analyst (everyone, free):** intent matching over the live data and models; it parses scenarios such as "I'm 35 with $50k saving $500 a month, can I reach $1M by 65?" or "What if rates rise 1%?" and runs them.
- **Claude (default once the proxy is on):** on this site and in the apps, every question goes to Claude through the proxy in
  [`ai-proxy/`](ai-proxy/), in the background: no key or setting for the visitor, the answer streams in, and the built-in
  analyst answers quietly whenever Claude is unavailable. One workflow run turns it on (see the proxy README). In the
  Claude-hosted copy, Claude answers through the viewer's own Claude account; a visitor can also use their own API key. Claude gets the page's data and models as tools (snapshot, asset stats, model outputs, portfolio analysis, Monte Carlo, scenarios, history, recommendations, charts, navigation).
- Any page opens the chat with a question from a link: `?ask=Is%20a%20correction%20likely%3F`.

## How it's built
| Piece | Where |
|---|---|
| Economics pipeline (World Bank, IMF, FRED) | `pipeline/fetch_econ.py` |
| News pipeline (official RSS feeds, major outlets, ESPN for the Sports Lab) | `pipeline/fetch_news.py`: standard library only; keeps the previous headlines for any feed that fails; output on the single-commit `news-data` branch |
| Markets pipeline (Yahoo Finance via yfinance, FRED, Shiller, French) | `pipeline/fetch_markets.py`: delta-coded log prices on the NYSE calendar, previous good copy kept for any failed series |
| Schedule | `.github/workflows/atlas-data.yml`: weekday mornings and evenings for everything (each with a backup slot, since GitHub drops some scheduled runs), plus seven runs during US trading hours for markets; output on the single-commit `atlas-data` branch, deployed to `probable-atlas/data/` |
| Shared kit | `source/src/kit-*.js`: formatting, statistics (OLS with robust errors, probit, AUC/Brier, k-means, PCA), SVG charts at real pixel width, tables, theme switch, the Ask AI chat (`kit-chat.js`), the Insights bar (`kit-insights.js`), the 3D loader (`kit-3d.js`), install support (`kit-app.js`), follows and alerts (`kit-favs.js`), search (`kit-search.js`), share cards (`kit-share.js`), briefing stories (`kit-story.js`), news (`kit-news.js`) and small touches (`kit-ux.js`, styles in `kit-x.css`); shared with the Sports Lab |
| 3D scenes | [`assets/probable-3d`](../assets/probable-3d/): globe, market skyline, yield-curve terrain and the Sports Lab scoreboard carousel, one bundle loaded on demand |
| Economics | `source/src/econ-*.js`, `views-*.js`, `econ-fx.js`, `econ-x.js`, `app.js`; build with `python3 source/build.py <data dir>` |
| Finance | `source/src/fin-*.js`, `fin-fx.js`, `fin-x.js`; build with `python3 source/build_fin.py <data dir>` |
| Home screen | `source/src/app-home.*`; build with `python3 source/build_app.py` |
| App shell | `manifest.webmanifest`, `sw.js` (network first for data with a timeout, cached copy offline), `icons/` |

No frameworks beyond three.js for the 3D views; every model runs in the browser on the published data. Analytical and educational, not investment or policy advice.
