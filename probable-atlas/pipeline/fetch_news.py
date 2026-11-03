#!/usr/bin/env python3
"""Probable news: headlines from public feeds for the Atlas (economics and markets) and the Sports Lab.

Writes OUT_DIR/news-atlas.json and OUT_DIR/news-sports.json:
  {"asOf": ISO, "sources": [{"id", "name", "kind", "n", "ok"}], "items": [{"id", "t", "u", "s", "src", "d", "x", "img", "tp", ...}]}
Each item is a headline, its link, the publisher, the time, the feed's own summary (trimmed) and an image when the
feed offers one; nothing else is copied from news outlets' articles. Official releases that may be reproduced (the
Federal Reserve Board and BEA, as US government works; the ECB, with the ECB cited as the source) also carry their
text ("body"), so the pages can show them in full. Sports headlines come from ESPN and other outlets' public feeds
(CBS Sports, BBC Sport, Sky Sports, The Guardian, MLB.com, The Athletic, MMA Fighting).
A feed that fails keeps its stories from the previous run (PREV_DIR), so one outage never empties the page.
Standard library only.
"""
import hashlib, html, json, os, re, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

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
PAYWALLED = {'ft-econ', 'ft-mkt'}   # the publisher may ask readers to subscribe

# Sports Lab leagues: id, ESPN path, label (tennis, golf and MMA included)
LEAGUES = [('nfl', 'football/nfl', 'NFL'), ('ncaaf', 'football/college-football', 'NCAAF'), ('mlb', 'baseball/mlb', 'MLB'), ('nba', 'basketball/nba', 'NBA'),
           ('wnba', 'basketball/wnba', 'WNBA'), ('nhl', 'hockey/nhl', 'NHL'), ('epl', 'soccer/eng.1', 'Premier League'), ('laliga', 'soccer/esp.1', 'LaLiga'),
           ('seriea', 'soccer/ita.1', 'Serie A'), ('bund', 'soccer/ger.1', 'Bundesliga'), ('ligue1', 'soccer/fra.1', 'Ligue 1'), ('mls', 'soccer/usa.1', 'MLS'),
           ('ucl', 'soccer/uefa.champions', 'Champions League'), ('tennis', 'tennis/atp', 'Tennis'), ('golf', 'golf/pga', 'Golf'), ('ufc', 'mma/ufc', 'UFC')]

NO_HOTLINK = re.compile(r'investing\.com/', re.I)
LABEL = {lg: label for lg, _, label in LEAGUES}

