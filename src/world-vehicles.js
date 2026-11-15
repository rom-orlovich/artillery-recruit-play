import * as THREE from 'three';
import { createSeededRandom } from './props/materials.js';
import { composeMatrix, createBake, ground } from './world-kit.js';
import { registerSoldier } from './world-soldiers.js';
import { collectPivotGeometry, doherMaterial, loadDoherTemplate } from './world-doher.js';

const DOHER_LOD_DISTANCE = 55;
const TRACK_COLOR = 0x2a2a27;
const WHEEL_COLOR = 0x3a3b36;
const DARK_COLOR = 0x30322b;
const CREW_RAY_LIFT = 1;
export const FOOT_OFFSETS = [[-0.11, 0.04], [0.11, 0.04]];
const DOWN = new THREE.Vector3(0, -1, 0);
const crewRaycaster = new THREE.Raycaster();
const pendingDohers = new Set();
let sharedPlaceholderGeom = null;

const cylinder = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const wheelGeometry = (r, w) => new THREE.CylinderGeometry(r, r, w, 12).rotateZ(Math.PI / 2);

function placer(bake, x, y, z, ry) {
  const base = composeMatrix(x, y, z, 0, ry, 0);
  const local = new THREE.Matrix4();
  return {
    put(material, geometry, lx, ly, lz, color, rx = 0, rz = 0, lry = 0) {
      local.copy(composeMatrix(lx, ly, lz, rx, lry, rz));
      bake.add(material, geometry, base.clone().multiply(local), color);
    },
    box(material, w, h, d, lx, ly, lz, color, rx = 0, rz = 0, lry = 0) {
      this.put(material, new THREE.BoxGeometry(w, h, d), lx, ly, lz, color, rx, rz, lry);
    }
  };
}

function barrel(p, length, radius, y, zStart, elevation, material) {
  const dir = new THREE.Vector3(0, Math.sin(elevation), -Math.cos(elevation));
  const mid = dir.clone().multiplyScalar(length / 2);
  p.put(material, cylinder(radius * 0.85, radius, length, 10), 0, y + mid.y, zStart + mid.z, undefined, Math.PI / 2 - elevation);
  const evac = dir.clone().multiplyScalar(length * 0.55);
  p.put(material, cylinder(radius * 1.55, radius * 1.55, length * 0.12, 10), 0, y + evac.y, zStart + evac.z, undefined, Math.PI / 2 - elevation);
  const tip = dir.clone().multiplyScalar(length);
  p.put('paint', new THREE.BoxGeometry(radius * 3.6, radius * 3, 0.55), 0, y + tip.y, zStart + tip.z, DARK_COLOR, -elevation);
}

export function addDoher(bake, x, y, z, ry = 0, elevation = 0.04) {
  const p = placer(bake, x, y, z, ry);
  for (const side of [-1, 1]) {
    p.box('paint', 0.56, 0.62, 6.3, side * 1.33, 0.48, 0, TRACK_COLOR);
    for (let i = 0; i < 7; i++) p.put('paint', wheelGeometry(0.33, 0.5), side * 1.33, 0.38, -2.5 + i * 0.83, WHEEL_COLOR);
    p.put('paint', wheelGeometry(0.3, 0.5), side * 1.33, 0.62, -3.05, WHEEL_COLOR);
    p.put('paint', wheelGeometry(0.3, 0.5), side * 1.33, 0.62, 3.05, WHEEL_COLOR);
    p.box('oliveMetal', 0.62, 0.08, 6.5, side * 1.33, 0.98, 0);
    p.box('oliveMetal', 0.24, 0.7, 2.6, side * 1.62, 2.4, 1.0);
  }
  p.box('oliveMetal', 2.2, 0.62, 6.1, 0, 0.92, 0);
  p.box('oliveMetal', 2.95, 0.72, 5.0, 0, 1.38, 0.45);
  p.box('oliveMetal', 2.95, 0.6, 1.4, 0, 1.12, -2.55, undefined, -0.42);
  p.box('oliveMetal', 3.05, 1.22, 3.9, 0, 2.35, 0.95);
  p.box('oliveMetal', 2.7, 0.55, 0.9, 0, 2.6, -1.25, undefined, 0.35);
  p.box('oliveMetal', 0.9, 0.72, 0.45, 0, 2.38, -1.12);
  p.box('paint', 2.9, 0.55, 0.7, 0, 2.2, 3.2, DARK_COLOR);
  p.put('oliveMetal', cylinder(0.36, 0.42, 0.3, 10), 0.75, 3.1, 1.4);
  p.box('paint', 0.1, 0.1, 1.0, 0.75, 3.35, 0.95, DARK_COLOR);
  p.put('paint', cylinder(0.018, 0.018, 3.2, 4), -1.25, 4.5, 2.6, DARK_COLOR);
  p.put('paint', cylinder(0.018, 0.018, 2.6, 4), 1.25, 4.2, 2.7, DARK_COLOR);
  barrel(p, 5.9, 0.13, 2.42, -1.3, elevation, 'oliveMetal');
}

