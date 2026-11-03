/* Probable kit: search everything. ⌘K / Ctrl+K or "/" opens a palette over the page; results come from the
   site's own index (teams, games, countries, markets, sections, news, actions), ranked by how well the words
   match, with recent picks and suggestions when the box is empty and "Ask AI" as the last option. */
const SRCH = (() => {
  let O = {}, root = null, inp = null, ul = null, rows = [], sel = 0, last = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%&+.\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
  const RK = () => (O.key || 'probable') + '-search-recent';
  const recents = () => { try { return JSON.parse(localStorage.getItem(RK()) || '[]'); } catch (e) { return []; } };
  const remember = it => { try { const r = recents().filter(x => x !== it.id); r.unshift(it.id); localStorage.setItem(RK(), JSON.stringify(r.slice(0, 8))); } catch (e) { /* ignore */ } };

  function score(it, q, toks) {
    const t = it._t || (it._t = norm(it.title)), all = it._a || (it._a = norm([it.title, it.sub, it.kw].join(' ')));
    let s = 0;
    if (t === q) s = 100; else if (t.startsWith(q)) s = 82; else if ((' ' + t).includes(' ' + q)) s = 64;
    else if (toks.every(w => all.includes(w))) s = 40 + (toks.every(w => t.includes(w)) ? 12 : 0);
    else { // loose match: the letters in order, close together ("sp5" finds "S&P 500", but "gold" does not match "Chicago Fed financial conditions")
      const qq = q.replace(/ /g, ''); let i = 0, first = -1;
      for (const c of qq) { i = t.indexOf(c, i); if (i < 0) { s = 0; break; } if (first < 0) first = i; i++; s = 14; }
      if (s && i - first > qq.length * 2 + 2) s = 0;
    }
    return s ? s + (it.boost || 0) : 0;
  }
  function results(q) {
    const items = O.source ? O.source() : [];
    const nq = norm(q);
    if (!nq) {
      const byId = new Map(items.map(i => [i.id, i]));
      const rec = recents().map(id => byId.get(id)).filter(Boolean).map(i => Object.assign({}, i, { group: 'Recent' }));
      const sug = (O.suggest ? O.suggest() : []).filter(i => !rec.some(r => r.id === i.id)).map(i => Object.assign({}, i, { group: i.group || 'Suggested' }));
      return rec.concat(sug).slice(0, 14);
    }
    const toks = nq.split(' ');
    const hit = items.map(i => ({ i, s: score(i, nq, toks) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);
    const order = O.groups || [], gi = k => { const n = order.indexOf(k); return n < 0 ? 99 : n; };
    // keep the best match first, then group the rest by kind
    const top = hit.slice(0, 1).map(i => Object.assign({}, i, { group: 'Top result' }));
    const rest = hit.slice(1).sort((a, b) => gi(a.kind) - gi(b.kind)).slice(0, 24).map(i => Object.assign({}, i, { group: i.kind }));
    const out = top.concat(rest);
    if (O.ask) out.push({ id: 'ask:' + q, kind: 'Ask AI', group: 'Ask AI', icon: '✦', title: `Ask AI: “${q}”`, sub: 'Answers from this page’s data and models', go: () => O.ask(q) });
    return out;
  }
  function render() {
    const q = inp.value; rows = results(q); sel = Math.min(sel, Math.max(0, rows.length - 1));
    let g = null, h = '';
    rows.forEach((r, i) => {
      if (r.group !== g) { g = r.group; h += `<li class="kx-s-grp" role="presentation">${esc(g)}</li>`; }
      h += `<li id="kxs-${i}" class="kx-s-row${i === sel ? ' sel' : ''}" role="option" aria-selected="${i === sel}" data-i="${i}"><span class="kx-s-ico" aria-hidden="true">${r.iconHTML || esc(r.icon || '•')}</span><span class="kx-s-txt"><b>${esc(r.title)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>${r.badge ? `<span class="kx-s-badge${r.badgeTone ? ' ' + esc(r.badgeTone) : ''}">${esc(r.badge)}</span>` : ''}<span class="kx-s-kind">${esc(r.kind || '')}</span></li>`;
    });
    if (!rows.length) h = `<li class="kx-s-empty" role="presentation">No matches. Try a team, a market, a country or a section.</li>`;
    ul.innerHTML = h; inp.setAttribute('aria-activedescendant', rows.length ? 'kxs-' + sel : '');
    const s = ul.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  }
  function choose(i) { const r = rows[i]; if (!r) return; if (!String(r.id).startsWith('ask:')) remember(r); close(); if (window.HAPTIC) HAPTIC.tap(); setTimeout(() => r.go && r.go(), 30); }
  function build() {
    root = document.createElement('div'); root.className = 'kx-search'; root.hidden = true;
    root.innerHTML = `<div class="kx-s-scrim" data-close></div><div class="kx-s-box" role="dialog" aria-modal="true" aria-label="Search">
      <div class="kx-s-in"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="search" role="combobox" aria-expanded="true" aria-controls="kxsList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(O.placeholder || 'Search')}"><button type="button" class="kx-s-esc" data-close aria-label="Close search">Esc</button></div>
      <ul class="kx-s-list" id="kxsList" role="listbox" aria-label="Results"></ul>
      <div class="kx-s-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>${isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> anywhere</span></div></div>`;
    document.body.appendChild(root);
    inp = root.querySelector('input'); ul = root.querySelector('ul');
    inp.addEventListener('input', () => { sel = 0; render(); });
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); render(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); choose(sel); }
      else if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    });
    ul.addEventListener('mousemove', ev => { const r = ev.target.closest('.kx-s-row'); if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; ul.querySelectorAll('.kx-s-row').forEach(x => { const on = +x.dataset.i === sel; x.classList.toggle('sel', on); x.setAttribute('aria-selected', String(on)); }); } });
    ul.addEventListener('click', ev => { const r = ev.target.closest('.kx-s-row'); if (r) choose(+r.dataset.i); });
    root.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) close(); });
  }
  function openP(q) {
    if (!root) build();
    last = document.activeElement; root.hidden = false; document.documentElement.classList.add('kx-lock');
    inp.value = q || ''; sel = 0; render(); requestAnimationFrame(() => { inp.focus(); inp.select(); });
  }
  function close() { if (!root || root.hidden) return; root.hidden = true; document.documentElement.classList.remove('kx-lock'); if (last && last.focus) try { last.focus(); } catch (e) { /* ignore */ } }
  function mount(o) {
    O = o || {};
    document.addEventListener('keydown', ev => {
      const t = ev.target, typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
      if ((ev.key === 'k' || ev.key === 'K') && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); root && !root.hidden ? close() : openP(); }
      else if (ev.key === '/' && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); openP(); }
    });
    const host = typeof O.host === 'string' ? document.querySelector(O.host) : O.host;
    if (host) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kx-s-btn'; b.setAttribute('aria-label', 'Search (' + (isMac ? '⌘' : 'Ctrl') + ' K)');
      b.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span class="kx-s-lbl">Search</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd>`;
      b.addEventListener('click', () => openP());
      if (O.before && host.contains(O.before)) host.insertBefore(b, O.before); else if (O.prepend) host.prepend(b); else host.appendChild(b);
    }
    return { open: openP, close };
  }
  return { mount, open: q => openP(q), close, norm };
})();

window.SRCH = SRCH;
