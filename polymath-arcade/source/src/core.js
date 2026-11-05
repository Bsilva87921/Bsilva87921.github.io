'use strict';
/* =====================================================================
   Polymath Arcade: core (utilities, state, sound, shell, game host, quiz engine)
   ===================================================================== */

/* ---------- Utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, d = 0) => (n < 0 ? '−$' : '$') + fmt(Math.abs(n), d);
const pct = (n, d = 0) => fmt(n * 100, d) + '%';
const fmtK = n => Math.abs(n) >= 10000 ? fmt(n / 1000, 0) + 'k' : Math.abs(n) >= 1000 ? fmt(n / 1000, 1) + 'k' : fmt(n);
const stripTags = s => String(s).replace(/<[^>]+>/g, '');
const round2 = x => Math.round(x * 100) / 100;
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
function dayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
const prettyDate = (d = new Date()) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Random numbers (seedable, so the Daily Challenge is the same for everyone) ---------- */
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    float: (lo, hi) => lo + next() * (hi - lo),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; },
    sample: (arr, n) => r.shuffle(arr).slice(0, n),
    normal: (mu = 0, sd = 1) => { let u = 0; while (u === 0) u = next(); const v = next(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    weighted: items => { const tot = items.reduce((s, x) => s + x[1], 0); let k = next() * tot; for (const [it, w] of items) { k -= w; if (k < 0) return it; } return items[items.length - 1][0]; }
  };
  return r;
}
function hashStr(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
const RNG = makeRng(((Math.random() * 4294967296) >>> 0) ^ (Date.now() & 0xffffffff));

/* Three plausible wrong numbers near `ans` (meaningful mistakes first). */
function nearNums(ans, r, extras = [], opt = {}) {
  const allowNeg = opt.neg || ans < 0;
  const dec = opt.dec || 0;
  const norm = v => dec ? Math.round(v * 10 ** dec) / 10 ** dec : Math.round(v);
  const ok = v => Number.isFinite(v) && (allowNeg || v >= 0) && norm(v) !== norm(ans);
  const out = [];
  const add = v => { v = norm(v); if (ok(v) && !out.includes(v)) out.push(v); };
  extras.forEach(add);
  const mag = Math.abs(ans);
  const step = dec ? Math.max(10 ** -dec, round2(mag * 0.1)) : Math.max(1, Math.round(mag * 0.1));
  const pool = r.shuffle([ans + step, ans - step, ans + 2 * step, ans - 2 * step, ans + 1, ans - 1, ans + 10, ans - 10, ans * 2, ans / 2, ans + 3 * step]);
  for (const v of pool) { if (out.length >= 3) break; add(v); }
  let k = 4; while (out.length < 3) add(ans + k++ * step);
  return out.slice(0, 3);
}

/* ---------- Saved state ---------- */
const STORE = 'polymath-arcade-v1';
function freshState() {
  return { v: 1, name: 'Player', xp: 0, sound: true, theme: null, streak: 0, bestStreak: 0, lastDay: null,
    goal: { day: null, rounds: 0 }, daily: {}, games: {}, domains: {}, badges: {},
    stats: { rounds: 0, correct: 0, answered: 0, bestCombo: 0 }, robot: { unlocked: 1, stars: {} }, tour: 0, haptics: true, updated: 0 };
}
function normalize(o) {
  const s = freshState();
  if (o && typeof o === 'object') {
    for (const k in s) if (o[k] !== undefined && o[k] !== null) s[k] = o[k];
    s.goal = Object.assign(freshState().goal, s.goal);
    s.stats = Object.assign(freshState().stats, s.stats);
    s.robot = Object.assign(freshState().robot, s.robot);
    if (o.theme === null) s.theme = null;
  }
  return s;
}
function loadLocal() { try { const raw = localStorage.getItem(STORE); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* storage unavailable */ } return null; }
function writeLocal() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
let S = loadLocal() || freshState();
function persist() { S.updated = Date.now(); writeLocal(); Cloud.queue(); }
function gameRec(id) { if (!S.games[id]) S.games[id] = { plays: 0, best: 0, stars: 0, diff: 1 }; return S.games[id]; }

/* Optional sync to the viewer's private store when the page runs inside Claude. Falls back silently. */
const Cloud = {
  ref: null, on: false, busy: false, again: false, timer: 0, retries: 0,
  async init() {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const ref = db.doc('data/users/' + uid + '/progress');
      const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
      this.ref = ref; this.on = true;
      const remote = snap && snap.exists ? snap.data() : null;
      if (remote && remote.state) {
        const rs = normalize(JSON.parse(JSON.stringify(remote.state)));
        if (rs.xp > S.xp || (rs.xp === S.xp && rs.updated > S.updated)) {
          S = rs; writeLocal(); applyTheme();
          if (!CUR) render();
          return;
        }
        if (S.xp > rs.xp || S.updated > rs.updated) this.queue(0);
      } else if (S.updated) this.queue(0);
      if (!CUR && VIEW === 'profile') render();
    } catch (e) { this.ref = null; this.on = false; }
  },
  queue(delay = 1200) { if (!this.ref) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), delay); },
  async push() {
    if (!this.ref) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try { await this.ref.set({ state: JSON.parse(JSON.stringify(S)), savedAt: Date.now() }); this.retries = 0; }
    catch (e) {
      const code = e && e.code;
      if (['invalid_argument', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'quota_exceeded', 'transform_error'].includes(code)) { this.ref = null; this.on = false; }
      else if (this.retries++ < 2) setTimeout(() => this.queue(0), 1500 + Math.random() * 1500);
    }
    this.busy = false;
    if (this.again) { this.again = false; this.push(); }
  }
};

/* ---------- Sound (synthesized, no files) ---------- */
const SFX = (() => {
  let ac = null;
  function ctx() {
    if (!S.sound) return null;
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { return null; }
    return ac;
  }
  function tone(f, dur = 0.12, type = 'sine', vol = 0.1, when = 0, slide = 0) {
    const c = ctx(); if (!c) return;
    try {
      const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* audio refused */ }
  }
  return {
    click: () => tone(520, 0.05, 'square', 0.03),
    pop: () => tone(760, 0.07, 'sine', 0.09, 0, 1.4),
    good: () => { tone(660, 0.09, 'sine', 0.11); tone(990, 0.14, 'sine', 0.1, 0.07); buzz(12); },
    bad: () => tone(190, 0.22, 'sawtooth', 0.06, 0, 0.6),
    tick: () => tone(1250, 0.03, 'square', 0.025),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.1)); buzz([18, 60, 18, 60, 40]); },
    level: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.08)); buzz([30, 40, 30, 40, 80]); },
    launch: () => tone(180, 0.35, 'sawtooth', 0.05, 0, 3),
    thud: () => tone(110, 0.18, 'sine', 0.12, 0, 0.5),
    coin: () => { tone(988, 0.06, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0.06); }
  };
})();
function buzz(ms = 40) { if (S.haptics === false) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no vibration */ } }

