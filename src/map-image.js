import { REGIONS, ROADS, FOOTPRINTS, WALLS, GUNS, GUN_BODY_OFFSET, BERM, TREES, MAP_LABELS, TERRAIN_EXTENT, MAP_DEFS } from './world-layout.js';
import { LANDMARKS, MISSIONS, ENEMY_TYPES, stripKeyHints } from './config.js';
import { save } from './state.js';
import { getTerrainHeight, desertFactor } from './world-terrain.js';
import { splatInfo, getCurrentMapId } from './world.js';
import { MAPS } from './maps/map-registry.js';
import { getCurrentTarget } from './current-target.js';
import { getMissionMapId } from './missions.js';

export const MAP_EXTENT = { minX: -210, maxX: 210, minZ: -450, maxZ: 100 };
export const MAP_PX_PER_M = 2;
const SAMPLE_STEP = 2;
const LIGHT = normalize([-1, 1.7, -1]);
const LEGACY_MAPS = new Set(['shivta', 'yoav', 'line']);
const BASE_COLORS = {
  shivta: [214, 190, 146], yoav: [176, 152, 108], line: [118, 108, 70],
  zaura: [138, 126, 88], beit_hillel: [122, 104, 66], kadita: [148, 72, 40]
};
const COLORS = { asphalt: [66, 67, 72], dirt: [132, 104, 74], rock: [70, 67, 64], gravelGolan: [120, 112, 100], gravelDesert: [196, 180, 150] };
const WALL_STYLES = { fence: { color: '#d9d6cc', width: 1.2, dash: [3, 3] }, twall: { color: '#c4c0b4', width: 3 }, berm: { color: '#7a6248', width: 5 }, stone: { color: '#4e4b46', width: 3 } };
const FOOTPRINT_STYLES = { building: { fill: '#ece4d2', stroke: '#4a4337' }, tent: { fill: '#f6f4ee', stroke: '#8d8a80' }, pad: { fill: '#6a6c70', stroke: null }, range: { fill: '#bba67f', stroke: '#7a6a4c' }, gravel: { fill: '#9c937f', stroke: null }, vehicle: { fill: '#5b623f', stroke: '#2c2f22' } };

const cache = new Map();

