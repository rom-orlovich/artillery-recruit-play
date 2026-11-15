import * as THREE from 'three';
import { composeMatrix, ground } from './world-kit.js';
import { FOOT_OFFSETS } from './world-vehicles.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const MAX_FOOT_GAP = 0.03;
const STEP_SIZE = 0.15;
const MAX_STEPS = 10;
const FALLBACK_BACK_DIST = 1.2;
const MAX_HEIGHT_ABOVE_TERRAIN = 2.0;
const RAY_LIFT = 0.3;

const raycaster = new THREE.Raycaster();
const rayOrigin = new THREE.Vector3();
const slotPos = new THREE.Vector3();
const backDir = new THREE.Vector3();
const localPos = new THREE.Vector3();
const worldPos = new THREE.Vector3();
const invSlot = new THREE.Matrix4();
const relMat = new THREE.Matrix4();
const meshBox = new THREE.Box3();

function castFeet(target, x, yOrigin, z, ry) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  let minY = Infinity;
  let maxY = -Infinity;
  let maxOverTerrain = -Infinity;
  for (let i = 0; i < FOOT_OFFSETS.length; i++) {
    const [fx, fz] = FOOT_OFFSETS[i];
    const wx = x + fx * cos + fz * sin;
    const wz = z - fx * sin + fz * cos;
    const ty = ground(wx, wz);
    rayOrigin.set(wx, yOrigin, wz);
    raycaster.set(rayOrigin, DOWN);
    const hit = raycaster.intersectObject(target, true)[0];
    const fy = hit ? Math.max(hit.point.y, ty) : ty;
    if (fy < minY) minY = fy;
    if (fy > maxY) maxY = fy;
    if (fy - ty > maxOverTerrain) maxOverTerrain = fy - ty;
  }
  const centerOverTerrain = maxY - ground(x, z);
  if (centerOverTerrain > maxOverTerrain) maxOverTerrain = centerOverTerrain;
  return { minY, maxY, gap: maxY - minY, maxOverTerrain };
}

function hullMaxLocalZ(slot, target) {
  invSlot.copy(slot.matrixWorld).invert();
  let maxZ = -Infinity;
  target.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    const bb = child.geometry.boundingBox;
    if (!bb || bb.isEmpty()) return;
    relMat.multiplyMatrices(invSlot, child.matrixWorld);
    meshBox.copy(bb).applyMatrix4(relMat);
    if (meshBox.max.z > maxZ) maxZ = meshBox.max.z;
  });
  return Number.isFinite(maxZ) ? maxZ : 3.2;
}

function terrainHeightWithFeet(x, z, ry) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  let y = ground(x, z);
  for (let i = 0; i < FOOT_OFFSETS.length; i++) {
    const [fx, fz] = FOOT_OFFSETS[i];
    const fy = ground(x + fx * cos + fz * sin, z - fx * sin + fz * cos);
    if (fy > y) y = fy;
  }
  return y;
}

function placeSpawnBehindHull(s, target) {
  const maxZ = hullMaxLocalZ(s.slot, target);
  localPos.set(s.x, s.y, s.z).applyMatrix4(invSlot);
  worldPos.set(localPos.x, 0, maxZ + FALLBACK_BACK_DIST).applyMatrix4(s.slot.matrixWorld);
  slotPos.setFromMatrixPosition(s.slot.matrixWorld);
  const ry = Math.atan2(worldPos.x - slotPos.x, worldPos.z - slotPos.z);
  s.x = worldPos.x;
  s.z = worldPos.z;
  s.ry = ry;
  s.y = terrainHeightWithFeet(worldPos.x, worldPos.z, ry);
}

export function snapCrewSpawns(spawns, pool) {
  const touchedMeshes = new Set();
  const updatedRoots = new Set();
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    if (!s.crewOf || !s.slot) continue;
    let root = s.slot;
    while (root.parent) root = root.parent;
    if (!updatedRoots.has(root)) {
      root.updateMatrixWorld(true);
      updatedRoots.add(root);
    }
    s.slot.updateMatrixWorld(true);
    const target = s.slot.levels?.[0]?.object || s.slot;
    target.updateMatrixWorld(true);
    backDir.set(0, 0, 1).transformDirection(s.slot.matrixWorld);
    const len = Math.hypot(backDir.x, backDir.z) || 1;
    const bx = backDir.x / len;
    const bz = backDir.z / len;
    const yOrigin = s.origY + RAY_LIFT;
    let placed = false;
    for (let step = 0; step <= MAX_STEPS; step++) {
      const dist = step * STEP_SIZE;
      const cx = s.x + bx * dist;
      const cz = s.z + bz * dist;
      const res = castFeet(target, cx, yOrigin, cz, s.ry);
      if (res.gap <= MAX_FOOT_GAP && res.maxOverTerrain <= MAX_HEIGHT_ABOVE_TERRAIN) {
        s.x = cx;
        s.z = cz;
        s.y = res.maxY;
        placed = true;
        break;
      }
    }
    if (!placed) placeSpawnBehindHull(s, target);
    s.matrix.copy(composeMatrix(s.x, s.y, s.z, 0, s.ry, 0));
    const poolSlot = pool.find((slot) => slot.spawnIndex === i);
    if (poolSlot) {
      poolSlot.root.position.set(s.x, s.y, s.z);
      poolSlot.root.rotation.set(0, s.ry, 0);
      poolSlot.root.updateMatrixWorld(true);
    } else if (s.activeMesh && s.activeIndex >= 0 && s.activeIndex < s.activeMesh.count) {
      s.activeMesh.setMatrixAt(s.activeIndex, s.matrix);
      s.activeMesh.instanceMatrix.needsUpdate = true;
      touchedMeshes.add(s.activeMesh);
    }
  }
  for (const mesh of touchedMeshes) mesh.computeBoundingSphere();
}
