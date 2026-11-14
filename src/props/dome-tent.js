import * as THREE from 'three';
import { createMeshBatch, createSeededRandom, createSegmentGeometry, mergeBoxes } from './materials.js';

const TENT_WIDTH = 6;
const TENT_LENGTH = 15;
const TENT_HEIGHT = 3.2;
const FRONT_Z = TENT_LENGTH / 2;
const PROFILE_EXPONENT = 0.72;
const PROFILE_DENSE_SAMPLES = 240;
const ARC_SEGMENTS = 24;
const BAY_COUNT = 7;
const SEGMENTS_PER_BAY = 4;
const BAY_SAG_DEPTH = 0.04;
const RIB_WIDTH = 0.14;
const RIB_RISE = 0.05;
const RIB_BASE_LIFT = 0.004;
const HEM_HEIGHT = 0.24;
const DOOR_HALF_WIDTH = 0.72;
const DOOR_HEIGHT = 2.1;
const DOOR_FLAP_OPEN_ANGLE = 0.26;
const COTS_PER_SIDE = 9;
const COT_FIRST_Z = 4.55;
const COT_SPACING = 1.02;
const COT_CENTER_X = 1.85;
const CABLE_HEIGHT = 2.88;
const CABLE_SAG = 0.12;
const CABLE_SEGMENTS_PER_BAY = 3;
const BULB_COUNT = 16;
const TABLE_Z = -6.2;

const ARCH_PROFILE = buildArchProfile();

function archPoint(t) {
  const angle = -Math.PI / 2 + Math.PI * t;
  return new THREE.Vector2(
    (TENT_WIDTH / 2) * Math.sin(angle),
    TENT_HEIGHT * Math.pow(Math.max(Math.cos(angle), 0), PROFILE_EXPONENT),
  );
}

function buildArchProfile() {
  const dense = [{ point: archPoint(0), distance: 0 }];
  for (let sample = 1; sample <= PROFILE_DENSE_SAMPLES; sample++) {
    const point = archPoint(sample / PROFILE_DENSE_SAMPLES);
    dense.push({ point, distance: dense[sample - 1].distance + point.distanceTo(dense[sample - 1].point) });
  }
  const totalLength = dense[PROFILE_DENSE_SAMPLES].distance;
  const profile = [];
  let cursor = 0;
  for (let index = 0; index <= ARC_SEGMENTS; index++) {
    const target = (index / ARC_SEGMENTS) * totalLength;
    while (cursor < PROFILE_DENSE_SAMPLES - 1 && dense[cursor + 1].distance < target) cursor++;
    const from = dense[cursor];
    const to = dense[cursor + 1];
    const blend = THREE.MathUtils.clamp((target - from.distance) / (to.distance - from.distance), 0, 1);
    profile.push({ point: from.point.clone().lerp(to.point, blend), distance: target });
  }
  profile.forEach((sample, index) => {
    const tangent = profile[Math.min(index + 1, ARC_SEGMENTS)].point.clone().sub(profile[Math.max(index - 1, 0)].point);
    sample.normal = new THREE.Vector2(-tangent.y, tangent.x).normalize();
  });
  return profile;
}

