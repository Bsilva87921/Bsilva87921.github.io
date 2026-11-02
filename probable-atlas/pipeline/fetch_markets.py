#!/usr/bin/env python3
"""Probable Atlas - markets data pipeline (Module 2: Finance & markets).

Runs on GitHub Actions; every source is free and needs no key:
  * Yahoo Finance daily history for ETFs, indices, futures and crypto (yfinance, then the chart API directly, then Stooq)
  * FRED (Federal Reserve Bank of St. Louis): Treasury curve, real yields, breakevens, policy rates, credit spreads,
    dollar and FX, oil and gas, financial-conditions indexes, plus fallbacks for any Yahoo series that fails
  * Robert Shiller's long-run S&P 500 data (price, dividends, earnings, CPI, CAPE since 1871)
  * Kenneth French data library (US market, size, value, momentum, profitability, investment factors)

Outputs (OUT_DIR):
  markets.json       daily panel since 1990 on the NYSE calendar (prices as delta-coded log levels, rates as delta-coded
                     integers), raw last/previous close for every quoted series, monthly and quarterly macro context
  markets-long.json  S&P 500 daily 1928-1989, Shiller monthly since 1871, French factors monthly since 1926
  mstatus.json       what worked, what fell back, what failed
Any series that fails keeps its previous good copy (PREV_DIR), so the site never goes blank.
"""
import calendar, csv, io, json, math, os, re, sys, time, zipfile, datetime as dt, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

OUT = os.environ.get("OUT_DIR", "out")
PREV = os.environ.get("PREV_DIR", "prev")
START = "1990-01-01"
WORLD_START = "2000-01-01"
LONG_START = "1927-12-30"
BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
           "Accept": "application/json,text/csv,text/html,*/*", "Accept-Language": "en-US,en;q=0.9"}
BOT = {"User-Agent": "ProbableAtlas/1.0 (+https://bsilva87921.github.io/probable-atlas/)", "Accept": "*/*"}
LOG, ERRORS, FALLBACK = [], [], {}


def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    LOG.append(s)


def get(url, headers=BOT, tries=3, timeout=60):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            err = e
            code = getattr(e, "code", None)
            if code in (400, 401, 403, 404):
                break
            time.sleep(1.5 + 2.5 * i)
    raise RuntimeError(f"{url[:110]} -> {err}")


def load_prev(name):
    try:
        with open(os.path.join(PREV, name)) as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return None


