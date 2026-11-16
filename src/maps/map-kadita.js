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
import { addCypressRows, addOliveGrove, addPineOakForest, addGrassTufts } from '../props/reserve-trees.js';

const SPAWN = { x: 0, z: 40 };
const GUNS = [
  { x: -34, z: 4, yaw: -0.15 },
  { x: -11, z: -4, yaw: -0.1 },
  { x: 14, z: -11, yaw: 0.05 },
  { x: 38, z: -18, yaw: 0.1 }
];

function isBlockedProp(x, z) {
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) return true;
  if (Math.abs(x - SPAWN.x) < 7 && z <= SPAWN.z + 4 && z >= SPAWN.z - 16) return true;
  if (Math.abs(z - 46) < 4.0 && x > -80 && x < 80) return true;
  for (let i = 0; i < GUNS.length; i++) {
    if (Math.abs(x - GUNS[i].x) < 7.5 && Math.abs(z - GUNS[i].z) < 9.5) return true;
  }
  if (Math.abs(x - 24) < 7 && Math.abs(z - 22) < 6) return true;
  if (Math.abs(x + 38) < 7 && Math.abs(z - 28) < 6) return true;
  if (Math.abs(x + 54) < 7 && Math.abs(z - 14) < 6) return true;
  if (Math.abs(x + 22) < 7 && Math.abs(z - 16) < 6) return true;
  if (Math.abs(x - 46) < 7 && Math.abs(z - 8) < 6) return true;
  if (Math.abs(x + 66) < 8 && Math.abs(z + 52) < 8) return true;
  return false;
}

export function buildKadita(mapGroup) {
  mapGroup.userData.guns = GUNS;
  const mats = createReserveMats();
  const bake = createBake(mapGroup);
  placeDohers(mapGroup, bake, GUNS, getTerrainHeight, mats);
  for (let i = 0; i < GUNS.length; i++) {
    const g = GUNS[i];
    const rx = Math.sin(g.yaw);
    const rz = Math.cos(g.yaw);
    addCamoCanopy(bake, getTerrainHeight, g.x + rx * 2.4, g.z + rz * 2.4, 8.0, 7.6, 4.0, g.yaw, mats);
    addAmmoPallets(bake, getTerrainHeight, g.x + rx * 9.4, g.z + rz * 9.4, g.yaw, mats);
  }
  addFdcStation(bake, mapGroup, getTerrainHeight, 24, 22, 0.15, 'tent', mats);
  addFdcStation(bake, mapGroup, getTerrainHeight, -38, 28, -0.2, 'container', mats);
  addAmmoDump(bake, mapGroup, getTerrainHeight, -54, 14, 0.2, mats);
  addCampCluster(bake, mapGroup, getTerrainHeight, -22, 16, 0.1, mats);
  addCampCluster(bake, mapGroup, getTerrainHeight, 46, 8, -0.25, mats);
  addSyrianBunkerRuin(bake, mapGroup, getTerrainHeight, -66, -52, 0.45, mats);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, -64, -18, -48, -22, 2.0, 4.4, mats.terraSoil);
  addEarthenRampart(bake, mapGroup, getTerrainHeight, 52, -32, 70, -28, 2.0, 4.4, mats.terraSoil);
  addOliveGrove(mapGroup, bake, getTerrainHeight, {
    minX: -88, maxX: -24, minZ: -82, maxZ: -44, stepX: 11, stepZ: 11,
    terraces: [
      { x1: -86, z1: -44, x2: -24, z2: -46 },
      { x1: -88, z1: -62, x2: -22, z2: -64 }
    ]
  }, 3041, isBlockedProp);
  bake.flush();
  const tWalls = [];
  for (let i = 0; i < 5; i++) tWalls.push({ x: -52 + i * 3.0, z: 52, yaw: 0 });
  for (let i = 0; i < 5; i++) tWalls.push({ x: 24 + i * 3.0, z: 52, yaw: 0 });
  tWalls.push({ x: -47, z: 18, yaw: 1.57 }, { x: -47, z: 15, yaw: 1.57 });
  addTWalls(mapGroup, getTerrainHeight, tWalls, mats);
  addPerimeterSign(mapGroup, getTerrainHeight, -24, 44, -0.3, 'גזרת כדיתא\nגליל עליון', mats);
  addBasaltBoulders(mapGroup, getTerrainHeight, 3042, 210, [-116, 114, -108, 96], [0xd2cbb8, 0xb8ad96, 0x8a6d52, 0x9b9282], isBlockedProp);
  addCypressRows(mapGroup, getTerrainHeight, [
    { x1: -76, z1: 58, x2: -22, z2: 64, count: 9 },
    { x1: 22, z1: 64, x2: 76, z2: 58, count: 9 }
  ], 3043, isBlockedProp);
  addPineOakForest(mapGroup, getTerrainHeight, [
    {
      minX: -116, maxX: 116, minZ: -112, maxZ: -54, count: 70, limit: 70,
      palette: [0x3a5436, 0x455f38, 0x8b6c32],
      charZone: (x, z) => x > 55 && z < -45
    },
    {
      minX: 64, maxX: 116, minZ: -54, maxZ: 64, count: 40, limit: 110,
      palette: [0x3a5436, 0x3e522b, 0x7e6530],
      charZone: (x, z) => x > 55 && z < -45
    },
    {
      minX: -116, maxX: -66, minZ: -40, maxZ: 64, count: 35, limit: 145,
      palette: [0x3a5436, 0x3e522b, 0x8a6e34]
    }
  ], 3044, isBlockedProp);
  addGrassTufts(mapGroup, getTerrainHeight, 680, [-114, 114, -106, 94], [0xa99a5c, 0x5b7334, 0x8f7a44], 3045, isBlockedProp);
}
