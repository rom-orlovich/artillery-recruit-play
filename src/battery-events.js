import { player, runtime, addScoreAndMoney } from './state.js';
import { spawnDrone } from './entities.js';
import { getCurrentMapId, getTerrainHeight } from './world.js';
import { getSkyPhase } from './world-time.js';
import { showRadio, showToast } from './hud.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';
import {
  getReadinessState,
  refillReadiness,
  updateBatteryReadiness
} from './battery-shift.js';
import {
  clearLightingOriginals,
  setScenePointLightsDimmed,
  applySceneAmbientBoost,
  syncSceneAmbientBoost,
  clearSceneAmbientBoost,
  revealInfiltrators,
  concealInfiltrators
} from './battery-lighting.js';
import {
  getNpcOrderSpeed,
  applyTrustDelta,
  getTrustGreetingPrefix,
  boostEnlistedTrustFromMeal,
  scanCrewState,
  resetCrewStaminaTracker
} from './battery-crew.js';

const CRISIS_INTERVAL_SEC = 210;
const CRISIS_DURATION_SEC = 60;
const STOVE_BUFF_SEC = 180;
const GENERATOR_SCORE = 75;
const GENERATOR_MONEY = 20;
const ILLUM_DURATION_SEC = 25;
const ILLUM_BOOST_AMOUNT = 0.35;
const INFILTRATOR_COUNT = 2;
const INFILTRATOR_OFFSET_M = 30;
const INFILTRATOR_HEIGHT_M = 2.5;

const CRISIS_POOL = ['event_drone_swarm', 'event_night_illum', 'event_generator_out'];

const RADIO_GEN_OUT = 'תקלת גנרטור! המפי"ק מושבת — תדלק את הגנרטור!';
const RADIO_DRONES = 'התראת רחפנים! אבטח את תורן המצלמה והפל רחפנים!';
const RADIO_NIGHT_ILLUM = 'תנועה חשודה בחושך — נדרש פגז תאורה!';
const TOAST_GEN_FIXED = 'הגנרטור תודלק והמפי"ק חזר לפעולה (+75)';
const TOAST_STOVE_READY = 'קפה ושקשוקה מוכנים! קצב טעינה מוגבר ל-3 דקות';
const TOAST_COT_REST = 'מנוחה במיטת השדה התרעננה';

let sceneRef = null;
let crisisCooldown = CRISIS_INTERVAL_SEC;
let crisisIndex = 0;

const eventsState = {
  activeCrisis: null,
  crisisTimer: 0,
  illumBoost: 0,
  illumTimer: 0,
  mafikOnline: true,
  moraleBuffSec: 0,
  readiness: getReadinessState()
};

function safeToast(msg) {
  try { showToast(msg); } catch {}
}

function safeRadio(msg) {
  try { showRadio(msg); } catch {}
}

function handleNpcGeneratorFix() {
  interactStation('generator');
}

export { getNpcOrderSpeed, applyTrustDelta, getTrustGreetingPrefix };

export function initBatteryEvents(appContext) {
  sceneRef = appContext?.scene || null;
  clearLightingOriginals();
  resetCrewStaminaTracker();
  eventsState.activeCrisis = null;
  eventsState.crisisTimer = 0;
  eventsState.illumBoost = 0;
  eventsState.illumTimer = 0;
  crisisCooldown = CRISIS_INTERVAL_SEC;
  runtime.illumBoost = 0;
  runtime.illumTimer = 0;
  if (typeof runtime.mafikOnline !== 'boolean') runtime.mafikOnline = true;
  if (typeof runtime.moraleBuffSec !== 'number') runtime.moraleBuffSec = 0;
  eventsState.mafikOnline = runtime.mafikOnline;
  eventsState.moraleBuffSec = runtime.moraleBuffSec;
}

export function activateIllumination(durationSec = ILLUM_DURATION_SEC, boost = ILLUM_BOOST_AMOUNT) {
  eventsState.illumTimer = durationSec;
  eventsState.illumBoost = boost;
  runtime.illumTimer = durationSec;
  runtime.illumBoost = boost;
  applySceneAmbientBoost(sceneRef, boost);
  revealInfiltrators();
  return eventsState.illumBoost;
}

