import * as THREE from 'three';
import { composeMatrix, ground } from './world-kit.js';
import { FOOT_OFFSETS } from './world-vehicles.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const MAX_FOOT_GAP = 0.03, STEP_SIZE = 0.15, MAX_STEPS = 10, MAX_FLAT_STEPS = 13;
const FALLBACK_BACK_DIST = 1.2, HULL_CLEARANCE = 0.85, MAX_HEIGHT_ABOVE_TERRAIN = 2.0;
const RAY_LIFT = 0.3, GROUND_RAY_LIFT = 1.0, TEST_RAY_LIFT = 0.05;
const SEARCH_ANGLES = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map((k) => (k * Math.PI) / 6);
const raycaster = new THREE.Raycaster(), rayOrigin = new THREE.Vector3(), rayHits = [];
const footResult = { minY: 0, maxY: 0, gap: 0, maxOverTerrain: 0, onDoher: false };
const probeResult = { ok: false, y: 0, gap: Infinity };
const slotPos = new THREE.Vector3(), backDir = new THREE.Vector3(), localPos = new THREE.Vector3(), worldPos = new THREE.Vector3();
const invSlot = new THREE.Matrix4(), relMat = new THREE.Matrix4(), meshBox = new THREE.Box3(), hullBox = new THREE.Box3();
const HULL_MIN_FALLBACK = new THREE.Vector3(-1.7, 0, -3.2), HULL_MAX_FALLBACK = new THREE.Vector3(1.7, 2.5, 3.2);
const targetMeshes = [], touchedMeshes = new Set(), updatedRoots = new Set(), excludedEnv = new Set(), excludedPool = new Set();
const seenMeshes = new Set(), envMeshCache = new Map(), allMeshCache = new Map();

function isNodeVisible(node) {
  for (let c = node; c; c = c.parent) if (!c.visible) return false;
  return true;
}

function ensureMatrixWorld(node) {
  if (!node) return null;
  let top = node;
  while (top.parent) top = top.parent;
  if (!updatedRoots.has(top)) { top.updateMatrixWorld(true); updatedRoots.add(top); }
  return top;
}

function collectVisibleMeshes(node, excluded, out) {
  if (!node || !node.visible || (excluded && excluded.has(node))) return;
  if (node.isMesh && !node.isInstancedMesh && !node.isSkinnedMesh && !seenMeshes.has(node)) {
    seenMeshes.add(node);
    out.push(node);
  }
  for (let i = 0; i < node.children.length; i++) collectVisibleMeshes(node.children[i], excluded, out);
}

function resolveTarget(slot) {
  if (!slot.levels || !slot.levels.length) return slot;
  for (let i = 0; i < slot.levels.length; i++) if (slot.levels[i]?.object?.visible) return slot.levels[i].object;
  return slot.levels[0]?.object || slot;
}

function getSurfaceMeshes(region, scene, root, excluded, cache) {
  const baseRoot = scene || root;
  const regTop = ensureMatrixWorld(region), baseTop = ensureMatrixWorld(baseRoot), rootTop = ensureMatrixWorld(root);
  const cacheKey = regTop && regTop === baseTop ? baseRoot : region || baseRoot;
  if (!cacheKey) return null;
  let meshes = cache.get(cacheKey);
  if (meshes) return meshes;
  meshes = [];
  seenMeshes.clear();
  if (baseRoot && isNodeVisible(baseRoot)) collectVisibleMeshes(baseRoot, excluded, meshes);
  if (region && regTop !== baseTop && isNodeVisible(region)) collectVisibleMeshes(region, excluded, meshes);
  if (root && rootTop !== baseTop && rootTop !== regTop && isNodeVisible(root)) collectVisibleMeshes(root, excluded, meshes);
  cache.set(cacheKey, meshes);
  return meshes;
}

function castDownAt(wx, yOrigin, wz, meshes) {
  if (!meshes || !meshes.length) return -Infinity;
  rayOrigin.set(wx, yOrigin, wz);
  raycaster.set(rayOrigin, DOWN);
  rayHits.length = 0;
  raycaster.intersectObjects(meshes, false, rayHits);
  return rayHits.length > 0 ? rayHits[0].point.y : -Infinity;
}

