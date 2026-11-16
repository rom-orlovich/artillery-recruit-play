import { colliders, ground } from './world-kit.js';

export const AGENT_RADIUS = 0.45;
const GRID_MIN = 2;
const GRID_AXIS = 80;
const NODE_CAP = GRID_AXIS * GRID_AXIS;
const MARGIN = 14;
const GOLDEN = 2.39996323;
const OX = [1, -1, 0, 0, 1, 1, -1, -1];
const OZ = [0, 0, 1, -1, 1, -1, 1, -1];
const SKIN = 0.001;
const SAMPLES = [0, 0, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5];

const cellBlocked = new Uint8Array(NODE_CAP);
const prevNode = new Int32Array(NODE_CAP);
const queueNodes = new Int32Array(NODE_CAP);
const rawX = new Float32Array(NODE_CAP);
const rawZ = new Float32Array(NODE_CAP);

export function blockedAt(x, z, r = AGENT_RADIUS) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  }
  return false;
}

export function lineClear(ax, az, bx, bz, r = AGENT_RADIUS) {
  const dx = bx - ax;
  const dz = bz - az;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const minX = c.minX - r;
    const maxX = c.maxX + r;
    const minZ = c.minZ - r;
    const maxZ = c.maxZ + r;
    let t0 = 0;
    let t1 = 1;
    if (dx !== 0) {
      let ta = (minX - ax) / dx;
      let tb = (maxX - ax) / dx;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
    } else if (ax < minX || ax > maxX) continue;
    if (dz !== 0) {
      let ta = (minZ - az) / dz;
      let tb = (maxZ - az) / dz;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
    } else if (az < minZ || az > maxZ) continue;
    if (t0 <= t1 && t1 >= 0 && t0 <= 1) return false;
  }
  return true;
}

