#!/usr/bin/env python3
"""Probable news: headlines from public feeds for the Atlas (economics and markets) and the Sports Lab.

Writes OUT_DIR/news-atlas.json and OUT_DIR/news-sports.json:
  {"asOf": ISO, "sources": [{"id", "name", "kind", "n", "ok"}], "items": [{"id", "t", "u", "s", "src", "d", "x", "img", "tp", ...}]}
Each item is a headline, its link, the publisher, the time, the feed's own summary (trimmed) and an image when the
feed offers one. Nothing else is copied from the article. A feed that fails keeps its stories from the previous run
(PREV_DIR), so one outage never empties the page. Standard library only.
"""
import hashlib, html, json, os, re, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

OUT = os.environ.get('OUT_DIR', 'out')
PREV = os.environ.get('PREV_DIR', 'prev')
UA = 'ProbableNews/1.0 (portfolio project; +https://bsilva87921.github.io/)'
NOW = datetime.now(timezone.utc)

# id, publisher, url (or a list of addresses to try in order), kind (official | outlet), topics the whole feed belongs to.
# Left out: BLS (refuses automated readers without a contact address), the IMF (rate-limits automated readers)
# and Yahoo Finance (its feeds were retired).
ATLAS_FEEDS = [
    ('fed-press', 'Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml', 'official', ['fed', 'policy']),
    ('fed-speech', 'Federal Reserve', 'https://www.federalreserve.gov/feeds/speeches.xml', 'official', ['fed', 'policy']),
    ('ecb', 'European Central Bank', 'https://www.ecb.europa.eu/rss/press.xml', 'official', ['global', 'policy']),
    ('bea', 'BEA', 'https://apps.bea.gov/rss/rss.xml', 'official', ['growth', 'data']),
    ('cnbc-econ', 'CNBC', 'https://www.cnbc.com/id/20910258/device/rss/rss.html', 'outlet', ['growth']),
    ('cnbc-top', 'CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'outlet', []),
    ('cnbc-fin', 'CNBC', 'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'outlet', ['markets']),
    ('cnbc-mkt', 'CNBC', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20409666', 'outlet', ['markets', 'stocks']),
    ('cnbc-earn', 'CNBC', 'https://www.cnbc.com/id/15839135/device/rss/rss.html', 'outlet', ['earnings', 'stocks']),
    ('mw-top', 'MarketWatch', 'https://feeds.marketwatch.com/marketwatch/topstories', 'outlet', ['markets']),
    ('mw-bull', 'MarketWatch', 'https://feeds.marketwatch.com/marketwatch/bulletins', 'outlet', ['markets']),
    ('inv-econ', 'Investing.com', 'https://www.investing.com/rss/news_14.rss', 'outlet', ['growth']),
    ('inv-ind', 'Investing.com', 'https://www.investing.com/rss/news_95.rss', 'outlet', ['data']),
    ('inv-stocks', 'Investing.com', 'https://www.investing.com/rss/news_25.rss', 'outlet', ['markets', 'stocks']),
    ('inv-cmd', 'Investing.com', 'https://www.investing.com/rss/news_11.rss', 'outlet', ['commodities']),
    ('inv-fx', 'Investing.com', 'https://www.investing.com/rss/news_1.rss', 'outlet', ['currency']),
    ('inv-crypto', 'Investing.com', 'https://www.investing.com/rss/news_301.rss', 'outlet', ['crypto']),
    ('ft-econ', 'Financial Times', 'https://www.ft.com/global-economy?format=rss', 'outlet', ['global', 'growth']),
    ('ft-mkt', 'Financial Times', 'https://www.ft.com/markets?format=rss', 'outlet', ['markets']),
    ('bbc-biz', 'BBC', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'outlet', []),
    ('guardian-econ', 'The Guardian', 'https://www.theguardian.com/business/economics/rss', 'outlet', ['growth']),
    ('sa-currents', 'Seeking Alpha', 'https://seekingalpha.com/market_currents.xml', 'outlet', ['markets', 'stocks']),
    ('coindesk', 'CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'outlet', ['crypto']),
]
# topic rules on headline + summary; the page groups these into its filters
RULES = {
    'fed': r'\b(fed|federal reserve|fomc|powell|rate cuts?|rate hikes?|interest rates?|central bank)\b',
    'inflation': r'\b(inflation|cpi|pce|consumer prices|price index|deflation|disinflation)\b',
    'jobs': r'\b(jobs?|payrolls?|unemployment|jobless|labou?r market|hiring|layoffs?|wages?)\b',
    'growth': r'\b(gdp|recession|economic growth|economy|economies|slowdown|soft landing)\b',
    'trade': r'\b(tariffs?|trade war|trade deal|exports?|imports?|sanctions)\b',
    'global': r'\b(china|chinese|europe|euro ?zone|ecb|japan|boj|imf|world bank|emerging markets?|india|britain|bank of england|germany|opec)\b',
    'stocks': r'\b(stocks?|s&p|nasdaq|dow|shares|equit(y|ies)|wall street|rally|sell-?off|ipo)\b',
    'bonds': r'\b(treasur(y|ies)|bonds?|yields?|10-year|credit spreads?|debt)\b',
    'commodities': r'\b(oil|crude|brent|gold|silver|copper|natural gas|commodit(y|ies)|wheat|opec)\b',
    'crypto': r'\b(bitcoin|crypto|ether(eum)?|stablecoins?|blockchain|btc)\b',
    'earnings': r'\b(earnings|quarterly (results|profit)|revenue|profit|guidance|eps|beats|misses)\b',
    'currency': r'\b(dollar|yen|euro|yuan|sterling|currenc(y|ies)|forex)\b',
}
RULES = {k: re.compile(v, re.I) for k, v in RULES.items()}

# Sports Lab leagues: id, ESPN path, label (tennis, golf and MMA included)
LEAGUES = [('nfl', 'football/nfl', 'NFL'), ('ncaaf', 'football/college-football', 'NCAAF'), ('mlb', 'baseball/mlb', 'MLB'), ('nba', 'basketball/nba', 'NBA'),
           ('wnba', 'basketball/wnba', 'WNBA'), ('nhl', 'hockey/nhl', 'NHL'), ('epl', 'soccer/eng.1', 'Premier League'), ('laliga', 'soccer/esp.1', 'LaLiga'),
           ('seriea', 'soccer/ita.1', 'Serie A'), ('bund', 'soccer/ger.1', 'Bundesliga'), ('ligue1', 'soccer/fra.1', 'Ligue 1'), ('mls', 'soccer/usa.1', 'MLS'),
           ('ucl', 'soccer/uefa.champions', 'Champions League'), ('tennis', 'tennis/atp', 'Tennis'), ('golf', 'golf/pga', 'Golf'), ('ufc', 'mma/ufc', 'UFC')]

NO_HOTLINK = re.compile(r'investing\.com/', re.I)
NS = {'media': 'http://search.yahoo.com/mrss/', 'content': 'http://purl.org/rss/1.0/modules/content/', 'atom': 'http://www.w3.org/2005/Atom', 'dc': 'http://purl.org/dc/elements/1.1/'}


def get(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, application/json, text/xml, */*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def clean(s, n=280):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    s = re.sub(r'The post .{0,160} appeared first on .{0,80}$', '', s.strip())
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'(Continue reading|Read more|Click here).*$', '', s, flags=re.I).strip()
    if len(s) > n:
        s = s[:n].rsplit(' ', 1)[0].rstrip(',;:.-') + '…'
    return s


def when(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    d = d.astimezone(timezone.utc)
    return None if d > NOW + timedelta(hours=2) else d


def sharper(u):
    # the BBC's image server serves any of its standard widths from the same path
    return re.sub(r'(ichef\.bbci\.co\.uk/(?:ace|news)/(?:standard|ws)/)\d+/', r'\g<1>800/', u) if u else u


def img_of(el, desc):
    best, bw = None, -1
    for tag in ('media:content', 'media:thumbnail'):
        for m in el.findall(tag, NS):
            u, typ, w = m.get('url'), (m.get('type') or m.get('medium') or ''), m.get('width')
            wi = int(w) if w and w.isdigit() else 0
            if u and u.startswith('http') and ('image' in typ or not typ or re.search(r'\.(jpe?g|png|webp)', u, re.I)) and not (w and wi < 120) and wi > bw:
                best, bw = u, wi
    if best:
        return sharper(best)
    for m in el.findall('media:group/media:content', NS):
        if m.get('url', '').startswith('http'):
            return m.get('url')
    e = el.find('enclosure')
    if e is not None and (e.get('type') or '').startswith('image') and (e.get('url') or '').startswith('http'):
        return e.get('url')
    m = re.search(r'<img[^>]+src=["\'](https?://[^"\']+)', desc or '')
    if m and not re.search(r'(pixel|1x1|feeds\.feedburner|tracking)', m.group(1), re.I):
        return html.unescape(m.group(1))
    return None


def parse_feed(raw):
    root = ET.fromstring(raw)
    out = []
    if root.tag.endswith('rss') or root.find('channel') is not None:
        for it in root.iter('item'):
            t = (it.findtext('title') or '').strip()
            u = (it.findtext('link') or '').strip() or (it.findtext('guid') or '').strip()
            desc = it.findtext('description') or it.findtext('content:encoded', namespaces=NS) or ''
            d = when(it.findtext('pubDate') or it.findtext('dc:date', namespaces=NS))
            out.append((t, u, desc, d, img_of(it, desc + (it.findtext('content:encoded', namespaces=NS) or ''))))
    else:  # Atom
        for en in root.findall('atom:entry', NS):
            t = (en.findtext('atom:title', namespaces=NS) or '').strip()
            u = ''
            for l in en.findall('atom:link', NS):
                if l.get('rel', 'alternate') == 'alternate' and l.get('href'):
                    u = l.get('href'); break
            desc = en.findtext('atom:summary', namespaces=NS) or en.findtext('atom:content', namespaces=NS) or ''
            d = when(en.findtext('atom:published', namespaces=NS) or en.findtext('atom:updated', namespaces=NS))
            out.append((t, u, desc, d, img_of(en, desc)))
    return out


def topics_of(text, base):
    tp = list(base)
    for k, rx in RULES.items():
        if k not in tp and rx.search(text):
            tp.append(k)
    return tp


def iid(u, t):
    return hashlib.sha1((u or t).encode('utf-8')).hexdigest()[:12]


def previous(name):
    try:
        with open(os.path.join(PREV, name), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'items': [], 'sources': []}


def finish(items, keep_days, cap, official_days=21, official_cap=40):
    cut, cut_off = (NOW - timedelta(days=keep_days)).isoformat(), (NOW - timedelta(days=official_days)).isoformat()
    seen, out, off = set(), [], []
    for it in sorted(items, key=lambda x: x.get('d') or '', reverse=True):
        k = re.sub(r'[^a-z0-9]+', '', (it.get('t') or '').lower())[:80]
        if not it.get('t') or not it.get('u') or it['u'] in seen or k in seen:
            continue
        official = it.get('k') == 'official'
        if it.get('d') and it['d'] < (cut_off if official else cut):
            continue
        seen.add(it['u']); seen.add(k)
        (off if official else out).append(it)
    return sorted(out[:cap] + off[:official_cap], key=lambda x: x.get('d') or '', reverse=True)


def atlas():
    prev = previous('news-atlas.json')
    items, sources = [], []
    for fid, name, url, kind, base in ATLAS_FEEDS:
        try:
            rows, err = None, None
            for cand in ([url] if isinstance(url, str) else url):
                try:
                    rows = parse_feed(get(cand))
                    if rows:
                        break
                except Exception as e:
                    err = e
            if not rows:
                raise err or ValueError('empty feed')
            n = 0
            for t, u, desc, d, im in rows[:40]:
                if not t or not u.startswith('http'):
                    continue
                t = re.sub(r'\s+\d{6,}$', '', t)   # a feed sometimes appends its article number to the headline
                if im and NO_HOTLINK.search(im):    # hosts that refuse pictures shown on other sites
                    im = None
                x = clean(desc)
                if x.lower().startswith(t.lower()[:40]):
                    x = clean(x[len(t):]) if len(x) > len(t) + 20 else ''
                items.append({'id': iid(u, t), 't': clean(t, 200), 'u': u, 's': name, 'src': fid, 'k': kind,
                              'd': (d or NOW).isoformat(timespec='seconds'), 'x': x, 'img': im, 'tp': topics_of(t + ' ' + x, base)})
                n += 1
            sources.append({'id': fid, 'name': name, 'kind': kind, 'n': n, 'ok': True})
            print(f'  {fid:14s} {n:3d} items')
        except Exception as e:
            old = [it for it in prev.get('items', []) if it.get('src') == fid]
            items.extend(old)
            sources.append({'id': fid, 'name': name, 'kind': kind, 'n': len(old), 'ok': False})
            print(f'  {fid:14s} failed ({type(e).__name__}: {str(e)[:80]}); kept {len(old)} previous')
        time.sleep(0.3)
    return {'asOf': NOW.isoformat(timespec='seconds'), 'sources': sources, 'items': finish(items, 4, 260)}


def sports():
    prev = previous('news-sports.json')
    items, sources = [], []
    for lg, path, label in LEAGUES:
        try:
            j = json.loads(get(f'https://site.api.espn.com/apis/site/v2/sports/{path}/news?limit=30'))
            n = 0
            for a in j.get('articles', []):
                t = (a.get('headline') or '').strip()
                u = (((a.get('links') or {}).get('web') or {}).get('href') or '').strip()
                if not t or not u.startswith('http') or a.get('type') == 'Media' and not a.get('description'):
                    continue
                if re.search(r'\bfantasy\b', t + ' ' + (a.get('description') or ''), re.I):
                    continue
                ims = [i for i in (a.get('images') or []) if (i.get('url') or '').startswith('http')]
                im = next((i['url'] for i in ims if (i.get('width') or 0) >= 400), ims[0]['url'] if ims else None)
                teams = [c.get('description') for c in (a.get('categories') or []) if c.get('type') == 'team' and c.get('description')]
                athletes = [c.get('description') for c in (a.get('categories') or []) if c.get('type') == 'athlete' and c.get('description')][:4]
                d = when(a.get('published') or a.get('lastModified'))
                items.append({'id': iid(u, t), 't': clean(t, 200), 'u': u, 's': 'ESPN', 'src': 'espn-' + lg, 'k': 'outlet', 'd': (d or NOW).isoformat(timespec='seconds'),
                              'x': '' if clean(a.get('description') or '').lower() == clean(t, 200).lower() else clean(a.get('description') or ''), 'img': im, 'lg': lg, 'lgName': label, 'tm': teams[:4], 'pl': athletes, 'tp': [lg]})
                n += 1
            sources.append({'id': 'espn-' + lg, 'name': 'ESPN', 'kind': 'outlet', 'n': n, 'ok': True})
            print(f'  espn {lg:7s} {n:3d} items')
        except Exception as e:
            old = [it for it in prev.get('items', []) if it.get('src') == 'espn-' + lg]
            items.extend(old)
            sources.append({'id': 'espn-' + lg, 'name': 'ESPN', 'kind': 'outlet', 'n': len(old), 'ok': False})
            print(f'  espn {lg:7s} failed ({type(e).__name__}: {str(e)[:80]}); kept {len(old)} previous')
        time.sleep(0.25)
    return {'asOf': NOW.isoformat(timespec='seconds'), 'sources': sources, 'items': finish(items, 3, 320)}


def main():
    os.makedirs(OUT, exist_ok=True)
    print('Atlas feeds')
    a = atlas()
    print('Sports leagues')
    s = sports()
    for name, j in (('news-atlas.json', a), ('news-sports.json', s)):
        if not j['items']:  # never publish an empty file over a good one
            old = previous(name)
            if old.get('items'):
                j = old
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
            json.dump(j, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{name}: {len(j["items"])} stories from {sum(1 for x in j["sources"] if x.get("ok"))}/{len(j["sources"])} sources')
    return 0


if __name__ == '__main__':
    sys.exit(main())
