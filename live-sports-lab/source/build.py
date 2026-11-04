#!/usr/bin/env python3
"""Build the Probable Sports Lab page from its source files.

  python3 build.py                 -> dist/index.html (GitHub Pages: loads data/track.json and the shared AI config)
  python3 build.py --artifact T [--news N] -> dist/sports-lab-artifact.html with the track record T (a track.json)
                                      and optionally the headlines N (a news.json) embedded,
                                      for the Claude-hosted copy (no network: snapshot data, Claude through the app)
  python3 build.py --orig          -> rebuild the original modules only (used to check the split is exact)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
ORIG_JS = ['01-models.js', '02-snapshot.js', '03-core.js', '04-charts.js', '05-tableviz.js', '06-box.js', '07-guide.js',
           '08-titles.js', '09-stats.js', '10-stats-indiv.js', '11-scenarios.js', '12-views.js']
def first(*paths):
    for p in paths:
        if os.path.isdir(p): return p
    return paths[0]
# shared Probable kit (chat, insights, 3D loader) and the 3D overlay styles: working copy, or the repo layout
ATLAS = first(os.path.join(HERE, '..', 'atlas', 'src'), os.path.join(HERE, '..', '..', 'probable-atlas', 'source', 'src'))
FX3D = first(os.path.join(HERE, '..', 'fx3d', 'src'), os.path.join(HERE, '..', '..', 'assets', 'probable-3d', 'source', 'src'))
NEW_JS = ['atlas:photo-meta.js', 'atlas:kit-media.js', '13-track.js', 'atlas:kit-chat.js', '15-chat-sports.js', 'atlas:kit-insights.js', '17-insights.js', 'atlas:kit-3d.js', 'atlas:kit-app.js',
          'atlas:kit-favs.js', 'atlas:kit-search.js', 'atlas:kit-share.js', 'atlas:kit-story.js', 'atlas:kit-news.js', 'atlas:kit-ux.js', '16-arena.js', '18-app.js', '19-extras.js', '20-bento.js']
NEW_CSS = ['atlas:kit-fx.css', 'fx3d:px3d.css', 'atlas:kit-x.css', 'fx.css']
BRIDGE = 'window.CH = CH; window.INS = INS; window.PX3D = PX3D; window.PAPP = PAPP;\n'


def read(name):
    base = SRC
    if name.startswith('atlas:'): base, name = ATLAS, name[6:]
    elif name.startswith('fx3d:'): base, name = FX3D, name[5:]
    with open(os.path.join(base, name), encoding='utf-8') as f:
        return f.read()


def build(orig=False, track=None, artifact=False, news=None):
    shell = read('shell.html')
    css = read('style.css')
    js = '\n'.join(read(n) for n in ORIG_JS)
    if not orig:
        css += '\n' + '\n'.join(read(n) for n in NEW_CSS)
        boot = ''
        if track is not None:
            boot += 'window.SPORTS_TRACK = ' + json.dumps(track, separators=(',', ':')).replace('</', '<\\/') + ';\n'
        parts = []
        for n in NEW_JS:
            parts.append(read(n))
            if n == 'atlas:kit-app.js': parts.append(BRIDGE)
        if news is not None:   # a headlines snapshot for the saved copy, which cannot fetch the live file
            boot += 'window.SPORTS_NEWS = ' + json.dumps(news, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/') + ';\n'
        if artifact: boot += 'window.SPORTS_ARTIFACT = true;\n'
        js += '\n' + boot + '\n'.join(parts)
    html = shell.replace('/*STYLE*/', css, 1).replace('/*SCRIPT*/', js, 1)
    if not orig and not artifact:
        # the site shares one AI proxy setting with Probable Atlas (window.ATLAS_AI = { endpoint })
        html = html.replace('<script>', '<script src="../probable-atlas/ai-config.js"></script>\n<script>', 1)
        # installable app (site only): manifest, icons and iOS home-screen settings
        pwa = ('<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/sports-apple-180.png">'
               '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
               '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Sports Lab">')
        html = html.replace('<meta name="theme-color"', pwa + '\n<meta name="theme-color"', 1)
    return html


def main():
    os.makedirs(os.path.join(HERE, 'dist'), exist_ok=True)
    args = sys.argv[1:]
    if '--orig' in args:
        out = os.path.join(HERE, 'dist', 'orig-rebuilt.html')
        html = build(orig=True)
    elif '--artifact' in args:
        tpath = args[args.index('--artifact') + 1]
        with open(tpath, encoding='utf-8') as f:
            track = json.load(f)
        news = None
        if '--news' in args:
            with open(args[args.index('--news') + 1], encoding='utf-8') as f:
                news = json.load(f)
        out = os.path.join(HERE, 'dist', 'sports-lab-artifact.html')
        html = build(track=track, artifact=True, news=news)
    else:
        out = os.path.join(HERE, 'dist', 'index.html')
        html = build()
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(out, f'{len(html.encode("utf-8")):,} bytes')


if __name__ == '__main__':
    main()
