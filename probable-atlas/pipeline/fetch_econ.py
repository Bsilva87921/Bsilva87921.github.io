#!/usr/bin/env python3
"""Probable Atlas - economics data pipeline.

Runs on GitHub Actions (the sources are free and need no keys). Pulls:
  * World Bank World Development Indicators + Worldwide Governance Indicators (all economies, 1970-latest)
  * IMF World Economic Outlook via the DataMapper API (history + projections)
  * FRED (Federal Reserve Bank of St. Louis) public CSV downloads for the US deep dive

Writes compact JSON to OUT_DIR (default ./out): world.json, us.json, status.json.
If a source fails, the previous good copy (PREV_DIR) is kept for that series so the site never goes blank.
"""
import csv, io, json, os, sys, time, datetime as dt, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

OUT = os.environ.get("OUT_DIR", "out")
PREV = os.environ.get("PREV_DIR", "prev")
UA = {"User-Agent": "ProbableAtlas/1.0 (+https://bsilva87921.github.io/probable-atlas/)", "Accept": "*/*"}
LOG = []

def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    LOG.append(s)

def get(url, tries=4, timeout=60):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            err = e
            time.sleep(2 + 3 * i)
    raise RuntimeError(f"{url} -> {err}")

def rnd(x, nd=3):
    if x is None:
        return None
    try:
        x = float(x)
    except Exception:
        return None
    if x != x:
        return None
    a = abs(x)
    if a >= 1e5:
        return round(x)
    if a >= 100:
        return round(x, 1)
    if a >= 1:
        return round(x, 2)
    return round(x, nd)

def load_prev(name):
    p = os.path.join(PREV, name)
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None

# ---------------------------------------------------------------- World Bank
WB_Y0 = 1970
WB = {
    # growth, size, prices
    "NY.GDP.MKTP.KD.ZG": "Real GDP growth (%)",
    "NY.GDP.PCAP.KD.ZG": "Real GDP per capita growth (%)",
    "NY.GDP.MKTP.CD": "GDP (current US$)",
    "NY.GDP.PCAP.CD": "GDP per capita (current US$)",
    "NY.GDP.PCAP.PP.KD": "GDP per capita, PPP (constant intl $)",
    "FP.CPI.TOTL.ZG": "Inflation, consumer prices (%)",
    "NY.GDP.DEFL.KD.ZG": "Inflation, GDP deflator (%)",
    "SL.UEM.TOTL.ZS": "Unemployment (% of labor force)",
    "SL.UEM.1524.ZS": "Youth unemployment (% ages 15-24)",
    # demand mix, openness, external
    "NE.GDI.TOTL.ZS": "Investment (gross capital formation, % GDP)",
    "NY.GNS.ICTR.ZS": "Gross savings (% GDP)",
    "NE.TRD.GNFS.ZS": "Trade (% GDP)",
    "NE.EXP.GNFS.ZS": "Exports (% GDP)",
    "BN.CAB.XOKA.GD.ZS": "Current account balance (% GDP)",
    "BX.KLT.DINV.WD.GD.ZS": "FDI net inflows (% GDP)",
    "FI.RES.TOTL.MO": "Reserves (months of imports)",
    "DT.DOD.DECT.GN.ZS": "External debt (% GNI)",
    "FR.INR.RINR": "Real interest rate (%)",
    "FS.AST.PRVT.GD.ZS": "Private credit (% GDP)",
    # fiscal
    "GC.TAX.TOTL.GD.ZS": "Tax revenue (% GDP)",
    # structure, people, capability
    "NV.IND.MANF.ZS": "Manufacturing (% GDP)",
    "NV.SRV.TOTL.ZS": "Services (% GDP)",
    "NV.AGR.TOTL.ZS": "Agriculture (% GDP)",
    "SP.POP.TOTL": "Population",
    "SP.POP.GROW": "Population growth (%)",
    "SP.POP.1564.TO.ZS": "Working-age population (% of total)",
    "SL.TLF.CACT.ZS": "Labor force participation (% 15+)",
    "SL.TLF.CACT.FE.ZS": "Female labor force participation (% 15+)",
    "GB.XPD.RSDV.GD.ZS": "R&D spending (% GDP)",
    "SE.TER.ENRR": "Tertiary enrollment (% gross)",
    "SE.XPD.TOTL.GD.ZS": "Education spending (% GDP)",
    "IT.NET.USER.ZS": "Internet users (% population)",
    "SI.POV.GINI": "Gini index",
    "SI.POV.DDAY": "Extreme poverty ($3/day, % population)",
    "SP.DYN.LE00.IN": "Life expectancy (years)",
    "EG.ELC.ACCS.ZS": "Access to electricity (%)",
}
WGI = {  # Worldwide Governance Indicators, estimate scale about -2.5..2.5 (source 3)
    "GE.EST": "Government effectiveness",
    "RL.EST": "Rule of law",
    "CC.EST": "Control of corruption",
    "RQ.EST": "Regulatory quality",
    "PV.EST": "Political stability",
    "VA.EST": "Voice and accountability",
}

