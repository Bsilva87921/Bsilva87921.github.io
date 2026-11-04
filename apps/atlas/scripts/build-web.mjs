// Copies Probable Atlas (home screen, Economics, Finance) into www/ for the native app, keeping the site's folder layout
// so every link works. Data files are read from the live site, which refreshes them on a schedule.
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), APPDIR = path.resolve(HERE, '..'), SITE = path.resolve(APPDIR, '../..');
const WWW = path.join(APPDIR, 'www'), PA = path.join(WWW, 'probable-atlas');
fs.rmSync(WWW, { recursive: true, force: true });
for (const d of ['probable-atlas/app', 'probable-atlas/finance', 'assets/probable-3d']) fs.mkdirSync(path.join(WWW, d), { recursive: true });
const boot = '<script>window.PROBABLE_NATIVE = true; window.ATLAS_DATA_BASE = "https://bsilva87921.github.io/probable-atlas/data/";</script>';
const page = (src, dst) => {
  let h = fs.readFileSync(path.join(SITE, src), 'utf8').replace(/<link rel="manifest"[^>]*>/, '');
  h = h.includes('</title>') ? h.replace('</title>', '</title>' + boot) : boot + h;
  fs.writeFileSync(path.join(WWW, dst), h);
};
page('probable-atlas/app/index.html', 'probable-atlas/app/index.html');
page('probable-atlas/index.html', 'probable-atlas/index.html');
page('probable-atlas/finance/index.html', 'probable-atlas/finance/index.html');
fs.copyFileSync(path.join(SITE, 'probable-atlas/ai-config.js'), path.join(PA, 'ai-config.js'));
fs.cpSync(path.join(SITE, 'probable-atlas/icons'), path.join(PA, 'icons'), { recursive: true });
fs.copyFileSync(path.join(SITE, 'assets/probable-3d/probable-3d.js'), path.join(WWW, 'assets/probable-3d/probable-3d.js'));
// photography (AVIF/WebP sizes, no candidates or tools) and the 3D renders, at the same paths as on the website
const media = (dir, keep) => { const src = path.join(SITE, dir), dst = path.join(WWW, dir); fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (keep.test(f)) fs.copyFileSync(path.join(src, f), path.join(dst, f)); };
media('assets/photos', /\.(avif|webp)$/); media('assets/renders', /\.(avif|webp)$/);
fs.writeFileSync(path.join(WWW, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=probable-atlas/app/index.html"><script>location.replace("probable-atlas/app/index.html")</script>');
console.log('www ready');
