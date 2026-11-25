/* Project 3D: puts a live 3D view of a project's own data into a panel on Bruno's portfolio pages.
   It loads the shared Probable 3D bundle (three.js r186: WebGPU where the browser has it, WebGL 2 otherwise) only
   when the panel is about to be seen, follows the page's light/dark theme, and adds a Motion/Still switch that is
   remembered across the site. If the browser cannot draw 3D, the panel keeps its still image.

   Project3D.mount(host, kind, data, { theme(t, v) }) -> Promise<controller | null>
     host   the panel element (class "px-panel"); its CSS custom properties --px-* carry the colors
     kind   'constellation' | 'cloud' | 'bars' | 'flow' (see assets/probable-3d/source/src)
     data   the scene's data; controller.update(data) redraws it
     theme  optional hook to add scene colors read from the panel: (t, v) => { t.tiers = { now: v('--px-now') } }
   Project3D.transition(fn) runs a theme change inside a view transition where the browser supports one. */
(function () {
  "use strict";
  var me = document.currentScript;
  var BUNDLE = new URL("../probable-3d/probable-3d.js?v=4", me ? me.src : location.href).href;
  var KEY = "px3d-still";
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };
  var reduce = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var still = function () { return reduce() || ls.get(KEY) === "1"; };
  var mod = null;
  function can() {
    try { if (navigator.gpu) return true; var c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch (e) { return false; }
  }
  function load() { return mod || (mod = import(BUNDLE)); }
  var idle = function (fn) { return window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200); };

  function readTheme(host, extra) {
    var cs = getComputedStyle(host);
    var v = function (n, d) { var x = cs.getPropertyValue(n).trim(); return x || d || ""; };
    var t = {
      dark: v("--px-dark", "0") === "1",
      bg: v("--px-bg", "#0f1622"), plate: v("--px-plate", "#131d2c"), ink: v("--px-ink", "#e8edf4"), ink2: v("--px-ink2", "#a3aebf"),
      line: v("--px-line", "#5b6b82"), accent: v("--px-accent", "#d3dceb"),
      series: ["--px-s1", "--px-s2", "--px-s3", "--px-s4", "--px-s5"].map(function (n) { return v(n); }).filter(Boolean)
    };
    if (v("--px-seq-lo")) t.seq = [v("--px-seq-lo"), v("--px-seq-hi")];
    if (!t.series.length) t.series = [t.accent];
    if (extra) extra(t, v);
    return t;
  }

  function motionToggle(host, ctl) {
    if (host.querySelector(".px3d-still")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "px3d-still";
    var paint = function () {
      var s = still();
      b.setAttribute("aria-pressed", String(s));
      b.innerHTML = s ? '<span aria-hidden="true">▶</span> Motion' : '<span aria-hidden="true">❚❚</span> Still';
      b.title = s ? "Turn the 3D motion back on" : "Stop the 3D motion";
    };
    b.addEventListener("click", function () {
      var s = !(ls.get(KEY) === "1"); ls.set(KEY, s ? "1" : "0");
      if (ctl && ctl.setPaused) ctl.setPaused(s || reduce());
      paint();
    });
    paint(); host.appendChild(b);
  }

  function mount(host, kind, data, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!host) return resolve(null);
      if (!can()) { host.classList.add("px-static"); return resolve(null); }
      var started = false;
      var go = function () {
        if (started) return; started = true;
        idle(function () {
          host.classList.add("px-loading");
          var theme = readTheme(host, opts.theme);
          load().then(function (m) {
            return m.mount(host, kind, typeof data === "function" ? data() : data, { reducedMotion: still(), theme: theme, quality: opts.quality });
          }).then(function (ctl) {
            host.classList.remove("px-loading"); host.classList.add("px3d-on");
            motionToggle(host, ctl);
            var last = JSON.stringify(theme);
            var sync = function () {
              var t = readTheme(host, opts.theme), s = JSON.stringify(t);
              if (s !== last) { last = s; ctl.setTheme(t); }
            };
            var mo = new MutationObserver(function () { requestAnimationFrame(sync); });
            mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
            if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
            try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { setTimeout(sync, 30); }); } catch (e) { /* old browsers */ }
            resolve(ctl);
          }).catch(function (e) {
            host.classList.remove("px-loading"); host.classList.add("px-static");
            if (window.console) console.warn("3D view unavailable:", e && e.message ? e.message : e);
            resolve(null);
          });
        });
      };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) {
          if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); }
        }, { rootMargin: "300px 0px" });
        io.observe(host);
      } else go();
    });
  }

  function transition(fn) {
    if (document.startViewTransition && !reduce()) { try { document.startViewTransition(fn); return; } catch (e) { /* fall through */ } }
    fn();
  }

  window.Project3D = { mount: mount, can: can, still: still, transition: transition, readTheme: readTheme };
})();