def wb_countries():
    js = json.loads(get("https://api.worldbank.org/v2/country?format=json&per_page=400"))
    out = {}
    for c in js[1]:
        iso = c.get("id")
        if not iso:
            continue
        agg = (c.get("region") or {}).get("id") in ("NA", "") or (c.get("region") or {}).get("value") == "Aggregates"
        out[iso] = {
            "n": c.get("name"),
            "r": (c.get("region") or {}).get("value", "").strip(),
            "rid": (c.get("region") or {}).get("id", ""),
            "inc": (c.get("incomeLevel") or {}).get("value", "").strip(),
            "iid": (c.get("incomeLevel") or {}).get("id", ""),
            "cap": c.get("capitalCity") or "",
            "lat": rnd(c.get("latitude")) if c.get("latitude") else None,
            "lon": rnd(c.get("longitude")) if c.get("longitude") else None,
            "agg": 1 if agg else 0,
        }
    return out

def wb_indicator(code, source=None):
    y1 = dt.date.today().year
    url = f"https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date={WB_Y0}:{y1}"
    if source:
        url += f"&source={source}"
    rows, page = [], 1
    while True:
        js = json.loads(get(url + f"&page={page}"))
        if not isinstance(js, list) or len(js) < 2 or js[1] is None:
            if page == 1:
                raise RuntimeError(f"WB {code}: empty response {str(js)[:200]}")
            break
        rows += js[1]
        if page >= int(js[0].get("pages", 1)):
            break
        page += 1
    data, last = {}, {}
    for r in rows:
        iso = r.get("countryiso3code") or (r.get("country") or {}).get("id")
        if not iso or r.get("value") is None:
            continue
        y = int(r["date"])
        data.setdefault(iso, {})[y] = rnd(r["value"])
        if r.get("lastupdated"):
            last[code] = r.get("lastupdated")
    y1 = max((max(d) for d in data.values()), default=WB_Y0)
    packed = {}
    for iso, d in data.items():
        arr = [d.get(y) for y in range(WB_Y0, y1 + 1)]
        while arr and arr[-1] is None:
            arr.pop()
        if any(v is not None for v in arr):
            packed[iso] = arr
    return {"y0": WB_Y0, "d": packed, "upd": last.get(code, "")}

# ---------------------------------------------------------------- IMF WEO (DataMapper)
IMF = {
    "NGDP_RPCH": "Real GDP growth (%)",
    "NGDPD": "GDP (current US$ billions)",
    "NGDPDPC": "GDP per capita (current US$)",
    "PPPGDP": "GDP, PPP (intl $ billions)",
    "PPPPC": "GDP per capita, PPP (intl $)",
    "PPPSH": "Share of world GDP, PPP (%)",
    "PCPIPCH": "Inflation, average consumer prices (%)",
    "PCPIEPCH": "Inflation, end of period (%)",
    "LUR": "Unemployment rate (%)",
    "GGXWDG_NGDP": "Government gross debt (% GDP)",
    "GGXCNL_NGDP": "Government net lending/borrowing (% GDP)",
    "GGXONLB_NGDP": "Government primary net lending/borrowing (% GDP)",
    "GGR_NGDP": "Government revenue (% GDP)",
    "GGX_NGDP": "Government expenditure (% GDP)",
    "BCA_NGDPD": "Current account balance (% GDP)",
    "LP": "Population (millions)",
}
IMF_Y0 = 1980

