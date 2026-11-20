// three.js scene for the preview renders. Loads the exported STLs and
// build/info.json, so the images always match the current model.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawScreen } from './displays.js';

const info = await (await fetch('/build/info.json')).json();
const [W, H, T, R] = info.tablet;
const [zFloor, zTabB, zTabF, zRim, bezelT] = info.z;
const ribH = info.ribs[2];
const [tilt, , sC] = info.stand;
const [scrX0, scrY0, scrW, scrH] = info.screen_mm;
const cskD = info.screw_spec[4];

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

// model space is Z-up (desk frame); three.js is Y-up
const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;
scene.add(world);

// ---------------------------------------------------------------- materials
const panel = new THREE.MeshStandardMaterial({ color: info.colour, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.4 });
const tpuMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.35, metalness: 0.55 });
const screwMat = new THREE.MeshStandardMaterial({ color: 0x5d646b, roughness: 0.4, metalness: 0.85 });
const recessMat = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.6 });

const loader = new STLLoader();
async function stlMesh(path, mat) {
  const g = toCreasedNormals(await loader.loadAsync(path), THREE.MathUtils.degToRad(28));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- case parts (case frame)
const caseGroup = new THREE.Group();
caseGroup.matrixAutoUpdate = false;
world.add(caseGroup);

const parts = {
  shell: await stlMesh('/stl/rear_housing_PLA.stl', panel),
  tpu: await stlMesh('/stl/tpu_liner_TPU_optional.stl', tpuMat),
  bezel: await stlMesh('/stl/front_bezel_PLA.stl', panel),
  tablet: new THREE.Group(),
  screws: new THREE.Group(),
};
const base = { shell: 0, tpu: zFloor + ribH, bezel: zRim, tablet: 0, screws: 0 };
for (const k in parts) caseGroup.add(parts[k]);

// tablet body with soft edges
{
  const b = 0.8, shape = new THREE.Shape(), r = R - b, x0 = b, y0 = b, x1 = W - b, y1 = H - b;
  shape.moveTo(x0 + r, y0); shape.lineTo(x1 - r, y0); shape.quadraticCurveTo(x1, y0, x1, y0 + r);
  shape.lineTo(x1, y1 - r); shape.quadraticCurveTo(x1, y1, x1 - r, y1); shape.lineTo(x0 + r, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - r); shape.lineTo(x0, y0 + r); shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: T - 2 * b - 0.06, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 24 });
  const body = new THREE.Mesh(g, bodyMat);
  body.position.z = zTabB + b; body.castShadow = body.receiveShadow = true;
  parts.tablet.add(body);
  // screen with generic PFD / ND mock-ups
  const black = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.6, H - 1.6),
    new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.25, metalness: 0 }));
  black.position.set(W / 2, H / 2, zTabF - 0.055);
  parts.tablet.add(black);
  const S = 2, cvs = document.createElement('canvas');
  cvs.width = 1340 * S; cvs.height = 800 * S;
  drawScreen(cvs, { pfd: info.pfd_px, nd: info.nd_px }, S);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.set(scrX0 + scrW / 2, scrY0 + scrH / 2, zTabF - 0.04);
  parts.tablet.add(scr);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, H - 2),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.18 }));
  glass.position.set(W / 2, H / 2, zTabF - 0.02);
  parts.tablet.add(glass);
}

// countersunk screw heads (flush with the bezel face)
for (const [sx, sy] of info.screws) {
  const head = new THREE.Mesh(new THREE.CylinderGeometry(cskD / 2 - 0.25, cskD / 2 - 0.25, 0.3, 40), screwMat);
  head.rotation.x = Math.PI / 2; head.position.set(sx, sy, zRim + bezelT - 0.12);
  parts.screws.add(head);
  for (const a of [0, Math.PI / 2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.2), recessMat);
    slot.rotation.z = a + Math.PI / 4; slot.position.set(sx, sy, zRim + bezelT + 0.0);
    parts.screws.add(slot);
  }
}

// case frame -> desk frame (same as on_stand() in the .scad)
{
  const th = THREE.MathUtils.degToRad(tilt);
  const M = new THREE.Matrix4().makeTranslation(0, sC * Math.sin(th), sC * Math.cos(th))
    .multiply(new THREE.Matrix4().makeRotationX(-th))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeTranslation(-W / 2, -H / 2, 0));
  caseGroup.matrix.copy(M);
}
const stand = await stlMesh('/stl/desk_stand_PLA.stl', panel);
world.add(stand);

// ---------------------------------------------------------------- environment
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.receiveShadow = true;
world.add(floor);

const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(-380, 620, 520);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 50, far: 2000 });
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.4; key.shadow.radius = 4;
key.target.position.set(0, 60, 0);
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
rim.position.set(420, 380, -500);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 0.35));

// ---------------------------------------------------------------- views
function setExploded(on) {
  const off = on ? { shell: 30, tpu: 48, tablet: 70, bezel: 112, screws: 132 } : { shell: 0, tpu: 0, tablet: 0, bezel: 0, screws: 0 };
  for (const k in parts) parts[k].position.z = base[k] + off[k];
}

// case-frame point -> three.js world point
export function casePoint(x, y, z) {
  const v = new THREE.Vector3(x, y, z).applyMatrix4(caseGroup.matrix);
  return new THREE.Vector3(v.x, v.z, -v.y);
}

window.casePoint = (x, y, z) => casePoint(x, y, z).toArray();

window.renderView = async (v) => {
  const ss = v.supersample ?? 2;
  key.position.set(...(v.key ?? [-380, 620, 520]));
  rim.position.set(...(v.rim ?? [420, 380, -500]));
  const w = v.width * ss, h = v.height * ss;
  renderer.setSize(w, h, false);
  setExploded(!!v.exploded);
  parts.tablet.visible = v.tablet !== false;
  stand.visible = v.stand !== false;
  scene.background = new THREE.Color(v.background ?? 0xe4e6e9);
  floor.visible = v.floorVisible !== false;
  const cam = new THREE.PerspectiveCamera(v.fov ?? 28, w / h, 5, 8000);
  const target = v.targetCase ? casePoint(...v.targetCase) : new THREE.Vector3(...v.target);
  const pos = v.offset ? target.clone().add(new THREE.Vector3(...v.offset)) : new THREE.Vector3(...v.cam);
  cam.position.copy(pos); cam.lookAt(target);
  renderer.render(scene, cam);
  // downsample for clean anti-aliasing
  const out = document.createElement('canvas');
  out.width = v.width; out.height = v.height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, v.width, v.height);
  return out.toDataURL('image/png');
};

window.screenTexture = () => {
  const c = document.createElement('canvas'); c.width = 1340; c.height = 800;
  drawScreen(c, { pfd: info.pfd_px, nd: info.nd_px }, 1);
  return c.toDataURL('image/png');
};

window.ready = true;
