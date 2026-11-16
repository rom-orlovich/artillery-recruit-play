import { player, runtime } from './state.js';
import { isWorldPausedByDialogue } from './npc.js';
import { getCurrentMapId } from './world.js';
import {
  initFireMissionLoop,
  resetFireMissionMapState,
  updateFireMissionLoop,
  getFireMissionState
} from './fire-mission-loop.js';
import {
  initBatteryEvents,
  updateBatteryEvents,
  getBatteryEventsState,
  interactStation
} from './battery-events.js';
import { initShiftHud, updateShiftHud } from './battery-shift.js';
import { updateDailyRoutine } from './daily-routine.js';
import { initPlayerLevel } from './player-level.js';

const MAX_FRAME_DT = 0.25;
const DEFAULT_HERO_AMMO = 8;

let contextRef = null;
let lastMapId = null;

function ensureRuntimeDefaults() {
  if (typeof player.score !== 'number') player.score = 0;
  if (typeof runtime.mafikOnline !== 'boolean') runtime.mafikOnline = true;
  if (typeof runtime.fireStreak !== 'number') runtime.fireStreak = 0;
  if (typeof runtime.moraleBuffSec !== 'number') runtime.moraleBuffSec = 0;
  if (typeof runtime.illumBoost !== 'number') runtime.illumBoost = 0;
  if (typeof runtime.illumTimer !== 'number') runtime.illumTimer = 0;
  runtime.gunAmmo = runtime.gunAmmo || {};
  if (typeof runtime.gunAmmo.hero !== 'number') runtime.gunAmmo.hero = DEFAULT_HERO_AMMO;
}

export function initFunLoop(appContext) {
  contextRef = appContext || null;
  lastMapId = getCurrentMapId();
  ensureRuntimeDefaults();
  initPlayerLevel();
  initFireMissionLoop(contextRef);
  initBatteryEvents(contextRef);
  initShiftHud();
}

export function handleFunInteract(stationId) {
  return interactStation(stationId);
}

export function updateFunLoop(dt) {
  if (!dt || dt <= 0) return;
  const mapId = getCurrentMapId();
  if (mapId && mapId !== lastMapId) {
    lastMapId = mapId;
    ensureRuntimeDefaults();
    resetFireMissionMapState();
    initBatteryEvents(contextRef);
  }
  if (runtime.paused || runtime.titleActive || runtime.isDead || isWorldPausedByDialogue()) {
    updateShiftHud(getFireMissionState(), getBatteryEventsState());
    return;
  }
  const safeDt = Math.min(dt, MAX_FRAME_DT);
  updateDailyRoutine(safeDt);
  updateFireMissionLoop(safeDt);
  updateBatteryEvents(safeDt, contextRef);
  updateShiftHud(getFireMissionState(), getBatteryEventsState());
}
