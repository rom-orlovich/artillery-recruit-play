import * as THREE from 'three';
import { getTerrainHeight } from '../world.js';
import {
  createBake,
  createReserveMats,
  placeDohers,
  addBasaltBoulders,
  addTWalls,
  addEarthenRampart,
  addAmmoDump,
  addAmmoPallets,
  addFdcStation,
  addCamoCanopy,
  addCampCluster,
  addPerimeterSign
} from '../props/reserve-props.js';
import { addCypressRows, addEucalyptusWindbreak, addOliveGrove, addGrassTufts } from '../props/reserve-trees.js';

const SPAWN = { x: 0, z: 42 };
const GUNS = [
  { x: -39, z: -10, yaw: 0 },
  { x: -13, z: -10, yaw: 0 },
  { x: 13, z: -10, yaw: 0 },
  { x: 39, z: -10, yaw: 0 }
];

function isBlockedProp(x, z) {
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) return true;
  if (Math.abs(x - SPAWN.x) < 7 && z <= SPAWN.z + 4 && z >= SPAWN.z - 16) return true;
  if (Math.abs(z - 4) < 3.5 && Math.abs(x) < 68) return true;
  if (Math.abs(z - 60) < 4.5 && x > -90 && x < 85) return true;
  for (let i = 0; i < GUNS.length; i++) {
    if (Math.abs(x - GUNS[i].x) < 7.5 && Math.abs(z - GUNS[i].z) < 9.0) return true;
  }
  if (Math.abs(x + 28) < 9 && Math.abs(z - 22) < 6) return true;
  if (Math.abs(x - 28) < 9 && Math.abs(z - 22) < 6) return true;
  if (Math.abs(x + 56) < 8 && Math.abs(z + 2) < 7) return true;
  if (Math.abs(x - 50) < 8 && Math.abs(z - 28) < 6) return true;
  return false;
}

export function buildBeitHillel(mapGroup) {
  mapGroup.userData.guns = GUNS;
  const mats = createReserveMats();
  const bake = createBake(mapGroup);
  placeDohers(mapGroup, bake, GUNS, getTerrainHeight, mats);
  for (let i = 0; i < GUNS.length; i++) {
    const g = GUNS[i];
    addCamoCanopy(bake, getTerrainHeight, g.x, g.z + 2.2, 8.2, 7.4, 4.0, g.yaw, mats);
    addAmmoPallets(bake, getTerrainHeight, g.x, g.z + 9.2, g.yaw, mats);
  }
  addFdcStation(bake, mapGroup, getTerrainHeight, -24, 22, 0, 'container', mats);
  addFdcStation(bake, mapGroup, getTerrainHeight, -38, 22, 0, 'tent', mats);
  addAmmoDump(bake, mapGroup, getTerrainHeight, -56, -2, 0.2, mats);
  addCampCluster(bake, mapGroup, getTerrainHeight, 50, 28, -0.25, mats);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sy = getTerrainHeight(28, 22);
  bake.add(box, mats.concrete, 28, sy + 0.1, 22, 0, 0, 0, 9.2, 0.24, 5.4);
  bake.add(box, mats.containerRed, 28, sy + 1.5, 22, 0, 0, 0, 6.0, 2.5, 2.4);
  bake.add(box, mats.canvas, 28, sy + 2.85, 22, 0, 0, 0, 9.0, 0.14, 5.2);
  bake.add(box, mats.orange, 20, sy + 0.65, 25, 0, 0, 0, 1.8, 1.2, 1.1);
  const wy = getTerrainHeight(-72, 74);
  bake.add(cyl, mats.concreteDark, -72, wy + 7.5, 74, 0, 0, 0, 1.4, 15.0, 1.4);
  bake.add(cyl, mats.concrete, -72, wy + 16.5, 74, 0, 0, 0, 3.4, 4.2, 3.4);
  box.dispose();
  cyl.dispose();
  addEarthenRampart(bake, mapGroup, getTerrainHeight, -68, -28, -54, -30, 2.1, 4.8, mats.claySoil);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, 54, -28, 70, -28, 2.1, 4.8, mats.claySoil);
  bake.flush();
  const tWalls = [];
  for (let i = 0; i < 6; i++) tWalls.push({ x: -56 + i * 3.0, z: 58, yaw: 0 });
  for (let i = 0; i < 6; i++) tWalls.push({ x: 26 + i * 3.0, z: 58, yaw: 0 });
  tWalls.push({ x: -49, z: 4, yaw: 1.57 }, { x: -49, z: 1, yaw: 1.57 });
  addTWalls(mapGroup, getTerrainHeight, tWalls, mats);
  addPerimeterSign(mapGroup, getTerrainHeight, -22, 48, -0.2, 'מחנה בית הלל\nסוללה ב׳', mats);
  addBasaltBoulders(mapGroup, getTerrainHeight, 2041, 130, [-116, 112, -108, 96], [0x8e8576, 0x6f675b, 0x5e584e], isBlockedProp);
  addEucalyptusWindbreak(mapGroup, getTerrainHeight, [
    { x1: -84, z1: -86, x2: -80, z2: 72, count: 16 },
    { x1: -76, z1: 72, x2: -24, z2: 72, count: 7 },
    { x1: 24, z1: 72, x2: 78, z2: 72, count: 7 }
  ], 2042, isBlockedProp);
  addCypressRows(mapGroup, getTerrainHeight, [
    { x1: 74, z1: -76, x2: 78, z2: 52, count: 16 }
  ], 2043, isBlockedProp);
  addOliveGrove(mapGroup, null, getTerrainHeight, {
    minX: -72, maxX: 66, minZ: -86, maxZ: -46, stepX: 9, stepZ: 9,
    palette: [0x2f4a25, 0x3b592c, 0x8a5b2c, 0x365228]
  }, 2044, isBlockedProp);
  addGrassTufts(mapGroup, getTerrainHeight, 720, [-114, 112, -104, 96], [0x9f8b52, 0x5e843c, 0x768246], 2045, isBlockedProp);
}