/* ---------- Particles: confetti, sparks, shockwaves ---------- */
const FX = {
  parts: [], running: false, cv: null, c: null, dpr: 1,
  ensure() {
    if (!this.cv) { this.cv = $('#fx'); this.c = this.cv.getContext('2d'); }
    const d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(innerWidth * d), hh = Math.round(innerHeight * d);
    if (this.cv.width !== w || this.cv.height !== hh) { this.cv.width = w; this.cv.height = hh; }
    this.dpr = d;
  },
  palette() { const cs = getComputedStyle(document.documentElement); return DOMAIN_ORDER.map(d => cs.getPropertyValue('--d-' + d).trim()).concat(['#22d3ee', '#f472b6', '#fbbf24', '#a78bfa']); },
  burst(n = 170) {
    if (reduceMotion()) return;
    this.ensure();
    const cols = this.palette();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, sp = 7 + Math.random() * 11;
      this.parts.push({ k: Math.random() < 0.82 ? 'conf' : 'star', x: innerWidth / 2 + (Math.random() - 0.5) * 180, y: innerHeight * 0.38, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 6 + Math.random() * 7, h: 3 + Math.random() * 4, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.35, flip: Math.random() * 6.3, vf: 0.1 + Math.random() * 0.22, c: cols[i % cols.length], life: 1, decay: 0.0035 + Math.random() * 0.004 });
    }
    this.run();
  },
  burstAt(x, y, color, n = 28) {
    if (reduceMotion()) return;
    this.ensure();
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7; this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, r: 1.5 + Math.random() * 2.8, c: color, life: 1, decay: 0.018 + Math.random() * 0.02 }); }
    this.parts.push({ k: 'ring', x, y, r: 8, vr: 6, c: color, life: 1, decay: 0.032 });
    this.run();
  },
  fade() { for (const p of this.parts) p.decay = Math.max(p.decay, 0.07); },
  run() {
    if (this.running) return;
    this.running = true;
    const step = () => {
      const c = this.c, d = this.dpr;
      c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
      this.parts = this.parts.filter(p => p.life > 0 && p.y < innerHeight + 80);
      for (const p of this.parts) {
        p.life -= p.decay;
        c.globalAlpha = clamp(p.life * 1.5, 0, 1);
        if (p.k === 'conf' || p.k === 'star') {
          p.vy += 0.26; p.vx *= 0.99; p.vy *= 0.993; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += p.vf;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.flip)); c.fillStyle = p.c;
          if (p.k === 'conf') c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          else { c.shadowColor = p.c; c.shadowBlur = 12; c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.w * 0.38 : p.w * 0.9, an = k * Math.PI / 5; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); }
          c.restore();
        } else if (p.k === 'spark') {
          p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.vx *= 0.96;
          c.fillStyle = p.c; c.shadowColor = p.c; c.shadowBlur = 12;
          c.beginPath(); c.arc(p.x, p.y, Math.max(0.3, p.r * p.life), 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
        } else {
          p.r += p.vr; p.vr *= 0.93;
          c.strokeStyle = p.c; c.lineWidth = 3 * p.life; c.shadowColor = p.c; c.shadowBlur = 14;
          c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0;
        }
      }
      c.globalAlpha = 1;
      if (this.parts.length) requestAnimationFrame(step); else { this.running = false; c.clearRect(0, 0, innerWidth, innerHeight); }
    };
    requestAnimationFrame(step);
  }
};

/* ---------- Icons ---------- */
const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.2.8 2 1.8 2 1.6 0 2.2-1.6 1.7-3.5C16.5 9.6 19 12.4 19 15.5 19 19.1 15.9 22 12 22s-7-2.9-7-6.5C5 10.8 9.5 8 12 2z"/></svg>',
  star: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z" fill="currentColor" fill-opacity=".25"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4"/></svg>'
};
const starsHTML = (n, cls = 'star') => [0, 1, 2].map(i => `<svg class="${cls}${i < n ? ' on' : ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON.star}</svg>`).join('');

/* ---------- Catalog ---------- */
const DOMAINS = {
  brain: 'Brain', math: 'Math', physics: 'Physics', world: 'Real World', coding: 'Coding',
  science: 'Science', finance: 'Finance', econ: 'Economics', business: 'Business', english: 'English', mix: 'All subjects'
};
const DOMAIN_ORDER = ['brain', 'math', 'physics', 'world', 'coding', 'science', 'finance', 'econ', 'business', 'english'];
const GAMES = [
  { id: 'memory', sym: 'Mm', name: 'Memory Matrix', domain: 'brain', adaptive: true, desc: 'Tiles flash for a moment. Tap the pattern back from memory as the grid grows.', how: ['Watch which tiles light up.', 'Tap the same tiles from memory.', 'A perfect round adds a tile. A wrong tap costs one of 3 lives.'], skills: 'Working memory, visual attention' },
  { id: 'clash', sym: 'Cc', name: 'Color Clash', domain: 'brain', adaptive: true, desc: 'Does the word match the color? Your brain reads faster than it thinks.', how: ['Compare a word’s meaning with an ink color, as the rule says.', 'Tap Yes or No, or press → and ←.', '45 seconds. Streaks multiply your points.'], skills: 'Attention control, processing speed' },
  { id: 'pattern', sym: 'Pp', name: 'Pattern Pro', domain: 'brain', adaptive: true, desc: 'Find the rule behind a number sequence and pick what comes next.', how: ['Study the sequence.', 'Pick the next number.', '60 seconds. Wrong answers cost you, so think before you tap.'], skills: 'Logical reasoning, pattern recognition' },
  { id: 'sprint', sym: 'Ms', name: 'Math Sprint', domain: 'math', adaptive: true, desc: '60 seconds of mental math. Type the answer and it locks in on its own.', how: ['Solve the problem in your head.', 'Type it on the keypad or keyboard. A correct answer locks in instantly.', 'Build streaks for bigger multipliers.'], skills: 'Mental arithmetic, percentages, order of operations' },
  { id: 'target', sym: 'Tn', name: 'Target Number', domain: 'math', adaptive: true, desc: 'Combine the numbers with + − × ÷ to hit the target exactly.', how: ['Tap a number, an operator, then another number to combine them.', 'Use every number once and finish on the target.', 'Two minutes. Stuck? Skip to see a solution.'], skills: 'Number sense, planning, flexible thinking' },
  { id: 'launch', sym: 'Pl', name: 'Planet Launch', domain: 'physics', adaptive: true, desc: 'Set angle and speed to land shots on targets under real planetary gravity.', how: ['Pick a launch angle and speed.', 'Land on the target pad. Gravity changes on every world.', 'Hit 3 targets with 12 shots. Fewer shots earn more stars.'], skills: 'Projectile motion, gravity, estimation' },
  { id: 'formula', sym: 'Ff', name: 'Formula Frenzy', domain: 'physics', adaptive: true, desc: 'Force, energy, circuits and motion. Real formulas, real units.', how: ['Read the problem and pick the right formula.', 'Work it out and choose the answer.', 'Each answer comes with the worked solution.'], skills: 'F = ma, energy, Ohm’s law, kinematics' },
  { id: 'estimate', sym: 'Es', name: 'Estimation Station', domain: 'world', adaptive: false, desc: 'How far is the Moon? How much does $100 a month grow to? Guess close to score.', how: ['Slide or type your best guess.', 'Points depend on how close you get.', '8 questions. Within 10% is a bullseye.'], skills: 'Estimation, orders of magnitude, number sense' },
  { id: 'shopper', sym: 'Ss', name: 'Smart Shopper', domain: 'world', adaptive: true, desc: 'Unit prices, stacked discounts, tips, taxes and paychecks: everyday math.', how: ['Read the situation.', 'Pick the right number or the better deal.', 'Each answer shows the quick way to work it out.'], skills: 'Percentages, unit rates, money sense' },
  { id: 'globe', sym: 'Gt', name: 'Globe Trotter', domain: 'world', adaptive: true, desc: 'Match countries and capitals, and dodge the famous traps.', how: ['Pick the capital, or the country.', 'Watch for traps like Sydney and Toronto.', '60 seconds. Streaks multiply your points.'], skills: 'World geography' },
  { id: 'robot', sym: 'Rc', name: 'Robot Coder', domain: 'coding', adaptive: false, desc: 'Program a robot with commands, functions and loops to collect every gem.', how: ['Tap commands to build the program.', 'Press Run and watch the robot follow your code exactly.', 'Shorter programs earn more stars. P1 is a function you can reuse, or call from itself.'], skills: 'Sequencing, functions, loops and recursion' },
  { id: 'tracer', sym: 'Ct', name: 'Code Tracer', domain: 'coding', adaptive: true, desc: 'Read real Python and JavaScript and predict exactly what it prints.', how: ['Trace the code line by line in your head.', 'Pick the exact output.', 'Each answer comes with a walkthrough.'], skills: 'Code reading, loops, conditions, functions' },
  { id: 'elements', sym: 'El', name: 'Element Match', domain: 'science', adaptive: true, desc: 'Element names and symbols at speed. Na for sodium? Learn why.', how: ['Match the element to its symbol, or the symbol to its name.', '60 seconds. Streaks multiply your points.', 'Harder levels reach deeper into the table.'], skills: 'Chemistry basics, memory' },
  { id: 'science', sym: 'Sc', name: 'Science Snap', domain: 'science', adaptive: true, desc: 'Biology, chemistry, Earth and space science in quick questions.', how: ['Read the question.', 'Pick the best answer.', 'Each answer explains the science.'], skills: 'Scientific literacy' },
  { id: 'market', sym: 'Mk', name: 'Market Mayhem', domain: 'finance', adaptive: false, desc: 'Invest $10,000 through 10 years of headlines. Can you beat a simple 60/40 portfolio?', how: ['Read the year’s headline.', 'Split your money across stocks, bonds, cash and crypto.', 'Run the year and see what happened. Changing your mix costs a small fee.'], skills: 'Risk and return, diversification, inflation' },
  { id: 'money', sym: 'Mo', name: 'Money Math', domain: 'finance', adaptive: true, desc: 'Compound interest, the Rule of 72, credit cards, budgets and paychecks.', how: ['Read the money situation.', 'Pick the answer.', 'Each answer shows the formula or rule behind it.'], skills: 'Personal finance, compounding, percentages' },
  { id: 'econ', sym: 'Ec', name: 'Econ Shock', domain: 'econ', adaptive: true, desc: 'A frost hits the orange crop. What happens next? Predict the ripple effects.', how: ['Read the scenario.', 'Predict what happens to prices, jobs or markets.', 'Each answer explains the economics.'], skills: 'Supply and demand, incentives, macroeconomics' },
  { id: 'tycoon', sym: 'Ty', name: 'Pop-Up Tycoon', domain: 'business', adaptive: false, desc: 'Run a lemonade stand for 7 days. Set prices, stock cups and read the weather.', how: ['Check the forecast and any events.', 'Set your price, how many cups to make, and your ad budget.', 'Open the stand. Leftover cups are wasted and selling out loses customers. You’re scored against par: what a perfect planner would earn with the same weather.'], skills: 'Pricing, inventory, profit and loss' },
  { id: 'breakeven', sym: 'Be', name: 'Break-Even', domain: 'business', adaptive: true, desc: 'Margins, markups, break-even points and runway. Think like a founder.', how: ['Read the business situation.', 'Pick the answer.', 'Each answer shows the business math.'], skills: 'Unit economics, margins, cash flow' },
  { id: 'scramble', sym: 'Ws', name: 'Word Scramble', domain: 'english', adaptive: true, desc: 'Unscramble the letters using the clue. Builds vocabulary and spelling.', how: ['Read the clue.', 'Tap letters (or type) to spell the word.', '90 seconds. Hints cost points; skips break your streak.'], skills: 'Vocabulary, spelling' },
  { id: 'lexicon', sym: 'Lx', name: 'Lexicon', domain: 'english', adaptive: true, desc: 'Vocabulary, grammar and spelling, with a quick explanation every time.', how: ['Read the question.', 'Pick the best answer.', 'Learn from each explanation.'], skills: 'Vocabulary, grammar, spelling' }
];
GAMES.forEach((g, i) => { g.n = i + 1; });
const DAILY_META = { id: 'daily', sym: 'Dc', name: 'Daily Challenge', domain: 'mix', adaptive: false, n: 0 };
const GAME_BY_ID = Object.fromEntries(GAMES.concat([DAILY_META]).map(g => [g.id, g]));
const IMPL = {};   // game id -> { play(ctx) }
const QGEN = {};   // quiz generators used by the Daily Challenge

