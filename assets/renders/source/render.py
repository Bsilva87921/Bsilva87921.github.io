"""Render the 3D module icons in headless Chromium and write PNG masters plus WebP/AVIF sizes."""
import asyncio, base64, io, os, subprocess, sys
from PIL import Image
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ONLY = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else None
subprocess.run(['node', '-e', f"""
import('/opt/npm-tools/node_modules/esbuild/lib/main.js').then(async esb => {{
  const T = '/home/claude/vendor-src/three186';
  await esb.build({{ entryPoints: ['{HERE}/src/icons.js'], bundle: true, format: 'esm', outfile: '{HERE}/out/icons.bundle.js', logLevel: 'warning',
    alias: {{ 'three': T + '/build/three.module.js' }},
    plugins: [{{ name: 'addons', setup(b) {{ b.onResolve({{ filter: /^three\\/addons\\// }}, a => ({{ path: T + '/examples/jsm/' + a.path.slice('three/addons/'.length) }})); }} }}] }});
}});
"""], check=True)
open(os.path.join(OUT, 'icons.html'), 'w').write('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style><script type="module" src="icons.bundle.js"></script>')
import http.server, socketserver, threading, functools
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 8791), functools.partial(Q, directory=OUT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1100, 'height': 1100})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:200]))
        pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)[:300]))
        await pg.goto('http://127.0.0.1:8791/icons.html?size=1024')
        try:
            await pg.wait_for_function('window.READY === true', timeout=90000)
        except Exception:
            print('\n'.join(logs)); raise
        names = await pg.evaluate('window.NAMES')
        for n in names:
            if ONLY and n not in ONLY: continue
            url = await pg.evaluate(f'window.renderIcon({n!r})')
            png = base64.b64decode(url.split(',', 1)[1])
            im = Image.open(io.BytesIO(png)).convert('RGBA')
            im.save(os.path.join(OUT, f'{n}.png'))
            for s in (512, 256):
                sm = im.resize((s, s), Image.LANCZOS)
                sm.save(os.path.join(OUT, f'{n}-{s}.webp'), 'WEBP', quality=86, method=6)
                sm.save(os.path.join(OUT, f'{n}-{s}.avif'), 'AVIF', quality=70, speed=4)
            print(n, 'ok', os.path.getsize(os.path.join(OUT, f'{n}-512.webp')), 'bytes webp512')
        for l in logs:
            if 'error' in l.lower() or 'warn' in l.lower(): print('  ', l)
        await b.close()
asyncio.run(main())
