"""Headless smoke test: plays every game to its results screen and records errors."""
import sys, time, random
from playwright.sync_api import sync_playwright

import os
from pathlib import Path
URL = os.environ.get("SMOKE_URL", (Path(__file__).resolve().parent.parent / "dist" / "polymath-arcade.html").as_uri())
SPEEDUP = """
(() => { const pn = performance.now.bind(performance), t0 = pn(); performance.now = () => t0 + (pn() - t0) * 12; })();
"""
errors = []
only = sys.argv[1:] or None

def results_open(page):
    return page.evaluate("() => !!document.querySelector('#modal:not([hidden]) .results')")

def play_until_results(page, step, limit=90):
    t = time.time()
    while time.time() - t < limit:
        if results_open(page):
            return True
        step()
        page.wait_for_timeout(60)
    return results_open(page)

def quiz_step(page):
    def step():
        page.evaluate("""() => {
          const fb = document.querySelector('.q-feedback.show .btn'); if (fb) { fb.click(); return; }
          const cs = [...document.querySelectorAll('.choice:not([disabled])')]; if (cs.length) cs[Math.floor(Math.random()*cs.length)].click();
        }""")
    return step

def run_game(page, gid, opts="{}"):
    page.evaluate(f"() => openGame('{gid}', {opts})")
    page.wait_for_timeout(250)
    if gid in ('lexicon', 'science', 'formula', 'tracer', 'money', 'econ', 'breakeven', 'shopper', 'pattern', 'elements', 'globe', 'daily'):
        ok = play_until_results(page, quiz_step(page))
    elif gid == 'sprint':
        ok = play_until_results(page, lambda: page.keyboard.press(str(random.randint(0, 9))))
    elif gid == 'clash':
        ok = play_until_results(page, lambda: page.keyboard.press(random.choice(['ArrowLeft', 'ArrowRight'])))
    elif gid == 'memory':
        ok = play_until_results(page, lambda: page.evaluate("() => { const c=[...document.querySelectorAll('.mm-grid:not(.locked) .mm-cell:not(.hit)')]; if(c.length) c[Math.floor(Math.random()*c.length)].click(); }"))
    elif gid == 'target':
        def st():
            page.evaluate("""() => { const t=[...document.querySelectorAll('.tn-tile')], o=[...document.querySelectorAll('.tn-op')];
              if (Math.random() < 0.15) { [...document.querySelectorAll('#gbody .btn')].find(b => b.textContent.startsWith('Skip'))?.click(); return; }
              if (t.length > 1) { t[0].click(); o[Math.floor(Math.random()*4)].click(); t[1].click(); }
              else [...document.querySelectorAll('#gbody .btn')].find(b => b.textContent === 'Reset')?.click(); }""")
        ok = play_until_results(page, st)
    elif gid == 'scramble':
        def st():
            page.evaluate("""() => { const L=[...document.querySelectorAll('.ws-letter:not(.used)')]; if (L.length && Math.random()<0.7) L[0].click(); else [...document.querySelectorAll('#gbody .btn')].find(b => b.textContent === 'Hint (−40)')?.click(); }""")
        ok = play_until_results(page, st)
    elif gid == 'launch':
        ok = play_until_results(page, lambda: page.evaluate("() => { const b=[...document.querySelectorAll('#gbody .btn')].find(b=>b.textContent==='Launch'); if (b && !b.disabled) b.click(); }"), limit=400)
    elif gid == 'robot':
        for k in ['ArrowUp', 'ArrowUp', 'ArrowUp']:
            page.keyboard.press(k)
        page.keyboard.press('Enter')
        ok = play_until_results(page, lambda: None, limit=15)
    elif gid == 'market':
        ok = play_until_results(page, lambda: page.evaluate("() => { const b=[...document.querySelectorAll('#gbody .btn.big')].find(b=>!b.disabled); b?.click(); }"))
    elif gid == 'tycoon':
        ok = play_until_results(page, lambda: page.evaluate("() => { const b=[...document.querySelectorAll('#gbody .btn.big')].find(b=>!b.disabled); b?.click(); }"), limit=150)
    elif gid == 'estimate':
        def st():
            page.evaluate("""() => { const r=document.getElementById('esRange'); if (r && !r.disabled) { r.value = String(Math.floor(Math.random()*1000)); r.dispatchEvent(new Event('input')); }
              const lock=[...document.querySelectorAll('#gbody .btn')].find(b=>b.textContent==='Lock in guess' && !b.disabled); if (lock) { lock.click(); return; }
              const nx=[...document.querySelectorAll('#gbody .btn.big')].find(b=>!b.hidden); nx?.click(); }""")
        ok = play_until_results(page, st)
    else:
        ok = False
    return ok

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for vw in [(1280, 900), (390, 844)]:
        ctx = browser.new_context(viewport={"width": vw[0], "height": vw[1]})
        page = ctx.new_page()
        page.add_init_script(SPEEDUP)
        page.add_init_script("try { if (!localStorage.getItem('polymath-arcade-v1')) localStorage.setItem('polymath-arcade-v1', JSON.stringify({ tour: 1 })); } catch (e) {}")
        page.on("pageerror", lambda e: errors.append(f"pageerror {vw}: {e}"))
        page.on("console", lambda m: errors.append(f"console {vw}: {m.text}") if (m.type == "error" and "fonts.g" not in m.text and "net::" not in m.text) or "disabled" in m.text else None)
        page.goto(URL)
        page.wait_for_timeout(500)
        print("BG3D ok:", page.evaluate("() => BG3D.ok"), "quality:", page.evaluate("() => BG3D.quality"))
        games = page.evaluate("() => GAMES.map(g => g.id)") + ["daily"]
        if only: games = [g for g in games if g in only]
        if vw[0] < 500: games = games[::4]  # sample on mobile
        for gid in games:
            t0 = time.time()
            opts = "{daily:true, rng: makeRng(hashStr('polymath-daily-' + dayKey()))}" if gid == 'daily' else "{}"
            ok = run_game(page, gid, opts)
            title = page.evaluate("() => document.querySelector('#modal .results h2')?.textContent || ''")
            stars = page.evaluate("() => document.querySelectorAll('#modal .stars-row svg.on').length")
            print(f"{vw[0]}px {gid:10s} {'OK ' if ok else 'FAIL'} {time.time()-t0:5.1f}s  stars={stars} {title}")
            if not ok:
                errors.append(f"{gid} did not reach results at {vw}")
                page.screenshot(path=f"/tmp/fail_{gid}.png")
            page.evaluate("() => closeGame()")
            page.wait_for_timeout(100)
        # views
        for v in ['home', 'daily', 'profile']:
            page.evaluate(f"() => go('{v}')")
            page.wait_for_timeout(150)
        state = page.evaluate("() => ({xp: S.xp, rounds: S.stats.rounds, badges: Object.keys(S.badges).length, streak: S.streak})")
        print("state", state)
        ctx.close()
    browser.close()
print("\n".join(errors) if errors else "NO ERRORS")
