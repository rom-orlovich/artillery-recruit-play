import { REGIONS, ROADS, FOOTPRINTS, WALLS, GUNS, GUN_BODY_OFFSET, BERM, TREES, MAP_LABELS, TERRAIN_EXTENT } from './world-layout.js';
import { LANDMARKS, MISSIONS } from './config.js';
import { on, save } from './state.js';
import { getTerrainHeight, desertFactor } from './world-terrain.js';
import { splatInfo } from './world.js';

const MAP_EXTENT = { minX: -210, maxX: 210, minZ: -450, maxZ: 100 };
export const MAP_PX_PER_M = 2;
const SAMPLE_STEP = 2;
const LIGHT = normalize([-1, 1.7, -1]);
const COLORS = {
  golan: [118, 108, 70], sand: [214, 190, 146], asphalt: [66, 67, 72], dirt: [132, 104, 74], rock: [70, 67, 64],
  gravelGolan: [120, 112, 100], gravelDesert: [196, 180, 150]
};
const WALL_STYLES = {
  fence: { color: '#d9d6cc', width: 1.2, dash: [3, 3] },
  twall: { color: '#c4c0b4', width: 3 },
  berm: { color: '#7a6248', width: 5 },
  stone: { color: '#4e4b46', width: 3 }
};
const FOOTPRINT_STYLES = {
  building: { fill: '#ece4d2', stroke: '#4a4337' },
  tent: { fill: '#f6f4ee', stroke: '#8d8a80' },
  pad: { fill: '#6a6c70', stroke: null },
  range: { fill: '#bba67f', stroke: '#7a6a4c' },
  gravel: { fill: '#9c937f', stroke: null },
  vehicle: { fill: '#5b623f', stroke: '#2c2f22' }
};

let cache = null;
let objectiveTarget = null;
let tracking = false;

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

export function mapToImage(x, z) {
  return [(x - MAP_EXTENT.minX) * MAP_PX_PER_M, (z - MAP_EXTENT.minZ) * MAP_PX_PER_M];
}

function splatAt(x, z) {
  const { data, size } = splatInfo;
  if (!data) return [0, 0, 0, 0];
  const col = Math.min(size - 1, Math.max(0, Math.floor(((x - TERRAIN_EXTENT.minX) / (TERRAIN_EXTENT.maxX - TERRAIN_EXTENT.minX)) * size)));
  const row = Math.min(size - 1, Math.max(0, Math.floor(((z - TERRAIN_EXTENT.minZ) / (TERRAIN_EXTENT.maxZ - TERRAIN_EXTENT.minZ)) * size)));
  const i = (row * size + col) * 4;
  return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, data[i + 3] / 255];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function shadedGround() {
  const cols = Math.ceil((MAP_EXTENT.maxX - MAP_EXTENT.minX) / SAMPLE_STEP);
  const rows = Math.ceil((MAP_EXTENT.maxZ - MAP_EXTENT.minZ) / SAMPLE_STEP);
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(cols, rows);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) heights[r * (cols + 1) + c] = getTerrainHeight(MAP_EXTENT.minX + c * SAMPLE_STEP, MAP_EXTENT.minZ + r * SAMPLE_STEP);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = MAP_EXTENT.minX + (c + 0.5) * SAMPLE_STEP;
      const z = MAP_EXTENT.minZ + (r + 0.5) * SAMPLE_STEP;
      const h = heights[r * (cols + 1) + c];
      const dx = heights[r * (cols + 1) + c + 1] - h;
      const dz = heights[(r + 1) * (cols + 1) + c] - h;
      const n = normalize([-dx, SAMPLE_STEP, -dz]);
      const shade = 0.62 + 0.55 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) + Math.min(0.12, h * 0.008);
      const desert = desertFactor(z);
      const [sr, sg, sb, sa] = splatAt(x, z);
      let color = mix(COLORS.golan, COLORS.sand, desert);
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

