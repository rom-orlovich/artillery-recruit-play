import * as THREE from 'three';
import { MAP_DEFS, GUNS, GUN_BODY_OFFSET, FOOTPRINTS, WALLS, TREES, ROADS } from './world-layout.js';
import { LANDMARKS } from './config.js';
import { createBake, addCollider, addSegmentCollider, addSign, ground, createInstanced, createInstancedChunks, composeMatrix, cullBeyond } from './world-kit.js';
import { addRoem, addAlfa, addSoldier, addTree, placeDoher, addGunCrew } from './world-vehicles.js';
import { createShellPallet } from './props/shell-pallet.js';
import { createMafikVehicle } from './props/mafik-vehicle.js';
import { createSeededRandom } from './props/materials.js';
import { createTuftGeometry } from './world-shivta.js';
import { fbm, distanceToSegment } from './world-terrain.js';
import { buildLineCamp } from './world-line-camp.js';

const REGION = 'line';
const SHELL_ROW = 6;
const BOULDER_COUNT = 220;
const PEBBLE_COUNT = 480;
const TUFT_COUNT = 4400;
const FIELD = { minX: -205, maxX: 205, minZ: -440, maxZ: -205 };
const STRAW = [0x927f54, 0x87744b, 0x7d6c47, 0x8b7850, 0x736340];
const CAIRN_STONES = [0x6a655d, 0x5c574f, 0x4a4640, 0x8e887c];
const CAMO_GUNS = ['A1', 'B2'];

export const GUN_CREW = {
  A1: [[-0.35, 1.2]],
  A2: [[0.6, 0.4], [-0.5, 1.6]],
  A3: [[-0.4, 0.9]],
  B1: [[-0.4, 0.8]],
  B2: [[-0.35, 1.1]],
  B3: [[-0.3, 1.3]]
};
export const GUN_CREW_FACING = Math.PI * 0.8;
export const FOOT_OFFSETS = [[-0.11, 0.04], [0.11, 0.04]];
export { addGunCrew };

function shellGeometry() {
  const profile = [[0, 0], [0.078, 0], [0.078, 0.05], [0.081, 0.06], [0.078, 0.08], [0.078, 0.5], [0.066, 0.62], [0.044, 0.72], [0.026, 0.79], [0.012, 0.82], [0, 0.825]];
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 6);
}

function addCamoNet(bake, cx, cz, w, d, height, seed) {
  const random = createSeededRandom(seed);
  const net = new THREE.PlaneGeometry(w, d, 7, 6).rotateX(-Math.PI / 2);
  const pos = net.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const edge = Math.max(Math.abs(pos.getX(i)) / (w / 2), Math.abs(pos.getZ(i)) / (d / 2));
    pos.setY(i, -Math.pow(edge, 2.2) * (height - 0.6) + (random() - 0.5) * 0.35);
  }
  net.computeVertexNormals();
  bake.mesh('camoNet', net, cx, ground(cx, cz) + height, cz);
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, height, 5);
  for (const [px, pz] of [[-w * 0.3, -d * 0.3], [w * 0.3, d * 0.3], [w * 0.32, -d * 0.28], [-w * 0.28, d * 0.32]]) {
    bake.mesh('paint', poleGeo, cx + px, ground(cx + px, cz + pz) + height / 2, cz + pz, 0, 0x55553f);
  }
}

function addGuns(bake, mapGroup, shell) {
  const pallet = createShellPallet();
  const bandGeo = new THREE.CylinderGeometry(0.083, 0.083, 0.03, 6);
  const fuzeGeo = new THREE.ConeGeometry(0.03, 0.06, 5);
  for (const gun of MAP_DEFS.line.guns) {
    const rx = gun.x;
    const rz = gun.z;
    const yaw = gun.yaw || 0;
    const bodyZ = rz + GUN_BODY_OFFSET;
    const y = ground(rx, bodyZ);
    const slot = placeDoher(mapGroup, rx, y, bodyZ, yaw, 0.04 + Math.abs(rx % 3) * 0.04);
    if (GUN_CREW[gun.id]) addGunCrew(slot, { members: GUN_CREW[gun.id], facing: GUN_CREW_FACING }, rx, bodyZ, gun.id);
    addCollider(REGION, rx, bodyZ, 3.4, 6.6, 3.2);
    for (let i = 0; i < SHELL_ROW; i++) {
      const sx = rx - 3.5 + (i % 2) * 0.22;
      const sz = rz - 1.8 - i * 0.36;
      const sy = ground(sx, sz);
      bake.mesh('shellOlive', shell, sx, sy, sz, i * 0.7);
      bake.mesh('copperBand', bandGeo, sx, sy + 0.065, sz);
      bake.mesh('fuzeGray', fuzeGeo, sx, sy + 0.84, sz);
    }
    if (gun.id === 'A2') bake.object(pallet, rx - 4.4, ground(rx - 4.4, rz + 1.6), rz + 1.6, 0.2);
    for (let i = 0; i < 5; i++) {
      const cx = rx + 3.6 + (i % 2) * 0.7;
      const cz = rz + 0.4 + Math.floor(i / 2) * 0.75;
      bake.box('paint', 0.62, 0.36, 1.1, cx, ground(cx, cz) + 0.18 + (i === 4 ? 0.36 : 0), cz, 0.05 * i, i % 2 ? 0x5a6534 : 0x6b5638);
    }
    if (CAMO_GUNS.includes(gun.id)) addCamoNet(bake, rx, bodyZ + 0.5, 8.5, 9, 4.6, rx * 3);
  }
  addSoldier(bake, -9.6, ground(-9.6, -287.6), -287.6, 2.4, 'arms');
  addSoldier(bake, -4.0, ground(-4.0, -287.4), -287.4, -2.0);
}

