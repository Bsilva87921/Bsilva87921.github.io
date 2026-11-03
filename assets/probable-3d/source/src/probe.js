import { WebGPURenderer, Scene, PerspectiveCamera, Mesh, IcosahedronGeometry, MeshStandardNodeMaterial, InstancedMesh, Color, RenderPipeline, Object3D, AmbientLight, DirectionalLight } from 'three/webgpu';
import { pass, color, time, sin, positionLocal, normalView, mix, vec3, float } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
export async function go(canvas) {
  const r = new WebGPURenderer({ canvas, antialias: true, alpha: true });
  await r.init();
  const s = new Scene(), c = new PerspectiveCamera(40, 1, 0.1, 100);
  const m = new MeshStandardNodeMaterial(); m.colorNode = mix(color(0x2244ff), color(0xff8800), sin(time).mul(0.5).add(0.5));
  const im = new InstancedMesh(new IcosahedronGeometry(1, 2), m, 100); s.add(im, new AmbientLight(), new DirectionalLight());
  const pp = new RenderPipeline(r); const sp = pass(s, c); pp.outputNode = sp.add(bloom(sp, 0.8, 0.3, 0.2));
  r.setAnimationLoop(() => pp.render());
  return r.backend.isWebGPUBackend;
}