const BADGES = [
  ['first', 'Go', 'First steps', 'Finish your first round', 'mix'],
  ['stars3', '3★', 'Superstar', 'Earn 3 stars in any game', 'mix'],
  ['combo10', '×10', 'On fire', 'Answer 10 in a row correctly', 'mix'],
  ['perfect', '100', 'Flawless', 'Get every question right in a 10-question round', 'mix'],
  ['explorer', '5', 'Explorer', 'Play 5 different games', 'mix'],
  ['polymath', 'All', 'True polymath', 'Play every game at least once', 'mix'],
  ['streak3', '3d', 'Habit builder', 'Play 3 days in a row', 'mix'],
  ['streak7', '7d', 'Unstoppable', 'Play 7 days in a row', 'mix'],
  ['daily', 'Dc', 'Daily grinder', 'Complete a Daily Challenge', 'mix'],
  ['lvl5', 'L5', 'Rising star', 'Reach level 5', 'mix'],
  ['lvl10', 'L10', 'Elite mind', 'Reach level 10', 'mix'],
  ['memory', '10', 'Photographic', 'Recall a 10-tile pattern in Memory Matrix', 'brain'],
  ['make24', '24', 'Number wizard', 'Solve 5 puzzles in one Target Number round', 'math'],
  ['bullseye', '◎', 'Sharpshooter', 'Hit a Planet Launch target on the first shot', 'physics'],
  ['estimator', '≈', 'Human calculator', 'Score 3 bullseyes in one Estimation round', 'world'],
  ['robot', 'Rb', 'Robot whisperer', 'Clear all 10 Robot Coder levels', 'coding'],
  ['investor', '60', 'Patient investor', 'Beat the 60/40 portfolio in Market Mayhem', 'finance'],
  ['tycoon', '$', 'Lemonade mogul', 'Reach 82% of par profit in Pop-Up Tycoon', 'business']
];

/* ---------- Levels ---------- */
function levelInfo(xp) { let lvl = 1, base = 0, need = 120; while (xp >= base + need) { base += need; lvl++; need = 120 + (lvl - 1) * 60; } return { lvl, into: xp - base, need, frac: (xp - base) / need }; }
const RANKS = ['Rookie', 'Apprentice', 'Thinker', 'Scholar', 'Strategist', 'Analyst', 'Expert', 'Mastermind', 'Genius', 'Polymath'];
const rankName = lvl => RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 3))];
const domainLevel = xp => 1 + Math.floor((xp || 0) / 150);
function playerSym() {
  const letters = (S.name || '').replace(/[^A-Za-z]/g, '');
  if (letters.length >= 2) return letters[0].toUpperCase() + letters[1].toLowerCase();
  if (letters.length === 1) return letters.toUpperCase();
  return 'Pl';
}