function footGroundY(wx, wz, envMeshes, terrainY, lift = GROUND_RAY_LIFT) {
  const hitY = castDownAt(wx, terrainY + lift, wz, envMeshes);
  return hitY > -Infinity ? hitY : terrainY;
}

function castFeet(tMeshes, envMeshes, x, yOrigin, z, ry) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  let minY = Infinity, maxY = -Infinity, maxOverTerrain = -Infinity, targetFeet = 0;
  for (let i = 0; i < FOOT_OFFSETS.length; i++) {
    const [fx, fz] = FOOT_OFFSETS[i];
    const wx = x + fx * cos + fz * sin, wz = z - fx * sin + fz * cos;
    const ty = ground(wx, wz);
    const targetY = castDownAt(wx, yOrigin, wz, tMeshes);
    let fy;
    if (targetY >= ty + GROUND_RAY_LIFT) { fy = targetY; targetFeet++; }
    else { const gy = footGroundY(wx, wz, envMeshes, ty); if (targetY > gy) { fy = targetY; targetFeet++; } else fy = gy; }
    if (fy < minY) minY = fy;
    if (fy > maxY) maxY = fy;
    if (fy - ty > maxOverTerrain) maxOverTerrain = fy - ty;
  }
  const centerOverTerrain = maxY - ground(x, z);
  if (centerOverTerrain > maxOverTerrain) maxOverTerrain = centerOverTerrain;
  footResult.minY = minY; footResult.maxY = maxY; footResult.gap = maxY - minY;
  footResult.maxOverTerrain = maxOverTerrain; footResult.onDoher = targetFeet === FOOT_OFFSETS.length;
  return footResult;
}

function computeHullBox(slot, target) {
  invSlot.copy(slot.matrixWorld).invert();
  hullBox.makeEmpty();
  target.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    const bb = child.geometry.boundingBox;
    if (!bb || bb.isEmpty()) return;
    relMat.multiplyMatrices(invSlot, child.matrixWorld);
    hullBox.union(meshBox.copy(bb).applyMatrix4(relMat));
  });
  if (hullBox.isEmpty()) hullBox.set(HULL_MIN_FALLBACK, HULL_MAX_FALLBACK);
  return hullBox;
}

function clampLocalToHull(x, y, z, box) {
  localPos.set(x, y, z).applyMatrix4(invSlot);
  const cx = localPos.x < box.min.x ? box.min.x : localPos.x > box.max.x ? box.max.x : localPos.x;
  const cz = localPos.z < box.min.z ? box.min.z : localPos.z > box.max.z ? box.max.z : localPos.z;
  return { lx: localPos.x, lz: localPos.z, cx, cz };
}

function isOutsideHull(x, z, y, box) {
  const { lx, lz, cx, cz } = clampLocalToHull(x, y, z, box);
  return Math.hypot(lx - cx, lz - cz) >= HULL_CLEARANCE - 1e-4;
}

function placeSpawnBehindHull(s, target) {
  const box = computeHullBox(s.slot, target);
  localPos.set(s.x, s.y, s.z).applyMatrix4(invSlot);
  worldPos.set(localPos.x, 0, box.max.z + FALLBACK_BACK_DIST).applyMatrix4(s.slot.matrixWorld);
  slotPos.setFromMatrixPosition(s.slot.matrixWorld);
  s.x = worldPos.x; s.z = worldPos.z;
  s.ry = Math.atan2(worldPos.x - slotPos.x, worldPos.z - slotPos.z);
}

