import * as THREE from 'three';
import { createMeshBatch, createSegmentGeometry } from './materials.js';

const RACK_HALF_WIDTH = 0.6;
const RACK_HALF_DEPTH = 0.5;
const RACK_HEIGHT = 2.25;
const POST_SIZE = 0.075;
const BAR_HEIGHT = 1.38;
const BAR_Z = RACK_HALF_DEPTH + POST_SIZE / 2 + 0.05;
const COLLAR_X = 0.72;
const PLATE_RADIUS = 0.225;
const PLATE_THICKNESS = 0.055;
const MAT_TOP = 0.02;
const TARP_UNDERSIDE_OFFSET = 0.02;
const TARP_SIDE_X = 0.648;
const TARP_ROOF_X = 0.74;
const TARP_BACK_Z = -0.565;
const TARP_TOP_Y = 2.22;
const TARP_FRONT_EDGE_Z = 0.33;

function horizontalCylinder(radius, length, radialSegments) {
  return new THREE.CylinderGeometry(radius, radius, length, radialSegments).rotateZ(Math.PI / 2);
}

function addRack(batch) {
  for (const x of [-RACK_HALF_WIDTH, RACK_HALF_WIDTH]) {
    for (const z of [-RACK_HALF_DEPTH, RACK_HALF_DEPTH]) {
      batch.addBox('rackSteel', [POST_SIZE, RACK_HEIGHT, POST_SIZE], [x, RACK_HEIGHT / 2, z]);
      for (const direction of [-1, 1]) {
        batch.addBox('blackSteel', [0.02, 0.17, 0.17], [x, POST_SIZE, z + direction * POST_SIZE / 2], [Math.PI / 4, 0, 0]);
      }
    }
    const side = Math.sign(x);
    batch.addBox('blackSteel', [POST_SIZE, POST_SIZE, 1.42], [x, POST_SIZE / 2, 0.06]);
    batch.addBox('blackSteel', [0.07, 0.07, RACK_HALF_DEPTH * 2 + POST_SIZE], [x, RACK_HEIGHT - POST_SIZE / 2, 0]);
    batch.addBox('blackSteel', [0.07, 0.12, 0.1], [x, BAR_HEIGHT - 0.05, BAR_Z - 0.01]);
    for (const z of [-RACK_HALF_DEPTH, RACK_HALF_DEPTH]) {
      batch.addBox('blackSteel', [0.05, 0.26, 0.05], [x - side * 0.115, RACK_HEIGHT - 0.17, z], [0, 0, side * 0.75]);
    }
  }
  for (const z of [-RACK_HALF_DEPTH, RACK_HALF_DEPTH]) {
    batch.addBox('blackSteel', [RACK_HALF_WIDTH * 2 + POST_SIZE, 0.07, 0.07], [0, RACK_HEIGHT - POST_SIZE / 2, z]);
  }
  batch.addBox('blackSteel', [RACK_HALF_WIDTH * 2, 0.07, 0.07], [0, POST_SIZE / 2, -RACK_HALF_DEPTH]);
  batch.add('blackSteel', horizontalCylinder(0.017, RACK_HALF_WIDTH * 2 + 0.12, 8), [0, 2.04, RACK_HALF_DEPTH + 0.07]);
}

function addBarbell(batch) {
  batch.add('chrome', horizontalCylinder(0.014, COLLAR_X * 2, 10), [0, BAR_HEIGHT, BAR_Z]);
  const plate = horizontalCylinder(PLATE_RADIUS, PLATE_THICKNESS, 24);
  const collar = horizontalCylinder(0.036, 0.03, 12);
  const sleeve = horizontalCylinder(0.025, 0.4, 12);
  const hub = horizontalCylinder(0.052, PLATE_THICKNESS * 2 + 0.008, 14);
  for (const side of [-1, 1]) {
    batch.add('chrome', collar, [side * COLLAR_X, BAR_HEIGHT, BAR_Z]);
    batch.add('chrome', sleeve, [side * (COLLAR_X + 0.215), BAR_HEIGHT, BAR_Z]);
    batch.add('chrome', hub, [side * (COLLAR_X + 0.015 + PLATE_THICKNESS), BAR_HEIGHT, BAR_Z]);
    for (const plateIndex of [0, 1]) {
      const plateX = COLLAR_X + 0.015 + PLATE_THICKNESS * (plateIndex + 0.5);
      batch.add('rubber', plate, [side * plateX, BAR_HEIGHT, BAR_Z]);
    }
  }
}

