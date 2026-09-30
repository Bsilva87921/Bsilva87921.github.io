#!/usr/bin/env python3
"""Build Probable Atlas · Economics: dist/site/index.html (loads ./data/*.json) and dist/probable-atlas.html (embedded snapshot)."""
import json, os, sys
R = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(R, 'src')
JS = ['map-data.js', 'kit-core.js', 'kit-stats.js', 'kit-charts.js', 'kit-table.js', 'econ-data.js', 'econ-models.js',
      'views-live.js', 'views-ind.js', 'views-models.js', 'views-whatif.js', 'views-reco.js', 'views-hist.js', 'app.js']
read = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()
TITLE = 'Probable Atlas Economics'
DESC = 'Live world and US economics dashboard with forecasts, a what-if lab and evidence-based recommendations.'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,500;0,600;1,400&display=swap">'
css = read('style.css'); body = read('body.html'); js = '\n'.join(read(f) for f in JS)
js = js.replace('</script', '<\\/script')

def trimmed(data_dir):
    w = json.load(open(os.path.join(data_dir, 'world.json')))
    u = json.load(open(os.path.join(data_dir, 'us.json')))
    s = json.load(open(os.path.join(data_dir, 'status.json')))
    keep_agg = {'WLD'}
    agg = {k for k, v in w['countries'].items() if v.get('agg')}
    for blk in ('wb', 'wgi'):
        for code, ser in w[blk].items():
            ser['d'] = {k: v for k, v in ser['d'].items() if k not in agg or k in keep_agg}
    keep_imf = {'WEOWORLD', 'ADVEC', 'OEMDC', 'EURO', 'EU'}
    real = set(w['countries'])
    for code, ser in w['imf'].items():
        ser['d'] = {k: v for k, v in ser['d'].items() if k in real or k in keep_imf}
    w['countries'] = {k: v for k, v in w['countries'].items() if not v.get('agg') or k in keep_agg}
    w['imf_meta'] = {'source': w['imf_meta'].get('source', ''), 'countries': {}, 'groups': {k: v for k, v in w['imf_meta'].get('groups', {}).items() if k in keep_imf}}
    s.pop('log', None)
    return {'world': w, 'us': u, 'status': s}

def page(snapshot=None, full_doc=True):
    head = f'<title>{TITLE}</title><meta name="description" content="{DESC}">{FONTS}<style>{css}</style>'
    data = ''
    if snapshot is not None:
        data = '<script>window.ATLAS_DATA=' + json.dumps(snapshot, separators=(',', ':')).replace('</', '<\\/') + ';</script>'
    content = f'{head}\n{body}\n{data}<script>\n{js}\n</script>'
    if not full_doc:
        return content
    og = ('<meta property="og:title" content="Probable Atlas · Economics"><meta property="og:description" content="' + DESC + '">'
          '<meta property="og:type" content="website"><meta name="theme-color" content="#0F1A1E">')
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">{og}{head}</head><body>\n{body}\n<script>\n{js}\n</script></body></html>'

if __name__ == '__main__':
    data_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'data', 'live')
    os.makedirs(os.path.join(R, 'dist', 'site'), exist_ok=True)
    site = page(None, True)
    open(os.path.join(R, 'dist', 'site', 'index.html'), 'w', encoding='utf-8').write(site)
    snap = trimmed(data_dir)
    art = page(snap, False)
    open(os.path.join(R, 'dist', 'probable-atlas.html'), 'w', encoding='utf-8').write(art)
    # local preview of the site with data next to it
    os.makedirs(os.path.join(R, 'dist', 'site', 'data'), exist_ok=True)
    for n in ('world.json', 'us.json', 'status.json'):
        open(os.path.join(R, 'dist', 'site', 'data', n), 'w').write(open(os.path.join(data_dir, n)).read())
    print('site', len(site), 'artifact', len(art))