/* ---------- Theme ---------- */
function effectiveTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function paintThemeBtns() {
  const dark = effectiveTheme() === 'dark';
  $$('.theme-btn').forEach(b => { b.innerHTML = dark ? ICON.sun : ICON.moon; b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); b.title = b.getAttribute('aria-label'); });
}
function applyTheme() { if (S.theme === 'dark' || S.theme === 'light') document.documentElement.setAttribute('data-theme', S.theme); paintThemeBtns(); }
function toggleTheme(ev) {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  S.theme = next; persist();
  const apply = () => document.documentElement.setAttribute('data-theme', next);
  const rect = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget.getBoundingClientRect() : null;
  const x = rect ? rect.left + rect.width / 2 : innerWidth - 40, y = rect ? rect.top + rect.height / 2 : 30;
  if (document.startViewTransition && !reduceMotion()) {
    const root = document.documentElement;
    root.classList.add('theme-vt');
    try {
      const vt = quietVT(document.startViewTransition(apply));
      vt.ready.then(() => {
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 720, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      const done = () => root.classList.remove('theme-vt');
      vt.finished.then(done, done);
    } catch (e) { root.classList.remove('theme-vt'); apply(); }
  } else apply();
}
function themeChanged() {
  paintThemeBtns();
  if (typeof BG3D !== 'undefined') BG3D.theme();
  if (CUR && CUR.onTheme) CUR.onTheme();
  if (!CUR && VIEW === 'profile') render();
}

/* ---------- Modal & toast ---------- */
let modalEsc = null;
function openModal(content, opt = {}) {
  const m = $('#modal');
  m.innerHTML = '';
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.label || 'Dialog' }, content);
  if (opt.dc) sheet.style.setProperty('--dc', opt.dc);
  m.append(sheet); m.hidden = false;
  modalEsc = opt.onEsc === undefined ? closeModal : opt.onEsc;
  m.onclick = e => { if (e.target === m && modalEsc) modalEsc(); };
  setTimeout(() => { const f = sheet.querySelector('[data-autofocus]') || sheet.querySelector('.btn.primary') || sheet.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 40);
  return sheet;
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; modalEsc = null; }
function toast(msg, ms = 2400) { const t = h('div', { class: 'toast' }, msg); $('#toast').append(t); setTimeout(() => t.remove(), ms); }

/* ---------- Shell & views ---------- */
let VIEW = 'home', FILTER = 'all', CUR = null;
function go(view) {
  if (view !== VIEW) FX.fade();
  const f = () => { VIEW = view; render(); try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } };
  if (view !== VIEW) withVT(f); else f();
}
function render() {
  renderTop();
  $$('.tabbar button').forEach(b => { const on = b.dataset.view === VIEW; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  const v = $('#view');
  v.innerHTML = '';
  if (VIEW === 'daily') renderDaily(v); else if (VIEW === 'profile') renderProfile(v); else renderHome(v);
  requestAnimationFrame(placeTabInd);
  App.route(VIEW);
}
function streakNow() { return (S.lastDay === dayKey() || S.lastDay === yesterdayKey()) ? S.streak : 0; }
function renderTop() {
  const sp = $('#streakPill'), n = streakNow();
  sp.innerHTML = `<span class="flame" aria-hidden="true">${ICON.flame}</span><span>${n}</span>`;
  sp.classList.toggle('cold', S.lastDay !== dayKey());
  const label = n ? `${n}-day streak${S.lastDay !== dayKey() ? ' (play today to keep it)' : ''}` : 'Play today to start a streak';
  sp.title = label; sp.setAttribute('aria-label', label);
  const sb = $('#soundBtn');
  sb.innerHTML = S.sound ? ICON.soundOn : ICON.soundOff;
  sb.setAttribute('aria-label', S.sound ? 'Turn sound off' : 'Turn sound on'); sb.title = sb.getAttribute('aria-label');
  paintThemeBtns();
}
function xpBarEl(L) {
  const bar = h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': 'Experience to next level', 'aria-valuemin': 0, 'aria-valuemax': L.need, 'aria-valuenow': L.into }, h('i'));
  bar.firstChild.style.width = (L.frac * 100).toFixed(1) + '%';
  return h('div', { class: 'stack', style: 'gap:7px' }, bar, h('div', { class: 'xp-line' }, h('span', null, `${fmt(L.into)} / ${fmt(L.need)} XP`), h('span', null, `Level ${L.lvl + 1} next`)));
}
function goalToday() { return S.goal.day === dayKey() ? S.goal.rounds : 0; }
function ringSVG(frac, size = 40, r = 16) {
  const C = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="bgc" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="fgc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - clamp(frac, 0, 1))).toFixed(1)}"/></svg>`;
}
function playerCardEl(L, show) {
  const R = 44, C = 2 * Math.PI * R;
  const acc = S.stats.answered ? pct(S.stats.correct / S.stats.answered) : '–';
  const top = DOMAIN_ORDER.slice().sort((a, b) => (S.domains[b] || 0) - (S.domains[a] || 0))[0];
  const card = h('button', { class: 'pcard', type: 'button', 'aria-label': `Your player card: level ${L.lvl}, ${rankName(L.lvl)}. Select to flip it over.` },
    h('span', { class: 'pface' },
      h('span', { class: 'pf-top' }, h('span', null, L.lvl), h('span', null, fmtK(S.xp) + ' XP')),
      h('span', { class: 'pf-ring' }, h('span', { html: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bgc" cx="50" cy="50" r="${R}"/><circle class="fgc" cx="50" cy="50" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - L.frac)).toFixed(1)}"/></svg>` }), h('span', { class: 'pf-sym' }, h('span', null, playerSym()))),
      h('span', { class: 'pf-bottom' }, h('strong', null, S.name), h('small', null, `${rankName(L.lvl)} · ${fmt(L.into)}/${fmt(L.need)} XP`))),
    h('span', { class: 'pface pback' }, h('span', { class: 'pb-in' }, h('h3', null, 'Lab record'),
      [['Rounds played', fmt(S.stats.rounds)], ['Accuracy', acc], ['Best streak', `${S.bestStreak} days`], ['Best combo', '×' + S.stats.bestCombo], ['Top subject', S.domains[top] ? DOMAINS[top] : '–'], ['Badges', `${Object.keys(S.badges).length}/${BADGES.length}`]]
        .map(([k, v]) => h('span', { class: 'pb-row' }, h('span', null, k), h('b', null, v))))));
  card.addEventListener('click', () => { card.classList.remove('tilting'); card.classList.toggle('flipped'); SFX.pop(); });
  bindTilt(card, 18);
  return h('div', { class: 'pwrap' + (show ? ' show' : '') }, h('div', { class: 'pfloat' }, card), h('p', { class: 'pf-hint' }, 'Tap the card to flip it'));
}
function heroEl() {
  const L = levelInfo(S.xp), g = goalToday(), streak = streakNow();
  return h('section', { class: 'hero', 'aria-label': 'Welcome' },
    h('div', { class: 'hero-copy' },
      h('span', { class: 'chip-eyebrow' }, h('i'), `${GAMES.length} games · ${DOMAIN_ORDER.length} subjects`, h('span', { class: 'hide-sm' }, ' · always adapting')),
      h('h1', null, h('span', null, 'Train every'), h('span', { class: 'l2 grad-text' }, 'kind of smart.')),
      h('p', null, 'Brain games for math, words, physics, code, money and the real world. Every round adapts to you and explains what you missed.'),
      S.stats.rounds < 5 ? h('button', { class: 'tour-cta', type: 'button', onclick: () => Tour.start() },
        h('span', { class: 'tc-ico', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" fill="currentColor"/></svg>' }),
        'New here? Take the tour', h('small', null, '1 min')) : null,
      h('div', { class: 'hero-stats' },
        h('div', { class: 'hstat' }, h('span', { html: ringSVG(g / 3) }), h('div', null, h('small', null, 'Daily goal'), h('b', null, `${Math.min(g, 3)}/3 rounds`))),
        h('div', { class: 'hstat', style: '--hc:#fb923c' }, h('span', { class: 'ico', html: ICON.flame }), h('div', null, h('small', null, 'Streak'), h('b', null, `${streak} day${streak === 1 ? '' : 's'}`))),
        h('div', { class: 'hstat' }, h('span', { class: 'ico', html: ICON.trophy }), h('div', null, h('small', null, 'Badges'), h('b', null, `${Object.keys(S.badges).length}/${BADGES.length}`))))),
    playerCardEl(L));
}
function dailyStripEl() {
  const done = S.daily[dayKey()], d = new Date();
  return h('section', { class: 'holo', 'aria-label': 'Daily challenge' },
    h('div', { class: 'holo-in' },
      h('div', { class: 'orbit', 'aria-hidden': 'true' }, h('span', { class: 'rg' }), h('span', { class: 'rg' }), h('span', { class: 'rg' }),
        h('span', { class: 'core' }, h('span', null, d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), h('b', null, d.getDate())))),
      h('div', { class: 'holo-copy' },
        h('p', { class: 'eyebrow' }, 'Daily challenge', h('span', { class: 'nowrap' }, ' · ' + prettyDate())),
        h('h2', null, done != null ? 'Done for today. Nice work.' : '10 questions. 10\u00a0subjects. 2×\u00a0XP.'),
        h('p', null, done != null ? `You scored ${fmt(done)} points. A new mix unlocks at midnight.` : 'One question from every subject, the same set for everyone today. Finishing it keeps your streak alive.'),
        h('span', { class: 'count' }, done != null ? 'Next set in ' : 'Resets in ', h('b', null, '--:--:--'))),
      h('div', { class: 'holo-cta' }, done != null ? h('span', { class: 'daily-done' }, '✓ ' + fmt(done) + ' pts') : h('button', { class: 'btn primary big glow', type: 'button', onclick: startDaily }, 'Start challenge'))));
}
function legendEl(onPick) {
  const wrap = h('div', { class: 'legend', role: 'toolbar', 'aria-label': 'Filter games by subject' });
  const mk = (key, label, count) => h('button', { class: 'lg', type: 'button', 'data-key': key, style: key === 'all' ? '' : `--dc:var(--d-${key})`, 'aria-pressed': String(FILTER === key), onclick: () => { FILTER = key; onPick(); } }, key === 'all' ? null : h('i'), label, h('small', null, count));
  wrap.append(mk('all', 'All', GAMES.length));
  DOMAIN_ORDER.forEach(d => wrap.append(mk(d, DOMAINS[d], GAMES.filter(g => g.domain === d).length)));
  return wrap;
}
function tileMeta(g) {
  const rec = S.games[g.id];
  if (g.id === 'robot') { const done = Object.keys(S.robot.stars).length; return done ? `${done}/10 levels` : 'New'; }
  if (!rec || !rec.plays) return 'New';
  return g.adaptive ? `Lv ${rec.diff} · best ${fmtK(rec.best)}` : `Best ${fmtK(rec.best)}`;
}
function tileStars(g) {
  if (g.id === 'robot') { const v = Object.values(S.robot.stars); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / 10) : 0; }
  return (S.games[g.id] || {}).stars || 0;
}
function tileEl(g, i) {
  const rec = S.games[g.id] || {};
  const emb = EMB.has(g.id) ? EMB.el(g.id) : h('span', { class: 't-sigil', html: sigilSVG(g.id) });
  const lvlOn = g.id === 'robot' ? Object.keys(S.robot.stars).length : (rec.plays ? rec.diff : 0);
  const t = h('button', { class: 'tile', type: 'button', style: `--dc:var(--d-${g.domain});animation-delay:${i * 30}ms,0s`, onclick: e => openIntro(g.id, e.currentTarget), 'aria-label': `${g.name}. ${DOMAINS[g.domain]}. ${tileMeta(g)}` },
    h('span', { class: 'tile-in' },
      h('span', { class: 't-foil' }), h('span', { class: 't-glare' }),
      h('span', { class: 't-num' }, g.n),
      h('span', { class: 't-stars', html: starsHTML(tileStars(g)) }),
      emb,
      h('span', { class: 't-body' },
        h('span', { class: 't-sym' }, g.sym),
        h('span', { class: 't-name' }, g.name),
        h('span', { class: 't-dom' }, DOMAINS[g.domain]),
        h('span', { class: 't-meta' }, tileMeta(g)),
        (g.adaptive || g.id === 'robot') ? h('span', { class: 't-lvl', 'aria-hidden': 'true' }, [...Array(10)].map((_, k) => h('i', { class: k < lvlOn ? 'on' : '' }))) : null)));
  bindTilt(t, 18);
  EMB.watch(t, g.id, emb.classList.contains('emb') ? emb : null);
  return t;
}
function tableEl() {
  const grid = h('div', { class: 'table', id: 'gameTable' });
  GAMES.filter(g => FILTER === 'all' || g.domain === FILTER).forEach((g, i) => grid.append(tileEl(g, i)));
  return grid;
}
function renderHome(v) {
  v.append(heroEl(), dailyStripEl());
  const head = h('div', { class: 'section-head' }, h('div', null, h('p', { class: 'eyebrow' }, 'Choose your game'), h('h2', { style: 'margin-top:6px' }, 'The periodic table of skills')), h('p', null, matchMedia('(hover: hover)').matches ? 'Hover a tile to tilt it. Click to play.' : 'Tap a tile to play.'));
  let grid = tableEl();
  const legend = legendEl(() => {
    $$('.lg', legend).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === FILTER)));
    withVT(() => { const ng = tableEl(); grid.replaceWith(ng); grid = ng; });
  });
  v.append(head, legend, grid, suiteFooterEl());
}

