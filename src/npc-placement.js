import { blockedAt, lineClear, buildPatrol } from './npc-path.js';

const OFFICER_MATCH_RADIUS = 6.5;
const MIN_PATROL_DIST = 2.2;
const FREE_SPOT_MIN_R = 1.6;
const FREE_SPOT_MAX_R = 6;
const FREE_SPOT_STEP_R = 1.4;
const FREE_SPOT_ANGLES = 8;
const FALLBACK_PATROL_DIST = 3.0;
const NUDGE_DIRS = [0, 1, -1, 2, -2, 3, -3, Math.PI];

export function findFreeSpot(x, z) {
  if (!blockedAt(x, z)) return { x, z };
  for (let r = FREE_SPOT_MIN_R; r <= FREE_SPOT_MAX_R; r += FREE_SPOT_STEP_R) {
    for (let k = 0; k < FREE_SPOT_ANGLES; k++) {
      const a = (k * Math.PI) / 4;
      const nx = x + Math.sin(a) * r;
      const nz = z + Math.cos(a) * r;
      if (!blockedAt(nx, nz)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

export function ensurePatrolLoop(x, z, seed) {
  const pts = buildPatrol(x, z, seed);
  let hasFar = false;
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i].x - x, pts[i].z - z) >= MIN_PATROL_DIST) { hasFar = true; break; }
  }
  if (!hasFar) {
    for (let k = 0; k < NUDGE_DIRS.length; k++) {
      const a = (k * Math.PI) / 4;
      const px = x + Math.sin(a) * FALLBACK_PATROL_DIST;
      const pz = z + Math.cos(a) * FALLBACK_PATROL_DIST;
      if (!blockedAt(px, pz) && lineClear(x, z, px, pz)) {
        pts[0] = { x: px, z: pz };
        if (pts.length < 2) pts.push({ x, z });
        break;
      }
    }
  }
  return pts;
}

export function findOfficerDef(officers, officerId) {
  return officers.find((o) => o.id === officerId) || null;
}

export function nearestMatchingEntry(list, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (let i = 0; i < list.length; i++) {
    const d = Math.hypot(list[i].x - x, list[i].z - z);
    if (d < bestD) { bestD = d; best = list[i]; }
  }
  return best;
}

export function matchOfficersToSpawns(officers, spawns) {
  const matched = new Map();
  for (let o = 0; o < officers.length; o++) {
    const cand = officers[o];
    let bestIdx = -1;
    let bestDist = OFFICER_MATCH_RADIUS;
    for (let i = 0; i < spawns.length; i++) {
      if (matched.has(i)) continue;
      const d = Math.hypot(spawns[i].x - cand.x, spawns[i].z - cand.z);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) matched.set(bestIdx, cand);
  }
  return matched;
}

export function partitionOfficersFirst(list) {
  let writeIdx = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].isOfficer) {
      if (i !== writeIdx) {
        const tmp = list[writeIdx];
        list[writeIdx] = list[i];
        list[i] = tmp;
      }
      writeIdx++;
    }
  }
}
