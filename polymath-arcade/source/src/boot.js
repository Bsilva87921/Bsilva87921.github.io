/* =====================================================================
   Daily Challenge + boot
   ===================================================================== */
IMPL.daily = {
  play(ctx) {
    const order = ctx.r.shuffle(DOMAIN_ORDER);
    runQuiz(ctx, {
      mode: 'classic', count: 10, perQ: 45,
      gen: (d, r, i) => { const dom = order[i % order.length]; const q = QGEN[dom](4, r); q.kind = DOMAINS[dom] + (q.kind ? ' · ' + q.kind : ''); return q; },
      lesson: 'Mixing subjects in one session, called interleaving, is a well-studied way to make learning stick: each switch makes your brain choose the right tool for the problem.'
    });
  }
};

function onKey(e) {
  if (Tour.active) return;
  if (!$('#modal').hidden) { if (e.key === 'Escape' && modalEsc) { e.preventDefault(); modalEsc(); } return; }
  if (!CUR || $('#game').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); requestExit(); return; }
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (CUR.handleKey(e)) e.preventDefault();
}
function boot(snap) {
  applyTheme();
  $('#soundBtn').addEventListener('click', () => { S.sound = !S.sound; persist(); renderTop(); if (S.sound) SFX.click(); });
  $$('.theme-btn').forEach(b => b.addEventListener('click', toggleTheme));
  BG3D.init();
  startTicker();
  addEventListener('resize', () => placeTabInd());
  $('#brandBtn').addEventListener('click', () => { if (!CUR) App.navTo('home'); });
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => App.navTo(b.dataset.view)));
  $('#tourBtn').addEventListener('click', () => Tour.start());
  $('#installBtn').addEventListener('click', () => App.install());
  $('#gameBack').innerHTML = ICON.close;
  $('#gameBack').addEventListener('click', requestExit);
  document.addEventListener('keydown', onKey);
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged); } catch (e) { /* old browser */ }
  try { new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* ignore */ }
  if (snap && ['home', 'daily', 'profile'].includes(snap.view)) VIEW = snap.view;
  else if (App.hashView()) VIEW = App.hashView();
  if (snap && (snap.filter === 'all' || DOMAINS[snap.filter])) FILTER = snap.filter;
  render();
  try { window.claude?.hot?.snapshot?.(() => ({ view: VIEW, filter: FILTER })); } catch (e) { /* not in viewer */ }
  Cloud.init();
  const wait = App.init();
  if (location.hash === '#tour') setTimeout(() => Tour.start(), wait + 300);
  else if (!S.tour && !S.stats.rounds && !(snap && snap.view)) setTimeout(() => { if (!CUR && $('#modal').hidden && !S.tour && !S.stats.rounds) Tour.start({ auto: true }); }, wait + 1100);
}
const start = snap => boot(snap || {});
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
