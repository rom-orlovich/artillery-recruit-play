import { runtime, save } from './state.js';
import { getCurrentMapId } from './world.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';

const GUN_CREW_ROLE_ID = 'doher';
const FIRE_CALL_INTERVAL_SEC = 20;
const FIRE_CALL_OFFSET_X = 60;
const FIRE_CALL_OFFSET_Z = -320;

const fireCallTarget = { x: 0, y: 0, z: 0 };
let fireCallTimerSec = 0;

export function getHeroGunPos() {
  return MAP_NPC_ROSTERS[getCurrentMapId()]?.heroGunPos || null;
}

export function resetFireCallTimer() {
  fireCallTimerSec = 0;
}

export function updateFireCallScheduler(dt, isMissionActive, onCall) {
  if (!runtime.isPlaying || isMissionActive || save.profile?.roleId !== GUN_CREW_ROLE_ID) return;
  fireCallTimerSec += dt;
  if (fireCallTimerSec < FIRE_CALL_INTERVAL_SEC) return;
  fireCallTimerSec = 0;
  const pos = getHeroGunPos();
  fireCallTarget.x = (pos?.x ?? 0) + FIRE_CALL_OFFSET_X;
  fireCallTarget.y = 0;
  fireCallTarget.z = (pos?.z ?? 0) + FIRE_CALL_OFFSET_Z;
  if (onCall) onCall(fireCallTarget);
}
