/* ---------- The 3D bookcase (Three.js r128, loaded from cdnjs; CSS shelf fallback) ---------- */
const Shelf3D = (() => {
  const W = 4.6, H = 5.4, D = 1.0, TH = 0.14, SH = 0.1;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = { ok: false, failed: false, loading: null, slot: null, theme: 'light' };
  let T, renderer, scene, camera, root, ray, ptr, books = [], shelfY = [], lights = {}, dust, globe, flame, sand;
  let raf = 0, running = false, hovered = null, selected = null, last = 0, yaw = 0, yawT = 0, pitch = 0, pitchT = 0;
  let drag = null, lastMove = 0, inView = true, ptrDirty = false, pagesMat = null, maxAniso = 4;
  const el = document.createElement('div');
  el.className = 'stage3d';
  el.innerHTML = '<div class="tip3d" aria-hidden="true"></div><div class="pick3d" role="region" aria-live="polite" aria-label="Book taken from the shelf"></div><span class="hint">Drag to look around · tap a spine to pull it out</span>';
  const tip = el.querySelector('.tip3d'), pick = el.querySelector('.pick3d'), hint = el.querySelector('.hint');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const esc3 = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function load() {
    return st.loading || (st.loading = new Promise((res, rej) => {
      if (window.THREE) return res();
      const s = document.createElement('script');
      s.src = window.ITSLIT_THREE_URL || 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.async = true;
      s.onload = () => (window.THREE ? res() : rej(new Error('no three')));
      s.onerror = () => rej(new Error('three failed'));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('timeout')), 15000);
    }));
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      Promise.all([document.fonts.load('600 48px "Bodoni Moda"'), document.fonts.load('italic 500 24px "EB Garamond"')]).catch(() => {}),
      new Promise(r => setTimeout(r, 2500))
    ]);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, wrap) {
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = maxAniso;
    if (wrap) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function grain(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); } }
  function woodTex(vertical) {
    const c = canvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#5a3922'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 110; i++) {
      const y = Math.random() * 512;
      g.strokeStyle = Math.random() < .5 ? `rgba(40,20,8,${.08 + Math.random() * .2})` : `rgba(150,95,55,${.05 + Math.random() * .12})`;
      g.lineWidth = .8 + Math.random() * 2.6;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 24) g.lineTo(x, y + Math.sin(x / 60 + i) * 3 + (Math.random() - .5) * 1.5);
      g.stroke();
    }
    const t = tex(c, true);
    if (vertical) { t.center.set(.5, .5); t.rotation = Math.PI / 2; }
    return t;
  }
  function stripeTex() {
    const c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#3a1820'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = '#46202a'; g.fillRect(x, 0, 16, 256);
      g.fillStyle = 'rgba(205,165,95,.22)'; g.fillRect(x, 0, 1, 256); g.fillRect(x + 16, 0, 1, 256);
    }
    grain(g, 256, 256, 1500, .08);
    const t = tex(c, true); t.repeat.set(3, 3); return t;
  }
  function pagesTex() {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#efe5cf'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(150,125,90,${.15 + Math.random() * .25})`; g.fillRect(x, 0, 1, 128); }
    return tex(c, true);
  }
  function emblem(g, key, cx, cy, size, color, lw) {
    const p = new Path2D(EMBLEMS[key]); const s = size / 64;
    g.save(); g.translate(cx - 32 * s, cy - 32 * s); g.scale(s, s);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(p); g.restore();
  }
  function leather(g, w, h, color, horizontal) {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const gr = horizontal ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, w, h);
    if (horizontal) { gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.2, 'rgba(0,0,0,.06)'); gr.addColorStop(.5, 'rgba(255,255,255,.14)'); gr.addColorStop(.8, 'rgba(0,0,0,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.5)'); }
    else { gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    grain(g, w, h, Math.round(w * h / 60), .09);
  }
  function fitFont(g, text, weight, family, max, maxW) {
    let fs = max; g.font = `${weight} ${fs}px ${family}`;
    while (g.measureText(text).width > maxW && fs > 10) { fs -= 1; g.font = `${weight} ${fs}px ${family}`; }
    return fs;
  }
  function spineMat(b, w, h) {
    const ch = 512, cw = Math.max(96, Math.round(ch * w / h)), c = canvas(cw, ch), g = c.getContext('2d');
    leather(g, cw, ch, b.spine, true);
    const gilt = '#DDB968';
    const band = y => { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y - 7, cw, 14); g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(0, y - 7, cw, 3); g.fillStyle = gilt; g.fillRect(0, y - 11, cw, 2); g.fillRect(0, y + 9, cw, 2); };
    [.06, .19, .82, .94].forEach(f => band(f * ch));
    emblem(g, b.em, cw / 2, ch * .125, Math.min(cw * .55, ch * .085), gilt, 3.4);
    g.save(); g.translate(cw / 2, ch * .505); g.rotate(Math.PI / 2);
    fitFont(g, b.st, 600, '"Bodoni Moda", Georgia, serif', Math.min(cw * .42, 46), ch * .54);
    g.fillStyle = gilt; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowOffsetY = 1.5; g.shadowBlur = 1;
    g.fillText(b.st, 0, 0); g.restore();
    g.shadowColor = 'transparent';
    fitFont(g, b.sur, 'italic 500', '"EB Garamond", Georgia, serif', Math.min(cw * .22, 24), cw * .86);
    g.fillStyle = gilt; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.sur, cw / 2, ch * .88);
    return new T.MeshStandardMaterial({ map: tex(c), roughness: .52, metalness: .04 });
  }
  function coverTex(b, d, h) {
    const ch = 640, cw = Math.round(ch * d / h), c = canvas(cw, ch), g = c.getContext('2d');
    leather(g, cw, ch, b.spine, false);
    const gilt = '#DDB968';
    g.strokeStyle = gilt; g.lineWidth = 3; g.strokeRect(24, 24, cw - 48, ch - 48);
    g.lineWidth = 1.4; g.strokeRect(34, 34, cw - 68, ch - 68);
    for (const [x, y] of [[34, 34], [cw - 34, 34], [34, ch - 34], [cw - 34, ch - 34]]) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = gilt; g.fillRect(-6, -6, 12, 12); g.restore(); }
    emblem(g, b.em, cw / 2, ch * .36, cw * .42, gilt, 2.6);
    g.fillStyle = gilt; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let fs = 46; g.font = `600 ${fs}px "Bodoni Moda", Georgia, serif`;
    const words = b.t.split(' '), maxW = cw * .74; let lines;
    for (;;) {
      lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
      lines.push(cur);
      if (lines.length <= 3 || fs <= 26) break;
      fs -= 2; g.font = `600 ${fs}px "Bodoni Moda", Georgia, serif`;
    }
    const y0 = ch * .66 - (lines.length - 1) * fs * .55;
    lines.forEach((l, i) => g.fillText(l, cw / 2, y0 + i * fs * 1.1));
    fitFont(g, b.a, 'italic 500', '"EB Garamond", Georgia, serif', 26, cw * .74);
    g.fillText(b.a, cw / 2, ch * .87);
    return tex(c);
  }
  function addBox(w, h, d, mat, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  function buildCase() {
    const wood = new T.MeshStandardMaterial({ map: woodTex(false), roughness: .7 });
    const woodV = new T.MeshStandardMaterial({ map: woodTex(true), roughness: .7 });
    const gold = new T.MeshStandardMaterial({ color: 0xC9A45A, metalness: .85, roughness: .35 });
    addBox(TH, H, D, woodV, -W / 2 + TH / 2, 0, 0);
    addBox(TH, H, D, woodV, W / 2 - TH / 2, 0, 0);
    addBox(W + .26, .2, D + .18, wood, 0, H / 2 + .08, .03);
    addBox(W + .1, .06, D + .1, gold, 0, H / 2 - .04, .03);
    addBox(W, TH, D, wood, 0, -H / 2 + TH / 2, 0);
    addBox(W + .18, .2, D + .12, wood, 0, -H / 2 - .1, .03);
    const back = new T.Mesh(new T.PlaneGeometry(W - 2 * TH, H - 2 * TH), new T.MeshStandardMaterial({ map: stripeTex(), roughness: .92 }));
    back.position.set(0, 0, -D / 2 + .01); back.receiveShadow = true; root.add(back);
    const comp = (H - 2 * TH - 2 * SH) / 3;
    let y = -H / 2 + TH;
    for (let i = 0; i < 3; i++) {
      shelfY.push(y);
      y += comp;
      if (i < 2) { addBox(W - 2 * TH, SH, D - .04, wood, 0, y + SH / 2, -.02); y += SH; }
    }
    for (const fy of shelfY) addBox(W - 2 * TH, .03, .02, gold, 0, fy - .018, D / 2 - .02);
  }
  function buildBooks() {
    pagesMat = new T.MeshStandardMaterial({ map: pagesTex(), roughness: .95 });
    const rows = [[0, 7, 2], [7, 14, 1], [14, 20, 0]];
    for (const [a, b, ci] of rows) {
      let x = -W / 2 + TH + .1;
      for (let i = a; i < b && i < BOOKS.length; i++) {
        const bk = BOOKS[i], hh = hash(bk.id);
        const w = .26 + Math.min(bk.pages / 1300, 1) * .34, h = 1.04 + (hh % 5) * .055, d = .74 + ((hh >> 4) % 3) * .03;
        const cover = new T.MeshStandardMaterial({ color: bk.spine, roughness: .58 });
        const backM = new T.MeshStandardMaterial({ color: bk.spine, roughness: .62 });
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), [cover, backM, pagesMat, pagesMat, spineMat(bk, w, h), pagesMat]);
        const bx = x + w / 2, by = shelfY[ci] + h / 2 + .002, bz = D / 2 - d / 2 - .06;
        m.position.set(bx, by, bz); m.castShadow = true; m.receiveShadow = true;
        m.userData = { book: bk, base: new T.Vector3(bx, by, bz), hov: 0, sel: 0, d, h, covered: false };
        root.add(m); books.push(m);
        x += w + .014;
      }
      st['end' + ci] = x;
    }
  }
  function buildProps() {
    const brass = new T.MeshStandardMaterial({ color: 0xB8893B, metalness: .9, roughness: .3 });
    const woodDark = new T.MeshStandardMaterial({ color: 0x3b2414, roughness: .6 });
    const right = W / 2 - TH;
    // celestial globe, top shelf
    const gx = (st.end2 + right) / 2, gy = shelfY[2];
    const gc = canvas(512, 256), gg = gc.getContext('2d');
    gg.fillStyle = '#16253d'; gg.fillRect(0, 0, 512, 256);
    gg.strokeStyle = 'rgba(221,185,104,.65)'; gg.lineWidth = 1.2;
    for (let x = 0; x <= 512; x += 43) { gg.beginPath(); gg.moveTo(x, 0); gg.lineTo(x, 256); gg.stroke(); }
    for (let y = 32; y < 256; y += 32) { gg.beginPath(); gg.moveTo(0, y); gg.lineTo(512, y); gg.stroke(); }
    gg.lineWidth = 2; gg.beginPath(); for (let x = 0; x <= 512; x += 8) gg.lineTo(x, 128 + Math.sin(x / 512 * Math.PI * 2) * 52); gg.stroke();
    for (let i = 0; i < 140; i++) { gg.fillStyle = `rgba(240,215,150,${.4 + Math.random() * .6})`; gg.beginPath(); gg.arc(Math.random() * 512, Math.random() * 256, Math.random() * 1.8 + .4, 0, 7); gg.fill(); }
    globe = new T.Mesh(new T.SphereGeometry(.3, 40, 28), new T.MeshStandardMaterial({ map: tex(gc), roughness: .45, metalness: .1 }));
    globe.position.set(gx, gy + .5, .08); globe.rotation.z = .4; globe.castShadow = true; root.add(globe);
    const ring = new T.Mesh(new T.TorusGeometry(.34, .012, 8, 64), brass); ring.position.copy(globe.position); ring.rotation.set(0, Math.PI / 2, .4); root.add(ring);
    const stem = new T.Mesh(new T.CylinderGeometry(.018, .018, .16, 12), brass); stem.position.set(gx, gy + .1, .08); root.add(stem);
    const foot = new T.Mesh(new T.CylinderGeometry(.08, .15, .05, 24), brass); foot.position.set(gx, gy + .025, .08); foot.castShadow = true; root.add(foot);
    // candle, middle shelf
    const cx = (st.end1 + right) / 2, cy = shelfY[1];
    const dish = new T.Mesh(new T.CylinderGeometry(.17, .19, .03, 28), brass); dish.position.set(cx, cy + .015, .16); dish.castShadow = true; root.add(dish);
    const stick = new T.Mesh(new T.CylinderGeometry(.05, .07, .12, 20), brass); stick.position.set(cx, cy + .09, .16); root.add(stick);
    const wax = new T.Mesh(new T.CylinderGeometry(.055, .058, .46, 20), new T.MeshStandardMaterial({ color: 0xF1E6CF, roughness: .8, emissive: 0x442200, emissiveIntensity: .15 }));
    wax.position.set(cx, cy + .38, .16); wax.castShadow = true; root.add(wax);
    flame = new T.Mesh(new T.SphereGeometry(.03, 16, 12), new T.MeshBasicMaterial({ color: 0xFFD27A }));
    flame.scale.set(1, 2.3, 1); flame.position.set(cx, cy + .66, .16); root.add(flame);
    const halo = new T.Mesh(new T.SphereGeometry(.09, 16, 12), new T.MeshBasicMaterial({ color: 0xFFB45A, transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending }));
    halo.scale.set(1, 1.6, 1); flame.add(halo);
    lights.candle = new T.PointLight(0xFFB36B, 1.2, 6.5, 2); lights.candle.position.set(cx, cy + .72, .3); root.add(lights.candle);
    // hourglass, bottom shelf
    const hx = (st.end0 + right) / 2 - .05, hy = shelfY[0];
    const cap = h => { const m = new T.Mesh(new T.CylinderGeometry(.2, .2, .045, 28), woodDark); m.position.set(hx, hy + h, .1); m.castShadow = true; root.add(m); };
    cap(.0225); cap(.6375);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, p = new T.Mesh(new T.CylinderGeometry(.012, .012, .59, 8), woodDark); p.position.set(hx + Math.cos(a) * .16, hy + .33, .1 + Math.sin(a) * .16); root.add(p); }
    const glass = new T.MeshStandardMaterial({ color: 0xDDE8F0, transparent: true, opacity: .28, roughness: .1, metalness: .2, depthWrite: false });
    const upper = new T.Mesh(new T.ConeGeometry(.14, .28, 24, 1, true), glass); upper.position.set(hx, hy + .47, .1); upper.rotation.x = Math.PI; root.add(upper);
    const lower = new T.Mesh(new T.ConeGeometry(.14, .28, 24, 1, true), glass); lower.position.set(hx, hy + .19, .1); root.add(lower);
    sand = new T.Mesh(new T.ConeGeometry(.1, .1, 20), new T.MeshStandardMaterial({ color: 0xC79A4E, roughness: 1 })); sand.position.set(hx, hy + .1, .1); root.add(sand);
  }
  function buildLights() {
    lights.hemi = new T.HemisphereLight(0xFFF4E0, 0x2A1A10, .6); scene.add(lights.hemi);
    lights.key = new T.DirectionalLight(0xFFF1DC, .9); lights.key.position.set(-3.5, 4.5, 6.5);
    lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024);
    Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    lights.key.shadow.bias = -.0008; scene.add(lights.key);
    lights.fill = new T.PointLight(0x9FB6D6, .25, 14); lights.fill.position.set(3.5, -1, 5); scene.add(lights.fill);
  }
  function buildDust() {
    const n = 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * W * 1.2; pos[i * 3 + 1] = (Math.random() - .5) * H; pos[i * 3 + 2] = D / 2 + .1 + Math.random() * 1.6; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    dust = new T.Points(g, new T.PointsMaterial({ color: 0xFFE2A8, size: .035, transparent: true, opacity: .35, depthWrite: false, blending: T.AdditiveBlending }));
    root.add(dust);
  }
  function applyTheme() {
    if (!renderer) return;
    const dark = st.theme === 'dark';
    lights.hemi.intensity = dark ? .3 : .78;
    lights.key.intensity = dark ? .42 : 1.0;
    lights.fill.intensity = dark ? .35 : .18;
    st.candleBase = dark ? 2.0 : .75;
    dust.material.opacity = dark ? .55 : .22;
    renderer.toneMappingExposure = dark ? 1.0 : 1.08;
  }
  function init() {
    T = window.THREE;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
    const cv = renderer.domElement;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'A 3D bookcase of the twenty ItsLit classics. Every book is also listed in the Library.');
    el.prepend(cv);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, 1, .1, 100);
    root = new T.Group(); scene.add(root);
    buildCase(); buildBooks(); buildProps(); buildLights(); buildDust();
    ray = new T.Raycaster(); ptr = new T.Vector2(-9, -9);
    cv.addEventListener('pointermove', e => {
      setPtr(e); lastMove = performance.now(); ptrDirty = true;
      if (drag) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true; yawT = clamp(drag.yaw + dx * .004, -.6, .6); }
      else { yawT = ptr.x * .16; pitchT = -ptr.y * .05; }
      moveTip(e);
    });
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: yawT, moved: false }; hint.style.opacity = 0; });
    cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && !d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) { setPtr(e); click(); } });
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('pointerleave', () => { drag = null; ptr.set(-9, -9); ptrDirty = true; tip.style.opacity = 0; el.classList.remove('hovering'); });
    pick.addEventListener('click', e => { if (e.target.closest('[data-put]')) deselect(); });
    new ResizeObserver(resize).observe(el);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; inView ? start() : stop(); }).observe(el);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    applyTheme();
  }
  function setPtr(e) { const r = el.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  function moveTip(e) { const r = el.getBoundingClientRect(); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; }
  function hit() {
    ray.setFromCamera(ptr, camera);
    const hs = ray.intersectObjects(books, false);
    return hs.length ? hs[0].object : null;
  }
  function click() {
    const m = hit();
    if (!m) return deselect();
    if (m === selected) { location.hash = '#book-' + m.userData.book.id; return; }
    select(m);
  }
  function select(m) {
    selected = m; const u = m.userData, b = u.book;
    if (!u.covered) { m.material[0].map = coverTex(b, u.d, u.h); m.material[0].color.set(0xffffff); m.material[0].needsUpdate = true; u.covered = true; }
    tip.style.opacity = 0;
    pick.innerHTML = `<p class="kicker" style="margin:0">${esc3(b.yr)} · ${esc3(b.a)}</p><h3>${esc3(b.t)}</h3><p>${esc3(b.line)}</p><div class="row"><a class="btn primary small" href="#book-${b.id}">Open the breakdown</a><button class="btn small" type="button" data-ask="${b.id}">Ask Shelley</button><button class="btn small ghost" type="button" data-put>Put it back</button></div>`;
    pick.classList.add('on');
    setTimeout(() => { if (pick.classList.contains('on')) pick.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 420);
  }
  function deselect() { selected = null; pick.classList.remove('on'); }
  function resize() {
    if (!renderer) return;
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 600 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const v = T.MathUtils.degToRad(camera.fov) / 2, a = w / h;
    const dh = (H * 1.08 / 2) / Math.tan(v), dw = ((W + .5) * 1.06 / 2) / (Math.tan(v) * a);
    camera.position.set(0, .05, Math.max(dh, dw) + D / 2);
    camera.lookAt(0, -.05, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const t = now / 1000;
    if (!drag && !RM && now - lastMove > 2500 && !selected) { yawT = Math.sin(t * .25) * .07; pitchT = 0; }
    yaw += (yawT - yaw) * Math.min(1, dt * 4); pitch += (pitchT - pitch) * Math.min(1, dt * 4);
    root.rotation.y = yaw; root.rotation.x = pitch;
    if (ptrDirty && !drag) {
      ptrDirty = false;
      const m = hit();
      if (m !== hovered) {
        hovered = m;
        el.classList.toggle('hovering', !!m);
        if (m && m !== selected) { const b = m.userData.book; tip.innerHTML = `${esc3(b.t)}<i>${esc3(b.a)} · ${esc3(b.yr)}</i>`; tip.style.opacity = 1; }
        else tip.style.opacity = 0;
      }
    }
    for (const m of books) {
      const u = m.userData;
      u.hov += ((m === hovered && m !== selected ? 1 : 0) - u.hov) * Math.min(1, dt * 10);
      u.sel = clamp(u.sel + (m === selected ? dt : -dt) * 1.5, 0, 1);
      const a = ease(clamp(u.sel / .35, 0, 1)), b = ease(clamp((u.sel - .35) / .65, 0, 1));
      const zOut = u.base.z + .9 * a;
      m.position.set(lerp(u.base.x, 0, b), lerp(u.base.y, .85, b), lerp(zOut, D / 2 + 1.9, b) + u.hov * .2);
      m.rotation.y = -Math.PI / 2 * b - u.hov * .07;
      m.rotation.x = b * .08;
      const s = 1 + .25 * b; m.scale.set(s, s, s);
    }
    if (!RM) {
      globe.rotation.y += dt * .25;
      const f = .86 + Math.sin(t * 9.1) * .06 + Math.sin(t * 23.7) * .04 + Math.random() * .04;
      lights.candle.intensity = (st.candleBase || 1) * f;
      flame.scale.set(1 + Math.sin(t * 13) * .08, 2.3 + Math.sin(t * 7) * .25, 1);
      const p = dust.geometry.attributes.position, arr = p.array;
      for (let i = 0; i < arr.length; i += 3) { arr[i + 1] += dt * .06; arr[i] += Math.sin(t * .5 + i) * dt * .02; if (arr[i + 1] > H / 2) arr[i + 1] = -H / 2; }
      p.needsUpdate = true;
    } else lights.candle.intensity = st.candleBase || 1;
    renderer.render(scene, camera);
  }
  function start() { if (st.ok && !running && inView && !document.hidden && el.isConnected) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); running = false; }
  function fallback() {
    el.innerHTML = '<div class="fallback-shelf" aria-label="Bookshelf">' + BOOKS.map(b => `<button class="fb-spine" type="button" style="background:${b.spine}" data-go="${b.id}" title="${esc3(b.t)}">${esc3(b.st)}</button>`).join('') + '</div>';
    el.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) location.hash = '#book-' + b.dataset.go; });
  }
  async function mount(slot) {
    if (!slot) return park();
    slot.appendChild(el); st.slot = slot; deselect();
    if (st.failed) return;
    if (!st.ok) {
      try { await load(); await fontsReady(); if (!el.isConnected) return; init(); st.ok = true; }
      catch (e) { st.failed = true; fallback(); return; }
    }
    resize(); start();
  }
  function park() { stop(); deselect(); if (el.parentNode) el.remove(); }
  function theme(t) { st.theme = t; applyTheme(); }
  return { mount, park, theme, resize, deselect };
})();
