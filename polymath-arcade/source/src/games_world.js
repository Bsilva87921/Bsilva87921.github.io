/* =====================================================================
   Real World: Estimation Station, Smart Shopper, Globe Trotter
   ===================================================================== */

/* ---------- Estimation Station ---------- */
const EST_FACTS = [
  { q: 'How many seconds are in one day?', a: 86400, unit: 'seconds', min: 1000, max: 1e7, ex: '60 seconds × 60 minutes × 24 hours = 86,400.' },
  { q: 'How many minutes are in a year (not a leap year)?', a: 525600, unit: 'minutes', min: 1e4, max: 1e8, ex: '60 × 24 × 365 = 525,600.' },
  { q: 'How many hours are in a year (not a leap year)?', a: 8760, unit: 'hours', min: 100, max: 1e6, ex: '24 × 365 = 8,760.' },
  { q: 'How tall is Mount Everest?', a: 8849, unit: 'meters', min: 100, max: 1e6, ex: 'A 2020 survey measured 8,848.86 m: nearly 9 km.' },
  { q: 'How far is the Moon from Earth, on average?', a: 384400, unit: 'km', min: 1000, max: 1e8, ex: 'About 384,400 km, roughly 30 Earths lined up side by side.' },
  { q: 'How far is Earth from the Sun, on average?', a: 149.6e6, unit: 'km', min: 1e6, max: 1e10, ex: 'About 149.6 million km. Astronomers call this one astronomical unit.' },
  { q: 'How fast does light travel?', a: 299792, unit: 'km per second', min: 100, max: 1e8, ex: 'About 300,000 km/s. Light could circle Earth about 7.5 times in one second.' },
  { q: 'How fast does sound travel through air at 20 °C?', a: 343, unit: 'meters per second', min: 10, max: 1e5, ex: 'About 343 m/s. Count the seconds between lightning and thunder, divide by 3, and you get the distance in km.' },
  { q: 'How many bones are in an adult human body?', a: 206, unit: 'bones', min: 10, max: 1e4, ex: '206 for a typical adult. Babies start with around 300 that fuse together as they grow.' },
  { q: 'How many keys are on a standard piano?', a: 88, unit: 'keys', min: 10, max: 1000, ex: '88 keys: 52 white and 36 black.' },
  { q: 'How many elements are on the periodic table?', a: 118, unit: 'elements', min: 10, max: 1e4, ex: '118 confirmed elements. The newest four were named in 2016.' },
  { q: 'What is Earth’s circumference at the equator?', a: 40075, unit: 'km', min: 1000, max: 1e7, ex: 'About 40,075 km around.' },
  { q: 'How many days pass from one full moon to the next?', a: 29.5, unit: 'days', min: 1, max: 1000, ex: 'About 29.5 days. The word “month” comes from “moon”.' },
  { q: 'How long does sunlight take to reach Earth?', a: 8.3, unit: 'minutes', min: 0.1, max: 1000, ex: '150 million km ÷ 300,000 km/s ≈ 500 seconds, about 8 minutes 20 seconds.' },
  { q: 'How tall is the Eiffel Tower, including its antennas?', a: 330, unit: 'meters', min: 10, max: 1e4, ex: 'About 330 m since a new antenna was added in 2022.' },
  { q: 'How deep is the deepest point in the ocean (Challenger Deep)?', a: 10935, unit: 'meters', min: 100, max: 1e6, ex: 'About 10,900 m. Mount Everest would fit inside with over 2 km of water to spare.' },
  { q: 'How many times does a heart beating 70 times a minute beat in one day?', a: 100800, unit: 'beats', min: 1000, max: 1e8, ex: '70 × 60 × 24 = 100,800.' },
  { q: 'How many feet are in a mile?', a: 5280, unit: 'feet', min: 100, max: 1e6, ex: '5,280 feet.' },
  { q: 'Counting squares of every size, how many squares are on a chessboard?', a: 204, unit: 'squares', min: 10, max: 1e4, ex: '64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204. Most people count only the 64 small ones.' },
  { q: 'What is 2 to the power of 20?', a: 1048576, unit: '', min: 1000, max: 1e9, ex: '2¹⁰ = 1,024, so 2²⁰ = 1,024 × 1,024 ≈ 1.05 million.' },
  { q: 'What is Earth’s diameter?', a: 12742, unit: 'km', min: 100, max: 1e7, ex: 'About 12,742 km.' },
  { q: 'How many member states does the United Nations have?', a: 193, unit: 'countries', min: 10, max: 1e4, ex: '193. The newest, South Sudan, joined in 2011.' },
  { q: 'How many people walked on the Moon during the Apollo missions (1969–1972)?', a: 12, unit: 'people', min: 1, max: 1000, ex: '12 astronauts, across six landings.' },
  { q: 'About how many neurons are in a human brain?', a: 86e9, unit: 'neurons', min: 1e6, max: 1e13, ex: 'About 86 billion, a widely cited estimate.' },
  { q: 'How old is the universe?', a: 13.8e9, unit: 'years', min: 1e6, max: 1e13, ex: 'About 13.8 billion years.' },
  { q: 'How old is Earth?', a: 4.54e9, unit: 'years', min: 1e6, max: 1e13, ex: 'About 4.54 billion years.' },
  { q: 'How long is a marathon?', a: 42.195, unit: 'km', min: 1, max: 1000, ex: '42.195 km, or 26.2 miles.' },
  { q: 'How much does one liter of water weigh?', a: 1000, unit: 'grams', min: 10, max: 1e6, ex: '1,000 grams, or 1 kg. The kilogram was originally defined this way.' },
  { q: 'How far away is the nearest star after the Sun (Proxima Centauri)?', a: 4.24, unit: 'light-years', min: 0.1, max: 1000, ex: 'About 4.24 light-years, or roughly 40 trillion km.' }
];
const EST_CALC = [
  () => { const v = 1.07 ** 30; return { q: 'If $1 grows by 7% every year, what is it worth after 30 years?', a: v, unit: '', money: true, min: 1, max: 1000, ex: `1.07³⁰ ≈ ${money(v, 2)}. By the Rule of 72, money doubles about every 10 years at 7%: three doublings is $8, so a bit under that.` }; },
  () => { const i = 0.07 / 12, v = 100 * ((1 + i) ** 480 - 1) / i; return { q: 'You invest $100 every month for 40 years and earn 7% a year. About how much do you end up with?', a: v, unit: '', money: true, min: 1000, max: 1e8, ex: `About ${money(v)}. You put in only $48,000; compound growth earned the rest.` }; },
  () => { const P = 30000, i = 0.07 / 12, pay = P * i / (1 - (1 + i) ** -60), tot = pay * 60 - P; return { q: 'How much interest do you pay in total on a $30,000 car loan at 7% APR over 5 years?', a: tot, unit: '', money: true, min: 100, max: 1e6, ex: `Monthly payments of ${money(pay, 2)} × 60 = ${money(pay * 60)}, so about ${money(tot)} is interest.` }; },
  () => ({ q: 'A $5 coffee every day for a year costs how much?', a: 1825, unit: '', money: true, min: 10, max: 1e6, ex: '$5 × 365 = $1,825.' }),
  () => { const v = 1000 * 1.05 ** 10; return { q: '$1,000 earns 5% a year, compounded yearly. What is it worth after 10 years?', a: v, unit: '', money: true, min: 100, max: 1e6, ex: `1,000 × 1.05¹⁰ ≈ ${money(v)}.` }; }
];
function sig3(v) { if (v === 0) return 0; const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2); return Math.round(v / p) * p; }
function estFmt(v, isMoney) {
  const a = Math.abs(v);
  let s;
  if (a >= 1e12) s = fmt(sig3(v) / 1e12, 2).replace(/\.?0+$/, '') + ' trillion';
  else if (a >= 1e9) s = fmt(sig3(v) / 1e9, 2).replace(/\.?0+$/, '') + ' billion';
  else if (a >= 1e6) s = fmt(sig3(v) / 1e6, 2).replace(/\.?0+$/, '') + ' million';
  else if (a >= 1000) s = fmt(sig3(v));
  else if (a >= 100) s = fmt(Math.round(v));
  else if (a >= 10) s = fmt(sig3(v), 1).replace(/\.0$/, '');
  else s = fmt(sig3(v), 2).replace(/\.?0+$/, '');
  return isMoney ? '$' + s : s;
}
function parseEst(str) {
  let s = String(str).toLowerCase().replace(/[$,\s]/g, '');
  let m = 1;
  const suf = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };
  const mm = s.match(/^([0-9]*\.?[0-9]+)([a-z]*)$/);
  if (!mm) return NaN;
  if (mm[2]) { if (!(mm[2] in suf)) return NaN; m = suf[mm[2]]; }
  return parseFloat(mm[1]) * m;
}
let EST_RECENT = [];
IMPL.estimate = {
  play(ctx) {
    const r = ctx.r, N = 8;
    const facts = r.shuffle(EST_FACTS.filter(f => !EST_RECENT.includes(f.q)));
    const qs = r.shuffle(r.sample(EST_CALC, 2).map(f => f()).concat(facts.slice(0, N - 2)));
    EST_RECENT = qs.map(q => q.q).slice(0, 12);
    let i = 0, total = 0, bulls = 0, cur = null, guess = 0, locked = false;
    const results = [];
    const prog = h('div', { class: 'q-prog', 'aria-hidden': 'true' });
    for (let k = 0; k < N; k++) prog.append(h('span'));
    const qEl = h('p', { class: 'es-q' });
    const gEl = h('div', { class: 'es-guess', 'aria-live': 'polite' });
    const range = h('input', { type: 'range', id: 'esRange', min: '0', max: '1000', step: '1', 'aria-label': 'Your estimate (logarithmic scale)' });
    const scale = h('div', { class: 'es-scale' }, range);
    const ticks = h('div', { class: 'es-ticks', 'aria-hidden': 'true' });
    const txt = h('input', { type: 'text', id: 'esText', inputmode: 'decimal', placeholder: 'or type a number, like 86400 or 2.5m', autocomplete: 'off', 'aria-label': 'Type your estimate' });
    const lockB = h('button', { class: 'btn primary', type: 'button', onclick: lock }, 'Lock in guess');
    const out = h('div', { class: 'es-result', 'aria-live': 'polite' });
    const nextB = h('button', { class: 'btn primary big', type: 'button', onclick: next, hidden: true }, 'Next question');
    ctx.body.append(h('div', { class: 'stack' }, prog, h('div', { class: 'panel stack' }, qEl, gEl, scale, ticks, h('div', { class: 'es-input' }, txt, lockB)), out, h('div', { class: 'row center' }, nextB)));
    const L = () => [Math.log10(cur.min), Math.log10(cur.max)];
    const toVal = p => { const [a, b] = L(); return 10 ** (a + (b - a) * p / 1000); };
    const toPos = v => { const [a, b] = L(); return clamp((Math.log10(clamp(v, cur.min, cur.max)) - a) / (b - a) * 1000, 0, 1000); };
    function showGuess() { gEl.innerHTML = `<b>${estFmt(guess, cur.money)}</b><small>${esc(cur.unit || '')}</small>`; }
    function load() {
      cur = qs[i]; locked = false;
      $$('span', prog).forEach((s, k) => { s.className = k < i ? (results[k] >= 60 ? 'ok' : 'no') : k === i ? 'cur' : ''; });
      qEl.textContent = cur.q;
      guess = toVal(500); range.value = '500'; range.disabled = false; txt.value = ''; txt.disabled = false;
      $$('.mk', scale).forEach(m => m.remove());
      ticks.innerHTML = [0, 250, 500, 750, 1000].map(p => `<span>${estFmt(toVal(p), cur.money)}</span>`).join('');
      out.innerHTML = ''; lockB.disabled = false; nextB.hidden = true;
      ctx.hud('q', 'Question', `${i + 1}/${N}`);
      showGuess();
    }
    range.addEventListener('input', () => { if (locked) return; guess = toVal(+range.value); txt.value = ''; showGuess(); });
    txt.addEventListener('input', () => { const v = parseEst(txt.value); if (v > 0 && Number.isFinite(v)) { guess = v; range.value = String(Math.round(toPos(v))); showGuess(); } });
    txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!locked) lock(); else next(); } });
    function lock() {
      if (locked || ctx.done) return;
      locked = true; range.disabled = true; txt.disabled = true; lockB.disabled = true;
      const ratio = Math.max(guess / cur.a, cur.a / guess);
      const tiers = [[1.1, 100, 'Bullseye!'], [1.25, 80, 'Very close'], [1.5, 60, 'Close'], [2, 40, 'Same ballpark'], [4, 20, 'Getting warm'], [10, 10, 'Within 10×'], [Infinity, 0, 'Way off']];
      const [, pts, label] = tiers.find(t => ratio <= t[0]);
      total += pts; if (pts === 100) bulls++;
      results.push(pts);
      pts >= 60 ? SFX.good() : pts > 0 ? SFX.pop() : SFX.bad();
      if (pts >= 80) burstFrom(gEl, cssVar('--good'), pts === 100 ? 40 : 20);
      scale.append(h('div', { class: 'mk', style: `left:${toPos(cur.a) / 10}%` }, 'actual'));
      out.innerHTML = '';
      out.append(h('b', null, `${label} +${pts}`), h('p', null, `Answer: ${estFmt(cur.a, cur.money)} ${cur.unit || ''}. You guessed ${estFmt(guess, cur.money)}${ratio < 10 ? ` (off by ×${fmt(ratio, ratio < 2 ? 2 : 1)})` : ''}.`), h('p', null, cur.ex));
      ctx.hud('score', 'Score', fmt(total));
      nextB.hidden = false; nextB.textContent = i >= N - 1 ? 'See results' : 'Next question';
      setTimeout(() => { if (!ctx.dead) nextB.focus({ preventScroll: true }); }, 30);
    }
    function next() {
      if (!locked) return;
      i++;
      if (i >= N) return ctx.finish({
        score: total, stars: (total >= 240) + (total >= 400) + (total >= 560), perf: total / 800, badges: bulls >= 3 ? ['estimator'] : [],
        summary: [['Bullseyes', String(bulls)], ['Average', fmt(total / N) + ' pts'], ['Goal for 3★', '560 pts']],
        lesson: 'Good estimators break problems into pieces they know (60 × 60 × 24) and think in powers of ten. Being within 2× of the answer is already a strong estimate.'
      });
      load();
    }
    ctx.onKey(e => { if (e.key === 'Enter') { if (!locked) lock(); else next(); return true; } return false; });
    ctx.hud('score', 'Score', '0');
    load();
  }
};