function strokePath(ctx, points, color, width, dash) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  points.forEach(([x, z], i) => {
    const [px, py] = mapToImage(x, z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVectors(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of ROADS) {
    const w = road.width * MAP_PX_PER_M;
    if (road.kind === 'asphalt') {
      strokePath(ctx, road.points, '#e8e0cc', w + 2.5);
      strokePath(ctx, road.points, '#45464b', w);
    } else {
      strokePath(ctx, road.points, 'rgba(110, 82, 52, 0.85)', w * 0.8, [6, 4]);
    }
  }
  for (const wall of WALLS) {
    const style = WALL_STYLES[wall.kind];
    strokePath(ctx, [wall.from, wall.to], style.color, style.width, style.dash);
  }
  for (const fp of FOOTPRINTS) {
    const style = FOOTPRINT_STYLES[fp.kind];
    const [px, py] = mapToImage(fp.x - fp.w / 2, fp.z - fp.d / 2);
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
    const w = BERM.halfWidth;
    strokePath(ctx, [[rx + BERM.gapFrom, rz + BERM.back], [rx - w, rz + BERM.back], [rx - w, rz + BERM.front]], '#6e5640', 5);
    strokePath(ctx, [[rx + w, rz + BERM.back - 2.5], [rx + w, rz + BERM.front]], '#6e5640', 5);
    const [bx, by] = mapToImage(rx - 1.7, rz + GUN_BODY_OFFSET - 3.3);
    ctx.fillStyle = '#4e5532';
    ctx.fillRect(bx, by, 3.4 * MAP_PX_PER_M, 6.6 * MAP_PX_PER_M);
    strokePath(ctx, [[rx, rz + GUN_BODY_OFFSET - 2], [rx, rz + GUN_BODY_OFFSET - 9]], '#2c2f22', 2);
  }
  ctx.fillStyle = '#4f6a3a';
  for (const [x, z] of TREES) {
    const [px, py] = mapToImage(x, z);
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getMapImage() {
  if (cache) return cache;
  const canvas = document.createElement('canvas');
  canvas.width = (MAP_EXTENT.maxX - MAP_EXTENT.minX) * MAP_PX_PER_M;
  canvas.height = (MAP_EXTENT.maxZ - MAP_EXTENT.minZ) * MAP_PX_PER_M;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadedGround(), 0, 0, canvas.width, canvas.height);
  drawVectors(ctx);
  cache = canvas;
  return cache;
}

export function getMapLabels() {
  const regionLabels = Object.values(REGIONS).map((region) => {
    const [minX, maxX, minZ, maxZ] = region.rect;
    const anchor = { shivta: [0, 52], yoav: [-112, -137], line: [20, -214] }[region.id] || [(minX + maxX) / 2, (minZ + maxZ) / 2];
    return { x: anchor[0], z: anchor[1], text: region.name, kind: 'region' };
  });
  const landmarkLabels = [
    [LANDMARKS.doherPos, 'דוהר 2'], [LANDMARKS.roemPos, 'רועם'], [LANDMARKS.mafikPos, 'מפי"ק'], [LANDMARKS.rangeConsole, 'מטווח'],
    [LANDMARKS.shop, 'אפסנאות'], [LANDMARKS.spawn, 'רחבת מסדרים'], [LANDMARKS.yamachDepot, 'ימ"ח'], [LANDMARKS.batteryTents, 'אוהלים']
  ].map(([p, text]) => ({ x: p.x, z: p.z, text, kind: 'landmark' }));
  return [...regionLabels, ...MAP_LABELS.map((l) => ({ ...l, kind: 'landmark' })), ...landmarkLabels];
}

function toPoint(pos) {
  if (Array.isArray(pos)) return { x: pos[0], z: pos[2] };
  return pos && typeof pos.x === 'number' && typeof pos.z === 'number' ? { x: pos.x, z: pos.z } : null;
}

export function trackObjective() {
  if (tracking) return;
  tracking = true;
  on('mission:objective_updated', (payload) => {
    if (payload?.targetWorldPos) objectiveTarget = toPoint(payload.targetWorldPos);
  });
  on('mission:completed', () => {
    objectiveTarget = null;
  });
}

export function getObjectiveTarget() {
  if (objectiveTarget) return objectiveTarget;
  const mission = MISSIONS[save.activeMissionId] || MISSIONS.base;
  return toPoint(mission?.markerPos);
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
