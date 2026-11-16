import { getTerrainHeight } from '../world.js';
import {
  makeRng,
  createBake,
  createReserveMats,
  placeDohers,
  addAmmoPallets,
  addCamoCanopy,
  addPerimeterSign
} from '../props/reserve-props.js';
import { placeMapKit } from './map-kit.js';
import { registerPieceCollider } from './map-tzeelim-colliders.js';

const SPAWN_POINT = { x: 0, z: 46 };
const GUNS = [
  { id: 'TZ1', x: -30, z: -8, yaw: 0 },
  { id: 'TZ2', x: -10, z: -8, yaw: 0 },
  { id: 'TZ3', x: 10, z: -8, yaw: 0 },
  { id: 'TZ4', x: 30, z: -8, yaw: 0 }
];
const CANOPY_GUN_INDICES = new Set([0, 2]);
const CANOPY_Z_OFFSET = 2.2;
const CANOPY_WIDTH = 8.2;
const CANOPY_DEPTH = 7.4;
const CANOPY_HEIGHT = 4.0;
const AMMO_Z_OFFSET = 10.2;
const PIT_BERM_OFFSET = 6.8;
const SIGN_POS_X = -12;
const SIGN_POS_Z = 42;
const SIGN_YAW = 0.25;
const SIGN_TEXT = 'בסיס צאלים\nמל"י';

const SHRUB_COUNT = 24;
const SHRUB_SEED = 7741;
const SHRUB_ATTEMPT_LIMIT = 480;
const SHRUB_MIN_X = -96;
const SHRUB_MAX_X = 96;
const SHRUB_MIN_Z = -84;
const SHRUB_MAX_Z = 78;
const SPAWN_CLEARANCE_M = 10;
const GUN_CLEARANCE_M = 9;
const ROAD_CLEARANCE_M = 5;
const PIECE_CLEARANCE_M = 5;

function formatKitPlacementId(piece, x, z) {
  return `${piece}@${x.toFixed(1)},${z.toFixed(1)}`;
}

function distanceToSegment(pointX, pointZ, startX, startZ, endX, endZ) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const lengthSq = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSq === 0) {
    return Math.hypot(pointX - startX, pointZ - startZ);
  }
  const rawParam = ((pointX - startX) * deltaX + (pointZ - startZ) * deltaZ) / lengthSq;
  const clampedParam = Math.max(0, Math.min(1, rawParam));
  const closestX = startX + clampedParam * deltaX;
  const closestZ = startZ + clampedParam * deltaZ;
  return Math.hypot(pointX - closestX, pointZ - closestZ);
}

function isBlockedForShrub(posX, posZ, placements) {
  if (Math.hypot(posX - SPAWN_POINT.x, posZ - SPAWN_POINT.z) < SPAWN_CLEARANCE_M) {
    return true;
  }
  for (let i = 0; i < GUNS.length; i++) {
    if (Math.hypot(posX - GUNS[i].x, posZ - GUNS[i].z) < GUN_CLEARANCE_M) {
      return true;
    }
  }
  if (distanceToSegment(posX, posZ, 0, 46, 0, -8) < ROAD_CLEARANCE_M) {
    return true;
  }
  if (distanceToSegment(posX, posZ, 0, 46, -20, 20) < ROAD_CLEARANCE_M) {
    return true;
  }
  if (distanceToSegment(posX, posZ, -20, 20, -48, -6) < ROAD_CLEARANCE_M) {
    return true;
  }
  if (distanceToSegment(posX, posZ, -48, -6, -50, -25) < ROAD_CLEARANCE_M) {
    return true;
  }
  if (posX >= -14 && posX <= 38 && posZ >= 52 && posZ <= 64) {
    return true;
  }
  if (posX >= -76 && posX <= -32 && posZ >= -44 && posZ <= -9) {
    return true;
  }
  for (let i = 0; i < placements.length; i++) {
    const placed = placements[i];
    if (Math.hypot(posX - placed.x, posZ - placed.z) < PIECE_CLEARANCE_M) {
      return true;
    }
  }
  return false;
}

