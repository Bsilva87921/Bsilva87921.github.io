"""Test the installable app build over http: manifest, icons, service worker, offline reload,
deep links, splash, swipe navigation, and a few games outside the Claude viewer."""
import json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8765
BASE = f"http://localhost:{PORT}/"
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=Path(os.environ.get("PA_APP_DIR") or ROOT / "app"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
fails, errors = [], []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)
try:
    man = json.loads(urllib.request.urlopen(BASE + "manifest.webmanifest").read())
    check(man["display"] == "standalone" and man["start_url"] == "./", "manifest: standalone, start_url")
    for ic in man["icons"] + [i for s in man.get("shortcuts", []) for i in s["icons"]] + man.get("screenshots", []):
        code = urllib.request.urlopen(BASE + ic["src"]).status
        check(code == 200, f"asset {ic['src']} served")
    sw = urllib.request.urlopen(BASE + "sw.js").read().decode()
    check("__VERSION__" not in sw and "pa-core-" in sw, "service worker stamped with a version")

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
        ctx = b.new_context(viewport={"width": 1280, "height": 860})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append("pageerror " + str(e)))
        pg.on("console", lambda m: m.type == "error" and "net::" not in m.text and "fonts.g" not in m.text and errors.append(m.text))
        pg.goto(BASE)
        check(pg.evaluate("() => !!document.getElementById('splash')"), "splash shows on launch")
        pg.wait_for_timeout(600); pg.screenshot(path="/tmp/app_splash.png")
        pg.wait_for_timeout(2200)
        check(pg.evaluate("() => !document.getElementById('splash')"), "splash removes itself")
        check(pg.evaluate("() => window.PA_APP === true && App.isApp"), "app flag on")
        check(pg.evaluate("() => !window.claude"), "runs outside the Claude viewer")
        ready = pg.evaluate("() => navigator.serviceWorker.ready.then(r => !!r.active)")
        check(ready, "service worker active")
        pg.reload(); pg.wait_for_timeout(2600)
        check(pg.evaluate("() => !!navigator.serviceWorker.controller"), "page controlled by the worker after reload")
        check(pg.evaluate("() => Tour.active"), "tour auto-offers to a new player")
        pg.evaluate("() => Tour.end()")
        check(pg.evaluate("() => S.tour === 1"), "tour remembered after closing")
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_timeout(2600)
        check(pg.evaluate("() => document.querySelectorAll('.tile').length") == 21, "offline reload still renders all 21 games")
        pg.evaluate("() => { openGame('sprint'); }"); pg.wait_for_timeout(800)
        check(pg.evaluate("() => !!CUR && !document.getElementById('game').hidden"), "a game opens offline")
        pg.evaluate("() => closeGame()")
        ctx.set_offline(False)
        pg.goto(BASE + "#daily"); pg.wait_for_timeout(2600)
        check(pg.evaluate("() => VIEW") == "daily", "deep link #daily opens the Daily view")
        pg.evaluate("() => App.navTo('profile')"); pg.wait_for_timeout(900)
        check(pg.evaluate("() => location.hash") == "#profile", "hash follows the view")
        pg.goto(BASE + "#tour"); pg.wait_for_timeout(3000)
        check(pg.evaluate("() => Tour.active"), "deep link #tour starts the tour")
        pg.evaluate("() => Tour.end()")
        ctx.close()

        m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        mp = m.new_page()
        mp.on("pageerror", lambda e: errors.append("mobile pageerror " + str(e)))
        mp.add_init_script("try { localStorage.setItem('polymath-arcade-v1', JSON.stringify({ tour: 1, theme: 'dark' })); } catch (e) {}")
        mp.goto(BASE); mp.wait_for_timeout(2800)
        swipe = """(dx) => { const v = document.getElementById('view'); const r = v.getBoundingClientRect();
          const mk = (x, y) => new Touch({ identifier: 1, target: v, clientX: x, clientY: y });
          v.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(300, 400)], changedTouches: [mk(300, 400)], bubbles: true }));
          v.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(300 + dx, 410)], bubbles: true })); }"""
        mp.evaluate(swipe, -160); mp.wait_for_timeout(900)
        check(mp.evaluate("() => VIEW") == "daily", "swipe left moves Games to Daily")
        mp.evaluate(swipe, -160); mp.wait_for_timeout(900)
        check(mp.evaluate("() => VIEW") == "profile", "swipe left moves Daily to Profile")
        mp.evaluate(swipe, 160); mp.wait_for_timeout(900)
        check(mp.evaluate("() => VIEW") == "daily", "swipe right goes back")
        check(mp.evaluate("() => document.getElementById('installBtn').hidden"), "install button hidden until the browser offers install")
        mp.screenshot(path="/tmp/app_mobile.png")
        m.close()
        b.close()
finally:
    srv.terminate()
print("errors:", errors[:6] if errors else "none")
print("FAILED: " + "; ".join(fails) if fails else "ALL APP CHECKS PASSED")
