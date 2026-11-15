import * as THREE from 'three';
import { FOOTPRINTS, WALLS, TREES } from './world-layout.js';
import { createBake, addCollider, addSegmentCollider, addSign, ground, createInstanced, createInstancedChunks, composeMatrix, addFenceRun } from './world-kit.js';
import { addRoem, addSoldier, addTree, placeDoher, addGunCrew } from './world-vehicles.js';
import { createShellPallet } from './props/shell-pallet.js';
import { createSeededRandom } from './props/materials.js';
import { fbm } from './world-terrain.js';

const REGION = 'shivta';
const TRIM = 0x2c8f99;
const AC_COLOR = 0xd8dbd6;
const WINDOW_SPACING = 2.6;
const STONE_COUNT = 260;
const SHRUB_COUNT = 1100;

export const PARK_HERO = { x: 24, y: 0, z: 18, ry: -Math.PI / 2 };
export const PARK_CREW = { members: [[-2.5, -0.6]], facing: -1.2 };

const footprint = (id) => FOOTPRINTS.find((fp) => fp.id === id);

function addRenovatedBuilding(bake, fp, options = {}) {
  const y = ground(fp.x, fp.z);
  const floors = fp.h > 5 ? 2 : 1;
  bake.box('stucco', fp.w, fp.h, fp.d, fp.x, y + fp.h / 2, fp.z);
  bake.box('paint', fp.w + 0.3, 0.42, fp.d + 0.3, fp.x, y + fp.h - 0.1, fp.z, 0, options.trim ?? TRIM);
  bake.box('concrete', fp.w + 0.2, 0.35, fp.d + 0.2, fp.x, y + 0.17, fp.z);
  for (let floor = 0; floor < floors; floor++) {
    const wy = y + 1.55 + floor * 3.1;
    for (const side of [-1, 1]) {
      const count = Math.max(1, Math.floor((fp.w - 1.5) / WINDOW_SPACING));
      for (let i = 0; i < count; i++) {
        const wx = fp.x - ((count - 1) * WINDOW_SPACING) / 2 + i * WINDOW_SPACING;
        bake.box('glass', 1.25, 1.05, 0.08, wx, wy, fp.z + side * (fp.d / 2 + 0.02));
        bake.box('paint', 1.45, 0.1, 0.2, wx, wy - 0.6, fp.z + side * (fp.d / 2 + 0.08), 0, 0xe9e4d6);
        if (i % 2 === 0) bake.box('paint', 0.75, 0.5, 0.42, wx + 0.9, wy - 0.4, fp.z + side * (fp.d / 2 + 0.23), 0, AC_COLOR);
      }
    }
  }
  const doorSide = options.doorSide ?? 1;
  for (const offset of options.doors ?? [0]) {
    bake.box('paint', 1.3, 2.2, 0.1, fp.x + offset, y + 1.1, fp.z + doorSide * (fp.d / 2 + 0.03), 0, 0x6a4f3a);
    bake.box('paint', 2.4, 0.12, 1.6, fp.x + offset, y + 2.7, fp.z + doorSide * (fp.d / 2 + 0.8), 0, options.trim ?? TRIM);
  }
  bake.mesh('paint', new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10), fp.x + fp.w * 0.25, y + fp.h + 0.6, fp.z, 0, 0xf1f1ee, 0, Math.PI / 2);
  addSign(bake, fp.label, fp.x, y + fp.h - 0.9, fp.z + doorSide * (fp.d / 2 + 0.06), doorSide > 0 ? 0 : Math.PI, Math.min(fp.w - 1, 4.4), 1.0, { bg: '#1f5960' });
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
}

function addTWallRun(bake, from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const count = Math.round(length / 1.25);
  for (let i = 0; i < count; i++) {
    const x = from[0] + ((to[0] - from[0]) * (i + 0.5)) / count;
    const z = from[1] + ((to[1] - from[1]) * (i + 0.5)) / count;
    const y = ground(x, z);
    bake.box('concrete', 1.18, 3.4, 0.32, x, y + 1.85, z);
    bake.box('concrete', 1.18, 0.35, 1.3, x, y + 0.17, z);
  }
  addSegmentCollider(REGION, from, to, 0.9, 3.6);
}

