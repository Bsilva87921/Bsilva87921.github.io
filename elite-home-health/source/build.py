#!/usr/bin/env python3
"""Build the dashboard and case study for the site (full documents) and for Claude artifacts (page content)."""
import json, os
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, 'src')
read = lambda f: open(os.path.join(S, f), encoding='utf-8').read()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,500;0,8..60,600;1,8..60,400&display=swap">'
KIT = ['kit-core.js', 'kit-stats.js', 'kit-charts.js', 'kit-table.js', 'elite-core.js']
data = json.load(open(os.path.join(R, 'data', 'elite.json')))
sqlres = {}
for f in sorted(os.listdir(os.path.join(R, 'sql'))):
    if f.endswith('.sql'): sqlres[f[:-4]] = open(os.path.join(R, 'sql', f)).read()
datajs = '<script>window.ELITE_DATA=' + json.dumps(data, separators=(',', ':')) + ';window.ELITE_SQL=' + json.dumps(sqlres) + ';</script>'
css = read('style.css')
# early theme restore (before paint) so dark-mode choice doesn't flash
pre = "<script>try{var t=localStorage.getItem('elite-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>"
def page(title, desc, body, js, start, full):
    code = '\n'.join(read(f) for f in KIT + js).replace('</script', '<\\/script')
    head = f'<title>{title}</title><meta name="description" content="{desc}">{FONTS}<style>{css}</style>{pre}'
    content = f'{head}\n{body}\n{datajs}<script>\n{code}\ndocument.addEventListener("DOMContentLoaded",()=>{start});\n</script>'
    if not full: return content
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">{head}</head><body>\n{body}\n{datajs}<script>\n{code}\ndocument.addEventListener("DOMContentLoaded",()=>{start});\n</script></body></html>'
os.makedirs(os.path.join(R, 'dist', 'site'), exist_ok=True)
D_T, D_D = 'Home Care Operations Dashboard', 'Interactive operations dashboard for a home care agency, built as a work sample for Elite Home Healthcare (illustrative data).'
C_T, C_D = 'Closing the Hours Gap', 'Business case study: why authorized home care hours go unstaffed, what it costs and how to close the gap (illustrative data).'
outs = [('index.html', D_T, D_D, read('body.html'), ['dash.js'], 'DASH.start()'),
        ('case-study.html', C_T, C_D, read('cs-body.html') if os.path.exists(os.path.join(S, 'cs-body.html')) else '', ['dash.js', 'cs.js'] if os.path.exists(os.path.join(S, 'cs.js')) else ['dash.js'], 'CS.start()')]
for fn, t, d, body, js, st in outs:
    if not body: continue
    open(os.path.join(R, 'dist', 'site', fn), 'w').write(page(t, d, body, js, st, True))
    base = 'https://bsilva87921.github.io/elite-home-health/'
    art = page(t, d, body, js, st, False).replace('href="case-study.html"', f'href="{base}case-study.html" target="_blank" rel="noopener"').replace('href="index.html"', f'href="{base}" target="_blank" rel="noopener"')
    open(os.path.join(R, 'dist', 'artifact-' + fn), 'w').write(art)
    print(fn, os.path.getsize(os.path.join(R, 'dist', 'site', fn)))