function normalize([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

export function getMapBounds(mapId = getCurrentMapId()) {
  const b = MAPS[mapId]?.bounds || MAP_DEFS[mapId]?.bounds;
  if (Array.isArray(b)) return { minX: b[0], maxX: b[1], minZ: b[2], maxZ: b[3] };
  if (b && typeof b.minX === 'number') return b;
  return MAP_EXTENT;
}

export function mapToImage(x, z, mapId = getCurrentMapId()) {
  const b = getMapBounds(mapId);
  return [(x - b.minX) * MAP_PX_PER_M, (z - b.minZ) * MAP_PX_PER_M];
}

function inBounds(x, z, b, pad = 16) {
  return x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad;
}

function splatAt(x, z) {
  const { data, size, extent } = splatInfo;
  if (!data) return [0, 0, 0, 0];
  const ext = extent || TERRAIN_EXTENT;
  const col = Math.min(size - 1, Math.max(0, Math.floor(((x - ext.minX) / (ext.maxX - ext.minX)) * size)));
  const row = Math.min(size - 1, Math.max(0, Math.floor(((z - ext.minZ) / (ext.maxZ - ext.minZ)) * size)));
  const i = (row * size + col) * 4;
  return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, data[i + 3] / 255];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function shadedGround(b, mapId) {
  const cols = Math.ceil((b.maxX - b.minX) / SAMPLE_STEP);
  const rows = Math.ceil((b.maxZ - b.minZ) / SAMPLE_STEP);
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(cols, rows);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) heights[r * (cols + 1) + c] = getTerrainHeight(b.minX + c * SAMPLE_STEP, b.minZ + r * SAMPLE_STEP);
  }
  const isLegacy = LEGACY_MAPS.has(mapId);
  const base = BASE_COLORS[mapId] || BASE_COLORS.shivta;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = b.minX + (c + 0.5) * SAMPLE_STEP;
      const z = b.minZ + (r + 0.5) * SAMPLE_STEP;
      const h = heights[r * (cols + 1) + c];
      const dx = heights[r * (cols + 1) + c + 1] - h;
      const dz = heights[(r + 1) * (cols + 1) + c] - h;
      const n = normalize([-dx, SAMPLE_STEP, -dz]);
      const shade = 0.62 + 0.55 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) + Math.min(0.12, h * 0.008);
      const desert = isLegacy ? desertFactor(z) : 0;
      const [sr, sg, sb, sa] = splatAt(x, z);
      let color = isLegacy ? mix(BASE_COLORS.line, BASE_COLORS.shivta, desert) : base;
      color = mix(color, COLORS.dirt, sg * 0.8);
      color = mix(color, mix(COLORS.gravelGolan, COLORS.gravelDesert, desert), sa * 0.7);
      color = mix(color, COLORS.rock, sb * 0.6);
      color = mix(color, COLORS.asphalt, sr);
      const i = (r * cols + c) * 4;
      image.data[i] = Math.min(255, color[0] * shade);
      image.data[i + 1] = Math.min(255, color[1] * shade);
      image.data[i + 2] = Math.min(255, color[2] * shade);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function strokePath(ctx, points, color, width, dash, mapId) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  points.forEach(([x, z], i) => {
    const [px, py] = mapToImage(x, z, mapId);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVectors(ctx, b, mapId) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (!LEGACY_MAPS.has(mapId)) {
    const guns = MAPS[mapId]?.guns || MAP_DEFS[mapId]?.guns || [];
    for (const g of guns) {
      const [gx, gy] = mapToImage(g.x, g.z, mapId);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-(g.yaw || 0));
      ctx.strokeStyle = '#6e5640';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-4.2 * MAP_PX_PER_M, 1.2 * MAP_PX_PER_M);
      ctx.lineTo(-4.2 * MAP_PX_PER_M, -4.2 * MAP_PX_PER_M);
      ctx.lineTo(4.2 * MAP_PX_PER_M, -4.2 * MAP_PX_PER_M);
      ctx.lineTo(4.2 * MAP_PX_PER_M, 1.2 * MAP_PX_PER_M);
      ctx.stroke();
      ctx.fillStyle = '#4e5532';
      ctx.fillRect(-1.7 * MAP_PX_PER_M, -3.3 * MAP_PX_PER_M, 3.4 * MAP_PX_PER_M, 6.6 * MAP_PX_PER_M);
      ctx.restore();
    }
    return;
  }
  for (const road of ROADS) {
    if (!road.points.some(([x, z]) => inBounds(x, z, b, 30))) continue;
    const w = road.width * MAP_PX_PER_M;
    if (road.kind === 'asphalt') {
      strokePath(ctx, road.points, '#e8e0cc', w + 2.5, null, mapId);
      strokePath(ctx, road.points, '#45464b', w, null, mapId);
    } else {
      strokePath(ctx, road.points, 'rgba(110, 82, 52, 0.85)', w * 0.8, [6, 4], mapId);
    }
  }
  for (const wall of WALLS) {
    if (!inBounds(wall.from[0], wall.from[1], b) && !inBounds(wall.to[0], wall.to[1], b)) continue;
    const style = WALL_STYLES[wall.kind];
    strokePath(ctx, [wall.from, wall.to], style.color, style.width, style.dash, mapId);
  }
  for (const fp of FOOTPRINTS) {
    if (!inBounds(fp.x, fp.z, b)) continue;
    const style = FOOTPRINT_STYLES[fp.kind];
    const [px, py] = mapToImage(fp.x - fp.w / 2, fp.z - fp.d / 2, mapId);
    ctx.fillStyle = style.fill;
    ctx.fillRect(px, py, fp.w * MAP_PX_PER_M, fp.d * MAP_PX_PER_M);
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px, py, fp.w * MAP_PX_PER_M, fp.d * MAP_PX_PER_M);
    }
  }
  for (const gun of GUNS) {
    const [rx, rz] = gun.rear;
    if (!inBounds(rx, rz, b)) continue;
    const w = BERM.halfWidth;
    strokePath(ctx, [[rx + BERM.gapFrom, rz + BERM.back], [rx - w, rz + BERM.back], [rx - w, rz + BERM.front]], '#6e5640', 5, null, mapId);
    strokePath(ctx, [[rx + w, rz + BERM.back - 2.5], [rx + w, rz + BERM.front]], '#6e5640', 5, null, mapId);
    const [bx, by] = mapToImage(rx - 1.7, rz + GUN_BODY_OFFSET - 3.3, mapId);
    ctx.fillStyle = '#4e5532';
    ctx.fillRect(bx, by, 3.4 * MAP_PX_PER_M, 6.6 * MAP_PX_PER_M);
    strokePath(ctx, [[rx, rz + GUN_BODY_OFFSET - 2], [rx, rz + GUN_BODY_OFFSET - 9]], '#2c2f22', 2, null, mapId);
  }
  ctx.fillStyle = '#4f6a3a';
  for (const [x, z] of TREES) {
    if (!inBounds(x, z, b)) continue;
    const [px, py] = mapToImage(x, z, mapId);
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getMapImage(mapId = getCurrentMapId()) {
  if (cache.has(mapId)) return cache.get(mapId);
  const b = getMapBounds(mapId);
  const canvas = document.createElement('canvas');
  canvas.width = (b.maxX - b.minX) * MAP_PX_PER_M;
  canvas.height = (b.maxZ - b.minZ) * MAP_PX_PER_M;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadedGround(b, mapId), 0, 0, canvas.width, canvas.height);
  drawVectors(ctx, b, mapId);
  cache.set(mapId, canvas);
  return canvas;
}

