// Temporary check of the live Probable sites in a real browser: errors, 3D renderer, Insights bar, Ask AI answers,
// install support, layout overflow, and screenshots (including 1200x630 previews). Usage: node check.mjs linux|mac
import { chromium } from 'playwright';
import fs from 'node:fs';
const OS = process.argv[2] || 'linux';
const OUT = 'verify/out-' + OS; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://bsilva87921.github.io';
const PAGES = [
  { k: 'sports', path: '/live-sports-lab/', q: 'Which games are closest right now?' },
  { k: 'econ', path: '/probable-atlas/', q: 'How is the world economy doing?' },
  { k: 'fin', path: '/probable-atlas/finance/', q: 'Is a correction likely?' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OG_ONLY = process.env.OG_ONLY === '1' && OS !== 'mac';   // second pass: previews and the terrain only
const report = { os: OS, at: new Date().toISOString(), pages: {} };
const log = (...a) => console.log(...a);

async function launch() {
  if (OS === 'mac') {
    for (const headless of [false, true]) {
      try { const b = await chromium.launch({ channel: 'chrome', headless }); return { b, mode: 'Chrome ' + (headless ? 'headless' : 'headed') }; }
      catch (e) { log('launch failed', headless, String(e.message).slice(0, 200)); }
    }
  }
  return { b: await chromium.launch(), mode: 'Chromium headless' };
}
if (process.env.WAIT_FOR) { // wait until the new build is live (Pages deploys can lag the push)
  for (let i = 0; i < 60; i++) {
    try { const t = await (await fetch(BASE + '/probable-atlas/finance/?nocache=' + Date.now(), { cache: 'no-store' })).text(); if (t.includes(process.env.WAIT_FOR)) { log('new build is live after', i * 20, 's'); break; } } catch (e) { /* retry */ }
    await sleep(20000);
  }
  await sleep(20000);
}
const { b, mode } = await launch();
report.browser = mode + ' ' + b.version();
log('browser', report.browser);

{ // raw WebGPU availability in this browser
  const ctx = await b.newContext(); const pg = await ctx.newPage();
  await pg.goto(BASE + '/apps/privacy.html');
  report.webgpu = await pg.evaluate(async () => {
    if (!navigator.gpu) return { api: false };
    try {
      const a = await navigator.gpu.requestAdapter(); if (!a) return { api: true, adapter: null };
      const i = a.info || {}; return { api: true, adapter: { vendor: i.vendor, architecture: i.architecture, description: i.description, fallback: !!a.isFallbackAdapter } };
    } catch (e) { return { api: true, error: String(e) }; }
  });
  log('webgpu', JSON.stringify(report.webgpu));
  await ctx.close();
}

async function open(url, o = {}) {
  const ctx = o.ctx || await b.newContext({ viewport: o.vp || { width: 1360, height: 900 }, deviceScaleFactor: o.dsf || 1, colorScheme: o.theme || 'light', isMobile: !!o.mobile, hasTouch: !!o.mobile });
  const pg = await ctx.newPage();
  pg._errs = []; pg._fails = [];
  pg.on('pageerror', e => pg._errs.push('pageerror: ' + String(e).slice(0, 300)));
  pg.on('console', m => { if (m.type() === 'error') pg._errs.push('console: ' + m.text().slice(0, 300)); });
  pg.on('response', r => { if (r.status() >= 400) pg._fails.push(r.status() + ' ' + r.url().slice(0, 170)); });
  pg.on('requestfailed', r => pg._fails.push('failed ' + ((r.failure() || {}).errorText || '') + ' ' + r.url().slice(0, 170)));
  await pg.goto(url, { waitUntil: 'load', timeout: 90000 });
  await sleep(o.wait ?? 12000);
  return { ctx, pg };
}
const state = pg => pg.evaluate(() => {
  const el = document.querySelector('[data-px3d]'), ins = document.querySelector('.ins'), fab = document.getElementById('askFab');
  const I = typeof INS !== 'undefined' ? INS : window.INS;
  return {
    title: document.title,
    px3d: el ? el.dataset.px3d : null,
    canvases: document.querySelectorAll('canvas').length,
    insights: !!(ins && !ins.hidden && ins.getBoundingClientRect().height > 0),
    insightItems: I && I.items ? I.items.map(x => [x.tag, x.text, x.val].filter(Boolean).join(' | ')) : null,
    askButton: fab ? fab.textContent.trim() : null,
    installButton: !!document.querySelector('.appbtn'),
    themeAttr: document.documentElement.dataset.theme || null,
    hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : false,
  };
});
async function ask(pg, q) {
  await pg.click('#askFab'); await pg.fill('#chatIn', q); await pg.press('#chatIn', 'Enter');
  await sleep(3500);
  return pg.evaluate(() => { const m = [...document.querySelectorAll('#chatMsgs .msg.bot')].pop(); return m ? { text: m.innerText.slice(0, 600), error: !!m.querySelector('.err') } : null; });
}

for (const P of PAGES) {
  if (OG_ONLY) break;
  const R = report.pages[P.k] = {};
  // desktop, light
  let { ctx, pg } = await open(BASE + P.path);
  Object.assign(R, await state(pg));
  R.serviceWorker = await pg.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistration(); return r ? r.scope : null; } catch (e) { return 'error ' + e; } });
  await pg.screenshot({ path: `${OUT}/desk-${P.k}.png` });
  const el = await pg.$('[data-px3d]'); if (el) { try { await el.screenshot({ path: `${OUT}/3d-${P.k}.png` }); } catch (e) { /* off screen */ } }
  R.answer = await ask(pg, P.q);
  await pg.screenshot({ path: `${OUT}/chat-${P.k}.png` });
  if (P.k === 'sports') { await pg.goto(BASE + P.path + '#method'); await sleep(5000); R.trackRecordShown = await pg.evaluate(() => /Track record/i.test(document.body.innerText)); await pg.screenshot({ path: `${OUT}/track-${P.k}.png` }); }
  R.errors = pg._errs.slice(0, 12); R.httpFailures = [...new Set(pg._fails)].slice(0, 12);
  await ctx.close();
  log(P.k, JSON.stringify({ px3d: R.px3d, insights: R.insights, n: R.insightItems && R.insightItems.length, ask: R.askButton, errors: R.errors.length, fails: R.httpFailures.length }));
  if (OS === 'mac') continue;
  // desktop, dark
  ({ ctx, pg } = await open(BASE + P.path, { theme: 'dark', wait: 10000 }));
  R.dark = await state(pg); R.dark.errors = pg._errs.slice(0, 6);
  await pg.screenshot({ path: `${OUT}/dark-${P.k}.png` }); await ctx.close();
  // phone, with an ?ask= link
  ({ ctx, pg } = await open(BASE + P.path + '?ask=' + encodeURIComponent(P.q), { vp: { width: 390, height: 844 }, dsf: 2, mobile: true, wait: 12000 }));
  R.mobile = await state(pg); R.mobile.errors = pg._errs.slice(0, 6);
  R.mobile.askLinkAnswered = await pg.evaluate(() => document.querySelectorAll('#chatMsgs .msg.bot').length > 0);
  await pg.screenshot({ path: `${OUT}/mob-ask-${P.k}.png` }); await ctx.close();
  ({ ctx, pg } = await open(BASE + P.path, { vp: { width: 390, height: 844 }, dsf: 2, mobile: true, wait: 12000 }));
  await pg.screenshot({ path: `${OUT}/mob-${P.k}.png` }); await ctx.close();
}

