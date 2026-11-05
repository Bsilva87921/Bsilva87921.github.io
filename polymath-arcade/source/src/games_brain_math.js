/* =====================================================================
   Brain + Math: Memory Matrix, Color Clash, Pattern Pro, Math Sprint, Target Number
   ===================================================================== */

/* ---------- Memory Matrix ---------- */
IMPL.memory = {
  play(ctx) {
    const r = ctx.r, MAXT = 12;
    let n = 3 + Math.floor((ctx.diff - 1) / 2), lives = 3, trial = 0, wins = 0, score = 0, maxN = 0, phase = 'wait';
    let targets = new Set(), found = new Set(), cells = [];
    const status = h('p', { class: 'prompt', 'aria-live': 'polite' }, 'Get ready…');
    const grid = h('div', { class: 'mm-grid locked' });
    ctx.body.append(h('div', { class: 'stack' }, status, h('div', { class: 'mm-stage' }, grid)));
    const hudAll = () => {
      ctx.hud('score', 'Score', fmt(score));
      ctx.hud('lives', 'Lives', '♥'.repeat(lives) + '♡'.repeat(3 - lives));
      ctx.hud('round', 'Round', `${Math.max(1, Math.min(trial, MAXT))}/${MAXT}`);
    };
    function startTrial() {
      if (lives <= 0 || trial >= MAXT) return end();
      trial++; hudAll();
      const size = n <= 4 ? 3 : n <= 6 ? 4 : n <= 9 ? 5 : 6;
      targets = new Set(r.sample([...Array(size * size).keys()], n)); found = new Set();
      grid.innerHTML = ''; grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`; grid.classList.add('locked');
      cells = [...Array(size * size)].map((_, i) => { const c = h('button', { class: 'mm-cell', type: 'button', 'aria-label': `Tile ${i + 1}`, onclick: () => tap(i) }, h('span', { class: 'mm-flip' }, h('span', { class: 'mm-f front' }), h('span', { class: 'mm-f back' }))); grid.append(c); return c; });
      phase = 'show';
      status.innerHTML = `Memorize <b>${n}</b> tiles`;
      ctx.timeout(() => targets.forEach(i => cells[i].classList.add('lit')), 450);
      ctx.timeout(() => {
        targets.forEach(i => cells[i].classList.remove('lit'));
        phase = 'input'; grid.classList.remove('locked');
        status.innerHTML = `Your turn: tap the <b>${n}</b> tiles`;
      }, 450 + 900 + n * 170);
    }
    function tap(i) {
      if (phase !== 'input' || found.has(i) || ctx.done) return;
      if (targets.has(i)) {
        found.add(i); cells[i].classList.add('hit'); SFX.pop(); score += 10;
        if (found.size === targets.size) {
          phase = 'wait'; wins++; maxN = Math.max(maxN, n); score += n * 15; SFX.good(); burstFrom(grid, cssVar('--good'), 36);
          status.innerHTML = '<b>Perfect!</b> One more tile next round.';
          n = Math.min(n + 1, 14); grid.classList.add('locked');
          ctx.timeout(startTrial, 850);
        }
      } else {
        cells[i].classList.add('miss'); lives--; phase = 'wait'; SFX.bad(); buzz(); grid.classList.add('locked');
        targets.forEach(t => { if (!found.has(t)) cells[t].classList.add('reveal'); });
        status.innerHTML = lives ? `<b>Missed.</b> Dashed tiles show what you missed. ${lives} ${lives === 1 ? 'life' : 'lives'} left.` : '<b>Out of lives.</b>';
        n = Math.max(3, n - 1);
        ctx.timeout(startTrial, 1600);
      }
      hudAll();
    }
    function end() {
      const stars = wins >= 9 ? 3 : wins >= 6 ? 2 : wins >= 3 ? 1 : 0;
      ctx.finish({
        score, stars, perf: wins / MAXT, badges: maxN >= 10 ? ['memory'] : [],
        summary: [['Perfect rounds', `${wins}/${trial}`], ['Biggest pattern', maxN ? `${maxN} tiles` : '–'], ['Lives left', String(lives)]],
        lesson: 'Working memory holds only a few items at once. Seeing the tiles as shapes or lines (chunking) lets you hold far more than remembering single squares.'
      });
    }
    hudAll();
    ctx.timeout(startTrial, 350);
  }
};

/* ---------- Color Clash (Stroop) ---------- */
const INKS = [['RED', 'red'], ['BLUE', 'blue'], ['GREEN', 'green'], ['YELLOW', 'yellow'], ['PURPLE', 'purple'], ['ORANGE', 'orange']];
IMPL.clash = {
  play(ctx) {
    const r = ctx.r, two = ctx.diff >= 4, pal = INKS.slice(0, ctx.diff >= 7 ? 6 : 5);
    let cur = null, correct = 0, wrong = 0, streak = 0, best = 0, score = 0, lock = true;
    const rule = h('p', { class: 'prompt', html: two ? 'Does the <b>left word’s meaning</b> match the <b>right word’s ink color</b>?' : 'Does the word’s <b>meaning</b> match its <b>ink color</b>?' });
    const cards = h('div', { class: 'cc-cards' + (two ? ' two' : '') });
    const fbk = h('p', { class: 'msg', 'aria-live': 'polite' });
    ctx.body.append(h('div', { class: 'stack' }, rule, cards,
      h('div', { class: 'yn' }, h('button', { class: 'btn big', type: 'button', onclick: () => answer(false) }, '← No'), h('button', { class: 'btn big primary', type: 'button', onclick: () => answer(true) }, 'Yes →')), fbk));
    const mult = () => 1 + Math.min(Math.floor(streak / 4), 4) * 0.5;
    function next() {
      const match = r.chance(0.5);
      cards.innerHTML = '';
      if (!two) {
        const word = r.pick(pal), ink = match ? word : r.pick(pal.filter(p => p !== word));
        cards.append(h('div', { class: 'cc-card flip' }, h('small', null, 'Meaning vs ink'), h('span', { class: 'cc-word', style: `color:var(--ink-${ink[1]})` }, word[0])));
      } else {
        const meaning = r.pick(pal), ink = match ? meaning : r.pick(pal.filter(p => p !== meaning)), word2 = r.pick(pal);
        cards.append(
          h('div', { class: 'cc-card flip' }, h('small', null, 'Meaning'), h('span', { class: 'cc-word' }, meaning[0])),
          h('div', { class: 'cc-card flip' }, h('small', null, 'Ink color'), h('span', { class: 'cc-word', style: `color:var(--ink-${ink[1]})` }, word2[0])));
      }
      cur = { match }; lock = false;
    }
    function answer(y) {
      if (lock || ctx.done || !cur) return;
      lock = true;
      const ok = y === cur.match;
      if (ok) { correct++; streak++; best = Math.max(best, streak); score += Math.round(100 * mult()); SFX.good(); fbk.textContent = ''; }
      else { wrong++; streak = 0; SFX.bad(); buzz(); fbk.className = 'msg bad'; fbk.textContent = cur.match ? 'They matched.' : 'They didn’t match.'; }
      $$('.cc-card', cards).forEach(c => c.classList.add(ok ? 'ok' : 'no'));
      ctx.hud('score', 'Score', fmt(score));
      ctx.hud('combo', 'Combo', '×' + mult(), mult() > 1 ? 'hot' : '');
      ctx.timeout(next, ok ? 150 : 600);
    }
    function end() {
      const net = correct - wrong, t = [8, 18, 28];
      ctx.finish({
        score, stars: (net >= t[0]) + (net >= t[1]) + (net >= t[2]), correct, answered: correct + wrong, maxCombo: best,
        summary: [['Correct', `${correct}/${correct + wrong}`], ['Accuracy', correct + wrong ? pct(correct / (correct + wrong)) : '–'], ['Best streak', String(best)], ['Goal for 3★', '28 net']],
        lesson: 'This is the Stroop effect: reading is so automatic that the word fights the color. Practicing it trains your mental brake, the skill of ignoring distractions and staying on task.'
      });
    }
    ctx.onKey(e => {
      if (e.key === 'ArrowLeft' || e.key === 'n' || e.key === 'N') { answer(false); return true; }
      if (e.key === 'ArrowRight' || e.key === 'y' || e.key === 'Y') { answer(true); return true; }
      return false;
    });
    ctx.hud('score', 'Score', '0'); ctx.hud('combo', 'Combo', '×1');
    ctx.countdown(45, end);
    next();
  }
};

/* ---------- Pattern Pro (sequences) ---------- */
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];
function seqGen(d, r) {
  const types = [['arith', 3]];
  if (d >= 2) types.push(['geom', 2]);
  if (d >= 3) types.push(['square', 1.5], ['grow', 2]);
  if (d >= 4) types.push(['fib', 1.5]);
  if (d >= 5) types.push(['alt', 2], ['prime', 1], ['tri', 1]);
  if (d >= 6) types.push(['dbl1', 1.5], ['cube', 1]);
  if (d >= 7) types.push(['muladd', 2]);
  const t = r.weighted(types);
  let s = [], ans, ex, extra = [];
  if (t === 'arith') {
    let k = r.int(2, 3 + d); if (d >= 4 && r.chance(0.35)) k = -k;
    const a = k < 0 ? r.int(40, 60 + d * 10) : r.int(1, 10 + d * 4);
    for (let i = 0; i < 5; i++) s.push(a + i * k);
    ans = a + 5 * k; ex = k > 0 ? `Add ${k} each time.` : `Subtract ${-k} each time.`; extra = [ans + 1, ans - 1, ans + k];
  } else if (t === 'geom') {
    const k = r.pick(d >= 5 ? [2, 3, 4] : [2, 3]), a = r.int(1, k === 2 ? 5 : 3);
    for (let i = 0; i < 5; i++) s.push(a * k ** i);
    ans = a * k ** 5; ex = `Multiply by ${k} each time.`; extra = [s[4] + (s[4] - s[3]), ans + s[4], ans - k];
  } else if (t === 'square') {
    const b = r.int(1, 7); for (let i = 0; i < 5; i++) s.push((b + i) ** 2);
    ans = (b + 5) ** 2; ex = `Square numbers: ${b + 5}² = ${ans}.`; extra = [s[4] + (s[4] - s[3]), ans + 1, ans - 1];
  } else if (t === 'cube') {
    const b = r.int(1, 4); for (let i = 0; i < 4; i++) s.push((b + i) ** 3);
    ans = (b + 4) ** 3; ex = `Cube numbers: ${b + 4}³ = ${ans}.`; extra = [s[3] + (s[3] - s[2]), (b + 4) ** 2, ans + 1];
  } else if (t === 'grow') {
    const a = r.int(1, 20), st = r.int(1, 3); s = [a];
    for (let i = 1; i < 5; i++) s.push(s[i - 1] + st * i);
    ans = s[4] + st * 5; ex = `The gap grows by ${st} each time: +${st}, +${2 * st}, +${3 * st}, +${4 * st}, then +${5 * st}.`; extra = [s[4] + st * 4, s[4] + st * 6, ans + 1];
  } else if (t === 'fib') {
    const a = r.int(1, 5), b = r.int(a, a + 4); s = [a, b];
    while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2]);
    ans = s[5] + s[4]; ex = 'Each number is the sum of the two before it.'; extra = [s[5] + (s[5] - s[4]), ans + 1, s[5] * 2];
  } else if (t === 'alt') {
    const a = r.int(1, 9), b = r.int(20, 40), k1 = r.int(2, 6), k2 = -r.int(1, 4);
    for (let i = 0; i < 3; i++) s.push(a + i * k1, b + i * k2);
    ans = a + 3 * k1; ex = `Two sequences take turns: ${a}, ${a + k1}, ${a + 2 * k1}… (+${k1}) and ${b}, ${b + k2}, ${b + 2 * k2}… (${k2}).`; extra = [b + 3 * k2, ans + 1, s[5] + k2];
  } else if (t === 'prime') {
    const i0 = r.int(0, 12); s = PRIMES.slice(i0, i0 + 5);
    ans = PRIMES[i0 + 5]; ex = 'Prime numbers: each one is divisible only by 1 and itself.'; extra = [ans + 2, ans - 1, ans + 1];
  } else if (t === 'tri') {
    const b = r.int(1, 6), T = n => n * (n + 1) / 2;
    for (let i = 0; i < 5; i++) s.push(T(b + i));
    ans = T(b + 5); ex = `Triangular numbers: add one more each time (+${b + 1}, +${b + 2}, … then +${b + 5}).`; extra = [ans + 1, s[4] + b + 4, ans - 1];
  } else if (t === 'dbl1') {
    const a = r.int(1, 6); s = [a];
    for (let i = 1; i < 5; i++) s.push(s[i - 1] * 2 + 1);
    ans = s[4] * 2 + 1; ex = 'Double the number, then add 1.'; extra = [s[4] * 2, s[4] * 2 + 2, s[4] + (s[4] - s[3])];
  } else {
    const a = r.int(1, 6), m = r.pick([2, 3]), k = r.int(1, 5); s = [a];
    for (let i = 1; i < 6; i++) s.push(i % 2 ? s[i - 1] * m : s[i - 1] + k);
    ans = s[5] + k; ex = `The steps alternate: ×${m}, then +${k}.`; extra = [s[5] * m, ans + 1, s[5] + m];
  }
  return { kind: 'Sequence', q: 'What comes next?', seq: s, choices: [ans, ...nearNums(ans, r, extra, { neg: s.some(v => v < 0) })], explain: ex, short: ex };
}
QGEN.brain = seqGen;
IMPL.pattern = {
  play(ctx) {
    runQuiz(ctx, { mode: 'rush', time: 60, gen: seqGen, starsAt: [4, 8, 12],
      lesson: 'To crack a sequence, look at the gaps first. Equal gaps mean adding, growing gaps hide a second pattern, and a constant ratio means multiplying.' });
  }
};

/* ---------- Math Sprint ---------- */
function mathProblem(d, r) {
  const ops = [['add', d <= 2 ? 3 : 2], ['sub', d <= 2 ? 3 : 2]];
  if (d >= 2) ops.push(['mul', 3]);
  if (d >= 3) ops.push(['div', 2]);
  if (d >= 4) ops.push(['pct', 2], ['sq', 1]);
  if (d >= 5) ops.push(['ooo', 2]);
  const op = r.weighted(ops);
  let a, b, c, ans, text, hint = [], explain;
  if (op === 'add' || op === 'sub') {
    if (d === 1) { a = r.int(1, 9); b = r.int(1, 9); }
    else if (d === 2) { a = r.int(10, 49); b = r.int(2, 9); }
    else if (d <= 4) { a = r.int(11, 89); b = r.int(11, 89); }
    else if (d <= 6) { a = r.int(101, 499); b = r.int(11, 99); }
    else { a = r.int(120, 899); b = r.int(101, 499); }
    if (op === 'sub' && a < b) [a, b] = [b, a];
    if (op === 'add') { ans = a + b; text = `${a} + ${b}`; hint = [ans + 10, ans - 10, ans + 1]; }
    else { ans = a - b; text = `${a} − ${b}`; hint = [ans + 10, ans - 10, ans - 1]; }
    explain = `${text} = ${ans}.`;
  } else if (op === 'mul') {
    if (d === 2) { a = r.int(2, 5); b = r.int(2, 9); }
    else if (d === 3) { a = r.int(2, 10); b = r.int(2, 10); }
    else if (d <= 5) { a = r.int(3, 12); b = r.int(3, 12); }
    else if (d === 6) { a = r.int(12, 49); b = r.int(3, 9); }
    else { a = r.int(11, 29); b = r.int(11, 19); }
    ans = a * b; text = `${a} × ${b}`; hint = [ans + a, ans - b, ans + 10];
    explain = b > 10 ? `Split it: ${a} × ${b} = ${a} × 10 + ${a} × ${b - 10} = ${a * 10} + ${a * (b - 10)} = ${ans}.` : `${text} = ${ans}.`;
  } else if (op === 'div') {
    b = d <= 4 ? r.int(2, 10) : r.int(3, 12);
    const q = d <= 5 ? r.int(2, 12) : r.int(6, 40);
    a = b * q; ans = q; text = `${a} ÷ ${b}`; hint = [q + 1, q - 1, q + b];
    explain = `${b} × ${q} = ${a}, so ${text} = ${q}.`;
  } else if (op === 'pct') {
    const p = d <= 5 ? r.pick([10, 20, 25, 50]) : r.pick([5, 15, 30, 40, 75]);
    const m = 100 / gcd(p, 100);
    let base; do { base = m * r.int(1, Math.max(2, Math.floor(400 / m))); } while (base < 20);
    ans = base * p / 100; text = `${p}% of ${base}`; hint = [ans * 2, Math.round(ans / 2), base - ans];
    explain = p === 15 ? `10% is ${base / 10}, 5% is half of that (${base / 20}), so 15% = ${ans}.` : `${p}% means ${p}/100, and ${base} × ${p}/100 = ${ans}.`;
  } else if (op === 'sq') {
    a = d >= 7 ? r.int(11, 25) : d >= 5 ? r.int(4, 15) : r.int(3, 12);
    ans = a * a; text = `${a}²`; hint = [a * 2, ans + a, ans - a];
    explain = `${a}² means ${a} × ${a} = ${ans}.`;
  } else {
    a = r.int(2, 9); b = r.int(2, 9);
    if (r.chance(0.5)) { c = r.int(2, 9); ans = a + b * c; text = `${a} + ${b} × ${c}`; hint = [(a + b) * c, ans + 1, ans - 1]; }
    else { c = r.int(1, Math.min(9, a * b - 1)); ans = a * b - c; text = `${a} × ${b} − ${c}`; hint = [a * (b - c), ans + 1, ans - 2]; }
    explain = 'Multiply before you add or subtract, so ' + text + ' = ' + ans + '.';
  }
  return { text, ans, hint, explain };
}
QGEN.math = (d, r) => {
  const p = mathProblem(d, r);
  return { kind: 'Mental math', q: `<span class="mono" style="font-size:30px;font-weight:700">${p.text} = ?</span>`, choices: [p.ans, ...nearNums(p.ans, r, p.hint)], explain: p.explain, key: p.text };
};
IMPL.sprint = {
  play(ctx) {
    const r = ctx.r, d = ctx.diff;
    let cur = null, input = '', correct = 0, wrong = 0, streak = 0, best = 0, score = 0, lock = false;
    const probEl = h('div', { class: 'ms-prob', 'aria-live': 'polite' });
    const ansEl = h('div', { class: 'ms-ans empty', 'aria-label': 'Your answer' });
    const pad = h('div', { class: 'keypad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵'].forEach(k => pad.append(h('button', { class: 'key' + (k === '↵' ? ' enter' : ''), type: 'button', 'aria-label': k === '⌫' ? 'Delete' : k === '↵' ? 'Submit' : k, onclick: () => press(k) }, k)));
    const missed = [];
    ctx.body.append(h('div', { class: 'stack' }, h('div', { class: 'panel ms-card' }, probEl, ansEl), pad));
    const mult = () => 1 + Math.min(Math.floor(streak / 3), 4) * 0.5;
    function next() { cur = mathProblem(d, r); input = ''; probEl.textContent = cur.text; probEl.classList.remove('flipin'); void probEl.offsetWidth; probEl.classList.add('flipin'); draw(); lock = false; }
    function draw(state) { ansEl.textContent = input || '?'; ansEl.className = 'ms-ans' + (input ? '' : ' empty') + (state ? ' ' + state : ''); }
    function press(k) {
      if (ctx.done || lock || !cur) return;
      if (k === '⌫') { input = input.slice(0, -1); draw(); return; }
      if (k === '↵') { if (input) check(true); return; }
      if (input.length >= 6) return;
      input += k; draw(); check(false);
    }
    function check(force) {
      const target = String(cur.ans);
      if (input === target) {
        correct++; streak++; best = Math.max(best, streak);
        const pts = Math.round(100 * mult()); score += pts; SFX.good();
        draw('ok'); lock = true; burstFrom(ansEl, cssVar('--good'), 16); ctx.timeout(next, 160);
      } else if (force || input.length >= target.length) {
        wrong++; streak = 0; SFX.bad(); buzz();
        if (missed.length < 6) missed.push({ q: cur.text + ' = ?', a: String(cur.ans), why: cur.explain });
        ansEl.textContent = `${input} → ${cur.ans}`; ansEl.className = 'ms-ans no shake'; lock = true;
        ctx.timeout(next, 900);
      }
      ctx.hud('score', 'Score', fmt(score));
      ctx.hud('combo', 'Combo', '×' + mult(), mult() > 1 ? 'hot' : '');
    }
    function end() {
      const net = correct - wrong, t = [6, 12, 18];
      ctx.finish({
        score, stars: (net >= t[0]) + (net >= t[1]) + (net >= t[2]), correct, answered: correct + wrong, maxCombo: best, review: missed,
        summary: [['Correct', `${correct}/${correct + wrong}`], ['Accuracy', correct + wrong ? pct(correct / (correct + wrong)) : '–'], ['Best streak', String(best)], ['Goal for 3★', '18 net']],
        lesson: 'Speed comes from shortcuts: split numbers (23 × 14 = 23 × 10 + 23 × 4), find 10% first for percentages, and multiply before adding.'
      });
    }
    ctx.onKey(e => {
      if (/^[0-9]$/.test(e.key)) { press(e.key); return true; }
      if (e.key === 'Backspace') { press('⌫'); return true; }
      if (e.key === 'Enter') { press('↵'); return true; }
      return false;
    });
    ctx.hud('score', 'Score', '0'); ctx.hud('combo', 'Combo', '×1');
    ctx.countdown(60, end);
    next();
  }
};

/* ---------- Target Number (24-style) ---------- */
function unwrapExpr(e) {
  if (e[0] !== '(') return e;
  let depth = 0;
  for (let i = 0; i < e.length; i++) { if (e[i] === '(') depth++; else if (e[i] === ')') { depth--; if (depth === 0 && i < e.length - 1) return e; } }
  return e.slice(1, -1);
}
function solveTarget(nums, target) {
  const dead = new Set();
  function rec(list) {
    if (list.length === 1) return list[0].v === target ? list[0].e : null;
    const key = list.map(x => x.v).sort((a, b) => a - b).join(',');
    if (dead.has(key)) return null;
    for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const a = list[i], b = list[j], rest = list.filter((_, k) => k !== i && k !== j), cand = [];
      if (i < j) cand.push({ v: a.v + b.v, e: `(${a.e} + ${b.e})` }, { v: a.v * b.v, e: `(${a.e} × ${b.e})` });
      if (a.v - b.v >= 0) cand.push({ v: a.v - b.v, e: `(${a.e} − ${b.e})` });
      if (b.v !== 0 && a.v % b.v === 0) cand.push({ v: a.v / b.v, e: `(${a.e} ÷ ${b.e})` });
      for (const c of cand) { const res = rec(rest.concat([c])); if (res) return res; }
    }
    dead.add(key);
    return null;
  }
  const res = rec(nums.map(v => ({ v, e: String(v) })));
  return res ? unwrapExpr(res) : null;
}
function randomCombine(nums, r, ops) {
  let list = nums.slice();
  while (list.length > 1) {
    const i = r.int(0, list.length - 1); let j = r.int(0, list.length - 2); if (j >= i) j++;
    const a = list[i], b = list[j];
    const valid = ops.filter(o => o === '+' || o === '×' || (o === '−' && a - b >= 0) || (o === '÷' && b > 1 && a % b === 0));
    const o = r.pick(valid);
    const v = o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : a / b;
    list = list.filter((_, k) => k !== i && k !== j).concat([v]);
  }
  return list[0];
}
function genTarget(d, r) {
  for (let t = 0; t < 600; t++) {
    let nums, target;
    if (d <= 2) { nums = [r.int(1, 9), r.int(1, 9), r.int(2, 9)]; target = randomCombine(nums, r, ['+', '−', '×']); if (target < 6 || target > 40) continue; }
    else if (d <= 4) { nums = [0, 0, 0, 0].map(() => r.int(1, 9)); target = randomCombine(nums, r, ['+', '−', '×', '÷']); if (target < 10 || target > 60) continue; }
    else if (d <= 7) { nums = [0, 0, 0, 0].map(() => r.int(1, d >= 7 ? 12 : 9)); target = 24; }
    else { nums = [0, 0, 0, 0].map(() => r.int(1, 13)); target = r.chance(0.5) ? 24 : randomCombine(nums, r, ['+', '−', '×', '÷']); if (target < 10 || target > 99) continue; }
    const sol = solveTarget(nums, target);
    if (sol) return { nums, target, sol };
  }
  return { nums: [3, 8, 1, 1], target: 24, sol: '3 × 8 × 1 × 1' };
}
IMPL.target = {
  play(ctx) {
    const r = ctx.r, d = ctx.diff, OPS = ['+', '−', '×', '÷'];
    let P = null, tiles = [], hist = [], sel = null, op = null, solved = 0, skipped = 0, score = 0, t0 = 0, busy = false, uid = 0;
    const tgt = h('div', { class: 'tn-target' });
    const tilesEl = h('div', { class: 'tn-tiles' });
    const opsEl = h('div', { class: 'tn-ops' });
    const msg = h('p', { class: 'msg', 'aria-live': 'polite' });
    OPS.forEach(o => opsEl.append(h('button', { class: 'tn-op', type: 'button', 'aria-label': { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' }[o], onclick: () => tapOp(o) }, o)));
    ctx.body.append(h('div', { class: 'stack' },
      h('div', { class: 'panel stack' }, tgt, tilesEl, opsEl), msg,
      h('div', { class: 'row center' }, h('button', { class: 'btn', type: 'button', onclick: undo }, 'Undo'), h('button', { class: 'btn', type: 'button', onclick: reset }, 'Reset'), h('button', { class: 'btn ghost', type: 'button', onclick: skip }, 'Skip and show answer')),
      h('p', { class: 'prompt' }, 'Tap a number, then an operator, then another number. Use every number exactly once.')));
    const say = (t, cls = '') => { msg.className = 'msg ' + cls; msg.textContent = t; };
    function newPuzzle() {
      P = genTarget(d, r);
      tiles = P.nums.map(v => ({ v, id: ++uid })); hist = []; sel = null; op = null; busy = false; t0 = performance.now();
      tgt.innerHTML = `<small>Make</small><b>${P.target}</b>`; say('');
      draw();
    }
    function draw(fresh) {
      tilesEl.innerHTML = '';
      tiles.forEach((t, k) => tilesEl.append(h('button', { class: 'tn-tile' + (k === sel ? ' sel' : '') + (t.id === fresh ? ' new' : ''), type: 'button', 'aria-pressed': String(k === sel), onclick: () => tapTile(k) }, t.v)));
      $$('.tn-op', opsEl).forEach(b => b.classList.toggle('on', b.textContent === op));
    }
    function tapTile(k) {
      if (busy || ctx.done) return;
      if (sel === null || (op === null && sel !== k)) { sel = k; SFX.click(); }
      else if (sel === k) { sel = null; op = null; }
      else return combine(sel, k, op);
      draw();
    }
    function tapOp(o) {
      if (busy || ctx.done) return;
      if (sel === null) { say('Pick a number first.', 'bad'); return; }
      op = op === o ? null : o; SFX.click(); draw();
    }
    function combine(i, j, o) {
      const a = tiles[i].v, b = tiles[j].v;
      let v;
      if (o === '+') v = a + b; else if (o === '×') v = a * b; else if (o === '−') v = a - b;
      else { if (b === 0 || a % b !== 0) { say(`${a} ÷ ${b} isn’t a whole number. Try another move.`, 'bad'); SFX.bad(); op = null; draw(); tilesEl.classList.add('shake'); ctx.timeout(() => tilesEl.classList.remove('shake'), 400); return; } v = a / b; }
      if (v < 0) { say(`${a} − ${b} goes below zero. Try ${b} − ${a}.`, 'bad'); SFX.bad(); op = null; draw(); return; }
      hist.push(tiles.map(t => ({ ...t })));
      const nt = { v, id: ++uid }, next = [];
      tiles.forEach((t, k) => { if (k === j) next.push(nt); else if (k !== i) next.push(t); });
      tiles = next; sel = tiles.indexOf(nt); op = null; SFX.pop();
      say(`${a} ${o} ${b} = ${v}`);
      draw(nt.id);
      burstFrom($('.tn-tile.new', tilesEl), cssVar('--d-math'), 12);
      if (tiles.length === 1) {
        if (v === P.target) win();
        else { say(`That makes ${v}, not ${P.target}. Undo or reset.`, 'bad'); SFX.bad(); }
      }
    }
    function win() {
      busy = true; solved++;
      const secs = (performance.now() - t0) / 1000, pts = 300 + (secs < 15 ? 150 : secs < 30 ? 75 : 0);
      score += pts; SFX.good();
      $$('.tn-tile', tilesEl).forEach(b => b.classList.add('win'));
      burstFrom(tilesEl, cssVar('--good'), 40);
      say(`Solved in ${Math.round(secs)}s! +${pts}`, 'good');
      ctx.hud('score', 'Score', fmt(score)); ctx.hud('solved', 'Solved', String(solved));
      ctx.timeout(newPuzzle, 900);
    }
    function undo() { if (busy || !hist.length) return; tiles = hist.pop(); sel = null; op = null; say(''); draw(); }
    function reset() { if (busy) return; tiles = P.nums.map(v => ({ v, id: ++uid })); hist = []; sel = null; op = null; say(''); draw(); }
    function skip() {
      if (busy) return;
      busy = true; skipped++;
      say(`One answer: ${P.sol} = ${P.target}`, 'good');
      ctx.timeout(newPuzzle, 2600);
    }
    function end() {
      ctx.finish({
        score, stars: (solved >= 1) + (solved >= 3) + (solved >= 5), perf: Math.min(1, solved / 5), badges: solved >= 5 ? ['make24'] : [],
        summary: [['Solved', String(solved)], ['Skipped', String(skipped)], ['Goal for 3★', '5 solves']],
        lesson: 'Work backwards from the target. 24 is 3 × 8, 4 × 6, 2 × 12 or 12 + 12, so look for numbers that can build those pieces.'
      });
    }
    ctx.onKey(e => {
      if (/^[1-4]$/.test(e.key)) { const k = +e.key - 1; if (k < tiles.length) { tapTile(k); return true; } }
      const m = { '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷' }[e.key];
      if (m) { tapOp(m); return true; }
      if (e.key === 'Backspace' || e.key === 'z') { undo(); return true; }
      return false;
    });
    ctx.hud('score', 'Score', '0'); ctx.hud('solved', 'Solved', '0');
    ctx.countdown(120, end);
    newPuzzle();
  }
};
