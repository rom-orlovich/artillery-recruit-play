import { blockedAt, planPath, snapGround } from './npc-path.js';
import { syncSoldierTransform } from './world-soldiers.js';
import { CREW_BREAK_WALK_SPEED, followBreakPath, pickBreakTarget } from './npc-crew-break-path.js';

const CREW_BREAK_INTERVAL_SEC = 35;
const CREW_BREAK_REST_SEC = 5;
const CREW_BREAK_ARRIVE_EPS = 0.8;
const CREW_HOME_SNAP_M = 0.05;
const CREW_BREAK_STUCK_LIMIT = 1.4;
const CREW_GUN_AT_STATION_MAX_M = 2.0;
const CREW_BREAK_TIMEOUT_SEC = 28;
const CREW_BREAK_MIN_AWAY_M = 3.5;
const MAX_CREW_GROUPS = 16;

const groups = [];
for (let i = 0; i < MAX_CREW_GROUPS; i++) {
  groups.push({
    active: false,
    crewOf: null,
    members: [],
    nextMemberIdx: 0,
    timer: CREW_BREAK_INTERVAL_SEC,
    onBreakNpc: null,
    phase: 0,
    restTimer: 0,
    walkTimer: 0,
    targetX: 0,
    targetZ: 0
  });
}

const onBreakSet = new Set();
let builtForList = false;

function syncNpcMoved(n) {
  snapGround(n.pos);
  n.object.position.set(n.pos.x, n.pos.y, n.pos.z);
  n.object.rotation.y = n.ry;
  syncSoldierTransform(n.spawnIndex, n.pos.x, n.pos.y, n.pos.z, n.ry, n.pose);
}

function buildCrewGroups(npcs) {
  builtForList = true;
  for (let i = 0; i < MAX_CREW_GROUPS; i++) {
    groups[i].active = false;
    groups[i].crewOf = null;
    groups[i].members.length = 0;
    groups[i].onBreakNpc = null;
    groups[i].phase = 0;
    groups[i].timer = CREW_BREAK_INTERVAL_SEC;
    groups[i].nextMemberIdx = 0;
  }

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n || n.isOfficer || n.crewOf == null) continue;
    let slot = null;
    for (let k = 0; k < MAX_CREW_GROUPS; k++) {
      if (groups[k].active && groups[k].crewOf === n.crewOf) {
        slot = groups[k];
        break;
      }
      if (!groups[k].active && !slot) {
        slot = groups[k];
      }
    }
    if (!slot) continue;
    if (!slot.active) {
      slot.active = true;
      slot.crewOf = n.crewOf;
    }
    slot.members.push(n);
  }
}

function finishBreak(g) {
  if (g.onBreakNpc) onBreakSet.delete(g.onBreakNpc);
  g.onBreakNpc = null;
  g.phase = 0;
  g.restTimer = 0;
  g.walkTimer = 0;
}

function tryStartBreak(g, roster) {
  const count = g.members.length;
  if (count < 2) return;

  for (let attempt = 0; attempt < count; attempt++) {
    const idx = (g.nextMemberIdx + attempt) % count;
    const cand = g.members[idx];
    if (!cand || !cand.pos || cand.task || onBreakSet.has(cand)) continue;

    let othersAtGun = 0;
    for (let i = 0; i < count; i++) {
      const m = g.members[i];
      if (m === cand || !m.pos || m.task || onBreakSet.has(m)) continue;
      if (Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z) <= CREW_GUN_AT_STATION_MAX_M) {
        othersAtGun++;
      }
    }
    if (othersAtGun < 1) continue;

    g.nextMemberIdx = (idx + 1) % count;
    pickBreakTarget(g, cand, roster);
    g.onBreakNpc = cand;
    g.phase = 1;
    g.walkTimer = 0;
    cand.stuckTime = 0;
    planPath(cand.pos.x, cand.pos.z, g.targetX, g.targetZ, cand.path);
    cand.pathIdx = 0;
    onBreakSet.add(cand);
    return;
  }
}

function startReturnToGun(g, n) {
  g.phase = 3;
  g.walkTimer = 0;
  n.stuckTime = 0;
  n.path.length = 0;
  planPath(n.pos.x, n.pos.z, n.home.x, n.home.z, n.path);
  n.pathIdx = 0;
}

