import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMeshBatch, mergeBoxes, placeGeometry } from './materials.js';

const PALLET_LENGTH = 1.2;
const PALLET_DEPTH = 0.8;
const PALLET_HEIGHT = 0.144;
const BOARD_THICKNESS = 0.022;
const BLOCK_HEIGHT = 0.078;
const SHELL_COLUMNS = 4;
const SHELL_ROWS = 3;
const SHELL_SPACING = 0.19;
const SHELL_FIRST_X = -0.485;
const SHELL_ROW_Z = [-0.16, 0.04, 0.24];
const LATHE_SEGMENTS = 14;
const BODY_RADIUS = 0.0775;
const BAND_RADIUS = 0.0793;
const FUZE_BASE_RADIUS = 0.033;
const OGIVE_START_Y = 0.416;
const OGIVE_END_Y = 0.704;
const OGIVE_FULLNESS = 0.62;
const CRATE_WIDTH = 0.38;
const CRATE_LENGTH = 0.74;
const CRATE_BODY_HEIGHT = 0.26;
const CRATE_LID_HEIGHT = 0.06;
const CRATE_X = 0.39;

function ogivePoint(t) {
  const radius = FUZE_BASE_RADIUS + (BODY_RADIUS - FUZE_BASE_RADIUS) * Math.pow(1 - t * t, OGIVE_FULLNESS);
  return [radius, OGIVE_START_Y + t * (OGIVE_END_Y - OGIVE_START_Y)];
}

const SHELL_PROFILE_PIECES = [
  ['shellOlive', [[0.071, 0], [BODY_RADIUS, 0.028], [BODY_RADIUS, 0.07]]],
  ['copperBand', [[BODY_RADIUS, 0.07], [BAND_RADIUS, 0.072], [BAND_RADIUS, 0.093], [0.078, 0.095], [BAND_RADIUS, 0.097], [BAND_RADIUS, 0.118], [BODY_RADIUS, 0.12]]],
  ['shellOlive', [[BODY_RADIUS, 0.12], [BODY_RADIUS, OGIVE_START_Y], ogivePoint(0.25), ogivePoint(0.5), ogivePoint(0.72)]],
  ['shellYellow', [ogivePoint(0.72), ogivePoint(0.8), ogivePoint(0.89)]],
  ['shellOlive', [ogivePoint(0.89), ogivePoint(1)]],
  ['fuzeGray', [[FUZE_BASE_RADIUS, OGIVE_END_Y], [0.0335, 0.716], [0.031, 0.72], [0.021, 0.766], [0.0105, 0.794], [0, 0.798]]],
];

function createShellPartsByMaterial() {
  const lathesByMaterial = new Map();
  for (const [materialName, profile] of SHELL_PROFILE_PIECES) {
    const lathe = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), LATHE_SEGMENTS);
    if (!lathesByMaterial.has(materialName)) lathesByMaterial.set(materialName, []);
    lathesByMaterial.get(materialName).push(placeGeometry(lathe));
  }
  return [...lathesByMaterial].map(([materialName, lathes]) => [materialName, mergeGeometries(lathes)]);
}

function addShells(batch) {
  const shellParts = createShellPartsByMaterial();
  for (const rowZ of SHELL_ROW_Z) {
    for (let column = 0; column < SHELL_COLUMNS; column++) {
      const position = [SHELL_FIRST_X + column * SHELL_SPACING, PALLET_HEIGHT, rowZ];
      for (const [materialName, geometry] of shellParts) batch.add(materialName, geometry, position);
    }
  }
  const frontEdgeZ = SHELL_ROW_Z[SHELL_ROWS - 1] + 0.1;
  for (let gap = 0; gap <= SHELL_COLUMNS; gap++) {
    const blockX = SHELL_FIRST_X + (gap - 0.5) * SHELL_SPACING;
    batch.addBox('palletWood', [0.05, 0.045, 0.06], [blockX, PALLET_HEIGHT + 0.0225, frontEdgeZ]);
  }
}

