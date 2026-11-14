import * as THREE from 'three';
import { isTouchDevice } from './config.js';
import { player, runtime, on } from './state.js';
import { worldShootables } from './world.js';

const MAX_ANGLE_RAD = (6 * Math.PI) / 180;
const MIN_COS = Math.cos(MAX_ANGLE_RAD);
const assistRay = new THREE.Raycaster();
const camPos = new THREE.Vector3();
const camDir = new THREE.Vector3();
const targetPos = new THREE.Vector3();
const toTarget = new THREE.Vector3();

let aimAssistEnabled = true;

function applySettings(s) {
  if (!s || typeof s !== 'object') return;
  const val = s.aimAssist ?? s.aim_assist;
  if (typeof val === 'boolean') aimAssistEnabled = val;
}

import('./settings.js')
  .then((m) => applySettings(m?.getSettings?.()))
  .catch(() => {});

on('settings:changed', (payload) => {
  if (payload && typeof payload === 'object') {
    applySettings(payload.settings || payload);
    return;
  }
  import('./settings.js')
    .then((m) => applySettings(m?.getSettings?.()))
    .catch(() => {});
});

export function isAimAssistActive() {
  return aimAssistEnabled && (runtime.isMobile || isTouchDevice());
}

function isTargetMeshActive(obj) {
  let curr = obj;
  while (curr) {
    if (curr.visible === false) return false;
    const ud = curr.userData || {};
    if (ud.target && ud.target.active === false) return false;
    if (ud.targetObj && ud.targetObj.active === false) return false;
    if (ud.drone?.destroyed || ud.droneObj?.destroyed) return false;
    if (ud.transmitter?.destroyed || ud.transmitterObj?.destroyed) return false;
    curr = curr.parent;
  }
  return true;
}

function getMeshWorldCenter(mesh, out) {
  mesh.updateWorldMatrix(true, false);
  if (mesh.geometry) {
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    if (mesh.geometry.boundingSphere) {
      return out.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
    }
  }
  return mesh.getWorldPosition(out);
}

export function findAimAssistHit(camera, candidateMeshes, maxRange = 140, wallDist = 140, blockersList = worldShootables) {
  if (!camera || !Array.isArray(candidateMeshes) || !candidateMeshes.length) return null;
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(camDir);

  let best = null;
  for (const mesh of candidateMeshes) {
    if (!mesh || !mesh.isObject3D || !isTargetMeshActive(mesh)) continue;
    getMeshWorldCenter(mesh, targetPos);
    toTarget.subVectors(targetPos, camPos);
    const dist = toTarget.length();
    if (dist < 0.1 || dist > maxRange || dist > wallDist + 0.35) continue;
    toTarget.divideScalar(dist);
    const dot = camDir.dot(toTarget);
    if (dot < MIN_COS) continue;

    if (Array.isArray(blockersList) && blockersList.length > 0) {
      assistRay.set(camPos, toTarget);
      assistRay.far = dist;
      const wallHits = assistRay.intersectObjects(blockersList, false);
      if (wallHits.length > 0 && wallHits[0].distance < dist - 0.35) continue;
    }

    if (!best || dot > best.dot) {
      best = {
        mesh,
        dot,
        dist,
        dir: toTarget.clone(),
        center: targetPos.clone()
      };
    }
  }

  if (!best) return null;
  assistRay.set(camPos, best.dir);
  assistRay.far = maxRange;
  const hits = assistRay.intersectObject(best.mesh, true);
  if (hits.length > 0) {
    return { object: hits[0].object, point: hits[0].point, distance: hits[0].distance };
  }
  return { object: best.mesh, point: best.center, distance: best.dist };
}

export function snapCrosshairGently(camera, targetPoint, blend = 0.35) {
  if (!camera || !targetPoint) return;
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(camPos);
  const dx = targetPoint.x - camPos.x;
  const dy = targetPoint.y - camPos.y;
  const dz = targetPoint.z - camPos.z;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 0.001) return;

  const targetYaw = Math.atan2(-dx, -dz);
  const targetPitch = Math.max(-1.25, Math.min(1.25, Math.atan2(dy, horiz)));
  let dYaw = targetYaw - player.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;

  player.yaw += dYaw * blend;
  player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch + (targetPitch - player.pitch) * blend));
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

export function updateAimAssist(dt, camera, entitiesApi) {
  if (!isAimAssistActive() || !camera || !entitiesApi || dt <= 0) return;
  if (!runtime.isPlaying || runtime.isDead || runtime.paused || runtime.modalOpen || runtime.shopOpen || runtime.enlistOpen) return;

  const list = [];
  const pushArr = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const m = item?.hitMesh || item?.mesh || item;
      if (m && m.isObject3D && m.visible) list.push(m);
    }
  };
  pushArr(entitiesApi.targetHitMeshes);
  pushArr(entitiesApi.droneHitMeshes);
  pushArr(entitiesApi.borderTransmitters);
  if (!list.length) return;

  const hit = findAimAssistHit(camera, list, 140, 140, worldShootables);
  if (hit) {
    snapCrosshairGently(camera, hit.point, Math.min(0.18, dt * 4.5));
  }
}