function renderDaily(v) {
  v.append(dailyStripEl());
  const cal = h('div', { class: 'cal' });
  for (let k = 6; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k);
    const sc = S.daily[dayKey(d)];
    cal.append(h('div', { class: (sc != null ? 'done' : '') + (k === 0 ? ' today' : '') }, h('small', null, d.toLocaleDateString('en-US', { weekday: 'short' })), h('b', null, sc != null ? fmtK(sc) : '–')));
  }
  v.append(h('section', { class: 'stack' }, h('div', { class: 'section-head' }, h('h2', null, 'Last 7 days'), h('p', null, 'Points scored in each day’s challenge.')), cal));
  const subjects = h('div', { class: 'subject-list' }, DOMAIN_ORDER.map(d => h('span', { style: `--dc:var(--d-${d})` }, h('i'), DOMAINS[d])));
  const done = S.daily[dayKey()] != null;
  v.append(h('section', { class: 'panel stack' },
    h('h2', { style: 'font-size:18px' }, 'Today’s subjects'), subjects,
    h('p', { class: 'note' }, 'Questions come from the same generators as the games, seeded by today’s date. Your first finish each day earns double XP.'),
    done ? h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: startDaily }, 'Replay today’s set')) : null));
  v.append(suiteFooterEl());
}

function radarSVG() {
  const n = DOMAIN_ORDER.length, cx = 220, cy = 158, R = 106;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  let s = `<svg viewBox="0 0 440 316" role="img" aria-label="Skill radar across ${n} subjects">`;
  [0.25, 0.5, 0.75, 1].forEach(f => { s += `<polygon points="${DOMAIN_ORDER.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`; });
  DOMAIN_ORDER.forEach((_, i) => { const [x, y] = pt(i, 1); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`; });
  const vals = DOMAIN_ORDER.map(d => 0.05 + 0.95 * (1 - Math.exp(-(S.domains[d] || 0) / 700)));
  s += `<polygon class="area" points="${vals.map((f, i) => pt(i, f).join(',')).join(' ')}" fill="url(#ringGrad)" fill-opacity=".25" stroke="url(#ringGrad)" stroke-width="2.5" stroke-linejoin="round"/>`;
  vals.forEach((f, i) => { const [x, y] = pt(i, f); s += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--d-${DOMAIN_ORDER[i]})" stroke="var(--surface)" stroke-width="1.5"/>`; });
  DOMAIN_ORDER.forEach((d, i) => { const [x, y] = pt(i, 1.2); const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'; s += `<text x="${x}" y="${y + 4}" text-anchor="${anchor}">${esc(DOMAINS[d])}</text>`; });
  return s + '</svg>';
}
function medalEl(b, unlocked) {
  return h('div', { class: 'medal' + (unlocked ? '' : ' locked'), style: `--mc:var(--d-${b[4]})` }, h('span', { class: 'm', 'aria-hidden': 'true' }, b[1]), h('div', null, h('strong', null, b[2]), h('small', null, b[3] + (unlocked ? '' : ' (locked)'))));
}
function renderProfile(v) {
  const L = levelInfo(S.xp);
  const input = h('input', { id: 'nameInput', type: 'text', value: S.name, maxlength: '18', 'aria-label': 'Player name', autocomplete: 'off' });
  const saveName = () => { const nv = input.value.trim().slice(0, 18) || 'Player'; if (nv !== S.name) { S.name = nv; persist(); toast('Name saved'); render(); } };
  input.addEventListener('change', saveName);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  v.append(h('section', { class: 'panel profile-top' }, playerCardEl(L, true),
    h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Your name'), h('div', { class: 'name-edit' }, input), h('p', { class: 'rank' }, `${rankName(L.lvl)} · Level ${L.lvl} · ${fmt(S.xp)} XP total`), xpBarEl(L))));
  const acc = S.stats.answered ? pct(S.stats.correct / S.stats.answered) : '–';
  v.append(h('section', { class: 'stat-grid' },
    [['Rounds played', fmt(S.stats.rounds)], ['Answer accuracy', acc], ['Best streak', `${S.bestStreak} day${S.bestStreak === 1 ? '' : 's'}`], ['Badges', `${Object.keys(S.badges).length}/${BADGES.length}`]]
      .map(([k, val]) => h('div', { class: 'stat' }, h('small', null, k), h('b', null, val)))));
  const domList = h('div', { class: 'dom-list' }, DOMAIN_ORDER.map(d => {
    const xp = S.domains[d] || 0, lvl = domainLevel(xp);
    const bar = h('div', { class: 'bar' }, h('i')); bar.firstChild.style.width = ((xp % 150) / 150 * 100).toFixed(1) + '%';
    return h('div', { class: 'dom', style: `--dc:var(--d-${d})` }, h('b', null, DOMAINS[d]), bar, h('span', null, 'Lv ' + lvl));
  }));
  v.append(h('section', { class: 'two-col' },
    h('div', { class: 'panel stack' }, h('h2', { style: 'font-size:18px' }, 'Skill radar'), h('div', { class: 'radar-wrap', html: radarSVG() }), h('p', { class: 'note' }, 'Each axis grows with the XP you earn in that subject.')),
    h('div', { class: 'panel stack' }, h('h2', { style: 'font-size:18px' }, 'Subject levels'), domList)));
  v.append(h('section', { class: 'stack' }, h('div', { class: 'section-head' }, h('h2', null, 'Badges'), h('p', null, `${Object.keys(S.badges).length} of ${BADGES.length} unlocked`)),
    h('div', { class: 'badge-grid' }, BADGES.map(b => medalEl(b, !!S.badges[b[0]])))));
  const toggle = (on, label, fn) => h('button', { class: 'toggle', type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: fn });
  v.append(h('section', { class: 'panel settings' },
    h('h2', { style: 'font-size:18px' }, 'Settings'),
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Sound effects'), h('p', null, 'Short synthesized beeps for right and wrong answers.')), toggle(S.sound, 'Sound effects', () => { S.sound = !S.sound; persist(); render(); })),
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Dark theme'), h('p', null, 'Also available from the sun and moon button at the top.')), toggle(effectiveTheme() === 'dark', 'Dark theme', toggleTheme)),
    ('vibrate' in navigator && matchMedia('(pointer: coarse)').matches) ? h('div', { class: 'setting' }, h('div', null, h('b', null, 'Haptics'), h('p', null, 'Short vibrations for right and wrong answers, on phones that support it.')), toggle(S.haptics !== false, 'Haptics', () => { S.haptics = S.haptics === false; persist(); render(); buzz(20); })) : null,
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Guided tour'), h('p', null, 'A one-minute walkthrough of the arcade.')), h('button', { class: 'btn small', type: 'button', onclick: () => Tour.start() }, 'Start tour')),
    App.settingRow(),
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'Saved progress'), h('p', null, Cloud.on ? 'Saved privately to your account and in this browser.' : App.standalone() ? 'Saved on this device. Works offline.' : 'Saved in this browser on this device.')), h('button', { class: 'btn small', type: 'button', onclick: confirmReset }, 'Reset progress')),
    h('div', { class: 'setting' }, h('div', null, h('b', null, 'About'), h('p', null, `Polymath Arcade v${SUITE.version}, a Probable app by ${SUITE.author}.`)), h('button', { class: 'btn small', type: 'button', onclick: () => openAbout() }, 'About'))));
  v.append(suiteFooterEl());
}
function confirmReset() {
  openModal(h('div', null, h('h2', null, 'Reset all progress?'), h('p', { class: 'lede' }, 'This clears your XP, levels, streak, badges and best scores. It can’t be undone.'),
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: closeModal, 'data-autofocus': true }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { const keep = { name: S.name, sound: S.sound, theme: S.theme, tour: S.tour, haptics: S.haptics }; S = Object.assign(freshState(), keep); persist(); closeModal(); render(); toast('Progress reset'); } }, 'Reset everything'))), { label: 'Reset progress' });
}

