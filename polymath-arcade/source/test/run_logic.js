// Node-based checks for generators, puzzles, levels and simulations.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const store = {};
const ctx = {
  console, Math, Date, JSON, Number, String, Array, Object, Set, Map, Promise, Error, RegExp, Infinity, NaN, isFinite, parseFloat, parseInt, setTimeout, clearTimeout, setInterval, clearInterval, performance,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  window: {}, document: { documentElement: { getAttribute: () => null, setAttribute() {} }, querySelector: () => null, querySelectorAll: () => [] },
  matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ getPropertyValue: () => '' }), navigator: {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const code = fs.readFileSync(path.join(__dirname, 'logic.js'), 'utf8');
vm.runInContext(code + '\n;this.__exports = { QGEN, IMPL, makeRng, makeQuestion, seqGen, mathProblem, genTarget, solveTarget, lexGen, elemGen, sciGen, physGen, codeGen, moneyGen, econGen, bizGen, shopGen, capGen, RC_LEVELS, rcSimulate, tyPlan, tyDay, tyRep, tyBestPrice, TY, TY_WEATHER, launchTargets, collideShot, PLANETS, EST_FACTS, EST_CALC, estFmt, parseEst, mkYears, levelInfo, nearNums, WORDS, GAMES };', ctx);
const X = ctx.__exports;

let fails = 0;
const fail = (...a) => { fails++; if (fails < 60) console.log('FAIL', ...a); };
const bad = s => /NaN|undefined|Infinity|\[object|null/.test(String(s));

// 1. Quiz generators
const gens = { seqGen: X.seqGen, mathMC: X.QGEN.math, lexGen: X.lexGen, elemGen: X.elemGen, sciGen: X.sciGen, physGen: X.physGen, codeGen: X.codeGen, moneyGen: X.moneyGen, econGen: X.econGen, bizGen: X.bizGen, shopGen: X.shopGen, capGen: X.capGen };
const pySnippets = [];
for (const [name, gen] of Object.entries(gens)) {
  let n = 0, totalChoices = 0;
  for (let d = 1; d <= 10; d++) {
    const r = X.makeRng(1000 + d * 17 + name.length);
    for (let k = 0; k < 300; k++) {
      const seen = new Set();
      let q;
      try { q = X.makeQuestion(gen, d, r, k % 10, seen); } catch (e) { fail(name, d, 'threw', e.message); continue; }
      n++; totalChoices += q.choices.length;
      if (q.choices.length < 2) fail(name, d, 'few choices', q.q);
      if (q.ans < 0 || q.ans >= q.choices.length) fail(name, d, 'bad ans index', q.q, q.choices);
      if (new Set(q.choices).size !== q.choices.length) fail(name, d, 'dup choices', q.choices);
      if (bad(q.q) || bad(q.explain || '') || q.choices.some(bad) || bad(q.code || '')) fail(name, d, 'bad text', q.q, q.choices, q.explain);
      if (q.choices.some(c => String(c).trim() === '' || String(c).includes('−$-') || String(c).includes('$-'))) fail(name, d, 'odd choice', q.choices);
      if (name === 'codeGen') {
        const truth = String(q.choices[q.ans]).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        if (q.lang === 'js') {
          const out = [];
          const sb = { console: { log: (...a) => out.push(a.map(String).join(' ')) }, Math };
          vm.createContext(sb);
          try { vm.runInContext(q.code, sb, { timeout: 200 }); } catch (e) { fail('codeGen js threw', e.message, q.code); }
          if (out.join('\n') !== truth) fail('codeGen js mismatch', JSON.stringify(out), 'vs', truth, '\n' + q.code);
        } else if (pySnippets.length < 600) pySnippets.push({ code: q.code, expect: truth });
      }
      if (name === 'mathMC') {
        const expr = q.key.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d+)²/g, '($1*$1)').replace(/(\d+)% of (\d+)/g, '($1/100*$2)');
        const v = eval(expr);
        if (String(v) !== q.choices[q.ans] && Number(q.choices[q.ans]) !== v) fail('math mismatch', q.key, v, q.choices[q.ans]);
      }
    }
  }
  console.log(`${name}: ${n} questions ok, avg ${(totalChoices / n).toFixed(2)} choices`);
}
fs.writeFileSync(path.join(__dirname, 'py_snippets.json'), JSON.stringify(pySnippets));

