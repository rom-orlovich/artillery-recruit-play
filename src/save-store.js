import { SAVE_KEY, DEFAULT_SAVE, EVENTS, RANKS } from './config.js';
import { emit, player, runtime } from './state.js';

export const LEGACY_M1_ID_MAP = Object.freeze({
  m1_doher: 'ch2_role_doher_fire',
  doher_intro: 'ch2_role_doher_fire',
  battery_doher: 'ch2_role_doher_fire',
  m1_mafik: 'ch2_role_mafik_compute',
  mafik_intro: 'ch2_role_mafik_compute',
  battery_mafik: 'ch2_role_mafik_compute',
  m1_mlrs: 'ch2_role_mlrs_salvo',
  mlrs_intro: 'ch2_role_mlrs_salvo',
  battery_mlrs: 'ch2_role_mlrs_salvo',
  m1_rochev: 'ch2_role_rochev_recon',
  rochev_intro: 'ch2_role_rochev_recon',
  battery_rochev: 'ch2_role_rochev_recon'
});

const CAMPAIGN_SAVE_DEFAULTS = {
  chapterId: 'ch1_bakum',
  activeMissionId: null,
  commandCourseSkipped: false,
  discharged: false,
  stats: {
    dronesKilled: 0,
    fireMissionsCalled: 0,
    nightMissionsDone: 0,
    rolesPlayed: ['doher']
  },
  gear: {
    earplugs: false,
    boots: false,
    bipod: false,
    nvg: false,
    laser_binoc: false,
    flak_plates: false,
    coffee_kit: false
  },
  ceremonies: {
    swearingIn: false,
    commanderPin: false
  },
  achievements: {}
};

const DEFAULT_MISSION_STATE = {
  activeMissionId: null,
  activeStepIndex: 0,
  subStepIndex: 0,
  progressCount: 0,
  visitedPointIds: [],
  holdElapsedSec: 0,
  timerRemainingSec: null,
  completedIds: [],
  dailyCompletions: {},
  onboardingDone: false
};

export function attachRoleAlias(targetSave) {
  if (!targetSave || typeof targetSave !== 'object') return targetSave;
  const desc = Object.getOwnPropertyDescriptor(targetSave, 'role');
  if (!desc || !desc.get) {
    Object.defineProperty(targetSave, 'role', {
      enumerable: true,
      configurable: true,
      get() {
        return targetSave.profile?.roleId || 'doher';
      },
      set(nextRole) {
        if (!targetSave.profile || typeof targetSave.profile !== 'object') {
          targetSave.profile = { name: 'יואב', roleId: 'doher', battalion: 'גדוד 409 "בזלת"' };
        }
        if (typeof nextRole === 'string' && nextRole) {
          targetSave.profile.roleId = nextRole;
        }
      }
    });
  }
  return targetSave;
}

export function getRankIndex(rankIdOrName) {
  if (!rankIdOrName) return -1;
  return RANKS.findIndex((r) => r.id === rankIdOrName || r.name === rankIdOrName);
}

export function cloneDefault() {
  const base = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  const initialRank = RANKS.find((r) => r.id === base.rankId) || RANKS[0];
  const obj = {
    ...base,
    rank: initialRank.name,
    chapterId: CAMPAIGN_SAVE_DEFAULTS.chapterId,
    activeMissionId: CAMPAIGN_SAVE_DEFAULTS.activeMissionId,
    commandCourseSkipped: CAMPAIGN_SAVE_DEFAULTS.commandCourseSkipped,
    discharged: CAMPAIGN_SAVE_DEFAULTS.discharged,
    stats: JSON.parse(JSON.stringify(CAMPAIGN_SAVE_DEFAULTS.stats)),
    gear: { ...CAMPAIGN_SAVE_DEFAULTS.gear, ...(base.gear || {}) },
    ceremonies: { ...CAMPAIGN_SAVE_DEFAULTS.ceremonies, ...(base.ceremonies || {}) },
    achievements: {},
    missionState: JSON.parse(JSON.stringify(DEFAULT_MISSION_STATE))
  };
  return attachRoleAlias(obj);
}

function mapLegacyMissionId(id) {
  if (typeof id !== 'string' || !id) return null;
  return LEGACY_M1_ID_MAP[id] || id;
}

