import { runtime } from './state.js';

const DEFAULT_HERO_GUN_ID = 'hero';
const BASE_RELOAD_SEC = 4.0;
const BUFFED_RELOAD_SEC = 2.8;
const SHELL_FLIGHT_SEC = 0.85;
const SHELL_POOL_SIZE = 8;
const MIN_TARGET_DIST_M = 40;
const MIN_ELEV_RAD = 0.15;
const MAX_ELEV_RAD = 1.2;
const BASE_ELEV_RAD = 0.35;
const ELEV_PER_M = 0.0006;
const DEFAULT_ELEV_RAD = 0.5;
const TWO_PI = Math.PI * 2;

export function createGunRegistry() {
  return new Map();
}

export function createShellPool() {
  const pool = [];
  for (let i = 0; i < SHELL_POOL_SIZE; i += 1) {
    pool.push({
      active: false,
      gunId: DEFAULT_HERO_GUN_ID,
      shellType: 'he',
      flightLeft: 0,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      yawDiff: 0,
      elevDiff: 0
    });
  }
  return pool;
}

export function resetShellPool(pool) {
  for (let i = 0; i < pool.length; i += 1) {
    pool[i].active = false;
    pool[i].flightLeft = 0;
  }
}

export function getOrCreateGun(gunStates, gunId) {
  const id = gunId || DEFAULT_HERO_GUN_ID;
  let g = gunStates.get(id);
  if (!g) {
    g = { id, yaw: 0, elev: DEFAULT_ELEV_RAD, loadedShell: null, reloadTimer: 0 };
    gunStates.set(id, g);
  }
  return g;
}

export function layGunState(gunStates, gunId, yaw, elev) {
  const g = getOrCreateGun(gunStates, gunId);
  g.yaw = Number(yaw) || 0;
  g.elev = Number(elev) || DEFAULT_ELEV_RAD;
  return true;
}

export function loadGunState(gunStates, gunId, shellType = 'he') {
  const g = getOrCreateGun(gunStates, gunId);
  g.loadedShell = shellType || 'he';
  return true;
}

export function getGunReloadCooldown(gunStates, gunId = DEFAULT_HERO_GUN_ID) {
  getOrCreateGun(gunStates, gunId);
  return (runtime.moraleBuffSec ?? 0) > 0 ? BUFFED_RELOAD_SEC : BASE_RELOAD_SEC;
}

export function wrapAngleDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export function computeTargetAngles(missionTarget, gunOrigin, outState) {
  const dx = missionTarget.x - gunOrigin.x;
  const dz = missionTarget.z - gunOrigin.z;
  const dist = Math.hypot(dx, dz);
  outState.targetYaw = Math.atan2(dx, -dz);
  outState.targetElev = Math.max(MIN_ELEV_RAD, Math.min(MAX_ELEV_RAD, BASE_ELEV_RAD + dist * ELEV_PER_M));
}

export function computeImpactErrorM(shell, gunOrigin) {
  const dist = Math.max(MIN_TARGET_DIST_M, Math.hypot(shell.targetX - gunOrigin.x, shell.targetZ - gunOrigin.z));
  const yawErrM = dist * Math.abs(shell.yawDiff);
  const elevErrM = dist * 0.5 * Math.abs(shell.elevDiff);
  return Math.hypot(yawErrM, elevErrM) + (yawErrM < 1 && elevErrM < 1 ? 1.5 : 0);
}

export function fireGunFromPool(gunStates, shellPool, gunId, missionTarget, loopState) {
  const id = gunId || DEFAULT_HERO_GUN_ID;
  runtime.gunAmmo = runtime.gunAmmo || {};
  const ammo = runtime.gunAmmo[id] ?? 0;
  if (ammo <= 0) return false;
  const g = getOrCreateGun(gunStates, id);
  if (!g.loadedShell) return false;
  let slot = null;
  for (let i = 0; i < shellPool.length; i += 1) {
    if (!shellPool[i].active) {
      slot = shellPool[i];
      break;
    }
  }
  if (!slot) return false;
  runtime.gunAmmo[id] = ammo - 1;
  slot.active = true;
  slot.gunId = id;
  slot.shellType = g.loadedShell;
  slot.flightLeft = SHELL_FLIGHT_SEC;
  slot.targetX = missionTarget.x;
  slot.targetY = missionTarget.y;
  slot.targetZ = missionTarget.z;
  slot.yawDiff = wrapAngleDiff(g.yaw, loopState.targetYaw);
  slot.elevDiff = g.elev - loopState.targetElev;
  g.loadedShell = null;
  g.reloadTimer = getGunReloadCooldown(gunStates, id);
  return true;
}

export function tickGunReloads(gunStates, dt) {
  for (const g of gunStates.values()) {
    if (g.reloadTimer > 0) g.reloadTimer = Math.max(0, g.reloadTimer - dt);
  }
}

export function updateShellPool(shellPool, dt, onImpact) {
  for (let i = 0; i < shellPool.length; i += 1) {
    const s = shellPool[i];
    if (!s.active) continue;
    s.flightLeft -= dt;
    if (s.flightLeft <= 0) {
      s.active = false;
      onImpact(s);
    }
  }
}