def imf_indicator(code):
    js = json.loads(get(f"https://www.imf.org/external/datamapper/api/v1/{code}", timeout=90))
    vals = (js.get("values") or {}).get(code) or {}
    if not vals:
        raise RuntimeError(f"IMF {code}: no values")
    y1 = max(int(y) for d in vals.values() for y in d)
    packed = {}
    for iso, d in vals.items():
        arr = [rnd(d.get(str(y))) for y in range(IMF_Y0, y1 + 1)]
        while arr and arr[-1] is None:
            arr.pop()
        if any(v is not None for v in arr):
            packed[iso] = arr
    return {"y0": IMF_Y0, "d": packed}

def imf_meta():
    out = {"countries": {}, "groups": {}, "source": ""}
    try:
        js = json.loads(get("https://www.imf.org/external/datamapper/api/v1/countries"))
        out["countries"] = {k: (v or {}).get("label") for k, v in (js.get("countries") or {}).items()}
    except Exception as e:
        log("IMF countries meta failed", e)
    for kind in ("groups", "regions"):
        try:
            js = json.loads(get(f"https://www.imf.org/external/datamapper/api/v1/{kind}"))
            for k, v in (js.get(kind) or {}).items():
                out["groups"][k] = (v or {}).get("label")
        except Exception as e:
            log(f"IMF {kind} meta failed", e)
    try:
        js = json.loads(get("https://www.imf.org/external/datamapper/api/v1/indicators"))
        ind = (js.get("indicators") or {}).get("NGDP_RPCH") or {}
        out["source"] = ind.get("source") or ind.get("dataset") or ""
    except Exception as e:
        log("IMF indicators meta failed", e)
    return out

# ---------------------------------------------------------------- FRED (US)
# id: (label, units, native frequency, how to store)  store: m = monthly, q = quarterly, a = annual,
# d = daily/weekly (monthly average history + last ~2y of raw observations)
FRED = {
    "A191RL1Q225SBEA": ("Real GDP growth (annualized)", "%", "q"),
    "GDPC1": ("Real GDP", "bn 2017 $", "q"),
    "GDPPOT": ("Potential GDP (CBO)", "bn 2017 $", "q"),
    "GDPNOW": ("Atlanta Fed GDPNow", "%", "q"),
    "PCEC96": ("Real consumer spending", "bn 2017 $", "m"),
    "W875RX1": ("Real personal income ex transfers", "bn 2017 $", "m"),
    "INDPRO": ("Industrial production", "index", "m"),
    "TCU": ("Capacity utilization", "%", "m"),
    "RRSFS": ("Real retail sales", "mn 1982-84 $", "m"),
    "RSAFS": ("Retail sales", "mn $", "m"),
    "HOUST": ("Housing starts", "thous., SAAR", "m"),
    "PERMIT": ("Building permits", "thous., SAAR", "m"),
    "UMCSENT": ("Consumer sentiment (U. Michigan)", "index", "m"),
    "MICH": ("Expected inflation, 1 year (U. Michigan)", "%", "m"),
    "CPIAUCSL": ("CPI, all items", "index", "m"),
    "CPILFESL": ("Core CPI", "index", "m"),
    "PCEPI": ("PCE prices", "index", "m"),
    "PCEPILFE": ("Core PCE prices", "index", "m"),
    "UNRATE": ("Unemployment rate", "%", "m"),
    "U6RATE": ("Underemployment rate (U-6)", "%", "m"),
    "PAYEMS": ("Nonfarm payrolls", "thous.", "m"),
    "CIVPART": ("Labor force participation", "%", "m"),
    "LNS12300060": ("Prime-age employment rate (25-54)", "%", "m"),
    "JTSJOL": ("Job openings", "thous.", "m"),
    "AHETPI": ("Average hourly earnings (production)", "$", "m"),
    "SAHMREALTIME": ("Sahm rule indicator", "pp", "m"),
    "NROU": ("Natural rate of unemployment (CBO)", "%", "q"),
    "USREC": ("NBER recession indicator", "0/1", "m"),
    "FEDFUNDS": ("Fed funds rate", "%", "m"),
    "DFF": ("Fed funds rate (daily)", "%", "d"),
    "DGS3MO": ("3-month Treasury yield", "%", "d"),
    "DGS2": ("2-year Treasury yield", "%", "d"),
    "DGS10": ("10-year Treasury yield", "%", "d"),
    "T10Y3M": ("Yield curve: 10-year minus 3-month", "pp", "d"),
    "T10Y2Y": ("Yield curve: 10-year minus 2-year", "pp", "d"),
    "T5YIE": ("5-year breakeven inflation", "%", "d"),
    "BAA10Y": ("Corporate credit spread (Baa minus 10-year)", "pp", "d"),
    "NFCI": ("Chicago Fed financial conditions", "index", "d"),
    "ICSA": ("Initial jobless claims", "claims", "d"),
    "MORTGAGE30US": ("30-year mortgage rate", "%", "d"),
    "DCOILWTICO": ("Oil price (WTI)", "$/barrel", "d"),
    "DTWEXBGS": ("Trade-weighted dollar", "index", "d"),
    "VIXCLS": ("Stock volatility (VIX)", "index", "d"),
    "SP500": ("S&P 500", "index", "d"),
    "CSUSHPISA": ("Home prices (Case-Shiller)", "index", "m"),
    "M2SL": ("Money supply (M2)", "bn $", "m"),
    "BOPGSTB": ("Trade balance", "mn $", "m"),
    "GFDEGDQ188S": ("Federal debt (% GDP)", "%", "q"),
    "FYFSGDA188S": ("Federal surplus/deficit (% GDP)", "%", "a"),
    "FYOIGDA188S": ("Federal interest outlays (% GDP)", "%", "a"),
}

