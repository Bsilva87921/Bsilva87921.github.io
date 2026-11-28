/* ---------- ItsLit app ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('itslit:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('itslit:' + k, JSON.stringify(v)); } catch (e) {} }
};
const COPY = Object.assign({
  postGate: 'Open ItsLit while signed in to Claude to join the conversation. Reading is open to everyone.',
  noWrite: 'You can read the Salon. To post, ask the owner for Contributor access.',
  shelfLocal: 'Your shelf is saved in this browser. Open ItsLit signed in to Claude to keep it across devices.',
  shelfSynced: 'Your shelf is private and follows you to any device where you open ItsLit.',
  savedLocal: 'Saved in this browser. Sign in to Claude to join the real list.',
  shelleyOff: 'Shelley is not available in this view. Open ItsLit signed in to Claude to talk with her.',
  shelleyAskOff: 'I am not available in this view. Open ItsLit signed in to Claude and I will be glad to help.',
  deskOff: 'Open ItsLit signed in to Claude, as the owner or an Editor, to use it.',
  deskWho: 'It opens for the artifact’s owner and anyone the owner adds as an Editor.',
  publishOff: 'Publishing needs ItsLit open while signed in to Claude.',
  checkout: 'Checkout opens at launch. Joining the list here takes no payment; it only saves your place and the plan you chose.',
  quota: 'Free readers get 5 questions a day and Patrons get unlimited. You have asked {n} today; in this preview, keep asking.',
  subscribed: 'You are on the Gazette list. Check your inbox to confirm.',
  subsNote: 'Paste the list into your email service (beehiiv, Kit or similar) to send each letter. This prototype stores sign-ups; it does not send email.',
  shelleySignin: ''
}, window.ITSLIT_COPY || {});
const CFG = window.ITSLIT_CONFIG || {};
const signinBtn = () => (window.itslitAuth && !window.itslitAuth.user() ? ' <button class="btn small primary" type="button" data-signin>Sign in</button>' : '');
const S = {
  db: null, user: null, sample: null, tts: null, uid: null, me: null, canEdit: false, isOwner: false, canWrite: null, writeBlocked: false,
  posts: [], postsReady: false, dbLetters: [], lettersReady: false, hidden: [], shelf: LS.get('shelf', { want: [], reading: [], done: [] }),
  subscribed: !!LS.get('sub', null), waitlist: LS.get('wait', { plans: [], merch: [] }), subs: null, waits: null,
  chat: [], asking: null, askContext: null, spoilFree: true, newbie: false, slow: {}, err: {}, capsDone: false, editing: null, billing: 'year'
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = iso => { const [y, m, d] = String(iso).split('-').map(Number); return y ? `${MONTHS[m - 1]} ${d}, ${y}` : ''; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (!isFinite(s)) return '';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (s < 60) return 'just now';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 3200); }

/* ---------- icons, ornaments, cameo ---------- */
const IC = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', books: 'M4 4h4v16H4zM10 4h4v16h-4zM15.5 5.2l3.4-.9 3.6 15-3.4.9z',
  chat: 'M4 5h16v11H9l-5 4z', menu: 'M4 7h16M4 12h16M4 17h16', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', shelf: 'M3 20h18M5 20V6h3v14M10 20V4h3v16M15 20l2-13 3 .5-2 12.5',
  paper: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h5', bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 8v8', heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', speaker: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  copy: 'M8 8h11v12H8zM5 16V4h11', flag: 'M5 21V4h11l-2 4 2 4H5', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', reply: 'M10 8L4 13l6 5M4 13h10a6 6 0 0 1 6 6',
  left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', web: 'M3 5h18v14H3zM3 9h18'
};
const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[k]}"/></svg>`;
const ORN = '<svg class="orn" viewBox="0 0 150 16" aria-hidden="true"><path d="M2 8h52M96 8h52" stroke="currentColor" stroke-width="1"/><path d="M75 2l6 6-6 6-6-6z" fill="currentColor"/><path d="M58 8c4-5 8-5 11 0c-3 5-7 5-11 0zM92 8c-4-5-8-5-11 0c3 5 7 5 11 0z" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const FLAME = '<svg viewBox="0 0 22 30" aria-hidden="true"><path fill="currentColor" d="M11 1c3.5 5.5 8.5 8.5 8.5 15.5a8.5 8.5 0 0 1-17 0c0-4.2 2.2-6.8 4.3-9.6c.2 3.1 1.2 5.2 3.3 6.3C9 8 9.8 4.3 11 1z"/><path fill="#E8C877" d="M11 14c1.8 2.6 3.6 4.1 3.6 7a3.6 3.6 0 0 1-7.2 0c0-2.3 1.6-4.2 3.6-7z"/></svg>';
let cameoN = 0;
function cameo(cls = 'cameo') {
  const id = 'cm' + (++cameoN);
  return `<svg class="${cls}" viewBox="0 0 200 240" role="img" aria-label="Shelley, shown as a Regency cameo silhouette"><defs><clipPath id="${id}"><ellipse cx="100" cy="120" rx="86" ry="106"/></clipPath></defs><ellipse cx="100" cy="120" rx="97" ry="117" style="fill:#C9A45A"/><ellipse cx="100" cy="120" rx="91" ry="111" style="fill:#8E6A2C"/><ellipse cx="100" cy="120" rx="86" ry="106" style="fill:#4D6C91"/><g clip-path="url(#${id})" fill="#F7F3EA"><path d="M96 54C80 56 70 68 69 86C68 93 64 99 59 108C57 111 58 114 62 115L64 118C62 121 63 123 66 124C64 127 65 130 68 131C68 137 71 142 78 144C86 146 91 149 93 157C95 170 93 184 86 198C78 208 64 214 52 228L168 228C158 210 140 196 132 176C129 165 130 155 136 148C148 139 154 126 152 112C164 106 170 94 166 82C162 70 150 63 140 64C132 56 114 52 96 54Z"/><circle cx="153" cy="80" r="15"/><path d="M90 196c10 4 22 4 30 0" stroke="#4D6C91" stroke-width="2" fill="none"/></g><ellipse cx="100" cy="120" rx="80" ry="100" fill="none" stroke="#fff" stroke-opacity=".45" stroke-dasharray="1.5 5"/></svg>`;
}
const emb = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="${EMBLEMS[k]}"/></svg>`;
function book3d(b, opt = {}) {
  const inner = opt.open ? `<div class="b3d-inner"><p class="inner-line">${esc(b.line)}</p><div class="exlibris">Ex libris<span>ItsLit</span>${esc(b.t)}</div></div>` : '';
  return `<div class="b3d${opt.lift ? ' lift' : ''}" style="--c:${b.spine}" ${opt.open ? 'tabindex="0" role="button" aria-label="Open the book"' : ''}><div class="b3d-in"><div class="b3d-face b3d-back"></div><div class="b3d-face b3d-pages"></div><div class="b3d-face b3d-spine"></div><div class="b3d-face b3d-front"><div class="b3d-cover"><div class="cv">${emb(b.em)}<b>${esc(b.t)}</b><i>${esc(b.sur)}</i></div><div class="endp"></div></div>${inner}</div></div></div>`;
}
const bookCard = b => `<a class="book-card" href="#book-${b.id}">${book3d(b)}<div><h3>${esc(b.t)}</h3><p class="small">${esc(b.a)} · ${esc(b.yr)}</p></div><div class="meta-row"><span class="tag">About ${hoursOf(b)} h</span><span class="tag">${LEVELS[b.lvl]}</span></div></a>`;

/* ---------- markdown-lite (input is escaped first) ---------- */
function md(src) {
  const inline = t => t.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  let html = '', para = [], list = null;
  const fp = () => { if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>'; para = []; } };
  const fl = () => { if (list) { html += '<ul>' + list.map(li => '<li>' + inline(li) + '</li>').join('') + '</ul>'; list = null; } };
  for (const raw of esc(src).split('\n')) {
    const l = raw.trim();
    if (!l) { fp(); fl(); continue; }
    if (l.startsWith('## ')) { fp(); fl(); html += '<h3>' + inline(l.slice(3)) + '</h3>'; continue; }
    if (l.startsWith('&gt; ')) { fp(); fl(); html += '<blockquote>' + inline(l.slice(5)) + '</blockquote>'; continue; }
    if (/^[-*] /.test(l)) { fp(); (list = list || []).push(l.slice(2)); continue; }
    fl(); para.push(l);
  }
  fp(); fl();
  return html;
}
const plain = s => String(s).replace(/\[\[book:[a-z0-9-]+\]\]/g, '').replace(/[*#>]/g, '').replace(/\n{2,}/g, '\n\n').trim();

/* ---------- letters ---------- */
function allLetters() {
  const own = S.dbLetters.filter(l => l.title && l.body).map(l => ({ id: 'u' + l.id, docId: l.id, title: String(l.title), dek: String(l.dek || ''), body: String(l.body), book: BOOK[l.book] ? l.book : '', date: /^\d{4}-\d{2}-\d{2}$/.test(l.date) ? l.date : todayISO(), ts: +l.ts || 0, mine: true }));
  const built = LETTERS.filter(l => !S.hidden.includes(l.id)).map(l => ({ ...l, sample: true }));
  return [...own, ...built].sort((a, b) => (b.date + (b.ts || 0)).localeCompare(a.date + (a.ts || 0)) || (b.ts || 0) - (a.ts || 0));
}
const letterById = id => allLetters().find(l => l.id === id);

/* ---------- router ---------- */
const PAGES = {};
function parse() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('book-') && BOOK[h.slice(5)]) return { r: 'book', id: h.slice(5) };
  if (h.startsWith('letter-')) return { r: 'letter', id: h.slice(7) };
  return { r: ['home', 'library', 'salon', 'ask', 'match', 'shop', 'join', 'shelf', 'gazette', 'desk'].includes(h) ? h : 'home' };
}
const GZ = ['gazette', 'letter', 'desk'];
function render() {
  const R = parse(); S.route = R;
  document.body.dataset.route = R.r;
  document.body.classList.toggle('in-gazette', GZ.includes(R.r));
  const sec = R.r === 'book' ? 'library' : R.r === 'letter' || R.r === 'desk' ? 'gazette' : R.r;
  $$('[data-r]').forEach(a => a.dataset.r === sec ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('#view').innerHTML = PAGES[R.r](R);
  const titles = { home: 'ItsLit Reading Club', library: 'The Library · ItsLit', salon: 'The Salon · ItsLit', ask: 'Ask Shelley · ItsLit', match: 'The Matchmaker · ItsLit', shop: 'The Emporium · ItsLit', join: 'Membership · ItsLit', shelf: 'My shelf · ItsLit', gazette: 'The ItsLit Gazette', desk: 'Writing desk · The ItsLit Gazette' };
  document.title = R.r === 'book' ? `${BOOK[R.id].t} · ItsLit` : R.r === 'letter' ? `${(letterById(R.id) || {}).title || 'Letter'} · The ItsLit Gazette` : titles[R.r];
  Shelf3D.mount($('.shelf-slot'));
  mountRegions();
  updateThemeButtons();
  const sc = document.documentElement.classList.contains('preview') ? $('#shell') : null;
  if (S.scrollTo && $('#' + S.scrollTo)) { const t = $('#' + S.scrollTo); S.scrollTo = null; setTimeout(() => t.scrollIntoView({ block: 'start' }), 60); }
  else if (sc) sc.scrollTop = 0; else window.scrollTo(0, 0);
}
function mountRegions() {
  const R = S.route; if (!R) return;
  if (R.r === 'book') { renderThread(R.id); renderShelfSel(R.id); }
  if (R.r === 'salon') renderFeed();
  if (R.r === 'library') renderLibrary();
  if (R.r === 'ask') renderChat();
  if (R.r === 'home') renderHomeLetters();
  if (R.r === 'gazette') renderGazetteFront();
  if (R.r === 'letter') renderLetter(R.id);
  if (R.r === 'desk') renderDeskLists();
  if (R.r === 'shelf') renderShelfPage();
  if (R.r === 'shop' || R.r === 'join') renderWaitButtons();
  if (R.r === 'match') { const a = LS.get('match', {}); if (['mood', 'len', 'watch', 'set'].every(k => a[k])) renderMatch(); }
  $$('.sub-state').forEach(e => { e.textContent = S.subscribed ? 'You are on the Gazette list. Thank you!' : ''; });
  $$('[data-hear]').forEach(b => { b.hidden = !S.tts; });
}

/* ---------- pages ---------- */
const STAVES = [['Sat, Dec 19', 'Stave One: Marley’s ghost'], ['Sun, Dec 20', 'Stave Two: the first spirit'], ['Mon, Dec 21', 'Stave Three: the second spirit'], ['Tue, Dec 22', 'Stave Four: the last spirit'], ['Wed, Dec 23', 'Stave Five: the end of it']];
const stavesList = () => `<ul class="staves">${STAVES.map(([d, s]) => `<li><b>${d}</b><span>${s}</span></li>`).join('')}</ul>`;
const subForm = (src, light) => `<form class="sub-form foot-sub" data-src="${src}"><label class="vh" for="sub-${src}">Email address</label><input id="sub-${src}" type="email" placeholder="you@example.com" autocomplete="email" required><button class="btn ${light ? 'light' : 'primary'}" type="submit">Subscribe</button></form><p class="small sub-state" aria-live="polite"></p>`;

PAGES.home = () => {
  const feat = ['pride-and-prejudice', 'frankenstein', 'wuthering-heights', 'the-count-of-monte-cristo', 'the-great-gatsby', 'dracula', 'the-odyssey', 'the-metamorphosis', 'jane-eyre', 'crime-and-punishment'].map(id => BOOK[id]);
  const cc = BOOK['a-christmas-carol'];
  return `