function addDumbbell(batch, headRadius, headLength, handleLength, position, yaw) {
  const head = new THREE.CylinderGeometry(headRadius, headRadius, headLength, 6).rotateZ(Math.PI / 2);
  const y = MAT_TOP + headRadius * Math.cos(Math.PI / 6);
  const yawCos = Math.cos(yaw);
  const yawSin = Math.sin(yaw);
  for (const side of [-1, 1]) {
    const offset = side * (handleLength + headLength) / 2;
    batch.add('rubber', head, [position[0] + offset * yawCos, y, position[1] - offset * yawSin], [0, yaw, 0]);
  }
  batch.add('chrome', horizontalCylinder(0.016, handleLength + 0.02, 8), [position[0], y, position[1]], [0, yaw, 0]);
}

function addFloor(batch) {
  batch.addBox('rubberMat', [1.75, MAT_TOP, 1.85], [0, MAT_TOP / 2, 0.12]);
  addDumbbell(batch, 0.075, 0.1, 0.13, [-0.2, 0.18], 0.4);
  addDumbbell(batch, 0.075, 0.1, 0.13, [0.02, 0.33], 0.25);
  addDumbbell(batch, 0.05, 0.07, 0.11, [0.3, 0.02], 0.2);
  addDumbbell(batch, 0.05, 0.07, 0.11, [0.43, 0.16], 0.12);
}

function wrinkle(u, v, seed) {
  return 0.026 * Math.sin(u * 11 + v * 5 + seed) * Math.sin(v * 9 - u * 3 + seed * 2) + 0.006 * Math.sin(u * 31 + v * 23 + seed * 3);
}

function createSheet(columns, rows, rippleSeed, placeVertex) {
  const sheet = new THREE.PlaneGeometry(1, 1, columns, rows);
  const positions = sheet.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const point = placeVertex(positions.getX(index) + 0.5, 0.5 - positions.getY(index));
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  sheet.computeVertexNormals();
  const normals = sheet.attributes.normal;
  const uvs = sheet.attributes.uv;
  for (let index = 0; index < positions.count; index++) {
    const ripple = wrinkle(uvs.getX(index), 1 - uvs.getY(index), rippleSeed);
    positions.setXYZ(
      index,
      positions.getX(index) + normals.getX(index) * ripple,
      positions.getY(index) + normals.getY(index) * ripple,
      positions.getZ(index) + normals.getZ(index) * ripple,
    );
  }
  sheet.computeVertexNormals();
  return sheet;
}

function createUnderside(sheet) {
  const underside = sheet.clone();
  const positions = underside.attributes.position;
  const normals = underside.attributes.normal;
  for (let index = 0; index < positions.count; index++) {
    positions.setXYZ(
      index,
      positions.getX(index) - normals.getX(index) * TARP_UNDERSIDE_OFFSET,
      positions.getY(index) - normals.getY(index) * TARP_UNDERSIDE_OFFSET,
      positions.getZ(index) - normals.getZ(index) * TARP_UNDERSIDE_OFFSET,
    );
  }
  return underside;
}

