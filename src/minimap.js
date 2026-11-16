import { save, player, runtime } from './state.js';
import { getCurrentMapId } from './maps/map-registry.js';
import {
  getMapImage,
  mapToImage,
  MAP_PX_PER_M,
  getObjectiveTarget,
  trackObjective,
  drawPlayerArrow,
  drawMissionIcon,
  extractEntityPos,
  isEntityActive,
  drawDroneDot
} from './map-image.js';
import { getMapMarkers } from './current-target.js';
import { initFullMap, openFullMap } from './full-map.js';

const VIEW_METERS = 140;
const MINI_RADIUS = VIEW_METERS / 2;
const BASE_SIZE = 190;
const MAX_DPR = 2.5;

let unit = 1;
let cssScale = 1;
let canvas = null;
let ctx = null;

function setDataset(el, key, value) {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

export function initMinimap(canvasEl) {
  canvas = canvasEl || document.getElementById('minimap-canvas');
  ctx = canvas ? canvas.getContext('2d') : null;
  trackObjective();
  initFullMap();
  const wrap = canvas?.parentElement;
  if (wrap && !wrap.dataset.mapBound) {
    wrap.dataset.mapBound = '1';
    wrap.addEventListener('click', () => openFullMap());
  }
  getMapImage(getCurrentMapId());
}

function worldToMini(wx, wz) {
  const scale = canvas.width / VIEW_METERS;
  return [canvas.width / 2 + (wx - player.pos.x) * scale, canvas.height / 2 + (wz - player.pos.z) * scale];
}

function fitCanvasToScreen() {
  const cw = canvas.clientWidth || BASE_SIZE;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const target = Math.round(cw * dpr);
  if (target > 0 && canvas.width !== target) {
    canvas.width = target;
    canvas.height = target;
  }
  unit = canvas.width / BASE_SIZE;
  cssScale = canvas.width / cw;
}

function dot(wx, wz, radius, fill, stroke) {
  const [x, y] = worldToMini(wx, wz);
  ctx.beginPath();
  ctx.arc(x, y, radius * unit, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.6 * unit; ctx.stroke(); }
}

function drawDashedRoute(x0, y0, x1, y1) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([5.5 * cssScale, 4 * cssScale]);
  ctx.strokeStyle = 'rgba(20, 14, 4, 0.65)';
  ctx.lineWidth = 3.6 * cssScale;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = '#ffe05c';
  ctx.lineWidth = 2 * cssScale;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function edgePoint(angle, w, h, inset) {
  const wrap = canvas.parentElement || canvas;
  const br = parseFloat(getComputedStyle(wrap).borderTopLeftRadius) || 0;
  if (br >= (canvas.clientWidth || w) * 0.42) {
    const r = w / 2 - inset;
    return [w / 2 + Math.cos(angle) * r, h / 2 + Math.sin(angle) * r];
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const reach = Math.min((w / 2 - inset) / Math.max(1e-6, Math.abs(cos)), (h / 2 - inset) / Math.max(1e-6, Math.abs(sin)));
  return [w / 2 + cos * reach, h / 2 + sin * reach];
}

function drawObjective(pulse) {
  const target = getObjectiveTarget();
  if (!target) {
    setDataset(canvas, 'objInside', '');
    setDataset(canvas, 'objDist', '');
    setDataset(canvas, 'objX', '');
    setDataset(canvas, 'objY', '');
    setDataset(canvas, 'edgeX', '');
    setDataset(canvas, 'edgeY', '');
    return;
  }
  const [x, y] = worldToMini(target.x, target.z);
  const w = canvas.width;
  const h = canvas.height;
  const dist = Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z));
  setDataset(canvas, 'objX', x.toFixed(1));
  setDataset(canvas, 'objY', y.toFixed(1));
  setDataset(canvas, 'objDist', String(dist));

  const ringBase = Math.max(8 * cssScale, 9.5 * unit);
  const inset = ringBase + 3 * cssScale;
  if (x > inset && x < w - inset && y > inset && y < h - inset) {
    setDataset(canvas, 'objInside', '1');
    setDataset(canvas, 'edgeX', '');
    setDataset(canvas, 'edgeY', '');
    drawDashedRoute(w / 2, h / 2, x, y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, ringBase + pulse * 3.5 * cssScale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 136, 0, 0.24)';
    ctx.fill();
    ctx.lineWidth = 2.6 * cssScale;
    ctx.strokeStyle = '#1d1202';
    ctx.stroke();
    ctx.lineWidth = 1.8 * cssScale;
    ctx.strokeStyle = '#ff9f1c';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3.6 * cssScale, 4.2 * unit), 0, Math.PI * 2);
    ctx.fillStyle = '#ff6a00';
    ctx.fill();
    ctx.lineWidth = 1.4 * cssScale;
    ctx.strokeStyle = '#fff3b0';
    ctx.stroke();
    ctx.restore();
    return;
  }

  setDataset(canvas, 'objInside', '0');
  const angle = Math.atan2(y - h / 2, x - w / 2);
  const [ex, ey] = edgePoint(angle, w, h, 11 * cssScale);
  setDataset(canvas, 'edgeX', ex.toFixed(1));
  setDataset(canvas, 'edgeY', ey.toFixed(1));
  drawDashedRoute(w / 2, h / 2, ex, ey);

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  const s = Math.max(1.1 * cssScale, 1.3 * unit);
  ctx.beginPath();
  ctx.moveTo(8 * s, 0);
  ctx.lineTo(-6 * s, -6.5 * s);
  ctx.lineTo(-3 * s, 0);
  ctx.lineTo(-6 * s, 6.5 * s);
  ctx.closePath();
  ctx.fillStyle = '#ff9f1c';
  ctx.fill();
  ctx.strokeStyle = '#1d1202';
  ctx.lineWidth = 1.8 * cssScale;
  ctx.stroke();
  ctx.restore();

  const label = `${dist}m`;
  const fontPx = Math.round(Math.max(10 * cssScale, 10.5 * unit));
  ctx.save();
  ctx.font = `bold ${fontPx}px Tahoma, Arial, sans-serif`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + 8 * cssScale;
  const th = fontPx + 4 * cssScale;
  const inward = 15 * cssScale;
  const lx = Math.min(w - tw / 2 - 2 * cssScale, Math.max(tw / 2 + 2 * cssScale, ex - Math.cos(angle) * inward));
  const ly = Math.min(h - th / 2 - 2 * cssScale, Math.max(th / 2 + 2 * cssScale, ey - Math.sin(angle) * inward));
  ctx.fillStyle = 'rgba(14, 18, 22, 0.88)';
  ctx.fillRect(lx - tw / 2, ly - th / 2, tw, th);
  ctx.strokeStyle = '#ff9f1c';
  ctx.lineWidth = 1 * cssScale;
  ctx.strokeRect(lx - tw / 2, ly - th / 2, tw, th);
  ctx.fillStyle = '#ffe875';
  ctx.fillText(label, lx, ly + 0.5 * cssScale);
  ctx.restore();
}

