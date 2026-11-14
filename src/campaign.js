import { EVENTS, MISSIONS } from './config.js';
import { CHAPTERS, ACHIEVEMENTS, RADIO_LINES } from './campaign-data.js';
import { MISSIONS_CH1_TO_3 } from './missions-ch1-3.js';
import { MISSIONS_CH4_TO_7 } from './missions-ch4-7.js';
import { save, player, runtime, addScoreAndMoney, advanceDay, writeSave, emit, on } from './state.js';
import { completeMission } from './missions.js';
import {
  createObjectiveState,
  getActiveMissionRunner,
  setActiveMissionRunner,
  setMissionCompleteHandler,
  completeActiveMission,
  resetActiveMissionObjectives,
  resetObjectiveTelemetry,
  updateObjectiveTelemetry,
  getLeafState,
  getCampaignObjectiveState,
  updateCampaignObjectives,
  handleCampaignInteract,
  onCampaignArtilleryImpact
} from './campaign-objectives.js';
import { createCampaignUi } from './campaign-ui.js';

export { getCampaignObjectiveState, updateCampaignObjectives, handleCampaignInteract, onCampaignArtilleryImpact };

export const ALL_CAMPAIGN_MISSIONS = { ...MISSIONS, ...MISSIONS_CH1_TO_3, ...MISSIONS_CH4_TO_7 };

const M1_IDS = new Set(['base', 'range', 'doher_salvo', 'roem_rapid', 'rokhash_recon', 'mafik_radar', 'patrol']);

let boundMissionsApi = null;
let listenersBound = false;

setMissionCompleteHandler((id) => {
  if (boundMissionsApi?.completeMission) boundMissionsApi.completeMission(id);
  else completeMission(id);
});

const campaignUi = createCampaignUi({
  isChapterUnlocked,
  isChapterCompleted,
  getChapterMissions,
  setActiveChapter,
  startCampaignMission,
  skipCommandersCourse
});

function evName(key, fallback) {
  return EVENTS[key] || fallback;
}

function getActiveRoleId() {
  return save.role || save.profile?.roleId || 'doher';
}

function resolveChapterId(chapterId) {
  if (!chapterId || typeof chapterId !== 'string') return null;
  const ch = CHAPTERS.find((c) => c.id === chapterId || c.id.startsWith(`${chapterId}_`));
  return ch ? ch.id : null;
}

function ensureCampaignSave() {
  if (!save.chapterId) save.chapterId = 'ch1_bakum';
  if (!save.activeMissionId) save.activeMissionId = 'ch1_m1_bakum_gear';
  if (typeof save.commandCourseSkipped !== 'boolean') save.commandCourseSkipped = false;
  if (typeof save.discharged !== 'boolean') save.discharged = false;
  if (!save.stats) {
    save.stats = { dronesKilled: 0, fireMissionsCalled: 0, nightMissionsDone: 0, rolesPlayed: [getActiveRoleId()] };
  }
  if (!save.achievements) save.achievements = {};
  if (!save.ceremonies) save.ceremonies = { turquoiseBeret: false, fighterPin: false };
  if (typeof save.ceremonies.swearingIn !== 'boolean') save.ceremonies.swearingIn = false;
  if (typeof save.ceremonies.commanderPin !== 'boolean') save.ceremonies.commanderPin = false;
  if (typeof runtime.timeOfDay !== 'number') runtime.timeOfDay = 7.5;
  if (typeof runtime.activeObjectiveIdx !== 'number') runtime.activeObjectiveIdx = 0;
  if (typeof runtime.objectiveProgress !== 'number') runtime.objectiveProgress = 0;
  if (typeof runtime.objectiveTimer !== 'number') runtime.objectiveTimer = 0;
  if (typeof runtime.stealthAlertTimer !== 'number') runtime.stealthAlertTimer = 0;
  if (typeof runtime.campaignModalOpen !== 'boolean') runtime.campaignModalOpen = false;
}