function addEarthBerm(bake, from, to) {
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ry = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const mound = new THREE.CylinderGeometry(1.0, 2.6, 2.8, 6, 1).rotateY(Math.PI / 6);
  bake.mesh('earth', mound, cx, ground(cx, cz) + 1.3, cz, ry, undefined, 0, 0, 1, 1, length / 4.8);
  addSegmentCollider(REGION, from, to, 2.4, 2.8);
}

function addGate(bake) {
  addTWallRun(bake, [-7, -35], [-6.2, -35]);
  for (const side of [-1, 1]) bake.box('paint', 0.35, 5.2, 0.35, side * 6.6, 2.6, -35.6, 0, 0x3b4534);
  addSign(bake, 'מחנה שבטה — ביסל"ת\nבית הספר לתותחנות שדה', 0, 4.6, -35.7, Math.PI, 6.4, 1.4, { bg: '#26332a' });
  const booth = { x: -10.5, z: -39 };
  bake.box('stucco', 2.6, 2.6, 2.6, booth.x, ground(booth.x, booth.z) + 1.3, booth.z);
  bake.box('glass', 2.0, 0.9, 0.05, booth.x, 1.7, booth.z + 1.32);
  bake.box('paint', 3.1, 0.2, 3.1, booth.x, 2.7, booth.z, 0, TRIM);
  addCollider(REGION, booth.x, booth.z, 2.6, 2.6, 2.6);
  bake.box('paint', 6.2, 0.14, 0.14, -3.2, 1.05, -37.6, 0, 0xd8382e, 0, 0.12);
  bake.box('paint', 0.4, 1.1, 0.4, -6.4, 0.55, -37.6, 0, 0xe6c22d);
  addSoldier(bake, -8.2, 0, -38.2, 0.4);
  for (const x of [-12.5, -7, 7, 12.5]) bake.box('paint', 1.2, 0.8, 0.5, x, 0.4, -41.5, 0, 0xc9bfa6);
}

function addParadeGround(bake) {
  const parade = footprint('shivtaParade');
  bake.box('asphaltSlab', parade.w, 0.08, parade.d, parade.x, 0.04, parade.z);
  for (let row = 0; row < 4; row++) bake.box('paint', parade.w - 4, 0.012, 0.12, parade.x, 0.085, parade.z - 6 + row * 4, 0, 0xf1efe6);
  bake.box('paint', 0.12, 0.012, parade.d - 4, parade.x, 0.085, parade.z, 0, 0xe8c63a);
  const plaza = footprint('shivtaPlaza');
  bake.box('asphaltSlab', plaza.w, 0.08, plaza.d, plaza.x, 0.04, plaza.z);
  bake.box('concrete', 6, 0.35, 2.4, plaza.x, 0.17, plaza.z - 3.6);
  for (let i = 0; i < 6; i++) {
    for (const row of [0, 1]) {
      const x = -6 + i * 2.4;
      const z = 26 + row * 1.7;
      addSoldier(bake, x, 0, z, Math.PI);
    }
  }
  addCollider(REGION, 0, 26, 13, 0.6, 1.8);
  addCollider(REGION, 0, 27.7, 13, 0.6, 1.8);
}

function addHowitzerPark(bake, group) {
  const park = footprint('shivtaPark');
  bake.box('concrete', park.w, 0.1, park.d, park.x, 0.05, park.z);
  for (const [px, pz] of [[16, 11], [32, 11], [16, 33], [32, 33], [24, 11], [24, 33]]) {
    bake.mesh('paint', new THREE.CylinderGeometry(0.12, 0.14, 6.4, 8), px, 3.2, pz, 0, 0x7d8285);
  }
  bake.box('paint', 17, 0.1, 23, 24, 6.45, 22, 0, 0xd9cfb2);
  const slot = placeDoher(group, PARK_HERO.x, PARK_HERO.y, PARK_HERO.z, PARK_HERO.ry, 0.04);
  addGunCrew(slot, PARK_CREW, PARK_HERO.x, PARK_HERO.z, 'shivta-park');
  addCollider(REGION, 24, 18, 6.6, 3.4, 3.2);
  addRoem(bake, 24.4, 0, 28, -Math.PI / 2);
  addCollider(REGION, 24.4, 28, 9, 2.6, 3.2);
  addSign(bake, 'פארק תומ"תים — הדרכה', 16, 2.2, 22, Math.PI / 2, 4.6, 1.0, { bg: '#2b3b2a' });
  const pallet = createShellPallet();
  for (const [x, z] of [[10.2, 21.6], [13.6, 21.6], [10.2, 23.2]]) bake.object(pallet, x, 0, z, 0);
  addSoldier(bake, 18.6, 0, 22.6, 2.2, 'arms');
}