function addPallet(batch) {
  const deckBoards = [[0.145, -0.3275], [0.1, -0.165], [0.145, 0], [0.1, 0.165], [0.145, 0.3275]];
  for (const [width, z] of deckBoards) {
    batch.addBox('palletWood', [PALLET_LENGTH, BOARD_THICKNESS, width], [0, PALLET_HEIGHT - BOARD_THICKNESS / 2, z]);
  }
  const stringerY = PALLET_HEIGHT - BOARD_THICKNESS * 1.5;
  const blockY = BOARD_THICKNESS + BLOCK_HEIGHT / 2;
  for (const x of [-0.5275, 0, 0.5275]) {
    batch.addBox('palletWood', [PALLET_DEPTH, BOARD_THICKNESS, 0.145], [x, stringerY, 0], [0, Math.PI / 2, 0]);
    for (const z of [-0.3275, 0, 0.3275]) {
      batch.addBox('palletWood', [0.145, BLOCK_HEIGHT, 0.145], [x, blockY, z]);
    }
  }
  for (const [width, z] of [[0.145, -0.3275], [0.145, 0], [0.145, 0.3275]]) {
    batch.addBox('palletWood', [PALLET_LENGTH, BOARD_THICKNESS, width], [0, BOARD_THICKNESS / 2, z]);
  }
}

function createCrateHardwareGeometry() {
  const halfWidth = CRATE_WIDTH / 2;
  const halfLength = CRATE_LENGTH / 2;
  const totalHeight = CRATE_BODY_HEIGHT + CRATE_LID_HEIGHT;
  const boxes = [{ size: [CRATE_WIDTH + 0.006, 0.014, CRATE_LENGTH + 0.006], position: [0, CRATE_BODY_HEIGHT, 0] }];
  for (const cornerX of [-1, 1]) {
    for (const cornerZ of [-1, 1]) {
      for (const cornerY of [0.025, totalHeight - 0.025]) {
        boxes.push({ size: [0.055, 0.055, 0.055], position: [cornerX * (halfWidth - 0.022), cornerY, cornerZ * (halfLength - 0.022)] });
      }
    }
  }
  for (const face of [-1, 1]) {
    const faceZ = face * (halfLength + 0.008);
    boxes.push({ size: [0.045, 0.07, 0.012], position: [0, CRATE_BODY_HEIGHT - 0.002, faceZ] });
    boxes.push({ size: [0.075, 0.022, 0.01], position: [0, CRATE_BODY_HEIGHT - 0.05, faceZ] });
    boxes.push({ size: [0.17, 0.06, 0.006], position: [0, 0.125, faceZ - face * 0.004] });
    boxes.push({ size: [0.13, 0.018, 0.018], position: [0, 0.105, faceZ + face * 0.01] });
  }
  for (const side of [-1, 1]) {
    for (const latchZ of [-0.2, 0.2]) {
      boxes.push({ size: [0.014, 0.09, 0.05], position: [side * (halfWidth + 0.008), CRATE_BODY_HEIGHT - 0.01, latchZ] });
    }
  }
  return mergeBoxes(boxes);
}

function addCrates(batch) {
  const body = new THREE.BoxGeometry(CRATE_WIDTH, CRATE_BODY_HEIGHT, CRATE_LENGTH).translate(0, CRATE_BODY_HEIGHT / 2, 0);
  const lid = new THREE.BoxGeometry(CRATE_WIDTH + 0.012, CRATE_LID_HEIGHT, CRATE_LENGTH + 0.012)
    .translate(0, CRATE_BODY_HEIGHT + CRATE_LID_HEIGHT / 2, 0);
  const hardware = createCrateHardwareGeometry();
  const crateHeight = CRATE_BODY_HEIGHT + CRATE_LID_HEIGHT;
  const placements = [
    [[CRATE_X, PALLET_HEIGHT, 0], 0],
    [[CRATE_X + 0.006, PALLET_HEIGHT + crateHeight, -0.012], 0.025],
  ];
  for (const [position, yaw] of placements) {
    batch.add('crateOlive', body, position, [0, yaw, 0]);
    batch.add('crateOlive', lid, position, [0, yaw, 0]);
    batch.add('crateHardware', hardware, position, [0, yaw, 0]);
  }
}

export function createShellPallet() {
  const batch = createMeshBatch();
  addPallet(batch);
  addShells(batch);
  addCrates(batch);
  return batch.toGroup('shell-pallet');
}
