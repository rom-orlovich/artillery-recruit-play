import { player, runtime } from './state.js';
import {
  getHeroGunPos,
  resetFireCallTimer,
  updateFireCallScheduler
} from './fire-call-scheduler.js';
import {
  createGunRegistry,
  createShellPool,
  resetShellPool,
  getOrCreateGun,
  layGunState,
  loadGunState,
  getGunReloadCooldown,
  fireGunFromPool,
  tickGunReloads,
  updateShellPool,
  computeTargetAngles
} from './fire-mission-guns.js';
import {
  createRoemState,
  startRoemMrsi,
  updateRoemMrsi,
  resolveRoemCounterBattery
} from './fire-mission-roem.js';
import {
  createObserverState,
  resetMissionDispersion,
  beginBinocularLaze,
  updateBinocularLaze,
  applyFireCorrection
} from './rokhash-observer.js';
import {
  awardScootBonus,
  applyCounterBatteryDamage,
  safeRadio,
  safeToast,
  spawnImpactParticles,
  resolveMrsiImpact,
  resolveStandardShellImpact
} from './fire-mission-impacts.js';

const DEFAULT_HERO_GUN_ID = 'hero';
const INITIAL_AMMO_COUNT = 8;

const RADIO_MSG_FIRE_CALLED = 'מפי"ק בזלת: קריאת אש התקבלה, טווח למטרה מוכן!';
const RADIO_MSG_SCOOT = 'רועם: בצע דילוג מהיר תוך 30 שניות!';
const TOAST_CORRECTION = 'תיקון אש הוזן למפי"ק';

const shellPool = createShellPool();
const gunStates = createGunRegistry();
const roemState = createRoemState();
const observerState = createObserverState();
const missionTarget = { x: 120, y: 0, z: -320 };
const gunOrigin = { x: 0, y: 0, z: 0 };

let sceneRef = null;
let simTimeSec = 0;
let missionLaid = false;

const loopState = {
  heroGunId: DEFAULT_HERO_GUN_ID,
  platform: 'doher',
  activeMission: false,
  targetYaw: 0,
  targetElev: 0.5,
  impactCount: 0,
  streakMultiplier: 1,
  lastHitTime: -1,
  lastShotHit: false,
  lastRadioKey: null,
  lastErrorM: 0,
  mrsiImpacts: roemState.mrsiImpacts,
  scootTimer: 0,
  cepRadius: observerState.cepRadius,
  lazing: false,
  lazeProgress: 0
};

function syncGunOrigin() {
  const pos = getHeroGunPos();
  gunOrigin.x = pos?.x ?? 0;
  gunOrigin.y = 0;
  gunOrigin.z = pos?.z ?? 0;
}

function handleRoemLaunch() {
  spawnImpactParticles(sceneRef, player.pos.x, 2.4, player.pos.z, 0xffcc66);
}

function handleRoemImpact(shot) {
  resolveMrsiImpact(shot, loopState, sceneRef);
}

function handleLazeLocked(target) {
  triggerFireMission(target);
}

function resolveShellImpact(shell) {
  resolveStandardShellImpact(shell, gunOrigin, loopState, simTimeSec, sceneRef);
  loopState.activeMission = false;
  missionLaid = false;
  resetFireCallTimer();
}

export function initFireMissionLoop(appContext) {
  sceneRef = appContext?.scene || null;
  runtime.gunAmmo = runtime.gunAmmo || {};
  if (typeof runtime.gunAmmo[DEFAULT_HERO_GUN_ID] !== 'number') {
    runtime.gunAmmo[DEFAULT_HERO_GUN_ID] = INITIAL_AMMO_COUNT;
  }
  if (typeof runtime.fireStreak !== 'number') runtime.fireStreak = 0;
  getOrCreateGun(gunStates, DEFAULT_HERO_GUN_ID);
  syncGunOrigin();
}

export function resetFireMissionMapState() {
  resetShellPool(shellPool);
  for (const gun of gunStates.values()) {
    gun.loadedShell = null;
    gun.reloadTimer = 0;
  }
  observerState.lazing = false;
  observerState.lazeElapsed = 0;
  roemState.scootActive = false;
  roemState.scootTimer = 0;
  loopState.scootTimer = 0;
  loopState.lazing = false;
  loopState.lazeProgress = 0;
  loopState.activeMission = false;
  missionLaid = false;
  resetFireCallTimer();
  syncGunOrigin();
}

