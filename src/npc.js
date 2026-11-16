import { player, runtime } from './state.js';
import { getRawSoldierSpawn, syncSoldierTransform } from './world-soldiers.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';
import { snapGround } from './npc-path.js';
import { bindNpcOrderStore, issueNpcOrder } from './npc-orders.js';
import { faceNpcToward, stepNpcState } from './npc-routines.js';
import { spawnNpcsForMap } from './npc-spawner.js';

const TALK_DEFAULT_DIST = 6;
const TALK_DOT_MIN = 0.35;
const TALK_SELF_DIST_SQ = 0.01;
const FAR_AI_DIST_SQ = 1225;
const STAGGER_SLICES = 5;
const NIGHT_START_H = 21.5;
const NIGHT_END_H = 6.0;
const DEFAULT_DAY_HOUR = 10;
const CREW_SNAP_EPS = 0.01;

const npcs = [];
const followers = [];
const byId = new Map();

let currentMapId = 'shivta';
let activeTalkNpc = null;
let frameSlice = 0;

bindNpcOrderStore({ byId, getFollowers, getMapId: () => currentMapId });

export function initNpcsForMap(mapId, scene) {
  for (let i = 0; i < npcs.length; i++) {
    const obj = npcs[i].object;
    if (obj && obj.parent) obj.parent.remove(obj);
  }
  npcs.length = 0;
  followers.length = 0;
  byId.clear();
  activeTalkNpc = null;

  currentMapId = mapId || 'shivta';
  const roster = MAP_NPC_ROSTERS[currentMapId] || MAP_NPC_ROSTERS.shivta;
  spawnNpcsForMap(currentMapId, roster, scene, npcs, byId);
}

export function getNpcs() {
  return npcs;
}

export function getFollowers() {
  followers.length = 0;
  for (let i = 0; i < npcs.length; i++) {
    if (npcs[i].task === 'follow') followers.push(npcs[i]);
  }
  return followers;
}

export function isWorldPausedByDialogue() {
  return Boolean(runtime.dialogueOpen);
}

export function setTalkTarget(npc) {
  activeTalkNpc = npc || null;
  if (activeTalkNpc) faceNpcToward(activeTalkNpc, player.pos.x, player.pos.z);
}

export function getNearestTalkableNpc(playerPos, playerYaw, maxDist = TALK_DEFAULT_DIST) {
  if (!playerPos) return null;
  const fx = -Math.sin(playerYaw || 0);
  const fz = -Math.cos(playerYaw || 0);
  const maxSq = maxDist * maxDist;
  let bestFacing = null;
  let bestFacingSq = maxSq;
  let bestAny = null;
  let bestAnySq = maxSq;
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n.pos) continue;
    const dx = n.pos.x - playerPos.x;
    const dz = n.pos.z - playerPos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > maxSq) continue;
    if (!bestAny || d2 < bestAnySq) {
      bestAnySq = d2;
      bestAny = n;
    }
    if (d2 <= TALK_SELF_DIST_SQ) {
      if (!bestFacing || d2 < bestFacingSq) {
        bestFacingSq = d2;
        bestFacing = n;
      }
      continue;
    }
    const dist = Math.sqrt(d2);
    if ((fx * dx + fz * dz) / dist > TALK_DOT_MIN && (!bestFacing || d2 < bestFacingSq)) {
      bestFacingSq = d2;
      bestFacing = n;
    }
  }
  return bestFacing || bestAny;
}

export function updateNpcs(dt, playerPos, timeOfDayHours) {
  if (!npcs.length || !playerPos) return;
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n.snappedCrew && n.crewOf !== null && !n.task) {
      const raw = getRawSoldierSpawn(n.spawnIndex);
      if (raw && (Math.hypot(raw.x - n.home.x, raw.z - n.home.z) > CREW_SNAP_EPS || Math.abs(raw.y - n.home.y) > CREW_SNAP_EPS)) {
        n.pos.x = raw.x; n.pos.y = raw.y; n.pos.z = raw.z; n.ry = raw.ry;
        n.home.x = raw.x; n.home.y = raw.y; n.home.z = raw.z; n.home.ry = raw.ry;
        n.snappedCrew = true;
        n.object.position.set(raw.x, raw.y, raw.z);
        n.object.rotation.y = raw.ry;
      }
    }
  }

  if (isWorldPausedByDialogue()) {
    if (activeTalkNpc) faceNpcToward(activeTalkNpc, playerPos.x, playerPos.z);
    return;
  }
  if (dt <= 0) return;

  frameSlice = (frameSlice + 1) % STAGGER_SLICES;
  const h = typeof timeOfDayHours === 'number' ? timeOfDayHours : DEFAULT_DAY_HOUR;
  const isNight = h >= NIGHT_START_H || h < NIGHT_END_H;
  const roster = MAP_NPC_ROSTERS[currentMapId] || MAP_NPC_ROSTERS.shivta;

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    const dx = n.pos.x - playerPos.x;
    const dz = n.pos.z - playerPos.z;
    const far = dx * dx + dz * dz > FAR_AI_DIST_SQ;
    if (far && !n.task && (i % STAGGER_SLICES) !== frameSlice) {
      n.accumDt += dt;
      continue;
    }
    const stepDt = dt + n.accumDt;
    n.accumDt = 0;
    const prevX = n.pos.x;
    const prevZ = n.pos.z;
    const prevRy = n.ry;
    const prevPose = n.pose;
    stepNpcState(n, stepDt, playerPos, isNight, roster);
    if (n.pos.x !== prevX || n.pos.z !== prevZ || n.ry !== prevRy || n.pose !== prevPose) {
      snapGround(n.pos);
      n.object.position.set(n.pos.x, n.pos.y, n.pos.z);
      n.object.rotation.y = n.ry;
      syncSoldierTransform(n.spawnIndex, n.pos.x, n.pos.y, n.pos.z, n.ry, n.pose);
    }
  }
}

export { issueNpcOrder };
