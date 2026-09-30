/* Probable Atlas kit: core utilities shared by every module (DOM, formatting, time, tooltip, drawer, state). */
const K = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = v => v != null && typeof v === 'number' && isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MINUS = '−';
  function num(v, d = 1) {
    if (!ok(v)) return '–';
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 && Number(s.replace(/,/g, '')) !== 0 ? MINUS : '') + s;
  }
  const pct = (v, d = 1) => ok(v) ? num(v, d) + '%' : '–';
  function sgn(v, d = 1, unit = '') {
    if (!ok(v)) return '–';
    const r = Number(v.toFixed(d));
    return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + unit;
  }
  function big(v, d = 1, pre = '') { // 1.23T / 456B / 7.8M
    if (!ok(v)) return '–';
    const a = Math.abs(v), s = v < 0 ? MINUS : '';
    if (a >= 1e12) return s + pre + (a / 1e12).toFixed(d) + 'T';
    if (a >= 1e9) return s + pre + (a / 1e9).toFixed(d) + 'B';
    if (a >= 1e6) return s + pre + (a / 1e6).toFixed(d) + 'M';
    if (a >= 1e4) return s + pre + (a / 1e3).toFixed(0) + 'K';
    return s + pre + a.toLocaleString('en-US', { maximumFractionDigits: d });
  }
  const money = (v, d = 0) => ok(v) ? (v < 0 ? MINUS : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–';
  function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  const cls = v => !ok(v) ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat';

  /* ---- time: monthly index t = y*12 + (m-1); quarterly q = y*4 + (q-1) ---- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIdx = s => { const y = +s.slice(0, 4), m = +s.slice(5, 7); return y * 12 + m - 1; };
  const mLab = t => MON[((t % 12) + 12) % 12] + ' ' + Math.floor(t / 12);
  const qIdx = s => /Q/.test(s) ? (+s.slice(0, 4)) * 4 + (+s.slice(5)) - 1 : (+s.slice(0, 4)) * 4 + Math.floor((+s.slice(5, 7) - 1) / 3);
  const qLab = q => 'Q' + (((q % 4) + 4) % 4 + 1) + ' ' + Math.floor(q / 4);
  const mYear = t => t / 12;           // fractional year for charts (Jan = y.0)
  const qYear = q => q / 4;
  const dLab = d => { const s = String(d); return MON[+s.slice(4, 6) - 1] + ' ' + (+s.slice(6, 8)) + ', ' + s.slice(0, 4); };
  const isoLab = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return MON[+m - 1] + ' ' + (+d) + ', ' + y; };
  function ago(iso) {
    const t = Date.parse(iso); if (!isFinite(t)) return '';
    const h = (Date.now() - t) / 36e5;
    if (h < 1) return 'under an hour ago';
    if (h < 36) return Math.round(h) + ' hours ago';
    return Math.round(h / 24) + ' days ago';
  }

  /* ---- seeded random ---- */
  function rng(seed = 7) {
    let a = seed >>> 0;
    const u = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let spare = null;
    u.norm = () => { if (spare != null) { const s = spare; spare = null; return s; } let x, y, r; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (!r || r >= 1); const f = Math.sqrt(-2 * Math.log(r) / r); spare = y * f; return x * f; };
    u.pick = arr => arr[Math.floor(u() * arr.length)];
    return u;
  }

  /* ---- tooltip ---- */
  const tip = {
    el: null,
    show(html, ev) {
      const el = this.el || (this.el = $('#tip'));
      el.innerHTML = html; el.hidden = false;
      this.move(ev);
    },
    move(ev) {
      const el = this.el; if (!el || el.hidden || !ev) return;
      const pt = ev.touches ? ev.touches[0] : ev;
      const w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight;
      let x = pt.clientX + 14, y = pt.clientY + 14;
      if (x + w > vw - 8) x = pt.clientX - w - 14;
      if (x < 8) x = 8;
      if (y + h > vh - 8) y = pt.clientY - h - 14;
      if (y < 8) y = 8;
      el.style.left = x + 'px'; el.style.top = y + 'px';
    },
    hide() { if (this.el) this.el.hidden = true; }
  };
  const tipRow = (color, name, val) => `<div class="row"><span>${color ? `<i style="background:${color}"></i>` : ''}${esc(name)}</span><span>${val}</span></div>`;

  /* ---- drawer ---- */
  let lastFocus = null;
  const drawer = {
    open(html) {
      const d = $('#drawer'), s = $('#scrim');
      lastFocus = document.activeElement;
      d.innerHTML = html; d.hidden = false; s.hidden = false; d.scrollTop = 0;
      document.body.style.overflow = 'hidden';
      const x = d.querySelector('.x'); if (x) x.focus();
    },
    close() {
      const d = $('#drawer'), s = $('#scrim');
      if (d.hidden) return;
      d.hidden = true; s.hidden = true; d.innerHTML = '';
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },
    get isOpen() { return !$('#drawer').hidden; }
  };

  /* ---- small state store with a remembered subset (try/catch: storage may be blocked) ---- */
  function store(key, defaults, keep) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
    const st = Object.assign({}, defaults);
    for (const k of keep) if (k in saved) st[k] = saved[k];
    st.save = () => { try { const o = {}; for (const k of keep) o[k] = st[k]; localStorage.setItem(key, JSON.stringify(o)); } catch (e) { /* ignore */ } };
    return st;
  }

  const uid = (() => { let n = 0; return p => (p || 'k') + (++n); })();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  return { $, $$, esc, ok, clamp, num, pct, sgn, big, money, ord, cls, MON, mIdx, mLab, qIdx, qLab, mYear, qYear, dLab, isoLab, ago, rng, tip, tipRow, drawer, store, uid, debounce, MINUS };
})();