/* ---------- Game intro ---------- */
function bigTile(g, spin) { return h('div', { class: 'etile' + (spin ? ' spin3d' : ''), style: `--dc:var(--d-${g.domain})`, 'aria-hidden': 'true' }, h('i', null, g.n || ''), h('b', null, g.sym)); }
function openIntro(id, fromEl) {
  const g = GAME_BY_ID[id], rec = S.games[id] || {};
  const build = () => {
    const body = h('div', null,
      h('div', { class: 'intro-head' }, bigTile(g, true), h('div', null, h('p', { class: 'eyebrow' }, `${g.n} · ${DOMAINS[g.domain]}`), h('h2', { style: 'margin-top:4px' }, g.name), h('p', { class: 'lede' }, g.desc))),
      h('h3', null, 'How to play'), h('ol', { class: 'how' }, g.how.map(t => h('li', null, t))),
      h('p', { class: 'skills' }, h('b', null, 'Skills: '), g.skills));
    if (IMPL[id] && IMPL[id].intro) body.append(IMPL[id].intro());
    else body.append(h('div', { class: 'kv' },
      [['Best', rec.plays ? fmt(rec.best) : '–'], ['Stars', h('span', { html: starsHTML(rec.stars || 0) })], ['Level', g.adaptive ? (rec.diff || 1) + '/10' : '–'], ['Played', fmt(rec.plays || 0)]]
        .map(([k, val]) => h('div', null, h('small', null, k), h('b', null, val)))));
    if (!(IMPL[id] && IMPL[id].intro)) body.append(h('div', { class: 'sheet-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Back'), h('button', { class: 'btn primary', type: 'button', onclick: () => openGame(id) }, 'Play')));
    openModal(body, { dc: `var(--d-${g.domain})`, label: g.name });
  };
  const inner = fromEl && fromEl.querySelector ? fromEl.querySelector('.tile-in') : null;
  if (inner && document.startViewTransition && !reduceMotion()) {
    inner.style.viewTransitionName = 'pm-tile';
    try {
      const vt = quietVT(document.startViewTransition(() => { inner.style.viewTransitionName = ''; build(); const et = $('#modal .etile'); if (et) et.style.viewTransitionName = 'pm-tile'; }));
      const clear = () => { const et = $('#modal .etile'); if (et) et.style.viewTransitionName = ''; inner.style.viewTransitionName = ''; };
      vt.finished.then(clear, clear);
    } catch (e) { inner.style.viewTransitionName = ''; build(); }
  } else build();
}
function startDaily() { openGame('daily', { daily: true, rng: makeRng(hashStr('polymath-daily-' + dayKey())) }); }

/* ---------- Game host ---------- */
function openGame(id, opts = {}) {
  closeModal(); FX.fade();
  if (CUR) { CUR.destroy(); CUR = null; }
  const g = GAME_BY_ID[id], rec = id === 'daily' ? { diff: 4 } : gameRec(id);
  const shell = $('#game');
  shell.hidden = false;
  shell.style.setProperty('--dc', `var(--d-${g.domain})`);
  $('#gTile').textContent = g.sym;
  $('#gTile').style.setProperty('--dc', `var(--d-${g.domain})`);
  $('#gName').textContent = g.name;
  $('#gSub').textContent = id === 'daily' ? prettyDate() : g.adaptive ? `${DOMAINS[g.domain]} · Level ${rec.diff}` : DOMAINS[g.domain];
  $('#hud').innerHTML = '';
  const body = $('#gbody');
  body.innerHTML = ''; body.scrollTop = 0;
  body.style.setProperty('--dc', `var(--d-${g.domain})`);
  document.body.classList.add('in-game');
  $('#gTimebar').hidden = true; $('#gTimebar').classList.remove('low');
  BG3D.focus('--d-' + (g.domain === 'mix' ? 'brain' : g.domain));
  const ctx = makeCtx(g, rec, opts, body);
  CUR = ctx;
  try { IMPL[id].play(ctx); }
  catch (e) { console.error(e); body.append(h('p', { class: 'msg bad' }, 'This game hit a problem while loading. Go back and try again.')); }
}
function closeGame() {
  closeModal();
  if (CUR) { CUR.destroy(); CUR = null; }
  $('#game').hidden = true;
  document.body.classList.remove('in-game');
  BG3D.focus(null);
  render();
}
function requestExit() {
  if (!CUR || CUR.done) { closeGame(); return; }
  CUR.paused = true;
  const resume = () => { closeModal(); if (CUR) CUR.paused = false; };
  openModal(h('div', null, h('h2', null, 'Leave this round?'), h('p', { class: 'lede' }, 'Your score for this round won’t be saved.'),
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: resume, 'data-autofocus': true }, 'Keep playing'), h('button', { class: 'btn primary', type: 'button', onclick: closeGame }, 'Leave'))), { onEsc: resume, label: 'Leave game' });
}
function makeCtx(g, rec, opts, body) {
  const timers = new Set(), ivs = new Set(), rafs = new Set(), keys = [], cleanups = [], hudEls = {};
  const ctx = {
    g, id: g.id, rec, opts, body, r: opts.rng || RNG, daily: !!opts.daily,
    diff: clamp(opts.diff || rec.diff || 1, 1, 10), dead: false, done: false, paused: false, onTheme: null,
    timeout(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (!ctx.dead) fn(); }, ms); timers.add(t); return t; },
    interval(fn, ms) { const t = setInterval(() => { if (!ctx.dead) fn(); }, ms); ivs.add(t); return t; },
    clear(t) { clearTimeout(t); clearInterval(t); timers.delete(t); ivs.delete(t); },
    raf(fn) { const id = requestAnimationFrame(ts => { rafs.delete(id); if (!ctx.dead) fn(ts); }); rafs.add(id); return id; },
    onKey(fn) { keys.push(fn); },
    onCleanup(fn) { cleanups.push(fn); },
    handleKey(e) { for (const f of keys) if (f(e) === true) return true; return false; },
    hud(key, label, value, cls) {
      let el = hudEls[key];
      if (!el) { el = h('div', { class: 'chip' }, h('small', null, label), h('b', null, '')); hudEls[key] = el; $('#hud').append(el); }
      const changed = el.lastChild.textContent !== String(value);
      el.lastChild.textContent = value;
      if (cls !== undefined) el.className = 'chip ' + cls;
      if (changed && (key === 'score' || key === 'combo' || key === 'solved') && !reduceMotion()) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      return el;
    },
    countdown(sec, onEnd, onTick) {
      let left = sec * 1000, last = performance.now(), stopped = false, lastWhole = sec;
      const total = sec * 1000, tb = $('#gTimebar');
      tb.hidden = false;
      const tick = () => {
        if (stopped) return;
        const now = performance.now(), dt = now - last; last = now;
        if (!ctx.paused) left -= dt;
        const s = Math.max(0, Math.ceil(left / 1000));
        ctx.hud('time', 'Time', fmtClock(s), s <= 5 ? 'low' : '');
        tb.firstChild.style.transform = `scaleX(${Math.max(0, left / total).toFixed(4)})`;
        tb.classList.toggle('low', s <= 5);
        if (s !== lastWhole) { lastWhole = s; if (s <= 5 && s > 0) SFX.tick(); }
        if (onTick) onTick(left);
        if (left <= 0) { stopped = true; ctx.clear(iv); onEnd(); }
      };
      const iv = ctx.interval(tick, 100); tick();
      return { add(s) { left += s * 1000; }, stop() { stopped = true; ctx.clear(iv); }, left: () => left };
    },
    finish(res) {
      if (ctx.done || ctx.dead) return;
      ctx.done = true;
      timers.forEach(clearTimeout); ivs.forEach(clearInterval); rafs.forEach(cancelAnimationFrame);
      timers.clear(); ivs.clear(); rafs.clear();
      finishRound(ctx, res);
    },
    destroy() {
      ctx.dead = true;
      timers.forEach(clearTimeout); ivs.forEach(clearInterval); rafs.forEach(cancelAnimationFrame);
      cleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
    }
  };
  return ctx;
}