# ------------------------------------------------------------------ universe
# symbol, display name, class, group, currency, stooq symbol, FRED fallback
TICKERS = [
    ("^GSPC", "S&P 500 index", "ix", "us", "USD", "^spx", "SP500"),
    ("^IXIC", "Nasdaq Composite", "ix", "us", "USD", "^ndq", "NASDAQCOM"),
    ("^DJI", "Dow Jones Industrial Average", "ix", "us", "USD", "^dji", "DJIA"),
    ("^RUT", "Russell 2000", "ix", "us", "USD", None, None),
    ("^VIX", "VIX (expected S&P 500 volatility, 30 days)", "vol", "us", "USD", None, "VIXCLS"),
    ("^VIX3M", "VIX 3-month", "vol", "us", "USD", None, "VXVCLS"),
    ("^MOVE", "MOVE (expected Treasury volatility)", "vol", "us", "USD", None, None),
    ("SPY", "US stocks (S&P 500)", "eq", "core", "USD", "spy.us", None),
    ("QQQ", "Nasdaq 100", "eq", "core", "USD", "qqq.us", None),
    ("IWM", "US small caps", "eq", "core", "USD", "iwm.us", None),
    ("RSP", "S&P 500 equal weight", "eq", "style", "USD", "rsp.us", None),
    ("IWD", "US large value", "eq", "style", "USD", "iwd.us", None),
    ("IWF", "US large growth", "eq", "style", "USD", "iwf.us", None),
    ("MTUM", "US momentum", "eq", "style", "USD", "mtum.us", None),
    ("QUAL", "US quality", "eq", "style", "USD", "qual.us", None),
    ("USMV", "US minimum volatility", "eq", "style", "USD", "usmv.us", None),
    ("EFA", "Developed markets ex-US", "eq", "core", "USD", "efa.us", None),
    ("EEM", "Emerging markets", "eq", "core", "USD", "eem.us", None),
    ("XLK", "Technology", "eq", "sector", "USD", "xlk.us", None),
    ("XLC", "Communication services", "eq", "sector", "USD", "xlc.us", None),
    ("XLY", "Consumer discretionary", "eq", "sector", "USD", "xly.us", None),
    ("XLF", "Financials", "eq", "sector", "USD", "xlf.us", None),
    ("XLV", "Health care", "eq", "sector", "USD", "xlv.us", None),
    ("XLI", "Industrials", "eq", "sector", "USD", "xli.us", None),
    ("XLP", "Consumer staples", "eq", "sector", "USD", "xlp.us", None),
    ("XLE", "Energy", "eq", "sector", "USD", "xle.us", None),
    ("XLB", "Materials", "eq", "sector", "USD", "xlb.us", None),
    ("XLU", "Utilities", "eq", "sector", "USD", "xlu.us", None),
    ("XLRE", "Real estate", "eq", "sector", "USD", "xlre.us", None),
    ("AGG", "US bonds (aggregate)", "bd", "core", "USD", "agg.us", None),
    ("SHY", "Treasuries 1-3 years", "bd", "core", "USD", "shy.us", None),
    ("IEF", "Treasuries 7-10 years", "bd", "core", "USD", "ief.us", None),
    ("TLT", "Treasuries 20+ years", "bd", "core", "USD", "tlt.us", None),
    ("BIL", "Treasury bills (cash)", "bd", "core", "USD", "bil.us", None),
    ("TIP", "TIPS (inflation-protected)", "bd", "core", "USD", "tip.us", None),
    ("LQD", "Investment-grade corporates", "bd", "core", "USD", "lqd.us", None),
    ("HYG", "High-yield corporates", "bd", "core", "USD", "hyg.us", None),
    ("EMB", "Emerging-market bonds", "bd", "core", "USD", "emb.us", None),
    ("GLD", "Gold", "ra", "core", "USD", "gld.us", None),
    ("SLV", "Silver", "ra", "core", "USD", "slv.us", None),
    ("DBC", "Broad commodities", "ra", "core", "USD", "dbc.us", None),
    ("VNQ", "US real estate (REITs)", "ra", "core", "USD", "vnq.us", None),
    ("GC=F", "Gold futures", "ra", "macro", "USD", "gc.f", None),
    ("CL=F", "WTI crude oil futures", "ra", "macro", "USD", "cl.f", "DCOILWTICO"),
    ("HG=F", "Copper futures", "ra", "macro", "USD", "hg.f", None),
    ("BTC-USD", "Bitcoin", "cx", "core", "USD", "btcusd", "CBBTCUSD"),
    ("ETH-USD", "Ether", "cx", "core", "USD", "ethusd", "CBETHUSD"),
    ("DX-Y.NYB", "US dollar index (DXY)", "fx", "macro", "USD", None, None),
    ("^FTSE", "UK FTSE 100", "ix", "world", "GBP", "^ukx", None),
    ("^GDAXI", "Germany DAX", "ix", "world", "EUR", "^dax", None),
    ("^FCHI", "France CAC 40", "ix", "world", "EUR", "^cac", None),
    ("^STOXX50E", "Euro Stoxx 50", "ix", "world", "EUR", None, None),
    ("^N225", "Japan Nikkei 225", "ix", "world", "JPY", "^nkx", None),
    ("^HSI", "Hong Kong Hang Seng", "ix", "world", "HKD", "^hsi", None),
    ("000001.SS", "China Shanghai Composite", "ix", "world", "CNY", "^shc", None),
    ("^NSEI", "India Nifty 50", "ix", "world", "INR", None, None),
    ("^KS11", "South Korea KOSPI", "ix", "world", "KRW", "^kospi", None),
    ("^AXJO", "Australia ASX 200", "ix", "world", "AUD", None, None),
    ("^GSPTSE", "Canada S&P/TSX", "ix", "world", "CAD", None, None),
    ("^BVSP", "Brazil Bovespa", "ix", "world", "BRL", "^bvp", None),
    ("^MXX", "Mexico IPC", "ix", "world", "MXN", None, None),
]
# FRED daily series kept in the panel: id, name, unit, scale (integer coding), start
FRED_D = [
    ("DGS1MO", "1-month Treasury yield", "%", 100, START), ("DGS3MO", "3-month Treasury yield", "%", 100, START),
    ("DGS6MO", "6-month Treasury yield", "%", 100, START), ("DGS1", "1-year Treasury yield", "%", 100, START),
    ("DGS2", "2-year Treasury yield", "%", 100, START), ("DGS3", "3-year Treasury yield", "%", 100, START),
    ("DGS5", "5-year Treasury yield", "%", 100, START), ("DGS7", "7-year Treasury yield", "%", 100, START),
    ("DGS10", "10-year Treasury yield", "%", 100, START), ("DGS20", "20-year Treasury yield", "%", 100, START),
    ("DGS30", "30-year Treasury yield", "%", 100, START),
    ("DFII5", "5-year real yield (TIPS)", "%", 100, START), ("DFII10", "10-year real yield (TIPS)", "%", 100, START),
    ("T5YIE", "5-year breakeven inflation", "%", 100, START), ("T10YIE", "10-year breakeven inflation", "%", 100, START),
    ("T5YIFR", "5-year, 5-year forward inflation", "%", 100, START),
    ("DFF", "Fed funds rate (effective)", "%", 100, START), ("SOFR", "SOFR (overnight funding)", "%", 100, START),
    ("BAA10Y", "Baa corporate spread over 10-year", "pp", 100, START), ("AAA10Y", "Aaa corporate spread over 10-year", "pp", 100, START),
    ("BAMLH0A0HYM2", "High-yield spread (OAS)", "pp", 100, START), ("BAMLC0A0CM", "Investment-grade spread (OAS)", "pp", 100, START),
    ("DTWEXBGS", "Broad trade-weighted dollar", "index", 10000, START), ("DEXUSEU", "US$ per euro", "$", 10000, START),
    ("DEXJPUS", "Yen per US$", "¥", 100, START), ("DEXUSUK", "US$ per pound", "$", 10000, START),
    ("DEXCHUS", "Yuan per US$", "¥", 10000, START), ("DEXMXUS", "Pesos per US$", "MXN", 10000, START),
    ("DCOILWTICO", "WTI crude oil (spot)", "$/bbl", 100, START), ("DCOILBRENTEU", "Brent crude oil (spot)", "$/bbl", 100, START),
    ("DHHNGSP", "Henry Hub natural gas (spot)", "$/MMBtu", 100, START),
    ("NFCI", "Chicago Fed financial conditions", "index", 1000, START), ("STLFSI4", "St. Louis Fed financial stress", "index", 1000, START),
    ("MORTGAGE30US", "30-year mortgage rate", "%", 100, START),
]
FRED_M = [("USREC", "NBER recession (1 = recession)"), ("CPIAUCSL", "Consumer prices (CPI-U)"), ("UNRATE", "Unemployment rate")]
FRED_Q = [("NCBEILQ027S", "Corporate equities, market value ($ mn)"), ("GDP", "Nominal GDP ($ bn, SAAR)")]