function addAmmoDump(bake) {
  const dump = FOOTPRINTS.find((fp) => fp.id === 'lineAmmoDump');
  const pallet = createShellPallet();
  const dy = ground(dump.x, dump.z);
  for (let i = 0; i < 3; i++) bake.object(pallet, dump.x - 2.4 + i * 1.5, dy, dump.z - 0.5, (i % 2) * 0.1);
  for (let i = 0; i < 9; i++) bake.box('paint', 0.62, 0.36, 1.1, dump.x - 2.6 + (i % 3) * 1.3, dy + 0.18 + Math.floor(i / 3) * 0.37, dump.z - 1.6, 0, i % 2 ? 0x5a6534 : 0x6b5638);
  for (let i = 0; i < 4; i++) bake.box('paint', 1.1, 0.55, 0.65, dump.x + 2.6, dy + 0.28 + (i % 2) * 0.56, dump.z - 1.2 + Math.floor(i / 2) * 0.8, 0.05, 0x5c4932);
  addCamoNet(bake, dump.x, dump.z, 9, 7, 3.2, 91);
  addCollider(REGION, dump.x, dump.z - 0.4, 6.6, 3.2, 1.4);
  addAlfa(bake, -34, ground(-34, -274), -274, Math.PI + 0.15);
  addCollider(REGION, -34, -274, 3.0, 6.0, 2.6);
  addAlfa(bake, 104, ground(104, -276), -276, 0.4);
  addCollider(REGION, 104, -276, 4.2, 6.2, 2.6);
  addSoldier(bake, -24.5, ground(-24.5, -279.6), -279.6, 0.3, 'arms');
}

function addRoemAndMafik(bake) {
  const roem = LANDMARKS.roemPos;
  addRoem(bake, roem.x, ground(roem.x, roem.z - 5.6), roem.z - 5.6, 0);
  addCollider(REGION, roem.x, roem.z - 5.6, 2.6, 9.4, 3.2);
  const fp = FOOTPRINTS.find((f) => f.id === 'lineMafikVehicle');
  const fy = ground(fp.x, fp.z);
  bake.object(createMafikVehicle(), fp.x, fy, fp.z, Math.PI);
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
  for (const [dx, h] of [[-1.6, 7], [1.4, 5.5]]) bake.mesh('paint', new THREE.CylinderGeometry(0.03, 0.05, h, 5), fp.x + dx, fy + h / 2 + 2.4, fp.z - 1.6, 0, 0x2e302b);
  addCamoNet(bake, fp.x, fp.z - 0.8, 6, 7, 3.4, 33);
  bake.box('paint', 1.6, 0.06, 0.8, fp.x + 3.2, ground(fp.x + 3.2, fp.z + 3) + 0.74, fp.z + 3, 0, 0x6b6a52);
  addSoldier(bake, fp.x + 3.2, ground(fp.x + 3.2, fp.z + 4), fp.z + 4, Math.PI, 'arms');
}