# Other sports outlets: id, publisher, url (or addresses to try in order), league id or 'soccer' (sorted into the lab's
# leagues by competition and club names), paywalled. Feeds that stop answering are simply skipped.
SPORTS_FEEDS = [
    ('cbs-nfl', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/nfl/', 'nfl', False),
    ('cbs-ncaaf', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/college-football/', 'ncaaf', False),
    ('cbs-mlb', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/mlb/', 'mlb', False),
    ('cbs-nba', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/nba/', 'nba', False),
    ('cbs-wnba', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/wnba/', 'wnba', False),
    ('cbs-nhl', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/nhl/', 'nhl', False),
    ('cbs-soccer', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/soccer/', 'soccer', False),
    ('cbs-golf', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/golf/', 'golf', False),
    ('cbs-mma', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/mma/', 'ufc', False),
    ('cbs-tennis', 'CBS Sports', 'https://www.cbssports.com/rss/headlines/tennis/', 'tennis', False),
    ('bbc-epl', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml', 'epl', False),
    ('bbc-ucl', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/football/champions-league/rss.xml', 'ucl', False),
    ('bbc-euro', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/football/european/rss.xml', 'soccer', False),
    ('bbc-nfl', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', 'nfl', False),
    ('bbc-nba', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/basketball/rss.xml', 'nba', False),
    ('bbc-tennis', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', 'tennis', False),
    ('bbc-golf', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/golf/rss.xml', 'golf', False),
    ('bbc-mma', 'BBC Sport', 'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml', 'ufc', False),
    ('sky-epl', 'Sky Sports', 'https://www.skysports.com/rss/11661', 'epl', False),
    ('sky-football', 'Sky Sports', 'https://www.skysports.com/rss/11095', 'soccer', False),
    ('sky-nfl', 'Sky Sports', 'https://www.skysports.com/rss/12118', 'nfl', False),
    ('sky-tennis', 'Sky Sports', 'https://www.skysports.com/rss/12110', 'tennis', False),
    ('sky-golf', 'Sky Sports', 'https://www.skysports.com/rss/12176', 'golf', False),
    ('gu-epl', 'The Guardian', 'https://www.theguardian.com/football/premierleague/rss', 'epl', False),
    ('gu-ucl', 'The Guardian', 'https://www.theguardian.com/football/championsleague/rss', 'ucl', False),
    ('gu-laliga', 'The Guardian', 'https://www.theguardian.com/football/laligafootball/rss', 'laliga', False),
    ('gu-seriea', 'The Guardian', 'https://www.theguardian.com/football/serieafootball/rss', 'seriea', False),
    ('gu-bund', 'The Guardian', 'https://www.theguardian.com/football/bundesligafootball/rss', 'bund', False),
    ('gu-ligue1', 'The Guardian', 'https://www.theguardian.com/football/ligue1football/rss', 'ligue1', False),
    ('gu-mls', 'The Guardian', 'https://www.theguardian.com/football/mls/rss', 'mls', False),
    ('gu-nfl', 'The Guardian', 'https://www.theguardian.com/sport/nfl/rss', 'nfl', False),
    ('gu-nba', 'The Guardian', 'https://www.theguardian.com/sport/nba/rss', 'nba', False),
    ('gu-mlb', 'The Guardian', ['https://www.theguardian.com/sport/mlb/rss', 'https://www.theguardian.com/sport/baseball/rss'], 'mlb', False),
    ('gu-tennis', 'The Guardian', 'https://www.theguardian.com/sport/tennis/rss', 'tennis', False),
    ('gu-golf', 'The Guardian', 'https://www.theguardian.com/sport/golf/rss', 'golf', False),
    ('mlb-com', 'MLB.com', 'https://www.mlb.com/feeds/news/rss.xml', 'mlb', False),
    ('ath-nfl', 'The Athletic', 'https://www.nytimes.com/athletic/rss/nfl/', 'nfl', True),
    ('ath-nba', 'The Athletic', 'https://www.nytimes.com/athletic/rss/nba/', 'nba', True),
    ('ath-mlb', 'The Athletic', 'https://www.nytimes.com/athletic/rss/mlb/', 'mlb', True),
    ('ath-nhl', 'The Athletic', 'https://www.nytimes.com/athletic/rss/nhl/', 'nhl', True),
    ('ath-ncaaf', 'The Athletic', 'https://www.nytimes.com/athletic/rss/college-football/', 'ncaaf', True),
    ('ath-epl', 'The Athletic', 'https://www.nytimes.com/athletic/rss/premier-league/', 'epl', True),
    ('mmaf', 'MMA Fighting', ['https://www.mmafighting.com/rss/index.xml', 'https://www.mmafighting.com/rss/current'], 'ufc', False),
]
# soccer stories from general feeds: the competition named first wins, then the clubs (2025-26 top flights)
SOCCER = [(lg, re.compile(rx, re.I)) for lg, rx in [
    ('ucl', r'champions league|\bucl\b'),
    ('epl', r'premier league|arsenal|aston villa|bournemouth|brentford|brighton|burnley|chelsea|crystal palace|everton|fulham|leeds|liverpool|manchester city|man city|manchester united|man utd|man united|newcastle|nottingham forest|sunderland|tottenham|spurs|west ham|wolves|wolverhampton'),
    ('laliga', r'la ?liga|real madrid|barcelona|barça|barca\b|atl[eé]tico|sevilla|real sociedad|villarreal|real betis|athletic club|athletic bilbao|valencia|girona|celta|osasuna|mallorca|getafe|rayo vallecano|espanyol|alav[eé]s|elche|levante|real oviedo'),
    ('seriea', r'serie a|juventus|inter milan|internazionale|ac milan|napoli|\broma\b|lazio|atalanta|fiorentina|bologna|torino|udinese|genoa|lecce|cagliari|parma|hellas verona|sassuolo|cremonese'),
    ('bund', r'bundesliga|bayern|dortmund|leipzig|leverkusen|eintracht frankfurt|vfb stuttgart|wolfsburg|freiburg|mainz|gladbach|hoffenheim|werder bremen|union berlin|augsburg|heidenheim|st\.? pauli|hamburger sv|cologne|k[oö]ln'),
    ('ligue1', r'ligue 1|paris saint-germain|\bpsg\b|marseille|\blyon\b|as monaco|\blille\b|stade rennais|\brennes\b|nantes|strasbourg|toulouse|auxerre|le havre|lorient|paris fc'),
    ('mls', r'\bmls\b|inter miami|la galaxy|\blafc\b|sounders|atlanta united|red bulls|nycfc|columbus crew|fc cincinnati|orlando city|philadelphia union|toronto fc|whitecaps|portland timbers|austin fc|nashville sc|charlotte fc|st\.? louis city|real salt lake|minnesota united|sporting kansas city|houston dynamo|colorado rapids|earthquakes|chicago fire|d\.?c\.? united|new england revolution|cf montr[eé]al|san diego fc'),
]]
NBA_RE = re.compile(r'\bnba\b|hawks|celtics|brooklyn nets|hornets|chicago bulls|cavaliers|mavericks|nuggets|pistons|warriors|rockets|pacers|clippers|lakers|grizzlies|miami heat|bucks|timberwolves|pelicans|knicks|thunder|orlando magic|76ers|sixers|phoenix suns|trail blazers|sacramento kings|san antonio spurs|raptors|utah jazz|wizards|wembanyama|lebron', re.I)
FANTASY = re.compile(r'\bfantasy\b', re.I)


def soccer_league(text):
    for lg, rx in SOCCER:
        if rx.search(text):
            return lg
    return None


class Paras(HTMLParser):
    """Paragraph text grouped by the element that holds it: the group with the most text is the article."""
    SKIP = {'script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'noscript', 'button', 'svg', 'select', 'figure', 'table'}
    VOID = {'br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr', 'area', 'col', 'embed', 'param', 'track', 'base'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.st, self.n, self.skip, self.buf, self.par, self.out = [], 0, 0, None, 0, []

    def _end_p(self):
        if self.buf is not None:
            txt = re.sub(r'\s+', ' ', ''.join(self.buf)).strip()
            if txt:
                self.out.append((self.par, txt))
            self.buf = None

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            if tag == 'br' and self.buf is not None:
                self.buf.append(' ')
            return
        if tag in ('p', 'div', 'section', 'article', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4'):
            self._end_p()                      # a new block closes an open paragraph
        self.n += 1
        self.st.append((tag, self.n))
        if tag in self.SKIP:
            self.skip += 1
        if tag == 'p' and not self.skip:
            self.buf, self.par = [], (self.st[-2][1] if len(self.st) > 1 else 0)

    def handle_endtag(self, tag):
        for i in range(len(self.st) - 1, -1, -1):
            if self.st[i][0] == tag:
                for t, _ in self.st[i:]:
                    if t in self.SKIP:
                        self.skip -= 1
                    if t == 'p':
                        self._end_p()
                del self.st[i:]
                break

    def handle_data(self, d):
        if self.buf is not None and not self.skip:
            self.buf.append(d)


BOILER = re.compile(r'^(last update|for release|for immediate release|(for )?media (contact|inquiries)|back to top|share|print|related (links|information)|implementation note|subscribe|accessible version|return to text|footnotes?)\b|\[email[^\]]*protected\]', re.I)
DATELINE = re.compile(r'^[A-Z][\w .\'-]{2,40}, \d{1,2} [A-Z][a-z]+ \d{4}\.?$|^[A-Z][a-z]+ \d{1,2}, \d{4}$')


def article_text(raw, limit=4200):
    """The longest run of paragraphs in a page, trimmed to about `limit` characters; returns (paragraphs, complete)."""
    p = Paras()
    try:
        p.feed(raw.decode('utf-8', 'replace'))
        p.close()
    except Exception:
        pass
    groups = {}
    for par, txt in p.out:
        groups.setdefault(par, []).append(txt)
    if not groups:
        return [], False
    best = max(groups.values(), key=lambda g: sum(len(x) for x in g))
    out, n, complete = [], 0, True
    for txt in best:
        if len(txt) < 30 or BOILER.search(txt) or DATELINE.match(txt):
            continue
        if n + len(txt) > limit and out:
            complete = False
            break
        out.append(txt)
        n += len(txt)
    return out, complete
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
                it = {'id': iid(u, t), 't': clean(t, 200), 'u': u, 's': name, 'src': fid, 'k': kind,
                      'd': (d or NOW).isoformat(timespec='seconds'), 'x': x, 'img': im, 'tp': topics_of(t + ' ' + x, base)}
                if fid in PAYWALLED:
                    it['pw'] = True
                items.append(it)
                n += 1
            sources.append({'id': fid, 'name': name, 'kind': kind, 'n': n, 'ok': True})
            print(f'  {fid:14s} {n:3d} items')
        except Exception as e:
            old = [it for it in prev.get('items', []) if it.get('src') == fid]
            items.extend(old)
            sources.append({'id': fid, 'name': name, 'kind': kind, 'n': len(old), 'ok': False})
            print(f'  {fid:14s} failed ({type(e).__name__}: {str(e)[:80]}); kept {len(old)} previous')
        time.sleep(0.3)
    out = finish(items, 4, 260)
    full_text(out, prev)
    return {'asOf': NOW.isoformat(timespec='seconds'), 'sources': sources, 'items': out}


# official sources whose releases may be shown in full, with the credit the page shows
REUSE = {'fed-press': 'Federal Reserve Board', 'fed-speech': 'Federal Reserve Board', 'bea': 'U.S. Bureau of Economic Analysis', 'ecb': 'European Central Bank'}


def full_text(items, prev, budget=24):
    """Adds the text of official releases (kept from the previous run when already read)."""
    known = {it['id']: it for it in prev.get('items', []) if it.get('body')}
    fetched = kept = 0
    for it in items:
        if it.get('src') not in REUSE:
            continue
        if it['id'] in known:
            it['body'], it['full'] = known[it['id']]['body'], known[it['id']].get('full', False)
            it['credit'] = REUSE[it['src']]; kept += 1
            continue
        if fetched >= budget:
            continue
        fetched += 1
        try:
            body, complete = article_text(get(it['u'], timeout=20))
            if sum(len(x) for x in body) >= 200:
                it['body'], it['full'], it['credit'] = body, complete, REUSE[it['src']]
        except Exception as e:
            print(f'  text {it["src"]:10s} failed ({type(e).__name__}: {str(e)[:60]})')
        time.sleep(0.4)
    print(f'  official text: {sum(1 for it in items if it.get("body"))} releases ({fetched} read now, {kept} kept)')


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
                if FANTASY.search(t + ' ' + (a.get('description') or '')):
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
    for fid, name, url, lg0, paywall in SPORTS_FEEDS:
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
            for t, u, desc, d, im in rows[:30]:
                if not t or not u.startswith('http'):
                    continue
                t = re.sub(r'\s+\d{6,}$', '', t)
                x = clean(desc)
                if x.lower().startswith(t.lower()[:40]):
                    x = clean(x[len(t):]) if len(x) > len(t) + 20 else ''
                text = t + ' ' + x
                if FANTASY.search(text):
                    continue
                lg = soccer_league(text) if lg0 == 'soccer' else lg0
                if not lg or (fid == 'bbc-nba' and not NBA_RE.search(text)):
                    continue
                if im and NO_HOTLINK.search(im):
                    im = None
                it = {'id': iid(u, t), 't': clean(t, 200), 'u': u, 's': name, 'src': fid, 'k': 'outlet', 'd': (d or NOW).isoformat(timespec='seconds'),
                      'x': x, 'img': im, 'lg': lg, 'lgName': LABEL.get(lg, lg), 'tm': [], 'pl': [], 'tp': [lg]}
                if paywall:
                    it['pw'] = True
                items.append(it)
                n += 1
            sources.append({'id': fid, 'name': name, 'kind': 'outlet', 'n': n, 'ok': True})
            print(f'  {fid:14s} {n:3d} items')
        except Exception as e:
            old = [it for it in prev.get('items', []) if it.get('src') == fid]
            items.extend(old)
            sources.append({'id': fid, 'name': name, 'kind': 'outlet', 'n': len(old), 'ok': False})
            print(f'  {fid:14s} failed ({type(e).__name__}: {str(e)[:80]}); kept {len(old)} previous')
        time.sleep(0.25)
    return {'asOf': NOW.isoformat(timespec='seconds'), 'sources': sources, 'items': balance(finish(items, 10, 100000), 480)}


PER_PUB = {'The Athletic': 45, 'MLB.com': 30, 'MMA Fighting': 25}   # others: 160


def balance(items, cap, floor=14, recent_days=4):
    """Newest first, a ceiling per publisher, and every league's newest `floor` stories kept whatever the cap (from
    the last ten days, so quieter leagues still show); beyond those, only stories from the last `recent_days`."""
    from collections import Counter
    pub, kept = Counter(), []
    for it in items:
        if pub[it['s']] >= PER_PUB.get(it['s'], 160):
            continue
        pub[it['s']] += 1
        kept.append(it)
    lg, must, rest = Counter(), [], []
    for it in kept:
        if lg[it.get('lg')] < floor:
            lg[it.get('lg')] += 1
            must.append(it)
        else:
            rest.append(it)
    cut = (NOW - timedelta(days=recent_days)).isoformat()
    rest = [it for it in rest if (it.get('d') or '') >= cut]
    out = must + rest[:max(0, cap - len(must))]
    return sorted(out, key=lambda x: x.get('d') or '', reverse=True)


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
