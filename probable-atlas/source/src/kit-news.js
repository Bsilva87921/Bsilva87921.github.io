/* Probable kit: the News section. Headlines come from the site's news file (refreshed by a scheduled job from
   public feeds: ESPN and other sports outlets for sports; official releases and major outlets for economics and
   markets) and, where a site offers it, a live refresh in the browser. Each story shows its source, time and
   summary; filters by topic and source, a search box, related headlines for any team, country or market, and
   "What it means" hands the headline to Ask AI.
   Tapping a story opens it in the reader on the page: the picture, the publisher's summary (official releases that
   may be reproduced, in full), related stories and Ask AI. The full article is one tap away: inside the app in the
   installed apps, on the publisher's site in a browser (publishers do not allow their pages inside other sites). */
const NEWS = (() => {
  let O = {}, items = [], byId = new Map(), asOf = null, sources = [], loaded = null, filt = 'all', srcF = '', query = '', shown = 24, liveAt = 0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const key = it => String(it.id || it.u);
  function ago(iso) {
    const t = +new Date(iso); if (!t) return '';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 24 * 60) return Math.round(m / 60) + ' h ago';
    if (m < 48 * 60) return 'Yesterday';
    return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function merge(list) {
    const seen = new Set(), out = [];
    for (const it of list) {
      if (!it || !it.t || !it.u) continue;
      const k = norm(it.t).replace(/[^a-z0-9]+/g, '').slice(0, 80);
      if (seen.has(it.u) || seen.has(k)) continue; seen.add(it.u); seen.add(k); out.push(it);
    }
    out.sort((a, b) => (+new Date(b.d) || 0) - (+new Date(a.d) || 0));
    byId = new Map(out.map(it => [key(it), it]));
    return out;
  }
  async function load() {
    if (loaded) return loaded;
    loaded = (async () => {
      let j = O.embed ? window[O.embed] : null;
      if (!j && O.url) {
        for (const u of [].concat(O.url)) { try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) { j = await r.json(); break; } } catch (e) { /* try the next */ } }
      }
      if (j) { items = merge((j.items || []).map(O.mapItem || (x => x))); asOf = j.asOf || null; sources = j.sources || []; }
      return items;
    })();
    return loaded;
  }
  async function refreshLive() {
    if (!O.live || Date.now() - liveAt < 5 * 60e3) return false;
    liveAt = Date.now();
    try { const fresh = await O.live(); if (fresh && fresh.length) { items = merge(fresh.concat(items)); asOf = new Date().toISOString(); return true; } } catch (e) { /* keep the file */ }
    return false;
  }
  const topics = () => O.topics ? O.topics() : [];
  function match(it) {
    if (filt !== 'all') { const T = topics().find(t => t.id === filt); if (T && !T.test(it)) return false; }
    if (srcF && it.s !== srcF) return false;
    if (query) { const q = norm(query); if (!norm(it.t + ' ' + (it.x || '') + ' ' + (it.s || '')).includes(q)) return false; }
    return true;
  }
  function img(it, cls) {
    const ini = esc((it.s || '?').trim().charAt(0).toUpperCase());
    return it.img ? `<span class="${cls} kx-n-ph" data-ini="${ini}"><img src="${esc(it.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"></span>` : `<span class="${cls} kx-n-ph" data-ini="${ini}" aria-hidden="true"></span>`;
  }
  function tags(it) { return (O.tagOf ? O.tagOf(it) : []).slice(0, 2).map(t => `<span class="kx-n-tag">${esc(t)}</span>`).join(''); }
  const nid = it => `data-nid="${esc(key(it))}"`;
  function cardHTML(it, k, lead) {
    // stories without a picture get a compact text card with an accent edge instead of an empty frame
    return `<article class="kx-n-card${lead ? ' lead' : ''}${it.img ? '' : ' noimg'}" data-n="${k}">
      ${it.img ? `<a class="kx-n-media" href="${esc(it.u)}" ${nid(it)} target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${img(it, 'kx-n-img')}</a>` : ''}
      <div class="kx-n-body"><div class="kx-n-meta"><span class="kx-n-src">${esc(it.s || host(it.u))}</span><span class="kx-n-dot" aria-hidden="true">·</span><time datetime="${esc(it.d || '')}">${esc(ago(it.d))}</time>${tags(it)}${it.body ? `<span class="kx-n-full">${it.full ? 'Full text' : 'Read here'}</span>` : ''}</div>
      <h3 class="kx-n-h"><a href="${esc(it.u)}" ${nid(it)} target="_blank" rel="noopener">${esc(it.t)}</a></h3>
      ${it.x && norm(it.x) !== norm(it.t) ? `<p class="kx-n-x">${esc(it.x)}</p>` : ''}
      <div class="kx-n-acts">${O.ask ? `<button type="button" class="kx-n-btn" data-nask="${k}">✦ What it means</button>` : ''}<button type="button" class="kx-n-btn kx-ico" data-nshare="${k}" aria-label="Share this story">${window.SHARE ? SHARE.ICON : '↗'}</button></div></div>
    </article>`;
  }
  let view = [], target = null;
  function paint() {
    if (!target) return;
    view = items.filter(match);
    const T = topics(), counts = {}; T.forEach(t => { counts[t.id] = items.filter(t.test).length; });
    const chips = `<button type="button" class="kx-chip${filt === 'all' ? ' on' : ''}" data-nf="all">All <span>${items.length}</span></button>` + T.filter(t => counts[t.id] || t.always).map(t => `<button type="button" class="kx-chip${filt === t.id ? ' on' : ''}" data-nf="${esc(t.id)}">${esc(t.label)} <span>${counts[t.id] || 0}</span></button>`).join('');
    const src = sources.filter(s => s.ok !== false && s.n).map(s => s.name).filter((v, k, a) => a.indexOf(v) === k);
    // a source picker once the stories come from three or more publishers
    const pubs = {}; items.forEach(it => { if (it.s) pubs[it.s] = (pubs[it.s] || 0) + 1; });
    const pubList = Object.entries(pubs).sort((a, b) => b[1] - a[1]);
    const picker = pubList.length >= 3 ? `<label class="kx-n-from"><span class="kx-sr">Show stories from</span><select data-nsrc><option value="">All sources</option>${pubList.map(([n, c]) => `<option value="${esc(n)}"${n === srcF ? ' selected' : ''}>${esc(n)} (${c})</option>`).join('')}</select></label>` : '';
    const lead = view.findIndex(it => it.img);
    const order = lead > 0 ? [view[lead], ...view.slice(0, lead), ...view.slice(lead + 1)] : view;
    view = order;
    target.innerHTML = `<div class="kx-n-head"><div><h2 class="kx-n-title">${esc(O.title || 'News')}</h2><p class="kx-n-sub">${esc(O.lede || '')}${asOf ? ` Updated ${esc(ago(asOf))}.` : ''}</p></div>
      <div class="kx-n-tools">${picker}<label class="kx-n-search"><span class="sr kx-sr">Search the news</span><input type="search" placeholder="Search headlines" value="${esc(query)}" data-nq></label></div></div>
      <div class="kx-chips" role="group" aria-label="Filter the news">${chips}</div>
      ${view.length ? `<div class="kx-n-grid" data-ngrid>${view.slice(0, shown).map((it, k) => cardHTML(it, k, k === 0 && !!it.img && !query && filt === 'all' && !srcF)).join('')}</div>${view.length > shown ? `<button type="button" class="kx-btn kx-n-more" data-nmore>Show more (${view.length - shown})</button>` : ''}` : `<p class="kx-n-empty">${items.length ? 'No headlines match. Try another filter, source or search.' : esc(O.empty || 'Headlines are on their way: the news job refreshes several times an hour.')}</p>`}
      <p class="kx-n-src-note">${src.length ? `Headlines and summaries from ${esc(src.slice(0, 10).join(', '))}${src.length > 10 ? ' and more' : ''}. ` : ''}Tap a story to read it here; the full article is one tap away.</p>`;
  }
  function bind(el) {
    el.addEventListener('click', ev => {
      const f = ev.target.closest('[data-nf]'); if (f) { filt = f.dataset.nf; shown = 24; paint(); if (window.HAPTIC) HAPTIC.tick(); return; }
      if (ev.target.closest('[data-nmore]')) { shown += 24; paint(); return; }
      const a = ev.target.closest('[data-nask]'); if (a) { const it = view[+a.dataset.nask]; if (it && O.ask) O.ask(O.askText ? O.askText(it) : `What does this news mean: "${it.t}"?`, it); return; }
      const s = ev.target.closest('[data-nshare]'); if (s) { const it = view[+s.dataset.nshare]; if (!it) return; if (window.SHARE) SHARE.link({ title: it.t, text: `${it.t} (${it.s})`, url: it.u }); return; }
      // anywhere else on a card opens it in the reader
      const card = ev.target.closest('.kx-n-card'); if (card && !ev.target.closest('a,button')) open(view[+card.dataset.n], view);
    });
    el.addEventListener('change', ev => { if (ev.target.matches('[data-nsrc]')) { srcF = ev.target.value; shown = 24; paint(); } });
    el.addEventListener('input', ev => { if (ev.target.matches('[data-nq]')) { query = ev.target.value; shown = 24; const pos = ev.target.selectionStart; paint(); const i2 = target.querySelector('[data-nq]'); if (i2) { i2.focus(); try { i2.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } } });
  }
  async function render(el) {
    target = el; if (!el._kxn) { bind(el); el._kxn = 1; }
    if (!items.length) el.innerHTML = `<div class="kx-n-head"><h2 class="kx-n-title">${esc(O.title || 'News')}</h2></div><div class="kx-n-grid">${'<div class="kx-n-skel"></div>'.repeat(6)}</div>`;
    await load(); paint();
    if (await refreshLive()) paint();
  }
  // a compact list for side panels and drawers: the newest stories matching a test
  function listHTML(test, n, opts) {
    const L = items.filter(test || (() => true)).slice(0, n || 5);
    if (!L.length) return opts && opts.empty ? `<p class="kx-n-empty sm">${esc(opts.empty)}</p>` : '';
    const pics = L.some(it => it.img);   // thumbnails only when the list has pictures, so the rows stay aligned
    return `<ul class="kx-n-list${pics ? '' : ' nopics'}" data-nlist>${L.map(it => `<li><a href="${esc(it.u)}" ${nid(it)} target="_blank" rel="noopener">${pics ? img(it, 'kx-n-thumb') : ''}<span><b>${esc(it.t)}</b><small>${esc(it.s || host(it.u))} · ${esc(ago(it.d))}</small></span></a></li>`).join('')}</ul>`;
  }

  /* ---------- the reader ---------- */
  let R = null, rList = [], rIdx = 0, rLast = null, rPushed = false;
  const STOP = new Set('the and for with from after over into this that have will says said what when your more than their they about could would been were just also into amid ahead against first last week weeks year years make makes made gets take takes back down here there where which while being still how why who its it’s it\'s new news live report reports update updates'.split(' '));
  const words = t => new Set(norm(t).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length > 3 && !STOP.has(w)));
  function related(it, n) {
    const W = words(it.t + ' ' + (it.x || '')), tm = new Set(it.tm || []), tp = new Set(it.tp || []);
    return items.filter(x => x !== it && x.u !== it.u).map(x => {
      let s = 0;
      if (it.lg && x.lg === it.lg) s += 1.5;
      for (const t of x.tm || []) if (tm.has(t)) s += 4;
      for (const t of x.tp || []) if (tp.has(t)) s += 0.5;
      for (const w of words(x.t)) if (W.has(w)) s += 2;
      return { x, s };
    }).filter(o => o.s >= 4).sort((a, b) => b.s - a.s || (+new Date(b.x.d) || 0) - (+new Date(a.x.d) || 0)).slice(0, n || 4).map(o => o.x);
  }
  const inApp = () => !!(window.KXP && window.KXP('Browser'));
  function readerHTML(it) {
    const pos = rList.length > 1 ? `${rIdx + 1} / ${rList.length}` : '';
    const app = inApp(), name = esc(it.s || host(it.u));
    const body = it.body && it.body.length ? it.body.map(p => `<p>${esc(p)}</p>`).join('') : '';
    const dek = it.x && norm(it.x) !== norm(it.t) && !(body && norm(it.body[0]).startsWith(norm(it.x).slice(0, 60))) ? `<p class="kx-r-dek">${esc(it.x)}</p>` : '';
    const note = body
      ? `${it.full ? 'Official release, in full.' : 'Official release: the opening paragraphs; the rest is in the original.'} Source: ${esc(it.credit || it.s)}.`
      : `This is the publisher's summary. ${app ? 'The full article opens right here in the app.' : 'The full article opens on the publisher’s site.'}${it.pw ? ` ${name} may ask you to subscribe.` : ''}`;
    const more = related(it, 4);
    return `<header class="kx-r-bar"><span class="kx-r-src"><span class="kx-r-ini" aria-hidden="true">${esc((it.s || '?').trim().charAt(0).toUpperCase())}</span><span><b>${name}</b><small><span class="kx-r-when">${esc(ago(it.d))}</span>${it.d ? `<span class="kx-r-at"> · ${esc(new Date(it.d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span>` : ''}</small></span></span>
        <span class="kx-r-nav">${rList.length > 1 ? `<button type="button" class="kx-r-b" data-rprev aria-label="Previous story"${rIdx ? '' : ' disabled'}>‹</button><span class="kx-r-pos">${pos}</span><button type="button" class="kx-r-b" data-rnext aria-label="Next story"${rIdx < rList.length - 1 ? '' : ' disabled'}>›</button>` : ''}</span>
        <button type="button" class="kx-r-b kx-r-x" data-rclose aria-label="Close the story">×</button></header>
      <div class="kx-r-in">
        ${it.img ? `<figure class="kx-r-fig"><img src="${esc(it.img)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><figcaption>Image: ${name}</figcaption></figure>` : ''}
        <div class="kx-r-tags">${tags(it)}${it.pw ? '<span class="kx-n-tag kx-r-pw">Subscription</span>' : ''}${body ? `<span class="kx-n-tag kx-r-off">${it.full ? 'Full text' : 'Opening paragraphs'}</span>` : ''}</div>
        <h2 class="kx-r-h" id="kxrH">${esc(it.t)}</h2>
        ${dek}
        ${body ? `<div class="kx-r-body">${body}</div>` : ''}
        <div class="kx-r-cta"><a class="kx-btn pri" href="${esc(it.u)}" target="_blank" rel="noopener" data-rout>${body ? (it.full ? 'View the original' : 'Continue reading') : app ? 'Read the full story' : `Read the full story on ${name}`} <span aria-hidden="true">${app ? '→' : '↗'}</span></a>${O.ask ? '<button type="button" class="kx-btn" data-rask>✦ What it means</button>' : ''}<button type="button" class="kx-btn kx-ico" data-rshare aria-label="Share this story">${window.SHARE ? SHARE.ICON : '↗'}</button></div>
        <p class="kx-r-note">${note}</p>
        ${more.length ? `<section class="kx-r-more"><h3>More on this</h3><ul class="kx-n-list${more.some(x => x.img) ? '' : ' nopics'}">${more.map(x => `<li><a href="${esc(x.u)}" data-rrel="${esc(key(x))}">${more.some(y => y.img) ? img(x, 'kx-n-thumb') : ''}<span><b>${esc(x.t)}</b><small>${esc(x.s || host(x.u))} · ${esc(ago(x.d))}</small></span></a></li>`).join('')}</ul></section>` : ''}
      </div>`;
  }
  function paintReader() {
    const it = rList[rIdx]; if (!R || !it) return;
    const panel = R.querySelector('.kx-r-panel'); panel.innerHTML = readerHTML(it); panel.scrollTop = 0;
    R.setAttribute('aria-label', it.t);
    const c = R.querySelector('.kx-r-x'); if (c) c.focus({ preventScroll: true });
  }
  function build() {
    R = document.createElement('div'); R.className = 'kx-reader'; R.hidden = true; R.setAttribute('role', 'dialog'); R.setAttribute('aria-modal', 'true');
    R.innerHTML = '<div class="kx-r-scrim" data-rclose></div><article class="kx-r-panel" aria-labelledby="kxrH"></article>';
    document.body.appendChild(R);
    R.addEventListener('click', ev => {
      const t = ev.target;
      if (t.closest('[data-rclose]')) { close(); return; }
      if (t.closest('[data-rprev]')) { step(-1); return; }
      if (t.closest('[data-rnext]')) { step(1); return; }
      const rel = t.closest('[data-rrel]'); if (rel && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) { ev.preventDefault(); const x = byId.get(rel.dataset.rrel); if (x) { rList = [x].concat(related(x, 8)); rIdx = 0; paintReader(); if (window.HAPTIC) HAPTIC.tick(); } return; }
      const it = rList[rIdx];
      if (t.closest('[data-rask]') && it && O.ask) { close(); setTimeout(() => O.ask(O.askText ? O.askText(it) : `What does this news mean: "${it.t}"?`, it), 80); return; }
      if (t.closest('[data-rshare]') && it && window.SHARE) { SHARE.link({ title: it.t, text: `${it.t} (${it.s})`, url: it.u }); return; }
    });
    document.addEventListener('keydown', ev => {   // the whole page while a story is open, wherever focus is
      if (!R || R.hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
      if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && !/^(input|textarea|select)$/i.test(ev.target.tagName)) { ev.preventDefault(); step(ev.key === 'ArrowRight' ? 1 : -1); return; }
      if (ev.key === 'Tab') {   // keep focus inside the story
        const f = [...R.querySelectorAll('.kx-r-panel button:not([disabled]), .kx-r-panel a[href]')]; if (!f.length) return;
        const a = f[0], b = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus(); } else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus(); }
      }
    });
    // swipe left or right on a phone for the next or previous story
    let x0 = null, y0 = 0;
    R.addEventListener('touchstart', ev => { const p = ev.touches[0]; x0 = p.clientX; y0 = p.clientY; }, { passive: true });
    R.addEventListener('touchend', ev => { if (x0 == null) return; const p = ev.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0; x0 = null; if (Math.abs(dx) > 70 && Math.abs(dy) < 45) step(dx < 0 ? 1 : -1); }, { passive: true });
    addEventListener('popstate', () => { if (R && !R.hidden) { rPushed = false; close(true); } });
  }
  function step(d) { const k = rIdx + d; if (k < 0 || k >= rList.length) return; rIdx = k; paintReader(); if (window.HAPTIC) HAPTIC.tick(); }
  function open(it, list) {
    if (typeof it === 'string') it = byId.get(it) || items.find(x => x.u === it);
    if (!it) return;
    if (!R) build();
    rList = (list && list.length ? list : [it].concat(related(it, 8))).filter(Boolean);
    rIdx = Math.max(0, rList.indexOf(it)); if (rList[rIdx] !== it) { rList.unshift(it); rIdx = 0; }
    if (R.hidden) {
      rLast = document.activeElement; R.hidden = false; document.documentElement.classList.add('kx-lock', 'kx-reading');
      // the phone's back button (and the browser's) closes the story instead of leaving the page
      try { history.pushState(Object.assign({}, history.state, { kxReader: 1 }), ''); rPushed = true; } catch (e) { rPushed = false; }
    }
    paintReader(); if (window.HAPTIC) HAPTIC.tap();
  }
  function close(fromHistory) {
    if (!R || R.hidden) return;
    R.hidden = true; document.documentElement.classList.remove('kx-lock', 'kx-reading');
    if (!fromHistory && rPushed) { rPushed = false; try { history.back(); } catch (e) { /* ignore */ } }
    if (rLast && rLast.focus) try { rLast.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  // any headline link the kit draws (cards, drawer lists, side panels) opens in the reader;
  // a middle-click or Ctrl/⌘-click still opens the publisher in a new tab
  let wired = false;
  function wire() {
    if (wired) return; wired = true;
    document.addEventListener('click', ev => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target.closest && ev.target.closest('a[data-nid]'); if (!a) return;
      const it = byId.get(a.dataset.nid); if (!it) return;
      ev.preventDefault();
      let list = null;
      if (a.closest('[data-ngrid]')) list = view;
      else { const ul = a.closest('[data-nlist]'); if (ul) list = [...ul.querySelectorAll('a[data-nid]')].map(x => byId.get(x.dataset.nid)).filter(Boolean); }
      open(it, list);
    }, true);
  }
  function init(o) { O = o || {}; wire(); return { load, render }; }
  return { init, load, render, listHTML, ago, open, close, related, get items() { return items; }, get asOf() { return asOf; }, refresh: refreshLive, repaint: paint };
})();

window.NEWS = NEWS;
