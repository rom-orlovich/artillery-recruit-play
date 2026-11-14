import { REGIONS } from './world-layout.js';
import { MAP_EXTENT, getMapImage, mapToImage, getMapLabels, getObjectiveInfo, drawPlayerArrow, trackObjective } from './map-image.js';
import { player, runtime } from './state.js';
import { travelTo, getRegionAt } from './world.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { closeAllModals, setModalVisible } from './modal-manager.js';
import { resetRouteCache, getRouteForObjective, computeFitRect, drawRoute } from './full-map-route.js';
import { MODAL_ID, ensureStylesheet, ensureFullMapDom, syncToggleButton, updateMissionCard, drawTargetAndLabel } from './full-map-card.js';

const REGION_FONT = 'bold 15px Tahoma, Arial, sans-serif';
const LANDMARK_FONT = 'bold 12px Tahoma, Arial, sans-serif';

let bound = false;
let zoomMode = 'fit';
let rafId = 0;

function isFullMapOpen() {
  const modal = document.getElementById(MODAL_ID);
  return Boolean(modal && !modal.classList.contains('hidden'));
}

function handleZoomToggle() {
  zoomMode = zoomMode === 'fit' ? 'all' : 'fit';
  syncToggleButton(zoomMode);
  drawMap();
}

function fitWorldRect(canvas, rect, dpr) {
  const [ix0, iy0] = mapToImage(rect.minX, rect.minZ);
  const [ix1, iy1] = mapToImage(rect.maxX, rect.maxZ);
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

function drawLabels(ctx, toScreen, dpr) {
  const placed = [];
  for (const label of getMapLabels()) {
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
  const image = getMapImage();
  const info = getObjectiveInfo();
  const target = info.target;
  updateMissionCard(info);
  const route = target ? getRouteForObjective(player.pos, target) : null;
  const worldRect = zoomMode === 'fit' ? computeFitRect(player.pos, target, route) : MAP_EXTENT;
  const { scale, offsetX, offsetY } = fitWorldRect(canvas, worldRect, dpr);
  const toScreen = (x, z) => {
    const [ix, iy] = mapToImage(x, z);
    return [offsetX + ix * scale, offsetY + iy * scale];
  };

  ctx.fillStyle = '#10161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, image.width * scale, image.height * scale);

  const active = getRegionAt(player.pos.x, player.pos.z);
  ctx.lineWidth = 2 * dpr;
  for (const region of Object.values(REGIONS)) {
    const [minX, maxX, minZ, maxZ] = region.rect;
    const [x0, y0] = toScreen(Math.max(minX, -208), Math.max(minZ, -448));
    const [x1, y1] = toScreen(Math.min(maxX, 208), Math.min(maxZ, 98));
    ctx.setLineDash(region.id === active ? [] : [6 * dpr, 5 * dpr]);
    ctx.strokeStyle = region.id === active ? 'rgba(126, 232, 220, 0.95)' : 'rgba(255, 255, 255, 0.35)';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  drawLabels(ctx, toScreen, dpr);
  drawRoute(ctx, route, toScreen, dpr);

  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 5);
  if (target) {
    const [tx, ty] = drawTargetAndLabel(ctx, target, info.objectiveText, toScreen, dpr, pulse);
    canvas.dataset.objX = tx.toFixed(1);
    canvas.dataset.objY = ty.toFixed(1);
  } else {
    canvas.dataset.objX = '';
    canvas.dataset.objY = '';
  }

  const [px, py] = toScreen(player.pos.x, player.pos.z);
  drawPlayerArrow(ctx, px, py, player.yaw, 7 * dpr);
  canvas.dataset.playerX = px.toFixed(1);
  canvas.dataset.playerY = py.toFixed(1);
  canvas.dataset.scale = scale.toFixed(4);
  canvas.dataset.zoomMode = zoomMode;

  for (const button of document.querySelectorAll('.btn-travel')) button.classList.toggle('active', button.dataset.region === active);
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
  closeAllModals();
}

export function openFullMap() {
  if (!runtime.isPlaying || runtime.isDead || runtime.modalOpen || runtime.shopOpen || runtime.campaignModalOpen || isFullMapOpen()) return;
  ensureStylesheet();
  ensureFullMapDom(handleZoomToggle);
  resetInputState();
  releaseGameLock();
  runtime.modalOpen = true;
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
  if (bound) return;
  bound = true;
  document.getElementById('btn-close-full-map')?.addEventListener('click', closeFullMap);
  for (const button of document.querySelectorAll('.btn-travel')) {
    button.addEventListener('click', () => {
      travelTo(button.dataset.region);
      closeFullMap();
    });
  }
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
