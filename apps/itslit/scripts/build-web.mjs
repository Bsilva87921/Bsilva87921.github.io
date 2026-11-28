// Copies the live ItsLit site into www/ for the native app: the page, its settings, the account and AI connector,
// the 3D library and Firebase libraries, icons and the privacy notice. Books and breakdowns are built into the page;
// the Salon, accounts and Shelley use the same services as the website.
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), APPDIR = path.resolve(HERE, '..'), SITE = path.resolve(APPDIR, '../../itslit');
const WWW = path.join(APPDIR, 'www');
fs.rmSync(WWW, { recursive: true, force: true }); fs.mkdirSync(WWW, { recursive: true });
let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
if (!html.includes('<script src="config.js"></script>')) throw new Error('index.html changed: cannot find the config script');
html = html.replace('<script src="config.js"></script>', '<script>window.ITSLIT_NATIVE = true;</script>\n<script src="config.js"></script>');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
fs.writeFileSync(path.join(WWW, 'index.html'), html);
for (const f of ['config.js', 'api-config.js', 'backend.js', 'privacy.html']) fs.copyFileSync(path.join(SITE, f), path.join(WWW, f));
for (const d of ['lib', 'icons']) fs.cpSync(path.join(SITE, d), path.join(WWW, d), { recursive: true });
console.log('www ready:', fs.readdirSync(WWW).join(', '));
