import { REGIONS } from './world-layout.js';
import { MAPS, loadMap, getCurrentMapId } from './maps/map-registry.js';
import {
  getMapBounds,
  getMapImage,
  mapToImage,
  getMapLabels,
  getObjectiveInfo,
  drawPlayerArrow,
  trackObjective,
  drawMissionIcon,
  extractEntityPos,
  isEntityActive,
  drawDroneDot
} from './map-image.js';
import { getMapMarkers, hasRemainingMissions } from './current-target.js';
import { getDrones } from './entities.js';
import { player, runtime } from './state.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { closeAllModals, setModalVisible } from './modal-manager.js';
import { resetRouteCache, getRouteForObjective, computeFitRect, drawRoute } from './full-map-route.js';
import { MODAL_ID, ensureStylesheet, ensureFullMapDom, syncToggleButton, updateMissionCard, drawTargetAndLabel } from './full-map-card.js';

const REGION_FONT = 'bold 15px Tahoma, Arial, sans-serif';
const LANDMARK_FONT = 'bold 12px Tahoma, Arial, sans-serif';
const DETECT_RANGE_M = 80;
const RESET_RANGE_M = 100;
const MAP_ICONS = { shivta: '🏜️', yoav: '🏕️', line: '💥', zaura: '🌋', beit_hillel: '🌿', tzeelim: '🎯' };

let bound = false;
let zoomMode = 'fit';
let rafId = 0;