function createShellGeometry() {
  const lengthSegments = BAY_COUNT * SEGMENTS_PER_BAY;
  const geometry = new THREE.PlaneGeometry(1, 1, ARC_SEGMENTS, lengthSegments);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let index = 0; index < positions.count; index++) {
    const arcIndex = Math.round((positions.getX(index) + 0.5) * ARC_SEGMENTS);
    const lengthIndex = Math.round((positions.getY(index) + 0.5) * lengthSegments);
    const { point, normal, distance } = ARCH_PROFILE[arcIndex];
    const z = (lengthIndex / lengthSegments - 0.5) * TENT_LENGTH;
    const bayFraction = (lengthIndex % SEGMENTS_PER_BAY) / SEGMENTS_PER_BAY;
    const sag = BAY_SAG_DEPTH * Math.sin(Math.PI * bayFraction) * Math.min(point.y / 1.2, 1);
    positions.setXYZ(index, point.x - normal.x * sag, point.y - normal.y * sag, z);
    uvs.setXY(index, distance, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createEndWallGeometry(withDoorway) {
  const outline = new THREE.Shape(ARCH_PROFILE.map(({ point }) => point.clone()));
  if (withDoorway) {
    outline.lineTo(DOOR_HALF_WIDTH, 0);
    outline.lineTo(DOOR_HALF_WIDTH, DOOR_HEIGHT);
    outline.lineTo(-DOOR_HALF_WIDTH, DOOR_HEIGHT);
    outline.lineTo(-DOOR_HALF_WIDTH, 0);
  }
  return new THREE.ShapeGeometry(outline);
}

function createRibGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 3, ARC_SEGMENTS);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const column = Math.round((positions.getX(index) + 0.5) * 3);
    const arcIndex = Math.round((0.5 - positions.getY(index)) * ARC_SEGMENTS);
    const { point, normal } = ARCH_PROFILE[arcIndex];
    const rise = column === 0 || column === 3 ? RIB_BASE_LIFT : RIB_RISE;
    const z = column <= 1 ? -RIB_WIDTH / 2 : RIB_WIDTH / 2;
    positions.setXYZ(index, point.x + normal.x * rise, point.y + normal.y * rise, z);
  }
  const rib = geometry.toNonIndexed();
  rib.computeVertexNormals();
  return rib;
}

function createDoorFlapGeometry() {
  const flapWidth = DOOR_HALF_WIDTH * 2;
  const flap = new THREE.PlaneGeometry(flapWidth, DOOR_HEIGHT, 4, 3).translate(flapWidth / 2, 0, 0);
  const positions = flap.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const across = positions.getX(index) / flapWidth;
    positions.setZ(index, 0.07 * Math.sin(Math.PI * across) + 0.02 * Math.sin(positions.getY(index) * 3));
  }
  flap.computeVertexNormals();
  return flap;
}

function addShell(batch) {
  batch.add('tentCanvas', createShellGeometry());
  batch.add('tentCanvas', createEndWallGeometry(true), [0, 0, FRONT_Z]);
  batch.add('tentCanvas', createEndWallGeometry(false), [0, 0, -FRONT_Z]);
  const rib = createRibGeometry();
  for (let ribIndex = 0; ribIndex <= BAY_COUNT; ribIndex++) {
    const z = -FRONT_Z + (ribIndex * TENT_LENGTH) / BAY_COUNT;
    batch.add('tentTrim', rib, [0, 0, z]);
    for (const side of [-1, 1]) batch.addBox('tentTrim', [0.07, 0.12, 0.2], [side * (TENT_WIDTH / 2 + 0.03), 0.06, z]);
  }
  for (const side of [-1, 1]) {
    batch.addBox('tentTrim', [0.03, HEM_HEIGHT, TENT_LENGTH], [side * (TENT_WIDTH / 2 + 0.012), HEM_HEIGHT / 2, 0]);
    const frontHemWidth = TENT_WIDTH / 2 - DOOR_HALF_WIDTH;
    batch.addBox('tentTrim', [frontHemWidth, HEM_HEIGHT, 0.03], [side * (DOOR_HALF_WIDTH + frontHemWidth / 2), HEM_HEIGHT / 2, FRONT_Z + 0.012]);
  }
  batch.addBox('tentTrim', [TENT_WIDTH, HEM_HEIGHT, 0.03], [0, HEM_HEIGHT / 2, -FRONT_Z - 0.012]);
}

function addEntrance(batch) {
  const frameZ = FRONT_Z + 0.016;
  for (const side of [-1, 1]) {
    const frameX = side * (DOOR_HALF_WIDTH + 0.05);
    batch.addBox('tentTrim', [0.1, DOOR_HEIGHT + 0.12, 0.035], [frameX, (DOOR_HEIGHT + 0.12) / 2, frameZ]);
    for (const strapHeight of [0.35, 0.9, 1.45, 1.9]) {
      batch.addBox('tentTrim', [0.16, 0.05, 0.05], [frameX, strapHeight, frameZ + 0.01]);
    }
    batch.addBox('tentTrim', [0.42, 0.22, 0.035], [side * 0.92, 2.62, FRONT_Z + 0.015]);
  }
  batch.addBox('tentTrim', [1.5, DOOR_HEIGHT, 0.025], [0, DOOR_HEIGHT / 2, -FRONT_Z - 0.014]);
  batch.addBox('tentTrim', [DOOR_HALF_WIDTH * 2 + 0.36, 0.14, 0.04], [0, DOOR_HEIGHT + 0.07, frameZ]);
  batch.add('tentTrim', createDoorFlapGeometry(), [-DOOR_HALF_WIDTH - 0.04, DOOR_HEIGHT / 2 + 0.01, FRONT_Z + 0.05], [0, DOOR_FLAP_OPEN_ANGLE - Math.PI, 0]);
}

