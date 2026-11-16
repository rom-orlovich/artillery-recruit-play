import * as THREE from 'three';
import { MAP_BIOMES } from './maps/map-biomes.js';
import * as layout from './world-layout.js';

const NORMAL_EPS = 0.75;
const BERM_STEP = 0.75;
const DEFAULT_BERM = { halfWidth: 7.5, back: 3.8, front: -7.4, gapFrom: 2, height: 2.3, profile: 3.2 };

let activeMapId = 'shivta';
let activeGuns = [];
let activeMapGroup = null;

function mapGunList(guns) {
  return (Array.isArray(guns) ? guns : []).map((g) => {
    const gx = g.x ?? g.pos?.[0] ?? g.rear?.[0] ?? 0;
    const gz = g.z ?? g.pos?.[1] ?? g.rear?.[1] ?? 0;
    const yaw = g.yaw ?? 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    return { gx, gz, yaw, fx, fz, lx: fz, lz: -fx };
  });
}

function getEffectiveGuns() {
  if (activeGuns.length) return activeGuns;
  const defGuns = layout.MAP_DEFS?.[activeMapId]?.guns;
  return defGuns?.length ? mapGunList(defGuns) : [];
}

export function getActiveTerrainMap() {
  return activeMapId;
}

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
  if (activeMapId === 'shivta') return 1;
  const edge = layout.DESERT_EDGE_Z;
  if (edge) return smoothstep(edge.end, edge.start, z);
  return 0;
}

export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return { dist: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

function floorStep(t) {
  const fl = Math.floor(t);
  return fl + smoothstep(0.75, 1.0, t - fl);
}

function legacyFeaturesHeight(x, z, h) {
  const features = layout.FEATURES;
  if (!features) return h;
  for (const hill of features.hills || []) {
    h += hill.height * bell(Math.hypot(x - hill.x, z - hill.z) / hill.radius);
  }
  for (const ridge of features.ridges || []) {
    const { dist, t } = distanceToSegment(x, z, ridge.from[0], ridge.from[1], ridge.to[0], ridge.to[1]);
    h += ridge.height * bell(dist / ridge.halfWidth) * smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t);
  }
  for (const plateau of features.plateaus || []) {
    const w = 1 - smoothstep(plateau.radius, plateau.radius + plateau.falloff, Math.hypot(x - plateau.x, z - plateau.z));
    h += (plateau.height - h) * w;
  }
  return h;
}

