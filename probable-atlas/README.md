# Probable Atlas

A series of world-domain analytics dashboards by Bruno Silva, built on the approach of the [Probable Sports Lab](../live-sports-lab/). Each module has the same seven tabs (Live now, data explorer, Models & forecasts, What-if lab, Recommendations, History, How it works), a light/dark switch, and an **Ask Atlas** chat that answers questions from the module's own data and models.

| Module | Live | What it covers |
|---|---|---|
| 1 · Economics | https://bsilva87921.github.io/probable-atlas/ | 214 economies (World Bank, IMF WEO) and 52 FRED series for the US |
| 2 · Finance & markets | https://bsilva87921.github.io/probable-atlas/finance/ | 61 funds, indexes, futures and crypto plus 34 FRED rate, credit and FX series daily since 1990; the S&P 500 since 1928; Shiller data since 1871; French factors since 1926 |

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

## Ask Atlas
- **Built-in analyst (everyone, free):** intent matching over the live data and models; it parses scenarios such as "I'm 35 with $50k saving $500 a month, can I reach $1M by 65?" or "What if rates rise 1%?" and runs them.
- **Claude:** in the Claude-hosted copy, through the viewer's own Claude account; on this site, through the optional proxy in [`ai-proxy/`](ai-proxy/) (set its URL in `ai-config.js`) or a visitor's own API key. Claude gets the page's data and models as tools (snapshot, asset stats, model outputs, portfolio analysis, Monte Carlo, scenarios, history, recommendations, charts, navigation).

## How it's built
| Piece | Where |
|---|---|
| Economics pipeline (World Bank, IMF, FRED) | `pipeline/fetch_econ.py` |
| Markets pipeline (Yahoo Finance via yfinance, FRED, Shiller, French) | `pipeline/fetch_markets.py`: delta-coded log prices on the NYSE calendar, previous good copy kept for any failed series |
| Schedule | `.github/workflows/atlas-data.yml`: weekday mornings and evenings for everything, plus four runs during US trading hours for markets; output on the single-commit `atlas-data` branch, deployed to `probable-atlas/data/` |
| Shared kit | `source/src/kit-*.js`: formatting, statistics (OLS with robust errors, probit, AUC/Brier, k-means, PCA), SVG charts at real pixel width (log scales, zones, overlays, dials), tables, theme switch, Ask Atlas chat |
| Economics | `source/src/econ-*.js`, `views-*.js`, `app.js`; build with `python3 source/build.py <data dir>` |
| Finance | `source/src/fin-*.js`; build with `python3 source/build_fin.py <data dir>` |

No frameworks; every model runs in the browser on the published data. Analytical and educational, not investment or policy advice.