function addRange(bake) {
  bake.box('concrete', 6, 0.1, 30, 48.5, 0.05, 0);
  for (const wall of WALLS.filter((w) => w.region === REGION && w.kind === 'berm')) addEarthBerm(bake, wall.from, wall.to);
  bake.box('paint', 1.0, 1.1, 1.0, 49.5, 0.55, -2.4, 0, 0x3f4738);
  bake.box('paint', 0.8, 0.5, 0.06, 49.5, 1.15, -1.9, 0, 0x1d2a2e, -0.5);
  addCollider(REGION, 49.5, -2.4, 1.0, 1.0, 1.1);
  addSign(bake, 'מטווח ירי חי — עמדת הפעלה', 46.5, 2.4, -6.8, -Math.PI / 2, 4.6, 1.0, { bg: '#5a2a1c' });
  bake.mesh('paint', new THREE.CylinderGeometry(0.05, 0.06, 6, 6), 47, 3, -15, 0, 0x9a9da0);
  bake.box('paint', 1.4, 0.9, 0.03, 47.75, 5.4, -15, 0, 0xc7302a);
  for (const z of [-11, -5, 5, 11]) bake.box('earth', 1.2, 0.55, 2.2, 52.5, 0.27, z);
}

function addFieldTraining(bake) {
  for (const [x, z, w] of [[21, -50.2, 3.8], [-17, -60.2, 3.8], [6, -58, 2.6]]) {
    bake.box('paint', w, 1.1, 0.9, x, ground(x, z) + 0.55, z, 0, 0xb59c6d);
    addCollider(REGION, x, z, w, 0.9, 1.1);
  }
  bake.mesh('paint', new THREE.CylinderGeometry(0.06, 0.07, 4.5, 6), 3.2, ground(3.2, -70) + 2.25, -70, 0, 0x8a8d90);
  bake.box('paint', 1.6, 1.0, 0.04, 4.0, ground(3.2, -70) + 3.9, -70, 0, 0xd63a2c);
  addSign(bake, 'שטח אימונים — אש חיה', 6, 1.6, -42, Math.PI, 4.2, 0.9, { bg: '#6b2b1e' });
  bake.mesh('paint', new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), 6, 0.8, -41.95, 0, 0x777a7c);
  const random = createSeededRandom(77);
  for (let i = 0; i < 9; i++) {
    const x = -30 + random() * 70;
    const z = -48 - random() * 60;
    if (Math.abs(x) < 6) continue;
    bake.mesh('paint', new THREE.TorusGeometry(0.42, 0.17, 6, 10), x, ground(x, z) + 0.17, z, random() * 3, 0x222222, Math.PI / 2);
  }
  for (const [x, z] of [[40, -90], [-24, -96]]) {
    bake.box('paint', 2.6, 1.2, 5.2, x, ground(x, z) + 0.8, z, 0.7, 0x5c4a3a, 0.05);
    addCollider(REGION, x, z, 4.4, 4.4, 1.6);
  }
}

