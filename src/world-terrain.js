import * as THREE from 'three';
import { TERRAIN_EXTENT, FEATURES, FLAT_ZONES, GUNS, BERM, DESERT_EDGE_Z } from './world-layout.js';

const PLAY_BOX = { minX: -200, maxX: 200, minZ: -422, maxZ: 92 };
const EDGE_RAMP = 75;
const EDGE_HEIGHT = 16;
const DEFAULT_KEEP = 0.05;
const TILE_SIZE_X = 300;
const TILE_SIZE_Z = 227;
const GRID_STEP = 4;
const BERM_STEP = 0.55;
const NORMAL_EPS = 0.75;

function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function fbm(x, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq + i * 17.3, z * freq - i * 9.1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function bell(t) {
  return t >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * t);
}

export function desertFactor(z) {
  return smoothstep(DESERT_EDGE_Z.end, DESERT_EDGE_Z.start, z);
}

export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return { dist: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

function distanceToPolyline(px, pz, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const { dist } = distanceToSegment(px, pz, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    if (dist < best) best = dist;
  }
  return best;
}

function relief(x, z) {
  const broad = fbm(x * 0.0085 + 11, z * 0.0085 - 7, 3);
  const detail = fbm(x * 0.05, z * 0.05, 2);
  const golan = (broad - 0.5) * 8 + (detail - 0.5) * 1.1;
  const duneLine = Math.sin(x * 0.045 + z * 0.02 + broad * 5);
  const dunes = (broad - 0.5) * 3 + duneLine * 0.6 * smoothstep(60, 140, Math.abs(x)) + (detail - 0.5) * 0.5;
  const desert = desertFactor(z);
  return golan + (dunes - golan) * desert;
}

function zoneWeight(zone, x, z) {
  if (zone.rect) {
    const [minX, maxX, minZ, maxZ] = zone.rect;
    const dx = Math.max(minX - x, 0, x - maxX);
    const dz = Math.max(minZ - z, 0, z - maxZ);
    return 1 - smoothstep(0, zone.feather, Math.hypot(dx, dz));
  }
  const [cx, cz, radius] = zone.circle;
  return 1 - smoothstep(radius, radius + zone.feather, Math.hypot(x - cx, z - cz));
}

function flattenFactor(x, z) {
  let flat = 0;
  for (const zone of FLAT_ZONES) {
    const weight = zoneWeight(zone, x, z) * (1 - (zone.keep ?? DEFAULT_KEEP));
    if (weight > flat) flat = weight;
  }
  return flat;
}

function edgeRamp(x, z) {
  const out = Math.max(0, PLAY_BOX.minX - x, x - PLAY_BOX.maxX, PLAY_BOX.minZ - z, z - PLAY_BOX.maxZ);
  if (out <= 0) return 0;
  return smoothstep(0, EDGE_RAMP, out) * (EDGE_HEIGHT + fbm(x * 0.02, z * 0.02, 2) * 14);
}

function getBaseHeight(x, z) {
  let h = relief(x, z) * (1 - flattenFactor(x, z)) + edgeRamp(x, z);
  for (const hill of FEATURES.hills) {
    h += hill.height * bell(Math.hypot(x - hill.x, z - hill.z) / hill.radius);
  }
  for (const ridge of FEATURES.ridges) {
    const { dist, t } = distanceToSegment(x, z, ridge.from[0], ridge.from[1], ridge.to[0], ridge.to[1]);
    h += ridge.height * bell(dist / ridge.halfWidth) * smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t);
  }
  for (const wadi of FEATURES.wadis) {
    h -= wadi.depth * bell(distanceToPolyline(x, z, wadi.points) / wadi.halfWidth);
  }
  for (const plateau of FEATURES.plateaus) {
    const weight = 1 - smoothstep(plateau.radius, plateau.radius + plateau.falloff, Math.hypot(x - plateau.x, z - plateau.z));
    h += (plateau.height - h) * weight;
  }
  return h;
}

function bermSegments(gun) {
  const [rx, rz] = gun.rear;
  const { halfWidth: w, back, front, gapFrom } = BERM;
  return [
    [rx - w, rz + back, rx + gapFrom, rz + back],
    [rx - w, rz + back, rx - w, rz + front],
    [rx + w, rz + back - 2.5, rx + w, rz + front]
  ];
}

const BERM_SEGMENTS = GUNS.map((gun) => ({ gun, segments: bermSegments(gun) }));