function hash2(x, z, seed) {
  let h = (Math.round(x * 8) ^ Math.round(z * 8) ^ Math.imul(seed + 1, -1640531527)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function buildPatrol(x, z, seed = 0) {
  const h = hash2(x, z, seed);
  const count = 2 + (h % 3);
  const pts = [];
  let prevX = x;
  let prevZ = z;
  for (let i = 0; i < count; i++) {
    const wrap = i === count - 1;
    let a = ((h >>> (i * 5)) % 629) / 100 + (i * Math.PI * 2) / count;
    let px = x;
    let pz = z;
    let ok = false;
    for (let k = 0; k < 16; k++) {
      const r = 3.5 + ((h >>> ((i + k) * 3 + 4)) % 26) / 10;
      px = x + Math.sin(a) * r;
      pz = z + Math.cos(a) * r;
      if (!blockedAt(px, pz) && lineClear(prevX, prevZ, px, pz) && (!wrap || lineClear(px, pz, x, z))) { ok = true; break; }
      a += GOLDEN;
    }
    if (!ok) { px = x; pz = z; }
    pts.push({ x: px, z: pz });
    prevX = px;
    prevZ = pz;
  }
  return pts;
}

function finish(out, k) {
  out.length = k;
  return k;
}

function pushPoint(out, k, x, z) {
  if (k < out.length) { out[k].x = x; out[k].z = z; } else out.push({ x, z });
  return k + 1;
}

function markBlocked(x0, z0, cell) {
  for (let s = 0; s < 5; s++) {
    if (blockedAt(x0 + (0.5 + SAMPLES[s * 2]) * cell, z0 + (0.5 + SAMPLES[s * 2 + 1]) * cell)) return true;
  }
  return false;
}

export function planPath(fromX, fromZ, toX, toZ, out = []) {
  if (lineClear(fromX, fromZ, toX, toZ)) return finish(out, pushPoint(out, 0, toX, toZ));
  const spanX = Math.abs(toX - fromX) + 2 * MARGIN;
  const spanZ = Math.abs(toZ - fromZ) + 2 * MARGIN;
  const cell = Math.max(GRID_MIN, Math.ceil(Math.max(spanX, spanZ) / GRID_AXIS));
  const minX = Math.min(fromX, toX) - MARGIN;
  const minZ = Math.min(fromZ, toZ) - MARGIN;
  const nx = Math.max(1, Math.ceil(spanX / cell));
  const nz = Math.max(1, Math.ceil(spanZ / cell));
  const n = nx * nz;
  cellBlocked.fill(0, 0, n);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      if (markBlocked(minX + ix * cell, minZ + iz * cell, cell)) cellBlocked[iz * nx + ix] = 1;
    }
  }
  let sx = Math.max(0, Math.min(nx - 1, Math.floor((fromX - minX) / cell)));
  let sz = Math.max(0, Math.min(nz - 1, Math.floor((fromZ - minZ) / cell)));
  let gx = Math.max(0, Math.min(nx - 1, Math.floor((toX - minX) / cell)));
  let gz = Math.max(0, Math.min(nz - 1, Math.floor((toZ - minZ) / cell)));
  const startIdx = sz * nx + sx;
  let goalIdx = gz * nx + gx;
  cellBlocked[startIdx] = 0;
  if (cellBlocked[goalIdx]) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (cellBlocked[i]) continue;
      const dx = minX + ((i % nx) + 0.5) * cell - toX;
      const dz = minZ + (Math.floor(i / nx) + 0.5) * cell - toZ;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return finish(out, pushPoint(out, 0, toX, toZ));
    goalIdx = best;
  }
  if (goalIdx === startIdx) return finish(out, pushPoint(out, 0, toX, toZ));
  prevNode.fill(-2, 0, n);
  prevNode[startIdx] = -1;
  let head = 0;
  let tail = 0;
  let found = false;
  queueNodes[tail++] = startIdx;
  while (head < tail) {
    const cur = queueNodes[head++];
    if (cur === goalIdx) { found = true; break; }
    const cx = cur % nx;
    const cz = (cur - cx) / nx;
    for (let d = 0; d < 8; d++) {
      const ax = cx + OX[d];
      const az = cz + OZ[d];
      if (ax < 0 || ax >= nx || az < 0 || az >= nz) continue;
      const ni = az * nx + ax;
      if (cellBlocked[ni] || prevNode[ni] !== -2) continue;
      if (d >= 4 && (cellBlocked[cz * nx + ax] || cellBlocked[az * nx + cx])) continue;
      prevNode[ni] = cur;
      queueNodes[tail++] = ni;
    }
  }
  if (!found) {
    let best = startIdx;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (prevNode[i] === -2) continue;
      const dx = minX + ((i % nx) + 0.5) * cell - toX;
      const dz = minZ + (Math.floor(i / nx) + 0.5) * cell - toZ;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    goalIdx = best;
    if (goalIdx === startIdx) return finish(out, pushPoint(out, 0, toX, toZ));
  }
  let count = 1;
  let node = goalIdx;
  while (node !== startIdx && count < NODE_CAP) {
    const cx = node % nx;
    const cz = (node - cx) / nx;
    rawX[count] = minX + (cx + 0.5) * cell;
    rawZ[count] = minZ + (cz + 0.5) * cell;
    count++;
    node = prevNode[node];
  }
  rawX[0] = fromX;
  rawZ[0] = fromZ;
  rawX[count] = toX;
  rawZ[count] = toZ;
  count++;
  for (let i = 1, j = count - 2; i < j; i++, j--) {
    const tx = rawX[i];
    const tz = rawZ[i];
    rawX[i] = rawX[j];
    rawZ[i] = rawZ[j];
    rawX[j] = tx;
    rawZ[j] = tz;
  }
  let k = 0;
  let i = 0;
  while (i < count - 1) {
    let j = count - 1;
    while (j > i + 1 && !lineClear(rawX[i], rawZ[i], rawX[j], rawZ[j])) j--;
    k = pushPoint(out, k, rawX[j], rawZ[j]);
    i = j;
  }
  return finish(out, k);
}

function slideX(x, z, dx, r) {
  let m = dx;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (z <= c.minZ - r || z >= c.maxZ + r) continue;
    const lo = c.minX - r;
    const hi = c.maxX + r;
    if (x <= lo) {
      if (m > 0 && x + m > lo - SKIN) m = lo - SKIN - x;
    } else if (x >= hi) {
      if (m < 0 && x + m < hi + SKIN) m = hi + SKIN - x;
    }
  }
  return m;
}

function slideZ(x, z, dz, r) {
  let m = dz;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x <= c.minX - r || x >= c.maxX + r) continue;
    const lo = c.minZ - r;
    const hi = c.maxZ + r;
    if (z <= lo) {
      if (m > 0 && z + m > lo - SKIN) m = lo - SKIN - z;
    } else if (z >= hi) {
      if (m < 0 && z + m < hi + SKIN) m = hi + SKIN - z;
    }
  }
  return m;
}

export function steerStep(mover, tx, tz, dt, speed) {
  const pos = mover.pos;
  const dx = tx - pos.x;
  const dz = tz - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist <= 1e-5) return 0;
  const step = Math.min(dist, speed * dt);
  pos.x += slideX(pos.x, pos.z, (dx / dist) * step, AGENT_RADIUS);
  pos.z += slideZ(pos.x, pos.z, (dz / dist) * step, AGENT_RADIUS);
  mover.ry = Math.atan2(dx, dz);
  pos.y = ground(pos.x, pos.z);
  return Math.sqrt((tx - pos.x) * (tx - pos.x) + (tz - pos.z) * (tz - pos.z));
}

export function snapGround(pos) {
  pos.y = ground(pos.x, pos.z);
  return pos.y;
}