<section class="wedg hero" aria-labelledby="h-hero">
  <p class="kicker">A candlelit reading club for the great works</p>
  <h1 id="h-hero">The classics, <em>finally lit.</em></h1>
  <p class="lede">Plain-English breakdowns, a Salon to talk it through, and Shelley, an AI librarian on call day and night. Pull a book from the shelf to begin.</p>
  <div class="hero-ctas"><a class="btn primary" href="#library">Enter the Library</a><a class="btn light" href="#ask">Ask Shelley</a><a class="btn light" href="#match">Find my next classic</a></div>
  <div class="alcove-wrap"><div class="alcove"><div class="shelf-slot"></div></div></div>
</section>
<section class="band"><div class="salon-feature">
  <a href="#book-${cc.id}" aria-label="${esc(cc.t)}">${book3d(cc, { lift: true })}</a>
  <div>
    <p class="kicker">The December Salon</p>
    <h2>A Christmas Carol, in five evenings</h2>
    <p style="margin-top:10px">One stave a night, about 25 minutes each. Read along, then meet the other readers in the Salon.</p>
    ${stavesList()}
    <div class="row"><a class="btn primary" href="#book-${cc.id}">Join the read-along</a><a class="btn" href="#letter-carol-salon">Read the Salon guide</a></div>
  </div>
</div></section>
<section class="band paper2"><div class="wrap">
  <div class="sec-head">${ORN}<h2>Breakdowns worth staying up for</h2><p>Every book gets a one-line hook, the story part by part, a sealed ending and a thread of readers to argue with.</p></div>
  <div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="icon-btn" type="button" data-scroll="-1" aria-label="Previous books">${icon('left')}</button><button class="icon-btn" type="button" data-scroll="1" aria-label="Next books">${icon('right')}</button></div>
  <div class="scroller" id="featScroll" tabindex="0" aria-label="Featured books">${feat.map(bookCard).join('')}</div>
</div></section>
<section class="band"><div class="wrap duo">
  <div class="card plate shelley-teaser">${cameo()}<div><p class="kicker">Meet Shelley</p><h2>Your AI librarian</h2><p style="margin-top:10px">Named for Mary Shelley, who began <i>Frankenstein</i> at eighteen. She explains, recommends and argues back, without spoiling the ending or writing your essay.</p><a class="btn primary" href="#ask">Ask Shelley a question</a></div></div>
  <div class="card plate" style="display:flex;flex-direction:column;justify-content:center"><p class="kicker">The Matchmaker</p><h2>Four questions. One perfect classic.</h2><p style="margin-top:10px">Tell us your mood, your time and your guilty-pleasure shows. We will make the introduction, as Emma Woodhouse would.</p><div><a class="btn" href="#match">${icon('spark')} Find my match</a></div></div>
</div></section>
<section class="band wedg"><div class="wrap">
  <div class="sec-head">${ORN}<h2>From The ItsLit Gazette</h2><p>Letters on the great works, every Sunday, from the editor's desk.</p></div>
  <div class="trio" id="homeLetters"></div>
  <div class="narrow" style="max-width:560px;margin-top:30px;text-align:center"><p>Get the Gazette by email.</p>${subForm('home', true)}</div>
</div></section>
<section class="band"><div class="wrap">
  <div class="sec-head">${ORN}<h2>The Emporium <span class="soon">Opening soon</span></h2><p>Totes, candles and pins for the well-read. A first look at what is coming.</p></div>
  <div class="merch">${MERCH.slice(0, 3).map(merchCard).join('')}</div>
  <p style="text-align:center;margin-top:22px"><a class="btn" href="#shop">${icon('bag')} Visit the Emporium</a></p>
</div></section>
<section class="band paper2"><div class="narrow" style="text-align:center">
  ${ORN}<h2>Become a Patron</h2>
  <p style="margin:12px auto 18px;max-width:560px">Unlimited Shelley, chapter-by-chapter guides, read-aloud synopses and members-only Salons, for $5.99 a month or $49 a year. Founding Patrons pay $39 for the first year, first 500 only.</p>
  <a class="btn primary" href="#join">${icon('ticket')} See membership</a>
</div></section>`;
};

PAGES.library = () => {
  const f = LS.get('lib', { mood: 'all', q: '', sort: 'year' });
  const moods = [['all', 'All'], ['romance', 'Romance'], ['gothic', 'Gothic'], ['adventure', 'Adventure'], ['mystery', 'Mystery'], ['ideas', 'Big ideas'], ['wit', 'Wit'], ['short', 'Short reads']];
  return `
<section class="wedg band" style="padding-bottom:30px"><div class="wrap">
  <div class="sec-head">${ORN}<h1>The Library</h1><p>Twenty great works, each with a plain-English breakdown. Pull one from the shelf, or browse the catalogue below.</p></div>
  <div class="alcove-wrap" style="max-width:900px"><div class="alcove lib"><div class="shelf-slot"></div></div></div>
</div></section>
<section class="band"><div class="wrap">
  <div class="row" style="margin-bottom:12px">
    <div class="chips" role="group" aria-label="Filter by mood">${moods.map(([k, n]) => `<button class="chip" type="button" data-mood="${k}" aria-pressed="${f.mood === k}">${n}</button>`).join('')}</div>
  </div>
  <div class="row" style="margin-bottom:22px">
    <label class="vh" for="libQ">Search the Library</label><input id="libQ" type="search" placeholder="Search by title or author" value="${esc(f.q)}" style="max-width:320px">
    <label class="vh" for="libSort">Sort</label><select id="libSort" style="max-width:220px"><option value="year">Oldest first</option><option value="title">Title, A to Z</option><option value="short">Shortest first</option></select>
    <span class="small" id="libCount" aria-live="polite"></span>
  </div>
  <div class="book-grid" id="libGrid"></div>
</div></section>`;
};
function renderLibrary() {
  const f = LS.get('lib', { mood: 'all', q: '', sort: 'year' });
  const sel = $('#libSort'); if (sel) sel.value = f.sort;
  const q = f.q.trim().toLowerCase();
  let list = BOOKS.filter(b => (f.mood === 'all' || (f.mood === 'short' ? b.pages <= 200 : b.mood.includes(f.mood))) && (!q || (b.t + ' ' + b.a).toLowerCase().includes(q)));
  list = list.sort(f.sort === 'title' ? (a, b) => a.t.localeCompare(b.t) : f.sort === 'short' ? (a, b) => a.pages - b.pages : (a, b) => a.y - b.y);
  $('#libGrid').innerHTML = list.length ? list.map(bookCard).join('') : '<p class="empty">No books match. Try another mood or search.</p>';
  $('#libCount').textContent = `${list.length} of ${BOOKS.length} books`;
}

PAGES.book = ({ id }) => {
  const b = BOOK[id];
  const facts = [`About ${hoursOf(b)} hours`, `${b.pages} pages`, `${LEVELS[b.lvl]} read`, ...b.mood.map(m => ({ ideas: 'Big ideas', 'coming-of-age': 'Coming of age' }[m] || m[0].toUpperCase() + m.slice(1)))];
  return `
