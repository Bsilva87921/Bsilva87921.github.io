/* Probable kit: share cards. Turns a game, a chart or an insight into a polished 1080×1080 image (drawn on a
   canvas with the site's fonts and colors) and hands it to the phone's share sheet, the app's share sheet, or a
   preview with download and copy buttons. */
const SHARE = (() => {
  const B = { name: 'Probable', url: location.origin + location.pathname, accent: '#FFB547', bg: ['#0b1220', '#16284a'], ink: '#eef3fb', muted: '#9fb0c8', up: '#36d399', down: '#ff7b72', fd: 'system-ui', fb: 'system-ui', fm: 'ui-monospace' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function brand(o) { Object.assign(B, o || {}); }
  function wrap(ctx, text, max, lines) {
    const words = String(text || '').split(/\s+/), out = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    if (out.length > lines) { const keep = out.slice(0, lines); let l = keep[lines - 1]; while (l && ctx.measureText(l + '…').width > max) l = l.slice(0, -1); keep[lines - 1] = l.replace(/[ ,;:.]+$/, '') + '…'; return keep; }
    return out;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function fonts() { try { if (document.fonts) { await Promise.race([Promise.all([`800 120px ${B.fd}`, `600 40px ${B.fb}`, `600 28px ${B.fm}`].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1200))]); } } catch (e) { /* use fallbacks */ } }
  // an inline SVG chart → image, with its computed styles copied in so it renders the same outside the page
  function svgImage(svg) {
    return new Promise((res, rej) => {
      const clone = svg.cloneNode(true), src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      const P = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'display', 'visibility'];
      src.forEach((n, i) => { const cs = getComputedStyle(n), d = dst[i]; if (!d) return; d.setAttribute('style', P.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')); });
      const r = svg.getBoundingClientRect(); clone.setAttribute('width', Math.round(r.width)); clone.setAttribute('height', Math.round(r.height));
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = e => { URL.revokeObjectURL(url); rej(e); }; img.src = url;
    });
  }
  function chart(ctx, c, x, y, w, h) {
    if (!c) return;
    if (c.type === 'spark' && c.data && c.data.length > 1) {
      const d = c.data.filter(v => v != null && isFinite(v)); if (d.length < 2) return;
      const lo = Math.min(...d), hi = Math.max(...d), sx = w / (d.length - 1), sy = v => y + h - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * h;
      const col = c.color || B.accent;
      ctx.beginPath(); d.forEach((v, i) => i ? ctx.lineTo(x + i * sx, sy(v)) : ctx.moveTo(x, sy(v)));
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
      ctx.save(); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.beginPath(); d.forEach((v, i) => i ? ctx.lineTo(x + i * sx, sy(v)) : ctx.moveTo(x, sy(v)));
      ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + w, sy(d[d.length - 1]), 13, 0, 7); ctx.fillStyle = col; ctx.fill();
      if (c.label) { ctx.font = `600 26px ${B.fm}`; ctx.fillStyle = B.muted; ctx.textAlign = 'left'; ctx.fillText(c.label, x, y - 18); }
    } else if (c.type === 'split') {
      const parts = [c.a, c.d, c.h].filter(p => p && p.p > 0.001), tot = parts.reduce((s, p) => s + p.p, 0) || 1;
      ctx.save(); rr(ctx, x, y + h / 2 - 34, w, 68, 34); ctx.clip(); let xx = x;
      parts.forEach(p => { const ww = w * p.p / tot; ctx.fillStyle = p.color || '#8b98ad'; ctx.fillRect(xx, y, ww, h); xx += ww; }); ctx.restore();
      ctx.font = `800 40px ${B.fb}`; ctx.fillStyle = B.ink; ctx.textAlign = 'left'; ctx.fillText(`${c.a.label} ${Math.round(c.a.p * 100)}%`, x, y + h / 2 + 90);
      ctx.textAlign = 'right'; ctx.fillText(`${Math.round(c.h.p * 100)}% ${c.h.label}`, x + w, y + h / 2 + 90);
      if (c.d && c.d.p > 0.001) { ctx.textAlign = 'center'; ctx.font = `600 32px ${B.fb}`; ctx.fillStyle = B.muted; ctx.fillText(`Draw ${Math.round(c.d.p * 100)}%`, x + w / 2, y + h / 2 + 90); }
    } else if (c.type === 'bars' && c.data && c.data.length) {
      const n = c.data.length, mx = Math.max(...c.data.map(b => Math.abs(b.v))) || 1, bw = w / n * 0.62, mid = y + h / 2;
      c.data.forEach((b, i) => { const bh = Math.abs(b.v) / mx * (h / 2 - 30), bx = x + (i + 0.19) * w / n; ctx.fillStyle = b.v >= 0 ? B.up : B.down; rr(ctx, bx, b.v >= 0 ? mid - bh : mid, bw, Math.max(6, bh), 8); ctx.fill(); ctx.font = `600 22px ${B.fb}`; ctx.fillStyle = B.muted; ctx.textAlign = 'center'; ctx.fillText(b.label, bx + bw / 2, y + h + 4); });
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, mid - 1, w, 2);
    } else if (c.type === 'image' && c.img) {
      const k = Math.min(w / c.img.width, h / c.img.height), iw = c.img.width * k, ih = c.img.height * k;
      ctx.save(); rr(ctx, x - 16, y - 16, w + 32, h + 32, 26); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.restore();
      ctx.drawImage(c.img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
  }
  async function card(c) {
    await fonts();
    if (c.chart && c.chart.type === 'svg' && c.chart.el) { try { c.chart = { type: 'image', img: await svgImage(c.chart.el) }; } catch (e) { c.chart = null; } }
    const S = 1080, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, S * 0.4, S); g.addColorStop(0, B.bg[1]); g.addColorStop(1, B.bg[0]); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const rg = ctx.createRadialGradient(S * 0.86, S * 0.08, 10, S * 0.86, S * 0.08, S * 0.7); rg.addColorStop(0, B.accent + '40'); rg.addColorStop(1, B.accent + '00'); ctx.fillStyle = rg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(255,255,255,.035)'; for (let yy = 18; yy < S; yy += 26) for (let xx = 18; xx < S; xx += 26) ctx.fillRect(xx, yy, 2, 2);
    const X = 84, W = S - 2 * X; ctx.textBaseline = 'alphabetic';
    // brand row
    ctx.fillStyle = B.accent; ctx.beginPath(); ctx.arc(X + 9, 100, 9, 0, 7); ctx.fill();
    ctx.font = `700 28px ${B.fm}`; ctx.fillStyle = B.ink; ctx.textAlign = 'left'; ctx.fillText(String(B.name).toUpperCase(), X + 34, 110);
    ctx.textAlign = 'right'; ctx.fillStyle = B.muted; ctx.fillText(c.date || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }), S - X, 110);
    let y = 210;
    if (c.kicker) { ctx.textAlign = 'left'; ctx.font = `700 30px ${B.fm}`; ctx.fillStyle = B.accent; ctx.fillText(String(c.kicker).toUpperCase().slice(0, 48), X, y); y += 70; }
    ctx.textAlign = 'left'; ctx.font = `800 68px ${B.fd}`; ctx.fillStyle = B.ink;
    for (const l of wrap(ctx, c.title, W, c.value ? 3 : 5)) { ctx.fillText(l, X, y); y += 76; }
    if (c.value != null && c.value !== '') { y += 150; ctx.font = `900 196px ${B.fd}`; ctx.fillStyle = c.tone === 'up' ? B.up : c.tone === 'down' ? B.down : c.tone === 'warn' ? '#ffc145' : B.ink; ctx.fillText(String(c.value).slice(0, 12), X - 6, y); y += 24; }
    if (c.sub) { y += 52; ctx.font = `500 36px ${B.fb}`; ctx.fillStyle = B.muted; for (const l of wrap(ctx, c.sub, W, 3)) { ctx.fillText(l, X, y); y += 48; } }
    const cy = Math.max(y + 40, 720), ch = S - 150 - cy;
    if (c.chart && ch > 90) chart(ctx, c.chart, X, cy, W, ch);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(X, S - 110, W, 2);
    // footer: the link on the left, shrunk (then trimmed) so it never runs into the note on the right
    const foot = c.foot || 'Educational analytics';
    ctx.font = `600 27px ${B.fm}`; const room = S - 2 * X - ctx.measureText(foot).width - 40;
    let u = String(c.url || B.url).replace(/^https?:\/\//, '').replace(/\/$/, ''), fs = 27;
    while (fs > 19 && ctx.measureText(u).width > room) { fs -= 1; ctx.font = `600 ${fs}px ${B.fm}`; }
    if (ctx.measureText(u).width > room) { while (u.length > 8 && ctx.measureText(u + '…').width > room) u = u.slice(0, -1); u += '…'; }
    ctx.fillStyle = B.muted; ctx.textAlign = 'left'; ctx.fillText(u, X, S - 62);
    ctx.font = `600 27px ${B.fm}`; ctx.textAlign = 'right'; ctx.fillStyle = B.ink; ctx.fillText(foot, S - X, S - 62);
    return await new Promise(r => cv.toBlob(r, 'image/png'));
  }
  const toB64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  async function deliver(blob, o) {
    const name = (o.file || 'probable-card') + '.png', file = new File([blob], name, { type: 'image/png' });
    const P = n => (window.KXP ? window.KXP(n) : null), SH = P('Share'), FS = P('Filesystem');
    try {
      if (SH && FS) {
        const w = await FS.writeFile({ path: name, data: await toB64(blob), directory: 'CACHE' });
        await SH.share({ title: o.title, text: o.text, url: o.url, files: [w.uri] }); return 'shared';
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: o.title, text: o.text }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    preview(blob, o); return 'preview';
  }
  function preview(blob, o) {
    const url = URL.createObjectURL(blob), m = document.createElement('div'); m.className = 'kx-share'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Share card');
    m.innerHTML = `<div class="kx-share-in"><button type="button" class="kx-share-x" aria-label="Close">×</button><img src="${url}" alt="${esc(o.title || 'Share card')}"><div class="kx-share-acts"><a class="kx-btn pri" href="${url}" download="${esc((o.file || 'probable-card') + '.png')}">Download image</a><button type="button" class="kx-btn" data-copyimg>Copy image</button>${o.url ? '<button type="button" class="kx-btn" data-copylink>Copy link</button>' : ''}</div><p class="kx-share-note">On a phone, press and hold the image to save or share it.</p></div>`;
    document.body.appendChild(m); document.documentElement.classList.add('kx-lock');
    const close = () => { m.remove(); URL.revokeObjectURL(url); document.documentElement.classList.remove('kx-lock'); };
    m.addEventListener('click', async ev => {
      if (ev.target === m || ev.target.closest('.kx-share-x')) return close();
      if (ev.target.closest('[data-copyimg]')) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); ev.target.textContent = 'Copied'; } catch (e) { ev.target.textContent = 'Copy not allowed here'; } }
      if (ev.target.closest('[data-copylink]')) { try { await navigator.clipboard.writeText(o.url); ev.target.textContent = 'Link copied'; } catch (e) { ev.target.textContent = o.url; } }
    });
    m.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
    m.querySelector('.kx-share-x').focus();
  }
  async function share(c, o) {
    o = o || {};
    if (window.HAPTIC) HAPTIC.tap();
    const t = window.ALERT ? ALERT.toast({ title: 'Making your share card…', ms: 1800 }) : null;
    try { const blob = await card(c); if (t) t.remove(); return await deliver(blob, Object.assign({ title: c.title, text: c.text || c.title, url: c.url || B.url, file: o.file }, o)); }
    catch (e) { console.warn('share', e); if (window.ALERT) ALERT.toast({ title: 'Could not make the card', body: 'Try again in a moment.', tone: 'down' }); }
  }
  async function link(o) { try { const SH = window.KXP ? window.KXP('Share') : null; if (SH) { await SH.share({ title: o.title, text: o.text, url: o.url }); return; } } catch (e) { return; } try { if (navigator.share) { await navigator.share(o); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(o.url); if (window.ALERT) ALERT.toast({ title: 'Link copied', body: o.url }); } catch (e) { /* ignore */ } }
  const ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return { brand, card, share, link, deliver, ICON };
})();

window.SHARE = SHARE;
