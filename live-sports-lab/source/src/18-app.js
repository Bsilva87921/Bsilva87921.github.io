/* ==========================================================================
   Probable — installable app: service worker (offline starts, last data kept),
   the Install app button in the top strip, and ?ask= links into Ask AI.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP; let done = false;
  APP.onRender.push(() => {
    if (done || !window.PAPP) return; done = true;
    window.PAPP.init({ sw: 'sw.js', scope: '/live-sports-lab/', host: '.site-strip .wrap > span', name: 'Probable Sports Lab' });
    window.PAPP.ask(q => { if (window.CH) window.CH.open(q); });
  });
})();
