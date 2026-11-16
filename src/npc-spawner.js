import * as THREE from 'three';
import { ground } from './world-kit.js';
import { getSoldierSpawns, registerSoldier, setSoldierIdentity, syncSoldierTransform } from './world-soldiers.js';
import {
  NAMED_OFFICERS, setNpcMapId, resetIdentityAssignments, seedNames, nextName,
  pickSpawnRole, pickSpawnRank
} from './npc-data.js';
import {
  findFreeSpot, ensurePatrolLoop, findOfficerDef, nearestMatchingEntry,
  matchOfficersToSpawns, partitionOfficersFirst
} from './npc-routines.js';

const ORDER_SPEED = 2.7;
const INITIAL_PATROL_PAUSE = 1.2;
const PATROL_PAUSE_STEP = 0.35;
const OFFICER_SPAWN_MIN_DIST = 1.5;
const ENLISTED_SPAWN_MIN_DIST = 1.4;
const ENLISTED_MATCH_RADIUS = 2.5;
const DEFAULT_TRUST = 50;
const DEFAULT_STAMINA = 100;

function hasSpawnNear(spawns, tx, tz, radius) {
  for (let i = 0; i < spawns.length; i++) {
    if (Math.hypot(spawns[i].x - tx, spawns[i].z - tz) < radius) return true;
  }
  return false;
}

export function spawnNpcsForMap(mapId, roster, scene, npcs, byId) {
  setNpcMapId(mapId);
  resetIdentityAssignments();
  for (const off of roster.officers) seedNames(mapId, [off.name]);

  let spawns = getSoldierSpawns();

  for (const off of roster.officers) {
    if (!hasSpawnNear(spawns, off.x, off.z, OFFICER_SPAWN_MIN_DIST)) {
      const spot = findFreeSpot(off.x, off.z);
      registerSoldier(spot.x, ground(spot.x, spot.z), spot.z, off.ry || 0, off.pose || 'stand', null, null);
      spawns = getSoldierSpawns();
    }
  }

  for (const fb of roster.fallbackEnlisted) {
    if (spawns.length >= roster.minCount) break;
    if (!hasSpawnNear(spawns, fb.x, fb.z, ENLISTED_SPAWN_MIN_DIST)) {
      const spot = fb.crewOf ? { x: fb.x, z: fb.z } : findFreeSpot(fb.x, fb.z);
      registerSoldier(spot.x, ground(spot.x, spot.z), spot.z, fb.ry || 0, fb.pose || 'stand', fb.crewOf ?? null, null);
      spawns = getSoldierSpawns();
    }
  }

  const officerBySpawn = matchOfficersToSpawns(roster.officers, spawns);
  let zauraLoaderAssigned = false;

  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    const off = officerBySpawn.get(i) || null;
    const fb = off ? null : nearestMatchingEntry(roster.fallbackEnlisted, s.x, s.z, ENLISTED_MATCH_RADIUS);
    let role = off ? off.role : (fb ? fb.role : pickSpawnRole(mapId, s.x, s.z, s.crewOf, i));
    let rank = off ? off.rank : (fb ? fb.rank : pickSpawnRank(role, i));
    if (!off && mapId === 'zaura' && !zauraLoaderAssigned && s.crewOf == null) {
      role = 'טען';
      rank = 'טוראי';
      zauraLoaderAssigned = true;
    }
    const name = off ? off.name : nextName(mapId);
    setSoldierIdentity(i, name, rank, role);

    const isPatroller = !off && s.crewOf == null;
    const start = isPatroller ? findFreeSpot(s.x, s.z) : s;
    const startY = isPatroller ? ground(start.x, start.z) : s.y;
    if (isPatroller && (start.x !== s.x || start.z !== s.z || startY !== s.y)) {
      syncSoldierTransform(i, start.x, startY, start.z, s.ry);
    }

    const obj = new THREE.Object3D();
    obj.name = `npc-${mapId}-${i}`;
    obj.position.set(start.x, startY, start.z);
    obj.rotation.y = s.ry;
    if (scene && typeof scene.add === 'function') scene.add(obj);

    const offDef = off ? findOfficerDef(NAMED_OFFICERS, off.officerId) : null;
    const patrol = isPatroller ? ensurePatrolLoop(start.x, start.z, i + 1) : [];
    const npc = {
      id: `npc_${mapId}_${i}`,
      spawnIndex: i,
      name, rank, role, region: mapId,
      crewOf: s.crewOf ?? null,
      isOfficer: Boolean(off),
      officerId: off?.officerId ?? null,
      linesByChapter: offDef?.linesByChapter || null,
      pos: { x: start.x, y: startY, z: start.z },
      home: { x: start.x, y: startY, z: start.z, ry: s.ry },
      ry: s.ry,
      basePose: s.pose || 'stand',
      pose: s.pose || 'stand',
      task: null,
      taskTarget: { x: start.x, y: startY, z: start.z },
      taskPhase: 0,
      patrol,
      patrolIdx: 0,
      pauseTimer: INITIAL_PATROL_PAUSE + (i % 4) * PATROL_PAUSE_STEP,
      path: [],
      pathIdx: 0,
      lastFollowGoalX: Infinity,
      lastFollowGoalZ: Infinity,
      stuckTime: 0,
      trust: DEFAULT_TRUST,
      stamina: DEFAULT_STAMINA,
      orderSpeed: ORDER_SPEED,
      accumDt: 0,
      snappedCrew: false,
      cotIndex: i,
      chatWith: null,
      chatLine: '',
      object: obj
    };
    npcs.push(npc);
    byId.set(npc.id, npc);
  }
  partitionOfficersFirst(npcs);
}
