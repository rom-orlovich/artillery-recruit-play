import * as THREE from 'three';
import { FOOTPRINTS } from './world-layout.js';
import { LANDMARKS } from './config.js';
import { addCollider, addSign, ground } from './world-kit.js';
import { addSoldier } from './world-vehicles.js';
import { createDomeTent } from './props/dome-tent.js';
import { createFieldGym } from './props/field-gym.js';

const REGION = 'line';
const TENT_HALF_WIDTH = 3;
const TENT_HALF_LENGTH = 7.5;
const DOOR_HALF_GAP = 1.0;
const WALL = 0.5;
const CANVAS_OLIVE = 0x6f6d4c;
const TOILET_BLUE = 0x2f6fb5;

const footprint = (id) => FOOTPRINTS.find((fp) => fp.id === id);

function addWalkInTent(bake, fp, interior) {
  bake.object(createDomeTent(interior), fp.x, ground(fp.x, fp.z), fp.z, 0);
  const { x, z } = fp;
  addCollider(REGION, x - TENT_HALF_WIDTH + 0.45, z, WALL + 0.4, TENT_HALF_LENGTH * 2, 3);
  addCollider(REGION, x + TENT_HALF_WIDTH - 0.45, z, WALL + 0.4, TENT_HALF_LENGTH * 2, 3);
  addCollider(REGION, x, z - TENT_HALF_LENGTH, TENT_HALF_WIDTH * 2, WALL, 3);
  const sideWidth = TENT_HALF_WIDTH - DOOR_HALF_GAP;
  for (const side of [-1, 1]) addCollider(REGION, x + side * (DOOR_HALF_GAP + sideWidth / 2), z + TENT_HALF_LENGTH, sideWidth, WALL, 3);
  if (interior === 'dinner') {
    addCollider(REGION, x, z - 0.5, 1.15, 8, 0.9);
  } else {
    for (const side of [-1, 1]) addCollider(REGION, x + side * 1.85, z - 0.4, 0.9, 9.6, 0.7);
  }
  addSign(bake, fp.label, x, ground(x, z) + 2.75, z + TENT_HALF_LENGTH + 0.12, 0, 2.4, 0.6, { bg: '#2f3a2a' });
}

function addCommandTent(bake, fp) {
  const y = ground(fp.x, fp.z);
  bake.box('paint', fp.w, 1.7, fp.d, fp.x, y + 0.85, fp.z, 0, CANVAS_OLIVE);
  for (const side of [-1, 1]) bake.box('paint', fp.w / 2 + 0.5, 0.06, fp.d + 0.4, fp.x + side * fp.w / 4, y + 2.2, fp.z, 0, 0x625f43, 0, side * -0.55);
  bake.box('paint', 1.4, 1.6, 0.04, fp.x, y + 0.8, fp.z + fp.d / 2 + 0.02, 0, 0x2b2b24);
  bake.box('paint', 1.6, 0.8, 1.0, fp.x + 1.6, y + 0.4, fp.z + fp.d / 2 + 1.0, 0, 0x8a7a55);
  addSign(bake, 'מסו"ל — מפקד הסוללה', fp.x, y + 2.2, fp.z + fp.d / 2 + 0.3, 0, 2.6, 0.6, { bg: '#3b2f22' });
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
}