export function isCrewOnBreak(npc) {
  return onBreakSet.has(npc);
}

export function resetCrewBreaks() {
  builtForList = false;
  onBreakSet.clear();
  for (let i = 0; i < MAX_CREW_GROUPS; i++) {
    groups[i].active = false;
    groups[i].crewOf = null;
    groups[i].members.length = 0;
    groups[i].onBreakNpc = null;
    groups[i].phase = 0;
    groups[i].timer = CREW_BREAK_INTERVAL_SEC;
    groups[i].nextMemberIdx = 0;
  }
}

export function updateCrewBreaks(dt, npcs, isNight, roster) {
  if (!npcs || dt <= 0) return;
  if (!builtForList) buildCrewGroups(npcs);

  for (let i = 0; i < MAX_CREW_GROUPS; i++) {
    const g = groups[i];
    if (!g.active) continue;

    if (!isNight) {
      g.timer -= dt;
      if (g.timer <= 0 && !g.onBreakNpc) {
        g.timer = CREW_BREAK_INTERVAL_SEC;
        tryStartBreak(g, roster);
      }
    }

    const n = g.onBreakNpc;
    if (!n) continue;
    if (!n.pos || n.task) {
      finishBreak(g);
      continue;
    }

    if (isNight && g.phase !== 3) {
      startReturnToGun(g, n);
    }

    if (g.phase === 1) {
      g.walkTimer += dt;
      followBreakPath(n, g.targetX, g.targetZ, dt, false, CREW_BREAK_STUCK_LIMIT);
      n.pose = 'walk';
      syncNpcMoved(n);
      const distTarget = Math.hypot(n.pos.x - g.targetX, n.pos.z - g.targetZ);
      const distHome = Math.hypot(n.pos.x - n.home.x, n.pos.z - n.home.z);
      const stuckAway = n.stuckTime >= CREW_BREAK_STUCK_LIMIT && distHome > CREW_BREAK_MIN_AWAY_M;
      if (distTarget <= CREW_BREAK_ARRIVE_EPS || n.pathIdx >= n.path.length || stuckAway || g.walkTimer >= CREW_BREAK_TIMEOUT_SEC) {
        g.phase = 2;
        g.restTimer = CREW_BREAK_REST_SEC;
        n.pose = 'stand';
        n.stuckTime = 0;
        syncNpcMoved(n);
      }
      continue;
    }

    if (g.phase === 2) {
      n.pose = 'stand';
      g.restTimer -= dt;
      if (g.restTimer <= 0) {
        startReturnToGun(g, n);
      }
      continue;
    }

    if (g.phase === 3) {
      g.walkTimer += dt;
      const dx = n.home.x - n.pos.x;
      const dz = n.home.z - n.pos.z;
      const distHome = Math.hypot(dx, dz);
      if (distHome <= CREW_BREAK_ARRIVE_EPS) {
        const step = Math.min(distHome, CREW_BREAK_WALK_SPEED * dt);
        const snapNow = distHome - step <= CREW_HOME_SNAP_M;
        const candX = snapNow ? n.home.x : n.pos.x + (dx / distHome) * step;
        const candZ = snapNow ? n.home.z : n.pos.z + (dz / distHome) * step;
        if (snapNow || blockedAt(candX, candZ)) {
          n.pos.x = n.home.x;
          n.pos.z = n.home.z;
          n.ry = n.home.ry;
          n.pose = 'arms';
          syncNpcMoved(n);
          finishBreak(g);
        } else {
          n.pos.x = candX;
          n.pos.z = candZ;
          n.ry = Math.atan2(dx, dz);
          n.pose = 'walk';
          syncNpcMoved(n);
        }
      } else {
        followBreakPath(n, n.home.x, n.home.z, dt, true, CREW_BREAK_STUCK_LIMIT);
        n.pose = 'walk';
        syncNpcMoved(n);
        if (g.walkTimer >= CREW_BREAK_TIMEOUT_SEC) {
          startReturnToGun(g, n);
        }
      }
    }
  }
}
