/* Probable kit: the "Ask AI" chat shared by the Probable sites. A built-in analyst answers from the page's own data and
   models; when Claude is available (the Claude-hosted copy, a site proxy, or the visitor's own API key) it gets the same
   data and models as tools. A site plugs in with CH.init(adapter, state). */
const CH = (() => {
  const esc = (typeof K !== 'undefined' && K.esc) || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const mountCharts = el => { if (A && A.mount) A.mount(el); else if (typeof C !== 'undefined' && C.mount) { C.mount(el); if (C.gc) C.gc(); } };
  let A = null, ST = null, built = false, opened = false, busy = false, ctl = null;
  let engine = 'analyst', sample = null, sampleTools = false, sampleChecked = false;
  const turns = []; // LLM conversation (role/content strings)
  const cfg = window.ATLAS_AI || {};
  let SNAP = !!(window.ATLAS_FIN_DATA || window.ATLAS_DATA);
  const KEYS = { key: 'atlas-ai-key', model: 'atlas-ai-model', engine: 'atlas-ai-engine' };
  const MODELS = [['claude-sonnet-5', 'Claude Sonnet 5'], ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (fastest)'], ['claude-opus-5-5', 'Claude Opus 5.5 (most capable)']];
  const store = { get(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }, set(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) { /* blocked */ } }, del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* blocked */ } } };
  const apiKey = () => store.get(KEYS.key, true) || store.get(KEYS.key);
  const ENG = { analyst: 'Built-in analyst', claude: 'Claude · your Claude account', endpoint: 'Claude · site service', key: 'Claude · your API key' };

  /* ---------------- tiny safe markdown ---------------- */
  function md(src) {
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const lines = String(src || '').replace(/\r/g, '').split('\n'); let out = '', list = null, para = [], table = [];
    const flushP = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushL = () => { if (list) { out += `<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.t}>`; list = null; } };
    const flushT = () => { if (table.length) { const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())); out += `<table>${rows.map((r, k) => `<tr>${r.map(c => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('')}</tr>`).join('')}</table>`; table = []; } };
    for (const ln of lines) {
      if (/^\s*\|.*\|\s*$/.test(ln)) { flushP(); flushL(); table.push(ln); continue; } else flushT();
      const h = ln.match(/^\s*#{1,4}\s+(.*)$/); if (h) { flushP(); flushL(); out += `<h4>${inline(h[1])}</h4>`; continue; }
      const ul = ln.match(/^\s*[-*•]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) { flushP(); const t = ul ? 'ul' : 'ol'; if (!list || list.t !== t) { flushL(); list = { t, items: [] }; } list.items.push((ul || ol)[1]); continue; }
      if (!ln.trim()) { flushP(); flushL(); continue; }
      if (list && /^\s{2,}/.test(ln)) { list.items[list.items.length - 1] += ' ' + ln.trim(); continue; }
      flushL(); para.push(ln.trim());
    }
    flushP(); flushL(); flushT();
    return out;
  }

  /* ---------------- UI ---------------- */
  function build() {
    if (built) return; built = true;
    const root = document.getElementById('chatRoot') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'chatRoot' }));
    const title = A.title || 'Ask AI';
    root.innerHTML = `<button type="button" class="askfab" id="askFab" aria-label="${esc(title)}: ask a question about this page"><b aria-hidden="true">✦</b>${esc(title)}</button>
      <aside class="chat" id="chat" hidden role="dialog" aria-modal="false" aria-labelledby="chatTitle">
        <div class="chd"><div><div class="eng" id="chatEng"></div><h2 id="chatTitle">${esc(title)}</h2></div><div class="acts"><button type="button" data-chat="settings" aria-label="Chat settings" title="Settings">⚙</button><button type="button" data-chat="new" aria-label="New conversation" title="New conversation">⟲</button><button type="button" data-chat="close" aria-label="Close chat">×</button></div></div>
        <div class="set" id="chatSet" hidden></div>
        <div class="msgs" id="chatMsgs" aria-live="polite"></div>
        <form id="chatForm"><textarea id="chatIn" rows="1" placeholder="${esc(A.placeholder || 'Ask about the data, models, forecasts or your own scenario…')}" aria-label="Your question"></textarea><button type="submit" id="chatSend">Ask</button></form>
        <div class="foot">${esc(A.footer || 'Answers come from this page\'s data and models. Educational, not investment advice.')}</div>
      </aside>`;
    document.getElementById('askFab').addEventListener('click', () => open(''));
    document.getElementById('chatForm').addEventListener('submit', ev => { ev.preventDefault(); if (busy) { if (ctl) ctl.abort(); return; } const t = document.getElementById('chatIn'); const q = t.value.trim(); if (q) { t.value = ''; grow(t); send(q); } });
    const ta = document.getElementById('chatIn');
    ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); document.getElementById('chatForm').requestSubmit(); } });
    ta.addEventListener('input', () => grow(ta));
    document.getElementById('chat').addEventListener('click', onClick);
    document.getElementById('chat').addEventListener('change', onChange);
    welcome(); paintEng();
  }
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; };
  function paintEng() { const e = document.getElementById('chatEng'); if (e) e.textContent = ENG[engine]; }
  function welcome() {
    const m = document.getElementById('chatMsgs'); if (!m) return;
    m.innerHTML = `<div class="welcome">${A.welcome()}<div class="sugg">${A.suggestions(ST).map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  }
  function open(q) {
    build(); opened = true;
    document.getElementById('chat').hidden = false; document.getElementById('askFab').hidden = true;
    checkSample();
    if (q) send(q); else setTimeout(() => document.getElementById('chatIn').focus(), 30);
  }
  function close() { if (!built) return; opened = false; document.getElementById('chat').hidden = true; document.getElementById('askFab').hidden = false; if (ctl) ctl.abort(); }
  const isOpen = () => opened;
  function settings() {
    const s = document.getElementById('chatSet'); if (!s.hidden) { s.hidden = true; return; }
    const opts = [['analyst', 'Built-in analyst: instant, free, answers from this page\'s data and models', true], ['claude', 'Claude, using your Claude account (in the Claude app)', !!sample], ['endpoint', 'Claude through this site\'s service', !!cfg.endpoint && !SNAP], ['key', 'Claude with your own Anthropic API key', !SNAP]];
    s.innerHTML = opts.filter(o => o[2]).map(([v, l]) => `<label><input type="radio" name="eng" value="${v}" ${engine === v ? 'checked' : ''} data-eng> <span>${esc(l)}</span></label>`).join('') +
      (!SNAP ? `<div id="keyBox" ${engine === 'key' ? '' : 'hidden'}><input type="password" id="apiKey" placeholder="sk-ant-…" value="${esc(apiKey() || '')}" autocomplete="off" aria-label="Anthropic API key"><div class="acts2"><select id="apiModel" aria-label="Model">${MODELS.map(([v, l]) => `<option value="${v}" ${(store.get(KEYS.model) || MODELS[0][0]) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div><label><input type="checkbox" id="keyKeep" ${store.get(KEYS.key) ? 'checked' : ''}> <span>Remember on this device (otherwise only for this tab)</span></label><div class="acts2"><button type="button" class="btn sm pri" data-chat="savekey">Use this key</button><button type="button" class="btn sm" data-chat="forget">Forget key</button></div><div class="note">Your key is sent only to api.anthropic.com from your browser and usage is billed to your account. Use a key with a spending limit.</div></div>` : '') +
      (sample ? '' : SNAP ? '<div class="note">Claude answers appear here when this page is opened in the Claude app and you allow it to use Claude.</div>' : '');
    s.hidden = false;
  }
  function onChange(ev) {
    if (ev.target.matches('[data-eng]')) { engine = ev.target.value; store.set(KEYS.engine, engine); paintEng(); const kb = document.getElementById('keyBox'); if (kb) kb.hidden = engine !== 'key'; if (engine === 'key' && !apiKey()) document.getElementById('apiKey').focus(); }
    if (ev.target.id === 'apiModel') store.set(KEYS.model, ev.target.value);
  }
  function onClick(ev) {
    const b = ev.target.closest('[data-chat]'), q = ev.target.closest('[data-q]:not([data-game])');
    if (q) { send(q.dataset.q); return; }
    if (!b) { const lnk = ev.target.closest('[data-goto],[data-asset],[data-anchor],[data-game],[data-tabgo]'); if (lnk && window.matchMedia('(max-width:900px)').matches) close(); return; }
    const a = b.dataset.chat;
    if (a === 'close') close();
    if (a === 'new') { turns.length = 0; welcome(); }
    if (a === 'settings') settings();
    if (a === 'savekey') { const v = document.getElementById('apiKey').value.trim(); if (!/^sk-ant-/.test(v)) { alertMsg('That does not look like an Anthropic API key (it should start with sk-ant-).'); return; } store.del(KEYS.key); store.set(KEYS.key, v, !document.getElementById('keyKeep').checked); engine = 'key'; store.set(KEYS.engine, 'key'); paintEng(); document.getElementById('chatSet').hidden = true; alertMsg('Key saved. Questions now go to Claude with this page\'s data and models as tools.'); }
    if (a === 'forget') { store.del(KEYS.key); if (engine === 'key') engine = 'analyst'; paintEng(); document.getElementById('chatSet').hidden = true; alertMsg('Key removed from this browser.'); }
  }
  function alertMsg(t) { bubble('bot', `<div class="meta">Note</div><p>${esc(t)}</p>`); }
  function bubble(role, html) {
    const m = document.getElementById('chatMsgs'), d = document.createElement('div'); d.className = 'msg ' + role; d.innerHTML = html; m.appendChild(d);
    d.scrollIntoView({ block: 'end', behavior: 'smooth' }); return d;
  }
  function scrollEnd() { const m = document.getElementById('chatMsgs'); m.scrollTop = m.scrollHeight; }
  function setBusy(v) { busy = v; const b = document.getElementById('chatSend'); b.textContent = v ? 'Stop' : 'Ask'; }

  /* ---------------- engines ---------------- */
  function checkSample() {
    if (sampleChecked || !window.claude || typeof window.claude.use !== 'function') return; sampleChecked = true;
    window.claude.use('sample').then(s => { if (!s) return; sample = s; s.limits().then(l => { sampleTools = !!(l && l.tools); }).catch(() => {}); if (engine === 'analyst' && store.get(KEYS.engine) !== 'analyst') { engine = 'claude'; paintEng(); } }).catch(() => {});
  }
  function initEngine() {
    const saved = store.get(KEYS.engine);
    if (saved === 'key' && apiKey() && !SNAP) engine = 'key';
    else if (cfg.endpoint && !SNAP && saved !== 'analyst') engine = 'endpoint';
    else engine = 'analyst';
  }
  const followHTML = list => list && list.length ? `<div class="sugg">${list.map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : '';
  function send(q) {
    if (!built) build();
    if (!opened) { opened = true; document.getElementById('chat').hidden = false; document.getElementById('askFab').hidden = true; }
    bubble('user', esc(q));
    if (engine === 'analyst') return analyst(q);
    return llm(q);
  }
  function analyst(q, note) {
    let res;
    try { res = A.answer(q, ST); } catch (e) { console.error(e); res = { html: `<p class="err">Sorry, that question tripped up the built-in analyst (${esc(e.message)}).</p>`, follow: A.suggestions(ST).slice(0, 3) }; }
    const d = bubble('bot', `<div class="meta">Built-in analyst${note ? ' · ' + esc(note) : ''}</div>${res.html}${followHTML(res.follow)}`);
    mountCharts(d); scrollEnd();
  }
  function toolList(attach) { // the adapter's tools plus a chart tool that draws into the current answer
    const tools = A.tools(ST).slice();
    if (A.chart) tools.push(A.chartTool || { name: 'show_chart', description: 'Draw a chart in the chat for the user. kind: "price" (a market over a range), "compare" (several markets rebased to 100), or a model chart name from list_charts. Returns a short confirmation.', inputSchema: { type: 'object', properties: { kind: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } }, range: { type: 'string', enum: ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'MAX'] } }, required: ['kind'] } });
    const ct = tools[tools.length - 1]; if (A.chart && !ct.execute) ct.execute = input => { const h = A.chart(input || {}); if (!h) throw new Error('Unknown chart. Use a kind or name from list_charts.'); attach(h); return 'Chart shown to the user.'; };
    return tools;
  }
  async function llm(q) {
    const d = bubble('bot', `<div class="meta">${esc(ENG[engine])}</div><div class="att"></div><div class="body"><span class="think"><i></i><i></i><i></i> Thinking…</span></div><div class="stat src"></div>`);
    const body = d.querySelector('.body'), att = d.querySelector('.att'), stat = d.querySelector('.stat');
    const attach = h => { const w = document.createElement('div'); w.innerHTML = h; att.appendChild(w); mountCharts(w); scrollEnd(); };
    const tools = toolList(attach), looked = [];
    const wrap = tools.map(t => Object.assign({}, t, { execute: async (inp, cx) => { looked.push(t.name.replace(/_/g, ' ')); stat.textContent = 'Looked up: ' + Array.from(new Set(looked)).join(', '); return t.execute(inp || {}, cx); } }));
    const system = A.system(ST);
    turns.push({ role: 'user', content: q });
    while (turns.length > 12) turns.shift();
    if (turns[0].role !== 'user') turns.shift();
    setBusy(true); ctl = new AbortController();
    let text = '';
    const show = t => { text = t; body.innerHTML = md(t); scrollEnd(); };
    try {
      if (engine === 'claude') {
        if (!sample) throw { code: 'not_available' };
        const input = [{ role: 'user', content: system }].concat(turns);
        const opts = { signal: ctl.signal, onText: ({ text: t }) => show(t), cache: false };
        if (sampleTools) opts.tools = wrap;
        const r = await sample(input, opts); show(r.text);
      } else {
        const send = engine === 'key' ? payload => fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(payload) })
          : payload => fetch(cfg.endpoint, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const model = engine === 'key' ? (store.get(KEYS.model) || MODELS[0][0]) : (cfg.model || undefined);
        show(await messagesLoop(send, model, system, turns, wrap, show));
      }
      turns.push({ role: 'assistant', content: text || '(no answer)' });
      d.insertAdjacentHTML('beforeend', followHTML(A.suggestions(ST).slice(0, 3)));
    } catch (e) {
      turns.pop();
      const code = e && e.code, msg = e && (e.message || e.code) || String(e);
      if (code === 'cancelled' || (e && e.name === 'AbortError')) { body.innerHTML = text ? md(text) + '<p class="muted">(stopped)</p>' : '<p class="muted">Stopped.</p>'; }
      else {
        d.remove();
        const why = code === 'not_granted' ? 'Claude was not allowed for this page' : code === 'rate_limited' ? 'Claude is busy or your usage limit was reached' : code === 'sampling_disabled' ? 'Claude is not available for this account' : /401|invalid x-api-key|authentication/i.test(msg) ? 'the API key was rejected' : 'Claude could not be reached (' + String(msg).slice(0, 80) + ')';
        if (code === 'not_granted' || code === 'sampling_disabled') { engine = 'analyst'; paintEng(); }
        analyst(q, 'used because ' + why);
      }
    } finally { setBusy(false); ctl = null; }
  }
  async function messagesLoop(send, model, system, hist, tools, show) {
    const msgs = hist.map(t => ({ role: t.role, content: t.content })); let text = '';
    const toolDefs = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    for (let round = 0; round < 6; round++) {
      const payload = { max_tokens: 1400, system, messages: msgs, tools: toolDefs }; if (model) payload.model = model;
      const r = await send(payload); let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
      if (!r.ok || !j || !j.content) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
      msgs.push({ role: 'assistant', content: j.content });
      const tx = j.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (tx) { text += (text ? '\n\n' : '') + tx; show(text); }
      if (j.stop_reason !== 'tool_use') break;
      const results = [];
      for (const u of j.content.filter(c => c.type === 'tool_use')) {
        const t = tools.find(x => x.name === u.name);
        try { const out = await t.execute(u.input || {}); results.push({ type: 'tool_result', tool_use_id: u.id, content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 30000) }); }
        catch (e) { results.push({ type: 'tool_result', tool_use_id: u.id, content: 'Error: ' + (e.message || e), is_error: true }); }
      }
      msgs.push({ role: 'user', content: results });
    }
    return text;
  }

  /* ---------------- shared language helpers for module analysts ---------------- */
  const NLU = {
    norm: s => ' ' + String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%$&+./\- ']/g, ' ').replace(/\s+/g, ' ').trim() + ' ',
    has: (q, words) => words.some(w => w instanceof RegExp ? w.test(q) : q.includes(w)),
    score: (q, words) => words.reduce((s, w) => s + ((w instanceof RegExp ? w.test(q) : q.includes(w)) ? 1 : 0), 0),
    money(q) { // $50k, 50,000, $1.2m, 1 million
      const out = []; const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|thousand|m|mm|million|b|billion)?\b/g; let m;
      while ((m = re.exec(q))) { const raw = m[1].replace(/,/g, ''); let v = parseFloat(raw); const u = m[2]; if (u === 'k' || u === 'thousand') v *= 1e3; else if (u === 'm' || u === 'mm' || u === 'million') v *= 1e6; else if (u === 'b' || u === 'billion') v *= 1e9; const hasDollar = q[m.index] === '$' || /\$\s?$/.test(q.slice(Math.max(0, m.index - 2), m.index + 1)); out.push({ v, i: m.index, len: m[0].length, dollar: hasDollar || !!u, txt: m[0] }); }
      return out;
    },
    pct(q) { const out = []; const re = /([+-]?\d+(?:\.\d+)?)\s?(%|percent|pct|bp|bps|basis points|points|pts|pp)/g; let m; while ((m = re.exec(q))) out.push({ v: parseFloat(m[1]) * (/bp|basis/.test(m[2]) ? 0.01 : 1), unit: m[2], i: m.index }); return out; },
    years(q) { const m = q.match(/(\d{1,2})\s?(?:more\s)?(?:years?|yrs?)\b/); return m ? +m[1] : null; },
    age(q) { const m = q.match(/\b(?:i'?m|i am|age|aged)\s(\d{2})\b/) || q.match(/\b(\d{2})\s?(?:years? old|yo)\b/); return m ? +m[1] : null; },
    retireAge(q) { const m = q.match(/retire (?:at|by)\s?(?:age\s)?(\d{2})/); return m ? +m[1] : null; }
  };

  function init(adapter, state) { A = adapter; ST = state; if (A.snapshot != null) SNAP = !!A.snapshot; initEngine(); build(); checkSample(); }
  function context(state) { ST = state; }
  return { init, open, close, isOpen, context, send, md, NLU };
})();
