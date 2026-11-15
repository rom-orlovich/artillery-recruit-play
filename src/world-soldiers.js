import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { composeMatrix } from './world-kit.js';
import { POSE_CLIPS, buildBoxSoldierGeometry, loadSoldierAssets } from './world-soldier-mesh.js';
import { whenDohersReady } from './world-vehicles.js';
import { snapCrewSpawns } from './world-soldier-snap.js';

const POOL_SIZE = 4;
const NEAR_RADIUS_SQ = 900;
const NEAR_DETAIL_SQ = 1600;
const REASSIGN_INTERVAL = 0.5;
const farMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const spawns = [];
const buckets = [];
const pool = [];
const nearestIdx = [-1, -1, -1, -1];
const nearestDist = [0, 0, 0, 0];
const assignedTo = [-1, -1, -1, -1];
const slotReused = [false, false, false, false];

let buildId = 0;
let reassignTimer = 0;
let lastX = Infinity;
let lastZ = Infinity;

export function resetSoldiers() {
  buildId++;
  spawns.length = 0;
  for (const b of buckets) {
    for (const mesh of [b.nearMesh, b.farMesh]) {
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry?.userData?.boxFallback) mesh.geometry.dispose();
      mesh.dispose();
    }
  }
  buckets.length = 0;
  for (const slot of pool) {
    slot.mixer.stopAllAction();
    slot.mixer.uncacheRoot(slot.root);
    if (slot.root.parent) slot.root.parent.remove(slot.root);
  }
  pool.length = 0;
  reassignTimer = 0;
  lastX = Infinity;
  lastZ = Infinity;
}

export function registerSoldier(x, y, z, ry = 0, pose = 'stand', crewOf = null, slot = null) {
  const key = POSE_CLIPS[pose] ? pose : 'stand';
  spawns.push({
    x, y, origY: y, z, ry, pose: key, crewOf: crewOf ?? null, slot: slot ?? null,
    matrix: composeMatrix(x, y, z, 0, ry, 0),
    activeMesh: null, activeIndex: -1, inPool: false, timeOffset: Math.random()
  });
}

export function getSoldierSpawns() {
  return spawns.map(({ x, y, z, ry, pose, crewOf }) => ({ x, y, z, ry, pose, crewOf }));
}

