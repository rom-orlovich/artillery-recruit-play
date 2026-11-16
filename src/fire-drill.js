import { save } from './state.js';
import { getCurrentMapId } from './world.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';
import {
  getFireMissionState,
  isGunLaid,
  markGunLaid,
  hasLoadedShell,
  getGunReloadTimer,
  layGun,
  loadGun,
  fireGun
} from './fire-mission-loop.js';

const GUN_CREW_ROLE_ID = 'doher';
const GUN_DRILL_RADIUS_M = 4;
const SHELL_TYPE_HE = 'he';
const STEP_LAY_SHORT = 'כוון';
const STEP_LAY_LABEL = '[E] כוון את התותח למטרה';
const STEP_LOAD_SHORT = 'טען';
const STEP_LOAD_LABEL = '[E] טען פגז';
const STEP_FIRE_SHORT = 'אש!';
const STEP_FIRE_LABEL = '[E] אש!';

const gunTarget = { x: 0, y: 0, z: 0 };
const drillCandidate = {
  dist: 0,
  type: 'gun_drill',
  label: '',
  shortLabel: '',
  target: gunTarget
};

export function getGunDrillInteraction(playerPos) {
  if (save.profile?.roleId !== GUN_CREW_ROLE_ID) return null;
  const mission = getFireMissionState();
  if (!mission.activeMission || !playerPos) return null;
  const heroGunPos = MAP_NPC_ROSTERS[getCurrentMapId()]?.heroGunPos;
  if (!heroGunPos) return null;
  const dist = Math.hypot(playerPos.x - heroGunPos.x, playerPos.z - heroGunPos.z);
  if (dist > GUN_DRILL_RADIUS_M) return null;

  gunTarget.x = heroGunPos.x;
  gunTarget.y = 0;
  gunTarget.z = heroGunPos.z;
  drillCandidate.dist = dist;

  if (!isGunLaid()) {
    drillCandidate.shortLabel = STEP_LAY_SHORT;
    drillCandidate.label = STEP_LAY_LABEL;
  } else if (!hasLoadedShell(mission.heroGunId)) {
    drillCandidate.shortLabel = STEP_LOAD_SHORT;
    drillCandidate.label = STEP_LOAD_LABEL;
  } else {
    drillCandidate.shortLabel = STEP_FIRE_SHORT;
    drillCandidate.label = STEP_FIRE_LABEL;
  }
  return drillCandidate;
}

export function performGunDrillStep() {
  const mission = getFireMissionState();
  if (!mission.activeMission) return false;
  const gunId = mission.heroGunId;
  if (!isGunLaid()) {
    layGun(gunId, mission.targetYaw, mission.targetElev);
    markGunLaid();
    return true;
  }
  if (!hasLoadedShell(gunId)) {
    if (getGunReloadTimer(gunId) > 0) return false;
    return loadGun(gunId, SHELL_TYPE_HE);
  }
  return fireGun(gunId);
}
