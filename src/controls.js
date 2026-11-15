import { WORLD_BOUNDS } from './config.js';
import { player, runtime, getSpeedMultiplier, on } from './state.js';
import { colliders, getTerrainHeight } from './world.js';
import {
  initTouchControls,
  resetTouchState,
  getTouchInput,
  updateTouchAutoSprint
} from './controls-touch.js';
import { initHelpAndShortcuts } from './help-panel.js';

const keys = new Set();
let lookSensitivity = 1;
let isLeftHanded = false;
let wasPointerLocked = false;
let callbacks = {};

const GRAVITY = 21;
const GROUND_SNAP = 0.6;

function applySettings(s) {
  if (!s || typeof s !== 'object') return;
  const sens = Number(s.lookSensitivity ?? s.sensitivity);
  if (Number.isFinite(sens) && sens > 0) lookSensitivity = sens;
  if (typeof s.leftHanded === 'boolean') {
    isLeftHanded = s.leftHanded;
  } else if (typeof s.handedness === 'string') {
    isLeftHanded = s.handedness === 'left';
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('left-handed', isLeftHanded);
  }
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

export function resolveCircleAABB(px, pz, r) {
  let x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, px));
  let z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, pz));

  for (let pass = 0; pass < 2; pass++) {
    for (const box of colliders) {
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const push = r - dist;
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        } else {
          const leftPen = Math.abs(x - box.minX);
          const rightPen = Math.abs(box.maxX - x);
          const topPen = Math.abs(z - box.minZ);
          const bottomPen = Math.abs(box.maxZ - z);
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) x = box.minX - r;
          else if (minPen === rightPen) x = box.maxX + r;
          else if (minPen === topPen) z = box.minZ - r;
          else z = box.maxZ + r;
        }
      }
    }
  }

  x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, x));
  z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, z));
  return [x, z];
}

export function requestGameLock(canvas) {
  runtime.isPlaying = true;
  const guideOfferOpen = Boolean(document.querySelector('#guide-offer:not(.hidden)'));
  if (!runtime.isMobile && !guideOfferOpen && canvas && canvas.requestPointerLock) {
    try {
      const res = canvas.requestPointerLock();
      if (res && typeof res.catch === 'function') res.catch(() => {});
    } catch {}
  }
}

export function releaseGameLock() {
  runtime.isPlaying = false;
  if (document.pointerLockElement && document.exitPointerLock) {
    try {
      document.exitPointerLock();
    } catch {}
  }
}

export function resetInputState() {
  keys.clear();
  resetTouchState();
}

export function getInput() {
  const touch = getTouchInput();
  let moveForward = -touch.joyY;
  let moveRight = touch.joyX;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveForward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveForward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;
  const len = Math.hypot(moveRight, moveForward);
  if (len > 1) {
    moveRight /= len;
    moveForward /= len;
  }
  return {
    moveForward,
    moveRight,
    sprintLocked: touch.sprintLocked,
    lookYaw: player.yaw
  };
}

export function initControls(canvas, actionCallbacks = {}) {
  callbacks = actionCallbacks;

  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('left-handed', isLeftHanded);
  }

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (keys.has(e.code)) return;
    keys.add(e.code);
    if (!runtime.isPlaying) return;
    if (e.code === 'Space') {
      if (player.onGround) {
        player.velY = 7.4;
        player.onGround = false;
      }
    } else if (e.code === 'KeyE') {
      callbacks.onInteract?.();
    } else if (e.code === 'KeyQ') {
      callbacks.onAbility?.();
    } else if (e.code === 'KeyP') {
      callbacks.onPauseToggle?.();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => resetInputState());

  window.addEventListener('mousemove', (e) => {
    if (!runtime.isPlaying) return;
    if (document.pointerLockElement === canvas) {
      player.yaw -= e.movementX * 0.0022 * lookSensitivity;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - e.movementY * 0.0022 * lookSensitivity));
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !runtime.isPlaying) return;
    if (!runtime.isMobile && document.pointerLockElement !== canvas) {
      requestGameLock(canvas);
    }
    callbacks.onFire?.();
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (wasPointerLocked && !locked && runtime.isPlaying && !runtime.shopOpen && !runtime.enlistOpen && !runtime.isDead) {
      callbacks.onPauseToggle?.();
    }
    wasPointerLocked = locked;
  });

  initTouchControls(canvas, () => callbacks, () => lookSensitivity);
  initHelpAndShortcuts(callbacks);
}

export function updatePlayerMovement(dt, camera) {
  updateTouchAutoSprint(dt);
  const touch = getTouchInput();

  let moveRight = touch.joyX;
  let moveForward = -touch.joyY;

  if (keys.has('KeyW') || keys.has('ArrowUp')) moveForward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveForward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;

  const len = Math.hypot(moveRight, moveForward);
  if (len > 1) {
    moveRight /= len;
    moveForward /= len;
  }

  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sprintLocked;
  const speed = 7.6 * (sprinting ? 1.48 : 1.0) * getSpeedMultiplier();

  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const vx = (-sinY * moveForward + cosY * moveRight) * speed;
  const vz = (-cosY * moveForward - sinY * moveRight) * speed;

  const [nx, nz] = resolveCircleAABB(player.pos.x + vx * dt, player.pos.z + vz * dt, player.radius);
  player.pos.x = nx;
  player.pos.z = nz;

  const groundY = getTerrainHeight(player.pos.x, player.pos.z);
  player.velY -= GRAVITY * dt;
  player.pos.y += player.velY * dt;
  const snapDown = player.onGround && player.velY <= 0 && player.pos.y - groundY < GROUND_SNAP;
  if (player.pos.y <= groundY || snapDown) {
    player.pos.y = groundY;
    player.velY = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (len > 0.1 && player.onGround) {
    runtime.bobTime += dt * (sprinting ? 12 : 8.5);
  }
  const bobOffset = player.onGround ? Math.sin(runtime.bobTime) * 0.04 : 0;

  camera.position.set(player.pos.x, player.pos.y + player.eyeHeight + bobOffset, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}