function createCotGeometry() {
  return mergeBoxes([
    { size: [1.9, 0.05, 0.66], position: [0, 0.42, 0] },
    { size: [1.9, 0.04, 0.035], position: [0, 0.43, 0.34] },
    { size: [1.9, 0.04, 0.035], position: [0, 0.43, -0.34] },
    { size: [0.04, 0.4, 0.62], position: [-0.86, 0.2, 0] },
    { size: [0.04, 0.4, 0.62], position: [0.86, 0.2, 0] },
  ]);
}

function createSleepingBagGeometry(random) {
  const bag = new THREE.BoxGeometry(1.78, 0.14, 0.6, 5, 1, 3);
  const positions = bag.attributes.position;
  const phase = random() * 6;
  for (let index = 0; index < positions.count; index++) {
    const along = positions.getX(index) / 0.89;
    const across = positions.getZ(index) / 0.3;
    if (positions.getY(index) <= 0) continue;
    const swell = 0.06 * (1 - along * along * 0.6) * (1 - across * across);
    const hood = along > 0.55 ? 0.09 * (along - 0.55) : 0;
    const lump = 0.03 * Math.sin(along * 5 + phase) * Math.cos(across * 2.5 + phase);
    positions.setY(index, positions.getY(index) + swell + hood + lump);
    positions.setZ(index, positions.getZ(index) * 0.9);
  }
  bag.computeVertexNormals();
  return bag;
}

function addSleepingArea(batch) {
  const random = createSeededRandom(5);
  const cot = createCotGeometry();
  const bags = [0, 1, 2].map(() => createSleepingBagGeometry(random));
  const rolledBag = new THREE.CylinderGeometry(0.12, 0.12, 0.58, 8).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    for (let slot = 0; slot < COTS_PER_SIDE; slot++) {
      const z = COT_FIRST_Z - slot * COT_SPACING + (random() - 0.5) * 0.08;
      const x = side * (COT_CENTER_X + (random() - 0.5) * 0.08);
      const yaw = (side > 0 ? 0 : Math.PI) + (random() - 0.5) * 0.06;
      batch.add('cotFrame', cot, [x, 0, z], [0, yaw, 0]);
      const roll = random();
      if (roll < 0.18) {
        batch.add('sleepingBag', rolledBag, [x - side * 0.7, 0.57, z], [0, yaw, 0]);
      } else {
        const bagYaw = yaw + (random() - 0.5) * 0.16;
        batch.add('sleepingBag', bags[slot % bags.length], [x + (random() - 0.5) * 0.1, 0.5, z + (random() - 0.5) * 0.06], [0, bagYaw, 0]);
      }
    }
  }
}

function createChairGeometry() {
  return mergeBoxes([
    { size: [0.46, 0.035, 0.42], position: [0, 0.44, 0.02] },
    { size: [0.26, 0.42, 0.03], position: [0, 0.68, -0.23], rotation: [-0.18, 0, 0] },
    { size: [0.16, 0.42, 0.03], position: [-0.196, 0.68, -0.185], rotation: [-0.18, 0.6, 0] },
    { size: [0.16, 0.42, 0.03], position: [0.196, 0.68, -0.185], rotation: [-0.18, -0.6, 0] },
    { size: [0.05, 0.45, 0.06], position: [-0.21, 0.22, 0.19], rotation: [0.08, 0, 0.07] },
    { size: [0.05, 0.45, 0.06], position: [0.21, 0.22, 0.19], rotation: [0.08, 0, -0.07] },
    { size: [0.05, 0.45, 0.06], position: [-0.21, 0.22, -0.18], rotation: [-0.1, 0, 0.07] },
    { size: [0.05, 0.45, 0.06], position: [0.21, 0.22, -0.18], rotation: [-0.1, 0, -0.07] },
    { size: [0.05, 0.03, 0.36], position: [-0.25, 0.62, 0.03] },
    { size: [0.05, 0.03, 0.36], position: [0.25, 0.62, 0.03] },
  ]);
}

