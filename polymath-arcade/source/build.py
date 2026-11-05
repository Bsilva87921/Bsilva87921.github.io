#!/usr/bin/env python3
"""Build both deliverables from one source:
   dist/polymath-arcade.html   the self-contained web page (published as the artifact)
   app/ (or $PA_APP_DIR)       the installable app (PWA): index.html, manifest, service worker, icons
   dist/polymath-arcade-app.zip  the app folder, ready to upload to any static host"""
import hashlib, json, os, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
APP = Path(os.environ.get("PA_APP_DIR") or ROOT / "app").resolve()   # in the site repo: PA_APP_DIR=..
CSS_ORDER = ["fonts.css", "style.css", "brand.css", "emblems.css", "tour.css", "app.css"]
JS_ORDER = ["core.js", "fx3d.js", "brand.js", "emblems.js", "tour.js", "app.js", "games_brain_math.js", "games_lang_sci.js", "games_phys_code.js", "games_money.js", "games_world.js", "boot.js"]

APP_HEAD = """<meta name="theme-color" content="#edf0f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#05060f" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Polymath">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script>window.PA_APP = true;</script>"""

SPLASH = """<div id="splash" aria-hidden="true">
  <div class="sp-stage"><span class="cube big"><i>Pm</i><i>Ar</i><i>Ec</i><i>Rc</i><i>Ms</i><i>Lx</i></span></div>
  <div class="sp-word"><span class="sp-suite"><svg class="pb-mark" viewBox="0 0 32 16"><path d="M1.5 14.5C8 14.5 10 2 16 2s8 12.5 14.5 12.5" fill="none" stroke="url(#ringGrad)" stroke-width="2.6" stroke-linecap="round"/><path d="M16 3.5v11" stroke="url(#ringGrad)" stroke-width="1.4" stroke-dasharray="1.6 2"/></svg>Probable</span><strong>Polymath Arcade</strong><small>by Bruno Silva</small></div>
  <div class="sp-bar"><i></i></div>
</div>"""

MANIFEST = {
    "name": "Polymath Arcade · Probable",
    "short_name": "Polymath",
    "description": "Adaptive 3D brain games across 10 subjects: math, English, physics, coding, science, finance, economics, business and the real world. A Probable app by Bruno Silva.",
    "id": "./",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "display_override": ["standalone", "minimal-ui"],
    "orientation": "any",
    "background_color": "#05060f",
    "theme_color": "#05060f",
    "lang": "en-US",
    "dir": "ltr",
    "categories": ["games", "education", "productivity"],
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ],
    "shortcuts": [
        {"name": "Daily Challenge", "short_name": "Daily", "description": "Today's 10-subject challenge", "url": "./#daily", "icons": [{"src": "icons/shortcut-daily.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "Profile and badges", "short_name": "Profile", "description": "Skill radar, levels and badges", "url": "./#profile", "icons": [{"src": "icons/shortcut-profile.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "Take the tour", "short_name": "Tour", "description": "A one-minute walkthrough", "url": "./#tour", "icons": [{"src": "icons/shortcut-tour.png", "sizes": "96x96", "type": "image/png"}]}
    ]
}

def assemble():
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = "\n".join((SRC / f).read_text(encoding="utf-8") for f in CSS_ORDER)
    js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in JS_ORDER)
    assert "</script" not in js.lower(), "script must not contain a closing script tag"
    return html.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)

def build():
    html = assemble()
    web = html.replace("<!--__APP_HEAD__-->\n", "")
    out = ROOT / "dist" / "polymath-arcade.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(web, encoding="utf-8")
    (ROOT / "test" / "logic.js").write_text("\n".join((SRC / f).read_text(encoding="utf-8") for f in JS_ORDER[:-1]), encoding="utf-8")
    print(f"built {out} ({out.stat().st_size/1024:.1f} KB)")
    build_app(html)

def build_app(html):
    APP.mkdir(exist_ok=True)
    page = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
                        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
    page = page.replace("<!--__APP_HEAD__-->", APP_HEAD)
    page = page.replace('<div class="nebula"', SPLASH + '\n<div class="nebula"', 1)
    assert "window.PA_APP" in page and 'id="splash"' in page and "viewport-fit=cover" in page
    (APP / "index.html").write_text(page, encoding="utf-8")
    manifest = dict(MANIFEST)
    shots = []
    if (APP / "screenshots" / "wide.jpg").exists():
        shots.append({"src": "screenshots/wide.jpg", "sizes": "1280x800", "type": "image/jpeg", "form_factor": "wide", "label": "The game browser: 21 games on a 3D periodic table"})
    if (APP / "screenshots" / "narrow.jpg").exists():
        shots.append({"src": "screenshots/narrow.jpg", "sizes": "780x1688", "type": "image/jpeg", "form_factor": "narrow", "label": "Polymath Arcade on a phone"})
    if shots:
        manifest["screenshots"] = shots
    (APP / "manifest.webmanifest").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    version = hashlib.sha256(page.encode("utf-8")).hexdigest()[:10]
    sw = (SRC / "sw.js").read_text(encoding="utf-8").replace("__VERSION__", version)
    (APP / "sw.js").write_text(sw, encoding="utf-8")
    shutil.copy(SRC / "APP_README.md", APP / "README.md")
    zpath = ROOT / "dist" / "polymath-arcade-app.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(APP.rglob("*")):
            if f.is_file() and "source" not in f.relative_to(APP).parts and f.name != ".nojekyll":
                z.write(f, Path("polymath-arcade") / f.relative_to(APP))
    print(f"built app/ (sw {version}) and {zpath.name} ({zpath.stat().st_size/1024:.1f} KB)")

if __name__ == "__main__":
    build()
