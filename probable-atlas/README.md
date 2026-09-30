# Probable Atlas · Economics

Module 1 of **Probable Atlas**, a series of world-domain analytics dashboards by Bruno Silva, built on the approach of the [Probable Sports Lab](../live-sports-lab/).

**Live:** https://bsilva87921.github.io/probable-atlas/

## What it does
- **Live now:** world and US headline indicators, a choropleth world map, rule-based alerts, the latest US data releases and daily market pulse.
- **Indicators:** 34 indicators for 214 economies (Table / Chart / Heat map), a 52-series US explorer with recession shading, and country-versus-peer explorers.
- **Models & forecasts:** US recession probability (yield-curve probit, out-of-sample tested since 1985), a GDP nowcast (bridge equation benchmarked against the Atlanta Fed's GDPNow), 1–12 month inflation forecasts with backtests, the Taylor rule, country contraction risk, Monte Carlo growth and debt fans, k-means archetypes and anomaly detection.
- **What-if lab:** a US macro scenario (rates, credit conditions, oil, expectations), a growth-levers simulator and a public-debt simulator.
- **Recommendations:** ranked improvements from a cross-country panel regression and debt arithmetic, each with evidence, an impact range, trade-offs and a confidence level.
- **History** and **How it works** (sources, methods, accuracy and limits).

## How it's built
| Piece | Where |
|---|---|
| Data pipeline (World Bank, IMF WEO DataMapper, FRED) | `pipeline/fetch_econ.py`, run by `.github/workflows/atlas-data.yml` twice a day; output lives on the single-commit `atlas-data` branch and is deployed to `probable-atlas/data/` |
| Shared kit (reused by every Atlas module) | `source/src/kit-*.js`: DOM and formatting, statistics toolkit (OLS with robust errors, probit, AUC/Brier, k-means, PCA), SVG charts drawn at real pixel width, tables with chart and heat-map views, recommendation cards |
| Economics module | `source/src/econ-*.js` (data layer and models) and `source/src/views-*.js` (the seven tabs) |
| Build | `python3 source/build.py <data dir>` concatenates everything into the single-file `index.html` |

No frameworks or external scripts; every model runs in the browser on the published data. Analytical and educational, not investment or policy advice.