function setDataset(el, key, value) {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

function isFullMapOpen() {
  const modal = document.getElementById(MODAL_ID);
  return Boolean(modal && !modal.classList.contains('hidden'));
}

function handleZoomToggle() {
  zoomMode = zoomMode === 'fit' ? 'all' : 'fit';
  syncToggleButton(zoomMode);
  drawMap();
}

function renderTravelList() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  let list = document.getElementById('full-map-travel-list');
  if (!list) {
    const side = modal.querySelector('.full-map-side') || modal.querySelector('.modal-body') || modal;
    list = document.createElement('div');
    list.id = 'full-map-travel-list';
    list.className = 'travel-list';
    list.dataset.travelList = '1';
    side.appendChild(list);
  }
  list.innerHTML = '';
  for (const [id, m] of Object.entries(MAPS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary btn-travel';
    btn.dataset.map = id;
    btn.dataset.region = id;
    btn.textContent = `${MAP_ICONS[id] || '📍'} ${m.nameHe}`;
    btn.addEventListener('click', async () => {
      await loadMap(id);
      closeFullMap();
    });
    list.appendChild(btn);
  }
}

function fitWorldRect(canvas, rect, dpr, mapId) {
  const [ix0, iy0] = mapToImage(rect.minX, rect.minZ, mapId);
  const [ix1, iy1] = mapToImage(rect.maxX, rect.maxZ, mapId);
  const srcW = Math.max(1, ix1 - ix0);
  const srcH = Math.max(1, iy1 - iy0);
  const padPx = zoomMode === 'fit' ? 24 * dpr : 0;
  const scale = Math.min(Math.max(0.05, (canvas.width - padPx) / srcW), Math.max(0.05, (canvas.height - padPx) / srcH));
  return {
    scale,
    offsetX: canvas.width / 2 - (ix0 + srcW / 2) * scale,
    offsetY: canvas.height / 2 - (iy0 + srcH / 2) * scale
  };
}

function drawLabels(ctx, toScreen, dpr, mapId) {
  const placed = [];
  for (const label of getMapLabels(mapId)) {
    const [x, y] = toScreen(label.x, label.z);
    ctx.font = label.kind === 'region' ? REGION_FONT : LANDMARK_FONT;
    ctx.font = ctx.font.replace(/(\d+)px/, (_, px) => `${Math.round(px * dpr)}px`);
    const width = ctx.measureText(label.text).width + 8 * dpr;
    const height = (label.kind === 'region' ? 19 : 15) * dpr;
    const box = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
    if (placed.some((p) => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top)) continue;
    placed.push(box);
    ctx.fillStyle = label.kind === 'region' ? 'rgba(18, 30, 34, 0.82)' : 'rgba(12, 16, 18, 0.62)';
    ctx.fillRect(box.left, box.top, width, height);
    ctx.fillStyle = label.kind === 'region' ? '#7ee8dc' : '#f4efe0';
    ctx.fillText(label.text, x, y + 1);
  }
}

function drawFullMapDrones(ctx, canvas, toScreen, dpr, pulse) {
  let threatDots = 0;
  let firstX = '';
  let firstY = '';
  for (const drone of getDrones()) {
    const pos = isEntityActive(drone) && extractEntityPos(drone);
    if (!pos) continue;
    const dist = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
    if (dist > DETECT_RANGE_M && (!drone._threatAlerted || dist > RESET_RANGE_M)) continue;
    const [dx, dy] = toScreen(pos.x, pos.z);
    if (dx < 0 || dy < 0 || dx > canvas.width || dy > canvas.height) continue;
    drawDroneDot(ctx, dx, dy, drone.enemyType, dpr, pulse);
    if (threatDots === 0) {
      firstX = dx.toFixed(1);
      firstY = dy.toFixed(1);
    }
    threatDots += 1;
  }
  setDataset(canvas, 'threatDots', String(threatDots));
  setDataset(canvas, 'threatX', firstX);
  setDataset(canvas, 'threatY', firstY);
}

function drawMap() {
  const canvas = document.getElementById('full-map-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const nextW = Math.max(1, Math.round(rect.width * dpr));
  const nextH = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== nextW) canvas.width = nextW;
  if (canvas.height !== nextH) canvas.height = nextH;
  const ctx = canvas.getContext('2d');
  const mapId = getCurrentMapId();
  const bounds = getMapBounds(mapId);
  const image = getMapImage(mapId);
  const info = getObjectiveInfo();
  const target = hasRemainingMissions() ? info.target : null;
  updateMissionCard(info);
  const route = target ? getRouteForObjective(player.pos, target) : null;
  const worldRect = zoomMode === 'fit' ? computeFitRect(player.pos, target, route, bounds) : bounds;
  const { scale, offsetX, offsetY } = fitWorldRect(canvas, worldRect, dpr, mapId);
  const toScreen = (x, z) => {
    const [ix, iy] = mapToImage(x, z, mapId);
    return [offsetX + ix * scale, offsetY + iy * scale];
  };

  ctx.fillStyle = '#10161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, image.width * scale, image.height * scale);

  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(126, 232, 220, 0.95)';
  const regionRect = REGIONS[mapId]?.rect;
  const [bx0, by0] = toScreen(regionRect ? regionRect[0] : bounds.minX, regionRect ? regionRect[2] : bounds.minZ);
  const [bx1, by1] = toScreen(regionRect ? regionRect[1] : bounds.maxX, regionRect ? regionRect[3] : bounds.maxZ);
  ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  drawLabels(ctx, toScreen, dpr, mapId);
  drawRoute(ctx, route, toScreen, dpr);

  let missionIcons = 0;
  for (const m of getMapMarkers()) {
    const [mx, my] = toScreen(m.x, m.z);
    if (mx < 0 || my < 0 || mx > canvas.width || my > canvas.height) continue;
    drawMissionIcon(ctx, mx, my, dpr);
    missionIcons += 1;
  }
  setDataset(canvas, 'missionMarkers', String(missionIcons));

  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 5);
  drawFullMapDrones(ctx, canvas, toScreen, dpr, pulse);

  if (target) {
    const [tx, ty] = drawTargetAndLabel(ctx, target, info.objectiveText, toScreen, dpr, pulse);
    setDataset(canvas, 'objX', tx.toFixed(1));
    setDataset(canvas, 'objY', ty.toFixed(1));
  } else {
    setDataset(canvas, 'objX', '');
    setDataset(canvas, 'objY', '');
  }

  const [px, py] = toScreen(player.pos.x, player.pos.z);
  drawPlayerArrow(ctx, px, py, player.yaw, 7 * dpr);
  setDataset(canvas, 'playerX', px.toFixed(1));
  setDataset(canvas, 'playerY', py.toFixed(1));
  setDataset(canvas, 'scale', scale.toFixed(4));
  setDataset(canvas, 'zoomMode', zoomMode);

  for (const button of document.querySelectorAll('#full-map-travel-list .btn-travel')) {
    button.classList.toggle('active', button.dataset.map === mapId || button.dataset.region === mapId);
  }
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function tick() {
  if (!isFullMapOpen()) {
    rafId = 0;
    return;
  }
  drawMap();
  rafId = requestAnimationFrame(tick);
}

function closeFullMap() {
  stopLoop();
  resetRouteCache();
  setModalVisible(MODAL_ID, false);
  runtime.fullMapOpen = false;
  closeAllModals();
}

export function openFullMap() {
  if (!runtime.isPlaying || runtime.isDead || runtime.modalOpen || runtime.shopOpen || runtime.campaignModalOpen || isFullMapOpen()) return;
  ensureStylesheet();
  ensureFullMapDom(handleZoomToggle);
  if (!document.querySelector('#full-map-travel-list .btn-travel')) renderTravelList();
  resetInputState();
  releaseGameLock();
  runtime.modalOpen = true;
  runtime.fullMapOpen = true;
  zoomMode = 'fit';
  resetRouteCache();
  syncToggleButton(zoomMode);
  setModalVisible(MODAL_ID, true);
  drawMap();
  stopLoop();
  rafId = requestAnimationFrame(tick);
}

export function initFullMap() {
  trackObjective();
  ensureStylesheet();
  ensureFullMapDom(handleZoomToggle);
  renderTravelList();
  if (bound) return;
  bound = true;
  document.getElementById('btn-close-full-map')?.addEventListener('click', closeFullMap);
  document.getElementById('btn-full-map-done')?.addEventListener('click', closeFullMap);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !isFullMapOpen()) openFullMap();
    if (e.code !== 'Escape' || !isFullMapOpen()) return;
    e.stopImmediatePropagation();
    closeFullMap();
  }, true);
  window.addEventListener('resize', () => {
    if (isFullMapOpen()) drawMap();
  });
}