function createRoofSheet() {
  const crossSection = new THREE.SplineCurve([
    new THREE.Vector2(-TARP_ROOF_X, 1.78),
    new THREE.Vector2(-TARP_ROOF_X + 0.03, 2.33),
    new THREE.Vector2(-0.3, 2.45),
    new THREE.Vector2(0, 2.54),
    new THREE.Vector2(0.3, 2.45),
    new THREE.Vector2(TARP_ROOF_X - 0.03, 2.33),
    new THREE.Vector2(TARP_ROOF_X, 1.86),
  ]);
  return createSheet(14, 12, 1, (u, v) => {
    const profile = crossSection.getPointAt(u);
    const z = THREE.MathUtils.lerp(-0.8, 0.8, v);
    const overhang = Math.max(0, Math.abs(z) - RACK_HALF_DEPTH - 0.04);
    const midSpan = Math.sin(Math.PI * Math.min(Math.abs(profile.x) / TARP_ROOF_X, 1));
    const droop = overhang * 1.4 * (0.35 + 0.65 * Math.sin(Math.PI * u)) + 0.05 * Math.sin(Math.PI * v) * midSpan;
    return new THREE.Vector3(profile.x, profile.y - droop, z);
  });
}

function createSidePanel(side) {
  return createSheet(10, 10, side + 3, (u, v) => {
    const z = side < 0 ? THREE.MathUtils.lerp(TARP_BACK_Z - 0.05, TARP_FRONT_EDGE_Z, u) : THREE.MathUtils.lerp(TARP_FRONT_EDGE_Z, TARP_BACK_Z - 0.05, u);
    const fold = 0.03 * Math.sin(u * Math.PI * 6 + v * 1.3 + side) * (0.15 + v);
    const y = THREE.MathUtils.lerp(TARP_TOP_Y, 0.3, v) + v * 0.05 * Math.sin(u * 11 + side);
    return new THREE.Vector3(side * (TARP_SIDE_X + 0.07 * v * v + Math.abs(fold)), y, z);
  });
}

function createBackPanel(startX, endX, seed) {
  return createSheet(7, 9, seed, (u, v) => {
    const fold = 0.03 * Math.sin(u * Math.PI * 4 + v + seed) * (0.25 + v);
    const y = THREE.MathUtils.lerp(TARP_TOP_Y, 0.34, v) + v * 0.05 * Math.sin(u * 9 + seed);
    return new THREE.Vector3(THREE.MathUtils.lerp(startX, endX, u), y, TARP_BACK_Z - 0.06 * v * v - Math.abs(fold));
  });
}

function addTarp(batch) {
  const whiteSheets = [createRoofSheet(), createSidePanel(-1), createBackPanel(0.06, -TARP_SIDE_X, 2)];
  for (const sheet of whiteSheets) {
    batch.add('tarpWhite', sheet);
    batch.add('tarpBlack', createUnderside(sheet));
  }
  batch.add('tarpBlack', createSidePanel(1));
  const blackBack = createBackPanel(TARP_SIDE_X, -0.02, 5);
  batch.add('tarpBlack', blackBack, [0, 0, -0.012]);
  const cords = [
    [[-0.72, 0.32, 0.3], [-0.95, 0, 0.5]],
    [[-0.72, 0.32, -0.6], [-0.95, 0, -0.82]],
    [[0.74, 0.34, 0.3], [0.98, 0, 0.48]],
    [[0.74, 0.34, -0.6], [0.98, 0, -0.84]],
    [[-0.3, 0.37, -0.63], [-0.36, 0, -0.9]],
    [[0.36, 0.37, -0.64], [0.42, 0, -0.92]],
  ];
  for (const [from, to] of cords) {
    batch.add('blackSteel', createSegmentGeometry(new THREE.Vector3(...from), new THREE.Vector3(...to), 0.006));
    batch.addBox('blackSteel', [0.022, 0.12, 0.022], [to[0], 0.04, to[2]]);
  }
}

export function createFieldGym() {
  const batch = createMeshBatch();
  addRack(batch);
  addBarbell(batch);
  addFloor(batch);
  addTarp(batch);
  return batch.toGroup('field-gym');
}
