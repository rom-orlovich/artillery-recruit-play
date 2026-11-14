import * as THREE from 'three';
import { FOOTPRINTS, WALLS, TREES } from './world-layout.js';
import { createBake, addCollider, addSign, ground, createInstanced, createInstancedChunks, composeMatrix, addFenceRun } from './world-kit.js';
import { addAlfa, addSoldier, addTree } from './world-vehicles.js';
import { createShellPallet } from './props/shell-pallet.js';
import { createSeededRandom } from './props/materials.js';
import { createTuftGeometry } from './world-shivta.js';
import { fbm } from './world-terrain.js';

const REGION = 'yoav';
const ROOF_COLOR = 0x6e4239;
const SLATE_COLOR = 0x5d6468;
const BOULDER_COUNT = 190;
const TUFT_COUNT = 900;
const RECT = { minX: -178, maxX: -48, minZ: -222, maxZ: -128 };

const footprint = (id) => FOOTPRINTS.find((fp) => fp.id === id);

function addGolanBuilding(bake, fp, roofColor, doorSide = 1) {
  const y = ground(fp.x, fp.z);
  bake.box('basaltWall', fp.w + 0.1, 1.3, fp.d + 0.1, fp.x, y + 0.65, fp.z);
  bake.box('stucco', fp.w, fp.h - 1.3, fp.d, fp.x, y + 1.3 + (fp.h - 1.3) / 2, fp.z);
  const pitch = 0.36;
  const half = fp.d / 2 + 0.5;
  for (const side of [-1, 1]) {
    bake.box('paint', fp.w + 0.8, 0.12, half / Math.cos(pitch) + 0.1, fp.x, y + fp.h + Math.tan(pitch) * half / 2, fp.z + side * half / 2, 0, roofColor, side * pitch);
  }
  const gable = new THREE.BufferGeometry();
  const ridge = Math.tan(pitch) * half;
  gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -half, 0, 0, half, 0, ridge, 0], 3));
  gable.computeVertexNormals();
  for (const side of [-1, 1]) bake.mesh('paint', gable, fp.x + side * (fp.w / 2), y + fp.h, fp.z, side > 0 ? 0 : Math.PI, 0xe9e1cf);
  const count = Math.floor(fp.w / 3);
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const wx = fp.x - ((count - 1) * 3) / 2 + i * 3;
      bake.box('glass', 1.1, 1.0, 0.08, wx, y + 2.2, fp.z + side * (fp.d / 2 + 0.02));
      bake.box('paint', 1.3, 1.2, 0.04, wx, y + 2.2, fp.z + side * (fp.d / 2 + 0.06), 0, 0x3b4a3f, 0, 0, 0);
    }
  }
  bake.box('paint', 1.3, 2.2, 0.1, fp.x, y + 1.1, fp.z + doorSide * (fp.d / 2 + 0.03), 0, 0x4c3a2c);
  bake.box('basaltWall', 0.7, 2.2, 0.7, fp.x + fp.w * 0.3, y + fp.h + 1.0, fp.z - fp.d * 0.15);
  addSign(bake, fp.label, fp.x, y + fp.h - 0.55, fp.z + doorSide * (fp.d / 2 + 0.07), doorSide > 0 ? 0 : Math.PI, Math.min(fp.w - 2, 5), 0.9, { bg: '#2e2d2a' });
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
}

function addHangar(bake, fp) {
  const y = ground(fp.x, fp.z);
  bake.box('oliveMetal', fp.w, fp.h, fp.d, fp.x, y + fp.h / 2, fp.z);
  for (const side of [-1, 1]) bake.box('oliveMetal', fp.w + 0.6, 0.15, fp.d / 2 + 0.9, fp.x, y + fp.h + 1.0, fp.z + side * (fp.d / 4 + 0.2), 0, undefined, side * 0.32);
  for (const offset of [-4.5, 4.5]) bake.box('paint', 4.4, 4.0, 0.1, fp.x + offset, y + 2.0, fp.z + fp.d / 2 + 0.03, 0, 0x2c302a);
  addSign(bake, 'ימ"ח סוללתי — מחסני חירום', fp.x, y + fp.h - 0.6, fp.z + fp.d / 2 + 0.08, 0, 6, 1.0, { bg: '#2f3a28' });
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
  const crates = createShellPallet();
  for (const [dx, dz] of [[-6, 2.5], [-4.4, 2.5], [6, 2.4]]) bake.object(crates, fp.x + dx, y, fp.z + fp.d / 2 + dz, 0);
}

function addMemorial(bake) {
  const fp = footprint('yoavMemorial');
  const y = ground(fp.x, fp.z);
  bake.mesh('basaltWall', new THREE.CylinderGeometry(3.6, 4.0, 0.35, 10), fp.x, y + 0.17, fp.z);
  const stone = new THREE.DodecahedronGeometry(1, 0);
  [[-1.3, 0, 2.3], [0, -0.6, 3.0], [1.3, 0.1, 2.0]].forEach(([dx, dz, h], i) => {
    bake.mesh('basaltWall', stone, fp.x + dx, y + h * 0.55, fp.z + dz, i * 0.8, undefined, 0, 0, 0.75, h * 0.62, 0.6);
  });
  addCollider(REGION, fp.x, fp.z - 0.2, 3.6, 1.8, 2.6);
  addSign(bake, 'גן אלון — לזכר יואל פורת\nואבי דייטשי ז"ל, תשל"ד', fp.x, y + 0.9, fp.z + 1.6, 0, 2.6, 0.75, { bg: '#1f1f1f', fg: '#e8d9a8' });
  bake.box('paint', 2.7, 0.85, 0.12, fp.x, y + 0.45, fp.z + 1.5, 0, 0x2a2a2a);
}

