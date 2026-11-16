import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const POOL_SIZE = 1;
export const NEAR_RADIUS_SQ = 625;
export const HIDE_FAR_SQ = 14400;
export const REASSIGN_INTERVAL = 0.5;
export const MOVE_REASSIGN_SQ = 100;
const SOLDIER_GLB_URL = './assets/models/soldier.glb';
const CROSSFADE_SEC = 0.2;

const farMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const nearestIdx = new Array(POOL_SIZE).fill(-1);
const nearestDist = new Array(POOL_SIZE).fill(0);
const assignedTo = new Array(POOL_SIZE).fill(-1);
const slotReused = new Array(POOL_SIZE).fill(false);

let walkClipPromise = null;

export function loadWalkClip() {
  if (!walkClipPromise) {
    walkClipPromise = new Promise((resolve) => {
      new GLTFLoader().load(
        SOLDIER_GLB_URL,
        (gltf) => resolve(gltf.animations.find((c) => c.name.toLowerCase().includes('walk')) || null),
        undefined,
        () => resolve(null)
      );
    });
  }
  return walkClipPromise;
}

export function finishBucketMesh(mesh, count) {
  mesh.count = count;
  mesh.visible = count > 0;
  if (count > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

export function makeFarMesh(name, geom, count, parent) {
  const mesh = new THREE.InstancedMesh(geom, farMaterial, count);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function resolveSlotAction(slot, poseKey) {
  if (poseKey === 'walk') return slot.actions.walk || slot.actions.stand;
  if (poseKey === 'work' || poseKey === 'arms') return slot.actions.arms || slot.actions.stand;
  return slot.actions[poseKey] || slot.actions.stand;
}

export function applySlotPose(slot, spawn, fade = false) {
  const poseKey = spawn.actionPose || spawn.pose;
  const action = resolveSlotAction(slot, poseKey);
  slot.currentPose = poseKey;
  if (!action || action === slot.activeAction) return;
  action.reset();
  const dur = action.getClip().duration;
  if (dur > 0) action.time = spawn.timeOffset * dur;
  action.play();
  if (fade && slot.activeAction) slot.activeAction.crossFadeTo(action, CROSSFADE_SEC, false);
  else if (slot.activeAction) slot.activeAction.stop();
  slot.activeAction = action;
}

export function createPoolSlots(pool, assets, walkClip, scene) {
  for (let i = 0; i < POOL_SIZE; i++) {
    const root = SkeletonUtils.clone(assets.template);
    root.visible = false;
    root.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = false;
        c.receiveShadow = true;
      }
    });
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [pose, clip] of Object.entries(assets.clips)) {
      if (clip) actions[pose] = mixer.clipAction(clip);
    }
    if (walkClip) actions.walk = mixer.clipAction(walkClip);
    pool.push({ root, mixer, actions, activeAction: null, currentPose: '', spawnIndex: -1 });
  }
}

export function disposePoolSlots(pool) {
  for (const slot of pool) {
    slot.mixer.stopAllAction();
    slot.mixer.uncacheRoot(slot.root);
    if (slot.root.parent) slot.root.parent.remove(slot.root);
  }
  pool.length = 0;
}

export function reassignPool(spawns, farMesh, pool, x, z) {
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
      spawns[slot.spawnIndex].poolSlot = -1;
      slot.spawnIndex = -1;
      slot.currentPose = '';
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
    spawn.poolSlot = s;
    slot.root.position.set(spawn.x, spawn.y, spawn.z);
    slot.root.rotation.set(0, spawn.ry, 0);
    slot.root.visible = true;
    applySlotPose(slot, spawn, false);
    slot.mixer.update(0);
  }
  if (!farMesh) return;
  let farCount = 0;
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    if (s.inPool) { s.activeMesh = null; s.activeIndex = -1; continue; }
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz > HIDE_FAR_SQ) { s.activeMesh = null; s.activeIndex = -1; continue; }
    farMesh.setMatrixAt(farCount, s.matrix);
    s.activeMesh = farMesh;
    s.activeIndex = farCount++;
  }
  finishBucketMesh(farMesh, farCount);
}
