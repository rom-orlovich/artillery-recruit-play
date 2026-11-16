import { player } from './state.js';
import { planPath, steerStep } from './npc-path.js';
import { syncSoldierTransform } from './world-soldiers.js';
import { getNpcOrderSpeed } from './battery-events.js';
import { completeAmmoDelivery } from './npc-orders.js';
import { getNpcs } from './npc.js';

export {
  findFreeSpot,
  ensurePatrolLoop,
  findOfficerDef,
  nearestMatchingEntry,
  matchOfficersToSpawns,
  partitionOfficersFirst
} from './npc-placement.js';

const WALK_SPEED = 2.0;
const BASE_ORDER_SPEED = 2.7;
const FOLLOW_SPEED = 6.0;
const FOLLOW_CATCHUP_SPEED = 12.0;
const FOLLOW_STOP_DIST = 2.4;
const FOLLOW_STOP_TOLERANCE = 1.2;
const FOLLOW_NEAR_DIST = 3.5;
const FOLLOW_CATCHUP_DIST = 6.0;
const FOLLOW_REPLAN_DIST = 2.0;
const FOLLOW_STUCK_REPLAN = 0.35;
const AMMO_SPEED = 8.0;
const AMMO_FAR_SPEED = 12.0;
const AMMO_FAR_DIST = 15.0;
const AMMO_PICKUP_RADIUS = 2.2;
const AMMO_DELIVER_RADIUS = 3.5;
const AMMO_STUCK_ARRIVE_DIST = 4.5;
const STUCK_TIME_LIMIT = 0.25;
const STUCK_BYPASS_TIME = 0.35;
const STUCK_MOVE_EPS = 0.02;
const WAYPOINT_EPS = 0.65;
const COT_WALK_SPEED = 8.0;
const COT_ARRIVE_RADIUS = 2.4;
const COT_STUCK_TIME = 0.8;
const COT_RECOVER_RATE = 32;
const NIGHT_STAMINA_THRESHOLD = 40;
const STAMINA_DRAIN_PER_SEC = 0.12;
const COT_OCCUPY_TOLERANCE = 0.5;
const PATROL_PAUSE_TIME = 0.6;

export function faceNpcToward(n, tx, tz) {
  const dx = tx - n.pos.x;
  const dz = tz - n.pos.z;
  if (dx * dx + dz * dz < 1e-5) return;
  n.ry = Math.atan2(dx, dz);
  n.object.position.set(n.pos.x, n.pos.y, n.pos.z);
  n.object.rotation.y = n.ry;
  n.object.updateMatrixWorld(true);
  syncSoldierTransform(n.spawnIndex, n.pos.x, n.pos.y, n.pos.z, n.ry, n.pose);
}

function advanceAlongPath(n, dt, speed) {
  if (n.pathIdx >= n.path.length) return true;
  const wp = n.path[n.pathIdx];
  const prevX = n.pos.x;
  const prevZ = n.pos.z;
  const rem = steerStep(n, wp.x, wp.z, dt, speed);
  if (rem <= WAYPOINT_EPS) {
    n.pathIdx++;
    n.stuckTime = 0;
  } else if (Math.hypot(n.pos.x - prevX, n.pos.z - prevZ) < STUCK_MOVE_EPS) {
    n.stuckTime = (n.stuckTime || 0) + dt;
  } else {
    n.stuckTime = 0;
  }
  return n.pathIdx >= n.path.length;
}

function directStepToward(n, tx, tz, dt, speed) {
  const dx = tx - n.pos.x;
  const dz = tz - n.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= 1e-4) return 0;
  const step = Math.min(dist, speed * dt);
  n.pos.x += (dx / dist) * step;
  n.pos.z += (dz / dist) * step;
  n.ry = Math.atan2(dx, dz);
  return dist - step;
}

function findFreeCot(cots, x, z, selfId) {
  const npcs = getNpcs();
  let best = null;
  let bestSq = Infinity;
  for (let i = 0; i < cots.length; i++) {
    const c = cots[i];
    let taken = false;
    if (Array.isArray(npcs)) {
      for (let j = 0; j < npcs.length; j++) {
        const o = npcs[j];
        if (o && o.id !== selfId && o.task === 'sleep_cot' && o.taskTarget && Math.abs(o.taskTarget.x - c.x) < COT_OCCUPY_TOLERANCE && Math.abs(o.taskTarget.z - c.z) < COT_OCCUPY_TOLERANCE) {
          taken = true;
          break;
        }
      }
    }
    if (taken) continue;
    const d2 = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
    if (d2 < bestSq) { bestSq = d2; best = c; }
  }
  return best;
}

function hasFatiguedCrewWaiting(selfId) {
  const npcs = getNpcs();
  if (!Array.isArray(npcs)) return false;
  for (let i = 0; i < npcs.length; i++) {
    const o = npcs[i];
    if (o && o.id !== selfId && !o.isOfficer && !o.task && (o.stamina ?? 100) < NIGHT_STAMINA_THRESHOLD) return true;
  }
  return false;
}

