import { blockedAt, steerStep } from './npc-path.js';

export const CREW_BREAK_WALK_SPEED = 2.2;
const CREW_BREAK_BEHIND_MIN_M = 6;
const CREW_BREAK_BEHIND_DEFAULT_M = 7;
const CREW_BREAK_BEHIND_MAX_M = 8;
const CREW_BREAK_AMMO_DUMP_MAX_M = 25;
const CREW_BREAK_AMMO_DUMP_MIN_M = 4;
const CREW_BREAK_WAYPOINT_EPS = 0.65;
const CREW_BREAK_MOVE_EPS = 0.02;
const DUMP_OFFSET_M = 1.5;
const BEHIND_ANGLES = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, Math.PI];
const BEHIND_DISTS = [CREW_BREAK_BEHIND_DEFAULT_M, CREW_BREAK_BEHIND_MIN_M, CREW_BREAK_BEHIND_MAX_M];

export function pickBreakTarget(g, cand, roster) {
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < g.members.length; i++) {
    sx += g.members[i].home.x;
    sz += g.members[i].home.z;
  }
  const cx = sx / g.members.length;
  const cz = sz / g.members.length;

  if (roster && roster.ammoDump) {
    const d = roster.ammoDump;
    const ax = d.x ?? d[0];
    const az = d.z ?? d[d.length - 1];
    if (typeof ax === 'number' && typeof az === 'number') {
      const distDump = Math.hypot(ax - cx, az - cz);
      if (distDump <= CREW_BREAK_AMMO_DUMP_MAX_M && distDump >= CREW_BREAK_AMMO_DUMP_MIN_M) {
        if (!blockedAt(ax, az)) {
          g.targetX = ax;
          g.targetZ = az;
          return true;
        }
        const ox = ax + ((cx - ax) / distDump) * DUMP_OFFSET_M;
        const oz = az + ((cz - az) / distDump) * DUMP_OFFSET_M;
        if (!blockedAt(ox, oz)) {
          g.targetX = ox;
          g.targetZ = oz;
          return true;
        }
      }
    }
  }

  const facing = cand.home.ry || 0;
  for (let dIdx = 0; dIdx < BEHIND_DISTS.length; dIdx++) {
    const dist = BEHIND_DISTS[dIdx];
    for (let aIdx = 0; aIdx < BEHIND_ANGLES.length; aIdx++) {
      const ang = facing + BEHIND_ANGLES[aIdx];
      const tx = cx - Math.sin(ang) * dist;
      const tz = cz - Math.cos(ang) * dist;
      if (!blockedAt(tx, tz)) {
        g.targetX = tx;
        g.targetZ = tz;
        return true;
      }
    }
  }

  g.targetX = cx - Math.sin(facing) * CREW_BREAK_BEHIND_DEFAULT_M;
  g.targetZ = cz - Math.cos(facing) * CREW_BREAK_BEHIND_DEFAULT_M;
  return true;
}

export function followBreakPath(n, tx, tz, dt, allowDirectFallback, stuckLimit) {
  if (n.pathIdx < n.path.length) {
    const wp = n.path[n.pathIdx];
    const prevX = n.pos.x;
    const prevZ = n.pos.z;
    const rem = steerStep(n, wp.x, wp.z, dt, CREW_BREAK_WALK_SPEED);
    if (rem <= CREW_BREAK_WAYPOINT_EPS) {
      n.pathIdx++;
      n.stuckTime = 0;
    } else if (Math.hypot(n.pos.x - prevX, n.pos.z - prevZ) < CREW_BREAK_MOVE_EPS) {
      n.stuckTime += dt;
    } else {
      n.stuckTime = 0;
    }
  } else if (allowDirectFallback) {
    steerStep(n, tx, tz, dt, CREW_BREAK_WALK_SPEED);
  }
  if (allowDirectFallback && n.stuckTime >= stuckLimit) {
    const dx = tx - n.pos.x;
    const dz = tz - n.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-4) {
      const step = Math.min(dist, CREW_BREAK_WALK_SPEED * dt);
      const candX = n.pos.x + (dx / dist) * step;
      const candZ = n.pos.z + (dz / dist) * step;
      if (!blockedAt(candX, candZ)) {
        n.pos.x = candX;
        n.pos.z = candZ;
        n.ry = Math.atan2(dx, dz);
      } else if (candX !== n.pos.x && !blockedAt(candX, n.pos.z)) {
        n.pos.x = candX;
        n.ry = Math.atan2(dx, dz);
      } else if (candZ !== n.pos.z && !blockedAt(n.pos.x, candZ)) {
        n.pos.z = candZ;
        n.ry = Math.atan2(dx, dz);
      }
    }
  }
}
