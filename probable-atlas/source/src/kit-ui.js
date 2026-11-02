/* Probable Atlas kit: shared view helpers and the light/dark theme switch (used by every module). */
const U = (() => {
  const { esc, ok, sgn } = K;
  const sec = (t, p, right = '', id = '') => `<div class="sec-h"${id ? ` id="${esc(id)}"` : ''}><div><h2>${esc(t)}</h2>${p ? `<p>${p}</p>` : ''}</div>${right}</div>`;
  const tile = o => `<div class="tile${o.hero ? ' hero' : ''}${o.cls ? ' ' + o.cls : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}${o.asset ? ` data-asset="${esc(o.asset)}" role="button" tabindex="0"` : ''}><span class="lab">${esc(o.lab)}</span><span class="val">${o.val}${o.unit ? `<small>${esc(o.unit)}</small>` : ''}</span>${o.sub ? `<span class="sub">${o.sub}</span>` : ''}${o.spark || ''}</div>`;
  const badge = (lvl, txt) => `<span class="badge st-${lvl}"><i></i>${esc(txt)}</span>`;
  const card = (title, note, body, ctl = '', cls = '') => `<section class="card${cls ? ' ' + cls : ''}"><div class="head"><div><h3>${esc(title)}</h3>${note ? `<div class="note">${note}</div>` : ''}</div>${ctl ? `<div class="ctl">${ctl}</div>` : ''}</div>${body}</section>`;
  const src = h => `<div class="src">${h}</div>`;
  const ICON = { crit: '!', serious: '!', warn: '~', good: '✓', info: 'i' };
  const LVL = { crit: 'Critical', serious: 'Serious', warn: 'Watch', good: 'Healthy', info: 'Note' };
  const alerts = list => list.length ? `<ul class="alerts">${list.map(a => `<li><span class="ico st-${a.lvl}" aria-hidden="true">${ICON[a.lvl]}</span><div><b>${esc(a.title)}</b> <span class="badge st-${a.lvl}"><i></i>${LVL[a.lvl]}</span><div class="why">${esc(a.why)}</div></div></li>`).join('')}</ul>` : `<div class="empty">No alerts right now.</div>`;
  const upDown = (v, d = 1, unit = '%') => `<span class="delta ${K.cls(v)}">${ok(v) ? sgn(v, d, unit) : '–'}</span>`;
  const seg = (name, opts, cur, aria) => `<div class="seg sm" role="group"${aria ? ` aria-label="${esc(aria)}"` : ''}>${opts.map(([v, l]) => `<button type="button" data-${name}="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
  const sel = (name, opts, cur, aria) => `<label class="picker"><span class="sr">${esc(aria)}</span><select class="sel" data-${name} aria-label="${esc(aria)}">${opts.map(o => o.group ? `<optgroup label="${esc(o.group)}">${o.items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</optgroup>` : `<option value="${esc(o[0])}" ${String(o[0]) === String(cur) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  const skill = (lvl, txt) => `<span class="skill sk-${lvl}" title="${esc(txt || '')}"><i></i>${esc({ high: 'Strong track record', mid: 'Useful track record', low: 'Modest track record', none: 'No proven skill' }[lvl])}</span>`;

  /* ---- theme: light/dark switch, remembered on this device; follows the system until chosen ---- */
  const KEY = 'atlas-theme';
  function current() { const t = document.documentElement.dataset.theme; if (t === 'light' || t === 'dark') return t; return matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function paint() { const b = document.getElementById('themeBtn'); if (!b) return; const t = current(); b.textContent = t === 'dark' ? '☀︎ Light mode' : '☾ Dark mode'; b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
  function theme() {
    try { const t = localStorage.getItem(KEY); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
    paint();
    document.addEventListener('click', ev => {
      if (!ev.target.closest('#themeBtn')) return;
      const next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
      paint(); document.dispatchEvent(new CustomEvent('atlas:theme', { detail: next }));
    });
    if (matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); const f = () => paint(); mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener && mq.addListener(f); }
  }
  const THEME_BOOT = `<script>try{var t=localStorage.getItem('atlas-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>`;
  return { sec, tile, badge, card, src, alerts, upDown, seg, sel, skill, theme, current, THEME_BOOT };
})();
