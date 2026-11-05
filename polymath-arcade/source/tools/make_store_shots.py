#!/usr/bin/env python3
"""Capture the install-dialog screenshots listed in the manifest (wide 1280x800, narrow 780x1688)."""
import io, os, subprocess, time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
APP = Path(os.environ.get("PA_APP_DIR") or ROOT / "app")
OUT = APP / "screenshots"
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
SEED = """try { localStorage.setItem('polymath-arcade-v1', JSON.stringify({ tour: 1, theme: 'dark', name: 'Bruno', xp: 1340, streak: 4, bestStreak: 6,
  lastDay: (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()),
  stats: { rounds: 42, correct: 310, answered: 380, bestCombo: 12 },
  games: { memory: { plays: 3, best: 1520, stars: 3, diff: 4 }, sprint: { plays: 4, best: 2210, stars: 2, diff: 5 }, launch: { plays: 2, best: 1840, stars: 2, diff: 3 },
    market: { plays: 3, best: 2950, stars: 3, diff: 4 }, tracer: { plays: 2, best: 1650, stars: 1, diff: 3 }, econ: { plays: 2, best: 1720, stars: 2, diff: 3 },
    lexicon: { plays: 3, best: 1980, stars: 3, diff: 5 }, globe: { plays: 1, best: 1250, stars: 1, diff: 2 } },
  domains: { brain: 520, math: 640, physics: 410, world: 300, coding: 380, science: 260, finance: 590, econ: 330, business: 210, english: 450 },
  badges: { first: '2026-11-01', explorer: '2026-11-02', stars3: '2026-11-03', streak3: '2026-11-04' } })); } catch (e) {}"""

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen(["python3", "-m", "http.server", "8767", "--bind", "127.0.0.1"], cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
            w = b.new_context(viewport={"width": 1280, "height": 800}).new_page()
            w.add_init_script(SEED); w.goto("http://localhost:8767/"); w.wait_for_timeout(2600)
            w.evaluate("() => { const t = document.querySelector('.section-head'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 76); }")
            w.wait_for_timeout(2600)
            Image.open(io.BytesIO(w.screenshot())).convert("RGB").save(OUT / "wide.jpg", quality=86, optimize=True)
            n = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True).new_page()
            n.add_init_script(SEED); n.goto("http://localhost:8767/"); n.wait_for_timeout(3200)
            Image.open(io.BytesIO(n.screenshot())).convert("RGB").save(OUT / "narrow.jpg", quality=86, optimize=True)
            b.close()
    finally:
        srv.terminate()
    for f in sorted(OUT.iterdir()):
        print(f.name, Image.open(f).size, f"{f.stat().st_size/1024:.0f} KB")

if __name__ == "__main__":
    main()