# ------------------------------------------------------------------ price sources -> sorted [(date, close, adjclose)]
def clean_rows(rows):
    by = {}
    for d, c, a in rows:
        if c is None or a is None:
            continue
        try:
            c, a = float(c), float(a)
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(c) and math.isfinite(a)) or c <= 0 or a <= 0:
            continue
        by[d] = (c, a)
    return [(d, by[d][0], by[d][1]) for d in sorted(by)]


def yf_hist(sym, start, end=None):
    import yfinance as yf  # noqa: PLC0415
    kw = dict(start=start, interval="1d", auto_adjust=False, actions=False)
    if end:
        kw["end"] = end
    df = yf.Ticker(sym).history(**kw)
    if df is None or len(df) == 0:
        raise RuntimeError("empty")
    cols = list(df.columns)
    ccol = "Close"
    acol = "Adj Close" if "Adj Close" in cols else "Close"
    rows = [(idx.strftime("%Y-%m-%d"), r[ccol], r[acol]) for idx, r in df.iterrows()]
    return clean_rows(rows)


def epoch(d):
    y, m, dd = map(int, d.split("-"))
    return calendar.timegm((y, m, dd, 0, 0, 0))


def yahoo_chart(sym, start, end=None):
    q = urllib.parse.quote(sym, safe="")
    p2 = epoch(end) if end else int(time.time()) + 86400
    params = f"period1={epoch(start)}&period2={p2}&interval=1d&includeAdjustedClose=true&events=div%2Csplit"
    err = None
    for host in ("query2", "query1"):
        try:
            j = json.loads(get(f"https://{host}.finance.yahoo.com/v8/finance/chart/{q}?{params}", headers=BROWSER, tries=2))
            res = j["chart"]["result"][0]
            ts = res.get("timestamp") or []
            off = res.get("meta", {}).get("gmtoffset", 0) or 0
            cl = res["indicators"]["quote"][0]["close"]
            adj = (res["indicators"].get("adjclose") or [{}])[0].get("adjclose") or cl
            rows = [(dt.datetime.fromtimestamp(t + off, dt.timezone.utc).strftime("%Y-%m-%d"), c, a) for t, c, a in zip(ts, cl, adj)]
            rows = clean_rows(rows)
            if rows:
                return rows
            err = "empty"
        except Exception as e:  # noqa: BLE001
            err = e
    raise RuntimeError(f"chart api: {err}")