function baseHeightForMap(mapId, x, z) {
  if (mapId === 'zaura') {
    const raw = 1.6 * Math.sin(x / 55) + 1.2 * Math.cos(z / 48) + 4.5 * smoothstep(30, 95, -z - 0.4 * x);
    return raw + (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.35;
  }
  if (mapId === 'beit_hillel') {
    return 0.35 * Math.sin(x / 40) * Math.cos(z / 45) - 1.1 * smoothstep(-50, -68, x);
  }
  if (mapId === 'kadita') {
    return -0.045 * z + 1.4 * floorStep(z / 24) + 0.8 * Math.sin(x / 32);
  }
  if (mapId === 'shivta') {
    const flat = 1 - smoothstep(55, 95, Math.hypot(x, z + 15));
    const ridge = 3.2 * smoothstep(65, 102, z);
    const undul = (0.4 * Math.sin(x * 0.04) * Math.cos(z * 0.035) + (fbm(x * 0.025, z * 0.025, 2) - 0.5) * 0.45) * (1 - flat * 0.85);
    return undul + ridge;
  }
  if (mapId === 'yoav') {
    const flat = 1 - smoothstep(32, 62, Math.hypot(x + 110, z + 179));
    const swell = (2.5 * Math.sin((x + 110) * 0.045) * Math.cos((z + 179) * 0.05) + (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 1.4) * (1 - flat * 0.92);
    return swell;
  }
  const flatBat = 1 - smoothstep(45, 78, Math.max(Math.abs(x - 58) * 0.45, Math.abs(z + 298)));
  const flatSpawn = 1 - smoothstep(22, 42, Math.hypot(x + 57, z + 244));
  const keep = Math.max(flatBat, flatSpawn);
  const wadi = -2.4 * bell(Math.abs(z + 348) / 22);
  const northRidge = 28 * smoothstep(-368, -445, z) * (0.65 + 0.35 * Math.sin(x * 0.035));
  const detail = (fbm(x * 0.025, z * 0.025, 3) - 0.5) * 4.5 * (1 - keep * 0.9);
  return legacyFeaturesHeight(x, z, detail + wadi + northRidge);
}

function evalGunPit(x, z, gun, baseFn) {
  const dx = x - gun.gx;
  const dz = z - gun.gz;
  if (Math.abs(dx) > 13.5 || Math.abs(dz) > 13.5) return { floorW: 0, floorY: 0, berm: 0 };
  const f = dx * gun.fx + dz * gun.fz;
  const l = dx * gun.lx + dz * gun.lz;
  if (Math.abs(l) > 9.5 || f < -6.5 || f > 13.0) return { floorW: 0, floorY: 0, berm: 0 };
  const absL = Math.abs(l);
  const floorW =
    (1 - smoothstep(3.4, 4.4, absL)) *
    smoothstep(-4.2, -2.8, f) *
    (1 - smoothstep(7.0, 8.2, f));
  const bermCfg = layout.BERM || DEFAULT_BERM;
  const wallCenterL = bermCfg.halfWidth - bermCfg.profile * 0.5;
  const wallFrontInner = -bermCfg.front - bermCfg.profile * 0.5;
  const wallFrontOuter = -bermCfg.front;
  const wallBackF = -bermCfg.gapFrom;
  const frontSpanF = Math.max(wallFrontInner, Math.min(wallFrontOuter, f));
  const dFront = distanceToSegment(f, l, frontSpanF, -wallCenterL, frontSpanF, wallCenterL).dist;
  const dLeft = distanceToSegment(f, l, wallBackF, wallCenterL, wallFrontInner, wallCenterL).dist;
  const dRight = distanceToSegment(f, l, wallBackF, -wallCenterL, wallFrontInner, -wallCenterL).dist;
  const dSeg = Math.min(dFront, dLeft, dRight);
  const bermProfile = 1 - smoothstep(0.3, 1.4, dSeg);
  const ripple = 1 + 0.06 * (valueNoise(x * 0.6, z * 0.6) - 0.5);
  return {
    floorW,
    floorY: baseFn(gun.gx, gun.gz) - 0.25,
    berm: bermCfg.height * bermProfile * ripple
  };
}

function getBermDelta(x, z, gunsList) {
  let maxBerm = 0;
  const baseFn = (px, pz) => baseHeightForMap(activeMapId, px, pz);
  for (const gun of gunsList) {
    const p = evalGunPit(x, z, gun, baseFn);
    if (p.berm > maxBerm) maxBerm = p.berm;
  }
  return maxBerm;
}

export function setActiveTerrainMap(mapId, guns = [], mapGroup = null) {
  activeMapId = MAP_BIOMES[mapId] ? mapId : 'shivta';
  activeMapGroup = mapGroup;
  const rawGuns = Array.isArray(guns) && guns.length ? guns : (layout.MAP_DEFS?.[activeMapId]?.guns || []);
  activeGuns = mapGunList(rawGuns);
}

export function getTerrainHeight(x, z) {
  const baseFn = (px, pz) => baseHeightForMap(activeMapId, px, pz);
  let h = baseFn(x, z);
  let bestFloorW = 0;
  let bestFloorY = h;
  let maxBerm = 0;
  for (const gun of getEffectiveGuns()) {
    const p = evalGunPit(x, z, gun, baseFn);
    if (p.floorW > bestFloorW) {
      bestFloorW = p.floorW;
      bestFloorY = p.floorY;
    }
    if (p.berm > maxBerm) maxBerm = p.berm;
  }
  return h + (bestFloorY - h) * bestFloorW + maxBerm;
}

function surfaceNormal(heightFn, x, z, target) {
  const hx = heightFn(x + NORMAL_EPS, z) - heightFn(x - NORMAL_EPS, z);
  const hz = heightFn(x, z + NORMAL_EPS) - heightFn(x, z - NORMAL_EPS);
  return target.set(-hx, 2 * NORMAL_EPS, -hz).normalize();
}

function buildPlaneTile(minX, minZ, sizeX, sizeZ, step, heightFn) {
  const cols = Math.ceil(sizeX / step);
  const rows = Math.ceil(sizeZ / step);
  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, cols, rows);
  geo.rotateX(-Math.PI / 2);
  const cx = minX + sizeX * 0.5;
  const cz = minZ + sizeZ * 0.5;
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    const y = heightFn(x, z);
    pos.setXYZ(i, x, y, z);
    surfaceNormal(heightFn, x, z, n);
    norm.setXYZ(i, n.x, n.y, n.z);
    const shade = 0.92 + 0.08 * Math.min(1, Math.max(0, n.y));
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

function tileHasGun(minX, maxX, minZ, maxZ) {
  for (const g of getEffectiveGuns()) {
    if (g.gx >= minX - 14 && g.gx <= maxX + 14 && g.gz >= minZ - 14 && g.gz <= maxZ + 14) return true;
  }
  return false;
}

export function createTerrainTiles(material, mapId = activeMapId, mapGroup = activeMapGroup) {
  const biome = MAP_BIOMES[mapId] || MAP_BIOMES.shivta;
  const [minX, maxX, minZ, maxZ] = biome.bounds;
  const tileSize = biome.tileSize || 140;
  const tiles = [];
  for (let x0 = minX; x0 < maxX; x0 += tileSize) {
    for (let z0 = minZ; z0 < maxZ; z0 += tileSize) {
      const sizeX = Math.min(tileSize, maxX - x0);
      const sizeZ = Math.min(tileSize, maxZ - z0);
      const step = tileHasGun(x0, x0 + sizeX, z0, z0 + sizeZ) ? 1.5 : 3.2;
      const mesh = new THREE.Mesh(buildPlaneTile(x0, z0, sizeX, sizeZ, step, getTerrainHeight), material);
      mesh.name = 'terrain-tile';
      mesh.receiveShadow = true;
      mesh.userData.terrain = true;
      mesh.userData.tileRect = [x0, x0 + sizeX, z0, z0 + sizeZ];
      if (mapGroup) mapGroup.add(mesh);
      tiles.push(mesh);
    }
  }
  return tiles;
}

export function createGunPitBerms(material, guns = []) {
  const list = guns.length ? mapGunList(guns) : getEffectiveGuns();
  if (!list.length) {
    const empty = new THREE.Mesh(new THREE.BufferGeometry(), material);
    empty.name = 'gun-berms';
    empty.visible = false;
    return empty;
  }
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  const n = new THREE.Vector3();
  const reach = 13.0;
  const cols = Math.ceil((reach * 2) / BERM_STEP);
  for (const gun of list) {
    const x0 = gun.gx - reach;
    const z0 = gun.gz - reach;
    const baseFn = (px, pz) => baseHeightForMap(activeMapId, px, pz);
    const hAt = (x, z) => {
      const p = evalGunPit(x, z, gun, baseFn);
      return getTerrainHeight(x, z) + (p.berm < 0.04 ? -0.06 : 0.01);
    };
    const gridPos = [];
    for (let r = 0; r <= cols; r++) {
      for (let c = 0; c <= cols; c++) {
        const x = x0 + c * BERM_STEP;
        const z = z0 + r * BERM_STEP;
        const y = hAt(x, z);
        gridPos.push(x, y, z);
        positions.push(x, y, z);
        surfaceNormal(hAt, x, z, n);
        normals.push(n.x, n.y, n.z);
        colors.push(0.98, 0.98, 0.98);
        uvs.push(c / cols, r / cols);
      }
    }
    for (let r = 0; r < cols; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + cols + 1;
        const e = d + 1;
        const keep = [a, b, d, e].some((idx) => getBermDelta(gridPos[idx * 3], gridPos[idx * 3 + 2], list) > 0.04);
        if (keep) indices.push(offset + a, offset + d, offset + b, offset + b, offset + d, offset + e);
      }
    }
    offset += (cols + 1) * (cols + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'gun-berms';
  mesh.userData.terrain = true;
  mesh.receiveShadow = true;
  return mesh;
}

export { createGunPitBerms as createBermMesh };