/* ---------- Finishing a round: XP, streaks, badges, results ---------- */
function finishRound(ctx, res) {
  const g = ctx.g, today = dayKey();
  const stars = clamp(res.stars | 0, 0, 3);
  const perf = clamp(res.perf != null ? res.perf : (res.answered ? res.correct / res.answered : stars / 3), 0, 1);
  const dailyFirst = ctx.daily && S.daily[today] == null;
  const xp = Math.round((10 + stars * 15 + perf * 25 + (res.bonusXp || 0)) * (dailyFirst ? 2 : 1));
  const before = levelInfo(S.xp);
  let newBest = false, diffMsg = '';
  if (!ctx.daily) {
    const rec = gameRec(g.id), firstPlay = !rec.plays;
    const score = Math.round(res.score || 0);
    newBest = !firstPlay && score > rec.best;
    rec.plays++; rec.best = Math.max(rec.best, score); rec.stars = Math.max(rec.stars, stars);
    if (g.adaptive && !res.noAdapt) {
      if (stars >= 3 && rec.diff < 10) { rec.diff++; diffMsg = `Level up: ${g.name} is now level ${rec.diff} of 10.`; }
      else if (stars <= 1 && rec.diff > 1) { rec.diff--; diffMsg = `Easing off: ${g.name} drops to level ${rec.diff} so you can build up again.`; }
    }
    S.domains[g.domain] = (S.domains[g.domain] || 0) + xp;
  } else {
    DOMAIN_ORDER.forEach(d => { S.domains[d] = (S.domains[d] || 0) + Math.round(xp / DOMAIN_ORDER.length); });
    S.daily[today] = Math.max(S.daily[today] || 0, Math.round(res.score || 0));
    const keys = Object.keys(S.daily).sort();
    while (keys.length > 60) delete S.daily[keys.shift()];
  }
  S.xp += xp;
  S.stats.rounds++; S.stats.correct += res.correct || 0; S.stats.answered += res.answered || 0;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, res.maxCombo || 0);
  if (S.lastDay !== today) { S.streak = S.lastDay === yesterdayKey() ? S.streak + 1 : 1; S.lastDay = today; S.bestStreak = Math.max(S.bestStreak, S.streak); }
  if (S.goal.day !== today) S.goal = { day: today, rounds: 0 };
  S.goal.rounds++;
  const after = levelInfo(S.xp), newBadges = [];
  const award = id => { if (!S.badges[id] && BADGES.some(b => b[0] === id)) { S.badges[id] = today; newBadges.push(id); } };
  award('first');
  if (stars >= 3) award('stars3');
  if ((res.maxCombo || 0) >= 10) award('combo10');
  if ((res.answered || 0) >= 10 && res.correct === res.answered) award('perfect');
  const played = GAMES.filter(x => S.games[x.id] && S.games[x.id].plays).length;
  if (played >= 5) award('explorer');
  if (played >= GAMES.length) award('polymath');
  if (S.streak >= 3) award('streak3');
  if (S.streak >= 7) award('streak7');
  if (ctx.daily) award('daily');
  if (after.lvl >= 5) award('lvl5');
  if (after.lvl >= 10) award('lvl10');
  (res.badges || []).forEach(award);
  persist();
  showResults(ctx, res, { stars, xp, before, after, newBest, diffMsg, newBadges, dailyFirst });
}
function showResults(ctx, res, info) {
  const g = ctx.g;
  const verdicts = ['Keep practicing', 'Good effort', 'Great round', 'Outstanding'];
  const levelUp = info.after.lvl > info.before.lvl;
  const bar = h('div', { class: 'xpbar' }, h('i'));
  bar.firstChild.style.width = (levelUp ? 0 : info.before.frac * 100) + '%';
  const again = res.again || { label: ctx.daily ? 'Replay set' : 'Play again', opts: ctx.daily ? null : {} };
  const playAgain = () => { if (ctx.daily) startDaily(); else openGame(g.id, again.opts || {}); };
  const review = res.review && res.review.length ? h('details', { class: 'review' }, h('summary', null, `Review ${res.review.length} missed question${res.review.length === 1 ? '' : 's'}`),
    h('ol', null, res.review.map(it => h('li', null, h('div', { html: it.q }), h('div', null, 'Answer: ', h('span', { class: 'a', html: it.a })), it.why ? h('div', { class: 'w', html: it.why }) : null)))) : null;
  const scoreB = h('b', null, res.scoreText || '0');
  const starsRow = h('div', { class: 'stars-row', html: [0, 1, 2].map(i => `<svg class="${i < info.stars ? 'on' : ''}" style="animation-delay:${350 + i * 220}ms" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON.star}</svg>`).join(''), role: 'img', 'aria-label': `${info.stars} of 3 stars` });
  const sheet = h('div', { class: 'results' },
    h('div', { class: 'res-head' }, h('div', { class: 'res-medal' }, info.stars >= 2 ? h('div', { class: 'rays' }) : null, bigTile(g)), h('div', null, h('p', { class: 'eyebrow' }, g.name), h('h2', { style: 'margin-top:4px' }, res.title || verdicts[info.stars]))),
    starsRow,
    h('div', { class: 'res-score' }, h('small', null, res.scoreLabel || 'Score'), scoreB, info.newBest ? h('span', { class: 'tag' }, 'New best') : null),
    res.summary ? h('dl', { class: 'res-stats' }, res.summary.map(([k, val]) => h('div', null, h('dt', null, k), h('dd', null, val)))) : null,
    res.lesson ? h('div', { class: 'lesson' }, h('b', null, 'Takeaway'), h('p', { html: res.lesson })) : null,
    review,
    h('div', { class: 'xp-block' }, h('div', { class: 'row' }, h('span', null, `Level ${info.after.lvl} · ${rankName(info.after.lvl)}`), h('span', { class: 'xp-gain' }, `+${info.xp} XP${info.dailyFirst ? ' (2× daily)' : ''}`)), bar),
    levelUp ? h('div', { class: 'levelup' }, h('span', { class: 'lv' }, info.after.lvl), h('div', null, h('b', null, `Level ${info.after.lvl} reached`), h('div', null, `Rank: ${rankName(info.after.lvl)}`))) : null,
    info.newBadges.length ? h('div', null, h('h3', null, 'New badges'), h('div', { class: 'badges-new' }, info.newBadges.map(id => medalEl(BADGES.find(b => b[0] === id), true)))) : null,
    info.diffMsg ? h('p', { class: 'diffmsg' }, info.diffMsg) : null,
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn', type: 'button', onclick: closeGame }, 'All games'), h('button', { class: 'btn primary', type: 'button', onclick: playAgain }, again.label)));
  openModal(sheet, { dc: `var(--d-${g.domain})`, onEsc: closeGame, label: 'Round results' });
  if (!res.scoreText) countUp(scoreB, Math.round(res.score || 0), v => fmt(Math.round(v)), 1100);
  setTimeout(() => { bar.firstChild.style.width = (info.after.frac * 100).toFixed(1) + '%'; }, 450);
  $$('svg.on', starsRow).forEach((st, i) => setTimeout(() => { if (!st.isConnected) return; SFX.pop(); burstFrom(st, cssVar('--warn'), 18); }, 650 + i * 220));
  if (levelUp) { setTimeout(() => { SFX.level(); FX.burst(190); BG3D.boost(); }, 700); }
  else if (info.stars >= 3) { setTimeout(() => { SFX.win(); FX.burst(150); BG3D.boost(); }, 600); }
  else if (info.stars >= 1) setTimeout(SFX.win, 500);
  else SFX.thud();
}

/* ---------- Code highlighting for Code Tracer ---------- */
function highlight(code, lang) {
  const KW = new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'in', 'while', 'and', 'or', 'not', 'let', 'const', 'function', 'of', 'True', 'False', 'true', 'false', 'None', 'null']);
  const FN = new Set(['print', 'len', 'range', 'console', 'log', 'Math', 'floor', 'push', 'append', 'sum', 'length', 'slice', 'filter', 'map', 'reduce', 'get']);
  const com = lang === 'py' ? '#[^\\n]*' : '\\/\\/[^\\n]*';
  const re = new RegExp(`(${com})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][A-Za-z0-9_]*)|([\\s\\S])`, 'g');
  let out = '', m;
  while ((m = re.exec(code))) {
    if (m[1]) out += `<span class="com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="num">${m[3]}</span>`;
    else if (m[4]) out += KW.has(m[4]) ? `<span class="kw">${m[4]}</span>` : FN.has(m[4]) ? `<span class="fn">${m[4]}</span>` : m[4];
    else out += esc(m[5]);
  }
  return out;
}