if (OG_ONLY) {
  const { ctx: c0, pg: p0 } = await open(BASE + '/probable-atlas/finance/', { wait: 13000 });
  report.finTerrain = await state(p0); report.finTerrain.errors = p0._errs.slice(0, 6);
  const e0 = await p0.$('#mast3d'); if (e0) await e0.screenshot({ path: `${OUT}/3d-fin.png` }); await c0.close();
}
if (OS !== 'mac' && !OG_ONLY) {
  // the Atlas app home screen, after visiting both modules so it has saved readings
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' });
  for (const p of ['/probable-atlas/', '/probable-atlas/finance/']) { const x = await open(BASE + p, { ctx, wait: 9000 }); await x.pg.close(); }
  const { pg } = await open(BASE + '/probable-atlas/app/', { ctx, wait: 10000 });
  report.pages.home = await state(pg); report.pages.home.errors = pg._errs.slice(0, 8); report.pages.home.httpFailures = [...new Set(pg._fails)].slice(0, 8);
  report.pages.home.readings = await pg.evaluate(() => document.querySelectorAll('#hmRead .hm-r').length);
  await pg.screenshot({ path: `${OUT}/desk-home.png` });
  await pg.setViewportSize({ width: 390, height: 844 }); await sleep(2500); await pg.screenshot({ path: `${OUT}/mob-home.png` });
  await ctx.close();

}
if (OS !== 'mac') {
  // 1200x630 previews: Atlas pages as they are; the Sports Lab as a card with a capture of the page
  for (const k of ['econ', 'fin']) {
    const P = PAGES.find(x => x.k === k);
    const { ctx: c, pg: p } = await open(BASE + P.path, { vp: { width: 1200, height: 630 }, wait: 13000 });
    await p.screenshot({ path: `${OUT}/og-${k}.png` }); await c.close();
  }
  const { ctx: c, pg: p } = await open(BASE + '/live-sports-lab/', { vp: { width: 1100, height: 780 }, dsf: 2, wait: 14000 });
  const shot = (await p.screenshot()).toString('base64'); await c.close();
  const cardCtx = await b.newContext({ viewport: { width: 1200, height: 630 } }); const card = await cardCtx.newPage();
  await card.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"><style>
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Barlow,system-ui,sans-serif;color:#eef3fb;
      background:radial-gradient(90% 120% at 0% 0%,#1b2f55 0%,#0f1a33 55%,#0a1226 100%)}
    .l{position:absolute;left:56px;top:54px;width:360px;height:522px;display:flex;flex-direction:column}
    .eb{font:700 17px/1 'JetBrains Mono',monospace;letter-spacing:.14em;color:#f2b638}
    h1{margin:22px 0 0;font:800 50px/1.02 Barlow,sans-serif;letter-spacing:-.01em}
    p{margin:20px 0 0;font:500 19.5px/1.42 Barlow,sans-serif;color:#c7d3e6}
    .ch{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.ch span{font:700 15px/1 Barlow;padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}
    .f{margin-top:auto;display:flex;align-items:end;justify-content:space-between}.f b{display:block;font:800 21px/1.1 Barlow}.f small{font:500 16px/1.3 Barlow;color:#aebbd0}
    .go{font:800 18px/1 Barlow;color:#14110a;background:#f2b638;padding:12px 16px;border-radius:9px}
    .s{position:absolute;left:446px;top:56px;width:900px;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.12)}
    .s img{display:block;width:900px}
  </style></head><body><div class="l"><div class="eb">LIVE · 3D · AI</div><h1>Live Sports Probability Lab</h1>
    <p>13 leagues plus tennis, UFC and golf. Live win odds for every game, a 3D arena of the next 40 hours, and a track record graded every hour.</p>
    <div class="ch"><span>WebGPU 3D</span><span>Ask AI</span><span>Monte Carlo</span><span>Track record</span></div>
    <div class="f"><div><b>Bruno Silva</b><small>bsilva87921.github.io</small></div><span class="go">Open live ›</span></div></div>
    <div class="s"><img src="data:image/png;base64,${shot}"></div></body></html>`, { waitUntil: 'networkidle' });
  await card.evaluate(() => document.fonts.ready); await sleep(800);
  await card.screenshot({ path: `${OUT}/og-sports.png` }); await cardCtx.close();
}

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
log('REPORT ' + JSON.stringify(report));
await b.close();
log('done');