function addMessArea(batch) {
  const chair = createChairGeometry();
  batch.addBox('whitePlastic', [2.4, 0.04, 0.76], [0, 0.74, TABLE_Z]);
  for (const [legX, legZ] of [[-1.1, -0.32], [1.1, -0.32], [-1.1, 0.32], [1.1, 0.32]]) {
    batch.addBox('blackSteel', [0.035, 0.72, 0.035], [legX, 0.36, TABLE_Z + legZ]);
  }
  for (const chairX of [-0.6, 0.6]) {
    batch.add('whitePlastic', chair, [chairX, 0, TABLE_Z - 0.72], [0, 0, 0]);
    batch.add('whitePlastic', chair, [chairX + 0.1, 0, TABLE_Z + 0.75], [0, Math.PI + 0.15, 0]);
  }
  for (const chairZ of [5.55, 6.15, 6.75]) batch.add('whitePlastic', chair, [2.15, 0, chairZ], [0, -Math.PI / 2 + 0.1, 0]);
  for (let level = 0; level < 3; level++) batch.add('whitePlastic', chair, [-2.1, level * 0.09, 6.2], [0, Math.PI / 2, 0]);
  const supplyBoxes = [
    [[0.42, 0.3, 0.32], [-0.85, 0.91, TABLE_Z], 0.1],
    [[0.36, 0.24, 0.3], [-0.42, 0.88, TABLE_Z + 0.05], -0.05],
    [[0.5, 0.34, 0.36], [0.55, 0.93, TABLE_Z - 0.05], 0.04],
    [[0.32, 0.22, 0.28], [0.58, 1.21, TABLE_Z - 0.04], 0.3],
    [[0.55, 0.42, 0.42], [-2.25, 0.21, -6.9], 0.12],
    [[0.5, 0.36, 0.4], [-2.2, 0.6, -6.88], -0.08],
    [[0.55, 0.42, 0.42], [2.2, 0.21, -6.85], -0.1],
    [[0.48, 0.34, 0.38], [1.6, 0.17, -6.95], 0.2],
    [[0.44, 0.32, 0.36], [-1.0, 0.16, -6.0], 0.35],
  ];
  for (const [size, position, yaw] of supplyBoxes) batch.addBox('cardboard', size, position, [0, yaw, 0]);
}

function cableHeightAt(z) {
  const bayFraction = (((z + FRONT_Z) / TENT_LENGTH) * BAY_COUNT) % 1;
  return CABLE_HEIGHT - CABLE_SAG * Math.sin(Math.PI * bayFraction);
}

function addStringLights(batch) {
  const segmentCount = BAY_COUNT * CABLE_SEGMENTS_PER_BAY;
  for (let segment = 0; segment < segmentCount; segment++) {
    const startZ = -FRONT_Z + (segment * TENT_LENGTH) / segmentCount;
    const endZ = -FRONT_Z + ((segment + 1) * TENT_LENGTH) / segmentCount;
    const from = new THREE.Vector3(0, cableHeightAt(startZ), startZ);
    const to = new THREE.Vector3(0, segment === segmentCount - 1 ? CABLE_HEIGHT : cableHeightAt(endZ), endZ);
    batch.add('blackSteel', createSegmentGeometry(from, to, 0.008));
  }
  for (let ribIndex = 1; ribIndex < BAY_COUNT; ribIndex++) {
    const z = -FRONT_Z + (ribIndex * TENT_LENGTH) / BAY_COUNT;
    batch.add('blackSteel', createSegmentGeometry(new THREE.Vector3(0, TENT_HEIGHT - 0.02, z), new THREE.Vector3(0, CABLE_HEIGHT, z), 0.008));
  }
  const bulb = new THREE.IcosahedronGeometry(0.048).scale(1, 1.3, 1);
  const socket = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 6);
  for (let bulbIndex = 0; bulbIndex < BULB_COUNT; bulbIndex++) {
    const z = -FRONT_Z + 0.5 + ((bulbIndex + 0.5) * (TENT_LENGTH - 1)) / BULB_COUNT;
    const hangY = cableHeightAt(z);
    batch.add('blackSteel', socket, [0, hangY - 0.04, z]);
    batch.add('bulbGlow', bulb, [0, hangY - 0.12, z]);
  }
}

