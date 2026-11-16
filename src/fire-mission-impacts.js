import { player, runtime, addScoreAndMoney } from './state.js';
import { showRadio, showToast, showHitMarker } from './hud.js';
import { spawnParticles, applyDamage } from './combat.js';
import { activateIllumination } from './battery-events.js';
import { computeImpactErrorM } from './fire-mission-guns.js';

const HIT_RADIUS_M = 25;
const STREAK_WINDOW_SEC = 12;
const MAX_STREAK = 5;
const BASE_HIT_SCORE = 100;
const ILLUM_DURATION_SEC = 25;
const ILLUM_BOOST_AMOUNT = 0.35;
const MRSI_HIT_SCORE = 60;
const MRSI_HIT_MONEY = 15;
const SCOOT_BONUS_MONEY = 25;
const IMPACT_PARTICLE_COUNT = 12;
const HIT_MONEY_RATIO = 0.25;
const STREAK_MULTIPLIERS = [1, 1, 1.25, 1.5, 2.0, 3.0];

const RADIO_MSG_HIT = 'קש"א יעל: פגיעה במטרה! המשך ירי.';
const RADIO_MSG_MISS = 'קש"א יעל: סטייה מהמטרה, תקן צידוד.';
const RADIO_MSG_ILLUM = 'פגז תאורה נפתח מעל הגזרה!';

const impactVec = { x: 0, y: 0, z: 0 };

export function awardMissionScore(points, money) {
  player.score = (player.score || 0) + points;
  addScoreAndMoney(points, money);
}

export function awardScootBonus(points) {
  awardMissionScore(points, SCOOT_BONUS_MONEY);
}

export function applyCounterBatteryDamage(dmg) {
  try { applyDamage(dmg, null, player.pos); } catch { player.hp = Math.max(0, player.hp - dmg); }
}

export function safeRadio(text) {
  try { showRadio(text); } catch {}
}

export function safeToast(text) {
  try { showToast(text); } catch {}
}

export function spawnImpactParticles(sceneRef, x, y, z, color) {
  if (!sceneRef) return;
  impactVec.x = x;
  impactVec.y = y;
  impactVec.z = z;
  try { spawnParticles(sceneRef, impactVec, color, IMPACT_PARTICLE_COUNT); } catch {}
}

export function resolveMrsiImpact(shot, loopState, sceneRef) {
  loopState.impactCount += 1;
  spawnImpactParticles(sceneRef, shot.targetX, shot.targetY + 1, shot.targetZ, 0xff9933);
  if (loopState.activeMission) {
    awardMissionScore(MRSI_HIT_SCORE, MRSI_HIT_MONEY);
  }
}

export function resolveStandardShellImpact(shell, gunOrigin, loopState, simTimeSec, sceneRef) {
  loopState.impactCount += 1;
  spawnImpactParticles(sceneRef, shell.targetX, shell.targetY + 1, shell.targetZ, 0xffaa33);
  if (shell.shellType === 'illum') {
    activateIllumination(ILLUM_DURATION_SEC, ILLUM_BOOST_AMOUNT);
    safeToast(RADIO_MSG_ILLUM);
    return;
  }
  const errorM = computeImpactErrorM(shell, gunOrigin);
  loopState.lastErrorM = errorM;
  if (errorM <= HIT_RADIUS_M) {
    const inWindow = loopState.lastShotHit && loopState.lastHitTime >= 0 && (simTimeSec - loopState.lastHitTime) <= STREAK_WINDOW_SEC;
    const nextStreak = inWindow ? Math.min(MAX_STREAK, (runtime.fireStreak || 1) + 1) : 1;
    runtime.fireStreak = nextStreak;
    loopState.streakMultiplier = STREAK_MULTIPLIERS[nextStreak] ?? 1;
    loopState.lastHitTime = simTimeSec;
    loopState.lastShotHit = true;
    const pts = Math.round(BASE_HIT_SCORE * loopState.streakMultiplier);
    awardMissionScore(pts, Math.round(pts * HIT_MONEY_RATIO));
    try { showHitMarker(); } catch {}
    safeRadio(RADIO_MSG_HIT);
  } else {
    runtime.fireStreak = 1;
    loopState.streakMultiplier = 1;
    loopState.lastShotHit = false;
    loopState.lastHitTime = -1;
    safeRadio(RADIO_MSG_MISS);
  }
}
