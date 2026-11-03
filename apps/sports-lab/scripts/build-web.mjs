// Copies the live Sports Lab into www/ for the native app: the page, the 3D bundle, the AI settings and icons.
// Data comes from the network as on the website (ESPN feeds, and the track record from the site).
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), APPDIR = path.resolve(HERE, '..'), SITE = path.resolve(APPDIR, '../..');
const WWW = path.join(APPDIR, 'www');
fs.rmSync(WWW, { recursive: true, force: true }); fs.mkdirSync(path.join(WWW, 'assets/probable-3d'), { recursive: true });
let html = fs.readFileSync(path.join(SITE, 'live-sports-lab/index.html'), 'utf8');
const boot = '<script>window.PROBABLE_NATIVE = true; window.SPORTS_TRACK_URL = "https://bsilva87921.github.io/live-sports-lab/data/track.json";</script>';
html = html.replace('<script src="../probable-atlas/ai-config.js"></script>', boot + '<script src="ai-config.js"></script>');
html = html.replace(/<link rel="manifest"[^>]*>/, '');
fs.writeFileSync(path.join(WWW, 'index.html'), html);
fs.copyFileSync(path.join(SITE, 'probable-atlas/ai-config.js'), path.join(WWW, 'ai-config.js'));
fs.copyFileSync(path.join(SITE, 'assets/probable-3d/probable-3d.js'), path.join(WWW, 'assets/probable-3d/probable-3d.js'));
fs.cpSync(path.join(SITE, 'live-sports-lab/icons'), path.join(WWW, 'icons'), { recursive: true });
console.log('www ready:', fs.readdirSync(WWW).join(', '));