function addFloor(batch) {
  batch.add('tentFloor', new THREE.PlaneGeometry(TENT_WIDTH - 0.1, TENT_LENGTH - 0.1), [0, 0.012, 0], [-Math.PI / 2, 0, 0]);
}

function addDinnerArea(batch) {
  const chair = createChairGeometry();
  const tableStart = -4.5;
  const tableEnd = 3.5;
  const length = tableEnd - tableStart;
  const centerZ = (tableStart + tableEnd) / 2;
  batch.addBox('tarpBlack', [1.15, 0.04, length], [0, 0.76, centerZ]);
  for (const side of [-1, 1]) batch.addBox('tarpBlack', [0.02, 0.32, length], [side * 0.58, 0.6, centerZ]);
  for (const legZ of [tableStart + 0.3, centerZ, tableEnd - 0.3]) {
    for (const side of [-1, 1]) batch.addBox('blackSteel', [0.035, 0.74, 0.035], [side * 0.5, 0.37, legZ]);
  }
  const plate = new THREE.CylinderGeometry(0.12, 0.1, 0.02, 12);
  const cup = new THREE.CylinderGeometry(0.035, 0.028, 0.1, 8);
  const bottle = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8);
  const bowl = new THREE.CylinderGeometry(0.11, 0.07, 0.07, 10);
  const bun = new THREE.SphereGeometry(0.09, 8, 6);
  const seats = Math.floor(length / 0.72);
  for (let seat = 0; seat < seats; seat++) {
    const z = tableStart + 0.4 + seat * 0.72;
    for (const side of [-1, 1]) {
      batch.add('whitePlastic', chair, [side * 0.95, 0, z], [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]);
      batch.add('whitePlastic', plate, [side * 0.33, 0.79, z]);
      batch.add('whitePlastic', cup, [side * 0.42, 0.83, z + 0.2]);
    }
  }
  const bottleMaterials = ['crateOlive', 'copperBand', 'blackSteel'];
  for (let i = 0; i < 8; i++) batch.add(bottleMaterials[i % 3], bottle, [(i % 2 ? 0.08 : -0.08), 0.93, tableStart + 0.6 + i * 0.95]);
  const saladMaterials = ['shellYellow', 'crateOlive', 'copperBand'];
  for (let i = 0; i < 6; i++) batch.add(saladMaterials[i % 3], bowl, [(i % 2 ? -0.12 : 0.12), 0.815, tableStart + 1.1 + i * 1.15]);
  for (const challahZ of [centerZ - 1.6, centerZ + 1.4]) {
    for (let knot = 0; knot < 3; knot++) batch.add('cardboard', bun, [0, 0.84 + (knot === 1 ? 0.03 : 0), challahZ - 0.12 + knot * 0.12], [0, 0, 0], [1.1, 0.7, 0.9]);
  }
  for (const [size, position] of [[[0.6, 0.45, 0.45], [-2.1, 0.23, -6.6]], [[0.55, 0.4, 0.4], [-1.5, 0.2, -6.7]], [[0.6, 0.45, 0.45], [2.0, 0.23, -6.6]]]) {
    batch.addBox('cardboard', size, position);
  }
}

export function createDomeTent(interior = 'sleeping') {
  const batch = createMeshBatch();
  addShell(batch);
  addEntrance(batch);
  addFloor(batch);
  if (interior === 'dinner') {
    addDinnerArea(batch);
  } else {
    addSleepingArea(batch);
    addMessArea(batch);
  }
  addStringLights(batch);
  return batch.toGroup('dome-tent');
}