export function addRoem(bake, x, y, z, ry = 0) {
  const p = placer(bake, x, y, z, ry);
  for (const side of [-1, 1]) {
    for (const wz of [-3.3, -1.9, 1.5, 2.9]) p.put('paint', wheelGeometry(0.62, 0.48), side * 1.2, 0.62, wz, TRACK_COLOR);
  }
  p.box('oliveMetal', 2.5, 0.55, 9.0, 0, 1.12, 0);
  p.box('oliveMetal', 2.6, 1.55, 2.3, 0, 2.15, -3.4);
  p.box('glass', 2.3, 0.62, 0.06, 0, 2.48, -4.56, undefined, -0.2);
  p.box('oliveMetal', 2.5, 1.5, 4.0, 0, 2.15, 1.9);
  p.box('paint', 2.1, 0.9, 1.0, 0, 1.85, 4.2, DARK_COLOR);
  p.box('oliveMetal', 0.5, 1.4, 0.4, 0, 0.9, 4.7, undefined, 0.5);
  barrel(p, 7.0, 0.13, 3.15, -0.2, 0.06, 'oliveMetal');
}

export function addAlfa(bake, x, y, z, ry = 0) {
  const p = placer(bake, x, y, z, ry);
  for (const side of [-1, 1]) {
    p.box('paint', 0.5, 0.6, 5.6, side * 1.18, 0.45, 0, TRACK_COLOR);
    for (let i = 0; i < 5; i++) p.put('paint', wheelGeometry(0.3, 0.46), side * 1.18, 0.36, -2.1 + i * 1.05, WHEEL_COLOR);
  }
  p.box('oliveMetal', 2.7, 0.7, 5.8, 0, 1.05, 0);
  p.box('oliveMetal', 2.6, 1.15, 1.7, 0, 1.95, -2.0);
  p.box('glass', 2.2, 0.45, 0.05, 0, 2.15, -2.86);
  p.box('paint', 2.7, 0.08, 1.9, 0, 2.58, -2.0, 0x6b6646);
  p.box('oliveMetal', 2.7, 0.5, 3.6, 0, 1.65, 0.95);
  const random = createSeededRandom(Math.round(x * 7 + z * 13));
  for (let i = 0; i < 6; i++) {
    p.box('paint', 0.8, 0.45, 0.55, -0.5 + (i % 2), 2.12, -0.2 + Math.floor(i / 2) * 0.9, i % 3 ? 0x5a6534 : 0x7a5d3c, 0, 0, (random() - 0.5) * 0.2);
  }
}

export function addSoldier(bake, x, y, z, ry = 0, pose = 'stand') {
  registerSoldier(x, y, z, ry, pose);
}

function crown(bake, cx, cy, cz, radius, squash, color, seed) {
  const random = createSeededRandom(seed);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const lobes = 5;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + random();
    const d = radius * 0.55 * (i ? 1 : 0);
    const r = radius * (0.55 + random() * 0.3);
    const shade = new THREE.Color(color).multiplyScalar(0.85 + random() * 0.3);
    bake.mesh('foliage', blob, cx + Math.cos(a) * d, cy + random() * radius * 0.25, cz + Math.sin(a) * d, random() * 3, shade, 0, 0, r, r * squash, r);
  }
}

