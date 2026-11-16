import * as THREE from 'three';
import { getTerrainHeight } from '../world.js';
import {
  createBake,
  createReserveMats,
  placeDohers,
  addBasaltBoulders,
  addSyrianBunkerRuin,
  addTWalls,
  addEarthenRampart,
  addAmmoDump,
  addAmmoPallets,
  addFdcStation,
  addCamoCanopy,
  addCampCluster,
  addPerimeterSign
} from '../props/reserve-props.js';
import { addCypressRows, addOliveGrove, addGrassTufts } from '../props/reserve-trees.js';

const SPAWN = { x: 0, z: 38 };
const GUNS = [
  { x: -36, z: -12, yaw: 0 },
  { x: -12, z: -8, yaw: 0 },
  { x: 12, z: -14, yaw: 0 },
  { x: 36, z: -10, yaw: 0 }
];

function isBlockedProp(x, z) {
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) return true;
  if (Math.abs(x - SPAWN.x) < 7 && z <= SPAWN.z + 4 && z >= SPAWN.z - 16) return true;
  if (Math.abs(z - 48) < 4.5 && x > -95 && x < 75) return true;
  if (Math.abs(z - 2) < 3.5 && Math.abs(x) < 62) return true;
  for (let i = 0; i < GUNS.length; i++) {
    if (Math.abs(x - GUNS[i].x) < 7.5 && Math.abs(z - GUNS[i].z) < 9.0) return true;
  }
  if (Math.abs(x - 26) < 7 && Math.abs(z - 22) < 6) return true;
  if (Math.abs(x + 32) < 7 && Math.abs(z - 18) < 6) return true;
  if (Math.abs(x + 52) < 7 && Math.abs(z - 8) < 6) return true;
  if (Math.abs(x - 48) < 7 && Math.abs(z - 16) < 6) return true;
  if (Math.abs(x + 64) < 8 && Math.abs(z + 56) < 8) return true;
  return false;
}

export function buildZaura(mapGroup) {
  mapGroup.userData.guns = GUNS;
  const mats = createReserveMats();
  const bake = createBake(mapGroup);
  placeDohers(mapGroup, bake, GUNS, getTerrainHeight, mats);
  for (let i = 0; i < GUNS.length; i++) {
    const g = GUNS[i];
    addCamoCanopy(bake, getTerrainHeight, g.x, g.z + 2.5, 7.6, 7.2, 3.8, g.yaw, mats);
    addAmmoPallets(bake, getTerrainHeight, g.x, g.z + 9.2, g.yaw, mats);
  }
  addFdcStation(bake, mapGroup, getTerrainHeight, 26, 22, -0.25, 'tent', mats);
  addFdcStation(bake, mapGroup, getTerrainHeight, 48, 16, 1.57, 'container', mats);
  addAmmoDump(bake, mapGroup, getTerrainHeight, -32, 18, 0.15, mats);
  addCampCluster(bake, mapGroup, getTerrainHeight, -52, 8, 0.2, mats);
  addSyrianBunkerRuin(bake, mapGroup, getTerrainHeight, -64, -56, 0.55, mats);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, -72, -32, -50, -34, 1.9, 4.6, mats.basaltSoil);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, 50, -32, 74, -30, 1.9, 4.6, mats.basaltSoil);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, -46, 18, -42, 28, 1.6, 4.0, mats.basaltSoil);
  const ptzMast = new THREE.CylinderGeometry(0.08, 0.12, 5.2, 6);
  const ptzHead = new THREE.BoxGeometry(0.45, 0.35, 0.55);
  const py = getTerrainHeight(-52, -42);
  bake.add(ptzMast, mats.gunMetal, -52, py + 2.6, -42);
  bake.add(ptzHead, mats.containerWhite, -52, py + 5.3, -42);
  ptzMast.dispose();
  ptzHead.dispose();
  bake.flush();
  const tWalls = [];
  for (let i = 0; i < 6; i++) tWalls.push({ x: -58 + i * 3.0, z: 54, yaw: 0 });
  for (let i = 0; i < 6; i++) tWalls.push({ x: 24 + i * 3.0, z: 54, yaw: 0 });
  tWalls.push({ x: -38, z: 24, yaw: 1.57 }, { x: -38, z: 21, yaw: 1.57 }, { x: 34, z: 26, yaw: 0.4 });
  addTWalls(mapGroup, getTerrainHeight, tWalls, mats);
  addPerimeterSign(mapGroup, getTerrainHeight, -22, 44, -0.35, 'גזרת זעורה\nסוללת מילואים', mats);
  addBasaltBoulders(mapGroup, getTerrainHeight, 1041, 230, [-118, 118, -110, 96], [0x4a3f38, 0x564c44, 0x70675c, 0x3b332e], isBlockedProp);
  addCypressRows(mapGroup, getTerrainHeight, [
    { x1: 78, z1: -60, x2: 84, z2: 42, count: 14 },
    { x1: -86, z1: -20, x2: -82, z2: 46, count: 9 }
  ], 1042, isBlockedProp);
  addOliveGrove(mapGroup, null, getTerrainHeight, {
    minX: 16, maxX: 72, minZ: -84, maxZ: -46, stepX: 14, stepZ: 14,
    palette: [0x58663d, 0x687347, 0x4b5734]
  }, 1043, isBlockedProp);
  addGrassTufts(mapGroup, getTerrainHeight, 680, [-115, 115, -105, 95], [0xb8a25a, 0x8c7a45, 0xa28b52], 1044, isBlockedProp);
}
