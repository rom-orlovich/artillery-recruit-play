import { EVENTS, RANKS, ROLES } from './config.js';
import {
  save,
  LEGACY_M1_ID_MAP,
  migrateSaveData,
  loadSave,
  flushSave,
  beginSaveBatch,
  endSaveBatch,
  writeSave,
  attachRoleAlias,
  cloneDefault,
  getRankIndex
} from './save-store.js';

export {
  save,
  LEGACY_M1_ID_MAP,
  migrateSaveData,
  loadSave,
  flushSave,
  beginSaveBatch,
  endSaveBatch,
  writeSave
};

const listeners = new Map();

export function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  const set = listeners.get(eventName);
  if (set) set.delete(handler);
}

export function emit(eventName, payload = {}) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const fn of set) {
    fn(payload);
  }
}

function detectMobile() {
  if (typeof window === 'undefined') return false;
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 900;
}

export const player = {
  pos: { x: 0, y: 0, z: 18 },
  velY: 0,
  onGround: true,
  yaw: 0,
  pitch: 0,
  hp: save.gear.shluker ? 125 : 100,
  maxHp: save.gear.shluker ? 125 : 100,
  radius: 0.48,
  eyeHeight: 1.7,
  carryingType: null,
  energy: 100,
  hydration: 100,
  inVehicle: null
};

export const runtime = {
  isPlaying: false,
  isMobile: detectMobile(),
  isDead: false,
  paused: false,
  modalOpen: false,
  titleActive: false,
  saveDirty: false,
  shopOpen: false,
  enlistOpen: false,
  sandbagsPlaced: save.completed.base ? 5 : 0,
  rangeActive: false,
  rangeTimeLeft: 60,
  rangeHits: 0,
  shellsLoaded: 0,
  roemNodesCalibrated: 0,
  roemRapidActive: false,
  roemRapidTimeLeft: 45,
  roemRapidHits: 0,
  uavLaunched: false,
  transmittersDestroyed: 0,
  radarCalibrated: 0,
  radarWaveActive: false,
  radarDronesKilled: 0,
  patrolActive: false,
  patrolStep: 0,
  shootCooldown: 0,
  recoil: 0,
  muzzleTimer: 0,
  bobTime: 0,
  abilityCooldownLeft: 0,
  abilityActiveLeft: 0,
  droneSpawnTimer: 1.5,
  timeOfDay: 7.5,
  nvgActive: false,
  fireMapOpen: false,
  campaignModalOpen: false,
  dischargeModalOpen: false,
  fireSupportCooldown: 0,
  selectedShellType: 'he',
  activeObjectiveIdx: 0,
  objectiveProgress: 0,
  objectiveTimer: 0,
  stealthAlertTimer: 0
};

export function resetSave() {
  const fresh = cloneDefault();
  for (const key of Object.keys(save)) delete save[key];
  Object.assign(save, fresh);
  attachRoleAlias(save);

  player.pos.x = 0;
  player.pos.y = 0;
  player.pos.z = 18;
  player.velY = 0;
  player.onGround = true;
  player.yaw = 0;
  player.pitch = 0;
  player.maxHp = 100;
  player.hp = 100;
  player.carryingType = null;
  player.energy = 100;
  player.hydration = 100;
  player.inVehicle = null;

  Object.assign(runtime, {
    isDead: false,
    paused: false,
    modalOpen: false,
    shopOpen: false,
    sandbagsPlaced: 0,
    rangeActive: false,
    rangeTimeLeft: 60,
    rangeHits: 0,
    shellsLoaded: 0,
    roemNodesCalibrated: 0,
    roemRapidActive: false,
    roemRapidTimeLeft: 45,
    roemRapidHits: 0,
    uavLaunched: false,
    transmittersDestroyed: 0,
    radarCalibrated: 0,
    radarWaveActive: false,
    radarDronesKilled: 0,
    patrolActive: false,
    patrolStep: 0,
    shootCooldown: 0,
    recoil: 0,
    muzzleTimer: 0,
    bobTime: 0,
    abilityCooldownLeft: 0,
    abilityActiveLeft: 0,
    droneSpawnTimer: 1.5,
    timeOfDay: 7.5,
    nvgActive: false,
    fireMapOpen: false,
    campaignModalOpen: false,
    dischargeModalOpen: false,
    fireSupportCooldown: 0,
    selectedShellType: 'he',
    activeObjectiveIdx: 0,
    objectiveProgress: 0,
    objectiveTimer: 0,
    stealthAlertTimer: 0
  });

  syncDerivedStats();
  writeSave({ immediate: true });
  return save;
}

