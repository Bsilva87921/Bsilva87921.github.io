#!/usr/bin/env python3
"""Build Probable Atlas · Finance: dist/fin-site/index.html (loads ../data/*.json) and dist/probable-atlas-finance.html (embedded snapshot)."""
import json, os, sys
def px3d_css():
    """The shared 3D overlay styles: the working copy, or the repo layout (assets/probable-3d/source/src)."""
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, '..', 'fx3d', 'src', 'px3d.css'), os.path.join(here, '..', '..', 'assets', 'probable-3d', 'source', 'src', 'px3d.css')):
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f: return f.read()
    return ''

R = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(R, 'src')
JS = ['kit-core.js', 'kit-stats.js', 'kit-charts.js', 'kit-table.js', 'kit-ui.js', 'kit-chat.js', 'fin-data.js', 'fin-models.js', 'fin-port.js',
      'fin-live.js', 'fin-markets.js', 'fin-modview.js', 'fin-lab.js', 'fin-reco.js', 'fin-hist.js', 'fin-chat.js', 'kit-insights.js', 'kit-3d.js', 'kit-app.js', 'fin-fx.js', 'fin-app.js']
read = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()
TITLE = 'Probable Atlas Finance'
DESC = 'Live markets dashboard: 60 markets and 34 rates since 1990, tested forecasts, a portfolio lab, evidence-based recommendations and an AI analyst.'
PWA = '<link rel="manifest" href="../manifest.webmanifest"><link rel="apple-touch-icon" href="../icons/atlas-apple-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Atlas"><meta name="theme-color" content="#0c1a22">'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,500;0,600;1,400&display=swap">'
BOOT = "<script>try{var t=localStorage.getItem('atlas-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>"
css = read('style.css') + '\n' + read('fin.css') + '\n' + read('kit-fx.css') + '\n' + px3d_css() + '\n' + read('atlas-fx.css'); body = read('fin-body.html'); js = '\n'.join(read(f) for f in JS)
js = js.replace('</script', '<\\/script')

def snapshot(d):
    load = lambda n: json.load(open(os.path.join(d, n)))
    st = load('mstatus.json'); st.pop('log', None)
    return {'panel': load('markets.json'), 'long': load('markets-long.json'), 'status': st}

def page(snap=None, full_doc=True):
    head = f'<title>{TITLE}</title><meta name="description" content="{DESC}">{BOOT}{FONTS}<style>{css}</style>'
    if snap is None and full_doc: head = PWA + head
    data = ''
    if snap is not None:
        data = '<script>window.ATLAS_FIN_DATA=' + json.dumps(snap, separators=(',', ':')).replace('</', '<\\/') + ';</script>'
    if not full_doc:
        return f'{head}\n{body}\n{data}<script>\n{js}\n</script>'
    og = ('<meta property="og:title" content="Probable Atlas · Finance"><meta property="og:description" content="' + DESC + '">'
          '<meta property="og:type" content="website"><meta property="og:image" content="https://bsilva87921.github.io/probable-atlas/finance/preview.jpg"><meta name="theme-color" content="#0F1A1E">')
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">{og}{head}'
            f'<script src="../ai-config.js"></script></head><body>\n{body}\n<script>\n{js}\n</script></body></html>')

if __name__ == '__main__':
    d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'data', 'live')
    out = os.path.join(R, 'dist', 'fin-site'); os.makedirs(out, exist_ok=True)
    site = page(None, True); open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(site)
    art = page(snapshot(d), False); open(os.path.join(R, 'dist', 'probable-atlas-finance.html'), 'w', encoding='utf-8').write(art)
    # local preview: ../data next to the site folder
    os.makedirs(os.path.join(R, 'dist', 'data'), exist_ok=True)
    for n in ('markets.json', 'markets-long.json', 'mstatus.json'):
        open(os.path.join(R, 'dist', 'data', n), 'w').write(open(os.path.join(d, n)).read())
    print('site', len(site), 'artifact', len(art))