/* ---------- Smart Shopper ---------- */
const SHOP_ITEMS = [['cereal', 'oz'], ['coffee', 'oz'], ['laundry detergent', 'loads'], ['batteries', 'batteries'], ['orange juice', 'fl oz'], ['paper towels', 'rolls'], ['rice', 'lb']];
function cents(v) { return Math.round(v * 100) / 100; }
function frac(n) {
  const whole = Math.floor(n + 1e-9), rem = n - whole;
  const map = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞']];
  const best = map.reduce((a, b) => Math.abs(b[0] - rem) < Math.abs(a[0] - rem) ? b : a);
  if (Math.abs(rem - 1) < 0.01) return String(whole + 1);
  return (whole ? whole + (best[1] ? ' ' : '') : '') + best[1] || '0';
}
function shopGen(d, r) {
  const types = [['unit', 2.5], ['tip', 2], ['discount', 2], ['tax', 1.5], ['change', 1]];
  if (d >= 3) types.push(['split', 1.5], ['time', 1.5], ['fuel', 1.5], ['hourly', 1.5]);
  if (d >= 5) types.push(['sub', 1.5], ['bogo', 1.5], ['coupon', 1], ['recipe', 1.5], ['semimonthly', 1]);
  const t = r.weighted(types);
  const M = v => money(v, 2);
  if (t === 'unit') {
    const it = r.pick(SHOP_ITEMS);
    const toPrice = v => Math.max(0.99, Math.floor(v) + (v % 1 >= 0.5 ? 0.99 : 0.49));
    let a = 12, b = 18, pa = 3.49, pb = 4.99;
    for (let k = 0; k < 60; k++) {
      const a2 = r.pick([8, 10, 12, 16, 20, 24, 32]), b2 = r.pick([12, 18, 24, 36, 40, 48, 64]);
      if (a2 === b2) continue;
      const base = r.float(0.08, 0.6), pa2 = toPrice(a2 * base * r.float(0.85, 1.15)), pb2 = toPrice(b2 * base * r.float(0.8, 1.15));
      if (Math.abs(pa2 / a2 - pb2 / b2) / Math.min(pa2 / a2, pb2 / b2) > 0.05) { a = a2; b = b2; pa = pa2; pb = pb2; break; }
    }
    const ua = pa / a, ub = pb / b, ansA = ua < ub;
    const fu = v => '$' + (v < 1 ? v.toFixed(3) : v.toFixed(2));
    return { kind: 'Unit price', q: `Which ${it[0]} is the better deal?`, choices: [`A: ${a} ${it[1]} for ${M(pa)}`, `B: ${b} ${it[1]} for ${M(pb)}`], answer: ansA ? 0 : 1, fixed: true,
      explain: `Divide price by quantity. A: ${M(pa)} ÷ ${a} = ${fu(ua)} per ${it[1].replace(/s$/, '')}. B: ${M(pb)} ÷ ${b} = ${fu(ub)}. <b>${ansA ? 'A' : 'B'}</b> is cheaper per unit${(ansA ? a > b : b > a) ? '' : ', even though it’s the smaller pack'}.`, key: `u${a}${b}${pa}` };
  }
  if (t === 'tip') {
    const B = cents(r.int(1800, 16000) / 100), p = r.pick([15, 18, 20]), tip = cents(B * p / 100);
    return { kind: 'Tipping', q: `Your restaurant bill is <b>${M(B)}</b>. How much is a <b>${p}%</b> tip?`, choices: [M(tip), ...nearNums(tip, r, [B * 0.1, B * 0.25, tip * 2], { dec: 2 }).map(M)], explain: p === 20 ? `Find 10% (${M(B / 10)}) and double it: <b>${M(tip)}</b>.` : p === 15 ? `10% is ${M(B / 10)} and 5% is half that (${M(B / 20)}): together <b>${M(tip)}</b>.` : `${M(B)} × 0.18 = <b>${M(tip)}</b>. Quick check: just under 20% (${M(B * 0.2)}).`, key: `t${B}${p}` };
  }
  if (t === 'discount') {
    const P = r.pick([40, 60, 80, 120, 150, 200]), d1 = r.pick([20, 25, 30, 40, 50]), d2 = r.pick([10, 20, 25]);
    const fin = cents(P * (1 - d1 / 100) * (1 - d2 / 100));
    return { kind: 'Stacked discounts', q: `A <b>${M(P)}</b> jacket is <b>${d1}% off</b>, and you get an extra <b>${d2}% off</b> at checkout. What do you pay?`, choices: [M(fin), ...nearNums(fin, r, [P * (1 - (d1 + d2) / 100), P * (1 - d1 / 100), P * (1 - d2 / 100)], { dec: 2 }).map(M)], explain: `Discounts multiply, they don’t add: ${M(P)} × ${(1 - d1 / 100).toFixed(2)} × ${(1 - d2 / 100).toFixed(2)} = <b>${M(fin)}</b>. That’s ${fmt(100 - fin / P * 100, 1)}% off in total, not ${d1 + d2}%.`, key: `d${P}${d1}${d2}` };
  }
  if (t === 'tax') {
    const P = cents(r.int(1200, 9000) / 100), rate = r.pick([5, 6, 7, 8, 8.5]), tot = cents(P * (1 + rate / 100));
    return { kind: 'Sales tax', q: `An item costs <b>${M(P)}</b> before <b>${rate}%</b> sales tax. What is the total?`, choices: [M(tot), ...nearNums(tot, r, [P + rate, P * rate / 100, tot + 1], { dec: 2 }).map(M)], explain: `${M(P)} × ${(1 + rate / 100).toFixed(3).replace(/0$/, '')} = <b>${M(tot)}</b>.`, key: `x${P}${rate}` };
  }
  if (t === 'change') {
    const a = cents(r.int(500, 2400) / 100), b = cents(r.int(300, 1800) / 100), paid = a + b < 40 ? 40 : a + b < 50 ? 50 : 100, ch = cents(paid - a - b);
    return { kind: 'Making change', q: `You buy items for <b>${M(a)}</b> and <b>${M(b)}</b> and pay with <b>${M(paid)}</b>. How much change do you get?`, choices: [M(ch), ...nearNums(ch, r, [ch + 1, ch - 1, ch + 0.1], { dec: 2 }).map(M)], explain: `${M(a)} + ${M(b)} = ${M(a + b)}. ${M(paid)} − ${M(a + b)} = <b>${M(ch)}</b>.`, key: `c${a}${b}` };
  }
  if (t === 'split') {
    const n = r.pick([3, 4, 5, 6]), each0 = r.int(14, 40), T = each0 * n, each = cents(T * 1.2 / n);
    return { kind: 'Splitting the bill', q: `Dinner for <b>${n}</b> costs <b>${M(T)}</b> before a <b>20% tip</b>. Split evenly, what does each person pay?`, choices: [M(each), ...nearNums(each, r, [T / n, T * 1.2 / (n + 1), each + T * 0.2], { dec: 2 }).map(M)], explain: `Total with tip: ${M(T)} × 1.2 = ${M(T * 1.2)}. Split ${n} ways: <b>${M(each)}</b> each.`, key: `s${T}${n}` };
  }
  if (t === 'time') {
    const sh = r.int(6, 9), sm = r.pick([0, 15, 30, 40, 45, 50]), dh = r.int(1, 2), dm = r.pick([25, 35, 40, 50, 55]);
    const toStr = m => { const hh = Math.floor(m / 60) % 24, mm = m % 60, h12 = hh % 12 || 12; return `${h12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`; };
    const st = (sh + 12) * 60 + sm, en = st + dh * 60 + dm;
    return { kind: 'Time math', q: `A movie starts at <b>${toStr(st)}</b> and runs <b>${dh} h ${dm} min</b>. When does it end?`, choices: [toStr(en), toStr(en - 60), toStr(en + 10), toStr(en - 15)], explain: `${toStr(st)} + ${dh} h = ${toStr(st + dh * 60)}. Then + ${dm} min = <b>${toStr(en)}</b>.`, key: `tm${st}${dh}${dm}` };
  }
  if (t === 'fuel') {
    const mpg = r.pick([20, 24, 25, 30, 32, 40]), D = mpg * r.pick([4, 5, 6, 8, 10]), gas = r.pick([3, 3.25, 3.5, 3.8, 4.2]), cost = cents(D / mpg * gas);
    return { kind: 'Road trip', q: `A <b>${D}-mile</b> trip in a car that gets <b>${mpg} miles per gallon</b>, with gas at <b>${M(gas)}</b> a gallon. Fuel cost?`, choices: [M(cost), ...nearNums(cost, r, [D * gas / 10, D / mpg, cost * 2], { dec: 2 }).map(M)], explain: `${D} ÷ ${mpg} = ${D / mpg} gallons. ${D / mpg} × ${M(gas)} = <b>${M(cost)}</b>.`, key: `f${D}${mpg}${gas}` };
  }
  if (t === 'hourly') {
    const rate = r.pick([15, 18, 20, 22.5, 25, 30, 35]), yr = rate * 40 * 52;
    return { kind: 'Pay', q: `You earn <b>${M(rate)}</b> an hour, 40 hours a week, 52 weeks a year. What is your yearly pay before tax?`, choices: [money(yr), ...nearNums(yr, r, [rate * 40 * 50, rate * 40 * 12, rate * 52 * 8]).map(v => money(v))], explain: `40 × 52 = 2,080 hours. 2,080 × ${M(rate)} = <b>${money(yr)}</b>. Shortcut: double the hourly rate and add “000” (roughly).`, key: `h${rate}` };
  }
  if (t === 'semimonthly') {
    const S = r.pick([48000, 54000, 60000, 72000]);
    return { kind: 'Pay', q: `You’re paid <b>twice a month</b> on a <b>${money(S)}</b> salary. What is each paycheck before tax?`, choices: [money(S / 24), money(S / 26, 2), money(S / 12), money(S / 52, 2)], explain: `Twice a month = 24 paychecks. ${money(S)} ÷ 24 = <b>${money(S / 24)}</b>. (Every two weeks would be 26 smaller checks.)`, key: `sm${S}` };
  }
  if (t === 'sub') {
    const m = r.pick([8, 10, 12, 15]), disc = r.pick([15, 20, 25]), A = cents(m * 12 * (1 - disc / 100)), save = cents(m * 12 - A);
    return { kind: 'Subscriptions', q: `A plan costs <b>${M(m)} a month</b> or <b>${M(A)} a year</b>. How much does the yearly plan save over 12 months?`, choices: [M(save), ...nearNums(save, r, [m, m * 12 - A / 12, A - m * 10], { dec: 2 }).map(M)], explain: `12 × ${M(m)} = ${M(m * 12)}. ${M(m * 12)} − ${M(A)} = <b>${M(save)}</b> saved.`, key: `sb${m}${disc}` };
  }
  if (t === 'bogo') {
    const P = r.pick([20, 30, 40, 50]), x = r.pick([20, 30]), bogo = P * 1.5, pctDeal = P * 2 * (1 - x / 100);
    const ans = bogo < pctDeal ? 0 : 1;
    return { kind: 'Deals', q: `You want two shirts at <b>${M(P)}</b> each. Which deal is cheaper?`, choices: [`Buy one, get one 50% off`, `${x}% off everything`], answer: ans, fixed: true, explain: `BOGO 50%: ${M(P)} + ${M(P / 2)} = ${M(bogo)} (that’s 25% off the pair). ${x}% off: ${M(P * 2)} × ${(1 - x / 100).toFixed(2)} = ${M(pctDeal)}. <b>${ans === 0 ? 'BOGO' : `${x}% off`}</b> wins.`, key: `bg${P}${x}` };
  }
  if (t === 'coupon') {
    const P = r.pick([40, 50, 60, 80, 100]), off = r.pick([10, 15, 20]), p = r.pick([20, 25]);
    const a = P * (1 - p / 100) - off, b = (P - off) * (1 - p / 100);
    return { kind: 'Coupons', q: `A <b>${M(P)}</b> item is <b>${p}% off</b>, and you have a <b>${M(off)} off</b> coupon. If the store lets you choose the order, which is cheaper?`, choices: [`${p}% off first, then the coupon`, `Coupon first, then ${p}% off`, 'Both give the same price'], answer: 0, fixed: true, explain: `Percent first: ${M(P)} × ${(1 - p / 100).toFixed(2)} − ${M(off)} = ${M(a)}. Coupon first: (${M(P)} − ${M(off)}) × ${(1 - p / 100).toFixed(2)} = ${M(b)}. Taking the percent off the bigger number saves more.`, key: `cp${P}${off}${p}` };
  }
  const base = r.pick([0.5, 0.75, 2 / 3, 1.5, 1.25]), s = r.pick([2, 4]), mult = r.pick([1.5, 2, 0.5]), target = s * mult, need = base * mult;
  const cup = v => frac(v) + (v > 1 ? ' cups' : ' cup');
  return { kind: 'Recipes', q: `A recipe for <b>${s} servings</b> needs <b>${cup(base)}</b> of sugar. How much do you need for <b>${target} servings</b>?`, choices: [cup(need), cup(need + 0.5), cup(Math.max(0.125, need - 0.25)), cup(base + (target - s) * 0.25)], explain: `${target} servings is ${mult}× the recipe. ${frac(base)} × ${mult} = <b>${cup(need)}</b>.`, key: `rc${base}${s}${mult}` };
}
QGEN.world = shopGen;
IMPL.shopper = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 50, gen: shopGen,
      lesson: 'Three everyday shortcuts: compare price per unit, not price per package; stacked discounts multiply (20% + 10% off is 28% off, not 30%); and find 10% first for any tip or tax.' });
  }
};