function pushOutsideHull(s, target) {
  const box = computeHullBox(s.slot, target);
  const { lx, lz, cx, cz } = clampLocalToHull(s.x, s.y, s.z, box);
  const dx = lx - cx, dz = lz - cz, dist = Math.hypot(dx, dz);
  if (dist >= HULL_CLEARANCE) return box;
  let nx = lx, nz = lz;
  if (dist > 1e-6) {
    const scale = HULL_CLEARANCE / dist;
    nx = cx + dx * scale; nz = cz + dz * scale;
  } else {
    const dL = lx - box.min.x, dR = box.max.x - lx, dF = lz - box.min.z, dB = box.max.z - lz;
    const minD = Math.min(dL, dR, dF, dB);
    if (minD === dL) nx = box.min.x - HULL_CLEARANCE;
    else if (minD === dR) nx = box.max.x + HULL_CLEARANCE;
    else if (minD === dF) nz = box.min.z - HULL_CLEARANCE;
    else nz = box.max.z + HULL_CLEARANCE;
  }
  worldPos.set(nx, localPos.y, nz).applyMatrix4(s.slot.matrixWorld);
  s.x = worldPos.x; s.z = worldPos.z;
  return box;
}

function castFootSpan(x, z, cos, sin, yRef, meshes, useGround) {
  let maxH = -Infinity, minH = Infinity;
  for (let i = 0; i < FOOT_OFFSETS.length; i++) {
    const [fx, fz] = FOOT_OFFSETS[i];
    const wx = x + fx * cos + fz * sin, wz = z - fx * sin + fz * cos;
    const h = useGround ? footGroundY(wx, wz, meshes, ground(wx, wz), MAX_HEIGHT_ABOVE_TERRAIN) : castDownAt(wx, yRef, wz, meshes);
    if (h === -Infinity) return false;
    if (h > maxH) maxH = h;
    if (h < minH) minH = h;
  }
  probeResult.y = maxH; probeResult.gap = maxH - minH;
  return true;
}

function probeFlatSpot(x, z, ry, refY, envMeshes, allMeshes, onDoher) {
  const cos = Math.cos(ry), sin = Math.sin(ry), hasAll = allMeshes && allMeshes.length > 0;
  const initOk = onDoher ? castFootSpan(x, z, cos, sin, refY + RAY_LIFT, allMeshes, !hasAll) : castFootSpan(x, z, cos, sin, 0, envMeshes, true);
  if (!initOk) { probeResult.ok = false; probeResult.gap = Infinity; return probeResult; }
  if (hasAll) {
    let originY = probeResult.y + TEST_RAY_LIFT;
    for (let pass = 0; pass < 2; pass++) {
      if (!castFootSpan(x, z, cos, sin, originY, allMeshes, false)) { probeResult.ok = false; probeResult.gap = Infinity; return probeResult; }
      if (probeResult.y + TEST_RAY_LIFT <= originY + 1e-4) break;
      originY = probeResult.y + TEST_RAY_LIFT;
    }
  }
  probeResult.ok = probeResult.gap <= MAX_FOOT_GAP;
  return probeResult;
}

function settleFeet(s, envMeshes, allMeshes, onDoher, hullBoxRef) {
  const baseX = s.x, baseZ = s.z, refY = s.y;
  const first = probeFlatSpot(baseX, baseZ, s.ry, refY, envMeshes, allMeshes, onDoher);
  if (first.ok) { s.y = first.y; return; }
  let bestGap = first.gap, bestX = baseX, bestZ = baseZ, bestY = first.y, hasBest = first.gap < Infinity;
  slotPos.setFromMatrixPosition(s.slot.matrixWorld);
  let ox = baseX - slotPos.x, oz = baseZ - slotPos.z;
  const oLen = Math.hypot(ox, oz);
  if (oLen > 1e-6) { ox /= oLen; oz /= oLen; } else { const bLen = Math.hypot(backDir.x, backDir.z) || 1; ox = backDir.x / bLen; oz = backDir.z / bLen; }
  for (let step = 1; step <= MAX_FLAT_STEPS; step++) {
    const dist = step * STEP_SIZE;
    for (let a = 0; a < SEARCH_ANGLES.length; a++) {
      const ang = SEARCH_ANGLES[a], ca = Math.cos(ang), sa = Math.sin(ang);
      const cx = baseX + (ox * ca - oz * sa) * dist, cz = baseZ + (ox * sa + oz * ca) * dist;
      if (!onDoher && hullBoxRef && !isOutsideHull(cx, cz, refY, hullBoxRef)) continue;
      const res = probeFlatSpot(cx, cz, s.ry, refY, envMeshes, allMeshes, onDoher);
      if (res.ok) { s.x = cx; s.z = cz; s.y = res.y; return; }
      if (res.gap < bestGap) { bestGap = res.gap; bestX = cx; bestZ = cz; bestY = res.y; hasBest = true; }
    }
  }
  if (hasBest) { s.x = bestX; s.z = bestZ; s.y = bestY; }
}