def stooq(code):
    raw = get(f"https://stooq.com/q/d/l/?s={urllib.parse.quote(code, safe='^.')}&i=d", headers=BROWSER, tries=2).decode("utf-8", "replace")
    if not raw.startswith("Date"):
        raise RuntimeError("stooq: " + raw[:60].replace("\n", " "))
    rows = []
    for r in csv.DictReader(io.StringIO(raw)):
        rows.append((r["Date"], r.get("Close"), r.get("Close")))
    rows = clean_rows(rows)
    if not rows:
        raise RuntimeError("stooq: empty")
    return rows


def fred_csv(sid, start=None):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}" + (f"&cosd={start}" if start else "")
    raw = get(url, timeout=90).decode("utf-8", "replace")
    rows = list(csv.reader(io.StringIO(raw)))
    if not rows or len(rows[0]) < 2:
        raise RuntimeError(f"FRED {sid}: bad csv {raw[:80]}")
    out = []
    for r in rows[1:]:
        if len(r) < 2 or not r[0] or r[1] in (".", ""):
            continue
        try:
            out.append((r[0][:10], float(r[1])))
        except ValueError:
            continue
    if not out:
        raise RuntimeError(f"FRED {sid}: no observations")
    return out


HAVE_YF = True
try:
    import yfinance  # noqa: F401
except Exception:  # noqa: BLE001
    HAVE_YF = False


def fetch_symbol(t):
    sym, _n, _c, grp, _cur, stq, fred_fb = t
    start = LONG_START if sym == "^GSPC" else (WORLD_START if grp == "world" else START)
    errs = []
    if HAVE_YF:
        for attempt in range(2):
            try:
                return yf_hist(sym, start), "yfinance"
            except Exception as e:  # noqa: BLE001
                errs.append(f"yf: {str(e)[:80]}")
                time.sleep(1 + 2 * attempt)
    try:
        return yahoo_chart(sym, start), "yahoo-chart"
    except Exception as e:  # noqa: BLE001
        errs.append(str(e)[:100])
    if stq:
        try:
            return [r for r in stooq(stq) if r[0] >= start], "stooq"
        except Exception as e:  # noqa: BLE001
            errs.append(str(e)[:100])
    if fred_fb:
        try:
            return [(d, v, v) for d, v in fred_csv(fred_fb, start) if v > 0], "fred:" + fred_fb
        except Exception as e:  # noqa: BLE001
            errs.append(str(e)[:100])
    raise RuntimeError(" | ".join(errs))


