import * as THREE from 'three';
import { ENEMY_TYPES, EVENTS } from './config.js';
import { save, player, runtime, on } from './state.js';
import { playThreatAlarmSound } from './audio.js';
import {
  initThreatHud,
  showThreatBanner,
  hideThreatBanner,
  syncThreatArrows,
  hideAllThreatArrows,
  clearEdgeFlash,
  triggerEdgeFlash,
  tickEdgeFlash,
  hasArrowsContainer
} from './threat-hud.js';

const DETECT_RANGE_M = 80;
const RESET_RANGE_M = 100;
const HIDE_DELAY_MS = 3000;
const MAX_ARROWS = 12;
const COMPASS_HE = [
  'צפון',
  'צפון-מזרח',
  'מזרח',
  'דרום-מזרח',
  'דרום',
  'דרום-מערב',
  'מערב',
  'צפון-מערב'
];

const tmpVec = new THREE.Vector3();

let cameraRef = null;
let initialized = false;
let hadThreat = false;
let lastInRangeAtMs = 0;

function getCompassHebrew(dx, dz) {
  const angle = Math.atan2(dx, -dz);
  const norm = angle < 0 ? angle + Math.PI * 2 : angle;
  const idx = Math.round(norm / (Math.PI / 4)) % 8;
  return COMPASS_HE[idx];
}

function isAudioMuted() {
  const cfg = save?.settings || save || {};
  if (cfg.muted === true || cfg.mute === true || cfg.sound === false) return true;
  const keys = ['volume', 'masterVolume', 'sfxVolume'];
  for (let i = 0; i < keys.length; i += 1) {
    if (typeof cfg[keys[i]] === 'number' && cfg[keys[i]] <= 0) return true;
  }
  if (typeof save?.volume === 'number' && save.volume <= 0) return true;
  return false;
}

function onPlayerDamaged(payload) {
  if (!payload?.sourcePos) return;
  const dx = payload.sourcePos.x - player.pos.x;
  const dz = payload.sourcePos.z - player.pos.z;
  const yaw = cameraRef ? cameraRef.rotation.y : player.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const localFwd = dx * fx + dz * fz;
  const localRight = dx * rx + dz * rz;

  let dir = 'top';
  if (Math.abs(localRight) >= Math.abs(localFwd)) {
    dir = localRight < 0 ? 'left' : 'right';
  } else {
    dir = localFwd >= 0 ? 'top' : 'bottom';
  }
  triggerEdgeFlash(dir);
}

function onPlayerLifecycleReset() {
  runtime.markedUntil = 0;
  resetThreatAlerts();
}

export function initThreatAlerts() {
  initThreatHud();
  if (!initialized) {
    initialized = true;
    on(EVENTS.PLAYER_DAMAGED, onPlayerDamaged);
    on(EVENTS.PLAYER_DIED, onPlayerLifecycleReset);
    on(EVENTS.PLAYER_RESPAWNED, onPlayerLifecycleReset);
  }
}

export function resetThreatAlerts() {
  hadThreat = false;
  lastInRangeAtMs = 0;
  hideThreatBanner();
  hideAllThreatArrows();
  clearEdgeFlash();
}

function computeArrowSpec(p, dx, dz, fx, fz, rx, rz, camera, vw, vh, severity) {
  const localFwd = dx * fx + dz * fz;
  const localRight = dx * rx + dz * rz;
  let sx = localRight;
  let sy = -localFwd;

  if (localFwd > 0.2) {
    tmpVec.set(p.x, p.y, p.z).project(camera);
    if (tmpVec.z >= -1 && tmpVec.z <= 1 && Math.abs(tmpVec.x) <= 0.92 && Math.abs(tmpVec.y) <= 0.92) {
      return null;
    }
    sx = tmpVec.x;
    sy = -tmpVec.y;
  } else {
    sy = Math.max(0.25, -localFwd);
  }

  const len = Math.hypot(sx, sy) || 1;
  const nx = sx / len;
  const ny = sy / len;
  const halfW = Math.max(20, vw / 2 - 20);
  const halfH = Math.max(20, vh / 2 - 20);
  const scale = Math.min(halfW / Math.max(1e-4, Math.abs(nx)), halfH / Math.max(1e-4, Math.abs(ny)));
  return {
    x: vw / 2 + nx * scale,
    y: vh / 2 + ny * scale,
    deg: Math.atan2(ny, nx) * (180 / Math.PI),
    severity
  };
}