function resetState() {
  touchedMeshes.clear(); updatedRoots.clear(); excludedEnv.clear(); excludedPool.clear();
  seenMeshes.clear(); envMeshCache.clear(); allMeshCache.clear(); targetMeshes.length = 0; rayHits.length = 0;
}

export function snapCrewSpawns(spawns, pool, regionOf = null, scene = null) {
  resetState();
  if (pool) for (let i = 0; i < pool.length; i++) if (pool[i]?.root) { excludedEnv.add(pool[i].root); excludedPool.add(pool[i].root); }
  for (let i = 0; i < spawns.length; i++) {
    const slot = spawns[i]?.slot;
    if (!slot) continue;
    excludedEnv.add(slot);
    if (slot.levels) for (let k = 0; k < slot.levels.length; k++) if (slot.levels[k]?.object) excludedEnv.add(slot.levels[k].object);
  }
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    if (!s.crewOf || !s.slot) continue;
    const root = ensureMatrixWorld(s.slot);
    s.slot.updateMatrixWorld(true);
    const target = resolveTarget(s.slot);
    target.updateMatrixWorld(true);
    targetMeshes.length = 0;
    if (isNodeVisible(target)) { seenMeshes.clear(); collectVisibleMeshes(target, null, targetMeshes); }
    const region = typeof regionOf === 'function' ? regionOf(s.x, s.z) : null;
    const envMeshes = getSurfaceMeshes(region, scene, root, excludedEnv, envMeshCache);
    const allMeshes = getSurfaceMeshes(region, scene, root, excludedPool, allMeshCache);
    backDir.set(0, 0, 1).transformDirection(s.slot.matrixWorld);
    const len = Math.hypot(backDir.x, backDir.z) || 1, bx = backDir.x / len, bz = backDir.z / len, yOrigin = s.origY + RAY_LIFT;
    let placed = false, onDoher = false;
    for (let step = 0; step <= MAX_STEPS; step++) {
      const dist = step * STEP_SIZE, cx = s.x + bx * dist, cz = s.z + bz * dist;
      const res = castFeet(targetMeshes, envMeshes, cx, yOrigin, cz, s.ry);
      if (res.gap <= MAX_FOOT_GAP && res.maxOverTerrain <= MAX_HEIGHT_ABOVE_TERRAIN) { s.x = cx; s.z = cz; s.y = res.maxY; placed = true; onDoher = res.onDoher; break; }
    }
    if (!placed) placeSpawnBehindHull(s, target);
    const box = onDoher ? null : pushOutsideHull(s, target);
    const postReg = typeof regionOf === 'function' ? regionOf(s.x, s.z) : null;
    const envAfter = postReg === region ? envMeshes : getSurfaceMeshes(postReg, scene, root, excludedEnv, envMeshCache);
    const allAfter = postReg === region ? allMeshes : getSurfaceMeshes(postReg, scene, root, excludedPool, allMeshCache);
    settleFeet(s, envAfter, allAfter, onDoher, box);
    s.matrix.copy(composeMatrix(s.x, s.y, s.z, 0, s.ry, 0));
    let poolSlot = null;
    if (pool) for (let p = 0; p < pool.length; p++) if (pool[p].spawnIndex === i) { poolSlot = pool[p]; break; }
    if (poolSlot) {
      poolSlot.root.position.set(s.x, s.y, s.z); poolSlot.root.rotation.set(0, s.ry, 0); poolSlot.root.updateMatrixWorld(true);
    } else if (s.activeMesh && s.activeIndex >= 0 && s.activeIndex < s.activeMesh.count) {
      s.activeMesh.setMatrixAt(s.activeIndex, s.matrix); s.activeMesh.instanceMatrix.needsUpdate = true; touchedMeshes.add(s.activeMesh);
    }
  }
  for (const mesh of touchedMeshes) mesh.computeBoundingSphere();
  resetState();
}