export function getCurrentRole() {
  return ROLES[save.profile.roleId] || ROLES.doher;
}

export function getCurrentRank() {
  let scoreIdx = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (save.score >= RANKS[i].minScore) scoreIdx = i;
  }
  const idIdx = getRankIndex(save.rankId);
  const nameIdx = getRankIndex(save.rank);
  const savedIdx = Math.max(idIdx, nameIdx);

  if (save.rank && nameIdx === -1 && save.rank !== RANKS[0].name) {
    return {
      id: save.rankId || 'custom',
      name: save.rank,
      minScore: 0,
      bonus: 0
    };
  }
  if (savedIdx >= scoreIdx) {
    return RANKS[nameIdx >= idIdx && nameIdx !== -1 ? nameIdx : idIdx] || RANKS[0];
  }
  return RANKS[scoreIdx] || RANKS[0];
}

export function addScoreAndMoney(scoreDelta = 0, moneyDelta = 0, options = {}) {
  const oldRank = getCurrentRank();
  const oldIdx = Math.max(0, getRankIndex(oldRank.id), getRankIndex(oldRank.name));
  save.score = Math.max(0, save.score + scoreDelta);
  save.money = Math.max(0, save.money + moneyDelta);

  let scoreIdx = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (save.score >= RANKS[i].minScore) scoreIdx = i;
  }

  const isCustomRank = Boolean(save.rank && getRankIndex(save.rank) === -1);
  if (!isCustomRank && scoreIdx > oldIdx) {
    const newRank = RANKS[scoreIdx];
    save.rankId = newRank.id;
    save.rank = newRank.name;
    if (newRank.bonus > 0) save.money += newRank.bonus;
    emit(EVENTS.RANK_PROMOTED, { oldRank, newRank, bonusMoney: newRank.bonus });
  } else if (!isCustomRank) {
    save.rankId = oldRank.id;
    save.rank = oldRank.name;
  }

  const completedCount = Object.values(save.completed).filter(Boolean).length;
  if (!save.ceremonies.turquoiseBeret && completedCount >= 2) {
    save.ceremonies.turquoiseBeret = true;
    emit(EVENTS.CEREMONY_UNLOCKED, { type: 'turquoiseBeret', title: 'הוענקה כומתת הטורקיז!' });
  }
  if (!save.ceremonies.fighterPin && (save.rankId !== 'turai' || completedCount >= 3)) {
    save.ceremonies.fighterPin = true;
    emit(EVENTS.CEREMONY_UNLOCKED, { type: 'fighterPin', title: 'הוענקה סיכת לוחם תותחנים!' });
  }

  if (!options?.deferSave) writeSave();
}

export function advanceDay(days = 1, options = {}) {
  save.day += days;
  if (!options?.deferSave) writeSave();
}

export function getDamageMultiplier() {
  const role = getCurrentRole();
  let reduction = 0;
  if (save.gear.helmet) reduction += 0.25;
  if (save.gear.vest) reduction += 0.4;
  reduction += role.modifiers.droneDamageReduction || 0;
  if (save.profile.roleId === 'rokhash' && runtime.abilityActiveLeft > 0) {
    reduction += 0.35;
  }
  return Math.max(0.2, 1 - reduction);
}

export function getSpeedMultiplier() {
  const role = getCurrentRole();
  let mult = save.gear.shluker ? 1.15 : 1.0;
  if (player.carryingType) {
    mult *= save.profile.roleId === 'doher' ? role.modifiers.carrySpeedMult : 0.85;
  }
  return mult;
}

export function syncDerivedStats() {
  player.maxHp = save.gear.shluker ? 125 : 100;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}
