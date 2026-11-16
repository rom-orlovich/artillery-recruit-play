import * as THREE from 'three';
import { composeMatrix } from './world-kit.js';
import { POSE_CLIPS, buildBoxSoldierGeometry, loadSoldierAssets } from './world-soldier-mesh.js';
import { whenDohersReady } from './world-vehicles.js';
import { snapCrewSpawns } from './world-soldier-snap.js';
import {
  REASSIGN_INTERVAL, MOVE_REASSIGN_SQ, loadWalkClip, finishBucketMesh,
  makeFarMesh, applySlotPose, createPoolSlots, disposePoolSlots, reassignPool
} from './world-soldier-pool.js';

const spawns = [];
const pool = [];
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpScale = new THREE.Vector3(1, 1, 1);

let farMesh = null;
let buildId = 0;
let reassignTimer = 0;
let lastX = Infinity;
let lastZ = Infinity;

function pickFirstGeometry(map) {
  if (!map) return null;
  for (const key in map) {
    if (map[key]) return map[key];
  }
  return null;
}

export function resetSoldiers() {
  buildId++;
  spawns.length = 0;
  if (farMesh) {
    if (farMesh.parent) farMesh.parent.remove(farMesh);
    if (farMesh.geometry?.userData?.boxFallback) farMesh.geometry.dispose();
    farMesh.dispose();
    farMesh = null;
  }
  disposePoolSlots(pool);
  reassignTimer = 0;
  lastX = Infinity;
  lastZ = Infinity;
}

export function registerSoldier(x, y, z, ry = 0, pose = 'stand', crewOf = null, slot = null) {
  const key = POSE_CLIPS[pose] ? pose : 'stand';
  spawns.push({
    x, y, origY: y, z, ry, pose: key, actionPose: key, crewOf: crewOf ?? null, slot: slot ?? null,
    name: '', rank: '', role: '',
    matrix: composeMatrix(x, y, z, 0, ry, 0),
    activeMesh: null, activeIndex: -1, inPool: false, poolSlot: -1, dirty: false, timeOffset: Math.random()
  });
}

export function getSoldierSpawns() {
  return spawns.map(({ x, y, z, ry, pose, crewOf, name, rank, role }) => ({ x, y, z, ry, pose, crewOf, name, rank, role }));
}

export function getRawSoldierSpawn(index) {
  return spawns[index] || null;
}

export function setSoldierIdentity(index, name, rank, role) {
  const s = spawns[index];
  if (!s) return;
  s.name = name || '';
  s.rank = rank || '';
  s.role = role || '';
}

export function syncSoldierTransform(index, x, y, z, ry, actionPose) {
  const s = spawns[index];
  if (!s) return;
  s.x = x;
  s.y = y;
  s.z = z;
  s.ry = ry;
  if (actionPose) s.actionPose = actionPose;
  s.dirty = true;
}

export function initSoldiers(scene, regionOf = null) {
  if (!spawns.length) return;
  const resolveParent = typeof regionOf === 'function' ? regionOf : () => scene;
  const boxGeom = buildBoxSoldierGeometry('stand');
  boxGeom.userData.boxFallback = true;
  farMesh = makeFarMesh('far-soldiers-all', boxGeom, spawns.length, scene);
  for (let i = 0; i < spawns.length; i++) {
    spawns[i].activeIndex = i;
    spawns[i].activeMesh = farMesh;
    farMesh.setMatrixAt(i, spawns[i].matrix);
  }
  finishBucketMesh(farMesh, spawns.length);

  const myBuildId = buildId;
  const assetsPromise = loadSoldierAssets();
  Promise.all([assetsPromise, loadWalkClip()]).then(([assets, walkClip]) => {
    if (!assets || myBuildId !== buildId) return;
    const farGeom = assets.farPoseGeometries?.stand || pickFirstGeometry(assets.farPoseGeometries) ||
      assets.poseGeometries?.stand || pickFirstGeometry(assets.poseGeometries);
    if (farGeom && farMesh) {
      farGeom.userData.shared = true;
      farMesh.geometry = farGeom;
      farMesh.computeBoundingSphere();
      boxGeom.dispose();
    }
    createPoolSlots(pool, assets, walkClip, scene);
    reassignTimer = 0;
    lastX = Infinity;
  });
  Promise.all([assetsPromise, whenDohersReady()]).then(() => {
    if (myBuildId !== buildId) return;
    snapCrewSpawns(spawns, pool, resolveParent, scene);
    reassignTimer = 0;
    lastX = Infinity;
  });
}

export function updateSoldiers(dt, x, z) {
  let farNeedsUpdate = false;
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    if (!s.dirty) continue;
    s.dirty = false;
    tmpEuler.set(0, s.ry, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(s.x, s.y, s.z);
    s.matrix.compose(tmpPos, tmpQuat, tmpScale);
    if (s.inPool && s.poolSlot >= 0) {
      const slot = pool[s.poolSlot];
      slot.root.position.set(s.x, s.y, s.z);
      slot.root.rotation.y = s.ry;
      applySlotPose(slot, s, true);
    } else if (s.activeMesh && s.activeIndex >= 0) {
      s.activeMesh.setMatrixAt(s.activeIndex, s.matrix);
      farNeedsUpdate = true;
    }
  }
  if (farNeedsUpdate && farMesh) farMesh.instanceMatrix.needsUpdate = true;
  if (!pool.length) return;
  reassignTimer -= dt;
  const movedSq = (x - lastX) * (x - lastX) + (z - lastZ) * (z - lastZ);
  if (reassignTimer <= 0 || movedSq > MOVE_REASSIGN_SQ) {
    reassignTimer = REASSIGN_INTERVAL;
    lastX = x;
    lastZ = z;
    reassignPool(spawns, farMesh, pool, x, z);
  }
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].spawnIndex !== -1) pool[i].mixer.update(dt);
  }
}