export function getChapterMissions(chapterId, roleId = getActiveRoleId()) {
  const resolvedId = resolveChapterId(chapterId);
  if (!resolvedId) return [];
  return Object.values(ALL_CAMPAIGN_MISSIONS)
    .filter((m) => m.chapterId === resolvedId && (m.roleId === 'all' || m.roleId == null || m.roleId === roleId))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function isChapterCompleted(chapterId, roleId = getActiveRoleId()) {
  const missions = getChapterMissions(chapterId, roleId);
  if (!missions.length) return false;
  return missions.every((m) => Boolean(save.completed?.[m.id]));
}

function isChapterUnlocked(chapterId) {
  if (chapterId === 'ch1_bakum') return true;
  if (chapterId === 'ch2_tironut') return isChapterCompleted('ch1_bakum') || save.day >= 15;
  if (chapterId === 'ch3_mikzoi') return isChapterCompleted('ch2_tironut') || save.day >= 91;
  if (chapterId === 'ch4_mitkadem') return isChapterCompleted('ch3_mikzoi') || save.day >= 166;
  if (chapterId === 'ch5_kav') return isChapterCompleted('ch4_mitkadem') || save.day >= 241;
  if (chapterId === 'ch6_mefakzim') return isChapterCompleted('ch5_kav') || save.day >= 481;
  if (chapterId === 'ch7_shihrur') {
    return isChapterCompleted('ch6_mefakzim') || save.commandCourseSkipped || save.day >= 661;
  }
  return false;
}

function syncHudBadges() {
  const ch = CHAPTERS.find((c) => c.id === save.chapterId) || CHAPTERS[0];
  const badge = document.getElementById('chapter-badge');
  if (badge) badge.textContent = ch.title;
  const dayEl = document.getElementById('day-text');
  if (dayEl) dayEl.textContent = `יום ${save.day}`;
}

function reconcileCampaignProgression(persist = false) {
  ensureCampaignSave();
  const prevChapter = save.chapterId;
  const prevRank = save.rankId;
  const prevDay = save.day;
  const prevActive = save.activeMissionId;
  const prevDischarged = save.discharged;
  const chain = ['ch1_bakum', 'ch2_tironut', 'ch3_mikzoi', 'ch4_mitkadem', 'ch5_kav', 'ch6_mefakzim', 'ch7_shihrur'];

  for (let i = 0; i < chain.length - 1; i++) {
    const cid = chain[i];
    const nextCid = chain[i + 1];
    if (!isChapterCompleted(cid)) continue;
    const nextCh = CHAPTERS.find((c) => c.id === nextCid);
    if (cid === 'ch2_tironut') {
      save.ceremonies.turquoiseBeret = true;
      save.ceremonies.swearingIn = true;
    }
    if (cid === 'ch4_mitkadem') {
      save.ceremonies.fighterPin = true;
      if (save.rankId === 'turai') save.rankId = 'rabat';
    }
    if (cid === 'ch5_kav' && save.rankId !== 'samar') save.rankId = 'samal';
    if (cid === 'ch6_mefakzim') save.ceremonies.commanderPin = true;
    const targetCid = cid === 'ch5_kav' && save.commandCourseSkipped ? 'ch7_shihrur' : nextCid;
    const targetCh = CHAPTERS.find((c) => c.id === targetCid);
    if (targetCh && save.day < targetCh.minDay) save.day = targetCh.minDay;
    if (save.chapterId === cid) save.chapterId = targetCid;
    if (nextCh && save.chapterId === 'ch6_mefakzim' && save.commandCourseSkipped) save.chapterId = 'ch7_shihrur';
  }

  if (save.completed?.ch7_m6_bakum_discharge) {
    save.day = Math.max(save.day, 840);
    save.discharged = true;
    save.rankId = 'samar';
  }

  const chMissions = getChapterMissions(save.chapterId);
  if (!chMissions.some((m) => m.id === save.activeMissionId)) {
    const pending = chMissions.find((m) => !save.completed?.[m.id]) || chMissions[0];
    if (pending) save.activeMissionId = pending.id;
  }

  const achUnlocked = checkAndUnlockAchievements(persist);
  syncHudBadges();
  const changed = save.chapterId !== prevChapter || save.rankId !== prevRank || save.day !== prevDay || save.activeMissionId !== prevActive || save.discharged !== prevDischarged;
  if (persist && changed && !achUnlocked) writeSave();
  if (save.chapterId !== prevChapter) {
    const ch = CHAPTERS.find((c) => c.id === save.chapterId);
    emit(evName('CHAPTER_CHANGED', 'campaign:chapter_changed'), { chapterId: save.chapterId, title: ch?.title || '' });
  }
}

export function checkAndUnlockAchievements(persist = true) {
  ensureCampaignSave();
  const checks = {
    ach_enlisted: () => isChapterCompleted('ch1_bakum'),
    ach_turai_beret: () => isChapterCompleted('ch2_tironut') || Boolean(save.ceremonies?.turquoiseBeret),
    ach_sharpshooter: () => Boolean(save.completed?.range && save.completed?.ch2_m6_night_range),
    ach_specialist: () => isChapterCompleted('ch3_mikzoi'),
    ach_fighter_pin: () => isChapterCompleted('ch4_mitkadem') || Boolean(save.ceremonies?.fighterPin),
    ach_kav_veteran: () => isChapterCompleted('ch5_kav'),
    ach_commander_pin: () => isChapterCompleted('ch6_mefakzim') || Boolean(save.ceremonies?.commanderPin),
    ach_drone_hunter: () => (save.stats?.dronesKilled || 0) >= 10,
    ach_fire_lord: () => (save.stats?.fireMissionsCalled || 0) >= 5,
    ach_geared_up: () => Object.values(save.gear || {}).filter(Boolean).length >= 4,
    ach_veteran_samar: () => save.rankId === 'samar' || save.day >= 720,
    ach_honorable_discharge: () => Boolean(save.discharged || save.completed?.ch7_m6_bakum_discharge)
  };

  let unlockedAny = false;
  for (const ach of ACHIEVEMENTS) {
    if (save.achievements[ach.id]) continue;
    const fn = checks[ach.id];
    if (fn && fn()) {
      save.achievements[ach.id] = true;
      unlockedAny = true;
      if (persist) addScoreAndMoney(ach.rewardScore || 0, ach.rewardMoney || 0);
      emit(evName('ACHIEVEMENT_UNLOCKED', 'campaign:achievement'), { id: ach.id, title: ach.title });
      emit(EVENTS.TOAST, { message: `עיטור חדש: ${ach.icon} ${ach.title}! (+${ach.rewardMoney} ₪)`, duration: 3800 });
    }
  }
  if (persist && unlockedAny) writeSave();
  return unlockedAny;
}

export function setActiveChapter(chapterId) {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (!ch || !isChapterUnlocked(chapterId)) return false;
  save.chapterId = chapterId;
  const list = getChapterMissions(chapterId);
  const next = list.find((m) => !save.completed?.[m.id]) || list[0];
  if (next) save.activeMissionId = next.id;
  syncHudBadges();
  writeSave();
  emit(evName('CHAPTER_CHANGED', 'campaign:chapter_changed'), { chapterId, title: ch.title });
  if (next) startCampaignMission(next.id);
  return true;
}

export function skipCommandersCourse() {
  ensureCampaignSave();
  save.commandCourseSkipped = true;
  save.chapterId = 'ch7_shihrur';
  if (save.day < 661) save.day = 661;
  save.activeMissionId = 'ch7_m1_mentor_recruits';
  const ch7 = CHAPTERS.find((c) => c.id === 'ch7_shihrur');
  syncHudBadges();
  writeSave();
  emit(evName('CHAPTER_CHANGED', 'campaign:chapter_changed'), { chapterId: 'ch7_shihrur', title: ch7?.title || '' });
  emit(EVENTS.TOAST, { message: 'דילגת על קורס המפק"ץ ועברת לסבב הקו המסכם (פרק 7).', duration: 3600 });
  startCampaignMission('ch7_m1_mentor_recruits');
  if (runtime.campaignModalOpen) campaignUi.renderCampaignModal('ch7_shihrur');
}

export function startCampaignMission(missionId) {
  const m = ALL_CAMPAIGN_MISSIONS[missionId];
  if (!m) return false;
  ensureCampaignSave();
  save.activeMissionId = missionId;
  if (m.chapterId && isChapterUnlocked(m.chapterId)) save.chapterId = m.chapterId;
  if (typeof m.forceTimeOfDay === 'number') runtime.timeOfDay = m.forceTimeOfDay;
  player.carryingType = null;
  const runner = M1_IDS.has(missionId) ? null : { mission: m, states: (m.objectives || []).map(createObjectiveState), completed: false };
  setActiveMissionRunner(runner);
  runtime.stealthAlertTimer = 0;
  syncHudBadges();
  if (runner) updateObjectiveTelemetry(runner, true);
  const line = RADIO_LINES.missionStart[Math.floor(Math.random() * RADIO_LINES.missionStart.length)];
  emit(evName('RADIO_MESSAGE', 'ui:radio'), { speaker: 'מפי"ק 409', text: line, duration: 4200 });
  emit(EVENTS.TOAST, { message: `משימה פעילה: ${m.title}`, duration: 3200 });
  writeSave();
  return true;
}

export function completeCurrentCampaignMission() {
  return completeActiveMission();
}

export function openCampaignModal() {
  campaignUi.openCampaignModal();
}

export function closeCampaignModal() {
  campaignUi.closeCampaignModal();
}

export function initCampaign(missionsApi = null) {
  boundMissionsApi = missionsApi;
  resetObjectiveTelemetry();
  Object.assign(MISSIONS, MISSIONS_CH1_TO_3, MISSIONS_CH4_TO_7);
  ensureCampaignSave();
  campaignUi.ensureCampaignModalDOM();
  reconcileCampaignProgression(false);

  if (!listenersBound) {
    listenersBound = true;

    on(EVENTS.MISSION_COMPLETED, (p) => {
      const m = ALL_CAMPAIGN_MISSIONS[p?.missionId];
      if (m && p?.firstTime) {
        if (m.targetDay) save.day = Math.max(save.day, m.targetDay);
        else if ((m.daysAdvance || 1) > 1) advanceDay(m.daysAdvance - 1);
      }
      if (m?.unlocks?.ceremony) {
        save.ceremonies[m.unlocks.ceremony] = true;
        emit(EVENTS.CEREMONY_UNLOCKED, { type: m.unlocks.ceremony, title: m.title });
      }
      if (m?.unlocks?.swearingIn) save.ceremonies.swearingIn = true;
      const isDischarge = p?.missionId === 'ch7_m6_bakum_discharge';
      const nextM = isDischarge ? null : getChapterMissions(save.chapterId).find((x) => !save.completed?.[x.id]);
      reconcileCampaignProgression(isDischarge || !nextM);
      if (isDischarge) {
        emit(evName('SERVICE_DISCHARGED', 'campaign:discharged'), { save });
      } else if (nextM) {
        startCampaignMission(nextM.id);
      }
    });

    on(EVENTS.RANGE_HIT, () => {
      const runner = getActiveMissionRunner();
      if (!runner) return;
      const leaf = runner.states.map(getLeafState).find((s) => s?.def.type === 'shoot-targets');
      if (!leaf) return;
      leaf.progress += 1;
      if (leaf.progress >= leaf.def.targetCount) {
        leaf.done = true;
        runtime.rangeActive = false;
        runtime.roemRapidActive = false;
      }
      updateObjectiveTelemetry(runner, true);
      if (runner.states.every((s) => s.done)) completeActiveMission();
      else writeSave();
    });

    on(EVENTS.DRONE_DESTROYED, (payload) => {
      if (payload?.isTransmitter || payload?.kind === 'transmitter') return;
      save.stats.dronesKilled = (save.stats.dronesKilled || 0) + 1;
      const runner = getActiveMissionRunner();
      if (runner) {
        const leaf = runner.states.map(getLeafState).find((s) => s?.def.type === 'destroy-drones');
        if (leaf) {
          leaf.progress += 1;
          if (leaf.progress >= leaf.def.targetCount) leaf.done = true;
          updateObjectiveTelemetry(runner, true);
          if (runner.states.every((s) => s.done)) completeActiveMission();
          else writeSave();
        }
      }
      checkAndUnlockAchievements(true);
    });

    on(evName('FIRE_SUPPORT_IMPACT', 'fire:impact'), (p) => {
      save.stats.fireMissionsCalled = (save.stats.fireMissionsCalled || 0) + 1;
      onCampaignArtilleryImpact(p?.x || 0, p?.z || 0, p?.shellType || 'he');
      checkAndUnlockAchievements(true);
    });

    on(EVENTS.PLAYER_RESPAWNED, () => {
      resetActiveMissionObjectives();
    });

    on(EVENTS.ROLE_CHANGED, () => {
      const rid = getActiveRoleId();
      if (!save.stats.rolesPlayed.includes(rid)) save.stats.rolesPlayed.push(rid);
      reconcileCampaignProgression(true);
    });
  }

  if (save.activeMissionId && !M1_IDS.has(save.activeMissionId)) {
    const m = ALL_CAMPAIGN_MISSIONS[save.activeMissionId];
    if (m) setActiveMissionRunner({ mission: m, states: (m.objectives || []).map(createObjectiveState), completed: false });
  }
}
