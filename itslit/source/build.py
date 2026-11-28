"""Builds itslit/index.html (the website and installable app) from the files in this folder.

    python3 itslit/source/build.py

Edit data.js (books, letters, merchandise), app.js (pages and behaviour), shelf3d.js (the 3D bookcase), style.css
(the look) or body.html (header, footer, tabs), then run this and commit. It also stamps a new version into sw.js so
installed apps pick up the change.
"""
import hashlib
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent
# the public address, used for link previews on social media (change it when the club moves to its own domain)
SITE_URL = 'https://bsilva87921.github.io/itslit/'

TITLE = 'ItsLit Reading Club · The classics, finally lit'
DESC = ('A candlelit reading club for the great works: a 3D library of 20 classics broken down in plain English, '
        'a book matchmaker, Shelley the AI librarian, and a friendly salon for every book.')

HEAD = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#F4EEE3">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ItsLit">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ItsLit Reading Club">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}">
<meta property="og:image" content="{SITE_URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="ItsLit Reading Club: the classics, finally lit">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Pinyon+Script&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<style>
'''

PROD_CSS = '''
/* ---------- the live site: accounts, install, privacy ---------- */
.prod #previewBtn,.prod .preview-only,.prod .exit-preview{display:none!important}
.acct-btn img{width:26px;height:26px;border-radius:50%;object-fit:cover;display:block;flex:none}
#acctHead.icon-btn{padding:0 12px 0 6px}
#acctHead .acct-name{max-width:8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--fd);font-weight:600;font-size:14px}
@container shell (max-width:1279px){#installHead{display:none!important}}
@container shell (max-width:1180px){#acctHead .acct-name{display:none}#acctHead.icon-btn{padding:0 9px}}
.acct-dlg{width:min(440px,calc(100vw - 32px))}
.acct-dlg .x{position:absolute;top:8px;right:8px;width:44px;height:44px;border:0;background:transparent;color:var(--ink2);font-size:28px;line-height:1;cursor:pointer;border-radius:50%}
.acct-dlg .x:hover{background:var(--paper2)}
.acct-dlg h3{margin-right:40px;font-size:26px}
.acct-dlg .wide{width:100%}
.acct-dlg .google-btn{background:var(--card);gap:10px}
.acct-dlg .or{display:flex;align-items:center;gap:10px;color:var(--ink2);font-size:14px;margin:16px 0 4px}
.acct-dlg .or::before,.acct-dlg .or::after{content:"";flex:1;border-top:1px solid var(--line)}
.acct-form label{display:block;font-size:15px;margin:10px 0 4px;color:var(--ink2)}
.acct-form .btn.wide{margin-top:16px}
.acct-form .row input{flex:1;min-width:0;width:auto}
input[type=password]{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--card);color:var(--ink);font-size:16px}
.acct-card{display:flex;gap:12px;align-items:center;margin:6px 0 16px}
.acct-card img{width:52px;height:52px;border-radius:50%;object-fit:cover}
.acct-foot{margin-top:18px}
.acct-alt{margin-top:12px}
.linkish{background:none;border:0;padding:0;color:var(--claret);text-decoration:underline;cursor:pointer;font:inherit}
.acct-dlg .danger{color:var(--claret)}
.acct-msg{margin-top:10px;color:var(--ink)}
.acct-msg:empty{display:none}
.acct-dlg .fine{margin-top:12px}
.install-btn{white-space:nowrap}
.site-foot .foot-base a{color:inherit}
'''

FOOT_OLD = '<span>&copy; 2026 ItsLit. Prototype with sample content; prices are placeholders and checkout is not open.</span>'
FOOT_NEW = '<span>&copy; 2026 ItsLit Reading Club · <a href="privacy.html">Privacy &amp; house rules</a></span>'
APP_OLD = '<li style="font-size:15px">On phones, ItsLit runs as an app with tabs at the bottom. Store versions are planned for late 2027.</li>'
APP_NEW = ('<li style="font-size:15px">ItsLit installs like an app on phones and computers.<br>'
           '<button class="btn small light" type="button" data-install hidden style="margin-top:8px">Install ItsLit</button></li>')
SCRIPTS = '''<noscript><p style="padding:20px;text-align:center">ItsLit needs JavaScript switched on.</p></noscript>
<script src="config.js"></script>
<script src="api-config.js"></script>
<script>window.ITSLIT_THREE_URL = 'lib/three.min.js';</script>
<script src="backend.js"></script>
'''


def main():
    body = (HERE / 'body.html').read_text()
    for old, new in ((FOOT_OLD, FOOT_NEW), (APP_OLD, APP_NEW)):
        if old in body:
            body = body.replace(old, new)
    js = '\n'.join((HERE / f).read_text() for f in ('data.js', 'shelf3d.js', 'app.js'))
    js = js.replace('const C = window.claude;', 'const C = window.itslitRuntime;')
    # the prototype's wording for when it runs inside Claude never shows on the live site; keep the source neutral too
    js = js.replace('signed in to Claude', 'signed in').replace('Sign in to Claude', 'Sign in')
    css = (HERE / 'style.css').read_text() + PROD_CSS
    html = HEAD + css + '</style>\n</head>\n<body>\n' + body + SCRIPTS + '<script>\n{\n' + js + '\n}\n</script>\n</body>\n</html>\n'
    (SITE / 'index.html').write_text(html)
    stamp = hashlib.sha1((html + (SITE / 'backend.js').read_text() + (SITE / 'privacy.html').read_text()).encode()).hexdigest()[:10]
    sw = SITE / 'sw.js'
    sw.write_text(re.sub(r"const VERSION = 'itslit-[^']*';", f"const VERSION = 'itslit-{stamp}';", sw.read_text()))
    print(f'index.html: {len(html):,} bytes · service worker version itslit-{stamp}')


if __name__ == '__main__':
    main()
