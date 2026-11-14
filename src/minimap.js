import { save, player, runtime } from './state.js';
import { getMapImage, mapToImage, MAP_PX_PER_M, getObjectiveTarget, trackObjective, drawPlayerArrow } from './map-image.js';
import { initFullMap, openFullMap } from './full-map.js';

const VIEW_METERS = 140;
const BASE_SIZE = 190;
const MAX_DPR = 2.5;

let unit = 1;

let canvas = null;
let ctx = null;

function extractPos(item) {
  if (!item) return null;
  const p = item.mesh?.position || item.position || item.pos || item;
  if (p && typeof p.x === 'number' && typeof p.z === 'number') return { x: p.x, z: p.z };
  return null;
}

function isEntityActive(item) {
  if (!item) return false;
  if (item.alive === false || item.active === false || item.destroyed === true) return false;
  return !(item.mesh && item.mesh.visible === false);
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
  getMapImage();
}

function worldToMini(wx, wz) {
  const scale = canvas.width / VIEW_METERS;
  return [canvas.width / 2 + (wx - player.pos.x) * scale, canvas.height / 2 + (wz - player.pos.z) * scale];
}

function fitCanvasToScreen() {
  const target = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, MAX_DPR));
  if (target > 0 && canvas.width !== target) {
    canvas.width = target;
    canvas.height = target;
  }
  unit = canvas.width / BASE_SIZE;
}

function dot(wx, wz, radius, fill, stroke) {
  const [x, y] = worldToMini(wx, wz);
  ctx.beginPath();
  ctx.arc(x, y, radius * unit, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6 * unit;
    ctx.stroke();
  }
}

function drawObjective(pulse) {
  const target = getObjectiveTarget();
  if (!target) return;
  const [x, y] = worldToMini(target.x, target.z);
  const w = canvas.width;
  const h = canvas.height;
  const inset = 9 * unit;
  if (x > inset && x < w - inset && y > inset && y < h - inset) {
    dot(target.x, target.z, 4.5, '#ffd15c', '#2a2008');
    dot(target.x, target.z, 8 + pulse * 4, null, 'rgba(255, 209, 92, 0.85)');
    return;
  }
  const angle = Math.atan2(y - h / 2, x - w / 2);
  const reach = Math.min((w / 2 - inset) / Math.abs(Math.cos(angle) || 1e-6), (h / 2 - inset) / Math.abs(Math.sin(angle) || 1e-6));
  ctx.save();
  ctx.translate(w / 2 + Math.cos(angle) * reach, h / 2 + Math.sin(angle) * reach);
  ctx.rotate(angle);
  ctx.scale(unit, unit);
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -6.5);
  ctx.lineTo(-6, 6.5);
  ctx.closePath();
  ctx.fillStyle = '#ffd15c';
  ctx.fill();
  ctx.strokeStyle = '#2a2008';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawEntities(entitiesApi, pulse) {
  if (Array.isArray(entitiesApi?.checkpoints) && !save.completed.patrol) {
    entitiesApi.checkpoints.forEach((cp, idx) => {
      if (idx < runtime.patrolStep) return;
      const pos = extractPos(cp);
      if (pos) dot(pos.x, pos.z, idx === runtime.patrolStep ? 4.5 : 3, idx === runtime.patrolStep ? '#4bc6ff' : 'rgba(75, 198, 255, 0.5)');
    });
  }
  const scan = save.profile.roleId === 'rokhash' && runtime.abilityActiveLeft > 0;
  if (Array.isArray(entitiesApi?.borderTransmitters) && (save.profile.roleId === 'rokhash' || scan)) {
    for (const tx of entitiesApi.borderTransmitters) {
      const pos = isEntityActive(tx) && extractPos(tx);
      if (pos) dot(pos.x, pos.z, 4, '#ff9838', scan ? '#ffd15c' : null);
    }
  }
  const mafikAlert = save.profile.roleId === 'mafik';
  for (const drone of entitiesApi?.drones || []) {
    const pos = isEntityActive(drone) && extractPos(drone);
    if (!pos) continue;
    if (mafikAlert) {
      const [dx, dy] = worldToMini(pos.x, pos.z);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.5)';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(dx, dy);
      ctx.stroke();
      ctx.restore();
    }
    dot(pos.x, pos.z, 4, '#ff3b3b', '#3a0b0b');
    if (mafikAlert || scan) dot(pos.x, pos.z, 7 + pulse * 3, null, 'rgba(255, 90, 90, 0.85)');
  }
}

export function drawMinimap(entitiesApi) {
  if (!ctx || !canvas) {
    initMinimap(document.getElementById('minimap-canvas'));
    if (!ctx || !canvas) return;
  }
  fitCanvasToScreen();
  const w = canvas.width;
  const h = canvas.height;
  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 5);
  const [ix, iy] = mapToImage(player.pos.x, player.pos.z);
  const src = VIEW_METERS * MAP_PX_PER_M;
  ctx.fillStyle = '#20251a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(getMapImage(), ix - src / 2, iy - src / 2, src, src, 0, 0, w, h);
  drawEntities(entitiesApi, pulse);
  drawObjective(pulse);
  if (runtime.abilityActiveLeft > 0) dot(player.pos.x, player.pos.z, 12 + pulse * 6, null, 'rgba(126, 227, 255, 0.55)');
  drawPlayerArrow(ctx, w / 2, h / 2, player.yaw, 7 * unit);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 3 * unit;
  ctx.font = `bold ${Math.round(16 * unit)}px Tahoma, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeText('צ', w / 2, 17 * unit);
  ctx.fillText('צ', w / 2, 17 * unit);
}