function finishBucketMesh(mesh, count) {
  mesh.count = count;
  mesh.visible = count > 0;
  if (count > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

function makeBucketMesh(name, geom, count, parent) {
  const mesh = new THREE.InstancedMesh(geom, farMaterial, count);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function initSoldiers(scene, regionOf = null) {
  if (!spawns.length) return;
  const byBucket = new Map();
  for (const spawn of spawns) {
    const parent = (typeof regionOf === 'function' ? regionOf(spawn.x, spawn.z) : null) || scene;
    const key = `${parent.uuid}:${spawn.pose}`;
    if (!byBucket.has(key)) byBucket.set(key, { parent, pose: spawn.pose, list: [] });
    byBucket.get(key).list.push(spawn);
  }
  const boxGeoms = {};
  for (const { parent, pose, list } of byBucket.values()) {
    if (!boxGeoms[pose]) {
      boxGeoms[pose] = buildBoxSoldierGeometry(pose);
      boxGeoms[pose].userData.boxFallback = true;
    }
    const geom = boxGeoms[pose];
    const nearMesh = makeBucketMesh(`soldiers-${pose}`, geom, list.length, parent);
    finishBucketMesh(nearMesh, 0);
    const farMesh = makeBucketMesh(`far-soldiers-${pose}`, geom, list.length, parent);
    for (let i = 0; i < list.length; i++) {
      list[i].activeIndex = i;
      list[i].activeMesh = farMesh;
      farMesh.setMatrixAt(i, list[i].matrix);
    }
    finishBucketMesh(farMesh, list.length);
    buckets.push({ pose, list, nearMesh, farMesh });
  }
  const myBuildId = buildId;
  const assetsPromise = loadSoldierAssets();
  assetsPromise.then((assets) => {
    if (!assets || myBuildId !== buildId) return;
    for (const b of buckets) {
      const nearGeom = assets.poseGeometries[b.pose];
      const farGeom = assets.farPoseGeometries[b.pose] || nearGeom;
      if (nearGeom) { b.nearMesh.geometry = nearGeom; b.nearMesh.computeBoundingSphere(); }
      if (farGeom) { b.farMesh.geometry = farGeom; b.farMesh.computeBoundingSphere(); }
    }
    const used = new Set(buckets.flatMap((b) => [b.nearMesh.geometry, b.farMesh.geometry]));
    for (const g of Object.values(boxGeoms)) if (!used.has(g)) g.dispose();
    for (let i = 0; i < POOL_SIZE; i++) {
      const root = SkeletonUtils.clone(assets.template);
      root.visible = false;
      root.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root);
      const actions = {};
      for (const [pose, clip] of Object.entries(assets.clips)) if (clip) actions[pose] = mixer.clipAction(clip);
      pool.push({ root, mixer, actions, activeAction: null, spawnIndex: -1 });
    }
    reassignTimer = 0;
    lastX = Infinity;
  });
  Promise.all([assetsPromise, whenDohersReady()]).then(() => {
    if (myBuildId !== buildId) return;
    snapCrewSpawns(spawns, pool);
  });
}

function reassignPool(x, z) {
  nearestIdx.fill(-1);
  nearestDist.fill(NEAR_RADIUS_SQ);
  for (let i = 0; i < spawns.length; i++) {
    const dx = spawns[i].x - x;
    const dz = spawns[i].z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= nearestDist[POOL_SIZE - 1]) continue;
    let k = POOL_SIZE - 1;
    while (k > 0 && d2 < nearestDist[k - 1]) {
      nearestDist[k] = nearestDist[k - 1];
      nearestIdx[k] = nearestIdx[k - 1];
      k--;
    }
    nearestDist[k] = d2;
    nearestIdx[k] = i;
  }
  assignedTo.fill(-1);
  slotReused.fill(false);
  for (let s = 0; s < pool.length; s++) {
    const slot = pool[s];
    if (slot.spawnIndex === -1) continue;
    const found = nearestIdx.indexOf(slot.spawnIndex);
    if (found !== -1) {
      assignedTo[found] = s;
      slotReused[s] = true;
    } else {
      spawns[slot.spawnIndex].inPool = false;
      slot.spawnIndex = -1;
      slot.root.visible = false;
      if (slot.activeAction) { slot.activeAction.stop(); slot.activeAction = null; }
    }
  }
  for (let k = 0; k < POOL_SIZE; k++) {
    const idx = nearestIdx[k];
    if (idx === -1 || assignedTo[k] !== -1) continue;
    const s = slotReused.indexOf(false);
    if (s === -1) break;
    slotReused[s] = true;
    const slot = pool[s];
    const spawn = spawns[idx];
    slot.spawnIndex = idx;
    spawn.inPool = true;
    slot.root.position.set(spawn.x, spawn.y, spawn.z);
    slot.root.rotation.set(0, spawn.ry, 0);
    slot.root.visible = true;
    const action = slot.actions[spawn.pose] || slot.actions.stand;
    if (action) {
      action.reset();
      const dur = action.getClip().duration;
      if (dur > 0) action.time = spawn.timeOffset * dur;
      action.play();
      slot.mixer.update(0);
    }
    slot.activeAction = action || null;
  }
  for (const b of buckets) {
    let nearCount = 0;
    let farCount = 0;
    for (const s of b.list) {
      if (s.inPool) { s.activeMesh = null; s.activeIndex = -1; continue; }
      const dx = s.x - x;
      const dz = s.z - z;
      if (dx * dx + dz * dz <= NEAR_DETAIL_SQ) {
        b.nearMesh.setMatrixAt(nearCount, s.matrix);
        s.activeMesh = b.nearMesh;
        s.activeIndex = nearCount++;
      } else {
        b.farMesh.setMatrixAt(farCount, s.matrix);
        s.activeMesh = b.farMesh;
        s.activeIndex = farCount++;
      }
    }
    finishBucketMesh(b.nearMesh, nearCount);
    finishBucketMesh(b.farMesh, farCount);
  }
}

export function updateSoldiers(dt, x, z) {
  if (!pool.length) return;
  reassignTimer -= dt;
  const movedSq = (x - lastX) * (x - lastX) + (z - lastZ) * (z - lastZ);
  if (reassignTimer <= 0 || movedSq > 100) {
    reassignTimer = REASSIGN_INTERVAL;
    lastX = x;
    lastZ = z;
    reassignPool(x, z);
  }
  for (let i = 0; i < pool.length; i++) if (pool[i].spawnIndex !== -1) pool[i].mixer.update(dt);
}