function addGate(bake) {
  const y = ground(-58, -178);
  for (const dz of [-4.3, 4.3]) bake.box('basaltWall', 0.9, 3.4, 0.9, -58, y + 1.7, -178 + dz);
  bake.box('paint', 0.3, 0.6, 9.4, -58, y + 3.6, -178, 0, 0x2c3326);
  addSign(bake, 'מחנה יואב — כביש 978', -57.75, y + 3.6, -178, Math.PI / 2, 5.6, 0.9, { bg: '#2c3326' });
  bake.box('stucco', 2.4, 2.6, 2.4, -54.5, y + 1.3, -184.5);
  bake.box('paint', 2.9, 0.2, 2.9, -54.5, y + 2.7, -184.5, 0, SLATE_COLOR);
  addCollider(REGION, -54.5, -184.5, 2.4, 2.4, 2.6);
  bake.box('paint', 0.14, 0.14, 7, -55.8, y + 1.05, -177, 0, 0xd8382e);
  addSoldier(bake, -53.6, y, -182.4, 1.2);
}

function addParadeAndStaging(bake) {
  const parade = footprint('yoavParade');
  bake.box('asphaltSlab', parade.w, 0.08, parade.d, parade.x, ground(parade.x, parade.z) + 0.04, parade.z);
  addAlfa(bake, -150, ground(-150, -183), -183, 0.1);
  addCollider(REGION, -150, -183, 2.9, 6, 2.6);
  addAlfa(bake, -141, ground(-141, -184), -184, -0.05);
  addCollider(REGION, -141, -184, 2.9, 6, 2.6);
  const truckY = ground(-131, -184);
  bake.box('oliveMetal', 2.5, 1.2, 6.5, -131, truckY + 1.4, -184);
  bake.box('oliveMetal', 2.4, 1.6, 1.8, -131, truckY + 2.2, -187.6);
  bake.box('paint', 2.5, 1.6, 4.4, -131, truckY + 2.8, -182.6, 0, 0x6d6748);
  for (const dz of [-3.4, 0.6, 2.2]) for (const side of [-1, 1]) bake.mesh('paint', new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10).rotateZ(Math.PI / 2), -131 + side * 1.15, truckY + 0.5, -184 + dz, 0, 0x262626);
  addCollider(REGION, -131, -184.5, 2.6, 7.4, 3);
  for (const [x, z, ry] of [[-100, -178, 0], [-98, -178, 0], [-96, -178, 0], [-94.5, -175, 2.6], [-90, -194, 0.4], [-118, -184, 1.2]]) addSoldier(bake, x, ground(x, z), z, ry);
}

function addScatter(group) {
  const random = createSeededRandom(978);
  const boulders = [];
  const boulderColors = [];
  const tufts = [];
  const tuftColors = [];
  const inside = (x, z) => x > -170 && x < -56 && z > -214 && z < -144;
  while (boulders.length < BOULDER_COUNT) {
    const x = RECT.minX - 20 + random() * (RECT.maxX - RECT.minX + 60);
    const z = RECT.minZ - 10 + random() * (RECT.maxZ - RECT.minZ + 20);
    if (inside(x, z) && random() > 0.15) continue;
    if (Math.abs(x + 44) < 6) continue;
    const s = 0.3 + Math.pow(random(), 2.5) * 1.6;
    boulders.push(composeMatrix(x, ground(x, z) + s * 0.15, z, random() * 3, random() * 6, random() * 3, s * 1.2, s * 0.75, s));
    boulderColors.push(new THREE.Color(0x48474a).multiplyScalar(0.7 + random() * 0.45));
  }
  while (tufts.length < TUFT_COUNT) {
    const x = RECT.minX - 20 + random() * (RECT.maxX - RECT.minX + 60);
    const z = RECT.minZ - 10 + random() * (RECT.maxZ - RECT.minZ + 20);
    if (inside(x, z) && random() > 0.25) continue;
    if (fbm(x * 0.04, z * 0.04, 2) < 0.38) continue;
    const s = 0.55 + random() * 0.6;
    tufts.push(composeMatrix(x, ground(x, z), z, 0, random() * 6, 0, s, s * 0.9, s));
    tuftColors.push(new THREE.Color(random() > 0.4 ? 0x9c8a55 : 0x7d7a45).multiplyScalar(0.75 + random() * 0.35));
  }
  group.add(createInstanced(new THREE.DodecahedronGeometry(0.6, 0), 'rock', boulders, boulderColors));
  group.add(createInstancedChunks(createTuftGeometry(), 'grassTuft', tufts, tuftColors, 100, 65));
}

export function buildYoav(scene) {
  const group = new THREE.Group();
  group.name = 'region-yoav';
  const bake = createBake();
  for (const fp of FOOTPRINTS.filter((f) => f.region === REGION && f.kind === 'building')) {
    if (fp.id === 'yoavHangar') addHangar(bake, fp);
    else addGolanBuilding(bake, fp, fp.id === 'yoavMess' ? SLATE_COLOR : ROOF_COLOR, 1);
  }
  for (const wall of WALLS.filter((w) => w.region === REGION)) addFenceRun(bake, REGION, wall.from, wall.to);
  addGate(bake);
  addMemorial(bake);
  addParadeAndStaging(bake);
  TREES.filter(([x, z]) => z <= -128 && z > -222 && x < -48).forEach(([x, z, kind], i) => {
    addTree(bake, x, ground(x, z), z, kind, i + 41);
    addCollider(REGION, x, z, 0.6, 0.6, 3);
  });
  group.add(bake.build('yoav-static'));
  addScatter(group);
  scene.add(group);
  return group;
}