# ------------------------------------------------------------------ long-run monthly sources
def shiller():
    import xlrd  # noqa: PLC0415
    urls = []
    try:
        html = get("https://shillerdata.com/", headers=BROWSER, tries=2).decode("utf-8", "replace")
        urls += [u.replace("&amp;", "&") for u in re.findall(r'href="([^"]*ie_data\.xls[^"]*)"', html)]
        urls = [("https:" + u if u.startswith("//") else u) for u in urls]
    except Exception as e:  # noqa: BLE001
        log("shillerdata.com page:", e)
    urls += ["https://www.econ.yale.edu/~shiller/data/ie_data.xls", "http://www.econ.yale.edu/~shiller/data/ie_data.xls"]
    last = None
    for u in urls:
        try:
            raw = get(u, headers=BROWSER, tries=2, timeout=120)
            book = xlrd.open_workbook(file_contents=raw)
            sh = book.sheet_by_name("Data") if "Data" in book.sheet_names() else book.sheet_by_index(0)
            return parse_shiller(sh), u
        except Exception as e:  # noqa: BLE001
            last = e
            log("shiller", u[:80], e)
    raise RuntimeError(f"shiller: {last}")


def parse_shiller(sh):
    hdr_row = None
    for r in range(min(sh.nrows, 20)):
        if str(sh.cell_value(r, 0)).strip().lower() == "date":
            hdr_row = r
            break
    if hdr_row is None:
        raise RuntimeError("no header row")
    labels = []
    for c in range(sh.ncols):
        parts = [str(sh.cell_value(r, c)).strip() for r in range(max(0, hdr_row - 2), hdr_row + 1)]
        labels.append(" ".join(p for p in parts if p).lower())

    def col(*keys, default=None):
        for c, lab in enumerate(labels):
            if all(k in lab for k in keys):
                return c
        return default
    idx = {"P": col("p", default=1), "D": col("d", default=2), "E": col("e", default=3), "CPI": col("cpi", default=4),
           "GS10": col("rate", default=6), "CAPE": col("cape", default=12), "TRP": col("total return price", default=9)}
    # make sure P/D/E point at the first columns (single-letter headers are ambiguous)
    idx["P"], idx["D"], idx["E"], idx["CPI"] = 1, 2, 3, 4
    tr_cape = col("tr cape")
    if tr_cape is not None and idx["CAPE"] == tr_cape:
        idx["CAPE"] = 12
    rows = []
    for r in range(hdr_row + 1, sh.nrows):
        d = sh.cell_value(r, 0)
        if not isinstance(d, float):
            try:
                d = float(str(d))
            except ValueError:
                continue
        y = int(d)
        m = int(round((d - y) * 100))
        if not (1 <= m <= 12) or y < 1871:
            continue
        rec = {"ym": f"{y:04d}-{m:02d}"}
        for k, c in idx.items():
            try:
                v = sh.cell_value(r, c)
                rec[k] = float(v) if v not in ("", "NA") else None
            except Exception:  # noqa: BLE001
                rec[k] = None
        rows.append(rec)
    if len(rows) < 1000:
        raise RuntimeError(f"too few rows ({len(rows)})")
    rows.sort(key=lambda x: x["ym"])
    out = {"s": rows[0]["ym"], "e": rows[-1]["ym"]}
    dec = {"P": 2, "D": 3, "E": 3, "CPI": 3, "GS10": 2, "CAPE": 2, "TRP": 2}
    for k in idx:
        vals = [rec[k] for rec in rows]
        while vals and vals[-1] is None:
            vals.pop()
        out[k] = [None if v is None or not math.isfinite(v) else round(v, dec[k]) for v in vals]
    return out


FF_BASE = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/"


def ff_zip(name):
    raw = get(FF_BASE + name, headers=BROWSER, timeout=120)
    z = zipfile.ZipFile(io.BytesIO(raw))
    txt = z.read(z.namelist()[0]).decode("latin-1")
    lines = txt.splitlines()
    head, rows = None, []
    for ln in lines:
        parts = [p.strip() for p in ln.split(",")]
        if head is None and len(parts) > 1 and parts[0] == "" and any(p for p in parts[1:]):
            head = parts[1:]
            continue
        if head is not None:
            if re.fullmatch(r"\d{6}", parts[0] or ""):
                rows.append(parts)
            elif rows:
                break  # end of the monthly block (annual block follows)
    if not head or not rows:
        raise RuntimeError(f"french {name}: unparsed")
    out = {"s": rows[0][0][:4] + "-" + rows[0][0][4:6]}
    for j, h in enumerate(head):
        key = {"Mkt-RF": "MKT", "Mom": "MOM"}.get(h, h)
        vals = []
        for r in rows:
            try:
                v = float(r[j + 1])
                vals.append(None if v <= -99 else round(v, 3))
            except (ValueError, IndexError):
                vals.append(None)
        out[key] = vals
    return out


