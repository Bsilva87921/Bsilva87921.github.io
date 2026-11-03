"""Probe ESPN's public APIs from a GitHub runner: are pregame odds and line scores kept on completed games,
what do season calendars look like, and does the standings endpoint take a season."""
import json, os, time, urllib.request, urllib.error
OUT = os.environ.get('OUT_DIR', 'out'); os.makedirs(OUT + '/raw', exist_ok=True)
W = 'https://site.web.api.espn.com/apis/site/v2/sports/'
W2 = 'https://site.web.api.espn.com/apis/v2/sports/'
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (probe)'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read(); return r.status, json.loads(body), round(time.time() - t, 2), len(body)
    except urllib.error.HTTPError as e: return e.code, None, round(time.time() - t, 2), 0
    except Exception as e: return str(e)[:80], None, round(time.time() - t, 2), 0
def odds_summary(js):
    ev = js.get('events', []) if js else []
    n = len(ev); post = 0; with_odds = 0; with_ls = 0; sample = None; prov = {}
    for e in ev:
        c = (e.get('competitions') or [{}])[0]
        st = ((c.get('status') or e.get('status') or {}).get('type') or {})
        if st.get('completed'): post += 1
        od = c.get('odds') or []
        if od:
            with_odds += 1; p = (od[0].get('provider') or {}).get('name'); prov[p] = prov.get(p, 0) + 1
            if sample is None and st.get('completed'): sample = {k: od[0].get(k) for k in ['details', 'overUnder', 'spread', 'moneyline', 'homeTeamOdds', 'awayTeamOdds', 'drawOdds', 'provider']}
        cs = c.get('competitors') or []
        if cs and cs[0].get('linescores'): with_ls += 1
    return {'events': n, 'completed': post, 'with_odds': with_odds, 'with_linescores': with_ls, 'providers': prov, 'odds_sample_completed': sample}
R = {}
PAST = {
  'nba_2026-03-01': W + 'basketball/nba/scoreboard?dates=20260301',
  'nba_2026-10-30': W + 'basketball/nba/scoreboard?dates=20261030',
  'nfl_2025_w10': W + 'football/nfl/scoreboard?dates=2025&seasontype=2&week=10',
  'nfl_2026_w8': W + 'football/nfl/scoreboard?dates=2026&seasontype=2&week=8',
  'nfl_day_20261026': W + 'football/nfl/scoreboard?dates=20261026',
  'ncaaf_2026_w9': W + 'football/college-football/scoreboard?groups=80&limit=300&dates=2026&seasontype=2&week=9',
  'mlb_2026-07-15': W + 'baseball/mlb/scoreboard?dates=20260715',
  'mlb_2026-10-30': W + 'baseball/mlb/scoreboard?dates=20261030',
  'nhl_2026-01-15': W + 'hockey/nhl/scoreboard?dates=20260115',
  'nhl_2026-10-30': W + 'hockey/nhl/scoreboard?dates=20261030',
  'wnba_2026-07-15': W + 'basketball/wnba/scoreboard?dates=20260715',
  'epl_2026-02-21': W + 'soccer/eng.1/scoreboard?dates=20260221',
  'epl_2026-10-31': W + 'soccer/eng.1/scoreboard?dates=20261031',
  'laliga_2026-10-26': W + 'soccer/esp.1/scoreboard?dates=20261026',
  'mls_2026-07-04': W + 'soccer/usa.1/scoreboard?dates=20260704',
  'ucl_2026-10-21': W + 'soccer/uefa.champions/scoreboard?dates=20261021',
  'nba_range': W + 'basketball/nba/scoreboard?dates=20261025-20261101&limit=300',
}
for k, url in PAST.items():
    st, js, sec, size = get(url); R[k] = {'url': url, 'status': st, 'sec': sec, 'bytes': size, **(odds_summary(js) if js else {})}
    if js and k in ('nba_2026-03-01', 'nfl_2026_w8', 'epl_2026-10-31', 'mlb_2026-07-15', 'nhl_2026-10-30'):
        json.dump(js, open(f'{OUT}/raw/{k}.json', 'w'))
# calendars and seasons from the current scoreboards
CUR = {'nfl': 'football/nfl', 'ncaaf': 'football/college-football', 'mlb': 'baseball/mlb', 'nba': 'basketball/nba', 'wnba': 'basketball/wnba', 'nhl': 'hockey/nhl',
       'epl': 'soccer/eng.1', 'laliga': 'soccer/esp.1', 'seriea': 'soccer/ita.1', 'bund': 'soccer/ger.1', 'ligue1': 'soccer/fra.1', 'mls': 'soccer/usa.1', 'ucl': 'soccer/uefa.champions'}
C = {}
for lg, path in CUR.items():
    st, js, sec, size = get(W + path + '/scoreboard')
    if not js: C[lg] = {'status': st}; continue
    L = (js.get('leagues') or [{}])[0]; cal = L.get('calendar') or []
    C[lg] = {'status': st, 'season': L.get('season'), 'calendarType': L.get('calendarType'), 'calendarIsWhitelist': L.get('calendarIsWhitelist'),
             'calendar_len': len(cal), 'calendar_head': cal[:3], 'calendar_tail': cal[-2:], 'events': len(js.get('events', [])), 'day': js.get('day'), 'week': js.get('week')}
R['calendars'] = C
S = {}
for k, url in {'nba_2025': W2 + 'basketball/nba/standings?season=2025', 'nba_2026': W2 + 'basketball/nba/standings?season=2026', 'nba_cur': W2 + 'basketball/nba/standings?region=us&lang=en&contentorigin=espn',
               'nfl_2025': W2 + 'football/nfl/standings?season=2025', 'epl_2025': W2 + 'soccer/eng.1/standings?season=2025', 'mlb_2025': W2 + 'baseball/mlb/standings?season=2025'}.items():
    st, js, sec, size = get(url)
    ent = 0; season = None
    def walk(n):
        global ent
        if n.get('standings') and n['standings'].get('entries'): ent += len(n['standings']['entries'])
        for ch in n.get('children') or []: walk(ch)
    if js: walk(js); season = (js.get('seasons') or [None])[0] if isinstance(js.get('seasons'), list) else js.get('season')
    S[k] = {'status': st, 'entries': ent, 'season': season if not isinstance(season, dict) else {kk: season.get(kk) for kk in ('year', 'displayName')}, 'name': js.get('name') if js else None}
R['standings'] = S
json.dump(R, open(f'{OUT}/probe.json', 'w'), indent=1, default=str)
print(json.dumps(R, indent=1, default=str)[:20000])
