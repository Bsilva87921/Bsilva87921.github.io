// Probable photos: downloads every photo in ../manifest.json once, crops it, and writes responsive AVIF and WebP sizes
// next to the manifest, plus photos.json (sizes, aspect, blur placeholder, colour, alt text and credit) for the pages.
// Runs in the "Photos" GitHub workflow (node assets/photos/tools/fetch.mjs). Needs sharp.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRY = path.join(DIR, 'try');
const UA = 'ProbablePhotos/1.0 (portfolio project; +https://bsilva87921.github.io/)';
const M = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const OUTF = path.join(DIR, 'photos.json');
const prev = fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : {};
const out = {};
const cache = new Map();
sharp.cache(false);

const key = p => crypto.createHash('sha1').update(JSON.stringify([p.src, p.crop || null, p.sizes || null, !!p.try])).digest('hex').slice(0, 10);
const srcUrl = s => s.unsplash ? `https://images.unsplash.com/${s.unsplash}?q=92&w=${s.w || 3200}&fm=jpg&fit=max` : s.url;
async function get(url) {
  if (cache.has(url)) return cache.get(url);
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/jpeg,image/*;q=0.9' }, redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 20000) throw new Error('too small: ' + buf.length + ' bytes');
      cache.set(url, buf); return buf;
    } catch (e) { console.log('  retry', i, url.slice(0, 90), String(e.message || e)); await new Promise(r => setTimeout(r, 3000 * i)); }
  }
  throw new Error('download failed: ' + url);
}
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

let made = 0, kept = 0, failed = 0;
for (const p of M.photos) {
  const v = key(p);
  const sizes = p.try ? [960] : (p.sizes || [480, 960, 1600]);
  const dest = p.try ? TRY : DIR;
  const files = sizes.flatMap(w => p.try ? [`${p.id}-${w}.webp`] : [`${p.id}-${w}.avif`, `${p.id}-${w}.webp`]);
  if (prev[p.id] && prev[p.id].v === v && files.every(f => fs.existsSync(path.join(dest, f)))) { out[p.id] = prev[p.id]; kept++; continue; }
  try {
    console.log('photo', p.id);
    const buf = await get(srcUrl(p.src));
    let img = sharp(buf, { limitInputPixels: false }).rotate();
    const meta = await img.metadata();
    let W = meta.width, H = meta.height;
    if (p.crop) {
      // lon/lat crops are for equirectangular world maps; x/y/w/h crops are fractions of the frame
      const c = p.crop.lon ? { x: (p.crop.lon[0] + 180) / 360, w: (p.crop.lon[1] - p.crop.lon[0]) / 360, y: (90 - p.crop.lat[1]) / 180, h: (p.crop.lat[1] - p.crop.lat[0]) / 180 } : p.crop;
      const box = { left: Math.round(c.x * W), top: Math.round(c.y * H), width: Math.round(c.w * W), height: Math.round(c.h * H) };
      img = sharp(await img.extract(box).toBuffer(), { limitInputPixels: false });
      W = box.width; H = box.height;
    }
    const maxW = Math.max(...sizes);
    const master = await img.resize({ width: Math.min(W, maxW), withoutEnlargement: true }).toBuffer();
    const mm = await sharp(master).metadata();
    fs.mkdirSync(dest, { recursive: true });
    const done = [];
    for (const w of sizes) {
      const ww = Math.min(w, mm.width);
      const base = sharp(master).resize({ width: ww });
      if (!p.try) await base.clone().avif({ quality: p.q || 50, effort: 6, chromaSubsampling: '4:2:0' }).toFile(path.join(dest, `${p.id}-${w}.avif`));
      await base.clone().webp({ quality: p.q ? p.q + 22 : 72, effort: 6 }).toFile(path.join(dest, `${p.id}-${w}.webp`));
      done.push(w);
    }
    const lq = await sharp(master).resize({ width: 24 }).blur(0.6).webp({ quality: 38 }).toBuffer();
    const st = await sharp(master).stats();
    out[p.id] = { v, w: mm.width, h: mm.height, sizes: done, lqip: 'data:image/webp;base64,' + lq.toString('base64'), color: hex(st.dominant),
      alt: p.alt, credit: p.credit, link: p.link, license: p.license, ...(p.try ? { try: true } : {}) };
    made++;
  } catch (e) { failed++; console.log('FAILED', p.id, String(e.message || e)); if (prev[p.id]) out[p.id] = prev[p.id]; }
}
// remove files of photos that left the manifest
const ids = new Set(M.photos.map(p => p.id));
for (const d of [DIR, TRY]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) {
  const m = f.match(/^(.+)-\d+\.(avif|webp)$/); if (m && !ids.has(m[1])) fs.unlinkSync(path.join(d, f));
}
fs.writeFileSync(OUTF, JSON.stringify(out, null, 1) + '\n');
// credits, for the README and the pages' How it works sections
const cred = M.photos.filter(p => !p.try).map(p => `- **${p.alt}**: ${p.credit}, [source](${p.link}), ${p.license}`).join('\n');
fs.writeFileSync(path.join(DIR, 'CREDITS.md'), `# Photo credits\n\nPhotos used on the Probable sites and apps, resized and converted to AVIF and WebP.\n\n${cred}\n`);
console.log(`made ${made}, kept ${kept}, failed ${failed}`);
if (failed && !made && !kept) process.exit(1);