def french():
    f3 = ff_zip("F-F_Research_Data_Factors_CSV.zip")
    res = {"f3": f3}
    for key, name in (("mom", "F-F_Momentum_Factor_CSV.zip"), ("f5", "F-F_Research_Data_5_Factors_2x3_CSV.zip")):
        try:
            res[key] = ff_zip(name)
        except Exception as e:  # noqa: BLE001
            ERRORS.append(f"French {key}: {e}")
    return res


# ------------------------------------------------------------------ panel coding
B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def day_num(d):
    return dt.date.fromisoformat(d).toordinal()


def enc_cal(dates):
    gaps = []
    for a, b in zip(dates, dates[1:]):
        g = day_num(b) - day_num(a)
        gaps.append(B36[g] if 0 < g < 36 else "z")
    return {"d0": dates[0], "g": "".join(gaps)}


def dec_cal(c):
    out = [c["d0"]]
    n = day_num(c["d0"])
    for ch in c["g"]:
        n += B36.index(ch)
        out.append(dt.date.fromordinal(n).isoformat())
    return out


def align(cal, rows, max_stale=10):
    """rows: sorted [(date, value)]. Returns (start_index, values) forward-filled onto cal, stopping max_stale days after the last real value."""
    if not rows:
        return None, []
    last_n = day_num(rows[-1][0])
    out, s, j, cur = [], None, 0, None
    for i, d in enumerate(cal):
        while j < len(rows) and rows[j][0] <= d:
            cur = rows[j][1]
            j += 1
        if cur is None:
            continue
        if day_num(d) - last_n > max_stale:
            break
        if s is None:
            s = i
        out.append(cur)
    return s, out


def enc_series(vals, kind, k=None):
    out, prev = [], 0
    for v in vals:
        q = round(math.log(v) * 1e4) if kind == "l" else round(v * k)
        out.append(q - prev)
        prev = q
    return out


def dec_series(ser):
    out, acc = [], 0
    for x in ser["d"]:
        acc += x
        out.append(math.exp(acc / 1e4) if ser["e"] == "l" else acc / ser["k"])
    return out


def prev_rows(prev_panel, key):
    """Decode a series from the previous panel back to [(date, value)] so it can be kept if today's fetch fails."""
    try:
        cal = dec_cal(prev_panel["cal"])
        ser = prev_panel["s"][key]
        vals = dec_series(ser)
        return [(cal[ser["s"] + i], v) for i, v in enumerate(vals)]
    except Exception:  # noqa: BLE001
        return None


def run_many(fn, items, workers=6):
    res = {}

    def one(it):
        try:
            return it, fn(it), None
        except Exception as e:  # noqa: BLE001
            return it, None, str(e)[:400]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for it, val, err in ex.map(one, items):
            res[it] = (val, err)
    return res


def ym_add(s, k):
    y, m = int(s[:4]), int(s[5:7]) - 1 + k
    return f"{y + m // 12:04d}-{m % 12 + 1:02d}"


def monthly(obs):
    """[(date, v)] -> {"s": "YYYY-MM", "v": [...]} using the month of each observation (last one wins)."""
    by = {}
    for d, v in obs:
        by[d[:7]] = v
    ks = sorted(by)
    s, e = ks[0], ks[-1]
    vals, cur = [], s
    while cur <= e:
        v = by.get(cur)
        vals.append(None if v is None else round(v, 4))
        cur = ym_add(cur, 1)
    return {"s": s, "v": vals}