<section class="band"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="#library">The Library</a> / ${esc(b.t)}</nav>
  <div class="book-hero">
    <div>${book3d(b, { open: true })}<span class="open-hint">Tap the book to open it</span></div>
    <div>
      <p class="kicker">${esc(b.era)} · ${esc(b.yr)}</p>
      <h1>${esc(b.t)}</h1>
      <p class="byline">by ${esc(b.a)}</p>
      <div class="facts">${facts.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <p class="logline">${esc(b.line)}</p>
      <div class="actions" style="margin-bottom:12px" id="shelfSel"></div>
      <div class="actions">
        <a class="btn primary" href="https://www.gutenberg.org/ebooks/${b.g}" target="_blank" rel="noopener">Read it free</a>
        <a class="btn" href="https://bookshop.org/search?keywords=${encodeURIComponent(b.t + ' ' + b.sur)}" target="_blank" rel="noopener">Buy a copy</a>
        <button class="btn" type="button" data-ask="${b.id}">Ask Shelley</button>
        <button class="btn ghost" type="button" data-hear="${b.id}" hidden>${icon('speaker')} Hear the synopsis</button>
      </div>
      <p class="small" style="margin-top:10px">Free text from Project Gutenberg; copies from Bookshop.org, which supports independent bookshops.</p>
    </div>
  </div>
</div></section>
<section class="band paper2"><div class="wrap two-col">
  <div>
    <h2>Why it still lands</h2>
    <p style="margin-top:12px">${esc(b.why)}</p>
    <h2 style="margin-top:34px">The story, part by part</h2>
    <p class="small" style="margin:8px 0 18px">Spoiler-light: the set-up and turns, never the ending.</p>
    <ol class="parts">${b.parts.map(p => `<li><h3>${esc(p.h)}</h3><p>${esc(p.s)}</p></li>`).join('')}</ol>
    <div class="seal-box" id="sealBox">
      <button class="seal" type="button" aria-label="Break the seal to reveal the ending"><span class="h l"></span><span class="h r"></span><span class="mono">IL</span></button>
      <p class="sealmsg"><b>The ending is sealed.</b> Break the seal once you have finished, or if you simply must know.</p>
      <div class="ending"><h3>How it ends</h3><p style="margin-top:8px">${esc(b.end)}</p></div>
    </div>
  </div>
  <aside>
    <h2>Who’s who</h2>
    <div class="cast" style="margin:14px 0 30px">${b.chars.map(([n, d]) => `<div><b>${esc(n)}</b><span>${esc(d)}</span></div>`).join('')}</div>
    <h2>Big themes</h2>
    <div class="chips" style="margin:14px 0 30px">${b.themes.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="card plate quote"><blockquote>“${esc(b.q)}”</blockquote><cite>${esc(b.qs)}</cite><button class="btn small ghost" type="button" data-copy="${esc(b.q)} (${esc(b.t)}, ${esc(b.a)})" style="margin-top:8px">${icon('copy')} Copy the line</button></div>
    <p class="note" style="margin-top:14px">Content note: ${esc(b.note)}</p>
    <h3 style="margin:26px 0 12px">Read it next</h3>
    <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${b.pair.map(p => bookCard(BOOK[p])).join('')}</div>
  </aside>
</div></section>
<section class="band" id="talk"><div class="narrow">
  <p class="kicker">The Salon</p>
  <h2>Talk about ${esc(b.t)}</h2>
  <p class="small" style="margin:8px 0 18px">Be kind, mark spoilers, and argue with ideas, not people.</p>
  <div class="thread" id="thread"></div>
</div></section>`;
};

PAGES.salon = () => `
<section class="wedg band"><div class="sec-head">${ORN}<h1>The Salon</h1><p>Where readers talk it through. Every book has its own thread; spoilers are marked and blurred until you tap them.</p></div></section>
<section class="band"><div class="wrap two-col">
  <div><h2>Recent conversation</h2><div id="feed" style="margin-top:12px"></div></div>
  <aside class="grid">
    <div class="card plate"><p class="kicker">December read-along</p><h3>A Christmas Carol</h3>${stavesList()}<a class="btn primary small" href="#book-a-christmas-carol">Go to the thread</a></div>
    <div class="card"><h3>Start a conversation</h3><p class="small" style="margin:6px 0 10px">Pick a book to open its thread.</p><label class="vh" for="salonPick">Book</label><select id="salonPick"><option value="">Choose a book</option>${BOOKS.map(b => `<option value="${b.id}">${esc(b.t)}</option>`).join('')}</select></div>
    <div class="card"><h3>House rules</h3><ul style="margin:8px 0 0;padding-left:20px;font-size:16px"><li>Tick “contains spoilers” when you discuss endings.</li><li>Disagree with the idea, never the person.</li><li>No homework swaps or copied essays.</li><li>Report anything unkind; the editor reviews every flag.</li><li>ItsLit is for readers aged 13 and up.</li></ul></div>
  </aside>
</div></section>`;

PAGES.ask = () => `
<section class="band"><div class="wrap ask">
  <aside class="ask-side">
    ${cameo()}
    <h1 style="font-size:40px">Ask Shelley</h1>
    <p style="margin-top:10px">I am Shelley, ItsLit’s librarian: an AI named for Mary Shelley, who began <i>Frankenstein</i> at eighteen. Ask me anything about the classics.</p>
    <div class="chips" style="justify-content:center;margin:12px 0">
      <button class="chip" type="button" id="optSpoil" aria-pressed="${S.spoilFree}">No spoilers</button>
      <button class="chip" type="button" id="optNew" aria-pressed="${S.newbie}">New to classics</button>
    </div>
    <p class="small">I help you understand books; I will not write your homework. I can make mistakes, so check anything important.</p>
  </aside>
  <div class="chat" aria-label="Conversation with Shelley">
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <p class="quota" id="quota" hidden></p>
    <form class="ask-form" id="askForm"><label class="vh" for="askInput">Your question</label><textarea id="askInput" rows="1" placeholder="Ask about any classic…" maxlength="800"></textarea><button class="btn primary" type="submit">Ask</button></form>
  </div>
</div></section>`;

PAGES.match = () => {
  const qs = [
    ['mood', '1. Choose a mood', [['romance', 'Swoon'], ['gothic', 'Shiver'], ['adventure', 'Thrill'], ['mystery', 'Puzzle'], ['ideas', 'Think'], ['wit', 'Laugh']]],
    ['len', '2. How much time do you have?', [['short', 'A weekend'], ['mid', 'A few weeks'], ['long', 'A whole season']]],
    ['watch', '3. What have you been watching?', [['romance', 'Period dramas'], ['mystery', 'Detective shows'], ['gothic', 'Horror films'], ['adventure', 'Epic adventures'], ['ideas', 'Deep-talk podcasts'], ['coming-of-age', 'Coming-of-age series']]],
    ['set', '4. Pick a setting', [['ballroom', 'A ballroom'], ['moor', 'A storm-lashed moor'], ['sea', 'The open sea'], ['city', 'A foggy city street'], ['castle', 'A castle on a cliff'], ['dream', 'Somewhere impossible']]]
  ];
  const a = LS.get('match', {});
  return `
<section class="wedg band"><div class="sec-head">${ORN}<h1>The Matchmaker</h1><p>Four questions, asked the way Emma Woodhouse would ask them. Then we make the introduction.</p></div></section>
<section class="band"><div class="calling" id="matchCard">
  ${qs.map(([k, t, opts]) => `<div class="q"><h3>${t}</h3><div class="chips" role="group" aria-label="${esc(t)}">${opts.map(([v, n]) => `<button class="chip" type="button" data-q="${k}" data-v="${v}" aria-pressed="${a[k] === v}">${n}</button>`).join('')}</div></div>`).join('')}
  <div class="row"><button class="btn primary" type="button" id="matchGo">${icon('spark')} Make the introduction</button><span class="small" id="matchMsg"></span></div>
  <div class="match-res" id="matchRes"></div>
</div></section>`;
};
function scoreMatch(a) {
  const len = b => b.pages <= 200 ? 'short' : b.pages <= 450 ? 'mid' : 'long';
  return BOOKS.map(b => {
    let s = 0; const why = [];
    if (b.mood.includes(a.mood)) { s += 3; why.push('your mood'); }
    if (len(b) === a.len) { s += 2; why.push('your time'); } else if (a.len === 'long' || (a.len === 'mid' && len(b) === 'short')) s += 1;
    if (b.mood.includes(a.watch)) { s += 2; why.push('what you watch'); }
    if (b.set.includes(a.set)) { s += 2; why.push('the setting'); }
    s += (4 - b.lvl) * .15;
    return { b, s, why };
  }).sort((x, y) => y.s - x.s).slice(0, 3).map(r => ({ ...r, pct: Math.round(Math.min(98, 58 + r.s / 9.45 * 40)) }));
}
function renderMatch() {
  const a = LS.get('match', {}); const box = $('#matchRes'); if (!box) return;
  const need = ['mood', 'len', 'watch', 'set'].filter(k => !a[k]);
  if (need.length) { $('#matchMsg').textContent = `Answer ${need.length} more question${need.length > 1 ? 's' : ''} first.`; return; }
  $('#matchMsg').textContent = '';
  box.innerHTML = `<h2 style="margin-top:18px">May we introduce…</h2>` + scoreMatch(a).map(({ b, why, pct }) => `<div class="match"><a href="#book-${b.id}" aria-label="${esc(b.t)}">${book3d(b)}</a><div><h3><a href="#book-${b.id}">${esc(b.t)}</a></h3><p class="small" style="margin:4px 0 6px">${esc(b.a)} · about ${hoursOf(b)} hours</p><p style="margin:0">${esc(b.line)}</p><p class="small" style="margin-top:6px">Matched on ${why.length ? esc(why.join(', ')) : 'a hunch'}.</p></div><span class="pct">${pct}%</span></div>`).join('') + `<div class="row"><button class="btn" type="button" data-copy-match>${icon('copy')} Copy my match</button><button class="btn ghost" type="button" data-ask-match>Ask Shelley why</button></div>`;
}

const ART = {
  tote: '<svg viewBox="0 0 200 150"><path d="M70 52c0-26 60-26 60 0" fill="none" stroke="#7A2236" stroke-width="6"/><path d="M48 50h104l-8 92H56z" fill="#F4EBD8" stroke="#C9A45A" stroke-width="2"/><path d="M100 70c5 7 11 11 11 20a11 11 0 0 1-22 0c0-6 4-10 7-15c0 4 2 6 4 7c-1-4 0-8 0-12z" fill="#7A2236"/><text x="100" y="128" text-anchor="middle" font-family="Bodoni Moda,serif" font-style="italic" font-weight="700" font-size="20" fill="#7A2236">It’s lit.</text></svg>',
  candle: '<svg viewBox="0 0 200 150"><rect x="62" y="44" width="76" height="96" rx="10" fill="#8A5A26" opacity=".9"/><rect x="62" y="44" width="76" height="14" rx="4" fill="#3a2414"/><rect x="72" y="76" width="56" height="42" fill="#F4EBD8" stroke="#C9A45A"/><text x="100" y="94" text-anchor="middle" font-family="Bodoni Moda,serif" font-size="10" fill="#201B1E">OLD</text><text x="100" y="108" text-anchor="middle" font-family="Bodoni Moda,serif" font-size="10" fill="#201B1E">LIBRARY</text><path d="M100 18c5 7 8 11 8 17a8 8 0 0 1-16 0c0-6 4-10 8-17z" fill="#F0B04E"/><path d="M100 40v6" stroke="#201B1E" stroke-width="2"/></svg>',
  pin: '<svg viewBox="0 0 200 150"><circle cx="100" cy="75" r="56" fill="#C9A45A"/><circle cx="100" cy="75" r="48" fill="#7A2236"/><path id="pa" d="M62 75a38 38 0 0 1 76 0" fill="none"/><text font-family="Bodoni Moda,serif" font-size="11.5" fill="#F4EBD8" letter-spacing="1"><textPath href="#pa" startOffset="50%" text-anchor="middle">READER, I MARRIED HIM</textPath></text><path d="M100 98s-14-9-14-19a7 7 0 0 1 14-3a7 7 0 0 1 14 3c0 10-14 19-14 19z" fill="#E6C77E"/></svg>',
  bookmark: '<svg viewBox="0 0 200 150"><g transform="rotate(-12 100 75)"><rect x="76" y="12" width="48" height="128" fill="#7A2236" stroke="#C9A45A" stroke-width="2"/><rect x="82" y="18" width="36" height="116" fill="none" stroke="#C9A45A"/><path d="M88 44h24M88 54h24M88 64h18M88 84h24M88 94h20" stroke="#E6C77E" stroke-width="2"/><path d="M100 12v-6" stroke="#C9A45A" stroke-width="2"/><circle cx="100" cy="5" r="4" fill="#C9A45A"/></g><g transform="rotate(8 140 80)"><rect x="128" y="22" width="34" height="110" fill="#1F4A3A" stroke="#C9A45A" stroke-width="2"/></g></svg>',
  hoodie: '<svg viewBox="0 0 200 150"><path d="M70 30c10-14 50-14 60 0l26 14 14 44-18 6-6-20v70H54V74l-6 20-18-6 14-44z" fill="#1F4A3A"/><path d="M80 30c6 16 34 16 40 0" fill="none" stroke="#163628" stroke-width="5"/><path d="M100 60c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 4-8c0 2 1 3 2 4c-1-2 0-5 0-7z" fill="#E6C77E"/><text x="100" y="98" text-anchor="middle" font-family="Bodoni Moda,serif" font-style="italic" font-size="11" fill="#E6C77E">Classically Lit</text></svg>',
  mug: '<svg viewBox="0 0 200 150"><path d="M136 58h12a16 16 0 0 1 0 32h-12" fill="none" stroke="#4D6C91" stroke-width="8"/><rect x="58" y="36" width="82" height="96" rx="8" fill="#4D6C91"/><path d="M66 60h66M66 70h60M66 80h66M66 90h48" stroke="#F4F7FB" stroke-width="2" opacity=".85"/><ellipse cx="99" cy="38" rx="41" ry="5" fill="#3C5878"/><path d="M84 22c4-4 4-8 0-12M100 22c4-4 4-8 0-12" stroke="#B9C6D8" stroke-width="2" fill="none"/></svg>'
};
const merchCard = m => `<div class="card"><div class="art">${ART[m.art]}</div><div class="body"><h3>${esc(m.n)}</h3><p style="margin:0;font-size:16px">${esc(m.d)}</p><div class="row" style="margin-top:auto"><span class="price">$${m.p}</span><span class="small">planned price</span><span class="spacer"></span><button class="btn small" type="button" data-notify="${m.id}">Notify me</button></div></div></div>`;
PAGES.shop = () => `
<section class="wedg band"><div class="sec-head">${ORN}<h1>The Emporium</h1><p>Goods for the well-read: totes, candles, pins and more. The shop opens after launch; ask to be told first.</p></div></section>
<section class="band"><div class="wrap">
  <p class="notice" style="margin-bottom:24px">This is a preview. Products, designs and prices are placeholders, and nothing is for sale yet. “Notify me” only records your interest.</p>
  <div class="merch">${MERCH.map(merchCard).join('')}</div>
</div></section>`;

PAGES.join = () => `
<section class="wedg band"><div class="sec-head">${ORN}<h1>Your ticket to the Library</h1><p>Like a Regency circulating library, ItsLit is free to browse and better with a subscription.</p>
  <div class="toggle" role="group" aria-label="Billing" style="margin-top:18px"><button type="button" data-bill="month" aria-pressed="${S.billing === 'month'}">Monthly</button><button type="button" data-bill="year" aria-pressed="${S.billing === 'year'}">Yearly</button></div></div></section>
<section class="band"><div class="wrap">
  <div class="tiers" id="tiers">${tiersHTML()}</div>
  <p class="notice" style="margin-top:26px">${esc(COPY.checkout)}</p>
  <div class="duo" style="margin-top:36px">
    <div><h3>Is ItsLit for teens?</h3><p style="margin-top:6px">Yes, for readers aged 13 and up. The Salon is moderated and Shelley keeps things age-appropriate.</p><h3 style="margin-top:20px">Will Shelley do my homework?</h3><p style="margin-top:6px">No. She will help you understand a book and find your own argument, but she will not write work for you to hand in.</p></div>
    <div><h3>Can I cancel any time?</h3><p style="margin-top:6px">Yes. Monthly plans stop at the end of the month; yearly plans run to the end of the year.</p><h3 style="margin-top:20px">What does Family & Classroom add?</h3><p style="margin-top:6px">Patron for up to five readers, plus a parent or teacher view of what everyone is reading. It arrives in 2028.</p></div>
  </div>
</div></section>`;
function tiersHTML() {
  const y = S.billing === 'year';
  const T = [
    { id: 'reader', n: 'Reader', a: '$0', s: 'free forever', f: ['All 20 breakdowns', 'The Salon threads', '5 Shelley questions a day', 'The Gazette every Sunday'], cta: 'Start reading', href: '#library' },
    { id: 'patron', n: 'Patron', a: y ? '$49' : '$5.99', s: y ? 'a year (2 months free)' : 'a month', f: ['Everything in Reader', 'Unlimited Shelley', 'Chapter-by-chapter guides', 'Read-aloud synopses', 'Members-only Salons', 'Printable guides'], cta: 'Join the list', star: 1 },
    { id: 'founding', n: 'Founding Patron', a: '$39', s: 'for your first year', f: ['Everything in Patron', 'A founder badge', 'Your name in the Subscription Ledger', 'First 500 readers only'], cta: 'Claim a founding place' },
    { id: 'family', n: 'Family & Classroom', a: y ? '$119' : '$11.99', s: (y ? 'a year' : 'a month') + ', up to 5 readers', f: ['Patron for every reader', 'Parent or teacher view', 'Class read-alongs', 'Arrives in 2028'], cta: 'Join the list' }
  ];
  const pay = CFG.stripe || {};
  const link = id => id === 'patron' ? (y ? pay.patronYearly : pay.patronMonthly) : id === 'family' ? (y ? pay.familyYearly : pay.familyMonthly) : id === 'founding' ? pay.founding : '';
  T.forEach(t => { const u = link(t.id); if (u && /^https:\/\//.test(u)) { t.href = u; t.cta = t.id === 'founding' ? 'Claim a founding place' : 'Join now'; t.ext = 1; } });
  return T.map(t => `<div class="card tier${t.star ? ' star plate' : ''}">${t.star ? '<span class="ribbon">Most readers choose</span>' : ''}<h3>${t.n}</h3><div class="amt">${t.a} <small>${t.s}</small></div><ul>${t.f.map(x => `<li>${x}</li>`).join('')}</ul>${t.href ? `<a class="btn${t.ext && t.star ? ' primary' : ''}" href="${esc(t.href)}"${t.ext ? ' target="_blank" rel="noopener"' : ''}>${t.cta}</a>` : `<button class="btn ${t.star ? 'primary' : ''}" type="button" data-plan="${t.id}">${t.cta}</button>`}</div>`).join('');
}
PAGES.shelf = () => `
<section class="wedg band"><div class="sec-head">${ORN}<h1>My shelf</h1><p>Books you want to read, are reading and have finished. Add them from any book page.</p></div></section>
<section class="band"><div class="wrap"><p class="small" id="shelfNote" style="margin-bottom:18px"></p><div class="shelves" id="shelfPage"></div></div></section>`;

/* ---------- Gazette ---------- */
function gzChrome(active, inner) {
  const d = new Date();
  const dl = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const vol = Math.max(1, d.getFullYear() - 2025);
  return `<div class="gz">
<header class="gz-mast">
  <div class="gz-top"><a href="#home">← Back to ItsLit</a><span>${dl}</span><button class="icon-btn theme-btn" type="button"></button></div>
  <p class="gz-title">The ItsLit Gazette</p>
  <div class="gz-rule"><span>Vol. ${vol === 1 ? 'I' : 'II'}</span><span>Letters on the great works, every Sunday</span><span>Free to all readers</span></div>
  <nav class="gz-nav" aria-label="Gazette"><a href="#gazette" ${active === 'front' ? 'aria-current="page"' : ''}>Front page</a><button class="btn ghost small" type="button" data-jump="gzAll">All letters</button><button class="btn ghost small" type="button" data-jump="gzSub">Subscribe</button><a href="#desk" ${active === 'desk' ? 'aria-current="page"' : ''}>Writing desk</a><a href="#library">The Library</a><a href="#salon">The Salon</a></nav>
</header>
<div class="gz-body">${inner}</div>
</div>`;
}
const classifieds = `<div class="gz-box classified"><h3>Notices &amp; classifieds</h3>
<p><b>WANTED.</b> Readers of good character and modest patience, to finish one classic before spring. Apply at the Library.</p>
<p><b>LOST.</b> One good opinion, formerly held by Mr Darcy. Last seen at a country assembly. Finder may keep it.</p>
<p><b>TO LET.</b> A seat by the fire in the Salon. Spoilers kindly marked.</p>
<p><b>SHORTLY.</b> The Emporium: totes, candles and pins for the well-read. <a href="#shop">Notice of opening</a> to follow.</p></div>`;
PAGES.gazette = () => gzChrome('front', '<div id="gzFront"></div>');
function excerpt(body) {
  const out = []; let len = 0;
  for (const blk of String(body).split(/\n\s*\n/)) {
    const t = blk.trim(); if (!t || /^(##|>|[-*] )/.test(t)) continue;
    out.push(t); len += t.length; if (len > 650 || out.length >= 4) break;
  }
  return { text: out.join('\n\n'), len };
}
function renderGazetteFront() {
  const box = $('#gzFront'); if (!box) return;
  const L = allLetters(); const lead = L[0];
  let leadHTML = '<p class="empty">The first letter is being written.</p>';
  if (lead) {
    const ex = excerpt(lead.body);
    leadHTML = `<article><p class="kicker">Latest letter · ${fmtDate(lead.date)}${lead.sample ? '<span class="sample-tag">Sample</span>' : ''}</p><h2><a href="#letter-${lead.id}" style="color:inherit;text-decoration:none">${esc(lead.title)}</a></h2><p class="gz-dek">${esc(lead.dek)}</p><div class="${ex.len > 480 ? 'cols ' : ''}dropcap">${md(ex.text)}</div><a class="btn" href="#letter-${lead.id}">Continue reading</a></article>`;
  }
  const also = L.slice(1, 5);
  box.innerHTML = `
<div class="gz-front"><div class="gz-lead">${leadHTML}
${also.length ? `<div class="gz-also">${also.map(l => `<a class="letter-card" href="#letter-${l.id}"><span class="date">${fmtDate(l.date)}${l.sample ? '<span class="sample-tag">Sample</span>' : ''}</span><h3>${esc(l.title)}</h3><p style="margin:0;font-size:16px">${esc(l.dek)}</p></a>`).join('')}</div>` : ''}
</div>
<div class="gz-side">
  <div class="gz-box"><h3>This month in the Salon</h3><p style="font-size:16px;margin:0 0 6px"><i>A Christmas Carol</i>, one stave a night.</p>${stavesList()}<a href="#book-a-christmas-carol">Join the read-along</a></div>
  <div class="gz-box" id="gzSub"><h3>Subscribe</h3><p style="font-size:16px;margin:0">One letter every Sunday. No spam, ever.</p>${subForm('gazette')}</div>
  ${classifieds}
</div></div>
<div style="padding-top:26px" id="gzAll"><h2 style="font-size:24px;margin-bottom:10px">All letters</h2>
<table class="list-table">${L.map(l => `<tr><td style="white-space:nowrap;color:var(--ink2)">${fmtDate(l.date)}</td><td><a href="#letter-${l.id}">${esc(l.title)}</a>${l.sample ? '<span class="sample-tag">Sample</span>' : ''}</td></tr>`).join('')}</table>
<p class="small" style="margin-top:12px">${L.some(l => l.sample) ? 'Letters marked “Sample” were written to show the format. The editor can hide or replace them from the Writing desk.' : ''}</p></div>
<div style="padding-top:30px"><h2 style="font-size:24px;margin-bottom:16px">From the Library</h2><div class="book-grid">${['a-christmas-carol', 'frankenstein', 'the-metamorphosis', 'pride-and-prejudice'].map(id => bookCard(BOOK[id])).join('')}</div></div>`;
  mountRegionsLite();
}
PAGES.letter = ({ id }) => gzChrome('letter', '<div id="gzLetter"></div>');
function renderLetter(id) {
  const box = $('#gzLetter'); if (!box) return;
  const L = allLetters(), i = L.findIndex(l => l.id === id), l = L[i];
  if (!l) { box.innerHTML = S.lettersReady || !S.db ? '<p class="empty">This letter could not be found. It may have been taken down.</p><p style="text-align:center"><a class="btn" href="#gazette">Back to the front page</a></p>' : '<p class="empty">Fetching the letter…</p>'; return; }
  const b = BOOK[l.book];
  const newer = L[i - 1], older = L[i + 1];
  box.innerHTML = `<article class="letter">
<p class="kicker">${fmtDate(l.date)} · From the editor’s desk${l.sample ? '<span class="sample-tag">Sample letter</span>' : ''}</p>
<h1>${esc(l.title)}</h1>
<p class="gz-dek">${esc(l.dek)}</p>
<div class="letter-body dropcap">${md(l.body)}</div>
<p class="sig">The Editor</p>
<div class="row" style="margin:22px 0"><button class="btn small" type="button" data-copy="${esc(l.title)} (The ItsLit Gazette)">${icon('copy')} Copy the headline</button><button class="btn small ghost" type="button" data-hear-letter="${esc(l.id)}" data-hear hidden>${icon('speaker')} Read it to me</button></div>
${b ? `<div class="card plate" style="display:grid;grid-template-columns:120px minmax(0,1fr);gap:18px;align-items:center;margin:26px 0"><a href="#book-${b.id}" aria-label="${esc(b.t)}">${book3d(b, {})}</a><div><p class="kicker">This letter’s book</p><h3>${esc(b.t)}</h3><p style="font-size:16px;margin:6px 0 10px">${esc(b.line)}</p><div class="row"><a class="btn primary small" href="#book-${b.id}">Open the breakdown</a><button class="btn small" type="button" data-talk="${b.id}">Discuss in the Salon</button></div></div></div>` : ''}
<nav class="row" style="justify-content:space-between;border-top:1px solid var(--ink);padding-top:14px">${older ? `<a href="#letter-${older.id}">← ${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="#letter-${newer.id}">${esc(newer.title)} →</a>` : ''}</nav>
<div class="gz-box" id="gzSub" style="margin-top:28px"><h3>Get the Gazette</h3><p style="font-size:16px;margin:0">A new letter every Sunday.</p>${subForm('letter')}</div>
</article>`;
  mountRegionsLite();
}
PAGES.desk = () => {
  if (!S.canEdit) return gzChrome('desk', `<div class="narrow" style="text-align:center"><h1 style="font-size:40px">The writing desk</h1><p style="margin:14px auto;max-width:560px">This is where the editor writes and publishes Gazette letters. ${esc(S.user && (S.uid || !window.itslitAuth) ? COPY.deskWho : COPY.deskOff)}${signinBtn()}</p><a class="btn" href="#gazette">Read the Gazette</a></div>`);
  const dr = LS.get('draft', { title: '', dek: '', book: '', body: '' });
  return gzChrome('desk', `<div class="desk">
<form id="deskForm" novalidate>
  <h1 style="font-size:36px;margin-bottom:6px">The writing desk</h1>
  <p class="small" style="margin-bottom:18px" id="deskMode">New letter. Drafts save on this device as you type.</p>
  <div class="field"><label for="dTitle">Headline</label><input id="dTitle" type="text" maxlength="120" value="${esc(dr.title)}"></div>
  <div class="field"><label for="dDek">Standfirst (one line under the headline)</label><input id="dDek" type="text" maxlength="200" value="${esc(dr.dek)}"></div>
  <div class="field"><label for="dBook">Featured book</label><select id="dBook"><option value="">None</option>${BOOKS.map(b => `<option value="${b.id}" ${dr.book === b.id ? 'selected' : ''}>${esc(b.t)}</option>`).join('')}</select></div>
  <div class="field"><label for="dBody">Letter</label><div class="fmt" role="toolbar" aria-label="Formatting"><button type="button" data-fmt="b" aria-label="Bold"><b>B</b></button><button type="button" data-fmt="i" aria-label="Italic"><i>I</i></button><button type="button" data-fmt="h">Heading</button><button type="button" data-fmt="q">Quote</button><button type="button" data-fmt="l">List</button></div><textarea id="dBody" rows="16">${esc(dr.body)}</textarea><span class="small">Use a blank line between paragraphs. **bold**, *italic*, ## heading, &gt; quote, - list.</span></div>
  <div class="row"><button class="btn primary" type="submit" id="dPub">Publish to the Gazette</button><button class="btn" type="button" id="dCopy">${icon('copy')} Copy as email</button><button class="btn ghost" type="button" id="dClear">Start over</button></div>
  <p class="small" id="dStatus" aria-live="polite" style="margin-top:10px"></p>
</form>
<div>
  <h2 style="font-size:22px;margin-bottom:10px">Preview</h2>
  <div class="preview-pane letter" id="dPrev"></div>
  <div id="deskLists" style="margin-top:26px"></div>
</div></div>`);
};
function deskPreview() {
  const p = $('#dPrev'); if (!p) return;
  const t = $('#dTitle').value, dk = $('#dDek').value, body = $('#dBody').value;
  p.innerHTML = `<p class="kicker">${fmtDate(todayISO())}</p><h1 style="font-size:30px">${esc(t) || '<span class="muted">Your headline</span>'}</h1><p class="gz-dek">${esc(dk)}</p><div class="letter-body">${md(body) || '<p class="muted">Start writing on the left.</p>'}</div>`;
}
function uniqEmails(arr) { return [...new Set((arr || []).map(s => String((s && s.email) || '').trim().toLowerCase()).filter(e => e.includes('@')))]; }
function renderDeskLists() {
  const box = $('#deskLists'); if (!box) return;
  deskPreview();
  const own = allLetters().filter(l => l.mine), samples = LETTERS;
  const subs = S.subs === null ? null : uniqEmails(S.subs), waits = S.waits;
  const tally = (arr, key) => { const c = {}; (arr || []).forEach(w => (w[key] || []).forEach(v => { c[v] = (c[v] || 0) + 1; })); return Object.entries(c).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ') || 'none yet'; };
  box.innerHTML = `
<h2 style="font-size:22px;margin-bottom:8px">Your published letters</h2>
${!S.db ? `<p class="notice">${esc(COPY.publishOff)}</p>` : own.length ? `<table class="list-table">${own.map(l => `<tr><td>${esc(l.title)}<br><span class="small">${fmtDate(l.date)}</span></td><td style="text-align:right;white-space:nowrap"><button class="btn small" type="button" data-edit="${esc(l.docId)}">Edit</button> <button class="btn small ghost" type="button" data-unpub="${esc(l.docId)}">Unpublish</button></td></tr>`).join('')}</table>` : '<p class="small">Nothing published yet. Your first letter will appear here and on the front page.</p>'}
<h2 style="font-size:22px;margin:24px 0 8px">Sample letters</h2>
<table class="list-table">${samples.map(l => { const hid = S.hidden.includes(l.id); return `<tr><td>${esc(l.title)}<br><span class="small">${hid ? 'Hidden from readers' : 'Showing on the Gazette'}</span></td><td style="text-align:right"><button class="btn small" type="button" data-hide="${l.id}" ${S.db ? '' : 'disabled'}>${hid ? 'Show' : 'Hide'}</button></td></tr>`; }).join('')}</table>
<h2 style="font-size:22px;margin:24px 0 8px">Subscribers</h2>
${subs === null ? '<p class="small">Loading the list…</p>' : `<p>${subs.length} reader${subs.length === 1 ? '' : 's'} on the list.</p>${subs.length ? `<button class="btn small" type="button" id="copySubs">${icon('copy')} Copy all emails</button>` : ''}<p class="small" style="margin-top:8px">${esc(COPY.subsNote)}</p>`}
<h2 style="font-size:22px;margin:24px 0 8px">Waitlists</h2>
${waits === null ? '<p class="small">Loading…</p>' : `<p style="font-size:16px">Membership: ${tally(waits, 'plans')}<br>Emporium: ${tally(waits, 'merch')}</p>`}
<h2 style="font-size:22px;margin:24px 0 8px">Flagged Salon posts</h2>
${(() => { const f = S.posts.filter(p => Array.isArray(p.flaggedBy) && p.flaggedBy.length); return f.length ? f.map(p => `<p style="font-size:16px"><a href="#book-${esc(p.book)}" data-talk="${esc(p.book)}">${esc((BOOK[p.book] || {}).t || 'A book')}</a>: “${esc(String(p.text).slice(0, 90))}” (${p.flaggedBy.length} flag${p.flaggedBy.length > 1 ? 's' : ''})</p>`).join('') : '<p class="small">None. All quiet in the Salon.</p>'; })()}`;
}

/* ---------- home letters, feed, thread ---------- */
function renderHomeLetters() {
  const box = $('#homeLetters'); if (!box) return;
  box.innerHTML = allLetters().slice(0, 3).map(l => `<a class="card letter-card" href="#letter-${l.id}" style="color:var(--ink)"><span class="date">${fmtDate(l.date)}${l.sample ? '<span class="sample-tag">Sample</span>' : ''}</span><h3>${esc(l.title)}</h3><p style="margin:0;font-size:16px">${esc(l.dek)}</p><span style="margin-top:auto;color:var(--claret)">Read the letter →</span></a>`).join('');
  mountRegionsLite();
}
function mountRegionsLite() { $$('.sub-state').forEach(e => { e.textContent = S.subscribed ? 'You are on the Gazette list. Thank you!' : ''; }); $$('[data-hear]').forEach(b => { b.hidden = !S.tts; }); updateThemeButtons(); }
function canPost() { return !!(S.db && S.uid && S.canWrite !== false && !S.writeBlocked); }
function postGate() {
  if (!S.capsDone) return 'Connecting to the Salon…';
  if (!S.db || !S.uid) return COPY.postGate;
  if (S.canWrite === false || S.writeBlocked) return COPY.noWrite;
  return '';
}
function renderFeed() {
  const box = $('#feed'); if (!box) return;
  const posts = S.posts.slice(0, 30);
  if (!posts.length) {
    const gate = postGate();
    box.innerHTML = (gate ? `<p class="notice" style="margin-bottom:14px">${esc(gate)}${signinBtn()}</p>` : '') + `<p class="small" style="margin-bottom:6px">${S.db && !S.postsReady ? 'Gathering the conversation…' : 'No posts yet. These questions are waiting for their first answers:'}</p>` + ['frankenstein', 'pride-and-prejudice', 'wuthering-heights', 'a-christmas-carol', 'the-great-gatsby'].map(id => { const b = BOOK[id]; return `<a class="feed-item" href="#book-${id}" data-talk="${id}" style="color:var(--ink);text-decoration:none"><span class="mini-spine" style="background:${b.spine}"></span><span><b style="font-family:var(--fd)">${esc(b.t)}</b><br><span style="font-size:16px">${esc(PROMPTS[id])}</span></span></a>`; }).join('');
    return;
  }
  box.innerHTML = posts.map(p => { const b = BOOK[p.book] || { t: 'A book', spine: '#555' }; return `<a class="feed-item" href="#book-${esc(p.book)}" data-talk="${esc(p.book)}" style="color:var(--ink);text-decoration:none"><span class="mini-spine" style="background:${esc(b.spine)}"></span><span><span class="small"><b class="who" data-uid="${esc(p.author)}">A reader</b> on <i>${esc(b.t)}</i> · ${esc(ago(+p.ts))}</span><br><span class="post-text${p.spoiler ? ' spoiler' : ''}" style="font-size:16px">${esc(String(p.text).slice(0, 220))}</span></span></a>`; }).join('');
  resolveNames(box);
}
async function resolveNames(root) {
  if (!S.user || !S.user.profiles) return;
  const els = $$('[data-uid]', root); const ids = [...new Set(els.map(e => e.dataset.uid).filter(Boolean))];
  if (!ids.length) return;
  let ps = {}; try { ps = await S.user.profiles(ids); } catch (e) { return; }
  els.forEach(e => { const p = ps[e.dataset.uid]; if (!p) return; if (e.tagName === 'IMG') { if (p.avatarUrl) e.src = p.avatarUrl; } else e.textContent = (p.name || 'A reader') + (p.isMe ? ' (you)' : ''); });
}
function composer(bookId, parent) {
  const f = document.createElement('form'); f.className = 'composer'; f.dataset.book = bookId; f.dataset.parent = parent || '';
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  const gate = postGate();
  f.innerHTML = `<label class="vh" for="${id}">${parent ? 'Your reply' : 'Your thought'}</label><textarea id="${id}" maxlength="1200" placeholder="${parent ? 'Write a reply…' : 'Share a thought, a question or a favourite line…'}" ${canPost() ? '' : 'disabled'}></textarea><div class="row"><label class="check"><input type="checkbox" name="sp" ${canPost() ? '' : 'disabled'}> Contains spoilers</label><span class="spacer"></span><button class="btn primary small" type="submit" ${canPost() ? '' : 'disabled'}>${parent ? 'Reply' : 'Post to the Salon'}</button></div>${gate ? `<p class="small">${esc(gate)}${signinBtn()}</p>` : ''}`;
  return f;
}
function postEl(p, replies) {
  const el = document.createElement('article'); el.className = 'post'; el.dataset.id = p.id;
  const head = document.createElement('div'); head.className = 'post-head';
  const av = document.createElement('img'); av.className = 'avatar'; av.alt = ''; av.referrerPolicy = 'no-referrer'; av.dataset.uid = p.author || '';
  const nm = document.createElement('b'); nm.dataset.uid = p.author || ''; nm.textContent = 'A reader';
  const tm = document.createElement('time'); tm.textContent = ago(+p.ts);
  head.append(av, nm, tm);
  const flags = Array.isArray(p.flaggedBy) ? p.flaggedBy.length : 0;
  if (flags && S.canEdit) { const fl = document.createElement('span'); fl.className = 'flag'; fl.textContent = `Flagged ${flags}`; head.append(fl); }
  const tx = document.createElement('p'); tx.className = 'post-text' + (p.spoiler ? ' spoiler' : ''); tx.textContent = String(p.text || '');
  if (p.spoiler) { tx.title = 'Spoiler: tap to reveal'; tx.tabIndex = 0; tx.setAttribute('role', 'button'); }
  const tools = document.createElement('div'); tools.className = 'post-tools';
  const cheers = Array.isArray(p.cheers) ? p.cheers : [];
  const mine = S.uid && cheers.includes(S.uid);
  const btn = (act, label, html, pressed) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.act = act; b.dataset.id = p.id; b.innerHTML = html; b.setAttribute('aria-label', label); if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed)); return b; };
  tools.append(btn('cheer', 'Hear, hear', `${icon('heart')} Hear, hear${cheers.length ? ' · ' + cheers.length : ''}`, !!mine));
  if (!p.parent) tools.append(btn('reply', 'Reply', `${icon('reply')} Reply`));
  if (S.uid && p.author !== S.uid) tools.append(btn('flag', 'Report', `${icon('flag')} Report`, !!(S.uid && (p.flaggedBy || []).includes(S.uid))));
  if (S.uid && (p.author === S.uid || S.canEdit)) tools.append(btn('del', 'Delete', `${icon('trash')} Delete`));
  tools.querySelectorAll('svg').forEach(s => { s.style.width = '15px'; s.style.height = '15px'; s.style.display = 'inline'; s.style.verticalAlign = '-2px'; });
  el.append(head, tx, tools);
  if (replies && replies.length) { const r = document.createElement('div'); r.className = 'replies'; replies.forEach(x => r.append(postEl(x))); el.append(r); }
  return el;
}
function renderThread(bookId) {
  const box = $('#thread'); if (!box) return;
  const active = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA' ? document.activeElement : null;
  if (active && active.value) return; // do not wipe a reply in progress
  const posts = S.posts.filter(p => p.book === bookId);
  const tops = posts.filter(p => !p.parent).sort((a, b) => b.ts - a.ts);
  const reps = id => posts.filter(p => p.parent === id).sort((a, b) => a.ts - b.ts);
  box.innerHTML = '';
  box.append(composer(bookId, null));
  const house = document.createElement('article'); house.className = 'post house';
  house.innerHTML = `<div class="post-head"><span class="avatar" style="display:grid;place-items:center;background:var(--wedg);color:#fff;width:30px;height:30px">${FLAME.replace('<svg', '<svg style="width:12px;height:16px"')}</span><b>The ItsLit Librarian</b><span class="who-tag">Opening question</span></div><p class="post-text">${esc(PROMPTS[bookId])}</p>`;
  box.append(house);
  if (S.db && !S.postsReady) { const n = document.createElement('p'); n.className = 'small'; n.textContent = S.slow.posts ? 'The Salon is taking a while to answer. Posts may be out of date.' : 'Gathering the conversation…'; box.append(n); }
  else if (S.db && !tops.length) { const n = document.createElement('p'); n.className = 'empty'; n.textContent = 'No replies yet. Be the first to answer the question above.'; box.append(n); }
  tops.forEach(p => box.append(postEl(p, reps(p.id))));
  resolveNames(box);
}
async function dbWrite(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) {
    const c = e && e.code;
    if (c === 'invalid_argument') { S.writeBlocked = true; toast('You can read here, but you do not have permission to post.'); mountRegions(); }
    else if (c === 'quota_exceeded') toast('The Salon is full for now. The editor has been asked to tidy up.');
    else if (c === 'resource_exhausted') toast('Slow down a little and try again in a moment.');
    else toast('That did not save. Please try again.');
    return false;
  }
}

/* ---------- shelf ---------- */
function shelfOf(id) { return ['want', 'reading', 'done'].find(k => (S.shelf[k] || []).includes(id)) || ''; }
async function setShelf(id, where) {
  const s = { want: (S.shelf.want || []).filter(x => x !== id), reading: (S.shelf.reading || []).filter(x => x !== id), done: (S.shelf.done || []).filter(x => x !== id) };
  if (where && shelfOf(id) !== where) s[where].push(id);
  S.shelf = s; LS.set('shelf', s); mountRegions();
  if (S.db && S.uid) { try { await S.db.doc('data/users/' + S.uid + '/shelf').set(s); } catch (e) {} }
  toast(where && s[where].includes(id) ? { want: 'Added to Want to read', reading: 'Marked as Reading', done: 'Finished! Well read.' }[where] : 'Removed from your shelf');
}
function renderShelfSel(id) {
  const box = $('#shelfSel'); if (!box) return;
  const cur = shelfOf(id);
  box.innerHTML = `<span class="small" style="width:100%">My shelf:</span>` + [['want', 'Want to read'], ['reading', 'Reading'], ['done', 'Finished']].map(([k, n]) => `<button class="chip" type="button" data-shelf="${k}" data-book="${id}" aria-pressed="${cur === k}">${n}</button>`).join('');
}
function renderShelfPage() {
  const box = $('#shelfPage'); if (!box) return;
  $('#shelfNote').innerHTML = esc(S.db && S.uid ? COPY.shelfSynced : COPY.shelfLocal) + (S.uid ? '' : signinBtn());
  box.innerHTML = [['want', 'Want to read'], ['reading', 'Reading now'], ['done', 'Finished']].map(([k, n]) => {
    const ids = (S.shelf[k] || []).filter(x => BOOK[x]);
    return `<div class="shelf-col"><h3>${n} <span class="small">(${ids.length})</span></h3><div class="shelf-row">${ids.length ? ids.map(x => `<a class="shelf-book" href="#book-${x}" style="background:${BOOK[x].spine}" title="${esc(BOOK[x].t)}">${esc(BOOK[x].st)}</a>`).join('') : '<p class="small" style="align-self:center">Empty for now.</p>'}</div></div>`;
  }).join('') + `<div style="grid-column:1/-1;text-align:center;margin-top:10px"><p>${(S.shelf.done || []).length ? `You have finished ${(S.shelf.done || []).length} classic${(S.shelf.done || []).length > 1 ? 's' : ''}. The lamps salute you.` : 'Finish your first classic to earn a place in the Ledger.'}</p><a class="btn" href="#library">Browse the Library</a></div>`;
}

/* ---------- waitlist, subscribe ---------- */
function renderWaitButtons() {
  $$('[data-notify]').forEach(b => { const on = (S.waitlist.merch || []).includes(b.dataset.notify); b.textContent = on ? 'On the list' : 'Notify me'; b.setAttribute('aria-pressed', String(on)); });
  $$('[data-plan]').forEach(b => { const on = (S.waitlist.plans || []).includes(b.dataset.plan); if (on) b.textContent = 'You are on the list'; });
}
async function addWait(kind, v) {
  const w = { plans: [...(S.waitlist.plans || [])], merch: [...(S.waitlist.merch || [])] };
  if (!w[kind].includes(v)) w[kind].push(v); else if (kind === 'merch') w[kind] = w[kind].filter(x => x !== v);
  S.waitlist = w; LS.set('wait', w); renderWaitButtons();
  if (S.db && S.uid) await dbWrite(() => S.db.doc('waitlist/' + S.uid).set({ ...w, ts: Date.now() }), kind === 'plans' ? 'Your place is saved. We will tell you when checkout opens.' : (w.merch.includes(v) ? 'We will tell you when it is in stock.' : 'Removed from the list.'));
  else toast(kind === 'plans' ? COPY.savedLocal : 'Saved in this browser.');
}
async function subscribe(email, src) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('That email address looks incomplete.'); return; }
  if (window.itslitApi && window.itslitApi.subscribe) {
    try { await window.itslitApi.subscribe(email, src); S.subscribed = true; LS.set('sub', { email: '', ts: Date.now() }); toast(COPY.subscribed); }
    catch (e) { toast('That did not go through. Please try again in a moment.'); }
  } else if (S.db && S.uid) { const ok = await dbWrite(() => S.db.doc('subscribers/' + S.uid).set({ email, src, ts: Date.now() }), 'You are on the Gazette list. Thank you!'); if (ok) S.subscribed = true; }
  else { LS.set('sub', { email, ts: Date.now() }); S.subscribed = true; toast(COPY.savedLocal); }
  mountRegionsLite();
}

/* ---------- Shelley ---------- */
const SUGGEST = ['I loved Bridgerton. Which classic should I start with?', 'Explain Wuthering Heights like I am new to it', 'Is Frankenstein’s creature the real victim?', 'Give me a 10-minute tour of Moby-Dick', 'Quiz me on A Christmas Carol'];
function shelleyHTML(text) {
  return md(text).replace(/\[\[book:([a-z0-9-]+)\]\]/g, (m, id) => BOOK[id] ? `<a class="bookchip" href="#book-${id}" aria-label="Open ${esc(BOOK[id].t)} in the Library">Open →</a>` : '');
}
function persona() {
  const ctx = S.askContext && BOOK[S.askContext] ? `The reader came from the page for ${BOOK[S.askContext].t} by ${BOOK[S.askContext].a}.` : '';
  return `You are Shelley, the AI librarian of ItsLit, a reading club that helps readers aged 13 and up enjoy classic literature. You are named for Mary Shelley, who began Frankenstein at eighteen. You are an AI and say so if asked.
Voice: warm, witty and encouraging, with a light Regency flavour, but always in clear modern English. No emoji. Short paragraphs. Keep answers under 170 words unless the reader asks for more.
Rules:
- Spoilers: ${S.spoilFree ? 'spoiler-free mode is ON. Never reveal endings, deaths or major twists. If the reader asks, offer to reveal it and wait for them to confirm in a later message.' : 'spoilers are allowed, but warn briefly before revealing an ending.'}
- Level: ${S.newbie ? 'the reader is new to classics. Avoid jargon and explain any literary term you use.' : 'adjust to the reader.'}
- Homework: help readers understand, discuss and form their own ideas. Do not write essays, assignments or answers to hand in. Offer questions to think about or an outline of ideas instead.
- Accuracy: if unsure, say so. Point to chapters, acts or staves when helpful. Never invent quotations; only quote short public-domain lines you are certain of.
- Readers may be teenagers: discuss mature themes in classics with care and without graphic detail.
- When you mention a book that is in the ItsLit Library, write its title followed by its tag, for example: Frankenstein [[book:frankenstein]]. Library: ${BOOKS.map(b => `${b.t} by ${b.a} [[book:${b.id}]]`).join('; ')}.
- You may recommend books outside the Library, without a tag.
- Stay on books, reading and writing. Politely steer back if asked about other topics. Never ask for personal information.
${ctx}`;
}
function renderChat() {
  const box = $('#msgs'); if (!box) return;
  box.innerHTML = '';
  const hello = document.createElement('div'); hello.className = 'msg her';
  const ctx = S.askContext && BOOK[S.askContext];
  hello.innerHTML = `<span class="who">Shelley</span><p>Good evening, reader. ${ctx ? `Shall we talk about <i>${esc(ctx.t)}</i>? Ask me anything, and I will keep the ending sealed unless you say otherwise.` : 'What shall we open tonight? Ask about any classic, or try one of these.'}</p><div class="chips">${(ctx ? [`Tell me about ${ctx.t} without spoilers`, `Why do people still read ${ctx.t}?`, `Quiz me on ${ctx.t}`] : SUGGEST).map(s => `<button class="chip" type="button" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  box.append(hello);
  S.chat.forEach(m => box.append(msgEl(m.role === 'user' ? 'me' : 'her', m.content, true)));
  if (!S.capsDone) note(box, 'Lighting Shelley’s lamp…');
  else if (!S.sample) note(box, COPY.shelleyOff);
  else if (COPY.shelleySignin && window.itslitAuth && !window.itslitAuth.user()) { const p = document.createElement('p'); p.className = 'small'; p.style.textAlign = 'center'; p.innerHTML = esc(COPY.shelleySignin) + signinBtn(); box.append(p); }
  updateQuota();
  box.scrollTop = box.scrollHeight;
}
function note(box, t) { const p = document.createElement('p'); p.className = 'small'; p.style.textAlign = 'center'; p.textContent = t; box.append(p); }
function msgEl(who, text, done) {
  const el = document.createElement('div'); el.className = 'msg ' + who;
  if (who === 'me') el.textContent = text;
  else { el.innerHTML = `<span class="who">Shelley</span>${shelleyHTML(text)}`; if (done) addTools(el, text); }
  return el;
}
function addTools(el, text) {
  const t = document.createElement('div'); t.className = 'tools';
  t.innerHTML = `<button class="btn small ghost" type="button" data-copy="${esc(plain(text))}">${icon('copy')} Copy</button>` + (S.tts ? `<button class="btn small ghost" type="button" data-say="${esc(plain(text).slice(0, 2000))}">${icon('speaker')} Hear it</button>` : '');
  el.append(t);
}
function updateQuota() {
  const q = $('#quota'); if (!q) return;
  const n = LS.get('q-' + todayISO(), 0);
  const lim = +CFG.dailyLimit || 5, showAt = CFG.dailyLimit ? Math.max(1, lim - 2) : 5;
  q.hidden = n < showAt; q.textContent = n >= showAt ? COPY.quota.replace('{n}', n).replace('{left}', Math.max(0, lim - n)).replace('{lim}', lim) : '';
}
async function ask(q) {
  q = q.trim(); if (!q || S.asking) return;
  const box = $('#msgs'); if (!box) return;
  S.chat.push({ role: 'user', content: q });
  box.append(msgEl('me', q));
  const her = document.createElement('div'); her.className = 'msg her'; her.innerHTML = '<span class="who">Shelley</span><span class="typing" aria-label="Shelley is writing"><i></i><i></i><i></i></span>';
  box.append(her); box.scrollTop = box.scrollHeight;
  if (!S.sample) { S.chat.pop(); her.innerHTML = `<span class="who">Shelley</span><p>${S.capsDone ? esc(COPY.shelleyAskOff) : 'One moment, my lamp is still being lit. Try again shortly.'}${S.capsDone ? signinBtn() : ''}</p>`; return; }
  const msgs = [{ role: 'user', content: persona() + '\n\nReply "Understood." to begin.' }, { role: 'assistant', content: 'Understood.' }, ...S.chat.slice(-11)];
  S.asking = new AbortController();
  $('#askForm button').disabled = true;
  try {
    const r = await S.sample(msgs, { cache: false, modelTier: 'default', signal: S.asking.signal, onText: ({ text }) => { if (text) { her.innerHTML = `<span class="who">Shelley</span>${shelleyHTML(text)}`; box.scrollTop = box.scrollHeight; } } });
    const text = (r && r.text) || '';
    S.chat.push({ role: 'assistant', content: text });
    her.innerHTML = `<span class="who">Shelley</span>${shelleyHTML(text)}`; addTools(her, text);
    LS.set('q-' + todayISO(), LS.get('q-' + todayISO(), 0) + 1); updateQuota();
  } catch (e) {
    S.chat.pop();
    const c = e && e.code;
    if (c === 'not_granted') { S.sample = null; her.innerHTML = '<span class="who">Shelley</span><p>Shelley has been switched off for this page.</p>'; }
    else if (c === 'not_signed_in') her.innerHTML = `<span class="who">Shelley</span><p>Please sign in first, so I know whom I am talking to. It takes a moment.${signinBtn()}</p>`;
    else if (c === 'rate_limited') her.innerHTML = '<span class="who">Shelley</span><p>I need a moment to catch my breath. Please ask again in a minute.</p>';
    else her.innerHTML = `<span class="who">Shelley</span>${e && e.text ? shelleyHTML(e.text) : '<p>My candle flickered and the answer was lost. Please try again.</p>'}`;
  } finally { S.asking = null; const b = $('#askForm button'); if (b) b.disabled = false; box.scrollTop = box.scrollHeight; }
}

/* ---------- theme, preview, sheet ---------- */
function effTheme() { const t = document.documentElement.dataset.theme; if (t === 'light' || t === 'dark') return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
function updateThemeButtons() {
  const dark = effTheme() === 'dark';
  $$('.theme-btn').forEach(b => { b.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span class="theme-lbl">${dark ? 'Daylight' : 'Candlelight'}</span>`; b.setAttribute('aria-label', dark ? 'Switch to the daylight (light) theme' : 'Switch to the candlelight (dark) theme'); });
  Shelf3D.theme(effTheme());
}
function setTheme(t) { document.documentElement.dataset.theme = t; LS.set('theme', t); updateThemeButtons(); }
function setPreview(on) { document.documentElement.classList.toggle('preview', on); LS.set('preview', on); setTimeout(() => { Shelf3D.resize(); render(); }, 30); }

/* ---------- capabilities ---------- */
function watch(ref, key, next) {
  const timer = setTimeout(() => { S.slow[key] = true; mountRegions(); }, 10000);
  try {
    ref.onSnapshot(snap => { if (!snap.metadata || !snap.metadata.fromCache) { clearTimeout(timer); S.slow[key] = false; } next(snap); }, err => { clearTimeout(timer); S.err[key] = err && err.code; mountRegions(); });
  } catch (e) { clearTimeout(timer); S.err[key] = 'error'; }
}
function subscribeData() {
  const db = S.db;
  watch(db.collection('posts').orderBy('ts', 'desc').limit(500), 'posts', snap => { S.posts = snap.docs.map(d => ({ ...d.data(), id: d.id })); S.postsReady = true; mountRegions(); });
  watch(db.collection('letters'), 'letters', snap => { S.dbLetters = snap.docs.map(d => ({ ...d.data(), id: d.id })); S.lettersReady = true; mountRegions(); });
  watch(db.doc('config/gazette'), 'config', snap => { const d = snap.exists ? snap.data() : {}; S.hidden = Array.isArray(d.hidden) ? d.hidden.filter(x => typeof x === 'string') : []; mountRegions(); });
  if (S.uid) {
    watch(db.doc('data/users/' + S.uid + '/shelf'), 'shelf', snap => { if (snap.exists) { const d = snap.data(); S.shelf = { want: [...(d.want || [])], reading: [...(d.reading || [])], done: [...(d.done || [])] }; LS.set('shelf', S.shelf); mountRegions(); } });
    watch(db.doc('subscribers/' + S.uid), 'sub', snap => { if (snap.exists) { S.subscribed = true; mountRegions(); } });
    watch(db.doc('waitlist/' + S.uid), 'wait', snap => { if (snap.exists) { const d = snap.data(); S.waitlist = { plans: [...(d.plans || [])], merch: [...(d.merch || [])] }; LS.set('wait', S.waitlist); mountRegions(); } });
    if (S.canEdit) {
      watch(db.collection('subscribers'), 'subs', snap => { S.subs = snap.docs.map(d => d.data()); mountRegions(); });
      watch(db.collection('waitlist'), 'waits', snap => { S.waits = snap.docs.map(d => d.data()); mountRegions(); });
    }
  }
}
async function initCaps() {
  const C = window.claude;
  if (!C || typeof C.use !== 'function') { S.capsDone = true; mountRegions(); return; }
  const use = n => Promise.resolve().then(() => C.use(n)).catch(() => null);
  const [user, db] = await Promise.all([use('user'), use('db')]);
  S.user = user; S.db = db;
  if (user) {
    try { S.me = await user.me(); S.uid = S.me.id; S.canEdit = !!S.me.canEdit; S.isOwner = !!S.me.isOwner; } catch (e) {}
    try { S.canWrite = await user.can('data.write'); } catch (e) { S.canWrite = null; }
  }
  if (db) subscribeData();
  const [sample, tts] = await Promise.all([use('sample'), use('tts')]);
  S.sample = sample; S.tts = tts;
  S.capsDone = true;
  if (S.route && S.route.r === 'desk') render(); else mountRegions();
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, a, [data-go], .post-text.spoiler, .b3d[role=button], .seal');
  if (!t) return;
  const d = t.dataset;
  if (t.classList.contains('theme-btn')) return setTheme(effTheme() === 'dark' ? 'light' : 'dark');
  if (d.signin !== undefined && window.itslitAuth) return window.itslitAuth.open();
  if (t.id === 'previewBtn') return setPreview(true);
  if (t.id === 'exitPreview' || d.web !== undefined) { $('#moreSheet').close(); return setPreview(false); }
  if (t.id === 'moreBtn') return $('#moreSheet').showModal();
  if (t.closest('#moreSheet') && t.tagName === 'A') { $('#moreSheet').close(); return; }
  if (d.ask) { e.preventDefault(); S.askContext = d.ask; Shelf3D.deselect(); location.hash = '#ask'; return; }
  if (d.talk) { e.preventDefault(); S.scrollTo = 'talk'; if (location.hash === '#book-' + d.talk) render(); else location.hash = '#book-' + d.talk; return; }
  if (d.scroll) { const sc = $('#featScroll'); sc.scrollBy({ left: +d.scroll * sc.clientWidth * .8, behavior: 'smooth' }); return; }
  if (d.mood) { const f = LS.get('lib', { mood: 'all', q: '', sort: 'year' }); f.mood = d.mood; LS.set('lib', f); $$('[data-mood]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mood === d.mood))); return renderLibrary(); }
  if (t.classList.contains('seal')) { t.closest('.seal-box').classList.add('broken'); t.setAttribute('aria-expanded', 'true'); return; }
  if (t.matches('.b3d[role=button]')) { t.classList.toggle('open'); const h = $('.open-hint'); if (h) h.textContent = t.classList.contains('open') ? 'Tap again to close the book' : 'Tap the book to open it'; return; }
  if (t.matches('.post-text.spoiler')) { t.classList.remove('spoiler'); t.removeAttribute('role'); return; }
  if (d.copy !== undefined || d.copyMatch !== undefined) {
    let text = d.copy;
    if (d.copyMatch !== undefined) text = 'My ItsLit matches: ' + scoreMatch(LS.get('match', {})).map(r => `${r.b.t} (${r.pct}%)`).join(', ');
    try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch (err) { toast('Copying is blocked here. Select the text to copy it.'); }
    return;
  }
  if (d.askMatch !== undefined) { const top = scoreMatch(LS.get('match', {}))[0]; S.askContext = top.b.id; location.hash = '#ask'; setTimeout(() => ask(`The Matchmaker paired me with ${top.b.t}. In a few lines, why might I love it?`), 80); return; }
  if (d.say !== undefined || d.hear !== undefined) {
    if (!S.tts) return;
    let text = d.say;
    if (d.hear !== undefined && d.hear) { const b = BOOK[d.hear]; text = b ? `${b.t}, by ${b.a}. ${b.line} ${b.parts.map(p => p.h + '. ' + p.s).join(' ')}` : ''; }
    if (d.hearLetter) { const l = letterById(d.hearLetter); text = l ? `${l.title}. ${l.dek}. ${plain(l.body)}` : ''; }
    if (!text) return;
    if (t.getAttribute('aria-pressed') === 'true') { S.tts.stop(); return; }
    t.setAttribute('aria-pressed', 'true');
    try { await S.tts.speak(text.slice(0, 2000), { voice: 'rounded' }); } catch (err) { if (err && err.code === 'not_granted') { S.tts = null; mountRegions(); } }
    t.setAttribute('aria-pressed', 'false');
    return;
  }
  if (d.suggest) return ask(d.suggest);
  if (t.id === 'optSpoil') { S.spoilFree = !S.spoilFree; t.setAttribute('aria-pressed', String(S.spoilFree)); return; }
  if (t.id === 'optNew') { S.newbie = !S.newbie; t.setAttribute('aria-pressed', String(S.newbie)); return; }
  if (d.q && d.v) { const a = LS.get('match', {}); a[d.q] = d.v; LS.set('match', a); $$(`[data-q="${d.q}"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === d.v))); if ($('#matchRes').innerHTML) renderMatch(); return; }
  if (t.id === 'matchGo') return renderMatch();
  if (d.notify) return addWait('merch', d.notify);
  if (d.plan) return addWait('plans', d.plan);
  if (d.bill) { S.billing = d.bill; $$('[data-bill]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bill === d.bill))); $('#tiers').innerHTML = tiersHTML(); renderWaitButtons(); return; }
  if (d.shelf) return setShelf(d.book, d.shelf);
  if (d.jump) { const el = $('#' + d.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (d.act) return postAction(d.act, d.id, t);
  if (d.fmt) return fmt(d.fmt);
  if (t.id === 'dCopy') { const txt = `${$('#dTitle').value}\n${$('#dDek').value}\n\n${plain($('#dBody').value)}\n\nRead it on ItsLit and join the conversation in the Salon.`; try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it into your email service.'); } catch (err) { toast('Copying is blocked here. Select the preview text to copy it.'); } return; }
  if (t.id === 'dClear') { S.editing = null; LS.set('draft', { title: '', dek: '', book: '', body: '' }); render(); return; }
  if (d.edit) { const l = S.dbLetters.find(x => x.id === d.edit); if (!l) return; S.editing = l.id; $('#dTitle').value = l.title || ''; $('#dDek').value = l.dek || ''; $('#dBook').value = BOOK[l.book] ? l.book : ''; $('#dBody').value = l.body || ''; $('#deskMode').textContent = 'Editing a published letter. Publishing updates it in place.'; $('#dPub').textContent = 'Update the letter'; deskPreview(); $('#deskForm').scrollIntoView({ behavior: 'smooth' }); return; }
  if (d.unpub) { if (await confirmBox('Unpublish this letter?', 'It disappears from the Gazette for every reader.')) await dbWrite(() => S.db.doc('letters/' + d.unpub).delete(), 'Letter unpublished.'); return; }
  if (d.hide) { const h = S.hidden.includes(d.hide) ? S.hidden.filter(x => x !== d.hide) : [...S.hidden, d.hide]; await dbWrite(() => S.db.doc('config/gazette').set({ hidden: h }), 'Saved.'); return; }
  if (t.id === 'copySubs') { try { await navigator.clipboard.writeText(uniqEmails(S.subs).join('\n')); toast('Emails copied.'); } catch (err) { toast('Copying is blocked here.'); } return; }
});
async function postAction(act, id, t) {
  const p = S.posts.find(x => x.id === id); if (!p) return;
  if (!canPost()) { toast(postGate()); return; }
  const ref = S.db.doc('posts/' + id);
  if (act === 'cheer') { const c = Array.isArray(p.cheers) ? p.cheers.filter(x => typeof x === 'string') : []; const next = c.includes(S.uid) ? c.filter(x => x !== S.uid) : [...c, S.uid]; return dbWrite(() => ref.update({ cheers: next })); }
  if (act === 'flag') { const f = Array.isArray(p.flaggedBy) ? p.flaggedBy.filter(x => typeof x === 'string') : []; if (f.includes(S.uid)) return toast('You have already reported this. The editor will review it.'); return dbWrite(() => ref.update({ flaggedBy: [...f, S.uid] }), 'Reported. Thank you for keeping the Salon kind.'); }
  if (act === 'del') { if (await confirmBox('Delete this post?', 'This cannot be undone.')) dbWrite(() => ref.delete(), 'Post deleted.'); return; }
  if (act === 'reply') { const art = t.closest('.post'); if (art.querySelector(':scope > .composer')) return; const c = composer(p.book, p.id); art.append(c); c.querySelector('textarea').focus(); }
}
function confirmBox(title, msg) {
  return new Promise(res => {
    const dlg = $('#dlg');
    dlg.innerHTML = `<h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" type="button" value="no">Cancel</button><button class="btn primary" type="button" value="yes">Yes</button></div>`;
    dlg.onclick = e => { const b = e.target.closest('button'); if (!b) return; dlg.close(); res(b.value === 'yes'); };
    dlg.oncancel = () => res(false);
    dlg.showModal();
  });
}
function fmt(k) {
  const ta = $('#dBody'); const [s, e] = [ta.selectionStart, ta.selectionEnd]; const sel = ta.value.slice(s, e) || { b: 'bold text', i: 'italic text', h: 'A heading', q: 'A line worth quoting', l: 'A list item' }[k];
  const ins = { b: `**${sel}**`, i: `*${sel}*`, h: `\n## ${sel}\n`, q: `\n> ${sel}\n`, l: `\n- ${sel}\n` }[k];
  ta.setRangeText(ins, s, e, 'end'); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
}
document.addEventListener('submit', async e => {
  const f = e.target; if (f.method === 'dialog') return; e.preventDefault();
  if (f.classList.contains('sub-form')) { const i = f.querySelector('input[type=email]'); await subscribe(i.value.trim(), f.dataset.src); if (S.subscribed) i.value = ''; return; }
  if (f.id === 'askForm') { const i = $('#askInput'); const q = i.value; i.value = ''; i.style.height = ''; return ask(q); }
  if (f.classList.contains('composer')) {
    if (!canPost()) { toast(postGate()); return; }
    const ta = f.querySelector('textarea'), text = ta.value.trim(); if (!text) return toast('Write something first.');
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const ok = await dbWrite(() => S.db.collection('posts').add({ book: f.dataset.book, parent: f.dataset.parent || '', text: text.slice(0, 1200), author: S.uid, ts: Date.now(), spoiler: !!f.querySelector('[name=sp]').checked, cheers: [], flaggedBy: [] }), f.dataset.parent ? 'Reply posted.' : 'Posted to the Salon.');
    btn.disabled = false; if (ok) { ta.value = ''; ta.blur(); renderThread(f.dataset.book); }
    return;
  }
  if (f.id === 'deskForm') {
    const title = $('#dTitle').value.trim(), dek = $('#dDek').value.trim(), book = $('#dBook').value, body = $('#dBody').value.trim();
    if (!title || !body) { $('#dStatus').textContent = 'A headline and a letter are both needed before publishing.'; return; }
    if (!S.db) { $('#dStatus').textContent = COPY.publishOff; return; }
    const data = { title: title.slice(0, 120), dek: dek.slice(0, 200), book, body: body.slice(0, 20000), author: S.uid || '', ts: Date.now(), date: todayISO() };
    const editing = S.editing;
    const ok = await dbWrite(() => editing ? S.db.doc('letters/' + editing).update({ title: data.title, dek: data.dek, book, body: data.body, edited: Date.now() }) : S.db.collection('letters').add(data), editing ? 'Letter updated.' : 'Published to the Gazette.');
    if (ok) { S.editing = null; LS.set('draft', { title: '', dek: '', book: '', body: '' }); render(); }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'libQ') { const f = LS.get('lib', { mood: 'all', q: '', sort: 'year' }); f.q = t.value; LS.set('lib', f); renderLibrary(); }
  if (t.id === 'askInput') { t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; }
  if (['dTitle', 'dDek', 'dBody', 'dBook'].includes(t.id)) { if (!S.editing) LS.set('draft', { title: $('#dTitle').value, dek: $('#dDek').value, book: $('#dBook').value, body: $('#dBody').value }); deskPreview(); $('#dStatus').textContent = S.editing ? '' : 'Draft saved on this device.'; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'libSort') { const f = LS.get('lib', { mood: 'all', q: '', sort: 'year' }); f.sort = t.value; LS.set('lib', f); renderLibrary(); }
  if (t.id === 'salonPick' && t.value) { S.scrollTo = 'talk'; location.hash = '#book-' + t.value; }
  if (t.id === 'dBook') deskPreview();
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'askInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#askForm').requestSubmit(); }
  if ((e.key === 'Enter' || e.key === ' ') && (t.matches('.b3d[role=button]') || t.matches('.post-text.spoiler'))) { e.preventDefault(); t.click(); }
  if (t.id === 'featScroll' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); t.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * t.clientWidth * .8, behavior: 'smooth' }); }
});
window.addEventListener('hashchange', render);
new MutationObserver(() => updateThemeButtons()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeButtons);

/* ---------- start ---------- */
(() => {
  const th = LS.get('theme', null); if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  if (LS.get('preview', false) && innerWidth > 700) document.documentElement.classList.add('preview');
  $$('.brand-flame').forEach(s => { s.outerHTML = FLAME; });
  $('#tabShelley').innerHTML = cameo('mini-cameo');
  render();
  initCaps();
})();