export function migrateSaveData(rawSave) {
  const base = cloneDefault();
  if (!rawSave || typeof rawSave !== 'object') return base;

  const parsedStats = rawSave.stats && typeof rawSave.stats === 'object' ? rawSave.stats : {};
  const parsedAch = rawSave.achievements && typeof rawSave.achievements === 'object' && !Array.isArray(rawSave.achievements)
    ? rawSave.achievements
    : {};
  const parsedProfile = rawSave.profile && typeof rawSave.profile === 'object' ? rawSave.profile : {};
  const resolvedRoleId = parsedProfile.roleId || rawSave.role || base.profile.roleId;
  const rolesPlayed = Array.isArray(parsedStats.rolesPlayed) && parsedStats.rolesPlayed.length
    ? parsedStats.rolesPlayed
    : [resolvedRoleId];

  const completedMap = { ...base.completed };
  const completedSet = new Set();
  const addCompleted = (rawId) => {
    const mapped = mapLegacyMissionId(rawId);
    if (!mapped) return;
    completedSet.add(mapped);
    completedMap[mapped] = true;
  };

  if (Array.isArray(rawSave.completed)) {
    for (const id of rawSave.completed) addCompleted(id);
  } else if (rawSave.completed && typeof rawSave.completed === 'object') {
    for (const [id, val] of Object.entries(rawSave.completed)) {
      if (val) addCompleted(id);
    }
  }
  if (Array.isArray(rawSave.completedMissions)) {
    for (const id of rawSave.completedMissions) addCompleted(id);
  } else if (rawSave.completedMissions && typeof rawSave.completedMissions === 'object') {
    for (const [id, val] of Object.entries(rawSave.completedMissions)) {
      if (val) addCompleted(id);
    }
  }
  if (Array.isArray(rawSave.campaign?.completedIds)) {
    for (const id of rawSave.campaign.completedIds) addCompleted(id);
  }
  if (Array.isArray(rawSave.missionState?.completedIds)) {
    for (const id of rawSave.missionState.completedIds) addCompleted(id);
  }

  const rawActive = rawSave.missionState?.activeMissionId ?? rawSave.activeMissionId ?? rawSave.campaign?.activeMissionId ?? null;
  const activeMissionId = rawActive ? mapLegacyMissionId(rawActive) : null;

  const rawMs = rawSave.missionState && typeof rawSave.missionState === 'object' ? rawSave.missionState : {};
  const missionState = {
    activeMissionId,
    activeStepIndex: Number.isInteger(rawMs.activeStepIndex) && rawMs.activeStepIndex >= 0 ? rawMs.activeStepIndex : 0,
    subStepIndex: Number.isInteger(rawMs.subStepIndex) && rawMs.subStepIndex >= 0 ? rawMs.subStepIndex : 0,
    progressCount: typeof rawMs.progressCount === 'number' && rawMs.progressCount >= 0 ? rawMs.progressCount : 0,
    visitedPointIds: Array.isArray(rawMs.visitedPointIds) ? [...new Set(rawMs.visitedPointIds.filter((x) => typeof x === 'string'))] : [],
    holdElapsedSec: typeof rawMs.holdElapsedSec === 'number' && rawMs.holdElapsedSec >= 0 ? rawMs.holdElapsedSec : 0,
    timerRemainingSec: typeof rawMs.timerRemainingSec === 'number' && rawMs.timerRemainingSec >= 0 ? rawMs.timerRemainingSec : null,
    completedIds: Array.from(completedSet),
    dailyCompletions: rawMs.dailyCompletions && typeof rawMs.dailyCompletions === 'object' && !Array.isArray(rawMs.dailyCompletions)
      ? { ...rawMs.dailyCompletions }
      : {},
    onboardingDone: Boolean(rawMs.onboardingDone)
  };

  const rankId = typeof rawSave.rankId === 'string' && rawSave.rankId ? rawSave.rankId : base.rankId;
  const matchedRank = RANKS.find((r) => r.id === rankId || r.name === rawSave.rank);
  const rankName = typeof rawSave.rank === 'string' && rawSave.rank
    ? rawSave.rank
    : (matchedRank ? matchedRank.name : base.rank);

  const migrated = {
    ...base,
    ...rawSave,
    rankId: matchedRank && !rawSave.rankId ? matchedRank.id : rankId,
    rank: rankName,
    chapterId: rawSave.chapterId || base.chapterId,
    activeMissionId,
    commandCourseSkipped: typeof rawSave.commandCourseSkipped === 'boolean' ? rawSave.commandCourseSkipped : base.commandCourseSkipped,
    discharged: typeof rawSave.discharged === 'boolean' ? rawSave.discharged : base.discharged,
    profile: { ...base.profile, ...parsedProfile, roleId: resolvedRoleId },
    gear: { ...base.gear, ...(rawSave.gear || {}) },
    ceremonies: { ...base.ceremonies, ...(rawSave.ceremonies || {}) },
    completed: completedMap,
    stats: { ...base.stats, ...parsedStats, rolesPlayed },
    achievements: { ...base.achievements, ...parsedAch },
    missionState
  };
  return attachRoleAlias(migrated);
}

let flushScheduled = false;
let batchDepth = 0;
let lastSavedJson = null;

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const fresh = cloneDefault();
      lastSavedJson = JSON.stringify(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    const migrated = migrateSaveData(parsed);
    lastSavedJson = JSON.stringify(migrated);
    return migrated;
  } catch {
    const fallback = cloneDefault();
    lastSavedJson = JSON.stringify(fallback);
    return fallback;
  }
}

export let save = loadSave();

function performFlush() {
  flushScheduled = false;
  if (batchDepth > 0) return;
  let serialized = '';
  try {
    serialized = JSON.stringify(save);
  } catch {
    return;
  }
  if (serialized === lastSavedJson) {
    runtime.saveDirty = false;
    return;
  }
  try {
    localStorage.setItem(SAVE_KEY, serialized);
    lastSavedJson = serialized;
    runtime.saveDirty = false;
  } catch {}
  emit(EVENTS.STATE_CHANGED, { save, player, runtime });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    if (runtime.saveDirty) performFlush();
  });
}

export function flushSave() {
  performFlush();
}

export function beginSaveBatch() {
  batchDepth += 1;
}

export function endSaveBatch() {
  if (batchDepth > 0) batchDepth -= 1;
  if (batchDepth === 0 && runtime.saveDirty) {
    performFlush();
  }
}

export function writeSave(options = {}) {
  runtime.saveDirty = true;
  if (options && options.immediate && batchDepth === 0) {
    performFlush();
    return;
  }
  if (batchDepth > 0 || flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    if (flushScheduled) performFlush();
  });
}