function addScatter(group) {
  const random = createSeededRandom(1337);
  const stones = [];
  const stoneColors = [];
  const shrubs = [];
  const shrubColors = [];
  const insideCompound = (x, z) => Math.abs(x) < 38 && Math.abs(z) < 38;
  const onRange = (x, z) => x > 42 && x < 92 && Math.abs(z) < 20;
  const onRoad = (x, z) => Math.abs(x) < 5 && z < 120;
  while (stones.length < STONE_COUNT) {
    const x = -200 + random() * 400;
    const z = -128 + random() * 220;
    if (insideCompound(x, z) || onRange(x, z) || onRoad(x, z)) continue;
    const s = 0.25 + Math.pow(random(), 3) * 1.3;
    stones.push(composeMatrix(x, ground(x, z) + s * 0.2, z, random() * 3, random() * 6, random() * 3, s * 1.3, s * 0.7, s));
    stoneColors.push(new THREE.Color(0xd2bf98).multiplyScalar(0.8 + random() * 0.3));
  }
  while (shrubs.length < SHRUB_COUNT) {
    const x = -205 + random() * 410;
    const z = -128 + random() * 225;
    if (insideCompound(x, z) || onRange(x, z) || onRoad(x, z)) continue;
    if (fbm(x * 0.03, z * 0.03, 2) < 0.42) continue;
    const s = 0.5 + random() * 0.7;
    shrubs.push(composeMatrix(x, ground(x, z), z, 0, random() * 6, 0, s, s * 0.8, s));
    shrubColors.push(new THREE.Color(random() > 0.5 ? 0x9c9a74 : 0xb4a37a).multiplyScalar(0.75 + random() * 0.3));
  }
  group.add(createInstanced(new THREE.DodecahedronGeometry(0.5, 0), 'rock', stones, stoneColors));
  group.add(createInstancedChunks(createTuftGeometry(), 'grassTuft', shrubs, shrubColors, 110, 70));
}

export function createTuftGeometry() {
  const planes = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => new THREE.PlaneGeometry(1, 0.7).translate(0, 0.35, 0).rotateY(a));
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const plane of planes) {
    const g = plane.toNonIndexed();
    positions.push(...g.attributes.position.array);
    uvs.push(...g.attributes.uv.array);
    for (let i = 0; i < g.attributes.position.count; i++) normals.push(0, 1, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

export function buildShivta(scene) {
  const group = new THREE.Group();
  group.name = 'region-shivta';
  const bake = createBake();
  for (const fp of FOOTPRINTS.filter((f) => f.region === REGION && f.kind === 'building')) {
    const options = {
      shivtaMess: { doors: [-5, -1.5, 2, 5.5] },
      shivtaShop: { doorSide: -1 },
      shivtaArmory: { doorSide: 1 },
      shivtaSim: { doorSide: 1 },
      shivtaClinic: {}
    }[fp.id];
    addRenovatedBuilding(bake, fp, options);
  }
  const clinic = footprint('shivtaClinic');
  addSign(bake, 'מרפאה — מד"א צבאי', clinic.x + 1.3, 2.35, clinic.z + clinic.d / 2 + 0.1, 0, 2.2, 0.55, { bg: '#f2f0ea', fg: '#c62828', border: '#c62828' });
  bake.box('paint', 1.0, 1.1, 5.5, 19.2, 0.55, -14, 0, 0x6c5136);
  addCollider(REGION, 19.2, -14, 1.0, 5.5, 1.1);
  addSoldier(bake, 20.2, 0, -14, -Math.PI / 2);
  bake.box('paint', 2.4, 0.08, 0.8, 14, 0.82, -5.5, 0, 0x6a6e5a);
  for (const [lx, lz] of [[12.9, -5.2], [15.1, -5.2], [12.9, -5.8], [15.1, -5.8]]) bake.box('paint', 0.06, 0.8, 0.06, lx, 0.4, lz, 0, 0x2a2b2c);
  addCollider(REGION, 14, -5.5, 2.4, 0.8, 0.9);
  for (const wall of WALLS.filter((w) => w.region === REGION)) {
    if (wall.kind === 'fence') addFenceRun(bake, REGION, wall.from, wall.to);
    if (wall.kind === 'twall') addTWallRun(bake, wall.from, wall.to);
  }
  addGate(bake);
  addParadeGround(bake);
  addHowitzerPark(bake, group);
  addRange(bake);
  addFieldTraining(bake);
  TREES.filter(([, z]) => z > -128).forEach(([x, z, kind], i) => {
    addTree(bake, x, ground(x, z), z, kind, i + 3);
    addCollider(REGION, x, z, 0.6, 0.6, 3);
  });
  group.add(bake.build('shivta-static'));
  addScatter(group);
  scene.add(group);
  return group;
}