export function setBatteryPlatform(platform) {
  loopState.platform = platform === 'roem' ? 'roem' : 'doher';
  runtime.batteryPlatform = loopState.platform;
  return loopState.platform;
}

export function triggerFireMission(targetPos) {
  missionTarget.x = targetPos?.x ?? 120;
  missionTarget.y = targetPos?.y ?? 0;
  missionTarget.z = targetPos?.z ?? -320;
  loopState.activeMission = true;
  loopState.lastRadioKey = 'fireCalled';
  missionLaid = false;
  resetFireCallTimer();
  resetMissionDispersion(observerState);
  loopState.cepRadius = observerState.cepRadius;
  computeTargetAngles(missionTarget, gunOrigin, loopState);
  safeRadio(RADIO_MSG_FIRE_CALLED);
  return {
    gunId: loopState.heroGunId,
    targetYaw: loopState.targetYaw,
    targetElev: loopState.targetElev,
    cepRadius: loopState.cepRadius
  };
}

export function isGunLaid() {
  return missionLaid;
}

export function markGunLaid() {
  missionLaid = true;
}

export function getGunReloadTimer(gunId = DEFAULT_HERO_GUN_ID) {
  return getOrCreateGun(gunStates, gunId).reloadTimer;
}

export function hasLoadedShell(gunId = DEFAULT_HERO_GUN_ID) {
  return Boolean(getOrCreateGun(gunStates, gunId).loadedShell);
}

export function layGun(gunId, yaw, elev) {
  return layGunState(gunStates, gunId, yaw, elev);
}

export function loadGun(gunId, shellType = 'he') {
  return loadGunState(gunStates, gunId, shellType);
}

export function getReloadCooldown(gunId = DEFAULT_HERO_GUN_ID) {
  return getGunReloadCooldown(gunStates, gunId);
}

export function fireGun(gunId = DEFAULT_HERO_GUN_ID) {
  if (!fireGunFromPool(gunStates, shellPool, gunId, missionTarget, loopState)) return false;
  spawnImpactParticles(sceneRef, gunOrigin.x, 2, gunOrigin.z, 0xffdd88);
  return true;
}

export function fireRoemMrsi(targetPos) {
  if (targetPos) {
    missionTarget.x = targetPos.x;
    missionTarget.y = targetPos.y ?? 0;
    missionTarget.z = targetPos.z;
    computeTargetAngles(missionTarget, gunOrigin, loopState);
  }
  startRoemMrsi(roemState, missionTarget, player.pos, handleRoemLaunch);
  loopState.scootTimer = roemState.scootTimer;
  safeRadio(RADIO_MSG_SCOOT);
  return true;
}

export function resolveCounterBattery() {
  const res = resolveRoemCounterBattery(roemState, player.pos, awardScootBonus, applyCounterBatteryDamage);
  loopState.scootTimer = 0;
  return res;
}

export function startBinocularLaze(targetPos) {
  beginBinocularLaze(observerState, targetPos);
  loopState.lazing = true;
  loopState.lazeProgress = 0;
  return true;
}

export function submitFireCorrection(correction) {
  const nextCep = applyFireCorrection(observerState, missionTarget, correction, gunOrigin);
  loopState.cepRadius = nextCep;
  computeTargetAngles(missionTarget, gunOrigin, loopState);
  safeToast(TOAST_CORRECTION);
  return nextCep;
}

export function getFireMissionState() {
  loopState.scootTimer = roemState.scootTimer;
  loopState.cepRadius = observerState.cepRadius;
  loopState.lazing = observerState.lazing;
  loopState.lazeProgress = observerState.lazeDuration > 0
    ? Math.min(1, observerState.lazeElapsed / observerState.lazeDuration)
    : 0;
  return loopState;
}

export function updateFireMissionLoop(dt) {
  simTimeSec += dt;
  updateFireCallScheduler(dt, loopState.activeMission, triggerFireMission);
  tickGunReloads(gunStates, dt);
  updateShellPool(shellPool, dt, resolveShellImpact);
  updateRoemMrsi(roemState, dt, simTimeSec, handleRoemLaunch, handleRoemImpact, resolveCounterBattery);
  loopState.scootTimer = roemState.scootTimer;
  updateBinocularLaze(observerState, dt, runtime, handleLazeLocked);
}