def fred_csv(sid):
    raw = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}", timeout=90).decode("utf-8", "replace")
    rows = list(csv.reader(io.StringIO(raw)))
    if not rows or len(rows[0]) < 2:
        raise RuntimeError(f"FRED {sid}: bad csv {raw[:120]}")
    obs = []
    for r in rows[1:]:
        if len(r) < 2 or not r[0] or r[1] in (".", ""):
            continue
        try:
            obs.append((r[0][:10], float(r[1])))
        except ValueError:
            continue
    if not obs:
        raise RuntimeError(f"FRED {sid}: no observations")
    return obs

def ym(d):
    return int(d[:4]), int(d[5:7])

def pack_fred(sid, obs, kind):
    if kind == "m":
        y0, m0 = ym(obs[0][0])
        idx = {ym(d): v for d, v in obs}
        y1, m1 = ym(obs[-1][0])
        arr, y, m = [], y0, m0
        while (y, m) <= (y1, m1):
            arr.append(rnd(idx.get((y, m)), 4))
            m += 1
            if m > 12:
                y, m = y + 1, 1
        return {"k": "m", "s": f"{y0:04d}-{m0:02d}", "v": arr, "last": obs[-1][0]}
    if kind == "q":
        def qk(d):
            y, m = ym(d)
            return y, (m - 1) // 3 + 1
        idx = {qk(d): v for d, v in obs}
        (y0, q0), (y1, q1) = qk(obs[0][0]), qk(obs[-1][0])
        arr, y, q = [], y0, q0
        while (y, q) <= (y1, q1):
            arr.append(rnd(idx.get((y, q)), 4))
            q += 1
            if q > 4:
                y, q = y + 1, 1
        return {"k": "q", "s": f"{y0:04d}Q{q0}", "v": arr, "last": obs[-1][0]}
    if kind == "a":
        idx = {int(d[:4]): v for d, v in obs}
        y0, y1 = min(idx), max(idx)
        return {"k": "a", "s": str(y0), "v": [rnd(idx.get(y), 4) for y in range(y0, y1 + 1)], "last": obs[-1][0]}
    # daily / weekly: monthly averages for history + raw recent observations
    sums = {}
    for d, v in obs:
        k = ym(d)
        s = sums.setdefault(k, [0.0, 0])
        s[0] += v
        s[1] += 1
    (y0, m0), (y1, m1) = ym(obs[0][0]), ym(obs[-1][0])
    arr, y, m = [], y0, m0
    while (y, m) <= (y1, m1):
        s = sums.get((y, m))
        arr.append(rnd(s[0] / s[1], 4) if s else None)
        m += 1
        if m > 12:
            y, m = y + 1, 1
    cut = (dt.date.fromisoformat(obs[-1][0]) - dt.timedelta(days=800)).isoformat()
    recent = [[int(d.replace("-", "")), rnd(v, 4)] for d, v in obs if d >= cut]
    return {"k": "d", "s": f"{y0:04d}-{m0:02d}", "v": arr, "r": recent, "last": obs[-1][0]}