export function triggerCrisisEvent(eventId) {
  eventsState.activeCrisis = eventId;
  eventsState.crisisTimer = CRISIS_DURATION_SEC;
  if (eventId === 'event_generator_out') {
    runtime.mafikOnline = false;
    eventsState.mafikOnline = false;
    setScenePointLightsDimmed(sceneRef, true);
    safeRadio(RADIO_GEN_OUT);
  } else if (eventId === 'event_drone_swarm') {
    safeRadio(RADIO_DRONES);
    try {
      spawnDrone({ x: (player.pos?.x ?? 0) + 18, y: 12, z: (player.pos?.z ?? 0) - 24 }, true);
    } catch {}
  } else if (eventId === 'event_night_illum') {
    safeRadio(RADIO_NIGHT_ILLUM);
    const heroPos = MAP_NPC_ROSTERS[getCurrentMapId()]?.heroGunPos || player.pos;
    const baseX = heroPos?.x ?? 0;
    const baseZ = heroPos?.z ?? 0;
    for (let i = 0; i < INFILTRATOR_COUNT; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = baseX + side * INFILTRATOR_OFFSET_M;
      const y = getTerrainHeight(x, baseZ) + INFILTRATOR_HEIGHT_M;
      try {
        spawnDrone({ x, y, z: baseZ, enemyType: 'infiltrator', type: 'infiltrator' });
      } catch {}
    }
  }
  return eventsState;
}

export function interactStation(stationId) {
  if (stationId === 'generator' || stationId === 'jerrycan') {
    if (eventsState.activeCrisis !== 'event_generator_out' && runtime.mafikOnline !== false) {
      return false;
    }
    runtime.mafikOnline = true;
    eventsState.mafikOnline = true;
    setScenePointLightsDimmed(sceneRef, false);
    if (eventsState.activeCrisis === 'event_generator_out') {
      eventsState.activeCrisis = null;
      eventsState.crisisTimer = 0;
    }
    player.score = (player.score || 0) + GENERATOR_SCORE;
    addScoreAndMoney(GENERATOR_SCORE, GENERATOR_MONEY);
    refillReadiness('alertness', 100);
    safeToast(TOAST_GEN_FIXED);
    return true;
  }
  if (stationId === 'field_stove_table' || stationId === 'stove') {
    runtime.moraleBuffSec = STOVE_BUFF_SEC;
    eventsState.moraleBuffSec = STOVE_BUFF_SEC;
    refillReadiness('morale', 100);
    boostEnlistedTrustFromMeal();
    safeToast(TOAST_STOVE_READY);
    return true;
  }
  if (stationId === 'cot_folding' || stationId === 'dome_tent') {
    player.energy = 100;
    player.hydration = 100;
    refillReadiness('alertness', 100);
    safeToast(TOAST_COT_REST);
    return true;
  }
  return false;
}

export function getBatteryEventsState() {
  eventsState.mafikOnline = runtime.mafikOnline !== false;
  eventsState.moraleBuffSec = runtime.moraleBuffSec ?? 0;
  return eventsState;
}

export function updateBatteryEvents(dt, appContext) {
  if (appContext?.scene && appContext.scene !== sceneRef) {
    sceneRef = appContext.scene;
    clearLightingOriginals();
  }
  if ((runtime.moraleBuffSec ?? 0) > 0) {
    runtime.moraleBuffSec = Math.max(0, runtime.moraleBuffSec - dt);
  }
  eventsState.moraleBuffSec = runtime.moraleBuffSec ?? 0;
  if (eventsState.illumTimer > 0) {
    eventsState.illumTimer = Math.max(0, eventsState.illumTimer - dt);
    runtime.illumTimer = eventsState.illumTimer;
    if (eventsState.illumTimer <= 0) {
      eventsState.illumBoost = 0;
      runtime.illumBoost = 0;
      runtime.illumTimer = 0;
      clearSceneAmbientBoost(sceneRef);
      concealInfiltrators();
    } else {
      syncSceneAmbientBoost(sceneRef, eventsState.illumBoost);
      revealInfiltrators();
    }
  }
  const hasSentry = scanCrewState(dt, eventsState.activeCrisis, handleNpcGeneratorFix);
  if (eventsState.activeCrisis) {
    eventsState.crisisTimer = Math.max(0, eventsState.crisisTimer - dt);
    if (eventsState.crisisTimer <= 0) eventsState.activeCrisis = null;
  } else if (runtime.isPlaying) {
    crisisCooldown -= dt;
    if (crisisCooldown <= 0) {
      crisisCooldown = CRISIS_INTERVAL_SEC;
      let nextId = CRISIS_POOL[crisisIndex % CRISIS_POOL.length];
      crisisIndex += 1;
      if (nextId === 'event_night_illum' && getSkyPhase() !== 'night') {
        nextId = 'event_drone_swarm';
      }
      triggerCrisisEvent(nextId);
    }
  }
  updateBatteryReadiness(dt, getCurrentMapId(), hasSentry);
}