export function getMapLabels(mapId = getCurrentMapId()) {
  const b = getMapBounds(mapId);
  if (!LEGACY_MAPS.has(mapId)) {
    const def = MAPS[mapId] || MAP_DEFS[mapId];
    const labels = [{ x: def.spawn.x, z: def.spawn.z + 18, text: def.nameHe, kind: 'region' }];
    if (def.batteryCenter) labels.push({ x: def.batteryCenter.x, z: def.batteryCenter.z, text: 'עמדת סוללה', kind: 'landmark' });
    return labels;
  }
  const region = REGIONS[mapId];
  const anchor = { shivta: [0, 52], yoav: [-112, -137], line: [20, -214] }[mapId];
  const regionLabels = region && anchor ? [{ x: anchor[0], z: anchor[1], text: region.name, kind: 'region' }] : [];
  const landmarkLabels = [
    [LANDMARKS.doherPos, 'דוהר 2'], [LANDMARKS.roemPos, 'רועם'], [LANDMARKS.mafikPos, 'מפי"ק'], [LANDMARKS.rangeConsole, 'מטווח'],
    [LANDMARKS.shop, 'אפסנאות'], [LANDMARKS.spawn, 'רחבת מסדרים'], [LANDMARKS.yamachDepot, 'ימ"ח'], [LANDMARKS.batteryTents, 'אוהלים']
  ].filter(([p]) => inBounds(p.x, p.z, b, 0)).map(([p, text]) => ({ x: p.x, z: p.z, text, kind: 'landmark' }));
  return [...regionLabels, ...MAP_LABELS.filter((l) => inBounds(l.x, l.z, b, 0)).map((l) => ({ ...l, kind: 'landmark' })), ...landmarkLabels];
}

export function trackObjective() {}

export function getObjectiveTarget() {
  const cur = getCurrentTarget();
  return cur ? { x: cur.x, z: cur.z } : null;
}

export function getObjectiveInfo() {
  const cur = getCurrentTarget();
  if (!cur) {
    const m = MISSIONS[save.activeMissionId];
    const targetMapId = m ? getMissionMapId(m) : null;
    if (m && targetMapId && targetMapId !== getCurrentMapId()) {
      return {
        target: null,
        missionTitle: stripKeyHints(m.title || 'משימה פעילה').trim(),
        objectiveText: `סע אל ${MAPS[targetMapId]?.nameHe || targetMapId}`
      };
    }
    return { target: null, missionTitle: 'אין משימה פעילה', objectiveText: 'אין משימה פעילה' };
  }
  const mission = MISSIONS[cur.missionId || save.activeMissionId];
  const missionTitle = stripKeyHints(mission?.title || 'משימה פעילה').trim();
  const objectiveText = cur.text ? stripKeyHints(cur.text).trim() : missionTitle;
  return { target: { x: cur.x, z: cur.z }, missionTitle, objectiveText };
}

export function extractEntityPos(item) {
  if (!item) return null;
  const p = item.mesh?.position || item.position || item.pos || item;
  return p && typeof p.x === 'number' && typeof p.z === 'number' ? { x: p.x, z: p.z } : null;
}

export function isEntityActive(item) {
  if (!item || item.alive === false || item.active === false || item.destroyed === true) return false;
  return !(item.mesh && item.mesh.visible === false);
}

export function drawDroneDot(ctx, x, y, enemyType, scale, pulse) {
  const def = ENEMY_TYPES[enemyType] || ENEMY_TYPES.attack_drone;
  const isRecon = def.id === 'recon_drone';
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, (3.6 + pulse * 1.4) * scale, 0, Math.PI * 2);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = isRecon ? '#4a2d00' : '#3a0b0b';
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, (6.4 + pulse * 2.8) * scale, 0, Math.PI * 2);
  ctx.strokeStyle = isRecon ? 'rgba(255, 170, 34, 0.85)' : 'rgba(255, 59, 59, 0.85)';
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  ctx.restore();
  return isRecon;
}

export function drawMissionIcon(ctx, x, y, s) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 4.4 * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 224, 92, 0.28)';
  ctx.fill();
  ctx.lineWidth = 1.7 * s;
  ctx.strokeStyle = '#ffe05c';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 1.9 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3b0';
  ctx.fill();
  ctx.restore();
}

export function drawPlayerArrow(context, x, y, yaw, size) {
  context.save();
  context.translate(x, y);
  context.rotate(-yaw);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-size * 1.3, -size * 3);
  context.lineTo(size * 1.3, -size * 3);
  context.closePath();
  context.fillStyle = 'rgba(126, 227, 255, 0.22)';
  context.fill();
  context.beginPath();
  context.moveTo(0, -size * 1.4);
  context.lineTo(size, size);
  context.lineTo(0, size * 0.45);
  context.lineTo(-size, size);
  context.closePath();
  context.fillStyle = '#2cc5b6';
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.6;
  context.stroke();
  context.restore();
}