# ---------------------------------------------------------------- run
def run_many(fn, items, workers=6):
    res = {}
    def one(it):
        try:
            return it, fn(it), None
        except Exception as e:  # noqa
            return it, None, str(e)[:300]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for it, val, err in ex.map(one, items):
            res[it] = (val, err)
    return res

def main():
    os.makedirs(OUT, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status = {"fetched_at": now, "sources": {}, "errors": []}
    prev_world = load_prev("world.json") or {}
    prev_us = load_prev("us.json") or {}

    # World Bank
    world = {"fetched_at": now, "wb": {}, "wgi": {}, "imf": {}, "labels": {"wb": WB, "wgi": WGI, "imf": IMF}}
    try:
        world["countries"] = wb_countries()
    except Exception as e:
        status["errors"].append(f"WB countries: {e}")
        world["countries"] = prev_world.get("countries", {})
    ok = 0
    for code, (val, err) in run_many(lambda c: wb_indicator(c), list(WB)).items():
        if val:
            world["wb"][code] = val; ok += 1
        else:
            status["errors"].append(f"WB {code}: {err}")
            if code in (prev_world.get("wb") or {}):
                world["wb"][code] = prev_world["wb"][code]
    status["sources"]["World Bank WDI"] = f"{ok}/{len(WB)}"
    ok = 0
    for code, (val, err) in run_many(lambda c: wb_indicator(c, 3), list(WGI)).items():
        if val:
            world["wgi"][code] = val; ok += 1
        else:
            status["errors"].append(f"WGI {code}: {err}")
            if code in (prev_world.get("wgi") or {}):
                world["wgi"][code] = prev_world["wgi"][code]
    status["sources"]["World Bank WGI"] = f"{ok}/{len(WGI)}"

    # IMF
    ok = 0
    for code, (val, err) in run_many(imf_indicator, list(IMF), workers=4).items():
        if val:
            world["imf"][code] = val; ok += 1
        else:
            status["errors"].append(f"IMF {code}: {err}")
            if code in (prev_world.get("imf") or {}):
                world["imf"][code] = prev_world["imf"][code]
    status["sources"]["IMF WEO"] = f"{ok}/{len(IMF)}"
    meta = imf_meta()
    world["imf_meta"] = meta if meta.get("countries") else prev_world.get("imf_meta", meta)

    # FRED
    us = {"fetched_at": now, "series": {}, "labels": {k: [v[0], v[1]] for k, v in FRED.items()}}
    ok = 0
    def fred_one(sid):
        return pack_fred(sid, fred_csv(sid), FRED[sid][2])
    for sid, (val, err) in run_many(fred_one, list(FRED), workers=4).items():
        if val:
            us["series"][sid] = val; ok += 1
        else:
            status["errors"].append(f"FRED {sid}: {err}")
            if sid in (prev_us.get("series") or {}):
                us["series"][sid] = prev_us["series"][sid]
    status["sources"]["FRED"] = f"{ok}/{len(FRED)}"

    status["log"] = LOG[-50:]
    for name, obj in (("world.json", world), ("us.json", us), ("status.json", status)):
        with open(os.path.join(OUT, name), "w") as f:
            json.dump(obj, f, separators=(",", ":"))
        log(name, os.path.getsize(os.path.join(OUT, name)), "bytes")
    log(json.dumps(status["sources"]))
    # fail the job only if everything failed (keeps the last good data otherwise)
    if not world["wb"] and not world["imf"] and not us["series"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