export function stepNpcState(n, dt, playerPos, isNight, roster) {
  if (!n.isOfficer && n.task !== 'sleep_cot') {
    n.stamina = Math.max(0, (n.stamina ?? 100) - STAMINA_DRAIN_PER_SEC * dt);
  }

  if (n.task === 'follow') {
    const yaw = player.yaw || 0;
    const gx = playerPos.x + Math.sin(yaw) * FOLLOW_STOP_DIST;
    const gz = playerPos.z + Math.cos(yaw) * FOLLOW_STOP_DIST;
    const dPlayer = Math.hypot(n.pos.x - playerPos.x, n.pos.z - playerPos.z);
    const dGoal = Math.hypot(n.pos.x - gx, n.pos.z - gz);
    if (dGoal <= FOLLOW_STOP_TOLERANCE || dPlayer <= FOLLOW_STOP_DIST) {
      n.pose = 'stand';
      n.stuckTime = 0;
      return;
    }
    if ((n.stuckTime || 0) > FOLLOW_STUCK_REPLAN || Math.hypot(gx - n.lastFollowGoalX, gz - n.lastFollowGoalZ) > FOLLOW_REPLAN_DIST || n.pathIdx >= n.path.length) {
      n.stuckTime = 0;
      n.lastFollowGoalX = gx;
      n.lastFollowGoalZ = gz;
      planPath(n.pos.x, n.pos.z, gx, gz, n.path);
      n.pathIdx = 0;
    }
    const speed = dGoal > FOLLOW_CATCHUP_DIST ? FOLLOW_CATCHUP_SPEED : (dGoal > FOLLOW_NEAR_DIST ? FOLLOW_SPEED : getNpcOrderSpeed(n));
    advanceAlongPath(n, dt, speed);
    n.pose = 'walk';
    return;
  }

  if (n.task === 'goto' || n.task === 'guard' || n.task === 'return') {
    const speed = getNpcOrderSpeed(n);
    n.orderSpeed = speed;
    const arrived = advanceAlongPath(n, dt, speed);
    n.pose = arrived ? 'stand' : 'walk';
    if (arrived && n.task === 'return') {
      n.task = null;
      n.ry = n.home.ry;
      n.pose = n.basePose;
    }
    return;
  }

  if (n.task === 'ammo') {
    const distTarget = Math.hypot(n.pos.x - n.taskTarget.x, n.pos.z - n.taskTarget.z);
    const arriveRadius = n.taskPhase === 0 ? AMMO_PICKUP_RADIUS : AMMO_DELIVER_RADIUS;
    const trustBonus = Math.max(0, getNpcOrderSpeed(n) - BASE_ORDER_SPEED);
    const speed = (distTarget > AMMO_FAR_DIST ? AMMO_FAR_SPEED : AMMO_SPEED) + trustBonus;
    const pathDone = advanceAlongPath(n, dt, speed);
    let directDone = false;
    if (!pathDone && (n.stuckTime || 0) >= STUCK_BYPASS_TIME) {
      directDone = directStepToward(n, n.taskTarget.x, n.taskTarget.z, dt, speed) <= arriveRadius;
    }
    const stuckNear = (n.stuckTime || 0) >= STUCK_TIME_LIMIT && distTarget <= AMMO_STUCK_ARRIVE_DIST;
    const arrived = pathDone || directDone || distTarget <= arriveRadius || stuckNear;
    n.pose = 'walk';
    if (arrived) {
      n.stuckTime = 0;
      if (n.taskPhase === 0) {
        n.taskPhase = 1;
        n.taskTarget.x = roster.heroGunPos.x;
        n.taskTarget.z = roster.heroGunPos.z;
        planPath(n.pos.x, n.pos.z, roster.heroGunPos.x, roster.heroGunPos.z, n.path);
        n.pathIdx = 0;
      } else {
        completeAmmoDelivery(n, roster);
      }
    }
    return;
  }

  if (n.task === 'sleep_cot') {
    if ((!isNight || hasFatiguedCrewWaiting(n.id)) && (n.stamina ?? 100) >= 100) {
      n.task = null;
      n.stuckTime = 0;
      n.pose = n.basePose;
      return;
    }
    const distCot = Math.hypot(n.pos.x - n.taskTarget.x, n.pos.z - n.taskTarget.z);
    let arrived = distCot <= COT_ARRIVE_RADIUS;
    if (!arrived) {
      const pathDone = advanceAlongPath(n, dt, COT_WALK_SPEED);
      if (!pathDone && (n.stuckTime || 0) >= STUCK_BYPASS_TIME) {
        if (directStepToward(n, n.taskTarget.x, n.taskTarget.z, dt, COT_WALK_SPEED) <= COT_ARRIVE_RADIUS) arrived = true;
      }
      if (pathDone || (n.stuckTime || 0) >= COT_STUCK_TIME) arrived = true;
    }
    if (arrived) {
      n.pose = 'sit';
      n.stuckTime = 0;
      n.stamina = Math.min(100, (n.stamina ?? 0) + COT_RECOVER_RATE * dt);
    } else {
      n.pose = 'walk';
    }
    return;
  }

  if (isNight && !n.isOfficer && !n.task && (n.stamina ?? 100) < NIGHT_STAMINA_THRESHOLD && roster.cots.length) {
    const cot = findFreeCot(roster.cots, n.pos.x, n.pos.z, n.id);
    if (cot) {
      n.task = 'sleep_cot';
      n.taskTarget.x = cot.x;
      n.taskTarget.z = cot.z;
      n.stuckTime = 0;
      planPath(n.pos.x, n.pos.z, cot.x, cot.z, n.path);
      n.pathIdx = 0;
      n.pose = 'walk';
      return;
    }
  }

  if (n.crewOf !== null) { n.pose = 'arms'; return; }

  if (n.patrol.length >= 2) {
    if (n.pauseTimer > 0) { n.pauseTimer -= dt; n.pose = 'stand'; return; }
    const wp = n.patrol[n.patrolIdx];
    const rem = steerStep(n, wp.x, wp.z, dt, WALK_SPEED);
    n.pose = 'walk';
    if (rem <= WAYPOINT_EPS) { n.patrolIdx = (n.patrolIdx + 1) % n.patrol.length; n.pauseTimer = PATROL_PAUSE_TIME; }
    return;
  }

  n.pose = n.basePose;
}
