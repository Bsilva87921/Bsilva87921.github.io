/* ItsLit · backend.js
   Connects the site to its services. Each part switches itself on once its settings exist:
   - Firebase (config.js): reader accounts (Google, or email and password), the Salon, private shelves, waitlists,
     Gazette sign-ups and the Writing desk
   - The ItsLit API Worker (api-config.js, written by the "ItsLit API (Shelley)" workflow): Shelley, the AI librarian
   - The browser: read-aloud, install as an app, offline reading
   With nothing set up, the site still works for reading: the Library, book pages, the Matchmaker, the Gazette and a
   shelf kept in the browser. The app talks to this file through window.itslitRuntime.use(name). */
(() => {
  'use strict';
  const CFG = (window.ITSLIT_CONFIG = window.ITSLIT_CONFIG || {});
  const FB = CFG.firebase || {};
  const NATIVE = !!window.ITSLIT_NATIVE;
  const HAS_FB = !!(FB.apiKey && FB.projectId && FB.appId);
  const WORKER = String(CFG.workerUrl || (window.ITSLIT_API && window.ITSLIT_API.workerUrl) || '').trim().replace(/\/+$/, '');
  const HAS_AI = /^https:\/\/\S+$/.test(WORKER);
  const BEEHIIV = CFG.newsletter === 'beehiiv' && HAS_AI;
  const EDITORS = (Array.isArray(CFG.editors) ? CFG.editors : []).map(e => String(e).trim().toLowerCase()).filter(Boolean);
  const PAY = !!CFG.stripe && Object.values(CFG.stripe).some(u => /^https:\/\//.test(String(u || '')));
  if (HAS_AI && !HAS_FB) CFG.dailyLimit = 20; // before accounts exist, the Worker allows 20 questions per visitor a day
  const LIMIT = Math.max(1, +CFG.dailyLimit || 5);
  const root = document.documentElement;
  root.classList.add('prod');
  if (NATIVE) root.classList.add('native');

  /* ---------- the words readers see ---------- */
  window.ITSLIT_COPY = Object.assign({
    postGate: HAS_FB ? 'Sign in to join the conversation. Reading is open to everyone.' : 'The Salon opens for posting very soon. Reading is open to everyone.',
    noWrite: HAS_FB ? 'Your account cannot post yet. If you joined with email, open the link we sent you, then choose “I have verified it” in your account.' : 'The Salon opens for posting very soon.',
    shelfLocal: HAS_FB ? 'Your shelf is saved in this browser. Sign in to keep it on every device.' : 'Your shelf is saved in this browser.',
    shelfSynced: 'Your shelf is private and follows you to every device where you sign in.',
    savedLocal: HAS_FB ? 'Saved in this browser. Sign in so your place on the list is kept.' : 'Saved in this browser. Member accounts open very soon.',
    shelleyOff: 'Shelley is trimming her lamp and will take questions very soon. Until then, every book in the Library has a full breakdown.',
    shelleyAskOff: 'I am trimming my lamp and will take questions very soon. Until then, every book in the Library has a full breakdown.',
    shelleySignin: HAS_AI && HAS_FB ? 'Sign in (it is free) to talk with Shelley.' : '',
    deskOff: HAS_FB ? 'Sign in with an editor account to use it.' : 'It opens when member accounts go live.',
    deskWho: 'It opens only for the Gazette’s editors.',
    publishOff: HAS_FB ? 'Sign in with an editor account to publish.' : 'Publishing opens when member accounts go live.',
    checkout: PAY ? 'Payments are handled securely by Stripe.' : 'Checkout opens at launch. Joining the list here takes no payment; it only saves your place and the plan you chose.',
    quota: '{left} of today’s {lim} free questions left. Patrons will have unlimited questions.',
    subscribed: BEEHIIV ? 'You are on the Gazette list. Look out for a welcome note in your inbox.' : 'You are on the Gazette list. The next letter comes to your inbox.',
    subsNote: BEEHIIV ? 'Sign-ups from the website go straight to beehiiv. This list shows readers who joined from inside their account.' : 'To send a letter: copy the emails, import them into your email service (in beehiiv: Subscribers → Add subscribers → Import), then paste in the letter with “Copy as email”.'
  }, window.ITSLIT_COPY || {});

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('itslit:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('itslit:' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('itslit:' + k); } catch (e) {} }
  };
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); });
  const toast = msg => { const t = $('#toast'); if (!t || !msg) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 4200); };
  const fail = (code, text) => Object.assign(new Error(code), { code, text });
  const CODES = { 'permission-denied': 'invalid_argument', unauthenticated: 'invalid_argument', 'invalid-argument': 'invalid_argument', 'resource-exhausted': 'resource_exhausted' };
  const wrapErr = e => fail(CODES[e && e.code] || (e && e.code) || 'error');
  const hue = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const initialAvatar = (name, id) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${hue(id || name)},30%,40%)"/><text x="32" y="43" font-family="Georgia,serif" font-size="30" fill="#fff" text-anchor="middle">${esc((String(name || '?').trim()[0] || '?').toUpperCase())}</text></svg>`);
  const shortName = u => { const n = String(u.displayName || '').trim().split(/\s+/).filter(Boolean); return n.length ? (n[0] + (n.length > 1 ? ' ' + n[n.length - 1][0] + '.' : '')).slice(0, 40) : 'Reader ' + u.uid.slice(0, 4).toUpperCase(); };
  const PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  const GOOGLE = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  /* ---------- Firebase ---------- */
  let fb = null, booted = false, bootP = null;
  const profiles = new Map();
  const boot = () => {
    if (!HAS_FB) { booted = true; return Promise.resolve(null); }
    return bootP || (bootP = (async () => {
      await load('lib/firebase/firebase-app-compat.js');
      await Promise.all([load('lib/firebase/firebase-auth-compat.js'), load('lib/firebase/firebase-firestore-compat.js')]);
      const app = firebase.initializeApp(FB);
      const auth = firebase.auth(), fs = firebase.firestore();
      const u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
      fb = { app, auth, fs, u, name: '', isEditor: !!(u && u.email && u.emailVerified && EDITORS.includes(u.email.toLowerCase())) };
      if (u) {
        try {
          const s = await fs.doc('profiles/' + u.uid).get();
          if (s.exists && s.data().name) fb.name = String(s.data().name);
          else { fb.name = shortName(u); await fs.doc('profiles/' + u.uid).set({ name: fb.name, avatarUrl: u.photoURL || '', ts: Date.now() }); }
          profiles.set(u.uid, { name: fb.name, avatarUrl: u.photoURL || '' });
        } catch (e) { fb.name = shortName(u); }
      }
      // signing in or out (here or in another tab) reloads the page, so every part of the app sees the new reader
      auth.onAuthStateChanged(x => { if (!fb.hold && (x && x.uid) !== (u && u.uid)) location.reload(); });
      return fb;
    })().catch(e => { console.warn('[ItsLit] Accounts are unavailable:', e); return null; }).finally(() => { booted = true; paintAccount(); if (LS.get('openAcct', 0)) { LS.del('openAcct'); openAuth(); } }));
  };

  // database: the same calls the app makes inside Claude, mapped onto Firestore
  const mapPath = p => { const m = /^data\/users\/([^/]+)\/shelf$/.exec(p); return m ? 'shelves/' + m[1] : p; };
  const guard = pr => pr.catch(e => { throw wrapErr(e); });
  const D = ref => ({
    id: ref.id, path: ref.path,
    get: () => guard(ref.get()),
    set: (d, o) => guard(o ? ref.set(d, o) : ref.set(d)),
    update: d => guard(ref.update(d)),
    delete: () => guard(ref.delete()),
    onSnapshot: (next, onErr) => ref.onSnapshot(next, e => onErr && onErr(wrapErr(e))),
    collection: c => Q(ref.collection(c))
  });
  const Q = q => ({
    where: (...a) => Q(q.where(...a)), orderBy: (...a) => Q(q.orderBy(...a)), limit: n => Q(q.limit(n)),
    get: () => guard(q.get()),
    onSnapshot: (next, onErr) => q.onSnapshot(next, e => onErr && onErr(wrapErr(e))),
    add: d => guard(q.add(d)).then(D),
    doc: id => D(id ? q.doc(id) : q.doc())
  });
  const makeDb = () => ({ doc: p => D(fb.fs.doc(mapPath(p))), collection: p => Q(fb.fs.collection(mapPath(p))) });

  const verifiedUser = u => !!(u && (u.emailVerified || !u.providerData.some(p => p && p.providerId === 'password')));
  const myAvatar = () => (fb.u.photoURL || initialAvatar(fb.name, fb.u.uid));
  function makeUser() {
    const u = fb.u;
    const me = u ? { id: u.uid, name: fb.name, avatarUrl: myAvatar(), color: `hsl(${hue(u.uid)},30%,40%)`, email: u.email || null, isOwner: fb.isEditor, canEdit: fb.isEditor }
      : { id: null, name: 'Guest', avatarUrl: '', color: '#888', email: null, isOwner: false, canEdit: false };
    return {
      me: async () => me, id: async () => me.id, isOwner: async () => me.isOwner, canEdit: async () => me.canEdit,
      can: async () => !!me.id && verifiedUser(u),
      profiles: async ids => {
        ids = [...new Set([].concat(ids || []).filter(x => typeof x === 'string' && x && x.length < 200))];
        const need = ids.filter(id => !profiles.has(id));
        for (let i = 0; i < need.length; i += 30) {
          const chunk = need.slice(i, i + 30);
          try { (await fb.fs.collection('profiles').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()).docs.forEach(d => profiles.set(d.id, d.data())); } catch (e) {}
          chunk.forEach(id => { if (!profiles.has(id)) profiles.set(id, null); });
        }
        const out = {};
        ids.forEach(id => {
          const p = profiles.get(id) || {}; const name = String(p.name || 'A reader').slice(0, 40);
          out[id] = { id, name, avatarUrl: /^https:\/\//.test(p.avatarUrl || '') ? p.avatarUrl : initialAvatar(name, id), color: `hsl(${hue(id)},30%,40%)`, email: null, isMe: id === me.id, guest: false, roles: null };
        });
        return out;
      }
    };
  }

  /* ---------- Shelley ---------- */
  async function sample(input, opts = {}) {
    const headers = { 'content-type': 'application/json' };
    if (HAS_FB) {
      const u = fb && fb.auth.currentUser;
      if (!u) throw fail('not_signed_in');
      if (!verifiedUser(u)) throw fail('unverified', 'Please verify your email first: open the link we sent you, then choose “I have verified it” in your account. After that, ask me anything.');
      headers.authorization = 'Bearer ' + await u.getIdToken();
    }
    const messages = (Array.isArray(input) ? input : [{ role: 'user', content: String(input) }]).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') }));
    let res;
    try { res = await fetch(WORKER + '/shelley', { method: 'POST', headers, body: JSON.stringify({ messages }), signal: opts.signal }); }
    catch (e) { if (e && e.name === 'AbortError') throw e; throw fail('network', 'I could not reach my desk just now. Please check your connection and try again.'); }
    if (res.status === 401) throw fail('not_signed_in');
    if (res.status === 403) { let j = {}; try { j = await res.json(); } catch (e) {} if (j.error === 'unverified') throw fail('unverified', 'Please verify your email first: open the link we sent you, then choose “I have verified it” in your account.'); throw fail('error'); }
    if (res.status === 429) {
      let j = {}; try { j = await res.json(); } catch (e) {}
      if (j.error === 'daily_limit') { throw fail('daily_limit', `That is all ${j.limit || LIMIT} of today’s free questions. My lamp relights tomorrow, and Patrons will be able to ask as much as they like.`); }
      throw fail('rate_limited');
    }
    if (!res.ok || !res.body) throw fail('error', res.status === 503 ? 'So many readers are asking at once that my candle is guttering. Please try again in a minute.' : undefined);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', stop = '';
    const handle = block => {
      const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
      if (!data) return;
      let j; try { j = JSON.parse(data); } catch (e) { return; }
      if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') { text += j.delta.text; if (opts.onText) opts.onText({ text, delta: j.delta.text }); }
      else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason) stop = j.delta.stop_reason;
      else if (j.type === 'error') throw fail('error');
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let i; while ((i = buf.indexOf('\n\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2); }
    }
    if (buf.trim()) handle(buf);
    if (!text) throw fail('error');
    return { text, truncated: stop === 'max_tokens' };
  }

  /* ---------- read-aloud (the browser's own voices) ---------- */
  function makeTts() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
    const ss = window.speechSynthesis; let run = 0;
    const voice = () => { const vs = ss.getVoices(); return vs.find(v => /en-GB/i.test(v.lang) && /female|serena|kate|libby|sonia|martha/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; };
    const chunks = t => (String(t).match(/[^.!?;:]+[.!?;:]*\s*/g) || [String(t)]).reduce((a, s) => { if (a.length && (a[a.length - 1] + s).length < 220) a[a.length - 1] += s; else a.push(s); return a; }, []);
    return {
      speak: (text, _o) => new Promise(res => {
        ss.cancel(); const id = ++run; const parts = chunks(text); const v = voice(); let i = 0;
        const next = () => {
          if (id !== run || i >= parts.length) return res();
          const u = new SpeechSynthesisUtterance(parts[i++]); if (v) u.voice = v; u.rate = 0.97;
          u.onend = next; u.onerror = () => res(); ss.speak(u);
        };
        next();
      }),
      stop: () => { run++; ss.cancel(); }
    };
  }

  /* ---------- what the app asks for ---------- */
  window.itslitRuntime = {
    use: async name => {
      if (name === 'tts') return makeTts();
      if (name === 'sample') { if (!HAS_AI) return null; if (!HAS_FB) return sample; return (await boot()) ? sample : null; }
      const f = await boot(); if (!f) return null;
      if (name === 'db') return makeDb();
      if (name === 'user') return makeUser();
      return null;
    }
  };
  if (HAS_FB) window.itslitAuth = { open: () => openAuth(), user: () => (booted ? (fb && fb.u) || null : 'pending') };
  if (BEEHIIV || HAS_FB) window.itslitApi = {
    subscribe: async (email, src) => {
      email = String(email || '').trim().toLowerCase().slice(0, 200); src = String(src || 'site').slice(0, 40);
      if (BEEHIIV) { const r = await fetch(WORKER + '/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, src }) }); if (!r.ok) throw fail('error'); return; }
      const f = await boot(); if (!f) throw fail('error');
      await guard(f.fs.collection('subscribers').add({ email, src, ts: Date.now() }));
    }
  };

  /* ---------- the account button and panel ---------- */
  const AUTH_ERR = {
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site, or use your email below.',
    'auth/popup-closed-by-user': '', 'auth/cancelled-popup-request': '', 'auth/user-cancelled': '',
    'auth/operation-not-supported-in-this-environment': 'Google sign-in does not work here. Please use your email below.',
    'auth/unauthorized-domain': 'This web address is not approved for sign-in yet. (Editors: add it in Firebase → Authentication → Settings → Authorized domains.)',
    'auth/operation-not-allowed': 'This way of signing in is switched off. (Editors: turn it on in Firebase → Authentication → Sign-in method.)',
    'auth/invalid-email': 'That email address looks incomplete.',
    'auth/missing-password': 'Please enter your password.',
    'auth/weak-password': 'Please choose a password of at least 8 characters.',
    'auth/email-already-in-use': 'There is already an account with that email. Sign in instead, or reset the password.',
    'auth/invalid-credential': 'That email and password do not match an account.', 'auth/wrong-password': 'That email and password do not match an account.', 'auth/user-not-found': 'That email and password do not match an account.',
    'auth/too-many-requests': 'Too many tries. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Please check your internet and try again.',
    'auth/requires-recent-login': 'For your safety, please sign out, sign in again, then try once more.',
    'auth/user-disabled': 'This account has been switched off. Please contact us.'
  };
  const authError = e => (AUTH_ERR[e && e.code] ?? 'That did not work. Please try again.');
  const dlg = () => { let d = $('#acctDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'acctDlg'; d.className = 'acct-dlg'; d.setAttribute('aria-label', 'Your ItsLit account'); document.body.append(d); } return d; };
  const say = m => { const p = $('#acctDlg .acct-msg'); if (p) p.textContent = m; };

  function paintAccount() {
    if (!HAS_FB) return;
    const ha = $('.head-actions'), ab = $('.app-bar');
    let hb = $('#acctHead'), ib = $('#acctApp');
    if (!hb && ha) { hb = document.createElement('button'); hb.id = 'acctHead'; hb.type = 'button'; hb.dataset.acct = ''; ha.insertBefore(hb, ha.querySelector('a.btn.primary')); }
    if (!ib && ab) { ib = document.createElement('button'); ib.id = 'acctApp'; ib.type = 'button'; ib.dataset.acct = ''; ab.insertBefore(ib, ab.querySelector('a[href="#shelf"]')); }
    const u = fb && fb.u, img = u ? `<img src="${esc(myAvatar())}" alt="" referrerpolicy="no-referrer">` : '';
    if (hb) {
      hb.className = u || !booted ? 'icon-btn acct-btn' : 'btn small acct-btn';
      hb.innerHTML = u ? `${img}<span class="acct-name">${esc(fb.name)}</span>` : booted ? 'Sign in' : PERSON;
      hb.setAttribute('aria-label', u ? 'Your account' : 'Sign in or join');
    }
    if (ib) { ib.className = 'icon-btn acct-btn'; ib.innerHTML = u ? img : PERSON; ib.setAttribute('aria-label', u ? 'Your account' : 'Sign in or join'); }
  }

  function openAuth(mode) {
    if (!HAS_FB) return;
    const d = dlg();
    if (!booted) { d.innerHTML = '<p>One moment…</p>'; if (!d.open) d.showModal(); boot().then(() => openAuth(mode)); return; }
    if (!fb) d.innerHTML = '<button class="x" type="button" data-auth="close" aria-label="Close">×</button><h3>Accounts are resting</h3><p>We could not reach the reading club’s accounts just now. Please try again in a little while.</p>';
    else if (fb.u) accountView();
    else signInView(mode || 'in');
    if (!d.open) d.showModal();
  }
  function signInView(mode, note) {
    const up = mode === 'up';
    dlg().innerHTML = `<button class="x" type="button" data-auth="close" aria-label="Close">×</button>
<h3>${up ? 'Join the reading club' : 'Welcome, reader'}</h3>
<p class="small" style="margin-bottom:14px">Free for every reader. Post in the Salon, talk with Shelley and keep your shelf on every device.</p>
${NATIVE ? '' : `<button class="btn wide google-btn" type="button" data-auth="google">${GOOGLE} Continue with Google</button><div class="or"><span>or with your email</span></div>`}
<form class="acct-form" data-auth-form="${up ? 'up' : 'in'}" novalidate>
  <label for="acctEmail">Email</label><input id="acctEmail" type="email" autocomplete="email" required>
  <label for="acctPw">Password${up ? ' (at least 8 characters)' : ''}</label><input id="acctPw" type="password" minlength="8" autocomplete="${up ? 'new-password' : 'current-password'}" required>
  <button class="btn primary wide" type="submit">${up ? 'Create my account' : 'Sign in'}</button>
</form>
<p class="small acct-alt">${up ? 'Already a member? <button type="button" class="linkish" data-auth="mode-in">Sign in</button>' : 'New here? <button type="button" class="linkish" data-auth="mode-up">Create an account</button> · <button type="button" class="linkish" data-auth="reset">Forgot password?</button>'}</p>
<p class="small acct-msg" aria-live="polite">${esc(note || '')}</p>
<p class="small fine">For readers 13 and over. By joining you agree to the <a href="privacy.html">house rules and privacy notice</a>.</p>`;
  }
  function accountView(note) {
    const u = fb.u, unverified = !verifiedUser(u);
    dlg().innerHTML = `<button class="x" type="button" data-auth="close" aria-label="Close">×</button>
<h3>Your account</h3>
<div class="acct-card"><img src="${esc(myAvatar())}" alt="" referrerpolicy="no-referrer"><div><b>${esc(fb.name)}</b><br><span class="small">${esc(u.email || '')}</span></div></div>
${unverified ? `<div class="notice" style="margin-bottom:14px">Please verify your email to post in the Salon and talk with Shelley. We sent a link to ${esc(u.email)}.<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="btn small primary" type="button" data-auth="verified">I have verified it</button><button class="btn small ghost" type="button" data-auth="resend">Send the link again</button></div></div>` : ''}
${fb.isEditor ? '<p class="notice" style="margin-bottom:14px">You are an editor of the Gazette. <a href="#desk" data-auth="close">Open the writing desk</a></p>' : ''}
<form class="acct-form" data-auth-form="name"><label for="acctName">Your name in the Salon</label><div class="row" style="gap:8px"><input id="acctName" type="text" maxlength="40" required value="${esc(fb.name)}"><button class="btn small" type="submit">Save</button></div></form>
<div class="row acct-foot"><button class="btn" type="button" data-auth="out">Sign out</button><span class="spacer"></span><button class="btn small ghost danger" type="button" data-auth="delete">Delete my account</button></div>
<p class="small acct-msg" aria-live="polite">${esc(note || '')}</p>`;
  }

  async function deleteEverything() {
    const u = fb.u, fs = fb.fs;
    if (Date.now() - Date.parse(u.metadata.lastSignInTime || 0) > 5 * 60e3) { say('For your safety, please sign out and sign in again, then delete within five minutes.'); return; }
    say('Deleting your account…');
    try {
      const posts = await fs.collection('posts').where('author', '==', u.uid).get();
      const refs = posts.docs.map(d => d.ref).concat(['shelves', 'waitlist', 'profiles', 'subscribers'].map(c => fs.doc(c + '/' + u.uid)));
      for (let i = 0; i < refs.length; i += 400) { const b = fs.batch(); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); }
      ['shelf', 'wait', 'sub', 'chat'].forEach(k => LS.del(k));
      await u.delete(); // signing out reloads the page
    } catch (e) { say(authError(e)); }
  }

  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-acct],[data-auth],[data-install]');
    if (!t) return;
    if (t.hasAttribute('data-acct')) return openAuth();
    if (t.hasAttribute('data-install')) return install();
    const a = t.dataset.auth, d = dlg();
    if (a === 'close') { d.close(); return; }
    if (!fb) return;
    if (a === 'mode-in' || a === 'mode-up') return signInView(a.slice(5));
    if (a === 'google') {
      say('Opening Google…');
      try { const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await fb.auth.signInWithPopup(p); say('Signed in. One moment…'); }
      catch (err) { say(authError(err)); }
      return;
    }
    if (a === 'reset') {
      const email = ($('#acctEmail') || {}).value || '';
      if (!email.trim()) { say('Type your email above, then choose “Forgot password?” again.'); return; }
      try { await fb.auth.sendPasswordResetEmail(email.trim()); say('If there is an account for that email, a reset link is on its way.'); }
      catch (err) { say(err && err.code === 'auth/user-not-found' ? 'If there is an account for that email, a reset link is on its way.' : authError(err)); }
      return;
    }
    if (a === 'out') { say('Signing out…'); await fb.auth.signOut(); return; }
    if (a === 'resend') { try { await fb.u.sendEmailVerification(); say('Sent. Check your inbox (and the spam folder).'); } catch (err) { say(authError(err)); } return; }
    if (a === 'verified') {
      try { await fb.u.reload(); if (fb.auth.currentUser.emailVerified) { await fb.auth.currentUser.getIdToken(true); say('Verified. Welcome!'); location.reload(); } else say('Not verified yet. Open the link in the email we sent, then try again.'); }
      catch (err) { say(authError(err)); }
      return;
    }
    if (a === 'delete') { t.dataset.auth = 'delete-yes'; t.textContent = 'Yes, delete my account and my posts'; say('This removes your account, your shelf and everything you posted. It cannot be undone.'); return; }
    if (a === 'delete-yes') return deleteEverything();
  });
  document.addEventListener('submit', async e => {
    const f = e.target.closest && e.target.closest('[data-auth-form]');
    if (!f || !fb) return;
    e.preventDefault();
    const kind = f.dataset.authForm, btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (kind === 'name') {
        const name = $('#acctName').value.trim().replace(/\s+/g, ' ').slice(0, 40);
        if (!name) { say('Please write a name.'); return; }
        await fb.fs.doc('profiles/' + fb.u.uid).set({ name, avatarUrl: fb.u.photoURL || '', ts: Date.now() });
        fb.name = name; profiles.set(fb.u.uid, { name, avatarUrl: fb.u.photoURL || '' }); paintAccount(); accountView('Saved. Your posts now show this name.');
        return;
      }
      const email = $('#acctEmail').value.trim(), pw = $('#acctPw').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('That email address looks incomplete.'); return; }
      if (pw.length < (kind === 'up' ? 8 : 1)) { say(kind === 'up' ? 'Please choose a password of at least 8 characters.' : 'Please enter your password.'); return; }
      say(kind === 'up' ? 'Creating your account…' : 'Signing in…');
      if (kind === 'up') {
        fb.hold = true; // keep the page until the welcome email has gone
        try {
          const cred = await fb.auth.createUserWithEmailAndPassword(email, pw);
          LS.set('openAcct', 1);
          try { await cred.user.sendEmailVerification(); } catch (err) {}
          location.reload();
        } finally { fb.hold = false; }
      } else await fb.auth.signInWithEmailAndPassword(email, pw);
    } catch (err) { say(authError(err)); }
    finally { btn.disabled = false; }
  });

  /* ---------- install as an app, offline reading, theme colour ---------- */
  let deferred = null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const showInstall = on => document.querySelectorAll('[data-install]').forEach(b => { b.hidden = !on || NATIVE || standalone(); });
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; showInstall(true); });
  addEventListener('appinstalled', () => { deferred = null; showInstall(false); toast('ItsLit is installed. Find it with your other apps.'); });
  async function install() {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; showInstall(false); return; }
    const d = dlg();
    d.innerHTML = `<button class="x" type="button" data-auth="close" aria-label="Close">×</button><h3>Install ItsLit</h3>
<p><b>iPhone or iPad:</b> in Safari, tap the Share button, then <b>Add to Home Screen</b>.</p>
<p><b>Android:</b> open the browser menu and choose <b>Install app</b> (or Add to Home screen).</p>
<p><b>Computer:</b> in Chrome or Edge, use the install icon at the right of the address bar. In Safari on a Mac: File → Add to Dock.</p>
<p class="small">ItsLit then opens in its own window with its own icon, and the Library works offline.</p>`;
    if (!d.open) d.showModal();
  }
  const ready = () => {
    // the install buttons: in the site header, the app's More sheet, and the footer
    const ha = $('.head-actions');
    if (ha && !$('#installHead')) { const b = document.createElement('button'); b.id = 'installHead'; b.type = 'button'; b.className = 'btn small ghost install-btn'; b.dataset.install = ''; b.hidden = true; b.textContent = 'Get the app'; ha.insertBefore(b, ha.querySelector('.theme-btn')); }
    const sl = $('#moreSheet .sheet-links');
    if (sl && !$('#installSheet')) { const b = document.createElement('button'); b.id = 'installSheet'; b.type = 'button'; b.dataset.install = ''; b.hidden = true; b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Install the app'; sl.insertBefore(b, sl.querySelector('.theme-btn')); }
    showInstall(!!deferred || (IOS && !standalone()));
    paintAccount();
    const meta = $('meta[name=theme-color]');
    const paint = () => { if (!meta) return; const t = root.dataset.theme; meta.content = (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '#121011' : '#F4EEE3'; };
    new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
    paint();
    if (HAS_FB) boot();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