function collectStaticPlacements() {
  const placements = [
    { piece: 'tzeelim_hangar', x: 0, z: 58, ry: 0 },
    { piece: 'tzeelim_hangar', x: 24, z: 58, ry: 0 },
    { piece: 'tzeelim_meal_table', x: -4, z: 52, ry: 0 },
    { piece: 'tzeelim_meal_table', x: 4, z: 52, ry: 0 },
    { piece: 'tzeelim_village_house', x: -66, z: -36, ry: 0 },
    { piece: 'tzeelim_village_house', x: -54, z: -36, ry: 0 },
    { piece: 'tzeelim_village_house', x: -42, z: -36, ry: 0 },
    { piece: 'tzeelim_village_house', x: -66, z: -20, ry: Math.PI / 2 },
    { piece: 'tzeelim_village_house', x: -54, z: -22, ry: 0 },
    { piece: 'tzeelim_village_house', x: -42, z: -24, ry: -Math.PI / 2 },
    { piece: 'tzeelim_ruined_container', x: -64, z: -28, ry: 0.25 },
    { piece: 'tzeelim_ruined_container', x: -52, z: -29, ry: -0.15 },
    { piece: 'tzeelim_ruined_container', x: -35, z: -31, ry: 1.4 },
    { piece: 'tzeelim_container_wall', x: -66, z: -42, ry: 0 },
    { piece: 'tzeelim_container_wall', x: -59, z: -42, ry: 0 },
    { piece: 'tzeelim_container_wall', x: -52, z: -42, ry: 0 },
    { piece: 'tzeelim_container_wall', x: -45, z: -42, ry: 0 },
    { piece: 'tzeelim_container_wall', x: -68, z: -11, ry: 0 },
    { piece: 'tzeelim_container_wall', x: -61, z: -11, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -53, z: -13, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -51, z: -13, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -49, z: -13, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -43, z: -15, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -41, z: -15, ry: 0 },
    { piece: 'tzeelim_concrete_block', x: -39, z: -15, ry: 0 },
    { piece: 'tzeelim_striped_block', x: -48, z: -11, ry: 0.3 },
    { piece: 'tzeelim_striped_block', x: -44, z: -17, ry: -0.3 },
    { piece: 'tzeelim_ramp', x: 40, z: 20, ry: 0 },
    { piece: 'tzeelim_ramp', x: 48, z: 20, ry: 0 },
    { piece: 'tzeelim_acacia', x: 58, z: 8, ry: 0.4 },
    { piece: 'tzeelim_acacia', x: -64, z: 36, ry: 1.7 },
    { piece: 'tzeelim_acacia', x: 64, z: -48, ry: 2.8 },
    { piece: 'tzeelim_sand_berm', x: -86, z: -64, ry: 0.2 },
    { piece: 'tzeelim_sand_berm', x: -88, z: -20, ry: 1.5 },
    { piece: 'tzeelim_sand_berm', x: -86, z: 28, ry: 1.4 },
    { piece: 'tzeelim_sand_berm', x: 86, z: -62, ry: -0.2 },
    { piece: 'tzeelim_sand_berm', x: 88, z: -16, ry: -1.5 },
    { piece: 'tzeelim_sand_berm', x: 86, z: 30, ry: -1.4 },
    { piece: 'tzeelim_sand_berm', x: -46, z: -78, ry: 0.05 },
    { piece: 'tzeelim_sand_berm', x: 0, z: -82, ry: 0 },
    { piece: 'tzeelim_sand_berm', x: 46, z: -78, ry: -0.05 },
    { piece: 'tzeelim_sand_berm', x: -42, z: 78, ry: 0.1 },
    { piece: 'tzeelim_sand_berm', x: 48, z: 76, ry: -0.1 }
  ];
  for (let i = 0; i < GUNS.length; i++) {
    const gun = GUNS[i];
    placements.push({ piece: 'tzeelim_sand_berm', x: gun.x - PIT_BERM_OFFSET, z: gun.z, ry: Math.PI / 2 });
    placements.push({ piece: 'tzeelim_sand_berm', x: gun.x + PIT_BERM_OFFSET, z: gun.z, ry: -Math.PI / 2 });
    placements.push({ piece: 'tzeelim_sand_berm', x: gun.x, z: gun.z + PIT_BERM_OFFSET, ry: 0 });
  }
  return placements;
}

function appendShrubPlacements(placements) {
  const rng = makeRng(SHRUB_SEED);
  let placedShrubs = 0;
  for (let i = 0; i < SHRUB_ATTEMPT_LIMIT && placedShrubs < SHRUB_COUNT; i++) {
    const posX = SHRUB_MIN_X + rng() * (SHRUB_MAX_X - SHRUB_MIN_X);
    const posZ = SHRUB_MIN_Z + rng() * (SHRUB_MAX_Z - SHRUB_MIN_Z);
    const rotY = rng() * Math.PI * 2;
    const scaleFactor = 0.85 + rng() * 0.35;
    if (isBlockedForShrub(posX, posZ, placements)) {
      continue;
    }
    placements.push({ piece: 'tzeelim_shrub', x: posX, z: posZ, ry: rotY, scale: scaleFactor });
    placedShrubs += 1;
  }
}

export function buildTzeelim(mapGroup) {
  mapGroup.userData.guns = GUNS;
  const mats = createReserveMats();
  const bake = createBake(mapGroup);
  placeDohers(mapGroup, bake, GUNS, getTerrainHeight, mats);
  for (let i = 0; i < GUNS.length; i++) {
    const gun = GUNS[i];
    if (CANOPY_GUN_INDICES.has(i)) {
      addCamoCanopy(
        bake,
        getTerrainHeight,
        gun.x,
        gun.z + CANOPY_Z_OFFSET,
        CANOPY_WIDTH,
        CANOPY_DEPTH,
        CANOPY_HEIGHT,
        gun.yaw,
        mats
      );
    }
    addAmmoPallets(bake, getTerrainHeight, gun.x, gun.z + AMMO_Z_OFFSET, gun.yaw, mats);
  }
  bake.flush();
  addPerimeterSign(mapGroup, getTerrainHeight, SIGN_POS_X, SIGN_POS_Z, SIGN_YAW, SIGN_TEXT, mats);
  const placements = collectStaticPlacements();
  appendShrubPlacements(placements);
  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i];
    placement.ry = placement.ry ?? 0;
    placement.scale = placement.scale ?? 1;
    placement.id = formatKitPlacementId(placement.piece, placement.x, placement.z);
    registerPieceCollider(mapGroup, placement);
  }
  placeMapKit(mapGroup, 'tzeelim', placements);
}