function addSignCairn(bake) {
  const cx = -51;
  const cz = -236.2;
  const y = ground(cx, cz);
  const random = createSeededRandom(5150);
  const stone = new THREE.DodecahedronGeometry(0.3, 0);
  for (let i = 0; i < 22; i++) {
    const layer = i < 11 ? 0 : i < 18 ? 1 : 2;
    const a = random() * Math.PI * 2;
    const r = (1.1 - layer * 0.35) * Math.sqrt(random());
    const s = 0.8 + random() * 0.9;
    bake.mesh('paint', stone, cx + Math.cos(a) * r * 1.4, y + 0.18 + layer * 0.32, cz + Math.sin(a) * r * 0.7, random() * 3, CAIRN_STONES[Math.floor(random() * CAIRN_STONES.length)], random(), random(), s * 1.2, s * 0.8, s);
  }
  const ry = -0.62;
  for (const side of [-1, 1]) bake.box('paint', 0.06, 1.9, 0.06, cx + Math.cos(ry) * side * 0.85, y + 0.95, cz - Math.sin(ry) * side * 0.85, ry, 0x6e3b23, 0, side * 0.03);
  addSign(bake, 'רחוב האפרסק\nסוללה א׳ — 409', cx, y + 1.25, cz, ry, 1.9, 0.62, { painted: true, colors: ['#f2c935', '#3f7fe0'], thickness: 0.05 });
  bake.box('paint', 1.95, 0.66, 0.06, cx, y + 1.25, cz, ry, 0x4a3727);
  addCollider(REGION, cx, cz, 2.6, 1.6, 1.6);
}

function addOutpost(bake) {
  const random = createSeededRandom(2020);
  for (const wall of WALLS.filter((w) => w.region === REGION && w.kind === 'stone')) {
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    const count = Math.round(length / 1.15);
    for (let i = 0; i < count; i++) {
      const x = wall.from[0] + ((wall.to[0] - wall.from[0]) * (i + 0.5)) / count;
      const z = wall.from[1] + ((wall.to[1] - wall.from[1]) * (i + 0.5)) / count;
      for (let layer = 0; layer < 3; layer++) bake.box('basaltWall', 1.1 + random() * 0.3, 0.5, 0.95, x + (random() - 0.5) * 0.2, ground(x, z) + 0.25 + layer * 0.48, z + (random() - 0.5) * 0.2, random() * 0.3);
    }
    addSegmentCollider(REGION, wall.from, wall.to, 1.0, 1.5);
  }
  const bunker = FOOTPRINTS.find((f) => f.id === 'lineOutpostBunker');
  const by = ground(bunker.x, bunker.z);
  bake.box('concrete', bunker.w, bunker.h, bunker.d, bunker.x, by + bunker.h / 2, bunker.z);
  bake.box('paint', bunker.w + 0.6, 0.6, bunker.d + 0.6, bunker.x, by + bunker.h + 0.3, bunker.z, 0, 0xa38f66);
  addCollider(REGION, bunker.x, bunker.z, bunker.w, bunker.d, bunker.h);
  for (const [x, z] of [[-20, -408], [20, -378]]) {
    const y = ground(x, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bake.box('paint', 0.12, 3.6, 0.12, x + dx, y + 1.8, z + dz, 0, 0x6d6f6a);
    bake.box('paint', 2.6, 1.1, 2.6, x, y + 4.0, z, 0, 0xa38f66);
    bake.box('paint', 2.9, 0.12, 2.9, x, y + 5.4, z, 0, 0x5e6250);
    addCollider(REGION, x, z, 2.4, 2.4, 5.5);
  }
  addSign(bake, 'מוצב צוקית — עמדת תצפית', 0, 2.3, -371.3, 0, 4.4, 0.9, { bg: '#3b2a22' });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5);
  for (let x = -60; x <= 60; x += 4) bake.mesh('paint', postGeo, x, ground(x, -428) + 1.2, -428, 0, 0x5f6258);
  bake.box('paint', 120, 0.03, 0.03, 0, ground(0, -428) + 1.7, -428, 0, 0x707070);
  bake.box('paint', 120, 0.03, 0.03, 0, ground(0, -428) + 0.9, -428, 0, 0x707070);
  addSign(bake, 'גבול — אין מעבר', 0, ground(0, -427.8) + 2.6, -427.8, 0, 3.6, 0.8, { bg: '#7a1f1a' });
}

function addUavRidge(bake) {
  const pad = LANDMARKS.uavLaunch;
  const y = ground(pad.x, pad.z);
  bake.box('oliveMetal', 2.4, 2.2, 4.8, pad.x + 6.5, y + 1.1, pad.z - 1, 0.3);
  addCollider(REGION, pad.x + 6.5, pad.z - 1, 3.4, 5.2, 2.2);
  bake.box('paint', 0.3, 0.3, 4.6, pad.x - 4.2, y + 0.9, pad.z + 2.6, 0.5, 0x4a5047, -0.25);
  addSign(bake, 'רכס רוכ"ש — שיגור סקיילרק', pad.x + 4.2, y + 2.6, pad.z + 2, -0.4, 4.4, 0.9, { bg: '#1d3c47' });
}

