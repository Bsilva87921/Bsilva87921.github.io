/* Probable kit: the News section. Headlines come from the site's news file (refreshed by a scheduled job from
   public feeds: league news from ESPN for sports; official releases and major outlets for economics and
   markets) and, where a site offers it, a live refresh in the browser. Each story shows its source, time and
   summary and links to the original; filters by topic, a search box, related headlines for any team, country
   or market, and "What it means" hands the headline to Ask AI. */
const NEWS = (() => {
  let O = {}, items = [], asOf = null, sources = [], loaded = null, filt = 'all', query = '', shown = 24, liveAt = 0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
    return out.sort((a, b) => (+new Date(b.d) || 0) - (+new Date(a.d) || 0));
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
    if (query) { const q = norm(query); if (!norm(it.t + ' ' + (it.x || '') + ' ' + (it.s || '')).includes(q)) return false; }
    return true;
  }
  function img(it, cls) {
    const ini = esc((it.s || '?').trim().charAt(0).toUpperCase());
    return it.img ? `<span class="${cls} kx-n-ph" data-ini="${ini}"><img src="${esc(it.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"></span>` : `<span class="${cls} kx-n-ph" data-ini="${ini}" aria-hidden="true"></span>`;
  }
  function tags(it) { return (O.tagOf ? O.tagOf(it) : []).slice(0, 2).map(t => `<span class="kx-n-tag">${esc(t)}</span>`).join(''); }
  function cardHTML(it, k, lead) {
    // stories without a picture get a compact text card with an accent edge instead of an empty frame
    return `<article class="kx-n-card${lead ? ' lead' : ''}${it.img ? '' : ' noimg'}" data-n="${k}">
      ${it.img ? `<a class="kx-n-media" href="${esc(it.u)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${img(it, 'kx-n-img')}</a>` : ''}
      <div class="kx-n-body"><div class="kx-n-meta"><span class="kx-n-src">${esc(it.s || host(it.u))}</span><span class="kx-n-dot" aria-hidden="true">·</span><time datetime="${esc(it.d || '')}">${esc(ago(it.d))}</time>${tags(it)}</div>
      <h3 class="kx-n-h"><a href="${esc(it.u)}" target="_blank" rel="noopener">${esc(it.t)}</a></h3>
      ${it.x ? `<p class="kx-n-x">${esc(it.x)}</p>` : ''}
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
    const lead = view.findIndex(it => it.img);
    const order = lead > 0 ? [view[lead], ...view.slice(0, lead), ...view.slice(lead + 1)] : view;
    view = order;
    target.innerHTML = `<div class="kx-n-head"><div><h2 class="kx-n-title">${esc(O.title || 'News')}</h2><p class="kx-n-sub">${esc(O.lede || '')}${asOf ? ` Updated ${esc(ago(asOf))}.` : ''}</p></div>
      <label class="kx-n-search"><span class="sr kx-sr">Search the news</span><input type="search" placeholder="Search headlines" value="${esc(query)}" data-nq></label></div>
      <div class="kx-chips" role="group" aria-label="Filter the news">${chips}</div>
      ${view.length ? `<div class="kx-n-grid">${view.slice(0, shown).map((it, k) => cardHTML(it, k, k === 0 && !!it.img && !query && filt === 'all')).join('')}</div>${view.length > shown ? `<button type="button" class="kx-btn kx-n-more" data-nmore>Show more (${view.length - shown})</button>` : ''}` : `<p class="kx-n-empty">${items.length ? 'No headlines match. Try another filter or search.' : esc(O.empty || 'Headlines are on their way: the news job refreshes several times an hour.')}</p>`}
      <p class="kx-n-src-note">${src.length ? `Headlines and summaries from ${esc(src.slice(0, 10).join(', '))}${src.length > 10 ? ' and more' : ''}. ` : ''}Each story links to its publisher.</p>`;
  }
  function bind(el) {
    el.addEventListener('click', ev => {
      const f = ev.target.closest('[data-nf]'); if (f) { filt = f.dataset.nf; shown = 24; paint(); if (window.HAPTIC) HAPTIC.tick(); return; }
      if (ev.target.closest('[data-nmore]')) { shown += 24; paint(); return; }
      const a = ev.target.closest('[data-nask]'); if (a) { const it = view[+a.dataset.nask]; if (it && O.ask) O.ask(O.askText ? O.askText(it) : `What does this news mean: "${it.t}"?`, it); return; }
      const s = ev.target.closest('[data-nshare]'); if (s) { const it = view[+s.dataset.nshare]; if (!it) return; if (window.SHARE) SHARE.link({ title: it.t, text: `${it.t} (${it.s})`, url: it.u }); }
    });
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
    return `<ul class="kx-n-list${pics ? '' : ' nopics'}">${L.map(it => `<li><a href="${esc(it.u)}" target="_blank" rel="noopener">${pics ? img(it, 'kx-n-thumb') : ''}<span><b>${esc(it.t)}</b><small>${esc(it.s || host(it.u))} · ${esc(ago(it.d))}</small></span></a></li>`).join('')}</ul>`;
  }
  function init(o) { O = o || {}; return { load, render }; }
  return { init, load, render, listHTML, ago, get items() { return items; }, get asOf() { return asOf; }, refresh: refreshLive, repaint: paint };
})();

window.NEWS = NEWS;