function addKitchen(bake, fp) {
  const y = ground(fp.x, fp.z);
  bake.box('oliveMetal', fp.w, 2.1, fp.d, fp.x, y + 1.35, fp.z);
  for (const side of [-1, 1]) bake.mesh('paint', new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10).rotateZ(Math.PI / 2), fp.x + side * 1.6, y + 0.33, fp.z + 0.6, 0, 0x262626);
  bake.box('paint', 0.1, 0.05, 2.8, fp.x - fp.w / 2 - 1.2, y + 2.55, fp.z, 0, 0x6f6a4c, 0, -0.15);
  bake.box('paint', 2.4, 0.06, 3.2, fp.x - fp.w / 2 - 1.2, y + 2.5, fp.z, 0, 0x7a7454, 0, 0.12);
  bake.box('paint', 0.9, 0.06, 2.2, fp.x - fp.w / 2 - 0.9, y + 0.8, fp.z - 0.4, 0, 0xcfcac0);
  for (let i = 0; i < 4; i++) bake.box('paint', 0.42, 0.5, 0.36, fp.x - fp.w / 2 - 0.9, y + 1.08, fp.z - 1.2 + i * 0.55, 0, 0x4f5a38);
  for (let i = 0; i < 5; i++) bake.box('paint', 0.18, 0.46, 0.34, fp.x - fp.w / 2 - 0.4 + i * 0.22, y + 0.23, fp.z + 2.2, 0, 0x3d4a2c);
  addSign(bake, 'מטבח שדה', fp.x - fp.w / 2 - 0.02, y + 2.0, fp.z, -Math.PI / 2, 2.2, 0.55, { bg: '#4a3a1e' });
  addCollider(REGION, fp.x, fp.z, fp.w, fp.d, fp.h);
  bake.box('paint', 1.15, 1.15, 1.0, fp.x + 4.5, y + 0.58, fp.z + 5, 0, 0xe8e8e2);
  bake.box('paint', 1.2, 0.12, 1.05, fp.x + 4.5, y + 0.06, fp.z + 5, 0, 0x4e4e48);
  addCollider(REGION, fp.x + 4.5, fp.z + 5, 1.2, 1.1, 1.2);
}

function addUtilities(bake) {
  const gen = footprint('lineGenerator');
  const gy = ground(gen.x, gen.z);
  bake.box('oliveMetal', gen.w, gen.h, gen.d, gen.x, gy + gen.h / 2, gen.z);
  bake.mesh('paint', new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), gen.x + 0.4, gy + gen.h + 0.5, gen.z - 0.8, 0, 0x2a2a2a);
  bake.box('paint', 0.05, 0.05, 6.5, gen.x - 1.8, gy + 0.03, gen.z + 1.5, 0.9, 0x1d1d1d);
  addCollider(REGION, gen.x, gen.z, gen.w, gen.d, gen.h);
  const toilets = footprint('lineToilets');
  const ty = ground(toilets.x, toilets.z);
  for (let i = 0; i < 3; i++) {
    const x = toilets.x - 1.2 + i * 1.2;
    bake.box('paint', 1.1, 2.25, 1.1, x, ty + 1.12, toilets.z, 0, i === 1 ? 0x6b6a4e : TOILET_BLUE);
    bake.box('paint', 1.16, 0.12, 1.16, x, ty + 2.3, toilets.z, 0, 0xe6e6e6);
    bake.box('paint', 0.7, 1.8, 0.03, x, ty + 1.0, toilets.z + 0.56, 0, 0x2a5f9e);
  }
  addCollider(REGION, toilets.x, toilets.z, toilets.w, toilets.d, toilets.h);
}