/* ---------- Shared quiz engine ----------
   gen(diff, rng, i) returns { kind, q (html), choices: [correct, ...wrong], explain?, code?, lang?, seq?, key?, fixed? } */
function makeQuestion(gen, diff, r, i, seen) {
  for (let t = 0; t < 40; t++) {
    const c = gen(diff, r, i);
    if (!c || !c.choices) continue;
    const key = c.key || stripTags(c.q) + '|' + (c.code || '') + '|' + (c.seq || '');
    if (seen.has(key) && t < 30) continue;
    const uniq = [];
    c.choices.forEach(x => { const sx = String(x); if (!uniq.includes(sx)) uniq.push(sx); });
    if (uniq.length < 2) continue;
    const correct = c.answer != null ? String(c.choices[c.answer]) : uniq[0];
    seen.add(key);
    const order = c.fixed ? uniq : r.shuffle(uniq);
    return Object.assign({}, c, { choices: order, ans: order.indexOf(correct) });
  }
  throw new Error('Question generator failed');
}
function runQuiz(ctx, cfg) {
  const r = ctx.r, rush = cfg.mode === 'rush', N = cfg.count || 10;
  const st = { i: 0, correct: 0, wrong: 0, streak: 0, maxStreak: 0, score: 0, review: [] };
  const seen = new Set();
  const prog = h('div', { class: 'q-prog', 'aria-hidden': 'true' });
  const tbar = h('div', { class: 'q-timer', 'aria-hidden': 'true' }, h('i'));
  const card = h('div', { class: 'q-card' });
  const choicesEl = h('div', { class: 'q-choices' });
  const fb = h('div', { class: 'q-feedback', 'aria-live': 'polite' });
  const rfb = h('div', { class: 'rush-fb', 'aria-live': 'polite' });
  const wrap = h('div', { class: 'quiz' + (rush ? ' rush' : '') });
  if (!rush) { for (let k = 0; k < N; k++) prog.append(h('span')); wrap.append(prog, tbar); }
  wrap.append(card, choicesEl, rush ? rfb : fb);
  ctx.body.append(wrap);
  ctx.hud('score', 'Score', '0');
  ctx.hud('combo', 'Combo', '×1');
  if (!rush) ctx.hud('q', 'Question', `1/${N}`);
  let q = null, locked = true, btns = [], qTimer = null, qLeft = 0, qTotal = 0;
  const mult = () => 1 + Math.min(Math.floor(st.streak / 3), 4) * 0.5;

  function show() {
    if (ctx.dead || ctx.done) return;
    if (!rush && st.i >= N) return end();
    try { q = makeQuestion(cfg.gen, ctx.diff, r, st.i, seen); }
    catch (e) { console.error(e); return end(); }
    card.innerHTML = '';
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    const kick = h('div', { class: 'q-kicker' }, q.kind || cfg.kind || ctx.g.name, q.langLabel ? h('span', { class: 'lang' }, q.langLabel) : null);
    card.append(kick, h('div', { class: 'q-text', html: q.q }));
    if (q.code) card.append(h('pre', { class: 'q-code', html: highlight(q.code, q.lang) }));
    if (q.seq) card.append(h('div', { class: 'q-seq' }, q.seq.map(v => h('span', null, v)), h('span', { class: 'q' }, '?')));
    choicesEl.innerHTML = '';
    choicesEl.classList.toggle('wide', !!q.wide || q.choices.some(c => stripTags(c).length > 24));
    btns = q.choices.map((c, k) => {
      const b = h('button', { class: 'choice' + (q.monoChoices ? ' mono-c' : ''), type: 'button', onclick: () => choose(k) }, h('span', { class: 'k' }, k + 1), h('span', { html: c }));
      choicesEl.append(b); return b;
    });
    fb.className = 'q-feedback'; fb.innerHTML = '';
    locked = false;
    if (!rush) {
      prog.children[st.i].classList.add('cur');
      ctx.hud('q', 'Question', `${st.i + 1}/${N}`);
      qTotal = qLeft = (cfg.perQ || 25) * 1000;
      const bar = tbar.firstChild; bar.style.width = '100%';
      let last = performance.now();
      if (qTimer) ctx.clear(qTimer);
      qTimer = ctx.interval(() => {
        const now = performance.now(), dt = now - last; last = now;
        if (locked) return;
        if (!ctx.paused) qLeft -= dt;
        bar.style.width = Math.max(0, qLeft / qTotal * 100) + '%';
        if (qLeft <= 0) choose(-1);
      }, 100);
    }
  }
  function choose(k) {
    if (locked || ctx.dead || ctx.done) return;
    locked = true;
    const ok = k === q.ans;
    btns.forEach((b, j) => { b.disabled = true; if (j === q.ans) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); else b.classList.add('dim'); });
    if (ok) {
      st.correct++; st.streak++; st.maxStreak = Math.max(st.maxStreak, st.streak);
      const pts = Math.round((100 + (rush ? 0 : Math.round(50 * Math.max(0, qLeft) / qTotal))) * mult());
      st.score += pts; SFX.good();
      card.append(h('span', { class: 'float-pts' }, '+' + pts));
      if (btns[k]) burstFrom(btns[k], cssVar('--good'), 22);
    } else {
      st.wrong++; st.streak = 0; SFX.bad(); buzz();
      if (st.review.length < 8) st.review.push({ q: q.reviewQ || q.q + (q.code ? `<pre class="q-code">${highlight(q.code, q.lang)}</pre>` : '') + (q.seq ? ' ' + q.seq.join(', ') + ', ?' : ''), a: q.choices[q.ans], why: q.explain || '' });
    }
    ctx.hud('score', 'Score', fmt(st.score));
    ctx.hud('combo', 'Combo', '×' + mult(), mult() > 1 ? 'hot' : '');
    if (!rush) {
      prog.children[st.i].classList.remove('cur'); prog.children[st.i].classList.add(ok ? 'ok' : 'no');
      fb.className = 'q-feedback show ' + (ok ? 'ok' : 'no');
      fb.innerHTML = '';
      const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { st.i++; show(); } }, st.i + 1 >= N ? 'See results' : 'Next question');
      fb.append(...[h('div', { class: 'fb-h' }, ok ? 'Correct' : k === -1 ? 'Time’s up' : 'Not quite'),
        !ok ? h('p', null, 'Answer: ', h('b', { html: q.choices[q.ans] })) : null,
        q.explain ? h('p', { html: q.explain }) : null,
        h('div', { class: 'row' }, nextBtn)].filter(Boolean));
      setTimeout(() => { if (!ctx.dead) nextBtn.focus({ preventScroll: true }); fb.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, 30);
    } else {
      rfb.innerHTML = ok ? '' : `Answer: <b>${q.choices[q.ans]}</b>${q.short ? ' · ' + q.short : ''}`;
      ctx.timeout(() => { st.i++; show(); }, ok ? 280 : 1100);
    }
  }
  function end() {
    if (ctx.done) return;
    const answered = st.correct + st.wrong;
    let stars;
    if (rush) { const net = st.correct - st.wrong, t = cfg.starsAt || [5, 10, 15]; stars = (net >= t[0]) + (net >= t[1]) + (net >= t[2]); }
    else { const a = st.correct / N; stars = a >= 0.9 ? 3 : a >= 0.7 ? 2 : a >= 0.4 ? 1 : 0; }
    ctx.finish({
      score: st.score, stars, correct: st.correct, answered, maxCombo: st.maxStreak,
      summary: [['Correct', `${st.correct}/${answered}`], ['Accuracy', answered ? pct(st.correct / answered) : '–'], ['Best streak', String(st.maxStreak)]].concat(rush ? [['Goal for 3★', `${(cfg.starsAt || [5, 10, 15])[2]} net`]] : []),
      review: st.review, lesson: cfg.lesson
    });
  }
  ctx.onKey(e => {
    if (/^[1-9]$/.test(e.key) && !locked) { const k = +e.key - 1; if (k < btns.length) { choose(k); return true; } }
    if (e.key === 'Enter' && locked && !rush && fb.classList.contains('show')) { const b = fb.querySelector('.btn'); if (b) b.click(); return true; }
    return false;
  });
  if (rush) ctx.countdown(cfg.time || 60, end);
  show();
}
