"""Record every ESPN response the live Sports Lab page makes (board, standings, stats center, a game drawer) into a HAR,
so the page can be replayed offline in a test sandbox."""
import asyncio, json, os, re, time
from playwright.async_api import async_playwright
OUT = os.environ.get('OUT_DIR', 'out')
URL = 'https://bsilva87921.github.io/live-sports-lab/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1360, 'height': 1000}, record_har_path=f'{OUT}/sports.har.zip', record_har_content='attach', record_har_url_filter=re.compile(r'espn\.com'))
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:200]))
        t0 = int(time.time() * 1000)
        await pg.goto(URL, wait_until='domcontentloaded')
        await pg.wait_for_function("window.APP && APP.S && APP.S.mode !== 'loading'", timeout=90000)
        await pg.wait_for_timeout(6000)
        mode = await pg.evaluate('APP.S.mode')
        counts = await pg.evaluate("Object.fromEntries(APP.LEAGUES.map(l => [l.id, (APP.S.data[l.id].games||[]).length + ' games / ' + (APP.S.data[l.id].standings||[]).length + ' standings']))")
        # open one game drawer per sport kind that has a game today (in-progress first, then final)
        opened = []
        for lg in ['nfl', 'nba', 'nhl', 'epl', 'ncaaf', 'mlb']:
            gid = await pg.evaluate(f"(() => {{ const g = (APP.S.data['{lg}'].games||[]).slice().sort((a,b)=>({{in:0,post:1,pre:2}}[a.state]-({{in:0,post:1,pre:2}}[b.state])))[0]; return g ? g.id : null; }})()")
            if not gid: continue
            el = await pg.query_selector(f'[data-game="{gid}"]')
            if el:
                await el.click(); await pg.wait_for_timeout(3500); opened.append(lg + ':' + gid)
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        for tab in ['standings', 'stats', 'lab', 'method', 'board']:
            await pg.click(f'.tab[data-tab="{tab}"]'); await pg.wait_for_timeout(5000 if tab == 'stats' else 2000)
        t1 = int(time.time() * 1000)
        await ctx.close(); await b.close()
        json.dump({'t0': t0, 't1': t1, 'mode': mode, 'counts': counts, 'opened': opened, 'console': logs[:40]}, open(f'{OUT}/har_meta.json', 'w'), indent=1)
        print(mode, counts, opened)
asyncio.run(main())