function getBermHeight(x, z) {
  let best = 0;
  const reach = BERM.halfWidth + BERM.profile + 0.5;
  for (const { gun, segments } of BERM_SEGMENTS) {
    const u = x - gun.rear[0];
    const v = z - gun.rear[1];
    if (Math.abs(u) > reach || v > BERM.back + BERM.profile + 0.5 || v < BERM.front - BERM.profile) continue;
    let dist = Infinity;
    for (const [ax, az, bx, bz] of segments) dist = Math.min(dist, distanceToSegment(x, z, ax, az, bx, bz).dist);
    const taper = smoothstep(BERM.front - 1, BERM.front + 6, v);
    const ripple = 0.88 + 0.24 * valueNoise(x * 0.6, z * 0.6);
    best = Math.max(best, BERM.height * bell(dist / BERM.profile) * taper * ripple);
  }
  return best;
}

export function getTerrainHeight(x, z) {
  return getBaseHeight(x, z) + getBermHeight(x, z);
}

function surfaceNormal(heightFn, x, z, target) {
  const hx = heightFn(x + NORMAL_EPS, z) - heightFn(x - NORMAL_EPS, z);
  const hz = heightFn(x, z + NORMAL_EPS) - heightFn(x, z - NORMAL_EPS);
  return target.set(-hx, 2 * NORMAL_EPS, -hz).normalize();
}

function buildGrid(minX, minZ, sizeX, sizeZ, step, heightFn, keepTriangle) {
  const cols = Math.ceil(sizeX / step);
  const rows = Math.ceil(sizeZ / step);
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  const normals = new Float32Array(positions.length);
  const normal = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const i = (r * (cols + 1) + c) * 3;
      const x = minX + (c / cols) * sizeX;
      const z = minZ + (r / rows) * sizeZ;
      positions[i] = x;
      positions[i + 1] = heightFn(x, z);
      positions[i + 2] = z;
      surfaceNormal(heightFn, x, z, normal);
      normals[i] = normal.x;
      normals[i + 1] = normal.y;
      normals[i + 2] = normal.z;
    }
  }
  const indices = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      if (!keepTriangle || keepTriangle(positions, a, b, d, e)) indices.push(a, d, b, b, d, e);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function createTerrainTiles(material) {
  const tiles = [];
  for (let minX = TERRAIN_EXTENT.minX; minX < TERRAIN_EXTENT.maxX; minX += TILE_SIZE_X) {
    for (let minZ = TERRAIN_EXTENT.minZ; minZ < TERRAIN_EXTENT.maxZ; minZ += TILE_SIZE_Z) {
      const sizeX = Math.min(TILE_SIZE_X, TERRAIN_EXTENT.maxX - minX);
      const sizeZ = Math.min(TILE_SIZE_Z, TERRAIN_EXTENT.maxZ - minZ);
      const mesh = new THREE.Mesh(buildGrid(minX, minZ, sizeX, sizeZ, GRID_STEP, getBaseHeight), material);
      mesh.name = 'terrain-tile';
      mesh.receiveShadow = true;
      mesh.userData.tileRect = [minX, minX + sizeX, minZ, minZ + sizeZ];
      tiles.push(mesh);
    }
  }
  return tiles;
}

export function createBermMesh(material) {
  const geometries = GUNS.map((gun) => {
    const reach = BERM.halfWidth + BERM.profile;
    const minX = gun.rear[0] - reach;
    const minZ = gun.rear[1] + BERM.front - BERM.profile;
    const sizeZ = BERM.back - BERM.front + BERM.profile * 2;
    const heightFn = (x, z) => {
      const berm = getBermHeight(x, z);
      return getBaseHeight(x, z) + (berm < 0.04 ? -0.08 : berm);
    };
    const keep = (positions, ...corners) => corners.some((index) => getBermHeight(positions[index * 3], positions[index * 3 + 2]) > 0.04);
    return buildGrid(minX, minZ, reach * 2, sizeZ, BERM_STEP, heightFn, keep);
  });
  const merged = new THREE.Mesh(mergeIndexed(geometries), material);
  merged.name = 'gun-berms';
  merged.receiveShadow = true;
  return merged;
}

function mergeIndexed(geometries) {
  const positions = [];
  const normals = [];
  const indices = [];
  let offset = 0;
  for (const geometry of geometries) {
    positions.push(...geometry.attributes.position.array);
    normals.push(...geometry.attributes.normal.array);
    for (const index of geometry.index.array) indices.push(index + offset);
    offset += geometry.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(offset * 2), 2));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}