function addCoffeeCorner(bake) {
  const board = LANDMARKS.dutyBoard;
  const cx = board.x - 4.5;
  const cz = board.z - 1.5;
  const y = ground(cx, cz);
  bake.mesh('palletWood', new THREE.CylinderGeometry(0.6, 0.6, 0.06, 14), cx, y + 0.72, cz);
  bake.mesh('palletWood', new THREE.CylinderGeometry(0.18, 0.18, 0.66, 10), cx, y + 0.36, cz);
  bake.mesh('blackSteel', new THREE.CylinderGeometry(0.11, 0.13, 0.18, 10), cx + 0.2, y + 0.84, cz);
  addCollider(REGION, cx, cz, 1.2, 1.2, 0.8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    bake.mesh('paint', new THREE.DodecahedronGeometry(0.28, 0), cx + Math.cos(a) * 2.3, y + 0.12, cz + Math.sin(a) * 2.3, a, 0x3c3b3d, 0, 0, 1.2, 0.6, 1);
  }
  for (const [a, pose] of [[0.6, 'sit'], [2.4, 'sit'], [4.3, 'arms']]) {
    const sx = cx + Math.cos(a) * 1.3;
    const sz = cz + Math.sin(a) * 1.3;
    bake.box('whitePlastic', 0.46, 0.04, 0.42, sx, y + 0.44, sz, -a);
    bake.box('whitePlastic', 0.44, 0.42, 0.04, sx + Math.cos(a) * 0.22, y + 0.68, sz + Math.sin(a) * 0.22, Math.PI / 2 - a);
    addSoldier(bake, sx, y, sz, Math.PI / 2 - a + Math.PI, pose);
  }
  const by = ground(board.x, board.z + 1.6);
  for (const side of [-1, 1]) bake.box('palletWood', 0.08, 1.9, 0.08, board.x + side * 0.85, by + 0.95, board.z + 1.6);
  bake.box('palletWood', 1.9, 1.0, 0.06, board.x, by + 1.35, board.z + 1.6);
  addSign(bake, 'לוח תורנויות\nשמירות · מטבח · ש"ג', board.x, by + 1.35, board.z + 1.56, Math.PI, 1.7, 0.85, { bg: '#e9e4d6', fg: '#1d2b3a', thickness: 0.035 });
  addCollider(REGION, board.x, board.z + 1.6, 2.0, 0.3, 2);
}

function addGuardPost(bake, x, z, ry) {
  const y = ground(x, z);
  for (let i = 0; i < 9; i++) {
    const a = -0.9 * Math.PI + (i / 8) * 1.8 * Math.PI;
    bake.box('paint', 0.7, 0.32, 0.42, x + Math.sin(a + ry) * 1.3, y + 0.16 + (i % 2) * 0.32, z + Math.cos(a + ry) * 1.3, a + ry, 0xa89a72);
    bake.box('paint', 0.7, 0.32, 0.42, x + Math.sin(a + ry) * 1.3, y + 0.8, z + Math.cos(a + ry) * 1.3, a + ry, 0x9c8e66);
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bake.box('paint', 0.08, 2.3, 0.08, x + dx, y + 1.15, z + dz, 0, 0x5d5b4a);
  bake.box('paint', 2.4, 0.06, 2.4, x, y + 2.32, z, ry, 0x67644a);
  addSoldier(bake, x, y, z, ry);
  addCollider(REGION, x, z, 2.6, 2.6, 2.4);
}

export function buildLineCamp(bake) {
  addWalkInTent(bake, footprint('lineSleepTent'), 'sleeping');
  addWalkInTent(bake, footprint('lineDinnerTent'), 'dinner');
  addCommandTent(bake, footprint('lineCommandTent'));
  addKitchen(bake, footprint('lineKitchen'));
  addUtilities(bake);
  addCoffeeCorner(bake);
  const gym = footprint('lineGym');
  bake.object(createFieldGym(), gym.x, ground(gym.x, gym.z), gym.z, 0, 1.25);
  addCollider(REGION, gym.x, gym.z - 0.2, 1.8, 1.6, 2.8);
  addGuardPost(bake, -28, -221, 0.3);
  addGuardPost(bake, 62, -254, -0.6);
  addSoldier(bake, 26.4, ground(26.4, -234), -234, Math.PI / 2);
  addSoldier(bake, 3.4, ground(3.4, -233.6), -233.6, 2.6);
  for (let i = 0; i < 6; i++) {
    bake.box('paint', 0.22, 0.32, 0.3, 4.5 + (i % 3) * 0.24, ground(4.5, -235) + 0.16 + Math.floor(i / 3) * 0.32, -235.2, 0, 0x3f5a2c);
  }
}