function blocked(x, z, margin) {
  if (x > -42 && x < 50 && z > -260 && z < -222) return true;
  if (Math.abs(x) < 28 && z < -366 && z > -416) return true;
  for (const gun of GUNS) if (Math.hypot(x - gun.rear[0], z - gun.rear[1] + 4) < 12 + margin) return true;
  for (const fp of FOOTPRINTS) if (fp.region === REGION && Math.abs(x - fp.x) < fp.w / 2 + 2 + margin && Math.abs(z - fp.z) < fp.d / 2 + 2 + margin) return true;
  for (const road of ROADS) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      if (distanceToSegment(x, z, ax, az, bx, bz).dist < road.width / 2 + margin) return true;
    }
  }
  return false;
}

function addScatter(mapGroup) {
  const random = createSeededRandom(9409);
  const sample = () => [FIELD.minX + random() * (FIELD.maxX - FIELD.minX), FIELD.minZ + random() * (FIELD.maxZ - FIELD.minZ)];
  const boulders = [];
  const boulderColors = [];
  while (boulders.length < BOULDER_COUNT) {
    const [x, z] = sample();
    if (blocked(x, z, 1.5) || fbm(x * 0.02 + 5, z * 0.02, 2) < 0.4) continue;
    const s = 0.35 + Math.pow(random(), 2.4) * 1.7;
    boulders.push(composeMatrix(x, ground(x, z) + s * 0.1, z, random() * 3, random() * 6, random() * 3, s * 1.25, s * 0.7, s));
    boulderColors.push(new THREE.Color(random() > 0.85 ? 0xe2ded2 : 0xb8b4ac).multiplyScalar(0.75 + random() * 0.5));
  }
  const pebbles = [];
  const pebbleColors = [];
  while (pebbles.length < PEBBLE_COUNT) {
    const x = -120 + random() * 220;
    const z = -205 - random() * 150;
    if (blocked(x, z, -1.5)) continue;
    const s = 0.08 + random() * 0.16;
    pebbles.push(composeMatrix(x, ground(x, z) + s * 0.2, z, random() * 3, random() * 6, 0, s * 1.4, s * 0.8, s));
    pebbleColors.push(new THREE.Color(random() > 0.8 ? 0xf0ece2 : 0xa29d94).multiplyScalar(0.8 + random() * 0.4));
  }
  const tufts = [];
  const tuftColors = [];
  while (tufts.length < TUFT_COUNT) {
    const [x, z] = random() < 0.65 ? [-130 + random() * 260, -210 - random() * 160] : sample();
    if (blocked(x, z, -1) || fbm(x * 0.05, z * 0.05 + 3, 2) < 0.3) continue;
    const s = 0.32 + random() * 0.4;
    tufts.push(composeMatrix(x, ground(x, z) - 0.03, z, 0, random() * 6, 0, s * 1.2, s * (0.8 + random() * 0.6), s * 1.2));
    tuftColors.push(new THREE.Color(STRAW[Math.floor(random() * STRAW.length)]).multiplyScalar(0.8 + random() * 0.35));
  }
  mapGroup.add(createInstanced(new THREE.DodecahedronGeometry(0.55, 0), 'rock', boulders, boulderColors));
  mapGroup.add(createInstanced(new THREE.OctahedronGeometry(1, 0), 'rock', pebbles, pebbleColors));
  mapGroup.add(createInstancedChunks(createTuftGeometry(), 'grassTuft', tufts, tuftColors, 140, 65));
}

export function buildLine(mapGroup) {
  const bake = createBake();
  const outpostBake = createBake();
  addGuns(bake, mapGroup, shellGeometry());
  addAmmoDump(bake);
  addRoemAndMafik(bake);
  addSignCairn(bake);
  addOutpost(outpostBake);
  addUavRidge(outpostBake);
  buildLineCamp(bake);
  TREES.filter(([x, z]) => z <= -222 || (z <= -128 && x >= -48)).forEach(([x, z, kind], i) => {
    addTree(bake, x, ground(x, z), z, kind, i + 71);
    addCollider(REGION, x, z, 0.7, 0.7, 3);
  });
  mapGroup.add(bake.build('line-static'));
  mapGroup.add(cullBeyond(outpostBake.build('line-outpost-static'), -30, -380, 210));
  addScatter(mapGroup);
  return mapGroup;
}