/* ---------- Globe Trotter ---------- */
// [country, capital, tier, famous non-capital city]
const CAPITALS = [
  ['France', 'Paris', 1], ['Japan', 'Tokyo', 1, 'Osaka'], ['Italy', 'Rome', 1, 'Milan'], ['Spain', 'Madrid', 1, 'Barcelona'], ['Germany', 'Berlin', 1, 'Munich'],
  ['United Kingdom', 'London', 1, 'Manchester'], ['Canada', 'Ottawa', 1, 'Toronto'], ['Mexico', 'Mexico City', 1, 'Guadalajara'], ['Brazil', 'Brasília', 1, 'Rio de Janeiro'],
  ['Argentina', 'Buenos Aires', 1, 'Córdoba'], ['China', 'Beijing', 1, 'Shanghai'], ['India', 'New Delhi', 1, 'Mumbai'], ['Russia', 'Moscow', 1, 'St. Petersburg'],
  ['Australia', 'Canberra', 1, 'Sydney'], ['South Korea', 'Seoul', 1, 'Busan'], ['Greece', 'Athens', 1, 'Thessaloniki'], ['Portugal', 'Lisbon', 1, 'Porto'], ['Ireland', 'Dublin', 1, 'Cork'],
  ['United States', 'Washington, D.C.', 1, 'New York City'], ['Turkey', 'Ankara', 1, 'Istanbul'], ['Switzerland', 'Bern', 1, 'Zurich'], ['Norway', 'Oslo', 1, 'Bergen'],
  ['Sweden', 'Stockholm', 1, 'Gothenburg'], ['Thailand', 'Bangkok', 1, 'Chiang Mai'], ['Kenya', 'Nairobi', 1, 'Mombasa'], ['Peru', 'Lima', 1, 'Cusco'], ['Cuba', 'Havana', 1], ['Philippines', 'Manila', 1, 'Cebu'],
  ['Nigeria', 'Abuja', 2, 'Lagos'], ['Pakistan', 'Islamabad', 2, 'Karachi'], ['New Zealand', 'Wellington', 2, 'Auckland'], ['Morocco', 'Rabat', 2, 'Casablanca'],
  ['Vietnam', 'Hanoi', 2, 'Ho Chi Minh City'], ['United Arab Emirates', 'Abu Dhabi', 2, 'Dubai'], ['Saudi Arabia', 'Riyadh', 2, 'Jeddah'], ['Colombia', 'Bogotá', 2, 'Medellín'],
  ['Chile', 'Santiago', 2, 'Valparaíso'], ['Poland', 'Warsaw', 2, 'Kraków'], ['Austria', 'Vienna', 2, 'Salzburg'], ['Belgium', 'Brussels', 2, 'Antwerp'], ['Denmark', 'Copenhagen', 2],
  ['Finland', 'Helsinki', 2], ['Hungary', 'Budapest', 2], ['Czechia', 'Prague', 2], ['Ukraine', 'Kyiv', 2, 'Odesa'], ['Iran', 'Tehran', 2], ['Iraq', 'Baghdad', 2],
  ['Ghana', 'Accra', 2, 'Kumasi'], ['Ethiopia', 'Addis Ababa', 2], ['Venezuela', 'Caracas', 2], ['Jamaica', 'Kingston', 2, 'Montego Bay'], ['Iceland', 'Reykjavík', 2],
  ['Malaysia', 'Kuala Lumpur', 2], ['Bangladesh', 'Dhaka', 2], ['Ecuador', 'Quito', 2, 'Guayaquil'], ['Romania', 'Bucharest', 2], ['Croatia', 'Zagreb', 2, 'Split'], ['Netherlands', 'Amsterdam', 2, 'Rotterdam'],
  ['Kazakhstan', 'Astana', 3, 'Almaty'], ['Tanzania', 'Dodoma', 3, 'Dar es Salaam'], ['Myanmar', 'Naypyidaw', 3, 'Yangon'], ['Mongolia', 'Ulaanbaatar', 3], ['Nepal', 'Kathmandu', 3],
  ['Uzbekistan', 'Tashkent', 3, 'Samarkand'], ['Qatar', 'Doha', 3], ['Jordan', 'Amman', 3], ['Lebanon', 'Beirut', 3], ['Tunisia', 'Tunis', 3], ['Algeria', 'Algiers', 3], ['Senegal', 'Dakar', 3],
  ['Uganda', 'Kampala', 3], ['Zimbabwe', 'Harare', 3], ['Zambia', 'Lusaka', 3], ['Angola', 'Luanda', 3], ['Madagascar', 'Antananarivo', 3], ['Costa Rica', 'San José', 3],
  ['Panama', 'Panama City', 3], ['Honduras', 'Tegucigalpa', 3, 'San Pedro Sula'], ['Dominican Republic', 'Santo Domingo', 3, 'Punta Cana'], ['Uruguay', 'Montevideo', 3], ['Paraguay', 'Asunción', 3],
  ['Serbia', 'Belgrade', 3], ['Cambodia', 'Phnom Penh', 3, 'Siem Reap'], ['Laos', 'Vientiane', 3], ['Afghanistan', 'Kabul', 3], ['Bulgaria', 'Sofia', 3], ['Slovakia', 'Bratislava', 3],
  ['Slovenia', 'Ljubljana', 3], ['Estonia', 'Tallinn', 3], ['Latvia', 'Riga', 3], ['Lithuania', 'Vilnius', 3], ['Georgia', 'Tbilisi', 3, 'Batumi'], ['Armenia', 'Yerevan', 3], ['Azerbaijan', 'Baku', 3]
];
function capGen(d, r) {
  const c = pickTiered(CAPITALS, d, r, x => x[2]);
  const pool = CAPITALS.filter(x => x !== c && Math.abs(x[2] - c[2]) <= 1);
  if (r.chance(0.75)) {
    const wrong = r.sample(pool, 3).map(x => x[1]);
    if (c[3]) wrong[0] = c[3];
    return { kind: 'Country → capital', q: `What is the capital of <b>${c[0]}</b>?`, choices: [c[1], ...wrong], explain: c[3] ? `${c[1]} is the capital. ${c[3]} is a famous city there, but not the capital.` : `${c[1]} is the capital of ${c[0]}.`, short: c[3] ? `not ${c[3]}` : '', key: 'c' + c[0] };
  }
  return { kind: 'Capital → country', q: `<b>${c[1]}</b> is the capital of which country?`, choices: [c[0], ...r.sample(pool, 3).map(x => x[0])], explain: `${c[1]} is the capital of ${c[0]}.`, key: 'k' + c[0] };
}
IMPL.globe = {
  play(ctx) {
    runQuiz(ctx, { mode: 'rush', time: 60, gen: capGen, starsAt: [6, 12, 18],
      lesson: 'Many capitals aren’t the biggest city: Canberra not Sydney, Ottawa not Toronto, Ankara not Istanbul. Several were chosen or built as a compromise between rival cities.' });
  }
};