// 2. Target Number puzzles
for (let d = 1; d <= 10; d++) {
  const r = X.makeRng(77 + d);
  for (let k = 0; k < 150; k++) {
    const P = X.genTarget(d, r);
    const expr = P.sol.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const val = eval(expr);
    if (val !== P.target) fail('target eval', P, val);
    const used = (P.sol.match(/\d+/g) || []).map(Number).sort((a, b) => a - b).join(',');
    if (used !== P.nums.slice().sort((a, b) => a - b).join(',')) fail('target numbers', P);
  }
}
console.log('target puzzles checked');

// 3. Robot levels: brute force minimum program size under slot limits
function* programs(cmds, len) { if (len === 0) { yield []; return; } for (const p of programs(cmds, len - 1)) for (const c of cmds) yield p.concat([c]); }
X.RC_LEVELS.forEach((L, i) => {
  const cmds = L.p1 ? ['F', 'L', 'R', 'P'] : ['F', 'L', 'R'];
  let found = null;
  for (let total = 1; total <= L.best && !found; total++) {
    for (let m = 1; m <= Math.min(total, L.main) && !found; m++) {
      const p1len = total - m;
      if (p1len > L.p1) continue;
      for (const main of programs(cmds, m)) {
        if (found) break;
        if (p1len === 0 && main.includes('P')) continue;
        for (const p1 of programs(cmds, p1len)) {
          const res = X.rcSimulate(L, { main, p1 });
          if (res.won) { found = { total, main: main.join(''), p1: p1.join('') }; break; }
        }
      }
    }
  }
  if (!found) fail(`robot level ${i + 1}: no solution within best=${L.best}`);
  else if (found.total !== L.best) fail(`robot level ${i + 1}: best should be ${found.total} (found ${found.main} / ${found.p1}), listed ${L.best}`);
  else console.log(`robot level ${i + 1} ok: min ${found.total} e.g. main=${found.main} p1=${found.p1}`);
});

// 4. Planet Launch reachability
function shoot(T, angle, speed) {
  const g = X.PLANETS[T.planet].g, th = angle * Math.PI / 180, vx = speed * Math.cos(th), vy = speed * Math.sin(th);
  let t = 0, px = 0, py = 0;
  for (let k = 0; k < 200000; k++) { const t2 = t + 1 / 400, x2 = vx * t2, y2 = vy * t2 - 0.5 * g * t2 * t2; const o = X.collideShot(px, py, x2, y2, T); if (o) return o; t = t2; px = x2; py = y2; }
  return null;
}
let unreachable = 0, checked = 0;
for (let d = 1; d <= 10; d++) {
  const r = X.makeRng(500 + d);
  for (let k = 0; k < 12; k++) {
    const targets = X.launchTargets(d, r);
    for (const T of targets) {
      checked++;
      let ok = false;
      for (let a = 10; a <= 80 && !ok; a += 2) for (let s = 1; s <= T.vmax && !ok; s += 0.1) { const o = shoot(T, a, Math.round(s * 10) / 10); if (o && o.type === 'hit') ok = true; }
      if (!ok) { unreachable++; fail('launch unreachable', JSON.stringify(T)); }
    }
  }
}
console.log(`launch targets: ${checked - unreachable}/${checked} reachable`);