function drawMissionMarkers() {
  const w = canvas.width;
  const h = canvas.height;
  const s = Math.max(0.85 * cssScale, 1 * unit);
  let drawn = 0;
  for (const m of getMapMarkers()) {
    const [x, y] = worldToMini(m.x, m.z);
    if (x < 3 || y < 3 || x > w - 3 || y > h - 3) continue;
    drawMissionIcon(ctx, x, y, s);
    drawn += 1;
  }
  setDataset(canvas, 'missionMarkers', String(drawn));
}

function drawEntities(entitiesApi, pulse) {
  if (Array.isArray(entitiesApi?.checkpoints) && !save.completed.patrol) {
    entitiesApi.checkpoints.forEach((cp, idx) => {
      if (idx < runtime.patrolStep) return;
      const pos = extractEntityPos(cp);
      if (pos) dot(pos.x, pos.z, idx === runtime.patrolStep ? 4.5 : 3, idx === runtime.patrolStep ? '#4bc6ff' : 'rgba(75, 198, 255, 0.5)');
    });
  }
  const scan = save.profile.roleId === 'rokhash' && runtime.abilityActiveLeft > 0;
  if (Array.isArray(entitiesApi?.borderTransmitters) && (save.profile.roleId === 'rokhash' || scan)) {
    for (const tx of entitiesApi.borderTransmitters) {
      const pos = isEntityActive(tx) && extractEntityPos(tx);
      if (pos) dot(pos.x, pos.z, 4, '#ff9838', scan ? '#ffd15c' : null);
    }
  }
  const mafikAlert = save.profile.roleId === 'mafik';
  let threatDots = 0;
  for (const drone of entitiesApi?.drones || []) {
    const pos = isEntityActive(drone) && extractEntityPos(drone);
    if (!pos) continue;
    if (Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) > MINI_RADIUS) continue;
    const [dx, dy] = worldToMini(pos.x, pos.z);
    if (mafikAlert) {
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = drone.enemyType === 'recon_drone' ? 'rgba(255, 170, 34, 0.5)' : 'rgba(255, 90, 90, 0.5)';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(dx, dy);
      ctx.stroke();
      ctx.restore();
    }
    drawDroneDot(ctx, dx, dy, drone.enemyType, unit, pulse);
    threatDots += 1;
  }
  setDataset(canvas, 'threatDots', String(threatDots));
}

export function drawMinimap(entitiesApi) {
  if (!ctx || !canvas) {
    initMinimap(document.getElementById('minimap-canvas'));
    if (!ctx || !canvas) return;
  }
  fitCanvasToScreen();
  const w = canvas.width;
  const h = canvas.height;
  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 6);
  const mapId = getCurrentMapId();
  const img = getMapImage(mapId);
  const [ix, iy] = mapToImage(player.pos.x, player.pos.z, mapId);
  const src = VIEW_METERS * MAP_PX_PER_M;
  const sx0 = ix - src / 2;
  const sy0 = iy - src / 2;
  const cx0 = Math.max(0, sx0);
  const cy0 = Math.max(0, sy0);
  const cx1 = Math.min(img.width, sx0 + src);
  const cy1 = Math.min(img.height, sy0 + src);
  ctx.fillStyle = '#20251a';
  ctx.fillRect(0, 0, w, h);
  if (cx1 > cx0 && cy1 > cy0) {
    const k = w / src;
    ctx.drawImage(img, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx0) * k, (cy0 - sy0) * k, (cx1 - cx0) * k, (cy1 - cy0) * k);
  }
  drawEntities(entitiesApi, pulse);
  drawMissionMarkers();
  drawObjective(pulse);
  if (runtime.abilityActiveLeft > 0) dot(player.pos.x, player.pos.z, 12 + pulse * 6, null, 'rgba(126, 227, 255, 0.55)');
  drawPlayerArrow(ctx, w / 2, h / 2, player.yaw, Math.max(5.5 * cssScale, 6.5 * unit));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = 2.8 * cssScale;
  ctx.font = `bold ${Math.round(Math.max(11 * cssScale, 14 * unit))}px Tahoma, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeText('צ', w / 2, 13 * cssScale);
  ctx.fillText('צ', w / 2, 13 * cssScale);
}