export function addTree(bake, x, y, z, kind, seed = 1) {
  const random = createSeededRandom(seed);
  const s = 0.85 + random() * 0.35;
  if (kind === 'palm') {
    bake.mesh('paint', cylinder(0.17, 0.26, 6.5 * s, 8), x, y + 3.25 * s, z, 0, 0x7b6a52);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      bake.mesh('foliage', new THREE.BoxGeometry(0.5, 0.05, 3.0), x + Math.sin(a) * 1.3, y + 6.3 * s, z + Math.cos(a) * 1.3, a, 0x5d7240, 0.45);
    }
    return;
  }
  if (kind === 'cypress') {
    bake.mesh('paint', cylinder(0.12, 0.18, 1.4, 6), x, y + 0.7, z, 0, 0x5a4636);
    bake.mesh('foliage', new THREE.ConeGeometry(1.0 * s, 7 * s, 8), x, y + 1 + 3.5 * s, z, 0, 0x2f4732);
    return;
  }
  const trunkH = (kind === 'oak' ? 2.4 : 1.6) * s;
  const lean = (random() - 0.5) * 0.25;
  bake.mesh('paint', cylinder(0.16, 0.28, trunkH, 7), x, y + trunkH / 2, z, 0, 0x4f4032, lean, lean * 0.5);
  if (kind === 'oak') crown(bake, x + lean * 1.2, y + trunkH + 0.9 * s, z, 2.3 * s, 0.52, 0x4d5a33, seed);
  else crown(bake, x, y + trunkH + 0.9 * s, z, 1.9 * s, 0.75, 0x7f8a6a, seed);
}

function surfaceTop(support, x, z) {
  support.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(support).max.y + CREW_RAY_LIFT;
  crewRaycaster.set(new THREE.Vector3(x, top, z), DOWN);
  return crewRaycaster.intersectObject(support, true)[0]?.point.y ?? ground(x, z);
}

export function addGunCrew(slot, { members, facing }, x, z, gunId = null) {
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  for (const [dx, dz] of members) {
    const sx = x + dx;
    const sz = z + dz;
    const feet = FOOT_OFFSETS.map(([fx, fz]) => surfaceTop(slot, sx + fx * cos + fz * sin, sz - fx * sin + fz * cos));
    registerSoldier(sx, Math.max(...feet), sz, facing, 'stand', gunId, slot);
  }
}

function getDoherPlaceholderGeometry() {
  if (!sharedPlaceholderGeom) {
    const bake = createBake();
    const inputs = new Set();
    const tracker = { add: (m, g, mat, c) => { inputs.add(g); bake.add(m, g, mat, c); } };
    addDoher(tracker, 0, 0, 0, 0, 0.04);
    const group = bake.build('doher-placeholder', false);
    for (const g of inputs) g.dispose();
    sharedPlaceholderGeom = collectPivotGeometry(group, new Set()) || new THREE.BufferGeometry();
  }
  return sharedPlaceholderGeom;
}

export function placeDoher(parent, x, y, z, ry = 0, elevation = 0.04) {
  const slot = new THREE.LOD();
  slot.name = 'doher';
  slot.position.set(x, y, z);
  slot.rotation.y = ry;
  parent.add(slot);
  const placeholder = new THREE.Mesh(getDoherPlaceholderGeometry(), doherMaterial);
  placeholder.name = 'doher-placeholder';
  placeholder.castShadow = false;
  placeholder.receiveShadow = true;
  slot.addLevel(placeholder, 0);
  const task = loadDoherTemplate().then((template) => {
    if (!template) return;
    const model = template.clone(true);
    const barrelObj = model.getObjectByName('doher-barrel');
    if (barrelObj) barrelObj.rotation.x = elevation;
    slot.remove(placeholder);
    slot.levels.length = 0;
    slot.addLevel(model, 0);
    slot.addLevel(placeholder, DOHER_LOD_DISTANCE);
    placeholder.visible = false;
  }).finally(() => pendingDohers.delete(task));
  pendingDohers.add(task);
  return slot;
}

export function whenDohersReady() {
  return Promise.all([...pendingDohers]);
}