function buildThreatText(inRangeCount, attackCount, reconCount, nearestType, nearestDist, nearestDx, nearestDz, isMarked) {
  if (inRangeCount === 0) return 'סומנת על ידי רחפן תצפית';
  const roundedDist = Math.round(nearestDist);
  const dirHe = getCompassHebrew(nearestDx, nearestDz);
  let base = '';
  if (inRangeCount === 1) {
    const def = ENEMY_TYPES[nearestType];
    base = `${def.nameHe} מתקרב — ${roundedDist} מ׳, ${dirHe}`;
  } else if (attackCount > 0 && reconCount === 0) {
    base = `${attackCount} ${ENEMY_TYPES.attack_drone.pluralHe} מתקרבים — ${roundedDist} מ׳, ${dirHe}`;
  } else if (reconCount > 0 && attackCount === 0) {
    base = `${reconCount} ${ENEMY_TYPES.recon_drone.pluralHe} מתקרבים — ${roundedDist} מ׳, ${dirHe}`;
  } else {
    base = `${inRangeCount} רחפני אויב (${attackCount} תקיפה, ${reconCount} תצפית) — ${roundedDist} מ׳, ${dirHe}`;
  }
  return isMarked ? `סומנת על ידי רחפן תצפית • ${base}` : base;
}

export function updateThreatAlerts(dt, camera, entitiesApi) {
  if (camera) cameraRef = camera;
  const nowMs = performance.now();
  tickEdgeFlash(nowMs);

  if (!runtime.isPlaying || runtime.isDead) {
    resetThreatAlerts();
    return;
  }

  const drones = entitiesApi?.drones;
  const vw = window.innerWidth || 722;
  const vh = window.innerHeight || 280;
  const yaw = camera ? camera.rotation.y : player.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);

  let inRangeCount = 0;
  let attackCount = 0;
  let reconCount = 0;
  let newAlertCount = 0;
  let newAlertSeverity = 'amber';
  let nearestDist = Infinity;
  let nearestDx = 0;
  let nearestDz = 0;
  let nearestType = 'attack_drone';
  const arrowSpecs = [];
  const canArrows = Boolean(camera && hasArrowsContainer());

  if (Array.isArray(drones)) {
    for (let i = 0; i < drones.length; i += 1) {
      const d = drones[i];
      if (!d || d.destroyed || d.alive === false || d.active === false) continue;
      const p = d.pos || d.group?.position;
      if (!p) continue;

      const dx = p.x - player.pos.x;
      const dz = p.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      const eType = d.enemyType === 'recon_drone' ? 'recon_drone' : 'attack_drone';
      const def = ENEMY_TYPES[eType];

      if (dist <= DETECT_RANGE_M) {
        if (!d._threatAlerted) {
          d._threatAlerted = true;
          newAlertCount += 1;
          if (def.severity === 'red') newAlertSeverity = 'red';
        }
      } else if (dist > RESET_RANGE_M) {
        d._threatAlerted = false;
      }

      const inRange = dist <= DETECT_RANGE_M || (Boolean(d._threatAlerted) && dist <= RESET_RANGE_M);
      if (!inRange) continue;

      inRangeCount += 1;
      if (eType === 'recon_drone') reconCount += 1;
      else attackCount += 1;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDx = dx;
        nearestDz = dz;
        nearestType = eType;
      }

      if (canArrows && arrowSpecs.length < MAX_ARROWS) {
        const spec = computeArrowSpec(p, dx, dz, fx, fz, rx, rz, camera, vw, vh, def.severity);
        if (spec) arrowSpecs.push(spec);
      }
    }
  }

  syncThreatArrows(arrowSpecs);

  if (newAlertCount > 0) {
    if (!isAudioMuted()) playThreatAlarmSound(newAlertSeverity);
    try {
      navigator.vibrate?.(200);
    } catch {}
  }

  const isMarked = Boolean(runtime.markedUntil && runtime.markedUntil > 0);
  if (inRangeCount > 0 || isMarked) {
    if (inRangeCount > 0) {
      lastInRangeAtMs = nowMs;
      hadThreat = true;
    }
    const severity = attackCount > 0 ? 'red' : 'amber';
    const text = buildThreatText(inRangeCount, attackCount, reconCount, nearestType, nearestDist, nearestDx, nearestDz, isMarked);
    showThreatBanner(text, severity);
  } else if (hadThreat && (nowMs - lastInRangeAtMs) < HIDE_DELAY_MS) {
    return;
  } else {
    hadThreat = false;
    hideThreatBanner();
  }
}
