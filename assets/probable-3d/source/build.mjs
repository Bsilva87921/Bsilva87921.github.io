import * as esbuild from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
const T = '/home/claude/vendor-src/three186';
const entry = process.argv[2] || 'src/probe.js', out = process.argv[3] || 'dist/probe.js';
const r = await esbuild.build({
  entryPoints: [entry], bundle: true, format: 'esm', minify: true, target: ['es2020'], outfile: out, metafile: true, legalComments: 'eof',
  alias: { 'three/webgpu': T + '/build/three.webgpu.js', 'three/tsl': T + '/build/three.tsl.js', 'three': T + '/build/three.webgpu.js' },
  plugins: [{ name: 'addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, a => ({ path: T + '/examples/jsm/' + a.path.slice('three/addons/'.length) })); } }],
  logLevel: 'warning'
});
const o = Object.values(r.metafile.outputs)[0];
console.log(out, (o.bytes / 1024).toFixed(0) + ' KB');
