/* =====================================================================
   Probable suite branding: footer credit and the About sheet
   ===================================================================== */
const SUITE = {
  product: 'Polymath Arcade',
  suite: 'Probable',
  author: 'Bruno Silva',
  version: '2.2',
  released: 'November 2026',
  links: [
    { label: 'Live Sports Lab', href: 'https://bsilva87921.github.io/live-sports-lab/', note: 'Also in Probable' },
    { label: 'Portfolio', href: 'https://bsilva87921.github.io/' },
    { label: 'GitHub', href: 'https://github.com/Bsilva87921' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/brunosilva1987' }
  ]
};
const pbMark = (cls = 'pb-mark') => `<svg class="${cls}" viewBox="0 0 32 16" aria-hidden="true"><path d="M1.5 14.5C8 14.5 10 2 16 2s8 12.5 14.5 12.5" fill="none" stroke="url(#ringGrad)" stroke-width="2.6" stroke-linecap="round"/><path d="M16 3.5v11" stroke="url(#ringGrad)" stroke-width="1.4" stroke-dasharray="1.6 2"/></svg>`;
const extIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16L16 8M9.5 8H16v6.5"/></svg>';
function suiteLinkEls(cls = 'sf-link') {
  return SUITE.links.map(l => h('a', { class: cls, href: l.href, target: '_blank', rel: 'noopener', title: l.note || l.label },
    l.note ? h('small', null, l.note) : null, h('span', null, l.label), h('span', { class: 'ext', html: extIcon })));
}
function suiteFooterEl() {
  return h('footer', { class: 'suite-foot', 'aria-label': 'About Polymath Arcade' },
    h('div', { class: 'sf-main' },
      h('div', { class: 'sf-brand' },
        h('span', { class: 'sf-suite', html: pbMark() + '<span>Probable suite</span>' }),
        h('strong', null, SUITE.product),
        h('p', null, 'Designed and built by ', h('b', { class: 'sig' }, SUITE.author), '. One of the apps in Probable, his suite of data, statistics and analytics tools.')),
      h('div', { class: 'sf-links' }, ...suiteLinkEls(),
        h('button', { class: 'sf-link', type: 'button', onclick: () => openAbout() }, h('span', null, 'About this app')))),
    h('p', { class: 'sf-legal' }, `© ${new Date().getFullYear()} ${SUITE.author} · ${SUITE.suite} · ${SUITE.product} v${SUITE.version}`));
}
function openAbout() {
  const facts = [['21', 'games'], ['10', 'subjects'], ['10', 'adaptive levels'], ['1000s', 'of questions']];
  const body = h('div', { class: 'about' },
    h('div', { class: 'about-hero' },
      h('div', { class: 'about-cube', 'aria-hidden': 'true' }, h('span', { class: 'cube big' }, ...['Pm', 'Ar', 'Ec', 'Rc', 'Ms', 'Lx'].map(t => h('i', null, t)))),
      h('div', null,
        h('span', { class: 'sf-suite', html: pbMark() + '<span>A Probable app</span>' }),
        h('h2', null, SUITE.product),
        h('p', { class: 'lede' }, 'Short, adaptive brain games that build real skills in math, English, physics, coding, science, finance, economics, business and the real world.'))),
    h('div', { class: 'about-facts' }, facts.map(([n, k]) => h('div', null, h('b', null, n), h('small', null, k)))),
    h('div', { class: 'about-credit' },
      h('small', null, 'Designed and built by'),
      h('strong', { class: 'sig' }, SUITE.author),
      h('p', null, 'Polymath Arcade is part of Probable, Bruno’s suite of data, statistics and analytics apps, alongside Live Sports Lab.')),
    h('h3', null, 'Under the hood'),
    h('p', { class: 'about-tech' }, 'A hand-written WebGL renderer for the crystal field, CSS 3D for tiles and boards, the View Transitions API, synthesized Web Audio sound effects, and seeded generators for thousands of questions. One file, no frameworks, and it installs as an app that works offline.'),
    h('div', { class: 'sf-links about-links' }, ...suiteLinkEls()),
    h('p', { class: 'sf-legal' }, `Version ${SUITE.version} · ${SUITE.released} · © ${new Date().getFullYear()} ${SUITE.author}`),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => { closeModal(); Tour.start(); } }, 'Take the tour'),
      h('button', { class: 'btn primary', type: 'button', onclick: closeModal, 'data-autofocus': true }, 'Close')));
  openModal(body, { label: 'About Polymath Arcade', dc: 'var(--accent)' });
}
