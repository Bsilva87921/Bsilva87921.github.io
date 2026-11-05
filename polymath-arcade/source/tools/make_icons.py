#!/usr/bin/env python3
"""Render the app icons from live CSS 3D (the same cube as the logo) and save every size the app needs."""
import io, os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("PA_APP_DIR") or ROOT / "app") / "icons"
FONTS = (ROOT / "src" / "fonts.css").read_text(encoding="utf-8")

def icon_html(cube_px, rounded, full_bleed):
    half = cube_px / 2
    radius = "22.5%" if rounded else "0"
    return f"""<!DOCTYPE html><html><head><style>{FONTS}
html,body{{margin:0;width:1024px;height:1024px;background:transparent;overflow:hidden}}
.bg{{position:absolute;inset:0;border-radius:{radius};overflow:hidden;
  background:radial-gradient(60% 55% at 22% 18%,rgba(124,58,237,.95),transparent 70%),
             radial-gradient(55% 50% at 86% 88%,rgba(219,39,119,.85),transparent 70%),
             radial-gradient(45% 40% at 90% 12%,rgba(8,145,178,.7),transparent 70%),#0a0b1f}}
.bg::before{{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 54%,rgba(255,255,255,.16),transparent 46%)}}
.bg::after{{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 6px rgba(255,255,255,.08)}}
.stars i{{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff;opacity:.8}}
.stage{{position:absolute;inset:0;display:grid;place-items:center;perspective:2400px}}
.cube{{position:relative;width:{cube_px}px;height:{cube_px}px;transform-style:preserve-3d;transform:translateY({cube_px*0.04}px) rotateX(-27deg) rotateY(-38deg)}}
.cube i{{position:absolute;inset:0;border-radius:{cube_px*0.13}px;display:grid;place-items:center;font:800 {cube_px*0.3}px/1 "PA Display",sans-serif;font-style:normal;color:#fff;
  border:{max(3, cube_px*0.012)}px solid rgba(255,255,255,.45);box-shadow:inset 0 0 {cube_px*0.18}px rgba(255,255,255,.28);text-shadow:0 {cube_px*0.01}px {cube_px*0.04}px rgba(0,0,0,.25);backface-visibility:hidden}}
.cube i:nth-child(1){{transform:translateZ({half}px);background:linear-gradient(135deg,#8b5cf6,#db2777)}}
.cube i:nth-child(2){{transform:rotateY(90deg) translateZ({half}px);background:linear-gradient(135deg,#06b6d4,#7c3aed)}}
.cube i:nth-child(3){{transform:rotateX(90deg) translateZ({half}px);background:linear-gradient(135deg,#f59e0b,#db2777)}}
.glow{{position:absolute;left:50%;top:76%;width:{cube_px*1.3}px;height:{cube_px*0.26}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(167,139,250,.55),transparent);filter:blur(6px)}}
</style></head><body><div class="bg"><div class="stars"><i style="left:16%;top:22%"></i><i style="left:80%;top:30%;width:4px;height:4px"></i><i style="left:24%;top:78%;width:4px;height:4px"></i><i style="left:74%;top:72%"></i></div><div class="glow"></div></div>
<div class="stage"><div class="cube"><i>Pm</i><i>Ar</i><i>Ec</i></div></div></body></html>"""

GLYPHS = {
    "daily": '<circle cx="12" cy="12" r="4.2" fill="#fff" fill-opacity=".35"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="4.2"/>',
    "profile": '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"/>',
    "tour": '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" fill="#fff"/>',
}

def glyph_html(name):
    return f"""<!DOCTYPE html><html><head><style>html,body{{margin:0;width:1024px;height:1024px;background:transparent}}
.b{{position:absolute;inset:0;border-radius:22.5%;background:linear-gradient(135deg,#7c3aed,#db2777);display:grid;place-items:center;box-shadow:inset 0 0 0 8px rgba(255,255,255,.15)}}
svg{{width:58%;height:58%}}</style></head><body><div class="b"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{GLYPHS[name]}</svg></div></body></html>"""

def shot(page, html, transparent=True):
    page.set_content(html)
    page.wait_for_timeout(250)
    return Image.open(io.BytesIO(page.screenshot(omit_background=transparent))).convert("RGBA")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        page = b.new_page(viewport={"width": 1024, "height": 1024})
        anyicon = shot(page, icon_html(430, True, False))
        full = shot(page, icon_html(430, False, True), transparent=False)
        mask = shot(page, icon_html(330, False, True), transparent=False)
        for size in (512, 192):
            anyicon.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)
            mask.convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / f"maskable-{size}.png", optimize=True)
        full.convert("RGB").resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png", optimize=True)
        anyicon.resize((32, 32), Image.LANCZOS).save(OUT / "favicon-32.png", optimize=True)
        for name in GLYPHS:
            shot(page, glyph_html(name)).resize((96, 96), Image.LANCZOS).save(OUT / f"shortcut-{name}.png", optimize=True)
        b.close()
    for f in sorted(OUT.iterdir()):
        print(f.name, Image.open(f).size, f"{f.stat().st_size/1024:.1f} KB")

if __name__ == "__main__":
    main()