# ------------------------------------------------------------------ main
def main():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    prev_panel = load_prev("markets.json") or {}
    prev_long = load_prev("markets-long.json") or {}
    status = {"fetched_at": now, "yfinance": HAVE_YF, "sources": {}, "errors": ERRORS, "fallback": FALLBACK}

    # 1) prices
    rows, quotes, got = {}, {}, 0
    workers = 3 if HAVE_YF else 4
    res = run_many(fetch_symbol, TICKERS, workers=workers)
    for t in TICKERS:
        sym = t[0]
        val, err = res[t]
        if val:
            data, src = val
            got += 1
            if src != "yfinance":
                FALLBACK[sym] = src
            rows[sym] = [(d, a) for d, c, a in data]
            raw = [(d, c) for d, c, a in data]
            quotes[sym] = [round(raw[-1][1], 4), round(raw[-2][1], 4) if len(raw) > 1 else None, raw[-1][0]]
        else:
            ERRORS.append(f"{sym}: {err}")
            pr = prev_rows(prev_panel, sym)
            if pr:
                rows[sym] = pr
                quotes[sym] = (prev_panel.get("q") or {}).get(sym)
                FALLBACK[sym] = "previous copy"
    status["sources"]["Yahoo Finance"] = f"{got}/{len(TICKERS)}"
    log("prices", status["sources"]["Yahoo Finance"], f"{time.time() - t0:.0f}s")

    # 2) FRED
    fred_rows, ok = {}, 0
    fres = run_many(lambda f: fred_csv(f[0], f[4]), FRED_D, workers=4)
    for f in FRED_D:
        val, err = fres[f]
        if val:
            fred_rows[f[0]] = val
            ok += 1
        else:
            ERRORS.append(f"FRED {f[0]}: {err}")
            pr = prev_rows(prev_panel, f[0])
            if pr:
                fred_rows[f[0]] = pr
    status["sources"]["FRED daily"] = f"{ok}/{len(FRED_D)}"
    macro = {"m": {}, "q": {}}
    for blk, lst in (("m", FRED_M), ("q", FRED_Q)):
        r2 = run_many(lambda f: fred_csv(f[0], "1947-01-01"), lst, workers=3)
        n_ok = 0
        for f in lst:
            val, err = r2[f]
            if val:
                macro[blk][f[0]] = monthly(val)
                n_ok += 1
            else:
                ERRORS.append(f"FRED {f[0]}: {err}")
                old = ((prev_panel.get("macro") or {}).get(blk) or {}).get(f[0])
                if old:
                    macro[blk][f[0]] = old
        status["sources"]["FRED " + ("monthly" if blk == "m" else "quarterly")] = f"{n_ok}/{len(lst)}"
    log("fred done", f"{time.time() - t0:.0f}s")

    # 3) calendar = S&P 500 trading days since 1990 (fallback SPY, then previous)
    master = rows.get("^GSPC") or rows.get("SPY")
    if not master:
        if prev_panel:
            log("no master calendar; keeping previous panel")
            ERRORS.append("no calendar series; previous panel kept")
            json.dump(prev_panel, open(os.path.join(OUT, "markets.json"), "w"), separators=(",", ":"))
            master = None
        else:
            json.dump(status, open(os.path.join(OUT, "mstatus.json"), "w"))
            sys.exit(1)
    long_gspc = None
    if master:
        cal = [d for d, _ in master if d >= "1990-01-02"]
        today = dt.date.today().isoformat()
        cal = [d for d in cal if d <= today]
        panel = {"fetched_at": now, "cal": enc_cal(cal), "s": {}, "q": {}, "meta": {}, "fred": {}, "macro": macro}
        for t in TICKERS:
            sym = t[0]
            if sym not in rows:
                continue
            s, vals = align(cal, rows[sym])
            if s is None or len(vals) < 5:
                continue
            panel["s"][sym] = {"s": s, "e": "l", "d": enc_series(vals, "l")}
            panel["q"][sym] = quotes.get(sym)
            panel["meta"][sym] = [t[1], t[2], t[3], t[4]]
        for sid, name, unit, k, _st in FRED_D:
            if sid not in fred_rows:
                continue
            s, vals = align(cal, fred_rows[sid], max_stale=21 if sid in ("NFCI", "STLFSI4", "MORTGAGE30US") else 10)
            if s is None or len(vals) < 5:
                continue
            panel["s"][sid] = {"s": s, "e": "a", "k": k, "d": enc_series(vals, "a", k)}
            last = fred_rows[sid][-1]
            prevv = fred_rows[sid][-2] if len(fred_rows[sid]) > 1 else (None, None)
            panel["q"][sid] = [last[1], prevv[1], last[0]]
            panel["fred"][sid] = [name, unit]
        with open(os.path.join(OUT, "markets.json"), "w") as f:
            json.dump(panel, f, separators=(",", ":"))
        log("markets.json", os.path.getsize(os.path.join(OUT, "markets.json")), "bytes;", len(cal), "days;", len(panel["s"]), "series")
        g = [(d, v) for d, v in master if d < "1990-01-02"] if rows.get("^GSPC") else []
        if len(g) > 1000:
            long_gspc = {"cal": enc_cal([d for d, _ in g]), "d": enc_series([v for _, v in g], "l")}

    # 4) long-run monthly: Shiller + French
    long = {"fetched_at": now}
    long["gspc"] = long_gspc or prev_long.get("gspc")
    if not long_gspc:
        ERRORS.append("S&P 500 1928-1989 daily: kept previous copy" if prev_long.get("gspc") else "S&P 500 1928-1989 daily: unavailable")
    try:
        long["shiller"], u = shiller()
        status["sources"]["Shiller"] = "ok " + long["shiller"]["e"]
        long["shiller_src"] = u
    except Exception as e:  # noqa: BLE001
        ERRORS.append(f"Shiller: {e}")
        long["shiller"] = prev_long.get("shiller")
        status["sources"]["Shiller"] = "previous copy" if long["shiller"] else "failed"
    try:
        long["ff"] = french()
        status["sources"]["Kenneth French"] = "ok " + long["ff"]["f3"]["s"]
    except Exception as e:  # noqa: BLE001
        ERRORS.append(f"French: {e}")
        long["ff"] = prev_long.get("ff")
        status["sources"]["Kenneth French"] = "previous copy" if long["ff"] else "failed"
    with open(os.path.join(OUT, "markets-long.json"), "w") as f:
        json.dump(long, f, separators=(",", ":"))
    log("markets-long.json", os.path.getsize(os.path.join(OUT, "markets-long.json")), "bytes")

    status["seconds"] = round(time.time() - t0)
    status["log"] = LOG[-60:]
    with open(os.path.join(OUT, "mstatus.json"), "w") as f:
        json.dump(status, f, separators=(",", ":"))
    log(json.dumps(status["sources"]))
    log("errors:", len(ERRORS), "fallbacks:", json.dumps(FALLBACK)[:400])


