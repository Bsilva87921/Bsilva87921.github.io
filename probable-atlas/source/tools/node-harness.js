// Node harness: load Atlas kit + finance modules against the real data, then run a test script.
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src'), DATA = path.join(__dirname, '..', 'data', 'live');
const files = process.argv[2].split(',');
const test = fs.readFileSync(process.argv[3], 'utf8');
const ctx = { console, Math, Date, JSON, Float64Array, Int32Array, Uint8Array, Array, Object, Map, Set, Number, String, isFinite, isNaN, parseFloat, parseInt, performance, setTimeout, clearTimeout };
ctx.window = { ATLAS_FIN_DATA: { panel: JSON.parse(fs.readFileSync(path.join(DATA, 'markets.json'))), long: JSON.parse(fs.readFileSync(path.join(DATA, 'markets-long.json'))), status: JSON.parse(fs.readFileSync(path.join(DATA, 'mstatus.json'))) } };
ctx.localStorage = { getItem: () => null, setItem: () => {} };
ctx.addEventListener = () => {}; ctx.document = { addEventListener: () => {}, querySelector: () => null, documentElement: { dataset: {}, style: {} } };
vm.createContext(ctx);
const code = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + '\n;(async () => { try {\n' + test + '\n} catch (e) { console.error("TEST ERROR", e.stack); } })();';
vm.runInContext(code, ctx, { filename: 'bundle.js' });
