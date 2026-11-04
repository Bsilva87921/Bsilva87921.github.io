#!/usr/bin/env python3
"""Build the Probable Atlas app home screen: dist/app/index.html (the installed app's start page)."""
import os
R = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(R, 'src')
read = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()
def px3d_css():
    for p in (os.path.join(R, '..', 'fx3d', 'src', 'px3d.css'), os.path.join(R, '..', '..', 'assets', 'probable-3d', 'source', 'src', 'px3d.css')):
        if os.path.exists(p): return open(p, encoding='utf-8').read()
    return ''
css = read('kit-fx.css') + '\n' + px3d_css() + '\n' + read('kit-x.css') + '\n' + read('app-home.css')
js = '\n'.join(read(f) for f in ['photo-meta.js', 'kit-media.js', 'kit-insights.js', 'kit-3d.js', 'kit-app.js', 'kit-favs.js', 'kit-search.js', 'kit-share.js', 'kit-story.js', 'kit-news.js', 'kit-ux.js', 'globe-geo.js']) + '\nwindow.INS = INS; window.PX3D = PX3D; window.PAPP = PAPP;\n' + read('app-home.js')
html = read('app-home.html').replace('/*CSS*/', css, 1).replace('/*JS*/', js.replace('</script', '<\\/script'), 1)
os.makedirs(os.path.join(R, 'dist', 'app'), exist_ok=True)
open(os.path.join(R, 'dist', 'app', 'index.html'), 'w', encoding='utf-8').write(html)
print('app', len(html.encode()))