def selftest():
    import random
    random.seed(3)
    d0 = dt.date(1990, 1, 2)
    cal = []
    d = d0
    while len(cal) < 400:
        if d.weekday() < 5:
            cal.append(d.isoformat())
        d += dt.timedelta(days=1)
    c = enc_cal(cal)
    assert dec_cal(c) == cal, "calendar roundtrip"
    px, p = [], 100.0
    for _ in cal:
        p *= math.exp(random.gauss(0.0003, 0.012))
        px.append(p)
    rows = list(zip(cal, px))
    s, vals = align(cal, rows[50:])
    assert s == 50 and len(vals) == len(cal) - 50
    ser = {"s": s, "e": "l", "d": enc_series(vals, "l")}
    back = dec_series(ser)
    err = max(abs(a / b - 1) for a, b in zip(back, vals))
    assert err < 1e-4, err
    ys = [round(random.uniform(-1, 6), 2) for _ in cal]
    ser2 = {"s": 0, "e": "a", "k": 100, "d": enc_series(ys, "a", 100)}
    assert max(abs(a - b) for a, b in zip(dec_series(ser2), ys)) < 1e-9
    # forward fill + staleness cut
    sparse = [r for i, r in enumerate(rows) if i % 3 == 0][:100]
    s3, v3 = align(cal, sparse)
    assert s3 == 0 and len(v3) <= 300 + 10
    print("selftest ok; max log-coding error", f"{err:.2e}")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        main()