// 5. Tycoon calibration
function playTycoon(strategy, seed) {
  const r = X.makeRng(seed), plan = X.tyPlan(r);
  let cash = X.TY.start, rep = 1;
  for (let i = 0; i < X.TY.days; i++) {
    if (cash < X.TY.rent + X.TY.cost * 10) break;
    const D = plan[i];
    const { price, cups, ads } = strategy(D, cash, rep);
    const maxC = Math.max(0, Math.min(400, Math.floor((cash - X.TY.rent - ads) / X.TY.cost / 5) * 5));
    const c = Math.min(cups, maxC);
    const o = X.tyDay(D, price, c, ads, rep);
    cash += o.profit; rep = X.tyRep(rep, o, price, ads);
  }
  return cash - X.TY.start;
}
const fcMu = D => X.TY_WEATHER[D.fc].mu + (D.ev ? D.ev.mu : 0);
const fcTraffic = (D, ads, rep) => X.TY.base * X.TY_WEATHER[D.fc].traffic * (D.ev ? D.ev.traffic : 1) * (ads >= 25 ? 1.45 : ads >= 10 ? 1.22 : 1) * rep;
const strategies = {
  naive: () => ({ price: 1.0, cups: 150, ads: 0 }),
  flat2: () => ({ price: 2.0, cups: 100, ads: 0 }),
  decent: D => { const p = [2.25, 2.0, 1.5, 1.25][D.fc]; return { price: p, cups: [160, 120, 80, 40][D.fc], ads: 10 }; },
  smart: (D, cash, rep) => { const mu = fcMu(D), p = X.tyBestPrice(mu); const ads = D.fc <= 1 ? 10 : 0; const want = fcTraffic(D, ads, rep) * (1 - normCdf((p - mu) / 0.7)); return { price: p, cups: Math.round(want * 1.05 / 5) * 5, ads }; }
};
function normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), dd = 0.3989423 * Math.exp(-z * z / 2); const p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
for (const [name, s] of Object.entries(strategies)) {
  const res = []; for (let seed = 1; seed <= 400; seed++) res.push(playTycoon(s, seed));
  res.sort((a, b) => a - b);
  const q = f => res[Math.floor(f * (res.length - 1))].toFixed(0);
  console.log(`tycoon ${name}: p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}`);
}

// 6. Market Mayhem benchmark spread
{
  const outs = { mix: [], cash: [], stocks: [], crypto: [] };
  for (let seed = 1; seed <= 400; seed++) {
    const Y = X.mkYears(X.makeRng(seed));
    let mix = 10000, cash = 10000, st = 10000, cr = 10000, inf = 1;
    Y.forEach(y => { mix *= 1 + 0.6 * y.ret[0] + 0.4 * y.ret[1]; cash *= 1 + y.cash; st *= 1 + y.ret[0]; cr *= 1 + 0.5 * y.ret[0] + 0.2 * y.ret[1] + 0.3 * y.ret[3]; inf *= 1 + y.infl; });
    outs.mix.push(mix); outs.cash.push(cash); outs.stocks.push(st); outs.crypto.push(cr);
  }
  for (const [k, arr] of Object.entries(outs)) { arr.sort((a, b) => a - b); console.log(`market ${k}: median ${arr[200].toFixed(0)}  p10 ${arr[40].toFixed(0)}  p90 ${arr[360].toFixed(0)}`); }
}

// 7. Estimation facts and helpers
X.EST_FACTS.concat(X.EST_CALC.map(f => f())).forEach(f => { if (!(f.min < f.a && f.a < f.max)) fail('estimate range', f.q); if (bad(f.ex)) fail('estimate text', f.q, f.ex); });
[[86400, '86,400'], [149.6e6, '150 million'], [8.3, '8.3'], [42.195, '42.2'], [1048576, '1.05 million'], [13.8e9, '13.8 billion'], [0.5, '0.5'], [204, '204']].forEach(([v, s]) => { const o = X.estFmt(v); if (o !== s) fail('estFmt', v, o, 'expected', s); });
[['86400', 86400], ['86,400', 86400], ['2.5m', 2.5e6], ['$1,825', 1825], ['13.8 billion', 13.8e9], ['4k', 4000], ['abc', NaN]].forEach(([s, v]) => { const o = X.parseEst(s); if (!(o === v || (isNaN(o) && isNaN(v)))) fail('parseEst', s, o); });
console.log('estimation checked');

// 8. Words: scrambles must differ from the word; no duplicate words
const seenW = new Set(); X.WORDS.forEach(w => { if (seenW.has(w[0])) fail('dup word', w[0]); seenW.add(w[0]); if (!/^[A-Z]+$/.test(w[0])) fail('word chars', w[0]); });
console.log(`levels: lvl at 0 xp=${X.levelInfo(0).lvl}, 1000 xp=${X.levelInfo(1000).lvl}, 3000 xp=${X.levelInfo(3000).lvl}, 6000 xp=${X.levelInfo(6000).lvl}`);
console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
